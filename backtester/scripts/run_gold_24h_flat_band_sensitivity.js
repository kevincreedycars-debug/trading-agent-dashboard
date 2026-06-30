#!/usr/bin/env node

const {
  classifyMarketOutcome,
  scoreEvaluationResult
} = require("../lib/outcome_direction");
const {
  fetchAllRows,
  parseArgs,
  requireEnv
} = require("../lib/historical_common");
const { isValidTradingSessionDay } = require("../lib/timeframe_windows");

const DEFAULT_START = "2024-01-02";
const DEFAULT_END = "2026-04-30";
const DEFAULT_THRESHOLDS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60];

async function loadGoldRows(supabaseUrl, serviceRoleKey, startDate, endDate) {
  const rows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "research_prediction_evaluations",
    (url) => {
      url.searchParams.set(
        "select",
        [
          "prediction_id",
          "call_date",
          "timeframe",
          "agent_direction",
          "agent_conviction",
          "open_price",
          "close_price",
          "pct_change",
          "result_reason",
          "evaluation_payload",
          "observation:research_observations!inner(agent_name,source_workflow)"
        ].join(",")
      );
      url.searchParams.set("asset_code", "eq.GOLD");
      url.searchParams.set("evaluated_market", "eq.XAUUSD");
      url.searchParams.set("evaluation_mode", "eq.primary");
      url.searchParams.set("timeframe", "eq.following 24hrs");
      url.searchParams.set("call_date", `gte.${startDate}`);
      url.searchParams.append("call_date", `lte.${endDate}`);
      url.searchParams.set("observation.agent_name", "eq.GOLD");
      url.searchParams.set("observation.source_workflow", "eq.gold_historical_replay");
      url.searchParams.set("order", "call_date.asc");
    }
  );
  return rows.filter((row) => isValidTradingSessionDay(row.call_date));
}

function summariseThreshold(rows, threshold) {
  const counts = {
    CORRECT: 0,
    WRONG: 0,
    FLAT: 0,
    NO_CALL: 0,
    NOT_EVALUABLE: 0
  };

  for (const row of rows) {
    const evaluable = row?.evaluation_payload?.evaluable !== false &&
      Number.isFinite(Number(row.open_price)) &&
      Number.isFinite(Number(row.close_price)) &&
      Number(row.open_price) > 0 &&
      Number(row.close_price) > 0;

    const marketOutcome = classifyMarketOutcome(row.pct_change, threshold);
    const scored = scoreEvaluationResult({
      agentDirection: row.agent_direction,
      marketOutcomeDirection: marketOutcome.market_outcome_direction,
      notEvaluableReason: evaluable ? null : "market_price_missing"
    });

    counts[scored.result] = (counts[scored.result] || 0) + 1;
  }

  const evaluableRows = counts.CORRECT + counts.WRONG + counts.FLAT + counts.NO_CALL;
  const directionalRows = counts.CORRECT + counts.WRONG;
  const exFlatWinRate = directionalRows ? Number(((counts.CORRECT / directionalRows) * 100).toFixed(1)) : null;
  const flatRate = evaluableRows ? Number(((counts.FLAT / evaluableRows) * 100).toFixed(1)) : null;
  const noCallRate = evaluableRows ? Number(((counts.NO_CALL / evaluableRows) * 100).toFixed(1)) : null;

  return {
    flat_threshold: threshold,
    evaluable_rows: evaluableRows,
    directional_rows: directionalRows,
    correct: counts.CORRECT,
    wrong: counts.WRONG,
    flat: counts.FLAT,
    no_call: counts.NO_CALL,
    not_evaluable: counts.NOT_EVALUABLE,
    ex_flat_win_rate_pct: exFlatWinRate,
    flat_rate_pct: flatRate,
    no_call_rate_pct: noCallRate
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.start || DEFAULT_START;
  const endDate = args.end || DEFAULT_END;
  const thresholds = args.thresholds
    ? String(args.thresholds).split(",").map((value) => Number(value.trim())).filter(Number.isFinite)
    : DEFAULT_THRESHOLDS;

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const rows = await loadGoldRows(supabaseUrl, serviceRoleKey, startDate, endDate);
  const summary = thresholds.map((threshold) => summariseThreshold(rows, threshold));

  console.log(JSON.stringify({
    date_range: {
      start: startDate,
      end: endDate
    },
    source_rows: rows.length,
    thresholds: summary
  }, null, 2));
}

if (require.main === module) {
  run().catch((error) => {
    console.error("GOLD flat-band sensitivity run failed.");
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}
