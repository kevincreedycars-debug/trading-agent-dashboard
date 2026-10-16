// Contract tests for the automatic order loop, and for the boundary that keeps it a caller rather than a
// second sender.
//
// The loop places real tickets, so what is asserted here is what stands between a confirmed row and a send:
// the arming flag, the freshness and terminal gates, the size it never chooses (the tool's own volume_min),
// one ticket per signal bar and one per pair, the hand cap it can be given rather than a cap it keeps across
// pairs, the daily count it keeps, and the fact that it names no
// order call of its own. The readings themselves are the module's, and tests/l2l_strategy.test.js holds
// those; these tests hold the loop that reads them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  ORDER_MAGIC,
  ORDER_TOOL_RELATIVE,
  USAGE,
  UsageError,
  parseArgs,
  nextRunAt,
  layer1Call,
  layer1Validity,
  readCalls,
  levelsFor,
  joinLevels,
  pendingDirection,
  rowDirection,
  marketHasReached,
  closedAtItsTarget,
  tradeCycles,
  reviewPendings,
  reviewPositions,
  breakevenReview,
  placementRisk,
  movedTickets,
  BREAKEVEN_R_MULTIPLE,
  parseToolRecord,
  liveFromStatus,
  decide,
  readState,
  runOnce,
  main
} = require("../scripts/run-live-trading-trader.js");

const repoRoot = path.join(__dirname, "..");
const runnerPath = path.join(repoRoot, "scripts", "run-live-trading-trader.js");
const runnerSource = fs.readFileSync(runnerPath, "utf8");
const orderToolSource = fs.readFileSync(path.join(repoRoot, "tools", "mt5-bridge", "live-trading-order.py"), "utf8");
const scriptSource = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");
// The instant every fixture is read at, so a run is reproducible rather than "whenever it was run".
const NOW = Date.parse("2026-10-05T06:00:00Z");
// Three marked levels 1,000 apart, and three M5 bars ending at a close: the same shape the rule's own tests
// use, so a ticket asserted here is the ticket asserted there.
const LEVELS = [
  { price: 85500.0, role: "derived", label: "derived 85500" },
  { price: 84500.0, role: "seed", label: "seed 84500" },
  { price: 83500.0, role: "derived", label: "derived 83500" }
];

function bar(minutes, open, high, low, close) {
  const hour = 15 + Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  return { time_utc: `2026-10-04T${String(hour).padStart(2, "0")}:${minute}:00Z`, open, high, low, close };
}

function barsEndingAt(close, { previousClose = 84480, low = close - 300 } = {}) {
  return [
    bar(0, 84200, 84400, 84100, 84300),
    { time_utc: "2026-10-04T15:05:00Z", open: 84300, high: Math.max(84510, previousClose), low: 84250, close: previousClose },
    { time_utc: "2026-10-04T15:10:00Z", open: previousClose, high: close + 50, low, close }
  ];
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-trader-"));
}

// The calls artifact, with the 24h call the page falls back to and a priority call beside it.
function callsFixture({ sealed = "2026-10-04T20:03:58.859949+00:00", ends = "2026-10-06T04:00:00.000Z", status = "ACTIVE", btcEnds = "2026-10-05T20:04:34.483Z", btcDirection = "BULLISH_LEAN" } = {}) {
  const agent = (name, direction, expiry) => ({
    agent: name,
    sealed_at: sealed,
    effective_status: status,
    forecast_window_end: expiry,
    expires_at: expiry,
    calls: { "24h": { direction } },
    priority_call: { direction }
  });
  return {
    dashboard_meta: { last_updated_et: "2026-10-04T20:05:41.007Z" },
    agents: [
      agent("EUR", "BEARISH_LEAN", ends),
      agent("GOLD", "BULLISH_LEAN", ends),
      agent("NQ", "BULLISH", ends),
      agent("BTC", btcDirection, btcEnds)
    ]
  };
}

// Only BTCUSD carries a ladder in this fixture; the other three are refusals the rule states itself.
function levelsFixture() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: "2026-10-04T16:14:19Z",
    instruments: [
      { symbol: "EURUSD", dashboard_asset: "EUR", levels: [] },
      { symbol: "XAUUSD", dashboard_asset: "GOLD", levels: [] },
      { symbol: "US100.cash", dashboard_asset: "NQ", levels: [] },
      { symbol: "BTCUSD", dashboard_asset: "BTC", levels: LEVELS }
    ]
  };
}

// One M5 block per instrument. Only BTC's newest close is beyond a marked level, so one pair is confirmed
// and the other three are refusals the rule reaches by itself. `closedTrades` is the account's own record of
// tickets this lane placed that have finished, which is the only artifact that says how one ended.
function feedFixture({ generatedAtMs = NOW - 30000, close = 84700, previousClose = 84480, positions = [], closedTrades = [] } = {}) {
  const instrument = (symbol, asset, point, bars) => ({
    symbol,
    dashboard_asset: asset,
    available: true,
    digits: 2,
    point,
    contract_size: 1,
    min_lot: 0.01,
    lot_step: 0.01,
    stops_level: 0,
    quote: {
      bid: close,
      ask: close,
      spread_points: 1,
      time_server: "2026-10-05T06:00:00Z",
      time_utc: "2026-10-05T06:00:00Z",
      market_state: "open"
    },
    m5: { bars }
  });
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(generatedAtMs).toISOString(),
    stale_after_seconds: 900,
    read_only: true,
    order_functions_called: false,
    positions,
    closed_trades: closedTrades,
    instruments: [
      instrument("EURUSD", "EUR", 0.00001, barsEndingAt(1.1, { previousClose: 1.099 })),
      instrument("XAUUSD", "GOLD", 0.01, barsEndingAt(4100, { previousClose: 4099 })),
      instrument("US100.cash", "NQ", 0.01, barsEndingAt(31000, { previousClose: 30999 })),
      instrument("BTCUSD", "BTC", 0.01, barsEndingAt(close, { previousClose }))
    ]
  };
}

// The state file as a run that has already placed one ticket leaves it: the trade a pair is in. Written before a
// run rather than after one, so a test can start from a pair that is already in a trade.
function stateWithPlacement(dir, over = {}) {
  const placed = {
    symbol: "BTCUSD",
    asset: "BTC",
    side: "long",
    signal_time_utc: "2026-10-04T15:10:00Z",
    level: 84500,
    entry: 84500,
    stop: 84300,
    target: 85500,
    risk: 200,
    r_multiple: 5,
    expire_minutes: null,
    comment: "l2l-rule-btc",
    sent: true,
    placed: true,
    refused: false,
    retcode_name: "TRADE_RETCODE_DONE",
    order_ticket: 278466201,
    deal: null,
    tool_exit: 0,
    placed_at_utc: new Date(NOW - 3600000).toISOString(),
    reason: null,
    ...over
  };
  fs.writeFileSync(path.join(dir, "trader-state.json"), `${JSON.stringify({ placements: [placed] }, null, 2)}\n`, "utf8");
  return placed;
}

// One closed trade of this lane's own, as the feed's history carries it: the two prices that were placed with it,
// the one price it closed at - at its target by default, so the trade it belongs to is over - and the deal times
// that tie it to the ticket that produced it.
function closedTrade(over = {}) {
  return {
    position_id: 278466201,
    symbol: "BTCUSD",
    dashboard_asset: "BTC",
    side: "buy",
    volume: 0.01,
    price_open: 84500,
    price_close: 85510,
    stop_loss: 84300,
    take_profit: 85500,
    profit: 0.1,
    commission: 0,
    swap: 0,
    net_profit: 0.1,
    magic: ORDER_MAGIC,
    comment: "l2l-rule-btc",
    deal_count: 2,
    entry_deal: 278466200,
    exit_deal: 278466201,
    opened: { time_server: "2026-10-05T05:05:00+00:00", time_utc: "2026-10-05T05:05:00+00:00" },
    closed: { time_server: "2026-10-05T05:40:00+00:00", time_utc: "2026-10-05T05:40:00+00:00" },
    duration_seconds: 2100,
    ...over
  };
}

function writeFixtures(dir, { calls = callsFixture(), levels = levelsFixture(), feed = feedFixture() } = {}) {
  const callsPath = path.join(dir, "layer1.json");
  const levelsPath = path.join(dir, "l2l-levels.json");
  const feedPath = path.join(dir, "live-trading.json");
  fs.writeFileSync(callsPath, JSON.stringify(calls), "utf8");
  fs.writeFileSync(levelsPath, JSON.stringify(levels), "utf8");
  fs.writeFileSync(feedPath, JSON.stringify(feed), "utf8");
  return { callsPath, levelsPath, feedPath };
}

// A run's options point at the fixtures and at temp paths for its own log, lock, state and journal, so a test
// never writes into the repository and never touches the published artifacts.
function optionsFor(dir, over = {}) {
  const options = parseArgs([
    "--once",
    "--published", repoRoot,
    "--calls", path.join(dir, "layer1.json"),
    "--levels", path.join(dir, "l2l-levels.json"),
    "--feed", path.join(dir, "live-trading.json")
  ]);
  options.log = path.join(dir, "trader.log");
  options.lock = path.join(dir, "trader.lock");
  options.state = path.join(dir, "trader-state.json");
  options.journal = path.join(dir, "orders.log");
  return { ...options, ...over };
}

// The flags a spawn's argument list carries, so a test can assert what the loop actually asked the tool for
// rather than what its source appears to say.
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

// The account as the tool's read-only `status` prints it: the human line, then the record on its own line.
function statusStdout({ positions = [], orders = [] } = {}) {
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "status",
    account: {
      login_masked: "***614",
      balance: 9997.55,
      equity: 9997.55,
      positions_open: positions.length,
      orders_open: orders.length
    },
    ticket_filter: null,
    positions,
    orders
  };
  return `STATUS ${positions.length} position(s), ${orders.length} pending order(s)\n${JSON.stringify(record)}\n`;
}

