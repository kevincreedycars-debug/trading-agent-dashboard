const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MARKET_CLOSED_REASON,
  isWeekendDate,
  marketOpenForDate,
  pairSessionStatus,
  pairSessionStatuses
} = require("../../../pair-coverage/eur/pair_session");
const { EUR_CROSS_PAIRS } = require("../../../pair-coverage/eur/layer2_pair_adapter");

const FRIDAY = new Date("2026-09-11T12:00:00Z");
const SATURDAY = new Date("2026-09-12T12:00:00Z");

test("mirrors the live London-weekend rule", () => {
  assert.equal(isWeekendDate(FRIDAY), false);
  assert.equal(isWeekendDate(SATURDAY), true);
});

test("mirrors marketOpenForDate: BTC is the only 24/7 base asset", () => {
  assert.equal(marketOpenForDate("BTC", SATURDAY), true);
  assert.equal(marketOpenForDate("EUR", SATURDAY), false);
  assert.equal(marketOpenForDate("GOLD", SATURDAY), false);
  assert.equal(marketOpenForDate("SILVER", SATURDAY), false);
  assert.equal(marketOpenForDate("WTI", SATURDAY), false);
  assert.equal(marketOpenForDate("NQ", SATURDAY), false);
  assert.equal(marketOpenForDate("EUR", FRIDAY), true);
});

test("the pair's base asset governs session status", () => {
  const xauEur = EUR_CROSS_PAIRS.find((pair) => pair.pairCode === "XAU_EUR");
  const btcEur = EUR_CROSS_PAIRS.find((pair) => pair.pairCode === "BTC_EUR");

  assert.deepEqual(pairSessionStatus(xauEur, SATURDAY), {
    pairCode: "XAU_EUR",
    instrument: "XAU/EUR",
    base: "GOLD",
    quote: "EUR",
    marketStatus: "CLOSED",
    reason: MARKET_CLOSED_REASON
  });
  assert.equal(pairSessionStatus(xauEur, FRIDAY).marketStatus, "OPEN");
  assert.equal(pairSessionStatus(xauEur, FRIDAY).reason, null);
  assert.equal(pairSessionStatus(btcEur, SATURDAY).marketStatus, "OPEN");
});

test("reports a session status for every EUR cross", () => {
  const statuses = pairSessionStatuses(EUR_CROSS_PAIRS, SATURDAY);
  assert.equal(statuses.length, 6);
  assert.deepEqual(
    statuses.map((status) => [status.instrument, status.marketStatus]),
    [
      ["EUR/GBP", "CLOSED"],
      ["XAU/EUR", "CLOSED"],
      ["XAG/EUR", "CLOSED"],
      ["WTI/EUR", "CLOSED"],
      ["NQ/EUR", "CLOSED"],
      ["BTC/EUR", "OPEN"]
    ]
  );
});
