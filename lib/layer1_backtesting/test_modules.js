"use strict";

/**
 * The four agreed test modules as executable contracts (research only).
 *
 * A test module is not a tab label. Each entry says what the module consumes, which session markets it
 * scores, and what it needs before it can be scored at all. The controller reads this file when a run asks
 * for a test selection, so choosing a module changes what is computed - which markets are scored and which
 * modules are recorded as not run - rather than only what an experiment record says about itself.
 *
 * Two distinctions are kept explicit because collapsing them would overstate what a run proved:
 *   - `per_record: "market_outcomes"` modules are scored inside a replayed record from the committed panel;
 *   - `per_record: "trade_paths"` modules need a 5-minute tape and a level ladder per market, so a record
 *     that carries no `trade_paths` is recorded as `blocked_on_history`, never as a zero.
 *
 * Nothing here reads a file, the network or a production path.
 */

const MODULES = Object.freeze([
  Object.freeze({
    id: "dxy_direction_broker_cfd",
    ordinal: 1,
    label: "USD direction on the broker DXY.cash series",
    markets: Object.freeze([]),
    per_record: "not_run",
    requires: Object.freeze(["broker_dxy_h1_closes"]),
    reason:
      "the replayed panel carries no broker DXY outcome per morning; test 1 is scored once per run from the broker's one-hour candles, not inside a per-morning record"
  }),
  Object.freeze({
    id: "four_markets",
    ordinal: 2,
    label: "USD-only opposite-direction mapping across the configured markets",
    markets: Object.freeze(["*"]),
    market_scope: "all_configured",
    per_record: "market_outcomes",
    requires: Object.freeze([]),
    reason: null
  }),
  Object.freeze({
    id: "l2l_full_5r",
    ordinal: 3,
    label: "Original Layer 2 levels with the frozen 5R rules",
    markets: Object.freeze([]),
    per_record: "trade_paths",
    simulation: "full_5r",
    requires: Object.freeze(["m5_tape", "level_ladder"]),
    reason:
      "a trade path needs a 5-minute tape and a level ladder archived before the setup; neither exists for these mornings"
  }),
  Object.freeze({
    id: "l2l_half_3r",
    ordinal: 4,
    label: "Original levels plus midpoints with the frozen 3R rules",
    markets: Object.freeze([]),
    per_record: "trade_paths",
    simulation: "half_3r",
    requires: Object.freeze(["m5_tape", "level_ladder"]),
    reason:
      "a trade path needs a 5-minute tape and a level ladder archived before the setup; neither exists for these mornings"
  })
]);

const MODULE_IDS = Object.freeze(MODULES.map((module) => module.id));
const DEFAULT_SELECTION = MODULE_IDS;

function byId(id) {
  return MODULES.find((module) => module.id === id) || null;
}

/**
 * Turn a requested selection into module definitions.
 *
 * A webhook body, a query string or a dashboard checkbox group all arrive as strings, so a string is
 * accepted. An unknown module is an error: a run must never report a test it did not execute, and a typo
 * must not silently fall back to the full set. An empty request means "all four", which is the committed
 * default the published run used.
 */
function resolveModules(requested) {
  if (requested === undefined || requested === null || requested === "") return MODULES.slice();
  const raw = Array.isArray(requested) ? requested : String(requested).split(",");
  const ids = [];
  for (const entry of raw) {
    const id = entry && typeof entry === "object" && entry.id ? String(entry.id) : String(entry).trim();
    if (!id) continue;
    if (!byId(id)) {
      throw new Error(`unknown test module ${JSON.stringify(id)}; the committed modules are ${MODULE_IDS.join(", ")}`);
    }
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) throw new Error("a run must select at least one test module");
  return ids.map(byId);
}

/** The committed market order a caller gets when it passes no configuration of its own. */
const DEFAULT_MARKET_ORDER = Object.freeze(["EURUSD", "XAUUSD", "BTCUSD", "NAS100"]);

/**
 * The markets the selection scores, in the order the caller declares.
 *
 * A module that declares `"*"` scores every configured market, so a run whose dataset carries the eight-market
 * matrix is scored on eight and a run whose dataset declares four is scored on four. A module that names its
 * markets scores only those. Nothing here knows a market by heart.
 */
function marketsFor(modules, marketOrder) {
  const order = Array.isArray(marketOrder) && marketOrder.length ? marketOrder : DEFAULT_MARKET_ORDER;
  const wanted = new Set();
  for (const module of modules) {
    if (module.markets.includes("*")) {
      for (const market of order) wanted.add(market);
      continue;
    }
    for (const market of module.markets) wanted.add(market);
  }
  return order.filter((market) => wanted.has(market));
}

/** The frozen simulation rules the selection asks for, in module order. */
function simulationsFor(modules) {
  return modules.filter((module) => module.simulation).map((module) => module.simulation);
}

function idsOf(modules) {
  return modules.map((module) => module.id);
}

/**
 * What happened to each selected module on one record.
 *
 * `scored` needs a stored result; `no_outcome` is a scored module whose morning had no readable outcome;
 * `blocked_on_history` is a path module without a tape; `not_run` is a module the record cannot carry.
 * A module that was not selected is not reported here at all, so a reader can tell "not asked" from "asked
 * and refused".
 */
function moduleRunStates({ modules, results, session } = {}) {
  const selected = Array.isArray(modules) && modules.length > 0 ? modules : resolveModules(null);
  const rows = Array.isArray(results) ? results : [];
  const tradePaths = session && session.trade_paths && typeof session.trade_paths === "object"
    ? session.trade_paths
    : null;
  return selected.map((module) => {
    if (module.per_record === "market_outcomes") {
      const declared = module.markets.includes("*")
        ? rows.length
          ? [...new Set(rows.map((row) => row.market))]
          : Object.keys((session && session.outcomes) || {})
        : module.markets.slice();
      const scored = declared
        .map((market) => rows.find((row) => row && row.market === market))
        .filter(Boolean);
      const anyOutcome = scored.some((row) => ["hit", "miss", "flat"].includes(row.result));
      return {
        id: module.id,
        ordinal: module.ordinal,
        state: anyOutcome ? "scored" : "no_outcome",
        markets: declared,
        reason: anyOutcome ? null : "no selected market had a readable outcome for this morning"
      };
    }
    if (module.per_record === "trade_paths") {
      const markets = tradePaths && Array.isArray(tradePaths.markets) ? tradePaths.markets : [];
      const usable = markets.filter((market) => tradePaths[market] && Array.isArray(tradePaths[market].candles));
      return {
        id: module.id,
        ordinal: module.ordinal,
        state: usable.length > 0 ? "scored" : "blocked_on_history",
        simulation: module.simulation,
        markets: usable,
        reason: usable.length > 0 ? null : module.reason
      };
    }
    return {
      id: module.id,
      ordinal: module.ordinal,
      state: "not_run",
      markets: [],
      reason: module.reason
    };
  });
}

module.exports = {
  MODULES,
  MODULE_IDS,
  DEFAULT_SELECTION,
  DEFAULT_MARKET_ORDER,
  byId,
  resolveModules,
  marketsFor,
  simulationsFor,
  idsOf,
  moduleRunStates
};
