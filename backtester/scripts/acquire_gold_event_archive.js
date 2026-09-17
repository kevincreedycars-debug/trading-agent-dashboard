const fs = require('node:fs');
const crypto = require('node:crypto');
async function run(args = process.argv.slice(2)) {
  if (![1, 4].includes(args.length) || !process.env.RAPIDAPI_KEY) throw new Error('NEW_DIRECTORY [START_DATE END_DATE HIGH,MEDIUM] and RAPIDAPI_KEY required');
  const startDate = args[1] ?? '2024-01-01', endDate = args[2] ?? '2026-09-12';
  const impacts = (args[3] ?? 'HIGH').split(',');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate ||
      !impacts.length || new Set(impacts).size !== impacts.length || impacts.some(value => !['HIGH', 'MEDIUM', 'LOW'].includes(value))) throw new Error('Invalid date range or impact filters');
  fs.mkdirSync(args[0]);
  const host = 'economic-calendar-api.p.rapidapi.com';
  const rows = new Map(), manifest = { version: 'gold-event-archive-v2', complete: false, requests: [],
    started_at: new Date().toISOString(), start_date: startDate, end_date: endDate, impacts,
    limitation: 'Current vendor archive snapshots; pre-release consensus and original release vintages not authenticated.' };
  fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  for (let cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`); cursor.toISOString().slice(0, 10) <= endDate; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const start = [cursor.toISOString().slice(0, 10), startDate].sort().at(-1);
    const end = [new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10), endDate].sort()[0];
    for (const impact of impacts) {
      const url = new URL(`https://${host}/calendar`);
      for (const [key, value] of Object.entries({ countryCode: 'US', volatility: impact, limit: '500', timezone: 'GMT+0', startDate: start, endDate: end })) url.searchParams.set(key, value);
      const response = await fetch(url, { headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': host }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Calendar archive HTTP ${response.status}`);
      const raw = await response.text(), payload = JSON.parse(raw);
      const file = `month-${start}-${impact}.json`;
      fs.writeFileSync(`${args[0]}/${file}`, raw, { flag: 'wx' });
      if (!payload.success || !Array.isArray(payload.data) || payload.data.length >= 500 || payload.totalEvents !== payload.data.length) throw new Error('Calendar coverage/truncation mismatch');
      for (const row of payload.data) {
        if (!row.id || typeof row.dateUtc !== 'string' || !Number.isFinite(Date.parse(row.dateUtc)) || row.dateUtc.slice(0, 10) < start || row.dateUtc.slice(0, 10) > end || row.countryCode !== 'US' || row.volatility !== impact) throw new Error('Out-of-range or filter-mismatched calendar row');
        if (rows.has(row.id) && JSON.stringify(rows.get(row.id)) !== JSON.stringify(row)) throw new Error('Conflicting event revisions');
        rows.set(row.id, row);
      }
      manifest.requests.push({ start, end, impact, returned_date_range: payload.dateRange, file, rows: payload.data.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') });
      fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(manifest, null, 2));
      console.log(JSON.stringify({ month: start, impact, rows: payload.data.length }));
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }
  const raw = JSON.stringify([...rows.values()]);
  fs.writeFileSync(`${args[0]}/events.json`, raw, { flag: 'wx' });
  manifest.complete = true; manifest.rows = rows.size; manifest.output_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(manifest, null, 2));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
