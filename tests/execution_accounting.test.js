"use strict";

// Guards the execution account: the contract's 1% sizing rule, a labelled cost schedule, equity after each
// fill, drawdown from the running peak, and a skipped trade that names what it was missing.

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const accounting = require(path.join(ROOT, "lib", "layer1_backtesting", "execution_accounting"));
const contracts = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "contracts"));
const fixture = require(path.join(ROOT, "data", "usd-layer1-backtester", "fixtures", "execution-accounting-v1.json"));

function run(costs) {
  return accounting.accountFor({ trades: fixture.trades, costs });
}

test("the sizing rule is the contract's own account rule", () => {
  assert.equal(accounting.SIZING.starting_balance, contracts.ACCOUNT.starting_balance);
  assert.equal(accounting.SIZING.starting_balance, 100000);
  assert.equal(accounting.SIZING.risk_per_trade_pct, contracts.ACCOUNT.risk_per_trade_pct);
  assert.equal(accounting.SIZING.risk_per_trade_pct, 1);
  assert.equal(accounting.SIZING.currency, "GBP");
});

test("the labelled fixture reproduces every hand-checked row and the summary", () => {
  const account = run("fixture_costs");
  const expected = fixture.expected;
  assert.equal(account.taken, expected.taken);
  assert.equal(account.skipped, expected.skipped);
  assert.equal(account.final_equity, expected.final_equity);
  assert.equal(account.return_pct, expected.return_pct);
  assert.equal(account.max_drawdown, expected.max_drawdown);
  assert.equal(account.max_drawdown_pct, expected.max_drawdown_pct);
  assert.equal(account.expectancy_r, expected.expectancy_r);
  assert.equal(account.profit_factor, expected.profit_factor);
  assert.equal(account.gross_total, expected.gross_total);
  assert.equal(account.cost_total, expected.cost_total);
  assert.equal(account.cost_drag_pct, expected.cost_drag_pct);
  for (const row of expected.rows) {
    const actual = account.rows.find((entry) => entry.id === row.id);
    assert.ok(actual, `${row.id} must be in the account`);
    for (const field of Object.keys(row)) {
      assert.equal(actual[field], row[field], `${row.id}.${field}`);
    }
  }
  assert.equal(account.cost_model.id, "fixture_costs");
  assert.match(account.cost_model.label_statement, /not a broker schedule/);
});

test("the trade with no stop distance is skipped with its reason, not sized to the minimum lot", () => {
  const account = run("fixture_costs");
  const skipped = account.rows.find((row) => row.id === "btc-no-stop");
  assert.equal(skipped.skipped, true);
  assert.match(skipped.reason, /no stop distance/);
});

test("a zero cost schedule is labelled gross and differs from the fixture schedule", () => {
  const gross = run("zero");
  assert.equal(gross.cost_model.id, "zero");
  assert.match(gross.cost_model.label_statement, /gross/);
  assert.equal(gross.cost_total, 0);
  assert.equal(gross.final_equity, 109150);
  assert.notEqual(gross.final_equity, run("fixture_costs").final_equity);
});

test("an account that goes below zero stops and is reported as blown", () => {
  const blown = accounting.accountFor({
    trades: [
      { id: "crash", market: "BTCUSD", direction: "short", entry: 50000, stop: 50500, exit: 120000, contract_size: 1 },
      { id: "after", market: "EURUSD", direction: "long", entry: 1.1, stop: 1.095, exit: 1.2, contract_size: 100000 }
    ],
    costs: "zero"
  });
  assert.equal(blown.blown, true);
  assert.equal(blown.rows[1].skipped, true);
  assert.match(blown.rows[1].reason, /already below zero/);
});

test("a risk budget too small for the minimum lot is skipped rather than forced", () => {
  const small = accounting.accountFor({
    sizing: Object.assign({}, accounting.SIZING, { starting_balance: 50 }),
    trades: [{ market: "EURUSD", direction: "long", entry: 1.1, stop: 1.095, exit: 1.2, contract_size: 100000 }],
    costs: "zero"
  });
  assert.equal(small.taken, 0);
  assert.equal(small.skipped, 1);
  assert.match(small.rows[0].reason, /minimum lot/);
});

test("path simulations can be handed to the account without retyping their prices", () => {
  const trades = accounting.tradesFromPaths([
    { rule: "full_5r", filled: true, direction: "long", entry: 1.1, stop: 1.095, exit: 1.125 },
    { rule: "full_5r", filled: false, outcome: "no_fill" }
  ], { market: "EURUSD" });
  assert.equal(trades.length, 1);
  assert.equal(trades[0].contract_size, 100000);
  assert.equal(trades[0].direction, "long");
});
