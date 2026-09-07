#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parseArgs } = require("../lib/historical_common");
const {
  buildRequiredDistanceInputs,
  bucketKeyFromConfidence,
  classifyDirectionalCallType,
  loadDailyOhlc,
  loadIntradayOhlc,
  normalizeHeadlineConfidence,
  normalizeLayer1Direction,
  reasonLabel,
  weekdayFromDate
} = require("../lib/adr_reach_research");
const {
  TARGET_MODES,
  confidenceBucketFromPct,
  evaluateTargetReach,
  roundNumber,
  summarizeDistribution,
  wilsonInterval
} = require("../lib/half_l2l_reach_research");
const {
  ASSET_CONFIGS,
  CHECKER_PATHS,
  PAIR_CONFIGS,
  buildLayer1AssetResearch,
  buildLayer2PairResearch,
  inRollingWindow,
  loadChecker,
  validateCheckerInvariants
} = require("./validate_adr_reach_research");

const OUTPUT_PATH = path.resolve(__dirname, "../../data/half-l2l-reach-research.json");
const REPO_ROOT = path.resolve(__dirname, "../..");
const FOLD_COUNT = 4;
const MIN_MONOTONIC_SAMPLE = 20;
const STRENGTH_ORDER = ["WEAK", "MODERATE", "STRONG", "VERY_STRONG"];
const MANUAL_SAMPLE_SEED = "half-l2l-manual-sample-20260809-v1";
const REVIEW_SAMPLE_PER_GROUP = 4;
const REVIEW_LAYER1_ASSETS = ["EUR", "GOLD", "NQ", "BTC"];
const REVIEW_LAYER2_PAIRS = ["EUR_USD", "XAU_USD", "NQ_USD", "BTC_USD"];
const MANUAL_REVIEW_GROUPS = [
  ...REVIEW_LAYER1_ASSETS.map((entityCode) => ({ layer: "LAYER_1", entityCode, layerLabel: "Layer 1" })),
  ...REVIEW_LAYER2_PAIRS.map((entityCode) => ({ layer: "LAYER_2", entityCode, layerLabel: "Layer 2" }))
];
const VALID_OUTCOME_COMBINATIONS = ["HIT/HIT", "HIT/MISS", "MISS/MISS"];
const MANUAL_REVIEW_RETAINED_ID_OVERRIDES = {
  "LAYER_1:EUR": [
    "layer_1-eur-5fad539bb898",
    "layer_1-eur-9a04ae804ce5",
    "layer_1-eur-34861f8fdac4",
    "layer_1-eur-a74dd137f489"
  ]
};

function relativeRepoPath(filePath) {
  if (!filePath) return null;
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}

function loadAssetContexts(config) {
  if (!config.dailySourcePath || !config.intradaySourcePath) {
    return null;
  }
  if (!fs.existsSync(config.dailySourcePath) || !fs.existsSync(config.intradaySourcePath)) {
    return null;
  }
  return {
    daily: loadDailyOhlc(config.dailySourcePath, {
      instrument: config.instrument,
      source: config.candleSourceLabel
    }),
    intraday: loadIntradayOhlc(config.intradaySourcePath, {
      instrument: config.instrument,
      source: config.candleSourceLabel
    })
  };
}

function hashFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  return {
    path: relativeRepoPath(filePath),
    sha256
  };
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value)));
}

function makeStableRecordId(row) {
  const rawId = [
    row.layer,
    row.entityCode,
    row.predictionId,
    row.snapshotDate,
    row.evaluationDate
  ].join("|");
  return `${String(row.layer || "").toLowerCase()}-${String(row.entityCode || "").toLowerCase()}-${shortHash(rawId)}`;
}

function yearFromDate(dateValue) {
  const value = String(dateValue || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 4) : null;
}

