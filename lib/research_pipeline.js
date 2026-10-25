'use strict';

// Unattended supervisor for the three-stage USD research chain.
//
// One job is one stage of one topic. The supervisor does four things and nothing else:
//   1. it derives which stage of every topic can run next from the committed catalogue and the
//      registry, so a later stage cannot start before the exact version it has to judge is registered;
//   2. it writes one self-contained envelope per dispatch: the stage prompt verified against its
//      catalogue sha256, plus the registered parent bytes re-hashed out of the private store;
//   3. it verifies a returned Markdown document before anything is stored: size, headings, balanced
//      code fences, no truncation marker, no replacement characters;
//   4. it registers a verified return in the same versioned store the panel reads, reads the object
//      back, and requires the topic page to show that exact version as delivered.
//
// Transport is deliberately out of scope. A dispatch is a file that an operator or a future verified
// driver delivers; nothing here calls a model endpoint and nothing here claims that an envelope was
// answered. docs/research/pipeline/EXECUTION_ROUTE.md records what is verified about the route and
// what is still an assumption.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ResearchLibrary = require('../lib/research_library.js');
const { createStore, MAX_UPLOAD_BYTES } = require('../lib/research_library_store.js');

const PIPELINE_SCHEMA = 'research-pipeline-state-v1';
const JOB_STATES = Object.freeze(['queued', 'dispatched', 'registered', 'rejected']);
const DEFAULT_LOCK_TTL_MS = 30 * 1000;
const DEFAULT_LEASE_MS = 90 * 60 * 1000;
const MAX_JOB_NOTES = 12;

// A returned stage document is judged on completeness, never on plausibility: these checks catch a
// truncated paste, a chat that stopped mid-sentence and a placeholder answer. They cannot tell whether
// the research is any good, and they do not pretend to.
const DEFAULT_VERIFICATION = Object.freeze({
  min_bytes: 2000,
  min_headings: 5,
  require_balanced_fences: true,
  forbidden: Object.freeze([
    '[truncated]',
    '\u2026 truncated',
    '[content truncated',
    '[...omitted',
    'would you like me to continue',
    'shall i continue',
    'continue generating',
    'as an ai language model'
  ])
});

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const wrapped = new Error(`${filePath} is not readable JSON: ${error.message}`);
    wrapped.code = 'state_unreadable';
    throw wrapped;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, filePath);
}

function writeFileAtomic(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, bytes);
  fs.renameSync(temp, filePath);
}

