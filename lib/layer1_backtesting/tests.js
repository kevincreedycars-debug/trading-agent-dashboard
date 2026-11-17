/**
 * The four tests, and the pair-combination definition that is recorded before it is scored.
 *
 * Every figure below is read from the published run artefact: nothing is retyped. A test is one question, one
 * denominator, one exclusion list and one measure per model, and every measure carries its coverage beside it so
 * a candidate that called on 71% of mornings is never compared as if it had called on 98%.
 *
 * Research only.
 */
"use strict";

const TEST_TYPES = {
  historical_coverage: "measured on the replayed history",
  synthetic_demonstration: "a worked example, not a measured result",
  sealed_live_replay: "measured on mornings the model had not seen before publication",
};

const DEFINITIONS = [
  {
    id: "dxy_direction_broker_cfd",
    ordinal: 1,
    label: "USD direction on the broker DXY.cash series",
    question:
      "On mornings where the model made a directional call, did the broker's DXY.cash series close the 05:00-to-05:00 window in that direction, using one candle per 05:00 boundary?",
    type: "historical_coverage",
    outcome_source: "broker DXY.cash one-hour candles",
    published_key: "dxy_direction_broker_cfd",
    notes: [
      "This is the agreed test 1. The broker series is a proxy for the official index and is labelled as a proxy everywhere it appears.",
      "A flat window inside the flat band is excluded from the accuracy denominator and counted separately.",
    ],
  },
  {
    id: "four_markets",
    ordinal: 2,
    label: "USD-only opposite-direction mapping in four markets",
    question:
      "Did the same USD call point the right way in EUR/USD, gold, bitcoin and the NAS100 over the same window?",
    type: "historical_coverage",
    outcome_source: "OANDA one-hour closes per market",
    published_key: "four_markets",
    notes: [
      "This is the agreed test 2: one model call against four market outcomes, not a pair-combination measure.",
      "Each market carries its own denominator; an aggregate across markets is not reported.",
    ],
  },
  {
    id: "l2l_full_5r",
    ordinal: 3,
    label: "Original Layer 2 levels with the frozen 5R rules",
    question:
      "When a Layer 1 call was handed to the original Layer 2 levels, did the frozen 5R path reach its target before its stop?",
    type: "historical_coverage",
    outcome_source: "one-hour closes with the original layer-2 level grid and 5R management",
    published_key: "l2l_full_5r",
    notes: [
      "This is the agreed test 3. It needs a trade-qualified call, contemporaneous levels and an actionable bid/ask M5 replay.",
      "The grid does not yet exist for these markets, so the test is blocked on history, not scored at zero.",
    ],
  },
  {
    id: "l2l_half_3r",
    ordinal: 4,
    label: "Original levels plus midpoints with the frozen 3R rules",
    question:
      "With midpoints added to the original levels, did the frozen 3R path reach its target before its stop?",
    type: "historical_coverage",
    outcome_source: "one-hour closes with the levels-plus-midpoints grid and 3R management",
    published_key: "l2l_half_3r",
    notes: [
      "This is the agreed test 4, a separately frozen geometry and management rule, not a sensitivity check on test 3.",
      "It needs the same tape and ladder evidence as test 3 plus the midpoint geometry.",
    ],
  },
];

/**
 * The official ICE series is still registered, but it is not one of the agreed four: the licence is absent, so
 * it has never been scored and cannot be substituted by the broker proxy.
 */
const SUPPLEMENTARY = [
  {
    id: "dxy_direction",
    ordinal: null,
    label: "USD direction against the official ICE dollar index",
    question:
      "On mornings where the model made a directional call, did the official ICE dollar index close the 05:00-to-05:00 window in that direction?",
    type: "historical_coverage",
    outcome_source: "ICE DXY official daily close",
    published_key: "dxy_direction",
    notes: [
      "Registered outside the agreed four. The official series is not in this checkout, so the denominator is empty.",
      "A proxy series is never substituted here; the broker proxy is its own test with its own label.",
    ],
  },
];

function labelFor(model) {
  return model === "current" ? "control" : model === "challenger_v1" ? "candidate" : model;
}

function pickCounts(overall) {
  const out = {};
  for (const key of ["scored", "hits", "misses", "flat", "no_call", "no_outcome"]) {
    out[key] = overall && overall[key] !== undefined ? overall[key] : null;
  }
  out.accuracy_pct = overall && overall.accuracy_pct !== undefined ? overall.accuracy_pct : null;
  out.lower_bound_pct = overall && overall.lower_bound_pct !== undefined ? overall.lower_bound_pct : null;
  return out;
}

