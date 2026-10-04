// Contract tests for the L2L deviation rule: the four steps the user asked for, read from the artifacts the
// lane already publishes.
//
// The rule is arithmetic over three files - the Layer 1 calls, the marked ladder and the M5 bars - and it
// is the place where a wrong answer would be expensive, so what is asserted here is the arithmetic and the
// refusals: which stage a reading stands in, that a limit ticket is the level itself with the stop behind
// the deviation leg and the target at five times the risk, that one pair never carries two tickets, and
// that the module carries no order call at all. The page wiring is asserted at source level, the way the
// levels tests assert theirs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  DEVIATION_TIMEFRAME,
  REWARD_R_MULTIPLE,
  DEVIATION_LOOKBACK_BARS,
  STAGES,
  SIDES,
  normaliseDirection,
  sideForDirection,
  readLevels,
  readBars,
  nearestBelow,
  nearestAbove,
  buildPlan,
  strategyReadings,
  strategySummary,
  planMarkerPrices
} = require("../lib/l2l_strategy.js");

const repoRoot = path.join(__dirname, "..");

function bar(minutes, open, high, low, close) {
  const hour = 15 + Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  return { time_utc: `2026-10-04T${String(hour).padStart(2, "0")}:${minute}:00Z`, open, high, low, close };
}

// Two marked levels 1,000 apart, the shape the user's ladders actually have, and three M5 bars that end at
// a close. Each case moves only the two closes the rule reads: the confirming candle and the one before it.
const LEVELS = [
  { price: 85500.0, role: "derived", label: "derived 85500" },
  { price: 84500.0, role: "seed", label: "seed 84500" },
  { price: 83500.0, role: "derived", label: "derived 83500" }
];

function barsEndingAt(close, { previousClose = 84480, low = close - 200, high = close + 50 } = {}) {
  return [
    bar(0, 84200, 84400, 84100, 84300),
    { time_utc: "2026-10-04T15:05:00Z", open: 84300, high: Math.max(84510, previousClose), low: 84250, close: previousClose },
    { time_utc: "2026-10-04T15:10:00Z", open: previousClose, high, low, close }
  ];
}


test("the rule's own constants are the ones the user asked for", () => {
  assert.equal(DEVIATION_TIMEFRAME, "M5");
  assert.equal(REWARD_R_MULTIPLE, 5);
  assert.deepEqual(SIDES, ["long", "short"]);
  assert.ok(STAGES.includes("confirmed") && STAGES.includes("waiting") && STAGES.includes("blocked"));
  assert.ok(DEVIATION_LOOKBACK_BARS > 0);
});

test("a direction is read from the dashboard's own words", () => {
  assert.equal(normaliseDirection("BULLISH"), "BULLISH");
  assert.equal(normaliseDirection("BEARISH_LEAN"), "BEARISH");
  assert.equal(normaliseDirection(" bullish "), "BULLISH");
  assert.equal(normaliseDirection("NEUTRAL"), null);
  assert.equal(normaliseDirection("PENDING"), null);
  assert.equal(normaliseDirection(null), null);
  assert.equal(sideForDirection("BULLISH"), "long");
  assert.equal(sideForDirection("BEARISH"), "short");
  assert.equal(sideForDirection("NEUTRAL"), null);
});

test("levels and bars are reduced to the rows the rule can read", () => {
  const levels = readLevels([
    { price: "84500", role: "seed" },
    { price: 85500, role: "derived" },
    { price: 0, role: "seed" },
    { price: null }
  ]);
  assert.deepEqual(levels.map(level => level.price), [85500, 84500]);
  assert.equal(levels[0].role, "derived");
  assert.equal(levels[1].role, "seed");

  // A block published newest-first still ends at the newest bar, and a row that is not a candle is dropped.
  const bars = readBars([
    bar(10, 1, 2, 0.5, 1.5),
    bar(0, 1, 2, 0.5, 1.5),
    { time_utc: "2026-10-04T15:05:00Z", open: 1, high: 2, low: null, close: 1.5 }
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[bars.length - 1].time_utc, "2026-10-04T15:10:00Z");
});

test("the line under and the line over a price are the only two the rule needs", () => {
  const levels = readLevels(LEVELS);
  assert.equal(nearestBelow(levels, 85000).price, 84500);
  assert.equal(nearestAbove(levels, 85000).price, 85500);
  assert.equal(nearestBelow(levels, 83000), null);
  assert.equal(nearestAbove(levels, 86000), null);
});

test("an open position blocks the pair rather than doubling it", () => {
  const plan = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars: barsEndingAt(85000),
    point: 0.01,
    position: { symbol: "BTCUSD", ticket: 1 }
  });
  assert.equal(plan.stage, "blocked");
  assert.equal(plan.available, false);
  assert.equal(plan.plan, null);
  assert.match(plan.reason, /one trade at a time/);
});

