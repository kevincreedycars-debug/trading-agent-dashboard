// The second account's lane, run end to end through the loop: what it asks the order tool for, what it refuses
// without, and what pausing entries does and does not stop.
//
// The fixtures are the smallest ones that state each case: one instrument, three marked levels ten apart, and a
// five-minute bar that closes past a line. On the half grid those three levels become five, so a ticket that
// comes out at the midpoint could only have come from the lane-2 flags rather than from the ladder.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");
const trader = require("../scripts/run-live-trading-trader.js");

const NOW = Date.parse("2026-11-07T12:05:00Z");
const LEVELS = [
  { price: 120, role: "derived", label: "derived 120" },
  { price: 110, role: "seed", label: "seed 110" },
  { price: 100, role: "derived", label: "derived 100" }
];

function bar(time, open, high, low, close) {
  return { time_utc: time, open, high, low, close };
}

// The newest closed bar finishes at 101 having opened the bar before it at 99.5: a crossing of 100 and of
// nothing else. The bar before that is the third bar the rule needs before it will judge a close at all.
function crossingBars() {
  return [
    bar("2026-11-07T11:50:00Z", 99, 99.6, 98.9, 99.4),
    bar("2026-11-07T11:55:00Z", 99.4, 99.8, 99.2, 99.5),
    bar("2026-11-07T12:00:00Z", 99.5, 101.2, 99.4, 101)
  ];
}

function callsFixture(direction = "BULLISH") {
  return {
    dashboard_meta: { last_updated_et: "2026-11-07T11:00:00Z" },
    agents: [{
      agent: "NQ",
      sealed_at: "2026-11-07T00:00:00Z",
      effective_status: "ACTIVE",
      forecast_window_end: "2026-11-08T00:00:00Z",
      expires_at: "2026-11-08T00:00:00Z",
      calls: { "24h": { direction } },
      priority_call: { direction }
    }]
  };
}

function levelsFixture() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: "2026-11-06T20:00:00Z",
    instrument_count: 1,
    instruments: [{ symbol: "US100.cash", dashboard_asset: "NQ", levels: LEVELS }]
  };
}

function feedFixture({ bars = crossingBars(), positions = [] } = {}) {
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(NOW - 30000).toISOString(),
    stale_after_seconds: 900,
    terminal: { build: 6296, connected: true, trade_allowed: true },
    account: { login_masked: "***222", server: "FTMO-Server", currency: "USD", balance: 10000, equity: 10000, positions_open: positions.length, orders_open: 0 },
    orders: [],
    positions,
    closed_trades: [],
    instrument_count: 1,
    instruments: [{
      symbol: "US100.cash",
      dashboard_asset: "NQ",
      available: true,
      digits: 2,
      point: 0.01,
      min_lot: 0.1,
      lot_step: 0.1,
      quote: { bid: 100.9, ask: 101.1, spread_points: 2, market_state: "full" },
      m5: { candle_count: bars.length, bars, stale: false }
    }],
    source: { producer: "tools/mt5-bridge/live-trading-snapshot.py", scope: "read-only snapshot" }
  };
}

function statusStdout({ positions = [], orders = [], magic }) {
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: trader.ORDER_TOOL_RELATIVE,
    action: "status",
    account: { login_masked: "***222", server: "FTMO-Server", balance: 10000, equity: 10000, positions_open: positions.length, orders_open: orders.length },
    ticket_filter: null,
    positions: positions.map(row => ({ type: "POSITION_TYPE_BUY", ...row, magic })),
    orders,
    identity: { login_masked: "***222", server: "FTMO-Server", terminal_path: "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2" }
  };
  return `STATUS ${positions.length} position(s), ${orders.length} order(s)\n${JSON.stringify(record)}\n`;
}

function answerStdout(action) {
  return `${action.toUpperCase()} stub\n${JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: trader.ORDER_TOOL_RELATIVE,
    action,
    answer: { sent: true, retcode: 10009, retcode_name: "TRADE_RETCODE_DONE", done: true, deal: 7000001, order: 7000002, volume: 0.1, price: null, comment: null, filling_mode: null, request_id: null },
    attempts: 1
  })}\n`;
}

