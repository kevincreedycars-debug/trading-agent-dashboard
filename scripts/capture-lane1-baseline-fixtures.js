// The lane 1 baseline fixtures: the live artifacts, cut down to what the rule and the loop read, with every
// account detail that is not already published as a mask removed.
//
// Run once, from the checkout whose behaviour is to be held still, and commit the four files it writes:
//
//     node scripts/capture-lane1-baseline-fixtures.js
//
// It reads `data/layer1.json`, `data/l2l-levels.json` and `data/live-trading.json` and writes
// `tests/fixtures/lane1/{calls,levels,feed,clock}.json`. Nothing here is a test and nothing here is run by the
// suite: `tests/live_trading_lane1_baseline.test.js` reads the committed fixtures, never these artifacts, so a
// feed that moves on cannot move a baseline that is supposed to be fixed in time.
//
// What is kept and what is taken out, deliberately:
//
//   * the four instruments, their own digits/point/tick size and their M5 block as the last 80 bars - enough for
//     the crossing rule and small enough to read in a diff;
//   * the whole marked ladder, because the target is a line off the ladder and a shorter ladder would change it;
//   * the two open positions, with their tickets replaced by 810001 and 810002 and their money zeroed, so the
//     baseline states the case it is about - a pair already in a trade - without carrying a real ticket;
//   * the four Layer 1 calls the dashboard reads, with the published directions and a validity window that is
//     open at the fixture's own clock;
//   * nothing else: no balance, no equity, no company, no server offset, no history, no closed trades.
//
// The clock is the newest M5 bar's own close, not the wall clock: the fixtures are read at an instant that
// belongs to the data, so "has this bar closed" has one answer for ever.
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "tests", "fixtures", "lane1");
const BAR_SECONDS = 300;
const BARS_KEPT = 80;
const ASSETS = ["EUR", "GOLD", "NQ", "BTC"];
const SANITARY_TICKETS = { EURUSD: 810001, BTCUSD: 810002 };

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function instrumentRow(row) {
  const bars = (Array.isArray(row?.m5?.bars) ? row.m5.bars : []).slice(-BARS_KEPT).map(bar => ({
    time_utc: bar.time_utc,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tick_volume: bar.tick_volume ?? null
  }));
  return {
    symbol: row.symbol,
    dashboard_asset: row.dashboard_asset,
    available: row.available === true,
    description: row.description || null,
    digits: row.digits,
    point: row.point,
    tick_size: row.tick_size ?? null,
    contract_size: row.contract_size ?? null,
    min_lot: row.min_lot ?? null,
    lot_step: row.lot_step ?? null,
    stops_level: row.stops_level ?? null,
    trade_mode: row.trade_mode ?? null,
    quote: row.quote
      ? {
        bid: row.quote.bid,
        ask: row.quote.ask,
        time_utc: row.quote.time_utc ?? null,
        spread_points: row.quote.spread_points ?? null,
        market_state: row.quote.market_state ?? null
      }
      : null,
    m5: {
      candle_count: row?.m5?.candle_count ?? null,
      bars,
      previous_close: row?.m5?.previous_close ?? null,
      last_close: row?.m5?.last_close ?? null,
      change_points: row?.m5?.change_points ?? null,
      change_pct: row?.m5?.change_pct ?? null,
      direction: row?.m5?.direction ?? null,
      bar_age_seconds: row?.m5?.bar_age_seconds ?? null,
      stale: row?.m5?.stale === true
    }
  };
}

