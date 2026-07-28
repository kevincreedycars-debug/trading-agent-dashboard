const fs = require("fs");

const SAMPLE_SIZE_THRESHOLDS = Object.freeze({
  very_low_max_evaluated_calls: 9,
  low_max_evaluated_calls: 29,
  moderate_max_evaluated_calls: 99
});

const LAYER_CONFIG = Object.freeze({
  "Layer 1": {
    pooledKey: "LAYER1_POOLED",
    directionalValues: ["BULLISH", "BEARISH"],
    combinedDirection: "BOTH",
    directionalReferenceLabel: "Pooled Layer 1 directional reference",
    pooledReferenceLabel: "Pooled Layer 1 reference"
  },
  "Layer 2": {
    pooledKey: "LAYER2_POOLED",
    directionalValues: ["BUY", "SELL"],
    combinedDirection: "BOTH",
    directionalReferenceLabel: "Pooled Layer 2 directional reference",
    pooledReferenceLabel: "Pooled Layer 2 reference"
  }
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function classifySampleSizeStatus(evaluatedCalls) {
  const count = Number(evaluatedCalls || 0);
  if (count <= SAMPLE_SIZE_THRESHOLDS.very_low_max_evaluated_calls) return "Very limited evidence";
  if (count <= SAMPLE_SIZE_THRESHOLDS.low_max_evaluated_calls) return "Limited evidence";
  if (count <= SAMPLE_SIZE_THRESHOLDS.moderate_max_evaluated_calls) return "Reasonable evidence";
  return "Substantial evidence";
}

function isInsufficientHistoricalSample(evaluatedCalls) {
  return Number(evaluatedCalls || 0) < 30;
}

function createBaseMetricRow({
  scopeType,
  referenceLabel,
  layer,
  market,
  marketKey,
  direction,
  confidenceBand,
  confidenceBandMin,
  confidenceBandMax,
  totalCalls,
  correct,
  wrong,
  flat,
  directionalAccuracy,
  allOutcomeAccuracy,
  flatRate,
  meanConfidence,
  horizon,
  checkerContract,
  generatedAt,
  sourceNote,
  additional = {}
}) {
  const evaluatedDirectionalCalls = Number(correct || 0) + Number(wrong || 0);
  const totalHistoricalOutcomes = Number(correct || 0) + Number(wrong || 0) + Number(flat || 0);
  const evidenceQuality = classifySampleSizeStatus(evaluatedDirectionalCalls);
  return {
    scope_type: scopeType,
    reference_label: referenceLabel,
    layer,
    market,
    market_key: marketKey,
    direction,
    confidence_band: confidenceBand,
    confidence_band_min: Number(confidenceBandMin ?? 0),
    confidence_band_max: Number(confidenceBandMax ?? 0),
    total_calls: Number(totalCalls || 0),
    historical_calls: Number(totalCalls || 0),
    correct: Number(correct || 0),
    wrong: Number(wrong || 0),
    flat: Number(flat || 0),
    evaluated_directional_calls: evaluatedDirectionalCalls,
    directional_sample: evaluatedDirectionalCalls,
    total_historical_outcomes: totalHistoricalOutcomes,
    total_sample: Number(totalCalls || 0),
    directional_accuracy: directionalAccuracy,
    ex_flat_win_rate: directionalAccuracy,
    all_outcome_accuracy: allOutcomeAccuracy,
    flat_rate: flatRate,
    mean_confidence: meanConfidence,
    evidence_quality: evidenceQuality,
    sample_size_status: evidenceQuality,
    insufficient_historical_sample: isInsufficientHistoricalSample(evaluatedDirectionalCalls),
    horizon,
    checker_contract: checkerContract,
    generated_at: generatedAt,
    source_note: sourceNote || "",
    ...additional
  };
}

function createBandMetricRow({
  scopeType,
  referenceLabel,
  layer,
  entity,
  direction,
  bucketRow,
  generatedAt
}) {
  const totalCalls = Number(bucketRow.total_rows || 0);
  const correct = Number(bucketRow.correct || 0);
  const wrong = Number(bucketRow.wrong || 0);
  const flat = Number(bucketRow.flat || 0);
  const evaluatedDirectionalCalls = correct + wrong;
  const totalHistoricalOutcomes = correct + wrong + flat;
  return createBaseMetricRow({
    scopeType,
    referenceLabel,
    layer,
    market: entity.entity_label,
    marketKey: entity.entity_key,
    direction,
    confidenceBand: bucketRow.bucket_label,
    confidenceBandMin: bucketRow.bucket_min_confidence_pct,
    confidenceBandMax: bucketRow.bucket_max_confidence_pct,
    totalCalls,
    correct,
    wrong,
    flat,
    directionalAccuracy: bucketRow.ex_flat_win_rate_pct ?? null,
    allOutcomeAccuracy: totalHistoricalOutcomes ? Number(((correct / totalHistoricalOutcomes) * 100).toFixed(1)) : null,
    flatRate: totalHistoricalOutcomes ? Number(((flat / totalHistoricalOutcomes) * 100).toFixed(1)) : null,
    meanConfidence: bucketRow.mean_confidence_pct ?? null,
    horizon: entity.timeframe,
    checkerContract: "locked following-24-hours checker contract",
    generatedAt,
    sourceNote: entity.note || "",
    additional: {
      no_calls: Number(bucketRow.no_calls || 0),
      calibration_gap: bucketRow.calibration_gap_pct ?? null
    }
  });
}

function createStrengthRow({
  scopeType,
  layer,
  entity,
  strengthRow,
  generatedAt
}) {
  const correct = Number(strengthRow.correct || 0);
  const wrong = Number(strengthRow.wrong || 0);
  const flat = Number(strengthRow.flat || 0);
  const evaluatedDirectionalCalls = correct + wrong;
  const totalHistoricalOutcomes = correct + wrong + flat;
  return {
    scope_type: scopeType,
    layer,
    market: entity.entity_label,
    market_key: entity.entity_key,
    strength_key: strengthRow.strength_key,
    strength_label: strengthRow.strength_label,
    total_calls: Number(strengthRow.total_rows || 0),
    historical_calls: Number(strengthRow.total_rows || 0),
    correct,
    wrong,
    flat,
    evaluated_directional_calls: evaluatedDirectionalCalls,
    directional_sample: evaluatedDirectionalCalls,
    total_historical_outcomes: totalHistoricalOutcomes,
    directional_accuracy: evaluatedDirectionalCalls ? Number(((correct / evaluatedDirectionalCalls) * 100).toFixed(1)) : null,
    ex_flat_win_rate: evaluatedDirectionalCalls ? Number(((correct / evaluatedDirectionalCalls) * 100).toFixed(1)) : null,
    all_outcome_accuracy: totalHistoricalOutcomes ? Number(((correct / totalHistoricalOutcomes) * 100).toFixed(1)) : null,
    flat_rate: totalHistoricalOutcomes ? Number(((flat / totalHistoricalOutcomes) * 100).toFixed(1)) : null,
    evidence_quality: classifySampleSizeStatus(evaluatedDirectionalCalls),
    sample_size_status: classifySampleSizeStatus(evaluatedDirectionalCalls),
    insufficient_historical_sample: isInsufficientHistoricalSample(evaluatedDirectionalCalls),
    horizon: entity.timeframe,
    checker_contract: "locked following-24-hours checker contract",
    generated_at: generatedAt,
    source_note: entity.note || ""
  };
}

function createNoTradeRow(entity, generatedAt) {
  const noTradeOutcomes = Number(entity.rows_without_bucket || 0);
  const totalObservations = Number(entity.total_source_rows || 0);
  return {
    scope_type: "layer2_no_trade_summary",
    layer: "Layer 2",
    market: entity.entity_label,
    market_key: entity.entity_key,
    direction: "NO_TRADE",
    no_trade_outcomes: noTradeOutcomes,
    total_layer2_observations: totalObservations,
    no_trade_rate: totalObservations ? Number(((noTradeOutcomes / totalObservations) * 100).toFixed(1)) : null,
    generated_at: generatedAt,
    source_note: entity.note || ""
  };
}

function findBucketRow(entity, direction, bucketLabel) {
  const directionEntry = (entity.direction_bucket_rows || []).find((row) => String(row.direction || "") === String(direction || ""));
  return directionEntry?.bucket_rows?.find((row) => row.bucket_label === bucketLabel) || null;
}

function createAsymmetryRow({
  layer,
  entity,
  bullishDirection,
  bearishDirection,
  combinedRow,
  generatedAt
}) {
  const bullishRow = findBucketRow(entity, bullishDirection, combinedRow.bucket_label);
  const bearishRow = findBucketRow(entity, bearishDirection, combinedRow.bucket_label);
  const bullishEvaluated = Number(bullishRow?.correct || 0) + Number(bullishRow?.wrong || 0);
  const bearishEvaluated = Number(bearishRow?.correct || 0) + Number(bearishRow?.wrong || 0);
  const bullishAccuracy = bullishRow?.ex_flat_win_rate_pct ?? null;
  const bearishAccuracy = bearishRow?.ex_flat_win_rate_pct ?? null;
  const bothSidesAdequate = bullishEvaluated >= 30 && bearishEvaluated >= 30;
  const difference = Number.isFinite(bullishAccuracy) && Number.isFinite(bearishAccuracy)
    ? Number((bullishAccuracy - bearishAccuracy).toFixed(1))
    : null;
  return {
    scope_type: "directional_asymmetry",
    layer,
    market: entity.entity_label,
    market_key: entity.entity_key,
    confidence_band: combinedRow.bucket_label,
    confidence_band_min: Number(combinedRow.bucket_min_confidence_pct ?? 0),
    confidence_band_max: Number(combinedRow.bucket_max_confidence_pct ?? 0),
    bullish_direction: bullishDirection,
    bearish_direction: bearishDirection,
    bullish_directional_accuracy: bullishAccuracy,
    bearish_directional_accuracy: bearishAccuracy,
    difference_pct_points: difference,
    bullish_historical_calls: Number(bullishRow?.total_rows || 0),
    bearish_historical_calls: Number(bearishRow?.total_rows || 0),
    bullish_evaluated_directional_calls: bullishEvaluated,
    bearish_evaluated_directional_calls: bearishEvaluated,
    adequate_evidence: bothSidesAdequate,
    generated_at: generatedAt
  };
}

function createCoverage(calibration) {
  return {
    layer1_markets: Object.keys(calibration.layer1?.assets || {}),
    layer2_pairs: Object.keys(calibration.layer2?.pairs || {}),
    layer1_directions: LAYER_CONFIG["Layer 1"].directionalValues.slice(),
    layer2_directions: LAYER_CONFIG["Layer 2"].directionalValues.slice(),
    confidence_bands: (((calibration.layer1?.pooled || {}).bucket_rows || []).map((row) => row.bucket_label)),
    strength_bands: (((calibration.layer1?.pooled || {}).strength_band_rows || []).map((row) => row.strength_label))
  };
}

function groupSum(rows, keys) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keys.map((keyPart) => String(row[keyPart] ?? "")).join("::");
    const existing = map.get(key) || { total_calls: 0, correct: 0, wrong: 0, flat: 0, evaluated_directional_calls: 0 };
    existing.total_calls += Number(row.total_calls || 0);
    existing.correct += Number(row.correct || 0);
    existing.wrong += Number(row.wrong || 0);
    existing.flat += Number(row.flat || 0);
    existing.evaluated_directional_calls += Number(row.evaluated_directional_calls || 0);
    map.set(key, existing);
  });
  return map;
}