// What the tool prints when a ticket is left: the human line, then the record.
function sentStdout(over = {}) {
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "open",
    plan: {
      action: "open",
      symbol: "BTCUSD",
      side: "buy",
      entry: "pending limit at --entry-price",
      entry_price: 84500,
      expire_minutes: 30,
      requested_lots: "symbol volume_min (the smallest size it accepts)"
    },
    entry_type: "pending limit",
    entry_price: 84500,
    request: { action: 5, symbol: "BTCUSD", volume: 0.01, type: 2, price: 84500, sl: 84300, tp: 85500, magic: ORDER_MAGIC },
    answer: {
      sent: true,
      retcode: 10009,
      retcode_name: "TRADE_RETCODE_DONE",
      done: true,
      deal: 278466200,
      order: 278466201,
      volume: 0.01,
      price: 84500,
      comment: "l2l-rule-btc",
      filling_mode: 1,
      request_id: null
    },
    answer_raw: { retcode: 10009 },
    attempts: 1,
    ...over
  };
  return `OPEN BTCUSD buy 0.01 lot pending limit at 84500 (minimum for this symbol: 0.01)\n${JSON.stringify(record)}\n`;
}

// What the tool prints when a working limit is taken out: the human line, then the record.
function cancelledStdout(row = {}) {
  const order = {
    ticket: 278466201,
    symbol: "BTCUSD",
    type: "ORDER_TYPE_BUY_LIMIT",
    side: "buy",
    volume: 0.01,
    price_open: 84500,
    stop_loss: 84300,
    take_profit: 85500,
    comment: "l2l-rule-btc",
    magic: ORDER_MAGIC,
    ...row
  };
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "cancel",
    plan: { action: "cancel", ticket: order.ticket, trader_action: "TRADE_ACTION_REMOVE on a working pending order" },
    order,
    request: { action: 8, order: order.ticket, magic: ORDER_MAGIC },
    answer: {
      sent: true,
      retcode: 10009,
      retcode_name: "TRADE_RETCODE_DONE",
      done: true,
      deal: null,
      order: order.ticket,
      volume: null,
      price: null,
      comment: null,
      filling_mode: null,
      request_id: null
    },
    answer_raw: { retcode: 10009 },
    attempts: 1
  };
  return `CANCEL ${order.symbol} ${order.side} ${order.volume} lot pending entry at ${order.price_open} (ticket ${order.ticket})\n${JSON.stringify(record)}\n`;
}

// What the tool prints when a position is closed at the market: the human line, then the record. The shape is
// `close_order`'s own - the position it reached, the deal request and the answer - so a test reads the loop's
// send exactly the way the terminal's answer arrives.
function closedStdout(row = {}) {
  const position = {
    ticket: 278466300,
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    price_open: 84500,
    profit: 0.4,
    swap: 0,
    ...row
  };
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "close",
    plan: { action: "close", ticket: position.ticket, requested_lots: "the position's whole volume", magic: ORDER_MAGIC },
    position,
    partial: false,
    request: { action: 1, symbol: position.symbol, volume: position.volume, position: position.ticket },
    answer: {
      sent: true,
      retcode: 10009,
      retcode_name: "TRADE_RETCODE_DONE",
      done: true,
      order: position.ticket,
      volume: position.volume,
      price: 84700,
      comment: "l2l-rule-btc",
      request_id: null
    },
    answer_raw: { retcode: 10009 },
    attempts: 1
  };
  return `CLOSE ${position.symbol} ${position.side} ${position.volume} lot at the market (ticket ${position.ticket})\n${JSON.stringify(record)}\n`;
}

// What the tool prints when a position's levels are moved: the human lines, then the record `modify_order` writes -
// the position it reached, the `SLTP` request and the answer - so the loop's third kind of send is read here the way
// the terminal's own answer arrives rather than the way the source appears to say.
function modifiedStdout(row = {}) {
  const position = {
    ticket: 278466201,
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    price_open: 84500,
    stop_loss: 84300,
    take_profit: 85500,
    profit: 1.2,
    swap: 0,
    ...row
  };
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "modify",
    plan: {
      action: "modify",
      ticket: position.ticket,
      stop_loss: 84500,
      take_profit: "the position's own target, carried through unchanged",
      trader_action: "TRADE_ACTION_SLTP on an open position",
      comment: "l2l-rule-btc",
      magic: ORDER_MAGIC
    },
    position,
    reference_price: 84950,
    request: { action: 6, symbol: position.symbol, position: position.ticket, sl: 84500, tp: 85500, magic: ORDER_MAGIC },
    answer: {
      sent: true,
      retcode: 10009,
      retcode_name: "TRADE_RETCODE_DONE",
      done: true,
      deal: null,
      order: position.ticket,
      volume: null,
      price: null,
      comment: null,
      request_id: null
    },
    answer_raw: { retcode: 10009 },
    attempts: 1
  };
  return `MODIFY ${position.symbol} ${position.side} position ${position.ticket}: stop-loss ${position.stop_loss} -> 84500 (take-profit 85500)\n${JSON.stringify(record)}\n`;
}

// A stand-in for the Python tool: it answers the read-only `status` call and, when the run sends, the send
// itself. Nothing here touches MT5, a terminal or a broker.
function fakeSpawn({ status = {}, send = { exitCode: 0, stdout: sentStdout() }, fail = null } = {}) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push({ command, args });
    if (fail) return { error: new Error(fail), status: null, stdout: "", stderr: "" };
    const action = args[1];
    if (action === "status") return { status: 0, stdout: statusStdout(status), stderr: "" };
    return { status: send.exitCode, stdout: send.stdout, stderr: send.stderr || "" };
  };
  spawn.calls = calls;
  return spawn;
}

test("the usage states the arming flag, the sources and the caps, and offers no way to size a trade", () => {
  assert.match(USAGE, /--confirm-live/);
  assert.match(USAGE, /--published <dir>/);
  assert.match(USAGE, /--expire-minutes <n>/);
  assert.match(USAGE, /carries no expiry/, "the usage states that the rule's entry has no expiry");
  assert.match(USAGE, /tmp\/live-trading-trader\.log/);
  assert.match(USAGE, /sends nothing/);
  assert.match(USAGE, /--close-ticket <n>/, "the one hand act this loop takes is stated");
  assert.match(USAGE, /Needs --once/, "and that it is a hand act rather than a cadence");
  assert.match(USAGE, /twice the risk it was placed with/, "the stop adjustment is stated as automatic rather than as a flag");
  assert.match(USAGE, /never moved a second time/, "and that it is one rung rather than a trail");
  assert.equal(/--lots|--max-lots/.test(USAGE), false, "the loop must not offer a size of its own");
  assert.equal(/--take-profit|--stop-loss|--breakeven/.test(USAGE), false, "a level this loop sets is the rule's own, not the caller's");
  assert.equal(/"--lots"|"--max-lots"/.test(runnerSource), false, "the loop must not pass a size to the tool");
});

test("a bad command line is a usage error, and a cadence that chases itself is refused", async () => {
  assert.throws(() => parseArgs(["--nope"]), UsageError);
  assert.throws(() => parseArgs(["--settle-seconds", "300"]), UsageError);
  assert.throws(() => parseArgs(["--once", "--loop"]), UsageError);
  assert.throws(() => parseArgs(["--max-open", "0"]), UsageError);
  assert.throws(() => parseArgs(["--expire-minutes", "0"]), UsageError);
  assert.throws(() => parseArgs(["--loop", "--close-ticket", "278466300"]), UsageError, "a hand act is one ticket rather than a cadence");
  assert.throws(() => parseArgs(["--once", "--close-ticket", "0"]), UsageError);
  assert.throws(() => parseArgs(["--once", "--close-ticket", "not-a-ticket"]), UsageError);
  assert.equal(parseArgs(["--once", "--close-ticket", "278466300"]).closeTicket, 278466300);
  assert.equal(parseArgs(["--once"]).closeTicket, null, "and without it a run judges as it always did");
  assert.equal(await main(["--nope"]), 2);
  assert.equal(await main(["--help"]), 0);
});

test("a Layer 1 call is a direction only while its own window is open", () => {
  const calls = callsFixture();
  const live = layer1Call(calls.agents[0], NOW);
  assert.equal(live.asset, "EUR");
  assert.equal(live.published, "BEARISH_LEAN");
  assert.equal(live.direction, "BEARISH_LEAN");
  assert.equal(live.live, true);
  assert.equal(live.expires_at, "2026-10-06T04:00:00.000Z");

  // A call whose window has closed is kept as what was published and refused as a direction.
  const closed = layer1Call(callsFixture({ btcEnds: "2026-10-05T04:00:00.000Z" }).agents[3], NOW);
  assert.equal(closed.published, "BULLISH_LEAN");
  assert.equal(closed.direction, null);
  assert.equal(closed.live, false);

  // An expired status is a refusal even with a window still in front of it.
  const expired = layer1Call(callsFixture({ status: "EXPIRED" }).agents[2], NOW);
  assert.equal(expired.direction, null);
  assert.equal(expired.status, "EXPIRED");

  // An agent the artifact says nothing about carries no direction at all.
  assert.equal(layer1Call({ agent: "SILVER" }, NOW).published, null);
  assert.equal(layer1Call(undefined, NOW).published, null);
});

test("the validity fields fall back the way the page's own reading falls back", () => {
  const agent = {
    agent: "NQ",
    calls: { "24h": { direction: "BULLISH", forecast_window_end: "2026-10-06T04:00:00.000Z", effective_status: "ACTIVE" } }
  };
  const validity = layer1Validity(agent);
  assert.equal(validity.forecast_window_end, "2026-10-06T04:00:00.000Z");
  assert.equal(validity.effective_status, "ACTIVE");
  assert.equal(layer1Call(agent, NOW).direction, "BULLISH");
  // The page reads the same fields, and the loop is held to that reading rather than to a second idea of it.
  assert.match(runnerSource, /agent\?\.priority_call\?\.direction \|\| agent\?\.calls\?\.\["24h"\]\?\.direction \|\| null/);
  assert.match(runnerSource, /validity\.forecast_window_end \|\| validity\.expires_at \|\| null/);
  assert.match(scriptSource, /agent\?\.priority_call\?\.direction \|\| getCall\(agent, "24h"\)\.direction \|\| null/);
  assert.match(scriptSource, /const expiresAt = validity\?\.forecast_window_end \|\| validity\?\.expires_at \|\| null/);
});

test("the calls are keyed by the dashboard's asset code", () => {
  const calls = readCalls(callsFixture(), NOW);
  assert.deepEqual(Object.keys(calls.directions), ["EUR", "GOLD", "NQ", "BTC"]);
  assert.equal(calls.directions.BTC, "BULLISH_LEAN");
  assert.equal(calls.directions.EUR, "BEARISH_LEAN");
  assert.equal(calls.generated_at_utc, "2026-10-04T20:05:41.007Z");
  assert.equal(readCalls({}, NOW).rows.length, 0);
});

