// One browser test for the Live Trading section's read-back: the two tables the section draws from the
// snapshot's own `positions` and `closed_trades`.
//
// The contract tests in tests/live_trading_feed.test.js already hold the artifact to its shape and the
// validator to its rules. What they cannot see is whether any of it reaches a screen, so this test loads the
// real page against a real v3 snapshot - the committed artifact with the round trip of 2026-10-04 (BTCUSD
// 0.01 lot, entry 85230.34, exit 85248.89, net -0.37) injected into it - and reads the rendered text back.
// The feed is injected rather than served as committed so the test does not depend on that trade still
// being inside the snapshot's own fourteen-day window.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const feedPath = path.join(repoRoot, "data", "live-trading.json");

const STAMP_OPEN_SERVER = "2026-10-04T16:47:59+00:00";
const STAMP_OPEN_UTC = "2026-10-04T13:47:59+00:00";
const STAMP_CLOSE_SERVER = "2026-10-04T16:49:24+00:00";
const STAMP_CLOSE_UTC = "2026-10-04T13:49:24+00:00";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

// The committed snapshot, with one open position and one closed trade added: the trade this lane actually
// placed and closed on 2026-10-04, so the numbers asserted below are a real round trip rather than invented
// ones.
function feedWithRoundTrip() {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  feed.generated_at_utc = new Date().toISOString();
  feed.stale_after_seconds = 900;
  feed.account.positions_open = 1;
  feed.positions = [
    {
      ticket: 297645550,
      symbol: "BTCUSD",
      dashboard_asset: "BTC",
      side: "buy",
      volume: 0.01,
      price_open: 85230.34,
      price_current: 85248.91,
      stop_loss: null,
      take_profit: null,
      profit: 0.19,
      swap: 0,
      floating_pct: 0.0218,
      magic: 20261004,
      comment: "live-trading-loop-proof",
      opened: { time_server: STAMP_OPEN_SERVER, time_utc: STAMP_OPEN_UTC },
      updated: { time_server: STAMP_OPEN_SERVER, time_utc: STAMP_OPEN_UTC }
    }
  ];
  feed.closed_trades = [
    {
      position_id: 297645550,
      symbol: "BTCUSD",
      dashboard_asset: "BTC",
      side: "buy",
      volume: 0.01,
      price_open: 85230.34,
      price_close: 85248.89,
      profit: 0.19,
      commission: -0.56,
      swap: 0,
      net_profit: -0.37,
      magic: 20261004,
      comment: "live-trading-loop-proof",
      deal_count: 2,
      entry_deal: 278466153,
      exit_deal: 278466158,
      opened: { time_server: STAMP_OPEN_SERVER, time_utc: STAMP_OPEN_UTC },
      closed: { time_server: STAMP_CLOSE_SERVER, time_utc: STAMP_CLOSE_UTC },
      duration_seconds: 85
    }
  ];
  feed.history.closed_positions = 1;
  feed.history.deal_count = 3;
  return feed;
}

async function startServer(feed) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

    if (pathname === "/data/live-trading.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(feed));
      return;
    }

    const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(fs.readFileSync(filePath));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

test("the Live Trading section renders the position and the closed trade it read back", async () => {
  const server = await startServer(feedWithRoundTrip());
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    // The section renders twice: once immediately, from whatever `liveTradingData` holds, and again when the
    // snapshot fetch resolves. Waiting for the rows themselves rather than for the panels is what makes this
    // an assertion about the read-back instead of a race with the first paint.
    await page.waitForFunction(
      () => {
        const panel = document.getElementById("liveTradingPanel");
        return Boolean(panel && panel.querySelectorAll(".live-trading-table-panel tbody tr").length === 2);
      },
      null,
      { timeout: 20000 }
    );
    const panels = await page.$$("#liveTradingPanel .live-trading-table-panel");
    assert.equal(panels.length, 2, "one panel for the open positions and one for the closed trades");

    const positions = await panels[0].innerText();
    assert.match(positions, /open positions/i);
    assert.match(positions, /1 open · floating \+0\.19 USD/);
    assert.match(positions, /BTCUSD/);
    assert.match(positions, /BUY/);
    assert.match(positions, /85230\.34/);
    assert.match(positions, /85248\.91/);
    assert.match(positions, /\+0\.19/);
    assert.match(positions, /#297645550/);
    assert.match(positions, /20261004/, "the ticket cell carries the magic the order tool stamps");
    assert.match(positions, /13:47Z/, "the position's own open time, in UTC");

    const closed = await panels[1].innerText();
    assert.match(closed, /closed trades/i);
    assert.match(closed, /1 closed in the last 14 days · net -0\.37 USD/);
    assert.match(closed, /13:49Z/, "the close time, newest first");
    assert.match(closed, /85230\.34/);
    assert.match(closed, /85248\.89/);
    assert.match(closed, /1m 25s/, "the 85 seconds it was held");
    assert.match(closed, /-0\.56/, "the commission that turned +0.19 into -0.37");
    assert.match(closed, /-0\.37/);

    // And the empty state on a snapshot with nothing open says which of the two facts it is. (The feed is
    // re-read in the page rather than taken from a global: the section's data lives in a block-scoped
    // binding, and only `renderLiveTrading` itself is reachable.)
    await page.evaluate(async () => {
      const feed = await (await fetch("./data/live-trading.json", { cache: "no-store" })).json();
      feed.generated_at_utc = new Date().toISOString();
      feed.account.positions_open = 0;
      feed.positions = [];
      renderLiveTrading(feed);
    });
    const empty = await page.innerText("#liveTradingPanel .live-trading-table-panel");
    assert.match(empty, /None open on this account/);
    assert.match(empty, /Nothing is open, so there is no position to read back/);
  } finally {
    await browser.close();
    await server.close();
  }
});

