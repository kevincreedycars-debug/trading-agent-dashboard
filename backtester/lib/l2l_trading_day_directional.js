const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { loadIntradayOhlc } = require("./adr_reach_research");
const { roundNumber, summarizeDistribution, wilsonInterval } = require("./half_l2l_reach_research");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ARTIFACT_PATH = path.join(REPO_ROOT, "data", "half-l2l-reach-research.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "data", "l2l-trading-day-directional-v1.json");
const CONTRACT_VERSION = "l2l-trading-day-directional-v1";
const EXECUTABLE_ENTRY_DRAFT_PATH = "data/half-l2l-executable-entry-v1-draft.json";

const CHRONOLOGICAL_FOLDS = Object.freeze([
  { key: "TRAIN", start: "2024-01-03", end: "2024-12-31", sealed_from_parameter_selection: false },
  { key: "VALIDATION", start: "2025-01-01", end: "2025-09-30", sealed_from_parameter_selection: false },
  { key: "FINAL_TEST", start: "2025-10-01", end: "2026-04-30", sealed_from_parameter_selection: true }
]);

const EXCLUSION_REASONS = Object.freeze({
  MISSING_SESSION: "missing_source_defined_session",
  INCOMPLETE_SESSION: "incomplete_source_defined_session",
  SHORTENED_SESSION: "shortened_source_defined_session",
  AMBIGUOUS_SESSION: "ambiguous_source_defined_session"
});

function relativeRepoPath(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function loadSourceArtifact() {
  return JSON.parse(fs.readFileSync(SOURCE_ARTIFACT_PATH, "utf8"));
}

function getEligibleRows(sourceArtifact) {
  const rows = Array.isArray(sourceArtifact?.row_level?.all) ? sourceArtifact.row_level.all : [];
  return rows.filter((row) => row.status === "ELIGIBLE");
}

function resolveUnderlyingAssetCode(row) {
  return row.layer === "LAYER_2" ? row.targetAssetCode : row.entityCode;
}

function assignChronologicalFold(evaluationDate) {
  return CHRONOLOGICAL_FOLDS.find((fold) => evaluationDate >= fold.start && evaluationDate <= fold.end)?.key || null;
}

function loadIntradayContexts(sourceArtifact) {
  const sourceAudit = Array.isArray(sourceArtifact?.source_audit) ? sourceArtifact.source_audit : [];
  return Object.fromEntries(
    sourceAudit
      .filter((row) => row.available && row.intradaySourcePath)
      .map((row) => {
        const filePath = path.join(REPO_ROOT, row.intradaySourcePath);
        return [
          row.assetCode,
          loadIntradayOhlc(filePath, {
            instrument: row.instrument,
            source: row.candleSourceLabel
          })
        ];
      })
  );
}

function expectedTimestampSequence(startIso, endIso) {
  const startMillis = Date.parse(startIso);
  const endMillis = Date.parse(endIso);
  if (!Number.isFinite(startMillis) || !Number.isFinite(endMillis) || endMillis < startMillis) {
    return [];
  }
  const timestamps = [];
  for (let current = startMillis; current <= endMillis; current += 60 * 60 * 1000) {
    timestamps.push(new Date(current).toISOString());
  }
  return timestamps;
}

function normalizeIsoInstant(value) {
  const millis = Date.parse(String(value || ""));
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function buildTimestampSet(candles) {
  return new Set(candles.map((candle) => normalizeIsoInstant(candle.timestamp)).filter(Boolean));
}

function selectTradingSessionCandles(row, intradayContext) {
  const sessionCandles = (intradayContext?.byDate?.get(row.evaluationDate) || []).slice();
  if (!sessionCandles.length) {
    return {
      ok: false,
      reason: EXCLUSION_REASONS.MISSING_SESSION,
      sessionCandles: []
    };
  }

  if (sessionCandles.some((candle) => !candle.complete)) {
    return {
      ok: false,
      reason: EXCLUSION_REASONS.INCOMPLETE_SESSION,
      sessionCandles
    };
  }

  const timestamps = sessionCandles.map((candle) => normalizeIsoInstant(candle.timestamp));
  const uniqueTimestampCount = new Set(timestamps).size;
  if (uniqueTimestampCount !== timestamps.length) {
    return {
      ok: false,
      reason: EXCLUSION_REASONS.AMBIGUOUS_SESSION,
      sessionCandles
    };
  }

  const normalizedStartTime = normalizeIsoInstant(row.evaluationStartTime);
  const normalizedEndTime = normalizeIsoInstant(row.evaluationEndTime);
  const expectedTimestamps = expectedTimestampSequence(normalizedStartTime, normalizedEndTime);
  const actualTimestampSet = buildTimestampSet(sessionCandles);
  const missingTimestamps = expectedTimestamps.filter((timestamp) => !actualTimestampSet.has(timestamp));
  const unexpectedTimestamps = timestamps.filter((timestamp) => !expectedTimestamps.includes(timestamp));

  if (unexpectedTimestamps.length) {
    return {
      ok: false,
      reason: EXCLUSION_REASONS.AMBIGUOUS_SESSION,
      sessionCandles,
      missingTimestamps,
      unexpectedTimestamps
    };
  }

  if (
    normalizeIsoInstant(sessionCandles[0]?.timestamp) !== normalizedStartTime
    || normalizeIsoInstant(sessionCandles[sessionCandles.length - 1]?.timestamp) !== normalizedEndTime
    || missingTimestamps.length
    || sessionCandles.length !== expectedTimestamps.length
  ) {
    return {
      ok: false,
      reason: EXCLUSION_REASONS.SHORTENED_SESSION,
      sessionCandles,
      missingTimestamps
    };
  }

  return {
    ok: true,
    sessionCandles
  };
}

function classifyTerminalDirection(sessionOpenPrice, sessionClosePrice, callDirection) {
  if (sessionClosePrice > sessionOpenPrice) {
    return {
      terminalDirection: "BULLISH",
      classification: callDirection === "BULLISH" ? "CORRECT" : "INCORRECT"
    };
  }
  if (sessionClosePrice < sessionOpenPrice) {
    return {
      terminalDirection: "BEARISH",
      classification: callDirection === "BEARISH" ? "CORRECT" : "INCORRECT"
    };
  }
  return {
    terminalDirection: "FLAT",
    classification: "FLAT"
  };
}

function computeExcursionMetrics(sessionCandles, sessionOpenPrice, callDirection, adr20, halfDistance, fullDistance) {
  const highs = sessionCandles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = sessionCandles.map((candle) => candle.low).filter(Number.isFinite);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);

  const favourableMove = callDirection === "BULLISH"
    ? maxHigh - sessionOpenPrice
    : sessionOpenPrice - minLow;
  const adverseMove = callDirection === "BULLISH"
    ? sessionOpenPrice - minLow
    : maxHigh - sessionOpenPrice;

  return {
    maxFavourableExcursion: roundNumber(favourableMove),
    maxAdverseExcursion: roundNumber(adverseMove),
    maxFavourableExcursionAdr: adr20 > 0 ? roundNumber(favourableMove / adr20, 6) : null,
    maxAdverseExcursionAdr: adr20 > 0 ? roundNumber(adverseMove / adr20, 6) : null,
    reachedHalfAdr20: favourableMove >= halfDistance,
    reachedFullAdr20: favourableMove >= fullDistance
  };
}

function evaluateRow(row, intradayContexts) {
  const underlyingAssetCode = resolveUnderlyingAssetCode(row);
  const intradayContext = intradayContexts[underlyingAssetCode] || null;
  const sessionSelection = selectTradingSessionCandles(row, intradayContext);

  const base = {
    recordId: row.recordId,
    predictionId: row.predictionId,
    layer: row.layer,
    entityCode: row.entityCode,
    entityLabel: row.entityLabel,
    underlyingAssetCode,
    snapshotDate: row.snapshotDate,
    evaluationDate: row.evaluationDate,
    weekdayKey: row.weekdayKey,
    callDirection: row.callDirection,
    confidencePct: row.confidencePct,
    strengthBucket: row.strengthBucket,
    exactConfidenceBucketKey: row.exactConfidenceBucketKey,
    exactConfidenceBucketLabel: row.exactConfidenceBucketLabel,
    chronologicalFold: assignChronologicalFold(row.evaluationDate),
    adr20: row.adr20,
    halfDistance: row.halfL2lDistance,
    fullDistance: row.currentStandardL2lDistance,
    evaluationStartTime: row.evaluationStartTime,
    evaluationEndTime: row.evaluationEndTime
  };

  if (!sessionSelection.ok) {
    return {
      ...base,
      included: false,
      exclusionReason: sessionSelection.reason,
      sessionCandleCount: sessionSelection.sessionCandles.length,
      sessionOpenPrice: null,
      sessionClosePrice: null,
      terminalDirection: null,
      classification: null
    };
  }

  const sessionCandles = sessionSelection.sessionCandles;
  const sessionOpenPrice = sessionCandles[0].open;
  const sessionClosePrice = sessionCandles[sessionCandles.length - 1].close;
  const direction = classifyTerminalDirection(sessionOpenPrice, sessionClosePrice, row.callDirection);
  const openToCloseMove = sessionClosePrice - sessionOpenPrice;
  const openToCloseReturnPct = sessionOpenPrice !== 0
    ? roundNumber((openToCloseMove / sessionOpenPrice) * 100, 6)
    : null;
  const openToCloseReturnAdr = row.adr20 > 0 ? roundNumber(openToCloseMove / row.adr20, 6) : null;
  const signedReturnAdrFromCallPerspective = row.callDirection === "BULLISH"
    ? openToCloseReturnAdr
    : (Number.isFinite(openToCloseReturnAdr) ? roundNumber(openToCloseReturnAdr * -1, 6) : null);
  const excursion = computeExcursionMetrics(
    sessionCandles,
    sessionOpenPrice,
    row.callDirection,
    row.adr20,
    row.halfL2lDistance,
    row.currentStandardL2lDistance
  );

  return {
    ...base,
    included: true,
    exclusionReason: null,
    sessionCandleCount: sessionCandles.length,
    sessionOpenPrice: roundNumber(sessionOpenPrice),
    sessionClosePrice: roundNumber(sessionClosePrice),
    openToCloseMove: roundNumber(openToCloseMove),
    openToCloseReturnPct,
    openToCloseReturnAdr,
    signedReturnAdrFromCallPerspective,
    terminalDirection: direction.terminalDirection,
    classification: direction.classification,
    reachedHalfAdr20: excursion.reachedHalfAdr20,
    reachedFullAdr20: excursion.reachedFullAdr20,
    maxFavourableExcursion: excursion.maxFavourableExcursion,
    maxAdverseExcursion: excursion.maxAdverseExcursion,
    maxFavourableExcursionAdr: excursion.maxFavourableExcursionAdr,
    maxAdverseExcursionAdr: excursion.maxAdverseExcursionAdr,
    halfReachButTerminalReversal: excursion.reachedHalfAdr20 && direction.classification === "INCORRECT",
    fullReachButTerminalReversal: excursion.reachedFullAdr20 && direction.classification === "INCORRECT",
    anyReachButTerminalReversal: (excursion.reachedHalfAdr20 || excursion.reachedFullAdr20) && direction.classification === "INCORRECT"
  };
}

function percentage(part, whole, decimals = 2) {
  if (!(whole > 0)) return null;
  return Number(((part / whole) * 100).toFixed(decimals));
}

function compareTo50Baseline(accuracyPct) {
  return Number.isFinite(accuracyPct) ? roundNumber(accuracyPct - 50, 2) : null;
}

function buildDirectionalDistribution(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.terminalDirection] = (acc[row.terminalDirection] || 0) + 1;
    return acc;
  }, { BULLISH: 0, BEARISH: 0, FLAT: 0 });
  const nonFlat = counts.BULLISH + counts.BEARISH;
  return {
    bullishCount: counts.BULLISH,
    bearishCount: counts.BEARISH,
    flatCount: counts.FLAT,
    bullishPctOfAll: percentage(counts.BULLISH, rows.length),
    bearishPctOfAll: percentage(counts.BEARISH, rows.length),
    flatPctOfAll: percentage(counts.FLAT, rows.length),
    bullishPctExFlat: percentage(counts.BULLISH, nonFlat),
    bearishPctExFlat: percentage(counts.BEARISH, nonFlat),
    majorityDirectionalBaselinePct: Math.max(
      percentage(counts.BULLISH, nonFlat) || 0,
      percentage(counts.BEARISH, nonFlat) || 0
    )
  };
}

