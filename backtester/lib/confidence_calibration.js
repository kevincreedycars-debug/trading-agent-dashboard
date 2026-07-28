const fs = require("fs");
const path = require("path");
const { CHECKER_PATHS } = require("./factor_edge_lab");
const { deriveLayer2PairSignal } = require("./layer2_pair_logic");

const TIMEFRAME_LABEL = "following 24hrs";
const FOLD_COUNT = 4;
const TEN_POINT_BUCKETS = Object.freeze([
  { key: "0_9", label: "0-9", min: 0, max: 9 },
  { key: "10_19", label: "10-19", min: 10, max: 19 },
  { key: "20_29", label: "20-29", min: 20, max: 29 },
  { key: "30_39", label: "30-39", min: 30, max: 39 },
  { key: "40_49", label: "40-49", min: 40, max: 49 },
  { key: "50_59", label: "50-59", min: 50, max: 59 },
  { key: "60_69", label: "60-69", min: 60, max: 69 },
  { key: "70_79", label: "70-79", min: 70, max: 79 },
  { key: "80_89", label: "80-89", min: 80, max: 89 },
  { key: "90_100", label: "90-100", min: 90, max: 100 }
]);
const LAYER2_PAIR_CONFIGS = Object.freeze([
  { targetAssetCode: "EUR", pairCode: "EUR_USD", pairLabel: "EUR/USD", marketKey: "EURUSD" },
  { targetAssetCode: "GOLD", pairCode: "XAU_USD", pairLabel: "XAU/USD", marketKey: "XAUUSD" },
  { targetAssetCode: "NQ", pairCode: "NQ_USD", pairLabel: "NQ/USD", marketKey: "QQQ_NQ_PROXY" },
  { targetAssetCode: "BTC", pairCode: "BTC_USD", pairLabel: "BTC/USD", marketKey: "BTCUSD" }
]);
const STRENGTH_LABELS = Object.freeze({
  WEAK: "Weak",
  MODERATE: "Moderate",
  STRONG: "Strong",
  VERY_STRONG: "Very Strong"
});
const LAYER1_DELIVERY_DIRECTIONS = Object.freeze(["BULLISH", "BEARISH"]);
const LAYER2_DELIVERY_DIRECTIONS = Object.freeze(["BUY", "SELL"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function safeMedian(values = []) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : ((sorted[middle - 1] + sorted[middle]) / 2);
}

function computePctChange(openPrice, closePrice) {
  const open = toNumber(openPrice);
  const close = toNumber(closePrice);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) return null;
  return ((close - open) / open) * 100;
}

function normalizeLayer1Direction(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("BULLISH")) return "BULLISH";
  if (normalized.startsWith("BEARISH")) return "BEARISH";
  return null;
}

function normalizeLayer2Direction(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BUY") return "BUY";
  if (normalized === "SELL") return "SELL";
  return null;
}

function classifyLayer1Direction(value = "") {
  const emitted = String(value || "").trim().toUpperCase();
  if (!emitted) {
    return {
      emitted_direction_class: null,
      delivery_direction: null,
      normalized_direction_sign: null
    };
  }

  if (emitted === "BULLISH" || emitted === "BULLISH_LEAN") {
    return {
      emitted_direction_class: emitted,
      delivery_direction: "BULLISH",
      normalized_direction_sign: "BULLISH"
    };
  }

  if (emitted === "BEARISH" || emitted === "BEARISH_LEAN") {
    return {
      emitted_direction_class: emitted,
      delivery_direction: "BEARISH",
      normalized_direction_sign: "BEARISH"
    };
  }

  const sign = normalizeLayer1Direction(emitted);
  return {
    emitted_direction_class: emitted,
    delivery_direction: sign,
    normalized_direction_sign: sign
  };
}

function classifyLayer2Direction(value = "") {
  const emitted = String(value || "").trim().toUpperCase();
  if (emitted === "BUY") {
    return {
      emitted_direction_class: "BUY",
      delivery_direction: "BUY",
      normalized_direction_sign: "BULLISH"
    };
  }
  if (emitted === "SELL") {
    return {
      emitted_direction_class: "SELL",
      delivery_direction: "SELL",
      normalized_direction_sign: "BEARISH"
    };
  }
  return {
    emitted_direction_class: emitted || null,
    delivery_direction: null,
    normalized_direction_sign: null
  };
}

