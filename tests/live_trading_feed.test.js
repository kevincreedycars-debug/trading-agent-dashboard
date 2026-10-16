// Contract tests for the Live Trading feed artifact and its dashboard wiring.
// The feed is the only live broker surface on the dashboard, so the read-only boundary is asserted
// here rather than left to review.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SCHEMA_VERSION,
  EXPECTED_INSTRUMENTS,
  TIMEFRAMES,
  MAX_FRESH_BAR_AGE_SECONDS,
  MAX_FRESH_M5_BAR_AGE_SECONDS,
  validateLiveTradingFeed
} = require("../scripts/validate_live_trading_feed.js");

const root = path.resolve(__dirname, "..");
const feedPath = path.join(root, "data", "live-trading.json");
const producerPath = path.join(root, "tools", "mt5-bridge", "live-trading-snapshot.py");
const STAMP = "2026-09-30T13:53:00+00:00";

// One timeframe block, in the shape the producer writes for every timeframe it publishes: the compact
// close-only view the cards render, the newest close, and the freshness proof. OHLC `bars` are added
// by the tests that are about bars.
function buildTimeframeBlock(close, overrides = {}) {
  return {
    candle_count: 2,
    close_series: [
      { time_server: STAMP, time_utc: STAMP, close, direction: "flat" },
      { time_server: STAMP, time_utc: STAMP, close: close + 1, direction: "up" }
    ],
    last_close: { time_server: STAMP, time_utc: STAMP, open: close, high: close + 2, low: close - 1, close: close + 1 },
    change_points: 1,
    change_pct: 1,
    direction: "up",
    bar_age_seconds: 120,
    refresh_attempts: 1,
    stale: false,
    ...overrides
  };
}

function buildInstrument(symbol, dashboardAsset, digits, point) {
  return {
    symbol,
    dashboard_asset: dashboardAsset,
    available: true,
    description: `${symbol} test fixture`,
    digits,
    point,
    contract_size: 1,
    min_lot: 0.01,
    lot_step: 0.01,
    stops_level: 0,
    quote: {
      bid: 100,
      ask: 100 + point,
      spread_price: point,
      spread_points: 1,
      time_server: STAMP,
      time_utc: STAMP,
      market_state: "quoting"
    },
    m5: buildTimeframeBlock(100),
    // The zoomed-out views the L2L seed levels are marked on. They carry the same block shape, so the
    // chart draws them the same way and only the bar width differs.
    h1: buildTimeframeBlock(101),
    h4: buildTimeframeBlock(102)
  };
}

function buildFeed(overrides = {}) {
  const instruments = [
    buildInstrument("EURUSD", "EUR", 5, 0.00001),
    buildInstrument("XAUUSD", "GOLD", 2, 0.01),
    buildInstrument("US100.cash", "NQ", 2, 0.01),
    buildInstrument("BTCUSD", "BTC", 2, 0.01)
  ];
  return {
    schema_version: SCHEMA_VERSION,
    generated_at_utc: "2026-09-30T13:53:00+00:00",
    time_server: "2026-09-30T16:53:00+00:00",
    server_offset_seconds: 10800,
    stale_after_seconds: 900,
    read_only: true,
    order_functions_called: false,
    terminal: { connected: true, build: 6231, trade_allowed: true },
    account: {
      login_masked: "***614",
      server: "FTMO-Server",
      currency: "USD",
      leverage: 30,
      balance: 10000,
      equity: 10000,
      margin_free: 10000,
      positions_open: 0,
      orders_open: 0
    },
    // v3: what has already been executed, read back so it can be seen rather than taken on trust. v4 adds
    // the working pending orders beside them, because a ticket left as a limit is neither a position nor a
    // closed trade.
    execution_note: "This snapshot places nothing; a trade comes from tools/mt5-bridge/live-trading-order.py.",
    orders: [],
    positions: [],
    closed_trades: [],
    history: {
      window_days: 14,
      from_server: "2026-09-16T16:53:00+00:00",
      from_utc: "2026-09-16T13:53:00+00:00",
      to_utc: "2026-09-30T13:53:00+00:00",
      deal_count: 1,
      closed_positions: 0,
      source: "history_deals_get",
      note: "Deals, not trades: paired by position_id."
    },
    instrument_count: instruments.length,
    instruments,
    ...overrides
  };
}

// One open position, in the shape the producer writes: the trade's own facts, both clocks, and the counts
// the table renders.
function buildPosition(overrides = {}) {
  return {
    ticket: 277652601,
    symbol: "BTCUSD",
    dashboard_asset: "BTC",
    side: "buy",
    volume: 0.01,
    price_open: 85000,
    price_current: 85100,
    stop_loss: null,
    take_profit: null,
    profit: 1,
    swap: 0,
    floating_pct: 0.1176,
    magic: 20261004,
    comment: "live-trading-loop-proof",
    opened: { time_server: STAMP, time_utc: STAMP },
    updated: { time_server: STAMP, time_utc: STAMP },
    ...overrides
  };
}

// One working pending order, in the shape the producer writes: the level it sits at, the stop and the
// target it carries, the clock it was placed on, and the magic that says which lane left it.
function buildOrder(overrides = {}) {
  return {
    ticket: 278466201,
    symbol: "US100.cash",
    dashboard_asset: "NQ",
    type: "ORDER_TYPE_BUY_LIMIT",
    side: "buy",
    volume: 0.01,
    price_open: 30774.61,
    stop_loss: 30719.646,
    take_profit: 31049.43,
    magic: 20261004,
    comment: "l2l-rule-nq",
    placed: { time_server: STAMP, time_utc: STAMP },
    expiration: null,
    ...overrides
  };
}

// One closed position, paired out of its entry and exit deals.
function buildClosedTrade(overrides = {}) {
  return {
    position_id: 987654321,
    symbol: "BTCUSD",
    dashboard_asset: "BTC",
    side: "buy",
    volume: 0.01,
    price_open: 85000,
    price_close: 85100,
    profit: 1,
    commission: -0.5,
    swap: 0,
    net_profit: 0.5,
    magic: 20261004,
    comment: "live-trading-loop-proof",
    deal_count: 2,
    entry_deal: 5550001,
    exit_deal: 5550002,
    opened: { time_server: STAMP, time_utc: STAMP },
    closed: { time_server: "2026-09-30T16:54:00+00:00", time_utc: "2026-09-30T13:54:00+00:00" },
    duration_seconds: 60,
    ...overrides
  };
}

