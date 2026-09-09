#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildGoldHistoryIsolation, sha256 } = require('../lib/gold_history_isolation');

function run(args = process.argv.slice(2)) {
  if (args.length !== 4) throw new Error('Usage: node backtester/scripts/build_gold_history_isolation.js SOURCE_WORKFLOW.json PATCH.json UTC_DATE NEW_DIRECTORY');
  const source = fs.readFileSync(args[0]), patch = fs.readFileSync(args[1]);
  const result = buildGoldHistoryIsolation(JSON.parse(source), JSON.parse(patch), args[2]);
  result.manifest.source_bytes_sha256 = sha256(source);
  result.manifest.patch_bytes_sha256 = sha256(patch);
  const directory = path.resolve(args[3]);
  fs.mkdirSync(directory); // Deliberately refuse existing destinations before writing any files.
  for (const [name, value] of [['workflow.json', result.workflow], ['manifest.json', result.manifest]]) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  }
  return { directory, candidate_sha256: result.manifest.candidate_object_sha256,
    credentials_included: false, runtime_executed: false };
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { run };
