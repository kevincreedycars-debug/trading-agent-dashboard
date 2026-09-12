const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SERIES = { DFII10: 'us_10y_real_yield', DGS2: 'us_2y_yield', DGS10: 'us_10y_yield',
  DTWEXBGS: 'broad_trade_weighted_usd_index_not_ice_dxy', VIXCLS: 'vix_level' };
async function run(args = process.argv.slice(2)) {
  if (args.length !== 3 || args.slice(0, 2).some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date)) || args[0] > args[1]) {
    throw new Error('Usage: node backtester/scripts/acquire_gold_fred_vintages.js START_DATE END_DATE NEW_DIRECTORY');
  }
  if (!process.env.FRED_API_KEY) throw new Error('FRED_API_KEY required');
  fs.mkdirSync(args[2]);
  const manifest = { version: 'gold-fred-vintage-acquisition-v1', started_at: new Date().toISOString(),
    complete: false, requests: [], source_timing: 'FRED real-time vintage dates; intraday publication not supplied',
    documentation: 'https://fred.stlouisfed.org/docs/api/fred/series_observations.html' };
  const save = () => fs.writeFileSync(path.join(args[2], 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  save();
  for (const [series_id, feature] of Object.entries(SERIES)) {
    const params = { series_id, observation_start: args[0], observation_end: args[1],
      realtime_start: args[0], realtime_end: args[1], output_type: '1', file_type: 'json', limit: '100000', sort_order: 'asc' };
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    for (const [key, value] of Object.entries({ ...params, api_key: process.env.FRED_API_KEY })) url.searchParams.set(key, value);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      manifest.requests.push({ series_id, status: response.status, success: false }); save();
      throw new Error(`FRED ${series_id}: HTTP ${response.status}; partial manifest retained`);
    }
    const raw = await response.text();
    const data = JSON.parse(raw);
    if (!Array.isArray(data.observations) || data.count !== data.observations.length) throw new Error('FRED response incomplete; pagination required');
    const file = `${series_id}.json`;
    fs.writeFileSync(path.join(args[2], file), raw, { flag: 'wx' });
    manifest.requests.push({ series_id, feature, parameters: params, file, success: true,
      records: data.observations.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') });
    save();
    console.log(JSON.stringify({ series_id, records: data.observations.length }));
  }
  manifest.complete = true; save();
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run, SERIES };