function normalizeConfidence(row = {}) {
  const candidates = [
    row?.stored?.displayed_headline_confidence_pct,
    row?.stored?.headline_confidence_pct,
    row?.checker?.displayed_headline_confidence_pct,
    row?.checker?.headline_confidence_pct
  ];

  for (const candidate of candidates) {
    const numeric = toNumber(candidate);
    if (!Number.isFinite(numeric)) continue;
    if (numeric >= 0.5 && numeric <= 1) return numeric * 100;
    if (numeric >= 0 && numeric <= 100) return numeric;
  }

  return null;
}

function normalizeOutcome(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "CORRECT") return "CORRECT";
  if (normalized === "WRONG") return "WRONG";
  if (normalized === "FLAT") return "FLAT";
  return null;
}

function bucketFromConfidence(confidence) {
  const numeric = toNumber(confidence);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  return TEN_POINT_BUCKETS.find((bucket) => clamped >= bucket.min && clamped <= bucket.max) || null;
}

function strengthBandFromConfidence(confidence) {
  const numeric = toNumber(confidence);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 80) return { key: "VERY_STRONG", label: "Very Strong" };
  if (numeric >= 65) return { key: "STRONG", label: "Strong" };
  if (numeric >= 50) return { key: "MODERATE", label: "Moderate" };
  if (numeric >= 0) return { key: "WEAK", label: "Weak" };
  return null;
}

function computeNormalizedReturnPct(direction, pctChange) {
  const normalizedDirection = String(direction || "").trim().toUpperCase();
  const numericMove = toNumber(pctChange);
  if (!Number.isFinite(numericMove)) return null;
  if (normalizedDirection === "BULLISH") return numericMove;
  if (normalizedDirection === "BEARISH") return -numericMove;
  return null;
}

function foldLabel(index) {
  return `Fold ${index + 1}`;
}

function buildChronologicalConsistency(observations = []) {
  const sorted = observations
    .slice()
    .sort((left, right) => String(left.snapshot_date || "").localeCompare(String(right.snapshot_date || "")));
  const foldSize = sorted.length ? Math.ceil(sorted.length / FOLD_COUNT) : 0;
  const folds = [];

  for (let index = 0; index < FOLD_COUNT; index += 1) {
    const start = index * foldSize;
    const slice = foldSize ? sorted.slice(start, start + foldSize) : [];
    const directional = slice.filter((row) => row.directional && row.outcome !== "FLAT");
    const wins = directional.filter((row) => row.outcome === "CORRECT").length;
    const losses = directional.filter((row) => row.outcome === "WRONG").length;
    folds.push({
      fold: foldLabel(index),
      total_rows: slice.length,
      directional_calls: directional.length,
      ex_flat_win_rate_pct: directional.length ? roundNumber((wins / directional.length) * 100, 1) : null
    });
  }

  const directionalRates = folds
    .map((fold) => fold.ex_flat_win_rate_pct)
    .filter((value) => Number.isFinite(value));
  const minRate = directionalRates.length ? Math.min(...directionalRates) : null;
  const maxRate = directionalRates.length ? Math.max(...directionalRates) : null;
  const spread = Number.isFinite(minRate) && Number.isFinite(maxRate) ? roundNumber(maxRate - minRate, 1) : null;
  let label = "insufficient_sample";
  if (directionalRates.length >= 2) {
    if (spread <= 10) label = "consistent";
    else if (spread <= 20) label = "mixed";
    else label = "unstable";
  }

  return {
    label,
    folds_with_directional_sample: directionalRates.length,
    min_ex_flat_win_rate_pct: minRate,
    max_ex_flat_win_rate_pct: maxRate,
    spread_pct_points: spread,
    folds
  };
}

function sampleWarning(totalRows, directionalCalls) {
  if (totalRows < 10) {
    return { label: "very_low_sample", detail: "Under 10 rows in bucket; diagnostic only." };
  }
  if (directionalCalls < 10) {
    return { label: "very_low_directional_sample", detail: "Fewer than 10 directional calls in bucket." };
  }
  if (totalRows < 30) {
    return { label: "low_sample", detail: "Fewer than 30 rows in bucket." };
  }
  if (directionalCalls < 30) {
    return { label: "low_directional_sample", detail: "Fewer than 30 directional calls in bucket." };
  }
  if (totalRows < 100) {
    return { label: "usable_but_limited", detail: "Bucket is usable but still modestly sampled." };
  }
  return { label: "well_sampled", detail: "Bucket has at least 100 rows and 30 directional calls." };
}

