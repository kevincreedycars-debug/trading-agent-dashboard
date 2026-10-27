'use strict';

// One unattended pass of the research supervisor.
//
// The operator CLI in scripts/research-pipeline.js moves one stage at a time by hand. This module is the half
// that can be put behind a scheduled task: it takes the next runnable stage, dispatches it, asks the carrier
// for an answer, refuses the answer unless the run's own record says the model answered with a search behind
// it, delivers it through the hosted store, and writes a receipt. Then it stops.
//
// The order is the whole safety argument, and it is the order the operator follows:
//
//   1. nothing is dispatched against a budget nobody read: the pass reads the newest Codex rollout under its own
//      Codex home first, and `dispatch` is called with require_provider, so a missing, stale, refused or exhausted
//      provider reading pauses the queue instead of spending it;
//   2. the carrier is a local process reading its own ~/.codex/auth.json, so no key, token or hosted runner is
//      involved and the spend is the plan's own allowance;
//   3. the answer is checked against the run before it is stored: the same thread in the event stream and the
//      rollout, the model the runtime recorded, a completed web_search where the stage needs a source, and the
//      exact bytes appearing in the rollout's assistant messages;
//   4. the hosted store is written and read back before the local registry records the same document, because a
//      document that sits only in a local folder is not delivery to the dashboard.
//
// Nothing here calls n8n, the live feed, production scoring or any trading surface, and nothing here writes to
// the trader's folders: every path it touches is under the repository root it is given.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const CodexUsage = require('./codex_usage.js');

const DEFAULT_MODEL = 'gpt-6-astra';
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
// Every research stage answers a brief that asks for sources, including the two that judge a document, so a
// run with no completed search is not a run this supervisor accepts unless the owner says otherwise.
const DEFAULT_REQUIRE_SEARCH = true;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function slug(value) {
  return asText(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item';
}

function failure(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  return Object.assign(error, extra);
}

function nowIso() {
  return new Date().toISOString();
}

// `--carrier` names the Codex build that answered the model on 2026-10-25. A path to a .js entry point is run
// with this Node, anything else is run directly, and a command with arguments is split on whitespace so a
// wrapper on the host does not need its own file.
function resolveCarrier(value) {
  const spec = asText(value).trim() || asText(process.env.RESEARCH_CARRIER).trim() || 'codex';
  const parts = spec.split(/\s+/).filter(Boolean);
  const head = parts[0];
  const rest = parts.slice(1);
  if (/\.(c|m)?js$/i.test(head)) {
    return { command: process.execPath, prefix: [path.resolve(head), ...rest], spec };
  }
  return { command: head, prefix: rest, spec };
}

function codexHomeOf(value) {
  const given = asText(value).trim() || asText(process.env.CODEX_HOME).trim();
  if (given) return path.resolve(given);
  return path.join(process.env.USERPROFILE || process.env.HOME || '.', '.codex');
}

function listFiles(directory, predicate) {
  const found = [];
  if (!fs.existsSync(directory)) return found;
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && predicate(full)) found.push(full);
    }
  };
  walk(directory);
  return found;
}

// The rollout of the run that just answered: `codex exec` names it `rollout-<timestamp>-<thread_id>.jsonl`, so
// the thread from the event stream is the join key. Newest-by-mtime is the fallback for a build that names it
// differently, and the caller still compares thread ids before believing it.
function findRollout(codexHome, threadId) {
  const sessions = path.join(codexHome, 'sessions');
  const files = listFiles(sessions, file => file.endsWith('.jsonl'));
  if (!files.length) return null;
  const wanted = asText(threadId).trim();
  if (wanted) {
    const named = files.find(file => path.basename(file).includes(wanted));
    if (named) return named;
  }
  let newest = null;
  for (const file of files) {
    const stat = fs.statSync(file);
    if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { file, mtimeMs: stat.mtimeMs };
  }
  return newest ? newest.file : null;
}

