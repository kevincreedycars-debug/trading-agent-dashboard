"use strict";

/**
 * Contracts for the USD Layer 1 backtester panel (research only, 2026-11-08).
 *
 * Everything the engine, the run artefact and the dashboard panel must agree on lives here: the
 * permanent North Star wording, the four test identifiers, the account rule, the markets and their
 * outcome series, the declared flat-band rule, the conviction bands and every honesty label.
 *
 * This file reads nothing, writes nothing and calls nothing. A panel figure that does not have a
 * home in this contract is an invention, not a measurement.
 */

/** The North Star is shown at the top of the panel and repeated in the run artefact verbatim. */
const NORTH_STAR_TEXT =
  "Does one independent USD call at 05:00 London, built from the 25-factor research, improve on our " +
  "current model? We measure four things: \u2460 DXY directional accuracy, \u2461 how often EUR/USD, gold, " +
  "BTC/USD and NAS100 move opposite the USD call, \u2462 full-level L2L trading results at 5R, and " +
  "\u2463 half-level L2L trading results at 3R. Both trade simulations start at \u00a3100,000 and risk 1% " +
  "of the account balance per filled trade.";

const SCHEMA_VERSION = "usd-layer1-backtester-panel-v1";
const RUN_VERSION = "usd-l1-backtester-r1";
const CHALLENGER_VERSION = "usd-layer1-challenger-v0";
const CURRENT_MODEL_VERSION =
  "agent_usd_direction.md (production baseline, replayed by backtester/replay/usd/usd_replay_core.js)";

/** The session the whole programme is defined on. Mirrors docs/research/usd-session/v1/session_contract_v1.json. */
const SESSION_CONTRACT = Object.freeze({
  cutoff_local: "05:00",
  cutoff_zone: "Europe/London",
  endpoint_day_offset: 1,
  nominal_hours: 24,
  start_weekdays: [1, 2, 3, 4, 5],
  note:
    "05:00 London is midnight in New York in both GMT and BST, so the session starts on the New York " +
    "calendar day boundary and each eligible session is exactly 24 hours long"
});

/** Both trade simulations start here and risk this share of their own running balance per filled trade. */
const ACCOUNT = Object.freeze({
  starting_balance: 100000,
  currency: "GBP",
  risk_per_trade_pct: 1,
  sizing_rule:
    "1% of the running simulated balance at the moment the order fills, never of the starting balance",
  chronological:
    "trades are processed in fill-time order across the four markets before the balance moves on",
  position_limits:
    "the trader rule's limits are kept: one position per line, one live order per line, and no re-entry " +
    "order while the line is behind the market"
});

/** The four test lanes. Identifiers are used by the engine, the artefact and the panel's tab strip. */
const TESTS = Object.freeze([
  Object.freeze({
    id: "dxy_direction",
    ordinal: 1,
    label: "DXY direction",
    question:
      "Did official cash DXY move in the direction called, from 05:00 London to 05:00 the next local calendar day?"
  }),
  Object.freeze({
    id: "four_markets",
    ordinal: 2,
    label: "Direction across four markets",
    question:
      "Using the USD call alone, how often did EUR/USD, XAU/USD, BTC/USD and NAS100 move opposite the call " +
      "over the same session?"
  }),
  Object.freeze({
    id: "l2l_full_5r",
    ordinal: 3,
    label: "Full L2L at 5R",
    question:
      "Applying the USD-implied direction to each market's original levels, what does the 5R line-to-line trade produce?"
  }),
  Object.freeze({
    id: "l2l_half_3r",
    ordinal: 4,
    label: "Half L2L at 3R",
    question:
      "With one midpoint inserted between adjacent originals, what does the 3R half-grid trade produce?"
  })
]);

/**
 * The markets used by test 2, and later by tests 3 and 4. `outcome_series` names the cached one-hour
 * series the session outcome is read from; `usd_bullish_predicts` says what a USD-bullish call predicts.
 */
const MARKETS = Object.freeze([
  Object.freeze({
    key: "EURUSD",
    label: "EUR/USD",
    outcome_series: "oanda_eur_usd_h1.csv",
    quote_convention: "USD per EUR",
    usd_bullish_predicts: "DOWN",
    digits: 5
  }),
  Object.freeze({
    key: "XAUUSD",
    label: "XAU/USD",
    outcome_series: "oanda_xau_usd_h1.csv",
    quote_convention: "USD per ounce",
    usd_bullish_predicts: "DOWN",
    digits: 2
  }),
  Object.freeze({
    key: "BTCUSD",
    label: "BTC/USD",
    outcome_series: "binance_btcusdt_1h.csv",
    quote_convention: "USD per BTC",
    usd_bullish_predicts: "DOWN",
    digits: 2
  }),
  Object.freeze({
    key: "NAS100",
    label: "NAS100",
    outcome_series: "oanda_nas100_usd_h1.csv",
    quote_convention: "index points",
    usd_bullish_predicts: "DOWN",
    digits: 1
  })
]);

