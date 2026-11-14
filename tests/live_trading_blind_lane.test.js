// The blind lane, held to the owner's approval of 2026-11-14.
//
// This is the third FTMO account's rule and nothing else: no Layer 1 call is read, each pair watches the nearest
// original full L2L above price and the nearest below, either line may arm either side, and the first three-leg
// deviation on the pair sets the direction. These tests hold the five things the approval names - the pair and its
// fixedness, the two directions, the refusals (a wick, a close on the line, a line nobody is watching), the ending
// (no timed expiry; out on a target reached or a line removed) and the day (a fifth valid entry can be placed on
// every lane, including when the first four were spread across assets).
//
// The lane's own state is the pair, so the restart test is a state-file test: the same two lines are read back and a
// limit already working on them is not moved. The end-to-end run at the bottom goes through runOnce with the same
// fake tool the lane-isolation suite uses, so "a fifth entry is placed" is a send and not only a decision.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");
const {
  ORDER_MAGIC,
  ORDER_TOOL_RELATIVE,
  parseArgs,
  UsageError,
  perDayCap,
  DEFAULT_MAX_PER_DAY,
  decide,
  blindWatchPairs,
  reviewPendings,
  readState,
  writeState,
  tradeCycles,
  traderStatus,
  runOnce
} = require("../scripts/run-live-trading-trader.js");

const repoRoot = path.join(__dirname, "..");
// The bars are placed against the machine's own clock: the run refuses a snapshot older than its window before any
// rule is asked, so a frozen date would make these tests tests of a stale fixture rather than of the rule.
const BAR_BASE = Math.floor(Date.now() / 300000) * 300000;
const NOW = BAR_BASE + 60000;

function bar(minutesBefore, open, high, low, close) {
  return { time_utc: new Date(BAR_BASE - minutesBefore * 60000).toISOString(), open, high, low, close };
}

// EURUSD's ladder: three original rungs, so the pair at a price near 1.105 is 1.10 below and 1.12 above. The
// excursion candles walk through 1.10 and never near 1.08, which keeps every fixture's pair the same two lines.
const EUR_LEVELS = [
  { price: 1.12, role: "seed", label: "seed 1.12" },
  { price: 1.1, role: "seed", label: "seed 1.1" },
  { price: 1.08, role: "seed", label: "seed 1.08" }
];

// 1.104 held above 1.10, 1.098 left it, 1.102 came back: the owner's three legs in order, all one session, one
// symbol, one level.
function reclaimAbove100() {
  return [
    bar(20, 1.1045, 1.1055, 1.1035, 1.104),
    bar(15, 1.104, 1.1042, 1.0975, 1.098),
    bar(10, 1.098, 1.1025, 1.0978, 1.102)
  ];
}

// The mirror image at 1.12: 1.114 held below it, 1.126 left it, 1.117 came back.
function reclaimBelow120() {
  return [
    bar(20, 1.1135, 1.1145, 1.1125, 1.114),
    bar(15, 1.114, 1.1265, 1.1138, 1.126),
    bar(10, 1.126, 1.1262, 1.1165, 1.117)
  ];
}