function monthFromDate(dateValue) {
  const value = String(dateValue || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : null;
}

function scoreStable(row, tag) {
  return shortHash(`${MANUAL_SAMPLE_SEED}|${tag}|${row.recordId}`);
}

function buildSourceCoverage(contexts) {
  if (!contexts) return null;
  return {
    daily: {
      startDate: contexts.daily.coverageStart,
      endDate: contexts.daily.coverageEnd,
      rowCount: contexts.daily.records.length,
      weekendRowCount: contexts.daily.weekendRowCount
    },
    intraday: {
      startDate: contexts.intraday.coverageStart,
      endDate: contexts.intraday.coverageEnd,
      sessionCount: contexts.intraday.sessionCount,
      candleCount: contexts.intraday.candleCount,
      weekendRowCount: contexts.intraday.weekendRowCount
    }
  };
}

function buildOutcomeSet(directionKey, requiredInputs) {
  const fullDistance = requiredInputs.requiredL2lDistance;
  return Object.fromEntries(TARGET_MODES.map((mode) => {
    const targetDistance = fullDistance * mode.multiplier;
    const evaluation = evaluateTargetReach(directionKey, requiredInputs.sessionCandles, targetDistance, {
      currentStandardDistance: fullDistance
    });
    return [mode.key, {
      modeKey: mode.key,
      modeLabel: mode.label,
      multiplierOfCurrentStandard: mode.multiplier,
      ...evaluation
    }];
  }));
}

function buildBaseRow(config, options) {
  return {
    layer: options.layer,
    entityCode: options.entityCode,
    entityLabel: options.entityLabel,
    targetAssetCode: options.targetAssetCode || null,
    predictionId: options.predictionId || null,
    snapshotDate: options.snapshotDate || null,
    evaluationDate: options.evaluationDate || null,
    rawCallDirection: options.rawCallDirection || null,
    callDirection: options.callDirection || null,
    directionalCallType: options.directionalCallType || null,
    confidencePct: Number.isFinite(options.confidencePct) ? roundNumber(options.confidencePct, 4) : null,
    strengthBucket: options.strengthBucket || null,
    exactConfidenceBucketKey: options.exactConfidenceBucketKey || null,
    exactConfidenceBucketLabel: options.exactConfidenceBucketLabel || null,
    weekdayKey: options.weekdayKey || null,
    evaluationYear: yearFromDate(options.evaluationDate),
    evaluationMonth: monthFromDate(options.evaluationDate),
    instrumentSymbol: options.instrumentSymbol || config.instrument || null,
    sourceVendor: config.sourceVendor || null,
    candleSourceLabel: config.candleSourceLabel || null,
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
  };
}

function finalizeRow(row) {
  return {
    ...row,
    recordId: makeStableRecordId(row)
  };
}

function buildLayer1Rows(config, checker, contexts, rollingWindowStart) {
  const rows = [];
  (Array.isArray(checker?.rows) ? checker.rows : []).forEach((checkerRow) => {
    const predictionId = checkerRow?.prediction_id || null;
    const snapshotDate = String(checkerRow?.snapshot_date || "").trim();
    const evaluationDate = String(checkerRow?.evaluation_inputs?.close_date || "").trim();
    if (!inRollingWindow(evaluationDate, rollingWindowStart)) {
      return;
    }

    const rawDirection = String(checkerRow?.stored?.direction || checkerRow?.checker?.direction || "").trim().toUpperCase();
    const directionKey = normalizeLayer1Direction(rawDirection);
    const directionalCallType = classifyDirectionalCallType(rawDirection);
    const confidencePct = normalizeHeadlineConfidence(checkerRow);
    const strengthBucket = bucketKeyFromConfidence(confidencePct);
    const exactBucket = confidenceBucketFromPct(confidencePct);
    const weekdayKey = weekdayFromDate(evaluationDate);
    const baseRow = buildBaseRow(config, {
      layer: "LAYER_1",
      entityCode: config.assetCode,
      entityLabel: config.assetLabel,
      predictionId,
      snapshotDate,
      evaluationDate,
      rawCallDirection: rawDirection,
      callDirection: directionKey,
      directionalCallType,
      confidencePct,
      strengthBucket,
      exactConfidenceBucketKey: exactBucket?.key || null,
      exactConfidenceBucketLabel: exactBucket?.label || null,
      weekdayKey
    });

    if (!directionKey) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "EXCLUDED",
        statusReasonKey: "no_trade_or_non_directional_rows",
        statusReason: reasonLabel("no_trade_or_non_directional_rows"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    if (!evaluationDate || !weekdayKey) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "UNRESOLVED_MISSING_DATA",
        statusReasonKey: "missing_evaluation_date",
        statusReason: reasonLabel("missing_evaluation_date"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    if (!strengthBucket || !exactBucket) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "UNRESOLVED_MISSING_DATA",
        statusReasonKey: "missing_confidence_bucket",
        statusReason: reasonLabel("missing_confidence_bucket"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    const requiredInputs = buildRequiredDistanceInputs(config, contexts.daily, contexts.intraday, evaluationDate);
    if (!requiredInputs.ok) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "UNRESOLVED_MISSING_DATA",
        statusReasonKey: requiredInputs.reason || "missing_input_data",
        statusReason: reasonLabel(requiredInputs.reason),
        numberOf1hCandlesLoaded: Number(requiredInputs.numberOf1hCandlesLoaded || 0),
        evaluationStartTime: requiredInputs.evaluationStartTime || null,
        evaluationEndTime: requiredInputs.evaluationEndTime || null,
        adr20: Number.isFinite(requiredInputs.adr20) ? roundNumber(requiredInputs.adr20) : null,
        currentStandardL2lDistance: Number.isFinite(requiredInputs.requiredL2lDistance) ? roundNumber(requiredInputs.requiredL2lDistance) : null,
        halfL2lDistance: Number.isFinite(requiredInputs.requiredL2lDistance) ? roundNumber(requiredInputs.requiredL2lDistance * 0.5) : null,
        adr20WindowStartDate: requiredInputs.adr20WindowStartDate || null,
        adr20WindowEndDate: requiredInputs.adr20WindowEndDate || null,
        outcomes: null
      }));
      return;
    }

    rows.push(finalizeRow({
      ...baseRow,
      status: "ELIGIBLE",
      statusReasonKey: null,
      statusReason: null,
      numberOf1hCandlesLoaded: requiredInputs.numberOf1hCandlesLoaded,
      evaluationStartTime: requiredInputs.evaluationStartTime || null,
      evaluationEndTime: requiredInputs.evaluationEndTime || null,
      adr20: roundNumber(requiredInputs.adr20),
      currentStandardL2lDistance: roundNumber(requiredInputs.requiredL2lDistance),
      halfL2lDistance: roundNumber(requiredInputs.requiredL2lDistance * 0.5),
      adr20WindowStartDate: requiredInputs.adr20WindowStartDate,
      adr20WindowEndDate: requiredInputs.adr20WindowEndDate,
      outcomes: buildOutcomeSet(directionKey, requiredInputs)
    }));
  });
  return rows;
}

