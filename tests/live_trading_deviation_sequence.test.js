// The owner's deviation sequence, run through the loop: at a fixed level of 100 the newest completed M5 candle is
// read once, and it is a reclaim only if price had already both held the level and left it. The three legs are one
// symbol's closes, at one fixed level, in one trading session:
//
//   102 -> 99 -> 100 -> 101 leaves one buy limit at 100 (99 established the excursion, 101 reclaimed the level);
//   102 -> 100 -> 101 leaves none, because a close exactly on the line neither establishes an excursion nor
//   confirms a reclaim, and 99 -> 98 -> 101 leaves none because nothing had held the line first. The mirror is
//   stated on the short side (98 -> 101 -> 100 -> 99 buys nothing, 98 -> 100 -> 99 sells nothing) and every case
//   is run again after a stop-out, where the level is put back.
//
// The rule is asked for with --require-deviation on both lanes, and lane 1 also asks for the crossing gate it has
// never had (--reentry-crossing): those two flags are the whole of the execution change, and a put-back under
// either reads the newest completed candle rather than replaying an old one, which is the 13:46Z EURUSD put-back
// of 2026-11-13 that replayed a 06:40 close. Without them the loop is the deployed behaviour, which the last
// tests state so the difference is in the suite rather than in a note.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");
const trader = require("../scripts/run-live-trading-trader.js");

// The run clock is the newest bar's close plus ninety seconds, stated per run in runCase: the snapshot the loop
// reads is then a minute old and not stale, and the confirming candle is the newest completed one.
const START = Date.parse("2026-11-13T08:00:00Z");
const BAR_MS = 5 * 60 * 1000;
const LEVEL = 100;
const LADDER = [
  { price: 120, role: "seed", label: "seed 120" },
  { price: 110, role: "seed", label: "seed 110" },
  { price: 100, role: "derived", label: "derived 100" },
  { price: 90, role: "seed", label: "seed 90" }
];

const LANE1 = {
  name: "ftmo-1",
  magic: 20261004,
  target: 110,
  stop: 98,
  args: ["--lane", "ftmo-1", "--max-per-day", "4"]
};
const LANE2 = {
  name: "ftmo-2",
  magic: 20261005,
  target: 105,
  stop: 98.333333,
  args: ["--lane", "ftmo-2", "--grid", "half", "--r-multiple", "3", "--magic", "20261005", "--max-per-day", "4"]
};
const RECLAIM = ["--reentry-crossing", "--require-deviation"];

function bars(closes, overrides = {}, options = {}) {
  const start = options.start ?? START;
  return closes.map((close, index) => {
    const open = index === 0 ? close : closes[index - 1];
    const extra = overrides[index] || {};
    return {
      time_utc: new Date(start + index * BAR_MS).toISOString(),
      // A bar that names its own instrument: the rule refuses a reading whose legs name different pairs, so a
      // fixture that wants to state that has to be able to name one.
      ...(extra.symbol || options.symbol ? { symbol: extra.symbol || options.symbol } : {}),
      open,
      high: extra.high ?? Math.max(open, close),
      low: extra.low ?? Math.min(open, close),
      close
    };
  });
}

function callsFixture(direction) {
  const sealedAt = new Date(START - 60 * 60 * 1000).toISOString();
  return {
    dashboard_meta: { last_updated_et: sealedAt },
    agents: [{
      agent: "NQ",
      sealed_at: sealedAt,
      effective_status: "ACTIVE",
      forecast_window_end: "2026-11-14T00:00:00Z",
      expires_at: "2026-11-14T00:00:00Z",
      calls: { "24h": { direction } },
      priority_call: { direction }
    }]
  };
}

function levelsFixture() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: "2026-11-13T00:00:00Z",
    instrument_count: 1,
    instruments: [{ symbol: "US100.cash", dashboard_asset: "NQ", levels: LADDER }]
  };
}