function main() {
  const callsJson = readJson("data/layer1.json");
  const levelsJson = readJson("data/l2l-levels.json");
  const feed = readJson("data/live-trading.json");

  const instruments = (Array.isArray(feed?.instruments) ? feed.instruments : [])
    .filter(row => row?.available === true)
    .map(instrumentRow);

  const newestBar = instruments
    .flatMap(row => row.m5.bars)
    .map(bar => Date.parse(bar.time_utc))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .pop();
  if (!Number.isFinite(newestBar)) throw new Error("no M5 bar carries a readable time_utc");
  // The instant every fixture is read at: the close of the newest bar the fixtures carry.
  const nowMs = newestBar + BAR_SECONDS * 1000;
  const window = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();

  // The calls: the direction the page reads for each instrument - the priority call where there is one, the 24h
  // call otherwise - with the seal and window that make it live at `nowMs`.
  const calls = {
    dashboard_meta: { last_updated_et: callsJson?.dashboard_meta?.last_updated_et ?? null },
    agents: ASSETS.map(asset => {
      const agent = (Array.isArray(callsJson?.agents) ? callsJson.agents : []).find(row => row?.agent === asset);
      if (!agent) throw new Error(`the published calls carry no ${asset} agent`);
      const direction = agent?.priority_call?.direction || agent?.calls?.["24h"]?.direction || null;
      return {
        agent: asset,
        sealed_at: agent.sealed_at ?? null,
        effective_status: "ACTIVE",
        forecast_window_end: window,
        expires_at: window,
        calls: { "24h": { direction } },
        priority_call: { direction }
      };
    })
  };

  // The ladder, whole: the derived lines either side of price are targets, so trimming it would move them.
  const levels = {
    schema_version: levelsJson.schema_version ?? "l2l-levels-v1",
    generated_at_utc: levelsJson.generated_at_utc ?? null,
    instrument_count: (Array.isArray(levelsJson?.instruments) ? levelsJson.instruments : []).length,
    instruments: (Array.isArray(levelsJson?.instruments) ? levelsJson.instruments : []).map(row => ({
      symbol: row.symbol,
      dashboard_asset: row.dashboard_asset,
      levels: (Array.isArray(row?.levels) ? row.levels : []).map(level => ({
        kind: level.kind ?? null,
        timeframe: level.timeframe ?? null,
        label: level.label ?? null,
        price: level.price,
        role: level.role ?? "seed"
      }))
    }))
  };

  // The account's own two positions as the case rather than as the record: the same pair, side, entry, stop and
  // target, with a fixture ticket and no money attached.
  const positions = (Array.isArray(feed?.positions) ? feed.positions : []).map(position => ({
    ticket: SANITARY_TICKETS[position.symbol] ?? 810000,
    symbol: position.symbol,
    dashboard_asset: position.dashboard_asset ?? null,
    side: position.side,
    volume: position.volume,
    price_open: position.price_open,
    price_current: position.price_current,
    stop_loss: position.stop_loss ?? null,
    take_profit: position.take_profit ?? null,
    profit: 0,
    swap: 0,
    floating_pct: 0,
    magic: position.magic,
    comment: position.comment ?? "",
    opened: position.opened ?? null
  }));

  const sanitisedFeed = {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(nowMs - 30000).toISOString(),
    time_server: new Date(nowMs - 30000).toISOString(),
    stale_after_seconds: 900,
    read_only: true,
    terminal: {
      name: feed?.terminal?.name ?? null,
      build: feed?.terminal?.build ?? null,
      connected: feed?.terminal?.connected === true,
      trade_allowed: feed?.terminal?.trade_allowed === true
    },
    account: {
      login_masked: feed?.account?.login_masked ?? null,
      server: feed?.account?.server ?? null,
      currency: feed?.account?.currency ?? null,
      leverage: feed?.account?.leverage ?? null,
      balance: 10000,
      equity: 10000,
      margin_free: 10000,
      positions_open: positions.length,
      orders_open: 0
    },
    orders: [],
    positions,
    closed_trades: [],
    instrument_count: instruments.length,
    instruments,
    source: { producer: "tools/mt5-bridge/live-trading-snapshot.py", scope: "read-only snapshot" }
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, value) => {
    fs.writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };
  write("calls.json", calls);
  write("levels.json", levels);
  write("feed.json", sanitisedFeed);
  write("clock.json", {
    now_utc: new Date(nowMs).toISOString(),
    note: "the close of the newest M5 bar the feed fixture carries"
  });

  process.stdout.write(`${JSON.stringify({
    now_utc: new Date(nowMs).toISOString(),
    bars: instruments.map(row => `${row.symbol}:${row.m5.bars.length}`),
    levels: levels.instruments.map(row => `${row.symbol}:${row.levels.length}`),
    calls: calls.agents.map(row => `${row.agent}:${row.priority_call.direction}`),
    positions: positions.map(row => `${row.symbol}#${row.ticket}`)
  }, null, 2)}\n`);
}

main();
