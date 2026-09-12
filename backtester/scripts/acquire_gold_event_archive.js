const fs = require('node:fs');
const crypto = require('node:crypto');
async function run(args = process.argv.slice(2)) {
  if (args.length !== 1 || !process.env.RAPIDAPI_KEY) throw new Error('NEW_DIRECTORY and RAPIDAPI_KEY required');
  fs.mkdirSync(args[0]);
  const host = 'economic-calendar-api.p.rapidapi.com';
  const rows = new Map(), manifest = { version: 'gold-event-archive-v1', complete: false, requests: [],
    limitation: 'Current vendor archive snapshots; pre-release consensus and original release vintages not authenticated.' };
  for (let month = 0; month < 33; month++) {
    const start = new Date(Date.UTC(2024, month, 1)).toISOString().slice(0, 10);
    const end = month === 32 ? '2026-09-12' : new Date(Date.UTC(2024, month + 1, 0)).toISOString().slice(0, 10);
    const url = new URL(`https://${host}/calendar`);
    for (const [key, value] of Object.entries({ countryCode: 'US', volatility: 'HIGH', limit: '500', timezone: 'GMT+0', startDate: start, endDate: end })) url.searchParams.set(key, value);
    const response = await fetch(url, { headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': host }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Calendar archive HTTP ${response.status}`);
    const raw = await response.text(), payload = JSON.parse(raw);
    const file = `month-${start}.json`;
    fs.writeFileSync(`${args[0]}/${file}`, raw, { flag: 'wx' });
    if (!payload.success || !Array.isArray(payload.data) || payload.data.length >= 500 || payload.totalEvents !== payload.data.length) throw new Error('Calendar coverage/truncation mismatch');
    for (const row of payload.data) {
      if (!row.id || row.dateUtc?.slice(0, 10) < start || row.dateUtc?.slice(0, 10) > end) throw new Error('Out-of-range calendar row');
      if (rows.has(row.id) && JSON.stringify(rows.get(row.id)) !== JSON.stringify(row)) throw new Error('Conflicting event revisions');
      rows.set(row.id, row);
    }
    manifest.requests.push({ start, end, returned_date_range: payload.dateRange, file, rows: payload.data.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') });
    fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ month: start, rows: payload.data.length }));
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  const raw = JSON.stringify([...rows.values()]);
  fs.writeFileSync(`${args[0]}/events.json`, raw, { flag: 'wx' });
  manifest.complete = true; manifest.rows = rows.size; manifest.output_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(manifest, null, 2));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
