#!/usr/bin/env node
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { buildGoldHistoryIsolation, validateGoldHistoryCapture, sha256 } = require('../lib/gold_history_isolation');

function run(args = process.argv.slice(2)) {
  if (args.length !== 8) throw new Error('Usage: node backtester/scripts/verify_gold_history_capture.js SOURCE.json PATCH.json MANIFEST.json RUNTIME_WORKFLOW.json REFERENCE_ROWS.json CAPTURED_ITEMS.json EXECUTION.json NEW_REPORT.json');
  const bytes = args.slice(0, 7).map(file => fs.readFileSync(file));
  const [source, patch, manifest, runtimeWorkflow, referenceRows, capturedItems, execution] = bytes.map(raw => JSON.parse(raw));
  assert.equal(sha256(bytes[0]), manifest.source_bytes_sha256, 'Source file changed.');
  assert.equal(sha256(bytes[1]), manifest.patch_bytes_sha256, 'Patch file changed.');
  const built = buildGoldHistoryIsolation(source, patch, manifest.cutoff_date);
  assert.deepEqual(manifest, { ...built.manifest, source_bytes_sha256: sha256(bytes[0]),
    patch_bytes_sha256: sha256(bytes[1]) }, 'Manifest drift.');
  const report = validateGoldHistoryCapture({ candidate: built.workflow, manifest, runtimeWorkflow,
    referenceRows, capturedItems, execution });
  report.input_file_sha256 = bytes.map(raw => sha256(raw));
  fs.writeFileSync(args[7], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { run };
