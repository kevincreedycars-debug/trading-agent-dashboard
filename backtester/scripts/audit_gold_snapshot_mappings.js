const fs = require('node:fs');
const crypto = require('node:crypto');
const { auditSnapshotMappings } = require('../lib/gold_snapshot_mapping');
function run(args = process.argv.slice(2)) {
  if (args.length !== 2) throw new Error('Usage: SNAPSHOTS.json NEW_REPORT.json');
  const raw = fs.readFileSync(args[0]);
  const report = { ...auditSnapshotMappings(JSON.parse(raw)), input_sha256: crypto.createHash('sha256').update(raw).digest('hex') };
  fs.writeFileSync(args[1], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run };
