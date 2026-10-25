'use strict';

// The runner's door to the hosted store the page already uses.
//
// The page (script.js) reaches the private `research-documents` bucket and the `research_documents` table
// through lib/research_upload_client.js. This module loads the same client, so a document the unattended
// runner registers lands on the same bucket, under the same path (`<chain>/<stage>/v<version>-<sha>.md`), with
// the same version sequence and the same read-back rule. There is no local service in this path: the only
// address the module can reach is the project URL read from the deployed page, and a loopback address is
// refused before any request is made.
//
// Secrets: the page's project URL and publishable key are public - they are already in script.js and in the
// bundle the browser downloads. The worker's own account credentials are the secure backend sign-in and are
// read from the environment for the length of one command. They are never written to a file, a receipt, a log
// line or a return value; status() reports only whether a sign-in is possible and which variable is missing.
//
// GitHub user sign-in is a different door: it lets the owner read the library in a browser, and it is not used
// by the runner.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

require('./research_upload_client.js');
const client = require('./research_upload_client.js');

const BUCKET = 'research-documents';
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const ENV_NAMES = Object.freeze({
  email: 'RESEARCH_WORKER_EMAIL',
  password: 'RESEARCH_WORKER_PASSWORD',
  url: 'RESEARCH_SUPABASE_URL',
  key: 'RESEARCH_SUPABASE_ANON_KEY'
});
const LOOPBACK = /^(https?:\/\/)?(localhost|127(\.\d+){3}|0\.0\.0\.0|\[::1\]|::1)(:|\/|$)/i;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function asText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function isLoopback(value) {
  return LOOPBACK.test(asText(value).trim());
}

// The page's publishable configuration is the single source of truth, so the runner cannot drift to a
// different project than the one the page reads. Both values are public; no secret is parsed here.
function pageConfig(repoRoot) {
  const source = fs.readFileSync(path.join(repoRoot, 'script.js'), 'utf8');
  const urlMatch = source.match(/const researchSupabaseUrl = "([^"]+)\/rest\/v1";/);
  const keyMatch = source.match(/const researchSupabaseKey = "([^"]+)";/);
  if (!urlMatch || !keyMatch) return null;
  return { url: urlMatch[1].replace(/\/+$/, ''), key: keyMatch[1] };
}

// What is missing, in the operator's words. A missing or partial configuration is a refusal, never a silent
// fall back to a local service.
function config(options = {}) {
  const env = options.env || process.env;
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  let page = null;
  try {
    page = pageConfig(repoRoot);
  } catch (_) {
    page = null;
  }
  const url = asText(env[ENV_NAMES.url]).trim() || (page ? page.url : '');
  const key = asText(env[ENV_NAMES.key]).trim() || (page ? page.key : '');
  const email = asText(env[ENV_NAMES.email]).trim();
  const password = asText(env[ENV_NAMES.password]);
  const needed = [];
  if (!url || !key) needed.push('the project URL and publishable key (script.js, or RESEARCH_SUPABASE_URL and RESEARCH_SUPABASE_ANON_KEY)');
  if (!email) needed.push(ENV_NAMES.email);
  if (!password) needed.push(ENV_NAMES.password);
  const loopback = isLoopback(url) === true;
  return {
    ok: needed.length === 0 && !loopback,
    loopback,
    url,
    key,
    email,
    password,
    needed,
    repo_root: repoRoot
  };
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (_) {
    return '';
  }
}

function storagePathFor(topicId, stage, version, sha) {
  return `${asText(topicId)}/${asText(stage)}/v${asText(version)}-${sha}.md`;
}