function feedFixture({ lane, closes, overrides = {}, stoppedOut = false, start = START, exitAtMs = null, symbol = null }) {
  const list = bars(closes, overrides, { start, symbol });
  const last = closes[closes.length - 1];
  const closedTrades = stoppedOut
    ? [{
        position_id: 910201,
        symbol: "US100.cash",
        dashboard_asset: "NQ",
        side: "buy",
        volume: 0.1,
        price_open: LEVEL,
        price_close: lane.stop,
        stop_loss: lane.stop,
        take_profit: lane.target,
        profit: -1,
        commission: 0,
        swap: 0,
        net_profit: -1,
        magic: lane.magic,
        comment: "l2l-rule-nq",
        deal_count: 2,
        opened: { time_utc: new Date(start + 60 * 1000).toISOString() },
        closed: { time_utc: new Date(exitAtMs ?? start + BAR_MS).toISOString() }
      }]
    : [];
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(start + list.length * BAR_MS + 20000).toISOString(),
    stale_after_seconds: 900,
    terminal: { build: 6296, connected: true, trade_allowed: true },
    account: { login_masked: "***000", server: "FTMO-Server", currency: "USD", balance: 10000, equity: 10000, positions_open: 0, orders_open: 0 },
    orders: [],
    positions: [],
    closed_trades: closedTrades,
    instrument_count: 1,
    instruments: [{
      symbol: "US100.cash",
      dashboard_asset: "NQ",
      available: true,
      digits: 2,
      point: 0.01,
      min_lot: 0.1,
      lot_step: 0.1,
      quote: { bid: last - 0.1, ask: last + 0.1, spread_points: 20, market_state: "full" },
      m5: { candle_count: list.length, bars: list, stale: false }
    }],
    source: { producer: "tools/mt5-bridge/live-trading-snapshot.py", scope: "read-only snapshot" }
  };
}


function runCase({
  lane,
  closes,
  overrides = {},
  stoppedOut = false,
  direction = "BULLISH",
  flags = RECLAIM,
  repeats = 1,
  start = START,
  exitAtMs = null,
  symbol = null,
  stages = null
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `deviation-${lane.name}-`));
  const statePath = path.join(dir, "trader-state.json");
  if (stoppedOut) {
    fs.writeFileSync(statePath, JSON.stringify({
      placements: [{
        placed: true,
        symbol: "US100.cash",
        asset: "NQ",
        side: direction === "BULLISH" ? "long" : "short",
        level: LEVEL,
        entry: LEVEL,
        stop: lane.stop,
        target: lane.target,
        r_multiple: lane.name === "ftmo-2" ? 3 : 5,
        order_ticket: 910201,
        placed_at_utc: new Date(start).toISOString(),
        signal_time_utc: new Date(start - BAR_MS).toISOString()
      }],
      cancellations: [],
      closes: [],
      moves: [],
      close_requests: []
    }, null, 2), "utf8");
  }
  fs.writeFileSync(path.join(dir, "layer1.json"), JSON.stringify(callsFixture(direction)), "utf8");
  fs.writeFileSync(path.join(dir, "l2l-levels.json"), JSON.stringify(levelsFixture()), "utf8");
  const identityPath = path.join(dir, "lane-identity.json");
  fs.writeFileSync(identityPath, JSON.stringify({ login: 1000841, server: "FTMO-Server3" }), "utf8");

  const options = trader.parseArgs([
    "--once",
    "--confirm-live",
    "--close-requests", "off",
    "--published", dir,
    "--calls", path.join(dir, "layer1.json"),
    "--levels", path.join(dir, "l2l-levels.json"),
    "--feed", path.join(dir, "live-trading.json"),
    ...lane.args,
    ...(lane.name === "ftmo-2" ? ["--expect-identity", identityPath] : []),
    ...flags
  ]);
  options.log = path.join(dir, "trader.log");
  options.lock = path.join(dir, "trader.lock");
  options.state = statePath;
  options.journal = path.join(dir, "orders.log");
  options.statusOut = path.join(dir, "trader-status.json");

  let opens = [];
  // The clock each run reads, restated per stage: a second stage is the same loop five minutes later, which is
  // what "read the newest completed candle once" is judged against.
  let nowMs = start + 90 * 1000;
  const spawn = (command, args) => {
    const action = String(args[1] || "");
    const map = {};
    for (let index = 0; index < args.length; index += 1) {
      const token = String(args[index]);
      if (!token.startsWith("--")) continue;
      const next = args[index + 1];
      map[token] = index + 1 < args.length && !String(next).startsWith("--") ? next : true;
    }
    if (action === "open") opens.push(map);
    const record = {
      at_utc: new Date(nowMs).toISOString(),
      tool: trader.ORDER_TOOL_RELATIVE,
      action,
      account: { login_masked: "***841", server: "FTMO-Server3", balance: 10000, equity: 10000, positions_open: 0, orders_open: 0 },
      ticket_filter: null,
      positions: [],
      orders: [],
      identity: { login_masked: "***841", server: "FTMO-Server3", terminal_path: "C:\\stub\\terminal64.exe" },
      answer: { sent: true, retcode: 10009, retcode_name: "TRADE_RETCODE_DONE", done: true, deal: 7000001, order: 7000002, volume: 0.1, price: null, comment: null, filling_mode: null, request_id: null },
      attempts: 1
    };
    if (action === "status") delete record.answer;
    return { status: 0, stdout: `${action.toUpperCase()} stub\n${JSON.stringify(record)}\n`, stderr: "" };
  };

  const stageList = stages || Array.from({ length: repeats }, () => ({ closes, overrides, symbol }));
  const results = [];
  for (const stage of stageList) {
    const feed = feedFixture({
      lane,
      closes: stage.closes,
      overrides: stage.overrides || {},
      stoppedOut,
      start,
      exitAtMs,
      symbol: stage.symbol ?? symbol
    });
    fs.writeFileSync(path.join(dir, "live-trading.json"), JSON.stringify(feed), "utf8");
    nowMs = stage.nowMs ?? start + stage.closes.length * BAR_MS + 90 * 1000;
    opens = [];
    const run = trader.runOnce(options, { spawn, now: () => nowMs });
    const placement = (run.record.placements || []).find(row => row.sent === true) || null;
    results.push({
      status: run.record.status,
      placement,
      opens,
      reason: (run.record.rule?.rows || [])[0]?.reason || run.record.reason || null,
      rule: (run.record.rule?.rows || [])[0] || null,
      trade: (run.record.trades?.rows || [])[0] || null
    });
  }
  return { results, dir, options };
}

