const completeSignal = (assetCode, direction) => ({
  assetCode,
  sourceCallId: `${assetCode.toLowerCase()}-layer1-24h-001`,
  direction,
  conviction: direction === "NO_CLEAR_BIAS" ? 0 : 72,
  horizonHours: 24,
  decisionAt: "2026-09-09T09:00:00Z",
  availableAt: "2026-09-09T09:01:00Z",
  expiresAt: "2026-09-10T09:00:00Z"
});

const directEurUsdPrice = {
  sourceType: "direct",
  feedId: "synthetic-feed-eurusd-v1",
  instrument: "EUR/USD",
  orientation: "EUR/USD",
  units: "USD per EUR",
  observedAt: "2026-09-09T09:02:00Z"
};

function completeInput(pairCode = "EUR_USD", baseDirection = "BULLISH", quoteDirection = "BEARISH") {
  return {
    pairCode,
    asOf: "2026-09-09T10:00:00Z",
    baseSignal: completeSignal("EUR", baseDirection),
    quoteSignal: completeSignal("USD", quoteDirection),
    priceEvidence: directEurUsdPrice
  };
}

// Layer 2 producer fixtures mirror the live agent_outputs call shape
// (direction + conviction only) that `layer2_trade_selection_agent` consumes.
const layer2Call = (direction, conviction) => ({ direction, conviction });

const layer2Calls = (overrides = {}) => ({
  USD: layer2Call("BEARISH", 72),
  EUR: layer2Call("BULLISH", 72),
  GBP: layer2Call("BEARISH", 68),
  GOLD: layer2Call("BULLISH", 80),
  SILVER: layer2Call("BULLISH", 66),
  WTI: layer2Call("BEARISH", 64),
  NQ: layer2Call("BULLISH", 70),
  BTC: layer2Call("BULLISH", 75),
  ...overrides
});

module.exports = {
  completeInput,
  completeSignal,
  directEurUsdPrice,
  layer2Call,
  layer2Calls
};