// The note the page's own reader parses: the human sentence first, then the dispatch provenance the runner
// knows and a browser upload does not, then the model or session label the reader expects at the end. The
// input package (final chain only) is appended by the client after this text, so the label stays last.
function composeNote(input) {
  const lines = [];
  const note = asText(input && input.notes).trim();
  if (note) lines.push(note);
  const provenance = (input && input.provenance) || null;
  if (provenance) {
    const parts = [];
    if (provenance.prompt_path) parts.push(`prompt ${provenance.prompt_path}`);
    if (provenance.prompt_sha256) parts.push(`sha256 ${provenance.prompt_sha256}`);
    if (provenance.catalog_version) parts.push(`catalog ${provenance.catalog_version}`);
    if (provenance.envelope_sha256) parts.push(`envelope sha256 ${provenance.envelope_sha256}`);
    if (parts.length) lines.push(`Dispatch provenance: ${parts.join(', ')}.`);
  }
  const model = asText(input && input.model).trim();
  if (model) lines.push(`Model or session: ${model}`);
  return lines.join('\n');
}

/**
 * Build the runner's hosted registration adapter.
 *
 * options.repoRoot  checkout whose script.js names the project (default: this checkout)
 * options.env       environment to read credentials from (default: process.env)
 * options.fetch     fetch implementation (tests pass a fixture; production uses global fetch)
 */
