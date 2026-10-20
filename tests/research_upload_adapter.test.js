'use strict';

// Offline integration test: the upload adapter driving the real client, with every network call faked.
// It covers the round trip the dashboard performs, so a regression in either file fails here first.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

require(path.join(__dirname, '..', 'lib', 'research_upload_client.js'));
const adapter = require(path.join(__dirname, '..', 'lib', 'research_upload_adapter.js'));

const PROJECT_URL = 'https://demo-project.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_demo';
const STORAGE_KEY = 'sb-demo-project-auth-token';
const TOPIC = 'usd-topic-vix-level-and-risk-regime';
const USER_ID = '11111111-2222-3333-4444-555555555555';

function fakeJwt(sub) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub, role: 'authenticated' })).toString('base64url');
  return `${header}.${body}.signature`;
}

function fakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

function jsonResponse(body, status) {
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function byteResponse(bytes, status) {
  const buffer = Buffer.from(bytes);
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    headers: { get: () => 'text/markdown' },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    text: async () => buffer.toString('utf8')
  };
}

function harness(options) {
  const settings = options || {};
  const rows = [];
  const objects = new Map();
  const calls = [];
  const fetchImpl = async (url, init) => {
    const target = String(url);
    const method = String((init && init.method) || 'GET').toUpperCase();
    calls.push(`${method} ${target}`);
    if (target.includes('/auth/v1/otp')) return jsonResponse({}, 200);
    if (target.includes('/auth/v1/token?grant_type=password')) {
      const payload = JSON.parse(init.body);
      if (payload.password !== settings.password) return jsonResponse({ error: 'invalid_grant' }, 400);
      return jsonResponse({
        access_token: fakeJwt(USER_ID),
        refresh_token: 'refresh-demo',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: USER_ID }
      }, 200);
    }
    if (target.includes('/auth/v1/logout')) return jsonResponse({}, 204);
    if (target.includes('/rest/v1/research_documents')) {
      if (method === 'GET') {
        const filter = target.match(/topic_id=eq\.([^&]+)/);
        const wanted = filter ? decodeURIComponent(filter[1]) : '';
        return jsonResponse(rows.filter(row => !wanted || row.topic_id === wanted));
      }
      const payload = JSON.parse(init.body);
      const row = Object.assign({ id: `row-${rows.length + 1}`, uploaded_at: '2026-10-16T00:00:00.000Z' }, payload);
      rows.push(row);
      return jsonResponse([row], 201);
    }
    if (target.includes('/storage/v1/object/sign/') && method === 'POST') {
      const objectPath = decodeURIComponent(target.split('/storage/v1/object/sign/research-documents/')[1]);
      return jsonResponse({ signedURL: `/object/sign/research-documents/${objectPath}?token=demo` });
    }
    if (target.includes('/storage/v1/object/sign/') && method === 'GET') {
      const objectPath = decodeURIComponent(target.split('/storage/v1/object/sign/research-documents/')[1].split('?')[0]);
      if (settings.corruptDownload) return byteResponse(Buffer.from('tampered bytes'), 200);
      const stored = objects.get(objectPath);
      return byteResponse(stored || Buffer.from(''), 200);
    }
    if (target.includes('/storage/v1/object/research-documents/')) {
      const objectPath = decodeURIComponent(target.split('/storage/v1/object/research-documents/')[1]);
      objects.set(objectPath, Buffer.from(init.body));
      return jsonResponse({ Key: objectPath }, 200);
    }
    return jsonResponse({ message: 'unexpected request' }, 404);
  };

  const seed = settings.signedIn === false ? {} : { [STORAGE_KEY]: JSON.stringify({ access_token: fakeJwt(USER_ID), user_id: USER_ID }) };
  adapter.configure({ url: PROJECT_URL, key: PUBLISHABLE_KEY, fetch: fetchImpl, storage: fakeStorage(seed) });
  assert.equal(adapter.signedIn(), settings.signedIn !== false, 'the seeded session state must be recognised');
  return { rows, objects, calls, fetchImpl };
}

function stageFile(text) {
  const bytes = Buffer.from(text, 'utf8');
  return { name: 'red-team-return.md', type: 'text/markdown', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), bytes };
}

function topic() {
  return { topic_id: TOPIC, title: 'VIX, its change and the USD risk regime at the 05:00 London cutoff' };
}

function redTeamStage() {
  return { stage: 'red_team', label: 'Red-team', document_type: 'review' };
}

