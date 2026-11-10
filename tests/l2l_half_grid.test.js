// The second account's lane: the same rule on a half grid, at three to one.
//
// The rule itself does not change - a closed five-minute candle beyond a line, a limit back at that line, the
// next line as the target, the stop a fraction of that distance behind the entry. What changes is what counts as
// a line (one midpoint inserted between every adjacent pair of marked levels) and which fraction (a third rather
// than a fifth). These tests state the four cases that combination creates - a long and a short, each entered
// from a marked level and from a midpoint - and hold the stop to exactly one third of the entry-to-target
// distance in every one of them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");

const FIXTURES = path.join(__dirname, "fixtures", "lane1");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

// Three marked levels 10 apart, highest first: 120, 110, 100. On the half grid the lines are 120, 115, 110, 105,
// 100 - so every case below sits on a line the user marked or on the one line this lane inserts between two.
const LEVELS = [
  { price: 120, role: "derived", label: "derived 120" },
  { price: 110, role: "seed", label: "seed 110" },
  { price: 100, role: "derived", label: "derived 100" }
];

const NOW = Date.parse("2026-11-07T12:05:00Z");

// Two closed bars, the newest of which finishes past `close` from `previousClose`: a crossing, not a price that
// has been sitting on one side of a line.
function barsCrossing({ previousClose, close }) {
  return [
    { time_utc: "2026-11-07T11:50:00Z", open: previousClose - 0.5, high: previousClose, low: previousClose - 1, close: previousClose - 0.5 },
    { time_utc: "2026-11-07T11:55:00Z", open: previousClose, high: previousClose + 1, low: previousClose - 1, close: previousClose },
    { time_utc: "2026-11-07T12:00:00Z", open: previousClose, high: Math.max(previousClose, close) + 1, low: Math.min(previousClose, close) - 1, close }
  ];
}

function reading({ previousClose, close, direction = "BULLISH", grid = "half", rMultiple = 3 }) {
  return strategy.buildPlan({
    symbol: "US100.cash",
    direction,
    levels: LEVELS,
    bars: barsCrossing({ previousClose, close }),
    point: 0.01,
    nowMs: NOW,
    grid,
    rMultiple
  });
}

test("the half grid inserts one midpoint between every adjacent pair and nothing else", () => {
  const grid = strategy.halfGrid(LEVELS);
  assert.deepEqual(grid.map(level => level.price), [120, 115, 110, 105, 100]);
  assert.deepEqual(grid.map(level => level.role), ["derived", "midpoint", "seed", "midpoint", "derived"]);
  // The marked levels keep their own labels: a midpoint says where it came from, a mark says what it is.
  assert.equal(grid[2].label, "seed 110");
  assert.equal(grid[1].label, "midpoint 115 between 120 and 110");
});

test("a midpoint that rounds onto a neighbour is dropped rather than kept as a line", () => {
  const tight = [
    { price: 1.000002, role: "seed" },
    { price: 1.000001, role: "seed" }
  ];
  // Two prices a tick apart whose midpoint rounds to the upper one: a line that is not strictly between the two
  // it came from would put a target where the user marked nothing.
  assert.deepEqual(strategy.halfGrid(tight).map(level => level.price), [1.000002, 1.000001]);
});

test("the full grid is the marked ladder untouched, so lane 1 reads what it always read", () => {
  const marked = strategy.readLevels(LEVELS);
  assert.deepEqual(strategy.gridLevels(LEVELS), marked);
  assert.deepEqual(strategy.gridLevels(LEVELS, "full"), marked);
  assert.deepEqual(strategy.gridLevels(LEVELS, "half"), strategy.halfGrid(LEVELS));
});

test("long from a marked level: the limit goes back to it, the target is the midpoint above, the stop a third", () => {
  const row = reading({ previousClose: 99.5, close: 101 });
  assert.equal(row.stage, "confirmed");
  assert.equal(row.grid, "half");
  assert.equal(row.plan.entry, 100);
  assert.equal(row.plan.target, 105);
  assert.equal(row.plan.r_multiple, 3);
  assert.deepEqual(row.plan.target_level.role, "midpoint");
  assert.equal(row.plan.risk, 1.666667);
  assert.equal(row.plan.stop, 98.333333);
  assert.equal(row.plan.entry_type, "limit");
  assert.ok(row.reason.includes("one third of that distance"));
});

