#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildGoldTimestampedReport } = require('../lib/gold_timestamped_evaluation');

function run(args = process.argv.slice(2)) {
  if (args.length !== 2) throw new Error('Usage: node backtester/scripts/evaluate_gold_timestamped.js INPUT.json OUTPUT.json');
  const [input, output] = args.map(value => path.resolve(value));
  if (input.toLowerCase() === output.toLowerCase()) throw new Error('Output must not overwrite source evidence.');
  const raw = fs.readFileSync(input);
  const report = buildGoldTimestampedReport(JSON.parse(raw.toString('utf8')));
  report.source_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, calls: report.calls, evaluable_calls: report.evaluable_calls,
    result_counts: report.result_counts, reason_counts: report.reason_counts }, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run };
