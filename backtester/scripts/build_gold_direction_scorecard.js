#!/usr/bin/env node
// Generate the durable Gold factor direction scorecard and the self-contained page that shows it.
// The inputs are the accepted 019 revision 2 single-variable report and the committed direction
// expectations registry. Nothing here measures anything: it re-cuts the accepted report through the
// existing direction check, so a missing input, a drifted count or an unreadable registry fails
// closed instead of rendering a new claim.
//
// Usage:
//   node backtester/scripts/build_gold_direction_scorecard.js [REPORT.json] [EXPECTATIONS.json] [OUT.json] [OUT.html]
//   node backtester/scripts/build_gold_direction_scorecard.js --check=<tmp/check.json> [OUT.json] [OUT.html]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildDirectionCheck, summarise } = require('./report_gold_factor_direction_check');
const { shapeDirectionScorecard, EXPECTED } = require('../lib/gold_direction_scorecard');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULTS = {
  report: path.join(ROOT, '.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json'),
  expectations: path.join(__dirname, '../registries/gold_factor_direction_expectations.v1.json'),
  writeUp: path.join(ROOT, 'docs/GOLD_FACTOR_DIRECTION_CHECK_20260927.md'),
  outJson: path.join(ROOT, 'data/gold-direction-scorecard-20260927.json'),
  outHtml: path.join(ROOT, 'gold-direction-scorecard.html')
};
const PARAMETERS = Object.freeze({
  cohort: 'daily_snapshot_anchors',
  group: 'all_computed',
  primary_horizon: EXPECTED.session_horizon,
  week_horizon: EXPECTED.week_horizon,
  horizons: [EXPECTED.session_horizon, EXPECTED.week_horizon],
  min_n: 100,
  min_year_n: 20,
  edge_pp: 5,
  threshold_pct: 60
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseArgs(argv) {
  const options = { positional: [] };
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      options.positional.push(path.resolve(arg));
      continue;
    }
    const [name, inline] = arg.slice(2).split('=');
    if (name !== 'check') throw new Error(`Unknown option: --${name}`);
    if (!inline) throw new Error('Use --check=<path> with an inline value.');
    options.check = path.resolve(inline);
  }
  return options;
}

function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const positional = options.positional;
  if (positional.length !== 0 && positional.length !== 4) {
    throw new Error('Usage: node backtester/scripts/build_gold_direction_scorecard.js [REPORT.json] [EXPECTATIONS.json] [OUT.json] [OUT.html]');
  }
  const reportPath = positional[0] || DEFAULTS.report;
  const expectationsPath = positional[1] || DEFAULTS.expectations;
  const outJson = positional[2] || DEFAULTS.outJson;
  const outHtml = positional[3] || DEFAULTS.outHtml;
  for (const [label, file] of Object.entries({ reportPath, expectationsPath })) {
    if (!fs.existsSync(file)) throw new Error(`Accepted evidence is missing (${label}): ${file}`);
  }
  const reportBytes = fs.readFileSync(reportPath);
  const report = JSON.parse(reportBytes.toString('utf8').replace(/^\uFEFF/, ''));
  const expectationsBytes = fs.readFileSync(expectationsPath);
  const registry = JSON.parse(expectationsBytes.toString('utf8').replace(/^\uFEFF/, ''));

  let check;
  let checkPath = null;
  let checkSha256 = null;
  if (options.check) {
    if (!fs.existsSync(options.check)) throw new Error(`The supplied check artifact is missing: ${options.check}`);
    check = JSON.parse(fs.readFileSync(options.check, 'utf8').replace(/^\uFEFF/, ''));
    checkPath = options.check;
    checkSha256 = sha256File(options.check);
  } else {
    check = buildDirectionCheck(report, registry, PARAMETERS);
    check.parameters = PARAMETERS;
    check.summary = summarise(check, PARAMETERS);
  }

  const scorecard = shapeDirectionScorecard({
    check,
    registry,
    report,
    hashes: {
      reportPath,
      reportSha256: crypto.createHash('sha256').update(reportBytes).digest('hex'),
      reportBytes: reportBytes.length,
      expectationsPath,
      expectationsSha256: crypto.createHash('sha256').update(expectationsBytes).digest('hex'),
      expectationsFileVersion: registry.version,
      methodPath: 'backtester/scripts/report_gold_factor_direction_check.js',
      methodSha256: sha256File(path.join(__dirname, 'report_gold_factor_direction_check.js')),
      checkPath,
      checkSha256,
      writeUpPath: 'docs/GOLD_FACTOR_DIRECTION_CHECK_20260927.md',
      writeUpSha256: fs.existsSync(DEFAULTS.writeUp) ? sha256File(DEFAULTS.writeUp) : null,
      generatedAt: new Date().toISOString()
    }
  });

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(scorecard, null, 2)}\n`);
  const template = fs.readFileSync(path.join(__dirname, '../templates/gold-direction-scorecard.html'), 'utf8');
  const safe = JSON.stringify(scorecard).replace(/</g, '\\u003c');
  fs.writeFileSync(outHtml, template.replace('__GOLD_DIRECTION_JSON__', () => safe));
  const result = {
    data: outJson,
    page: outHtml,
    states_scored: scorecard.coverage.states_scored,
    states_printed_unscored: scorecard.coverage.states_printed_unscored,
    states_declared_neutral: scorecard.coverage.states_declared_neutral,
    factors_scored: scorecard.coverage.factors_scored,
    session_baseline_pct: scorecard.baselines.session.positive_rate_pct,
    week_baseline_pct: scorecard.baselines.week.positive_rate_pct,
    session_verdicts: scorecard.summary.session_verdicts,
    week_verdicts: scorecard.summary.week_verdicts,
    exploratory: scorecard.exploratory,
    prediction_claimed: scorecard.prediction_claimed,
    accuracy_claimed: scorecard.accuracy_claimed
  };
  console.log(JSON.stringify(result, null, 2));
  return scorecard;
}

if (require.main === module) run();
module.exports = { DEFAULTS, PARAMETERS, parseArgs, run };