test("the ladder is joined onto the feed the way the page joins it", () => {
  const joined = joinLevels(feedFixture(), levelsFixture());
  assert.equal(joined.instruments.length, 4);
  const bySymbol = {};
  joined.instruments.forEach(instrument => { bySymbol[instrument.symbol] = instrument; });
  assert.equal(bySymbol.BTCUSD.levels.length, 3);
  assert.deepEqual(bySymbol.EURUSD.levels, []);
  assert.equal(joined.levels_generated_at_utc, "2026-10-04T16:14:19Z");
  // A symbol the ladder says nothing about keeps no levels key at all, and a price that is not a number is
  // dropped - the same filter the page applies, and the rule's own reader then drops anything not positive.
  const unmarked = joinLevels({ instruments: [{ symbol: "GBPUSD" }] }, levelsFixture());
  assert.equal("levels" in unmarked.instruments[0], false);
  assert.deepEqual(levelsFor({ levels: [{ price: "not a price" }, { price: 1.5 }] }), [{ price: 1.5 }]);
  assert.deepEqual(levelsFor({}), []);
});

test("the tool's own record is read from its last JSON line, refusals included", () => {
  assert.equal(parseToolRecord('STATUS 0 position(s), 0 pending order(s)\n{"action":"status"}').action, "status");
  assert.equal(parseToolRecord('refused: something\n{"refused":true,"message":"no"}').refused, true);
  assert.equal(parseToolRecord("not json at all"), null);
  assert.equal(parseToolRecord(""), null);
  assert.equal(parseToolRecord(undefined), null);
});

test("a ticket carrying this lane's magic is what makes the account read back as busy", () => {
  const live = liveFromStatus({
    action: "status",
    account: { login_masked: "***614" },
    positions: [{ ticket: 1, symbol: "BTCUSD", magic: ORDER_MAGIC }],
    orders: [
      { ticket: 2, symbol: "EURUSD", magic: ORDER_MAGIC, type: "ORDER_TYPE_SELL_LIMIT" },
      { ticket: 3, symbol: "XAUUSD", magic: 1 }
    ]
  });
  assert.equal(live.ours.length, 2);
  assert.deepEqual(live.ours.map(row => row.symbol), ["BTCUSD", "EURUSD"]);
  assert.equal(live.positions.length, 1);
  assert.equal(live.orders.length, 2);
  assert.equal(liveFromStatus({ action: "open" }), null);
  assert.equal(liveFromStatus(null), null);
});

test("an unarmed run states the ticket it would place and sends nothing", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "planned");
  assert.equal(record.armed, false);
  // One call to the tool: the read-only status. Nothing was sent, so nothing was spent.
  assert.equal(spawn.calls.length, 1);
  assert.equal(spawn.calls[0].args[1], "status");
  assert.equal(record.rule.confirmed, 1);
  assert.equal(record.rule.instruments, 4);
  assert.equal(record.rule.noLevels, 3);

  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.asset, "BTC");
  assert.equal(row.stage, "confirmed");
  assert.equal(row.decision, "place");
  assert.equal(row.side, "long");
  assert.deepEqual([row.entry, row.stop, row.target], [84500, 84300, 85500]);
  assert.equal(row.r_multiple, 5);

  assert.equal(record.placements.length, 1);
  assert.equal(record.placements[0].planned, true);
  assert.equal(record.placements[0].sent, false);
  assert.equal(record.placements[0].comment, "l2l-rule-btc");
  assert.equal(record.state.written, false);
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "a plan-only run must not spend a signal");
  assert.equal(fs.existsSync(path.join(dir, "trader.lock")), false, "the lock is released");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "trader.log"), "utf8").trim()).status, "planned");
});

test("an armed run places the ticket the rule states, at the instrument's own minimum", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "placed");
  assert.equal(spawn.calls.length, 2, "the terminal is read once, then one ticket is sent");
  assert.equal(spawn.calls[0].args[1], "status", "the read-only read comes first");

  const args = spawn.calls[1].args;
  assert.equal(args[1], "open");
  assert.ok(args[0].endsWith("live-trading-order.py"), "the sender is the one file that may send");
  const flags = flagMap(args);
  assert.equal(flags["--symbol"], "BTCUSD");
  assert.equal(flags["--side"], "buy");
  assert.equal(flags["--entry-price"], "84500");
  assert.equal(flags["--stop-loss"], "84300");
  assert.equal(flags["--take-profit"], "85500");
  assert.equal(flags["--comment"], "l2l-rule-btc");
  assert.equal(flags["--confirm-live"], true);
  assert.equal("--expire-minutes" in flags, false, "the rule's entry carries no expiry: the review removes it instead");
  assert.equal("--lots" in flags, false, "the size is the tool's own default, the symbol minimum");
  assert.equal("--max-lots" in flags, false);

  assert.equal(record.placements[0].placed, true);
  assert.equal(record.placements[0].order_ticket, 278466201);
  assert.equal(record.placements[0].deal, 278466200);
  assert.equal(record.placements[0].retcode_name, "TRADE_RETCODE_DONE");
  assert.equal(record.placements[0].reason, null);
  assert.equal(record.terminal.account, "***614");

  const state = readState(path.join(dir, "trader-state.json"));
  assert.equal(state.placements.length, 1);
  assert.equal(state.placements[0].placed, true);
  assert.equal(state.placements[0].signal_time_utc, "2026-10-04T15:10:00Z");
  assert.equal(state.placements[0].order_ticket, 278466201);
  assert.equal(record.state.held, 1);
});

// A crossing is spent once: the M5 bar that produced a ticket never produces a second trade. What the pair still
// holds while that trade is standing is the level it was triggered at, and the user corrected that on 2026-10-05:
// the limit goes back at that same level rather than waiting for a line a fresh candle crossed.
test("a spent signal bar is not a second trade, and the pair's own trade is what holds its level", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const options = optionsFor(dir, { confirmLive: true });
  const first = runOnce(options, { spawn: fakeSpawn(), now: () => NOW });
  assert.equal(first.record.status, "placed");
  const statePath = path.join(dir, "trader-state.json");
  assert.equal(readState(statePath).placements.length, 1);

  // The ticket is working in the account, so nothing is placed and nothing is spent: the live read, not the state
  // file, is what holds the pair.
  const heldSpawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] }
  });
  const held = runOnce(options, { spawn: heldSpawn, now: () => NOW });
  assert.equal(held.code, 0);
  assert.equal(held.record.status, "nothing_to_place");
  assert.equal(heldSpawn.calls.length, 1, "the terminal is read and nothing is sent");
  const heldRow = held.record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(heldRow.decision, "skip");
  assert.equal(heldRow.reentry, true, "the pair's own trade is what is judged, not the candles");
  assert.equal(heldRow.trade.trigger_level, 84500);
  assert.equal(heldRow.trade.ended, false);
  assert.match(heldRow.reason, /already carries a ticket from this loop/);
  assert.equal(held.record.rule.taken_today, 1);
  assert.equal(readState(statePath).placements.length, 1);

  // The market has taken the ticket out, and the call and the target both still stand: the trade is still the
  // pair's own, so the limit goes back at the level it was triggered at - a re-entry, which the day's count of
  // trades does not count against.
  const againSpawn = fakeSpawn();
  const again = runOnce(options, { spawn: againSpawn, now: () => NOW });
  assert.equal(again.code, 0);
  assert.equal(again.record.status, "placed");
  assert.equal(againSpawn.calls.length, 2, "the terminal is read, then the same level is put back");
  const flags = flagMap(againSpawn.calls[1].args);
  assert.equal(flags["--symbol"], "BTCUSD");
  assert.equal(flags["--entry-price"], "84500", "the level it was triggered at, not a line a fresh candle crossed");
  assert.equal(flags["--stop-loss"], "84300");
  assert.equal(flags["--take-profit"], "85500");
  assert.equal(again.record.placements[0].reentry, true);
  assert.equal(again.record.rule.taken_today, 1, "a re-entry is not a trade the day opened");
  assert.equal(
    again.record.rule.reentries_today,
    0,
    "the day as the run decided it: both counts are read before this run's own ticket lands"
  );
  const state = readState(statePath);
  assert.equal(state.placements.length, 2);
  assert.equal(state.placements[1].reentry, true);
  assert.equal(state.placements[1].signal_time_utc, "2026-10-04T15:10:00Z", "the trade's own signal bar, not a new one");
});

// The user's correction of 2026-10-05, stated as the cases it turns on: the level a trade was triggered at stays
// its entry while the call stands and its target has not been taken, and the two things that end it take the level
// out of the market - the call changing, and the account's own record of the target being taken.
// `closedAtItsTarget` is the reading the second of those rests on.
test("how a closed trade ended is read from the two prices that were placed with it", () => {
  // Today's two NQ trades exactly as data/live-trading.json carries them: the first closed at its target, the
  // second at its stop, and each exit sits a fraction of a point either side of the price it reached.
  assert.equal(closedAtItsTarget({ price_close: 30807.93, stop_loss: 30768.13, take_profit: 30807.01 }), true);
  assert.equal(closedAtItsTarget({ price_close: 30720.13, stop_loss: 30719.65, take_profit: 31049.43 }), false);
  // A record that does not say - neither price placed, a hand close, or nothing at all - ends nothing.
  assert.equal(closedAtItsTarget({ price_close: 85000, stop_loss: null, take_profit: null }), false);
  assert.equal(closedAtItsTarget({ price_close: null, stop_loss: 84300, take_profit: 85500 }), false);
  assert.equal(closedAtItsTarget(null), false);
});

