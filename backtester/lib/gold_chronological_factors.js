const { buildGoldTimestampedReport, parseTimestamp } = require('./gold_timestamped_evaluation');

function summarize(samples) {
  const flat = samples.filter(row => row.outcome === 'FLAT').length;
  const correct = samples.filter(row => row.signal === row.outcome).length;
  const n = samples.length - flat;
  return { samples: samples.length, directional_samples: n, flat, correct, wrong: n - correct,
    ex_flat_accuracy_pct: n ? correct / n * 100 : null };
}

function factorSummary(rows, factor) {
  const available = rows.filter(row => row.factors.has(factor));
  const active = available.filter(row => ['BULLISH', 'BEARISH'].includes(row.factors.get(factor)));
  const samples = active.map(row => ({ signal: row.factors.get(factor), outcome: row.outcome }));
  return { available_calls: available.length, missing_calls: rows.length - available.length,
    neutral_calls: available.length - active.length, ...summarize(samples),
    bullish: summarize(samples.filter(row => row.signal === 'BULLISH')),
    bearish: summarize(samples.filter(row => row.signal === 'BEARISH')) };
}

function pairSummary(rows, a, b) {
  const encoded = { BULLISH: 1, BEARISH: -1, NEUTRAL: 0 };
  const available = rows.filter(row => row.factors.has(a) && row.factors.has(b));
  const mean = name => available.reduce((sum, row) => sum + encoded[row.factors.get(name)], 0) / available.length;
  const meanA = mean(a), meanB = mean(b);
  let covariance = 0, varianceA = 0, varianceB = 0;
  for (const row of available) {
    const x = encoded[row.factors.get(a)] - meanA, y = encoded[row.factors.get(b)] - meanB;
    covariance += x * y; varianceA += x * x; varianceB += y * y;
  }
  const correlation = available.length > 1 && varianceA > 0 && varianceB > 0
    ? Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceA * varianceB))) : null;
  const jointlyActive = rows.filter(row => ['BULLISH', 'BEARISH'].includes(row.factors.get(a)) &&
    ['BULLISH', 'BEARISH'].includes(row.factors.get(b)));
  const agree = jointlyActive.filter(row => row.factors.get(a) === row.factors.get(b));
  return { jointly_active_calls: jointlyActive.length,
    jointly_available_calls: available.length,
    signal_correlation: correlation,
    correlation_encoding: 'BULLISH=1, NEUTRAL=0, BEARISH=-1; missing omitted; constant series undefined',
    agreement_pct: jointlyActive.length ? 100 * agree.length / jointlyActive.length : null,
    agreeing_outcomes: summarize(agree.map(row => ({ signal: row.factors.get(a), outcome: row.outcome }))) };
}

function buildGoldChronologicalFactors(dataset, options) {
  const split = parseTimestamp(options?.split_at);
  const embargo = options?.embargo_ms;
  if (split === null || !Number.isSafeInteger(embargo) || embargo < 0 || !Number.isSafeInteger(split + embargo)) {
    throw new Error('Explicit split_at timestamp and non-negative integer embargo_ms required.');
  }
  const evaluation = buildGoldTimestampedReport(dataset);
  const partitions = { training: [], validation: [] };
  const excluded = [];
  dataset.calls.forEach((call, index) => {
    const result = evaluation.rows[index];
    const exclude = reason => excluded.push({ prediction_id: call?.prediction_id ?? null, reason });
    if (!result.evaluable) { exclude(result.result_reason); return; }
    const start = parseTimestamp(call.call_time), end = parseTimestamp(call.horizon_end);
    let partition;
    if (end <= split) partition = 'training';
    else if (start >= split + embargo) partition = 'validation';
    else { exclude('split_overlap_or_embargo'); return; }
    const factors = new Map();
    for (const feature of call.features) {
      if (/^F(?:[1-9]|10)$/.test(feature.name) && ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(feature.value)) {
        factors.set(feature.name, feature.value);
      }
    }
    partitions[partition].push({ factors, outcome: result.market_outcome_direction,
      call_time: result.call_time, horizon_end: result.horizon_end });
  });
  const factors = Array.from({ length: 10 }, (_, i) => `F${i + 1}`);
  const pairs = [];
  for (let i = 0; i < factors.length; i++) for (let j = i + 1; j < factors.length; j++) {
    pairs.push({ factors: [factors[i], factors[j]],
      training: pairSummary(partitions.training, factors[i], factors[j]),
      validation: pairSummary(partitions.validation, factors[i], factors[j]) });
  }
  return { version: 'gold-chronological-factors-v1', research_only: true,
    data_kind: dataset.data_kind || 'unspecified',
    evaluation_contract: dataset.config ?? null,
    protocol: dataset.protocol ?? null,
    split_at: new Date(split).toISOString(), embargo_ms: embargo,
    untouched_holdout_claimed: false, weight_changes_proposed: false,
    limitations: [
      'Caller chooses the split; this tool cannot establish that validation data was previously unseen.',
      'Overlapping calls within a partition may be dependent; sample counts are not independent trial counts.',
      'All ten factors and 45 pairs are descriptive comparisons, not significance-tested edge or executable profits.',
      'Feature and candle provenance is supplied metadata, not independently authenticated.',
      'Endpoint-only coverage, when explicitly selected, does not validate the intervening path.'
    ],
    coverage: { source_calls: dataset.calls.length, training_calls: partitions.training.length,
      validation_calls: partitions.validation.length, excluded_calls: excluded.length },
    excluded,
    factors: factors.map(factor => ({ factor, training: factorSummary(partitions.training, factor),
      validation: factorSummary(partitions.validation, factor) })), pairs };
}

module.exports = { buildGoldChronologicalFactors };
