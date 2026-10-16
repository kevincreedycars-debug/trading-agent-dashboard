// Contract tests for the L2L deviation rule: the four steps the user asked for, read from the artifacts the
// lane already publishes.
//
// The rule is arithmetic over three files - the Layer 1 calls, the marked ladder and the M5 bars - and it
// is the place where a wrong answer would be expensive, so what is asserted here is the arithmetic and the
// refusals: which stage a reading stands in, that a limit ticket is the line the candle deviated with the
// next marked line as its 5R target and the stop at one fifth of that distance, that one pair never carries
// two tickets, and that the module carries no order call at all. The page wiring is asserted at source
// level, the way the levels tests assert theirs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  DEVIATION_TIMEFRAME,
  REWARD_R_MULTIPLE,
  LANE_MAGIC,
  STAGES,
  SIDES,
  normaliseDirection,
  sideForDirection,
  readLevels,
  readBars,
  nearestBelow,
  nearestAbove,
  buildPlan,
  reentryPlan,
  laneHoldings,
  holdingPlan,
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

test("a confirmed long is a limit at the deviated line, the next marked line as its 5R target, and the stop a fifth of that distance", () => {
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
  // The entry is the line the candle deviated: the rule buys the retrace to it, so it is a limit, not a
  // market order.
  assert.equal(plan.plan.entry, 84500);
  assert.equal(plan.plan.entry_type, "limit");
  // The target is the next line the user has marked past that entry - 85500 on this ladder - and the stop is
  // the distance that makes it worth five times the risk: 1,000 over five, so 200 behind the entry.
  assert.equal(plan.plan.target, 85500);
  assert.equal(plan.plan.target_level.price, 85500);
  assert.equal(plan.plan.target_level.role, "derived");
  assert.equal(plan.plan.reward, 1000);
  assert.equal(plan.plan.risk, 200);
  assert.equal(plan.plan.stop, 84300);
  assert.equal(plan.plan.r_multiple, 5);
  assert.equal(plan.plan.risk_points, 20000);
  assert.equal(plan.plan.reward_points, 100000);
  assert.equal(plan.confirmation.close, 84700);
  assert.equal(plan.confirmation.beyond.price, 200);
  assert.equal(plan.confirmation.time_utc, "2026-10-04T15:10:00Z");
  assert.match(plan.reason, /aims the 5R target at the next marked line 85500/);
});

test("a confirmed short is the mirror image: the next line below is the target and the stop is a fifth of it", () => {
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
  // The same two steps as the long, mirrored: 83500 is the next line marked below the entry, so the target is
  // 1,000 away and the stop sits 200 above the entry rather than behind any high.
  assert.equal(plan.plan.target, 83500);
  assert.equal(plan.plan.reward, 1000);
  assert.equal(plan.plan.risk, 200);
  assert.equal(plan.plan.stop, 84700);
  assert.ok(plan.plan.target < plan.plan.entry);
  assert.ok(plan.plan.stop > plan.plan.entry);
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

test("the stop no longer comes from any bar, so a stale block cannot define it", () => {
  // A weekend, a dropped row: the bar before the crossing candle is two days old. It does not stop the
  // crossing from confirming, and it no longer has any say in where the stop goes - the ladder sets the
  // target and the target sets the stop - so the same ticket comes out of this block as out of a clean one.
  const bars = [
    { time_utc: "2026-10-02T20:45:00Z", open: 80050, high: 80100, low: 79900, close: 80000 },
    { time_utc: "2026-10-02T20:50:00Z", open: 80000, high: 80050, low: 79000, close: 80010 },
    { time_utc: "2026-10-04T15:10:00Z", open: 84500, high: 84800, low: 84400, close: 84700 }
  ];
  const plan = buildPlan({ symbol: "BTCUSD", direction: "BULLISH", levels: LEVELS, bars, point: 0.01 });
  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.plan.entry, 84500);
  assert.equal(plan.plan.target, 85500);
  assert.equal(plan.plan.risk, 200);
  assert.equal(plan.plan.stop, 84300);
});

test("a candle that closes past two lines at once enters at the last line it deviated, and aims at the line past that", () => {
  // One five-minute candle taking out two marked lines leaves two readings of "the level that was deviated".
  // The rule takes the *last* line it deviated - the higher one for a long, the one price finished nearest
  // past - because that is the line the retrace comes back to first, and the line beyond it is then the next
  // level marked on the chart, which is the 5R target.
  const ladder = [
    { price: 85500.0, role: "derived" },
    { price: 85000.0, role: "derived" },
    { price: 84500.0, role: "seed" },
    { price: 83500.0, role: "derived" }
  ];
  const bars = [
    { time_utc: "2026-10-04T15:00:00Z", open: 84200, high: 84400, low: 84100, close: 84300 },
    { time_utc: "2026-10-04T15:05:00Z", open: 84300, high: 84450, low: 84250, close: 84400 },
    { time_utc: "2026-10-04T15:10:00Z", open: 84400, high: 85250, low: 84350, close: 85200 }
  ];
  const plan = buildPlan({ symbol: "BTCUSD", direction: "BULLISH", levels: ladder, bars, point: 0.01 });
  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.plan.entry, 85000);
  assert.equal(plan.plan.target, 85500);
  assert.equal(plan.plan.reward, 500);
  assert.equal(plan.plan.risk, 100);
  assert.equal(plan.plan.stop, 84900);
});

