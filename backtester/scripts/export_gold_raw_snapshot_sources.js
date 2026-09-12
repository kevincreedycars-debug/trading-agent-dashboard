const fs = require('node:fs');
const crypto = require('node:crypto');
const { readRows } = require('./export_gold_stored_calls');
const { auditSnapshotVariables } = require('./audit_gold_snapshot_variables');
async function run(args = process.argv.slice(2)) {
  if (args.length !== 2) throw new Error('Usage: node backtester/scripts/export_gold_raw_snapshot_sources.js STORED_CALLS.json NEW_DIRECTORY');
  const raw = fs.readFileSync(args[0]);
  const input = JSON.parse(raw);
  if (!Array.isArray(input.outputs)) throw new Error('Stored output array required');
  const ids = [...new Set(input.outputs.map(row => row.snapshot_id).filter(Boolean))];
  if (ids.some(id => !/^[a-f0-9-]{36}$/i.test(id))) throw new Error('Expected UUID snapshot ids');
  fs.mkdirSync(args[1]);
  const snapshots = [];
  for (let index = 0; index < ids.length; index += 50) {
    snapshots.push(...await readRows('market_snapshots', { id: `in.(${ids.slice(index, index + 50).join(',')})`, select: '*' }));
  }
  const returned = new Set(snapshots.map(row => row.id));
  if (returned.size !== snapshots.length || returned.size !== ids.length || ids.some(id => !returned.has(id))) {
    throw new Error('Snapshot identity coverage mismatch; do not treat this acquisition as complete.');
  }
  const bundle = { retrieved_at: new Date().toISOString(), snapshots };
  const output = JSON.stringify(bundle) + '\n';
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(`${args[1]}/snapshots.json`, output, { flag: 'wx' });
  const report = { ...auditSnapshotVariables(bundle), input_sha256: hash(raw), snapshot_sha256: hash(output),
    requested_snapshot_count: ids.length, captured_snapshot_count: snapshots.length,
    captured_field_names: [...new Set(snapshots.flatMap(row => Object.keys(row)))].sort() };
  fs.writeFileSync(`${args[1]}/readiness.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ captured_snapshots: snapshots.length, captured_fields: report.captured_field_names.length,
    missing_variables: report.missing_variables, snapshot_sha256: report.snapshot_sha256 }));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
