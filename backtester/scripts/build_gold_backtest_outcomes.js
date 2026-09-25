#!/usr/bin/env node
// Generate the durable Gold 28-factor outcome summary and the self-contained research page that
// shows it. Inputs are the accepted 023 declaration registry and the accepted 024 rev3 run
// artifacts plus the accepted 025 verdict page. Nothing here measures anything: it only reads
// accepted evidence, so a missing or drifted input fails closed instead of rendering a new claim.
//
// Usage:
//   node backtester/scripts/build_gold_backtest_outcomes.js [SUMMARY.json] [ANALYSIS.json] [REGISTRY.json] [VERDICT.md] [OUT.json] [OUT.html]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildGoldBacktestOutcomes } = require('../lib/gold_backtest_outcomes');

const ROOT = path.resolve(__dirname, '../..');
const RUN_DIR = path.join(ROOT, '.local/worktrees/gold-research/backtester/tmp/combination-run-024-20260926-rev3');
const GOLD_WORKTREE = path.join(ROOT, '.local/worktrees/gold-research');
const DECLARATION_COMMIT = '5fe48767';
const DEFAULTS = {
  summary: path.join(RUN_DIR, 'combination-summary.json'),
  descriptive: path.join(RUN_DIR, 'descriptive-analysis.json'),
  registry: path.join(GOLD_WORKTREE, 'backtester/registries/gold_combination_batch_daily_h24_and.v2.json'),
  verdict: path.join(GOLD_WORKTREE, 'docs/GOLD_BACKTEST_VERDICT_20260925.md'),
  outJson: path.join(ROOT, 'data/gold-28-factor-outcomes-20260925.json'),
  outHtml: path.join(ROOT, 'gold-backtest-outcomes.html')
};

function run(args = process.argv.slice(2)) {
  if (args.length !== 0 && args.length !== 6) {
    throw new Error('Usage: node backtester/scripts/build_gold_backtest_outcomes.js [SUMMARY.json] [ANALYSIS.json] [REGISTRY.json] [VERDICT.md] [OUT.json] [OUT.html]');
  }
  const [summaryPath, descriptivePath, registryPath, verdictPath, outJson, outHtml] = args.length
    ? args.map(value => path.resolve(value))
    : [DEFAULTS.summary, DEFAULTS.descriptive, DEFAULTS.registry, DEFAULTS.verdict, DEFAULTS.outJson, DEFAULTS.outHtml];
  for (const [label, file] of Object.entries({ summaryPath, descriptivePath, registryPath, verdictPath })) {
    if (!fs.existsSync(file)) throw new Error(`Accepted evidence is missing (${label}): ${file}`);
  }
  const registryBytes = fs.readFileSync(registryPath);
  const registry = JSON.parse(registryBytes.toString('utf8'));
  const outcomes = buildGoldBacktestOutcomes({
    summaryPath, descriptivePath, registryPath, verdictPath,
    declarationCommit: DECLARATION_COMMIT,
    declarationRegistrySha: crypto.createHash('sha256').update(registryBytes).digest('hex'),
    candidateListSha: registry.candidate_list_sha256
  });
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(outcomes, null, 2)}\n`);
  const template = fs.readFileSync(path.join(__dirname, '../templates/gold-outcomes.html'), 'utf8');
  const safe = JSON.stringify(outcomes).replace(/</g, '\\u003c');
  fs.writeFileSync(outHtml, template.replace('__GOLD_OUTCOMES_JSON__', () => safe));
  const result = {
    data: outJson,
    page: outHtml,
    run_id: outcomes.run_id,
    candidates: `${outcomes.coverage.candidates_evaluated} of ${outcomes.coverage.candidates_declared}`,
    status_totals: outcomes.coverage.status_totals,
    denominators: outcomes.denominators,
    exploratory: outcomes.exploratory,
    prediction_claimed: outcomes.prediction_claimed,
    accuracy_claimed: outcomes.accuracy_claimed
  };
  console.log(JSON.stringify(result, null, 2));
  return outcomes;
}

if (require.main === module) run();
module.exports = { DEFAULTS, run };
