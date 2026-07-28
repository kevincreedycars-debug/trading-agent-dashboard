const fs = require("fs");

const SAMPLE_SIZE_THRESHOLDS = Object.freeze({
  very_low_max_directional_sample: 9,
  low_max_directional_sample: 29,
  moderate_max_directional_sample: 99
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function classifySampleSizeStatus(directionalSample) {
  const count = Number(directionalSample || 0);
  if (count <= SAMPLE_SIZE_THRESHOLDS.very_low_max_directional_sample) return "Very limited evidence";
  if (count <= SAMPLE_SIZE_THRESHOLDS.low_max_directional_sample) return "Limited evidence";
  if (count <= SAMPLE_SIZE_THRESHOLDS.moderate_max_directional_sample) return "Reasonable evidence";
  return "Substantial evidence";
}

function isInsufficientHistoricalSample(directionalSample) {
  return Number(directionalSample || 0) < 30;
}

function toBandContractRows(layerKey, entityCollection = {}, scopeType, referenceLabel) {
  return Object.values(entityCollection).flatMap((entity) =>
    (entity.bucket_rows || []).map((bucketRow) => {
      const directionalSample = Number(bucketRow.correct || 0) + Number(bucketRow.wrong || 0);
      const totalSample = Number(bucketRow.total_rows || 0);
      const outcomeSample = Number(bucketRow.correct || 0) + Number(bucketRow.wrong || 0) + Number(bucketRow.flat || 0);
      return {
        scope_type: scopeType,
        reference_label: referenceLabel,
        layer: layerKey,
        market: entity.entity_label,
        market_key: entity.entity_key,
        direction: "BOTH",
        confidence_band: bucketRow.bucket_label,
        confidence_band_min: Number(bucketRow.bucket_min_confidence_pct ?? 0),
        confidence_band_max: Number(bucketRow.bucket_max_confidence_pct ?? 0),
        correct: Number(bucketRow.correct || 0),
        wrong: Number(bucketRow.wrong || 0),
        flat: Number(bucketRow.flat || 0),
        directional_sample: directionalSample,
        total_sample: totalSample,
        ex_flat_win_rate: bucketRow.ex_flat_win_rate_pct,
        all_outcome_accuracy: outcomeSample ? Number(((Number(bucketRow.correct || 0) / outcomeSample) * 100).toFixed(1)) : null,
        flat_rate: outcomeSample ? Number(((Number(bucketRow.flat || 0) / outcomeSample) * 100).toFixed(1)) : null,
        mean_confidence: bucketRow.mean_confidence_pct,
        sample_size_status: classifySampleSizeStatus(directionalSample),
        insufficient_historical_sample: isInsufficientHistoricalSample(directionalSample),
        horizon: entity.timeframe,
        checker_contract: "locked following-24-hours checker contract",
        generated_at: null,
        source_note: entity.note || ""
      };
    })
  );
}

function toDirectionContractRows(layerKey, entityCollection = {}, scopeType, referenceLabel) {
  return Object.values(entityCollection).flatMap((entity) =>
    (entity.direction_bucket_rows || []).flatMap((directionRow) =>
      (directionRow.bucket_rows || []).map((bucketRow) => {
        const directionalSample = Number(bucketRow.correct || 0) + Number(bucketRow.wrong || 0);
        const totalSample = Number(bucketRow.total_rows || 0);
        const outcomeSample = Number(bucketRow.correct || 0) + Number(bucketRow.wrong || 0) + Number(bucketRow.flat || 0);
        return {
          scope_type: scopeType,
          reference_label: referenceLabel,
          layer: layerKey,
          market: entity.entity_label,
          market_key: entity.entity_key,
          direction: directionRow.direction || null,
          confidence_band: bucketRow.bucket_label,
          confidence_band_min: Number(bucketRow.bucket_min_confidence_pct ?? 0),
          confidence_band_max: Number(bucketRow.bucket_max_confidence_pct ?? 0),
          correct: Number(bucketRow.correct || 0),
          wrong: Number(bucketRow.wrong || 0),
          flat: Number(bucketRow.flat || 0),
          directional_sample: directionalSample,
          total_sample: totalSample,
          ex_flat_win_rate: bucketRow.ex_flat_win_rate_pct,
          all_outcome_accuracy: outcomeSample ? Number(((Number(bucketRow.correct || 0) / outcomeSample) * 100).toFixed(1)) : null,
          flat_rate: outcomeSample ? Number(((Number(bucketRow.flat || 0) / outcomeSample) * 100).toFixed(1)) : null,
          mean_confidence: bucketRow.mean_confidence_pct,
          sample_size_status: classifySampleSizeStatus(directionalSample),
          insufficient_historical_sample: isInsufficientHistoricalSample(directionalSample),
          horizon: entity.timeframe,
          checker_contract: "locked following-24-hours checker contract",
          generated_at: null,
          source_note: entity.note || ""
        };
      })
    )
  );
}

function buildConfidenceBandDeliveryArtifact(options = {}) {
  const calibration = options.calibrationPayload || readJson(options.calibrationPath);
  const generatedAt = new Date().toISOString();
  const rows = [
    ...toDirectionContractRows("Layer 1", calibration.layer1?.assets || {}, "exact_market_direction", "Exact market and direction"),
    ...toBandContractRows("Layer 1", calibration.layer1?.assets || {}, "market_band_both_directions", "Market band, both directions"),
    ...toDirectionContractRows("Layer 1", { pooled: calibration.layer1?.pooled || {} }, "pooled_layer_direction", "Pooled Layer 1 directional reference"),
    ...toBandContractRows("Layer 1", { pooled: calibration.layer1?.pooled || {} }, "pooled_layer_band", "Pooled Layer 1 reference"),
    ...toDirectionContractRows("Layer 2", calibration.layer2?.pairs || {}, "exact_market_direction", "Exact market and direction"),
    ...toBandContractRows("Layer 2", calibration.layer2?.pairs || {}, "market_band_both_directions", "Market band, both directions"),
    ...toDirectionContractRows("Layer 2", { pooled: calibration.layer2?.pooled || {} }, "pooled_layer_direction", "Pooled Layer 2 directional reference"),
    ...toBandContractRows("Layer 2", { pooled: calibration.layer2?.pooled || {} }, "pooled_layer_band", "Pooled Layer 2 reference")
  ].map((row) => ({
    ...row,
    generated_at: generatedAt
  }));

  return {
    generated_at: generatedAt,
    version: "confidence-band-delivery-v2",
    timeframe: calibration.timeframe || "following 24hrs",
    checker_contract: "locked following-24-hours checker contract",
    direction_mapping: calibration.definitions_contract?.direction_mapping || {},
    sample_size_thresholds: {
      very_limited_evidence: "directional sample 0-9",
      limited_evidence: "directional sample 10-29",
      reasonable_evidence: "directional sample 30-99",
      substantial_evidence: "directional sample 100+",
      insufficient_for_primary_emphasis: "directional sample under 30"
    },
    fallback_hierarchy: [
      "Exact market and direction",
      "Market band, both directions",
      "Pooled same-layer directional reference",
      "Pooled layer band reference",
      "Insufficient historical evidence"
    ],
    rows
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