function monotonicAssessment(rows = []) {
  const usable = rows.filter((row) => Number.isFinite(row.ex_flat_win_rate_pct) && row.directional_calls > 0);
  if (usable.length < 2) {
    return {
      label: "insufficient_data",
      monotonic: null,
      breaks: [],
      detail: "Fewer than two directional confidence buckets were evaluable."
    };
  }

  const breaks = [];
  for (let index = 1; index < usable.length; index += 1) {
    if (usable[index].ex_flat_win_rate_pct < usable[index - 1].ex_flat_win_rate_pct) {
      breaks.push({
        from_bucket: usable[index - 1].bucket_label,
        to_bucket: usable[index].bucket_label,
        from_rate_pct: usable[index - 1].ex_flat_win_rate_pct,
        to_rate_pct: usable[index].ex_flat_win_rate_pct
      });
    }
  }

  return {
    label: breaks.length ? "not_monotonic" : "monotonic",
    monotonic: breaks.length === 0,
    breaks,
    detail: breaks.length
      ? "At least one higher-confidence bucket underperformed the preceding bucket."
      : "Directional ex-flat accuracy did not decrease as confidence rose."
  };
}

function evaluateReliability(entitySummary = {}) {
  const bucketRows = entitySummary.bucket_rows || [];
  const usable = bucketRows.filter((row) => Number.isFinite(row.ex_flat_win_rate_pct) && row.directional_calls > 0);
  const monotonic = entitySummary.monotonic_accuracy?.monotonic;
  const averageAbsGap = usable.length
    ? roundNumber(usable.reduce((sum, row) => sum + Math.abs(Number(row.calibration_gap_pct || 0)), 0) / usable.length, 1)
    : null;
  const wellSampledBuckets = usable.filter((row) => (row.directional_calls || 0) >= 30).length;

  let ordinalLabel = "insufficient_data";
  if (usable.length >= 3 && monotonic === true) ordinalLabel = "behaves_like_ordinal_conviction";
  else if (usable.length >= 3 && monotonic === false && usable[usable.length - 1].ex_flat_win_rate_pct > usable[0].ex_flat_win_rate_pct) ordinalLabel = "partially_ordinal_but_not_clean";
  else if (usable.length >= 2) ordinalLabel = "weak_or_inconsistent_ordinal_signal";

  let probabilityLabel = "insufficient_data";
  if (ordinalLabel === "behaves_like_ordinal_conviction" && averageAbsGap !== null && averageAbsGap <= 7.5 && wellSampledBuckets >= 3) {
    probabilityLabel = "closest_to_probability_like_but_still_requires_out_of_sample_validation";
  } else if (usable.length >= 2) {
    probabilityLabel = "not_statistically_defensible_as_probability_yet";
  }

  return {
    ordinal_conviction_label: ordinalLabel,
    probability_label: probabilityLabel,
    average_absolute_calibration_gap_pct_points: averageAbsGap,
    directional_buckets_evaluable: usable.length,
    well_sampled_directional_buckets: wellSampledBuckets
  };
}

function createBucketAccumulator(bucket) {
  return {
    bucket_key: bucket.key,
    bucket_label: bucket.label,
    bucket_min_confidence_pct: bucket.min,
    bucket_max_confidence_pct: bucket.max,
    observations: []
  };
}