test('the account bar asks for an email and a password when signed out and offers sign-out when signed in', async () => {
  harness({ signedIn: false });
  const signedOut = adapter.accountBarHtml();
  assert.match(signedOut, /data-rl-account-signin/);
  assert.match(signedOut, /data-rl-account-email/);
  assert.match(signedOut, /data-rl-account-password/);
  assert.match(signedOut, /data-rl-account-password-signin/);
  assert.doesNotMatch(signedOut, /data-rl-account-signout/);

  harness({ signedIn: true });
  const signedIn = adapter.accountBarHtml();
  assert.match(signedIn, /data-rl-account-signout/);
  assert.doesNotMatch(signedIn, /data-rl-account-signin/);
  assert.match(signedIn, /Signed in/);
});

test('signing in from the account bar with a password turns the bar into a signed-in session', async () => {
  harness({ signedIn: false, password: 'owner-password' });
  assert.equal(adapter.signedIn(), false);

  const scope = {
    querySelector: selector => selector === '[data-rl-account-email]'
      ? { value: 'owner@example.com' }
      : selector === '[data-rl-account-password]' ? { value: 'owner-password' } : null
  };
  const button = {
    closest: selector => (selector === '[data-rl-account]' ? scope
      : selector === '[data-rl-account-password-signin]' ? {} : null)
  };

  const handled = await adapter.handleAccountAction(button);
  assert.equal(handled, true);
  assert.equal(adapter.signedIn(), true, 'a correct password produces a session');
  assert.match(adapter.accountBarHtml(), /Signed in/);
});

test('a stage upload stores the exact bytes under the stage path and records the parent', async () => {
  const world = harness({ signedIn: true });
  const file = stageFile('# Red-team return\n\nOne finding.\n');
  const expectedSha = crypto.createHash('sha256').update(file.bytes).digest('hex');

  const result = await adapter.uploadStage({
    topic: topic(),
    chainId: 'usd-chain-vix-level',
    stage: redTeamStage(),
    file,
    title: 'VIX red-team return',
    model: 'verification session',
    parents: { researchRef: 'usd-baseline-audit-01-vix-usd-report', parentVersion: 1 },
    onStored: async () => {}
  });

  assert.equal(result.ok, true, result.message);
  const objectPath = `usd-chain-vix-level/2/v1-${expectedSha}.md`;
  assert.ok(world.objects.has(objectPath), `stored object ${objectPath}`);
  assert.deepEqual(Buffer.from(world.objects.get(objectPath)), file.bytes, 'stored bytes are identical to the file');
  const row = world.rows[0];
  assert.equal(row.topic_id, 'usd-chain-vix-level', 'the chain is the store owner, not its display topic');
  assert.equal(row.stage, 2);
  assert.equal(row.version, 1);
  assert.equal(row.sha256, expectedSha);
  assert.equal(row.storage_path, objectPath);
  assert.equal(row.uploaded_by, USER_ID);
  assert.equal(row.original_filename, 'red-team-return.md', 'the uploaded file name is recorded for the card and the download');
  assert.match(row.notes, /Model or session: verification session/);
});

test('a final chain stage keeps its own stage name and owner', async () => {
  const world = harness({ signedIn: true });
  const file = stageFile('# Final red-team return\n\nOne finding.\n');
  const result = await adapter.uploadStage({
    topic: { topic_id: 'usd-final-topic', title: 'USD final chain' },
    chainId: 'usd-chain-final',
    stage: { stage: 'final_red_team', label: 'Final red-team', document_type: 'review' },
    file,
    title: 'USD final red-team return',
    model: 'session',
    parents: { researchRef: 'final-analysis-01' },
    onStored: async () => {}
  });

  assert.equal(result.ok, true, result.message);
  const row = world.rows[0];
  assert.equal(row.topic_id, 'usd-chain-final');
  assert.equal(row.stage, 2, 'the hosted table still uses its three numeric stages');
  assert.equal(row.kind, 'final_red_team', 'the final stage name is kept in the kind column');

  let documents = { documents: [] };
  const merged = await adapter.refresh('usd-chain-final', () => documents, next => { documents = next; });
  assert.equal(merged, 1);
  assert.equal(documents.documents[0].stage, 'final_red_team');
  assert.equal(documents.documents[0].document_type, 'review');
  assert.equal(documents.documents[0].chain_id, 'usd-chain-final');
});

