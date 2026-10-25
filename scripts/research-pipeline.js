'use strict';

// Operator front end of the unattended research supervisor.
//
//   node scripts/research-pipeline.js status [--json] [--stages]
//   node scripts/research-pipeline.js plan [--asset USD] [--topic TOPIC] [--runnable]
//   node scripts/research-pipeline.js preview TOPIC STAGE [--chain CHAIN] [--out FILE] [--json]
//   node scripts/research-pipeline.js dispatch TOPIC STAGE [--chain CHAIN] [--owner NAME]
//   node scripts/research-pipeline.js submit TOPIC STAGE --file FILE --model NAME [--chain CHAIN] [--title T] [--note N]
//                                                  [--open-finding TEXT ...]
//                                                  [--rollout ROLLOUT.jsonl] [--envelope SHA256]
//   node scripts/research-pipeline.js recover
//   node scripts/research-pipeline.js pause --reason TEXT
//   node scripts/research-pipeline.js resume
//   node scripts/research-pipeline.js allowance [--limit N] [--reserve N] [--reset]
//   node scripts/research-pipeline.js allowance --from-rollout FILE | --latest-rollout
//   node scripts/research-pipeline.js allowance --provider on|off [--capacity-percent N] [--max-age-minutes N]
//   node scripts/research-pipeline.js allowance --refusal MESSAGE [--refusal-type T] [--resets-at ISO]
//
// Every command prints JSON except `preview`, which prints the envelope itself, because the envelope is the
// artifact a model is given. Nothing here calls a model, n8n, the dispatcher, Supabase, the live feed or
// production scoring, and nothing here publishes: a dispatch is a file under `.local/research-pipeline`, and a
// submission is bytes the operator says came back, which must pass verification before the registry changes.
//
// The root overrides exist so the guards can drive this CLI against a temporary checkout: --root,
// --state-root, --library-root, --catalog, --registry.

const fs = require('node:fs');
const path = require('node:path');
const { createPipeline } = require('../lib/research_pipeline.js');

const USAGE = [
  'node scripts/research-pipeline.js status [--json] [--stages]',
  'node scripts/research-pipeline.js plan [--asset USD] [--topic TOPIC] [--runnable]',
  'node scripts/research-pipeline.js preview TOPIC STAGE [--chain CHAIN] [--out FILE] [--json]',
  'node scripts/research-pipeline.js dispatch TOPIC STAGE [--chain CHAIN] [--owner NAME]',
  'node scripts/research-pipeline.js submit TOPIC STAGE --file FILE --model NAME [--chain CHAIN] [--title T] [--note N] [--open-finding TEXT ...] [--rollout FILE] [--exec-log FILE] [--require-search] [--envelope SHA256]',
  'node scripts/research-pipeline.js recover',
  'node scripts/research-pipeline.js pause --reason TEXT',
  'node scripts/research-pipeline.js resume',
  'node scripts/research-pipeline.js allowance [--limit N] [--reserve N] [--reset]',
  'node scripts/research-pipeline.js allowance --from-rollout FILE | --latest-rollout [--capacity-percent N] [--max-age-minutes N]',
  'node scripts/research-pipeline.js allowance --provider on|off [--capacity-percent N] [--max-age-minutes N]',
  'node scripts/research-pipeline.js allowance --refusal MESSAGE [--refusal-type TYPE] [--resets-at ISO]'
].join('\n');

// Flags are a small, explicit set, so the parser stays a loop rather than a dependency: `--name value` or a
// bare `--name`, with `--open-finding` the one flag that may repeat. A repeated flag that is not listed is an
// error rather than a silent last-one-wins, because a submission should not quietly lose a finding.
const REPEATABLE_FLAGS = new Set(['open-finding']);

function parseArguments(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index]);
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if (!name) throw new Error('an empty -- flag is not a flag');
    const next = argv[index + 1];
    if (next === undefined || String(next).startsWith('--')) {
      flags[name] = true;
      continue;
    }
    index += 1;
    if (!Object.prototype.hasOwnProperty.call(flags, name)) {
      flags[name] = REPEATABLE_FLAGS.has(name) ? [String(next)] : String(next);
      continue;
    }
    if (!REPEATABLE_FLAGS.has(name)) throw new Error(`--${name} was given more than once`);
    flags[name] = [].concat(flags[name], String(next));
  }
  return { positionals, flags };
}

function flagText(flags, name, fallback = '') {
  const value = flags[name];
  if (value === undefined || value === true) return fallback;
  if (Array.isArray(value)) return value[value.length - 1];
  return String(value);
}