function summarizeScopedBucket(accumulator, observations = []) {
  const directional = observations.filter((row) => row.directional);
  const correct = directional.filter((row) => row.outcome === "CORRECT");
  const wrong = directional.filter((row) => row.outcome === "WRONG");
  const flat = directional.filter((row) => row.outcome === "FLAT");
  const noCalls = observations.filter((row) => !row.directional);
  const directionalCount = directional.length;
  const totalRows = observations.length;
  const directionalDecisions = correct.length + wrong.length;
  const confidenceValues = directional.map((row) => row.confidence_pct).filter((value) => Number.isFinite(value));
  const normalizedReturns = directional.map((row) => row.normalized_return_pct).filter((value) => Number.isFinite(value));
  const exFlatWinRatePct = directionalDecisions ? roundNumber((correct.length / directionalDecisions) * 100, 1) : null;
  const allOutcomeAccuracyPct = directionalCount ? roundNumber((correct.length / directionalCount) * 100, 1) : null;
  const flatRatePct = directionalCount ? roundNumber((flat.length / directionalCount) * 100, 1) : null;
  const meanConfidencePct = confidenceValues.length
    ? roundNumber(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length, 1)
    : null;

  return {
    bucket_key: accumulator.bucket_key,
    bucket_label: accumulator.bucket_label,
    bucket_min_confidence_pct: accumulator.bucket_min_confidence_pct,
    bucket_max_confidence_pct: accumulator.bucket_max_confidence_pct,
    total_rows: totalRows,
    directional_calls: directionalCount,
    no_calls: noCalls.length,
    correct: correct.length,
    wrong: wrong.length,
    flat: flat.length,
    ex_flat_win_rate_pct: exFlatWinRatePct,
    all_outcome_accuracy_pct: allOutcomeAccuracyPct,
    flat_rate_pct: flatRatePct,
    average_normalized_return_pct: normalizedReturns.length ? roundNumber(normalizedReturns.reduce((sum, value) => sum + value, 0) / normalizedReturns.length, 4) : null,
    median_normalized_return_pct: normalizedReturns.length ? roundNumber(safeMedian(normalizedReturns), 4) : null,
    mean_confidence_pct: meanConfidencePct,
    calibration_gap_pct: Number.isFinite(meanConfidencePct) && Number.isFinite(exFlatWinRatePct)
      ? roundNumber(exFlatWinRatePct - meanConfidencePct, 1)
      : null,
    chronological_fold_consistency: buildChronologicalConsistency(directional),
    sample_size_warning: sampleWarning(totalRows, directionalCount)
  };
}

function summarizeBucket(accumulator) {
  const observations = accumulator.observations || [];
  const directional = observations.filter((row) => row.directional);
  const bullish = directional.filter((row) => row.direction_key === "BULLISH");
  const bearish = directional.filter((row) => row.direction_key === "BEARISH");
  const correct = directional.filter((row) => row.outcome === "CORRECT");
  const wrong = directional.filter((row) => row.outcome === "WRONG");
  const flat = directional.filter((row) => row.outcome === "FLAT");
  const noCalls = observations.filter((row) => !row.directional);
  const directionalCount = directional.length;
  const totalRows = observations.length;
  const directionalDecisions = correct.length + wrong.length;
  const confidenceValues = directional.map((row) => row.confidence_pct).filter((value) => Number.isFinite(value));
  const normalizedReturns = directional.map((row) => row.normalized_return_pct).filter((value) => Number.isFinite(value));
  const bullishDirectional = bullish.filter((row) => row.outcome === "CORRECT" || row.outcome === "WRONG");
  const bearishDirectional = bearish.filter((row) => row.outcome === "CORRECT" || row.outcome === "WRONG");
  const bullishWins = bullish.filter((row) => row.outcome === "CORRECT").length;
  const bearishWins = bearish.filter((row) => row.outcome === "CORRECT").length;

  const exFlatWinRatePct = directionalDecisions ? roundNumber((correct.length / directionalDecisions) * 100, 1) : null;
  const allOutcomeAccuracyPct = directionalCount ? roundNumber((correct.length / directionalCount) * 100, 1) : null;
  const flatRatePct = directionalCount ? roundNumber((flat.length / directionalCount) * 100, 1) : null;
  const meanConfidencePct = confidenceValues.length
    ? roundNumber(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length, 1)
    : null;

  return {
    bucket_key: accumulator.bucket_key,
    bucket_label: accumulator.bucket_label,
    bucket_min_confidence_pct: accumulator.bucket_min_confidence_pct,
    bucket_max_confidence_pct: accumulator.bucket_max_confidence_pct,
    total_rows: totalRows,
    directional_calls: directionalCount,
    no_calls: noCalls.length,
    correct: correct.length,
    wrong: wrong.length,
    flat: flat.length,
    ex_flat_win_rate_pct: exFlatWinRatePct,
    all_outcome_accuracy_pct: allOutcomeAccuracyPct,
    flat_rate_pct: flatRatePct,
    bullish_accuracy_pct: bullishDirectional.length ? roundNumber((bullishWins / bullishDirectional.length) * 100, 1) : null,
    bearish_accuracy_pct: bearishDirectional.length ? roundNumber((bearishWins / bearishDirectional.length) * 100, 1) : null,
    average_normalized_return_pct: normalizedReturns.length ? roundNumber(normalizedReturns.reduce((sum, value) => sum + value, 0) / normalizedReturns.length, 4) : null,
    median_normalized_return_pct: normalizedReturns.length ? roundNumber(safeMedian(normalizedReturns), 4) : null,
    mean_confidence_pct: meanConfidencePct,
    calibration_gap_pct: Number.isFinite(meanConfidencePct) && Number.isFinite(exFlatWinRatePct)
      ? roundNumber(exFlatWinRatePct - meanConfidencePct, 1)
      : null,
    chronological_fold_consistency: buildChronologicalConsistency(directional),
    sample_size_warning: sampleWarning(totalRows, directionalCount)
  };
}