/** The published shape tells us how a test can be read: one figure per model, one per market, or a ledger. */
function modeOf(publishedTest) {
  if (!publishedTest) return "none";
  if (Array.isArray(publishedTest.accounts) && publishedTest.accounts.length) return "demonstration";
  const first = (publishedTest.models && publishedTest.models.current) || null;
  if (first && first.markets && Object.keys(first.markets).length) return "per_market";
  if (first && first.overall) return "per_model";
  return "none";
}

function overallMeasures(publishedTest, models) {
  const measures = [];
  for (const model of models) {
    const entry = publishedTest && publishedTest.models ? publishedTest.models[model] : null;
    if (!entry || !entry.overall) continue;
    measures.push({
      model,
      label: labelFor(model),
      ...pickCounts(entry.overall),
      published: entry.overall,
    });
  }
  return measures;
}

function marketsFrom(publishedTest, models) {
  const out = new Map();
  for (const model of models) {
    const markets = (publishedTest && publishedTest.models && publishedTest.models[model]
      ? publishedTest.models[model].markets
      : null) || {};
    for (const [market, result] of Object.entries(markets)) {
      if (!out.has(market)) out.set(market, { market, label: result.label || market, by_model: [] });
      out.get(market).by_model.push({
        model,
        label: labelFor(model),
        status: result.status || null,
        ...pickCounts(result.overall),
        published: result.overall || null,
      });
    }
  }
  return [...out.values()];
}

function demonstrationFrom(publishedTest, models) {
  return ((publishedTest && publishedTest.accounts) || [])
    .filter((account) => models.includes(account.model))
    .map((account) => ({
      id: account.id,
      label: account.label,
      geometry: account.geometry,
      model: labelFor(account.model),
      starting_balance: account.starting_balance,
      currency: account.currency,
      fills: account.fills,
      wins: account.wins,
      losses: account.losses,
      flat_trades: account.flat_trades,
      average_r: account.average_r,
      total_r: account.total_r,
      return_pct: account.return_pct,
      max_drawdown_pct: account.max_drawdown ? account.max_drawdown.pct : null,
    }));
}

function pathBlockers(publishedTest) {
  const markets = (publishedTest && publishedTest.markets) || {};
  return Object.entries(markets).map(([market, result]) => ({
    market,
    label: result.label || market,
    status: result.status || null,
    usable_sessions: result.usable_sessions === undefined ? null : result.usable_sessions,
    blockers: result.blockers || [],
    note: result.note || null,
  }));
}

/**
 * @param {object} options
 * @param {object} options.run the published run-v1 artefact
 * @param {object} options.pairCombination the recorded pair-combination definition
 */
