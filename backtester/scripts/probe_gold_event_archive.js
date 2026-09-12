const fs = require('node:fs');
async function run(args = process.argv.slice(2)) {
  if (![1, 2].includes(args.length) || (args[1] && args[1] !== 'current') || !process.env.RAPIDAPI_KEY) throw new Error('NEW_REPORT.json [current] and RAPIDAPI_KEY required');
  const current = args[1] === 'current';
  const host = current ? 'economic-calendar-api.p.rapidapi.com' : 'forex-factory-scraper1.p.rapidapi.com';
  const url = new URL(`https://${host}/${current ? 'calendar' : 'get_calendar_details'}`);
  const parameters = current ? { countryCode: 'US', volatility: 'HIGH', limit: '100', timezone: 'GMT+0', startDate: '2025-01-10', endDate: '2025-01-10' } :
    { year: '2025', month: '1', day: '10', currency: 'USD', event_name: 'ALL', timezone: 'GMT-06:00 Central Time (US & Canada)', time_format: '12h' };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': host }, signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (response.ok) fs.writeFileSync(`${args[0]}.payload.json`, JSON.stringify(body), { flag: 'wx' });
  const report = { source: host, requested_date: '2025-01-10', status: response.status,
    captured_at: new Date().toISOString(), rows: Array.isArray(body) ? body.length : Array.isArray(body?.value) ? body.value.length : null,
    response_keys: body && typeof body === 'object' ? Object.keys(body).slice(0, 30) : [],
    message: typeof body?.message === 'string' ? body.message.replaceAll(process.env.RAPIDAPI_KEY, '[redacted]') : null };
  fs.writeFileSync(args[0], JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report));
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
