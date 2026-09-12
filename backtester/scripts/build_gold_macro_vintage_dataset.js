const fs = require('node:fs');
const crypto = require('node:crypto');
const { buildMacroDataset, SERIES } = require('../lib/gold_macro_vintage_dataset');
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
function run(args = process.argv.slice(2)) {
  if (args.length !== 3) throw new Error('Usage: FRED_DIRECTORY HOURLY_DIRECTORY NEW_DIRECTORY');
  const manifest = JSON.parse(fs.readFileSync(`${args[0]}/manifest.json`));
  if (!manifest.complete) throw new Error('Incomplete FRED acquisition');
  const payloads = {};
  for (const id of Object.keys(SERIES)) {
    const request = manifest.requests.find(row => row.series_id === id);
    const raw = fs.readFileSync(`${args[0]}/${id}.json`);
    if (hash(raw) !== request?.sha256) throw new Error('FRED byte hash mismatch');
    payloads[id] = JSON.parse(raw);
  }
  const priceManifest = JSON.parse(fs.readFileSync(`${args[1]}/manifest.json`));
  const prices = fs.readFileSync(`${args[1]}/candles.json`);
  if (!priceManifest.complete || hash(prices) !== priceManifest.output_sha256) throw new Error('Price acquisition incomplete or changed');
  const result = buildMacroDataset(payloads, JSON.parse(prices), { start_date: '2024-02-01', end_date: '2026-09-10' });
  result.dataset.acquisition_lineage = { fred_requests: manifest.requests, price_sha256: hash(prices) };
  fs.mkdirSync(args[2]);
  fs.writeFileSync(`${args[2]}/dataset.json`, JSON.stringify(result.dataset), { flag: 'wx' });
  fs.writeFileSync(`${args[2]}/snapshots.json`, JSON.stringify({ snapshots: result.snapshots }), { flag: 'wx' });
  console.log(JSON.stringify({ calls: result.dataset.calls.length, candles: result.dataset.candles.length,
    missing_input_calls: result.dataset.calls.filter(row => row.input_rejections.length).length }));
}
if (require.main === module) run();
module.exports = { run };