/**
 * Flat band rule. A session move smaller than the band is reported as FLAT and kept out of the
 * accuracy denominator, so a score never improves by counting noise as a hit. The band is not a hand
 * number: it is the development-window 20th percentile of the absolute session move for that market,
 * computed once per run from development dates only and frozen for the unseen dates.
 */
const FLAT_BAND = Object.freeze({
  rule: "20th percentile of the absolute 05:00-to-05:00 move over development dates, rounded to 3 decimals",
  percentile: 20,
  decimals: 3,
  applies_to: "tests 2, 3 and 4 session direction; test 1 uses the declared DXY band when prices exist",
  direction_agnostic:
    "the band is measured on the absolute move before any model is scored, so it cannot favour either model"
});

/** Conviction is a 1-5 band for both models. The raw score stays untouched beside it. */
const CONVICTION = Object.freeze({
  scale: [1, 2, 3, 4, 5],
  labels: Object.freeze({
    1: "minimal",
    2: "weak",
    3: "moderate",
    4: "strong",
    5: "distinct"
  }),
  trade_threshold: 3,
  trade_threshold_rule:
    "a call at conviction 3 or higher is the provisional trade threshold; every call below it is still " +
    "recorded and scored so the threshold can be reviewed on evidence instead of moved by hand",
  current_model_mapping: Object.freeze({
    rule: "the current model's own 0-100 conviction is banded, not recomputed",
    bands: Object.freeze([
      Object.freeze({ min: 80, conviction: 5 }),
      Object.freeze({ min: 65, conviction: 4 }),
      Object.freeze({ min: 50, conviction: 3 }),
      Object.freeze({ min: 35, conviction: 2 }),
      Object.freeze({ min: 0, conviction: 1 })
    ])
  })
});

/**
 * Test 1 needs official cash DXY. Nothing in this checkout carries it: the collector stores FRED
 * DTWEXBGS (a broad trade-weighted dollar index carried on a publication lag) under the name
 * `dxy_level`. Substituting it would measure a different question, so test 1 stays unscored and says why.
 */
const OFFICIAL_DXY = Object.freeze({
  available: false,
  required_series: "ICE US Dollar Index, cash, official close, USDX",
  what_exists_instead: "FRED DTWEXBGS (broad trade-weighted dollar), stored locally as `dxy_level`",
  why_it_cannot_stand_in:
    "DTWEXBGS is a weekly-cadence H.10 release carried with a publication lag, so a 05:00-to-05:00 move " +
    "read from it is neither the ICE basket nor knowable at 05:00; using it would silently answer a " +
    "different question and flatter whichever model happened to agree with the lagged print",
  blocker_owner:
    "ICE sample and fee letter (docs/research/usd-session/v1/ice_dxy_sample_and_fee_request_20261107.md)",
  unblock_condition: "a licensed cash DXY history with at least 05:00 London and next-05:00 London prints"
});

/** Fixed vocabulary for why a lane cannot score a date. The panel renders these words, not codes. */
const BLOCKERS = Object.freeze({
  no_official_dxy: "official cash DXY prices are not licensed in this checkout",
  no_call: "no call was reconstructed for this date and model",
  no_outcome: "the session outcome for this market could not be read from the cached series",
  no_m5_tape: "no 5-minute tape exists for this market and date",
  no_level_ladder: "no level ladder for this market was archived before the setup",
  flat_session: "the session move stayed inside the declared flat band",
  below_threshold: "the call was made below the provisional trade threshold"
});

/** Labels the panel must show so a reader cannot mistake research for a deployment. */
const LABELS = Object.freeze({
  research_only: "Research only. Nothing here is published as a live call or an edge claim.",
  execution_demo:
    "Execution demo: the two-day EUR/USD M5 replay reported at 5d488ef5, whose call direction came from " +
    "the live fill record because no 05:00 Layer 1 archive for those dates exists in this checkout",
  benchmark:
    "Benchmark, not a challenger: the historical hourly ADR results stand under their own label and are " +
    "never compared as if they were this programme's output",
  no_edge_claim:
    "No scored 5R or 3R figure is publishable from this run: the figures are gross of costs, single pair, " +
    "two sessions and one call direction"
});

module.exports = {
  NORTH_STAR_TEXT,
  SCHEMA_VERSION,
  RUN_VERSION,
  CHALLENGER_VERSION,
  CURRENT_MODEL_VERSION,
  SESSION_CONTRACT,
  ACCOUNT,
  TESTS,
  MARKETS,
  FLAT_BAND,
  CONVICTION,
  OFFICIAL_DXY,
  BLOCKERS,
  LABELS
};
