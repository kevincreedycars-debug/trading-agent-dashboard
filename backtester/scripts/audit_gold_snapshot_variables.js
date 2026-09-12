const fs = require('node:fs');
const crypto = require('node:crypto');
const { GOLD_VARIABLES, auditGoldSourceReadiness } = require('../lib/gold_source_readiness');

function auditSnapshotVariables(bundle) {
  if (!Array.isArray(bundle?.snapshots)) throw new Error('snapshots array required');
  const records = [];
  const coverage = GOLD_VARIABLES.map(name => {
    let present = 0;
    for (const snapshot of bundle.snapshots) {
      const value = snapshot[name];
      if (value === null || value === undefined || value === '') continue;
      present++;
      // Storage timestamps cannot be substituted for provider observation/release times.
      records.push({ name, value, source: 'Supabase market_snapshots', source_record_id: snapshot.id,
        timing_basis: 'storage_proxy', stored_at: snapshot.created_at });
    }
    return { name, present, absent: bundle.snapshots.length - present };
  });
  return { ...auditGoldSourceReadiness({ feature_records: records }), snapshot_count: bundle.snapshots.length,
    snapshot_field_coverage: coverage,
    extraction_limit: 'Only exact top-level field names are mapped. Nested event data and differing field names require reviewed adapters; absence here does not establish provider unavailability.' };
}
function run(args = process.argv.slice(2)) {
  if (args.length !== 2) throw new Error('Usage: node backtester/scripts/audit_gold_snapshot_variables.js SNAPSHOTS.json NEW_REPORT.json');
  const raw = fs.readFileSync(args[0]);
  const report = auditSnapshotVariables(JSON.parse(raw));
  report.input_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(args[1], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ snapshots: report.snapshot_count, variables: report.variable_count,
    missing_variables: report.missing_variables, metadata_eligible_records: report.variables.reduce((sum, row) => sum + row.metadata_eligible_records, 0) }));
  return report;
}
if (require.main === module) run();
module.exports = { run, auditSnapshotVariables };