function summarizeDirectionBucketRows(observations = [], directionValues = []) {
  return directionValues.map((directionValue) => {
    const buckets = new Map(TEN_POINT_BUCKETS.map((bucket) => [bucket.key, createBucketAccumulator(bucket)]));
    observations
      .filter((row) => row.directional && row.delivery_direction === directionValue)
      .forEach((row) => {
        const bucket = bucketFromConfidence(row.confidence_pct);
        if (!bucket) return;
        buckets.get(bucket.key).observations.push(row);
      });

    return {
      direction: directionValue,
      bucket_rows: TEN_POINT_BUCKETS.map((bucket) => summarizeScopedBucket(buckets.get(bucket.key), buckets.get(bucket.key).observations))
    };
  });
}

function summarizeStrengthBand(rows = [], band) {
  const matching = rows.filter((row) => row.strength_key === band.key);
  const directional = matching.filter((row) => row.directional);
  const correct = directional.filter((row) => row.outcome === "CORRECT").length;
  const wrong = directional.filter((row) => row.outcome === "WRONG").length;
  const flat = directional.filter((row) => row.outcome === "FLAT").length;
  const decisions = correct + wrong;
  return {
    strength_key: band.key,
    strength_label: band.label,
    total_rows: matching.length,
    directional_calls: directional.length,
    no_calls: matching.length - directional.length,
    correct,
    wrong,
    flat,
    ex_flat_win_rate_pct: decisions ? roundNumber((correct / decisions) * 100, 1) : null,
    all_outcome_accuracy_pct: directional.length ? roundNumber((correct / directional.length) * 100, 1) : null,
    flat_rate_pct: directional.length ? roundNumber((flat / directional.length) * 100, 1) : null
  };
}

function summarizeEntity({ entityKey, entityLabel, entityType, observations, nonBucketedRows = 0, note = "", directionValues = [] }) {
  const buckets = new Map(TEN_POINT_BUCKETS.map((bucket) => [bucket.key, createBucketAccumulator(bucket)]));

  observations.forEach((row) => {
    const bucket = bucketFromConfidence(row.confidence_pct);
    if (!bucket) return;
    buckets.get(bucket.key).observations.push(row);
  });

  const bucketRows = TEN_POINT_BUCKETS.map((bucket) => summarizeBucket(buckets.get(bucket.key)));
  const monotonic = monotonicAssessment(bucketRows);
  const reliability = evaluateReliability({ bucket_rows: bucketRows, monotonic_accuracy: monotonic });
  const strengthBands = Object.entries(STRENGTH_LABELS).map(([key, label]) => summarizeStrengthBand(observations, { key, label }));
  const directionalRows = observations.filter((row) => row.directional);

  return {
    entity_key: entityKey,
    entity_label: entityLabel,
    entity_type: entityType,
    timeframe: TIMEFRAME_LABEL,
    total_source_rows: observations.length + nonBucketedRows,
    rows_with_bucket: bucketRows.reduce((sum, row) => sum + row.total_rows, 0),
    rows_without_bucket: nonBucketedRows,
    directional_rows: directionalRows.length,
    note,
    bucket_rows: bucketRows,
    direction_bucket_rows: summarizeDirectionBucketRows(observations, directionValues),
    monotonic_accuracy: monotonic,
    strength_band_rows: strengthBands,
    reliability_summary: reliability
  };
}