function blindPlanFor(bars, over = {}) {
  return strategy.blindPlan({
    symbol: "EURUSD",
    levels: over.levels || EUR_LEVELS,
    bars,
    point: 0.00001,
    nowMs: NOW,
    rMultiple: 5,
    pair: over.pair,
    position: over.position || null
  });
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-blind-"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

// One placement, as the loop writes it down: spent, placed, and on a day of its own.
function placement(symbol, minutesAgo) {
  return {
    symbol,
    asset: null,
    side: "long",
    signal_time_utc: new Date(NOW - minutesAgo * 60000).toISOString(),
    level: 1,
    entry: 1,
    stop: 0.9,
    target: 1.2,
    risk: 0.1,
    r_multiple: 5,
    placed: true,
    sent: true,
    placed_at_utc: new Date(NOW - minutesAgo * 60000).toISOString()
  };
}

// A confirmed reading in the shape the module hands the loop, for the two lanes that read a call. The blind lane's
// own readings come out of `blindPlan` itself in the test below, so nothing here invents arithmetic for it.
function confirmedReading(symbol, { signal, entry = 1.1, stop = 1.096, target = 1.12 } = {}) {
  return {
    symbol,
    asset: null,
    stage: "confirmed",
    side: "long",
    direction: "BULLISH",
    level: { price: entry },
    watch: null,
    confirmation: { time_utc: signal, close: entry + 0.002, beyond: { price: 0.002, points: 200 } },
    deviation: null,
    plan: { side: "long", entry, stop, target, risk: 0.004, reward: 0.02, r_multiple: 5, entry_type: "limit" },
    reason: "a fixture reading"
  };
}

function baseOptions(over = {}) {
  return {
    mode: "once",
    maxOpen: null,
    maxPerDay: DEFAULT_MAX_PER_DAY,
    pauseEntries: false,
    reentryCrossing: false,
    requireDeviation: false,
    blind: false,
    ...over
  };
}


// ---- The pair and the two directions ----------------------------------------------------------------------------
test("the watch pair is the nearest original line above price and the nearest below, and a midpoint is not a line it may arm on", () => {
  const pair = strategy.watchPair({ levels: EUR_LEVELS, price: 1.105 });
  assert.deepEqual([pair.lower.price, pair.upper.price], [1.1, 1.12]);

  // The half grid's midpoint is a line the second account trades and this one does not: 1.09 sits between 1.08 and
  // 1.10 and is never watched, so a price at 1.095 still watches 1.08 and 1.10 rather than the midpoint.
  const gridded = strategy.gridLevels(EUR_LEVELS, "half");
  assert.ok(gridded.some(level => level.price === 1.09), "the half grid does carry a midpoint at 1.09");
  const blind = strategy.watchPair({ levels: gridded, price: 1.095 });
  assert.deepEqual([blind.lower.price, blind.upper.price], [1.08, 1.1]);
  assert.equal(blind.lower.role, "seed", "the watched line is an original one, not a derived midpoint");
});

test("a buy reclaim of the lower watched line is a limit at it, the next original line as its target, and a fifth of that distance behind", () => {
  const reading = blindPlanFor(reclaimAbove100());
  assert.equal(reading.stage, "confirmed");
  assert.equal(reading.side, "long");
  assert.equal(reading.blind, true);
  assert.equal(reading.plan.entry_type, "limit");
  assert.deepEqual([reading.plan.entry, reading.plan.stop, reading.plan.target], [1.1, 1.096, 1.12]);
  assert.equal(reading.plan.r_multiple, 5);
  assert.match(reading.reason, /No Layer 1 call was read/, "the lane states that nothing from Layer 1 entered it");
  assert.ok(Array.isArray(reading.probes) && reading.probes.length === 4, "both watched lines were asked both ways");
});

test("a sell reclaim of the upper watched line is the mirror image, with the next line below as its target", () => {
  const reading = blindPlanFor(reclaimBelow120());
  assert.equal(reading.stage, "confirmed");
  assert.equal(reading.side, "short");
  assert.deepEqual([reading.plan.entry, reading.plan.stop, reading.plan.target], [1.12, 1.124, 1.1]);
});

// ---- The refusals the owner named -------------------------------------------------------------------------------
test("a wick, a close exactly on the line and a first approach from the far side each complete no leg", () => {
  // A wick through the upper line with the close back below it: no close, no leg. All three closes are above 1.10,
  // so nothing here can arm that line either - this fixture is only about the wick.
  const wick = blindPlanFor([
    bar(20, 1.1135, 1.1145, 1.1125, 1.114),
    bar(15, 1.114, 1.1265, 1.1138, 1.118),
    bar(10, 1.118, 1.1195, 1.1165, 1.117)
  ]);
  assert.equal(wick.stage, "waiting", "the wick above 1.12 armed nothing");
  assert.equal(wick.plan, null);

  // The newest close comes back to the line itself: a price that touched it left nothing behind.
  const onTheLine = blindPlanFor([
    bar(20, 1.1045, 1.1055, 1.1035, 1.104),
    bar(15, 1.104, 1.1042, 1.0975, 1.098),
    bar(10, 1.098, 1.1012, 1.0978, 1.1)
  ]);
  assert.equal(onTheLine.stage, "waiting");
  assert.match(onTheLine.reason, /1\.1/, "the line it could not reclaim is named");

  // No earlier close above 1.10: the newest close is the first crossing of the line, not a reclaim of it.
  const firstCrossing = blindPlanFor([
    bar(20, 1.0975, 1.0985, 1.0965, 1.098),
    bar(15, 1.098, 1.0998, 1.0962, 1.096),
    bar(10, 1.096, 1.1025, 1.0958, 1.102)
  ]);
  assert.equal(firstCrossing.stage, "waiting");
  assert.match(firstCrossing.reason, /no earlier .* finished above 1\.1/i);
});

test("a reclaim of a line nobody is watching leaves the lane waiting: only the selected pair may arm", () => {
  // The pair in force is 1.10 and 1.12, read back out of the state. These candles complete the owner's three legs
  // at 1.08 - held above it, left below it, back above it - and the lane still states no ticket, because 1.08 is
  // not one of the two lines it is watching.
  const reading = blindPlanFor([
    bar(20, 1.0855, 1.0865, 1.0845, 1.085),
    bar(15, 1.085, 1.0852, 1.0785, 1.079),
    bar(10, 1.079, 1.0815, 1.0788, 1.081)
  ], { pair: { lower: { price: 1.1 }, upper: { price: 1.12 }, price: 1.105 } });
  assert.equal(reading.stage, "waiting");
  assert.equal(reading.plan, null);
  assert.ok(reading.probes.every(probe => probe.level === 1.1 || probe.level === 1.12), "every probe asked one of the two watched lines and nothing else");
  assert.match(reading.reason, /1\.1 and 1\.12/, "the pair in force is stated on the row");
});

test("a close wide enough to clear both watched lines enters at the nearer one and aims at the line past it", () => {
  const levels = [{ price: 1.14, role: "seed" }, ...EUR_LEVELS];
  // Held above both lines (1.125), left both of them (1.095), and closed back above both (1.13): each line has all
  // three of its own legs, so both probes confirm and the nearer line is the entry.
  const reading = blindPlanFor([
    bar(20, 1.1245, 1.1255, 1.1235, 1.125),
    bar(15, 1.125, 1.1252, 1.0945, 1.095),
    bar(10, 1.095, 1.1305, 1.0948, 1.13)
  ], { levels });
  assert.equal(reading.stage, "confirmed");
  assert.deepEqual(
    [reading.plan.entry, reading.plan.stop, reading.plan.target],
    [1.12, 1.116, 1.14],
    "the nearer line is the entry, the line past it the target"
  );
});

// ---- The pair as state, and the endings -------------------------------------------------------------------------
function instrumentFor({ symbol = "EURUSD", levels = EUR_LEVELS, bars = reclaimAbove100(), point = 0.00001, quote = null } = {}) {
  return {
    symbol,
    dashboard_asset: symbol === "EURUSD" ? "EUR" : null,
    available: true,
    point,
    levels,
    m5: { bars },
    quote: quote || { bid: 1.102, ask: 1.1022, spread_points: 2, market_state: "open" }
  };
}

test("the pair is state: a restart keeps the same two lines, and a rung leaving the marked set re-selects the next two", () => {
  const selectedAt = new Date(NOW - 3600000).toISOString();
  const stored = {
    EURUSD: { price: 1.105, lower: { price: 1.1, role: "seed" }, upper: { price: 1.12, role: "seed" }, selected_at_utc: selectedAt, reason: "selected earlier" }
  };
  const state = { placements: [], blind: stored };
  const joined = { instruments: [instrumentFor()] };

  const kept = blindWatchPairs({ state, joined, cycles: new Map(), nowMs: NOW });
  assert.equal(kept.events[0].action, "kept");
  assert.equal(kept.events[0].selected_at_utc, selectedAt, "the selection instant is not rewritten by a run that kept it");
  assert.deepEqual([kept.pairs.EURUSD.lower.price, kept.pairs.EURUSD.upper.price], [1.1, 1.12]);

  // The upper rung is unmarked: the pair cannot stand, so the next two lines are selected at this run's price.
  const trimmed = blindWatchPairs({
    state,
    joined: { instruments: [instrumentFor({ levels: [{ price: 1.1, role: "seed" }, { price: 1.08, role: "seed" }] })] },
    cycles: new Map(),
    nowMs: NOW
  });
  assert.equal(trimmed.events[0].action, "reselect");
  assert.match(trimmed.events[0].reason, /left the marked set/);
  assert.equal(trimmed.pairs.EURUSD.lower.price, 1.1);
  assert.equal(trimmed.pairs.EURUSD.upper, null, "with 1.12 unmarked there is no line above the price to watch");

  // A pair selected on an earlier trading day is not carried over: the first run of a new Prague day is the lane's
  // startup, and it selects around the price that day opens at.
  const tomorrow = blindWatchPairs({
    state: {
      placements: [],
      blind: {
        EURUSD: {
          price: 1.105,
          lower: { price: 1.1 },
          upper: { price: 1.12 },
          selected_at_utc: new Date(NOW - 26 * 3600000).toISOString()
        }
      }
    },
    joined: { instruments: [instrumentFor()] },
    cycles: new Map(),
    nowMs: NOW
  });
  assert.equal(tomorrow.events[0].action, "reselect");
  assert.match(tomorrow.events[0].reason, /first run of/);
});

test("a trade that ends re-selects the pair, and a limit already working on a still-marked line is not moved", () => {
  const selectedAt = new Date(NOW - 3600000).toISOString();
  const state = {
    placements: [],
    blind: { EURUSD: { price: 1.104, lower: { price: 1.1 }, upper: { price: 1.12 }, selected_at_utc: selectedAt } }
  };
  const ended = new Map([["EURUSD", { ended_by: "target-fill", last_exit_utc: new Date(NOW - 60000).toISOString() }]]);
  const afterExit = blindWatchPairs({ state, joined: { instruments: [instrumentFor()] }, cycles: ended, nowMs: NOW });
  assert.equal(afterExit.events[0].action, "reselect");
  assert.match(afterExit.events[0].reason, /the pair's trade ended/);
  assert.deepEqual([afterExit.pairs.EURUSD.lower.price, afterExit.pairs.EURUSD.upper.price], [1.1, 1.12], "the newest close at 1.102 selects the same two lines again");

  // The limit that was left at 1.10 is judged against the ladder, not against the pair: 1.10 is still marked, so the
  // ticket stays where it is and the re-selection cannot move an entry the account already holds.
  const orders = [{
    ticket: 900001,
    symbol: "EURUSD",
    type: "ORDER_TYPE_BUY_LIMIT",
    side: "buy",
    volume: 0.01,
    price_open: 1.1,
    stop_loss: 1.096,
    take_profit: 1.12,
    magic: strategy.BLIND_MAGIC
  }];
  const review = reviewPendings({
    live: { orders },
    joined: { instruments: [instrumentFor()] },
    cycles: new Map(),
    magic: strategy.BLIND_MAGIC,
    blind: true
  });
  assert.equal(review[0].decision, "keep");
  assert.match(review[0].reason, /no timed expiry/);
});

test("the blind lane's limit comes out on a target reached before entry or a line removed, and on nothing else", () => {
  const order = (over = {}) => ({
    ticket: 900001,
    symbol: "EURUSD",
    type: "ORDER_TYPE_BUY_LIMIT",
    side: "buy",
    volume: 0.01,
    price_open: 1.1,
    stop_loss: 1.096,
    take_profit: 1.12,
    magic: strategy.BLIND_MAGIC,
    ...over
  });
  const review = (over) => reviewPendings({
    live: { orders: [order(over)] },
    joined: { instruments: [instrumentFor()] },
    cycles: new Map(),
    magic: strategy.BLIND_MAGIC,
    blind: true
  })[0];

  // 1.10 has been unmarked: the entry line is gone, so the ticket goes.
  const removed = reviewPendings({
    live: { orders: [order()] },
    joined: { instruments: [instrumentFor({ levels: [{ price: 1.12, role: "seed" }, { price: 1.08, role: "seed" }] })] },
    cycles: new Map(),
    magic: strategy.BLIND_MAGIC,
    blind: true
  })[0];
  assert.equal(removed.decision, "cancel");
  assert.equal(removed.entry_removed, true);

  // The market is at the take-profit while the entry is still only a limit: the move the deviation was left for has
  // happened without the entry.
  const reached = reviewPendings({
    live: { orders: [order()] },
    joined: { instruments: [instrumentFor({ quote: { bid: 1.1202, ask: 1.1204, spread_points: 2, market_state: "open" } })] },
    cycles: new Map(),
    magic: strategy.BLIND_MAGIC,
    blind: true
  })[0];
  assert.equal(reached.decision, "cancel");
  assert.equal(reached.target_reached, true);

  // Nothing else removes it: no call is read, so a lane with no Layer 1 artifact at all keeps its ticket.
  assert.equal(review({}).decision, "keep");
});

// ---- The day: no cap, and a fifth entry through the real decision path -------------------------------------------
// Four placements of this lane, all today and all on different assets: the shape the owner named when he said
// "including when the earlier four were spread across assets". Nothing here is a re-entry, so each one is a paid
// placement and the old count would have read four.
function fourSpreadAcrossAssets() {
  return [placement("XAUUSD", 4), placement("US100.cash", 3), placement("BTCUSD", 2), placement("GBPUSD", 1)];
}

test("a fifth entry can be placed on the same day on every lane, with the earlier four spread across assets", () => {
  // Lane 1 and lane 2 trade the same decision path and differ only in the rule that priced the reading, so the
  // reading is the module's own confirmed ticket and the lane's flags are the ones its registration writes.
  const callLanes = [
    { name: "ftmo-1", options: baseOptions() },
    { name: "ftmo-2", options: baseOptions({ reentryCrossing: true }) }
  ];
  for (const lane of callLanes) {
    const reading = confirmedReading("EURUSD", { signal: new Date(NOW - 60000).toISOString() });
    const decision = decide({
      readings: [reading],
      state: { placements: fourSpreadAcrossAssets() },
      live: { ours: [] },
      options: lane.options,
      nowMs: NOW
    });
    assert.equal(decision.taken_today, 4, `${lane.name} starts the day with four placements`);
    assert.equal(decision.rows[0].decision, "place", `${lane.name} places the fifth valid entry of the day`);

    // The same input with the old cap still on shows what refused it before: the gate, not the rule.
    const capped = decide({
      readings: [reading],
      state: { placements: fourSpreadAcrossAssets() },
      live: { ours: [] },
      options: { ...lane.options, maxPerDay: 4 },
      nowMs: NOW
    });
    assert.equal(capped.rows[0].decision, "skip", `${lane.name} under a hand cap of four refuses the fifth`);
    assert.match(capped.rows[0].reason, /--max-per-day is 4/);
  }

  // The blind lane: the reading is `blindPlan`'s own, so the ticket is the one the rule states.
  const blind = decide({
    readings: [blindPlanFor(reclaimAbove100())],
    state: { placements: fourSpreadAcrossAssets() },
    live: { ours: [] },
    options: baseOptions({ blind: true, requireDeviation: true }),
    nowMs: NOW
  });
  assert.equal(blind.taken_today, 4);
  assert.equal(blind.rows[0].decision, "place");
  assert.equal(blind.rows[0].blind, true);
  assert.deepEqual([blind.rows[0].entry, blind.rows[0].stop, blind.rows[0].target], [1.1, 1.096, 1.12]);
});

test("the runner states no daily cap by default, and every way of saying so reads as no cap", () => {
  assert.equal(DEFAULT_MAX_PER_DAY, null, "the default is the owner's own answer: no strategy-imposed limit");
  assert.equal(parseArgs(["--once"]).maxPerDay, null, "a lane that passes nothing is not capped");
  for (const word of ["unlimited", "none", "off", "0", "UNLIMITED"]) {
    assert.equal(perDayCap("--max-per-day", word), null, `"${word}" states no cap`);
  }
  assert.equal(parseArgs(["--once", "--max-per-day", "4"]).maxPerDay, 4, "a hand cap is still available");
  assert.throws(() => parseArgs(["--once", "--max-per-day", "0.5"]), UsageError);
  assert.throws(() => parseArgs(["--once", "--max-per-day", "-1"]), UsageError);
});

test("ftmo-3 is a lane of its own: its magic, its identity and its blind rule are refused when a command line mixes them", () => {
  assert.throws(() => parseArgs(["--lane", "ftmo-3"]), /carries magic 20261006/);
  assert.throws(
    () => parseArgs(["--lane", "ftmo-3", "--magic", "20261006", "--expect-identity", "identity.json"]),
    /trades the blind rule/
  );
  assert.throws(
    () => parseArgs(["--lane", "ftmo-1", "--blind"]),
    /built on the Layer 1 call/
  );
  assert.throws(
    () => parseArgs(["--lane", "ftmo-3", "--magic", "20261006", "--expect-identity", "identity.json", "--blind", "--expire-minutes", "30"]),
    /no timed expiry/
  );
  const blind = parseArgs(["--lane", "ftmo-3", "--magic", "20261006", "--expect-identity", "identity.json", "--blind"]);
  assert.equal(blind.blind, true);
  assert.equal(blind.requireDeviation, true, "the three-leg deviation is part of the rule, not a separate switch");
  assert.equal(blind.maxPerDay, null);
});


// ---- One armed blind run, end to end ----------------------------------------------------------------------------
function blindFeed() {
  const instrument = (symbol, asset, point, bars, close) => ({
    symbol,
    dashboard_asset: asset,
    available: true,
    digits: 5,
    point,
    min_lot: 0.01,
    lot_step: 0.01,
    contract_size: 100000,
    stops_level: 0,
    quote: { bid: close, ask: close + point, spread_points: 1, market_state: "open", time_utc: new Date(NOW - 60000).toISOString() },
    m5: { bars }
  });
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(NOW - 30000).toISOString(),
    stale_after_seconds: 900,
    terminal: { build: 6000, connected: true, trade_allowed: true },
    account: { login_masked: "***999", server: "FTMO-Server3", currency: "USD", balance: 100000, equity: 100000 },
    orders: [],
    positions: [],
    closed_trades: [],
    instrument_count: 4,
    instruments: [
      instrument("EURUSD", "EUR", 0.00001, reclaimAbove100(), 1.102),
      instrument("XAUUSD", "GOLD", 0.01, [], 4100),
      instrument("US100.cash", "NQ", 0.01, [], 31000),
      instrument("BTCUSD", "BTC", 0.01, [], 95000)
    ]
  };
}

function blindLevels() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: new Date(NOW - 300000).toISOString(),
    instruments: [
      { symbol: "EURUSD", dashboard_asset: "EUR", levels: EUR_LEVELS },
      { symbol: "XAUUSD", dashboard_asset: "GOLD", levels: [] },
      { symbol: "US100.cash", dashboard_asset: "NQ", levels: [] },
      { symbol: "BTCUSD", dashboard_asset: "BTC", levels: [] }
    ]
  };
}