function compareGrouped(leftMap, rightMap) {
  if (leftMap.size !== rightMap.size) return false;
  for (const [key, leftValue] of leftMap.entries()) {
    const rightValue = rightMap.get(key);
    if (!rightValue) return false;
    if (
      leftValue.total_calls !== rightValue.total_calls
      || leftValue.correct !== rightValue.correct
      || leftValue.wrong !== rightValue.wrong
      || leftValue.flat !== rightValue.flat
      || leftValue.evaluated_directional_calls !== rightValue.evaluated_directional_calls
    ) {
      return false;
    }
  }
  return true;
}

function compareGroupedDirectionalOutcomes(leftMap, rightMap) {
  if (leftMap.size !== rightMap.size) return false;
  for (const [key, leftValue] of leftMap.entries()) {
    const rightValue = rightMap.get(key);
    if (!rightValue) return false;
    if (
      leftValue.correct !== rightValue.correct
      || leftValue.wrong !== rightValue.wrong
      || leftValue.flat !== rightValue.flat
      || leftValue.evaluated_directional_calls !== rightValue.evaluated_directional_calls
    ) {
      return false;
    }
  }
  return true;
}

function buildReconciliation(rows, strengthRows) {
  const bandRows = rows.filter((row) =>
    ["exact_market_direction", "market_band_both_directions", "pooled_layer_direction", "pooled_layer_band"].includes(row.scope_type)
  );
  const correctWrongChecksPass = bandRows.every((row) => Number(row.correct || 0) + Number(row.wrong || 0) === Number(row.evaluated_directional_calls || 0));
  const totalOutcomeChecksPass = bandRows.every((row) => Number(row.correct || 0) + Number(row.wrong || 0) + Number(row.flat || 0) <= Number(row.total_calls || 0));

  const combinedRows = rows.filter((row) => row.scope_type === "market_band_both_directions");
  const exactRows = rows.filter((row) => row.scope_type === "exact_market_direction");
  const pooledCombinedRows = rows.filter((row) => row.scope_type === "pooled_layer_band");
  const pooledDirectionalRows = rows.filter((row) => row.scope_type === "pooled_layer_direction");

  const exactGroupedForCombined = groupSum(exactRows, ["layer", "market_key", "confidence_band"]);
  const combinedGrouped = groupSum(combinedRows, ["layer", "market_key", "confidence_band"]);
  const combinedDirectionTotalsReconcile = compareGroupedDirectionalOutcomes(exactGroupedForCombined, combinedGrouped);

  const combinedGroupedForPooled = groupSum(combinedRows, ["layer", "confidence_band"]);
  const pooledGrouped = groupSum(pooledCombinedRows, ["layer", "confidence_band"]);
  const pooledBandTotalsReconcile = compareGrouped(combinedGroupedForPooled, pooledGrouped);

  const exactGroupedForPooledDirectional = groupSum(exactRows, ["layer", "direction", "confidence_band"]);
  const pooledDirectionalGrouped = groupSum(pooledDirectionalRows, ["layer", "direction", "confidence_band"]);
  const pooledDirectionalTotalsReconcile = compareGrouped(exactGroupedForPooledDirectional, pooledDirectionalGrouped);

  const strengthGrouped = groupSum(strengthRows.filter((row) => row.scope_type === "entity_strength_band"), ["layer", "market_key"]);
  const bandGroupedForStrength = groupSum(combinedRows, ["layer", "market_key"]);
  const strengthVsBandReconcile = compareGrouped(strengthGrouped, bandGroupedForStrength);

  return {
    correct_plus_wrong_equals_evaluated_directional_calls: correctWrongChecksPass,
    outcome_counts_do_not_exceed_total_calls: totalOutcomeChecksPass,
    market_direction_rows_reconcile_with_combined_direction_rows: combinedDirectionTotalsReconcile,
    market_rows_reconcile_with_pooled_layer_totals: pooledBandTotalsReconcile,
    directional_rows_reconcile_with_pooled_direction_totals: pooledDirectionalTotalsReconcile,
    strength_band_totals_reconcile_with_confidence_band_totals: strengthVsBandReconcile
  };
}