// A snapshot of an account holding one position, with one trade already closed inside the window.
function buildFeedWithTrade(overrides = {}) {
  const feed = buildFeed(overrides);
  feed.account.positions_open = 1;
  feed.positions = [buildPosition()];
  feed.closed_trades = [buildClosedTrade()];
  feed.history.closed_positions = 1;
  return feed;
}

// A snapshot of an account whose only ticket is a limit resting under the market: the shape the L2L lane
// leaves behind between a stop-out and the retrace back to the trade's own level.
function buildFeedWithWorkingOrder(overrides = {}) {
  const feed = buildFeed(overrides);
  feed.account.orders_open = 1;
  feed.orders = [buildOrder()];
  return feed;
}

test("accepts a well-formed snapshot", () => {
  assert.deepEqual(validateLiveTradingFeed(buildFeed()), []);
});

test("accepts the committed broker snapshot and covers all four instruments", () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  assert.deepEqual(validateLiveTradingFeed(feed), []);
  assert.deepEqual(
    feed.instruments.map((instrument) => instrument.symbol),
    EXPECTED_INSTRUMENTS.map((expected) => expected.symbol)
  );
});

test("rejects a feed that claims anything other than a read-only snapshot", () => {
  assert.match(validateLiveTradingFeed(buildFeed({ read_only: false })).join("\n"), /read_only must be true/);
  assert.match(validateLiveTradingFeed(buildFeed({ order_functions_called: true })).join("\n"), /order_functions_called must be false/);
});

test("rejects a raw login in the published feed", () => {
  const feed = buildFeed();
  feed.account.login = 15123614;
  const errors = validateLiveTradingFeed(feed).join("\n");
  assert.match(errors, /must not carry a raw credential field: login/);
});

test("rejects a feed that drops one of the four instruments", () => {
  const feed = buildFeed();
  feed.instruments = feed.instruments.filter((instrument) => instrument.symbol !== "BTCUSD");
  feed.instrument_count = feed.instruments.length;
  assert.match(validateLiveTradingFeed(feed).join("\n"), /Missing expected instrument: BTCUSD/);
});

test("rejects a stale last_close that disagrees with the close series", () => {
  const feed = buildFeed();
  feed.instruments[0].m5.last_close.time_utc = "2026-09-30T13:20:00+00:00";
  assert.match(validateLiveTradingFeed(feed).join("\n"), /is not the last entry of m5.close_series/);
});

test("rejects an m5 block that hides how old its bars are", () => {
  const feed = buildFeed();
  delete feed.instruments[0].m5.bar_age_seconds;
  delete feed.instruments[0].m5.stale;
  const errors = validateLiveTradingFeed(feed).join("\n");
  assert.match(errors, /requires a non-negative integer m5\.bar_age_seconds/);
  assert.match(errors, /requires a boolean m5\.stale/);
});

test("rejects bars claimed current when they are hours old", () => {
  const feed = buildFeed();
  feed.instruments[1].m5.bar_age_seconds = 17100; // 4h45m, the lag observed on 2026-09-30
  assert.match(
    validateLiveTradingFeed(feed).join("\n"),
    /claims m5\.stale false with bars 17100s old \(limit 660s\)/
  );
});

test("accepts bars exactly at the freshness limit and rejects one second past it", () => {
  const atLimit = buildFeed();
  atLimit.instruments[0].m5.bar_age_seconds = MAX_FRESH_M5_BAR_AGE_SECONDS;
  assert.deepEqual(validateLiveTradingFeed(atLimit), []);

  const pastLimit = buildFeed();
  pastLimit.instruments[0].m5.bar_age_seconds = MAX_FRESH_M5_BAR_AGE_SECONDS + 1;
  assert.match(validateLiveTradingFeed(pastLimit).join("\n"), /claims m5\.stale false with bars/);
});

test("rejects a stale M5 series that does not explain itself", () => {
  const feed = buildFeed();
  feed.instruments[1].m5.bar_age_seconds = 17100;
  feed.instruments[1].m5.stale = true;
  assert.match(validateLiveTradingFeed(feed).join("\n"), /has stale M5 bars and must carry a note explaining the lag/);
});

test("accepts a stale M5 series that states its lag instead of hiding it", () => {
  const feed = buildFeed();
  const m5 = feed.instruments[1].m5;
  m5.bar_age_seconds = 17100;
  m5.stale = true;
  m5.refresh_attempts = 6;
  m5.note = "The newest XAUUSD M5 bar is 285 minutes behind the live tick after 6 request(s).";
  assert.deepEqual(validateLiveTradingFeed(feed), []);
});

test("the producer records the M5 freshness proof and retries the terminal sync", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  assert.match(source, /"bar_age_seconds": bar_age/);
  assert.match(source, /"refresh_attempts": attempts/);
  assert.match(source, /"stale": stale/);
  assert.match(source, /for attempt in range\(1, M5_REFRESH_ATTEMPTS \+ 1\)/);
});

test("the producer and the validator share one M5 freshness limit", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  const match = source.match(/^M5_BAR_STALE_SECONDS = (\d+)$/m);
  assert.ok(match, "producer must declare M5_BAR_STALE_SECONDS");
  assert.equal(Number(match[1]), MAX_FRESH_M5_BAR_AGE_SECONDS);
});

test("rejects an inverted quote", () => {
  const feed = buildFeed();
  feed.instruments[0].quote.ask = 99;
  assert.match(validateLiveTradingFeed(feed).join("\n"), /ask below its bid/);
});

test("rejects an offline snapshot that explains nothing", () => {
  const feed = buildFeed({ instruments: [], instrument_count: 0 });
  assert.match(validateLiveTradingFeed(feed).join("\n"), /must carry a note explaining the failure/);
  assert.deepEqual(validateLiveTradingFeed(buildFeed({ instruments: [], instrument_count: 0, note: "no terminal" })), []);
});

