// Contract tests for the position sizer: the arithmetic behind the box a charting terminal draws under a
// trade, which is the picture the user asked to see for the trades already executed.
//
// Every number here is money, so what is asserted is the arithmetic and the refusals: what a distance to a
// stop and a distance to a target were worth at the size the trade was taken in, that the instrument's own
// contract size is what turns a price move into money, that a trade with no stop, no target or a bracket on
// the wrong side of the entry has no box rather than a wrong one, and that the module carries no order call,
// no DOM and no trade of its own. The page wiring is asserted at source level in tests/live_trading_feed.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  REASONS,
  formatRatio,
  formatPercent,
  tradePositionSizer,
  positionToolLines,
  positionToolNote
} = require("../lib/l2l_sizing.js");

const repoRoot = path.join(__dirname, "..");
const modulePath = path.join(repoRoot, "lib", "l2l_sizing.js");
const BTC = { symbol: "BTCUSD", digits: 2, contract_size: 1 };
const EUR = { symbol: "EURUSD", digits: 5, contract_size: 100000 };
const ACCOUNT = { currency: "USD" };

// The trade this lane actually placed and closed on 2026-10-04, at the levels the terminal carried: entry
// 85300.51, stop 85155.64, target 86023.40 at 0.01 lot. Its own numbers, not invented ones.
const BTC_ROUND_TRIP = {
  symbol: "BTCUSD",
  side: "buy",
  volume: 0.01,
  price_open: 85300.51,
  stop_loss: 85155.64,
  take_profit: 86023.4
};

test("the sizer reads a real round trip's levels and money off the trade's own row", () => {
  const sizer = tradePositionSizer(BTC_ROUND_TRIP, BTC, ACCOUNT);
  assert.equal(sizer.available, true);
  assert.equal(sizer.side, "buy");
  assert.equal(sizer.digits, 2);
  assert.equal(sizer.contractSize, 1);
  assert.equal(sizer.currency, "USD");
  // The two distances, on the instrument's own scale.
  assert.equal(sizer.stopMove, 144.87);
  assert.equal(sizer.targetMove, 722.89);
  // And what those distances were worth at the 0.01 lot that was traded, in the account's own money.
  assert.equal(sizer.riskAmount, 1.45);
  assert.equal(sizer.rewardAmount, 7.23);
  assert.equal(sizer.ratio, 4.99);
  assert.deepEqual(sizer.lines, {
    target: "Target: 86023.40 \u00b7 722.89 (0.847%) \u00b7 7.23 USD reward",
    stop: "Stop: 85155.64 \u00b7 144.87 (0.17%) \u00b7 1.45 USD risk",
    entry: "Entry: 85300.51 \u00b7 Qty 0.01 \u00b7 Risk/reward ratio 4.99"
  });
});

test("the money follows the instrument's own contract size, not the price move", () => {
  // One lot of an FX pair is 100,000 units, so a two-pip stop is two dollars at 0.01 lots rather than the
  // 0.002 a reader would get by treating the price move itself as the risk.
  const short = tradePositionSizer(
    { side: "sell", volume: 0.01, price_open: 1.125, stop_loss: 1.127, take_profit: 1.115 },
    EUR,
    ACCOUNT
  );
  assert.equal(short.available, true);
  assert.equal(short.stopMove, 0.002);
  assert.equal(short.targetMove, 0.01);
  assert.equal(short.riskAmount, 2);
  assert.equal(short.rewardAmount, 10);
  assert.equal(short.ratio, 5);
  assert.deepEqual(short.lines, {
    target: "Target: 1.11500 \u00b7 0.01000 (0.889%) \u00b7 10.00 USD reward",
    stop: "Stop: 1.12700 \u00b7 0.00200 (0.178%) \u00b7 2.00 USD risk",
    entry: "Entry: 1.12500 \u00b7 Qty 0.01 \u00b7 Risk/reward ratio 5"
  });
  // A snapshot that does not carry a contract size is read as one unit per lot rather than as a money figure
  // nobody declared.
  const withoutContractSize = tradePositionSizer(
    { side: "sell", volume: 0.01, price_open: 1.125, stop_loss: 1.127, take_profit: 1.115 },
    { digits: 5 },
    ACCOUNT
  );
  assert.equal(withoutContractSize.contractSize, 1);
  assert.equal(withoutContractSize.riskAmount, 0);
  assert.equal(withoutContractSize.ratio, null, "a risk of zero has no ratio to state");
  // The arithmetic is then honest and tiny rather than scaled up by a contract size nobody stated: 0.01 lots
  // of a two-pip stop at one unit per lot is a hundredth of a cent, which rounds to zero.
  assert.equal(withoutContractSize.rewardAmount, 0);
  assert.equal(withoutContractSize.lines.stop, "Stop: 1.12700 \u00b7 0.00200 (0.178%) \u00b7 0.00 USD risk");
});