test("no call and no levels are refused, and said plainly", () => {
  const noCall = buildPlan({ symbol: "EURUSD", direction: "NEUTRAL", levels: LEVELS, bars: barsEndingAt(85000) });
  assert.equal(noCall.stage, "no-call");
  assert.equal(noCall.available, false);
  assert.equal(noCall.plan, null);
  assert.equal(noCall.side, null);
  assert.match(noCall.reason, /no direction/);

  const noLevels = buildPlan({ symbol: "XAUUSD", direction: "BULLISH", levels: [], bars: barsEndingAt(85000) });
  assert.equal(noLevels.stage, "no-levels");
  assert.match(noLevels.reason, /No L2L level is marked/);

  // A single bar is not a history: with nothing before the newest close the rule cannot say it crossed a line.
  const tooFew = buildPlan({ symbol: "US100.cash", direction: "BULLISH", levels: LEVELS, bars: barsEndingAt(85000).slice(0, 1) });
  assert.equal(tooFew.stage, "unavailable");
  assert.match(tooFew.reason, /no close can be judged/);
});

test("a close that has not cleared a line leaves the rule waiting, and says which line it is watching", () => {
  const plan = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars: barsEndingAt(84400, { low: 84200 }),
    point: 0.01
  });
  assert.equal(plan.stage, "waiting");
  assert.equal(plan.available, false);
  assert.equal(plan.plan, null);
  assert.equal(plan.watch.level.price, 84500);
  assert.equal(plan.watch.distance.price, 100);
  assert.match(plan.reason, /Waiting for a M5 close above a marked level/);

  // A close that clears the line by less than one point of the instrument's own grid has not cleared it.
  const hairline = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars: barsEndingAt(84500.005, { low: 84300 }),
    point: 0.01
  });
  assert.equal(hairline.stage, "waiting");
});

test("a confirmed long is a limit at the level, a stop behind the leg, and five times the risk", () => {
  const plan = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars: barsEndingAt(84700, { low: 84400 }),
    point: 0.01
  });
  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.available, true);
  assert.equal(plan.side, "long");
  assert.equal(plan.level.price, 84500);
  // The entry is the level itself: the rule buys the retrace to it, so it is a limit, not a market order.
  assert.equal(plan.plan.entry, 84500);
  assert.equal(plan.plan.entry_type, "limit");
  // The stop is the lowest low of the leg that left the level: the bar before the crossing (84250) and the
  // crossing bar itself (84400), so 84250 is the extreme the re-entry is measured against.
  assert.equal(plan.plan.stop, 84250);
  assert.equal(plan.plan.risk, 250);
  assert.equal(plan.plan.target, 85750);
  assert.equal(plan.plan.r_multiple, 5);
  assert.equal(plan.plan.reward, 1250);
  assert.equal(plan.plan.risk_points, 25000);
  assert.equal(plan.plan.bars_in_leg, 2);
  assert.equal(plan.confirmation.close, 84700);
  assert.equal(plan.confirmation.beyond.price, 200);
  assert.equal(plan.confirmation.time_utc, "2026-10-04T15:10:00Z");
});

test("a confirmed short is the mirror image, and its target is below the entry", () => {
  const plan = buildPlan({
    symbol: "EURUSD",
    direction: "BEARISH",
    levels: LEVELS,
    bars: barsEndingAt(84300, { previousClose: 84600, high: 84900, low: 84250 }),
    point: 0.01
  });
  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.side, "short");
  assert.equal(plan.level.price, 84500);
  assert.equal(plan.plan.entry, 84500);
  // The extreme of the leg on the other side: the highest high of the bar before the crossing (84510) and
  // the crossing bar (84900).
  assert.equal(plan.plan.stop, 84900);
  assert.equal(plan.plan.risk, 400);
  assert.equal(plan.plan.target, 82500);
  assert.ok(plan.plan.target < plan.plan.entry);
});