test("a pair's trade is the newest ticket this loop placed on it", () => {
  const joined = joinLevels(feedFixture(), levelsFixture());
  const cycles = tradeCycles({
    state: {
      placements: [
        { symbol: "BTCUSD", asset: "BTC", side: "long", level: 83500, placed: true, placed_at_utc: "2026-10-05T04:00:00.000Z" },
        { symbol: "BTCUSD", asset: "BTC", side: "long", level: 84500, placed: true, placed_at_utc: "2026-10-05T05:00:00.000Z" },
        { symbol: "EURUSD", asset: "EUR", side: "short", level: 1.1, placed: false, placed_at_utc: null }
      ]
    },
    directions: { BTC: "BULLISH_LEAN", EUR: "BEARISH_LEAN" },
    joined,
    closedTrades: [],
    nowMs: NOW
  });

  assert.deepEqual(Array.from(cycles.keys()), ["BTCUSD"], "a ticket that was never placed is not a trade");
  const cycle = cycles.get("BTCUSD");
  assert.equal(cycle.trigger_level, 84500, "the newest level this loop placed at");
  assert.equal(cycle.target, 85500);
  assert.equal(cycle.ended, false);
  assert.equal(cycle.resting, true, "84500 sits under the market the feed reports");
  assert.equal(cycle.ticket.entry, 84500);
  assert.equal(cycle.ticket.stop, 84300);
});

test("the level a trade was triggered at stays the entry, whether or not a fresh candle crossed one", () => {
  const dir = tempDir();
  // Both closes are already above the trade's level, so no candle has crossed anything: the module reads the pair
  // as `waiting`, and the trade's own level is still what the loop leaves a limit at.
  writeFixtures(dir, { feed: feedFixture({ close: 84700, previousClose: 84600 }) });
  stateWithPlacement(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "placed");
  assert.equal(spawn.calls.length, 2, "the terminal is read, then the limit goes back at the level");
  const flags = flagMap(spawn.calls[1].args);
  assert.equal(flags["--symbol"], "BTCUSD");
  assert.equal(flags["--side"], "buy");
  assert.equal(flags["--entry-price"], "84500", "the level it was triggered at");
  assert.equal(flags["--stop-loss"], "84300");
  assert.equal(flags["--take-profit"], "85500", "the next marked line past that level");

  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.stage, "waiting", "the module's own reading is still stated beside the decision");
  assert.equal(row.reentry, true);
  assert.equal(row.decision, "place");
  assert.equal(row.entry, 84500);
  assert.equal(row.trade.trigger_level, 84500);
  assert.equal(row.trade.ended, false);
  assert.equal(record.placements[0].reentry, true);
  assert.equal(record.rule.taken_today, 1, "the day's one trade, not two");
  assert.equal(record.trades.rows[0].trigger_level, 84500);
});

test("a trade whose target the account has already taken is over, and its level is not re-entered", () => {
  const dir = tempDir();
  writeFixtures(dir, { feed: feedFixture({ close: 84700, previousClose: 84600, closedTrades: [closedTrade()] }) });
  stateWithPlacement(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "nothing_to_place");
  assert.equal(spawn.calls.length, 1, "nothing was sent");
  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.decision, "none");
  assert.equal(row.trade.ended, true);
  assert.equal(row.trade.ended_by, "target-fill");
  assert.match(row.trade.reason, /has taken its target/);
  assert.match(row.trade.reason, /closing at 85510/);
});

test("a trade whose call has changed is over, and its level is not re-entered", () => {
  const dir = tempDir();
  writeFixtures(dir, {
    calls: callsFixture({ btcDirection: "BEARISH_LEAN" }),
    feed: feedFixture({ close: 84600, previousClose: 84400 })
  });
  stateWithPlacement(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(spawn.calls.length, 1, "nothing was sent");
  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.reentry, undefined, "no trade of this pair's own is standing");
  assert.equal(row.trade.ended, true);
  assert.equal(row.trade.ended_by, "call");
  assert.match(row.trade.reason, /call this trade was left for has ended/);
});

// The endings the user has stated, in his own words. On 2026-10-05: "the levels are permanent, they are activated
// when a deviation happens on the 5m in line with the Layer 1 call. They stay active even if a SL is hit, they
// ractivate when a 5m candle deviates again they are only deactivated if the TP is hit or the daily call direction
// changes." On 2026-10-06 he restated the same lifetime: "just when the conditions are set for an entry you set
// the limit and wait for it to be hit or invalidated either by price hitting the TP without it touching the limit
// or if the directioncal call changed during the day, if it did then exit the position." The tests below pin the
// three endings that leaves: the call changing or turning, the account's own record of the target being taken, and
// a market that has reached the target while the entry is still only a working limit - the move the level was left
// for has happened without it. What is still not an ending is a stop-out or a *marked line* being passed on its
// own: the level is permanent and the same one is re-entered while its call stands.
test("a market that has reached the trade's target while the entry is still only a limit ends its turn", () => {
  const dir = tempDir();
  // The newest BTC close is 85700, at and past the 85500 line the trade is aiming at, and the entry never filled:
  // the deviation this level waits on has already happened without it, so the level's turn is over and nothing is
  // put back at 84500. The reading is the price the target sits at, taken from the quote and the bars since the
  // ticket was left - not a candle's close read as a line, which is the reading the 2026-10-05 ruling removed.
  writeFixtures(dir, { feed: feedFixture({ close: 85700, previousClose: 85600 }) });
  stateWithPlacement(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "nothing_to_place");
  assert.equal(spawn.calls.length, 1, "nothing was sent");
  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.reentry, undefined, "no trade of this pair's own is standing");
  assert.equal(row.trade.ended, true);
  assert.equal(row.trade.ended_by, "target-touched");
  assert.equal(row.trade.target_reached, true);
  assert.match(row.trade.reason, /target reached without its entry filling/);
});

test("a working limit whose target the market has reached comes out, read from the order's own take-profit", () => {
  const dir = tempDir();
  // The same reading on the account's own row, with no state file at all: the take-profit the terminal was given
  // when the ticket was left is the price the review reads, so a ticket this loop placed days ago - outside what
  // the state file still holds - is judged on the account's own numbers rather than on a recomputed ladder.
  writeFixtures(dir, { feed: feedFixture({ close: 85700, previousClose: 85600 }) });
  const spawn = fakeSpawn({
    status: {
      orders: [{
        ticket: 278466201,
        symbol: "BTCUSD",
        type: "ORDER_TYPE_BUY_LIMIT",
        side: "buy",
        magic: ORDER_MAGIC,
        price_open: 84500,
        stop_loss: 84300,
        take_profit: 85500
      }]
    },
    send: { exitCode: 0, stdout: cancelledStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "cancelled");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "cancel"], "the terminal is read, then the limit comes out");
  const row = record.pendings.rows[0];
  assert.equal(row.decision, "cancel");
  assert.equal(row.target_reached, true);
  assert.equal(row.target_line, 85500);
  assert.match(row.reason, /has been reached without the entry filling/);
  assert.equal(record.pendings.cancellations[0].cancelled, true);
  assert.equal(record.rule.open_tickets, 0, "the ticket that came out is not counted as working");
});

test("the target reading is the quote and the bars the snapshot carries since the ticket was left", () => {
  const instrument = {
    quote: { bid: 100, ask: 100.5 },
    m5: {
      bars: [
        { time_utc: "2026-10-05T04:00:00Z", high: 120, low: 90 },
        { time_utc: "2026-10-05T06:00:00Z", high: 105, low: 99 }
      ]
    }
  };
  // A touch between two runs: the quote is back under the target, and the bar the ticket was left before reached it.
  assert.equal(marketHasReached("long", 110, instrument, Date.parse("2026-10-05T03:00:00Z")), true);
  // The same ticket left after that bar: only the newest bar counts, and its high is under the target.
  assert.equal(marketHasReached("long", 110, instrument, Date.parse("2026-10-05T05:00:00Z")), false);
  // A touch exactly at the price is a touch: that is what a take-profit is.
  assert.equal(marketHasReached("long", 105, instrument, Date.parse("2026-10-05T05:00:00Z")), true);
  // A short's target is reached at the low, and the quote is read before the bars.
  assert.equal(marketHasReached("short", 99.5, instrument, null), true);
  assert.equal(marketHasReached("short", 101, instrument, null), true, "the ask at 100.5 is already through 101");
  assert.equal(marketHasReached("short", 85, instrument, null), false);
  // Nothing readable is not a reading that ends anything.
  assert.equal(marketHasReached("long", 110, { quote: {}, m5: { bars: [] } }, null), null);
  assert.equal(marketHasReached("long", null, instrument, null), null);
  assert.equal(marketHasReached("long", 110, null, null), null);
});


test("the trade's level is not left when the market is on the far side of it", () => {

  const dir = tempDir();
  // The market has fallen through the level: a buy limit at 84500 would be a buy now, so nothing is sent and the
  // pair waits for the price to trade back to it.
  writeFixtures(dir, { feed: feedFixture({ close: 84000, previousClose: 83900 }) });
  stateWithPlacement(dir);
  const spawn = fakeSpawn();
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "nothing_to_place");
  assert.equal(spawn.calls.length, 1, "a limit that cannot rest where the market is, is not sent");
  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.reentry, true);
  assert.equal(row.decision, "skip");
  assert.equal(row.trade.resting, false);
  assert.equal(row.trade.market, 84000);
  assert.match(row.reason, /far side of the market \(84000\)/);
});

test("a working limit comes out when the account's own record says its trade took the target", () => {
  const dir = tempDir();
  writeFixtures(dir, { feed: feedFixture({ close: 84700, previousClose: 84600, closedTrades: [closedTrade()] }) });
  stateWithPlacement(dir);
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] },
    send: { exitCode: 0, stdout: cancelledStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "cancelled");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "cancel"], "the terminal is read, then the limit comes out");
  const row = record.pendings.rows[0];
  assert.equal(row.decision, "cancel");
  assert.equal(row.target_line, 85500);
  assert.match(row.reason, /has taken its target/);
  assert.equal(record.pendings.cancellations[0].cancelled, true);
});

test("a ticket already working on a pair stops a second one, read live rather than from the snapshot", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "nothing_to_place");
  assert.equal(spawn.calls.length, 1);
  assert.equal(record.terminal.orders_open, 1);
  assert.equal(record.terminal.ours, 1);
  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.equal(row.decision, "skip");
  assert.match(row.reason, /already carries a ticket from this loop/);
});

