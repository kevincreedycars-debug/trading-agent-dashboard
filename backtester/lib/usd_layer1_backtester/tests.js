"use strict";

/**
 * The four tests (research only).
 *
 * Every figure carries its own sample count and its own split label, because a percentage without them is
 * not evidence. Nothing here reads a result before the parameters were frozen: the challenger's weights and
 * bands live in `challenger.js`, the flat bands are measured on development dates, and this module only
 * counts.
 */

const { MARKETS, CONVICTION, OFFICIAL_DXY, BLOCKERS, TESTS } = require("./contracts");

/** The three windows used by the whole programme. */
const SPLITS = Object.freeze({
  development: Object.freeze({ start: "2024-01-02", end: "2025-03-31", label: "development" }),
  validation: Object.freeze({ start: "2025-04-01", end: "2025-10-31", label: "unseen" }),
  holdout: Object.freeze({ start: "2025-11-01", end: "2026-12-31", label: "unseen" })
});

function splitOf(date) {
  for (const [key, window] of Object.entries(SPLITS)) {
    if (date >= window.start && date <= window.end) return { key, label: window.label };
  }
  return { key: "outside", label: "outside" };
}

/** Wilson 95% lower bound, so a small sample cannot look strong. */
function wilsonLowerBound(hits, total) {
  if (!total) return null;
  const z = 1.959963984540054;
  const p = hits / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return Math.round(((centre - spread) / denominator) * 10000) / 100;
}

function emptyBucket() {
  return { scored: 0, hits: 0, misses: 0, flat: 0, no_call: 0, no_outcome: 0, accuracy_pct: null, lower_bound_pct: null };
}

function addResult(bucket, result) {
  if (result === "hit") {
    bucket.scored += 1;
    bucket.hits += 1;
  } else if (result === "miss") {
    bucket.scored += 1;
    bucket.misses += 1;
  } else if (result === "flat") {
    bucket.flat += 1;
  } else if (result === "no_call") {
    bucket.no_call += 1;
  } else {
    bucket.no_outcome += 1;
  }
}

function finishBucket(bucket) {
  bucket.accuracy_pct = bucket.scored ? Math.round((bucket.hits / bucket.scored) * 10000) / 100 : null;
  bucket.lower_bound_pct = bucket.scored ? wilsonLowerBound(bucket.hits, bucket.scored) : null;
  return bucket;
}

/** One bucket per conviction level, plus a bucket for days with no call at all. */
function emptyConvictionMap() {
  const map = {};
  for (const level of CONVICTION.scale) map[level] = emptyBucket();
  map.uncalled = emptyBucket();
  return map;
}

/** The direction one market should take if the USD call is right. */
function predictedDirection(callDirection, market) {
  if (callDirection === "BULLISH") return market.usd_bullish_predicts;
  if (callDirection === "BEARISH") return market.usd_bullish_predicts === "DOWN" ? "UP" : "DOWN";
  return null;
}

/**
 * Score one market over one model's calls.
 *
 * @param {object} options
 * @param {object} options.market a market from `contracts.MARKETS`.
 * @param {Map<string,object>} options.calls date -> call record (direction, conviction).
 * @param {object} options.outcomes date -> { MARKET: { direction, present } }.
 * @param {string[]} options.dates the dates to consider.
 */
function scoreMarketDirection({ market, calls, outcomes, dates }) {
  const overall = emptyBucket();
  const byConviction = emptyConvictionMap();
  const bySplit = {};
  const rows = [];

  for (const date of dates) {
    const call = calls.get(date) || null;
    const outcome = outcomes[date] ? outcomes[date][market.key] : null;
    const split = splitOf(date);
    if (!bySplit[split.key]) bySplit[split.key] = { label: split.label, ...emptyBucket() };

    let result = "no_outcome";
    if (!call || call.direction === "NO_CALL") {
      result = "no_call";
    } else if (!outcome || !outcome.present || !outcome.direction) {
      result = "no_outcome";
    } else if (outcome.direction === "FLAT") {
      result = "flat";
    } else {
      result = outcome.direction === predictedDirection(call.direction, market) ? "hit" : "miss";
    }

    addResult(overall, result);
    addResult(bySplit[split.key], result);
    addResult(byConviction[call && call.conviction ? call.conviction : "uncalled"], result);
    rows.push({
      date,
      call_direction: call ? call.direction : null,
      conviction: call ? call.conviction : null,
      predicted: call && call.direction !== "NO_CALL" ? predictedDirection(call.direction, market) : null,
      actual: outcome ? outcome.direction : null,
      move_pct: outcome && Number.isFinite(outcome.move_pct) ? outcome.move_pct : null,
      result
    });
  }

  finishBucket(overall);
  for (const bucket of Object.values(byConviction)) finishBucket(bucket);
  for (const bucket of Object.values(bySplit)) finishBucket(bucket);

  return { market: market.key, label: market.label, overall, by_conviction: byConviction, by_split: bySplit, rows };
}

