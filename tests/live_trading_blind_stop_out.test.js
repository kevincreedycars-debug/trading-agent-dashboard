// The blind lane's trade ends where its own stop is filled.
//
// What the lane read on the VPS between 2026-11-16 and 2026-11-19, from the pulled feed, state file and lane-3 log:
// XAUUSD's buy limit at 3854.59 filled (ticket 201323839) and the account closed it at 3840.21 against its own stop
// at 3840.29. From that close onwards the pair was re-selected - the state file carries a pair the close at 3779 sits
// between - and the rule then confirmed a short at 3783.11, which the pulled feed shows as the newest three
// closes 3778, 3789, 3779 around that line. No ticket was ever sent for it. Every run instead read the *stopped* buy
// as still the pair's own, stated the old level and the old side back with its target at 3926.07, and refused the
// put-back because a buy limit at 3854.59 is a buy at a market of 3685.55. That is the cycling: a trade the account
// had finished going on standing for a pair that had already moved to two new lines, run after run, until the target
// of the finished trade happened to print. EURUSD (ticket 200695485, stopped at 1.10115) and US100.cash (200695492,
// stopped at 27697.63) sat in the same state from the 16th.
//
// The lane's endings were the target taken, the target reached before a fill, and a hand - a stop was deliberately
// not one of them, on the reading that "the level is re-armed by the next three-leg deviation". The re-arming was
// never the missing piece: `blindWatchPairs` already re-selected the pair on the exit, and the fresh deviation was
// already confirmed by `blindPlan`. What was missing was that the *trade row itself* was never marked ended, so
// `decide` took the cycle's old level instead of the reading's new one. A stop is the market answering the level,
// so it ends the trade the way the target does - and the next deviation, on whichever of the pair's two lines, opens
// the next ticket. These tests hold that ending, that the called lanes are untouched by it, and that the send at
// 3783.11 now leaves the loop.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");
const {
  ORDER_TOOL_RELATIVE,
  DEFAULT_MAX_PER_DAY,
  parseArgs,
  decide,
  blindWatchPairs,
  readState,
  tradeCycles,
  runOnce
} = require("../scripts/run-live-trading-trader.js");

const repoRoot = path.join(__dirname, "..");
// The bars and the feed are placed against the machine's own clock: the run refuses a snapshot older than its window
// before any rule is asked, so a frozen date would make these tests tests of a stale fixture rather than of the rule.
const BAR_BASE = Math.floor(Date.now() / 300000) * 300000;
const NOW = BAR_BASE + 60000;
const HOUR = 3600000;

function bar(minutesBefore, open, high, low, close) {
  return { time_utc: new Date(BAR_BASE - minutesBefore * 60000).toISOString(), open, high, low, close };
}

// Gold's ladder as the pulled levels state it around the trade. The rungs sit 71.48 apart: 3640.15, 3711.63, 3783.11,
// 3854.59 and 3926.07. 3854.59 is the line the buy was left at and 3926.07 the line above it - exactly the take-profit
// the pulled state row carries - while 3711.63 is the line under the pair's upper line, which is what a short at
// 3783.11 aims at.
const XAU_LEVELS = [
  { price: 3640.15, role: "seed", label: "seed 3640.15" },
  { price: 3711.63, role: "seed", label: "seed 3711.63" },
  { price: 3783.11, role: "seed", label: "seed 3783.11" },
  { price: 3854.59, role: "seed", label: "seed 3854.59" },
  { price: 3926.07, role: "seed", label: "seed 3926.07" }
];

// The closes the pulled feed carries after the stop: 3800 was the price the pair was selected at, then gold left
// 3783.11 downwards, closed back above it at 3789 and closed below it again at 3779 - the owner's three legs in
// order at the line that was being watched, and the deviation the loop refused for three days.
function goldBars() {
  return [
    bar(25, 3801.0, 3802.0, 3798.0, 3800.0),
    bar(20, 3800.0, 3801.5, 3776.0, 3778.0),
    bar(15, 3778.0, 3790.0, 3777.0, 3789.0),
    bar(10, 3789.0, 3790.5, 3778.0, 3779.0)
  ];
}

