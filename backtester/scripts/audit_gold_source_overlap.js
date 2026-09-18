const fs = require('node:fs');
const crypto = require('node:crypto');
const { buildMacroDataset, SERIES } = require('../lib/gold_macro_vintage_dataset');
const { attachEventVintages } = require('../lib/gold_event_vintages');
const { buildGoldTimestampedReport } = require('../lib/gold_timestamped_evaluation');

// Coverage only: do not select hypotheses or inspect directional performance.
function run(args = process.argv.slice(2)) {
  if (args.length !== 6) throw new Error('Usage: FRED_DIR PRICE_DIR EVENT_DIR START_DATE END_DATE NEW_REPORT.json');
  const [fred, prices, events, start_date, end_date, output] = args;
  if (fs.existsSync(output)) throw new Error('Report already exists');
  const lineage = [];
  const read = (directory, file, expected) => {
    const raw = fs.readFileSync(`${directory}/${file}`);
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    if (!expected || sha256 !== expected) throw new Error(`Source hash mismatch: ${file}`);
    lineage.push({ directory, file, sha256 });
    return JSON.parse(raw);
  };
  const manifest = directory => {
    const value = JSON.parse(fs.readFileSync(`${directory}/manifest.json`));
    if (value.complete !== true) throw new Error('Incomplete source acquisition');
    return value;
  };
  const fm = manifest(fred), pm = manifest(prices), em = manifest(events);
  if (em.start_date > start_date || em.end_date < end_date) throw new Error('Event archive does not span schedule');
  const payloads = Object.fromEntries(Object.keys(SERIES).map(id => [id,
    read(fred, `${id}.json`, fm.requests.find(row => row.series_id === id)?.sha256)]));
  const hourly = read(prices, 'candles.json', pm.output_sha256);
  const archive = read(events, 'events.json', em.output_sha256);
  const { dataset } = buildMacroDataset(payloads, hourly, { start_date, end_date });
  if (dataset.calls.some(call => Date.parse(call.horizon_end) - Date.parse(call.call_time) !== 86400000)) throw new Error('Non-24h observation');
  const endpoint = buildGoldTimestampedReport(dataset);
  const strict = buildGoldTimestampedReport({ ...dataset, config: { ...dataset.config, coverage_policy: 'contiguous' } });
  const evaluable = new Set(endpoint.rows.filter(row => row.evaluable).map(row => row.prediction_id));
  const modes = {};
  for (const mode of ['retrospective', 'as_of_proxy']) {
    const attached = attachEventVintages(dataset, archive, { mode });
    const { decision_details, ...audit } = attached.event_vintage_audit;
    modes[mode] = { ...audit, evaluable_decisions_with_events: decision_details.filter(row => row.eligible_events > 0 && evaluable.has(row.prediction_id)).length };
  }
  const exclusions = report => report.rows.filter(row => !row.evaluable).reduce((counts, row) => {
    counts[row.result_reason] = (counts[row.result_reason] || 0) + 1; return counts;
  }, {});
  const report = { version: 'gold-source-overlap-v1', start_date, end_date, lineage,
    schedule: dataset.protocol.schedule, scheduled_decisions: dataset.calls.length,
    macro_complete_decisions: dataset.calls.filter(row => !row.input_rejections.length).length,
    hourly_candles: hourly.candles.length, calendar_records: archive.length,
    exact_endpoint_evaluable: endpoint.evaluable_calls, endpoint_exclusions: exclusions(endpoint),
    contiguous_evaluable: strict.evaluable_calls, contiguous_exclusions: exclusions(strict), modes,
    limitation: 'Coverage audit only. No candidate selection or accuracy measurement. Current event archives do not authenticate original consensus. Macro vintage timing remains a conservative proxy; session gaps are not classified.' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run };