test("the producer touches only read-only MT5 functions", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  const allowed = new Set([
    "initialize",
    "shutdown",
    "last_error",
    "terminal_info",
    "account_info",
    "symbol_info",
    "symbol_info_tick",
    "copy_rates_from_pos",
    "positions_get",
    "orders_get",
    // v3: the read-back. `history_deals_get` reads what was already executed, and the constants are the
    // enum values saying which deal is an entry and which way one faced. None of them is a call that sends.
    "history_deals_get",
    // The stop and the target a closed position carried are booked on its orders, not on its deals, so the
    // position's own order history is read once per closed trade. Reading history is not sending.
    "history_orders_get",
    "DEAL_ENTRY_IN",
    "DEAL_ENTRY_OUT",
    "DEAL_ENTRY_OUT_BY",
    "DEAL_TYPE_BUY",
    "DEAL_TYPE_SELL",
    "POSITION_TYPE_BUY",
    "POSITION_TYPE_SELL",
    // v4: the working orders. These are the enum values saying which side a pending order faces, read to
    // publish the level it is working at; an order's *name* comes from walking the module's own constants,
    // which is a string comparison rather than a call.
    "ORDER_TYPE_BUY",
    "ORDER_TYPE_BUY_LIMIT",
    "ORDER_TYPE_BUY_STOP",
    "__version__",
    "TIMEFRAME_M5",
    "TIMEFRAME_H1",
    "TIMEFRAME_H4"
  ]);
  const used = [...source.matchAll(/\bmt5\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]);
  assert.ok(used.length > 0, "producer must call the MT5 package");
  for (const name of new Set(used)) {
    assert.ok(allowed.has(name), `producer used a non-allowlisted MT5 function: ${name}`);
  }
  // Reading history is not sending: no call that could place, change or close anything may appear here, and
  // the one file that may is asserted to be the only one in tests/live_trading_order_tool.test.js.
  for (const name of ["order_send", "order_check", "positions_close", "positions_modify", "order_close", "order_cancel"]) {
    assert.equal(new RegExp(`\\b${name}\\s*\\(`).test(source), false, `the producer must not call ${name}`);
  }
  assert.match(source, /"read_only": True/);
  assert.match(source, /"order_functions_called": False/);
});

test("accepts a snapshot that reads back an open position and a closed trade", () => {
  assert.deepEqual(validateLiveTradingFeed(buildFeedWithTrade()), []);
});

test("accepts a snapshot whose only ticket is a working pending order", () => {
  assert.deepEqual(validateLiveTradingFeed(buildFeedWithWorkingOrder()), []);
});

test("the read-back is what the producer writes, not a block the reader has to trust", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  // The window is declared, the closed trades come out of the deal history, and the report carries all of it.
  assert.match(source, /^HISTORY_WINDOW_DAYS = (\d+)$/m);
  assert.match(source, /def build_positions\(rows, offset_seconds\):/);
  assert.match(source, /def build_closed_trades\(deals, offset_seconds, levels=None\):/);
  assert.match(source, /mt5\.history_deals_get\(start, server_now\)/);
  // The stop and the target a closed position carried are booked on the order rather than the deal, so they
  // come from the position's own order history and stay unstated when that read cannot answer.
  assert.match(source, /def read_position_levels\(position_ids\):/);
  assert.match(source, /mt5\.history_orders_get\(position=position_id\)/);
  assert.match(source, /levels = read_position_levels\(\{int\(deal\.position_id\) for deal in deals or \(\)\}\)/);
  // A position closed by another position is an exit too, not a deal to drop.
  assert.match(source, /DEAL_ENTRY_OUT, mt5\.DEAL_ENTRY_OUT_BY/);
  assert.match(source, /"positions": positions/);
  assert.match(source, /"closed_trades": closed_trades/);
  assert.match(source, /"history": history/);
  assert.match(source, /"execution_note":/);
});

test("rejects an account whose position count disagrees with the rows beside it", () => {
  const feed = buildFeedWithTrade();
  feed.account.positions_open = 2;
  assert.match(
    validateLiveTradingFeed(feed).join("\n"),
    /account\.positions_open \(2\) must equal the number of entries in positions \(1\)/
  );
});

test("rejects an account whose working-order count disagrees with the rows beside it", () => {
  const feed = buildFeedWithWorkingOrder();
  feed.account.orders_open = 0;
  assert.match(
    validateLiveTradingFeed(feed).join("\n"),
    /account\.orders_open \(0\) must equal the number of entries in orders \(1\)/
  );
});

test("rejects a snapshot that publishes no orders block at all", () => {
  const feed = buildFeed();
  delete feed.orders;
  assert.match(validateLiveTradingFeed(feed).join("\n"), /orders must be an array, empty when nothing is working/);
});

