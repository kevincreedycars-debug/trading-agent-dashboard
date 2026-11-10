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
function runLane2({ extraArgs = [], feed = feedFixture(), state = null, statusPositions = [], statusOrders = [], laneOne = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane2-trader-"));
  fs.writeFileSync(path.join(dir, "layer1.json"), JSON.stringify(callsFixture()), "utf8");
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

// The rule, asked directly with the day's state in front of it: a target taken in the morning does not spend the
// afternoon's setup, a fresh bar is a fresh ticket, and the bar that was already taken is spent for ever.
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

