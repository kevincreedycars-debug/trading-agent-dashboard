const { computePctChange, normalizeMarketPrice } = require('./outcome_evaluation');
const { classifyMarketOutcome, scoreEvaluationResult } = require('./outcome_direction');
const { validDate } = require('./gold_evidence_audit');

// Require an explicit zone and real calendar components; never infer broker time.
function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !validDate(match[1]) || +match[2] > 23 || +match[3] > 59 || +match[4] > 59) return null;
  if (match[6] !== 'Z') {
    const [hours, minutes] = match[6].slice(1).split(':').map(Number);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function evaluateGoldTimestampedCall(call, candles, config) {
  const base = { prediction_id: call?.prediction_id ?? null, version: 'gold-timestamped-direction-v2',
    source_lineage: { source_snapshot_id: call?.source_snapshot_id ?? null,
      original_storage_timestamp: call?.original_storage_timestamp ?? null,
      feature_selection_cutoff: call?.feature_selection_cutoff ?? null,
      features: Array.isArray(call?.features) ? call.features.map(feature => ({
        name: feature?.name ?? null, source: feature?.source ?? null,
        source_record_id: feature?.source_record_id ?? null,
        observed_at: feature?.observed_at ?? null, available_at: feature?.available_at ?? null })) : [] },
    research_only: true, executable_trade_validated: false, evaluable: false,
    result: 'NOT_EVALUABLE', pct_change: null, market_outcome_direction: null,
    methodology: 'Exact candle-open at call to candle-close at explicit horizon; price direction only, not fills or P&L.' };
  const reject = reason => ({ ...base, result_reason: reason });
  if (!call || typeof call.prediction_id !== 'string' || !call.prediction_id.trim()) return reject('prediction_id_missing');
  if (call.market !== 'XAUUSD') return reject('market_mismatch');
  if (call.input_rejections !== undefined && (!Array.isArray(call.input_rejections) || call.input_rejections.length)) return reject('input_contract_incomplete');
  if (!['BULLISH', 'BEARISH', 'BULLISH_LEAN', 'BEARISH_LEAN', 'NO_CLEAR_BIAS'].includes(call.direction)) return reject('direction_invalid');
  const start = parseTimestamp(call.call_time), end = parseTimestamp(call.horizon_end);
  const inputsAt = parseTimestamp(call.inputs_available_at);
  if (start === null || end === null || inputsAt === null) return reject('timestamp_invalid_or_missing');
  if (inputsAt > start) return reject('inputs_available_after_call');
  if (!Array.isArray(call.features) || !call.features.length) return reject('features_missing');
  const featureNames = new Set();
  for (const feature of call.features) {
    if (!feature || typeof feature.name !== 'string' || !feature.name.trim() ||
      feature.value === null || feature.value === undefined ||
      !['string', 'number', 'boolean'].includes(typeof feature.value) ||
      (typeof feature.value === 'number' && !Number.isFinite(feature.value)) ||
      (typeof feature.value === 'string' && !feature.value.trim())) return reject('feature_invalid');
    if (featureNames.has(feature.name)) return reject('duplicate_feature');
    featureNames.add(feature.name);
    const available = parseTimestamp(feature.available_at);
    if (available === null) return reject('feature_availability_missing');
    if (available > start || available > inputsAt) return reject('feature_available_after_input_cutoff');
  }
  if (end <= start) return reject('horizon_not_after_call');
  const interval = config?.candle_interval_ms;
  if (!Number.isSafeInteger(interval) || interval <= 0) return reject('candle_interval_invalid');
  let entry = start;
  if (call.entry_time !== undefined) {
    entry = parseTimestamp(call.entry_time);
    if (config.entry_policy !== 'next_interval_open_after_call' ||
      !Number.isSafeInteger(config.max_entry_delay_ms) || config.max_entry_delay_ms <= 0) return reject('delayed_entry_policy_required');
    if (entry === null || entry !== (Math.floor(start / interval) + 1) * interval ||
      entry - start > config.max_entry_delay_ms) return reject('delayed_entry_invalid');
    if (end <= entry) return reject('horizon_not_after_entry');
  } else if (config.entry_policy !== undefined && config.entry_policy !== 'at_call') return reject('entry_time_missing');
  const coveragePolicy = config.coverage_policy ?? 'contiguous';
  if (!['contiguous', 'exact_endpoints'].includes(coveragePolicy)) return reject('coverage_policy_invalid');
  if (!['bid', 'ask', 'mid'].includes(config.price_basis)) return reject('price_basis_invalid');
  const threshold = config.flat_threshold_pct;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) return reject('flat_threshold_invalid');
  if (!Array.isArray(candles)) return reject('candles_missing');
  const parsed = [];
  for (const candle of candles) {
    if (!candle || candle.market !== 'XAUUSD') return reject('candle_market_mismatch');
    const openTime = parseTimestamp(candle.open_time), closeTime = parseTimestamp(candle.close_time);
    if (openTime === null || closeTime === null || closeTime <= openTime) return reject('candle_timestamp_invalid');
    // Outside-window candles cannot influence entry, settlement or path coverage.
    if (closeTime <= entry || openTime >= end) continue;
    if (candle.complete === false) return reject('candle_incomplete');
    if (candle.complete !== true) return reject('candle_completion_unknown');
    if (candle.price_basis !== config.price_basis) return reject('candle_price_basis_mismatch');
    if (typeof candle.source !== 'string' || !candle.source.trim()) return reject('candle_source_missing');
    const prices = ['open', 'high', 'low', 'close'].map(key => normalizeMarketPrice(candle[key]));
    const [open, high, low, close] = prices;
    if (prices.includes(null) || low > Math.min(open, close) || high < Math.max(open, close) || low > high) return reject('candle_ohlc_invalid');
    if (closeTime - openTime !== interval) return reject('candle_duration_mismatch');
    parsed.push({ openTime, closeTime, open, close, source: candle.source });
  }
  parsed.sort((a, b) => a.openTime - b.openTime);
  if (!parsed.length) return reject('candles_missing_in_window');
  if (parsed[0].openTime !== entry) return reject('exact_entry_candle_missing');
  if (parsed.at(-1).closeTime !== end) return reject('exact_horizon_candle_missing');
  if (new Set(parsed.map(row => row.source)).size !== 1) return reject('mixed_candle_sources');
  let gapCount = 0, missingDuration = 0;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].openTime < parsed[i - 1].closeTime) return reject('duplicate_or_overlapping_candles');
    if (parsed[i].openTime > parsed[i - 1].closeTime) {
      if (coveragePolicy === 'contiguous') return reject('candle_gap');
      gapCount++;
      missingDuration += parsed[i].openTime - parsed[i - 1].closeTime;
    }
  }
  const pctChange = computePctChange(parsed[0].open, parsed.at(-1).close);
  if (pctChange === null) return reject('market_return_invalid');
  const outcome = classifyMarketOutcome(pctChange, threshold);
  const scored = scoreEvaluationResult({ agentDirection: call.direction,
    marketOutcomeDirection: outcome.market_outcome_direction });
  return { ...base, ...scored, evaluable: true, pct_change: pctChange,
    market_outcome_direction: outcome.market_outcome_direction,
    call_time: new Date(start).toISOString(), horizon_end: new Date(end).toISOString(),
    entry_time: new Date(entry).toISOString(), entry_delay_ms: entry - start,
    entry_policy: call.entry_time === undefined ? 'at_call' : config.entry_policy,
    coverage_policy: coveragePolicy, observed_path_complete: gapCount === 0,
    interior_gap_count: gapCount, interior_missing_duration_ms: missingDuration,
    methodology: 'Exact selected candle-open at explicit entry to candle-close at explicit horizon; price direction only, not fills or P&L.',
    inputs_available_at: new Date(inputsAt).toISOString(),
    open_price: parsed[0].open, close_price: parsed.at(-1).close,
    candle_count: parsed.length, candle_interval_ms: interval, price_basis: config.price_basis,
    flat_threshold_pct: threshold, sources: [...new Set(parsed.map(row => row.source))].sort() };
}