function buildTests({ run, pairCombination }) {
  const published = (run && run.tests) || {};
  const coverage = (run && run.coverage && run.coverage.by_model) || {};
  const models = ["current", "challenger_v1"];
  const sessions = (run && run.sessions) || [];

  let bothCalled = 0;
  for (const session of sessions) {
    const current = session.models && session.models.current;
    const candidate = session.models && session.models.challenger_v1;
    if (current && candidate && current.direction !== "NO_CALL" && candidate.direction !== "NO_CALL") bothCalled += 1;
  }

  const toTest = (definition) => {
    const keys = definition.variants || [definition.published_key];
    const primary = published[definition.published_key] || null;
    const mode = modeOf(primary);
    const measures = mode === "per_model" ? overallMeasures(primary, models) : [];
    const markets = mode === "per_market" ? marketsFrom(primary, models) : [];
    const demonstrations = keys
      .map((key) => ({ key, accounts: demonstrationFrom(published[key], models) }))
      .filter((entry) => entry.accounts.length);
    const blockers = mode === "demonstration" ? pathBlockers(primary) : [];

    const scoredCount =
      mode === "per_model"
        ? measures.reduce((sum, measure) => sum + (measure.scored || 0), 0)
        : mode === "per_market"
          ? markets.reduce(
              (sum, market) =>
                sum + market.by_model.reduce((inner, entry) => inner + (entry.scored || 0), 0),
              0
            )
          : 0;

    const status =
      scoredCount > 0 ? (primary && primary.status === "scored_proxy" ? "scored_proxy" : "scored") : "blocked";
    const statusLabel =
      status === "blocked"
        ? mode === "demonstration"
          ? "blocked on history: the only evidence is a worked demonstration"
          : "blocked: no usable denominator"
        : status === "scored_proxy"
          ? "scored on a broker proxy series, not on the official index"
          : mode === "per_market"
            ? "scored market by market; no cross-market aggregate is published or reported"
            : "scored on a partial denominator";

    return {
      ...definition,
      mode,
      status,
      status_label: statusLabel,
      usable_sessions: primary ? primary.usable_sessions : null,
      sessions_available: sessions.length,
      sessions_with_any_outcome: primary && primary.sessions_with_any_outcome !== undefined
        ? primary.sessions_with_any_outcome
        : null,
      denominators:
        mode === "per_model"
          ? measures.map((measure) => ({
              model: measure.label,
              definition: "mornings with a directional call, a readable outcome and a move outside the flat band",
              scored: measure.scored,
              exclusions: [
                { reason: "flat window inside the flat band", count: measure.flat },
                { reason: "the model made no call", count: measure.no_call },
                { reason: "no readable outcome", count: measure.no_outcome },
              ],
            }))
          : mode === "per_market"
            ? markets.map((market) => ({
                market: market.market,
                label: market.label,
                definition: "the model's call against this market's own window, per model",
                by_model: market.by_model.map((entry) => ({
                  model: entry.label,
                  scored: entry.scored,
                  exclusions: [
                    { reason: "flat window inside the flat band", count: entry.flat },
                    { reason: "the model made no call", count: entry.no_call },
                    { reason: "no readable outcome", count: entry.no_outcome },
                  ],
                })),
              }))
            : [],
      measures,
      markets,
      demonstration: demonstrations.length
        ? {
            label: "worked example only: a two-day tape, six to eight trades per account; not a measured result",
            window: { first: "2026-11-05", last: "2026-11-06" },
            by_variant: demonstrations,
            market_blockers: blockers,
            why_blocked:
              "The path test needs a 5-minute tape and a level ladder archived before the setup; neither exists for these dates, and nothing is estimated in place of a tape.",
          }
        : null,
      comparisons: (primary && primary.comparisons) || null,
      coverage_disclosure: {
        control: coverage.current || null,
        candidate: coverage.challenger_v1 || null,
        common_directional_mornings: bothCalled,
        note: "coverage is reported per model; the candidate's lower participation rate is never folded into the control's",
      },
      evidence: keys.map((key) => ({ path: "data/usd-layer1-backtester/run-v1.json", field: `tests.${key}` })),
    };
  };

  const tests = DEFINITIONS.map(toTest);

  return {
    definition_order: DEFINITIONS.map((definition) => definition.id),
    types: TEST_TYPES,
    tests,
    supplementary: SUPPLEMENTARY.map(toTest),
    coverage_disclosure: {
      control: { ...(coverage.current || {}), label: "current USD model (control)" },
      candidate: { ...(coverage.challenger_v1 || {}), label: "USD 25-factor candidate (implemented book)" },
      common_directional_mornings: bothCalled,
      sessions: sessions.length,
      note:
        "The candidate called on far fewer mornings than the control. Any comparison that prints one number for both models hides that difference, so every measure prints coverage beside it.",
    },
    pair_combination: pairCombination,
  };
}

/**
 * The pair-combination measure, resolved before anything is scored.
 *
 * Two readings were possible: reuse the existing USD-only cross-market test, or combine two independent Layer 1
 * calls. They are not the same measure, so the definition is recorded and left unscored until the owner agrees.
 */
function pairCombinationDefinition() {
  return {
    id: "pair_combination",
    label: "Pair combination accuracy",
    status: "definition_recorded_not_scored",
    definition:
      "Combine two independent Layer 1 calls, one per leg, into one pair view: the pair direction is the long leg's call against the short leg's call, and a pair is scored only when both legs made a directional call on the same morning.",
    rejected_reading:
      "The existing four-market test is USD-only: one model call, four market outcomes. It answers a different question and is already test 3, so it is not reused under this name.",
    why_unscored: [
      "Only USD has a frozen Layer 1 rulebook with a per-morning decision record. The EUR, gold, NAS100 and BTC Layer 1 agents exist as exports but have no frozen rulebook version, so a second independent leg cannot be formed without inventing one.",
      "Scoring a pair from a USD call plus a price series would measure the same thing as test 3 under a new name.",
    ],
    needs_before_scoring: [
      "A frozen, versioned rulebook and decision record for at least one non-USD leg.",
      "A declared leg mapping (which call is long, which is short) and a declared conflict rule for two same-direction calls.",
      "A denominator that counts only mornings where both legs called.",
    ],
    owner_decision: "OD-1",
    evidence: [
      { path: "data/usd-layer1-backtester/run-v1.json", field: "tests.four_markets" },
      { path: "exports/eur_layer1_agent.json", role: "a second-leg agent exists as an export, with no frozen rulebook" },
    ],
  };
}

module.exports = { buildTests, pairCombinationDefinition, DEFINITIONS, SUPPLEMENTARY, TEST_TYPES };