function failure(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function slug(value) {
  return asText(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^[.\-_]+/, '')
    .replace(/[.\-_]+$/, '');
}

// The document id a stage registers under. It is derived from the topic and the stage, so a repeat run
// adds a new immutable version to the same document instead of inventing a parallel identity.
function stageDocumentId(topicId, stageId) {
  return slug(`${topicId}-${String(stageId).replace(/_/g, '-')}`);
}

function verifyReturnDocument(bytes, options = {}) {
  const settings = { ...DEFAULT_VERIFICATION, ...(options || {}) };
  const problems = [];
  const buffer = Buffer.isBuffer(bytes) ? bytes : null;
  if (!buffer) {
    return { ok: false, problems: ['a returned document must be given as raw bytes'], bytes: 0, sha256: '', headings: 0, text: '' };
  }
  const digest = sha256(buffer);
  if (buffer.length > MAX_UPLOAD_BYTES) {
    problems.push(`the returned document is ${buffer.length} bytes, larger than the store accepts (${MAX_UPLOAD_BYTES})`);
  }
  if (buffer.length === 0) {
    problems.push('the returned document is empty');
    return { ok: false, problems, bytes: 0, sha256: digest, headings: 0, text: '' };
  }
  const text = buffer.toString('utf8');
  if (text.includes('\uFFFD')) problems.push('the returned bytes are not valid UTF-8, so the document is damaged');
  if (text.includes('\u0000')) problems.push('the returned bytes contain NUL characters');
  if (!text.trim()) problems.push('the returned document contains no text');
  if (buffer.length < settings.min_bytes) {
    problems.push(`the returned document is ${buffer.length} bytes; a complete stage deliverable of this kind is at least ${settings.min_bytes}`);
  }
  const lines = text.split(/\r?\n/);
  const headings = lines.filter(line => /^#{1,6}\s+\S/.test(line)).length;
  if (headings < settings.min_headings) {
    problems.push(`the returned document has ${headings} Markdown heading(s); at least ${settings.min_headings} are expected, which is what a truncated answer usually loses first`);
  }
  if (settings.require_balanced_fences) {
    const fences = lines.filter(line => /^\s*```/.test(line)).length;
    if (fences % 2 !== 0) problems.push('the returned document has an unclosed code fence, so it ends inside a block and is probably truncated');
  }
  const lower = text.toLowerCase();
  (settings.forbidden || []).forEach(marker => {
    if (lower.includes(asText(marker).toLowerCase())) {
      problems.push(`the returned document contains a truncation or placeholder marker (${JSON.stringify(marker)})`);
    }
  });
  return { ok: problems.length === 0, problems, bytes: buffer.length, sha256: digest, headings, text };
}

// One envelope is one self-contained Markdown file: a header, the stage prompt taken verbatim from the
// repository at its catalogued hash, and the parent document taken verbatim from the private store at the
// exact version this stage has to judge. A driver only has to move these bytes and bring back one file.
function composeEnvelope({ topic, stage, prompt, parent, documentId, generatedAt }) {
  const lines = [
    `# Unattended stage dispatch: ${asText(topic.title)}`,
    '',
    `- generated: ${generatedAt}`,
    `- topic: ${asText(topic.topic_id)} (${asText(topic.asset || 'USD')})`,
    `- stage: ${Number(stage.order)} of 3, ${asText(stage.label)} (${asText(stage.stage)})`,
    `- deliverable: ${asText(stage.document_type)}. ${asText(stage.deliverable)}`,
    `- returns: ${asText(stage.returns)}`,
    `- registers under: document_id ${documentId}, document_type ${asText(stage.document_type)}`,
    `- prompt: ${asText(prompt.relative)} sha256 ${prompt.sha256} (${prompt.bytes} bytes), verified against the catalogue`,
    parent
      ? `- document under review: ${parent.document_id} version ${parent.version} sha256 ${parent.sha256} (${parent.bytes} bytes), re-hashed from the private store`
      : '- document under review: none, this is the first stage of the topic',
    '- answer with one Markdown file and nothing else; do not repeat the prompt back',
    ''
  ];
  if (asText(topic.summary)) lines.push(asText(topic.summary), '');
  lines.push('## Stage prompt (verbatim)', '', prompt.text.trimEnd(), '');
  if (parent) {
    lines.push(
      `## Document under review (verbatim, ${parent.document_id} version ${parent.version}, sha256 ${parent.sha256})`,
      '',
      parent.text.trimEnd(),
      ''
    );
  }
  const text = `${lines.join('\n')}`;
  return { text, bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(Buffer.from(text, 'utf8')) };
}

// The supervisor. Everything it writes lives under `stateRoot` (ignored by Git); the only file it ever
// adds to the repository-visible world is a registry entry, and only for bytes that passed verification
// and re-read back byte-identical.
function createPipeline(options = {}) {
  const repoRoot = path.resolve(options.root || path.join(__dirname, '..'));
  const catalogPath = path.resolve(options.catalogPath || path.join(repoRoot, 'data', 'research-library', 'catalog.json'));
  const registryPath = path.resolve(options.registryPath || path.join(repoRoot, 'data', 'research-library', 'documents.json'));
  const libraryRoot = path.resolve(options.libraryRoot || path.join(repoRoot, '.local', 'research-library'));
  const stateRoot = path.resolve(options.stateRoot || path.join(repoRoot, '.local', 'research-pipeline'));
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  const lockTtlMs = Number(options.lockTtlMs) > 0 ? Number(options.lockTtlMs) : DEFAULT_LOCK_TTL_MS;
  const leaseMs = Number(options.leaseMs) > 0 ? Number(options.leaseMs) : DEFAULT_LEASE_MS;
  const verification = { ...DEFAULT_VERIFICATION, ...(options.verification || {}) };
  const allowanceDefaults = { limit: 6, reserve: 1, ...(options.allowance || {}) };
  const injectedCatalog = options.catalog || null;

  const queuePath = path.join(stateRoot, 'queue.json');
  const usagePath = path.join(stateRoot, 'usage.json');
  const lockPath = path.join(stateRoot, '.lock');
  const outboxDir = path.join(stateRoot, 'outbox');
  const rejectedDir = path.join(stateRoot, 'returns', 'rejected');

  const store = options.store || createStore({ root: libraryRoot, registryPath, now });

  function nowIso() {
    return new Date(now()).toISOString();
  }

  function nowMs() {
    return new Date(now()).getTime();
  }

  function catalog(override) {
    if (override) return override;
    if (injectedCatalog) return injectedCatalog;
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  }

  function documents() {
    return store.readRegistry().documents || [];
  }

  function jobKey(topicId, stageId) {
    return `${asText(topicId)}/${asText(stageId)}`;
  }

  function emptyQueue() {
    return {
      schema_version: PIPELINE_SCHEMA,
      updated_at: null,
      control: { paused: false, reason: '', changed_at: null, changed_by: null },
      jobs: {}
    };
  }

  function readQueue() {
    const queue = readJson(queuePath, null);
    if (!queue || queue.schema_version !== PIPELINE_SCHEMA) return emptyQueue();
    if (!queue.control || typeof queue.control !== 'object') queue.control = emptyQueue().control;
    if (!queue.jobs || typeof queue.jobs !== 'object') queue.jobs = {};
    return queue;
  }

  function writeQueue(queue) {
    queue.updated_at = nowIso();
    writeJsonAtomic(queuePath, queue);
    return queue;
  }

  // The allowance is a count the operator sets, not a figure this program knows. ChatGPT, Work/Codex and
  // API allowances are separate and none of them exposes a verified machine-readable remaining count, so
  // the supervisor counts its own dispatches, keeps a reserve for the owner's own use and stops.
  function readUsage() {
    const raw = readJson(usagePath, null) || {};
    return {
      schema_version: PIPELINE_SCHEMA,
      limit: Number.isFinite(Number(raw.limit)) ? Number(raw.limit) : Number(allowanceDefaults.limit),
      reserve: Number.isFinite(Number(raw.reserve)) ? Number(raw.reserve) : Number(allowanceDefaults.reserve),
      used: Number.isFinite(Number(raw.used)) ? Number(raw.used) : 0,
      dispatches: Array.isArray(raw.dispatches) ? raw.dispatches.slice(-50) : [],
      reset_cadence: raw.reset_cadence || 'manual',
      reset_at: raw.reset_at || null
    };
  }

  function writeUsage(usage) {
    writeJsonAtomic(usagePath, usage);
    return usage;
  }

  function budget() {
    const usage = readUsage();
    const usable = Math.max(0, usage.limit - usage.reserve);
    return {
      limit: usage.limit,
      reserve: usage.reserve,
      usable,
      used: usage.used,
      remaining: Math.max(0, usable - usage.used),
      exhausted: usage.used >= usable,
      reset_cadence: usage.reset_cadence,
      reset_at: usage.reset_at
    };
  }

  // One writer at a time. A lock older than the TTL is treated as abandoned, because the point of the
  // lock is to serialise live writers, not to stop a run that died from being restarted.
  function withLock(fn) {
    fs.mkdirSync(stateRoot, { recursive: true });
    let handle = null;
    try {
      handle = fs.openSync(lockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age <= lockTtlMs) throw failure('pipeline_busy', `another pipeline process holds ${lockPath}`);
      fs.rmSync(lockPath, { force: true });
      handle = fs.openSync(lockPath, 'wx');
    }
    try {
      fs.writeFileSync(handle, `${process.pid} ${nowIso()}\n`);
      return fn();
    } finally {
      fs.closeSync(handle);
      fs.rmSync(lockPath, { force: true });
    }
  }

  function topicContext(topicId, overrideCatalog) {
    const value = catalog(overrideCatalog);
    const topic = ResearchLibrary.topicById(value, topicId);
    if (!topic) throw failure('not_in_catalog', `topic ${topicId} is not in ${catalogPath}`);
    return { catalog: value, topic };
  }

  function stageOf(topic, stageId) {
    const stage = ResearchLibrary.stageById(topic, stageId);
    if (!stage) throw failure('not_in_catalog', `topic ${asText(topic.topic_id)} has no ${stageId} stage`);
    return stage;
  }

  function describeBlock(progress, stage) {
    if (stage.state === 'delivered') return `already delivered as ${stage.document_id} version ${stage.version}`;
    if (stage.state === 'reassessment_required') {
      return `${stage.parent_document_id} was revised to version ${stage.parent_version} after this stage ran, so the stage has to run again`;
    }
    const earlier = progress.stages.filter(entry => Number(entry.order) < Number(stage.order) && entry.state !== 'delivered');
    if (earlier.length) return `waiting for ${earlier.map(entry => entry.stage).join(' and ')} of this topic to be delivered`;
    if (progress.next_stage && progress.next_stage !== stage.stage) return `the topic runs ${progress.next_stage} next`;
    return 'not runnable';
  }

  // Which stage of which topic can run now, and why not when it cannot. This is derived every time from
  // the catalogue and the registry, so the answer cannot drift away from what the topic page shows.
  function plan(planOptions = {}) {
    const value = catalog();
    const docs = documents();
    const queue = readQueue();
    const current = nowMs();
    const wantedAsset = asText(planOptions.asset).trim().toUpperCase();
    const wantedTopic = asText(planOptions.topicId).trim();
    const entries = [];
    ResearchLibrary.listTopics(value).forEach(topic => {
      if (wantedAsset && asText(topic.asset).toUpperCase() !== wantedAsset) return;
      if (wantedTopic && asText(topic.topic_id) !== wantedTopic) return;
      const progress = ResearchLibrary.topicProgress(topic, docs);
      progress.stages.forEach(stage => {
        const key = jobKey(topic.topic_id, stage.stage);
        const job = queue.jobs[key] || null;
        const claimLive = Boolean(job && job.state === 'dispatched' && job.claim && Date.parse(job.claim.expires_at) > current);
        const claimHeld = Boolean(job && job.state === 'dispatched' && job.claim);
        // A stage can run once every earlier stage of the topic is delivered and this stage is not: a stage whose
        // parent was revised becomes runnable again, and a stage that already delivered does not.
        const earlierDelivered = progress.stages
          .filter(entry => Number(entry.order) < Number(stage.order))
          .every(entry => entry.state === 'delivered');
        const runnable = !claimHeld
          && earlierDelivered
          && ['not_started', 'awaiting_upload', 'reassessment_required'].includes(stage.state);

        entries.push({
          job_key: key,
          topic_id: asText(topic.topic_id),
          topic_title: asText(topic.title),
          asset: asText(topic.asset),
          stage: stage.stage,
          order: Number(stage.order),
          label: asText(stage.label),
          document_type: asText(stage.document_type),
          prompt_path: asText(stage.prompt_path),
          prompt_sha256: asText(stage.prompt_sha256),
          prompt_bytes: Number(stage.prompt_bytes) || null,
          page_state: stage.state,
          job_state: job ? asText(job.state) : 'queued',
          attempts: job ? Number(job.attempts) || 0 : 0,
          claimed: claimLive,
          claim_held: claimHeld,

          claim_expires_at: claimLive ? job.claim.expires_at : null,
          document_id: stage.state === 'delivered' ? asText(stage.document_id) : stageDocumentId(topic.topic_id, stage.stage),
          delivered_version: stage.state === 'delivered' ? Number(stage.version) : null,
          parent_document_id: asText(stage.parent_document_id),
          parent_version: Number(stage.parent_version) || null,
          topic_ready: Boolean(progress.ready_for_synthesis),
          runnable,
          reason: claimLive
            ? `claimed until ${job.claim.expires_at}`
            : claimHeld
              ? `the lease on ${job.claim.expires_at} has run out; run recover() to requeue the stage`
              : runnable ? '' : describeBlock(progress, stage)

        });
      });
    });
    return entries;
  }

  function status() {
    const entries = plan();
    const control = readQueue().control;
    const counts = { stages: entries.length, runnable: 0, claimed: 0, delivered: 0, waiting: 0, topics_ready: 0 };
    entries.forEach(entry => {
      if (entry.runnable) counts.runnable += 1;
      if (entry.claimed) counts.claimed += 1;
      if (entry.page_state === 'delivered') counts.delivered += 1;
      else counts.waiting += 1;
      if (entry.stage === 'adjudication' && entry.topic_ready) counts.topics_ready += 1;
    });
    return {
      paused: Boolean(control.paused),
      pause_reason: asText(control.reason),
      paused_at: control.changed_at || null,
      allowance: budget(),
      counts,
      stages: entries
    };
  }

  // A run that died mid-dispatch leaves a claim behind. When its lease has expired the stage goes back to
  // the queue with its attempt count intact, so a restart resumes instead of starting over or refusing.
  function recover() {
    return withLock(() => {
      const queue = readQueue();
      const current = nowMs();
      const released = [];
      Object.entries(queue.jobs).forEach(([key, job]) => {
        if (!job || job.state !== 'dispatched' || !job.claim) return;
        const expires = Date.parse(job.claim.expires_at);
        if (Number.isFinite(expires) && expires > current) return;
        job.state = 'queued';
        job.claim = null;
        job.updated_at = nowIso();
        job.notes = [...(job.notes || []), `lease expired; requeued at ${nowIso()} with ${job.attempts} attempt(s) recorded`].slice(-MAX_JOB_NOTES);
        released.push(key);
      });
      if (released.length) writeQueue(queue);
      return { released, checked: Object.keys(queue.jobs).length };
    });
  }

  function pause(reason, owner = 'operator') {
    return withLock(() => {
      const queue = readQueue();
      queue.control = {
        paused: true,
        reason: asText(reason).trim() || 'paused without a stated reason',
        changed_at: nowIso(),
        changed_by: owner
      };
      writeQueue(queue);
      return { paused: true, reason: queue.control.reason, changed_at: queue.control.changed_at };
    });
  }

  function resume(owner = 'operator') {
    return withLock(() => {
      const queue = readQueue();
      queue.control = { paused: false, reason: '', changed_at: nowIso(), changed_by: owner };
      writeQueue(queue);
      return { paused: false, changed_at: queue.control.changed_at };
    });
  }

  // The operator states the allowance; the supervisor never guesses it. Clearing the count is an explicit
  // act because no verified machine-readable reset signal exists for a ChatGPT or Codex plan.
  function setAllowance(settings = {}) {
    return withLock(() => {
      const usage = readUsage();
      ['limit', 'reserve'].forEach(field => {
        if (settings[field] === undefined || settings[field] === null) return;
        const value = Number(settings[field]);
        if (!Number.isFinite(value) || value < 0) throw failure('bad_allowance', `${field} must be a non-negative number`);
        usage[field] = value;
      });
      if (settings.reset) {
        usage.used = 0;
        usage.reset_at = nowIso();
        usage.dispatches = [];
      }
      writeUsage(usage);
      return budget();
    });
  }

  // The prompt is taken from the repository only when it still hashes to the value the catalogue published.
  // A prompt that drifted stops the dispatch instead of sending a stage a brief nobody catalogued.
  function verifiedPrompt(entry) {
    const filePath = path.join(repoRoot, entry.prompt_path);
    if (!fs.existsSync(filePath)) {
      throw failure('prompt_missing', `the ${entry.stage} prompt ${entry.prompt_path} is not in this checkout`);
    }
    const bytes = fs.readFileSync(filePath);
    const digest = sha256(bytes);
    if (entry.prompt_sha256 && digest !== entry.prompt_sha256) {
      throw failure('prompt_drift', `${entry.prompt_path} hashes to ${digest} but the catalogue says ${entry.prompt_sha256}; restore the prompt or rebuild the catalogue before dispatching this stage`);
    }
    if (entry.prompt_bytes && bytes.length !== entry.prompt_bytes) {
      throw failure('prompt_drift', `${entry.prompt_path} is ${bytes.length} bytes but the catalogue says ${entry.prompt_bytes}`);
    }
    return { path: filePath, relative: entry.prompt_path, text: bytes.toString('utf8'), sha256: digest, bytes: bytes.length };
  }

  // A later stage judges one exact version, read out of the private store and re-hashed here. If the bytes do
  // not match the registry the dispatch stops: the stage would otherwise judge something nobody registered.
  function parentDocumentFor(entry, progress) {
    if (!entry.parent_stage) return null;
    const parentStage = progress.stages.find(stage => stage.stage === entry.parent_stage) || null;
    if (!parentStage || parentStage.state !== 'delivered' || !parentStage.document_id) {
      throw failure('parent_missing', `the ${entry.stage} stage of ${entry.topic_id} judges the ${entry.parent_stage} document, and no ${entry.parent_stage} version is registered`);
    }
    const object = store.readObject(parentStage.document_id, parentStage.version);
    const digest = sha256(object.bytes);
    if (digest !== asText(parentStage.sha256)) {
      throw failure('parent_hash_mismatch', `${parentStage.document_id} version ${parentStage.version} reads back as ${digest} but the registry says ${parentStage.sha256}`);
    }
    return {
      document_id: parentStage.document_id,
      version: parentStage.version,
      sha256: digest,
      bytes: object.bytes.length,
      text: object.bytes.toString('utf8')
    };
  }

  function buildEnvelope(topic, stage, progress) {
    const prompt = verifiedPrompt({
      stage: asText(stage.stage),
      prompt_path: asText(stage.prompt_path),
      prompt_sha256: asText(stage.prompt_sha256),
      prompt_bytes: Number(stage.prompt_bytes) || null
    });
    const parent = parentDocumentFor({
      parent_stage: asText(stage.parent_stage),
      stage: asText(stage.stage),
      topic_id: asText(topic.topic_id)
    }, progress);
    const documentId = stageDocumentId(topic.topic_id, stage.stage);
    const composed = composeEnvelope({ topic, stage, prompt, parent, documentId, generatedAt: nowIso() });
    return { ...composed, document_id: documentId, prompt, parent };
  }

  // Preview only: it checks the prompt and the parent and returns the bytes that a dispatch would write. It
  // claims nothing, spends nothing from the allowance and records no job.
  function envelope(topicId, stageId) {
    const { topic } = topicContext(topicId);
    const stage = stageOf(topic, stageId);
    const progress = ResearchLibrary.topicProgress(topic, documents());
    return buildEnvelope(topic, stage, progress);
  }

  // Dispatch: claim the stage, write the envelope, spend one unit of the allowance. The order matters — the
  // prompt and the parent are verified before the claim, and the bytes are re-read from disk before the claim
  // is recorded, so a claim never stands for an envelope that is not on disk.
  function dispatch(topicId, stageId, dispatchOptions = {}) {
    const owner = asText(dispatchOptions.owner).trim() || `pid-${process.pid}`;
    const control = readQueue().control;
    if (control.paused) throw failure('pipeline_paused', `the pipeline is paused: ${asText(control.reason) || 'no reason recorded'}`);
    const allowanceState = budget();
    if (allowanceState.exhausted) {
      throw failure('allowance_exhausted', `the dispatch allowance is used up (${allowanceState.used} of ${allowanceState.usable} usable, ${allowanceState.reserve} held in reserve); the stage stays queued until the owner resets the count`);
    }
    const { topic } = topicContext(topicId);
    const stage = stageOf(topic, stageId);
    const progress = ResearchLibrary.topicProgress(topic, documents());
    const entry = plan({ topicId: asText(topic.topic_id) }).find(candidate => candidate.stage === asText(stage.stage));
    if (!entry) throw failure('not_in_plan', `${asText(topic.topic_id)} ${asText(stage.stage)} is not in the plan`);
    if (!entry.runnable && !entry.claim_held) throw failure('not_runnable', `${entry.job_key} cannot be dispatched: ${entry.reason}`);
    const built = buildEnvelope(topic, stage, progress);
    const key = jobKey(topic.topic_id, stage.stage);

    const result = withLock(() => {
      const queue = readQueue();
      if (queue.control.paused) throw failure('pipeline_paused', `the pipeline is paused: ${asText(queue.control.reason) || 'no reason recorded'}`);
      const usage = readUsage();
      const usable = Math.max(0, usage.limit - usage.reserve);
      if (usage.used >= usable) {
        throw failure('allowance_exhausted', `the dispatch allowance is used up (${usage.used} of ${usable} usable, ${usage.reserve} held in reserve)`);
      }
      const job = queue.jobs[key] || {
        job_key: key,
        topic_id: asText(topic.topic_id),
        stage: asText(stage.stage),
        order: Number(stage.order),
        attempts: 0,
        notes: [],
        created_at: nowIso()
      };
      if (job.state === 'dispatched' && job.claim && Date.parse(job.claim.expires_at) > nowMs()) {
        throw failure('already_dispatched', `${key} is already dispatched to ${job.claim.owner} until ${job.claim.expires_at}; recover() releases it once that lease has expired`);
      }
      if (job.state === 'dispatched' && job.claim) {
        throw failure('stale_claim', `${key} still holds a claim from ${job.claim.owner} that ran out at ${job.claim.expires_at}; run recover() to requeue it before dispatching again`);
      }
      const outboxPath = path.join(outboxDir, `${built.document_id}-${built.sha256.slice(0, 12)}.md`);
      writeFileAtomic(outboxPath, Buffer.from(built.text, 'utf8'));
      const written = fs.readFileSync(outboxPath);
      if (sha256(written) !== built.sha256) {
        throw failure('envelope_write_failed', `${outboxPath} does not read back to the envelope it was built from`);
      }
      job.state = 'dispatched';
      job.attempts = Number(job.attempts || 0) + 1;
      job.claim = {
        owner,
        token: crypto.randomBytes(12).toString('hex'),
        claimed_at: nowIso(),
        expires_at: new Date(nowMs() + leaseMs).toISOString()
      };
      job.envelope = {
        path: outboxPath,
        relative: path.relative(repoRoot, outboxPath).replace(/\\/g, '/'),
        sha256: built.sha256,
        bytes: built.bytes,
        document_id: built.document_id,
        prompt_path: built.prompt.relative,
        prompt_sha256: built.prompt.sha256,
        prompt_bytes: built.prompt.bytes,
        parent_document_id: built.parent ? built.parent.document_id : null,
        parent_version: built.parent ? built.parent.version : null,
        parent_sha256: built.parent ? built.parent.sha256 : null
      };
      job.last_error = null;
      job.problems = [];
      job.updated_at = nowIso();
      job.notes = [...(job.notes || []), `dispatched attempt ${job.attempts} to ${owner} at ${nowIso()}`].slice(-MAX_JOB_NOTES);
      queue.jobs[key] = job;
      usage.used += 1;
      usage.dispatches = [...usage.dispatches, {
        at: nowIso(),
        job_key: key,
        envelope_sha256: built.sha256,
        document_id: built.document_id
      }].slice(-50);
      writeUsage(usage);
      writeQueue(queue);
      return { job: JSON.parse(JSON.stringify(job)), allowance: budget() };
    });

    return {
      job: result.job,
      allowance: result.allowance,
      envelope: {
        document_id: built.document_id,
        sha256: built.sha256,
        bytes: built.bytes,
        outbox_path: result.job.envelope.path,
        outbox_relative: result.job.envelope.relative,
        prompt_sha256: built.prompt.sha256,
        parent_document_id: built.parent ? built.parent.document_id : null,
        parent_version: built.parent ? built.parent.version : null
      }
    };
  }

  function rejectJob(key, message, extra = {}) {
    return withLock(() => {
      const queue = readQueue();
      const record = queue.jobs[key] || { job_key: key, attempts: 0, notes: [], created_at: nowIso() };
      record.state = 'rejected';
      record.claim = null;
      record.updated_at = nowIso();
      record.last_error = message;
      record.problems = Array.isArray(extra.problems) ? extra.problems : [message];
      if (extra.rejected_path) record.rejected_return = extra.rejected_path;
      record.notes = [...(record.notes || []), `rejected at ${nowIso()}: ${message}`].slice(-MAX_JOB_NOTES);
      queue.jobs[key] = record;
      writeQueue(queue);
      return record;
    });
  }

  // A return is verified before it is stored, and the registration is confirmed by reading the object back and
  // asking the topic page again. Anything short of that leaves the registry untouched and the job rejected.
  function submit(topicId, stageId, bytes, submitOptions = {}) {
    const { catalog: catalogValue, topic } = topicContext(topicId);
    const stage = stageOf(topic, stageId);
    const key = jobKey(topic.topic_id, stage.stage);
    const job = readQueue().jobs[key] || null;
    if (!job) throw failure('not_dispatched', `${key} has not been dispatched, so there is nothing for a return to answer`);
    const buffer = Buffer.isBuffer(bytes) ? bytes : null;
    if (!buffer) throw failure('bad_return', 'the returned document has to be passed as raw bytes');

    // A repeated submission of bytes that are already registered is not an error: it is the safe answer to a
    // retry after a crash between the registry write and the queue write.
    if (job.state === 'registered') {
      const registeredDocument = documents().find(entry => entry.document_id === job.document_id) || null;
      const digest = sha256(buffer);
      const known = registeredDocument && (registeredDocument.versions || []).find(entry => entry.sha256 === digest) || null;
      if (known) {
        return {
          duplicate: true,
          job: { ...job },
          registration: { document_id: job.document_id, version: Number(known.version), sha256: digest, bytes: Number(known.bytes) },
          verification: { ok: true, bytes: buffer.length, sha256: digest, headings: null, problems: [] },
          stage_after: ResearchLibrary.topicProgress(topic, documents()).stages.find(entry => entry.stage === asText(stage.stage)) || null
        };
      }
      throw failure('already_registered', `${key} is already registered as ${job.document_id} version ${job.version}; a different return needs a new dispatch so the registry says which brief it answered`);
    }

    const check = verifyReturnDocument(buffer, verification);
    if (!check.ok) {
      const rejectedPath = path.join(rejectedDir, `${slug(key)}-${check.sha256.slice(0, 12)}.md`);
      writeFileAtomic(rejectedPath, buffer);
      const rejectedRelative = path.relative(repoRoot, rejectedPath).replace(/\\/g, '/');
      rejectJob(key, check.problems.join('; '), { problems: check.problems, rejected_path: rejectedRelative });
      throw failure('return_rejected', `${key} was not registered: ${check.problems.join('; ')}`, {
        problems: check.problems,
        rejected_path: rejectedRelative
      });
    }

    const model = asText(submitOptions.model).trim();
    if (!model) {
      throw failure('model_required', `${key} was not registered: name the model or session that produced the return, because the registry has to say where a document came from`);
    }
    const progress = ResearchLibrary.topicProgress(topic, documents());
    const parentStageId = asText(stage.parent_stage);
    const parentStage = parentStageId
      ? progress.stages.find(entry => entry.stage === parentStageId) || null
      : null;
    if (parentStageId && (!parentStage || parentStage.state !== 'delivered')) {
      throw failure('parent_missing', `${key} was not registered: the ${parentStageId} stage of this topic is not delivered, so the review would name no version it judged`);
    }

    const title = asText(submitOptions.title).trim() || `${asText(topic.title)}: ${asText(stage.label)}`;
    const openFindings = Array.isArray(submitOptions.open_findings)
      ? submitOptions.open_findings.map(entry => asText(entry).trim()).filter(Boolean)
      : [];
    const envelope = job.envelope || {};
    const documentId = asText(envelope.document_id) || stageDocumentId(topic.topic_id, stage.stage);
    const note = [
      asText(submitOptions.note).trim(),
      `${asText(stage.label)} stage of ${asText(topic.topic_id)}, returned to the unattended supervisor.`,
      envelope.prompt_sha256
        ? `The dispatch carried the stage prompt ${asText(envelope.prompt_path)} sha256 ${envelope.prompt_sha256} (${envelope.prompt_bytes} bytes), verified against the catalogue, as envelope sha256 ${envelope.sha256}.`
        : '',
      parentStage ? `It judges ${parentStage.document_id} version ${parentStage.version} sha256 ${parentStage.sha256}.` : '',
      `The return is ${check.bytes} bytes with ${check.headings} headings, sha256 ${check.sha256}; it passed the completeness check before registration.`
    ].filter(Boolean).join(' ');

    const registration = store.registerUpload({
      document_id: documentId,
      asset: asText(topic.asset) || 'USD',
      factor_id: Array.isArray(topic.factor_ids) && topic.factor_ids.length ? asText(topic.factor_ids[0]) : '',
      topic_id: asText(topic.topic_id),
      stage: asText(stage.stage),
      parent_document_id: parentStage ? parentStage.document_id : '',
      parent_version: parentStage ? parentStage.version : null,
      document_type: asText(stage.document_type),
      title,
      model,
      content_base64: buffer.toString('base64'),
      original_filename: asText(submitOptions.original_filename).trim() || `${documentId}.md`,
      note,
      open_findings: openFindings
    }, catalogValue);

    // Read the bytes back out of the store and re-hash them: a registry entry that does not match its object is
    // worse than no entry at all.
    const stored = store.readObject(registration.document_id, registration.version);
    if (sha256(stored.bytes) !== check.sha256 || stored.bytes.length !== check.bytes) {
      throw failure('readback_mismatch', `${registration.document_id} version ${registration.version} reads back as ${stored.bytes.length} bytes, not the ${check.bytes} that were submitted`);
    }
    const after = ResearchLibrary.topicProgress(topic, documents());
    const stageAfter = after.stages.find(entry => entry.stage === asText(stage.stage)) || null;
    const shownCorrectly = Boolean(stageAfter
      && stageAfter.state === 'delivered'
      && stageAfter.document_id === registration.document_id
      && Number(stageAfter.version) === Number(registration.version)
      && asText(stageAfter.sha256) === check.sha256);
    if (!shownCorrectly) {
      throw failure('registration_not_verified', `${registration.document_id} version ${registration.version} is in the registry but the ${asText(stage.stage)} stage of the topic page does not show it as delivered`);
    }

    const updated = withLock(() => {
      const queue = readQueue();
      const record = queue.jobs[key] || job;
      record.state = 'registered';
      record.claim = null;
      record.document_id = registration.document_id;
      record.version = Number(registration.version);
      record.sha256 = check.sha256;
      record.bytes = check.bytes;
      record.headings = check.headings;
      record.registered_at = nowIso();
      record.duplicate = Boolean(registration.duplicate);
      record.updated_at = nowIso();
      record.last_error = null;
      record.problems = [];
      record.notes = [...(record.notes || []), `registered as ${registration.document_id} version ${registration.version} at ${nowIso()}`].slice(-MAX_JOB_NOTES);
      queue.jobs[key] = record;
      writeQueue(queue);
      return JSON.parse(JSON.stringify(record));
    });
    if (envelope.path && fs.existsSync(envelope.path)) fs.rmSync(envelope.path, { force: true });

    return {
      duplicate: Boolean(registration.duplicate),
      job: updated,
      registration: {
        document_id: registration.document_id,
        version: Number(registration.version),
        sha256: check.sha256,
        bytes: check.bytes
      },
      verification: { ok: true, bytes: check.bytes, sha256: check.sha256, headings: check.headings, problems: [] },
      stage_after: stageAfter,
      topic_progress: after
    };
  }

  return {
    plan,
    status,
    envelope,
    dispatch,
    submit,
    recover,
    pause,
    resume,
    setAllowance,
    budget,
    jobs: () => readQueue().jobs,
    paths: {
      repo_root: repoRoot,
      catalog: catalogPath,
      registry: registryPath,
      library_root: libraryRoot,
      state_root: stateRoot,
      queue: queuePath,
      usage: usagePath,
      outbox: outboxDir,
      rejected: rejectedDir
    },
    store,
    catalog,
    documents
  };
}

module.exports = {
  verifyReturnDocument,
  composeEnvelope,
  stageDocumentId,
  createPipeline,
  PIPELINE_SCHEMA,
  JOB_STATES,
  DEFAULT_VERIFICATION
};

