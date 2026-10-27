'use strict';

// The scheduled-task entry point for the unattended research worker.
//
//   node scripts/research-worker.js [--max-stages N] [--stage STAGE] [--asset USD] [--topic TOPIC]
//                                   [--model NAME] [--carrier PATH] [--codex-home DIR]
//                                   [--timeout-minutes N] [--no-require-search]
//                                   [--provider-reading FILE|--no-provider-reading] [--dry-run]
//                                   [--root DIR] [--state-root DIR] [--library-root DIR]
//                                   [--catalog FILE] [--registry FILE]
//
// One invocation is one bounded pass. The pass stops itself at the first refused stage, at a failing provider
// gate and at the dispatch allowance, and it prints one JSON summary. Exit code 0 means the pass did what it set
// out to do (delivering a stage, or finding nothing runnable); 1 means it refused for a reason named in the
// summary, which is what the task scheduler should surface to the owner.
//
// The pass does not publish to the dashboard: delivery is the hosted store, which the dashboard already reads.
// The stock flags the operator CLI uses for a temporary checkout are accepted here for the same reason, so a
// guard can drive a whole pass against a fixture rather than the private library.

const { createPipeline } = require('../lib/research_pipeline.js');
const { createWorker } = require('../lib/research_worker.js');
const { parseArguments } = require('./research-pipeline.js');

const USAGE = [
  'node scripts/research-worker.js [--dry-run] [--max-stages N]',
  '  [--stage research|red_team|adjudication] [--asset USD] [--topic TOPIC]',
  '  [--model NAME] [--carrier PATH] [--codex-home DIR] [--timeout-minutes N] [--no-require-search]',
  '  [--provider-reading FILE] [--no-provider-reading] [--allow-unconfigured-store]',
  '  [--root DIR] [--state-root DIR] [--library-root DIR] [--catalog FILE] [--registry FILE]',
  '',
  'One pass: recover, read the provider rollout, read the allowance, run the next runnable stage, verify the',
  'run, deliver through the hosted store, write a receipt, stop. Nothing is dispatched without a provider reading.',
  'The reading is the newest rollout under --codex-home unless --provider-reading names one; a pass never switches',
  'the provider half of the allowance on itself. A pass also refuses to start a carrier while the hosted store is',
  'not configured, because an answer the dashboard cannot serve is one the owner paid for and cannot read.'
].join('\n');

function text(flags, name, fallback = '') {
  const value = flags[name];
  if (value === undefined || value === true) return fallback;
  if (Array.isArray(value)) return value[value.length - 1];
  return String(value);
}

