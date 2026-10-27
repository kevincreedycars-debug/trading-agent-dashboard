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
  '  [--provider-reading FILE] [--no-provider-reading]',
  '  [--root DIR] [--state-root DIR] [--library-root DIR] [--catalog FILE] [--registry FILE]',
  '',
  'One pass: recover, read the provider rollout, read the allowance, run the next runnable stage, verify the',
  'run, deliver through the hosted store, write a receipt, stop. Nothing is dispatched without a provider reading.',
  'The reading is the newest rollout under --codex-home unless --provider-reading names one; a pass never switches',
  'the provider half of the allowance on itself.'
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
    const worker = createWorker({
      pipeline: pipelineFromFlags(flags),
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
      dryRun: flags['dry-run'] === true,
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

module.exports = { USAGE, mainAsync };
