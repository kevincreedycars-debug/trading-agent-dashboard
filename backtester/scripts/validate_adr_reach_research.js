#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("../lib/historical_common");
const {
  CONFIDENCE_BUCKETS,
  addOutcome,
  bucketKeyFromConfidence,
  buildCellMap,
  buildRequiredDistanceInputs,
  classifyDirectionalCallType,
  createOutcomeCell,
  evaluateL2lSequence,
  loadDailyOhlc,
  loadIntradayOhlc,
  normalizeHeadlineConfidence,
  normalizeLayer1Direction,
  reasonLabel,
  roundNumber,
  summarizeOutcomeCell,
  sumOutcomeCells,
  weekdayFromDate
} = require("../lib/adr_reach_research");

const LOOKBACK_DAYS = 730;
const CHECKER_PATHS = {
  USD: path.resolve(__dirname, "../../data/backtester-checker-usd-24h-2024-01.json"),
  EUR: path.resolve(__dirname, "../../data/backtester-checker-eur-24h-2024-2026.json"),
  GOLD: path.resolve(__dirname, "../../data/backtester-checker-gold-24h-2024-2026.json"),
  NQ: path.resolve(__dirname, "../../data/backtester-checker-nq-24h-2024-2026.json"),
  BTC: path.resolve(__dirname, "../../data/backtester-checker-btc-24h-2024-2026.json")
};
const EXPECTED_CHECKER_ROWS = {
  USD: 604,
  EUR: 602,
  GOLD: 608,
  NQ: 604,
  BTC: 850
};
const OUTPUT_PATH = path.resolve(__dirname, "../../data/adr-reach-research.json");
const REPO_ROOT = path.resolve(__dirname, "../..");
const FIXED_REFERENCE_L2L = {
  EUR: 0.00426,
  GOLD: 69.937,
  NQ: 269.6,
  BTC: 1468.4,
  EUR_USD: 0.00426,
  XAU_USD: 69.937,
  NQ_USD: 269.6,
  BTC_USD: 1468.4
};
const WEEKDAYS = {
  WEEKDAY_ONLY: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  ALL_DAYS: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
};
const ENTRY_RELIABILITY_GROUPS = [
  {
    key: "COMBINED_DIRECTIONAL",
    label: "Combined Directional",
    description: "Includes BULLISH, BEARISH, BULLISH_LEAN, and BEARISH_LEAN.",
    directionalCallTypes: ["CLEAN_DIRECTIONAL", "LEAN_DIRECTIONAL"]
  },
  {
    key: "CLEAN_DIRECTIONAL_ONLY",
    label: "Clean Directional Only",
    description: "Includes BULLISH and BEARISH only.",
    directionalCallTypes: ["CLEAN_DIRECTIONAL"]
  },
  {
    key: "LEAN_DIRECTIONAL_ONLY",
    label: "Lean Directional Only",
    description: "Includes BULLISH_LEAN and BEARISH_LEAN only.",
    directionalCallTypes: ["LEAN_DIRECTIONAL"]
  }
];
const ASSET_CONFIGS = [
  {
    assetCode: "EUR",
    assetLabel: "EUR",
    weekdayKeys: WEEKDAYS.WEEKDAY_ONLY,
    checkerPath: CHECKER_PATHS.EUR,
    dailySourcePath: path.resolve(__dirname, "../tmp/oanda_eur_usd_daily.csv"),
    intradaySourcePath: path.resolve(__dirname, "../tmp/oanda_eur_usd_h1.csv"),
    dailySourceLabel: "OANDA EUR_USD daily candles cache",
    intradaySourceLabel: "OANDA EUR_USD 1H candles cache",
    candleSourceLabel: "OANDA v20 candles",
    instrument: "EUR_USD",
    sourceVendor: "OANDA",
    fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.EUR
  },
  {
    assetCode: "GOLD",
    assetLabel: "Gold",
    weekdayKeys: WEEKDAYS.WEEKDAY_ONLY,
    checkerPath: CHECKER_PATHS.GOLD,
    dailySourcePath: path.resolve(__dirname, "../tmp/oanda_xau_usd_daily.csv"),
    intradaySourcePath: path.resolve(__dirname, "../tmp/oanda_xau_usd_h1.csv"),
    dailySourceLabel: "OANDA XAU_USD daily candles cache",
    intradaySourceLabel: "OANDA XAU_USD 1H candles cache",
    candleSourceLabel: "OANDA v20 candles",
    instrument: "XAU_USD",
    sourceVendor: "OANDA",
    fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.GOLD
  },
  {
    assetCode: "NQ",
    assetLabel: "NQ",
    weekdayKeys: WEEKDAYS.WEEKDAY_ONLY,
    checkerPath: CHECKER_PATHS.NQ,
    dailySourcePath: path.resolve(__dirname, "../tmp/oanda_nas100_usd_daily.csv"),
    intradaySourcePath: path.resolve(__dirname, "../tmp/oanda_nas100_usd_h1.csv"),
    dailySourceLabel: "OANDA NAS100_USD daily candles cache",
    intradaySourceLabel: "OANDA NAS100_USD 1H candles cache",
    candleSourceLabel: "OANDA v20 candles",
    instrument: "NAS100_USD",
    sourceVendor: "OANDA",
    fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.NQ
  },
  {
    assetCode: "BTC",
    assetLabel: "BTC",
    weekdayKeys: WEEKDAYS.ALL_DAYS,
    checkerPath: CHECKER_PATHS.BTC,
    dailySourcePath: path.resolve(__dirname, "../tmp/binance_btcusdt_daily.csv"),
    intradaySourcePath: path.resolve(__dirname, "../tmp/binance_btcusdt_1h.csv"),
    dailySourceLabel: "Binance BTCUSDT daily klines cache",
    intradaySourceLabel: "Binance BTCUSDT 1H klines cache",
    candleSourceLabel: "Binance Spot klines",
    instrument: "BTCUSDT",
    sourceVendor: "Binance",
    fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.BTC
  },
  {
    assetCode: "USD",
    assetLabel: "USD",
    weekdayKeys: WEEKDAYS.WEEKDAY_ONLY,
    checkerPath: CHECKER_PATHS.USD,
    dailySourcePath: null,
    intradaySourcePath: null,
    dailySourceLabel: "No DXY daily cache",
    intradaySourceLabel: "No DXY 1H cache",
    candleSourceLabel: "Unavailable",
    instrument: "DXY",
    sourceVendor: "Unavailable",
    fixedReferenceL2lDistance: null,
    blocker: "USD remains unavailable because no supportable repo-local DXY daily plus 1H source is staged."
  }
];
const PAIR_CONFIGS = [
  { targetAssetCode: "EUR", pairCode: "EUR_USD", pairLabel: "EUR/USD", weekdayKeys: WEEKDAYS.WEEKDAY_ONLY, fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.EUR_USD },
  { targetAssetCode: "GOLD", pairCode: "XAU_USD", pairLabel: "XAU/USD", weekdayKeys: WEEKDAYS.WEEKDAY_ONLY, fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.XAU_USD },
  { targetAssetCode: "NQ", pairCode: "NQ_USD", pairLabel: "NQ/USD", weekdayKeys: WEEKDAYS.WEEKDAY_ONLY, fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.NQ_USD },
  { targetAssetCode: "BTC", pairCode: "BTC_USD", pairLabel: "BTC/USD", weekdayKeys: WEEKDAYS.ALL_DAYS, fixedReferenceL2lDistance: FIXED_REFERENCE_L2L.BTC_USD }
];