test('a stored document is merged into the page registry and downloads byte-identical content', async () => {
  const world = harness({ signedIn: true });
  const file = stageFile('# Round trip\n\nBody.\n');
  await adapter.uploadStage({ topic: topic(), chainId: 'usd-chain-vix-level', stage: redTeamStage(), file, title: 'Round trip', model: 'session', parents: { researchRef: 'usd-baseline-audit-01-vix-usd-report' } });

  let documents = { documents: [] };
  const merged = await adapter.refresh('usd-chain-vix-level', () => documents, next => { documents = next; });
  assert.equal(merged, 1, 'one hosted document merged');
  const hosted = documents.documents[0];
  assert.equal(hosted.hosted, true);
  assert.equal(hosted.chain_id, 'usd-chain-vix-level');
  assert.equal(hosted.topic_id, 'usd-chain-vix-level');
  assert.equal(hosted.stage, 'red_team');
  assert.equal(hosted.storage, 'library_object');
  assert.equal(hosted.versions[0].version, 1);
  assert.equal(hosted.versions[0].storage_path, `usd-chain-vix-level/2/v1-${crypto.createHash('sha256').update(file.bytes).digest('hex')}.md`);

  const saved = [];
  globalThis.researchLibraryDownloadBytes = (name, bytes) => saved.push({ name, bytes });
  const downloaded = await adapter.openDocument(hosted, 1, 'download');
  assert.equal(downloaded.ok, true, downloaded.message);
  assert.equal(saved.length, 1);
  assert.deepEqual(Buffer.from(saved[0].bytes), file.bytes, 'downloaded bytes match the uploaded bytes');
  assert.match(downloaded.message, /fingerprint checked/);
  delete globalThis.researchLibraryDownloadBytes;

  // The merge is idempotent: a second refresh replaces the hosted rows rather than duplicating them.
  const mergedAgain = await adapter.refresh('usd-chain-vix-level', () => documents, next => { documents = next; });
  assert.equal(mergedAgain, 1);
  assert.equal(documents.documents.length, 1);
});

test('a tampered stored file fails its fingerprint check and is not handed over', async () => {
  const world = harness({ signedIn: true, corruptDownload: true });
  const file = stageFile('# Tamper check\n');
  await adapter.uploadStage({ topic: topic(), stage: redTeamStage(), file, title: 'Tamper check', model: 'session', parents: { researchRef: 'usd-baseline-audit-01-vix-usd-report' } });

  let documents = { documents: [] };
  await adapter.refresh(TOPIC, () => documents, next => { documents = next; });
  const saved = [];
  globalThis.researchLibraryDownloadBytes = (name, bytes) => saved.push({ name, bytes });
  const result = await adapter.openDocument(documents.documents[0], 1, 'download');
  delete globalThis.researchLibraryDownloadBytes;

  assert.equal(result.ok, false, 'a mismatched fingerprint must not be downloaded');
  assert.match(result.message, /fingerprint check/);
  assert.equal(saved.length, 0);
  assert.ok(world.objects.size >= 1);
});

test('an upload without a signed-in session is refused in plain words', async () => {
  harness({ signedIn: false });
  const result = await adapter.uploadStage({ topic: topic(), stage: redTeamStage(), file: stageFile('# x\n'), title: 'x', model: 'session' });
  assert.equal(result.ok, false);
  assert.match(result.message, /Sign in with your email/);
});

test('a later stage records the registered parent it follows and refuses an upload without one', async () => {
  const world = harness({ signedIn: true });
  const file = stageFile('# Stage two\n\nA finding.\n');

  const refused = await adapter.uploadStage({ topic: topic(), stage: redTeamStage(), file, title: 'no parent', model: 'session', parents: {} });
  assert.equal(refused.ok, false, 'a stage two upload with no parent must be refused');
  assert.match(refused.message, /Name the research report/);
  assert.equal(world.rows.length, 0, 'a refused upload records nothing');

  const accepted = await adapter.uploadStage({
    topic: topic(),
    stage: redTeamStage(),
    file,
    title: 'with parent',
    model: 'session',
    parents: { researchRef: 'usd-baseline-audit-01-vix-usd-report', parentVersion: 1 }
  });
  assert.equal(accepted.ok, true, accepted.message);
  assert.equal(world.rows[0].parent_research_ref, 'usd-baseline-audit-01-vix-usd-report');
  assert.equal(world.rows[0].parent_red_team_id, null);
});

test('nextVersion continues the version sequence for one topic stage only', () => {
  const rows = [
    { topic_id: TOPIC, stage: 2, version: 1 },
    { topic_id: TOPIC, stage: 2, version: 3 },
    { topic_id: TOPIC, stage: 1, version: 7 },
    { topic_id: 'usd-topic-front-end-rates', stage: 2, version: 9 }
  ];
  assert.equal(adapter.nextVersion(rows, TOPIC, 2), 4);
  assert.equal(adapter.nextVersion(rows, TOPIC, 3), 1);
  assert.equal(adapter.nextVersion([], TOPIC, 1), 1);
});