// A working limit is still working only because price has not come back to it, and the level it sits at is
// permanent: the user's ruling leaves exactly one thing that takes it out of the market, the call it was left for
// changing or ending. That is judged from the artifact the rule itself reads and ends with the loop taking its own
// ticket back out through the tool's cancel; a candle closing past a line on the far side of the limit is not a
// reason, which is the test below it.
test("a working limit is taken back out when the call it was left for has ended", () => {
  const dir = tempDir();
  // BTC's call has flipped: the buy limit waits on a direction that is not standing any more.
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }) });
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] },
    send: { exitCode: 0, stdout: cancelledStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "cancelled");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "cancel"], "the terminal is read, then one removal is sent");
  assert.ok(spawn.calls[1].args[0].endsWith("live-trading-order.py"), "the removal goes through the one file that may send");
  const flags = flagMap(spawn.calls[1].args);
  assert.equal(flags["--ticket"], "278466201");
  assert.equal(flags["--comment"], "l2l-rule-btc");
  assert.equal(flags["--confirm-live"], true);

  assert.equal(record.pendings.reviewed, 1);
  assert.equal(record.pendings.rows[0].decision, "cancel");
  assert.match(record.pendings.rows[0].reason, /call this entry was left for has ended/);
  assert.equal(record.pendings.cancellations[0].cancelled, true);
  assert.equal(record.pendings.cancellations[0].retcode_name, "TRADE_RETCODE_DONE");

  // A removal is written down as its own kind of event, beside the placements, so the next reader can tell
  // the two apart.
  const state = readState(path.join(dir, "trader-state.json"));
  assert.equal(state.placements.length, 0);
  assert.equal(state.cancellations.length, 1);
  assert.equal(state.cancellations[0].ticket, 278466201);
  assert.match(state.cancellations[0].reason, /has ended/);
  assert.equal(record.state.cancellations_held, 1);
});

test("a working limit is kept when a marked line further out has been passed", () => {
  const dir = tempDir();
  // A sell limit left above the market, with the market then closing below a line on the far side of it. That
  // used to read as "the deviation is behind the market now" and take the limit out; the user ruled on 2026-10-05
  // that the levels are permanent, so a candle's close on its own decides nothing and the limit stays where it is.
  // The reading that does end a limit of this kind is the price the order's own take-profit sits at being reached,
  // and this account's row states no take-profit at all - so there is nothing here for that reading to read.
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }), feed: feedFixture({ close: 83400 }) });
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466202, symbol: "BTCUSD", type: "ORDER_TYPE_SELL_LIMIT", magic: ORDER_MAGIC, price_open: 85500 }] }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "nothing_to_place");
  assert.equal(spawn.calls.length, 1, "the terminal is read and nothing is sent");
  const row = record.pendings.rows[0];
  assert.equal(row.side, "short");
  assert.equal(row.ticket, 278466202);
  assert.equal(row.decision, "keep");
  assert.match(row.reason, /still standing/);
  assert.equal(row.passed_line, undefined, "no candle reading is left in the review");
  assert.equal(record.pendings.cancellations.length, 0);
});

test("a working limit whose call still stands and whose lines are all in front of it is left where it is", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "nothing_to_place");
  assert.equal(spawn.calls.length, 1, "a limit still waiting on a live call is not touched");
  assert.equal(record.pendings.reviewed, 1);
  assert.equal(record.pendings.rows[0].decision, "keep");
  assert.equal(record.pendings.cancellations.length, 0);
  assert.match(record.pendings.rows[0].reason, /still standing/);
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "nothing was done, so nothing is written");
  const row = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.match(row.reason, /already carries a ticket from this loop/);
});

test("a limit removed in a run frees its slot in that same run", () => {
  const dir = tempDir();
  const levels = levelsFixture();
  // GOLD is confirmed in this reading, and the BTC limit whose call has flipped is what comes out: the review runs
  // before the day's decisions, so the pair the limit was holding is judged on the account as it stands after the
  // removal - with the slot free in the same run rather than a bar later.
  levels.instruments[1].levels = [{ price: 4105.0, role: "derived" }, { price: 4099.5, role: "seed" }];
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }), levels });
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] },
    send: { exitCode: 0, stdout: cancelledStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "placed");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "cancel", "open"], "read, remove, then place");
  assert.equal(record.rule.open_tickets, 0, "the ticket that was removed is not counted as working");
  assert.equal(record.placements.length, 1);
  assert.equal(record.placements[0].symbol, "XAUUSD");
  assert.equal(record.placements[0].entry, 4099.5);
  const openFlags = flagMap(spawn.calls[2].args);
  assert.equal(openFlags["--symbol"], "XAUUSD");
  assert.equal(openFlags["--side"], "buy");
  assert.equal("--expire-minutes" in openFlags, false, "the entry the loop leaves carries no expiry");
  assert.equal(readState(path.join(dir, "trader-state.json")).cancellations.length, 1);
});

test("an explicit --expire-minutes is the only way a placed limit gets one", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const spawn = fakeSpawn();
  const { record } = runOnce(optionsFor(dir, { confirmLive: true, expireMinutes: 30 }), { spawn, now: () => NOW });

  assert.equal(record.status, "placed");
  assert.equal(flagMap(spawn.calls[1].args)["--expire-minutes"], "30");
  assert.equal(record.placements[0].expire_minutes, 30);
});

test("a removal that was sent and did not land fails the run rather than passing quietly", () => {
  const dir = tempDir();
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }) });
  const refusedByBroker = JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "cancel",
    plan: { action: "cancel", ticket: 278466201 },
    request: { action: 8, order: 278466201 },
    answer: { sent: true, retcode: 10027, retcode_name: "TRADE_RETCODE_DISABLE_TRADE", done: false },
    attempts: 1
  });
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] },
    send: { exitCode: 4, stdout: `CANCEL BTCUSD buy pending entry at 84500 (ticket 278466201)\n${refusedByBroker}\n` }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 1);
  assert.equal(record.status, "send_failed");
  assert.equal(record.pendings.cancellations[0].cancelled, false);
  assert.equal(record.pendings.cancellations[0].retcode_name, "TRADE_RETCODE_DISABLE_TRADE");
  assert.match(record.reason, /removal\(s\) did not land/);
});

test("an unarmed run states the removal it would send, sends nothing and writes nothing", () => {
  const dir = tempDir();
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }) });
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 }] }
  });
  const { record } = runOnce(optionsFor(dir), { spawn, now: () => NOW });

  assert.equal(record.status, "planned");
  assert.equal(spawn.calls.length, 1, "only the read-only status was called");
  assert.equal(record.pendings.rows[0].decision, "cancel");
  assert.equal(record.pendings.cancellations[0].planned, true);
  assert.equal(record.pendings.cancellations[0].sent, false);
  assert.equal(record.pendings.cancellations[0].cancelled, false);
  assert.equal(record.state.written, false);
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "looking must not leave a mark either");
});

test("a position whose call has turned is exited, and one whose call still stands is left alone", () => {
  const rows = reviewPositions({
    live: {
      positions: [
        { ticket: 11, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, profit: 0.4 },
        { ticket: 12, symbol: "EURUSD", side: "sell", magic: ORDER_MAGIC, volume: 0.01, price_open: 1.1 },
        { ticket: 13, symbol: "US100.cash", side: "sell", magic: 1, volume: 0.01, price_open: 31000 },
        { ticket: 14, symbol: "GBPUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 1.2 }
      ]
    },
    joined: joinLevels(feedFixture(), levelsFixture()),
    calls: readCalls(callsFixture({ btcDirection: "BEARISH_LEAN" }), NOW)
  });

  assert.equal(rows.length, 3, "a position another path opened is not this loop's to judge");
  const btc = rows.find(row => row.symbol === "BTCUSD");
  assert.equal(btc.decision, "close");
  assert.equal(btc.side, "long");
  assert.equal(btc.volume, 0.01);
  assert.match(btc.reason, /call this position was opened for has turned/);
  const eur = rows.find(row => row.symbol === "EURUSD");
  assert.equal(eur.decision, "keep", "a short position under a bearish call is the pair's own and stays");
  assert.match(eur.reason, /still standing/);
  const orphan = rows.find(row => row.symbol === "GBPUSD");
  assert.equal(orphan.decision, "keep");
  assert.match(orphan.reason, /snapshot carries no GBPUSD pair/);
});

test("a call that has ended is not a call that has turned, so a position is left to its own stop and target", () => {
  // The window the call was sealed in has closed: the resting limit comes out on that reading, and the position is
  // not exited on it - the user's instruction names a call that *changed*, and a lapsed call is not one.
  const rows = reviewPositions({
    live: { positions: [{ ticket: 21, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500 }] },
    joined: joinLevels(feedFixture(), levelsFixture()),
    calls: readCalls(callsFixture({ btcEnds: "2026-10-04T04:00:00.000Z" }), NOW)
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].decision, "keep");
  assert.match(rows[0].reason, /call that has ended is not a call that has turned/);
});


test("an armed run exits the position its pair's call has turned against", () => {
  const dir = tempDir();
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }) });
  const spawn = fakeSpawn({
    status: {
      positions: [{ ticket: 278466300, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, profit: 0.4 }]
    },
    send: { exitCode: 0, stdout: closedStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "closed");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "close"], "the terminal is read, then the position is exited");
  assert.equal(record.positions.reviewed, 1);
  assert.equal(record.positions.rows[0].decision, "close");
  assert.equal(record.positions.closes[0].closed, true);
  const flags = flagMap(spawn.calls[1].args);
  assert.equal(flags["--ticket"], "278466300", "the exit names the position, not a pending order");
  assert.equal(flags["--comment"], "l2l-rule-btc");
  assert.equal(flags["--confirm-live"], true);
  // The pair still carries the position in this run's own read, so nothing new is placed on it until the account
  // itself says the exit has landed; the state records the send, so a reader can tell that it happened.
  assert.equal(readState(path.join(dir, "trader-state.json")).closes.length, 1);
  const btc = record.rule.rows.find(entry => entry.symbol === "BTCUSD");
  assert.match(btc.reason, /already holds an open position/);
});

test("an unarmed run states the exit it would send and sends nothing", () => {
  const dir = tempDir();
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }) });
  const spawn = fakeSpawn({
    status: {
      positions: [{ ticket: 278466300, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500 }]
    }
  });
  const { record } = runOnce(optionsFor(dir), { spawn, now: () => NOW });

  assert.equal(record.status, "planned");
  assert.equal(spawn.calls.length, 1, "only the read-only status was called");
  assert.equal(record.positions.rows[0].decision, "close");
  assert.equal(record.positions.closes[0].planned, true);
  assert.equal(record.positions.closes[0].sent, false);
  assert.equal(record.positions.closes[0].closed, false);
  assert.equal(record.state.written, false);
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "looking must not leave a mark either");
});