function buildLayer2Rows(pairConfig, targetRows, checkers, rollingWindowStart) {
  const usdRowsByDate = new Map((Array.isArray(checkers.USD?.rows) ? checkers.USD.rows : []).map((row) => [String(row?.snapshot_date || "").trim(), row]));
  const targetRowsByPredictionId = new Map(targetRows.map((row) => [row.predictionId, row]));
  const rows = [];

  (Array.isArray(checkers[pairConfig.targetAssetCode]?.rows) ? checkers[pairConfig.targetAssetCode].rows : []).forEach((targetCheckerRow) => {
    const predictionId = targetCheckerRow?.prediction_id || null;
    const snapshotDate = String(targetCheckerRow?.snapshot_date || "").trim();
    const evaluationDate = String(targetCheckerRow?.evaluation_inputs?.close_date || "").trim();
    if (!inRollingWindow(evaluationDate, rollingWindowStart)) {
      return;
    }

    const usdRow = usdRowsByDate.get(snapshotDate) || null;
    const targetRow = targetRowsByPredictionId.get(predictionId) || null;
    const targetRawDirection = String(targetCheckerRow?.stored?.direction || targetCheckerRow?.checker?.direction || "").trim().toUpperCase();
    const usdRawDirection = String(usdRow?.stored?.direction || usdRow?.checker?.direction || "").trim().toUpperCase();
    const targetDirection = normalizeLayer1Direction(targetRawDirection);
    const usdDirection = normalizeLayer1Direction(usdRawDirection);
    const directionalCallType = classifyDirectionalCallType(targetRawDirection);
    const targetConfidence = normalizeHeadlineConfidence(targetCheckerRow);
    const usdConfidence = normalizeHeadlineConfidence(usdRow);
    const combinedConfidencePct = Number.isFinite(targetConfidence) && Number.isFinite(usdConfidence)
      ? Math.min(targetConfidence, usdConfidence)
      : null;
    const strengthBucket = bucketKeyFromConfidence(combinedConfidencePct);
    const exactBucket = confidenceBucketFromPct(combinedConfidencePct);
    const weekdayKey = weekdayFromDate(evaluationDate);

    const baseRow = {
      ...buildBaseRow({
        ...pairConfig,
        sourceVendor: targetRow?.sourceVendor || null,
        candleSourceLabel: targetRow?.candleSourceLabel || null,
        instrument: targetRow?.instrumentSymbol || null,
        fixedReferenceL2lDistance: pairConfig.fixedReferenceL2lDistance
      }, {
        layer: "LAYER_2",
        entityCode: pairConfig.pairCode,
        entityLabel: pairConfig.pairLabel,
        targetAssetCode: pairConfig.targetAssetCode,
        predictionId,
        snapshotDate,
        evaluationDate,
        rawCallDirection: targetRawDirection,
        callDirection: targetDirection,
        directionalCallType,
        confidencePct: combinedConfidencePct,
        strengthBucket,
        exactConfidenceBucketKey: exactBucket?.key || null,
        exactConfidenceBucketLabel: exactBucket?.label || null,
        weekdayKey
      }),
      usdDirection: usdDirection || null,
      usdRawDirection: usdRawDirection || null
    };

    if (!usdRow) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "UNRESOLVED_MISSING_DATA",
        statusReasonKey: "missing_usd_snapshot",
        statusReason: reasonLabel("missing_usd_snapshot"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    if (!targetDirection || !usdDirection || targetDirection === usdDirection) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "EXCLUDED",
        statusReasonKey: "no_trade_or_non_directional_rows",
        statusReason: reasonLabel("no_trade_or_non_directional_rows"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    if (!strengthBucket || !exactBucket) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "UNRESOLVED_MISSING_DATA",
        statusReasonKey: "missing_combined_confidence",
        statusReason: reasonLabel("missing_combined_confidence"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    if (!targetRow) {
      rows.push(finalizeRow({
        ...baseRow,
        status: "UNRESOLVED_MISSING_DATA",
        statusReasonKey: "missing_target_asset_row",
        statusReason: reasonLabel("missing_target_asset_row"),
        evaluationStartTime: null,
        evaluationEndTime: null,
        outcomes: null
      }));
      return;
    }

    if (targetRow.status !== "ELIGIBLE") {
      rows.push(finalizeRow({
        ...baseRow,
        status: targetRow.status,
        statusReasonKey: targetRow.statusReasonKey,
        statusReason: targetRow.statusReason,
        numberOf1hCandlesLoaded: targetRow.numberOf1hCandlesLoaded || 0,
        evaluationStartTime: targetRow.evaluationStartTime || null,
        evaluationEndTime: targetRow.evaluationEndTime || null,
        adr20: targetRow.adr20 || null,
        currentStandardL2lDistance: targetRow.currentStandardL2lDistance || null,
        halfL2lDistance: targetRow.halfL2lDistance || null,
        adr20WindowStartDate: targetRow.adr20WindowStartDate || null,
        adr20WindowEndDate: targetRow.adr20WindowEndDate || null,
        outcomes: null
      }));
      return;
    }

    rows.push(finalizeRow({
      ...baseRow,
      status: "ELIGIBLE",
      statusReasonKey: null,
      statusReason: null,
      numberOf1hCandlesLoaded: targetRow.numberOf1hCandlesLoaded,
      evaluationStartTime: targetRow.evaluationStartTime || null,
      evaluationEndTime: targetRow.evaluationEndTime || null,
      adr20: targetRow.adr20,
      currentStandardL2lDistance: targetRow.currentStandardL2lDistance,
      halfL2lDistance: targetRow.halfL2lDistance,
      adr20WindowStartDate: targetRow.adr20WindowStartDate,
      adr20WindowEndDate: targetRow.adr20WindowEndDate,
      outcomes: targetRow.outcomes
    }));
  });

  return rows;
}

function sortRowsChronologically(rows) {
  return rows.slice().sort((left, right) => {
    const leftKey = `${left.evaluationDate || ""}|${left.snapshotDate || ""}|${left.predictionId || ""}`;
    const rightKey = `${right.evaluationDate || ""}|${right.snapshotDate || ""}|${right.predictionId || ""}`;
    return leftKey.localeCompare(rightKey);
  });
}

function minDate(rows) {
  const values = rows.map((row) => row.evaluationDate).filter(Boolean).sort();
  return values[0] || null;
}

function maxDate(rows) {
  const values = rows.map((row) => row.evaluationDate).filter(Boolean).sort();
  return values[values.length - 1] || null;
}

function summarizeModeRows(rows, modeKey) {
  const eligibleRows = rows.filter((row) => row.status === "ELIGIBLE" && row.outcomes?.[modeKey] && (row.outcomes[modeKey].outcome === "HIT" || row.outcomes[modeKey].outcome === "MISS"));
  const hits = eligibleRows.filter((row) => row.outcomes[modeKey].outcome === "HIT").length;
  const misses = eligibleRows.filter((row) => row.outcomes[modeKey].outcome === "MISS").length;
  const totalEligible = hits + misses;
  const unresolved = rows.filter((row) => row.status === "UNRESOLVED_MISSING_DATA").length;
  const excluded = rows.filter((row) => row.status === "EXCLUDED").length;
  const hitRatePct = totalEligible ? roundNumber((hits / totalEligible) * 100, 1) : null;
  const intervals = wilsonInterval(hits, totalEligible);
  const hitRows = eligibleRows.filter((row) => row.outcomes[modeKey].outcome === "HIT");

  return {
    targetModeKey: modeKey,
    eligibleCalls: totalEligible,
    hits,
    misses,
    unresolvedRows: unresolved,
    exclusions: excluded,
    hitRatePct,
    wilson95LowPct: intervals.lowPct,
    wilson95HighPct: intervals.highPct,
    dataCoveragePct: rows.length ? roundNumber((totalEligible / rows.length) * 100, 1) : null,
    medianTimeToTargetHours: summarizeDistribution(hitRows.map((row) => row.outcomes[modeKey].timeToTargetHours)).median,
    maxFavourableDistanceDistribution: summarizeDistribution(eligibleRows.map((row) => row.outcomes[modeKey].maxFavourableDistance)),
    maxFavourableRatioDistribution: summarizeDistribution(eligibleRows.map((row) => row.outcomes[modeKey].maxFavourableDistanceRatioToCurrentStandard)),
    maxAdverseExcursionSupported: false,
    maxAdverseExcursionDistribution: null,
    adverseBoundarySequenceSupported: false
  };
}

function buildComparisonRow(groupRowMeta, rows) {
  const full = summarizeModeRows(rows, "FULL_STANDARD");
  const half = summarizeModeRows(rows, "HALF_OF_STANDARD");
  return {
    ...groupRowMeta,
    fullStandard: full,
    halfOfStandard: half,
    halfMinusFullPctPoints: Number.isFinite(half.hitRatePct) && Number.isFinite(full.hitRatePct)
      ? roundNumber(half.hitRatePct - full.hitRatePct, 1)
      : null
  };
}

function groupRows(rows, keyBuilder) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = keyBuilder(row);
    const existing = grouped.get(key) || [];
    existing.push(row);
    grouped.set(key, existing);
  });
  return grouped;
}

function buildChronologicalFoldRows(rows, metaBuilder) {
  const eligible = sortRowsChronologically(rows.filter((row) => row.status === "ELIGIBLE"));
  if (!eligible.length) return [];
  const foldSize = Math.ceil(eligible.length / FOLD_COUNT);
  const output = [];
  for (let index = 0; index < FOLD_COUNT; index += 1) {
    const slice = eligible.slice(index * foldSize, (index + 1) * foldSize);
    if (!slice.length) continue;
    output.push(buildComparisonRow({
      ...metaBuilder(slice),
      foldKey: `FOLD_${index + 1}`,
      foldIndex: index + 1,
      foldStartDate: slice[0].evaluationDate || null,
      foldEndDate: slice[slice.length - 1].evaluationDate || null
    }, slice));
  }
  return output;
}

