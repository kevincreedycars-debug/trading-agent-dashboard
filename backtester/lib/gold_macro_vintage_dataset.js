const { parseTimestamp } = require('./gold_timestamped_evaluation');
const SERIES = { DFII10: 'us_10y_real_yield', DGS2: 'us_2y_yield', DGS10: 'us_10y_yield',
  DTWEXBGS: 'broad_usd_index', VIXCLS: 'vix_level' };
function vintageSeries(payload) {
  if (!Array.isArray(payload?.observations)) throw new Error('FRED observations required');
  return payload.observations.map(row => {
    const date = parseTimestamp(`${row.date}T00:00:00Z`);
    const vintage = parseTimestamp(`${row.realtime_start}T00:00:00Z`);
    const value = row.value === '.' ? null : typeof row.value === 'string' && /^-?\d+(\.\d+)?$/.test(row.value) ? Number(row.value) : NaN;
    if (date === null || vintage === null || (value !== null && !Number.isFinite(value))) throw new Error('Invalid FRED vintage row');
    return { date, vintage, value, available: vintage + 36 * 3600000, original: row };
  });
}
function asOfHistory(records, cutoff) {
  const selected = new Map();
  for (const row of records) {
    if (row.available > cutoff || row.date > cutoff) continue;
    const previous = selected.get(row.date);
    if (previous && row.vintage === previous.vintage) throw new Error('Ambiguous same-date vintage');
    if (!previous || row.vintage > previous.vintage) selected.set(row.date, row);
  }
  return [...selected.values()].filter(row => row.value !== null).sort((a, b) => a.date - b.date);
}
function buildMacroDataset(payloads, hourly, options) {
  const start = parseTimestamp(`${options.start_date}T14:00:00Z`), end = parseTimestamp(`${options.end_date}T14:00:00Z`);
  if (start === null || end === null || start > end) throw new Error('Valid scheduled range required');
  const parsed = Object.fromEntries(Object.keys(SERIES).map(id => [id, vintageSeries(payloads[id])]));
  if (hourly?.instrument !== 'XAU_USD' || hourly.granularity !== 'H1' || !Array.isArray(hourly.candles)) throw new Error('XAU_USD H1 archive required');
  const candles = hourly.candles.filter(row => row.complete === true).map(row => {
    const time = parseTimestamp(row.time.replace(/\.0{1,9}Z$/, 'Z'));
    if (time === null) throw new Error('Invalid candle timestamp');
    return { market: 'XAUUSD', open_time: new Date(time).toISOString(), close_time: new Date(time + 3600000).toISOString(),
      open: Number(row.mid.o), high: Number(row.mid.h), low: Number(row.mid.l), close: Number(row.mid.c),
      price_basis: 'mid', source: 'OANDA v20 XAU_USD H1', complete: true };
  });
  const calls = [], snapshots = [];
  for (let time = start; time <= end; time += 86400000) {
    if ([0, 6].includes(new Date(time).getUTCDay())) continue;
    const stamp = new Date(time).toISOString();
    const features = [], missing = [];
    for (const [id, name] of Object.entries(SERIES)) {
      const history = asOfHistory(parsed[id], time), latest = history.at(-1);
      const maxAge = (id === 'DTWEXBGS' ? 14 : 7) * 86400000;
      if (!latest || time - latest.date > maxAge) { missing.push({ name, reason: 'unavailable_or_stale' }); continue; }
      const feature = (key, value, sources) => features.push({ name: key, value,
        available_at: new Date(Math.max(...sources.map(row => row.available))).toISOString(),
        observed_at: new Date(latest.date).toISOString(), source: `FRED ${id}`, timing_basis: 'vintage_date_plus_36h_conservative_proxy',
        source_record_id: sources.map(row => `${id}:${row.original.date}:${row.original.realtime_start}`).join('|') });
      feature(name, latest.value, [latest]);
      for (const lag of [1, 5, 20]) {
        const previous = history.at(-1 - lag);
        if (!previous) continue;
        const isYield = ['DFII10', 'DGS2', 'DGS10'].includes(id);
        const change = isYield ? 100 * (latest.value - previous.value) : previous.value === 0 ? null : 100 * (latest.value - previous.value) / previous.value;
        if (change !== null) feature(`${name}_change_${lag}_${isYield ? 'bps' : 'pct'}`, change, [latest, previous]);
      }
    }
    const id = `macro-${stamp.slice(0, 10)}`;
    calls.push({ prediction_id: id, source_snapshot_id: id, market: 'XAUUSD', direction: 'NO_CLEAR_BIAS',
      call_time: stamp, inputs_available_at: stamp, horizon_end: new Date(time + 86400000).toISOString(), features,
      missing_features: missing, input_rejections: missing.length ? missing : [] });
    snapshots.push({ id, created_at: stamp, record_kind: 'derived_research_features_not_live_snapshot' });
  }
  return { dataset: { version: 'gold-macro-vintage-dataset-v1', data_kind: 'reconstructed_macro_research_not_production_calls',
    protocol: { schedule: 'weekdays 14:00 UTC, fixed before analysis; 24 elapsed hours', timing: 'vintage date plus 36h; conservative proxy, not authenticated intraday availability',
      dollar_series: 'DTWEXBGS broad trade-weighted USD; not ICE DXY', missing_inputs: 'require all five macro levels; short lookbacks remain absent',
      limitation: 'Hourly bar end timestamps are nominal; partial session bars and closures remain endpoint-only diagnostics.' },
    config: { candle_interval_ms: 3600000, price_basis: 'mid', flat_threshold_pct: 0.3, coverage_policy: 'exact_endpoints' }, calls, candles }, snapshots };
}
module.exports = { vintageSeries, asOfHistory, buildMacroDataset, SERIES };