test("a close that was sent and did not land fails the run rather than passing quietly", () => {
  const dir = tempDir();
  writeFixtures(dir, { calls: callsFixture({ btcDirection: "BEARISH_LEAN" }) });
  const refusedByBroker = JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "close",
    plan: { action: "close", ticket: 278466300 },
    request: { action: 1, position: 278466300 },
    answer: { sent: true, retcode: 10027, retcode_name: "TRADE_RETCODE_DISABLE_TRADE", done: false },
    attempts: 1
  });
  const spawn = fakeSpawn({
    status: {
      positions: [{ ticket: 278466300, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500 }]
    },
    send: { exitCode: 4, stdout: `CLOSE BTCUSD buy 0.01 lot at the market (ticket 278466300)\n${refusedByBroker}\n` }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 1);
  assert.equal(record.status, "send_failed");
  assert.equal(record.positions.closes[0].closed, false);
  assert.equal(record.positions.closes[0].retcode_name, "TRADE_RETCODE_DISABLE_TRADE");
  assert.match(record.reason, /exit\(s\) did not land/);
});

test("an order's own type says which way it waits, and another path's ticket is not this loop's to remove", () => {

  assert.equal(pendingDirection({ type: "ORDER_TYPE_BUY_LIMIT" }), "long");
  assert.equal(pendingDirection({ type: "ORDER_TYPE_BUY_STOP" }), "long");
  assert.equal(pendingDirection({ type: "ORDER_TYPE_SELL_LIMIT" }), "short");
  assert.equal(pendingDirection({ type: "ORDER_TYPE_SELL_STOP" }), "short");
  assert.equal(pendingDirection({ type: "ORDER_TYPE_BUY" }), "long");
  assert.equal(pendingDirection({ type: "something else" }), null);
  assert.equal(pendingDirection(null), null);

  const rows = reviewPendings({
    live: {
      orders: [
        { ticket: 1, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 84500 },
        { ticket: 2, symbol: "EURUSD", type: "ORDER_TYPE_SELL_LIMIT", magic: 1, price_open: 1.1 }
      ]
    },
    joined: joinLevels(feedFixture(), levelsFixture()),
    calls: readCalls(callsFixture(), NOW),
    nowMs: NOW
  });
  assert.equal(rows.length, 1, "a ticket another path placed is not this loop's to judge");
  assert.equal(rows[0].ticket, 1);
  assert.equal(rows[0].asset, "BTC");
  assert.equal(rows[0].side, "long");

  // A pair the snapshot does not carry is left alone rather than removed on a reading that is missing.
  const orphan = reviewPendings({
    live: { orders: [{ ticket: 3, symbol: "GBPUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, price_open: 1.2 }] },
    joined: joinLevels(feedFixture(), levelsFixture()),
    calls: readCalls(callsFixture(), NOW),
    nowMs: NOW
  });
  assert.equal(orphan[0].decision, "keep");
  assert.match(orphan[0].reason, /snapshot carries no GBPUSD pair/);
});

test("the caps the loop keeps hold before anything is placed, and the cap it does not keep is per pair", () => {
  const readings = [{
    symbol: "BTCUSD",
    asset: "BTC",
    stage: "confirmed",
    side: "long",
    plan: { entry: 84500, stop: 84300, target: 85500, risk: 200, r_multiple: 5 },
    confirmation: { time_utc: "2026-10-04T15:10:00Z" },
    reason: "confirmed"
  }];
  const clean = decide({ readings, state: { placements: [] }, live: { ours: [] }, options: { maxOpen: 1, maxPerDay: 4 }, nowMs: NOW });
  assert.equal(clean.candidates.length, 1);
  assert.equal(clean.taken_today, 0);
  assert.equal(clean.open_tickets, 0);

  const full = decide({
    readings,
    state: { placements: [] },
    live: { ours: [{ ticket: 1, symbol: "EURUSD" }] },
    options: { maxOpen: 1, maxPerDay: 4 },
    nowMs: NOW
  });
  assert.equal(full.candidates.length, 0);
  assert.match(full.rows[0].reason, /--max-open is 1/);

  const daySpent = decide({
    readings,
    state: { placements: [{ symbol: "NQ", placed: true, placed_at_utc: new Date(NOW).toISOString(), signal_time_utc: "2026-10-04T14:00:00Z" }] },
    live: { ours: [] },
    options: { maxOpen: 4, maxPerDay: 1 },
    nowMs: NOW
  });
  assert.equal(daySpent.candidates.length, 0);
  assert.match(daySpent.rows[0].reason, /--max-per-day is 1/);
  assert.equal(daySpent.taken_today, 1);

  // A ticket the tool refused never became a trade, so it does not spend the day's cap - while its signal bar
  // stays spent, which is a different question, answered by the signal key.
  const refusedToday = decide({
    readings,
    state: { placements: [{ symbol: "NQ", placed: false, placed_at_utc: new Date(NOW).toISOString(), signal_time_utc: "2026-10-04T14:00:00Z" }] },
    live: { ours: [] },
    options: { maxOpen: 1, maxPerDay: 1 },
    nowMs: NOW
  });
  assert.equal(refusedToday.candidates.length, 1);
  assert.equal(refusedToday.taken_today, 0);

  // The hold the user restated on 2026-10-06 - "each asset can have only one pending order running at a time" -
  // is one ticket per pair, and it is the rule's own. With no hand cap asked for, another pair's working ticket
  // does not hold this one back: what holds a pair back is that *pair* already carrying a ticket.
  const perPair = decide({
    readings,
    state: { placements: [] },
    live: { ours: [{ ticket: 1, symbol: "EURUSD" }] },
    options: { maxOpen: null, maxPerDay: 4 },
    nowMs: NOW
  });
  assert.equal(perPair.candidates.length, 1, "another pair's ticket is not this pair's business");
  assert.equal(perPair.rows[0].decision, "place");
  assert.equal(perPair.open_tickets, 1, "the working ticket is still counted and still stated");
});

test("a stale snapshot, a terminal that cannot be read or a missing artifact stops the run", () => {
  // A snapshot outside its own freshness window is refused before the terminal is even read.
  const staleDir = tempDir();
  writeFixtures(staleDir, { feed: feedFixture({ generatedAtMs: NOW - 3600000 }) });
  const staleSpawn = fakeSpawn();
  const stale = runOnce(optionsFor(staleDir), { spawn: staleSpawn, now: () => NOW });
  assert.equal(stale.code, 1);
  assert.equal(stale.record.status, "refused");
  assert.match(stale.record.reason, /not fresh/);
  assert.equal(staleSpawn.calls.length, 0, "nothing is read from a snapshot that is not a reading of the market");

  // A terminal that cannot be read leaves the account unknown, so nothing is sent into it.
  const deadDir = tempDir();
  writeFixtures(deadDir);
  const dead = runOnce(optionsFor(deadDir), { spawn: fakeSpawn({ fail: "spawn ENOENT" }), now: () => NOW });
  assert.equal(dead.code, 1);
  assert.equal(dead.record.status, "refused");
  assert.match(dead.record.reason, /terminal could not be read/);
  assert.match(dead.record.reason, /spawn ENOENT/);
  assert.equal(dead.record.placements.length, 0);

  // An artifact that is not there names itself rather than being reported as "an artifact".
  const missingDir = tempDir();
  writeFixtures(missingDir);
  fs.unlinkSync(path.join(missingDir, "l2l-levels.json"));
  const absent = runOnce(optionsFor(missingDir), { spawn: fakeSpawn(), now: () => NOW });
  assert.equal(absent.code, 1);
  assert.equal(absent.record.status, "refused");
  assert.match(absent.record.reason, /marked ladder could not be read/);
  assert.match(absent.record.reason, /l2l-levels\.json/);
});

test("a ticket the tool refuses spends the signal and is not a failed run", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const refusal = JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "open",
    plan: { symbol: "BTCUSD", side: "buy" },
    refused: true,
    message: "refused: a buy limit at 84500 is at or above the market (84700), so the retrace it waits for has already happened. Nothing was sent.",
    note: "nothing was sent; this record is the whole of what happened."
  });
  const spawn = fakeSpawn({ send: { exitCode: 3, stdout: `refused: a buy limit at 84500 is at or above the market\n${refusal}\n` } });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0, "the market saying no is not a cadence that has broken");
  assert.equal(record.status, "refused");
  assert.equal(record.placements[0].refused, true);
  assert.equal(record.placements[0].placed, false);
  assert.match(record.placements[0].reason, /retrace it waits for has already happened/);
  // The attempt is written down, so a spent signal is not offered again on the next tick.
  assert.equal(readState(path.join(dir, "trader-state.json")).placements.length, 1);
  const againSpawn = fakeSpawn();
  const again = runOnce(optionsFor(dir, { confirmLive: true }), { spawn: againSpawn, now: () => NOW });
  assert.equal(again.record.status, "nothing_to_place");
  assert.equal(againSpawn.calls.length, 1);
});

test("a ticket that was sent and did not land fails the run", () => {
  const dir = tempDir();
  writeFixtures(dir);
  const refusedByBroker = JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "open",
    plan: { symbol: "BTCUSD", side: "buy" },
    request: { action: 5, symbol: "BTCUSD", price: 84500 },
    answer: { sent: true, retcode: 10027, retcode_name: "TRADE_RETCODE_DISABLE_TRADE", done: false },
    attempts: 1
  });
  const spawn = fakeSpawn({ send: { exitCode: 4, stdout: `OPEN BTCUSD buy pending limit at 84500\n${refusedByBroker}\n` } });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 1);
  assert.equal(record.status, "send_failed");
  assert.equal(record.placements[0].placed, false);
  assert.equal(record.placements[0].refused, false);
  assert.equal(record.placements[0].retcode_name, "TRADE_RETCODE_DISABLE_TRADE");
});