function flagNumber(flags, name) {
  if (flags[name] === undefined) return undefined;
  const value = Number(flagText(flags, name));
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a non-negative number`);
  return value;
}

function flagList(flags, name) {
  const value = flags[name];
  if (value === undefined) return [];
  return [].concat(value).map(entry => String(entry).trim()).filter(Boolean);
}

function pipelineFromFlags(flags) {
  const options = {};
  const root = flagText(flags, 'root');
  if (root) options.root = path.resolve(root);
  const stateRoot = flagText(flags, 'state-root');
  if (stateRoot) options.stateRoot = path.resolve(stateRoot);
  const libraryRoot = flagText(flags, 'library-root');
  if (libraryRoot) options.libraryRoot = path.resolve(libraryRoot);
  const catalogPath = flagText(flags, 'catalog');
  if (catalogPath) options.catalogPath = path.resolve(catalogPath);
  const registryPath = flagText(flags, 'registry');
  if (registryPath) options.registryPath = path.resolve(registryPath);
  return createPipeline(options);
}

function needPositionals(command, positionals, count, shape) {
  if (positionals.length < count) {
    throw new Error(`${command} needs ${shape}; run with --help for the command list`);
  }
  if (positionals.length > count) {
    throw new Error(`${command} takes ${shape} and nothing after it, not ${positionals.slice(count).join(' ')}`);
  }
}

function emit(io, payload) {
  io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function run(argv, io = process) {
  const { positionals, flags } = parseArguments(argv);
  const command = positionals.shift() || 'status';
  if (command === 'help' || flags.help || flags.h) {
    io.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const pipeline = pipelineFromFlags(flags);

  if (command === 'status') {
    const current = pipeline.status();
    emit(io, {
      ok: true,
      paused: current.paused,
      pause_reason: current.pause_reason,
      paused_at: current.paused_at,
      paused_by: current.paused_by,
      allowance: current.allowance,
      counts: current.counts,
      next: current.stages
        .filter(entry => entry.runnable)
        .map(entry => ({ job_key: entry.job_key, stage: entry.stage, prompt_path: entry.prompt_path })),
      held: current.stages
        .filter(entry => entry.claim_held)
        .map(entry => ({ job_key: entry.job_key, stage: entry.stage, claim_expires_at: entry.claim_expires_at })),
      paths: pipeline.paths,
      stages: flags.stages ? current.stages : undefined
    });
    return 0;
  }

  if (command === 'plan') {
    const entries = pipeline.plan({ asset: flagText(flags, 'asset'), topicId: flagText(flags, 'topic') });
    const rows = flags.runnable ? entries.filter(entry => entry.runnable) : entries;
    emit(io, {
      ok: true,
      count: rows.length,
      stages: rows.map(entry => ({
        job_key: entry.job_key,
        topic_id: entry.topic_id,
        stage: entry.stage,
        page_state: entry.page_state,
        job_state: entry.job_state,
        runnable: entry.runnable,
        claimed: entry.claimed,
        claim_held: entry.claim_held,
        attempts: entry.attempts,
        document_id: entry.document_id,
        delivered_version: entry.delivered_version,
        reason: entry.reason
      }))
    });
    return 0;
  }

  if (command === 'preview') {
    needPositionals(command, positionals, 2, 'TOPIC and STAGE');
    const [topicId, stageId] = positionals;
    const envelope = pipeline.envelope(topicId, stageId, { chain: flagText(flags, 'chain') });
    const out = flagText(flags, 'out');
    const summary = {
      ok: true,
      topic_id: topicId,
      stage: stageId,
      document_id: envelope.document_id,
      sha256: envelope.sha256,
      bytes: envelope.bytes,
      prompt_path: envelope.prompt.relative,
      prompt_sha256: envelope.prompt.sha256,
      parent_document_id: envelope.parent ? envelope.parent.document_id : null,
      parent_version: envelope.parent ? envelope.parent.version : null,
      written_to: null
    };
    if (out) {
      const target = path.resolve(out);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, envelope.text, 'utf8');
      summary.written_to = target;
    }
    // A preview claims nothing and spends nothing, so the same stage can be previewed as often as the
    // operator likes while the allowance is being worked out.
    if (out || flags.json) emit(io, summary);
    else io.stdout.write(envelope.text.endsWith('\n') ? envelope.text : `${envelope.text}\n`);
    return 0;
  }

  if (command === 'dispatch') {
    needPositionals(command, positionals, 2, 'TOPIC and STAGE');
    const [topicId, stageId] = positionals;
    const result = pipeline.dispatch(topicId, stageId, { owner: flagText(flags, 'owner', 'operator-cli'), chain: flagText(flags, 'chain') });
    emit(io, {
      ok: true,
      job_key: result.job.job_key,
      attempt: result.job.attempts,
      claim_expires_at: result.job.claim.expires_at,
      envelope: result.envelope,
      allowance: result.allowance
    });
    return 0;
  }

  if (command === 'submit') {
    needPositionals(command, positionals, 2, 'TOPIC and STAGE');
    const [topicId, stageId] = positionals;
    const file = flagText(flags, 'file');
    if (!file) throw new Error('submit needs --file FILE, the Markdown that came back');
    const source = path.resolve(file);
    if (!fs.existsSync(source)) throw new Error(`--file ${source} is not a file`);
    const result = pipeline.submit(topicId, stageId, fs.readFileSync(source), {
      model: flagText(flags, 'model'),
      title: flagText(flags, 'title'),
      note: flagText(flags, 'note'),
      original_filename: path.basename(source),
      open_findings: flagList(flags, 'open-finding'),
      chain: flagText(flags, 'chain'),
      rollout: flagText(flags, 'rollout'),
      exec_log: flagText(flags, 'exec-log'),
      require_search: flags['require-search'] === true,
      envelope_sha256: flagText(flags, 'envelope')
    });
    emit(io, {
      ok: true,
      duplicate: result.duplicate,
      registration: result.registration,
      verification: result.verification,
      execution: result.execution,
      stage_after: result.stage_after,
      topic_ready: Boolean(result.topic_progress && result.topic_progress.ready_for_synthesis)
    });
    return 0;
  }

  if (command === 'recover') {
    needPositionals(command, positionals, 0, 'no arguments');
    emit(io, { ok: true, ...pipeline.recover(), allowance: pipeline.budget() });
    return 0;
  }

  if (command === 'pause') {
    needPositionals(command, positionals, 0, 'no arguments');
    const result = pipeline.pause(flagText(flags, 'reason'), flagText(flags, 'owner', 'operator-cli'));
    emit(io, { ok: true, ...result });
    return 0;
  }

  if (command === 'resume') {
    needPositionals(command, positionals, 0, 'no arguments');
    const result = pipeline.resume(flagText(flags, 'owner', 'operator-cli'));
    emit(io, { ok: true, ...result, allowance: pipeline.budget() });
    return 0;
  }

  if (command === 'allowance') {
    needPositionals(command, positionals, 0, 'no arguments');
    const limit = flagNumber(flags, 'limit');
    const reserve = flagNumber(flags, 'reserve');
    const capacity = flagNumber(flags, 'capacity-percent');
    const maxAge = flagNumber(flags, 'max-age-minutes');
    const providerFlag = flagText(flags, 'provider').trim().toLowerCase();
    if (providerFlag && providerFlag !== 'on' && providerFlag !== 'off') {
      throw new Error('--provider takes on or off; it is the owner\'s switch for the provider half of the allowance');
    }
    const refusal = flagText(flags, 'refusal').trim();
    const fromRollout = flagText(flags, 'from-rollout').trim();
    const latest = flags['latest-rollout'] === true;

    // A refusal the carrier saw is recorded as evidence, not inferred: the queue stops on it until a fresh
    // reading or a manual resume after the reset.
    if (refusal) {
      const result = pipeline.recordProviderRefusal({
        message: refusal,
        type: flagText(flags, 'refusal-type', 'rate_limit'),
        resets_at: flagText(flags, 'resets-at'),
        at: flagText(flags, 'at')
      });
      emit(io, { ok: true, recorded: 'provider_refusal', provider: result.provider, allowance: result.budget, queue: result.queue });
      return 0;
    }

    // Importing is the only way the provider numbers enter the budget, and the same command is the resume
    // path: when the reading clears the gate, a pause this module set is lifted and the queue is untouched.
    if (fromRollout || latest) {
      const result = pipeline.importProviderUsage({
        file: latest ? '' : fromRollout,
        capacity_percent: capacity,
        max_age_minutes: maxAge,
        owner: flagText(flags, 'owner', 'operator-cli')
      });
      emit(io, { ok: true, imported: 'provider_reading', provider: result.provider, allowance: result.budget, queue: result.queue });
      return 0;
    }

    if (providerFlag || capacity !== undefined || maxAge !== undefined) {
      const result = pipeline.setProviderPolicy({
        enabled: providerFlag ? providerFlag === 'on' : undefined,
        capacity_percent: capacity,
        max_age_minutes: maxAge,
        owner: flagText(flags, 'owner', 'operator-cli')
      });
      emit(io, { ok: true, changed: true, provider: result.provider, allowance: result.budget, queue: result.queue });
      return 0;
    }

    const changed = limit !== undefined || reserve !== undefined || flags.reset === true;
    // Reading is the common case; a bare `allowance` reports the state without writing a file.
    const allowance = changed
      ? pipeline.setAllowance({ limit, reserve, reset: flags.reset === true })
      : pipeline.budget();
    emit(io, { ok: true, changed, allowance });
    return 0;
  }

  throw new Error(`unknown command ${command}; run with --help for the command list`);
}

function main(argv, io = process) {
  try {
    return run(argv, io);
  } catch (error) {
    const payload = {
      ok: false,
      code: error && error.code ? String(error.code) : 'cli_error',
      message: error && error.message ? error.message : String(error)
    };
    const extra = error && error.rejected_path ? { rejected_path: error.rejected_path } : {};
    const problems = error && Array.isArray(error.problems) ? { problems: error.problems } : {};
    io.stderr.write(`${JSON.stringify({ ...payload, ...problems, ...extra }, null, 2)}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { USAGE, parseArguments, main, run };