function flagMap(args) {
  const map = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!String(token).startsWith("--")) continue;
    const next = args[index + 1];
    map[token] = index + 1 < args.length && !String(next).startsWith("--") ? next : true;
  }
  return map;
}

// One run of the loop against the fixtures. The identity file is only ever a path the run passes on here; the
// tool is what reads it, and `tests/live_trading_identity_gate.test.js` is where that reading is proved.
function runLane2({ extraArgs = [], feed = feedFixture(), state = null, statusPositions = [], statusOrders = [], laneOne = false, direction = "BULLISH" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane2-trader-"));
  fs.writeFileSync(path.join(dir, "layer1.json"), JSON.stringify(callsFixture(direction)), "utf8");
  fs.writeFileSync(path.join(dir, "l2l-levels.json"), JSON.stringify(levelsFixture()), "utf8");
  fs.writeFileSync(path.join(dir, "live-trading.json"), JSON.stringify(feed), "utf8");
  const identityPath = path.join(dir, "lane-ftmo2-identity.json");
  fs.writeFileSync(identityPath, JSON.stringify({ login: 7654321, server: "FTMO-Server" }), "utf8");

  const options = trader.parseArgs([
    "--once",
    "--confirm-live",
    "--published", dir,
    "--calls", path.join(dir, "layer1.json"),
    "--levels", path.join(dir, "l2l-levels.json"),
    "--feed", path.join(dir, "live-trading.json"),
    ...(laneOne ? [] : [...LANE2_ARGS, "--expect-identity", identityPath]),
    ...extraArgs
  ]);
  options.log = path.join(dir, "trader.log");
  options.lock = path.join(dir, "trader.lock");
  options.state = path.join(dir, "trader-state.json");
  options.journal = path.join(dir, "orders.log");
  options.statusOut = path.join(dir, "trader-status.json");
  options.closeRequests = "off";

  const spawns = [];
  const spawn = (command, args) => {
    const action = String(args[1] || "");
    spawns.push({ action, flags: flagMap(args) });
    return {
      status: 0,
      stdout: action === "status"
        ? statusStdout({ positions: statusPositions, orders: statusOrders, magic: options.magic })
        : answerStdout(action),
      stderr: ""
    };
  };
  const result = trader.runOnce(options, {
    spawn,
    now: () => NOW,
    ...(state ? { state } : {})
  });
  const heartbeat = JSON.parse(fs.readFileSync(options.statusOut, "utf8"));
  return { ...result, spawns, options, heartbeat, dir, identityPath };
}

// The flags a lane-2 run has to pass: a half grid, three to one, and its own ownership number.
const LANE2_ARGS = ["--grid", "half", "--r-multiple", "3", "--magic", String(trader.HALF_LANE_MAGIC)];


test("lane 2 asks the tool for a ticket on the half grid, at three to one, with its own magic and identity", () => {
  const run = runLane2();
  assert.equal(run.code, 0, run.record.reason);
  assert.equal(run.record.status, "placed");
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "one open was sent");
  assert.equal(open.flags["--magic"], String(trader.HALF_LANE_MAGIC));
  assert.equal(open.flags["--expect-identity"], run.identityPath);
  // The entry is the marked line the candle cleared, the target the midpoint above it, and the stop a third of
  // that distance behind the entry - three to one on a half grid, not five to one on the marked one.
  assert.equal(open.flags["--entry-price"], "100");
  assert.equal(open.flags["--take-profit"], "105");
  assert.equal(open.flags["--stop-loss"], "98.333333");
  assert.equal(run.record.placements[0].r_multiple, 3);
  assert.equal(run.heartbeat.strategy.grid, "half");
  assert.equal(run.heartbeat.strategy.r_multiple, 3);
  assert.equal(run.heartbeat.strategy.magic, trader.HALF_LANE_MAGIC);
  assert.equal(run.heartbeat.strategy.identity_checked, true);
  assert.equal(run.heartbeat.entries_paused, false);
});

test("lane 1 on the same bars is untouched: five to one on the marked ladder, no extra flags", () => {
  const run = runLane2({ laneOne: true });
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "lane 1 placed its ticket too");
  assert.equal(open.flags["--entry-price"], "100");
  assert.equal(open.flags["--take-profit"], "110");
  assert.equal(open.flags["--stop-loss"], "98");
  assert.equal(open.flags["--magic"], undefined);
  assert.equal(open.flags["--expect-identity"], undefined);
  assert.equal(run.heartbeat.strategy.grid, "full");
  assert.equal(run.heartbeat.strategy.r_multiple, 5);
});