function goldInstrument(over = {}) {
  return {
    symbol: "XAUUSD",
    dashboard_asset: "GOLD",
    available: true,
    digits: 2,
    point: 0.01,
    min_lot: 0.01,
    lot_step: 0.01,
    contract_size: 100,
    stops_level: 0,
    // The quote the pulled 2026-11-19 feed carries: 3685.55 bid, 3685.56 ask - below every line the pair watched.
    quote: { bid: 3685.55, ask: 3685.56, spread_points: 1, market_state: "open", time_utc: new Date(NOW - 60000).toISOString() },
    m5: { bars: goldBars() },
    levels: XAU_LEVELS,
    ...over
  };
}

const PLACED_AT = new Date(NOW - 30 * HOUR).toISOString();
const STOPPED_AT = new Date(NOW - 12 * HOUR).toISOString();

// The state file's row for the buy that was stopped: the level, the side and the ticket, as the pulled state states
// them.
function stoppedPlacement(over = {}) {
  return {
    symbol: "XAUUSD",
    asset: "GOLD",
    side: "long",
    level: 3854.59,
    entry: 3854.59,
    stop: 3840.29,
    target: 3926.07,
    order_ticket: 201323839,
    placed: true,
    signal_time_utc: new Date(NOW - 31 * HOUR).toISOString(),
    placed_at_utc: PLACED_AT,
    ...over
  };
}

// The account's own record of that buy, as the pulled closed-trades window states it: it closed at 3840.21, which is
// nearer the stop it was placed with than the take-profit at 3926.07.
function stopRecord(over = {}) {
  return {
    ticket: 201323839,
    symbol: "XAUUSD",
    magic: strategy.BLIND_MAGIC,
    comment: "l2l-rule-gold",
    type: "POSITION_TYPE_BUY",
    volume: 0.1,
    price_open: 3854.59,
    price_close: 3840.21,
    stop_loss: 3840.29,
    take_profit: 3926.07,
    opened: { time_utc: PLACED_AT },
    closed: { time_utc: STOPPED_AT },
    ...over
  };
}

// The pair the lane was watching when the buy was placed: 3783.11 below the 3820.50 it was selected at, 3854.59
// above it - the upper line being the one the buy was left at.
function pairBeforeStop() {
  return {
    price: 3820.5,
    lower: { price: 3783.11 },
    upper: { price: 3854.59 },
    selected_at_utc: new Date(NOW - 31 * HOUR).toISOString(),
    reason: "no pair was written down for this instrument, so this run selected one"
  };
}