function create(options = {}) {
  const resolved = config(options);
  const fetchImpl = typeof options.fetch === 'function'
    ? options.fetch
    : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  let signedIn = false;
  let signedInAs = '';

  function status() {
    return {
      configured: resolved.ok,
      signed_in: signedIn,
      signed_in_as: signedInAs,
      host: hostOf(resolved.url),
      bucket: BUCKET,
      loopback_refused: resolved.loopback,
      needed: resolved.needed.slice()
    };
  }

  function unavailable() {
    const reason = resolved.loopback
      ? 'the configured project address is a loopback address, and the research store is hosted'
      : `the hosted research store is not configured for this command: set ${resolved.needed.join(', ')}`;
    return { ok: false, code: 'hosted_not_configured', message: reason, status: status() };
  }

  async function signIn() {
    if (!resolved.ok) return unavailable();
    if (!fetchImpl) return { ok: false, code: 'hosted_unreachable', message: 'this runtime has no fetch, so the hosted store cannot be reached' };
    client.configure({ url: resolved.url, key: resolved.key, fetch: fetchImpl });
    const result = await client.signInWithPassword(resolved.email, resolved.password);
    signedIn = Boolean(result && result.ok);
    signedInAs = signedIn ? resolved.email : '';
    if (!signedIn) {
      return {
        ok: false,
        code: 'hosted_sign_in_refused',
        // The client's message is written for a reader: it names no address and no secret.
        message: asText(result && result.message) || 'the worker account was not accepted by the hosted store'
      };
    }
    return { ok: true, message: 'signed in to the hosted research store', status: status() };
  }

  async function ensureSignedIn() {
    if (signedIn) return { ok: true };
    return signIn();
  }

  async function listTopic(topicId) {
    const ready = await ensureSignedIn();
    if (!ready.ok) return ready;
    const listed = await client.listByTopic(asText(topicId).trim());
    if (!listed.ok) {
      return { ok: false, code: 'hosted_list_failed', message: asText(listed.message) || 'the hosted rows could not be read' };
    }
    return { ok: true, rows: Array.isArray(listed.rows) ? listed.rows : [] };
  }

  // Byte-identical download: a private signed link, the bytes themselves, and a fresh hash of what came back.
  // A registration is only verified when this matches the hash that was uploaded.
  async function download(row) {
    const ready = await ensureSignedIn();
    if (!ready.ok) return ready;
    const signed = await client.signedUrl(row);
    if (!signed.ok) {
      return { ok: false, code: 'hosted_download_refused', message: asText(signed.message) || 'a private download link could not be created' };
    }
    if (isLoopback(signed.url)) {
      return { ok: false, code: 'hosted_download_refused', message: 'the download link pointed at a loopback address and was refused' };
    }
    let response;
    try {
      response = await fetchImpl(signed.url);
    } catch (_) {
      return { ok: false, code: 'hosted_unreachable', message: 'the signed download link could not be reached' };
    }
    if (!response || !response.ok) {
      return { ok: false, code: 'hosted_download_refused', message: `the signed download link answered ${response ? response.status : 'nothing'}` };
    }
    let bytes;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (_) {
      return { ok: false, code: 'hosted_download_refused', message: 'the downloaded object could not be read as bytes' };
    }
    return { ok: true, bytes, bytes_length: bytes.length, sha256: sha256(bytes) };
  }

  async function verify(row) {
    if (!row || !asText(row.storage_path)) {
      return { ok: false, code: 'hosted_row_incomplete', message: 'the hosted row carries no storage path, so nothing can be read back' };
    }
    const fetched = await download(row);
    if (!fetched.ok) return fetched;
    const expected = asText(row.sha256);
    const identical = fetched.sha256 === expected && Number(row.bytes) === fetched.bytes_length;
    return {
      ok: identical,
      code: identical ? 'hosted_readback_ok' : 'hosted_readback_mismatch',
      message: identical
        ? `read back ${fetched.bytes_length} bytes, sha256 ${fetched.sha256}, identical to the uploaded object`
        : `the hosted object reads back as ${fetched.bytes_length} bytes, sha256 ${fetched.sha256}, not the ${asText(row.bytes)} bytes, sha256 ${expected} that were registered`,
      storage_path: asText(row.storage_path),
      bytes: fetched.bytes_length,
      sha256: fetched.sha256,
      expected_sha256: expected
    };
  }

  // Find the hosted parent a later stage names. The page passes the parent row id; the runner passes the
  // chain stage and version, and the row is resolved here so a review cannot name a version the hosted store
  // does not hold.
  function resolveParent(rows, parent) {
    const wanted = parent || {};
    const stage = Number(wanted.stage_number);
    if (!stage) return { ok: false, message: 'the parent stage is not a hosted stage number' };
    const version = Number(wanted.version) || 0;
    const candidates = (Array.isArray(rows) ? rows : [])
      .filter(row => Number(row.stage) === stage)
      .sort((a, b) => Number(b.version) - Number(a.version));
    const match = version
      ? candidates.find(row => Number(row.version) === version)
      : candidates[0];
    if (!match) {
      return {
        ok: false,
        message: version
          ? `stage ${stage} version ${version} is not in the hosted store, so this document would name a version that cannot be read`
          : `stage ${stage} has no version in the hosted store yet`
      };
    }
    if (asText(wanted.sha256) && asText(match.sha256) !== asText(wanted.sha256)) {
      return {
        ok: false,
        message: `stage ${stage} version ${match.version} in the hosted store is sha256 ${asText(match.sha256)}, not the ${asText(wanted.sha256)} this document judged`
      };
    }
    return { ok: true, row: match, version: Number(match.version), sha256: asText(match.sha256) };
  }

  /**
   * Register one stage document on the hosted store, then read it back and re-hash it.
   *
   * input.topicId       chain id (the hosted table's topic_id for a factor chain and for the final chain)
   * input.stage         1 research, 2 red_team, 3 adjudication
   * input.title         the stage title the page shows
   * input.kind          document type for a factor stage; the stage name for a final stage
   * input.notes         the human sentence for the notes column
   * input.model         model or session label
   * input.provenance    { prompt_path, prompt_sha256, catalog_version, envelope_sha256 }
   * input.parent        { stage_number, version, sha256, research_version } - required for stages 2 and 3
   * input.filename      original file name
   * input.bytes         the returned Markdown as bytes
   * input.inputPackage  final-chain input package, carried in notes exactly as the page does
   */
  async function register(input) {
    if (!resolved.ok) return unavailable();
    const values = input || {};
    const topicId = asText(values.topicId).trim();
    const stage = Number(values.stage);
    const bytes = Buffer.isBuffer(values.bytes) ? values.bytes : Buffer.from(values.bytes || []);
    if (!topicId || !/^[A-Za-z0-9._-]+$/.test(topicId)) {
      return { ok: false, code: 'hosted_topic_invalid', message: `"${topicId}" is not a chain id the hosted store accepts` };
    }
    if (![1, 2, 3].includes(stage)) {
      return { ok: false, code: 'hosted_stage_invalid', message: `stage ${asText(values.stage)} is not one of the hosted stage numbers 1, 2, 3` };
    }
    if (!bytes.length) return { ok: false, code: 'hosted_bytes_missing', message: 'there are no bytes to register' };
    if (!asText(values.title).trim() || !asText(values.kind).trim()) {
      return { ok: false, code: 'hosted_row_incomplete', message: 'a hosted row needs a title and a document kind' };
    }

    const listed = await listTopic(topicId);
    if (!listed.ok) return listed;
    const rows = listed.rows;
    const digest = sha256(bytes);
    const sameBytes = rows.find(row => Number(row.stage) === stage && asText(row.sha256) === digest);
    if (sameBytes) {
      // These bytes are already stored for this chain and stage: adopt the row rather than store a second
      // copy, which is what makes a retried submit safe after a crash between the upload and the row insert.
      const readback = await verify(sameBytes);
      return {
        ok: readback.ok,
        duplicate: true,
        code: readback.ok ? 'hosted_readback_ok' : readback.code,
        message: readback.message,
        row: sameBytes,
        row_id: asText(sameBytes.id),
        storage_path: asText(sameBytes.storage_path),
        version: Number(sameBytes.version),
        sha256: digest,
        bytes: bytes.length,
        readback
      };
    }

    let parents = {};
    if (stage > 1) {
      const parent = resolveParent(rows, values.parent);
      if (!parent.ok) return { ok: false, code: 'hosted_parent_missing', message: parent.message };
      const research = stage === 2
        ? parent.row
        : (function () {
          const wanted = Number((values.parent && values.parent.research_version) || 0);
          return rows
            .filter(row => Number(row.stage) === 1)
            .sort((a, b) => Number(b.version) - Number(a.version))
            .find(row => !wanted || Number(row.version) === wanted) || null;
        })();
      if (!research) {
        return { ok: false, code: 'hosted_parent_missing', message: 'the research stage of this chain is not in the hosted store, so a later stage cannot be attached to it' };
      }
      parents = { researchId: asText(research.id), redTeamId: stage === 3 ? asText(parent.row.id) : undefined };
    }

    const file = {
      name: asText(values.filename).trim() || `${topicId}-stage-${stage}-${digest.slice(0, 12)}.md`,
      type: 'text/markdown',
      arrayBuffer: async () => bytes
    };
    const uploaded = await client.upload({
      topicId,
      stage,
      title: asText(values.title).trim(),
      kind: asText(values.kind).trim(),
      notes: composeNote(values),
      file,
      parents,
      inputPackage: values.inputPackage || null
    });
    if (!uploaded || !uploaded.ok) {
      const stored = uploaded && uploaded.storagePath ? asText(uploaded.storagePath) : '';
      return {
        ok: false,
        code: 'hosted_registration_failed',
        message: asText(uploaded && uploaded.message) || 'the hosted store refused the registration',
        storage_path: stored,
        retryable: Boolean(uploaded && uploaded.retry),
        // A file that is stored but not registered is the one state an operator must know about: the bytes
        // are in the bucket and re-running the same command finishes the row without uploading again.
        needs_registration_only: Boolean(stored)
      };
    }

    const row = (uploaded && uploaded.row) || {};
    const readback = await verify(row);
    const receipt = {
      ok: readback.ok,
      code: readback.ok ? 'hosted_readback_ok' : readback.code,
      message: readback.message,
      duplicate: false,
      row,
      row_id: asText(row.id),
      storage_path: asText(row.storage_path || uploaded.storagePath),
      version: Number(row.version),
      sha256: digest,
      bytes: bytes.length,
      readback
    };
    if (!readback.ok) {
      // The row is in the store, so this is a mismatch on a known row, not a failure with no effect.
      receipt.message = `${receipt.message}. The row is ${asText(row.id) || 'unknown'} at ${receipt.storage_path}; do not upload again, inspect that object first`;
    }
    return receipt;
  }

  return { status, signIn, listTopic, download, verify, register, resolveParent, composeNote };
}

module.exports = { create, config, pageConfig, composeNote, storagePathFor, sha256, isLoopback, BUCKET, ENV_NAMES };