test("a second-lane magic without an identity file is a command-line refusal, not a run", () => {
  assert.throws(
    () => trader.parseArgs(["--once", "--magic", String(trader.HALF_LANE_MAGIC)]),
    error => error instanceof trader.UsageError && /--expect-identity/.test(error.message)
  );
  // Lane 1's own number needs nothing: the default is what every existing task passes by saying nothing.
  const laneOne = trader.parseArgs(["--once"]);
  assert.equal(laneOne.magic, 20261004);
  assert.equal(laneOne.expectIdentity, null);
});

test("pausing entries places nothing new, states why, and says so in the heartbeat", () => {
  const run = runLane2({ extraArgs: ["--pause-entries"] });
  assert.equal(run.spawns.filter(spawn => spawn.action === "open").length, 0, "no ticket was left");
  assert.equal(run.record.status, "nothing_to_place");
  assert.equal(run.record.entries_paused, true);
  const row = run.record.rule.rows.find(entry => entry.symbol === "US100.cash");
  assert.equal(row.decision, "skip");
  assert.equal(row.entries_paused, true);
  assert.match(row.reason, /entries are paused/);
  assert.equal(run.heartbeat.entries_paused, true);
  assert.equal(run.heartbeat.strategy.entries_paused, true);
});


test("a paused lane still manages what it already holds: the 2R breakeven is still sent", () => {
  // One position the lane placed, one marked entry, and a market that has run to twice the risk: the stop goes to
  // the entry. Pausing entries must not touch this - the pause is on new tickets, not on the account.
  const position = {
    ticket: 700002,
    symbol: "US100.cash",
    dashboard_asset: "NQ",
    side: "buy",
    volume: 0.1,
    price_open: 100,
    price_current: 104.2,
    stop_loss: 98,
    take_profit: 105,
    profit: 0,
    swap: 0,
    magic: trader.HALF_LANE_MAGIC,
    comment: "l2l-rule-nq",
    opened: { time_utc: "2026-11-07T11:30:00Z" }
  };
  const bars = [
    bar("2026-11-07T11:30:00Z", 100, 101, 99.8, 100.5),
    bar("2026-11-07T11:55:00Z", 100.5, 102, 100.2, 101.5),
    bar("2026-11-07T12:00:00Z", 101.5, 104.5, 101.2, 104.2)
  ];
  const state = {
    placements: [{
      symbol: "US100.cash",
      asset: "NQ",
      side: "long",
      entry: 100,
      stop: 98,
      risk: 2,
      target: 105,
      r_multiple: 3,
      placed: true,
      order_ticket: 700002,
      placed_at_utc: "2026-11-07T11:30:00Z"
    }],
    cancellations: [],
    closes: [],
    moves: []
  };
  const run = runLane2({
    extraArgs: ["--pause-entries"],
    feed: feedFixture({ bars, positions: [position] }),
    state,
    statusPositions: [position]
  });
  const move = run.spawns.find(spawn => spawn.action === "modify");
  assert.ok(move, "the breakeven move was still sent while entries are paused");
  assert.equal(run.record.stops.moves[0].new_stop, 100);
  assert.equal(run.record.status, "stop_moved");
});

// The account's own record of the trade the pair is still in: one placement this loop made, at the level the
// trade was triggered on. `tradeCycles` reads it, and the run prices the put-back from that level rather than
// from a fresh crossing - which is the path that was left at five to one on the marked ladder until 2026-11-11.
function putBackState({ side = "long", level = 100 } = {}) {
  return {
    placements: [{
      symbol: "US100.cash",
      asset: "NQ",
      side,
      signal_time_utc: "2026-11-07T11:00:00Z",
      level,
      entry: level,
      stop: side === "long" ? level - 1 : level + 1,
      target: side === "long" ? level + 3 : level - 3,
      risk: 1,
      r_multiple: 3,
      placed: true,
      order_ticket: 7000100,
      placed_at_utc: "2026-11-07T11:30:00Z"
    }],
    cancellations: [],
    closes: [],
    moves: []
  };
}