function expectedTicket(lane, side) {
  if (side === "long") return { side, entry: LEVEL, stop: lane.stop, target: lane.target };
  const half = lane.name === "ftmo-2";
  return { side, entry: LEVEL, stop: half ? 101.666667 : 102, target: half ? 95 : 90 };
}

function assertTicket(lane, result, side) {
  assert.ok(result.placement, `expected a ticket, got ${result.status}: ${result.reason}`);
  assert.deepEqual(
    { side: result.placement.side, entry: result.placement.entry, stop: result.placement.stop, target: result.placement.target },
    expectedTicket(lane, side)
  );
  const open = result.opens.find(row => row["--entry-price"] !== undefined);
  assert.ok(open, "the order tool was asked to open");
  assert.equal(open["--entry-price"], String(LEVEL));
  assert.equal(open["--side"], side === "long" ? "buy" : "sell");
}

function assertNothing(result) {
  assert.equal(result.placement, null, `expected no order, got ${result.placement?.side}@${result.placement?.entry}`);
}

// The owner's cases, one row each, on both lanes - a fresh entry and the same closes after a stop-out. Every row
// is judged at the fixed level 100, on one symbol, in one session, and the close the rule reads is always the
// newest completed one.
const CASES = [
  { id: "a reclaim price had already left: 102, 99, 98, 101", closes: [102, 99, 98, 101], direction: "BULLISH", side: "long" },
  {
    id: "the owner's valid one, the excursion bar then a close on the line: 102, 99, 100, 101",
    closes: [102, 99, 100, 101],
    direction: "BULLISH",
    side: "long"
  },
  { id: "several closes beyond first: 102, 103, 99, 98, 101", closes: [102, 103, 99, 98, 101], direction: "BULLISH", side: "long" },
  {
    id: "a touch with no excursion: 102, 100, 101 buys nothing",
    closes: [102, 100, 101],
    direction: "BULLISH",
    side: null
  },
  { id: "no earlier close above: 99, 98, 101", closes: [99, 98, 101], direction: "BULLISH", side: null },
  { id: "the mirror, a reclaim price had already left: 98, 101, 102, 99", closes: [98, 101, 102, 99], direction: "BEARISH", side: "short" },
  {
    id: "the mirror of the owner's valid one: 98, 101, 100, 99",
    closes: [98, 101, 100, 99],
    direction: "BEARISH",
    side: "short"
  },
  { id: "the mirror with several closes beyond first: 98, 97, 101, 102, 99", closes: [98, 97, 101, 102, 99], direction: "BEARISH", side: "short" },
  {
    id: "the mirror of a touch with no excursion: 98, 100, 99 sells nothing",
    closes: [98, 100, 99],
    direction: "BEARISH",
    side: null
  },
  { id: "the mirror with no earlier close below: 101, 102, 99", closes: [101, 102, 99], direction: "BEARISH", side: null },
  { id: "a wick through 100 is not a close beyond it", closes: [102, 99, 98, 99.4], overrides: { 3: { high: 101.5 } }, direction: "BULLISH", side: null },
  { id: "a close on 100 confirms nothing: 102, 99, 100", closes: [102, 99, 100], direction: "BULLISH", side: null },
  { id: "a return across 110 leaves nothing at 100", closes: [102, 99, 98, 111], direction: "BULLISH", side: null }
];

