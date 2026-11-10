// The four-chart switch, photographed: FTMO 1, FTMO 2 and back again, from one page and one selector.
//
// This is a capture, not a test - `tests/live_trading_lane_selector.browser.test.js` is what asserts the behaviour.
// It serves the shipped page with a lanes document naming both accounts and a second account's snapshot built
// here (its own login, its own tickets and lot sizes, its own ladder close enough to price to be drawn), clicks the
// selector through the three views and writes one PNG each:
//
//     node scripts/capture-lane2-dashboard-screenshots.js [--out <dir>]
//
// The default output is `.local/evidence/lane2` - an ignored folder, because a screenshot is evidence rather than
// a published artifact.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const REPO_ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const OUT_DIR = outIndex >= 0 && argv[outIndex + 1]
  ? path.resolve(argv[outIndex + 1])
  : path.resolve(REPO_ROOT, "..", "..", ".local", "evidence", "lane2");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

// The second account's snapshot: lane 1's instruments with a different login, a different position and lot size, a
// working limit, and a ladder near price so the half grid's midpoints are on the picture.
function laneTwoSnapshot() {
  const snapshot = JSON.parse(JSON.stringify(readJson("data/live-trading.json")));
  snapshot.account = { ...snapshot.account, login_masked: "***222", balance: 25000, equity: 25050 };
  snapshot.positions = [{
    ticket: 900111,
    symbol: "EURUSD",
    dashboard_asset: "EUR",
    side: "buy",
    volume: 0.05,
    price_open: 1.1,
    price_current: 1.1,
    stop_loss: 1.0999,
    take_profit: 1.2,
    profit: 1.5,
    swap: 0,
    floating_pct: 0.1,
    magic: 20261005,
    comment: "l2l-rule-eur",
    opened: { time_utc: "2026-11-07T10:00:00Z" }
  }];
  snapshot.orders = [{
    ticket: 900222,
    symbol: "BTCUSD",
    dashboard_asset: "BTC",
    side: "buy",
    type: "ORDER_TYPE_BUY_LIMIT",
    volume: 0.1,
    price_open: 75000,
    stop_loss: 74000,
    take_profit: 78000,
    magic: 20261005,
    comment: "l2l-rule-btc",
    placed: { time_utc: "2026-11-07T09:00:00Z" }
  }];
  snapshot.instruments = snapshot.instruments.map(instrument => {
    const bars = Array.isArray(instrument?.m5?.bars) ? instrument.m5.bars : [];
    const lastClose = Number(bars[bars.length - 1]?.close);
    const span = bars.length
      ? Math.max(...bars.map(bar => Number(bar.high))) - Math.min(...bars.map(bar => Number(bar.low)))
      : 0;
    const step = span > 0 ? span / 3 : Math.abs(lastClose) * 0.001;
    return {
      ...instrument,
      quote: instrument.quote
        ? { ...instrument.quote, bid: Number(instrument.quote.bid) + 0.01, ask: Number(instrument.quote.ask) + 0.01 }
        : instrument.quote,
      levels: [
        { price: lastClose + step * 2, role: "derived", label: `derived ${(lastClose + step * 2).toFixed(2)}` },
        { price: lastClose + step, role: "seed", label: `seed ${(lastClose + step).toFixed(2)}` },
        { price: lastClose - step, role: "seed", label: `seed ${(lastClose - step).toFixed(2)}` },
        { price: lastClose - step * 2, role: "derived", label: `derived ${(lastClose - step * 2).toFixed(2)}` }
      ]
    };
  });
  snapshot.generated_at_utc = new Date().toISOString();
  snapshot.stale_after_seconds = 900;
  snapshot.account.orders_open = snapshot.orders.length;
  snapshot.account.positions_open = snapshot.positions.length;
  return snapshot;
}

function lanesDocument() {
  return {
    schema_version: "live-trading-lanes-v1",
    generated_at_utc: new Date().toISOString(),
    lanes: [
      {
        id: "ftmo-1",
        label: "FTMO account 1",
        enabled: true,
        feed: "data/live-trading.json",
        magic: 20261004,
        strategy: { grid: "full", r_multiple: 5 },
        account_login_masked: "***614",
        account_server: "FTMO-Server",
        status: "published",
        trader: { published: "data/live-trading-trader.ftmo-1.json" }
      },
      {
        id: "ftmo-2",
        label: "FTMO account 2",
        enabled: true,
        feed: "data/live-trading.account2.json",
        magic: 20261005,
        strategy: { grid: "half", r_multiple: 3 },
        account_login_masked: "***222",
        account_server: "FTMO-Server",
        status: "published",
        trader: { published: "data/live-trading-trader.ftmo-2.json" }
      }
    ]
  };
}

function heartbeat(lane) {
  return {
    schema_version: "live-trading-trader-status-v1",
    lane,
    host: { computer: "PC-LANE2", platform: "win32", checkout: lane },
    expected_interval_seconds: 300,
    at_utc: new Date().toISOString(),
    written_at_utc: new Date().toISOString(),
    armed: true,
    status: "nothing_to_place",
    strategy: { grid: lane === "ftmo-2" ? "half" : "full", r_multiple: lane === "ftmo-2" ? 3 : 5 },
    entries_paused: false,
    account: { login_masked: lane === "ftmo-2" ? "***222" : "***614", server: "FTMO-Server" },
    duration_seconds: 1
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function main() {
  const laneTwo = laneTwoSnapshot();
  const lanes = lanesDocument();
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const json = body => {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    if (pathname === "/data/live-trading-lanes.json") return json(lanes);
    if (pathname === "/data/live-trading.account2.json") return json(laneTwo);
    if (pathname === "/data/live-trading-trader.ftmo-1.json") return json(heartbeat("ftmo-1"));
    if (pathname === "/data/live-trading-trader.ftmo-2.json") return json(heartbeat("ftmo-2"));
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(REPO_ROOT, relativePath);
    if (!filePath.startsWith(REPO_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1500, height: 2400 });
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.click('button.tab-button[data-tab="live-trading"]');
    await page.locator("#liveTradingPanel .live-trading-lane-selector").waitFor();
    await page.locator("#liveTradingPanel .live-trading-chips", { hasText: /\*\*\*614/ }).waitFor();

    const shot = async name => {
      const file = path.join(OUT_DIR, name);
      await page.locator("#liveTradingPanel").screenshot({ path: file });
      return file;
    };

    const files = [];
    files.push(await shot("lane-1-ftmo-1.png"));
    await page.locator('[data-live-lane="ftmo-2"]').click();
    await page.locator("#liveTradingPanel .live-trading-chips", { hasText: /\*\*\*222/ }).waitFor();
    files.push(await shot("lane-2-ftmo-2.png"));
    await page.locator('[data-live-lane="ftmo-1"]').click();
    await page.locator("#liveTradingPanel .live-trading-chips", { hasText: /\*\*\*614/ }).waitFor();
    files.push(await shot("lane-3-back-to-ftmo-1.png"));

    process.stdout.write(`${JSON.stringify({ out: OUT_DIR, files }, null, 2)}\n`);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

main().catch(error => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});