// The same three bars closing down through a line, with the account quoting under it, so a sell limit at 110 is
// a ticket that can rest and whose target at 105 has not been reached.
function shortFeedFixture() {
  const feed = feedFixture({
    bars: [
      bar("2026-11-07T11:50:00Z", 110.6, 110.8, 110.4, 110.6),
      bar("2026-11-07T11:55:00Z", 110.4, 110.5, 109.9, 110.2),
      bar("2026-11-07T12:00:00Z", 110.0, 110.1, 109.4, 109.6)
    ]
  });
  feed.instruments[0].quote = { bid: 108.9, ask: 109.1, spread_points: 2, market_state: "full" };
  return feed;
}

test("a lane-2 put-back is priced on the half grid at three to one, the same ticket a fresh crossing gets", () => {
  const run = runLane2({ state: putBackState() });
  assert.equal(run.code, 0, run.record.reason);
  assert.equal(run.record.status, "placed");
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "the standing trade was put back");
  assert.equal(open.flags["--magic"], String(trader.HALF_LANE_MAGIC));
  assert.equal(open.flags["--entry-price"], "100");
  assert.equal(open.flags["--take-profit"], "105");
  assert.equal(open.flags["--stop-loss"], "98.333333");
  const row = run.record.rule.rows.find(entry => entry.symbol === "US100.cash");
  assert.equal(row.reentry, true);
  assert.equal(row.r_multiple, 3);
  assert.equal(run.record.placements[0].reentry, true);
  assert.equal(run.record.placements[0].r_multiple, 3);
});

test("lane 1's put-back is untouched: five to one on the marked ladder", () => {
  const run = runLane2({ laneOne: true, state: putBackState() });
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "the primary lane put its trade back too");
  assert.equal(open.flags["--entry-price"], "100");
  assert.equal(open.flags["--take-profit"], "110");
  assert.equal(open.flags["--stop-loss"], "98");
  assert.equal(run.record.placements[0].r_multiple, 5);
});

test("a short put-back on lane 2 aims at the half-grid line below and stops a third back", () => {
  const run = runLane2({
    state: putBackState({ side: "short", level: 110 }),
    feed: shortFeedFixture(),
    direction: "BEARISH"
  });
  assert.equal(run.code, 0, run.record.reason);
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "the short trade was put back");
  assert.equal(open.flags["--side"], "sell");
  assert.equal(open.flags["--entry-price"], "110");
  assert.equal(open.flags["--take-profit"], "105");
  assert.equal(open.flags["--stop-loss"], "111.666667");
});

test("a short put-back on lane 1 keeps its five to one target on the marked line below", () => {
  const run = runLane2({
    laneOne: true,
    state: putBackState({ side: "short", level: 110 }),
    feed: shortFeedFixture(),
    direction: "BEARISH"
  });
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "lane 1 put the short back");
  assert.equal(open.flags["--take-profit"], "100");
  assert.equal(open.flags["--stop-loss"], "112");
});

// The account's own record of the attempt that ended on the level: a position the newest ticket produced, stopped
// out at its own stop. Nothing about it ends the trade - the level stands - so this is exactly the case the
// crossing rule asks about, and the closed time is the instant its window opens.
function stoppedOutClose({ closedAt = "2026-11-07T11:55:00Z" } = {}) {
  return {
    symbol: "US100.cash",
    magic: trader.HALF_LANE_MAGIC,
    comment: `${trader.COMMENT_PREFIX}nq`,
    price_open: 100,
    price_close: 98.333333,
    stop_loss: 98.333333,
    take_profit: 105,
    profit: -1,
    opened: { time_utc: "2026-11-07T11:35:00Z" },
    closed: { time_utc: closedAt }
  };
}

// The same three bars as `crossingBars`, with the newest one finishing under the level: nothing has deviated at
// 100 since the stop-out.
function noCrossingBars() {
  return [
    bar("2026-11-07T11:50:00Z", 99, 99.6, 98.9, 99.4),
    bar("2026-11-07T11:55:00Z", 99.4, 99.8, 98.4, 98.9),
    bar("2026-11-07T12:00:00Z", 98.9, 99.5, 98.6, 99.2)
  ];
}

function stoppedOutFeed(bars) {
  const feed = feedFixture({ bars });
  feed.closed_trades = [stoppedOutClose()];
  return feed;
}

