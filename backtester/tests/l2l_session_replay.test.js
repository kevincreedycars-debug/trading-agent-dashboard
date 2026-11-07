const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AMBIGUITY,
  EXIT,
  buildGrid,
  crossingFor,
  replaySessions,
  sizePosition,
  ticketGeometry
} = require("../lib/l2l_session_replay");

/**
 * The L2L session replay (backtester/lib/l2l_session_replay.js).
 *
 * These tests hold the parts of the live rule that a replay could quietly improve: the trigger is a crossing,
 * the entry is a limit back at the crossed line, the limit carries no expiry, a target taken without a fill
 * removes the order, a stopped-out trade goes back to the same level, and one ambiguous bar is resolved
 * pessimistically rather than in the trade's favour.
 */

const LEVELS = [
  { price: 1.12729, role: "seed", kind: "l2l", label: "seed high" },
  { price: 1.12308, role: "seed", kind: "l2l", label: "seed low" },
  { price: 1.11887, role: "derived", kind: "l2l", label: "derived 1.11887" },
  { price: 1.11466, role: "derived", kind: "l2l", label: "derived 1.11466" }
];

const SESSION = {
  date: "2026-11-06",
  startMs: Date.parse("2026-11-06T05:00:00Z"),
  endMs: Date.parse("2026-11-07T05:00:00Z")
};

const at = (hhmm) => `2026-11-06T${hhmm}:00Z`;
const bar = (hhmm, open, high, low, close) => ({ time_utc: at(hhmm), open, high, low, close });

function replay(bars, overrides = {}) {
  return replaySessions({
    bars,
    levels: LEVELS,
    side: "short",
    rMultiple: 5,
    point: 0.00001,
    digits: 5,
    sessions: [SESSION],
    balanceStart: 100000,
    riskPct: 0.01,
    contract: { contractSize: 100000, minLot: 0.01, lotStep: 0.01 },
    ...overrides
  });
}

test("the original grid keeps the marked ladder and the half grid adds one midpoint per gap", () => {
  const original = buildGrid(LEVELS, { halfGrid: false });
  assert.deepEqual(original.map(level => level.price), [1.12729, 1.12308, 1.11887, 1.11466]);

  const half = buildGrid(LEVELS, { halfGrid: true });
  assert.equal(half.length, 7);
  assert.deepEqual(
    half.filter(level => level.source === "midpoint").map(level => level.price),
    [1.125185, 1.120975, 1.116765]
  );
  assert.deepEqual(
    half.filter(level => level.source === "original").map(level => level.price),
    [1.12729, 1.12308, 1.11887, 1.11466]
  );
});

test("five to one is one fifth of the entry-to-target distance and three to one a third", () => {
  const grid = buildGrid(LEVELS, { halfGrid: false });
  const five = ticketGeometry({ entry: 1.12308, side: "short", grid, rMultiple: 5, minBreak: 0.00001, digits: 5 });
  assert.equal(five.ok, true);
  assert.equal(five.target, 1.11887);
  assert.equal(five.reward, 0.00421);
  assert.equal(five.risk, 0.00084);
  assert.equal(five.stop, 1.12392);

  const half = buildGrid(LEVELS, { halfGrid: true });
  const three = ticketGeometry({ entry: 1.12308, side: "short", grid: half, rMultiple: 3, minBreak: 0.00001, digits: 5 });
  assert.equal(three.target, 1.12098);
  assert.equal(three.risk, 0.0007);
});

test("a level with no line beyond it states no ticket", () => {
  const grid = buildGrid(LEVELS, { halfGrid: false });
  const geometry = ticketGeometry({ entry: 1.11466, side: "short", grid, rMultiple: 5, minBreak: 0.00001 });
  assert.equal(geometry.ok, false);
  assert.equal(geometry.cause, "no-target");
});

test("a price that has merely been sitting beyond a line has crossed nothing", () => {
  const grid = buildGrid(LEVELS, { halfGrid: false });
  const previous = { close: 1.12200, timeMs: Date.parse(at("05:00")) };
  const sitting = { close: 1.12100, timeMs: Date.parse(at("05:05")) };
  assert.equal(crossingFor({ bar: sitting, previous, side: "short", grid, minBreak: 0 }), null);

  const crossing = { close: 1.12290, timeMs: Date.parse(at("05:10")) };
  const inside = { close: 1.12320, timeMs: Date.parse(at("05:05")) };
  const cleared = crossingFor({ bar: crossing, previous: inside, side: "short", grid, minBreak: 0 });
  assert.equal(cleared.price, 1.12308);
});

test("a bar after a hole in the tape crosses nothing", () => {
  const grid = buildGrid(LEVELS, { halfGrid: false });
  const previous = { close: 1.12320, timeMs: Date.parse("2026-11-06T05:00:00Z") };
  const afterGap = { close: 1.12290, timeMs: Date.parse("2026-11-09T05:00:00Z") };
  assert.equal(crossingFor({ bar: afterGap, previous, side: "short", grid, minBreak: 0 }), null);
});

test("one per cent of the balance is risked on the stop and the size follows the lot step", () => {
  const size = sizePosition({
    balance: 100000,
    riskPct: 0.01,
    stopDistance: 0.000842,
    contractSize: 100000,
    minLot: 0.01,
    lotStep: 0.01
  });
  assert.equal(size.riskAmount, 1000);
  assert.equal(size.lots, 11.87);

  const tiny = sizePosition({
    balance: 1000,
    riskPct: 0.01,
    stopDistance: 5,
    contractSize: 100000,
    minLot: 0.01,
    lotStep: 0.01
  });
  assert.equal(tiny.lots, 0.01);
});