function buildLayer1Observation(assetCode, row) {
  const confidencePct = normalizeConfidence(row);
  const rawDirection = row?.stored?.direction || row?.checker?.direction || "";
  const directionClassification = classifyLayer1Direction(rawDirection);
  const outcome = normalizeOutcome(row?.stored?.evaluation_result || row?.checker?.evaluation_result || "");
  const pctChange = computePctChange(row?.evaluation_inputs?.open_price, row?.evaluation_inputs?.close_price);
  const strengthKey = String(row?.stored?.strength_bucket || row?.checker?.strength_bucket || "").trim().toUpperCase();

  return {
    asset_code: assetCode,
    snapshot_date: String(row?.snapshot_date || "").trim(),
    prediction_id: row?.prediction_id || null,
    confidence_pct: confidencePct,
    emitted_direction_class: directionClassification.emitted_direction_class,
    delivery_direction: directionClassification.delivery_direction,
    direction_key: directionClassification.normalized_direction_sign,
    directional: Boolean(directionClassification.delivery_direction),
    outcome,
    normalized_return_pct: computeNormalizedReturnPct(directionClassification.normalized_direction_sign, pctChange),
    raw_pct_change: pctChange,
    strength_key: STRENGTH_LABELS[strengthKey] ? strengthKey : (confidencePct !== null ? (strengthBandFromConfidence(confidencePct)?.key || null) : null)
  };
}

function rowsByDate(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(row?.snapshot_date || "").trim();
    if (key && !map.has(key)) map.set(key, row);
  });
  return map;
}

function buildLayer2Observations(checkers = {}) {
  const usdRows = Array.isArray(checkers.USD?.rows) ? checkers.USD.rows : [];
  const usdByDate = rowsByDate(usdRows);
  const perPair = {};

  LAYER2_PAIR_CONFIGS.forEach((config) => {
    const observations = [];
    let nonBucketedRows = 0;
    const targetRows = Array.isArray(checkers[config.targetAssetCode]?.rows) ? checkers[config.targetAssetCode].rows : [];

    targetRows.forEach((targetRow) => {
      const snapshotDate = String(targetRow?.snapshot_date || "").trim();
      const usdRow = usdByDate.get(snapshotDate) || null;
      if (!usdRow) {
        nonBucketedRows += 1;
        return;
      }

      const signal = deriveLayer2PairSignal({
        instrument: config.pairLabel,
        targetDirection: targetRow?.stored?.direction || targetRow?.checker?.direction || "",
        usdDirection: usdRow?.stored?.direction || usdRow?.checker?.direction || "",
        targetConfidence: normalizeConfidence(targetRow),
        usdConfidence: normalizeConfidence(usdRow)
      });

      if (!signal.tradable) {
        nonBucketedRows += 1;
        return;
      }

      const directionClassification = classifyLayer2Direction(signal.direction);
      const outcome = normalizeOutcome(targetRow?.stored?.evaluation_result || targetRow?.checker?.evaluation_result || "");
      const pctChange = computePctChange(targetRow?.evaluation_inputs?.open_price, targetRow?.evaluation_inputs?.close_price);
      observations.push({
        asset_code: config.pairCode,
        snapshot_date: snapshotDate,
        prediction_id: targetRow?.prediction_id || null,
        confidence_pct: toNumber(signal.combinedConfidence),
        emitted_direction_class: directionClassification.emitted_direction_class,
        delivery_direction: directionClassification.delivery_direction,
        direction_key: directionClassification.normalized_direction_sign,
        directional: Boolean(directionClassification.delivery_direction),
        outcome,
        normalized_return_pct: computeNormalizedReturnPct(directionClassification.normalized_direction_sign, pctChange),
        raw_pct_change: pctChange,
        strength_key: signal.strengthBucketKey || null
      });
    });

    perPair[config.pairCode] = summarizeEntity({
      entityKey: config.pairCode,
      entityLabel: config.pairLabel,
      entityType: "layer2_pair",
      observations,
      nonBucketedRows,
      directionValues: LAYER2_DELIVERY_DIRECTIONS,
      note: "Layer 2 rows are reconstructed from same-date target and USD checker rows using the current pair contract: opposite exact directional calls only, combined confidence = min(target, USD), and realised pair outcome = target-side stored checker outcome on the pair market."
    });
  });

  return perPair;
}

