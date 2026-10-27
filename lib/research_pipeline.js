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
const CodexUsage = require('./codex_usage.js');

const PIPELINE_SCHEMA = 'research-pipeline-state-v1';
const JOB_STATES = Object.freeze(['queued', 'dispatched', 'registered', 'rejected']);
const DEFAULT_LOCK_TTL_MS = 30 * 1000;
const DEFAULT_LEASE_MS = 90 * 60 * 1000;
const MAX_JOB_NOTES = 12;
// The hosted table's three stage numbers. A final chain carries its stage name in the kind column instead,
// because those numbers cannot distinguish the two chains on their own.
const HOSTED_STAGES = Object.freeze({ research: 1, red_team: 2, adjudication: 3 });

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
  const providerDefaults = { ...CodexUsage.DEFAULT_POLICY, ...(options.provider || {}) };
  const injectedCatalog = options.catalog || null;

  const queuePath = path.join(stateRoot, 'queue.json');
  const usagePath = path.join(stateRoot, 'usage.json');
  const lockPath = path.join(stateRoot, '.lock');
  const outboxDir = path.join(stateRoot, 'outbox');
  const receiptsDir = path.join(stateRoot, 'receipts');
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
      control: { paused: false, reason: '', changed_at: null, changed_by: null, paused_by: null },
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

  // The allowance has two halves. The dispatch count is the operator's own budget: the supervisor counts
  // what it spends and keeps `reserve` dispatches for the owner. The provider half is the plan's own
  // numbers, imported from a Codex rollout, and it is only enforced once the owner wires it in â€” a
  // pipeline that has never seen a provider reading must not pretend it has one.
  function readProvider(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const snapshot = source.snapshot && typeof source.snapshot === 'object' ? source.snapshot : null;
    const capacity = Number(source.capacity_percent);
    const maxAge = Number(source.max_age_minutes);
    return {
      enabled: source.enabled === undefined ? Boolean(providerDefaults.enabled) : source.enabled === true,
      capacity_percent: Number.isFinite(capacity) ? capacity : Number(providerDefaults.capacity_percent),
      max_age_minutes: Number.isFinite(maxAge) ? maxAge : Number(providerDefaults.max_age_minutes),
      snapshot: snapshot ? JSON.parse(JSON.stringify(snapshot)) : null,
      history: Array.isArray(source.history) ? source.history.slice(-20) : []
    };
  }

  function readUsage() {
    const raw = readJson(usagePath, null) || {};
    return {
      schema_version: PIPELINE_SCHEMA,
      limit: Number.isFinite(Number(raw.limit)) ? Number(raw.limit) : Number(allowanceDefaults.limit),
      reserve: Number.isFinite(Number(raw.reserve)) ? Number(raw.reserve) : Number(allowanceDefaults.reserve),
      used: Number.isFinite(Number(raw.used)) ? Number(raw.used) : 0,
      dispatches: Array.isArray(raw.dispatches) ? raw.dispatches.slice(-50) : [],
      reset_cadence: raw.reset_cadence || 'manual',
      reset_at: raw.reset_at || null,
      // `provider` is providerDefaults unless usage.json carries fields of its own; the function above
      // merges field by field so an older usage.json keeps working.
      provider: readProvider(raw.provider)
    };
  }

  function writeUsage(usage) {
    writeJsonAtomic(usagePath, usage);
    return usage;
  }

  // The provider gate, read fresh every time it is asked: nothing is cached, so a stale snapshot cannot be
  // mistaken for a current one by a long-lived process.
  function providerGate() {
    const usage = readUsage();
    return CodexUsage.evaluateGate({ provider: usage.provider, now: nowMs() });
  }

  function budget() {
    const usage = readUsage();
    const usable = Math.max(0, usage.limit - usage.reserve);
    const gate = CodexUsage.evaluateGate({ provider: usage.provider, now: nowMs() });
    return {
      limit: usage.limit,
      reserve: usage.reserve,
      usable,
      used: usage.used,
      remaining: Math.max(0, usable - usage.used),
      exhausted: usage.used >= usable,
      reset_cadence: usage.reset_cadence,
      reset_at: usage.reset_at,
      provider: {
        enforced: gate.enforced,
        ok: gate.ok,
        code: gate.code,
        reason: gate.reason,
        capacity_percent: gate.capacity_percent,
        owner_reserve_percent: gate.owner_reserve_percent,
        max_age_minutes: gate.max_age_minutes,
        observed_at: gate.observed_at,
        age_minutes: gate.age_minutes,
        plan_type: gate.plan_type,
        credits: gate.credits,
        refusal: gate.refusal,
        windows: gate.windows
      }
    };
  }


  // Both halves are checked before a claim is taken: the operator count and the provider signal. A failing
  // provider gate pauses the queue as well as refusing this dispatch, so an unattended loop cannot keep
  // retrying into a window it has already spent.
  function assertDispatchAllowance(requireProvider = false) {
    const state = budget();
    if (state.exhausted) {
      throw failure('allowance_exhausted', `the dispatch allowance is used up (${state.used} of ${state.usable} usable, ${state.reserve} held in reserve); the stage stays queued until the owner resets the count`);
    }
    const gate = state.provider;
    if (gate.enforced && !gate.ok) {
      const pauseState = withLock(() => settleQueueControl(gate, 'allowance-gate'));
      throw failure(gate.code, `${gate.reason}${pauseState.paused ? '; the pipeline is paused' : ''}`);
    }
    // A dispatch is authorised only against a reading of the provider's own allowance. With the provider half
    // switched off there is no reading at all, so the operational runner refuses and pauses the queue rather
    // than treating an unread budget as permission.
    if (requireProvider && (!gate.enforced || !gate.ok)) {
      const refusal = gate.enforced ? gate : { ...gate, ok: false, code: 'provider_disabled' };
      const pauseState = withLock(() => settleQueueControl(refusal, 'allowance-gate'));
      throw failure(refusal.code, `${refusal.reason}; the runner does not dispatch against a budget nobody read${pauseState.paused ? ', so the pipeline is paused' : ''}`);
    }
    return state;
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

  // A stage belongs to one unit of work: the committed catalogue keeps the three stages on the factor chain,
  // while a hand-written topic may carry them directly. Both shapes resolve here, so the supervisor reads the
  // same stages the topic page shows instead of an empty list on a chain-based catalogue.
  function stageUnitsFor(topic, catalogValue) {
    if (ResearchLibrary.chainStages(topic).length) return [topic];
    return ResearchLibrary.factorChainsForTopic(catalogValue, asText(topic.topic_id))
      .filter(chain => ResearchLibrary.chainStages(chain).length);
  }

  function unitIdOf(unit) {
    return asText(unit.chain_id) || asText(unit.topic_id);
  }

  // One topic can group several factor chains, and each chain runs its own three stages. Naming the chain is
  // therefore required exactly when the answer would otherwise be ambiguous; it is never guessed.
  function unitFor(topic, catalogValue, chainId) {
    const units = stageUnitsFor(topic, catalogValue);
    if (!units.length) {
      throw failure('topic_has_no_stages', `topic ${asText(topic.topic_id)} carries no stage, so there is nothing to run`);
    }
    const wanted = asText(chainId).trim();
    if (wanted) {
      const unit = units.find(candidate => unitIdOf(candidate) === wanted);
      if (!unit) {
        throw failure('not_in_catalog', `chain ${wanted} is not a chain of topic ${asText(topic.topic_id)}; the topic carries ${units.map(unitIdOf).join(', ')}`);
      }
      return unit;
    }
    if (units.length > 1) {
      throw failure('chain_required', `topic ${asText(topic.topic_id)} groups ${units.length} factor chains (${units.map(unitIdOf).join(', ')}); name one with --chain`);
    }
    return units[0];
  }

  function unitContext(topicId, stageId, unitOptions = {}) {
    const { catalog: catalogValue, topic } = topicContext(topicId, unitOptions.catalog);
    const unit = unitFor(topic, catalogValue, unitOptions.chain);
    const stage = ResearchLibrary.stageById(unit, stageId);
    if (!stage) throw failure('not_in_catalog', `${unitIdOf(unit)} has no ${stageId} stage`);
    return { catalogValue, topic, unit, unitId: unitIdOf(unit), stage };
  }

  // A topic that carries its own stages has no chain_id, so the registry is asked for its documents by the
  // factor the topic names: that is the same key the topic page uses, and it keeps a topic's stages visible
  // instead of silently reading as not started.
  function progressOf(unit, docs, catalogValue) {
    const factorId = asText(unit.factor_id)
      || (Array.isArray(unit.factor_ids) && unit.factor_ids.length ? asText(unit.factor_ids[0]) : '');
    return ResearchLibrary.chainProgress({ ...unit, factor_id: factorId }, docs, catalogValue);
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
      const units = stageUnitsFor(topic, value);
      const worked = units.flatMap(unit => {
        const progress = progressOf(unit, docs, value);
        return progress.stages.map(stage => ({ unit, unitId: unitIdOf(unit), progress, stage }));
      });
      worked.forEach(({ unit, unitId, progress, stage }) => {
        const key = jobKey(unitId, stage.stage);
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
          chain_id: asText(unit.chain_id),
          unit_id: unitId,
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
          document_id: stage.state === 'delivered' ? asText(stage.document_id) : stageDocumentId(unitId, stage.stage),
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
      paused_by: control.paused_by || null,
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
        changed_by: owner,
        paused_by: 'operator'
      };
      writeQueue(queue);
      return { paused: true, reason: queue.control.reason, changed_at: queue.control.changed_at };
    });
  }

  function resume(owner = 'operator') {
    return withLock(() => {
      const queue = readQueue();
      const gate = CodexUsage.evaluateGate({
        provider: readUsage().provider,
        now: nowMs()
      });
      // Resuming is not an override. When the owner has wired the provider signal in, a queue that stopped
      // because the allowance was used up, refused, stale or unreadable stays stopped until a fresh reading
      // says otherwise.
      if (gate.enforced && !gate.ok) {
        throw failure(gate.code, `the pipeline cannot resume: ${gate.reason}`);
      }
      queue.control = { paused: false, reason: '', changed_at: nowIso(), changed_by: owner, paused_by: null };
      writeQueue(queue);
      return { paused: false, changed_at: queue.control.changed_at, provider: gate.code };
    });
  }

  // Queue control is settled in one place, so a pause that this module created can also be lifted by it,
  // while an owner's pause is never lifted on the owner's behalf.
  function settleQueueControl(gate, owner = 'allowance-gate') {
    const queue = readQueue();
    const control = queue.control || emptyQueue().control;
    if (!gate.ok) {
      const reason = `allowance: ${gate.reason}`;
      const changed = !control.paused || control.reason !== reason;
      queue.control = { paused: true, reason, changed_at: nowIso(), changed_by: owner, paused_by: 'allowance' };
      if (changed) writeQueue(queue);
      return { changed, paused: true, reason };
    }
    if (control.paused && control.paused_by === 'allowance') {
      queue.control = { paused: false, reason: '', changed_at: nowIso(), changed_by: owner, paused_by: null };
      writeQueue(queue);
      return { changed: true, paused: false, reason: '' };
    }
    return { changed: false, paused: Boolean(control.paused), reason: asText(control.reason) };
  }
  function snapshotFromReading(reading) {
    return {
      observed_at: reading.observed_at || reading.last_event_at || null,
      plan_type: reading.plan_type || null,
      credits: reading.credits || null,
      windows: reading.windows || {},
      refusal: reading.refusal || null,
      source: {
        path: reading.path ? path.resolve(reading.path) : null,
        sha256: reading.sha256 || null,
        bytes: Number(reading.bytes) || null,
        thread_id: reading.thread_id || null,
        model: reading.model || null,
        model_provider: reading.model_provider || null,
        cli_version: reading.cli_version || null,
        events: Number(reading.events) || 0,
        unreadable_lines: Number(reading.unreadable_lines) || 0,
        rate_limit_events: Number(reading.rate_limit_events) || 0
      }
    };
  }

  // Importing a reading is the only way the provider half of the allowance becomes known. The reading is
  // recorded with its own hash and thread id, so a later reviewer can tell which run the numbers came from.
  function applyReading(reading, settings = {}) {
    return withLock(() => {
      const usage = readUsage();
      usage.provider.snapshot = snapshotFromReading(reading);
      if (settings.enabled !== undefined) usage.provider.enabled = settings.enabled === true;
      const capacity = Number(settings.capacity_percent);
      if (Number.isFinite(capacity) && capacity > 0) usage.provider.capacity_percent = Math.min(100, capacity);
      const maxAge = Number(settings.max_age_minutes);
      if (Number.isFinite(maxAge) && maxAge > 0) usage.provider.max_age_minutes = maxAge;
      const snapshot = usage.provider.snapshot;
      usage.provider.history = [...usage.provider.history, {
        at: nowIso(),
        observed_at: snapshot.observed_at,
        source: snapshot.source.path,
        thread_id: snapshot.source.thread_id,
        model: snapshot.source.model,
        primary: snapshot.windows.primary ? snapshot.windows.primary.used_percent : null,
        secondary: snapshot.windows.secondary ? snapshot.windows.secondary.used_percent : null,
        refused: Boolean(snapshot.refusal)
      }].slice(-20);
      writeUsage(usage);
      const gate = CodexUsage.evaluateGate({ provider: usage.provider, now: nowMs() });
      const control = settleQueueControl(gate, asText(settings.owner).trim() || 'allowance-gate');
      return { provider: gate, budget: budget(), queue: control };
    });
  }

  function importProviderUsage(settings = {}) {
    const file = asText(settings.file).trim() || CodexUsage.latestRolloutFile();
    if (!file) throw failure('provider_reading_missing', 'no rollout file was given and no Codex session rollout was found; pass --from-rollout FILE');
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) throw failure('provider_reading_missing', `${resolved} does not exist`);
    const reading = CodexUsage.parseRolloutFile(resolved);
    if (!reading.rate_limit_events) {
      throw failure(
        'provider_reading_incomplete',
        `${resolved} carries no rate-limit event (${reading.events} events read, ${reading.unreadable_lines} unreadable), so it cannot establish the allowance; a run started with --ephemeral writes no rollout, and a run that never reached the provider writes no limit numbers`
      );
    }
    return applyReading(reading, { ...settings, enabled: true, file: undefined });
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

  // When a run is refused the rollout may carry no limit event at all, so the refusal is recorded from what
  // the carrier saw. The gate then waits on the reset the refusal names.
  function recordProviderRefusal(settings = {}) {
    const message = asText(settings.message).trim();
    if (!message) throw failure('bad_refusal', 'a provider refusal needs the message the provider or carrier reported');
    return withLock(() => {
      const usage = readUsage();
      const base = usage.provider.snapshot || {
        observed_at: null,
        plan_type: null,
        credits: null,
        windows: {},
        source: { path: null, thread_id: null, model: null }
      };
      base.refusal = {
        type: asText(settings.type).trim() || 'rate_limit',
        message,
        at: asText(settings.at).trim() || nowIso(),
        resets_at: asText(settings.resets_at).trim() || (base.windows.primary ? base.windows.primary.resets_at : null)
      };
      usage.provider.snapshot = base;
      // A refusal is direct evidence that the plan's own limit is in play, so recording one also switches the
      // provider half on: the supervisor must not keep dispatching just because nobody had enabled it.
      usage.provider.enabled = true;
      writeUsage(usage);
      const gate = CodexUsage.evaluateGate({ provider: usage.provider, now: nowMs() });
      const control = settleQueueControl(gate, 'allowance-gate');
      return { provider: gate, budget: budget(), queue: control };
    });
  }

  function setProviderPolicy(settings = {}) {
    return withLock(() => {
      const usage = readUsage();
      if (settings.enabled !== undefined) usage.provider.enabled = settings.enabled === true;
      const capacity = Number(settings.capacity_percent);
      if (Number.isFinite(capacity) && capacity > 0) usage.provider.capacity_percent = Math.min(100, capacity);
      const maxAge = Number(settings.max_age_minutes);
      if (Number.isFinite(maxAge) && maxAge > 0) usage.provider.max_age_minutes = maxAge;
      writeUsage(usage);
      const gate = CodexUsage.evaluateGate({ provider: usage.provider, now: nowMs() });
      const queue = readQueue();
      const control = gate.enforced
        ? settleQueueControl(gate, asText(settings.owner).trim() || 'operator')
        : { changed: false, paused: Boolean(queue.control.paused), reason: asText(queue.control.reason) };
      return { provider: gate, budget: budget(), queue: control };
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
    const documentId = stageDocumentId(unitIdOf(topic), stage.stage);
    const composed = composeEnvelope({ topic, stage, prompt, parent, documentId, generatedAt: nowIso() });
    return { ...composed, document_id: documentId, prompt, parent };
  }

  // Preview only: it checks the prompt and the parent and returns the bytes that a dispatch would write. It
  // claims nothing, spends nothing from the allowance and records no job.
  function envelope(topicId, stageId, previewOptions = {}) {
    const { catalogValue, unit, stage } = unitContext(topicId, stageId, { chain: previewOptions.chain });
    const progress = progressOf(unit, documents(), catalogValue);
    return buildEnvelope(unit, stage, progress);
  }

  // Dispatch: claim the stage, write the envelope, spend one unit of the allowance. The order matters â€” the
  // prompt and the parent are verified before the claim, and the bytes are re-read from disk before the claim
  // is recorded, so a claim never stands for an envelope that is not on disk.
  function dispatch(topicId, stageId, dispatchOptions = {}) {
    const owner = asText(dispatchOptions.owner).trim() || `pid-${process.pid}`;
    const control = readQueue().control;
    if (control.paused) throw failure('pipeline_paused', `the pipeline is paused: ${asText(control.reason) || 'no reason recorded'}`);
    assertDispatchAllowance(Boolean(dispatchOptions.require_provider));
    const { catalogValue, topic, unit, unitId, stage } = unitContext(topicId, stageId, { chain: dispatchOptions.chain });
    const progress = progressOf(unit, documents(), catalogValue);
    const entry = plan({ topicId: asText(topic.topic_id) }).find(candidate =>
      candidate.unit_id === unitId && candidate.stage === asText(stage.stage));
    if (!entry) throw failure('not_in_plan', `${unitId} ${asText(stage.stage)} is not in the plan`);
    if (!entry.runnable && !entry.claim_held) throw failure('not_runnable', `${entry.job_key} cannot be dispatched: ${entry.reason}`);
    const built = buildEnvelope(unit, stage, progress);
    const key = jobKey(unitId, stage.stage);

    const result = withLock(() => {
      const queue = readQueue();
      if (queue.control.paused) throw failure('pipeline_paused', `the pipeline is paused: ${asText(queue.control.reason) || 'no reason recorded'}`);
      const usage = readUsage();
      const usable = Math.max(0, usage.limit - usage.reserve);
      if (usage.used >= usable) {
        throw failure('allowance_exhausted', `the dispatch allowance is used up (${usage.used} of ${usable} usable, ${usage.reserve} held in reserve)`);
      }
      const gate = CodexUsage.evaluateGate({ provider: usage.provider, now: nowMs() });
      if (gate.enforced && !gate.ok) {
        throw failure(gate.code, gate.reason);
      }
      const job = queue.jobs[key] || {
        job_key: key,
        topic_id: asText(topic.topic_id),
        chain_id: asText(unit.chain_id),
        unit_id: unitId,
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

  // A return is only evidence of a model run when the run itself says so. The rollout records the model the
  // runtime used and the answer it produced, so a receipt is checked against both: a claimed model that
  // differs from the recorded one is refused, and bytes that do not appear in the rollout are refused too.
  // That is the difference between "the answer says gpt-6-astra" and "the runtime ran gpt-6-astra".
  function verifyExecutionReceipt(submitOptions, job, buffer) {
    const envelopeClaim = asText(submitOptions.envelope_sha256).trim();
    const rolloutPath = asText(submitOptions.rollout).trim();
    if (envelopeClaim) {
      const declared = job.envelope && job.envelope.sha256 ? job.envelope.sha256 : null;
      if (!declared) throw failure('envelope_unknown', `${asText(job.job_key) || 'the job'} carries no dispatched envelope to compare with`);
      if (declared !== envelopeClaim) {
        throw failure('envelope_mismatch', `the carrier was given an envelope hashing to ${envelopeClaim} but this dispatch wrote ${declared}; the stage would be answering a different brief`);
      }
    }
    if (!rolloutPath) return null;
    const resolved = path.resolve(rolloutPath);
    if (!fs.existsSync(resolved)) throw failure('rollout_missing', `${resolved} does not exist, so the run cannot be verified`);
    const bytes = fs.readFileSync(resolved);
    const reading = CodexUsage.parseRolloutBytes(bytes, { path: resolved });
    if (!reading.model) {
      throw failure('model_unverified', `${resolved} records no turn context, so the model that answered cannot be established`);
    }
    const claimed = asText(submitOptions.model).trim();
    if (claimed && claimed !== reading.model) {
      throw failure('model_mismatch', `the return is claimed from ${claimed} but the rollout records ${reading.model} (thread ${reading.thread_id || 'unknown'})`);
    }
    // The carrier's event stream is where a search is visible. When one is supplied it must belong to the
    // same run, and when the caller requires a search the stage has to have made one.
    let search = null;
    const execLogPath = asText(submitOptions.exec_log).trim();
    if (execLogPath) {
      const logResolved = path.resolve(execLogPath);
      if (!fs.existsSync(logResolved)) throw failure('exec_log_missing', `${logResolved} does not exist`);
      const log = CodexUsage.parseExecLogFile(logResolved);
      if (log.thread_id && reading.thread_id && log.thread_id !== reading.thread_id) {
        throw failure('exec_log_mismatch', `the exec log belongs to thread ${log.thread_id} but the rollout belongs to ${reading.thread_id}; the receipt has to describe one run`);
      }
      if (submitOptions.require_search && log.searches.length === 0) {
        throw failure('search_not_observed', `${logResolved} records no completed web_search item, so the stage cannot be shown to have retrieved a source`);
      }
      search = {
        path: logResolved,
        sha256: log.sha256,
        bytes: log.bytes,
        thread_id: log.thread_id,
        searches: log.searches.length,
        actions: log.searches.map(entry => entry.action),
        queries: [...new Set(log.searches.map(entry => entry.query).filter(Boolean))].slice(0, 25),
        sources: log.sources.slice(0, 50)
      };
    } else if (submitOptions.require_search) {
      throw failure('search_not_observed', 'a required search cannot be shown without the captured codex exec event stream; pass --exec-log FILE');
    }
    const collapse = value => value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    const documentText = collapse(buffer.toString('utf8'));
    // A run may say a sentence before the document; the return has to be one of its assistant messages, or
    // the whole of them joined, with whitespace collapsed.
    const candidates = [...(reading.assistant_messages || []), reading.assistant_text]
      .filter(text => typeof text === 'string' && text.trim())
      .map(collapse);
    if (!candidates.some(candidate => candidate.includes(documentText))) {
      throw failure('return_not_in_rollout', `the returned bytes do not appear in ${resolved}; the document a stage submits has to be the document the run produced`);
    }
    return {
      reading,
      receipt: {
        verified_at: nowIso(),
        rollout: { path: resolved, sha256: reading.sha256, bytes: reading.bytes },
        thread_id: reading.thread_id,
        model: reading.model,
        model_provider: reading.model_provider,
        cli_version: reading.cli_version,
        plan_type: reading.plan_type,
        observed_at: reading.observed_at,
        turns: reading.turns,
        usage: reading.usage,
        windows: reading.windows,
        refusal: reading.refusal,
        envelope_sha256: job.envelope ? job.envelope.sha256 : null,
        model_claim: claimed || null,
        search
      }
    };
  }

  // The receipt goes into the job record and into its own file, so a later reviewer does not have to trust
  // the queue file alone. The provider snapshot is then refreshed from the same rollout: the run that just
  // spent allowance is also the freshest reading of what is left of it.
  function recordExecution(key, verified, registration) {
    const receiptPath = path.join(receiptsDir, `${slug(key)}-${registration.document_id}-v${registration.version}.json`);
    writeJsonAtomic(receiptPath, verified.receipt);
    return withLock(() => {
      const queue = readQueue();
      const record = queue.jobs[key];
      if (record) {
        record.execution = { ...verified.receipt, receipt_path: receiptPath };
        record.updated_at = nowIso();
        record.notes = [...(record.notes || []), `execution verified from ${path.basename(verified.receipt.rollout.path)} (${verified.receipt.model}, thread ${verified.receipt.thread_id || 'unknown'})`].slice(-MAX_JOB_NOTES);
        queue.jobs[key] = record;
        writeQueue(queue);
      }
      return receiptPath;
    });
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
    const { catalogValue, topic, unit, unitId, stage } = unitContext(topicId, stageId, { chain: submitOptions.chain });
    const key = jobKey(unitId, stage.stage);
    const job = readQueue().jobs[key] || null;
    if (!job) throw failure('not_dispatched', `${key} has not been dispatched, so there is nothing for a return to answer`);
    const buffer = Buffer.isBuffer(bytes) ? bytes : null;
    if (!buffer) throw failure('bad_return', 'the returned document has to be passed as raw bytes');

    // Checked before anything is stored: which brief the carrier was given, and whether these bytes came
    // out of the run the rollout records.
    const execution = verifyExecutionReceipt(submitOptions, job, buffer);

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
          stage_after: progressOf(unit, documents(), catalogValue).stages.find(entry => entry.stage === asText(stage.stage)) || null
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
    const progress = progressOf(unit, documents(), catalogValue);
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
      factor_id: asText(unit.factor_id) || (Array.isArray(topic.factor_ids) && topic.factor_ids.length ? asText(topic.factor_ids[0]) : ''),
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
    const after = progressOf(unit, documents(), catalogValue);
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

    // The receipt is written and the provider snapshot refreshed from the same rollout. A registered return
    // is never thrown away because the allowance changed afterwards: the queue keeps the progress and only
    // the next dispatch is refused.
    let executionRecord = null;
    if (execution) {
      const receiptPath = recordExecution(key, execution, registration);
      applyReading(execution.reading, {});
      executionRecord = { ...execution.receipt, receipt_path: receiptPath };
    }

    return {
      duplicate: Boolean(registration.duplicate),
      job: updated,
      execution: executionRecord,
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

  // What the hosted store needs to record one stage, derived from the catalogue and the registry rather than
  // typed by whoever starts the run. The chain id is the hosted topic_id, because two chains under one display
  // topic must never share a version sequence. The prompt provenance is the catalogued one, so a hosted note
  // names the brief the stage actually answered.
  function deliveryPlan(topicId, stageId, planOptions = {}) {
    const { catalogValue, topic, unit, unitId, stage } = unitContext(topicId, stageId, planOptions);
    const ownerId = asText(unit.chain_id) || asText(unit.topic_id) || unitId;
    const stageNumber = HOSTED_STAGES[asText(stage.stage)] || 0;
    if (!stageNumber) throw failure('not_in_catalog', `the hosted store has no stage number for ${asText(stage.stage)}`);
    const parentStageId = asText(stage.parent_stage);
    const progress = progressOf(unit, documents(), catalogValue);
    let parent = null;
    if (parentStageId) {
      const parentState = progress.stages.find(entry => entry.stage === parentStageId) || null;
      if (!parentState || parentState.state !== 'delivered') {
        throw failure('parent_missing', `the ${parentStageId} stage of ${unitId} is not delivered, so this document would name no version it judged`);
      }
      parent = {
        stage_number: HOSTED_STAGES[parentStageId] || 0,
        version: Number(parentState.version),
        sha256: asText(parentState.sha256)
      };
      const researchState = progress.stages.find(entry => entry.stage === 'research') || null;
      if (researchState && researchState.state === 'delivered') parent.research_version = Number(researchState.version);
    }
    const source = stage.prompt_source || {};
    return {
      topicId: ownerId,
      group_topic_id: asText(topic.topic_id),
      unit_id: unitId,
      stage: stageNumber,
      stage_id: asText(stage.stage),
      kind: asText(stage.document_type),
      title: `${asText(unit.title || topic.title)}: ${asText(stage.label)}`,
      parent,
      provenance: {
        prompt_path: asText(stage.prompt_path) || asText(source.repo_path),
        prompt_sha256: asText(stage.prompt_sha256) || asText(source.sha256),
        catalog_version: asText(source.template_version)
      }
    };
  }

  // The registry write and the two read-backs shared by adopt (a document from elsewhere) and deliver (the
  // hosted registration first, then the same local record). Kept in one place so a document cannot enter the
  // registry by a path that skips the hash or the parent check.
  function recordAdoptedDocument(context) {
    const { catalogValue, topic, unit, stage, buffer, check, model, hostedReceipt, adoptOptions } = context;
    const progress = progressOf(unit, documents(), catalogValue);
    const parentStageId = asText(stage.parent_stage);
    const parentStage = parentStageId ? progress.stages.find(entry => entry.stage === parentStageId) || null : null;
    if (parentStageId && (!parentStage || parentStage.state !== 'delivered')) {
      throw failure('parent_missing', `${stage.stage} was not registered: the ${parentStageId} stage of this topic is not delivered`);
    }
    const documentId = stageDocumentId(asText(topic.topic_id), asText(stage.stage));
    const provenance = (adoptOptions && adoptOptions.provenance) || {};
    const note = [
      asText(adoptOptions && adoptOptions.note).trim(),
      `Registered on ${nowIso()} from ${asText(adoptOptions && adoptOptions.source).trim() || 'a run outside this queue'}; no dispatch in this queue is claimed and no allowance unit was spent.`,
      provenance.prompt_path || provenance.prompt_sha256
        ? `It was produced against the prompt ${asText(provenance.prompt_path) || 'unknown'} sha256 ${asText(provenance.prompt_sha256) || 'unknown'}${provenance.prompt_bytes ? ` (${Number(provenance.prompt_bytes)} bytes)` : ''}${provenance.catalog_version ? `, catalog ${asText(provenance.catalog_version)}` : ''}. That is the brief it answered, recorded even where it is not the brief the catalogue now serves.`
        : '',
      hostedReceipt ? `The hosted store holds it at ${asText(hostedReceipt.storage_path)} as version ${Number(hostedReceipt.version)} (row ${asText(hostedReceipt.row_id)}), downloaded again and re-hashed to the same ${check.sha256}.` : '',
      `The document is ${check.bytes} bytes with ${check.headings} headings, sha256 ${check.sha256}.`
    ].filter(Boolean).join(' ');

    const registration = store.registerUpload({
      document_id: documentId,
      asset: asText(topic.asset) || 'USD',
      factor_id: asText(unit.factor_id) || (Array.isArray(topic.factor_ids) && topic.factor_ids.length ? asText(topic.factor_ids[0]) : ''),
      topic_id: asText(topic.topic_id),
      stage: asText(stage.stage),
      parent_document_id: parentStage ? parentStage.document_id : '',
      parent_version: parentStage ? parentStage.version : null,
      document_type: asText(stage.document_type),
      title: asText(adoptOptions && adoptOptions.title).trim() || `${asText(topic.title)}: ${asText(stage.label)}`,
      model,
      content_base64: buffer.toString('base64'),
      original_filename: asText(adoptOptions && adoptOptions.original_filename).trim() || `${documentId}.md`,
      note,
      open_findings: Array.isArray(adoptOptions && adoptOptions.open_findings) ? adoptOptions.open_findings : []
    }, catalogValue);

    const stored = store.readObject(registration.document_id, registration.version);
    if (sha256(stored.bytes) !== check.sha256 || stored.bytes.length !== check.bytes) {
      throw failure('readback_mismatch', `${registration.document_id} version ${registration.version} reads back as ${stored.bytes.length} bytes, not the ${check.bytes} that were registered`);
    }
    const after = progressOf(unit, documents(), catalogValue);
    const stageAfter = after.stages.find(entry => entry.stage === asText(stage.stage)) || null;
    if (!stageAfter || stageAfter.state !== 'delivered') {
      throw failure('registration_not_verified', `${registration.document_id} version ${registration.version} is in the registry but the ${asText(stage.stage)} stage does not read as delivered`);
    }
    return {
      registration: {
        document_id: registration.document_id,
        version: Number(registration.version),
        sha256: check.sha256,
        bytes: check.bytes
      },
      verification: { ok: true, bytes: check.bytes, sha256: check.sha256, headings: check.headings, problems: [] },
      hosted: hostedReceipt
        ? {
          row_id: asText(hostedReceipt.row_id),
          storage_path: asText(hostedReceipt.storage_path),
          version: Number(hostedReceipt.version),
          sha256: asText(hostedReceipt.sha256),
          duplicate: Boolean(hostedReceipt.duplicate),
          readback: hostedReceipt.readback || null
        }
        : null,
      stage_after: stageAfter,
      topic_progress: after
    };
  }

  // Register a document that was produced somewhere else - another checkout, an earlier pilot folder, a run
  // that predates this pipeline - without pretending it answered a dispatch in this queue. Nothing is spent and
  // no claim is written; the bytes, their hash and the provenance the caller states are recorded, and the same
  // read-back check as a submitted return decides whether the stage may read as delivered.
  function adopt(topicId, stageId, bytes, adoptOptions = {}) {
    const { catalogValue, topic, unit, stage } = unitContext(topicId, stageId, { chain: adoptOptions.chain, catalog: adoptOptions.catalog });
    const buffer = Buffer.isBuffer(bytes) ? bytes : null;
    if (!buffer) throw failure('bad_return', 'the adopted document has to be passed as raw bytes');
    const check = verifyReturnDocument(buffer, verification);
    if (!check.ok) {
      throw failure('return_rejected', `${stage.stage} was not adopted: ${check.problems.join('; ')}`, { problems: check.problems });
    }
    const model = asText(adoptOptions.model).trim();
    if (!model) {
      throw failure('model_required', `${stage.stage} was not adopted: name the model or session that produced it, because the registry has to say where a document came from`);
    }
    const hostedReceipt = adoptOptions.hosted || null;
    if (adoptOptions.hosted_required && !hostedReceipt) {
      throw failure('hosted_not_configured', `${stage.stage} was not adopted: the hosted store is not configured, and a document that sits only in a local folder is not delivery`);
    }
    if (hostedReceipt && !hostedReceipt.ok) {
      throw failure(asText(hostedReceipt.code) || 'hosted_registration_failed', `${stage.stage} was not adopted: ${asText(hostedReceipt.message)}`);
    }
    if (hostedReceipt && asText(hostedReceipt.sha256) !== check.sha256) {
      throw failure('hosted_readback_mismatch', `${stage.stage} was not adopted: the hosted row is sha256 ${asText(hostedReceipt.sha256)}, not the ${check.sha256} that would be recorded here`);
    }
    return recordAdoptedDocument({ catalogValue, topic, unit, stage, parentStage: null, buffer, check, model, hostedReceipt, adoptOptions });
  }

  return {
    plan,
    status,
    envelope,
    dispatch,
    submit,
    adopt,
    deliveryPlan,
    recover,
    pause,
    resume,
    setAllowance,
    budget,
    providerGate,
    importProviderUsage,
    recordProviderRefusal,
    setProviderPolicy,
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
      receipts: receiptsDir,
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