function indexCandleWindows(candles) {
  const entries = [];
  for (const [index, candle] of candles.entries()) {
    const open = parseTimestamp(candle?.open_time), close = parseTimestamp(candle?.close_time);
    // Preserve the direct evaluator's rejection precedence on malformed input.
    if (candle?.market !== 'XAUUSD' || open === null || close === null || close <= open) return () => candles;
    entries.push({ candle, index, open, close });
  }
  entries.sort((a, b) => a.open - b.open || a.index - b.index);
  let maximumClose = -Infinity;
  for (const entry of entries) { maximumClose = Math.max(maximumClose, entry.close); entry.maximumClose = maximumClose; }
  const first = predicate => {
    let low = 0, high = entries.length;
    while (low < high) { const mid = Math.floor((low + high) / 2); if (predicate(entries[mid])) high = mid; else low = mid + 1; }
    return low;
  };
  return call => {
    const start = parseTimestamp(call?.entry_time ?? call?.call_time), end = parseTimestamp(call?.horizon_end);
    if (start === null || end === null || end <= start) return candles;
    return entries.slice(first(row => row.maximumClose > start), first(row => row.open >= end))
      .filter(row => row.close > start).sort((a, b) => a.index - b.index).map(row => row.candle);
  };
}

function buildGoldTimestampedReport(dataset) {
  if (!dataset || !Array.isArray(dataset.calls) || !Array.isArray(dataset.candles)) throw new Error('Dataset requires calls and candles arrays.');
  const idCounts = new Map();
  for (const call of dataset.calls) idCounts.set(call?.prediction_id, (idCounts.get(call?.prediction_id) || 0) + 1);
  const windowForCall = indexCandleWindows(dataset.candles);
  const rows = dataset.calls.map(call => {
    const row = evaluateGoldTimestampedCall(call, windowForCall(call), dataset.config);
    if (call?.prediction_id && idCounts.get(call.prediction_id) > 1) return {
      version: row.version, source_lineage: row.source_lineage,
      prediction_id: call.prediction_id, evaluable: false, result: 'NOT_EVALUABLE',
      result_reason: 'duplicate_prediction_id', pct_change: null, market_outcome_direction: null,
      research_only: true, executable_trade_validated: false
    };
    return row;
  });
  const count = key => rows.reduce((counts, row) => { counts[row[key]] = (counts[row[key]] || 0) + 1; return counts; }, {});
  return { version: 'gold-timestamped-direction-v2', research_only: true,
    candle_completion_policy: 'explicit_boolean_true',
    data_kind: dataset.data_kind || 'unspecified',
    evaluation_contract: dataset.config ?? null,
    protocol: dataset.protocol ?? null,
    entry_semantics: dataset.entry_semantics ?? null,
    executable_trade_validated: false,
    provenance_note: 'Validates supplied timestamp consistency, not independent authenticity of the feed or feature availability claims.',
    calls: rows.length, evaluable_calls: rows.filter(row => row.evaluable).length,
    result_counts: count('result'), reason_counts: count('result_reason'), rows };
}

module.exports = { parseTimestamp, evaluateGoldTimestampedCall, buildGoldTimestampedReport };
