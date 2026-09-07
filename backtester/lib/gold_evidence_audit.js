const { evaluateSingleMarket } = require('./outcome_evaluation');
const { getPhase1OutcomeWindow } = require('./timeframe_windows');

const DIRECTIONS = new Set(['BULLISH', 'BEARISH']);
const FACTORS = Array.from({ length: 10 }, (_, i) => `F${i + 1}`);

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function countBy(rows, key) {
  const result = new Map();
  for (const row of rows) result.set(row[key], (result.get(row[key]) || 0) + 1);
  return result;
}

function stats(observations) {
  const correct = observations.filter(row => row.signal === row.outcome).length;
  const flat = observations.filter(row => row.outcome === 'FLAT').length;
  const directional = observations.length - flat;
  return {
    observations: observations.length, directional_observations: directional,
    correct, wrong: directional - correct, flat,
    ex_flat_accuracy_pct: directional ? 100 * correct / directional : null,
    interpretation: 'descriptive_historical_only'
  };
}

function buildGoldEvidenceAudit(artifact) {
  if (artifact?.meta?.asset !== 'GOLD' || !Array.isArray(artifact.rows)) {
    throw new Error('Expected a GOLD checker artifact with rows.');
  }
  const rows = artifact.rows;
  const ids = countBy(rows, 'prediction_id');
  const dates = countBy(rows, 'snapshot_date');
  const issues = [];
  const observations = [];
  const results = {};
  let recomputed = 0;
  const note = (row, reason) => issues.push({ prediction_id: row.prediction_id ?? null,
    snapshot_date: row.snapshot_date ?? null, reason });
  for (const row of rows) {
    if (typeof row.prediction_id !== 'string' || !row.prediction_id.trim()) { note(row, 'prediction_id_missing'); continue; }
    if (ids.get(row.prediction_id) !== 1) { note(row, 'duplicate_prediction_id'); continue; }
    if (!validDate(row.snapshot_date)) { note(row, 'invalid_snapshot_date'); continue; }
    if (row.timeframe !== 'following 24hrs') { note(row, 'unexpected_timeframe'); continue; }
    const direction = row.stored?.direction;
    if (!['BULLISH', 'BEARISH', 'BULLISH_LEAN', 'BEARISH_LEAN', 'NO_CLEAR_BIAS'].includes(direction)) { note(row, 'invalid_stored_direction'); continue; }
    const threshold = row.stored?.flat_threshold_used;
    if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
      note(row, 'invalid_flat_threshold'); continue;
    }
    const window = getPhase1OutcomeWindow({ assetCode: 'GOLD', timeframe: row.timeframe,
      callDate: row.snapshot_date, callTimeEt: '09:30:00' });
    if (row.evaluation_inputs?.close_date !== window.close_time_et_local?.slice(0, 10)) {
      note(row, 'close_date_mismatch'); continue;
    }
    const evaluation = evaluateSingleMarket({ assetCode: 'GOLD', evaluatedMarket: 'XAUUSD',
      timeframe: row.timeframe, callDate: row.snapshot_date, callTimeEt: '09:30:00',
      agentDirection: direction, agentConviction: row.stored?.predicted_conviction,
      openPrice: row.evaluation_inputs?.open_price, closePrice: row.evaluation_inputs?.close_price,
      flatThresholdOverride: threshold, evaluationVersion: 'gold_local_audit_v1' });
    recomputed++;
    results[evaluation.result] = (results[evaluation.result] || 0) + 1;
    if (evaluation.result !== row.stored?.evaluation_result) note(row, 'stored_result_mismatch');
    if (!evaluation.evaluable) { note(row, evaluation.result_reason); continue; }
    const factors = {};
    for (const factor of FACTORS) {
      const matches = (row.factor_comparisons || []).filter(item => item.factor_key === factor);
      const signal = matches[0]?.signal?.stored;
      if (matches.length !== 1 || !['BULLISH', 'BEARISH', 'NEUTRAL'].includes(signal)) {
        note(row, `invalid_or_missing_factor_${factor}`);
      } else factors[factor] = signal;
    }
    observations.push({ date: row.snapshot_date, factors, outcome: evaluation.market_outcome_direction });
  }
  const factorStats = FACTORS.map(factor => {
    const active = observations.filter(row => DIRECTIONS.has(row.factors[factor]));
    return { factor, available_rows: observations.filter(row => row.factors[factor]).length,
      ...stats(active.map(row => ({ signal: row.factors[factor], outcome: row.outcome }))),
      by_year: Object.fromEntries([...new Set(active.map(row => row.date.slice(0, 4)))].sort().map(year =>
        [year, stats(active.filter(row => row.date.startsWith(year)).map(row => ({ signal: row.factors[factor], outcome: row.outcome })))])) };
  });
  const pairs = [];
  for (let i = 0; i < FACTORS.length; i++) for (let j = i + 1; j < FACTORS.length; j++) {
    const a = FACTORS[i], b = FACTORS[j];
    const both = observations.filter(row => DIRECTIONS.has(row.factors[a]) && DIRECTIONS.has(row.factors[b]));
    const agree = both.filter(row => row.factors[a] === row.factors[b]);
    pairs.push({ factors: [a, b], jointly_active_rows: both.length,
      agreement_pct: both.length ? 100 * agree.length / both.length : null,
      agreement_outcomes: stats(agree.map(row => ({ signal: row.factors[a], outcome: row.outcome }))) });
  }
  return {
    version: 'gold-evidence-audit-v1', research_only: true,
    source_generated_at: artifact.meta.generated_at ?? null,
    methodology: {
      call_time_assumption: '09:30:00 America/New_York; legacy runner default, not verified publication time',
      horizon: 'Legacy weekday calendar: call-date reference price to next weekday close; not literal 24 hours',
      factor_source: 'Stored factor signals only; no fallback to rerun signals',
      interpretation: 'Historical descriptive diagnostics; no sealed holdout, significance claim, weight recommendation, or executable win rate',
      calendar_limit: 'Weekends excluded; exchange holidays not modelled'
    },
    coverage: { source_rows: rows.length, recomputed_rows: recomputed, factor_outcome_rows: observations.length,
      duplicated_prediction_ids: [...ids].filter(([id, n]) => id && n > 1).length,
      dates_with_multiple_rows: [...dates.values()].filter(n => n > 1).length },
    timing_gate: { qualified: false, reason: 'Legacy checker inputs lack verified call and source-price timestamps; numerical agreement cannot establish causal timing.' },
    result_counts: results,
    issue_counts: Object.fromEntries([...new Set(issues.map(row => row.reason))].sort().map(reason =>
      [reason, issues.filter(row => row.reason === reason).length])),
    issues, factors: factorStats, factor_pairs: pairs
  };
}

module.exports = { buildGoldEvidenceAudit, validDate };