function summarizeGroup(allRows, groupMeta = {}) {
  const includedRows = allRows.filter((row) => row.included);
  const excludedRows = allRows.filter((row) => !row.included);
  const correctCount = includedRows.filter((row) => row.classification === "CORRECT").length;
  const incorrectCount = includedRows.filter((row) => row.classification === "INCORRECT").length;
  const flatCount = includedRows.filter((row) => row.classification === "FLAT").length;
  const nonFlatCount = correctCount + incorrectCount;
  const directionalAccuracyPct = percentage(correctCount, nonFlatCount);
  const accuracyIncludingFlatPct = percentage(correctCount, includedRows.length);
  const wilson = wilsonInterval(correctCount, nonFlatCount);
  const directionalDistribution = buildDirectionalDistribution(includedRows);

  return {
    ...groupMeta,
    inputRowCount: allRows.length,
    includedCount: includedRows.length,
    excludedCount: excludedRows.length,
    exclusionReasons: excludedRows.reduce((acc, row) => {
      acc[row.exclusionReason] = (acc[row.exclusionReason] || 0) + 1;
      return acc;
    }, {}),
    correctCount,
    incorrectCount,
    flatCount,
    directionalAccuracyPct,
    directionalAccuracyIncludingFlatPct: accuracyIncludingFlatPct,
    wilson95LowPct: wilson.lowPct,
    wilson95HighPct: wilson.highPct,
    meanSignedReturnAdr: summarizeDistribution(includedRows.map((row) => row.signedReturnAdrFromCallPerspective)).count
      ? roundNumber(
        includedRows
          .map((row) => row.signedReturnAdrFromCallPerspective)
          .filter(Number.isFinite)
          .reduce((sum, value) => sum + value, 0)
        / includedRows.map((row) => row.signedReturnAdrFromCallPerspective).filter(Number.isFinite).length,
        6
      )
      : null,
    medianSignedReturnAdr: summarizeDistribution(includedRows.map((row) => row.signedReturnAdrFromCallPerspective)).median,
    halfAdr20ReachRatePct: percentage(includedRows.filter((row) => row.reachedHalfAdr20).length, includedRows.length),
    fullAdr20ReachRatePct: percentage(includedRows.filter((row) => row.reachedFullAdr20).length, includedRows.length),
    halfAdr20ReachButTerminalReversalRatePct: percentage(includedRows.filter((row) => row.halfReachButTerminalReversal).length, includedRows.length),
    fullAdr20ReachButTerminalReversalRatePct: percentage(includedRows.filter((row) => row.fullReachButTerminalReversal).length, includedRows.length),
    anyReachButTerminalReversalRatePct: percentage(includedRows.filter((row) => row.anyReachButTerminalReversal).length, includedRows.length),
    deltaVs50PctBaseline: compareTo50Baseline(directionalAccuracyPct),
    unconditionalDirectionalDistribution: directionalDistribution
  };
}