test("a candle that opens a five-minute bucket has not closed, so it confirms nothing yet", () => {
  // The last bar of the block opens at 15:15 and closes at 84700, above the 84500 line. While its own five
  // minutes are still running its close is just the price now, so the rule reads the bar before it - the
  // 15:10 close of 84400, which has crossed nothing - rather than firing on a half-formed candle.
  const bars = barsEndingAt(84700, { low: 84400 }).slice(0, 2).concat([
    { time_utc: "2026-10-04T15:10:00Z", open: 84480, high: 84510, low: 84250, close: 84400 },
    { time_utc: "2026-10-04T15:15:00Z", open: 84400, high: 84750, low: 84400, close: 84700 }
  ]);
  const forming = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars,
    point: 0.01,
    nowMs: Date.parse("2026-10-04T15:16:00Z")
  });
  assert.equal(forming.stage, "waiting");
  assert.equal(forming.confirmation.time_utc, "2026-10-04T15:10:00Z");

  const closed = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars,
    point: 0.01,
    nowMs: Date.parse("2026-10-04T15:20:00Z")
  });
  assert.equal(closed.stage, "confirmed");
  assert.equal(closed.confirmation.time_utc, "2026-10-04T15:15:00Z");
});

test("a bar that is not the previous five minutes cannot define the stop", () => {
  // A weekend, a dropped row: the bar before the crossing candle is two days old, so the leg is the crossing
  // candle alone and the stop is that candle's own low rather than a stale weekend range.
  const bars = [
    { time_utc: "2026-10-02T20:45:00Z", open: 80050, high: 80100, low: 79900, close: 80000 },
    { time_utc: "2026-10-02T20:50:00Z", open: 80000, high: 80050, low: 79000, close: 80010 },
    { time_utc: "2026-10-04T15:10:00Z", open: 84500, high: 84800, low: 84400, close: 84700 }
  ];
  const plan = buildPlan({ symbol: "BTCUSD", direction: "BULLISH", levels: LEVELS, bars, point: 0.01 });
  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.plan.stop, 84400);
  assert.equal(plan.plan.bars_in_leg, 1);
  assert.equal(plan.plan.risk, 100);
  assert.equal(plan.plan.target, 85000);
});

test("a leg with no room behind the level is refused rather than given a stop on the wrong side", () => {
  // The 15:05 candle elected 84500 and never traded under it, and the candle that crossed is above it too, so
  // the extreme of the leg sits exactly on the level. The rule says so instead of inventing a distance.
  const bars = [
    { time_utc: "2026-10-04T15:00:00Z", open: 84300, high: 84450, low: 84200, close: 84400 },
    { time_utc: "2026-10-04T15:05:00Z", open: 84450, high: 84520, low: 84500, close: 84500 },
    { time_utc: "2026-10-04T15:10:00Z", open: 84500, high: 84800, low: 84500, close: 84700 }
  ];
  const plan = buildPlan({ symbol: "BTCUSD", direction: "BULLISH", levels: LEVELS, bars, point: 0.01 });
  assert.equal(plan.stage, "waiting");
  assert.equal(plan.available, false);
  assert.equal(plan.plan, null);
  assert.match(plan.reason, /no measurable risk/);
});

test("one reading per instrument is produced for every pair the feed publishes", () => {
  const readings = strategyReadings({
    instruments: [
      { symbol: "EURUSD", dashboard_asset: "EUR", point: 0.00001, m5: { bars: barsEndingAt(84700, { low: 84400 }) } },
      { symbol: "XAUUSD", dashboard_asset: "GOLD", point: 0.01, levels: LEVELS, m5: { bars: barsEndingAt(84400, { low: 84200 }) } },
      { symbol: "US100.cash", dashboard_asset: "NQ", point: 0.1, levels: LEVELS, m5: { bars: barsEndingAt(84700, { low: 84400 }) } },
      { symbol: "BTCUSD", dashboard_asset: "BTC", point: 0.01, levels: LEVELS, m5: { bars: barsEndingAt(84700, { low: 84400 }) } }
    ],
    calls: { EUR: "BULLISH", GOLD: "BEARISH", NQ: "BULLISH", BTC: "BULLISH" },
    positions: [{ symbol: "BTCUSD", ticket: 297646459 }]
  });
  // The first instrument carries no levels of its own, which is the artifact's own empty state; the pair
  // with a stored call and no ladder is a reading, not an error.
  assert.deepEqual(readings.map(reading => reading.symbol), ["EURUSD", "XAUUSD", "US100.cash", "BTCUSD"]);
  assert.equal(readings[0].stage, "no-levels");
  assert.equal(readings[1].stage, "waiting");
  assert.equal(readings[2].stage, "confirmed");
  assert.equal(readings[3].stage, "blocked");

  const summary = strategySummary(readings);
  assert.equal(summary.instruments, 4);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.waiting, 1);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.noLevels, 1);
  assert.equal(strategySummary([]).instruments, 0);
});

