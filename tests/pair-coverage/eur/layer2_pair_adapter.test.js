const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LOW_CONVICTION_THRESHOLD,
  EUR_LAYER2_PAIRS,
  EUR_CROSS_PAIRS,
  normalizeDirection,
  clampConviction,
  buildLayer2PairDashboard
} = require("../../../pair-coverage/eur/layer2_pair_adapter");
const { layer2Call, layer2Calls } = require("./fixtures");

const EUR_USD_PAIR = [{ pairCode: "EUR_USD", instrument: "EUR/USD", base: "EUR", quote: "USD" }];

test("reproduces the live USD-quoted Layer 2 output unchanged", () => {
  const dashboard = buildLayer2PairDashboard({
    pairs: EUR_USD_PAIR,
    calls: layer2Calls(),
    generatedAt: "2026-09-12T10:00:00Z"
  });

  assert.equal(dashboard.dashboard_meta.source, "layer_2_trade_selection_agent");
  assert.equal(dashboard.dashboard_meta.last_updated_et, "2026-09-12T10:00:00Z");
  assert.deepEqual(dashboard.avoid_today, []);
  assert.deepEqual(dashboard.trade_opportunities, [
    {
      instrument: "EUR/USD",
      direction: "BUY",
      confidence: 72,
      reason:
        "EUR is independently bullish while USD is independently bearish during today's session.",
      rank: 1
    }
  ]);
});

test("quotes Layer 2 reasons in the pair's quote asset, not USD", () => {
  const dashboard = buildLayer2PairDashboard({
    pairs: [
      { pairCode: "XAU_EUR", instrument: "XAU/EUR", base: "GOLD", quote: "EUR" },
      { pairCode: "BTC_EUR", instrument: "BTC/EUR", base: "BTC", quote: "EUR" }
    ],
    calls: layer2Calls({ EUR: layer2Call("BEARISH", 72) }),
    generatedAt: "2026-09-12T10:00:00Z"
  });

  assert.deepEqual(
    dashboard.trade_opportunities.map((item) => [item.instrument, item.direction, item.confidence]),
    [
      ["XAU/EUR", "BUY", 76],
      ["BTC/EUR", "BUY", 74]
    ]
  );
  assert.equal(
    dashboard.trade_opportunities[0].reason,
    "GOLD is independently bullish while EUR is independently bearish during today's session."
  );
  assert.equal(
    dashboard.trade_opportunities[1].reason,
    "BTC is independently bullish while EUR is independently bearish during today's session."
  );
});

test("combines confidence as the rounded average and ranks every EUR pair descending", () => {
  const dashboard = buildLayer2PairDashboard({
    // EUR is BULLISH so it can be the base of EUR/USD and EUR/GBP while every
    // EUR-quoted base asset is BEARISH against it.
    calls: layer2Calls({
      GOLD: layer2Call("BEARISH", 80),
      SILVER: layer2Call("BEARISH", 66),
      WTI: layer2Call("BULLISH", 64),
      NQ: layer2Call("BEARISH", 70),
      BTC: layer2Call("BEARISH", 75)
    }),
    generatedAt: "2026-09-12T10:00:00Z"
  });

  // GOLD 80+EUR 72 -> 76 | BTC 75+72 -> 74 | EUR 72+USD 72 -> 72
  // NQ 70+72 -> 71 | EUR 72+GBP 68 -> 70 | SILVER 66+72 -> 69
  // WTI 64 points the same way as the EUR quote, so it is avoided.
  assert.deepEqual(
    dashboard.trade_opportunities.map((item) => [item.instrument, item.confidence, item.rank]),
    [
      ["XAU/EUR", 76, 1],
      ["BTC/EUR", 74, 2],
      ["EUR/USD", 72, 3],
      ["NQ/EUR", 71, 4],
      ["EUR/GBP", 70, 5],
      ["XAG/EUR", 69, 6]
    ]
  );
  assert.deepEqual(
    dashboard.avoid_today.map((item) => item.instrument),
    ["WTI/EUR"]
  );
});

test("fails closed with the live avoid reasons", () => {
  const build = (overrides) =>
    buildLayer2PairDashboard({
      pairs: EUR_USD_PAIR,
      calls: layer2Calls(overrides),
      generatedAt: "2026-09-12T10:00:00Z"
    });

  assert.equal(
    build({ EUR: layer2Call("BULLISH", null) }).avoid_today[0].reason,
    "Missing 24H conviction from one or both Layer 1 assets."
  );
  assert.equal(
    build({ USD: layer2Call("NO_CLEAR_BIAS", 72) }).avoid_today[0].reason,
    "One or both assets have no clear 24H bias."
  );
  assert.equal(
    build({ USD: layer2Call("BEARISH", LOW_CONVICTION_THRESHOLD - 1) }).avoid_today[0].reason,
    "Mixed or low conviction 24H signals."
  );
  assert.equal(
    build({ USD: layer2Call("BULLISH", 72) }).avoid_today[0].reason,
    "Both assets point in the same 24H direction, so there is no clear relative edge."
  );
  assert.equal(build({ EUR: layer2Call("BULLISH", 72) }).trade_opportunities.length, 1);
});