// The order tool, answered in its own record shape: a read-only status first, then one open. Both are the tool's own
// output as the loop parses it, so what is asserted below is a real send rather than a stubbed decision.
function fakeTool() {
  const calls = [];
  const line = record => `TOOL ${record.action}\n${JSON.stringify(record)}\n`;
  const spawn = (command, args) => {
    calls.push({ command, args });
    const at = name => {
      const index = args.indexOf(name);
      return index >= 0 ? args[index + 1] : null;
    };
    const action = args[1];
    const record = action === "status"
      ? {
        at_utc: new Date(NOW).toISOString(),
        tool: ORDER_TOOL_RELATIVE,
        action: "status",
        account: { login_masked: "***999", server: "FTMO-Server3", balance: 100000, equity: 100000, positions_open: 0, orders_open: 0 },
        ticket_filter: null,
        positions: [],
        orders: []
      }
      : {
        at_utc: new Date(NOW).toISOString(),
        tool: ORDER_TOOL_RELATIVE,
        action: "open",
        entry_type: "pending limit",
        entry_price: Number(at("--entry-price")),
        request: {
          action: 5,
          symbol: at("--symbol"),
          volume: 0.01,
          type: 2,
          price: Number(at("--entry-price")),
          sl: Number(at("--stop-loss")),
          tp: Number(at("--take-profit")),
          magic: Number(at("--magic"))
        },
        answer: {
          sent: true,
          retcode: 10009,
          retcode_name: "TRADE_RETCODE_DONE",
          done: true,
          deal: 278466300,
          order: 278466301,
          volume: 0.01,
          price: Number(at("--entry-price")),
          comment: at("--comment")
        }
      };
    return { status: 0, stdout: line(record), stderr: "" };
  };
  return { spawn, calls };
}