test("rejects a working order that could not be a ticket at a level", () => {
  const level = buildFeedWithWorkingOrder();
  level.orders[0].price_open = 0;
  assert.match(validateLiveTradingFeed(level).join("\n"), /order #278466201 requires a positive price_open/);

  const side = buildFeedWithWorkingOrder();
  side.orders[0].side = "long";
  assert.match(validateLiveTradingFeed(side).join("\n"), /order #278466201 requires side buy or sell/);

  const type = buildFeedWithWorkingOrder();
  type.orders[0].type = "";
  assert.match(validateLiveTradingFeed(type).join("\n"), /order #278466201 requires an order type/);

  // A level with no clock is a ticket the page cannot place against the bars beside it.
  const clock = buildFeedWithWorkingOrder();
  delete clock.orders[0].placed;
  assert.match(validateLiveTradingFeed(clock).join("\n"), /order #278466201 requires placed\.time_utc/);

  // An expiry is either absent and written as null, or a real pair of clocks.
  const expiry = buildFeedWithWorkingOrder();
  expiry.orders[0].expiration = { time_utc: STAMP };
  assert.match(validateLiveTradingFeed(expiry).join("\n"), /order #278466201 expiration must be null or carry both clocks/);
});

test("the working orders are read back by the producer, not invented by the page", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  assert.match(source, /def build_orders\(rows, offset_seconds\):/);
  assert.match(source, /def build_order\(row, offset_seconds\):/);
  // The level, the two levels attached to it and the moment it was placed: the four facts the L2L panel
  // states as the trade's own entry, stop, target and working since.
  assert.match(source, /"price_open": float\(row\.price_open\)/);
  assert.match(source, /"placed": stamp\(row\.time_setup, offset_seconds\)/);
  assert.match(source, /"expiration": stamp\(expiration, offset_seconds\) if expiration else None/);
  // The order's name, so the feed and the terminal's own journal agree on what kind of ticket it is.
  assert.match(source, /def order_type_name\(value\):/);
  assert.match(source, /name\.startswith\("ORDER_TYPE_"\)/);
  assert.match(source, /orders = build_orders\(order_rows, offset_seconds\)/);
  assert.match(source, /"orders": orders/);
  // An order with no expiry of its own is written as null rather than as the epoch.
  assert.match(source, /expiration = int\(row\.time_expiration\) if int\(row\.time_expiration or 0\) else None/);
});

test("rejects a position that hides the clock it opened on", () => {
  const opened = buildFeedWithTrade();
  delete opened.positions[0].opened;
  assert.match(validateLiveTradingFeed(opened).join("\n"), /position #277652601 requires opened\.time_utc/);

  const updated = buildFeedWithTrade();
  delete updated.positions[0].updated;
  assert.match(validateLiveTradingFeed(updated).join("\n"), /position #277652601 requires updated\.time_server/);
});

test("rejects a position whose side or size could not be a trade", () => {
  const side = buildFeedWithTrade();
  side.positions[0].side = "long";
  assert.match(validateLiveTradingFeed(side).join("\n"), /position #277652601 requires side buy or sell/);

  const size = buildFeedWithTrade();
  size.positions[0].volume = 0;
  assert.match(validateLiveTradingFeed(size).join("\n"), /position #277652601 requires a positive volume/);
});

test("rejects a closed trade whose net disagrees with its own parts", () => {
  const feed = buildFeedWithTrade();
  feed.closed_trades[0].net_profit = 0.75;
  assert.match(
    validateLiveTradingFeed(feed).join("\n"),
    /closed trade #987654321 net_profit \(0\.75\) must be profit plus commission plus swap \(0\.5\)/
  );
});

test("rejects a closed trade that closed before it opened", () => {
  const feed = buildFeedWithTrade();
  feed.closed_trades[0].closed.time_utc = "2026-09-30T13:00:00+00:00";
  assert.match(validateLiveTradingFeed(feed).join("\n"), /closed trade #987654321 closed before it opened/);
});

test("rejects a closed trade that was never paired out of two deals", () => {
  const feed = buildFeedWithTrade();
  feed.closed_trades[0].deal_count = 1;
  assert.match(validateLiveTradingFeed(feed).join("\n"), /closed trade #987654321 requires deal_count of at least 2/);
});

test("rejects a snapshot that does not say which window its closed trades cover", () => {
  const missing = buildFeedWithTrade();
  delete missing.history;
  assert.match(validateLiveTradingFeed(missing).join("\n"), /history must be an object describing the closed-trade window/);

  const disagreeing = buildFeedWithTrade();
  disagreeing.history.closed_positions = 4;
  assert.match(
    validateLiveTradingFeed(disagreeing).join("\n"),
    /history\.closed_positions \(4\) must equal the number of entries in closed_trades \(1\)/
  );
});

test("rejects a snapshot that does not say where an executed trade could have come from", () => {
  const feed = buildFeedWithTrade();
  delete feed.execution_note;
  assert.match(
    validateLiveTradingFeed(feed).join("\n"),
    /execution_note must state that this snapshot places nothing and name where a trade can come from/
  );
});

test("the producer measures the server offset from the freshest tick, not the first instrument", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  // A tick's epoch minus the real clock is the true offset minus that tick's own staleness, so a shut
  // instrument under-reports it. Reading the first instrument was wrong on 2026-10-03 (a Saturday):
  // EURUSD's Friday close measured -52200s and BTCUSD's live weekend tick measured the true +10800s.
  assert.match(source, /freshest_raw/, "the offset must come from the freshest tick available");
  assert.match(source, /FTMO_SERVER_OFFSET_SECONDS/, "an unreadable measurement must fall back to the documented FTMO offset");
  assert.equal(/return symbol, int\(round\(raw/.test(source), false, "the first instrument's tick must not be trusted on its own");
});

test("the dashboard exposes the live section and loads the feed", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(html, /data-tab="live-trading"/);
  assert.match(html, /id="liveTradingView"/);
  assert.match(html, /id="liveTradingPanel"/);
  assert.match(script, /const liveTradingUrl = "\.\/data\/live-trading\.json/);
  assert.match(script, /function renderLiveTrading\(data\)/);
  assert.match(script, /if \(activeTab === "live-trading"\) renderLiveTrading\(liveTradingData \|\| \{\}\);/);
  assert.match(script, /fetchLocalJson\(liveTradingUrl\)/);
  assert.match(script, /5M STALE/);
  assert.match(script, /live-trading-alert/);
  assert.match(css, /\.live-trading-grid/);
  assert.match(css, /\.live-trading-alert/);
  // The read-back is rendered, not left in the artifact: both tables are drawn from the snapshot's own
  // positions and closed trades, and each one is called by the section's single render.
  assert.match(script, /function liveTradingPositions\(data\) \{/);
  assert.match(script, /function liveTradingClosedTrades\(data\) \{/);
  assert.match(script, /\$\{liveTradingPositions\(data\)\}/);
  assert.match(script, /\$\{liveTradingClosedTrades\(data\)\}/);
  assert.match(script, /data\?\.positions/);
  assert.match(script, /data\?\.closed_trades/);
  assert.match(script, /<h3>Open positions<\/h3>/);
  assert.match(script, /<h3>Closed trades<\/h3>/);
  // The closed-trades table states both clocks with their own date: a trade read over a fourteen-day window
  // can open and close on different days, and a bare `HH:MMZ` cannot place it on one. The helper is named
  // here so the two timestamp cells stay the ones the date is drawn from rather than some nearby string.
  assert.match(script, /function liveTradingDateTimeLabel\(value\) \{/);
  assert.match(script, /<th scope="col">Opened \(UTC\)<\/th>\s*<th scope="col">Closed \(UTC\)<\/th>/);
  assert.match(script, /liveTradingDateTimeLabel\(trade\?\.opened\?\.time_utc\)/);
  assert.match(script, /liveTradingDateTimeLabel\(trade\?\.closed\?\.time_utc\)/);
  assert.match(css, /\.live-trading-table-panel/);
  assert.match(css, /\.live-trading-table-scroll/);
  assert.match(css, /\.live-trading-table \.positive/);
  assert.match(css, /\.live-trading-side\.sell/);
});

test("the live section states that it cannot trade", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  assert.match(script, /This section has no order code/);
  assert.match(script, /not a validated profit rule/);
});

test("the producer publishes full OHLC bars for the mirrored chart", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  // The chart draws candles, not a close line, so the M5 block has to carry open/high/low/close.
  assert.match(source, /"bars": rows/);
  assert.match(source, /"bars": \[\]/);
  assert.match(source, /"tick_volume": int\(row\["tick_volume"\]\)/);
  const match = source.match(/^DEFAULT_CANDLES = (\d+)$/m);
  assert.ok(match, "producer must declare DEFAULT_CANDLES");
  assert.ok(Number(match[1]) >= 24, "the published chart needs more than a couple of hours of bars");
});

test("accepts OHLC bars and rejects candles that could not exist", () => {
  const stamp = "2026-09-30T13:53:00+00:00";
  const feed = buildFeed();
  feed.instruments[0].m5.bars = [
    { time_server: stamp, time_utc: stamp, open: 100, high: 102, low: 99, close: 101 },
    { time_server: stamp, time_utc: stamp, open: 101, high: 103, low: 100, close: 101 }
  ];
  assert.deepEqual(validateLiveTradingFeed(feed), []);

  const impossible = buildFeed();
  impossible.instruments[0].m5.bars = [
    { time_server: stamp, time_utc: stamp, open: 100, high: 99, low: 98, close: 99 },
    { time_server: stamp, time_utc: stamp, open: 101, high: 103, low: 100, close: 101 }
  ];
  assert.match(
    validateLiveTradingFeed(impossible).join("\n"),
    /bars\[0\] has a high below its own open or close/
  );
});

test("rejects OHLC bars that disagree with the close-only view", () => {
  const stamp = "2026-09-30T13:53:00+00:00";
  const feed = buildFeed();
  feed.instruments[0].m5.bars = [
    { time_server: stamp, time_utc: stamp, open: 100, high: 102, low: 99, close: 101 }
  ];
  assert.match(
    validateLiveTradingFeed(feed).join("\n"),
    /m5\.candle_count that disagrees with m5\.bars length/
  );
});

test("a snapshot written before the chart existed still validates", () => {
  const feed = buildFeed();
  assert.equal("bars" in feed.instruments[0].m5, false);
  assert.deepEqual(validateLiveTradingFeed(feed), []);
});

test("the dashboard mirrors the MT5 candles in the live section", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(script, /function liveTradingChartShell\(data, ruleState = null\) \{/);
  assert.match(script, /function liveTradingChartPlot\(instrument, mode, timeframeKey, ruleReading = null\) \{/);
  assert.match(script, /\$\{liveTradingChartShell\(data, ruleState\)\}/);
  assert.match(script, /setupLiveTradingChart\(panel\);/);
  assert.match(script, /data-live-chart-symbol="\$\{escapeHtml\(instrument\.symbol\)\}"/);
  assert.match(script, /data-live-chart-mode="\$\{value\}"/);
  // The close-line fallback keeps the chart visible until the producer republishes with OHLC bars.
  assert.match(script, /OHLC not in this snapshot yet/);
  assert.match(script, /live-trading-chart-line/);
  // The L2L level overlay is drawn on the same price scale as the candles.
  assert.match(script, /live-trading-chart-level/);
  assert.match(css, /\.live-trading-chart-svg/);
  assert.match(css, /\.live-trading-chart-body\.up/);
  assert.match(css, /\.live-trading-chart-level-tag/);
});


test("the chart draws a volume pane under the price and labels both scales", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  // Volume rides in its own pane, scaled against the largest tick_volume in the snapshot. A snapshot
  // that carries no volume drops the pane instead of drawing a row of empty columns.
  assert.ok(script.includes("const volumeHeight = maxVolume > 0 ? 96 : 0;"));
  assert.ok(script.includes('class="live-trading-chart-volume ${up ? "up" : "down"}"'));
  assert.ok(script.includes("liveTradingVolumeLabel(maxVolume)"));
  assert.match(css, /\.live-trading-chart-volume\.up \{ fill: #26a69a;/);
  assert.match(css, /\.live-trading-chart-volume\.down \{ fill: #ef5350;/);
  assert.match(css, /\.live-trading-chart-separator \{/);

  // Both scales label round numbers: prices on the 1/2/2.5/5/10 ladder, time on whole bars.
  assert.ok(script.includes("const gridStep = liveTradingGridStep(max - min, 8);"));
  assert.ok(script.includes("const ticks = liveTradingTimeTicks(points);"));
  assert.match(css, /\.live-trading-chart-axis \{ fill: #787b86;/);
});

test("the chart marks the executed trades the snapshot read back", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  // The markers are placed from the read-back and from nothing else: the closed trades the snapshot carries
  // for the symbol on screen, each on the bar its own time falls in and at the price the terminal reported.
  assert.match(script, /function liveTradingChartTrades\(instrument, points, geometry, digits\) \{/);
  assert.ok(script.includes("liveTradingData.closed_trades.filter(trade => trade?.symbol === instrument?.symbol)"));
  // The marker size is a constant the browser test measures against, so the two cannot drift apart.
  assert.ok(script.includes("const size = 11;"));
  assert.ok(script.includes("const tradeView = liveTradingChartTrades(instrument, points, { xAt, yAt, plotX0, plotX1, plotY0, plotY1 }, digits);"));
  assert.ok(script.includes("${tradeMarks}"));
  assert.ok(script.includes('data-live-trade="${kind}"'));
  assert.ok(script.includes('class="live-trading-chart-trade-label">${isEntry ? "E" : "X"}'));
  // The tooltip on each marker carries the time and the price the marker was drawn from.
  assert.ok(script.includes('${isEntry ? "Entry" : "Exit"} ${side.toUpperCase()} ${liveTradingPrice(price, digits)}'));
  // A trade whose time falls outside the bars on screen is counted by the caption rather than clamped onto an
  // edge that is not its own bar.
  assert.ok(script.includes("tools: tradeView.tools"));
  assert.ok(script.includes("toolNote: liveTradingPositionToolNote(tradeView.sizers)"));
  assert.ok(script.includes("outside this window"));
  assert.ok(script.includes("On the chart above, an entry is a triangle lettered E and its exit a triangle lettered X"));
  assert.match(css, /\.live-trading-chart-trade\.buy \.live-trading-chart-trade-shape \{ fill: #26a69a; \}/);
  assert.match(css, /\.live-trading-chart-trade\.sell \.live-trading-chart-trade-shape \{ fill: #ef5350; \}/);
  assert.match(css, /\.live-trading-chart-trade-label \{ fill: #08131a;/);
});

// The user's own reading of a sized trade, drawn on the chart: the box a charting terminal's position tool
// draws - the risk under the entry, the reward above it, each edge carrying its price, its distance, its
// percentage and the money it was worth at the size that was traded, and the ratio between the two.
test("the chart draws the position tool under a trade the terminal bracketed", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  // The arithmetic lives in one small module the page and the tests share, and index.html loads it.
  assert.ok(html.includes('script src="lib/l2l_sizing.js?v=20261004-l2l-position-tool"'));
  assert.ok(script.includes("const liveTradingSizing = (typeof globalThis !== \"undefined\" && globalThis.L2LSizing) || null;"));
  assert.ok(script.includes("function liveTradingPositionSizer(trade, instrument, account) {"));
  // A page that loaded without the module draws the markers and no box rather than failing, or inventing one.
  assert.ok(script.includes('{ available: false, reason: "the position sizer is not loaded" }'));

  // The box is drawn from the trade's own row and the instrument's own contract facts, and only for a trade
  // the terminal reported both levels for.
  assert.ok(script.includes("const sizer = liveTradingPositionSizer(trade, instrumentRow, accountRow);"));
  assert.ok(script.includes("const instrumentRow = Array.isArray(liveTradingData?.instruments)"));
  assert.ok(script.includes('class="live-trading-chart-tool ${sizer.side}"'));
  assert.ok(script.includes('class="live-trading-chart-tool-band ${kind}"'));
  assert.ok(script.includes('class="live-trading-chart-tool-edge ${kind}"'));
  assert.ok(script.includes('class="live-trading-chart-tool-label ${kind}"'));
  // The band spans the bars the trade was held for: the bar its entry fell in to the bar its exit fell in.
  assert.ok(script.includes("const exitIndex = barIndexFor(trade?.closed?.time_utc);"));
  // The caption counts them, so a box that failed to draw is a caption that says so, and a trade with no stop
  // or no target read back is named rather than left as an unexplained absence.
  assert.ok(script.includes("${positionToolNote ? `<span>${escapeHtml(positionToolNote)}</span>` : \"\"}"));
  assert.match(css, /\.live-trading-chart-tool-band\.target \{ fill: #26a69a; \}/);
  assert.match(css, /\.live-trading-chart-tool-band\.stop \{ fill: #ef5350; \}/);
  assert.match(css, /\.live-trading-chart-tool-label\.stop \{ fill: #f2a1a6; \}/);
});

test("the read-back carries the levels the entry was opened with, and refuses a nonsense one", () => {
  const feed = buildFeedWithTrade();
  feed.closed_trades = [buildClosedTrade({ stop_loss: 84000, take_profit: 87000 })];
  assert.deepEqual(validateLiveTradingFeed(feed), []);

  // A closed trade without the two fields at all is a snapshot written before the read-back published them,
  // which is not an error: the page tells that apart from a null, which is a trade opened with nothing set.
  const older = buildFeedWithTrade();
  assert.deepEqual(validateLiveTradingFeed(older), []);
  assert.equal(Object.prototype.hasOwnProperty.call(older.closed_trades[0], "stop_loss"), false);

  const broken = buildFeedWithTrade();
  broken.closed_trades = [buildClosedTrade({ take_profit: -1 })];
  assert.match(validateLiveTradingFeed(broken).join("\n"), /take_profit must be null or a positive price/);

  // And the producer is where those two levels come from: the position's own order history, because MT5 books
  // the stop and the target on the order and not on the deal.
  const producer = fs.readFileSync(producerPath, "utf8");
  assert.ok(producer.includes("def read_position_levels(position_ids):"));
  assert.ok(producer.includes("mt5.history_orders_get(position=position_id)"));
  assert.ok(producer.includes("stop_loss, take_profit = (levels or {}).get(position_id, (None, None))"));
  assert.ok(producer.includes('"stop_loss": stop_loss,'));
  assert.ok(producer.includes('"take_profit": take_profit,'));
});

test("the chart shades an open position's stop and target, and says on the chart that it lags", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  // The shading is drawn from the read-back and from nothing else: the positions the snapshot carries for the
  // symbol on screen, an edge at each of the two prices the terminal reports and the entry through the middle.
  assert.match(script, /function liveTradingChartOpenPositions\(instrument, points, geometry, digits\) \{/);
  assert.ok(script.includes("liveTradingData.positions.filter(row => row?.symbol === instrument?.symbol)"));
  assert.ok(script.includes('class="live-trading-chart-position-band"'));
  assert.ok(script.includes('class="live-trading-chart-position-edge ${kind}"'));
  assert.ok(script.includes('class="live-trading-chart-position-edge entry"'));
  assert.ok(script.includes('class="live-trading-chart-position-label ${kind}"'));
  assert.ok(script.includes("const positionView = liveTradingChartOpenPositions(instrument, points, { xAt, yAt, plotX0, plotX1, plotY0, plotY1 }, digits);"));
  assert.ok(script.includes("${positionMarks}"));
  // A position the terminal reports without a stop or without a target is still an open trade, so it is drawn
  // and the caption says which of the two facts it is rather than leaving an unexplained band on the scale.
  assert.ok(script.includes('"no stop or target attached"'));
  assert.ok(script.includes("opened before this window"));
  // The closed trades are fainter than the open one, so the two are told apart by weight and not by a caption.
  assert.ok(script.includes('class="live-trading-chart-trade ${kind} ${side} closed"'));
  assert.match(css, /\.live-trading-chart-trade\.closed \{ opacity: \.5; \}/);
  assert.match(css, /\.live-trading-chart-position-band \{ fill-opacity: \.12; \}/);
  assert.match(css, /\.live-trading-chart-position-edge\.stop \{ stroke: #ef5350; \}/);
  assert.match(css, /\.live-trading-chart-position-edge\.target \{ stroke: #26a69a; \}/);
  // And the lag is stated on the chart itself, not only in a document: the served copy follows the stored
  // snapshot by minutes while the agent acts on the close.
  assert.ok(script.includes('class="live-trading-chart-lag" role="note"'));
  assert.ok(script.includes("Snapshot, not a live feed"));
  assert.ok(script.includes("The agent acts on the five-minute close itself, so a trade can appear here a few minutes after it was taken."));
  assert.match(css, /\.live-trading-chart-lag \{ margin: 6px 0 0;/);
});

test("the read-back says which of the two 'nothing open' facts it is", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

  // An account that held nothing on this run, and a snapshot that carries no position block at all, are two
  // different facts that both read as "nothing open". The second one has the account's own open count as its
  // evidence: that count is 0, so nothing has been open since the last publish.
  assert.ok(script.includes("const nothingOpen = Number.isFinite(accountOpen) && accountOpen === 0;"));
  assert.ok(script.includes("nothing has been open since the last publish"));
  assert.ok(script.includes("Run the producer again to publish a snapshot with position detail."));
});

test("the crosshair reads the pointer and repaints the legend", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(script, /function liveTradingChartCrosshair\(plot, event\) \{/);
  assert.match(script, /function liveTradingChartResetCrosshair\(plot\) \{/);
  assert.match(script, /panel\.addEventListener\("pointermove", event => \{/);
  assert.match(script, /panel\.addEventListener\("pointerleave", \(\) => \{/);
  // The legend opens on the newest bar and the crosshair switches it to the bar under the pointer.
  assert.ok(script.includes("function liveTradingChartLegend(instrument, points, digits) {"));
  assert.ok(script.includes('data-live-legend="${key}"'));
  assert.ok(script.includes("liveTradingChartPaintLegend(plot, nearest, view.digits);"));
  assert.ok(script.includes('class="live-trading-chart-crosshair-price-text"'));
  assert.match(css, /\.live-trading-chart-legend \{ position: absolute; top: 8px; left: 12px;/);
  assert.match(css, /\.live-trading-chart-crosshair-y, \.live-trading-chart-crosshair-x \{/);

  // The canvas is drawn in a fixed viewBox and scaled to fit, so a pointer has to be mapped back into
  // those units before it can mean a price. The marking click reads the same mapping.
  assert.match(script, /function liveTradingPointerToView\(svg, clientX, clientY\) \{/);
  assert.match(script, /const factor = Math\.min\(rect\.width \/ scale\.width, rect\.height \/ scale\.height\);/);
  assert.match(script, /function liveTradingMarkedPriceFromPointer\(svg, clientY\) \{/);
  assert.ok(script.includes('viewBox="0 0 ${width} ${height}"'));
});

test("the cards chart the same M5 series instead of a hanging bar strip", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(script, /function liveTradingCardChart\(m5, digits, symbol\) \{/);
  // Mini candles when the snapshot carries OHLC bars, an area line of the closes when it does not.
  assert.ok(script.includes("const candles = bars.length > 0;"));
  assert.ok(script.includes('class="live-trading-card-chart-body ${cls}"'));
  assert.ok(script.includes('class="live-trading-card-chart-line ${tone}"'));
  assert.match(css, /\.live-trading-card-chart-body\.up \{ fill: #26a69a; \}/);
  assert.match(css, /\.live-trading-card-chart-line\.up \{ stroke: #26a69a; \}/);
  // The strip it replaced is gone from the drawing and the stylesheet, not left behind as dead code.
  assert.equal(script.includes("liveTradingSeriesBars"), false);
  assert.equal(script.includes("live-trading-bars"), false);
  assert.equal(css.includes("live-trading-bars"), false);
});

test("rejects an instrument that drops one of the published timeframes", () => {
  const noH1 = buildFeed();
  delete noH1.instruments[0].h1;
  assert.match(validateLiveTradingFeed(noH1).join("\n"), /requires an H1 block/);

  const noH4 = buildFeed();
  delete noH4.instruments[1].h4;
  assert.match(validateLiveTradingFeed(noH4).join("\n"), /requires an H4 block/);
});

test("accepts H1 and H4 bars and rejects a bar that could not exist", () => {
  const stamp = STAMP;
  const feed = buildFeed();
  feed.instruments[0].h1.bars = [
    { time_server: stamp, time_utc: stamp, open: 100, high: 102, low: 99, close: 101 },
    { time_server: stamp, time_utc: stamp, open: 101, high: 103, low: 100, close: 101 }
  ];
  feed.instruments[0].h4.bars = [
    { time_server: stamp, time_utc: stamp, open: 100, high: 102, low: 99, close: 101 },
    { time_server: stamp, time_utc: stamp, open: 101, high: 103, low: 100, close: 101 }
  ];
  assert.deepEqual(validateLiveTradingFeed(feed), []);

  const impossible = buildFeed();
  impossible.instruments[2].h4.bars = [
    { time_server: stamp, time_utc: stamp, open: 100, high: 98, low: 97, close: 98 },
    { time_server: stamp, time_utc: stamp, open: 101, high: 103, low: 100, close: 101 }
  ];
  assert.match(
    validateLiveTradingFeed(impossible).join("\n"),
    /h4\.bars\[0\] has a high below its own open or close/
  );
});

test("each timeframe carries its own freshness limit, and the producer declares the same ones", () => {
  // Thirty hours is stale for an H1 read, while eight hours is still an ordinary H4 bar. One number for
  // all three would either hide a stale H1 series or refuse a perfectly current H4 one.
  const staleH1 = buildFeed();
  staleH1.instruments[1].h1.bar_age_seconds = 108000;
  assert.match(
    validateLiveTradingFeed(staleH1).join("\n"),
    /claims h1\.stale false with bars 108000s old \(limit 7200s\)/
  );

  const atLimit = buildFeed();
  atLimit.instruments[1].h1.bar_age_seconds = MAX_FRESH_BAR_AGE_SECONDS.h1;
  atLimit.instruments[1].h4.bar_age_seconds = MAX_FRESH_BAR_AGE_SECONDS.h4;
  assert.deepEqual(validateLiveTradingFeed(atLimit), []);

  const pastLimit = buildFeed();
  pastLimit.instruments[2].h4.bar_age_seconds = MAX_FRESH_BAR_AGE_SECONDS.h4 + 1;
  assert.match(validateLiveTradingFeed(pastLimit).join("\n"), /claims h4\.stale false with bars/);

  const source = fs.readFileSync(producerPath, "utf8");
  [["M5", MAX_FRESH_BAR_AGE_SECONDS.m5], ["H1", MAX_FRESH_BAR_AGE_SECONDS.h1], ["H4", MAX_FRESH_BAR_AGE_SECONDS.h4]]
    .forEach(([name, limit]) => {
      const match = source.match(new RegExp(`^${name}_BAR_STALE_SECONDS = (\\d+)$`, "m"));
      assert.ok(match, `producer must declare ${name}_BAR_STALE_SECONDS`);
      assert.equal(Number(match[1]), limit);
    });
  assert.match(source, /TIMEFRAME_KEYS = \("m5", "h1", "h4"\)/);
  assert.deepEqual(TIMEFRAMES, ["m5", "h1", "h4"]);
});

test("a stale H1 series that states its lag is accepted", () => {
  const feed = buildFeed();
  feed.instruments[3].h1.bar_age_seconds = 90000;
  feed.instruments[3].h1.stale = true;
  assert.match(validateLiveTradingFeed(feed).join("\n"), /has stale H1 bars and must carry a note explaining the lag/);

  feed.instruments[3].h1.note = "The newest BTCUSD H1 bar is 1500 minutes behind the live tick.";
  assert.deepEqual(validateLiveTradingFeed(feed), []);
});

test("the committed snapshot publishes bars on all three timeframes", () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  feed.instruments.forEach((instrument) => {
    TIMEFRAMES.forEach((label) => {
      const block = instrument[label];
      assert.ok(block, `${instrument.symbol} must carry an ${label} block`);
      assert.ok(Array.isArray(block.bars) && block.bars.length > 0, `${instrument.symbol} ${label} bars`);
      assert.equal(block.bars.length, block.close_series.length);
      assert.equal(block.bars[block.bars.length - 1].time_utc, block.last_close.time_utc);
    });
  });
  // The wider views have to be wide enough to read an L2L ladder against, not a couple of bars: a week
  // of hourly bars and weeks of four-hour bars.
  assert.ok(feed.instruments[0].h1.bars.length >= 48, "H1 must carry days of bars");
  assert.ok(feed.instruments[0].h4.bars.length >= 30, "H4 must carry weeks of bars");
});

test("the producer builds every timeframe through one block builder", () => {
  const source = fs.readFileSync(producerPath, "utf8");
  assert.match(
    source,
    /def build_timeframe_block\(key, symbol, timeframe, offset_seconds, candle_count, reference_epoch, stale_seconds\):/
  );
  assert.match(source, /row\[key\] = build_timeframe_block\(/);
  assert.match(source, /for key in TIMEFRAME_KEYS/);
  assert.match(source, /"timeframes": list\(TIMEFRAME_KEYS\)/);
  assert.match(source, /DEFAULT_H1_CANDLES = \d+/);
  assert.match(source, /DEFAULT_H4_CANDLES = \d+/);
  // The single-timeframe names are gone rather than left beside the new ones as dead code.
  assert.equal(source.includes("build_m5_block"), false);
  assert.equal(source.includes("fetch_m5_rows"), false);
});

test("the chart offers the published timeframes and marks on the one on screen", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(script, /const LIVE_TRADING_TIMEFRAMES = \[/);
  assert.match(script, /\{ key: "m5", label: "M5" \}/);
  assert.match(script, /\{ key: "h1", label: "H1" \}/);
  assert.match(script, /\{ key: "h4", label: "H4" \}/);
  assert.match(script, /let liveTradingChartTimeframe = "m5";/);
  assert.match(script, /function liveTradingTimeframeBlock\(instrument, key\) \{/);
  assert.match(script, /data-live-chart-timeframe="\$\{entry\.key\}"/);
  assert.match(script, /liveTradingChartTimeframe = timeframeButton\.dataset\.liveChartTimeframe/);
  // The plot, the legend, the watermark and the freshness line all follow the timeframe on screen, and the
  // plot is handed the L2L rule's reading for the pair on screen so a confirmed ticket is drawn with it.
  assert.match(script, /liveTradingChartPlot\(selected, liveTradingChartMode, frame\.key, ruleReading\)/);
  assert.match(script, /const block = liveTradingTimeframeBlock\(instrument, frame\.key\) \|\| \{\};/);
  assert.match(script, /Newest \$\{escapeHtml\(frame\.label\)\} bar/);
  // A timeframe the snapshot does not publish is a disabled button, not an empty chart.
  assert.match(script, /liveTradingTimeframeBlock\(selected, entry\.key\) \? "" : " disabled"/);
  assert.match(css, /\.live-trading-chart-modes \{/);
  // The old static "M5" chip is gone from both the drawing and the stylesheet.
  assert.equal(script.includes("live-trading-chart-tf"), false);
  assert.equal(css.includes(".live-trading-chart-tf"), false);
});