test("the loop names no order call of its own, and marks its tickets with the tool's own number", () => {
  const ORDER_CALL = /\b(order_send|order_check|order_calc|positions_modify|positions_close|order_close|order_cancel)\s*\(/;
  assert.equal(ORDER_CALL.test(runnerSource), false, "a second sender is a second thing that can send");
  assert.equal(ORDER_CALL.test(scriptSource), false, "the page must not reach a broker either");
  assert.match(orderToolSource, /^MAGIC = \d+$/m);
  assert.equal(Number(orderToolSource.match(/^MAGIC = (\d+)$/m)[1]), ORDER_MAGIC, "one magic, so a read-back can say who placed what");
  assert.match(runnerSource, /^const ORDER_MAGIC = 20261004;$/m);
  assert.match(runnerSource, /^const ORDER_TOOL_RELATIVE = "tools\/mt5-bridge\/live-trading-order\.py";$/m);
  assert.equal(/MetaTrader5|import mt5/.test(runnerSource), false, "the loop never touches the terminal library itself");
  assert.equal(ORDER_TOOL_RELATIVE, "tools/mt5-bridge/live-trading-order.py");
});

test("the cadence lands after the bar close and after the feed's own run", () => {
  assert.equal(new Date(nextRunAt(Date.parse("2026-10-05T06:02:00Z"), 300, 90)).toISOString(), "2026-10-05T06:06:30.000Z");
  assert.equal(new Date(nextRunAt(Date.parse("2026-10-05T06:06:40Z"), 300, 90)).toISOString(), "2026-10-05T06:11:30.000Z");
});


test("the breakeven rung is read from the trade's own placement, once, and never from the stop the terminal holds", () => {
  // The placement a trade was opened from: the entry, the stop and the target it was placed with, and its own risk.
  // This row is the source of the numbers, because the first move this loop makes is what overwrites the terminal's
  // stop - a stop at breakeven would read as a trade with no risk at all.
  const placement = {
    symbol: "BTCUSD",
    asset: "BTC",
    side: "long",
    entry: 84500,
    stop: 84300,
    target: 85500,
    risk: 200,
    r_multiple: 5,
    order_ticket: 278466201,
    sent: true,
    placed: true,
    placed_at_utc: "2026-10-05T05:00:00.000Z"
  };
  const state = { placements: [placement], cancellations: [], closes: [], moves: [] };
  const position = over => ({
    ticket: 278466201,
    symbol: "BTCUSD",
    side: "buy",
    magic: ORDER_MAGIC,
    volume: 0.01,
    price_open: 84500,
    stop_loss: 84300,
    ...over
  });
  const review = ({ at = 84950, held = {}, heldState = state, closing = [] } = {}) => breakevenReview({
    live: { positions: [position(held)] },
    joined: joinLevels(feedFixture({ close: at }), levelsFixture()),
    state: heldState,
    closing
  });

  assert.equal(BREAKEVEN_R_MULTIPLE, 2, "the rung is the rule's own and it is a constant rather than a flag");
  assert.equal(placementRisk(placement), 200, "the placement states its risk");
  assert.equal(placementRisk({ entry: 84500, stop: 84300 }), 200, "and the distance it placed is the risk when it states none");
  assert.equal(placementRisk({ entry: 84500, stop: 84500, target: 85500, r_multiple: 5 }), 200, "and its target over its multiple when the stop was placed at the entry");
  assert.equal(placementRisk({ entry: 84500 }), null, "a row stating no risk is not a number a stop may be moved against");
  assert.equal(movedTickets({ moves: [{ ticket: 278466201, moved_at_utc: "2026-10-05T05:30:00.000Z" }] }).get(278466201).ticket, 278466201);

  const move = review();
  assert.equal(move.length, 1);
  assert.equal(move[0].decision, "move");
  assert.equal(move[0].risk, 200, "the risk is the placement's own rather than the stop the terminal holds now");
  assert.equal(move[0].trigger_price, 84900);
  assert.equal(move[0].new_stop, 84500, "breakeven is the entry this trade was placed with");
  assert.equal(move[0].target, 85500, "and the target is carried through rather than restated");
  assert.equal(move[0].exit_price, 84950);
  assert.match(move[0].reason, /has run to 2 times the 200 it was placed with/);
  assert.match(move[0].reason, /one rung rather than a trail/);

  // The trade whose stop the terminal already carries at the entry, and the one the state file records a move for:
  // the first is the level itself, the second is the rung that has been spent, and neither is asked for twice.
  const held = review({ held: { stop_loss: 84500 } });
  assert.equal(held[0].decision, "keep");
  assert.match(held[0].reason, /at or past the entry 84500/);
  const spent = review({ heldState: { ...state, moves: [{ ticket: 278466201, moved_at_utc: "2026-10-05T05:30:00.000Z" }] } });
  assert.equal(spent[0].decision, "keep");
  assert.match(spent[0].reason, /already been taken to breakeven/);

  // Short of the level, on the same trade, nothing is sent: the market has to reach it first.
  const short = review({ at: 84800 });
  assert.equal(short[0].decision, "keep");
  assert.match(short[0].reason, /the market has to reach 84900/);


  // A position this same run is exiting keeps its stop, and a ticket the state file says nothing about is not moved
  // against a number this loop does not have.
  const exiting = review({ closing: [278466201] });
  assert.equal(exiting[0].decision, "keep");
  assert.match(exiting[0].reason, /already exiting BTCUSD/);
  const unknown = breakevenReview({
    live: { positions: [position({ ticket: 999 })] },
    joined: joinLevels(feedFixture({ close: 84950 }), levelsFixture()),
    state
  });
  assert.equal(unknown[0].decision, "keep");
  assert.match(unknown[0].reason, /no placement for ticket 999/);

  // A pair the snapshot does not carry, another path's position, and a position whose direction the terminal does
  // not state: none of them is moved.
  const orphan = breakevenReview({
    live: { positions: [position({ ticket: 999, symbol: "GBPUSD" })] },
    joined: joinLevels(feedFixture({ close: 84950 }), levelsFixture()),
    state: { ...state, placements: [{ ...placement, order_ticket: 999, symbol: "GBPUSD", entry: 1.2, stop: 1.19, target: 1.25, risk: 0.01 }] }
  });
  assert.equal(orphan[0].decision, "keep");
  assert.match(orphan[0].reason, /snapshot carries no GBPUSD pair/);
  assert.equal(breakevenReview({
    live: { positions: [position({ ticket: 5, magic: 1 })] },
    joined: joinLevels(feedFixture({ close: 84950 }), levelsFixture()),
    state
  }).length, 0, "a position another path placed is not this loop's to amend");
  const unstated = breakevenReview({
    live: { positions: [{ ticket: 278466201, symbol: "BTCUSD", magic: ORDER_MAGIC, volume: 0.01 }] },
    joined: joinLevels(feedFixture({ close: 84950 }), levelsFixture()),
    state
  });
  assert.equal(unstated[0].decision, "keep");
  assert.match(unstated[0].reason, /nothing here knows which way it waits/);
});

test("an unarmed run states the stop it would take to breakeven and writes nothing", () => {
  const dir = tempDir();
  stateWithPlacement(dir);
  writeFixtures(dir, { feed: feedFixture({ close: 84950 }) });
  const spawn = fakeSpawn({
    status: { positions: [{ ticket: 278466201, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, stop_loss: 84300, profit: 1.2 }] }
  });
  const { code, record } = runOnce(optionsFor(dir), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "planned");
  assert.equal(spawn.calls.length, 1, "only the read-only status was called: looking sends no move");
  assert.equal(record.breakeven.reviewed, 1);
  assert.equal(record.breakeven.rows[0].decision, "move");
  assert.equal(record.breakeven.moves[0].planned, true);
  assert.equal(record.breakeven.moves[0].sent, false);
  assert.equal(record.breakeven.moves[0].moved, false);
  assert.equal(record.breakeven.moves[0].new_stop, 84500);
  assert.equal(record.state.written, false);
  assert.equal(readState(path.join(dir, "trader-state.json")).moves.length, 0, "a plan is not a move");
});

test("an armed run moves the stop of a trade that has run to twice its risk, and never asks twice", () => {
  const dir = tempDir();
  stateWithPlacement(dir);
  writeFixtures(dir, { feed: feedFixture({ close: 84950 }) });
  const spawn = fakeSpawn({
    status: { positions: [{ ticket: 278466201, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, stop_loss: 84300, profit: 1.2 }] },
    send: { exitCode: 0, stdout: modifiedStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "stop_moved");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "modify"], "the terminal is read, then the stop is moved");
  assert.equal(record.breakeven.moves[0].moved, true);
  assert.equal(record.breakeven.moves[0].new_stop, 84500);
  assert.equal(record.breakeven.moves[0].retcode_name, "TRADE_RETCODE_DONE");
  assert.equal(record.breakeven.moves[0].comment, "l2l-rule-btc");
  const flags = flagMap(spawn.calls[1].args);
  assert.equal(flags["--ticket"], "278466201", "the move names the position rather than a pending order");
  assert.equal(flags["--stop-loss"], "84500", "and the level it asks for is the entry the trade was placed with");
  assert.equal(flags["--comment"], "l2l-rule-btc");
  assert.equal(flags["--confirm-live"], true);
  assert.equal(flags["--take-profit"], undefined, "the target is the position's own and is not restated");
  // The move is written down, so a run that reads the account between the send and its landing cannot ask again.
  const held = readState(path.join(dir, "trader-state.json"));
  assert.equal(held.moves.length, 1);
  assert.equal(held.moves[0].ticket, 278466201);
  assert.equal(held.moves[0].new_stop, 84500);

  // The next run reads the terminal with the stop the move left there and asks for nothing at all.
  const againSpawn = fakeSpawn({
    status: { positions: [{ ticket: 278466201, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, stop_loss: 84500, profit: 1.4 }] }
  });
  const again = runOnce(optionsFor(dir, { confirmLive: true }), { spawn: againSpawn, now: () => NOW });
  assert.equal(again.record.breakeven.rows[0].decision, "keep");
  assert.match(again.record.breakeven.rows[0].reason, /already been taken to breakeven/);
  assert.equal(againSpawn.calls.length, 1, "one rung per trade, not one a bar");
});

test("a stop move that was sent and did not land fails the run rather than passing quietly", () => {
  const dir = tempDir();
  stateWithPlacement(dir);
  writeFixtures(dir, { feed: feedFixture({ close: 84950 }) });
  const refusedByBroker = JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "modify",
    plan: { action: "modify", ticket: 278466201 },
    request: { action: 6, position: 278466201, sl: 84500 },
    answer: { sent: true, retcode: 10016, retcode_name: "TRADE_RETCODE_INVALID_STOPS", done: false },
    attempts: 1
  });
  const spawn = fakeSpawn({
    status: { positions: [{ ticket: 278466201, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, stop_loss: 84300 }] },
    send: { exitCode: 4, stdout: `MODIFY BTCUSD buy position 278466201: stop-loss 84300 -> 84500\n${refusedByBroker}\n` }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 1);
  assert.equal(record.status, "send_failed");
  assert.equal(record.breakeven.moves[0].moved, false);
  assert.equal(record.breakeven.moves[0].retcode_name, "TRADE_RETCODE_INVALID_STOPS");
  assert.match(record.reason, /stop move\(s\) did not land/);
  assert.equal(readState(path.join(dir, "trader-state.json")).moves.length, 0, "a move that did not land is not a rung that has been spent");
});