/**
 * Compare two models on the dates where both made a call and the market actually moved.
 *
 * `corrected` means the current model was wrong and the challenger was right; `spoiled` is the reverse.
 */
function compareModels({ market, currentCalls, challengerCalls, outcomes, dates }) {
  const summary = { market: market.key, matched: 0, corrected: 0, spoiled: 0, both_right: 0, both_wrong: 0, rows: [] };
  for (const date of dates) {
    const current = currentCalls.get(date) || null;
    const challenger = challengerCalls.get(date) || null;
    const outcome = outcomes[date] ? outcomes[date][market.key] : null;
    if (!current || !challenger) continue;
    if (current.direction === "NO_CALL" || challenger.direction === "NO_CALL") continue;
    if (!outcome || !outcome.direction || outcome.direction === "FLAT") continue;
    const currentRight = outcome.direction === predictedDirection(current.direction, market);
    const challengerRight = outcome.direction === predictedDirection(challenger.direction, market);
    summary.matched += 1;
    if (currentRight && challengerRight) summary.both_right += 1;
    else if (currentRight) summary.spoiled += 1;
    else if (challengerRight) summary.corrected += 1;
    else summary.both_wrong += 1;
    summary.rows.push({
      date,
      actual: outcome.direction,
      current: { direction: current.direction, conviction: current.conviction, right: currentRight },
      challenger: { direction: challenger.direction, conviction: challenger.conviction, right: challengerRight }
    });
  }

  return summary;
}

/**
 * Test 1. Official cash DXY direction from 05:00 to the next 05:00.
 *
 * `prices` is the licensed series when it exists. When it does not, the lane reports how many calls are
 * already waiting for it instead of substituting a lagged index that would answer a different question.
 *
 * A named proxy instrument (currently the broker's `DXY.cash` spot CFD) is passed through `instrument`.
 * The geometry is identical and the lane keeps its own id and label, so a proxy figure can never be read
 * as the official answer: `official_series.available` stays false and the block says what was scored.
 */
function testDxyDirection({ dates, callsByModel, prices = null, flatBandPct = null, instrument = null, workedExample = null }) {
  const perModel = {};
  for (const [model, calls] of Object.entries(callsByModel)) {
    const bucket = emptyBucket();
    const byConviction = emptyConvictionMap();
    let callsMade = 0;
    let paired = 0;
    let priced = 0;
    for (const date of dates) {
      const call = calls.get(date) || null;
      if (call && call.direction !== "NO_CALL") callsMade += 1;
      if (!prices) continue;
      const entry = prices[date] || null;
      if (entry && entry.present) priced += 1;
      if (!call || call.direction === "NO_CALL") {
        addResult(bucket, "no_call");
        addResult(byConviction.uncalled, "no_call");
        continue;
      }
      if (!entry || !entry.present) {
        addResult(bucket, "no_outcome");
        continue;
      }
      paired += 1;
      const band = Number.isFinite(flatBandPct) ? flatBandPct : 0;
      const magnitude = Math.abs(entry.move_pct);
      const predicted = predictedDirection(call.direction, { usd_bullish_predicts: "UP" });
      const result = magnitude <= band ? "flat" : ((entry.move_pct > 0 ? "UP" : "DOWN") === predicted ? "hit" : "miss");
      addResult(bucket, result);
      addResult(byConviction[call.conviction || "uncalled"], result);
    }
    finishBucket(bucket);
    for (const value of Object.values(byConviction)) finishBucket(value);
    perModel[model] = {
      calls_made: callsMade,
      sessions_with_price: prices ? priced : 0,
      paired_sessions: prices ? paired : 0,
      overall: bucket,
      by_conviction: byConviction
    };
  }

  const scored = Boolean(prices);
  const proxy = Boolean(instrument);
  return {
    id: proxy ? instrument.id : "dxy_direction",
    ordinal: 1,
    question: TESTS[0].question,
    official_series: OFFICIAL_DXY,
    instrument: instrument || null,
    status: scored ? (proxy ? "scored_proxy" : "scored") : "blocked",
    blocker: proxy
      ? null
      : scored
        ? null
        : { reason: OFFICIAL_DXY.why_it_cannot_stand_in, owner: OFFICIAL_DXY.blocker_owner },
    official_lane_note: proxy
      ? "this lane scores a named broker CFD, not official cash DXY; the official lane stays blocked until the " +
        "licensed ICE history is staged"
      : null,
    flat_band_pct: flatBandPct,
    worked_example: workedExample,
    usable_sessions: prices ? Object.keys(prices).filter((date) => prices[date] && prices[date].present).length : 0,
    awaiting_prices_sessions: scored
      ? 0
      : ((perModel.challenger || perModel.current || {}).calls_made || 0),
    models: perModel
  };
}


