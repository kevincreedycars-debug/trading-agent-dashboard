const fs = require('node:fs');
const crypto = require('node:crypto');
const { buildExperiments } = require('../lib/gold_research_experiments');
function run(args = process.argv.slice(2)) {
  if (args.length !== 4) throw new Error('Usage: node backtester/scripts/build_gold_research_experiments.js DATASET.json SNAPSHOTS.json PLAN.json NEW_REPORT.json');
  const raw = args.slice(0, 3).map(file => fs.readFileSync(file));
  const [dataset, snapshots, plan] = raw.map(bytes => JSON.parse(bytes));
  const report = buildExperiments(dataset, snapshots.snapshots, plan);
  report.input_sha256 = raw.map(bytes => crypto.createHash('sha256').update(bytes).digest('hex'));
  fs.writeFileSync(args[3], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ coverage: report.coverage, candidates: report.candidate_count,
    eligible: report.eligible_training_candidates, selected: report.selected_by_training_only,
    baseline: report.stored_call_baseline, blockers: report.qualification_blockers }, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run };
