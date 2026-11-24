"use strict";

// The session horizon applied to the stored L2L tick sweep.
//
// The claim these cases pin is narrow and checkable: the published sweep priced trades outside the
// 05:00-to-05:00 London session, and the corrected file prices every one of them inside it without
// inventing a decision. They also pin the guard that makes the correction honest - a sweep that cannot be
// reproduced from its own audit is refused rather than quietly re-priced.

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const bounds = require("../lib/usd_layer1_backtester/tick_sweep_bounds");

const ROOT = path.resolve(__dirname, "../..");
const V1 = path.join(ROOT, "data", "usd-layer1-backtester", "l2l-tick-sweep-v1.json");
const V2 = path.join(ROOT, "data", "usd-layer1-backtester", "l2l-tick-sweep-v2.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** A tape just wide enough to bound one trade, with the endpoint closes spelled out. */
function syntheticTape({ date = "2026-10-05", symbol = "EURUSD", bid = 1.2, ask = 1.2002 } = {}) {
  const window = bounds.sessionWindow(date);
  return {
    key: `${symbol}|${date}`,
    symbol,
    date,
    window,
    contract: { contractSize: 100000, minLot: 0.01, lotStep: 0.01, digits: 5, point: 0.00001 },
    endpoint_bar: { time_utc: `${date}T23:55:00Z`, bid_close: bid, ask_close: ask, spread_last: ask - bid },
    bars: 288,
    gaps: 0,
    sha256: "synthetic",
    bytes: 0
  };
}

function trade({ session = "2026-10-05", fillAt, exitAt, side = "long", entry = 1.2, stop = 1.19, exit = 1.25 } = {}) {
  return {
    symbol: "EURUSD",
    model: "current",
    rule: "full_5r",
    session_date: session,
    side,
    level: entry,
    trigger_time_utc: fillAt,
    order: { entry, stop, target: exit, r_multiple: 5 },
    fill: {
      time_utc: fillAt,
      price: entry,
      quote: { time_utc: fillAt, bid: { close: entry }, ask: { close: entry }, spread_at_close: 0 }
    },
    exit: exitAt
      ? {
          time_utc: exitAt,
          price: exit,
          quote: { time_utc: exitAt, bid: { close: exit }, ask: { close: exit }, spread_at_close: 0 },
          reason: "target",
          gap_flag: false
        }
      : null,
    r_gross: exitAt ? 5 : 0,
    lots: 1,
    risk_amount: 1000,
    balance_before: 100000,
    balance_after: 105000,
    ambiguity: []
  };
}

test("the session contract resolves 05:00 London to 05:00 London, and refuses a Saturday start", () => {
  const summer = bounds.sessionWindow("2026-10-05");
  assert.equal(summer.cutoff_at_utc, "2026-10-05T04:00:00Z");
  assert.equal(summer.endpoint_at_utc, "2026-10-06T04:00:00Z");
  assert.equal(summer.window_hours, 24);
  assert.equal(summer.session_starts_weekday, true);

  const winter = bounds.sessionWindow("2026-10-26");
  assert.equal(winter.cutoff_at_utc, "2026-10-26T05:00:00Z");
  assert.equal(winter.endpoint_at_utc, "2026-10-27T05:00:00Z");
  assert.equal(winter.window_hours, 24);

  const autumnChange = bounds.sessionWindow("2026-10-24");
  assert.equal(autumnChange.window_hours, 25);
  assert.equal(autumnChange.session_starts_weekday, false);

  const springChange = bounds.sessionWindow("2026-03-28");
  assert.equal(springChange.window_hours, 23);
  assert.equal(springChange.session_starts_weekday, false);
});

test("a fill outside its own session is cancelled, and an open position is closed at the endpoint", () => {
  const tape = syntheticTape({ bid: 1.24, ask: 1.2402 });
  const tapes = { [tape.key]: tape };
  const inside = trade({ fillAt: "2026-10-05T06:00:00Z", exitAt: "2026-10-05T09:00:00Z" });
  const carried = trade({ fillAt: "2026-10-05T07:00:00Z", exitAt: "2026-10-06T09:00:00Z" });
  const late = trade({ fillAt: "2026-10-07T09:00:00Z", exitAt: "2026-10-07T11:00:00Z" });
  const { trades, counts } = bounds.boundTrades({ trades: [inside, carried, late], tapes });

  assert.equal(counts.fills_recorded, 3);
  assert.equal(counts.fills_cancelled_at_session_end, 1);
  assert.equal(counts.exits_closed_at_session_end, 1);
  assert.equal(counts.exits_already_inside_window, 1);
  assert.deepEqual(counts.sessions_with_a_cancelled_fill, ["EURUSD|2026-10-05"]);

  assert.equal(trades[0].kind, "fill");
  assert.equal(trades[0].exit.reason, "target");

  assert.equal(trades[1].kind, "fill");
  assert.equal(trades[1].exit.reason, "session_end");
  assert.equal(trades[1].exit.price, tape.endpoint_bar.bid_close);
  assert.equal(trades[1].exit.bounded.endpoint_at_utc, tape.window.endpoint_at_utc);
  assert.equal(trades[1].exit.bounded.superseded_exit.time_utc, "2026-10-06T09:00:00Z");
  assert.equal(trades[1].r_gross, 4);

  assert.equal(trades[2].kind, "cancelled_at_session_end");
  assert.equal(trades[2].r_gross, null);
  assert.equal(trades[2].exit, null);
  assert.equal(trades[2].cancelled.at_utc, tape.window.endpoint_at_utc);
});

test("a short is closed at the ask, and its R is measured on the stop it risked", () => {
  const tape = syntheticTape({ bid: 1.2, ask: 1.2002 });
  const tapes = { [tape.key]: tape };
  const short = trade({
    side: "short",
    entry: 1.2,
    stop: 1.21,
    exit: 1.15,
    fillAt: "2026-10-05T08:00:00Z",
    exitAt: "2026-10-06T08:00:00Z"
  });
  const { trades } = bounds.boundTrades({ trades: [short], tapes });
  assert.equal(trades[0].exit.price, tape.endpoint_bar.ask_close);
  assert.equal(trades[0].r_gross, bounds.roundTo((1.2 - 1.2002) / (1.21 - 1.2), 4));
  assert.equal(bounds.rMultipleOf({ side: "long", entry: 1.2, stop: 1.19, exit: 1.25 }), 5);
});

test("the closing counts keep a session-end close and a cancelled fill out of each other's column", () => {
  const tape = syntheticTape();
  const tapes = { [tape.key]: tape };
  const { trades } = bounds.boundTrades({
    trades: [
      trade({ fillAt: "2026-10-05T06:00:00Z", exitAt: "2026-10-05T09:00:00Z" }),
      trade({ fillAt: "2026-10-05T07:00:00Z", exitAt: "2026-10-06T09:00:00Z" }),
      trade({ fillAt: "2026-10-07T09:00:00Z", exitAt: "2026-10-07T11:00:00Z" })
    ],
    tapes
  });
  const summary = bounds.summariseTrades(trades);
  assert.equal(summary.fills, 2);
  assert.equal(summary.targets, 1);
  assert.equal(summary.session_end, 1);
  assert.equal(summary.stops, 0);
  assert.equal(summary.working, 0);
});

test("the gross return reproduces the sweep's own 1% compounding", () => {
  assert.equal(bounds.returnPctGross({ trades: [{ r_gross: 5 }], riskPct: 1 }), 5);
  // The second 3R is risked on the enlarged balance, so the pair compounds to 6.09% rather than 6%.
  assert.equal(bounds.returnPctGross({ trades: [{ r_gross: 3 }, { r_gross: 3 }], riskPct: 1 }), 6.09);
  // A working trade carries no R and must not move the balance.
  assert.equal(bounds.returnPctGross({ trades: [{ r_gross: 0 }, { r_gross: 1 }], riskPct: 1 }), 1);
});

test("the published sweep reproduces from its own audit, and a tampered one is refused", () => {
  const sweep = readJson(V1);
  const clean = bounds.reproduceBaseline({ sweep, tapes: {}, startingBalance: 100000, riskPct: 1 });
  assert.deepEqual(clean.problems, []);

  const tampered = readJson(V1);
  tampered.totals.fills += 1;
  const broken = bounds.reproduceBaseline({ sweep: tampered, tapes: {}, startingBalance: 100000, riskPct: 1 });
  assert.equal(broken.problems.length, 1);
  assert.match(broken.problems[0], /totals\.fills/);
});

test("the committed v2 prices every trade inside its own session and supersedes v1 by hash", () => {
  const sweep = readJson(V2);
  const v1Buf = fs.readFileSync(V1);
  assert.equal(sweep.supersedes.sha256, crypto.createHash("sha256").update(v1Buf).digest("hex"));
  assert.equal(sweep.supersedes.schema, readJson(V1).schema);

  const windows = {};
  for (const session of sweep.horizon.sessions) {
    windows[`${session.symbol}|${session.date}`] = session;
  }
  assert.equal(Object.keys(windows).length, 24);

  for (const row of sweep.trade_audit) {
    const window = windows[`${row.symbol}|${row.session_date}`];
    assert.ok(window, `${row.symbol} ${row.session_date} has no declared window`);
    if (row.kind === "cancelled_at_session_end") {
      assert.equal(row.exit, null);
      assert.ok(row.cancelled.superseded_fill.time_utc >= window.endpoint_at_utc);
      continue;
    }
    assert.ok(row.fill.time_utc >= window.cutoff_at_utc, `${row.symbol} ${row.session_date} filled before the cutoff`);
    assert.ok(row.fill.time_utc < window.endpoint_at_utc, `${row.symbol} ${row.session_date} filled after the endpoint`);
    assert.ok(row.exit, "a bounded sweep leaves no position open");
    assert.ok(row.exit.time_utc < window.endpoint_at_utc, `${row.symbol} ${row.session_date} exited after the endpoint`);
    if (row.exit.reason === "session_end") {
      assert.equal(row.exit.bounded.endpoint_at_utc, window.endpoint_at_utc);
    }
  }
});

test("v2 keeps v1's decisions: the same ladder, order and level for every trade it still counts", () => {
  const v1 = readJson(V1);
  const v2 = readJson(V2);
  const key = (row) =>
    [row.symbol, row.model, row.rule, row.session_date, row.level, row.order.entry, row.order.stop, row.order.target].join("|");
  assert.deepEqual(v2.trade_audit.map(key), v1.trade_audit.map(key), "the audit must be the same decisions in the same order");
  for (const row of v2.per_symbol) {
    const prior = v1.per_symbol.find((entry) => entry.symbol === row.symbol);
    assert.deepEqual(row.ladder, prior.ladder, `${row.symbol}: the ladder must not be re-marked`);
  }
  assert.equal(
    v2.totals.fills_cancelled_at_session_end,
    v2.trade_audit.filter((row) => row.kind === "cancelled_at_session_end").length
  );
  assert.equal(v2.totals.working, 0);
});
