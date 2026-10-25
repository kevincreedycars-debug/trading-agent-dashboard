'use strict';

// Offline integration test: the upload adapter driving the real client, with every network call faked.
// It covers the round trip the dashboard performs, so a regression in either file fails here first.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
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
        if (settings.listFails) return jsonResponse({ message: 'unavailable' }, 500);
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
  assert.match(signedOut, /data-rl-account-email/);
  assert.match(signedOut, /data-rl-account-password/);
  assert.match(signedOut, /data-rl-account-password-signin/);
  assert.doesNotMatch(signedOut, /data-rl-account-signin/, 'an email link to an address with no inbox is not offered');
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
  assert.equal(row.notes, '', 'a model or session label is no longer part of the record');
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

// The asset-level final chain is the one chain whose return judges a package of factor documents. The local
// service used to be the only place that could record that package; this proves the private store keeps it
// too, stage by stage, with each stage still attached to the one before it.
test('the final chain keeps its whole input package and every parent link in the private store', async () => {
  const world = harness({ signedIn: true });
  const packageDocuments = [
    {
      document_id: 'usd-baseline-audit-01-vix-usd-adjudication',
      version: 2,
      sha256: 'c'.repeat(64),
      role: 'vix-level',
      role_stage: 'adjudication'
    },
    {
      document_id: 'usd-baseline-audit-02-front-end-rates-adjudication',
      version: 1,
      sha256: 'd'.repeat(64),
      role: 'front-end-rates',
      role_stage: 'adjudication'
    }
  ];
  const analysis = await adapter.uploadStage({
    topic: { topic_id: 'usd-final-topic', title: 'USD final chain' },
    chainId: 'usd-chain-final',
    stage: { stage: 'final_analysis', label: 'Final analysis', document_type: 'synthesis' },
    file: stageFile('# Final analysis\n\nSynthesis.\n'),
    title: 'USD final analysis',
    note: 'read against the 24 October registry',
    inputPackage: { documents: packageDocuments, recorded_at: '2026-10-24T08:59:00.000Z' },
    onStored: async () => {}
  });
  assert.equal(analysis.ok, true, analysis.message);
  const analysisRow = world.rows[0];
  assert.equal(analysisRow.stage, 1);
  assert.equal(analysisRow.kind, 'final_analysis');
  assert.match(analysisRow.notes, /^read against the 24 October registry\nresearch-input-package:v1 \{/, 'the note is kept first, then the package behind its marker');
  const marker = 'research-input-package:v1 ';
  const recorded = JSON.parse(analysisRow.notes.slice(analysisRow.notes.indexOf(marker) + marker.length));
  assert.deepEqual(recorded.documents, packageDocuments, 'the exact factor documents and versions travel with the return');
  assert.equal(recorded.stage, 'final_analysis');
  assert.equal(recorded.recorded_at, '2026-10-24T08:59:00.000Z');

  const redTeam = await adapter.uploadStage({
    topic: { topic_id: 'usd-final-topic', title: 'USD final chain' },
    chainId: 'usd-chain-final',
    stage: { stage: 'final_red_team', label: 'Final red-team', document_type: 'review' },
    file: stageFile('# Final red-team\n\nOne finding.\n'),
    title: 'USD final red-team',
    parents: { researchRef: analysisRow.id },
    onStored: async () => {}
  });
  assert.equal(redTeam.ok, true, redTeam.message);
  const redTeamRow = world.rows[1];
  assert.equal(redTeamRow.stage, 2);
  assert.equal(redTeamRow.parent_research_ref, analysisRow.id, 'the red-team return names the analysis it read');
  assert.equal(redTeamRow.notes, '', 'a plain note stays a plain note: no package is invented for it');

  const adjudication = await adapter.uploadStage({
    topic: { topic_id: 'usd-final-topic', title: 'USD final chain' },
    chainId: 'usd-chain-final',
    stage: { stage: 'final_adjudication', label: 'Final adjudication', document_type: 'synthesis' },
    file: stageFile('# Final adjudication\n\nRuling.\n'),
    title: 'USD final adjudication',
    parents: { researchRef: analysisRow.id, redTeamRef: redTeamRow.id },
    onStored: async () => {}
  });
  assert.equal(adjudication.ok, true, adjudication.message);
  assert.equal(world.rows[2].parent_red_team_ref, redTeamRow.id);

  // One read of the whole store restores the chain the page shows: stage names, both parent links and the
  // input package the analysis judged.
  let documents = { documents: [] };
  const merged = await adapter.refreshAll(() => documents, next => { documents = next; });
  assert.equal(merged, 3, 'the analysis, the red-team return and the adjudication all come back');
  const byStage = {};
  documents.documents.forEach(document => { byStage[document.stage] = document; });
  assert.deepEqual(Object.keys(byStage).sort(), ['final_adjudication', 'final_analysis', 'final_red_team']);
  assert.deepEqual(byStage.final_analysis.input_documents, packageDocuments);
  assert.deepEqual(byStage.final_analysis.input_package.documents, packageDocuments);
  assert.equal(byStage.final_analysis.input_package.recorded_at, '2026-10-24T08:59:00.000Z');
  assert.equal(byStage.final_analysis.note, 'read against the 24 October registry', 'the marker line is not shown as a note');
  assert.equal(byStage.final_red_team.parent_document_id, analysisRow.id);
  assert.equal(byStage.final_red_team.parent_version, 1);
  assert.equal(byStage.final_adjudication.parent_document_id, redTeamRow.id);
  assert.equal(byStage.final_adjudication.input_documents, undefined, 'only the stage that judged a package carries one');
});

test('one read covers the whole store, reports a failed read as nothing read, and leaves untouched chains alone', async () => {
  const world = harness({ signedIn: true });
  await adapter.uploadStage({
    topic: topic(),
    chainId: 'usd-chain-vix-level',
    stage: redTeamStage(),
    file: stageFile('# Only stored document\n'),
    title: 'Only stored document',
    parents: { researchRef: 'usd-baseline-audit-01-vix-usd-report' }
  });

  let documents = { documents: [] };
  const merged = await adapter.refreshAll(() => documents, next => { documents = next; });
  assert.equal(merged, 1);
  assert.equal(documents.documents.length, 1, 'a chain with nothing stored is not given an invented record');
  const read = `${PROJECT_URL}/rest/v1/research_documents?order=topic_id.asc,stage.asc,version.asc&limit=1000`;
  assert.equal(world.calls.filter(call => call === `GET ${read}`).length, 1, 'the whole store is read in one request, not one request per chain');

  harness({ signedIn: true, listFails: true });
  const failed = await adapter.refreshAll(() => ({ documents: [] }), () => {});
  assert.equal(failed, -1, 'a store that could not be read is reported as nothing read, so the page does not claim it is up to date');

  harness({ signedIn: false });
  const signedOut = await adapter.refreshAll(() => ({ documents: [] }), () => {});
  assert.equal(signedOut, -1);
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

// The page used to keep the final chain's upload for the local service, because only that service recorded
// the factor input package. The page now hands every stage, the final chain included, to the same adapter, so
// these guards keep the local service from creeping back into that path.
test('the page offers the final chain upload to a signed-in member and sends its whole input package', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  const bodyOf = (start, end) => {
    const from = source.indexOf(start);
    assert.ok(from >= 0, `${start} is in the page`);
    const to = source.indexOf(end, from);
    assert.ok(to > from, `${end} follows it`);
    return source.slice(from, to);
  };

  const form = bodyOf('function researchLibraryStageUploadForm(', '\nfunction researchLibraryChainStageCard(');
  assert.doesNotMatch(form, /!\s*finalChain/, 'the final chain is not held back from the private store');
  assert.doesNotMatch(form, /needs the local library service/, 'no note sends the reader to the local service');
  assert.match(form, /hosted && researchLibraryHostedClient\(\)\?\.signedIn\(\)/, 'a signed-in member can register either chain');

  const upload = bodyOf('async function researchLibraryStageUpload(', '\nfunction researchLibraryStagePromptBlock(');
  const hostedBranch = upload.indexOf('if (hostedUpload && hostedUpload.signedIn())');
  const localFallback = upload.indexOf('if (!client)');
  assert.ok(hostedBranch >= 0 && localFallback > hostedBranch, 'the private store is offered before the local service');
  assert.match(upload, /inputPackage: isFinalChain \? \{ documents: inputDocumentList/, 'the final chain sends its input package');
});


// GitHub is the owner's chosen sign-in. The button only sends the browser to the project's own OAuth
// endpoint: the GitHub client id and secret live in Supabase, never in this page or this repository.
test('the account bar offers GitHub sign-in and that button starts the redirect', async () => {
  harness({ signedIn: false });
  const html = adapter.accountBarHtml();
  assert.match(html, /data-rl-account-github-signin/, 'the GitHub button is drawn');
  assert.match(html, />Sign in with GitHub</);
  assert.match(html, /data-rl-account-password-signin/, 'the account email and password stay as the fallback');

  const previousLocation = globalThis.location;
  const visited = [];
  globalThis.location = {
    href: 'https://example.github.io/trading-agent-dashboard/',
    hash: '',
    pathname: '/trading-agent-dashboard/',
    search: '',
    assign: url => visited.push(String(url))
  };
  try {
    const button = { closest: selector => (selector.includes('data-rl-account-github-signin') ? button : null) };
    const handled = await adapter.handleAccountAction(button);
    assert.equal(handled, true);
    assert.equal(visited.length, 1, 'the browser is sent to exactly one place');
    const target = new URL(visited[0]);
    assert.equal(`${target.origin}${target.pathname}`, `${PROJECT_URL}/auth/v1/authorize`);
    assert.equal(target.searchParams.get('provider'), 'github');
    assert.equal(target.searchParams.get('redirect_to'), 'https://example.github.io/trading-agent-dashboard/');
    assert.doesNotMatch(visited[0], /secret|service_role/i, 'no secret is put in the page or the URL');
    assert.equal(adapter.signedIn(), false, 'leaving the page is not a session');
  } finally {
    globalThis.location = previousLocation;
  }
});

test('a refused GitHub return is shown in the account bar instead of a blank sign-in block', () => {
  const previousLocation = globalThis.location;
  const previousHistory = globalThis.history;
  globalThis.location = {
    hash: '#error=access_denied&error_description=provider+is+not+enabled',
    pathname: '/trading-agent-dashboard/',
    search: '',
    href: 'https://example.github.io/trading-agent-dashboard/#error=access_denied'
  };
  globalThis.history = { replaceState: () => {} };
  try {
    harness({ signedIn: false });
    const html = adapter.accountBarHtml();
    assert.match(html, /not turned on for this library yet/);
    assert.match(html, /data-rl-account-github-signin/, 'the button stays available for a second try');
  } finally {
    globalThis.location = previousLocation;
    globalThis.history = previousHistory;
  }
});