function blindState(over = {}) {
  return { placements: [stoppedPlacement()], blind: { XAUUSD: pairBeforeStop() }, ...over };
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

// The lane's trades are read from the state file and the account's record, so a cycle is a call to the same
// `tradeCycles` the run makes, with the fixture in place of the snapshot. `accountRows` is the account's own read of
// its positions and working orders: null is a caller that made no read, and an empty array is an account carrying
// nothing of this loop's.
function cyclesFor({ closedTrades = [stopRecord()], accountRows = [], blind = true, directions = {}, state = blindState() } = {}) {
  return tradeCycles({
    state,
    directions,
    joined: { instruments: [goldInstrument()] },
    closedTrades,
    magic: strategy.BLIND_MAGIC,
    blind,
    accountRows,
    nowMs: NOW
  });
}


test("a blind trade the account closed at its own stop is over, and the pair's next deviation is its own trade", () => {
  const cycle = cyclesFor().get("XAUUSD");
  assert.equal(cycle.ended, true, "the account's own record of the stop ends the trade");
  assert.equal(cycle.ended_by, "stop-fill");
  assert.equal(cycle.ticket, null, "a trade that is over states no ticket to put back");
  assert.equal(cycle.resting, false, "the fixture's market is below the old level, which is what made it a zombie");
  assert.equal(cycle.last_exit_utc, STOPPED_AT, "the close the record states is the instant the window opens on");
  assert.equal(cycle.blind, true);
  assert.match(cycle.reason, /closed at its own stop/);
  assert.match(cycle.reason, /3840\.21/, "the words quote the price the account closed at");
  assert.doesNotMatch(cycle.reason, /still the pair's own/);
});

test("the two called lanes still put their level back after a stop: the ending added here is the blind lane's", () => {
  // The same record and the same market, read as lane 1 reads it: the call it was left for still reads long, so the
  // level stands and the ticket is put back exactly as before. A stop is an ending on the blind lane alone.
  const called = cyclesFor({ blind: false, directions: { GOLD: "BULLISH" } }).get("XAUUSD");
  assert.equal(called.ended, false);
  assert.equal(called.ended_by, null);
  assert.notEqual(called.ticket, null, "the called lane's level goes back while its call stands");
  assert.equal(called.ticket.entry, 3854.59);
  assert.equal(called.blind, false);
});

test("the reading at the pair's new line states the short the loop refused, and the stopped cycle was the reason", () => {
  // The pair is re-selected after the stop from the newest close at 3779: 3711.63 below it and 3783.11 above it.
  const watch = blindWatchPairs({ state: blindState(), joined: { instruments: [goldInstrument()] }, cycles: cyclesFor(), nowMs: NOW });
  assert.equal(watch.events[0].action, "reselect");
  assert.match(watch.events[0].reason, /the pair's trade ended/);
  assert.deepEqual(
    [watch.pairs.XAUUSD.lower.price, watch.pairs.XAUUSD.upper.price],
    [3711.63, 3783.11],
    "the close at 3779 selects the line it sits under and the line under that"
  );

  const readings = strategy.blindReadings({
    instruments: [goldInstrument()],
    positions: [],
    holdings: [],
    pairs: watch.pairs,
    nowMs: NOW,
    rMultiple: 5
  });
  assert.equal(readings[0].stage, "confirmed");
  assert.deepEqual(
    { side: readings[0].plan.side, entry: readings[0].plan.entry, stop: readings[0].plan.stop, target: readings[0].plan.target },
    { side: "short", entry: 3783.11, stop: 3797.406, target: 3711.63 },
    "the three legs at 3783.11 state a sell limit there, the line under it as the target, and one fifth of that distance as the stop"
  );

  const decideWith = cycles => decide({
    readings,
    state: blindState(),
    live: { ours: [] },
    options: baseOptions({ blind: true, requireDeviation: true }),
    nowMs: NOW,
    cycles
  }).rows[0];

  // What the loop read before this change: the record's stop was not an ending, and the account's own read was not
  // asked which tickets it still carried. The old level stands, and the put-back is refused as a buy at the market.
  const before = decideWith(cyclesFor({ closedTrades: [], accountRows: null }));
  assert.equal(before.decision, "skip");
  assert.equal(before.trade.ended, false);
  assert.equal(before.trade.trigger_level, 3854.59, "the row is about the finished trade's level, not the new line");
  assert.match(before.reason, /far side of the market/);
  assert.match(before.reason, /3854\.59/);

  // The same input with the account's record read: the trade is over and the deviation on the pair's own line is the
  // ticket this run sends.
  const after = decideWith(cyclesFor());
  assert.equal(after.decision, "place");
  assert.equal(after.trade.ended, true, "the finished trade is stated as ended rather than as a ticket to put back");
  assert.equal(after.trade.ended_by, "stop-fill");
  assert.equal(after.trade.target, 3926.07, "the row beside the decision is still the finished trade's own row");
  assert.deepEqual(
    { side: after.side, level: after.level, entry: after.entry, stop: after.stop, target: after.target },
    { side: "short", level: 3783.11, entry: 3783.11, stop: 3797.406, target: 3711.63 }
  );
  assert.equal(after.blind, true);
  assert.equal(after.confirmation_time_utc, goldBars()[3].time_utc, "the reclaiming candle is the bar the ticket is sent on");
  assert.notEqual(after.confirmation_time_utc, stoppedPlacement().signal_time_utc, "one candle authorises one ticket per pair");
});

test("a stop older than the closed-trade window still ends the trade, read from the tickets the account carries", () => {
  // The feed's closed-trades window rolls: a trade that ended long enough ago is no longer in it. The account is
  // still read on every run, so the ticket being absent from its orders and positions - with the market already past
  // the level - is the same ending stated a different way.
  const aged = cyclesFor({ closedTrades: [], accountRows: [] }).get("XAUUSD");
  assert.equal(aged.ended, true);
  assert.equal(aged.ended_by, "entry-gone");
  assert.equal(aged.ticket, null);
  assert.equal(aged.last_exit_utc, new Date(NOW).toISOString(), "the run that found the ticket gone is the witness");
  assert.match(aged.reason, /no longer on the account/);
  assert.match(aged.reason, /201323839/);

  // And a ticket the account still works is never read as gone, whatever the market has done: the tool is the
  // authority on what is standing, so the level waits rather than the trade being closed behind a live order.
  const working = cyclesFor({
    closedTrades: [],
    accountRows: [{ ticket: 201323839, symbol: "XAUUSD", type: "ORDER_TYPE_BUY_LIMIT", side: "buy", magic: strategy.BLIND_MAGIC }]
  }).get("XAUUSD");
  assert.equal(working.ended, false);
  assert.equal(working.ended_by, null);
  assert.equal(working.resting, false, "the level is still past the market, so the run waits for price to come back");
});

// ---- One armed blind run, on the pulled evidence ----------------------------------------------------------------
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function blindFeed() {
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(NOW - 30000).toISOString(),
    stale_after_seconds: 900,
    terminal: { build: 6000, connected: true, trade_allowed: true },
    account: { login_masked: "***999", server: "FTMO-Server3", currency: "USD", balance: 100000, equity: 100000 },
    orders: [],
    positions: [],
    closed_trades: [stopRecord()],
    instrument_count: 1,
    instruments: [goldInstrument()]
  };
}

function blindLevels() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: new Date(NOW - 300000).toISOString(),
    instruments: [{ symbol: "XAUUSD", dashboard_asset: "GOLD", levels: XAU_LEVELS }]
  };
}