for (const lane of [LANE1, LANE2]) {
  for (const testCase of CASES) {
    test(`${lane.name} fresh entry: ${testCase.id}`, () => {
      const run = runCase({ lane, ...testCase });
      if (testCase.side) assertTicket(lane, run.results[0], testCase.side);
      else assertNothing(run.results[0]);
    });

    test(`${lane.name} after a stop-out at the same level: ${testCase.id}`, () => {
      const run = runCase({ lane, ...testCase, stoppedOut: true });
      if (testCase.side) assertTicket(lane, run.results[0], testCase.side);
      else assertNothing(run.results[0]);
    });
  }

  test(`${lane.name} places nothing when the same confirming bar comes round twice`, () => {
    const run = runCase({ lane, closes: [102, 99, 98, 101], direction: "BULLISH", repeats: 2 });
    assertTicket(lane, run.results[0], "long");
    assertNothing(run.results[1]);
  });

  test(`${lane.name} reads the newest completed candle once: the reclaim places, the bar after it does not`, () => {
    // The 13:46Z shape of 2026-11-13: the reclaiming candle is the newest completed one when the run happens, and
    // five minutes later the level has a close on each side of it that crossed nothing.
    const run = runCase({
      lane,
      direction: "BULLISH",
      stages: [
        { closes: [102, 99, 98, 101] },
        { closes: [102, 99, 98, 101, 100.5] }
      ]
    });
    assertTicket(lane, run.results[0], "long");
    assertNothing(run.results[1]);
  });

  test(`${lane.name} names the missing leg in its own words`, () => {
    const held = runCase({ lane, closes: [99, 98, 101], direction: "BULLISH" });
    assert.match(held.results[0].reason, /no earlier M5 candle in this session had finished above 100 first/);
    const touched = runCase({ lane, closes: [102, 100, 101], direction: "BULLISH" });
    assert.match(touched.results[0].reason, /the level was approached and touched but never left/);
  });

  test(`${lane.name} refuses a reading whose three legs do not name one symbol`, () => {
    const oneSymbol = runCase({ lane, closes: [102, 99, 98, 101], direction: "BULLISH", symbol: "US100.cash" });
    assertTicket(lane, oneSymbol.results[0], "long");
    const twoSymbols = runCase({
      lane,
      closes: [102, 99, 98, 101],
      direction: "BULLISH",
      symbol: "US100.cash",
      overrides: { 1: { symbol: "GER40.cash" } }
    });
    assertNothing(twoSymbols.results[0]);
    assert.match(twoSymbols.results[0].reason, /do not all name US100\.cash/);
  });

  test(`${lane.name} does not put a level back on a close that finished before the exit`, () => {
    const run = runCase({
      lane,
      closes: [102, 99, 98, 101],
      direction: "BULLISH",
      stoppedOut: true,
      exitAtMs: START + 4 * BAR_MS
    });
    assertNothing(run.results[0]);
  });
}

// The three legs have to be one session's. The loop counts its day in Europe/Prague, where midnight is 23:00Z in
// November, so the same closes read across that boundary are two sessions' evidence and are refused.
const SESSION_START = Date.parse("2026-11-12T22:45:00Z");
test("the confirming close has to be in the same session as the legs it is judged on", () => {
  for (const lane of [LANE1, LANE2]) {
    const acrossMidnight = runCase({ lane, closes: [102, 99, 98, 101], direction: "BULLISH", start: SESSION_START });
    assertNothing(acrossMidnight.results[0]);
    assert.match(acrossMidnight.results[0].reason, /cannot both be placed in one trading session/);
    const insideTheSession = runCase({ lane, closes: [102, 99, 98, 101], direction: "BULLISH" });
    assertTicket(lane, insideTheSession.results[0], "long");
  }
});

