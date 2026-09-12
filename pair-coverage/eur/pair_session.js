// Isolated EUR pair session rules.
//
// Mirrors live dashboard behaviour exactly:
//   - script.js `isWeekendDate(date)` uses the Europe/London weekday.
//   - script.js `marketOpenForDate(agentName, date)` returns true for BTC only,
//     otherwise `!isWeekendDate(date)`.
//   - The pair's BASE asset governs live eligibility (the quote asset's own
//     session does not gate the pair), matching how the live pair loop checks
//     `marketOpenForDate(config.targetAssetCode, marketDate)`.
//
// Pure: no I/O, no imports.

const TWENTY_FOUR_SEVEN_ASSETS = Object.freeze(["BTC"]);

const MARKET_CLOSED_REASON =
  "Market closed: no live trade is permitted outside the active market session.";

function isWeekendDate(date) {
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "Europe/London"
  });
  return weekday === "Saturday" || weekday === "Sunday";
}

function marketOpenForDate(assetCode, date) {
  return TWENTY_FOUR_SEVEN_ASSETS.includes(assetCode) || !isWeekendDate(date);
}

function baseAssetOf(pair) {
  return pair?.base ?? pair?.baseAsset ?? null;
}

function pairSessionStatus(pair, date = new Date()) {
  const base = baseAssetOf(pair);
  const open = marketOpenForDate(base, date);
  return {
    pairCode: pair?.pairCode ?? null,
    instrument: pair?.instrument ?? pair?.pairLabel ?? null,
    base,
    quote: pair?.quote ?? pair?.quoteAsset ?? null,
    marketStatus: open ? "OPEN" : "CLOSED",
    reason: open ? null : MARKET_CLOSED_REASON
  };
}

function pairSessionStatuses(pairs, date = new Date()) {
  return pairs.map((pair) => pairSessionStatus(pair, date));
}

module.exports = {
  TWENTY_FOUR_SEVEN_ASSETS,
  MARKET_CLOSED_REASON,
  isWeekendDate,
  marketOpenForDate,
  pairSessionStatus,
  pairSessionStatuses
};