function buildConfidenceBandDeliveryArtifact(options = {}) {
  const calibration = options.calibrationPayload || readJson(options.calibrationPath);
  const generatedAt = new Date().toISOString();
  const coverage = createCoverage(calibration);

  const rows = [];
  const strengthRows = [];
  const noTradeRows = [];
  const asymmetryRows = [];

  const layerDefinitions = [
    {
      layer: "Layer 1",
      combinedScopeType: "market_band_both_directions",
      combinedReferenceLabel: "Market band, both directions",
      exactEntities: calibration.layer1?.assets || {},
      pooledEntity: calibration.layer1?.pooled || null,
      asymmetryDirections: ["BULLISH", "BEARISH"]
    },
    {
      layer: "Layer 2",
      combinedScopeType: "market_band_both_directions",
      combinedReferenceLabel: "Market band, both directions",
      exactEntities: calibration.layer2?.pairs || {},
      pooledEntity: calibration.layer2?.pooled || null,
      asymmetryDirections: ["BUY", "SELL"]
    }
  ];

  layerDefinitions.forEach((definition) => {
    const config = LAYER_CONFIG[definition.layer];
    Object.values(definition.exactEntities).forEach((entity) => {
      config.directionalValues.forEach((direction) => {
        ((entity.direction_bucket_rows || []).find((row) => row.direction === direction)?.bucket_rows || []).forEach((bucketRow) => {
          rows.push(createBandMetricRow({
            scopeType: "exact_market_direction",
            referenceLabel: "Exact market and direction",
            layer: definition.layer,
            entity,
            direction,
            bucketRow,
            generatedAt
          }));
        });
      });

      (entity.bucket_rows || []).forEach((bucketRow) => {
        rows.push(createBandMetricRow({
          scopeType: definition.combinedScopeType,
          referenceLabel: definition.combinedReferenceLabel,
          layer: definition.layer,
          entity,
          direction: config.combinedDirection,
          bucketRow,
          generatedAt
        }));
      });

      (entity.strength_band_rows || []).forEach((strengthRow) => {
        strengthRows.push(createStrengthRow({
          scopeType: "entity_strength_band",
          layer: definition.layer,
          entity,
          strengthRow,
          generatedAt
        }));
      });

      if (definition.layer === "Layer 2") {
        noTradeRows.push(createNoTradeRow(entity, generatedAt));
      }

      (entity.bucket_rows || []).forEach((combinedRow) => {
        asymmetryRows.push(createAsymmetryRow({
          layer: definition.layer,
          entity,
          bullishDirection: definition.asymmetryDirections[0],
          bearishDirection: definition.asymmetryDirections[1],
          combinedRow,
          generatedAt
        }));
      });
    });

    if (definition.pooledEntity) {
      config.directionalValues.forEach((direction) => {
        ((definition.pooledEntity.direction_bucket_rows || []).find((row) => row.direction === direction)?.bucket_rows || []).forEach((bucketRow) => {
          rows.push(createBandMetricRow({
            scopeType: "pooled_layer_direction",
            referenceLabel: config.directionalReferenceLabel,
            layer: definition.layer,
            entity: definition.pooledEntity,
            direction,
            bucketRow,
            generatedAt
          }));
        });
      });

      (definition.pooledEntity.bucket_rows || []).forEach((bucketRow) => {
        rows.push(createBandMetricRow({
          scopeType: "pooled_layer_band",
          referenceLabel: config.pooledReferenceLabel,
          layer: definition.layer,
          entity: definition.pooledEntity,
          direction: config.combinedDirection,
          bucketRow,
          generatedAt
        }));
      });

      (definition.pooledEntity.strength_band_rows || []).forEach((strengthRow) => {
        strengthRows.push(createStrengthRow({
          scopeType: "pooled_strength_band",
          layer: definition.layer,
          entity: definition.pooledEntity,
          strengthRow,
          generatedAt
        }));
      });
    }
  });

  const reconciliation = buildReconciliation(rows, strengthRows);

  return {
    generated_at: generatedAt,
    version: "confidence-band-delivery-v3",
    timeframe: calibration.timeframe || "following 24hrs",
    checker_contract: "locked following-24-hours checker contract",
    direction_mapping: calibration.definitions_contract?.direction_mapping || {},
    coverage,
    sample_size_thresholds: {
      very_limited_evidence: "evaluated directional calls 0-9",
      limited_evidence: "evaluated directional calls 10-29",
      reasonable_evidence: "evaluated directional calls 30-99",
      substantial_evidence: "evaluated directional calls 100+",
      insufficient_for_primary_emphasis: "evaluated directional calls under 30"
    },
    fallback_hierarchy: [
      "Exact market and direction",
      "Market band, both directions",
      "Pooled same-layer directional reference",
      "Pooled layer band reference",
      "Insufficient historical evidence"
    ],
    rows,
    strength_rows: strengthRows,
    no_trade_rows: noTradeRows,
    asymmetry_rows: asymmetryRows,
    reconciliation
  };
}

function writeConfidenceBandDeliveryArtifact(outputPath, options = {}) {
  const payload = buildConfidenceBandDeliveryArtifact(options);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

module.exports = {
  SAMPLE_SIZE_THRESHOLDS,
  buildConfidenceBandDeliveryArtifact,
  classifySampleSizeStatus,
  isInsufficientHistoricalSample,
  writeConfidenceBandDeliveryArtifact
};