test("the crossed line states a limit, a retrace fills it and the next line pays five R", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12302, 1.12290, 1.12300),
    bar("05:15", 1.12310, 1.12320, 1.12300, 1.12302),
    bar("05:20", 1.12302, 1.12310, 1.11850, 1.11880)
  ];
  const result = replay(bars);
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.equal(trade.level, 1.12308);
  assert.equal(trade.entry, 1.12308);
  assert.equal(trade.stop, 1.12392);
  assert.equal(trade.target, 1.11887);
  assert.equal(trade.triggerTimeUtc, at("05:05"));
  assert.equal(trade.fillTimeUtc, at("05:15"));
  assert.equal(trade.exitReason, EXIT.TARGET);
  assert.equal(trade.rGross, 5);
  assert.equal(result.totals.balanceEnd, 105000);
  assert.equal(result.totals.returnPctGross, 5);
});

test("a target taken without the retrace removes the limit and scores nothing", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12305, 1.11880, 1.11900)
  ];
  const result = replay(bars);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].kind, "no-fill");
  assert.equal(result.trades[0].exitReason, EXIT.INVALIDATED);
  assert.equal(result.trades[0].rGross, 0);
  assert.equal(result.totals.balanceEnd, 100000);
});

test("one bar carrying both the target and the retrace is flagged and resolved as never filled", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12310, 1.11880, 1.11900)
  ];
  const result = replay(bars);
  const trade = result.trades[0];
  assert.equal(trade.exitReason, EXIT.INVALIDATED);
  assert.deepEqual(trade.ambiguity, [AMBIGUITY.TARGET_AND_FILL_IN_ONE_BAR]);
  assert.equal(result.totals.ambiguous, 1);
});

test("a stopped-out trade goes back to the same line and the next fill keeps its own trigger time", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12302, 1.12290, 1.12300),
    bar("05:15", 1.12310, 1.12320, 1.12300, 1.12302),
    bar("05:20", 1.12302, 1.12400, 1.12300, 1.12390),
    bar("05:25", 1.12390, 1.12395, 1.12200, 1.12250),
    bar("05:30", 1.12250, 1.12310, 1.12240, 1.12300),
    bar("05:35", 1.12300, 1.12310, 1.11880, 1.11900)
  ];
  const result = replay(bars);
  assert.equal(result.trades.length, 2);
  assert.equal(result.trades[0].exitReason, EXIT.STOP);
  assert.equal(result.trades[0].rGross, -1);
  assert.equal(result.trades[1].level, 1.12308);
  assert.equal(result.trades[1].triggerTimeUtc, at("05:25"));
  assert.equal(result.trades[1].fillTimeUtc, at("05:30"));
  assert.equal(result.trades[1].exitReason, EXIT.TARGET);
  assert.equal(result.totals.rGross, 4);
  assert.equal(result.totals.balanceEnd, 103950);
});

test("a re-entry is not placed while its line is behind the market", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12302, 1.12290, 1.12300),
    bar("05:15", 1.12310, 1.12320, 1.12300, 1.12302),
    bar("05:20", 1.12302, 1.12400, 1.12300, 1.12390),
    bar("05:25", 1.12390, 1.12410, 1.12350, 1.12400)
  ];
  const result = replay(bars);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].exitReason, EXIT.STOP);
  const waiting = result.events.filter(event => event.type === "re-entry-waiting");
  assert.equal(waiting.length, 1);
  assert.equal(result.events.some(event => event.type === "re-entry-armed"), false);
});

test("the limit does not expire on a clock: it is still resting when the session ends", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12330, 1.12280, 1.12300)
  ];
  const result = replay(bars);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].exitReason, EXIT.WORKING);
  assert.equal(result.trades[0].rGross, 0);
  assert.equal(result.totals.working, 1);
});

test("a third of the distance is taken from the half grid's next line", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12330, 1.12305, 1.12310),
    bar("05:15", 1.12310, 1.12320, 1.12280, 1.12290),
    bar("05:20", 1.12290, 1.12300, 1.12050, 1.12070)
  ];
  const result = replay(bars, { rMultiple: 3, halfGrid: true });
  const trade = result.trades[0];
  assert.equal(trade.entry, 1.12308);
  assert.equal(trade.target, 1.12098);
  assert.equal(trade.stop, 1.12378);
  assert.equal(trade.rGross, 3);
});

test("a bar outside every session window is not traded", () => {
  const bars = [
    bar("04:50", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("04:55", 1.12320, 1.12325, 1.12295, 1.12300)
  ];
  const result = replay(bars);
  assert.equal(result.trades.length, 0);
  assert.equal(result.totals.balanceEnd, 100000);
});

test("the same tape and the same call always give the same ledger", () => {
  const bars = [
    bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320),
    bar("05:05", 1.12320, 1.12325, 1.12295, 1.12300),
    bar("05:10", 1.12300, 1.12330, 1.12305, 1.12310),
    bar("05:15", 1.12310, 1.12320, 1.12300, 1.12302),
    bar("05:20", 1.12302, 1.12310, 1.11850, 1.11880)
  ];
  const first = replay(bars);
  const second = replay(bars);
  assert.deepEqual(first.trades, second.trades);
  assert.deepEqual(first.totals, second.totals);
});

test("the ledger states where its call came from and that it is gross", () => {
  const bars = [bar("05:00", 1.12320, 1.12340, 1.12310, 1.12320)];
  const result = replay(bars, { callModel: "l1-eur-bearish", callAsOfUtc: "2026-11-06T00:00:00Z" });
  assert.equal(result.inputs.callModel, "l1-eur-bearish");
  assert.equal(result.inputs.callAsOfUtc, "2026-11-06T00:00:00Z");
  assert.match(result.inputs.executionNote, /gross of spread, commission and slippage/);
  assert.equal(result.inputs.riskPct, 0.01);
});

