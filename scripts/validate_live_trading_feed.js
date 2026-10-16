// Guards the artifact the Live Trading dashboard section renders.
// The feed is a read-only broker snapshot: if any of these rules break, the published view must not
// show it as a trustworthy live feed.
//
// Since v3 the snapshot also carries what has already been executed - the open positions with their own
// entry price and floating result, and the trades that closed inside a stated window - so that a trade
// placed deliberately can be seen to have happened rather than taken on trust. Since v4 the working
// pending orders are published beside them: a ticket left as a limit is neither a position nor a closed
// trade, and it is the one artifact that states the level a live trade is working at. Those blocks are
// held to the same standard as the quotes: a row that does not read as a real trade, or a count that
// disagrees with the list beside it, is a refusal rather than something for the page to render.
const fs = require("fs");
const path = require("path");

const SCHEMA_VERSION = "live-trading-feed-v4";
const EXPECTED_INSTRUMENTS = [
  { symbol: "EURUSD", dashboard_asset: "EUR" },
  { symbol: "XAUUSD", dashboard_asset: "GOLD" },
  { symbol: "US100.cash", dashboard_asset: "NQ" },
  { symbol: "BTCUSD", dashboard_asset: "BTC" }
];
const ALLOWED_DIRECTIONS = new Set(["up", "down", "flat"]);
// A trade faces one way. The dashboard prints the side and derives the tint of the P/L cell from it, so a
// side it does not know is a row it cannot render honestly.
const ALLOWED_SIDES = new Set(["buy", "sell"]);
const FORBIDDEN_ACCOUNT_KEYS = ["login", "password", "investor_password"];
// The blocks a snapshot publishes, and all three are required. `m5` carries the 5m close-beyond-level
// trigger; `h1` and `h4` are the zoomed-out views the L2L seed levels and their duplicated ladder are
// read on, so the chart offers them as buttons and a snapshot without them is a producer run to repeat
// rather than a chart to draw half of. This list is the contract between the producer, the validator
// and the dashboard's timeframe buttons.
const TIMEFRAMES = ["m5", "h1", "h4"];
// Mirrors the *_BAR_STALE_SECONDS constants in tools/mt5-bridge/live-trading-snapshot.py: a block
// whose newest bar opens this far behind its own live tick is not the current read the chart shows.
// Two bar widths per timeframe - 300s M5, 3600s H1, 14400s H4 - rounded to the producer's numbers.
const MAX_FRESH_BAR_AGE_SECONDS = { m5: 660, h1: 7200, h4: 28800 };
const MAX_FRESH_M5_BAR_AGE_SECONDS = MAX_FRESH_BAR_AGE_SECONDS.m5;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message, errors = []) {
  const lines = [message, ...errors.map((error) => `- ${error}`)];
  throw new Error(lines.join("\n"));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimestamp(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function validateInstrument(instrument, errors) {
  const symbol = instrument?.symbol || "<missing>";
  if (!instrument || typeof instrument !== "object") {
    errors.push("Every instrument entry must be an object");
    return;
  }
  if (!instrument.dashboard_asset) errors.push(`Instrument ${symbol} requires dashboard_asset`);
  if (typeof instrument.available !== "boolean") errors.push(`Instrument ${symbol} requires a boolean available`);

  if (instrument.available !== true) {
    if (!instrument.note) errors.push(`Unavailable instrument ${symbol} must carry a note explaining why`);
    return;
  }

  if (!Number.isInteger(instrument.digits)) errors.push(`Instrument ${symbol} requires integer digits`);
  if (!isFiniteNumber(instrument.point) || instrument.point <= 0) errors.push(`Instrument ${symbol} requires a positive point`);
  if (!isFiniteNumber(instrument.contract_size) || instrument.contract_size <= 0) errors.push(`Instrument ${symbol} requires a positive contract_size`);
  if (!isFiniteNumber(instrument.min_lot) || instrument.min_lot <= 0) errors.push(`Instrument ${symbol} requires a positive min_lot`);
  if (!Number.isInteger(instrument.stops_level) || instrument.stops_level < 0) errors.push(`Instrument ${symbol} requires a non-negative integer stops_level`);

  const quote = instrument.quote;
  if (!quote || typeof quote !== "object") {
    errors.push(`Instrument ${symbol} requires a quote object`);
  } else {
    if (!isFiniteNumber(quote.bid) || quote.bid <= 0) errors.push(`Instrument ${symbol} requires a positive bid`);
    if (!isFiniteNumber(quote.ask) || quote.ask <= 0) errors.push(`Instrument ${symbol} requires a positive ask`);
    if (isFiniteNumber(quote.bid) && isFiniteNumber(quote.ask) && quote.ask < quote.bid) {
      errors.push(`Instrument ${symbol} has an ask below its bid`);
    }
    if (!Number.isInteger(quote.spread_points) || quote.spread_points < 0) errors.push(`Instrument ${symbol} requires a non-negative integer spread_points`);
    if (!isTimestamp(quote.time_server)) errors.push(`Instrument ${symbol} quote requires time_server`);
    if (!isTimestamp(quote.time_utc)) errors.push(`Instrument ${symbol} quote requires time_utc`);
    if (typeof quote.market_state !== "string" || !quote.market_state) errors.push(`Instrument ${symbol} requires a market_state`);
  }

  // Every published timeframe is required: m5 is the block the 5m close-beyond-level trigger reads, and
  // h1 and h4 carry the wider views a marked L2L ladder is read on.
  TIMEFRAMES.forEach((label) => {
    validateBarBlock(symbol, label, instrument[label], MAX_FRESH_BAR_AGE_SECONDS[label], errors);
  });
}

// One timeframe's bars, checked the same way whichever block they are in: shape, OHLC geometry, the
// close-only view beside them, and the freshness proof that says how old the newest bar is.
function validateBarBlock(symbol, label, block, maxFreshAge, errors) {
  if (!block || typeof block !== "object") {
    errors.push(`Instrument ${symbol} requires an ${label.toUpperCase()} block`);
    return;
  }
  if (!Number.isInteger(block.candle_count) || block.candle_count <= 0) errors.push(`Instrument ${symbol} requires a positive ${label}.candle_count`);
  if (!Array.isArray(block.close_series) || block.close_series.length === 0) {
    errors.push(`Instrument ${symbol} requires a non-empty ${label}.close_series`);
  } else {
    if (block.candle_count !== block.close_series.length) {
      errors.push(`Instrument ${symbol} has ${label}.candle_count that disagrees with ${label}.close_series length`);
    }
    block.close_series.forEach((point, index) => {
      if (!isTimestamp(point?.time_utc)) errors.push(`Instrument ${symbol} ${label}.close_series[${index}] requires time_utc`);
      if (!isTimestamp(point?.time_server)) errors.push(`Instrument ${symbol} ${label}.close_series[${index}] requires time_server`);
      if (!isFiniteNumber(point?.close)) errors.push(`Instrument ${symbol} ${label}.close_series[${index}] requires a numeric close`);
      if (!ALLOWED_DIRECTIONS.has(point?.direction)) errors.push(`Instrument ${symbol} ${label}.close_series[${index}] has an invalid direction`);
    });
  }

  // Full OHLC bars are optional, so a snapshot written before the chart existed still validates.
  // When present they are the candles the dashboard draws, so their geometry must be sound and they
  // must agree with the close-only view beside them.
  if (block.bars !== undefined) {
    if (!Array.isArray(block.bars) || block.bars.length === 0) {
      errors.push(`Instrument ${symbol} ${label}.bars must be a non-empty array when present`);
    } else {
      if (block.candle_count !== block.bars.length) {
        errors.push(`Instrument ${symbol} has ${label}.candle_count that disagrees with ${label}.bars length`);
      }
      block.bars.forEach((bar, index) => {
        if (!isTimestamp(bar?.time_utc)) errors.push(`Instrument ${symbol} ${label}.bars[${index}] requires time_utc`);
        if (!isTimestamp(bar?.time_server)) errors.push(`Instrument ${symbol} ${label}.bars[${index}] requires time_server`);
        for (const key of ["open", "high", "low", "close"]) {
          if (!isFiniteNumber(bar?.[key])) errors.push(`Instrument ${symbol} ${label}.bars[${index}] requires a numeric ${key}`);
        }
        if (isFiniteNumber(bar?.high) && isFiniteNumber(bar?.low) && bar.high < bar.low) {
          errors.push(`Instrument ${symbol} ${label}.bars[${index}] has a high below its low`);
        }
        if (isFiniteNumber(bar?.high) && isFiniteNumber(bar?.open) && isFiniteNumber(bar?.close)
          && (bar.high < bar.open || bar.high < bar.close)) {
          errors.push(`Instrument ${symbol} ${label}.bars[${index}] has a high below its own open or close`);
        }
        if (isFiniteNumber(bar?.low) && isFiniteNumber(bar?.open) && isFiniteNumber(bar?.close)
          && (bar.low > bar.open || bar.low > bar.close)) {
          errors.push(`Instrument ${symbol} ${label}.bars[${index}] has a low above its own open or close`);
        }
      });
      if (Array.isArray(block.close_series) && block.close_series.length) {
        const barLast = block.bars[block.bars.length - 1];
        const seriesLast = block.close_series[block.close_series.length - 1];
        if (barLast?.time_utc !== seriesLast?.time_utc) {
          errors.push(`Instrument ${symbol} ${label}.bars last bar is not the last entry of ${label}.close_series`);
        }
      }
    }
  }

  const lastClose = block.last_close;
  if (!lastClose || typeof lastClose !== "object") {
    errors.push(`Instrument ${symbol} requires ${label}.last_close`);
  } else {
    for (const key of ["open", "high", "low", "close"]) {
      if (!isFiniteNumber(lastClose[key])) errors.push(`Instrument ${symbol} ${label}.last_close requires a numeric ${key}`);
    }
    if (isFiniteNumber(lastClose.high) && isFiniteNumber(lastClose.low) && lastClose.high < lastClose.low) {
      errors.push(`Instrument ${symbol} ${label}.last_close has a high below its low`);
    }
    if (!isTimestamp(lastClose.time_utc)) errors.push(`Instrument ${symbol} ${label}.last_close requires time_utc`);
    if (Array.isArray(block.close_series) && block.close_series.length) {
      const seriesLast = block.close_series[block.close_series.length - 1];
      if (seriesLast?.time_utc !== lastClose.time_utc) {
        errors.push(`Instrument ${symbol} ${label}.last_close is not the last entry of ${label}.close_series`);
      }
    }
  }

  // The newest bar is the part most easily shipped stale: a series can be hours old while the quote
  // beside it is live. A feed must state the bar age and may not claim freshness it does not have.
  if (!Number.isInteger(block.bar_age_seconds) || block.bar_age_seconds < 0) {
    errors.push(`Instrument ${symbol} requires a non-negative integer ${label}.bar_age_seconds`);
  }
  if (typeof block.stale !== "boolean") {
    errors.push(`Instrument ${symbol} requires a boolean ${label}.stale`);
  }
  if (!Number.isInteger(block.refresh_attempts) || block.refresh_attempts <= 0) {
    errors.push(`Instrument ${symbol} requires a positive integer ${label}.refresh_attempts`);
  }
  if (block.stale === false && Number.isInteger(block.bar_age_seconds) && block.bar_age_seconds > maxFreshAge) {
    errors.push(
      `Instrument ${symbol} claims ${label}.stale false with bars ${block.bar_age_seconds}s old (limit ${maxFreshAge}s)`
    );
  }
  if (block.stale === true && (typeof block.note !== "string" || !block.note.trim())) {
    errors.push(`Instrument ${symbol} has stale ${label.toUpperCase()} bars and must carry a note explaining the lag`);
  }
}

// One open position, as the terminal reports it. These are the rows the positions table renders, so a row
// that does not read as a real trade is refused rather than printed.
function validatePosition(position, errors) {
  if (!position || typeof position !== "object") {
    errors.push("Every positions entry must be an object");
    return;
  }
  const label = `position #${position.ticket ?? "<missing>"}`;
  if (!Number.isInteger(position.ticket) || position.ticket <= 0) errors.push(`${label} requires a positive integer ticket`);
  if (typeof position.symbol !== "string" || !position.symbol) errors.push(`${label} requires a symbol`);
  if (!ALLOWED_SIDES.has(position.side)) errors.push(`${label} requires side buy or sell`);
  if (!isFiniteNumber(position.volume) || position.volume <= 0) errors.push(`${label} requires a positive volume`);
  if (!isFiniteNumber(position.price_open) || position.price_open <= 0) errors.push(`${label} requires a positive price_open`);
  if (!isFiniteNumber(position.price_current) || position.price_current <= 0) errors.push(`${label} requires a positive price_current`);
  if (!isFiniteNumber(position.profit)) errors.push(`${label} requires a numeric profit`);
  if (!isFiniteNumber(position.swap)) errors.push(`${label} requires a numeric swap`);
  if (position.floating_pct !== null && !isFiniteNumber(position.floating_pct)) {
    errors.push(`${label} floating_pct must be null or a number`);
  }
  if (!Number.isInteger(position.magic) || position.magic < 0) errors.push(`${label} requires a non-negative integer magic`);
  for (const key of ["stop_loss", "take_profit"]) {
    if (position[key] !== null && (!isFiniteNumber(position[key]) || position[key] <= 0)) {
      errors.push(`${label} ${key} must be null or a positive price`);
    }
  }
  // The clock: a position without the moment it opened and the moment it was last updated cannot be placed
  // against the bars the rest of this feed carries.
  for (const key of ["opened", "updated"]) {
    if (!isTimestamp(position[key]?.time_utc)) errors.push(`${label} requires ${key}.time_utc as a parseable timestamp`);
    if (!isTimestamp(position[key]?.time_server)) errors.push(`${label} requires ${key}.time_server as a parseable timestamp`);
  }
}

// One closed position, paired out of its deals. This is the read-back that proves a trade happened: the
// entry and the exit, what it made net of commission and swap, and how long it was held.
function validateClosedTrade(trade, errors) {
  if (!trade || typeof trade !== "object") {
    errors.push("Every closed_trades entry must be an object");
    return;
  }
  const label = `closed trade #${trade.position_id ?? "<missing>"}`;
  if (!Number.isInteger(trade.position_id) || trade.position_id <= 0) errors.push(`${label} requires a positive integer position_id`);
  if (typeof trade.symbol !== "string" || !trade.symbol) errors.push(`${label} requires a symbol`);
  if (!ALLOWED_SIDES.has(trade.side)) errors.push(`${label} requires side buy or sell`);
  if (!isFiniteNumber(trade.volume) || trade.volume <= 0) errors.push(`${label} requires a positive volume`);
  for (const key of ["price_open", "price_close"]) {
    if (!isFiniteNumber(trade[key]) || trade[key] <= 0) errors.push(`${label} requires a positive ${key}`);
  }
  for (const key of ["profit", "commission", "swap", "net_profit"]) {
    if (!isFiniteNumber(trade[key])) errors.push(`${label} requires a numeric ${key}`);
  }
  // The levels the entry carried, when the terminal read them back: null when nothing was attached to the
  // order, and absent on a snapshot written before the read-back published them at all. A page needs to tell
  // those two apart - one is a trade with no box to draw, the other is a snapshot that predates the box.
  for (const key of ["stop_loss", "take_profit"]) {
    if (trade[key] === undefined || trade[key] === null) continue;
    if (!isFiniteNumber(trade[key]) || trade[key] <= 0) {
      errors.push(`${label} ${key} must be null or a positive price`);
    }
  }
  // What it made has to be the arithmetic the reader would do: profit, less commission and swap. A net
  // figure that disagrees with its own parts is the one number on the panel a reader cannot check.
  if (isFiniteNumber(trade.profit) && isFiniteNumber(trade.commission) && isFiniteNumber(trade.swap) && isFiniteNumber(trade.net_profit)) {
    const net = Math.round((trade.profit + trade.commission + trade.swap) * 100) / 100;
    if (net !== trade.net_profit) {
      errors.push(`${label} net_profit (${trade.net_profit}) must be profit plus commission plus swap (${net})`);
    }
  }
  if (!Number.isInteger(trade.deal_count) || trade.deal_count < 2) errors.push(`${label} requires deal_count of at least 2`);
  for (const key of ["entry_deal", "exit_deal"]) {
    if (!Number.isInteger(trade[key]) || trade[key] <= 0) errors.push(`${label} requires a positive integer ${key}`);
  }
  if (!Number.isInteger(trade.duration_seconds) || trade.duration_seconds < 0) {
    errors.push(`${label} requires a non-negative integer duration_seconds`);
  }
  for (const key of ["opened", "closed"]) {
    if (!isTimestamp(trade[key]?.time_utc)) errors.push(`${label} requires ${key}.time_utc as a parseable timestamp`);
    if (!isTimestamp(trade[key]?.time_server)) errors.push(`${label} requires ${key}.time_server as a parseable timestamp`);
  }
  const opened = Date.parse(trade.opened?.time_utc);
  const closed = Date.parse(trade.closed?.time_utc);
  if (Number.isFinite(opened) && Number.isFinite(closed) && closed < opened) errors.push(`${label} closed before it opened`);
}

// One working pending order, as the terminal reports it. A limit waiting under the market at a level is
// the ticket the L2L lane leaves behind, and the level it sits at is the fact the page states as the
// trade's own entry, so a row that does not read as a real order is refused rather than printed.
function validateOrder(order, errors) {
  if (!order || typeof order !== "object") {
    errors.push("Every orders entry must be an object");
    return;
  }
  const label = `order #${order.ticket ?? "<missing>"}`;
  if (!Number.isInteger(order.ticket) || order.ticket <= 0) errors.push(`${label} requires a positive integer ticket`);
  if (typeof order.symbol !== "string" || !order.symbol) errors.push(`${label} requires a symbol`);
  if (typeof order.type !== "string" || !order.type) errors.push(`${label} requires an order type`);
  if (!ALLOWED_SIDES.has(order.side)) errors.push(`${label} requires side buy or sell`);
  if (!isFiniteNumber(order.volume) || order.volume <= 0) errors.push(`${label} requires a positive volume`);
  if (!isFiniteNumber(order.price_open) || order.price_open <= 0) errors.push(`${label} requires a positive price_open`);
  if (!Number.isInteger(order.magic) || order.magic < 0) errors.push(`${label} requires a non-negative integer magic`);
  for (const key of ["stop_loss", "take_profit"]) {
    if (order[key] !== null && (!isFiniteNumber(order[key]) || order[key] <= 0)) {
      errors.push(`${label} ${key} must be null or a positive price`);
    }
  }
  // The moment it was placed, so the page can say how long the level has been working. An order with no
  // expiry of its own writes null there, which is a different fact from an expiry that has passed.
  if (!isTimestamp(order.placed?.time_utc)) errors.push(`${label} requires placed.time_utc as a parseable timestamp`);
  if (!isTimestamp(order.placed?.time_server)) errors.push(`${label} requires placed.time_server as a parseable timestamp`);
  if (order.expiration !== null) {
    if (!isTimestamp(order.expiration?.time_utc) || !isTimestamp(order.expiration?.time_server)) {
      errors.push(`${label} expiration must be null or carry both clocks`);
    }
  }
}

function validateLiveTradingFeed(feed) {
  const errors = [];
  if (!feed || typeof feed !== "object" || Array.isArray(feed)) {
    return ["Feed must be a JSON object"];
  }

  if (feed.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (feed.read_only !== true) errors.push("read_only must be true");
  if (feed.order_functions_called !== false) errors.push("order_functions_called must be false");
  if (!isTimestamp(feed.generated_at_utc)) errors.push("generated_at_utc must be a parseable timestamp");
  if (!isFiniteNumber(feed.server_offset_seconds)) errors.push("server_offset_seconds must be a number");
  if (!Number.isInteger(feed.stale_after_seconds) || feed.stale_after_seconds <= 0) {
    errors.push("stale_after_seconds must be a positive integer");
  }

  const account = feed.account;
  if (!account || typeof account !== "object") {
    errors.push("account must be an object");
  } else {
    for (const key of FORBIDDEN_ACCOUNT_KEYS) {
      if (key in account) errors.push(`account must not carry a raw credential field: ${key}`);
    }
    if (typeof account.login_masked !== "string" || !/^\*{3}\d{3,}$/.test(account.login_masked)) {
      errors.push("account.login_masked must be a masked login such as ***614");
    }
    if (!isFiniteNumber(account.balance)) errors.push("account.balance must be a number");
    if (!Number.isInteger(account.positions_open) || account.positions_open < 0) errors.push("account.positions_open must be a non-negative integer");
    if (!Number.isInteger(account.orders_open) || account.orders_open < 0) errors.push("account.orders_open must be a non-negative integer");
  }

  if (!feed.terminal || typeof feed.terminal !== "object") {
    errors.push("terminal must be an object");
  } else if (typeof feed.terminal.connected !== "boolean") {
    errors.push("terminal.connected must be a boolean");
  }

  // The working pending orders, required and empty when nothing is working: a page that cannot tell "no
  // ticket left as a limit" from "a snapshot written before orders were published" would state the wrong
  // level for a live trade, and that is the failure this block exists to close.
  if (!Array.isArray(feed.orders)) {
    errors.push("orders must be an array, empty when nothing is working");
  } else {
    feed.orders.forEach((order) => validateOrder(order, errors));
    // The count the account block carries has to be the list beside it: a feed that says an order is
    // working while carrying no row is a page showing a pair as untraded when a limit is resting on it.
    if (Number.isInteger(feed.account?.orders_open) && feed.account.orders_open !== feed.orders.length) {
      errors.push(
        `account.orders_open (${feed.account.orders_open}) must equal the number of entries in orders (${feed.orders.length})`
      );
    }
  }

  if (!Array.isArray(feed.positions)) {
    errors.push("positions must be an array, empty when the account holds nothing");
  } else {
    feed.positions.forEach((position) => validatePosition(position, errors));
    // The count the account block carries has to be the list beside it: a feed that says two positions are
    // open while carrying one row is a page showing half the risk.
    if (Number.isInteger(feed.account?.positions_open) && feed.account.positions_open !== feed.positions.length) {
      errors.push(
        `account.positions_open (${feed.account.positions_open}) must equal the number of entries in positions (${feed.positions.length})`
      );
    }
  }

  if (!Array.isArray(feed.closed_trades)) {
    errors.push("closed_trades must be an array, empty when the window holds none");
  } else {
    feed.closed_trades.forEach((trade) => validateClosedTrade(trade, errors));
  }

  // The window the closed trades were read over, stated rather than assumed: "no closed trades" and "a
  // window that holds none" are different facts and the panel has to be able to tell them apart.
  if (!feed.history || typeof feed.history !== "object") {
    errors.push("history must be an object describing the closed-trade window");
  } else {
    if (!Number.isInteger(feed.history.window_days) || feed.history.window_days <= 0) errors.push("history.window_days must be a positive integer");
    if (!Number.isInteger(feed.history.deal_count) || feed.history.deal_count < 0) errors.push("history.deal_count must be a non-negative integer");
    if (!Number.isInteger(feed.history.closed_positions) || feed.history.closed_positions < 0) {
      errors.push("history.closed_positions must be a non-negative integer");
    }
    if (!isTimestamp(feed.history.from_utc) || !isTimestamp(feed.history.to_utc)) {
      errors.push("history must carry parseable from_utc and to_utc");
    }
    if (Array.isArray(feed.closed_trades) && Number.isInteger(feed.history.closed_positions)
      && feed.history.closed_positions !== feed.closed_trades.length) {
      errors.push(
        `history.closed_positions (${feed.history.closed_positions}) must equal the number of entries in closed_trades (${feed.closed_trades.length})`
      );
    }
  }

  // Where an executed trade can have come from. The feed is the read half of the lane; saying so on the
  // artifact is what keeps the page from reading as if this file had placed anything.
  if (typeof feed.execution_note !== "string" || !feed.execution_note.trim()) {
    errors.push("execution_note must state that this snapshot places nothing and name where a trade can come from");
  }

  if (!Array.isArray(feed.instruments)) {
    errors.push("instruments must be an array");
    return errors;
  }
  if (feed.instruments.length === 0 && typeof feed.note !== "string") {
    errors.push("An empty instruments array must carry a note explaining the failure");
  }
  if (feed.instrument_count !== feed.instruments.length) {
    errors.push("instrument_count must equal the number of instrument entries");
  }

  feed.instruments.forEach((instrument) => validateInstrument(instrument, errors));

  const present = new Set(feed.instruments.map((instrument) => instrument?.symbol));
  for (const expected of EXPECTED_INSTRUMENTS) {
    if (feed.instruments.length === 0) break;
    if (!present.has(expected.symbol)) {
      errors.push(`Missing expected instrument: ${expected.symbol} (${expected.dashboard_asset})`);
      continue;
    }
    const match = feed.instruments.find((instrument) => instrument?.symbol === expected.symbol);
    if (match?.dashboard_asset !== expected.dashboard_asset) {
      errors.push(`Instrument ${expected.symbol} must carry dashboard_asset ${expected.dashboard_asset}`);
    }
  }

  return errors;
}

module.exports = {
  SCHEMA_VERSION,
  EXPECTED_INSTRUMENTS,
  TIMEFRAMES,
  MAX_FRESH_BAR_AGE_SECONDS,
  MAX_FRESH_M5_BAR_AGE_SECONDS,
  validateLiveTradingFeed
};

function main() {
  const feedPath = path.resolve(process.cwd(), process.argv[2] || "data/live-trading.json");
  if (!fs.existsSync(feedPath)) fail(`Feed file not found: ${feedPath}`);

  const feed = readJson(feedPath);
  const errors = validateLiveTradingFeed(feed);
  if (errors.length) fail("Live trading feed validation failed.", errors);

  console.log(JSON.stringify({
    status: "PASS",
    feed: path.relative(process.cwd(), feedPath).replace(/\\/g, "/"),
    schema_version: feed.schema_version,
    generated_at_utc: feed.generated_at_utc,
    stale_after_seconds: feed.stale_after_seconds,
    timeframes: TIMEFRAMES,
    instruments: feed.instruments.map((instrument) => instrument.symbol),
    orders_open: Array.isArray(feed.orders) ? feed.orders.length : null,
    positions_open: Array.isArray(feed.positions) ? feed.positions.length : null,
    closed_trades: Array.isArray(feed.closed_trades) ? feed.closed_trades.length : null,
    history_window_days: feed.history?.window_days ?? null
  }, null, 2));
}

if (require.main === module) {
  main();
}
