#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildGoldChronologicalFactors } = require('../lib/gold_chronological_factors');

function run(args = process.argv.slice(2)) {
  if (args.length !== 4 || !/^\d+$/.test(args[3])) throw new Error('Usage: node backtester/scripts/build_gold_chronological_factors.js INPUT.json OUTPUT.json SPLIT_ISO EMBARGO_MS');
  const input = path.resolve(args[0]), output = path.resolve(args[1]);
  if (input.toLowerCase() === output.toLowerCase()) throw new Error('Output must not overwrite source evidence.');
  const raw = fs.readFileSync(input);
  const report = buildGoldChronologicalFactors(JSON.parse(raw.toString('utf8')),
    { split_at: args[2], embargo_ms: Number(args[3]) });
  report.source_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, coverage: report.coverage }, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run };