// The 04:31Z bitcoin put-back of 2026-11-11, as a rule: the previous position closed at its stop after price had
// fallen away from the level, and a limit went back on at that level twelve minutes later with no candle having
// finished above it in between. The owner's correction is that this is new exposure rather than the same trade put
// back, so the lane asks the candles for a crossing first - and states the wait when there has not been one.
test("lane 2 waits for a fresh crossing before it puts a level back, and states the wait when there has not been one", () => {
  const run = runLane2({ state: putBackState(), feed: stoppedOutFeed(noCrossingBars()), extraArgs: ["--reentry-crossing"] });
  assert.equal(run.code, 0, run.record.reason);
  assert.equal(run.record.status, "nothing_to_place");
  assert.equal(run.spawns.filter(spawn => spawn.action === "open").length, 0, "no ticket goes back on an un-crossed level");
  const row = run.record.rule.rows.find(entry => entry.symbol === "US100.cash");
  assert.equal(row.reentry, true, "the pair still carries the trade it was triggered on");
  assert.equal(row.decision, "skip");
  assert.match(row.reason, /has not been crossed afresh/);
  assert.equal(row.trade.crossing.crossed, false);
  assert.equal(row.trade.crossing.since_utc, "2026-11-07T11:55:00.000Z");
  assert.equal(row.trade.last_exit_utc, "2026-11-07T11:55:00.000Z", "the exit the window is measured from travels with the row");
  assert.equal(run.heartbeat.strategy.reentry, "crossed");
});

test("a closed candle beyond the level after the exit re-arms it, and lane 2's ticket goes back at three to one", () => {
  const run = runLane2({ state: putBackState(), feed: stoppedOutFeed(crossingBars()), extraArgs: ["--reentry-crossing"] });
  assert.equal(run.code, 0, run.record.reason);
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "the candle deviated at the level again, so the ticket went back");
  assert.equal(open.flags["--entry-price"], "100");
  assert.equal(open.flags["--take-profit"], "105");
  assert.equal(open.flags["--stop-loss"], "98.333333");
  const row = run.record.rule.rows.find(entry => entry.symbol === "US100.cash");
  assert.equal(row.trade.crossing.crossed, true);
  assert.equal(row.trade.crossing.bar_time_utc, "2026-11-07T12:00:00Z");
  assert.equal(row.trade.last_exit_utc, "2026-11-07T11:55:00.000Z");
  assert.equal(run.record.placements[0].reentry, true);
  assert.equal(run.record.placements[0].r_multiple, 3);
});

// The same stopped-out account and the same candles with no flag: lane 2's own rule before this correction, which
// is lane 1's rule always. It is stated as a test because the difference between the two runs is the whole change.
test("without the flag the level goes back whatever the candles are doing, and the heartbeat says which rule ran", () => {
  const run = runLane2({ state: putBackState(), feed: stoppedOutFeed(noCrossingBars()) });
  const open = run.spawns.find(spawn => spawn.action === "open");
  assert.ok(open, "a lane that does not ask for a crossing puts its level back");
  assert.equal(run.heartbeat.strategy.reentry, "level");
});

// The four facts the owner asks for in front of a re-entry are carried by one row: the previous exit, the candle
// that re-armed the level, the level the order goes back on, and the three prices the ticket is sent with. The
// first three are the loop's reading; the last three are the placement row below. A trade with no exit on it yet
// states no exit rather than a fabricated instant, and asks the candles nothing.
test("the row states no previous exit when the newest ticket never filled, and asks nothing of the candles", () => {
  const run = runLane2({ state: putBackState(), feed: feedFixture({ bars: noCrossingBars() }), extraArgs: ["--reentry-crossing"] });
  assert.equal(run.code, 0, run.record.reason);
  const row = run.record.rule.rows.find(entry => entry.symbol === "US100.cash");
  assert.equal(row.trade.last_exit_utc, null);
  assert.equal(row.trade.crossing, null);
});