function blindRun() {
  const dir = tempDir();
  const paths = {
    levels: writeJson(path.join(dir, "l2l-levels.json"), blindLevels()),
    feed: writeJson(path.join(dir, "live-trading.json"), blindFeed()),
    identity: writeJson(path.join(dir, "lane-ftmo3-identity.json"), { login: 3333333, server: "FTMO-Server3" }),
    state: writeJson(path.join(dir, "trader-state.json"), { placements: fourSpreadAcrossAssets() })
  };
  const options = {
    ...parseArgs([
      "--once",
      "--published", repoRoot,
      "--levels", paths.levels,
      "--feed", paths.feed,
      "--close-requests", "off",
      "--state", paths.state,
      "--log", path.join(dir, "trader.log"),
      "--lock", path.join(dir, "trader.lock"),
      "--journal", path.join(dir, "orders.log"),
      "--status-out", path.join(dir, "trader-status.json"),
      "--lane", "ftmo-3",
      "--magic", String(strategy.BLIND_MAGIC),
      "--expect-identity", paths.identity,
      "--blind",
      "--confirm-live"
    ]),
    python: "python"
  };
  const tool = fakeTool();
  const outcome = runOnce(options, { spawn: tool.spawn, now: () => NOW });
  return { dir, paths, options, tool, ...outcome };
}


