const fs = require('node:fs');
const crypto = require('node:crypto');
async function run(args = process.argv.slice(2)) {
  const [startDate, endDate, directory] = args;
  const start = Date.parse(`${startDate}T00:00:00Z`), end = Date.parse(`${endDate}T00:00:00Z`);
  if (args.length !== 3 || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Usage: START_DATE END_DATE NEW_DIRECTORY');
  if (!process.env.OANDA_API_TOKEN) throw new Error('OANDA_API_TOKEN required');
  fs.mkdirSync(directory);
  const manifest = { version: 'gold-hourly-acquisition-v1', complete: false, requests: [] };
  const candles = new Map();
  const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
  for (let cursor = start; cursor < end; cursor += 90 * 86400000) {
    const from = new Date(cursor).toISOString(), to = new Date(Math.min(end, cursor + 90 * 86400000)).toISOString();
    const url = new URL('https://api-fxtrade.oanda.com/v3/instruments/XAU_USD/candles');
    for (const [key, value] of Object.entries({ from, to, granularity: 'H1', price: 'MBA', smooth: 'false', includeFirst: 'true' })) url.searchParams.set(key, value);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.OANDA_API_TOKEN}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`OANDA H1 HTTP ${response.status}`);
    const raw = await response.text(), payload = JSON.parse(raw);
    if (payload.instrument !== 'XAU_USD' || payload.granularity !== 'H1' || !Array.isArray(payload.candles)) throw new Error('Unexpected OANDA response');
    const file = `page-${manifest.requests.length}.json`;
    fs.writeFileSync(`${directory}/${file}`, raw, { flag: 'wx' });
    manifest.requests.push({ from, to, file, sha256: hash(raw) });
    fs.writeFileSync(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2));
    for (const candle of payload.candles) {
      if (candle.complete !== true) continue;
      const previous = candles.get(candle.time);
      if (previous && JSON.stringify(previous) !== JSON.stringify(candle)) throw new Error('Conflicting candle revisions');
      candles.set(candle.time, candle);
    }
    console.log(JSON.stringify({ pages: manifest.requests.length, candles: candles.size }));
  }
  const output = JSON.stringify({ instrument: 'XAU_USD', granularity: 'H1', candles: [...candles.values()].sort((a, b) => a.time.localeCompare(b.time)) });
  fs.writeFileSync(`${directory}/candles.json`, output, { flag: 'wx' });
  manifest.complete = true; manifest.candles = candles.size; manifest.output_sha256 = hash(output);
  fs.writeFileSync(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
