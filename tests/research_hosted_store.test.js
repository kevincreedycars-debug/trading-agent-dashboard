'use strict';

// Hosted delivery without a local service.
//
// This suite stands a fixture in place of the Supabase project: the same routes the page's client calls
// (auth token, research_documents, the private object bucket and its signed links), answered from memory. No
// process is started, no port is opened and no request leaves the fixture, so the proof holds with the local
// research service stopped - it is never asked for anything. Every recorded request must also address the
// project host and nothing loopback.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const hosted = require(path.join(__dirname, '..', 'lib', 'research_hosted_store.js'));

const PROJECT = 'https://project.test';
const repoRoot = path.join(__dirname, '..');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function jwtFor(sub) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.fixture-signature`;
}

// A response the page's client can read: headers.get, json, text and arrayBuffer.
function response(status, body, type) {
  const text = typeof body === 'string' ? body : JSON.stringify(body === undefined ? null : body);
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(text);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => (String(name).toLowerCase() === 'content-type' ? (type || 'application/json') : null) },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => text,
    arrayBuffer: async () => bytes
  };
}

// The fixture project, in memory.
function fixtureProject() {
  const objects = new Map();
  const rows = [];
  const calls = [];
  let sequence = 0;
  const fetchImpl = async (target, init = {}) => {
    const address = String(target);
    const method = String(init.method || 'GET').toUpperCase();
    calls.push({ url: address, method });
    const url = new URL(address);
    const route = url.pathname;

    if (route === '/auth/v1/token') {
      const body = JSON.parse(String(init.body || '{}'));
      if (body.password !== 'fixture-password') return response(400, { error: 'invalid_grant' });
      return response(200, {
        access_token: jwtFor('worker-user'),
        refresh_token: 'fixture-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'worker-user' }
      });
    }

    if (route === '/rest/v1/research_documents' && method === 'GET') {
      const wanted = url.searchParams.get('topic_id') || '';
      const topic = wanted.startsWith('eq.') ? decodeURIComponent(wanted.slice(3)) : '';
      const found = rows
        .filter(row => !topic || row.topic_id === topic)
        .sort((a, b) => (a.stage - b.stage) || (a.version - b.version));
      return response(200, found);
    }

    if (route === '/rest/v1/research_documents' && method === 'POST') {
      const payload = JSON.parse(String(init.body || '{}'));
      sequence += 1;
      const row = Object.assign({ id: `row-${sequence}`, uploaded_at: new Date(2026, 9, 25, 12, 0, sequence).toISOString() }, payload);
      rows.push(row);
      return response(201, [row]);
    }

    if (route.startsWith('/storage/v1/object/sign/')) {
      const inner = decodeURIComponent(route.slice('/storage/v1/object/sign/'.length));
      const objectPath = inner.startsWith('research-documents/') ? inner.slice('research-documents/'.length) : inner;
      if (method === 'POST') {
        if (!objects.has(objectPath)) return response(400, { error: 'not_found' });
        return response(200, { signedURL: `/object/sign/research-documents/${objectPath.split('/').map(encodeURIComponent).join('/')}?token=fixture` });
      }
      if (url.searchParams.get('token') !== 'fixture') return response(400, { error: 'invalid_token' });
      if (!objects.has(objectPath)) return response(400, { error: 'not_found' });
      return response(200, objects.get(objectPath), 'text/markdown');
    }

    if (route.startsWith('/storage/v1/object/') && method === 'POST') {
      const inner = decodeURIComponent(route.slice('/storage/v1/object/'.length));
      if (!inner.startsWith('research-documents/')) return response(400, { error: 'unknown_bucket' });
      const objectPath = inner.slice('research-documents/'.length);
      if (objects.has(objectPath)) return response(409, { error: 'Duplicate' });
      objects.set(objectPath, Buffer.isBuffer(init.body) ? Buffer.from(init.body) : Buffer.from(String(init.body || '')));
      return response(200, { Key: objectPath });
    }

    return response(404, { error: 'not_handled', route, method });
  };
  return { fetchImpl, objects, rows, calls };
}

function adapterFor(project, overrides = {}) {
  return hosted.create({
    repoRoot,
    env: Object.assign({
      RESEARCH_SUPABASE_URL: PROJECT,
      RESEARCH_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
      RESEARCH_WORKER_EMAIL: 'worker@example.test',
      RESEARCH_WORKER_PASSWORD: 'fixture-password'
    }, overrides),
    fetch: project.fetchImpl
  });
}

const CHAIN = 'usd-factor-live-f5-dxy-delta';
const RESEARCH = Buffer.from('# Dollar index delta\n\nA returned research stage, as bytes.\n', 'utf8');
const RED_TEAM = Buffer.from('# Red team\n\nA returned red-team stage, as bytes.\n', 'utf8');
const PROVENANCE = {
  prompt_path: 'docs/research/factors/usd/live-f5-dxy-delta/01-research-prompt.md',
  prompt_sha256: 'c'.repeat(64),
  catalog_version: 'research-prompt-v3.1.0',
  envelope_sha256: 'd'.repeat(64)
};

function researchInput(extra = {}) {
  return Object.assign({
    topicId: CHAIN,
    stage: 1,
    title: 'Dollar index delta: research',
    kind: 'research',
    notes: 'Stage 1 of the fresh pilot chain, returned to the unattended supervisor.',
    model: 'gpt-6-astra session fixture',
    provenance: PROVENANCE,
    filename: 'live-f5-dxy-delta-research.md',
    bytes: RESEARCH
  }, extra);
}

test('an unconfigured runner refuses before any request and names what is missing', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project, { RESEARCH_WORKER_EMAIL: '', RESEARCH_WORKER_PASSWORD: '' });
  const status = adapter.status();
  assert.equal(status.configured, false);
  assert.deepEqual(status.needed, ['RESEARCH_WORKER_EMAIL', 'RESEARCH_WORKER_PASSWORD']);
  const result = await adapter.register(researchInput());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'hosted_not_configured');
  assert.match(result.message, /RESEARCH_WORKER_EMAIL/);
  assert.equal(project.calls.length, 0, 'an unconfigured runner must not touch the network');
});

test('a loopback project address is refused, because the store is hosted', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project, { RESEARCH_SUPABASE_URL: 'http://127.0.0.1:54321' });
  assert.equal(adapter.status().configured, false);
  assert.equal(adapter.status().loopback_refused, true);
  const result = await adapter.register(researchInput());
  assert.equal(result.code, 'hosted_not_configured');
  assert.match(result.message, /loopback/);
  assert.equal(project.calls.length, 0);
});

test('the worker signs in with its own account, not a browser session', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project);
  const signed = await adapter.signIn();
  assert.equal(signed.ok, true);
  assert.equal(adapter.status().signed_in, true);
  assert.equal(adapter.status().host, 'project.test');
  assert.equal(adapter.status().bucket, 'research-documents');
  const authCall = project.calls.find(call => call.url.endsWith('/auth/v1/token?grant_type=password'));
  assert.ok(authCall, 'the password grant is the only sign-in this runner uses');
  assert.equal(project.calls.some(call => call.url.includes('/auth/v1/authorize')), false, 'GitHub sign-in is not used by the runner');
});

test('upload, registration and byte-identical download happen against the hosted store only', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project);
  const result = await adapter.register(researchInput());
  assert.equal(result.ok, true, result.message);
  assert.equal(result.storage_path, `${CHAIN}/1/v1-${sha256(RESEARCH)}.md`);
  assert.equal(result.version, 1);
  assert.equal(result.readback.ok, true);
  assert.equal(result.readback.sha256, sha256(RESEARCH));
  assert.equal(result.readback.bytes, RESEARCH.length);

  const row = project.rows[0];
  assert.equal(row.topic_id, CHAIN);
  assert.equal(row.stage, 1);
  assert.equal(row.version, 1);
  assert.equal(row.sha256, sha256(RESEARCH));
  assert.equal(row.bytes, RESEARCH.length);
  assert.equal(row.storage_path, result.storage_path);
  assert.equal(row.uploaded_by, 'worker-user');
  // The note keeps the shape the page's reader parses: provenance, then the model label last.
  assert.match(row.notes, /Dispatch provenance: prompt docs\/research\/factors\/usd\/live-f5-dxy-delta\/01-research-prompt\.md, sha256 c{64}, catalog research-prompt-v3\.1\.0/);
  assert.match(row.notes, /Model or session: gpt-6-astra session fixture$/);

  const object = project.objects.get(result.storage_path);
  assert.equal(sha256(object), sha256(RESEARCH));
  assert.equal(object.equals(RESEARCH), true, 'the bucket holds the submitted bytes');

  for (const call of project.calls) {
    assert.ok(call.url.startsWith(PROJECT), `${call.url} is not on the project host`);
    assert.equal(/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(call.url), false, `${call.url} addressed loopback`);
  }
});

test('re-registering the same bytes adopts the row instead of storing a second copy', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project);
  const first = await adapter.register(researchInput());
  const second = await adapter.register(researchInput());
  assert.equal(second.ok, true, second.message);
  assert.equal(second.duplicate, true);
  assert.equal(second.row_id, first.row_id);
  assert.equal(project.rows.length, 1);
  assert.equal(project.objects.size, 1);
});

test('a review cannot attach to a research version the hosted store does not hold', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project);
  const orphan = await adapter.register(researchInput({
    stage: 2,
    kind: 'red_team',
    title: 'Dollar index delta: red team',
    bytes: RED_TEAM,
    parent: { stage_number: 1, version: 1 }
  }));
  assert.equal(orphan.ok, false);
  assert.equal(orphan.code, 'hosted_parent_missing');
  assert.equal(project.rows.length, 0, 'a refused review leaves no row behind');

  const research = await adapter.register(researchInput());
  const review = await adapter.register(researchInput({
    stage: 2,
    kind: 'red_team',
    title: 'Dollar index delta: red team',
    bytes: RED_TEAM,
    parent: { stage_number: 1, version: 1, sha256: sha256(RESEARCH) }
  }));
  assert.equal(review.ok, true, review.message);
  assert.equal(review.version, 1);
  assert.equal(review.storage_path, `${CHAIN}/2/v1-${sha256(RED_TEAM)}.md`);
  const reviewRow = project.rows.find(row => row.stage === 2);
  assert.equal(reviewRow.parent_research_id, research.row_id);
  assert.equal(reviewRow.parent_research_id, project.rows.find(row => row.stage === 1).id);
});

test('a review names the wrong parent hash and is refused', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project);
  await adapter.register(researchInput());
  const wrong = await adapter.register(researchInput({
    stage: 2,
    kind: 'red_team',
    title: 'Dollar index delta: red team',
    bytes: RED_TEAM,
    parent: { stage_number: 1, version: 1, sha256: 'e'.repeat(64) }
  }));
  assert.equal(wrong.ok, false);
  assert.equal(wrong.code, 'hosted_parent_missing');
  assert.match(wrong.message, /not the e{8}/);
});

test('a registration whose stored object does not match its row is reported, not passed', async () => {
  const project = fixtureProject();
  const adapter = adapterFor(project);
  const result = await adapter.register(researchInput());
  const stored = project.objects.get(result.storage_path);
  const tampered = Buffer.concat([stored, Buffer.from('\ntampered\n')]);
  project.objects.set(result.storage_path, tampered);
  const check = await adapter.verify({ id: result.row_id, storage_path: result.storage_path, sha256: sha256(RESEARCH), bytes: RESEARCH.length });
  assert.equal(check.ok, false);
  assert.equal(check.code, 'hosted_readback_mismatch');
  assert.equal(check.sha256, sha256(tampered));
  assert.equal(check.expected_sha256, sha256(RESEARCH));
});

test('the module itself carries no local service address', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'research_hosted_store.js'), 'utf8');
  // No URL literal at all: the only address this module can use is the one read from the deployed page or
  // the environment, so there is nothing here that could point at a local service.
  const literals = source.match(/https?:\/\/[^\s"'`]+/g) || [];
  assert.deepEqual(literals, []);
  assert.match(source, /research_upload_client\.js/, 'the runner reuses the page client rather than its own protocol');
  assert.match(source, /LOOPBACK/, 'a loopback project address is refused by name');
});

test('the project address and key come from the deployed page when the environment is silent', () => {
  const resolved = hosted.config({ repoRoot, env: { RESEARCH_WORKER_EMAIL: 'worker@example.test', RESEARCH_WORKER_PASSWORD: 'secret' } });
  assert.equal(resolved.ok, true);
  assert.match(resolved.url, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.equal(hosted.isLoopback(resolved.url), false);
  assert.equal(hosted.pageConfig(repoRoot).url, resolved.url);
});
