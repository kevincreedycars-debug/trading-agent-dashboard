const test = require("node:test");
const assert = require("node:assert/strict");

const { isMarketOpen, resolveMarketSession } = require("../lib/market_calendar");

const SATURDAY = "2026-08-29T12:00:00.000Z";
const MONDAY = "2026-08-31T12:00:00.000Z";

test("closes weekday assets over the London weekend", () => {
  for (const asset of ["USD", "EUR", "GBP", "GOLD", "SILVER", "WTI", "NQ"]) {
    assert.deepEqual(resolveMarketSession(asset, SATURDAY), {
      assetCode: asset,
      status: "CLOSED",
      reason: "WEEKEND",
      dateKey: "2026-08-29",
      timezone: "Europe/London"
    });
  }
});

test("keeps BTC open throughout the weekend", () => {
  assert.equal(isMarketOpen("BTC", SATURDAY), true);
  assert.equal(resolveMarketSession("BTC", SATURDAY).reason, "CONTINUOUS_SESSION");
});

test("fails closed for an unknown asset", () => {
  assert.equal(isMarketOpen("UNKNOWN", MONDAY), false);
  assert.equal(resolveMarketSession("UNKNOWN", MONDAY).reason, "UNKNOWN_ASSET");
});

test("honours explicit holiday and maintenance closures", () => {
  const options = {
    closures: {
      NQ: [{ date: "2026-08-31", reason: "EXCHANGE_HOLIDAY" }],
      ALL: ["2026-12-25"]
    }
  };
  assert.equal(isMarketOpen("NQ", MONDAY, options), false);
  assert.equal(resolveMarketSession("NQ", MONDAY, options).reason, "EXCHANGE_HOLIDAY");
  assert.equal(isMarketOpen("BTC", "2026-12-25T12:00:00.000Z", options), false);
});