function groupBy(rows, keyBuilder) {
  return rows.reduce((map, row) => {
    const key = keyBuilder(row);
    const existing = map.get(key) || [];
    existing.push(row);
    map.set(key, existing);
    return map;
  }, new Map());
}

function buildSummaryCollections(evaluatedRows) {
  const layer1Rows = evaluatedRows.filter((row) => row.layer === "LAYER_1");
  const layer2Rows = evaluatedRows.filter((row) => row.layer === "LAYER_2");

  const summarizeByEntityAndDimension = (rows, dimensionKey, entityLabelKey) => {
    return Array.from(groupBy(rows, (row) => `${row.entityCode}|${row[dimensionKey] || "UNKNOWN"}`).entries()).map(([key, groupRows]) => {
      const [entityCode, dimensionValue] = key.split("|");
      return summarizeGroup(groupRows, {
        entityCode,
        entityLabel: groupRows[0]?.entityLabel || entityCode,
        [entityLabelKey]: dimensionValue
      });
    });
  };

  const byLayerAndFold = (rows) => Array.from(groupBy(rows, (row) => row.chronologicalFold || "OUTSIDE_RANGE").entries()).map(([foldKey, groupRows]) =>
    summarizeGroup(groupRows, { chronologicalFold: foldKey })
  );

  return {
    overall: {
      layer1: summarizeGroup(layer1Rows, { layer: "LAYER_1" }),
      layer2: summarizeGroup(layer2Rows, { layer: "LAYER_2" })
    },
    layer1_assets: Array.from(groupBy(layer1Rows, (row) => row.entityCode).entries()).map(([entityCode, groupRows]) =>
      summarizeGroup(groupRows, { assetCode: entityCode, assetLabel: groupRows[0]?.entityLabel || entityCode })
    ),
    layer2_pairs: Array.from(groupBy(layer2Rows, (row) => row.entityCode).entries()).map(([entityCode, groupRows]) =>
      summarizeGroup(groupRows, { pairCode: entityCode, pairLabel: groupRows[0]?.entityLabel || entityCode })
    ),
    layer1_directions: summarizeByEntityAndDimension(layer1Rows, "callDirection", "callDirection"),
    layer2_directions: summarizeByEntityAndDimension(layer2Rows, "callDirection", "callDirection"),
    layer1_strength_bands: summarizeByEntityAndDimension(layer1Rows, "strengthBucket", "strengthBucket"),
    layer2_strength_bands: summarizeByEntityAndDimension(layer2Rows, "strengthBucket", "strengthBucket"),
    layer1_weekdays: summarizeByEntityAndDimension(layer1Rows, "weekdayKey", "weekdayKey"),
    layer2_weekdays: summarizeByEntityAndDimension(layer2Rows, "weekdayKey", "weekdayKey"),
    layer1_chronological_folds: Array.from(groupBy(layer1Rows, (row) => `${row.entityCode}|${row.chronologicalFold || "OUTSIDE_RANGE"}`).entries()).map(([key, groupRows]) => {
      const [entityCode, foldKey] = key.split("|");
      return summarizeGroup(groupRows, {
        assetCode: entityCode,
        assetLabel: groupRows[0]?.entityLabel || entityCode,
        chronologicalFold: foldKey
      });
    }),
    layer2_chronological_folds: Array.from(groupBy(layer2Rows, (row) => `${row.entityCode}|${row.chronologicalFold || "OUTSIDE_RANGE"}`).entries()).map(([key, groupRows]) => {
      const [entityCode, foldKey] = key.split("|");
      return summarizeGroup(groupRows, {
        pairCode: entityCode,
        pairLabel: groupRows[0]?.entityLabel || entityCode,
        chronologicalFold: foldKey
      });
    }),
    fold_consistency: {
      layer1: byLayerAndFold(layer1Rows),
      layer2: byLayerAndFold(layer2Rows)
    }
  };
}