test("accepts every live Layer 1 direction variant", () => {
  assert.equal(normalizeDirection("BULLISH"), "BULLISH");
  assert.equal(normalizeDirection("bullish_lean"), "BULLISH");
  assert.equal(normalizeDirection("LONG"), "BULLISH");
  assert.equal(normalizeDirection("BEARISH"), "BEARISH");
  assert.equal(normalizeDirection("Bearish Lean"), "BEARISH");
  assert.equal(normalizeDirection("SHORT"), "BEARISH");
  for (const sentinel of ["PENDING", "NO_24H_CALL", "NO_CLEAR_BIAS", "NEUTRAL", "MARKET_CLOSED", ""]) {
    assert.equal(normalizeDirection(sentinel), "NO_CLEAR_BIAS", sentinel);
  }
});

test("clamps conviction to integer 0-100 and preserves null", () => {
  assert.equal(clampConviction(120), 100);
  assert.equal(clampConviction(-5), 0);
  assert.equal(clampConviction(72.4), 72);
  assert.equal(clampConviction("68"), 68);
  assert.equal(clampConviction(null), null);
  assert.equal(clampConviction(""), null);
});

test("covers the six non-EUR/USD EUR crosses as the active scope", () => {
  assert.deepEqual(
    EUR_CROSS_PAIRS.map((pair) => [pair.pairLabel ?? pair.instrument, pair.base, pair.quote]),
    [
      ["EUR/GBP", "EUR", "GBP"],
      ["XAU/EUR", "GOLD", "EUR"],
      ["XAG/EUR", "SILVER", "EUR"],
      ["WTI/EUR", "WTI", "EUR"],
      ["NQ/EUR", "NQ", "EUR"],
      ["BTC/EUR", "BTC", "EUR"]
    ]
  );
  assert.equal(
    EUR_CROSS_PAIRS.some((pair) => pair.pairCode === "EUR_USD"),
    false
  );

  // EUR is BULLISH (default), so a EUR-quoted cross needs a BEARISH base and the
  // EUR-based cross needs a BEARISH quote for all six to produce a decision.
  const dashboard = buildLayer2PairDashboard({
    pairs: EUR_CROSS_PAIRS,
    calls: layer2Calls({
      GBP: layer2Call("BEARISH", 68),
      GOLD: layer2Call("BEARISH", 80),
      SILVER: layer2Call("BEARISH", 66),
      WTI: layer2Call("BEARISH", 64),
      NQ: layer2Call("BEARISH", 70),
      BTC: layer2Call("BEARISH", 75)
    }),
    generatedAt: "2026-09-12T10:00:00Z"
  });

  // GOLD 80+EUR 72 -> 76 SELL | BTC 75+72 -> 74 SELL | NQ 70+72 -> 71 SELL
  // EUR 72+GBP 68 -> 70 BUY | SILVER 66+72 -> 69 SELL | WTI 64+72 -> 68 SELL
  assert.deepEqual(
    dashboard.trade_opportunities.map((item) => [item.instrument, item.direction, item.confidence]),
    [
      ["XAU/EUR", "SELL", 76],
      ["BTC/EUR", "SELL", 74],
      ["NQ/EUR", "SELL", 71],
      ["EUR/GBP", "BUY", 70],
      ["XAG/EUR", "SELL", 69],
      ["WTI/EUR", "SELL", 68]
    ]
  );
  assert.deepEqual(dashboard.avoid_today, []);
  assert.equal(
    dashboard.trade_opportunities[0].reason,
    "EUR is independently bullish while GOLD is independently bearish during today's session."
  );
});

test("covers all seven EUR inventory pairs and blocks legs that are absent", () => {
  assert.equal(EUR_LAYER2_PAIRS.length, 7);
  const xauEur = EUR_LAYER2_PAIRS.find((pair) => pair.pairCode === "XAU_EUR");
  assert.deepEqual(xauEur, {
    pairCode: "XAU_EUR",
    instrument: "XAU/EUR",
    base: "GOLD",
    quote: "EUR"
  });

  const dashboard = buildLayer2PairDashboard({
    calls: {},
    generatedAt: "2026-09-12T10:00:00Z"
  });

  assert.equal(dashboard.trade_opportunities.length, 0);
  assert.deepEqual(
    dashboard.avoid_today.map((item) => item.instrument).sort(),
    ["BTC/EUR", "EUR/GBP", "EUR/USD", "NQ/EUR", "WTI/EUR", "XAG/EUR", "XAU/EUR"]
  );
  for (const item of dashboard.avoid_today) {
    assert.equal(item.reason, "Missing 24H conviction from one or both Layer 1 assets.");
  }
});