// `codex exec --json` on stdin with the envelope, `-o` for the last message, read-only sandbox and live search.
// The event stream is kept on disk because a search is only visible there: the rollout keeps the tool calls,
// not the retrieved text.
function runCarrier(options) {
  return new Promise(resolve => {
    fs.mkdirSync(path.dirname(options.exec_log_path), { recursive: true });
    fs.mkdirSync(path.dirname(options.answer_path), { recursive: true });
    const args = [
      ...options.carrier.prefix,
      'exec',
      '--json',
      '--skip-git-repo-check',
      '-m', options.model,
      '-c', 'web_search=live',
      '-s', 'read-only',
      '-C', options.repo_root,
      '-o', options.answer_path,
      '-'
    ];
    const result = {
      command: options.carrier.command,
      args,
      code: null,
      signal: null,
      timed_out: false,
      error: null,
      exec_log_path: options.exec_log_path,
      answer_path: options.answer_path,
      stderr: ''
    };
    let descriptor = null;
    let settled = false;
    let timer = null;
    let child = null;

    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (descriptor !== null) {
        try { fs.closeSync(descriptor); } catch (closeError) { /* the log is best effort */ }
        descriptor = null;
      }
      result.code = code;
      result.error = error ? asText(error.message || error) : null;
      resolve(result);
    };

    try {
      descriptor = fs.openSync(options.exec_log_path, 'w');
      child = spawn(options.carrier.command, args, {
        cwd: options.cwd || options.repo_root,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      finish(null, error);
      return;
    }

    timer = setTimeout(() => {
      result.timed_out = true;
      try { child.kill(); } catch (killError) { /* the process may already be gone */ }
    }, Number(options.timeout_ms) || DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      if (descriptor === null) return;
      try { fs.writeSync(descriptor, chunk); } catch (writeError) { /* the run must not die on a log write */ }
    });
    child.stderr.on('data', chunk => {
      result.stderr = `${result.stderr}${chunk.toString('utf8')}`.slice(-4000);
    });
    child.on('error', error => finish(null, error));
    child.on('close', code => finish(code));
    try {
      child.stdin.write(options.envelope_text);
      child.stdin.end();
    } catch (error) {
      finish(null, error);
    }
  });
}