test("the row states the previous exit, the re-arming candle, the fixed level and the prices the ticket was sent with", () => {
  const run = runLane2({ state: putBackState(), feed: stoppedOutFeed(crossingBars()), extraArgs: ["--reentry-crossing"] });
  const row = run.record.rule.rows.find(entry => entry.symbol === "US100.cash");
  const placed = run.record.placements.find(entry => entry.placed);
  assert.equal(row.trade.last_exit_utc, "2026-11-07T11:55:00.000Z");
  assert.equal(row.trade.crossing.bar_time_utc, "2026-11-07T12:00:00Z");
  assert.equal(row.trade.trigger_level, 100);
  assert.equal(placed.level, 100);
  assert.equal(placed.entry, 100);
  assert.equal(placed.stop, 98.333333);
  assert.equal(placed.target, 105);
  assert.equal(placed.r_multiple, 3);
  // Three to one, read off the sent ticket rather than off the rule that priced it.
  assert.ok(Math.abs((placed.target - placed.entry) / (placed.entry - placed.stop) - 3) < 1e-6);
});

// The spent-signal question the audit of 2026-11-11 raised, stated as two tests: a put-back is the same trade
// put back at its own level and is deliberately not stopped by the signal-bar guard that a fresh ticket answers
// to - while a trade that has ended can never be put back at all, so a spent bar cannot become a second trade.
test("a put-back is not blocked by the spent-signal guard, and an ended trade is never put back", () => {
  const bars = crossingBars();
  const readings = readingsFor(bars);
  const options = trader.parseArgs([
    "--once", "--grid", "half", "--r-multiple", "3", "--magic", String(trader.HALF_LANE_MAGIC),
    "--expect-identity", "tmp/lane2-identity.json"
  ]);
  // The standing trade's own placement carries the bar that opened it, and that bar is in the spent set above.
  const state = putBackState();
  state.placements[0].signal_time_utc = "2026-11-07T12:00:00Z";
  const live = { positions: [], orders: [], ours: [] };

  const standing = trader.decide({ readings, state, live, options, nowMs: NOW, cycles: trader.tradeCycles({
    state,
    directions: { NQ: "BULLISH" },
    joined: { instruments: [{ symbol: "US100.cash", dashboard_asset: "NQ", levels: LEVELS, point: 0.01, quote: { bid: 100.9, ask: 101.1 }, m5: { bars } }] },
    closedTrades: [],
    magic: trader.HALF_LANE_MAGIC,
    grid: "half",
    rMultiple: 3
  }) });
  assert.equal(standing.candidates.length, 1, "the same trade is put back while it stands");
  assert.equal(standing.candidates[0].confirmation_time_utc, "2026-11-07T12:00:00Z");

  // The target taken: the account's own record shows the position closing at its take-profit, so the trade's
  // turn is over and the level is not re-entered - no ticket, and no second trade from the same bar.
  const ended = trader.tradeCycles({
    state,
    directions: { NQ: "BULLISH" },
    joined: { instruments: [{ symbol: "US100.cash", dashboard_asset: "NQ", levels: LEVELS, point: 0.01, quote: { bid: 100.9, ask: 101.1 }, m5: { bars } }] },
    closedTrades: [{
      symbol: "US100.cash",
      magic: trader.HALF_LANE_MAGIC,
      comment: `${trader.COMMENT_PREFIX}nq`,
      price_open: 100,
      price_close: 105,
      stop_loss: 98.333333,
      take_profit: 105,
      opened: { time_utc: "2026-11-07T11:40:00Z" },
      closed: { time_utc: "2026-11-07T12:01:00Z" }
    }],
    magic: trader.HALF_LANE_MAGIC,
    grid: "half",
    rMultiple: 3
  });
  assert.equal(ended.get("US100.cash").ended_by, "target-fill");
  const after = trader.decide({ readings, state, live, options, nowMs: NOW, cycles: ended });
  assert.equal(after.rows[0].reentry, undefined, "a finished trade is judged as a fresh reading, not a put-back");
});