// The order tool in its own record shape: a read-only status first, then one open, both as the loop parses them.
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
          volume: Number(at("--volume")),
          type: 3,
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
          volume: Number(at("--volume")),
          price: Number(at("--entry-price")),
          comment: at("--comment")
        }
      };
    return { status: 0, stdout: line(record), stderr: "" };
  };
  return { spawn, calls };
}

function blindRun() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-blind-stop-"));
  const paths = {
    levels: writeJson(path.join(dir, "l2l-levels.json"), blindLevels()),
    feed: writeJson(path.join(dir, "live-trading.json"), blindFeed()),
    identity: writeJson(path.join(dir, "lane-ftmo3-identity.json"), { login: 3333333, server: "FTMO-Server3" }),
    state: writeJson(path.join(dir, "trader-state.json"), blindState())
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

test("the run that used to spend every tick on the finished trade now sends the short at 3783.11", () => {
  const run = blindRun();
  assert.equal(run.code, 0, run.record?.reason || run.record?.error || "the run exits clean");
  assert.equal(run.record.status, "placed");

  // One status read and one send, and the send is the deviation on the pair's own line - not a put-back of the
  // stopped buy, which is what the loop sent on every run of the pulled window.
  assert.equal(run.tool.calls.length, 2, "the loop sends once, on the pair's new line");
  assert.equal(run.tool.calls[0].args[1], "status");
  const args = run.tool.calls[1].args;
  const flag = name => args[args.indexOf(name) + 1];
  assert.equal(args[1], "open");
  assert.equal(flag("--symbol"), "XAUUSD");
  assert.equal(flag("--side"), "sell");
  assert.equal(flag("--entry-price"), "3783.11");
  assert.equal(flag("--stop-loss"), "3797.406");
  assert.equal(flag("--take-profit"), "3711.63");
  assert.equal(flag("--magic"), String(strategy.BLIND_MAGIC));
  assert.equal(args.includes("--expire-minutes"), false, "a limit on this lane carries no timed expiry");

  // The log states the ending that freed the pair, beside the trade it ended.
  assert.equal(run.record.trades.count, 1);
  assert.equal(run.record.trades.rows[0].ended_by, "stop-fill");
  assert.equal(run.record.trades.rows[0].trigger_level, 3854.59);
  assert.match(run.record.trades.rows[0].reason, /closed at its own stop/);
  const decision = run.record.rule.rows.find(row => row.symbol === "XAUUSD");
  assert.equal(decision.decision, "place");
  assert.match(decision.reason, /three-leg deviation|deviation/);

  // The pair the run selected is written down for the next tick, and the stopped row is still in the state beside the
  // new placement: nothing about the finished trade was rewritten or recreated.
  const state = readState(run.paths.state);
  assert.deepEqual([state.blind.XAUUSD.lower.price, state.blind.XAUUSD.upper.price], [3711.63, 3783.11]);
  assert.equal(state.placements.length, 2, "the stopped row is kept, and the new ticket is written beside it");
  assert.equal(state.placements[0].order_ticket, 201323839);
});

