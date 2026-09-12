const fs = require('node:fs');
const crypto = require('node:crypto');
const { attachEventVintages } = require('../lib/gold_event_vintages');
function run(args = process.argv.slice(2)) {
  if (args.length !== 3) throw new Error('Usage: DATASET.json EVENT_DIRECTORY NEW_DATASET.json');
  const dataset = fs.readFileSync(args[0]), events = fs.readFileSync(`${args[1]}/events.json`);
  const manifest = JSON.parse(fs.readFileSync(`${args[1]}/manifest.json`));
  const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
  if (!manifest.complete || hash(events) !== manifest.output_sha256) throw new Error('Event source incomplete or changed');
  const result = attachEventVintages(JSON.parse(dataset), JSON.parse(events));
  result.event_source_hash = hash(events); result.parent_dataset_hash = hash(dataset);
  fs.writeFileSync(args[2], JSON.stringify(result), { flag: 'wx' });
  const { decision_details, ...summary } = result.event_vintage_audit;
  console.log(JSON.stringify(summary));
}
if (require.main === module) run();
module.exports = { run };