// two marked bitcoin lines either side of the midpoint 73,657.005 the half grid inserts, and the digits are the
// symbol's own 2. The three put-backs of 2026-11-11 were stopped at 73,511.518 - five to one on the marked ladder -
// and this is the same arithmetic at the lane's three.
test("the broker-rounded target is the next half-grid level and the stop a third of the reward distance", () => {
  const levels = [{ price: 72929.57, role: "seed", label: "seed 72929.57" }, { price: 74384.44, role: "seed", label: "seed 74384.44" }];
  const instrument = { digits: 2, point: 0.01 };
  const entry = 73657.005;
  const plan = strategy.reentryPlan({ symbol: "BTCUSD", side: "long", entry, levels, point: 0.01, grid: "half", rMultiple: 3 });

  assert.equal(plan.stage, "confirmed");
  assert.equal(plan.plan.target, 74384.44, "the next line past the entry on the half grid");
  assert.equal(plan.plan.r_multiple, 3);
  // The stop is one third of the 727.435 to the target, rounded onto the symbol's own two digits.
  const reward = plan.plan.target - entry;
  assert.ok(Math.abs(reward / 3 - plan.plan.risk) < 1e-5);
  const stop = trader.priceOnDigits(instrument, plan.plan.stop);
  assert.ok(Math.abs(stop - (entry - reward / 3)) <= 0.01, `stop ${stop} is within one tick of a third of the reward`);

  // The same call the loop made until 2026-11-11 - no grid, no multiple - is the stop the three tickets carried.
  const bug = strategy.reentryPlan({ symbol: "BTCUSD", side: "long", entry, levels, point: 0.01 });
  assert.equal(Number(bug.plan.stop.toFixed(3)), 73511.518);
  assert.equal(trader.priceOnDigits(instrument, bug.plan.stop), 73511.52, "the stop the terminal held");
});


function readingsFor(bars) {
  return strategy.strategyReadings({
    instruments: [{
      symbol: "US100.cash",
      dashboard_asset: "NQ",
      levels: LEVELS,
      m5: { bars },
      point: 0.01
    }],
    positions: [],
    calls: { NQ: "BULLISH" },
    nowMs: NOW,
    grid: "half",
    rMultiple: 3
  });
}

test("after a take-profit the same day can take a fresh crossing, and the spent bar is still spent", () => {
  const fresh = crossingBars();
  const readings = readingsFor(fresh);
  const options = trader.parseArgs(["--once", "--grid", "half", "--r-multiple", "3", "--magic", String(trader.HALF_LANE_MAGIC), "--expect-identity", "tmp/lane2-identity.json"]);
  const empty = { placements: [], cancellations: [], closes: [], moves: [] };

  // The morning's ticket was taken out at its target: one placement today, nothing open, no working order.
  const morning = {
    ...empty,
    placements: [{
      symbol: "US100.cash",
      asset: "NQ",
      side: "long",
      signal_time_utc: "2026-11-07T09:00:00Z",
      entry: 100,
      stop: 98.333333,
      target: 105,
      risk: 1.666667,
      r_multiple: 3,
      placed: true,
      placed_at_utc: "2026-11-07T09:05:00Z"
    }]
  };
  const live = { positions: [], orders: [], ours: [] };
  const afternoon = trader.decide({ readings, state: morning, live, options, nowMs: NOW, cycles: new Map() });
  assert.equal(afternoon.candidates.length, 1, "the fresh crossing is a new ticket the same day");
  assert.equal(afternoon.candidates[0].entry, 100);
  assert.equal(afternoon.candidates[0].target, 105);
  assert.equal(afternoon.taken_today, 1);

  // Replaying the bar the morning's ticket was taken on is not a second trade: the signal bar is spent.
  const replayed = trader.decide({
    readings,
    state: {
      ...morning,
      placements: [{ ...morning.placements[0], signal_time_utc: "2026-11-07T12:00:00Z" }]
    },
    live,
    options,
    nowMs: NOW,
    cycles: new Map()
  });
  assert.equal(replayed.candidates.length, 0);
  assert.match(replayed.rows[0].reason, /already been taken/);

  // And the day's cap still counts what it says it counts: four placements, and the fifth waits for tomorrow.
  const fourToday = {
    ...empty,
    placements: [0, 1, 2, 3].map(index => ({
      symbol: "US100.cash",
      signal_time_utc: `2026-11-07T0${index}:00:00Z`,
      placed: true,
      placed_at_utc: `2026-11-07T0${index}:05:00Z`
    }))
  };
  const capped = trader.decide({ readings, state: fourToday, live, options, nowMs: NOW, cycles: new Map() });
  assert.equal(capped.candidates.length, 0);
  assert.match(capped.rows[0].reason, /--max-per-day is 4/);
});