test("an instant handed in is handed through to every pair's reading", () => {
  // The page reads one clock for all four pairs, so a bar that is still forming on the chart is still
  // forming for every row of the rule: the same block read with and without the instant has to disagree,
  // and all four rows have to move together rather than one of them firing on a half-formed candle.
  const bars = barsEndingAt(84700, { low: 84400 }).slice(0, 2).concat([
    { time_utc: "2026-10-04T15:10:00Z", open: 84480, high: 84510, low: 84250, close: 84400 },
    { time_utc: "2026-10-04T15:15:00Z", open: 84400, high: 84750, low: 84400, close: 84700 }
  ]);
  const input = {
    instruments: ["EURUSD", "XAUUSD", "US100.cash", "BTCUSD"].map((symbol, index) => ({
      symbol,
      dashboard_asset: ["EUR", "GOLD", "NQ", "BTC"][index],
      point: 0.01,
      levels: LEVELS,
      m5: { bars }
    })),
    calls: { EUR: "BULLISH", GOLD: "BULLISH", NQ: "BULLISH", BTC: "BULLISH" }
  };
  const forming = strategyReadings({ ...input, nowMs: Date.parse("2026-10-04T15:16:00Z") });
  assert.deepEqual(forming.map(reading => reading.stage), ["waiting", "waiting", "waiting", "waiting"]);
  assert.deepEqual(forming.map(reading => reading.confirmation.time_utc), [
    "2026-10-04T15:10:00Z", "2026-10-04T15:10:00Z", "2026-10-04T15:10:00Z", "2026-10-04T15:10:00Z"
  ]);

  const closed = strategyReadings({ ...input, nowMs: Date.parse("2026-10-04T15:20:00Z") });
  assert.deepEqual(closed.map(reading => reading.stage), ["confirmed", "confirmed", "confirmed", "confirmed"]);
  // Without an instant the newest row is read as closed, which is what a caller with no clock gets.
  assert.deepEqual(strategyReadings(input).map(reading => reading.stage), ["confirmed", "confirmed", "confirmed", "confirmed"]);
});

test("the three prices a confirmed ticket is drawn from are handed over in order", () => {
  const confirmed = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: LEVELS,
    bars: barsEndingAt(84700, { low: 84400 }),
    point: 0.01
  });
  const markers = planMarkerPrices(confirmed);
  assert.deepEqual(markers.map(marker => marker.key), ["entry", "stop", "target"]);
  assert.deepEqual(markers.map(marker => marker.price), [84500, 84250, 85750]);
  const waiting = buildPlan({ symbol: "BTCUSD", direction: "BULLISH", levels: LEVELS, bars: barsEndingAt(84400) });
  assert.deepEqual(planMarkerPrices(waiting), []);
  assert.deepEqual(planMarkerPrices(null), []);
});

test("the rule places no order: it hands a plan over and nothing else", () => {
  const source = fs.readFileSync(path.join(repoRoot, "lib", "l2l_strategy.js"), "utf8");
  // Nothing here may reach a bridge, a broker endpoint or the network. Placing the ticket is the caller's
  // job - the dashboard's own order tool - so the module is safe to load on the page and in this checker.
  for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "child_process", "http://", "https://", "/order", "order_send", "Ticket"]) {
    assert.equal(source.includes(forbidden), false, `the rule must not carry ${forbidden}`);
  }
  // And nothing in it can place one by accident: every exported name is a reading, and none is named like
  // something that sends.
  const exported = require("../lib/l2l_strategy.js");
  const names = Object.keys(exported);
  assert.ok(names.length >= 15);
  for (const name of names) {
    assert.equal(/order|send|submit|place|ticket/i.test(name), false, `${name} is named like a trade`);
  }
});