function loadChecker(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildRollingWindowStartDate(currentDate = new Date()) {
  const boundary = new Date(Date.UTC(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    currentDate.getUTCDate()
  ));
  boundary.setUTCDate(boundary.getUTCDate() - LOOKBACK_DAYS);
  return boundary.toISOString().slice(0, 10);
}

function inRollingWindow(dateValue, startDate) {
  const value = String(dateValue || "").trim();
  if (!value) return false;
  if (!startDate) return true;
  return value >= startDate;
}

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

function buildUnavailableAsset(config, checker, contexts = null) {
  const rowCount = Array.isArray(checker?.rows) ? checker.rows.length : 0;
  const blocker = config.blocker
    || (!fs.existsSync(config?.dailySourcePath || "") ? `Missing daily candle cache: ${relativeRepoPath(config.dailySourcePath)}` : `Missing 1H candle cache: ${relativeRepoPath(config.intradaySourcePath)}`);

  return {
    assetCode: config.assetCode,
    assetLabel: config.assetLabel,
    available: false,
    status: "UNAVAILABLE",
    blocker,
    weekdayKeys: config.weekdayKeys,
    instrument: config.instrument || null,
    sourceVendor: config.sourceVendor || null,
    candleSourceLabel: config.candleSourceLabel,
    dailySourceLabel: config.dailySourceLabel,
    intradaySourceLabel: config.intradaySourceLabel,
    dailySourcePath: relativeRepoPath(config.dailySourcePath),
    intradaySourcePath: relativeRepoPath(config.intradaySourcePath),
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null,
    sourceCoverage: contexts ? buildSourceCoverage(contexts) : null,
    summaryRowsChecked: Number(checker?.summary?.rows_checked || 0),
    totalCheckerRows: rowCount,
    diagnosticRows: [],
    evaluatedRows: [],
    skippedCounts: { unsupported_instrument_rows: rowCount },
    diagnostics: {
      missing_intraday_session: 0,
      incomplete_intraday_session: 0,
      missing_daily_adr20: 0,
      invalid_daily_adr20: 0,
      invalid_required_l2l_distance: 0,
      no_trade_or_non_directional_rows: 0,
      unsupported_instrument_rows: rowCount
    },
    summary: {
      evaluatedCalls: 0,
      l2lRangeAvailableWins: 0,
      l2lRangeAvailableLosses: 0,
      l2lRangeAvailablePct: null,
      strongPlusCalls: 0,
      strongPlusL2lRangeAvailablePct: null
    },
    bucketSummaryRows: emptyBucketSummaryRows(),
    weekdayTotals: buildCellMap(config.weekdayKeys),
    bucketTotals: buildCellMap(CONFIDENCE_BUCKETS.map((bucket) => bucket.key)),
    bucketMatrix: Object.fromEntries(CONFIDENCE_BUCKETS.map((bucket) => [bucket.key, buildCellMap(config.weekdayKeys)])),
    dayTotals: summarizeOutcomeCell(createOutcomeCell())
  };
}

function buildSourceCoverage(contexts) {
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

function emptyBucketSummaryRows() {
  return CONFIDENCE_BUCKETS.map((bucket) => ({
    bucketKey: bucket.key,
    bucketLabel: bucket.label,
    total: 0,
    wins: 0,
    losses: 0,
    l2lRangeAvailablePct: null
  }));
}

function classifySkipReason(reason) {
  return reason || "unknown";
}

function buildDiagnosticBase(config, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, evaluationDate) {
  return {
    predictionId: row?.prediction_id || null,
    snapshotDate: String(row?.snapshot_date || "").trim(),
    date: evaluationDate,
    evaluationDate,
    layer: "LAYER_1",
    assetOrPair: config.assetCode,
    rawCallDirection: rawDirectionLabel,
    callDirection: directionKey,
    directionalCallType,
    strengthBucket: bucketKey,
    confidencePct: roundNumber(confidencePct, 4),
    candleSource: config.candleSourceLabel,
    instrumentSymbol: config.instrument || null,
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
  };
}

function buildEvaluatedLayer1Row(config, contexts, baseRow, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, requiredInputs, evaluation) {
  return {
    ...buildDiagnosticBase(config, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, String(row?.evaluation_inputs?.close_date || "").trim()),
    layer: "LAYER_1",
    candleSource: config.candleSourceLabel,
    instrumentSymbol: requiredInputs.instrumentSymbol,
    numberOf1hCandlesLoaded: requiredInputs.numberOf1hCandlesLoaded,
    adr20: roundNumber(requiredInputs.adr20),
    requiredL2lDistance: roundNumber(requiredInputs.requiredL2lDistance),
    fixedReferenceL2lDistance: roundNumber(requiredInputs.fixedReferenceL2lDistance),
    triggerSwingPrice: evaluation.triggerSwingPrice,
    triggerCandleTime: evaluation.triggerCandleTime,
    triggerPrice: evaluation.triggerPrice,
    reached: evaluation.reached,
    margin: evaluation.margin,
    notEvaluatedReason: null,
    adr20WindowStartDate: requiredInputs.adr20WindowStartDate,
    adr20WindowEndDate: requiredInputs.adr20WindowEndDate,
    checkerOpenPrice: roundNumber(Number(row?.evaluation_inputs?.open_price)),
    checkerClosePrice: roundNumber(Number(row?.evaluation_inputs?.close_price)),
    outcomeKey: evaluation.reached ? "WIN" : "LOSS"
  };
}

function buildNotEvaluatedLayer1Row(config, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, evaluationDate, requiredInputs) {
  return {
    ...buildDiagnosticBase(config, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, evaluationDate),
    numberOf1hCandlesLoaded: Number(requiredInputs?.numberOf1hCandlesLoaded || 0),
    adr20: Number.isFinite(requiredInputs?.adr20) ? roundNumber(requiredInputs.adr20) : null,
    requiredL2lDistance: Number.isFinite(requiredInputs?.requiredL2lDistance) ? roundNumber(requiredInputs.requiredL2lDistance) : null,
    triggerSwingPrice: null,
    triggerCandleTime: null,
    triggerPrice: null,
    reached: null,
    margin: null,
    notEvaluatedReason: reasonLabel(requiredInputs?.reason),
    notEvaluatedReasonKey: requiredInputs?.reason || null,
    adr20WindowStartDate: requiredInputs?.adr20WindowStartDate || null,
    adr20WindowEndDate: requiredInputs?.adr20WindowEndDate || null,
    checkerOpenPrice: roundNumber(Number(row?.evaluation_inputs?.open_price)),
    checkerClosePrice: roundNumber(Number(row?.evaluation_inputs?.close_price))
  };
}

function buildBucketSummaryRows(bucketTotals) {
  return CONFIDENCE_BUCKETS.map((bucket) => {
    const totals = summarizeOutcomeCell(bucketTotals[bucket.key]);
    return {
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      ...totals,
      l2lRangeAvailablePct: totals.winRatePct
    };
  });
}

function buildLayer1AssetResearch(config, checker, options = {}) {
  const contexts = options.contexts || loadAssetContexts(config);
  if (!contexts) {
    return buildUnavailableAsset(config, checker, contexts);
  }

  const rows = Array.isArray(checker?.rows) ? checker.rows : [];
  const weekdayTotals = buildCellMap(config.weekdayKeys);
  const bucketTotals = buildCellMap(CONFIDENCE_BUCKETS.map((bucket) => bucket.key));
  const bucketMatrix = Object.fromEntries(CONFIDENCE_BUCKETS.map((bucket) => [bucket.key, buildCellMap(config.weekdayKeys)]));
  const diagnosticRows = [];
  const evaluatedRows = [];
  const skippedCounts = {};
  const rollingWindowStart = options.rollingWindowStart || null;

  rows.forEach((row) => {
    const evaluationDate = String(row?.evaluation_inputs?.close_date || "").trim();
    if (!inRollingWindow(evaluationDate, rollingWindowStart)) {
      skippedCounts.outside_lookback_window = (skippedCounts.outside_lookback_window || 0) + 1;
      return;
    }

    const rawDirectionLabel = String(row?.stored?.direction || row?.checker?.direction || "").trim().toUpperCase();
    const directionKey = normalizeLayer1Direction(rawDirectionLabel);
    const directionalCallType = classifyDirectionalCallType(rawDirectionLabel);
    if (!directionKey) {
      skippedCounts.no_trade_or_non_directional_rows = (skippedCounts.no_trade_or_non_directional_rows || 0) + 1;
      return;
    }

    const confidencePct = normalizeHeadlineConfidence(row);
    const bucketKey = bucketKeyFromConfidence(confidencePct);
    if (!bucketKey) {
      skippedCounts.missing_confidence_bucket = (skippedCounts.missing_confidence_bucket || 0) + 1;
      diagnosticRows.push(buildNotEvaluatedLayer1Row(config, row, rawDirectionLabel, directionKey, directionalCallType, null, confidencePct, evaluationDate, { reason: "missing_confidence_bucket" }));
      return;
    }

    const weekdayKey = weekdayFromDate(evaluationDate);
    if (!evaluationDate || !weekdayKey || !weekdayTotals[weekdayKey]) {
      skippedCounts.missing_evaluation_date = (skippedCounts.missing_evaluation_date || 0) + 1;
      diagnosticRows.push(buildNotEvaluatedLayer1Row(config, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, evaluationDate, { reason: "missing_evaluation_date" }));
      return;
    }

    const requiredInputs = buildRequiredDistanceInputs(config, contexts.daily, contexts.intraday, evaluationDate);
    if (!requiredInputs.ok) {
      const skipKey = classifySkipReason(requiredInputs.reason);
      skippedCounts[skipKey] = (skippedCounts[skipKey] || 0) + 1;
      diagnosticRows.push(buildNotEvaluatedLayer1Row(config, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, evaluationDate, requiredInputs));
      return;
    }

    const evaluation = evaluateL2lSequence(directionKey, requiredInputs);
    const evaluatedRow = buildEvaluatedLayer1Row(config, contexts, null, row, rawDirectionLabel, directionKey, directionalCallType, bucketKey, confidencePct, requiredInputs, evaluation);
    diagnosticRows.push(evaluatedRow);
    evaluatedRows.push(evaluatedRow);
    addOutcome(weekdayTotals[weekdayKey], evaluatedRow.outcomeKey);
    addOutcome(bucketTotals[bucketKey], evaluatedRow.outcomeKey);
    addOutcome(bucketMatrix[bucketKey][weekdayKey], evaluatedRow.outcomeKey);
  });

  const dayTotals = sumOutcomeCells(Object.values(weekdayTotals));
  const strongPlus = sumOutcomeCells([bucketTotals.STRONG, bucketTotals.VERY_STRONG]);

  return {
    assetCode: config.assetCode,
    assetLabel: config.assetLabel,
    available: true,
    status: "AVAILABLE",
    blocker: null,
    weekdayKeys: config.weekdayKeys,
    instrument: contexts.intraday.instrument || config.instrument || null,
    sourceVendor: config.sourceVendor,
    candleSourceLabel: config.candleSourceLabel,
    dailySourceLabel: config.dailySourceLabel,
    intradaySourceLabel: config.intradaySourceLabel,
    dailySourcePath: relativeRepoPath(config.dailySourcePath),
    intradaySourcePath: relativeRepoPath(config.intradaySourcePath),
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null,
    sourceCoverage: buildSourceCoverage(contexts),
    summaryRowsChecked: Number(checker?.summary?.rows_checked || 0),
    totalCheckerRows: rows.length,
    diagnosticRows,
    evaluatedRows,
    skippedCounts,
    diagnostics: {
      missing_intraday_session: Number(skippedCounts.missing_intraday_session || 0),
      incomplete_intraday_session: Number(skippedCounts.incomplete_intraday_session || 0),
      missing_daily_adr20: Number(skippedCounts.missing_daily_adr20 || 0),
      invalid_daily_adr20: Number(skippedCounts.invalid_daily_adr20 || 0),
      invalid_required_l2l_distance: Number(skippedCounts.invalid_required_l2l_distance || 0),
      no_trade_or_non_directional_rows: Number(skippedCounts.no_trade_or_non_directional_rows || 0),
      unsupported_instrument_rows: 0
    },
    summary: {
      evaluatedCalls: dayTotals.total,
      l2lRangeAvailableWins: dayTotals.wins,
      l2lRangeAvailableLosses: dayTotals.losses,
      l2lRangeAvailablePct: dayTotals.winRatePct,
      strongPlusCalls: strongPlus.total,
      strongPlusL2lRangeAvailablePct: strongPlus.winRatePct
    },
    bucketSummaryRows: buildBucketSummaryRows(bucketTotals),
    weekdayTotals,
    bucketTotals,
    bucketMatrix,
    dayTotals
  };
}

function buildUnavailablePair(config, targetAsset) {
  return {
    pairCode: config.pairCode,
    pairLabel: config.pairLabel,
    targetAssetCode: config.targetAssetCode,
    available: false,
    status: "UNAVAILABLE",
    blocker: targetAsset?.blocker || "Target asset sequence support is unavailable.",
    weekdayKeys: config.weekdayKeys,
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null,
    summary: {
      tradableSignals: 0,
      l2lRangeAvailableWins: 0,
      l2lRangeAvailableLosses: 0,
      l2lRangeAvailablePct: null,
      strongPlusSignals: 0,
      strongPlusL2lRangeAvailablePct: null
    },
    bucketSummaryRows: emptyBucketSummaryRows(),
    weekdayTotals: buildCellMap(config.weekdayKeys),
    bucketTotals: buildCellMap(CONFIDENCE_BUCKETS.map((bucket) => bucket.key)),
    bucketMatrix: Object.fromEntries(CONFIDENCE_BUCKETS.map((bucket) => [bucket.key, buildCellMap(config.weekdayKeys)])),
    dayTotals: summarizeOutcomeCell(createOutcomeCell()),
    tradableRows: [],
    diagnosticRows: [],
    skippedCounts: {},
    diagnostics: {
      missing_intraday_session: Number(targetAsset?.diagnostics?.missing_intraday_session || 0),
      incomplete_intraday_session: Number(targetAsset?.diagnostics?.incomplete_intraday_session || 0),
      missing_daily_adr20: Number(targetAsset?.diagnostics?.missing_daily_adr20 || 0),
      invalid_daily_adr20: Number(targetAsset?.diagnostics?.invalid_daily_adr20 || 0),
      invalid_required_l2l_distance: Number(targetAsset?.diagnostics?.invalid_required_l2l_distance || 0),
      no_trade_or_non_directional_rows: 0,
      unsupported_instrument_rows: Number(targetAsset?.diagnostics?.unsupported_instrument_rows || 0)
    }
  };
}

function buildLayer2PairResearch(config, layer1ByAssetCode, checkers, options = {}) {
  const targetAsset = layer1ByAssetCode[config.targetAssetCode];
  if (!targetAsset?.available) {
    return buildUnavailablePair(config, targetAsset);
  }

  const usdChecker = checkers.USD;
  const targetChecker = checkers[config.targetAssetCode];
  const usdRowsByDate = new Map((Array.isArray(usdChecker?.rows) ? usdChecker.rows : []).map((row) => [String(row?.snapshot_date || "").trim(), row]));
  const targetEvaluatedByPredictionId = new Map(targetAsset.evaluatedRows.map((row) => [row.predictionId, row]));
  const targetDiagnosticByPredictionId = new Map(targetAsset.diagnosticRows.map((row) => [row.predictionId, row]));
  const weekdayTotals = buildCellMap(config.weekdayKeys);
  const bucketTotals = buildCellMap(CONFIDENCE_BUCKETS.map((bucket) => bucket.key));
  const bucketMatrix = Object.fromEntries(CONFIDENCE_BUCKETS.map((bucket) => [bucket.key, buildCellMap(config.weekdayKeys)]));
  const skippedCounts = {};
  const diagnosticRows = [];
  const tradableRows = [];

  (Array.isArray(targetChecker?.rows) ? targetChecker.rows : []).forEach((targetRow) => {
    const snapshotDate = String(targetRow?.snapshot_date || "").trim();
    const usdRow = usdRowsByDate.get(snapshotDate) || null;
    const targetRawDirection = String(targetRow?.stored?.direction || targetRow?.checker?.direction || "").trim().toUpperCase();
    const usdRawDirection = String(usdRow?.stored?.direction || usdRow?.checker?.direction || "").trim().toUpperCase();
    const targetDirection = normalizeLayer1Direction(targetRawDirection);
    const usdDirection = normalizeLayer1Direction(usdRawDirection);
    const targetDirectionalCallType = classifyDirectionalCallType(targetRawDirection);
    const usdDirectionalCallType = classifyDirectionalCallType(usdRawDirection);
    const targetConfidence = normalizeHeadlineConfidence(targetRow);
    const usdConfidence = normalizeHeadlineConfidence(usdRow);
    const combinedConfidencePct = Number.isFinite(targetConfidence) && Number.isFinite(usdConfidence)
      ? Math.min(targetConfidence, usdConfidence)
      : null;
    const bucketKey = bucketKeyFromConfidence(combinedConfidencePct);

    if (!usdRow) {
      skippedCounts.missing_usd_snapshot = (skippedCounts.missing_usd_snapshot || 0) + 1;
      return;
    }

    if (!targetDirection || !usdDirection || targetDirection === usdDirection) {
      skippedCounts.no_trade_or_non_directional_rows = (skippedCounts.no_trade_or_non_directional_rows || 0) + 1;
      return;
    }

    if (!bucketKey) {
      skippedCounts.missing_combined_confidence = (skippedCounts.missing_combined_confidence || 0) + 1;
      diagnosticRows.push({
        predictionId: targetRow?.prediction_id || null,
        snapshotDate,
        date: String(targetRow?.evaluation_inputs?.close_date || "").trim(),
        evaluationDate: String(targetRow?.evaluation_inputs?.close_date || "").trim(),
        layer: "LAYER_2",
        assetOrPair: config.pairCode,
        rawCallDirection: targetRawDirection,
        callDirection: targetDirection,
        directionalCallType: targetDirectionalCallType,
        strengthBucket: null,
        confidencePct: null,
        candleSource: targetAsset.candleSourceLabel,
        instrumentSymbol: targetAsset.instrument,
        numberOf1hCandlesLoaded: 0,
        adr20: null,
        requiredL2lDistance: null,
        fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null,
        triggerSwingPrice: null,
        triggerCandleTime: null,
        triggerPrice: null,
        reached: null,
        margin: null,
        notEvaluatedReason: reasonLabel("missing_combined_confidence"),
        notEvaluatedReasonKey: "missing_combined_confidence",
        targetDirection,
        usdDirection,
        targetRawDirection,
        usdRawDirection,
        usdDirectionalCallType
      });
      return;
    }

    const targetDiagnosticRow = targetDiagnosticByPredictionId.get(targetRow?.prediction_id) || null;
    if (!targetDiagnosticRow) {
      skippedCounts.missing_target_asset_row = (skippedCounts.missing_target_asset_row || 0) + 1;
      return;
    }

    const pairRow = {
      ...targetDiagnosticRow,
      layer: "LAYER_2",
      assetOrPair: config.pairCode,
      pairLabel: config.pairLabel,
      rawCallDirection: targetRawDirection,
      targetDirection,
      usdDirection,
      directionalCallType: targetDirectionalCallType,
      targetRawDirection,
      usdRawDirection,
      usdDirectionalCallType,
      strengthBucket: bucketKey,
      confidencePct: roundNumber(combinedConfidencePct, 4),
      fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
    };
    diagnosticRows.push(pairRow);

    if (pairRow.reached === null) {
      skippedCounts[pairRow.notEvaluatedReasonKey || "missing_target_asset_row"] = (skippedCounts[pairRow.notEvaluatedReasonKey || "missing_target_asset_row"] || 0) + 1;
      return;
    }

    const weekdayKey = weekdayFromDate(pairRow.evaluationDate);
    if (!weekdayTotals[weekdayKey]) {
      skippedCounts.unsupported_weekday = (skippedCounts.unsupported_weekday || 0) + 1;
      return;
    }

    const outcomeKey = pairRow.reached ? "WIN" : "LOSS";
    pairRow.outcomeKey = outcomeKey;
    tradableRows.push(pairRow);
    addOutcome(weekdayTotals[weekdayKey], outcomeKey);
    addOutcome(bucketTotals[bucketKey], outcomeKey);
    addOutcome(bucketMatrix[bucketKey][weekdayKey], outcomeKey);
  });

  const dayTotals = sumOutcomeCells(Object.values(weekdayTotals));
  const strongPlus = sumOutcomeCells([bucketTotals.STRONG, bucketTotals.VERY_STRONG]);

  return {
    pairCode: config.pairCode,
    pairLabel: config.pairLabel,
    targetAssetCode: config.targetAssetCode,
    available: true,
    status: "AVAILABLE",
    blocker: null,
    weekdayKeys: config.weekdayKeys,
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null,
    summary: {
      tradableSignals: dayTotals.total,
      l2lRangeAvailableWins: dayTotals.wins,
      l2lRangeAvailableLosses: dayTotals.losses,
      l2lRangeAvailablePct: dayTotals.winRatePct,
      strongPlusSignals: strongPlus.total,
      strongPlusL2lRangeAvailablePct: strongPlus.winRatePct
    },
    bucketSummaryRows: buildBucketSummaryRows(bucketTotals),
    weekdayTotals,
    bucketTotals,
    bucketMatrix,
    dayTotals,
    tradableRows,
    diagnosticRows,
    skippedCounts,
    diagnostics: {
      missing_intraday_session: Number(skippedCounts.missing_intraday_session || 0),
      incomplete_intraday_session: Number(skippedCounts.incomplete_intraday_session || 0),
      missing_daily_adr20: Number(skippedCounts.missing_daily_adr20 || 0),
      invalid_daily_adr20: Number(skippedCounts.invalid_daily_adr20 || 0),
      invalid_required_l2l_distance: Number(skippedCounts.invalid_required_l2l_distance || 0),
      missing_usd_snapshot: Number(skippedCounts.missing_usd_snapshot || 0),
      missing_combined_confidence: Number(skippedCounts.missing_combined_confidence || 0),
      no_trade_or_non_directional_rows: Number(skippedCounts.no_trade_or_non_directional_rows || 0),
      unsupported_instrument_rows: 0
    }
  };
}

function validateCheckerInvariants(checkers, errors) {
  Object.entries(checkers).forEach(([assetCode, checker]) => {
    const rowCount = Array.isArray(checker?.rows) ? checker.rows.length : 0;
    const rowsChecked = Number(checker?.summary?.rows_checked || 0);
    if (EXPECTED_CHECKER_ROWS[assetCode] !== rowCount) {
      errors.push(`${assetCode}: checker rows ${rowCount} did not match expected ${EXPECTED_CHECKER_ROWS[assetCode]}`);
    }
    if (EXPECTED_CHECKER_ROWS[assetCode] !== rowsChecked) {
      errors.push(`${assetCode}: checker summary rows_checked ${rowsChecked} did not match expected ${EXPECTED_CHECKER_ROWS[assetCode]}`);
    }
  });
}

function validateAvailableAsset(asset, errors) {
  if (asset.assetCode === "BTC") {
    if (Number(asset?.sourceCoverage?.daily?.weekendRowCount || 0) <= 0) {
      errors.push("BTC: daily source coverage did not include weekend rows");
    }
    if (Number(asset?.sourceCoverage?.intraday?.weekendRowCount || 0) <= 0) {
      errors.push("BTC: intraday source coverage did not include weekend sessions");
    }
  } else {
    if (Number(asset?.sourceCoverage?.daily?.weekendRowCount || 0) > 0) {
      errors.push(`${asset.assetCode}: non-BTC daily source included weekend rows`);
    }
    if (Number(asset?.sourceCoverage?.intraday?.weekendRowCount || 0) > 0) {
      errors.push(`${asset.assetCode}: non-BTC intraday source included weekend sessions`);
    }
  }

  asset.evaluatedRows.forEach((row, index) => {
    if (!(row.adr20 > 0)) {
      errors.push(`${asset.assetCode} row ${index + 1}: ADR20 was not positive`);
    }
    if (!(row.requiredL2lDistance > 0)) {
      errors.push(`${asset.assetCode} row ${index + 1}: required L2L distance was not positive`);
    }
    if (row.reached !== true && row.reached !== false) {
      errors.push(`${asset.assetCode} row ${index + 1}: reached must be boolean for evaluated rows`);
    }
    if (row.reached === true && (!row.triggerCandleTime || !Number.isFinite(row.triggerPrice) || !Number.isFinite(row.triggerSwingPrice))) {
      errors.push(`${asset.assetCode} row ${index + 1}: winning row was missing trigger diagnostics`);
    }
  });

  const summaryTotal = asset.summary.l2lRangeAvailableWins + asset.summary.l2lRangeAvailableLosses;
  if (asset.summary.evaluatedCalls !== summaryTotal) {
    errors.push(`${asset.assetCode}: summary evaluated calls did not equal wins + losses`);
  }

  const bucketRollup = sumOutcomeCells(Object.values(asset.bucketTotals));
  const weekdayRollup = sumOutcomeCells(Object.values(asset.weekdayTotals));
  if (bucketRollup.total !== asset.summary.evaluatedCalls || weekdayRollup.total !== asset.summary.evaluatedCalls) {
    errors.push(`${asset.assetCode}: confidence buckets or weekday totals did not reconcile to the asset summary`);
  }
}

function validateAvailablePair(pair, errors) {
  const summaryTotal = pair.summary.l2lRangeAvailableWins + pair.summary.l2lRangeAvailableLosses;
  if (pair.summary.tradableSignals !== summaryTotal) {
    errors.push(`${pair.pairCode}: tradable signals did not equal wins + losses`);
  }

  const bucketRollup = sumOutcomeCells(Object.values(pair.bucketTotals));
  const weekdayRollup = sumOutcomeCells(Object.values(pair.weekdayTotals));
  if (bucketRollup.total !== pair.summary.tradableSignals || weekdayRollup.total !== pair.summary.tradableSignals) {
    errors.push(`${pair.pairCode}: confidence buckets or weekday totals did not reconcile to the pair summary`);
  }
}

function aggregateStrengthRows(items, totalKey) {
  return CONFIDENCE_BUCKETS.map((bucket) => {
    const totals = sumOutcomeCells(items.map((item) => item.bucketTotals?.[bucket.key]));
    return {
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      total: totals.total,
      wins: totals.wins,
      losses: totals.losses,
      l2lRangeAvailablePct: totals.winRatePct
    };
  }).filter((row) => row.total > 0 || totalKey === "keep_all");
}

function aggregateSignalsVsStrongPlus(items, type) {
  const totals = sumOutcomeCells(items.map((item) => ({
    total: type === "layer1" ? item.summary.evaluatedCalls : item.summary.tradableSignals,
    wins: item.summary.l2lRangeAvailableWins,
    losses: item.summary.l2lRangeAvailableLosses
  })));
  const strongPlus = sumOutcomeCells(items.flatMap((item) => [item.bucketTotals?.STRONG, item.bucketTotals?.VERY_STRONG]));
  return [
    {
      cohort: "All Signals",
      total: totals.total,
      wins: totals.wins,
      losses: totals.losses,
      l2lRangeAvailablePct: totals.winRatePct
    },
    {
      cohort: "Strong+",
      total: strongPlus.total,
      wins: strongPlus.wins,
      losses: strongPlus.losses,
      l2lRangeAvailablePct: strongPlus.winRatePct
    }
  ];
}

function reliabilityLabelFromRate(opportunityRatePct) {
  if (!Number.isFinite(opportunityRatePct)) return "Not yet available";
  return opportunityRatePct >= 60 ? "Reliable" : "Not Reliable";
}

function buildEntryReliabilityRows(rows = []) {
  const bucketRows = [
    ...CONFIDENCE_BUCKETS.map((bucket) => ({
      cohortKey: bucket.key,
      cohortLabel: bucket.label,
      filter: (row) => row.strengthBucket === bucket.key
    })),
    {
      cohortKey: "STRONG_PLUS",
      cohortLabel: "Strong+",
      filter: (row) => row.strengthBucket === "STRONG" || row.strengthBucket === "VERY_STRONG"
    },
    {
      cohortKey: "ALL",
      cohortLabel: "All",
      filter: () => true
    }
  ];

  return bucketRows.map((bucket) => {
    const matchingRows = rows.filter(bucket.filter);
    const totals = summarizeOutcomeCell({
      total: matchingRows.length,
      wins: matchingRows.filter((row) => row.outcomeKey === "WIN").length,
      losses: matchingRows.filter((row) => row.outcomeKey === "LOSS").length
    });
    return {
      cohortKey: bucket.cohortKey,
      cohortLabel: bucket.cohortLabel,
      total: totals.total,
      wins: totals.wins,
      losses: totals.losses,
      opportunityRatePct: totals.winRatePct,
      reliabilityLabel: reliabilityLabelFromRate(totals.winRatePct)
    };
  });
}

function buildEntryReliabilityGroups(rows = []) {
  return ENTRY_RELIABILITY_GROUPS.map((group) => {
    const groupRows = rows.filter((row) => group.directionalCallTypes.includes(row.directionalCallType));
    return {
      groupKey: group.key,
      groupLabel: group.label,
      description: group.description,
      rows: buildEntryReliabilityRows(groupRows)
    };
  });
}

function buildOutput(layer1Assets, layer2Pairs) {
  const availableLayer1 = layer1Assets.filter((asset) => asset.available);
  const availableLayer2 = layer2Pairs.filter((pair) => pair.available);

  return {
    meta: {
      generated_at: new Date().toISOString(),
      source: "backtester/scripts/validate_adr_reach_research.js",
      evaluation_window: "following 24hrs",
      lookback_days: null,
      metric_name: "L2L 1H Sequence Research",
      target_definition: "Walk 1H candles forward through the call day. Bullish rows win when a later candle high reaches the prior lowest low plus required L2L distance. Bearish rows win when a later candle low reaches the prior highest high minus required L2L distance.",
      reference_price_policy: "Required L2L distance is dynamic 50% ADR20 from daily candles. Fixed legacy L2L values are preserved as diagnostics only."
    },
    source_audit: layer1Assets.map((asset) => ({
      assetCode: asset.assetCode,
      assetLabel: asset.assetLabel,
      available: asset.available,
      instrument: asset.instrument || null,
      sourceVendor: asset.sourceVendor || null,
      candleSourceLabel: asset.candleSourceLabel || null,
      dailySourceLabel: asset.dailySourceLabel || null,
      intradaySourceLabel: asset.intradaySourceLabel || null,
      dailySourcePath: asset.dailySourcePath || null,
      intradaySourcePath: asset.intradaySourcePath || null,
      sourceCoverage: asset.sourceCoverage || null,
      fixedReferenceL2lDistance: asset.fixedReferenceL2lDistance ?? null,
      diagnostics: asset.diagnostics || null,
      blocker: asset.blocker || null
    })),
    layer1: {
      summary_rows: layer1Assets.map((asset) => ({
        assetCode: asset.assetCode,
        assetLabel: asset.assetLabel,
        available: asset.available,
        blocker: asset.blocker || null,
        evaluatedCalls: asset.summary.evaluatedCalls,
        l2lRangeAvailableWins: asset.summary.l2lRangeAvailableWins,
        l2lRangeAvailableLosses: asset.summary.l2lRangeAvailableLosses,
        l2lRangeAvailablePct: asset.summary.l2lRangeAvailablePct,
        strongPlusCalls: asset.summary.strongPlusCalls,
        strongPlusL2lRangeAvailablePct: asset.summary.strongPlusL2lRangeAvailablePct,
        diagnostics: asset.diagnostics
      })),
      strength_summary_rows: aggregateStrengthRows(availableLayer1, "keep_all"),
      comparison_rows: aggregateSignalsVsStrongPlus(availableLayer1, "layer1"),
      entry_reliability_groups: buildEntryReliabilityGroups(availableLayer1.flatMap((asset) => asset.evaluatedRows)),
      assets: layer1Assets.map((asset) => ({
        assetCode: asset.assetCode,
        assetLabel: asset.assetLabel,
        available: asset.available,
        blocker: asset.blocker || null,
        instrument: asset.instrument || null,
        fixedReferenceL2lDistance: asset.fixedReferenceL2lDistance ?? null,
        weekdayKeys: asset.weekdayKeys,
        summary: asset.summary,
        bucketSummaryRows: asset.bucketSummaryRows,
        dayTotals: asset.dayTotals,
        weekdayTotals: asset.weekdayTotals,
        bucketTotals: asset.bucketTotals,
        bucketMatrix: asset.bucketMatrix,
        diagnostics: asset.diagnostics,
        evaluatedRowsSample: asset.evaluatedRows.slice(0, 25),
        diagnosticRowsSample: asset.diagnosticRows.slice(0, 50)
      }))
    },
    layer2: {
      summary_rows: layer2Pairs.map((pair) => ({
        pairCode: pair.pairCode,
        pairLabel: pair.pairLabel,
        targetAssetCode: pair.targetAssetCode,
        available: pair.available,
        blocker: pair.blocker || null,
        tradableSignals: pair.summary.tradableSignals,
        l2lRangeAvailableWins: pair.summary.l2lRangeAvailableWins,
        l2lRangeAvailableLosses: pair.summary.l2lRangeAvailableLosses,
        l2lRangeAvailablePct: pair.summary.l2lRangeAvailablePct,
        strongPlusSignals: pair.summary.strongPlusSignals,
        strongPlusL2lRangeAvailablePct: pair.summary.strongPlusL2lRangeAvailablePct,
        diagnostics: pair.diagnostics
      })),
      strength_summary_rows: aggregateStrengthRows(availableLayer2, "keep_all"),
      comparison_rows: aggregateSignalsVsStrongPlus(availableLayer2, "layer2"),
      entry_reliability_groups: buildEntryReliabilityGroups(availableLayer2.flatMap((pair) => pair.tradableRows)),
      pairs: layer2Pairs.map((pair) => ({
        pairCode: pair.pairCode,
        pairLabel: pair.pairLabel,
        targetAssetCode: pair.targetAssetCode,
        available: pair.available,
        blocker: pair.blocker || null,
        fixedReferenceL2lDistance: pair.fixedReferenceL2lDistance ?? null,
        weekdayKeys: pair.weekdayKeys,
        summary: pair.summary,
        bucketSummaryRows: pair.bucketSummaryRows,
        dayTotals: pair.dayTotals,
        weekdayTotals: pair.weekdayTotals,
        bucketTotals: pair.bucketTotals,
        bucketMatrix: pair.bucketMatrix,
        diagnostics: pair.diagnostics,
        tradableRowsSample: pair.tradableRows.slice(0, 25),
        diagnosticRowsSample: pair.diagnosticRows.slice(0, 50)
      }))
    }
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checkers = Object.fromEntries(Object.entries(CHECKER_PATHS).map(([assetCode, filePath]) => [assetCode, loadChecker(filePath)]));
  const rollingWindowStart = args.start_date || null;
  const layer1Assets = ASSET_CONFIGS.map((config) => buildLayer1AssetResearch(config, checkers[config.assetCode], { rollingWindowStart }));
  const layer1ByAssetCode = Object.fromEntries(layer1Assets.map((asset) => [asset.assetCode, asset]));
  const layer2Pairs = PAIR_CONFIGS.map((config) => buildLayer2PairResearch(config, layer1ByAssetCode, checkers, { rollingWindowStart }));
  const output = buildOutput(layer1Assets, layer2Pairs);
  const errors = [];

  validateCheckerInvariants(checkers, errors);
  layer1Assets.filter((asset) => asset.available).forEach((asset) => validateAvailableAsset(asset, errors));
  layer2Pairs.filter((pair) => pair.available).forEach((pair) => validateAvailablePair(pair, errors));

  if (args.write === "true") {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  } else if (!fs.existsSync(OUTPUT_PATH)) {
    errors.push("L2L 1H sequence artifact is missing. Run with --write to generate data/adr-reach-research.json.");
  } else {
    const existing = fs.readFileSync(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(existing);
    const comparableCurrent = JSON.stringify({ ...output, meta: { ...output.meta, generated_at: null } });
    const comparableExisting = JSON.stringify({ ...parsed, meta: { ...parsed.meta, generated_at: null } });
    if (comparableCurrent !== comparableExisting) {
      errors.push("L2L 1H sequence artifact is stale relative to the current builder output.");
    }
  }

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    artifact_path: OUTPUT_PATH,
    layer1_summary: output.layer1.summary_rows,
    layer2_summary: output.layer2.summary_rows,
    available_layer1_assets: layer1Assets.filter((asset) => asset.available).map((asset) => asset.assetCode),
    available_layer2_pairs: layer2Pairs.filter((pair) => pair.available).map((pair) => pair.pairCode),
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
  ASSET_CONFIGS,
  CHECKER_PATHS,
  CONFIDENCE_BUCKETS,
  EXPECTED_CHECKER_ROWS,
  LOOKBACK_DAYS,
  OUTPUT_PATH,
  PAIR_CONFIGS,
  buildLayer1AssetResearch,
  buildLayer2PairResearch,
  buildOutput,
  buildRollingWindowStartDate,
  inRollingWindow,
  loadChecker,
  validateAvailableAsset,
  validateAvailablePair,
  validateCheckerInvariants
};
