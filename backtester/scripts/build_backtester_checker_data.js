#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  fetchAllRows,
  parseArgs,
  requireEnv
} = require("../lib/historical_common");
const { evaluateSingleMarket } = require("../lib/outcome_evaluation");
const { computeHeadlineConfidenceFromRow } = require("../lib/headline_confidence");
const { buildReplayOutput, parseLogicVersion } = require("../replay/usd/usd_replay_core");

const DEFAULT_START = "2024-01-01";
const DEFAULT_END = "2024-01-31";
const DEFAULT_OUTPUT = path.resolve(__dirname, "../../data/backtester-checker-usd-24h-2024-01.json");
const DEFAULT_CALL_TIME_ET = "09:30:00";
const PERCENT_TOLERANCE = 0.5;

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function addDays(dateLiteral, days) {
  const date = new Date(`${dateLiteral}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeDirection(value) {
  return value === null || value === undefined ? null : String(value).trim().toUpperCase();
}

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function percentDiff(stored, rerun) {
  const left = toNumber(stored);
  const right = toNumber(rerun);
  if (left === null || right === null) return null;
  return Number((right - left).toFixed(3));
}

function compareExact(label, storedValue, rerunValue) {
  const stored = storedValue === null || storedValue === undefined ? null : String(storedValue);
  const rerun = rerunValue === null || rerunValue === undefined ? null : String(rerunValue);
  return {
    key: label,
    label,
    type: "exact",
    stored,
    rerun,
    difference: stored === rerun ? "0" : `${stored || "—"} -> ${rerun || "—"}`,
    status: stored === rerun ? "PASS" : "FAIL"
  };
}

function compareNumeric(label, storedValue, rerunValue, tolerance = PERCENT_TOLERANCE) {
  const stored = toNumber(storedValue);
  const rerun = toNumber(rerunValue);
  if (stored === null || rerun === null) {
    return {
      key: label,
      label,
      type: "numeric",
      stored,
      rerun,
      difference: null,
      tolerance,
      status: "MISSING"
    };
  }

  const difference = Number((rerun - stored).toFixed(3));
  const exact = Math.abs(difference) < 0.0001;
  return {
    key: label,
    label,
    type: "numeric",
    stored,
    rerun,
    difference,
    tolerance,
    status: exact ? "PASS" : (Math.abs(difference) <= tolerance ? "TOLERANCE" : "FAIL")
  };
}

function fieldStatusSummary(comparisons = []) {
  if (comparisons.some(item => item.status === "MISSING")) return "MISSING_DATA";
  if (comparisons.some(item => item.status === "FAIL")) return "FAIL";
  if (comparisons.some(item => item.status === "TOLERANCE")) return "TOLERANCE_PASS";
  return "PASS";
}

function loadStoredPredictions(supabaseUrl, serviceRoleKey, startDate, endDate) {
  return fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "research_timeframe_predictions",
    (url) => {
      url.searchParams.set(
        "select",
        [
          "id",
          "observation_id",
          "timeframe",
          "legacy_timeframe_key",
          "predicted_direction",
          "predicted_conviction",
          "bull_case_pct",
          "bear_case_pct",
          "net_edge_pct",
          "participation_pct",
          "verdict_strength",
          "weighted_score",
          "conviction_model",
          "factor_breakdown",
          "logic_document_version",
          "observation:research_observations!inner(id,snapshot_date,asset_code,agent_name,source_workflow,market_snapshot)"
        ].join(",")
      );
      url.searchParams.set("timeframe", "eq.following 24hrs");
      url.searchParams.set("observation.snapshot_date", `gte.${startDate}`);
      url.searchParams.append("observation.snapshot_date", `lte.${endDate}`);
      url.searchParams.set("observation.agent_name", "eq.USD");
      url.searchParams.set("observation.source_workflow", "eq.usd_historical_replay");
      url.searchParams.set("order", "observation(snapshot_date).asc");
    }
  );
}

function loadStoredEvaluations(supabaseUrl, serviceRoleKey, startDate, endDate) {
  return fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "research_prediction_evaluations",
    (url) => {
      url.searchParams.set("select", "prediction_id,result,open_price,close_price,pct_change,evaluated_market,evaluation_mode,call_time_et,close_time_et,agent_direction,agent_conviction");
      url.searchParams.set("timeframe", "eq.following 24hrs");
      url.searchParams.set("evaluated_market", "eq.DXY");
      url.searchParams.set("evaluation_mode", "eq.primary");
      url.searchParams.set("call_date", `gte.${startDate}`);
      url.searchParams.append("call_date", `lte.${endDate}`);
      url.searchParams.set("order", "call_date.asc");
    }
  );
}

function loadSnapshots(supabaseUrl, serviceRoleKey, startDate, endDate) {
  return fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "historical_usd_market_snapshots",
    (url) => {
      url.searchParams.set("select", "*");
      url.searchParams.set("snapshot_date", `gte.${startDate}`);
      url.searchParams.append("snapshot_date", `lte.${endDate}`);
      url.searchParams.set("order", "snapshot_date.asc");
    }
  );
}

function loadMacroSeries(supabaseUrl, serviceRoleKey, startDate, endDate) {
  return fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "historical_macro_series",
    (url) => {
      url.searchParams.set("select", "series_key,observation_date,value_numeric");
      url.searchParams.set("series_key", "in.(dxy_level)");
      url.searchParams.set("observation_date", `gte.${startDate}`);
      url.searchParams.append("observation_date", `lte.${endDate}`);
      url.searchParams.set("order", "observation_date.asc");
    }
  );
}

function buildSeriesMap(rows, keyField, valueField) {
  const map = new Map();
  for (const row of rows) {
    map.set(`${row[keyField]}|${row.observation_date}`, toNumber(row[valueField]));
  }
  return map;
}

function evaluationRank(row) {
  const result = String(row?.result || "").toUpperCase();
  const openPrice = toNumber(row?.open_price);
  const closePrice = toNumber(row?.close_price);
  const closeTime = row?.close_time_et ? new Date(row.close_time_et).getTime() : 0;
  return [
    result === "NOT_EVALUABLE" ? 0 : 1,
    Number.isFinite(openPrice) && Number.isFinite(closePrice) ? 1 : 0,
    Number.isFinite(closeTime) ? closeTime : 0
  ];
}

function compareRank(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a === b) continue;
    return a - b;
  }
  return 0;
}

function buildEvaluationMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const existing = map.get(row.prediction_id);
    if (!existing || compareRank(evaluationRank(existing), evaluationRank(row)) < 0) {
      map.set(row.prediction_id, row);
    }
  }
  return map;
}

function marketValueFromSnapshot(market, marketSnapshot) {
  if (market === "DXY") return toNumber(marketSnapshot?.dxy_level);
  return null;
}

function marketValueFromSeries(market, closeDate, macroMap) {
  if (market === "DXY") return macroMap.get(`dxy_level|${closeDate}`) ?? null;
  return null;
}

function normalizeCallTimeEt(value) {
  if (!value) return DEFAULT_CALL_TIME_ET;
  const text = String(value);
  const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})/);
  if (timeMatch) return timeMatch[1];
  const shortMatch = text.match(/(\d{2}:\d{2})/);
  if (shortMatch) return `${shortMatch[1]}:00`;
  return DEFAULT_CALL_TIME_ET;
}

function formatJsonValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number(value.toFixed(3));
  return value;
}

function compareFactorBreakdown(storedBreakdown, rerunBreakdown) {
  const factorKeys = Array.from(new Set([
    ...Object.keys(safeObject(storedBreakdown)),
    ...Object.keys(safeObject(rerunBreakdown))
  ])).sort();

  return factorKeys.map((factorKey) => {
    const stored = safeObject(storedBreakdown)[factorKey] || {};
    const rerun = safeObject(rerunBreakdown)[factorKey] || {};
    const signal = compareExact(`${factorKey} signal`, stored.signal || null, rerun.signal || null);
    const weight = compareNumeric(`${factorKey} weight`, stored.weight, rerun.weight);
    return {
      factor_key: factorKey,
      signal,
      weight,
      status: fieldStatusSummary([signal, weight])
    };
  });
}

function storedPredictionConviction(prediction) {
  const convictionModel = safeObject(prediction?.conviction_model);
  return (
    toNumber(convictionModel.legacy_floor_conviction) ??
    toNumber(convictionModel.raw_conviction) ??
    toNumber(convictionModel.base_conviction) ??
    toNumber(convictionModel.final_conviction) ??
    toNumber(prediction?.predicted_conviction)
  );
}

function buildRowComparison(prediction, snapshot, storedEvaluation, macroMap) {
  if (!snapshot || !storedEvaluation) {
    return {
      prediction_id: prediction.id,
      snapshot_date: prediction.observation?.snapshot_date || null,
      status: "MISSING_DATA",
      missing: {
        snapshot: !snapshot,
        evaluation: !storedEvaluation
      }
    };
  }

  const logicDocumentVersion = prediction.logic_document_version || parseLogicVersion();
  const rerunOutput = buildReplayOutput(snapshot, logicDocumentVersion);
  const rerun24h = rerunOutput.timeframe_models.following_24hrs;
  const callTimeEt = normalizeCallTimeEt(storedEvaluation.call_time_et);
  const closeDate = storedEvaluation.close_time_et ? String(storedEvaluation.close_time_et).slice(0, 10) : addDays(snapshot.snapshot_date, 1);
  const openPrice = marketValueFromSnapshot("DXY", snapshot) ?? toNumber(storedEvaluation.open_price);
  const closePrice = marketValueFromSeries("DXY", closeDate, macroMap) ?? toNumber(storedEvaluation.close_price);
  const rerunEvaluation = evaluateSingleMarket({
    assetCode: "USD",
    timeframe: "following 24hrs",
    callDate: snapshot.snapshot_date,
    callTimeEt,
    agentDirection: rerun24h.direction,
    agentConviction: rerun24h.conviction,
    evaluatedMarket: "DXY",
    openPrice,
    closePrice,
    evaluationVersion: "phase1_outcome_eval_v1",
    marketRelationship: "direct",
    evaluationMode: "primary"
  });

  const storedWeighted = safeObject(prediction.weighted_score);
  const rerunWeighted = safeObject(rerun24h.weighted_score);
  const storedConvictionModel = safeObject(prediction.conviction_model);
  const rerunConvictionModel = safeObject(rerun24h.conviction_model);
  const storedHeadlineConfidence = computeHeadlineConfidenceFromRow({
    ...prediction,
    predicted_direction: prediction.predicted_direction,
    conviction_model: storedConvictionModel
  }).value;
  const rerunHeadlineConfidence = computeHeadlineConfidenceFromRow({
    predicted_direction: rerun24h.direction,
    bull_case_pct: rerunConvictionModel.bullish_argument_pct,
    bear_case_pct: rerunConvictionModel.bearish_argument_pct,
    participation_pct: rerunConvictionModel.directional_participation_pct,
    net_edge_pct: rerunConvictionModel.net_edge_pct,
    conviction_model: rerunConvictionModel
  }).value;
  const storedReplayConviction = storedPredictionConviction(prediction);
  const rerunReplayConviction = storedPredictionConviction({ conviction_model: rerunConvictionModel, predicted_conviction: rerun24h.conviction });

  const comparisons = [
    compareExact("Direction", normalizeDirection(prediction.predicted_direction), normalizeDirection(rerun24h.direction)),
    compareNumeric("Predicted Conviction %", storedReplayConviction, rerunReplayConviction),
    compareNumeric("Headline Confidence %", storedHeadlineConfidence, rerunHeadlineConfidence),
    compareExact("Strength Bucket", prediction.verdict_strength || null, rerunConvictionModel.confidence_strength || null),
    compareNumeric("Bull Case %", prediction.bull_case_pct, rerunConvictionModel.bullish_argument_pct),
    compareNumeric("Bear Case %", prediction.bear_case_pct, rerunConvictionModel.bearish_argument_pct),
    compareNumeric("Net Edge %", prediction.net_edge_pct, rerunConvictionModel.net_edge_pct),
    compareNumeric("Participation %", prediction.participation_pct, rerunConvictionModel.directional_participation_pct),
    compareNumeric("Active Directional Weight", storedWeighted.active_weight, rerunWeighted.active_weight),
    compareNumeric("Bull Weighted Total", storedWeighted.bullish_weight, rerunWeighted.bullish_weight),
    compareNumeric("Bear Weighted Total", storedWeighted.bearish_weight, rerunWeighted.bearish_weight),
    compareExact("Evaluation Result", storedEvaluation.result || null, rerunEvaluation.result || null)
  ];

  const factorComparisons = compareFactorBreakdown(prediction.factor_breakdown, rerun24h.factor_breakdown);
  const overallStatus = fieldStatusSummary([
    ...comparisons,
    ...factorComparisons.flatMap(item => [item.signal, item.weight])
  ]);

  return {
    prediction_id: prediction.id,
    snapshot_date: prediction.observation.snapshot_date,
    timeframe: prediction.timeframe,
    stored: {
      direction: prediction.predicted_direction,
      predicted_conviction: storedReplayConviction,
      displayed_headline_confidence_pct: storedHeadlineConfidence,
      headline_confidence_pct: storedHeadlineConfidence,
      strength_bucket: prediction.verdict_strength,
      bull_case_pct: prediction.bull_case_pct,
      bear_case_pct: prediction.bear_case_pct,
      net_edge_pct: prediction.net_edge_pct,
      participation_pct: prediction.participation_pct,
      active_directional_weight: storedWeighted.active_weight ?? null,
      bull_weighted_total: storedWeighted.bullish_weight ?? null,
      bear_weighted_total: storedWeighted.bearish_weight ?? null,
      evaluation_result: storedEvaluation.result || null,
      weighted_score: storedWeighted,
      conviction_model: storedConvictionModel
    },
    checker: {
      direction: rerun24h.direction,
      predicted_conviction: rerunReplayConviction,
      displayed_headline_confidence_pct: rerunHeadlineConfidence,
      headline_confidence_pct: rerunHeadlineConfidence,
      strength_bucket: rerunConvictionModel.confidence_strength || null,
      bull_case_pct: rerunConvictionModel.bullish_argument_pct ?? null,
      bear_case_pct: rerunConvictionModel.bearish_argument_pct ?? null,
      net_edge_pct: rerunConvictionModel.net_edge_pct ?? null,
      participation_pct: rerunConvictionModel.directional_participation_pct ?? null,
      active_directional_weight: rerunWeighted.active_weight ?? null,
      bull_weighted_total: rerunWeighted.bullish_weight ?? null,
      bear_weighted_total: rerunWeighted.bearish_weight ?? null,
      evaluation_result: rerunEvaluation.result || null,
      weighted_score: rerunWeighted,
      conviction_model: rerunConvictionModel
    },
    differences: comparisons,
    factor_comparisons: factorComparisons,
    status: overallStatus,
    evaluation_inputs: {
      open_price: formatJsonValue(openPrice),
      close_price: formatJsonValue(closePrice),
      close_date: closeDate
    }
  };
}

function summarizeRows(rows) {
  const summary = {
    rows_checked: rows.length,
    pass: 0,
    tolerance_pass: 0,
    fail: 0,
    missing_data: 0,
    exact_matches: 0
  };

  for (const row of rows) {
    if (row.status === "PASS") {
      summary.pass += 1;
      summary.exact_matches += 1;
    } else if (row.status === "TOLERANCE_PASS") {
      summary.tolerance_pass += 1;
    } else if (row.status === "FAIL") {
      summary.fail += 1;
    } else {
      summary.missing_data += 1;
    }
  }

  return summary;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.start || DEFAULT_START;
  const endDate = args.end || DEFAULT_END;
  const outputPath = path.resolve(args.output || DEFAULT_OUTPUT);

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const macroEndDate = addDays(endDate, 7);

  const [predictions, evaluations, snapshots, macroRows] = await Promise.all([
    loadStoredPredictions(supabaseUrl, serviceRoleKey, startDate, endDate),
    loadStoredEvaluations(supabaseUrl, serviceRoleKey, startDate, endDate),
    loadSnapshots(supabaseUrl, serviceRoleKey, startDate, endDate),
    loadMacroSeries(supabaseUrl, serviceRoleKey, startDate, macroEndDate)
  ]);

  const evaluationByPredictionId = buildEvaluationMap(evaluations);
  const snapshotByDate = new Map(snapshots.map(row => [row.snapshot_date, row]));
  const macroMap = buildSeriesMap(macroRows, "series_key", "value_numeric");

  const rows = predictions.map(prediction => {
    const snapshotDate = prediction.observation?.snapshot_date || null;
    return buildRowComparison(
      prediction,
      snapshotByDate.get(snapshotDate) || null,
      evaluationByPredictionId.get(prediction.id) || null,
      macroMap
    );
  });

  const summary = summarizeRows(rows);
  const selectedRowId = rows.find(row => row.status === "FAIL")?.prediction_id
    || rows.find(row => row.status === "TOLERANCE_PASS")?.prediction_id
    || rows[0]?.prediction_id
    || null;

  const payload = {
    meta: {
      generated_at: new Date().toISOString(),
      asset: "USD",
      timeframe: "following 24hrs",
      date_range: { start: startDate, end: endDate },
      replay_logic_source: "backtester/replay/usd/usd_replay_core.js",
      evaluation_logic_source: "backtester/lib/outcome_evaluation.js",
      tolerance_percentage_points: PERCENT_TOLERANCE
    },
    summary,
    selected_row_id: selectedRowId,
    fields_compared: [
      "direction",
      "predicted_conviction",
      "headline_confidence_pct",
      "strength_bucket",
      "bull_case_pct",
      "bear_case_pct",
      "net_edge_pct",
      "participation_pct",
      "active_directional_weight",
      "bull_weighted_total",
      "bear_weighted_total",
      "factor_scores",
      "evaluation_result"
    ],
    rows
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output_path: outputPath,
    rows_checked: summary.rows_checked,
    pass: summary.pass,
    tolerance_pass: summary.tolerance_pass,
    fail: summary.fail,
    missing_data: summary.missing_data
  }, null, 2));
}

if (require.main === module) {
  run().catch((error) => {
    console.error("Backtester checker data build failed.");
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  run
};