function buildMonotonicityReport(layerLabel, rows) {
  const eligible = rows.filter((row) => row.status === "ELIGIBLE");
  const strengthRows = STRENGTH_ORDER.map((bucketKey) => {
    const bucketRows = eligible.filter((row) => row.strengthBucket === bucketKey);
    return {
      bucketKey,
      ...summarizeModeRows(bucketRows, "HALF_OF_STANDARD")
    };
  }).filter((row) => row.eligibleCalls >= MIN_MONOTONIC_SAMPLE);

  const violations = [];
  for (let index = 1; index < strengthRows.length; index += 1) {
    if ((strengthRows[index].hitRatePct ?? -Infinity) < (strengthRows[index - 1].hitRatePct ?? -Infinity)) {
      violations.push({
        fromBucket: strengthRows[index - 1].bucketKey,
        toBucket: strengthRows[index].bucketKey,
        fromRatePct: strengthRows[index - 1].hitRatePct,
        toRatePct: strengthRows[index].hitRatePct
      });
    }
  }

  return {
    layerLabel,
    targetModeKey: "HALF_OF_STANDARD",
    minimumSampleForCheck: MIN_MONOTONIC_SAMPLE,
    checkedBuckets: strengthRows.map((row) => ({
      bucketKey: row.bucketKey,
      eligibleCalls: row.eligibleCalls,
      hitRatePct: row.hitRatePct,
      wilson95LowPct: row.wilson95LowPct,
      wilson95HighPct: row.wilson95HighPct
    })),
    monotonicNonDecreasing: violations.length === 0,
    violations
  };
}

function manualOutcomeCombination(row) {
  return `${row?.outcomes?.HALF_OF_STANDARD?.outcome || "N/A"}/${row?.outcomes?.FULL_STANDARD?.outcome || "N/A"}`;
}

function findManualSampleCandidate(rows, selectedIds, options = {}) {
  const filtered = rows.filter((row) => {
    if (selectedIds.has(row.recordId)) return false;
    if (options.callDirection && row.callDirection !== options.callDirection) return false;
    if (options.requireHalfOutcome && row.outcomes?.HALF_OF_STANDARD?.outcome !== options.requireHalfOutcome) return false;
    if (options.requireFullOutcome && row.outcomes?.FULL_STANDARD?.outcome !== options.requireFullOutcome) return false;
    if (options.requireHalfHitFullMiss && !(row.outcomes?.HALF_OF_STANDARD?.outcome === "HIT" && row.outcomes?.FULL_STANDARD?.outcome === "MISS")) return false;
    if (options.foldIndex && row.chronologicalFoldIndex !== options.foldIndex) return false;
    return true;
  });
  if (!filtered.length) return null;

  const sorted = filtered.slice().sort((left, right) => {
    const leftMargin = Math.abs(Number(left.outcomes?.HALF_OF_STANDARD?.bestMargin ?? Infinity));
    const rightMargin = Math.abs(Number(right.outcomes?.HALF_OF_STANDARD?.bestMargin ?? Infinity));
    const marginCompare = options.preferCloseThreshold ? leftMargin - rightMargin : 0;
    if (marginCompare !== 0) return marginCompare;

    const leftTime = Number(left.outcomes?.FULL_STANDARD?.timeToTargetHours ?? left.outcomes?.HALF_OF_STANDARD?.timeToTargetHours ?? Infinity);
    const rightTime = Number(right.outcomes?.FULL_STANDARD?.timeToTargetHours ?? right.outcomes?.HALF_OF_STANDARD?.timeToTargetHours ?? Infinity);
    if (options.preferFast && leftTime !== rightTime) return leftTime - rightTime;
    if (options.preferSlow && leftTime !== rightTime) return rightTime - leftTime;

    return scoreStable(left, options.tag || "").localeCompare(scoreStable(right, options.tag || ""));
  });
  return sorted[0] || null;
}

function compareManualSampleRows(left, right) {
  const leftDate = String(left?.evaluationDate || "");
  const rightDate = String(right?.evaluationDate || "");
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return String(left?.recordId || "").localeCompare(String(right?.recordId || ""));
}

function buildLegacyManualSampleForGroup(rows, entityKey, layerLabel) {
  const eligible = sortRowsChronologically(rows.filter((row) => row.status === "ELIGIBLE"));
  const selected = [];
  const selectedIds = new Set();
  const pushSelected = (row, slot, reason) => {
    if (!row || selectedIds.has(row.recordId) || selected.length >= 8) return;
    selected.push({
      ...row,
      manualSampleSlot: slot,
      manualSampleReason: reason
    });
    selectedIds.add(row.recordId);
  };

  const slots = [
    { slot: "bullish_half_miss", reason: "Deliberate half-L2L miss inclusion", options: { callDirection: "BULLISH", requireHalfOutcome: "MISS", preferCloseThreshold: true, tag: `${entityKey}|bullish_half_miss` } },
    { slot: "bearish_half_miss", reason: "Deliberate half-L2L miss inclusion", options: { callDirection: "BEARISH", requireHalfOutcome: "MISS", preferCloseThreshold: true, tag: `${entityKey}|bearish_half_miss` } },
    { slot: "bullish_half_hit_full_miss", reason: "Half-hit / full-miss contrast", options: { callDirection: "BULLISH", requireHalfHitFullMiss: true, preferCloseThreshold: true, tag: `${entityKey}|bullish_half_hit_full_miss` } },
    { slot: "bearish_half_hit_full_miss", reason: "Half-hit / full-miss contrast", options: { callDirection: "BEARISH", requireHalfHitFullMiss: true, preferCloseThreshold: true, tag: `${entityKey}|bearish_half_hit_full_miss` } },
    { slot: "bullish_full_hit_fast", reason: "Fast full-L2L completion", options: { callDirection: "BULLISH", requireFullOutcome: "HIT", preferFast: true, tag: `${entityKey}|bullish_full_hit_fast` } },
    { slot: "bearish_full_hit_fast", reason: "Fast full-L2L completion", options: { callDirection: "BEARISH", requireFullOutcome: "HIT", preferFast: true, tag: `${entityKey}|bearish_full_hit_fast` } },
    { slot: "early_fold", reason: "Early chronological fold coverage", options: { foldIndex: 1, preferCloseThreshold: true, tag: `${entityKey}|early_fold` } },
    { slot: "late_fold", reason: "Late chronological fold coverage", options: { foldIndex: FOLD_COUNT, preferSlow: true, tag: `${entityKey}|late_fold` } }
  ];

  for (const spec of slots) {
    const candidate = findManualSampleCandidate(eligible, selectedIds, spec.options)
      || findManualSampleCandidate(eligible, selectedIds, { callDirection: spec.options.callDirection, tag: `${spec.slot}|fallback_direction` })
      || findManualSampleCandidate(eligible, selectedIds, { tag: `${spec.slot}|fallback_any` });
    if (candidate) {
      pushSelected(candidate, spec.slot, candidate.manualSampleReason || spec.reason);
    }
  }

  const rankedFallback = eligible
    .filter((row) => !selectedIds.has(row.recordId))
    .sort((left, right) => scoreStable(left, `${entityKey}|fallback`).localeCompare(scoreStable(right, `${entityKey}|fallback`)));
  for (const row of rankedFallback) {
    if (selected.length >= 8) break;
    pushSelected(row, "fallback", "Deterministic fallback because a requested category was unavailable for this entity");
  }

  return selected
    .sort(compareManualSampleRows)
    .map((row, index) => ({
      ...row,
      manualSampleIndex: index + 1,
      manualSampleSeed: MANUAL_SAMPLE_SEED,
      manualSampleLayerLabel: layerLabel,
      manualOutcomeCombination: manualOutcomeCombination(row)
    }));
}

