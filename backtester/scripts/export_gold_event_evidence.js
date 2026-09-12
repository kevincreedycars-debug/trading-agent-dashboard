const fs = require('node:fs');
const crypto = require('node:crypto');
const { readRows } = require('./export_gold_stored_calls');
async function run(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error('Usage: NEW_DIRECTORY');
  fs.mkdirSync(args[0]);
  const rows = await readRows('historical_economic_events', { select: '*', event_date: 'gte.2024-01-01', order: 'event_time.asc,id.asc' });
  const raw = JSON.stringify(rows);
  fs.writeFileSync(`${args[0]}/events.json`, raw, { flag: 'wx' });
  const report = { rows: rows.length, fields: [...new Set(rows.flatMap(row => Object.keys(row)))].sort(),
    source_sha256: crypto.createHash('sha256').update(raw).digest('hex'), captured_at: new Date().toISOString(),
    pre_release_consensus_vintages_verified: false };
  fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