test("long from a midpoint: the entry is the midpoint the candle cleared, the target the mark above", () => {
  const row = reading({ previousClose: 104, close: 106 });
  assert.equal(row.stage, "confirmed");
  assert.equal(row.plan.entry, 105);
  assert.equal(row.level.price, 105);
  assert.equal(row.level.role, "midpoint");
  assert.equal(row.plan.target, 110);
  assert.equal(row.plan.stop, 103.333333);
});

test("short from a marked level: the limit goes back to it, the target the midpoint below, the stop a third", () => {
  const row = reading({ previousClose: 110.5, close: 109, direction: "BEARISH" });
  assert.equal(row.stage, "confirmed");
  assert.equal(row.side, "short");
  assert.equal(row.plan.entry, 110);
  assert.equal(row.plan.target, 105);
  assert.equal(row.plan.stop, 111.666667);
  assert.equal(row.plan.r_multiple, 3);
});

test("short from a midpoint: the entry is the midpoint the candle cleared, the target the mark below", () => {
  const row = reading({ previousClose: 115.5, close: 114, direction: "BEARISH" });
  assert.equal(row.stage, "confirmed");
  assert.equal(row.plan.entry, 115);
  assert.equal(row.level.role, "midpoint");
  assert.equal(row.plan.target, 110);
  assert.equal(row.plan.stop, 116.666667);
});

test("in all four cases the stop is exactly one third of the entry-to-target distance", () => {
  const cases = [
    { previousClose: 99.5, close: 101, direction: "BULLISH" },
    { previousClose: 104, close: 106, direction: "BULLISH" },
    { previousClose: 110.5, close: 109, direction: "BEARISH" },
    { previousClose: 115.5, close: 114, direction: "BEARISH" }
  ];
  cases.forEach(one => {
    const row = reading(one);
    const distance = Math.abs(row.plan.target - row.plan.entry);
    const risk = Math.abs(row.plan.entry - row.plan.stop);
    assert.ok(Math.abs(risk - distance / 3) < 0.000002, `${one.close}: risk ${risk} is a third of ${distance}`);
  });
});

test("lane 1 keeps five to one on the same bars: the midpoint is not a line for it", () => {
  const laneOne = reading({ previousClose: 99.5, close: 101, grid: "full", rMultiple: 5 });
  assert.equal(laneOne.plan.entry, 100);
  assert.equal(laneOne.plan.target, 110, "the next marked level, not the midpoint");
  assert.equal(laneOne.plan.stop, 98);
  assert.equal(laneOne.reason.includes("one fifth of that distance"), true);
});

test("a trade triggered at a level puts back at that same level on the half grid", () => {
  // The trade was triggered at 110 and its target is the midpoint above it. After that target is taken the trade
  // is over, and a fresh crossing puts the limit back at 110 - the same level, the same ticket - rather than at
  // the line the target sat on.
  const row = strategy.reentryPlan({
    symbol: "US100.cash",
    side: "long",
    entry: 110,
    levels: LEVELS,
    point: 0.01,
    rMultiple: 3,
    grid: "half"
  });
  assert.equal(row.stage, "confirmed");
  assert.equal(row.plan.entry, 110);
  assert.equal(row.plan.target, 115);
  assert.equal(row.plan.stop, 108.333333);
});

test("a reading on the half grid states its grid, so a page can draw the lines the loop traded", () => {
  const row = strategy.strategyReadings({
    instruments: [{
      symbol: "US100.cash",
      dashboard_asset: "NQ",
      levels: LEVELS,
      m5: { bars: barsCrossing({ previousClose: 99.5, close: 101 }) },
      point: 0.01
    }],
    positions: [],
    calls: { NQ: "BULLISH" },
    nowMs: NOW,
    grid: "half",
    rMultiple: 3
  })[0];
  assert.equal(row.plan.entry, 100);
  assert.equal(row.plan.target, 105);
  assert.equal(row.grid, "half");
  assert.equal(row.r_multiple, 3);
});

test("the published ladder gains exactly one line per gap, and every midpoint sits between its pair", () => {
  const levels = fixture("levels.json").instruments.find(row => row.symbol === "BTCUSD").levels;
  const full = strategy.readLevels(levels);
  const half = strategy.halfGrid(levels);
  assert.equal(half.length, full.length * 2 - 1);
  for (let index = 1; index < half.length; index += 1) {
    assert.ok(half[index].price < half[index - 1].price, `line ${index} is below the one above it`);
  }
  half.filter(level => level.role === "midpoint").forEach(level => {
    assert.ok(half.some(marked => marked.role !== "midpoint" && marked.price > level.price));
    assert.ok(half.some(marked => marked.role !== "midpoint" && marked.price < level.price));
  });
});