function buildManualSampleFromLegacyEight(rows, entityKey, layerLabel) {
  const eligible = sortRowsChronologically(rows.filter((row) => row.status === "ELIGIBLE"));
  const legacyEight = eligible.slice(0, 8);
  const groupLayer = legacyEight[0]?.layer || (layerLabel === "Layer 1" ? "LAYER_1" : "LAYER_2");
  const groupKey = `${groupLayer}:${entityKey}`;
  const selected = [];
  const selectedIds = new Set();
  const pushSelected = (row, slot, reason) => {
    if (!row || selectedIds.has(row.recordId) || selected.length >= REVIEW_SAMPLE_PER_GROUP) return;
    selected.push({
      ...row,
      manualSampleSlot: slot,
      manualSampleReason: reason
    });
    selectedIds.add(row.recordId);
  };

  const retainedOverrideIds = MANUAL_REVIEW_RETAINED_ID_OVERRIDES[groupKey] || null;
  const canApplyRetainedOverride = Array.isArray(retainedOverrideIds) && retainedOverrideIds.every((recordId) => legacyEight.some((row) => row.recordId === recordId));
  if (canApplyRetainedOverride) {
    retainedOverrideIds.forEach((recordId, index) => {
      const candidate = legacyEight.find((row) => row.recordId === recordId) || null;
      pushSelected(
        candidate,
        `authoritative_review_${index + 1}`,
        "Explicitly retained because this stable record ID already carries authoritative completed manual review state"
      );
    });
  } else {
    VALID_OUTCOME_COMBINATIONS.forEach((comboKey) => {
      const candidate = legacyEight
        .filter((row) => !selectedIds.has(row.recordId) && manualOutcomeCombination(row) === comboKey)
        .sort(compareManualSampleRows)[0] || null;
      if (candidate) {
        pushSelected(candidate, `combination_${comboKey.toLowerCase().replace("/", "_")}`, `Oldest retained ${comboKey} example from the legacy eight-row manual sample`);
      }
    });

    legacyEight
      .filter((row) => !selectedIds.has(row.recordId))
      .sort(compareManualSampleRows)
      .forEach((row) => {
        if (selected.length >= REVIEW_SAMPLE_PER_GROUP) return;
        pushSelected(row, "deterministic_fallback", "Oldest remaining legacy sample row because only three valid half/full outcome classes are possible under the current contract");
      });
  }

  return selected
    .sort(compareManualSampleRows)
    .slice(0, REVIEW_SAMPLE_PER_GROUP)
    .map((row, index) => ({
    ...row,
    manualSampleIndex: index + 1,
    manualSampleSeed: MANUAL_SAMPLE_SEED,
    manualSampleLayerLabel: layerLabel,
    manualOutcomeCombination: manualOutcomeCombination(row)
  }));
}

function getManualReviewGroupKey(group = {}) {
  return `${group.layer}:${group.entityCode}`;
}

function getManualReviewGroupSelectionRule(groupKey) {
  if (MANUAL_REVIEW_RETAINED_ID_OVERRIDES[groupKey]) {
    return "This group is pinned to the authoritative previously reviewed stable record IDs. Their existing verdicts, notes, evidence, and review timestamps must remain attached to those exact IDs.";
  }
  return "Select only from this entity's existing legacy eight-row manual sample. MISS/HIT is impossible because any full-target hit necessarily implies the half target was reached first. Retain the oldest eligible row for each valid class (HIT/HIT, HIT/MISS, MISS/MISS) by call date ascending and then stable record ID, then fill the fourth slot with the oldest remaining legacy sample row.";
}

function annotateChronologicalFoldIndex(rows) {
  const normalizedRows = rows.map((row) => row.recordId ? row : finalizeRow(row));
  const eligible = sortRowsChronologically(normalizedRows.filter((row) => row.status === "ELIGIBLE"));
  const foldSize = Math.ceil(eligible.length / FOLD_COUNT);
  const foldByRecordId = new Map();
  for (let index = 0; index < eligible.length; index += 1) {
    foldByRecordId.set(eligible[index].recordId, Math.min(FOLD_COUNT, Math.floor(index / foldSize) + 1));
  }
  return normalizedRows.map((row) => ({
    ...row,
    chronologicalFoldIndex: foldByRecordId.get(row.recordId) || null,
    chronologicalFoldKey: foldByRecordId.get(row.recordId) ? `FOLD_${foldByRecordId.get(row.recordId)}` : null
  }));
}

