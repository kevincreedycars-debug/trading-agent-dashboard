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

module.exports = { completeInput, completeSignal, directEurUsdPrice };