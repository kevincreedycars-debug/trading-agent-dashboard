const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EUR_CROSS_PAIRS,
  confidenceBucket,
  buildDashboardLayer2View,
  buildLayer2PairDashboard
} = require("../../../pair-coverage/eur/layer2_pair_adapter");
const { layer2Call, layer2Calls } = require("./fixtures");

const FRIDAY = "2026-09-11T12:00:00Z";
const SATURDAY = "2026-09-12T12:00:00Z";

// EUR is BULLISH, so every EUR-quoted base must be BEARISH to trade.
const weekdayCalls = () =>
  layer2Calls({
    GBP: layer2Call("BEARISH", 68),
    GOLD: layer2Call("BEARISH", 80),
    SILVER: layer2Call("BEARISH", 66),
    WTI: layer2Call("BEARISH", 64),
    NQ: layer2Call("BEARISH", 70),
    BTC: layer2Call("BEARISH", 75)
  });

test("renders all six EUR crosses in the dashboard-consumer shape on a weekday", () => {
  const view = buildDashboardLayer2View({
    pairs: EUR_CROSS_PAIRS,
    calls: weekdayCalls(),
    asOf: FRIDAY
  });

  assert.deepEqual(
    view.tradeOpportunities.map((item) => [
      item.pairCode,
      item.direction,
      item.confidence,
      item.strengthBucket,
      item.rank
    ]),
    [
      ["XAU_EUR", "SELL", 76, "Strong", 1],
      ["BTC_EUR", "SELL", 74, "Strong", 2],
      ["NQ_EUR", "SELL", 71, "Strong", 3],
      ["EUR_GBP", "BUY", 70, "Strong", 4],
      ["XAG_EUR", "SELL", 69, "Strong", 5],
      ["WTI_EUR", "SELL", 68, "Strong", 6]
    ]
  );
  assert.deepEqual(view.avoidToday, []);
});

test("suppresses closed base-asset markets but keeps the 24/7 BTC cross live", () => {
  const view = buildDashboardLayer2View({
    pairs: EUR_CROSS_PAIRS,
    calls: weekdayCalls(),
    asOf: SATURDAY
  });

  assert.deepEqual(
    view.tradeOpportunities.map((item) => [item.pairCode, item.direction, item.confidence]),
    [["BTC_EUR", "SELL", 74]]
  );
  assert.deepEqual(
    view.avoidToday.map((item) => [item.pairCode, item.marketStatus]),
    [
      ["EUR_GBP", "CLOSED"],
      ["XAU_EUR", "CLOSED"],
      ["XAG_EUR", "CLOSED"],
      ["WTI_EUR", "CLOSED"],
      ["NQ_EUR", "CLOSED"]
    ]
  );
});

test("keeps the live-parity producer free of presentation-only fields", () => {
  const dashboard = buildLayer2PairDashboard({ pairs: EUR_CROSS_PAIRS, calls: weekdayCalls(), generatedAt: FRIDAY });
  const opportunity = dashboard.trade_opportunities[0];
  assert.equal("pairCode" in opportunity, false);
  assert.equal("strengthBucket" in opportunity, false);
  assert.equal(opportunity.reason.startsWith("EUR is independently bullish"), true);
});

test("confidence buckets match backtester/lib/layer2_pair_logic.js boundaries", () => {
  assert.deepEqual(confidenceBucket(80), { key: "VERY_STRONG", label: "Very Strong" });
  assert.deepEqual(confidenceBucket(79), { key: "STRONG", label: "Strong" });
  assert.deepEqual(confidenceBucket(65), { key: "STRONG", label: "Strong" });
  assert.deepEqual(confidenceBucket(64), { key: "MODERATE", label: "Moderate" });
  assert.deepEqual(confidenceBucket(50), { key: "MODERATE", label: "Moderate" });
  assert.deepEqual(confidenceBucket(0), { key: "WEAK", label: "Weak" });
  assert.equal(confidenceBucket(null), null);
});