function buildConfidenceCalibrationArtifact(options = {}) {
  const checkerPaths = options.checkerPaths || CHECKER_PATHS;
  const checkers = Object.fromEntries(
    Object.entries(checkerPaths).map(([assetCode, filePath]) => [assetCode, readJson(filePath)])
  );

  const layer1PerAsset = {};
  const pooledLayer1Observations = [];

  Object.entries(checkers).forEach(([assetCode, payload]) => {
    const observations = (Array.isArray(payload?.rows) ? payload.rows : []).map((row) => buildLayer1Observation(assetCode, row));
    pooledLayer1Observations.push(...observations);
    layer1PerAsset[assetCode] = summarizeEntity({
      entityKey: assetCode,
      entityLabel: assetCode === "GOLD" ? "Gold" : assetCode,
      entityType: "layer1_asset",
      observations,
      directionValues: LAYER1_DELIVERY_DIRECTIONS,
      note: `Layer 1 ${assetCode === "GOLD" ? "Gold" : assetCode} rows use the checked-in ${TIMEFRAME_LABEL} checker artifact and its stored evaluation_result contract.`
    });
  });

  const layer2PerPair = buildLayer2Observations(checkers);
  const pooledLayer2Observations = Object.values(layer2PerPair).flatMap((entity) =>
    TEN_POINT_BUCKETS.flatMap((bucket) => {
      const matching = entity.bucket_rows.find((row) => row.bucket_key === bucket.key);
      return matching ? matching.total_rows : [];
    })
  );
  const pooledLayer2Raw = [];
  Object.values(layer2PerPair).forEach((entity) => {
    const note = entity.note;
    void note;
  });

  const rebuiltLayer2Observations = [];
  Object.entries(layer2PerPair).forEach(([pairCode]) => {
    const config = LAYER2_PAIR_CONFIGS.find((item) => item.pairCode === pairCode);
    const targetRows = Array.isArray(checkers[config.targetAssetCode]?.rows) ? checkers[config.targetAssetCode].rows : [];
    const usdByDate = rowsByDate(checkers.USD?.rows || []);
    targetRows.forEach((targetRow) => {
      const snapshotDate = String(targetRow?.snapshot_date || "").trim();
      const usdRow = usdByDate.get(snapshotDate) || null;
      if (!usdRow) return;
      const signal = deriveLayer2PairSignal({
        instrument: config.pairLabel,
        targetDirection: targetRow?.stored?.direction || targetRow?.checker?.direction || "",
        usdDirection: usdRow?.stored?.direction || usdRow?.checker?.direction || "",
        targetConfidence: normalizeConfidence(targetRow),
        usdConfidence: normalizeConfidence(usdRow)
      });
      if (!signal.tradable) return;
      const directionClassification = classifyLayer2Direction(signal.direction);
      rebuiltLayer2Observations.push({
        asset_code: config.pairCode,
        snapshot_date: snapshotDate,
        prediction_id: targetRow?.prediction_id || null,
        confidence_pct: toNumber(signal.combinedConfidence),
        emitted_direction_class: directionClassification.emitted_direction_class,
        delivery_direction: directionClassification.delivery_direction,
        direction_key: directionClassification.normalized_direction_sign,
        directional: Boolean(directionClassification.delivery_direction),
        outcome: normalizeOutcome(targetRow?.stored?.evaluation_result || targetRow?.checker?.evaluation_result || ""),
        normalized_return_pct: computeNormalizedReturnPct(directionClassification.normalized_direction_sign, computePctChange(targetRow?.evaluation_inputs?.open_price, targetRow?.evaluation_inputs?.close_price)),
        raw_pct_change: computePctChange(targetRow?.evaluation_inputs?.open_price, targetRow?.evaluation_inputs?.close_price),
        strength_key: signal.strengthBucketKey || null
      });
    });
  });

  const pooledLayer1 = summarizeEntity({
    entityKey: "LAYER1_POOLED",
    entityLabel: "Layer 1 Pooled",
    entityType: "layer1_pooled",
    observations: pooledLayer1Observations,
    directionValues: LAYER1_DELIVERY_DIRECTIONS,
    note: "Pooled Layer 1 aggregates the five checked-in checker artifacts without changing the existing 24H outcome contract."
  });
  const pooledLayer2 = summarizeEntity({
    entityKey: "LAYER2_POOLED",
    entityLabel: "Layer 2 Pooled",
    entityType: "layer2_pooled",
    observations: rebuiltLayer2Observations,
    directionValues: LAYER2_DELIVERY_DIRECTIONS,
    note: "Pooled Layer 2 aggregates reconstructed historically emitted pair calls under the current pair contract only; non-tradable dates remain outside bucket totals."
  });

  return {
    generated_at: new Date().toISOString(),
    version: "confidence-calibration-v1",
    timeframe: TIMEFRAME_LABEL,
    outcome_contract_note: "All metrics stay on the current locked checker definition: following 24hrs using each asset's checked-in primary evaluation market and stored evaluation_result semantics. This diagnostic does not reinterpret forecast horizon.",
    existing_analysis_audit: {
      existing_dashboard_views: [
        "Backtest / Accuracy currently shows coarse research_accuracy_by_confidence_bucket rows from the research SQL layer.",
        "Pair Trade Research already includes confidence bucket counts and ex-flat summaries using combined confidence = min(target, USD).",
        "Legacy historical writeups mention confidence bands, but they do not provide the full per-bucket calibration diagnostics requested here."
      ],
      missing_before_this_artifact: [
        "No repo-local 0-9 through 90-100 calibration artifact across all Layer 1 assets and Layer 2 pairs.",
        "No per-bucket bullish/bearish split accuracy, normalized return stats, fold consistency, monotonicity check, or reliability summary.",
        "Existing dashboard confidence analysis did not establish whether confidence behaved as an ordinal conviction score or as a defensible probability."
      ]
    },
    definitions_contract: {
      direction_mapping: {
        layer1: [
          "BULLISH and BULLISH_LEAN are evaluated together as BULLISH directional calls because the locked checker contract records directional correctness by sign rather than by lean/full subtype.",
          "BEARISH and BEARISH_LEAN are evaluated together as BEARISH directional calls for the same reason.",
          "NO_CLEAR_BIAS and other non-directional states remain non-directional and do not receive a directional success rate."
        ],
        layer2: [
          "BUY and SELL retain their exact emitted trade directions in the delivery contract.",
          "NO_TRADE remains non-directional and does not receive a directional success rate."
        ]
      },
      participation_definition: "Participation is the weighted share of expected directional evidence that remained active and usable for the call. Higher participation means more of the intended weighted model inputs contributed directional evidence; low participation means the call rests on a thinner active evidence base.",
      layer1_strength_thresholds: {
        VERY_STRONG: "confidence >= 80, abs(net edge) >= 25, participation >= 50",
        STRONG: "confidence >= 65, abs(net edge) >= 18, participation >= 35",
        MODERATE: "confidence >= 50, abs(net edge) >= 10, participation >= 25",
        WEAK: "confidence > 0 when stronger gates were not met"
      },
      layer2_strength_thresholds: {
        VERY_STRONG: "combined confidence >= 80",
        STRONG: "combined confidence >= 65",
        MODERATE: "combined confidence >= 50",
        WEAK: "combined confidence >= 0"
      }
    },
    layer1: {
      pooled: pooledLayer1,
      assets: layer1PerAsset
    },
    layer2: {
      pooled: pooledLayer2,
      pairs: layer2PerPair
    }
  };
}

function writeConfidenceCalibrationArtifact(outputPath, options = {}) {
  const payload = buildConfidenceCalibrationArtifact(options);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

module.exports = {
  CHECKER_PATHS,
  FOLD_COUNT,
  LAYER1_DELIVERY_DIRECTIONS,
  LAYER2_DELIVERY_DIRECTIONS,
  STRENGTH_LABELS,
  TEN_POINT_BUCKETS,
  TIMEFRAME_LABEL,
  buildConfidenceCalibrationArtifact,
  buildChronologicalConsistency,
  classifyLayer1Direction,
  classifyLayer2Direction,
  computeNormalizedReturnPct,
  computePctChange,
  monotonicAssessment,
  normalizeConfidence,
  normalizeLayer1Direction,
  normalizeOutcome,
  sampleWarning,
  summarizeEntity,
  writeConfidenceCalibrationArtifact
};
