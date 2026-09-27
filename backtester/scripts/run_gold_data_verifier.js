const fs = require('node:fs');
const path = require('node:path');
const {
  runVerification,
  formatSummary,
  VERSION
} = require('../lib/gold_data_verifier');

const REGISTRY_PATH = 'backtester/registries/gold_data_verifier_sampling.v1.json';
const DEFAULT_CHECKER = 'data/backtester-checker-gold-24h-2024-2026.json';
const DEFAULT_DECLARED = 'data/gold-28-factor-outcomes-20260925.json';
const MAX_ENVELOPES = 5000;

function parseArgs(args) {
  const options = {};
  const flags = new Set(['strict', 'quiet', 'help']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    const [name, inline] = arg.slice(2).split('=');
    if (flags.has(name)) { options[name] = true; continue; }
    const value = inline ?? args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    if (inline === undefined) index += 1;
  }
  return options;
}

function readJson(file, options = {}) {
  const raw = fs.readFileSync(file);
  if (options.report_large && raw.length > 64 * 1024 * 1024) {
    console.log(`Note: ${file} is ${(raw.length / 1048576).toFixed(1)} MB; run with --max-old-space-size=4096 if the parse fails.`);
  }
  return JSON.parse(raw.toString('utf8'));
}

// Newest combination ledger under a root, so the verifier can follow the current run directory.
function findNewestLedger(root, depth = 4) {
  if (!fs.existsSync(root)) return null;
  const found = [];
  const walk = (directory, level) => {
    if (level > depth) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full, level + 1);
      else if (entry.name === 'combination-ledger.jsonl') found.push(full);
    }
  };
  walk(root, 0);
  if (!found.length) return null;
  return found.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

function findCaptureEnvelopeFiles(root, depth = 6) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const walk = (directory, level) => {
    if (level > depth || files.length >= MAX_ENVELOPES) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full, level + 1);
      else if (entry.name === 'capture.envelope.json') files.push(full);
    }
  };
  walk(root, 0);
  return files.sort();
}

// Envelopes are read lazily so a large lane costs only the sampled files.
function buildCaptureEntries(root) {
  return findCaptureEnvelopeFiles(root).map(file => {
    const cached = {};
    const read = name => {
      if (!(name in cached)) {
        const sibling = path.join(path.dirname(file), name);
        cached[name] = fs.existsSync(sibling) ? fs.readFileSync(sibling) : null;
      }
      return cached[name];
    };
    return {
      key: path.relative(root, file).split(path.sep).join('/'),
      get envelope_raw() { return read('capture.envelope.json'); },
      get index_raw() { return read('capture.index.json'); }
    };
  });
}

function loadLedgerRecords(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim().length).map(line => JSON.parse(line));
}
function run(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log([
      `Gold data verifier ${VERSION}`,
      'Usage: node backtester/scripts/run_gold_data_verifier.js [options]',
      '  --checker PATH     stored-versus-recomputed prediction dataset (default data/backtester-checker-gold-24h-2024-2026.json)',
      '  --ledger PATH      combination-ledger.jsonl candidate records (skipped when absent)',
      '  --ledger-root DIR  discover the newest combination-ledger.jsonl under DIR',
      '  --report PATH      individual-variable-report.json (skipped when absent)',
      '  --captures DIR     capture lane root, sampled recursively (skipped when absent)',
      '  --declared PATH    accepted census used to reconcile ledger totals (default data/gold-28-factor-outcomes-20260925.json)',
      '  --sample N         sampled units per target (default from registry, currently 40)',
      '  --seed N           sampling seed (default from registry, currently 20260927)',
      '  --fixture-pattern  comma-separated lane fragments treated as collector test fixtures (replaces the registry list)',
      '  --strict-fixtures  judge every lane as a live capture, including declared fixture lanes',
      '  --out FILE         write the verification report as JSON (refuses to overwrite)',
      '  --strict           fail instead of skipping a requested source that is missing',
      '  --quiet            print only the final one-line status',
      'Exit code 1 means at least one re-checked value disagreed with its source.'
    ].join('\n'));
    return null;
  }
  const registry = readJson(options.registry || REGISTRY_PATH);
  const sources = { skipped: [] };
  const requested = [];
  const checkerPath = options.checker || DEFAULT_CHECKER;
  const ledgerPath = options.ledger || (options['ledger-root'] ? findNewestLedger(options['ledger-root']) : null);
  const reportPath = options.report || null;
  const captureRoot = options.captures || null;
  const requireOrSkip = (label, file, present) => {
    if (present) return true;
    if (options.strict) throw new Error(`${label} requested but not found: ${file}`);
    sources.skipped.push({ target: label, reason: file ? `not found: ${file}` : 'not requested' });
    return false;
  };
  if (requireOrSkip('checker_rows', checkerPath, fs.existsSync(checkerPath))) {
    sources.checker = readJson(checkerPath);
    sources.checker_source = checkerPath;
    requested.push('checker_rows');
  }
  if (requireOrSkip('combination_ledger', ledgerPath, ledgerPath && fs.existsSync(ledgerPath))) {
    sources.ledger = loadLedgerRecords(ledgerPath);
    sources.ledger_source = ledgerPath;
    requested.push('combination_ledger');
  }
  if (requireOrSkip('report_cells', reportPath, reportPath && fs.existsSync(reportPath))) {
    sources.report = readJson(reportPath, { report_large: true });
    sources.report_source = reportPath;
    requested.push('report_cells');
  }
  if (requireOrSkip('capture_envelopes', captureRoot, captureRoot && fs.existsSync(captureRoot))) {
    sources.captures = buildCaptureEntries(captureRoot);
    sources.captures_source = captureRoot;
    requested.push('capture_envelopes');
  }
  if (!requested.length) throw new Error('No source available to verify. Pass --checker, --ledger, --report or --captures.');
  const declaredPath = options.declared || DEFAULT_DECLARED;
  if (options.ledger && fs.existsSync(declaredPath)) {
    const declared = readJson(declaredPath);
    sources.declared_ledger_totals = { ...(declared.coverage || {}), denominators: declared.denominators || null };
  }
  if (options['fixture-pattern'] !== undefined) {
    sources.fixture_patterns = String(options['fixture-pattern']).split(',').map(value => value.trim()).filter(Boolean);
  }
  if (options['strict-fixtures']) sources.fixture_patterns = [];
  if (options.sample !== undefined) sources.sample_size = Number(options.sample);
  if (options.seed !== undefined) sources.seed = Number(options.seed);
  const report = { ...runVerification(sources, registry), generated_at: new Date().toISOString() };
  if (options.out) {
    fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  }
  const summary = formatSummary(report);
  console.log(options.quiet ? summary[0] : summary.join('\n'));
  if (options.out) console.log(`Report written: ${options.out}`);
  process.exitCode = report.status === 'fail' ? 1 : 0;
  return report;
}

if (require.main === module) run();
module.exports = { run, parseArgs, findNewestLedger, findCaptureEnvelopeFiles, buildCaptureEntries, loadLedgerRecords };

