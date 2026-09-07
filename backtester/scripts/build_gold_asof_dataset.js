#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildGoldAsOfDataset } = require('../lib/gold_asof_dataset');

function run(args = process.argv.slice(2)) {
  if (args.length !== 2) throw new Error('Usage: node backtester/scripts/build_gold_asof_dataset.js INPUT.json OUTPUT.json');
  const input = path.resolve(args[0]), output = path.resolve(args[1]);
  if (input.toLowerCase() === output.toLowerCase()) throw new Error('Output must not overwrite source evidence.');
  const raw = fs.readFileSync(input);
  const dataset = buildGoldAsOfDataset(JSON.parse(raw.toString('utf8')));
  dataset.source_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(JSON.stringify({ output, readiness: dataset.readiness }, null, 2));
  return dataset;
}
if (require.main === module) run();
module.exports = { run };
