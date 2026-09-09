const test = require("node:test");
const assert = require("node:assert/strict");
const { EUR_PAIR_INVENTORY } = require("../../../pair-coverage/eur/pair_inventory");
const { assessEurPairReadiness, derivePairDecision } = require("../../../pair-coverage/eur/pair_contract");
const { completeInput, completeSignal, directEurUsdPrice } = require("./fixtures");

test("covers the seven configured EUR pair routes", () => {
  assert.deepEqual(EUR_PAIR_INVENTORY.map((pair) => pair.pairLabel), [
    "EUR/USD", "EUR/GBP", "XAU/EUR", "XAG/EUR", "WTI/EUR", "NQ/EUR", "BTC/EUR"
  ]);
  assert.equal(EUR_PAIR_INVENTORY.find((pair) => pair.pairCode === "XAU_EUR").baseAsset, "GOLD");
});

test("derives opposite and same-direction outcomes without USD-specific fields", () => {
  assert.equal(derivePairDecision("BULLISH", "BEARISH"), "BUY");
  assert.equal(derivePairDecision("BEARISH", "BULLISH"), "SELL");
  assert.equal(derivePairDecision("BULLISH", "BULLISH"), "NO_CLEAR_BIAS");
  assert.equal(derivePairDecision("NO_CLEAR_BIAS", "BEARISH"), "NO_CLEAR_BIAS");
});

test("accepts complete EUR/USD evidence and calculates lower conviction", () => {
  const result = assessEurPairReadiness(completeInput());
  assert.equal(result.ready, true);
  assert.equal(result.tradable, true);
  assert.equal(result.decision, "BUY");
  assert.equal(result.combinedConviction, 72);
});

test("keeps a valid no-clear-bias decision distinct from blocked readiness", () => {
  const result = assessEurPairReadiness(completeInput("EUR_USD", "BULLISH", "BULLISH"));
  assert.equal(result.ready, true);
  assert.equal(result.tradable, false);
  assert.equal(result.decision, "NO_CLEAR_BIAS");
});

test("fails closed for missing, expired, future and mismatched evidence", () => {
  const input = completeInput();
  input.baseSignal = { ...input.baseSignal, expiresAt: "2026-09-09T09:59:00Z" };
  input.quoteSignal = { ...input.quoteSignal, availableAt: "2026-09-09T11:00:00Z", horizonHours: 4 };
  input.priceEvidence = { ...directEurUsdPrice, orientation: "USD/EUR" };
  const result = assessEurPairReadiness(input);
  assert.equal(result.ready, false);
  assert.deepEqual(result.reasons.sort(), ["expired", "future_available", "mismatched_horizon", "wrong_price_orientation"]);
});

test("blocks wrong asset identity and unsupported price evidence", () => {
  const input = completeInput();
  input.baseSignal = completeSignal("GOLD", "BULLISH");
  input.priceEvidence = { ...directEurUsdPrice, sourceType: "candle-combination" };
  const result = assessEurPairReadiness(input);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("wrong_asset"));
  assert.ok(result.reasons.includes("unsupported_price_source"));
});

test("requires both synchronized legs and execution limits for synthetic crosses", () => {
  const input = completeInput("EUR_GBP");
  input.quoteSignal = completeSignal("GBP", "BEARISH");
  input.priceEvidence = {
    sourceType: "synthetic",
    feedId: "synthetic-eurgbp-v1",
    instrument: "EUR/GBP",
    orientation: "EUR/GBP",
    units: "GBP per EUR",
    observedAt: "2026-09-09T09:02:00Z",
    legs: [{ instrument: "EUR/USD" }],
    timestampAligned: false
  };
  const result = assessEurPairReadiness(input);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("synthetic_legs_required"));
  assert.ok(result.reasons.includes("synthetic_timestamps_not_aligned"));
  assert.ok(result.reasons.includes("synthetic_execution_limits_required"));
});

test("blocks all non-EUR/USD inventory entries without matching evidence", () => {
  for (const pair of EUR_PAIR_INVENTORY.slice(1)) {
    const result = assessEurPairReadiness({ ...completeInput(pair.pairCode), priceEvidence: directEurUsdPrice });
    assert.equal(result.ready, false, pair.pairLabel);
    assert.ok(result.reasons.includes("wrong_asset"), pair.pairLabel);
  }
});