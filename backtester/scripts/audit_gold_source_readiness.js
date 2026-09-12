const fs = require('node:fs');
const crypto = require('node:crypto');
const { auditGoldSourceReadiness } = require('../lib/gold_source_readiness');
function run(args = process.argv.slice(2)) {
  if (args.length !== 2) throw new Error('Usage: node backtester/scripts/audit_gold_source_readiness.js RECORDS.json NEW_REPORT.json');
  const raw = fs.readFileSync(args[0]);
  const report = auditGoldSourceReadiness(JSON.parse(raw));
  report.input_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(args[1], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ variable_count: report.variable_count, missing_variables: report.missing_variables }));
  return report;
}
if (require.main === module) run();
module.exports = { run };