test("an armed blind run places the fifth entry of a day whose first four were spread across assets, and writes the pair down", () => {
  const run = blindRun();
  assert.equal(run.code, 0, run.record?.reason || run.record?.error || "the run exits clean");
  assert.equal(run.record.status, "placed");
  assert.equal(run.record.rule.max_per_day, null, "no cap was in force");
  assert.equal(run.record.rule.taken_today, 4, "four entries were already on the day");
  assert.equal(run.record.rule.rows.find(row => row.symbol === "EURUSD").decision, "place");
  assert.equal(run.record.calls, null, "the calls artifact was never read: this lane has no Layer 1 input");

  // One status read, one send, and the send is the ticket the blind rule stated.
  assert.equal(run.tool.calls.length, 2);
  assert.equal(run.tool.calls[0].args[1], "status");
  const args = run.tool.calls[1].args;
  const flag = name => args[args.indexOf(name) + 1];
  assert.equal(args[1], "open");
  assert.equal(flag("--symbol"), "EURUSD");
  assert.equal(flag("--side"), "buy");
  assert.equal(flag("--entry-price"), "1.1");
  assert.equal(flag("--stop-loss"), "1.096");
  assert.equal(flag("--take-profit"), "1.12");
  assert.equal(flag("--magic"), String(strategy.BLIND_MAGIC));
  assert.equal(args.includes("--expire-minutes"), false, "a limit on this lane carries no timed expiry");

  // The pair the lane selected is in the state file the next run reads, and the heartbeat says which rule ran.
  const state = readState(run.paths.state);
  assert.equal(state.blind.EURUSD.lower.price, 1.1);
  assert.equal(state.blind.EURUSD.upper.price, 1.12);
  assert.equal(state.placements.length, 5, "the fifth placement is written beside the first four");
  const status = JSON.parse(fs.readFileSync(path.join(run.dir, "trader-status.json"), "utf8"));
  assert.equal(status.strategy.blind, true);
  assert.equal(status.strategy.call_read, "none");
  assert.equal(status.caps.max_per_day, null);
  assert.equal(status.caps.entries_today, 4, "the count is reported with no cap in force");
});