test("a hand-run close states the act it would send, reads no artifact and leaves the account alone", () => {
  // No fixtures at all in this directory: the three artifacts are not this act's business, and a run that reached for
  // them would refuse on the missing files rather than state the act.
  const dir = tempDir();
  const spawn = fakeSpawn({
    status: { positions: [{ ticket: 278466300, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, profit: 0.4 }] }
  });
  const { code, record } = runOnce(optionsFor(dir, { closeTicket: 278466300 }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "planned");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status"], "the account is read and nothing is sent without the arming flag");
  assert.equal(record.hand.ticket, 278466300);
  assert.equal(record.hand.artifacts_read, false, "the rule is not asked about an act that is not its");
  assert.equal(record.hand.kind, "position");
  assert.equal(record.hand.symbol, "BTCUSD");
  assert.equal(record.hand.side, "long");
  assert.equal(record.hand.ours, true);
  assert.equal(record.hand.action, "close");
  assert.equal(record.hand.sent, false);
  assert.equal(record.hand.done, false);
  assert.match(record.reason, /--confirm-live was not passed/);
  assert.equal(record.rule, undefined, "the rule was never asked");
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "looking must not leave a mark either");
});

test("an armed hand-run close exits the named position, writes it down, and does nothing else that run", () => {
  const dir = tempDir();
  const spawn = fakeSpawn({
    status: { positions: [{ ticket: 278466300, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, profit: 0.4 }] },
    send: { exitCode: 0, stdout: closedStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true, closeTicket: 278466300 }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "closed");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "close"], "the terminal is read, then the position is exited");
  assert.equal(record.hand.done, true);
  assert.equal(record.hand.retcode_name, "TRADE_RETCODE_DONE");
  assert.match(record.reason, /position 278466300 was taken out by hand/);
  const flags = flagMap(spawn.calls[1].args);
  assert.equal(flags["--ticket"], "278466300");
  assert.equal(flags["--comment"], "l2l-rule-hand", "the ticket says who asked for it");
  assert.equal(flags["--confirm-live"], true);
  // Nothing else this run: no review, no removal, no ticket, no rule and no stop.
  assert.equal(record.rule, undefined, "the rule was never asked");
  assert.equal(record.positions, undefined);
  assert.equal(record.pendings, undefined);
  assert.equal(record.breakeven, undefined, "and no stop was reviewed on the way out");
  assert.deepEqual(record.placements, [], "nothing was placed");
  const held = readState(path.join(dir, "trader-state.json"));
  assert.equal(held.closes.length, 1);
  assert.equal(held.closes[0].ticket, 278466300);
  assert.equal(held.closes[0].comment, "l2l-rule-hand");
  assert.equal(held.placements.length, 0, "a hand act is not a trade this loop placed");
  assert.equal(held.moves.length, 0);
});


test("a hand run takes a working limit back out when the ticket turns out to be an order rather than a position", () => {
  const dir = tempDir();
  const spawn = fakeSpawn({
    status: { orders: [{ ticket: 278466201, symbol: "BTCUSD", type: "ORDER_TYPE_BUY_LIMIT", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500 }] },
    send: { exitCode: 0, stdout: cancelledStdout() }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true, closeTicket: 278466201 }), { spawn, now: () => NOW });

  assert.equal(code, 0);
  assert.equal(record.status, "cancelled");
  assert.equal(record.hand.kind, "working_limit", "one flag, and the ticket's own kind decides the action");
  assert.equal(record.hand.side, "long");
  assert.equal(record.hand.action, "cancel");
  assert.deepEqual(spawn.calls.map(call => call.args[1]), ["status", "cancel"]);
  const flags = flagMap(spawn.calls[1].args);
  assert.equal(flags["--ticket"], "278466201");
  assert.equal(flags["--comment"], "l2l-rule-hand");
  assert.equal(flags["--confirm-live"], true);
  const held = readState(path.join(dir, "trader-state.json"));
  assert.equal(held.cancellations.length, 1);
  assert.equal(held.cancellations[0].ticket, 278466201);
  assert.equal(held.closes.length, 0);
});

test("a hand run on a ticket that is not this loop's own, or is not on the account, sends nothing", () => {
  const dir = tempDir();
  // Another lane's magic: the reason says which of the two facts failed rather than reporting it as "not found".
  const otherSpawn = fakeSpawn({
    status: { positions: [{ ticket: 11, symbol: "EURUSD", side: "buy", magic: 1, volume: 0.01, price_open: 1.1 }] }
  });
  const other = runOnce(optionsFor(dir, { confirmLive: true, closeTicket: 11 }), { spawn: otherSpawn, now: () => NOW });
  assert.equal(other.code, 0);
  assert.equal(other.record.status, "nothing_to_close");
  assert.equal(other.record.hand.ours, false);
  assert.equal(other.record.hand.action, null);
  assert.equal(otherSpawn.calls.length, 1, "another path's position is not this loop's to take out");
  assert.match(other.record.reason, /does not carry this loop's own magic/);

  // A ticket the account does not carry at all is not a failure: there is simply nothing to be out of.
  const absentSpawn = fakeSpawn();
  const absent = runOnce(optionsFor(dir, { confirmLive: true, closeTicket: 4242 }), { spawn: absentSpawn, now: () => NOW });
  assert.equal(absent.code, 0);
  assert.equal(absent.record.status, "nothing_to_close");
  assert.equal(absentSpawn.calls.length, 1);
  assert.match(absent.record.reason, /not an open order or position on this account/);
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "a ticket that was not there leaves no mark");
});

test("a hand run whose terminal cannot be read, or whose send was refused, sends nothing it cannot stand behind", () => {
  const dir = tempDir();
  const dead = runOnce(optionsFor(dir, { confirmLive: true, closeTicket: 278466300 }), { spawn: fakeSpawn({ fail: "spawn ENOENT" }), now: () => NOW });
  assert.equal(dead.code, 1);
  assert.equal(dead.record.status, "refused");
  assert.match(dead.record.reason, /terminal could not be read/);
  assert.match(dead.record.reason, /spawn ENOENT/);
  assert.equal(dead.record.hand, undefined, "a ticket that could not be looked up has no act stated");

  // The tool's own guard, rather than this loop's: the run states the refusal and does not pass it off as a close.
  const refusedSpawn = fakeSpawn({
    status: { positions: [{ ticket: 278466300, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500 }] },
    send: {
      exitCode: 3,
      stdout: `refused: the terminal will not take that\n${JSON.stringify({
        at_utc: new Date(NOW).toISOString(),
        tool: ORDER_TOOL_RELATIVE,
        action: "close",
        plan: { action: "close", ticket: 278466300 },
        refused: true,
        message: "refused: position 278466300 is not there any more; nothing was sent.",
        note: "nothing was sent; this record is the whole of what happened."
      })}\n`
    }
  });
  const refused = runOnce(optionsFor(dir, { confirmLive: true, closeTicket: 278466300 }), { spawn: refusedSpawn, now: () => NOW });
  assert.equal(refused.code, 0, "the market saying no is not a cadence that has broken");
  assert.equal(refused.record.status, "refused");
  assert.equal(refused.record.hand.refused, true);
  assert.equal(refused.record.hand.done, false);
  assert.match(refused.record.reason, /is not there any more/);
  assert.equal(fs.existsSync(path.join(dir, "trader-state.json")), false, "a refused close is not a close");
});


test("a stop move the tool refused does not spend the rung, and the next run asks again", () => {
  const dir = tempDir();
  stateWithPlacement(dir);
  writeFixtures(dir, { feed: feedFixture({ close: 84950 }) });
  const refusal = JSON.stringify({
    at_utc: new Date(NOW).toISOString(),
    tool: ORDER_TOOL_RELATIVE,
    action: "modify",
    plan: { action: "modify", ticket: 278466201, stop_loss: 84500 },
    refused: true,
    message: "refused: the new stop sits 0.0 from the market and BTCUSD will not accept a level closer than 5.0 to it; nothing was sent.",
    note: "nothing was sent; this record is the whole of what happened."
  });
  const spawn = fakeSpawn({
    status: { positions: [{ ticket: 278466201, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, stop_loss: 84300 }] },
    send: { exitCode: 3, stdout: `refused: the new stop sits too close to the market\n${refusal}\n` }
  });
  const { code, record } = runOnce(optionsFor(dir, { confirmLive: true }), { spawn, now: () => NOW });

  assert.equal(code, 0, "the market saying no is not a cadence that has broken");
  assert.equal(record.status, "refused");
  assert.equal(record.breakeven.moves[0].refused, true);
  assert.equal(record.breakeven.moves[0].moved, false);
  assert.match(record.breakeven.moves[0].tool_reason, /will not accept a level closer than/);
  assert.match(record.reason, /no rung was spent/);
  assert.equal(readState(path.join(dir, "trader-state.json")).moves.length, 0, "the trade keeps the stop it was placed with");

  // The rung belongs to the terminal's own answer: a request it refused has not moved anything, so the next run asks
  // again rather than leaving the trade carrying the stop it was placed with for good.
  const againSpawn = fakeSpawn({
    status: { positions: [{ ticket: 278466201, symbol: "BTCUSD", side: "buy", magic: ORDER_MAGIC, volume: 0.01, price_open: 84500, stop_loss: 84300 }] },
    send: { exitCode: 0, stdout: modifiedStdout() }
  });
  const again = runOnce(optionsFor(dir, { confirmLive: true }), { spawn: againSpawn, now: () => NOW });
  assert.equal(again.record.breakeven.rows[0].decision, "move");
  assert.equal(again.record.status, "stop_moved");
  assert.equal(readState(path.join(dir, "trader-state.json")).moves.length, 1);
});