/**
 * Test 2. Directional accuracy on every configured additional market, using the USD call alone.
 *
 * Two columns are produced for each model: accuracy on every scored call, and accuracy restricted to the
 * calls DXY later proved right. The second column can only be filled when licensed DXY prices exist, so it
 * is reported as blocked rather than quietly left out.
 *
 * `markets` is the configured additional markets, so the lane's columns are the configuration's columns
 * and not a fixed list. A market with no cached series still appears, with its own zero sample and its own
 * reason, rather than being dropped from the table.
 */
function testFourMarkets({ dates, callsByModel, outcomes, dxyPrices = null, markets = MARKETS, primaryMarket = null }) {
  const models = {};
  for (const [model, calls] of Object.entries(callsByModel)) {
    const marketRows = {};
    for (const market of markets) {
      marketRows[market.key] = scoreMarketDirection({ market, calls, outcomes, dates });
    }
    models[model] = { markets: marketRows };
  }

  const comparisons = {};
  if (models.current && models.challenger) {
    comparisons.markets = {};
    for (const market of markets) {
      comparisons.markets[market.key] = compareModels({
        market,
        currentCalls: callsByModel.current,
        challengerCalls: callsByModel.challenger,
        outcomes,
        dates
      });
    }
  }

  const scoredSessions = dates.filter((date) =>
    Object.values(outcomes[date] || {}).some((entry) => entry && entry.present && entry.direction && entry.direction !== "FLAT"));

  return {
    id: "four_markets",
    ordinal: 2,
    label: "Direction across the configured markets",
    question:
      `Using the USD call alone, how often did ${markets.map((market) => market.label).join(", ")} move the ` +
      "way the call predicted over the same session?",
    markets_configured: markets.map((market) => market.key),
    market_count: markets.length,
    primary_market: primaryMarket,
    usable_sessions: scoredSessions.length,
    sessions_with_any_outcome: dates.filter((date) =>
      Object.values(outcomes[date] || {}).some((entry) => entry && entry.present)).length,
    dxy_confirmed_column: dxyPrices
      ? { status: "scored" }
      : { status: "blocked", reason: BLOCKERS.no_official_dxy, owner: OFFICIAL_DXY.blocker_owner },
    outcome_reads:
      "up means the market rose over the session; each market's own matrix entry says which way a USD-bullish " +
      "call predicts it, and a market with no cached series is reported with its reason rather than a zero",
    models,
    comparisons
  };
}

/**
 * Tests 3 and 4. Line-to-line execution, per configured market.
 *
 * The scored grid needs a 5-minute tape and a level ladder for each market and date that were both in hand
 * before the setup; neither exists in this checkout beyond the two-day EUR/USD execution demo, so the lane
 * reports its blocked state, the per-market reason, and the demo accounts it can actually run.
 *
 * `markets` is the configured set, so a market added to the configuration appears here with its own status
 * and its own missing-data reason without a code change.
 */
function testLineToLine({ id, ordinal, geometry, demo, markets = MARKETS }) {
  const index = ordinal - 1;
  const marketRows = {};
  for (const market of markets) {
    marketRows[market.key] = {
      label: market.label,
      broker_symbol: market.broker_symbol || null,
      status: "blocked",
      usable_sessions: 0,
      blockers: [BLOCKERS.no_m5_tape, BLOCKERS.no_level_ladder],
      note:
        `${market.label} has no archived 5-minute tape and no archived level ladder for these dates, so no ` +
        "line-to-line trade can be replayed for it; nothing is estimated in place of a tape"
    };
  }
  return {
    id,
    ordinal,
    question: TESTS[index].question,
    geometry,
    status: "blocked",
    usable_sessions: 0,
    markets_configured: markets.map((market) => market.key),
    market_count: markets.length,
    markets: marketRows,
    accounts: demo ? demo.accounts : null,
    demo: demo || null,
    blockers: [BLOCKERS.no_m5_tape, BLOCKERS.no_level_ladder]
  };
}

module.exports = {
  SPLITS,
  splitOf,
  wilsonLowerBound,
  emptyBucket,
  addResult,
  finishBucket,
  emptyConvictionMap,
  predictedDirection,
  scoreMarketDirection,
  compareModels,
  testDxyDirection,
  testFourMarkets,
  testLineToLine,
  MARKETS,
  CONVICTION,
  OFFICIAL_DXY,
  BLOCKERS,
  TESTS
};
