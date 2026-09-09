#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateGoldHistoryPatch } = require('../lib/gold_history_patch_validation');

function run(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error('Usage: node backtester/scripts/validate_gold_history_patch_offline.js NEW_REPORT.json');
  const root = path.resolve(__dirname, '../..');
  const workflow = fs.readFileSync(path.join(root, 'exports/gold_collector.json'));
  const patch = fs.readFileSync(path.join(root, 'backtester/drafts/gold_collector_history_query_patch.json'));
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const report = { ...validateGoldHistoryPatch(JSON.parse(workflow), JSON.parse(patch)),
    workflow_export_sha256: hash(workflow), patch_sha256: hash(patch) };
  fs.writeFileSync(path.resolve(args[0]), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { run };