test("a trade with no stop, no target or no entry has no box, and says which one is missing", () => {
  const missing = (overrides) => tradePositionSizer({ ...BTC_ROUND_TRIP, ...overrides }, BTC, ACCOUNT);
  assert.deepEqual(missing({ side: null }), { available: false, reason: REASONS.noSide });
  assert.deepEqual(missing({ price_open: null }), { available: false, reason: REASONS.noEntry });
  assert.deepEqual(missing({ stop_loss: null }), { available: false, reason: REASONS.noStop });
  assert.deepEqual(missing({ take_profit: null }), { available: false, reason: REASONS.noTarget });
  // A price of zero is a missing price, not a stop at the bottom of the scale.
  assert.equal(missing({ stop_loss: 0 }).reason, REASONS.noStop);
  // And a bracket on the wrong side of the entry is refused rather than drawn with the risk above the reward.
  assert.equal(missing({ stop_loss: 86023.4, take_profit: 85155.64 }).reason, REASONS.inverted);
  assert.equal(
    tradePositionSizer({ ...BTC_ROUND_TRIP, side: "sell" }, BTC, ACCOUNT).reason,
    REASONS.inverted,
    "a short whose stop is below its entry is the same refusal"
  );
});

test("a trade whose size was not read back still states its prices and distances", () => {
  const sizer = tradePositionSizer({ ...BTC_ROUND_TRIP, volume: null }, BTC, ACCOUNT);
  assert.equal(sizer.available, true);
  assert.equal(sizer.quantity, null);
  assert.equal(sizer.riskAmount, null);
  assert.equal(sizer.rewardAmount, null);
  assert.equal(sizer.ratio, null);
  // The distances are properties of the trade, not of how big it was, so they survive an unread size; only
  // the money and the ratio fall away, and the lines drop those clauses instead of printing a null.
  assert.equal(sizer.stopMove, 144.87);
  assert.equal(sizer.lines.stop, "Stop: 85155.64 \u00b7 144.87 (0.17%)");
  assert.equal(sizer.lines.target, "Target: 86023.40 \u00b7 722.89 (0.847%)");
  assert.equal(sizer.lines.entry, "Entry: 85300.51");
});

test("the note counts what could be sized and names what could not", () => {
  const sized = tradePositionSizer(BTC_ROUND_TRIP, BTC, ACCOUNT);
  const unsized = tradePositionSizer({ ...BTC_ROUND_TRIP, stop_loss: null }, BTC, ACCOUNT);
  assert.equal(positionToolNote([sized]), "1 executed trade with the position tool drawn");
  assert.equal(
    positionToolNote([sized, sized, unsized]),
    "2 executed trades with the position tool drawn, 1 without (no stop or target read back)"
  );
  assert.equal(positionToolNote([unsized]), `1 executed trade with no position tool (${REASONS.noStop})`);
  assert.equal(positionToolNote([]), "");
  assert.equal(positionToolNote(null), "");
});

test("the labels round the way a reader would, and never invent a place", () => {
  assert.equal(formatRatio(5), "5");
  assert.equal(formatRatio(4.5678), "4.57");
  assert.equal(formatRatio(4.9919), "4.99");
  assert.equal(formatPercent(0.17), "0.17");
  assert.equal(formatPercent(0.847), "0.847");
  assert.equal(formatPercent(2), "2");
  // One implementation of the three lines, whichever way it is reached.
  const sizer = tradePositionSizer(BTC_ROUND_TRIP, BTC, ACCOUNT);
  assert.deepEqual(positionToolLines(sizer), sizer.lines);
});

test("the sizer module places nothing, reads no page and exports no trade", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  // No order call, by any of the names a send could take, and no transport that could carry one.
  const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /child_process/, /https?:\/\//, /\/order/, /order_send/, /\bTicket\b/];
  forbidden.forEach((pattern) => {
    assert.equal(pattern.test(source), false, `the sizer must not carry ${pattern}`);
  });
  // Nothing here reads the page or the machine either: it is arithmetic over rows it is handed.
  [/document\./, /window\./, /localStorage/, /process\.env/].forEach((pattern) => {
    assert.equal(pattern.test(source), false, `the sizer must not read ${pattern}`);
  });
  // And nothing exported is named like something that could send: a sizer, not a trade.
  const exported = require("../lib/l2l_sizing.js");
  assert.deepEqual(
    Object.keys(exported).filter(name => /order|place|send|submit|ticket/i.test(name)),
    [],
    "no export may be named like an order"
  );
  assert.deepEqual(Object.keys(exported).sort(), [
    "REASONS",
    "contractSizeFor",
    "digitsFor",
    "formatPercent",
    "formatPrice",
    "formatRatio",
    "positionToolLines",
    "positionToolNote",
    "tradePositionSizer"
  ]);
});