test("a crossing with no line left marked past it is refused rather than aimed at nothing", () => {
  // 84500 is the top of this ladder, so the candle really did deviate a line and there is still no next
  // level to put the 5R target at. The rule says which fact is missing instead of inventing a distance.
  const ladder = [
    { price: 84500.0, role: "seed" },
    { price: 83500.0, role: "derived" }
  ];
  const plan = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: ladder,
    bars: barsEndingAt(84700, { low: 84400 }),
    point: 0.01
  });
  assert.equal(plan.stage, "waiting");
  assert.equal(plan.available, false);
  assert.equal(plan.plan, null);
  assert.equal(plan.level.price, 84500);
  assert.equal(plan.confirmation.beyond.price, 200);
  assert.match(plan.reason, /the last marked line on that side/);
});

test("a next line so close that five to one puts the stop inside the grid is refused too", () => {
  // Four hundredths of a point of reward over five is eight thousandths behind the entry, which is inside
  // BTCUSD's own 0.01 grid: a stop has to be a price, so this ticket is not stated.
  const ladder = [
    { price: 84500.04, role: "derived" },
    { price: 84500.0, role: "seed" }
  ];
  const plan = buildPlan({
    symbol: "BTCUSD",
    direction: "BULLISH",
    levels: ladder,
    bars: barsEndingAt(84500.02, { low: 84400 }),
    point: 0.01
  });
  assert.equal(plan.stage, "waiting");
  assert.equal(plan.available, false);
  assert.equal(plan.plan, null);
  assert.match(plan.reason, /inside the level's own tick/);
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

// The trade's own re-entry, corrected by the user on 2026-10-05: "It should have re-entered at the same level it
// originally was triggered on until price crosses the next level." The entry is that level, priced with the same
// ladder arithmetic as any other ticket, and no candle is asked for a crossing - the crossing that opened the
// trade has already happened and this is still that trade.
test("the trade's own level is priced as a ticket without asking the candles for a crossing", () => {
  const plan = reentryPlan({ symbol: "BTCUSD", side: "long", entry: 84500, levels: LEVELS, point: 0.01 });
  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.available, true);
  assert.equal(plan.side, "long");
  assert.equal(plan.direction, "BULLISH");
  assert.equal(plan.level.price, 84500);
  assert.equal(plan.level.role, "trade");
  assert.equal(plan.confirmation, null, "no candle is read: the level is the trade's own, not a fresh crossing");
  assert.equal(plan.plan.entry, 84500);
  assert.equal(plan.plan.entry_type, "limit");
  assert.equal(plan.plan.target, 85500);
  assert.equal(plan.plan.target_level.price, 85500);
  assert.equal(plan.plan.reward, 1000);
  assert.equal(plan.plan.risk, 200);
  assert.equal(plan.plan.stop, 84300);
  assert.equal(plan.plan.r_multiple, 5);
  assert.equal(plan.plan.risk_points, 20000);
  assert.equal(plan.plan.reward_points, 100000);
  assert.match(plan.reason, /the limit goes back to that same level/);
});

test("the trade's own level is mirrored for a short, and priced at the multiple it is given", () => {
  const levels = [{ price: 1.2 }, { price: 1.1 }, { price: 1.0 }];
  const short = reentryPlan({ symbol: "EURUSD", side: "short", entry: 1.1, levels, point: 0.00001 });
  assert.equal(short.stage, "confirmed");
  assert.equal(short.plan.target, 1.0);
  assert.equal(short.plan.reward, 0.1);
  assert.equal(short.plan.risk, 0.02);
  assert.equal(short.plan.stop, 1.12);
  assert.equal(short.plan.risk_points, 2000);
  assert.equal(short.plan.reward_points, 10000);

  const wider = reentryPlan({ symbol: "EURUSD", side: "short", entry: 1.1, levels, point: 0.00001, rMultiple: 10 });
  assert.equal(wider.plan.risk, 0.01);
  assert.equal(wider.plan.stop, 1.11);
  assert.equal(wider.plan.r_multiple, 10);
});

test("the trade's own level is refused rather than priced when the ladder cannot carry a ticket", () => {
  // The entry is the last marked line on that side: there is no next line for the target to sit on.
  const noTarget = reentryPlan({ symbol: "BTCUSD", side: "long", entry: 85500, levels: LEVELS, point: 0.01 });
  assert.equal(noTarget.stage, "waiting");
  assert.equal(noTarget.plan, null);
  assert.match(noTarget.reason, /is the last marked line on that side/);

  // A next line so close that five to one puts the stop inside the instrument's own tick.
  const inGrid = reentryPlan({ symbol: "BTCUSD", side: "long", entry: 84500, levels: [{ price: 84500.02 }], point: 0.01 });
  assert.equal(inGrid.stage, "waiting");
  assert.match(inGrid.reason, /inside the level's own tick/);

  // And the readings every caller can reach: no ladder, no side, no price.
  assert.equal(reentryPlan({ symbol: "BTCUSD", side: "long", entry: 84500, levels: [] }).stage, "no-levels");
  assert.equal(reentryPlan({ symbol: "BTCUSD", side: null, entry: 84500, levels: LEVELS }).stage, "no-call");
  assert.equal(reentryPlan({ symbol: "BTCUSD", side: "long", entry: null, levels: LEVELS }).stage, "unavailable");
  assert.equal(reentryPlan({ symbol: "BTCUSD", side: "long", entry: "not a price", levels: LEVELS }).stage, "unavailable");
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
  assert.deepEqual(markers.map(marker => marker.price), [84500, 84300, 85500]);
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

// The trade the account is already in, read at its own level (the user's correction of 2026-10-05): the
// number the panel stated as a far-side crossing - *waiting for a close above 31049.43* - while a limit was
// working at 30774.61. The levels are the NQ ladder of that day, and the ticket is the one the loop placed.
const NQ_LEVELS = [
  { price: 31049.43, role: "seed", kind: "L2L", timeframe: "H1", label: "next line up" },
  { price: 30774.61, role: "seed", kind: "L2L", timeframe: "H1", label: "trade level" },
  { price: 30511.2, role: "derived", kind: "L2L", timeframe: "M5", label: "below the market" }
];

// One working ticket of the lane's, in the shape the feed publishes it.
function workingOrder(overrides = {}) {
  return {
    ticket: 297942477,
    symbol: "US100.cash",
    dashboard_asset: "NQ",
    type: "ORDER_TYPE_BUY_LIMIT",
    side: "buy",
    volume: 0.01,
    price_open: 30774.61,
    stop_loss: 30719.65,
    take_profit: 31049.43,
    magic: LANE_MAGIC,
    comment: "l2l-rule-nq",
    placed: { time_server: "2026-10-05T19:11:30+00:00", time_utc: "2026-10-05T16:11:30+00:00" },
    expiration: null,
    ...overrides
  };
}

// One filled position of the lane's, in the shape the feed publishes it.
function openPosition(overrides = {}) {
  return {
    ticket: 297942478,
    symbol: "US100.cash",
    dashboard_asset: "NQ",
    side: "buy",
    volume: 0.01,
    price_open: 30775.2,
    price_current: 31000,
    stop_loss: 30719.65,
    take_profit: 31049.43,
    profit: 22.48,
    swap: 0,
    magic: LANE_MAGIC,
    comment: "l2l-rule-nq",
    opened: { time_server: "2026-10-05T19:20:00+00:00", time_utc: "2026-10-05T16:20:00+00:00" },
    updated: { time_server: "2026-10-05T19:25:00+00:00", time_utc: "2026-10-05T16:25:00+00:00" },
    ...overrides
  };
}

test("the account's rows are read as this lane's trades by magic alone", () => {
  const holdings = laneHoldings({
    orders: [
      workingOrder(),
      // Another path's ticket: not this lane's trade, so no level of it is stated as one.
      workingOrder({ ticket: 297942100, symbol: "XAUUSD", dashboard_asset: "GOLD", magic: 1 }),
      // A row with no readable level states no level to trade back to.
      workingOrder({ ticket: 297942101, symbol: "EURUSD", dashboard_asset: "EUR", price_open: null })
    ],
    positions: []
  });
  assert.deepEqual(holdings.map(row => row.symbol), ["US100.cash"]);
  assert.deepEqual(holdings.map(row => row.kind), ["order"]);
  assert.equal(holdings[0].entry, 30774.61);
  assert.equal(holdings[0].stop, 30719.65);
  assert.equal(holdings[0].target, 31049.43);
  assert.equal(holdings[0].magic, LANE_MAGIC);

  // When a limit fills, the position and the leftover order can both sit on the pair: the newer row is the
  // trade, and everything older is that same trade's own history.
  const filled = laneHoldings({
    orders: [workingOrder()],
    positions: [openPosition({ ticket: 297942479, opened: { time_utc: "2026-10-05T16:20:00+00:00" } })]
  });
  assert.equal(filled.length, 1);
  assert.equal(filled[0].kind, "position");
  assert.equal(filled[0].ticket, 297942479);
  assert.equal(filled[0].entry, 30775.2);

  // The magic is the module's constant unless a caller hands one over, and no rows at all is no holdings.
  assert.equal(LANE_MAGIC, 20261004);
  assert.deepEqual(laneHoldings({ orders: [workingOrder({ magic: 7 })] }), []);
  assert.deepEqual(laneHoldings({ orders: [workingOrder({ magic: 7 })], magic: 7 }).map(row => row.ticket), [297942477]);
  assert.deepEqual(laneHoldings({}), []);
});

test("a pair already in a trade is read at that trade's own level, not at a crossing elsewhere", () => {
  const reading = holdingPlan({
    symbol: "US100.cash",
    holding: laneHoldings({ orders: [workingOrder()] })[0],
    levels: NQ_LEVELS,
    point: 0.01,
    // The newest closed candle is 31018: between the trade's own level and the next line up, crossing
    // nothing. That is exactly the market the panel used to read as "waiting for a close above 31049.43".
    bars: [
      { time_utc: "2026-10-05T16:05:00Z", open: 30950, high: 31010, low: 30940, close: 30995 },
      { time_utc: "2026-10-05T16:10:00Z", open: 30995, high: 31020, low: 30980, close: 31005 },
      { time_utc: "2026-10-05T16:15:00Z", open: 31005, high: 31040, low: 30990, close: 31018 }
    ]
  });
  assert.equal(reading.stage, "in-trade");
  assert.ok(STAGES.includes("in-trade"));
  assert.equal(reading.available, true);
  assert.equal(reading.side, "long");
  assert.equal(reading.direction, "BULLISH");
  assert.equal(reading.level.price, 30774.61);
  assert.equal(reading.level.role, "trade");
  // The same arithmetic the loop places from: the next marked line as the target, a fifth of that distance
  // behind the entry as the stop.
  assert.equal(reading.plan.entry, 30774.61);
  assert.equal(reading.plan.target, 31049.43);
  assert.equal(reading.plan.stop, 30719.646);
  assert.equal(reading.plan.risk_points, 5496);
  assert.equal(reading.plan.reward_points, 27482);
  assert.equal(reading.plan.entry_type, "limit");
  // The account's own copy of the ticket is stated beside it, and agrees at the instrument's precision.
  assert.equal(reading.holding.ticket, 297942477);
  assert.equal(reading.holding.kind, "order");
  assert.equal(reading.holding.stop, 30719.65);
  assert.equal(reading.holding.target, 31049.43);
  assert.equal(reading.holding.stop_matches, true);
  assert.equal(reading.holding.target_matches, true);
  // The newest closed candle is still stated, as the market the trade is in rather than as a crossing.
  assert.equal(reading.confirmation.close, 31018);
  assert.equal(reading.confirmation.beyond, null);
  assert.equal(reading.watch.level.price, 31049.43);

  // The words: the trade's own level, the two endings the user named, and no far-side crossing sentence.
  assert.match(reading.reason, /stays in the trade it was triggered on at 30774\.61/);
  assert.match(reading.reason, /ticket 297942477, working buy limit/);
  assert.match(reading.reason, /until the call for NQ changes or the target is taken/);
  assert.match(reading.reason, /the ticket is a limit back at 30774\.61/);
  assert.match(reading.reason, /agrees with that arithmetic at the instrument's own precision/);
  assert.equal(reading.reason.includes("Waiting for a M5 close"), false);
});


test("a held pair is read as in-trade for every pair the feed publishes, and counted as one", () => {
  const bars = [
    { time_utc: "2026-10-05T16:05:00Z", open: 30950, high: 31010, low: 30940, close: 30995 },
    { time_utc: "2026-10-05T16:10:00Z", open: 30995, high: 31020, low: 30980, close: 31005 },
    { time_utc: "2026-10-05T16:15:00Z", open: 31005, high: 31040, low: 30990, close: 31018 }
  ];
  const input = {
    instruments: ["EURUSD", "XAUUSD", "US100.cash", "BTCUSD"].map((symbol, index) => ({
      symbol,
      dashboard_asset: ["EUR", "GOLD", "NQ", "BTC"][index],
      point: 0.01,
      levels: NQ_LEVELS,
      m5: { bars }
    })),
    calls: { EUR: "BULLISH", GOLD: "BEARISH", NQ: "BULLISH", BTC: "BULLISH" }
  };
  const readings = strategyReadings({
    ...input,
    holdings: laneHoldings({ orders: [workingOrder()] })
  });
  // Without the holding the same artifacts read NQ as waiting on a line far above the market; with it, the
  // pair is read as the trade it is in, at its own level. That difference is the whole correction.
  const without = strategyReadings(input);
  assert.equal(without[2].stage, "waiting");
  assert.match(without[2].reason, /Waiting for a M5 close above/);
  assert.equal(readings[2].stage, "in-trade");
  assert.equal(readings[2].level.price, 30774.61);
  assert.equal(/Waiting for a M5 close/.test(readings[2].reason), false);
  // Every other pair is read exactly as it was: a holding changes the pair it is on and nothing else.
  assert.deepEqual(readings.map(row => row.stage), [without[0].stage, without[1].stage, "in-trade", without[3].stage]);

  const summary = strategySummary(readings);
  assert.equal(summary.instruments, 4);
  assert.equal(summary.inTrade, 1);
  assert.equal(summary.waiting, 3);
  assert.equal(summary.confirmed, 0);
  assert.equal(strategySummary([]).inTrade, 0);

  // The chart's three lines are the trade's own ticket, with the entry named as the trade's rather than as
  // a fresh L2L crossing.
  const markers = planMarkerPrices(readings[2]);
  assert.deepEqual(markers.map(marker => marker.price), [30774.61, 30719.646, 31049.43]);
  assert.equal(markers[0].label, "trade entry 30774.61");
  assert.deepEqual(planMarkerPrices({ stage: "in-trade", plan: null }), []);
});

test("a ticket of another path's still blocks the pair, and a holding is never read as one", () => {
  const input = {
    instruments: [{ symbol: "US100.cash", dashboard_asset: "NQ", point: 0.01, levels: NQ_LEVELS, m5: { bars: [] } }],
    calls: { NQ: "BULLISH" }
  };
  // Someone else's position: the pair is capped, as it was before holdings existed.
  const foreign = strategyReadings({ ...input, positions: [openPosition({ magic: 1 })] });
  assert.equal(foreign[0].stage, "blocked");
  // This lane's position on the same pair is the trade, read at the level it was filled at.
  const ours = strategyReadings({
    ...input,
    positions: [openPosition({ magic: 1 }), openPosition()],
    holdings: laneHoldings({ positions: [openPosition()] })
  });
  assert.equal(ours[0].stage, "in-trade");
  assert.equal(ours[0].holding.kind, "position");
  assert.equal(ours[0].level.price, 30775.2);
  // A holding the caller cannot match to an instrument configures nothing: the pair keeps its own reading,
  // whatever that reading is.
  const unmatched = strategyReadings({ ...input, holdings: laneHoldings({ orders: [workingOrder({ symbol: "GBPUSD" })] }) });
  assert.equal(unmatched[0].stage, strategyReadings(input)[0].stage);
});

test("a trade whose ladder states no ticket is still read as the trade it is", () => {
  // The trade's level is the top marked line: no line above it, so no target and no ticket - but the trade
  // is on the account, and the account's own stop and target are stated rather than left out.
  const holdings = laneHoldings({ orders: [workingOrder({ price_open: 31049.43, stop_loss: 30994.5, take_profit: 31300 })] });
  const reading = holdingPlan({ symbol: "US100.cash", holding: holdings[0], levels: NQ_LEVELS, point: 0.01 });
  assert.equal(reading.stage, "in-trade");
  assert.equal(reading.available, true);
  assert.equal(reading.plan, null);
  assert.equal(reading.level.price, 31049.43);
  assert.equal(reading.holding.stop, 30994.5);
  assert.equal(reading.holding.stop_matches, null);
  assert.match(reading.reason, /The ladder states no ticket back at that level/);
  assert.match(reading.reason, /is the last marked line on that side/);
  assert.match(reading.reason, /carries stop 30994\.5 and target 31300/);
  assert.deepEqual(planMarkerPrices(reading), []);
});

test("a holding whose side or level cannot be read states what it can and no arithmetic", () => {
  assert.equal(holdingPlan({ symbol: "US100.cash", levels: NQ_LEVELS, point: 0.01 }).stage, "unavailable");
  assert.match(
    holdingPlan({ symbol: "US100.cash", levels: NQ_LEVELS, point: 0.01 }).reason,
    /no readable ticket on the account/
  );
  const noSide = holdingPlan({
    symbol: "US100.cash",
    holding: { ticket: 1, kind: "order", entry: 30774.61, stop: null, target: null, side: null },
    levels: NQ_LEVELS,
    point: 0.01
  });
  assert.equal(noSide.stage, "in-trade");
  assert.equal(noSide.plan, null);
  assert.match(noSide.reason, /The side the ticket faces cannot be read from the feed/);
  // Every stage the module can state is still the list it publishes.
  assert.deepEqual([...STAGES], ["unavailable", "no-call", "no-levels", "waiting", "confirmed", "in-trade", "blocked"]);
});