function buildOutput(sourceArtifact, evaluatedRows) {
  const eligibleRows = getEligibleRows(sourceArtifact);
  const layer1Rows = evaluatedRows.filter((row) => row.layer === "LAYER_1");
  const layer2Rows = evaluatedRows.filter((row) => row.layer === "LAYER_2");
  const summaries = buildSummaryCollections(evaluatedRows);
  const sourceAudit = Array.isArray(sourceArtifact?.source_audit) ? sourceArtifact.source_audit : [];

  return {
    meta: {
      generated_at: new Date().toISOString(),
      version: CONTRACT_VERSION,
      source: "backtester/scripts/build_l2l_trading_day_directional.js",
      research_only: true,
      core_question: "Does each Layer 1 or Layer 2 call correctly predict the open-to-close direction of its designated source-defined trading session?",
      session_scope_rule: "Use only candles inside the existing source-defined trading session for evaluationDate. Do not impose midnight-to-midnight or rolling 24-hour windows.",
      preserved_existing_artifacts: [
        relativeRepoPath(SOURCE_ARTIFACT_PATH),
        EXECUTABLE_ENTRY_DRAFT_PATH
      ],
      executable_entry_draft_scope: "outside_current_core_directional_research_scope",
      chronological_folds: CHRONOLOGICAL_FOLDS
    },
    lineage: {
      source_artifact_path: relativeRepoPath(SOURCE_ARTIFACT_PATH),
      source_artifact_sha256: hashFile(SOURCE_ARTIFACT_PATH),
      source_artifact_version: sourceArtifact?.meta?.version || null,
      publication_time_recovery_decision: "PROXY_REQUIRED",
      session_identification: {
        snapshotDate: "Original call-date lineage for the macro snapshot.",
        call_date: "Remote evaluation field that matched snapshotDate in the timestamp audit evidence.",
        evaluationDate: "The designated trading session key already used by the half-L2L research.",
        open_time_et: "Remote evaluation session-open proxy for the designated trading session, not publication time.",
        close_time_et: "Remote evaluation session-close proxy whose UTC date portion matched evaluationDate in the timestamp audit evidence."
      },
      source_hashes: sourceAudit.map((row) => ({
        assetCode: row.assetCode,
        dailySourceHash: row.dailySourceHash?.sha256 || null,
        intradaySourceHash: row.intradaySourceHash?.sha256 || null
      }))
    },
    source_population: {
      eligibleInputRows: eligibleRows.length,
      eligibleLayer1Rows: layer1Rows.length,
      eligibleLayer2Rows: layer2Rows.length,
      uniquePredictionIdsAcrossLayers: new Set(eligibleRows.map((row) => String(row.predictionId || "")).filter(Boolean)).size,
      duplicatedCrossLayerPredictionIdsNotIndependentEvidence: eligibleRows.length - new Set(eligibleRows.map((row) => String(row.predictionId || "")).filter(Boolean)).size
    },
    comparisons: summaries,
    row_level: {
      all: evaluatedRows,
      layer1: evaluatedRows.filter((row) => row.layer === "LAYER_1"),
      layer2: evaluatedRows.filter((row) => row.layer === "LAYER_2")
    }
  };
}

function validateOutput(output, sourceArtifact) {
  const errors = [];
  const eligibleRows = getEligibleRows(sourceArtifact);
  if (output?.meta?.version !== CONTRACT_VERSION) {
    errors.push(`Expected output version ${CONTRACT_VERSION}`);
  }
  if ((output?.source_population?.eligibleInputRows || 0) !== eligibleRows.length) {
    errors.push(`Expected ${eligibleRows.length} eligible input rows`);
  }
  if ((output?.row_level?.all || []).length !== eligibleRows.length) {
    errors.push(`Expected ${eligibleRows.length} evaluated rows`);
  }
  return errors;
}

module.exports = {
  CHRONOLOGICAL_FOLDS,
  CONTRACT_VERSION,
  EXCLUSION_REASONS,
  OUTPUT_PATH,
  SOURCE_ARTIFACT_PATH,
  assignChronologicalFold,
  buildOutput,
  classifyTerminalDirection,
  computeExcursionMetrics,
  evaluateRow,
  getEligibleRows,
  loadIntradayContexts,
  loadSourceArtifact,
  selectTradingSessionCandles,
  validateOutput
};