function collapse(value) {
  return asText(value).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

// The same evidence the operator's `submit --rollout --exec-log --require-search` demands, checked here because
// delivery through the hosted store carries no execution receipt of its own. A mismatch refuses the document
// instead of registering it: a stage whose answer cannot be traced to a run is not a stage this worker delivered.
function verifyRun(options) {
  const log = CodexUsage.parseExecLogFile(options.exec_log_path);
  if (!log.events) {
    throw failure('exec_log_empty', `${options.exec_log_path} carries no event line, so the run that produced this answer is not recorded`);
  }
  if (!log.thread_id) {
    throw failure('thread_unverified', `${options.exec_log_path} carries no thread.started event, so the run cannot be identified`);
  }
  if (!options.rollout_path) {
    throw failure('rollout_missing', `no rollout file was found for thread ${log.thread_id}; a run started with --ephemeral writes none, and then the model that answered cannot be established`);
  }
  const reading = CodexUsage.parseRolloutFile(options.rollout_path);
  if (!reading.model) {
    throw failure('model_unverified', `${options.rollout_path} records no turn context, so the model that answered cannot be established`);
  }
  if (options.model && reading.model !== options.model) {
    throw failure('model_mismatch', `the stage was dispatched to ${options.model} but the rollout records ${reading.model} (thread ${reading.thread_id || 'unknown'})`);
  }
  if (reading.thread_id && log.thread_id !== reading.thread_id) {
    throw failure('exec_log_mismatch', `the exec log belongs to thread ${log.thread_id} but the rollout belongs to ${reading.thread_id}`);
  }
  if (options.require_search && log.searches.length === 0) {
    throw failure('search_not_observed', `${options.exec_log_path} records no completed web_search item, so the stage cannot be shown to have retrieved a source`);
  }
  const documentText = collapse(options.answer.toString('utf8'));
  const candidates = [...(reading.assistant_messages || []), reading.assistant_text]
    .filter(text => typeof text === 'string' && text.trim())
    .map(collapse);
  if (!candidates.some(candidate => candidate.includes(documentText))) {
    throw failure('return_not_in_rollout', `the answer does not appear in ${options.rollout_path}; the document a stage delivers has to be the document the run produced`);
  }
  return {
    log,
    reading,
    receipt: {
      verified_at: nowIso(),
      checker: 'research-worker',
      carrier: options.carrier_spec || null,
      exec_log: {
        path: path.resolve(options.exec_log_path),
        sha256: log.sha256,
        bytes: log.bytes,
        events: log.events,
        unreadable_lines: log.unreadable_lines
      },
      rollout: {
        path: path.resolve(options.rollout_path),
        sha256: reading.sha256,
        bytes: reading.bytes
      },
      thread_id: reading.thread_id || log.thread_id,
      model: reading.model,
      model_provider: reading.model_provider,
      cli_version: reading.cli_version,
      plan_type: reading.plan_type,
      observed_at: reading.observed_at,
      turns: reading.turns,
      usage: reading.usage,
      credits: reading.credits,
      windows: reading.windows,
      refusal: reading.refusal,
      search: {
        required: Boolean(options.require_search),
        count: log.searches.length,
        actions: log.searches.map(entry => entry.action),
        queries: [...new Set(log.searches.map(entry => entry.query).filter(Boolean))].slice(0, 25),
        sources: log.sources.slice(0, 50)
      }
    }
  };
}

// The pass itself. `createWorker` is exported so a test can drive one stage with a stubbed hosted store and a
// stubbed carrier; scripts/research-worker.js only supplies the real ones and prints the summary.
function createWorker(options = {}) {
  const pipeline = options.pipeline;
  if (!pipeline || typeof pipeline.dispatch !== 'function' || typeof pipeline.plan !== 'function') {
    throw new Error('createWorker needs a research pipeline (createPipeline())');
  }
  const repoRoot = pipeline.paths.repo_root;
  const workerDir = path.join(pipeline.paths.state_root, 'worker');
  const carrierDir = path.join(workerDir, 'carrier');
  const answerDir = path.join(workerDir, 'answers');
  const receiptsDir = path.join(pipeline.paths.state_root, 'receipts');
  const runLogPath = path.join(workerDir, 'runs.jsonl');

  const model = asText(options.model).trim() || DEFAULT_MODEL;
  const carrier = options.carrier || resolveCarrier(options.carrierPath);
  const codexHome = codexHomeOf(options.codexHome);
  const requireSearch = options.requireSearch === undefined ? DEFAULT_REQUIRE_SEARCH : Boolean(options.requireSearch);
  const maxStages = Math.max(1, Number(options.maxStages) || 1);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const stageFilter = asText(options.stage).trim();
  const assetFilter = asText(options.asset).trim().toUpperCase();
  const topicFilter = asText(options.topicId).trim();
  const dryRun = Boolean(options.dryRun);
  // `latest` (the default) reads the newest rollout under this worker's Codex home before the pass; a path reads
  // that file; false leaves the allowance exactly as it was found.
  const providerReading = options.providerReading === undefined ? 'latest' : options.providerReading;
  const stdout = options.stdout || (() => {});

  let hostedStore = options.hosted || null;

  function hosted() {
    if (hostedStore) return hostedStore;
    hostedStore = require('./research_hosted_store.js').create({ repoRoot });
    return hostedStore;
  }

  function writeJsonAtomic(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filePath);
    return filePath;
  }

  function appendRun(record) {
    try {
      fs.mkdirSync(workerDir, { recursive: true });
      fs.appendFileSync(runLogPath, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (error) {
      // A pass is not lost because its log line could not be written; the receipt file is the record of truth.
      stdout(`the worker log could not be written: ${asText(error.message || error)}\n`);
    }
  }

  // The next stage in catalogue order that every earlier stage of the topic has delivered. A stage whose claim
  // is still live is skipped rather than fought over: another process may be answering it right now.
  function nextStage() {
    const entries = pipeline.plan({ asset: assetFilter || undefined, topicId: topicFilter || undefined });
    const candidates = entries.filter(entry => entry.runnable && !entry.claim_held);
    const scoped = stageFilter ? candidates.filter(entry => entry.stage === stageFilter) : candidates;
    return scoped[0] || null;
  }

  // The pipeline hands back the whole stage record after a registration; the summary and the receipt only need the
  // state it ended in, which is the fact an operator reads.
  function stageStateOf(stageAfter) {
    return asText(stageAfter && stageAfter.state);
  }

  function summarizeAllowance(state) {
    const provider = state.provider || {};
    return {
      limit: state.limit,
      reserve: state.reserve,
      usable: state.usable,
      used: state.used,
      remaining: state.remaining,
      exhausted: state.exhausted,
      provider: {
        enforced: Boolean(provider.enforced),
        ok: Boolean(provider.ok),
        code: provider.code || null,
        reason: provider.reason || null,
        capacity_percent: provider.capacity_percent === undefined ? null : provider.capacity_percent,
        owner_reserve_percent: provider.owner_reserve_percent === undefined ? null : provider.owner_reserve_percent,
        age_minutes: provider.age_minutes === undefined ? null : provider.age_minutes,
        windows: provider.windows || {},
        credits: provider.credits || null,
        credits_baseline: provider.credits_baseline || null,
        refusal: provider.refusal || null
      }
    };
  }

  // The hosted store first, the local registry second, and the receipt last. Both writes are read back before
  // this returns, so a pass that reports a delivery is one the dashboard can already serve.
  async function deliver(document, verified) {
    const plan = pipeline.deliveryPlan(document.topicId, document.stageId, { chain: document.chain });
    const store = hosted();
    const status = store.status();
    if (!status.configured) {
      throw failure('hosted_not_configured', `the hosted research store is not configured: set ${(status.needed || []).join(', ') || 'the store settings'}; a document that sits only in a local folder is not delivery`);
    }
    const hostedReceipt = await store.register({
      topicId: plan.topicId,
      stage: plan.stage,
      title: plan.title,
      kind: plan.kind,
      notes: `Delivered by the unattended research worker from thread ${verified.receipt.thread_id} of ${model}.`,
      model,
      provenance: plan.provenance,
      parent: plan.parent,
      filename: document.filename,
      bytes: document.bytes
    });
    if (!hostedReceipt.ok) {
      throw failure(asText(hostedReceipt.code) || 'hosted_registration_failed', asText(hostedReceipt.message) || 'the hosted store refused the registration', {
        storage_path: asText(hostedReceipt.storage_path) || null,
        needs_registration_only: Boolean(hostedReceipt.needs_registration_only)
      });
    }
    const adopted = pipeline.adopt(document.topicId, document.stageId, document.bytes, {
      chain: document.chain,
      model,
      original_filename: document.filename,
      provenance: plan.provenance,
      hosted: hostedReceipt,
      hosted_required: true,
      source: `unattended research worker (thread ${verified.receipt.thread_id})`
    });
    return { plan, hostedReceipt, adopted };
  }

  // One stage, start to finish. Every refusal is returned rather than thrown so the pass can record the reason,
  // leave the claim to expire and stop instead of trying the same stage again inside the same window.
  async function runStage(entry) {
    const topicId = asText(entry.topic_id);
    const stageId = asText(entry.stage);
    const chain = asText(entry.chain_id) || undefined;
    const label = slug(entry.job_key);
    const outcome = {
      ok: false,
      status: 'failed',
      job_key: asText(entry.job_key),
      topic_id: topicId,
      stage: stageId,
      order: Number(entry.order) || null,
      chain: chain || null,
      model,
      started_at: nowIso()
    };
    try {
      const dispatched = pipeline.dispatch(topicId, stageId, {
        owner: `research-worker:${process.pid}`,
        chain,
        require_provider: true
      });
      const attempt = Number(dispatched.job.attempts) || 1;
      const envelopePath = dispatched.envelope.outbox_path || dispatched.envelope.path;
      const execLogPath = path.join(carrierDir, `${label}-attempt-${attempt}.jsonl`);
      const answerPath = path.join(answerDir, `${label}-attempt-${attempt}.md`);
      outcome.envelope = { path: envelopePath, sha256: dispatched.envelope.sha256, bytes: dispatched.envelope.bytes };
      outcome.exec_log = execLogPath;
      outcome.answer = answerPath;

      // The envelope goes to the carrier exactly as it was written to the outbox: stdin, one Markdown file. The
      // carrier never sees the queue, the store or the probe endpoints.
      const carrierRun = await runCarrier({
        carrier,
        model,
        repo_root: repoRoot,
        cwd: repoRoot,
        envelope_text: fs.readFileSync(envelopePath, 'utf8'),
        answer_path: answerPath,
        exec_log_path: execLogPath,
        timeout_ms: timeoutMs
      });
      outcome.carrier = {
        command: carrierRun.command,
        args: carrierRun.args,
        code: carrierRun.code,
        timed_out: carrierRun.timed_out,
        error: carrierRun.error,
        stderr_tail: carrierRun.stderr.slice(-1200) || null
      };
      if (carrierRun.timed_out) {
        throw failure('carrier_timeout', `the carrier did not finish within ${Math.round(timeoutMs / 60000)} minutes; its claim is left to expire and the stage is not delivered`);
      }
      if (carrierRun.error) throw failure('carrier_failed', `the carrier could not be started: ${carrierRun.error}`);
      if (carrierRun.code !== 0) {
        throw failure('carrier_failed', `the carrier exited ${carrierRun.code}; the stage is not delivered and its claim is left to expire`);
      }
      if (!fs.existsSync(answerPath)) {
        throw failure('answer_missing', `the carrier wrote no answer to ${answerPath}; a run that produced no document is not a delivery`);
      }
      const answer = fs.readFileSync(answerPath);
      outcome.answer_bytes = answer.length;
      outcome.answer_sha256 = sha256(answer);

      const log = CodexUsage.parseExecLogFile(execLogPath);
      const rolloutPath = findRollout(codexHome, log.thread_id);
      const verified = verifyRun({
        exec_log_path: execLogPath,
        rollout_path: rolloutPath,
        model,
        require_search: requireSearch,
        answer,
        carrier_spec: carrier.spec
      });
      outcome.thread_id = verified.receipt.thread_id;
      outcome.plan_type = verified.receipt.plan_type;
      outcome.windows = verified.receipt.windows;
      outcome.searches = verified.receipt.search.count;
      outcome.sources = verified.receipt.search.sources.length;

      const delivered = await deliver({ topicId, stageId, chain, bytes: answer, filename: path.basename(answerPath) }, verified);
      outcome.ok = true;
      outcome.status = 'delivered';
      outcome.registration = delivered.adopted.registration;
      outcome.hosted = delivered.adopted.hosted;
      outcome.stage_after = stageStateOf(delivered.adopted.stage_after);
      outcome.topic_ready = Boolean(delivered.adopted.topic_progress && delivered.adopted.topic_progress.ready_for_synthesis);
      outcome.receipt_path = writeJsonAtomic(
        path.join(receiptsDir, `worker-${label}-${delivered.adopted.registration.document_id}-v${delivered.adopted.registration.version}.json`),
        {
          job: { job_key: outcome.job_key, topic_id: topicId, stage: stageId, order: outcome.order, chain: chain || null, attempt },
          envelope: outcome.envelope,
          carrier: outcome.carrier,
          answer: { path: answerPath, sha256: outcome.answer_sha256, bytes: outcome.answer_bytes },
          execution: verified.receipt,
          delivery: {
            plan: delivered.plan,
            registration: delivered.adopted.registration,
            verification: delivered.adopted.verification,
            hosted: delivered.adopted.hosted,
            stage_after: stageStateOf(delivered.adopted.stage_after),
            topic_ready: outcome.topic_ready
          },
          recorded_at: nowIso()
        }
      );
    } catch (error) {
      outcome.ok = false;
      outcome.status = 'refused';
      outcome.code = asText(error.code) || 'worker_failed';
      outcome.message = asText(error.message || error);
      if (error.problems) outcome.problems = error.problems;
      if (error.storage_path) outcome.hosted_storage_path = error.storage_path;
      if (error.needs_registration_only) outcome.needs_registration_only = true;
    }
    outcome.finished_at = nowIso();
    return outcome;
  }

  // A pass may only dispatch against the provider's own numbers, and an unattended pass has no operator to run
  // `allowance --latest-rollout` before it starts. So the pass reads the newest rollout under its own Codex home,
  // which is where `codex exec` writes the provider's rate-limit event. The owner's switch is never turned on from
  // here: with the provider half off the pass leaves it off and lets the dispatch gate refuse.
  function readProviderReading(source) {
    if (source === false) {
      return { ok: false, skipped: true, code: 'provider_reading_off', message: 'the pass was told not to read a provider rollout' };
    }
    let gate;
    try {
      gate = pipeline.providerGate();
    } catch (error) {
      return { ok: false, code: asText(error.code) || 'provider_reading_unreadable', message: asText(error.message || error) };
    }
    if (!gate.enforced) {
      return {
        ok: false,
        skipped: true,
        code: 'provider_disabled',
        message: 'the provider half of the allowance is switched off, and a pass does not switch it on itself'
      };
    }
    const wanted = asText(source).trim();
    const file = wanted && wanted !== 'latest' ? path.resolve(wanted) : CodexUsage.latestRolloutFile({ codexHome });
    if (!file) {
      return {
        ok: false,
        code: 'provider_reading_missing',
        message: `no Codex rollout was found under ${codexHome}, so there is nothing to read the allowance from`
      };
    }
    try {
      const imported = pipeline.importProviderUsage({ file });
      return {
        ok: true,
        path: file,
        observed_at: imported.provider.observed_at,
        windows: imported.provider.windows,
        credits: imported.provider.credits
      };
    } catch (error) {
      return { ok: false, path: file, code: asText(error.code) || 'provider_reading_unreadable', message: asText(error.message || error) };
    }
  }

  // One pass: recover what died, read the allowance, run at most `maxStages` stages and stop at the first
  // refusal. A budget that cannot be read stops the pass the same way a spent one does.
  async function run() {
    const summary = {
      ok: true,
      started_at: nowIso(),
      model,
      codex_home: codexHome,
      carrier: carrier.spec,
      require_search: requireSearch,
      max_stages: maxStages,
      dry_run: dryRun,
      allowance: null,
      provider_reading: null,
      stages: [],
      stopped: null
    };
    try {
      const recovered = pipeline.recover();
      if (recovered && Array.isArray(recovered.recovered) && recovered.recovered.length) summary.recovered = recovered.recovered;
    } catch (error) {
      summary.recover_skipped = asText(error.message || error);
    }
    // A dry run reads nothing into the allowance: importing a rollout writes the usage state, and a dry run is the
    // one pass that must leave every file it is pointed at exactly as it found it.
    summary.provider_reading = dryRun
      ? { ok: false, skipped: true, code: 'dry_run', message: 'a dry run reads no provider rollout and writes no allowance state' }
      : readProviderReading(providerReading);
    for (let index = 0; index < maxStages; index += 1) {
      let allowance = null;
      try {
        allowance = pipeline.budget();
      } catch (error) {
        summary.ok = false;
        summary.stopped = { reason: 'budget_unreadable', code: asText(error.code) || 'budget_unreadable', message: asText(error.message || error) };
        break;
      }
      summary.allowance = summarizeAllowance(allowance);
      if (allowance.exhausted) {
        summary.stopped = {
          reason: 'allowance_exhausted',
          code: 'allowance_exhausted',
          message: `the dispatch allowance is used up (${allowance.used} of ${allowance.usable} usable, ${allowance.reserve} held in reserve)`
        };
        // A stop the owner has to clear is not a clean pass: the run log and the exit code have to say so, or a
        // scheduler would read "nothing delivered" as normal.
        summary.ok = false;
        break;
      }
      if (allowance.provider.enforced && !allowance.provider.ok) {
        summary.stopped = {
          reason: 'provider_gate',
          code: allowance.provider.code || 'provider_gate',
          message: allowance.provider.reason || 'the provider reading does not permit a dispatch'
        };
        summary.ok = false;
        break;
      }
      const entry = nextStage();
      if (!entry) {
        summary.stopped = { reason: 'no_runnable_stage', message: 'every stage in scope is delivered or waiting on an earlier one' };
        break;
      }
      if (dryRun) {
        summary.stages.push({
          ok: true,
          status: 'planned',
          job_key: entry.job_key,
          topic_id: entry.topic_id,
          stage: entry.stage,
          order: entry.order,
          prompt_sha256: entry.prompt_sha256
        });
        summary.stopped = { reason: 'dry_run', message: 'nothing was dispatched, no carrier was started and nothing was stored' };
        break;
      }
      const outcome = await runStage(entry);
      summary.stages.push(outcome);
      appendRun(outcome);
      if (!outcome.ok) {
        summary.ok = false;
        summary.stopped = { reason: 'stage_refused', code: outcome.code, message: outcome.message, job_key: outcome.job_key };
        break;
      }
    }
    if (!summary.stopped) {
      summary.stopped = { reason: 'stage_budget', message: `max-stages reached (${maxStages}); run the pass again for the next stage` };
    }
    summary.finished_at = nowIso();
    appendRun({
      at: summary.finished_at,
      event: 'pass',
      ok: summary.ok,
      model,
      dry_run: dryRun,
      stages: summary.stages.map(stage => ({ job_key: stage.job_key, stage: stage.stage, status: stage.status })),
      stopped: summary.stopped
    });
    return summary;
  }

  return {
    run,
    runStage,
    nextStage,
    hosted,
    paths: { worker_dir: workerDir, carrier_dir: carrierDir, answer_dir: answerDir, run_log: runLogPath }
  };
}

module.exports = {
  createWorker,
  verifyRun,
  findRollout,
  resolveCarrier,
  codexHomeOf,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_REQUIRE_SEARCH
};
