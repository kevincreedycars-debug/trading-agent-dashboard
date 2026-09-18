const fs = require('node:fs');
const crypto = require('node:crypto');
const { parseTimestamp } = require('../lib/gold_timestamped_evaluation');
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');

function run(args = process.argv.slice(2)) {
  if (args.length < 3) throw new Error('Usage: NEW_DIRECTORY SOURCE_DIRECTORY SOURCE_DIRECTORY [...]');
  if (fs.existsSync(args[0])) throw new Error('Output already exists');
  const sources = args.slice(1).map(directory => {
    const rawManifest = fs.readFileSync(`${directory}/manifest.json`);
    const manifest = JSON.parse(rawManifest), raw = fs.readFileSync(`${directory}/events.json`);
    if (manifest.complete !== true || hash(raw) !== manifest.output_sha256) throw new Error('Incomplete or changed archive');
    const start = parseTimestamp(`${manifest.start_date}T00:00:00Z`), end = parseTimestamp(`${manifest.end_date}T00:00:00Z`);
    if (start === null || end === null || start > end) throw new Error('Invalid source bounds');
    const events = JSON.parse(raw);
    if (!Array.isArray(events) || events.length !== manifest.rows) throw new Error('Source count mismatch');
    return { directory, manifest, events, start, end, manifest_sha256: hash(rawManifest) };
  }).sort((a, b) => a.start - b.start);
  const impacts = [...sources[0].manifest.impacts].sort();
  const identities = new Set(), events = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (JSON.stringify([...source.manifest.impacts].sort()) !== JSON.stringify(impacts)) throw new Error('Impact filters differ');
    if (i && source.start !== sources[i - 1].end + 86400000) throw new Error('Source ranges must be adjacent and nonoverlapping');
    for (const event of source.events) {
      const time = parseTimestamp(event.dateUtc);
      if (!event.id || identities.has(event.id) || time === null || time < source.start || time >= source.end + 86400000 || event.countryCode !== 'US' || !impacts.includes(event.volatility)) throw new Error('Invalid or duplicate source event');
      identities.add(event.id); events.push(event);
    }
  }
  events.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc) || String(a.id).localeCompare(String(b.id)));
  const raw = JSON.stringify(events);
  const manifest = { version: 'gold-event-archive-merged-v1', complete: true,
    start_date: sources[0].manifest.start_date, end_date: sources.at(-1).manifest.end_date, impacts,
    rows: events.length, output_sha256: hash(raw),
    sources: sources.map(({ directory, manifest, manifest_sha256 }) => ({ directory, manifest_sha256, output_sha256: manifest.output_sha256, rows: manifest.rows })),
    limitation: 'Disjoint current archive versions merged without timing promotion; original release/consensus vintages remain unverified.' };
  fs.mkdirSync(args[0]);
  fs.writeFileSync(`${args[0]}/events.json`, raw, { flag: 'wx' });
  fs.writeFileSync(`${args[0]}/manifest.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(manifest));
  return manifest;
}
if (require.main === module) run();
module.exports = { run };