function number(flags, name) {
  if (flags[name] === undefined) return undefined;
  const value = Number(text(flags, name));
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a non-negative number`);
  return value;
}

function pipelineFromFlags(flags) {
  const options = {};
  const root = text(flags, 'root');
  const stateRoot = text(flags, 'state-root');
  const libraryRoot = text(flags, 'library-root');
  const catalog = text(flags, 'catalog');
  const registry = text(flags, 'registry');
  if (root) options.root = root;
  if (stateRoot) options.stateRoot = stateRoot;
  if (libraryRoot) options.libraryRoot = libraryRoot;
  if (catalog) options.catalogPath = catalog;
  if (registry) options.registryPath = registry;
  return createPipeline(options);
}

// The store's own answer to "could a document be delivered right now": the same adapter the pass delivers
// through, asked for its configuration only. Nothing is uploaded, registered or read back here.
function configuredStoreStatus(pipeline) {
  return require('../lib/research_hosted_store.js').create({ repoRoot: pipeline.paths.repo_root }).status();
}

// A scheduled pass must not pay for an answer it cannot deliver. The store is asked *before* the pipeline is
// allowed to dispatch, because the worker's own refusal happens after the carrier has run: on 2026-10-27 this
// PC's store reported RESEARCH_WORKER_EMAIL and RESEARCH_WORKER_PASSWORD missing, so a task registered ahead of
// those values would have spent one unit of the owner's ChatGPT allowance per tick and registered nothing.
//
// --allow-unconfigured-store is the deliberate exception: a report is wanted even though it can only sit in
// `.local/` until the store is configured. It is never what a scheduled task carries.
function deliverabilityGuard(options = {}) {
  if (options.dryRun) return { ok: true, skipped: 'dry_run' };
  if (options.allowUnconfigured) return { ok: true, skipped: 'allow_unconfigured_store' };
  let status;
  try {
    status = options.storeStatus();
  } catch (error) {
    return {
      ok: false,
      code: 'hosted_not_configured',
      message: `the hosted research store could not be asked whether it is configured (${error && error.message ? error.message : String(error)}); the pass starts no carrier, so no allowance is spent on an answer the dashboard cannot serve`
    };
  }
  const needed = Array.isArray(status && status.needed) ? status.needed : [];
  if (!status || status.configured !== true) {
    return {
      ok: false,
      code: 'hosted_not_configured',
      message: `the hosted research store is not configured: set ${needed.join(', ') || 'the store settings'}; the pass starts no carrier, so no allowance is spent on an answer the dashboard cannot serve`
    };
  }
  return { ok: true, host: status.host || null, bucket: status.bucket || null };
}

function fail(error, io) {
  const payload = {
    ok: false,
    code: error && error.code ? String(error.code) : 'cli_error',
    message: error && error.message ? error.message : String(error)
  };
  io.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  return 1;
}

async function mainAsync(argv, io = process) {
  try {
    const { positionals, flags } = parseArguments(argv);
    if (flags.help === true || flags.h === true) {
      io.stdout.write(`${USAGE}\n`);
      return 0;
    }
    if (positionals.length) {
      throw new Error(`the worker takes flags only, not "${positionals.join(' ')}"; run with --help for the list`);
    }
    const minutes = number(flags, 'timeout-minutes');
    const dryRun = flags['dry-run'] === true;
    const pipeline = pipelineFromFlags(flags);
    // Asked before the worker exists, so a pass that cannot deliver never takes a claim or a unit of allowance.
    const deliverability = deliverabilityGuard({
      dryRun,
      allowUnconfigured: flags['allow-unconfigured-store'] === true,
      storeStatus: () => configuredStoreStatus(pipeline)
    });
    if (!deliverability.ok) {
      const refused = { ok: false, code: deliverability.code, message: deliverability.message, spent: 0 };
      io.stderr.write(`${JSON.stringify(refused, null, 2)}\n`);
      return 1;
    }
    const worker = createWorker({
      pipeline,
      model: text(flags, 'model'),
      carrierPath: text(flags, 'carrier'),
      codexHome: text(flags, 'codex-home'),
      maxStages: number(flags, 'max-stages') || 1,
      stage: text(flags, 'stage'),
      asset: text(flags, 'asset'),
      topicId: text(flags, 'topic'),
      timeoutMs: minutes ? minutes * 60 * 1000 : undefined,
      requireSearch: flags['no-require-search'] === true ? false : undefined,
      providerReading: flags['no-provider-reading'] === true ? false : text(flags, 'provider-reading') || undefined,
      dryRun,
      stdout: line => io.stdout.write(line)
    });
    const summary = await worker.run();
    io.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary.ok ? 0 : 1;
  } catch (error) {
    return fail(error, io);
  }
}

if (require.main === module) {
  Promise.resolve(mainAsync(process.argv.slice(2)))
    .then(code => {
      if (typeof code === 'number') process.exitCode = code;
    })
    .catch(error => {
      process.stderr.write(`${JSON.stringify({ ok: false, code: 'cli_error', message: String(error && error.message) }, null, 2)}\n`);
      process.exitCode = 1;
    });
}

module.exports = { USAGE, mainAsync, deliverabilityGuard, configuredStoreStatus };