// Without the flags the loop is the deployed behaviour: the same bars that now leave nothing still place a ticket.
// This is the before half of the audit, kept in the suite so the change cannot be mistaken for a description.
test("without --require-deviation the first approach from below still places, which is the deployed behaviour", () => {
  const run = runCase({ lane: LANE1, closes: [99, 98, 101], direction: "BULLISH", flags: [] });
  assertTicket(LANE1, run.results[0], "long");
});

// The deviation rule cannot be answered from a replayed bar, so asking for it reads the crossing on the put-back
// path as --reentry-crossing does: the level is not put back while the newest close is still on the far side, and
// it is put back on the newest completed reclaim candle.
test("lane 1 with only --require-deviation reads the newest completed candle on a put-back too", () => {
  const stillBeyond = runCase({ lane: LANE1, closes: [102, 99, 98], direction: "BULLISH", stoppedOut: true, flags: ["--require-deviation"] });
  assertNothing(stillBeyond.results[0]);
  const reclaimed = runCase({ lane: LANE1, closes: [102, 99, 98, 101], direction: "BULLISH", stoppedOut: true, flags: ["--require-deviation"] });
  assertTicket(LANE1, reclaimed.results[0], "long");
});

// The helper on its own, so the boundary cases are stated once rather than only through a run.
test("levelWasLeft: three legs, one level, one session", () => {
  const session = strategy.tradingSessionKey(START);
  assert.equal(session, "2026-11-13");
  const read = (closes, options = {}) => strategy.levelWasLeft({
    side: "long",
    level: LEVEL,
    bars: bars(closes, options.overrides || {}, { symbol: options.symbol }),
    beforeIndex: closes.length,
    point: 0.01,
    sessionKey: session,
    symbol: options.readAs ?? null
  });

  const held = read([102, 99, 98]);
  assert.equal(held.left, true);
  assert.equal(held.close, 102, "the close that held the level");
  assert.equal(held.bar.time_utc, new Date(START).toISOString());
  assert.equal(held.excursion.close, 98, "the close that left it");
  assert.equal(held.session, session);

  assert.equal(read([102, 100]).left, false, "no excursion: a close on the line leaves nothing behind");
  assert.equal(read([102, 100]).missing, "excursion");
  assert.equal(read([99, 98]).left, false, "no hold: price only ever approached from below");
  assert.equal(read([99, 98]).missing, "held");
  assert.equal(read([102, 99, 98], { symbol: "US100.cash" }).missing, "symbol", "a named bar read without a named symbol");
  assert.equal(
    read([102, 99, 98], { symbol: "US100.cash", readAs: "US100.cash" }).left,
    true,
    "naming the one instrument the legs are on is not a mismatch"
  );
  assert.equal(
    read([102, 99, 98], { symbol: "GER40.cash", readAs: "US100.cash" }).missing,
    "symbol",
    "another instrument's closes are not this pair's excursion"
  );
  assert.equal(
    strategy.levelWasLeft({ side: "long", level: LEVEL, bars: bars([102, 99, 98]), beforeIndex: 3, point: 0.01 }).missing,
    "session",
    "a reading with no session stated is refused rather than assumed"
  );

  const wick = strategy.levelWasLeft({
    side: "long",
    level: LEVEL,
    bars: [{ time_utc: "2026-11-13T08:00:00Z", open: 99, high: 103, low: 98, close: 99.2 },
      { time_utc: "2026-11-13T08:05:00Z", open: 99.2, high: 99.4, low: 98.8, close: 99 }],
    beforeIndex: 2,
    point: 0.01,
    sessionKey: session
  });
  assert.equal(wick.left, false, "a wick is not a close");

  const mirror = strategy.levelWasLeft({
    side: "short",
    level: LEVEL,
    bars: bars([98, 101, 102]),
    beforeIndex: 3,
    point: 0.01,
    sessionKey: session
  });
  assert.equal(mirror.left, true);
  assert.equal(mirror.close, 98);
  assert.equal(mirror.excursion.close, 102);
});

test("a session key is the loop's own trading day, in Europe/Prague", () => {
  assert.equal(strategy.SESSION_TIMEZONE, "Europe/Prague");
  assert.equal(strategy.tradingSessionKey(Date.parse("2026-11-12T22:59:00Z")), "2026-11-12");
  assert.equal(strategy.tradingSessionKey(Date.parse("2026-11-12T23:00:00Z")), "2026-11-13");
  assert.equal(strategy.tradingSessionKey(Number.NaN), null);
  assert.equal(strategy.tradingSessionKey(null), null);
});