function buildOutput(sourceAudit, layer1Rows, layer2Rows) {
  const annotatedLayer1Rows = annotateChronologicalFoldIndex(layer1Rows);
  const annotatedLayer2Rows = annotateChronologicalFoldIndex(layer2Rows);
  const allRows = [...annotatedLayer1Rows, ...annotatedLayer2Rows];
  const layer1Assets = Array.from(groupRows(layer1Rows, (row) => row.entityCode).entries()).map(([assetCode, rows]) => buildComparisonRow({
    assetCode,
    assetLabel: rows[0]?.entityLabel || assetCode,
    available: rows.some((row) => row.status === "ELIGIBLE")
  }, rows));
  const layer2Pairs = Array.from(groupRows(layer2Rows, (row) => row.entityCode).entries()).map(([pairCode, rows]) => buildComparisonRow({
    pairCode,
    pairLabel: rows[0]?.entityLabel || pairCode,
    targetAssetCode: rows[0]?.targetAssetCode || null,
    available: rows.some((row) => row.status === "ELIGIBLE")
  }, rows));

  const layer1DirectionRows = Array.from(groupRows(annotatedLayer1Rows.filter((row) => row.callDirection), (row) => `${row.entityCode}|${row.callDirection}`).entries()).map(([key, rows]) => {
    const [assetCode, callDirection] = key.split("|");
    return buildComparisonRow({
      assetCode,
      assetLabel: rows[0]?.entityLabel || assetCode,
      callDirection
    }, rows);
  });
  const layer2DirectionRows = Array.from(groupRows(annotatedLayer2Rows.filter((row) => row.callDirection), (row) => `${row.entityCode}|${row.callDirection}`).entries()).map(([key, rows]) => {
    const [pairCode, callDirection] = key.split("|");
    return buildComparisonRow({
      pairCode,
      pairLabel: rows[0]?.entityLabel || pairCode,
      callDirection
    }, rows);
  });
  const layer1StrengthRows = Array.from(groupRows(annotatedLayer1Rows.filter((row) => row.strengthBucket), (row) => `${row.entityCode}|${row.strengthBucket}`).entries()).map(([key, rows]) => {
    const [assetCode, strengthBucket] = key.split("|");
    return buildComparisonRow({
      assetCode,
      assetLabel: rows[0]?.entityLabel || assetCode,
      strengthBucket
    }, rows);
  });
  const layer2StrengthRows = Array.from(groupRows(annotatedLayer2Rows.filter((row) => row.strengthBucket), (row) => `${row.entityCode}|${row.strengthBucket}`).entries()).map(([key, rows]) => {
    const [pairCode, strengthBucket] = key.split("|");
    return buildComparisonRow({
      pairCode,
      pairLabel: rows[0]?.entityLabel || pairCode,
      strengthBucket
    }, rows);
  });
  const layer1ExactConfidenceRows = Array.from(groupRows(annotatedLayer1Rows.filter((row) => row.exactConfidenceBucketKey), (row) => `${row.entityCode}|${row.exactConfidenceBucketKey}`).entries()).map(([key, rows]) => {
    const [assetCode, exactConfidenceBucketKey] = key.split("|");
    return buildComparisonRow({
      assetCode,
      assetLabel: rows[0]?.entityLabel || assetCode,
      exactConfidenceBucketKey,
      exactConfidenceBucketLabel: rows[0]?.exactConfidenceBucketLabel || null
    }, rows);
  });
  const layer2ExactConfidenceRows = Array.from(groupRows(annotatedLayer2Rows.filter((row) => row.exactConfidenceBucketKey), (row) => `${row.entityCode}|${row.exactConfidenceBucketKey}`).entries()).map(([key, rows]) => {
    const [pairCode, exactConfidenceBucketKey] = key.split("|");
    return buildComparisonRow({
      pairCode,
      pairLabel: rows[0]?.entityLabel || pairCode,
      exactConfidenceBucketKey,
      exactConfidenceBucketLabel: rows[0]?.exactConfidenceBucketLabel || null
    }, rows);
  });
  const layer1WeekdayRows = Array.from(groupRows(annotatedLayer1Rows.filter((row) => row.weekdayKey), (row) => `${row.entityCode}|${row.weekdayKey}`).entries()).map(([key, rows]) => {
    const [assetCode, weekdayKey] = key.split("|");
    return buildComparisonRow({
      assetCode,
      assetLabel: rows[0]?.entityLabel || assetCode,
      weekdayKey
    }, rows);
  });
  const layer2WeekdayRows = Array.from(groupRows(annotatedLayer2Rows.filter((row) => row.weekdayKey), (row) => `${row.entityCode}|${row.weekdayKey}`).entries()).map(([key, rows]) => {
    const [pairCode, weekdayKey] = key.split("|");
    return buildComparisonRow({
      pairCode,
      pairLabel: rows[0]?.entityLabel || pairCode,
      weekdayKey
    }, rows);
  });
  const layer1YearRows = Array.from(groupRows(annotatedLayer1Rows.filter((row) => row.evaluationYear), (row) => `${row.entityCode}|${row.evaluationYear}`).entries()).map(([key, rows]) => {
    const [assetCode, evaluationYear] = key.split("|");
    return buildComparisonRow({
      assetCode,
      assetLabel: rows[0]?.entityLabel || assetCode,
      evaluationYear
    }, rows);
  });
  const layer2YearRows = Array.from(groupRows(annotatedLayer2Rows.filter((row) => row.evaluationYear), (row) => `${row.entityCode}|${row.evaluationYear}`).entries()).map(([key, rows]) => {
    const [pairCode, evaluationYear] = key.split("|");
    return buildComparisonRow({
      pairCode,
      pairLabel: rows[0]?.entityLabel || pairCode,
      evaluationYear
    }, rows);
  });
  const layer1MonthRows = Array.from(groupRows(annotatedLayer1Rows.filter((row) => row.evaluationMonth), (row) => `${row.entityCode}|${row.evaluationMonth}`).entries()).map(([key, rows]) => {
    const [assetCode, evaluationMonth] = key.split("|");
    return buildComparisonRow({
      assetCode,
      assetLabel: rows[0]?.entityLabel || assetCode,
      evaluationMonth
    }, rows);
  });
  const layer2MonthRows = Array.from(groupRows(annotatedLayer2Rows.filter((row) => row.evaluationMonth), (row) => `${row.entityCode}|${row.evaluationMonth}`).entries()).map(([key, rows]) => {
    const [pairCode, evaluationMonth] = key.split("|");
    return buildComparisonRow({
      pairCode,
      pairLabel: rows[0]?.entityLabel || pairCode,
      evaluationMonth
    }, rows);
  });
  const layer1FoldRows = layer1Assets.flatMap((assetRow) => buildChronologicalFoldRows(
    annotatedLayer1Rows.filter((row) => row.entityCode === assetRow.assetCode),
    () => ({ assetCode: assetRow.assetCode, assetLabel: assetRow.assetLabel })
  ));
  const layer2FoldRows = layer2Pairs.flatMap((pairRow) => buildChronologicalFoldRows(
    annotatedLayer2Rows.filter((row) => row.entityCode === pairRow.pairCode),
    () => ({ pairCode: pairRow.pairCode, pairLabel: pairRow.pairLabel })
  ));
  const sampleGroups = MANUAL_REVIEW_GROUPS.map((group) => {
    const sourceRows = group.layer === "LAYER_1" ? annotatedLayer1Rows : annotatedLayer2Rows;
    const legacyEightRows = buildLegacyManualSampleForGroup(
      sourceRows.filter((row) => row.entityCode === group.entityCode),
      group.entityCode,
      group.layerLabel
    );
    const sampleRows = buildManualSampleFromLegacyEight(
      legacyEightRows,
      group.entityCode,
      group.layerLabel
    );
    const comboCounts = sampleRows.reduce((acc, row) => {
      const key = manualOutcomeCombination(row);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      layer: group.layer,
      layerLabel: group.layerLabel,
      entityCode: group.entityCode,
      entityLabel: sampleRows[0]?.entityLabel || group.entityCode,
      sampleSize: sampleRows.length,
      availableOutcomeCombinations: uniqueStrings(legacyEightRows.map((row) => manualOutcomeCombination(row))).sort(),
      validOutcomeCombinations: VALID_OUTCOME_COMBINATIONS,
      selectedOutcomeCombinationCounts: comboCounts,
      selectionRule: getManualReviewGroupSelectionRule(getManualReviewGroupKey(group)),
      sampleRows
    };
  });
  const layer1Sample = sampleGroups.filter((group) => group.layer === "LAYER_1").flatMap((group) => group.sampleRows);
  const layer2Sample = sampleGroups.filter((group) => group.layer === "LAYER_2").flatMap((group) => group.sampleRows);
  const sourceIdentity = sourceAudit.map((row) => ({
    assetCode: row.assetCode,
    assetLabel: row.assetLabel,
    instrument: row.instrument,
    candleSourceLabel: row.candleSourceLabel,
    dailySourceHash: row.dailySourceHash?.sha256 || null,
    intradaySourceHash: row.intradaySourceHash?.sha256 || null
  }));

  return {
    meta: {
      generated_at: new Date().toISOString(),
      version: "half-l2l-reach-v2",
      source: "backtester/scripts/validate_half_l2l_reach_research.js",
      research_only: true,
      evaluation_window: "date-keyed source session attached to evaluation_inputs.close_date",
      current_standard_definition: "Current standard L2L distance is ADR20 * 0.5 from the existing L2L 1H Sequence Research builder.",
      half_target_definition: "Half target distance is 0.5 * current standard, which equals ADR20 * 0.25.",
      boundary_touch_rule: "Exact equality counts as touched.",
      adverse_boundary_policy: "Not supported by the current contract because the existing L2L research does not define an adverse boundary, stop, or entry sequencing rule.",
      call_timestamp_policy: "The current contract is date-based. Checker rows provide snapshot_date and evaluation_inputs.close_date; the research engine keys the 1H session by evaluation_inputs.close_date rather than by an intraday call timestamp.",
      timezone: "UTC",
      pre_call_candles_may_be_included: true,
      evaluated_date_ranges: {
        layer1: {
          earliest: minDate(annotatedLayer1Rows.filter((row) => row.status === "ELIGIBLE")),
          latest: maxDate(annotatedLayer1Rows.filter((row) => row.status === "ELIGIBLE"))
        },
        layer2: {
          earliest: minDate(annotatedLayer2Rows.filter((row) => row.status === "ELIGIBLE")),
          latest: maxDate(annotatedLayer2Rows.filter((row) => row.status === "ELIGIBLE"))
        }
      },
      manual_review_sample_seed: MANUAL_SAMPLE_SEED,
      manual_review_sample_size: {
        layer1: layer1Sample.length,
        layer2: layer2Sample.length,
        total: layer1Sample.length + layer2Sample.length
      },
      manual_review_selection_rule: "Retain four rows per supported asset/pair from the prior eight-row manual sample. MISS/HIT is impossible because any full-target hit necessarily implies the half target was hit first. For each non-overridden group, retain the oldest eligible row for each valid class (HIT/HIT, HIT/MISS, MISS/MISS) by call date ascending and then stable record ID, then keep the oldest remaining legacy sample row as the deterministic fourth example. Layer 1 EUR is pinned to the four authoritative previously reviewed stable record IDs.",
      manual_review_valid_outcome_combinations: VALID_OUTCOME_COMBINATIONS,
      manual_review_group_order: sampleGroups.map((group) => `${group.layer}:${group.entityCode}`)
    },
    source_audit: sourceAudit,
    comparisons: {
      overall: {
        layer1: buildComparisonRow({ layer: "LAYER_1", label: "Layer 1 overall" }, annotatedLayer1Rows),
        layer2: buildComparisonRow({ layer: "LAYER_2", label: "Layer 2 overall" }, annotatedLayer2Rows)
      },
      layer1_assets: layer1Assets,
      layer2_pairs: layer2Pairs,
      layer1_directions: layer1DirectionRows,
      layer2_directions: layer2DirectionRows,
      layer1_strength_bands: layer1StrengthRows,
      layer2_strength_bands: layer2StrengthRows,
      layer1_exact_confidence_buckets: layer1ExactConfidenceRows,
      layer2_exact_confidence_buckets: layer2ExactConfidenceRows,
      layer1_weekdays: layer1WeekdayRows,
      layer2_weekdays: layer2WeekdayRows,
      layer1_years: layer1YearRows,
      layer2_years: layer2YearRows,
      layer1_months: layer1MonthRows,
      layer2_months: layer2MonthRows,
      layer1_chronological_folds: layer1FoldRows,
      layer2_chronological_folds: layer2FoldRows,
      layer1_latest_period: layer1FoldRows.filter((row) => row.foldIndex === FOLD_COUNT),
      layer2_latest_period: layer2FoldRows.filter((row) => row.foldIndex === FOLD_COUNT)
    },
    monotonicity: [
      buildMonotonicityReport("Layer 1 overall", layer1Rows),
      buildMonotonicityReport("Layer 2 overall", layer2Rows)
    ],
    manual_review: {
      seed: MANUAL_SAMPLE_SEED,
      contract_version: "half-l2l-manual-review-v1",
      selection_rule: "Retain four rows per supported asset/pair from the legacy eight-row manual sample. MISS/HIT is impossible because any full-target hit necessarily implies the half target was hit first. For non-overridden groups, the oldest eligible record wins for each valid class (HIT/HIT, HIT/MISS, MISS/MISS) by call date ascending and then stable record ID; the fourth retained row is the oldest remaining legacy sample row. Layer 1 EUR is pinned to the four authoritative previously reviewed stable record IDs.",
      valid_outcome_combinations: VALID_OUTCOME_COMBINATIONS,
      source_identity: sourceIdentity,
      groups: sampleGroups.map((group) => ({
        layer: group.layer,
        layerLabel: group.layerLabel,
        entityCode: group.entityCode,
        entityLabel: group.entityLabel,
        sampleSize: group.sampleSize,
        availableOutcomeCombinations: group.availableOutcomeCombinations,
        validOutcomeCombinations: group.validOutcomeCombinations,
        selectedOutcomeCombinationCounts: group.selectedOutcomeCombinationCounts,
        selectionRule: group.selectionRule
      })),
      sample_rows: [...layer1Sample, ...layer2Sample]
    },
    row_level: {
      layer1: annotatedLayer1Rows,
      layer2: annotatedLayer2Rows,
      all: allRows
    }
  };
}

function buildSourceAudit(assetConfigs) {
  return assetConfigs.map((config) => {
    const contexts = loadAssetContexts(config);
    return {
      assetCode: config.assetCode,
      assetLabel: config.assetLabel,
      available: Boolean(contexts),
      instrument: config.instrument || null,
      sourceVendor: config.sourceVendor || null,
      candleSourceLabel: config.candleSourceLabel || null,
      dailySourcePath: relativeRepoPath(config.dailySourcePath),
      intradaySourcePath: relativeRepoPath(config.intradaySourcePath),
      dailySourceHash: hashFile(config.dailySourcePath),
      intradaySourceHash: hashFile(config.intradaySourcePath),
      sourceCoverage: buildSourceCoverage(contexts),
      blocker: contexts ? null : (config.blocker || "Required local source caches are unavailable.")
    };
  });
}

function validateHalfDistance(rows, errors) {
  rows.filter((row) => row.status === "ELIGIBLE").forEach((row) => {
    const expected = Number(row.currentStandardL2lDistance) * 0.5;
    const actual = Number(row.halfL2lDistance);
    if (!Number.isFinite(expected) || !Number.isFinite(actual) || Math.abs(expected - actual) > 1e-8) {
      errors.push(`${row.layer} ${row.entityCode} ${row.predictionId}: half target was not exactly half of the current standard distance`);
    }
  });
}

function validateAgainstCurrentStandard(checkers, layer1Rows, layer2Rows, errors) {
  const currentLayer1Assets = ASSET_CONFIGS.map((config) => buildLayer1AssetResearch(config, checkers[config.assetCode]));
  const currentLayer1ByAssetCode = Object.fromEntries(currentLayer1Assets.map((row) => [row.assetCode, row]));
  const currentLayer2Pairs = PAIR_CONFIGS.map((config) => buildLayer2PairResearch(config, currentLayer1ByAssetCode, checkers));

  currentLayer1Assets.filter((asset) => asset.available).forEach((asset) => {
    const summary = summarizeModeRows(layer1Rows.filter((row) => row.entityCode === asset.assetCode), "FULL_STANDARD");
    if (summary.eligibleCalls !== asset.summary.evaluatedCalls || summary.hits !== asset.summary.l2lRangeAvailableWins || summary.misses !== asset.summary.l2lRangeAvailableLosses) {
      errors.push(`${asset.assetCode}: full-standard half-L2L baseline did not reconcile with existing L2L 1H Sequence Research output`);
    }
  });

  currentLayer2Pairs.filter((pair) => pair.available).forEach((pair) => {
    const summary = summarizeModeRows(layer2Rows.filter((row) => row.entityCode === pair.pairCode), "FULL_STANDARD");
    if (summary.eligibleCalls !== pair.summary.tradableSignals || summary.hits !== pair.summary.l2lRangeAvailableWins || summary.misses !== pair.summary.l2lRangeAvailableLosses) {
      errors.push(`${pair.pairCode}: full-standard half-L2L baseline did not reconcile with existing pair L2L output`);
    }
  });
}

function validateManualReviewSample(output, errors) {
  const sampleRows = Array.isArray(output?.manual_review?.sample_rows) ? output.manual_review.sample_rows : [];
  const groups = Array.isArray(output?.manual_review?.groups) ? output.manual_review.groups : [];
  if (sampleRows.length !== 32) {
    errors.push(`Manual review sample must contain exactly 32 rows, found ${sampleRows.length}`);
  }

  const uniqueIds = new Set(sampleRows.map((row) => row.recordId).filter(Boolean));
  if (uniqueIds.size !== sampleRows.length) {
    errors.push(`Manual review sample must contain unique stable record IDs, found ${sampleRows.length - uniqueIds.size} duplicates`);
  }

  const layerCounts = sampleRows.reduce((acc, row) => {
    acc[row.layer] = (acc[row.layer] || 0) + 1;
    return acc;
  }, {});
  if ((layerCounts.LAYER_1 || 0) !== 16 || (layerCounts.LAYER_2 || 0) !== 16) {
    errors.push(`Manual review sample must allocate 16 Layer 1 and 16 Layer 2 rows, found ${layerCounts.LAYER_1 || 0} and ${layerCounts.LAYER_2 || 0}`);
  }

  const expectedGroupKeys = MANUAL_REVIEW_GROUPS.map((group) => `${group.layer}:${group.entityCode}`);
  const actualGroupKeys = groups.map((group) => `${group.layer}:${group.entityCode}`);
  if (JSON.stringify(actualGroupKeys) !== JSON.stringify(expectedGroupKeys)) {
    errors.push(`Manual review groups were not emitted in the required order. Expected ${expectedGroupKeys.join(", ")}, found ${actualGroupKeys.join(", ")}`);
  }

  expectedGroupKeys.forEach((groupKey) => {
    const [layer, entityCode] = groupKey.split(":");
    const rows = sampleRows.filter((row) => row.layer === layer && row.entityCode === entityCode);
    if (rows.length !== REVIEW_SAMPLE_PER_GROUP) {
      errors.push(`${groupKey} must contain exactly ${REVIEW_SAMPLE_PER_GROUP} sample rows, found ${rows.length}`);
    }
    const sortedIds = rows.slice().sort(compareManualSampleRows).map((row) => row.recordId);
    const actualIds = rows.map((row) => row.recordId);
    if (JSON.stringify(sortedIds) !== JSON.stringify(actualIds)) {
      errors.push(`${groupKey} sample rows were not ordered by call date ascending and stable record ID`);
    }
  });

  const eurOverrideIds = MANUAL_REVIEW_RETAINED_ID_OVERRIDES["LAYER_1:EUR"] || [];
  const eurRows = sampleRows
    .filter((row) => row.layer === "LAYER_1" && row.entityCode === "EUR")
    .map((row) => row.recordId);
  const sortedExpectedEurIds = sampleRows
    .filter((row) => eurOverrideIds.includes(row.recordId))
    .sort(compareManualSampleRows)
    .map((row) => row.recordId);
  if (JSON.stringify(eurRows) !== JSON.stringify(sortedExpectedEurIds)) {
    errors.push(`LAYER_1:EUR must retain the authoritative reviewed stable record IDs in call-date order. Expected ${sortedExpectedEurIds.join(", ")}, found ${eurRows.join(", ")}`);
  }

  if (JSON.stringify(output?.meta?.manual_review_valid_outcome_combinations || []) !== JSON.stringify(VALID_OUTCOME_COMBINATIONS)) {
    errors.push("Manual review metadata did not expose the valid half/full outcome classes.");
  }
  if (JSON.stringify(output?.manual_review?.valid_outcome_combinations || []) !== JSON.stringify(VALID_OUTCOME_COMBINATIONS)) {
    errors.push("Manual review contract did not expose the valid half/full outcome classes.");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checkers = Object.fromEntries(Object.entries(CHECKER_PATHS).map(([assetCode, filePath]) => [assetCode, loadChecker(filePath)]));
  const rollingWindowStart = args.start_date || null;
  const sourceAudit = buildSourceAudit(ASSET_CONFIGS);
  const contextsByAssetCode = Object.fromEntries(ASSET_CONFIGS.map((config) => [config.assetCode, loadAssetContexts(config)]));
  const layer1Rows = ASSET_CONFIGS.flatMap((config) => {
    const contexts = contextsByAssetCode[config.assetCode];
    if (!contexts) return [];
    return buildLayer1Rows(config, checkers[config.assetCode], contexts, rollingWindowStart);
  });
  const layer2Rows = PAIR_CONFIGS.flatMap((config) => buildLayer2Rows(config, layer1Rows.filter((row) => row.entityCode === config.targetAssetCode), checkers, rollingWindowStart));
  const output = buildOutput(sourceAudit, layer1Rows, layer2Rows);
  const errors = [];

  validateCheckerInvariants(checkers, errors);
  validateHalfDistance(layer1Rows, errors);
  validateHalfDistance(layer2Rows, errors);
  validateAgainstCurrentStandard(checkers, layer1Rows, layer2Rows, errors);
  validateManualReviewSample(output, errors);

  if (args.write === "true") {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  } else if (!fs.existsSync(OUTPUT_PATH)) {
    errors.push("Half-L2L reach artifact is missing. Run with --write to generate data/half-l2l-reach-research.json.");
  } else {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    const comparableCurrent = JSON.stringify({ ...output, meta: { ...output.meta, generated_at: null } });
    const comparableExisting = JSON.stringify({ ...existing, meta: { ...existing.meta, generated_at: null } });
    if (comparableCurrent !== comparableExisting) {
      errors.push("Half-L2L reach artifact is stale relative to the current builder output.");
    }
  }

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    artifact_path: OUTPUT_PATH,
    overall_layer1: output.comparisons.overall.layer1,
    overall_layer2: output.comparisons.overall.layer2,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  OUTPUT_PATH,
  buildOutput,
  buildLayer1Rows,
  buildLayer2Rows,
  buildSourceAudit,
  summarizeModeRows,
  buildChronologicalFoldRows,
  buildMonotonicityReport,
  buildLegacyManualSampleForGroup,
  buildManualSampleFromLegacyEight,
  annotateChronologicalFoldIndex,
  compareManualSampleRows,
  manualOutcomeCombination,
  validateManualReviewSample
};
