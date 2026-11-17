'use strict';
const { resolveSession } = require('./reference/backtester/lib/usd_session_engine_interface');
function run(model, snapshot) {
  const cutoff = resolveSession(Date.parse(snapshot.date + 'T00:00:00Z')).cutoff_at_utc;
  const end = resolveSession(Date.parse(snapshot.endDate + 'T00:00:00Z')).cutoff_at_utc;
  const issues = [];
  if (end <= cutoff || !model.version || typeof model.decide !== 'function') issues.push('undefined session or model');
  // Only fixtures enter this executable. Production adapters must authenticate the source evidence.
  if (snapshot.evidence !== 'synthetic fixture') issues.push('unverified evidence');
  const values = {};
  for (const [key, [source, instrument, transform, hours]] of Object.entries(model.inputs)) {
    const row = snapshot.inputs[key];
    if (!row) { issues.push(key + ': missing'); continue; }
    const at = Date.parse(cutoff);
    const clocks = [row.observed, row.published, row.received].map(Date.parse);
    if (!clocks.every(Number.isFinite) || clocks[0] > clocks[1] || clocks[1] > clocks[2] || clocks[2] > at)
      issues.push(key + ': invalid or late clock');
    if (at - clocks[0] > hours * 3600000) issues.push(key + ': stale');
    if (source !== row.source || instrument !== row.instrument || transform !== row.transform)
      issues.push(key + ': source, instrument or transform mismatch');
    if (row.original !== true || !Number.isFinite(row.value)) issues.push(key + ': unavailable original value');
    values[key] = row.value;
  }
  const decision = issues.length ? {status:'blocked', direction:null, conviction:null, trade:false, trace:issues}
    : model.decide(values, snapshot.date);
  return {model:model.version, date:snapshot.date, cutoff, end, evidence:snapshot.evidence, ...decision};
}
module.exports = {run};
