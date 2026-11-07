// One selector, two accounts, and four charts that follow it.
//
// The page is served as shipped, with one controlled lanes document and a second account's snapshot built here:
// different login, different tickets, different lot sizes and a half grid. The test states the three things this
// control can get wrong - charts that do not move with the tables, a lane-2 chart quietly drawn from lane 1's
// numbers, and a Close offered on an account this page cannot date - and checks each one on the real script.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const laneOneSnapshot = readJson("data/live-trading.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

// The second account's snapshot: lane 1's instruments, with its own login, its own tickets and lot sizes, and a
// working entry so the tables have something to name. Every quote is nudged, so a chart drawn from the wrong file
// is a visible difference rather than a coincidence.
function laneTwoSnapshot({ ageSeconds = 0, withOrder = true } = {}) {
  const snapshot = JSON.parse(JSON.stringify(laneOneSnapshot));
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
  snapshot.orders = withOrder
    ? [{
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
    }]
    : [];
  snapshot.instruments = snapshot.instruments.map(instrument => {
    const bars = Array.isArray(instrument?.m5?.bars) ? instrument.m5.bars : [];
    const lastClose = Number(bars[bars.length - 1]?.close);
    const span = bars.length
      ? Math.max(...bars.map(bar => Number(bar.high))) - Math.min(...bars.map(bar => Number(bar.low)))
      : 0;
    // This account's own ladder, close enough to price to be drawn: two lines either side of the last close, a
    // third of the bars' own span away, so the chart shows the grid rather than a stripe with lines off its edge.
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
  snapshot.stale_after_seconds = 900;
  snapshot.account.orders_open = snapshot.orders.length;
  snapshot.account.positions_open = snapshot.positions.length;
  snapshot.generated_at_utc = new Date(Date.now() - ageSeconds * 1000).toISOString();
  return snapshot;
}

function lanesDocument({ laneTwoEnabled = true } = {}) {
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
        enabled: laneTwoEnabled,
        feed: "data/live-trading.account2.json",
        magic: 20261005,
        strategy: { grid: "half", r_multiple: 3 },
        account_login_masked: "***222",
        account_server: "FTMO-Server",
        status: laneTwoEnabled ? "published" : "disabled",
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

async function createHarness({ lanes, laneTwo = null } = {}) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const json = body => {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    if (pathname === "/data/live-trading-lanes.json") return json(lanes);
    if (pathname === "/data/live-trading.account2.json") {
      if (!laneTwo) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Not found");
      }
      return json(laneTwo);
    }
    if (pathname === "/data/live-trading-trader.ftmo-1.json") return json(heartbeat("ftmo-1"));
    if (pathname === "/data/live-trading-trader.ftmo-2.json") return json(heartbeat("ftmo-2"));
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  return {
    origin,
    browser,
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  };
}

async function openLiveTrading(harness) {
  const page = await harness.browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto(`${harness.origin}/`, { waitUntil: "domcontentloaded" });
  const button = page.locator('button.tab-button[data-tab="live-trading"]');
  await button.waitFor();
  await button.click();
  await page.locator("#liveTradingPanel .live-trading-lane-selector").waitFor();
  // The snapshot and the lanes document are fetched after the tab opens, so the first paint of the panel has an
  // empty account. Waiting for the primary lane's own masked login is waiting for that read to have landed.
  await page.locator("#liveTradingPanel .live-trading-chips", { hasText: /\*\*\*614/ }).waitFor();
  return { page, errors };
}

// Switching lanes and waiting for the paint that follows it: the button's own pressed state, then the account facts
// the next render carries, so an assertion never reads a half-drawn panel.
async function selectLane(page, id, login) {
  await page.locator(`[data-live-lane="${id}"]`).click();
  await page.locator(`[data-live-lane="${id}"][aria-pressed="true"]`).waitFor();
  await page.locator("#liveTradingPanel .live-trading-chips", { hasText: new RegExp(login) }).waitFor();
}


test("the selector opens on FTMO 1 and moves the charts, the tables and the account facts together", async () => {
  const harness = await createHarness({ lanes: lanesDocument(), laneTwo: laneTwoSnapshot() });
  try {
    const { page, errors } = await openLiveTrading(harness);
    // Default: the primary lane, five to one, no midpoints anywhere.
    assert.equal(await page.locator('[data-live-lane="ftmo-1"]').getAttribute("aria-pressed"), "true");
    assert.match(await page.locator(".live-trading-chips").innerText(), /\*\*\*614/);
    assert.equal(await page.locator("#liveTradingPanel .live-trading-card-chart-level.midpoint").count(), 0);

    await selectLane(page, "ftmo-2", "222");

    // The account facts and the tables followed the charts: lane 2's login, its ticket and its lot size.
    assert.match(await page.locator(".live-trading-chips").innerText(), /\*\*\*222/);
    const positions = await page.locator("#liveTradingPanel .live-trading-table-panel", { hasText: "Open positions" }).innerText();
    assert.match(positions, /900111/);
    assert.match(positions, /0\.05/);
    // The working-entry table can still fill while entries are paused, and it states that.
    const working = await page.locator("#liveTradingPanel .live-trading-table-panel", { hasText: "Working entries" }).innerText();
    assert.match(working, /900222/);
    assert.match(working, /0\.1/);
    // The four charts are the half grid: midpoint lines are drawn, and the legend says which line is which.
    assert.ok(await page.locator("#liveTradingPanel .live-trading-card-chart-level.midpoint").count() > 0, "midpoints drawn");
    const legend = await page.locator("#liveTradingPanel .live-trading-card-chart-legend").first().innerText();
    assert.match(legend, /marked level/);
    assert.match(legend, /midpoint/);

    await selectLane(page, "ftmo-1", "614");
    assert.equal(await page.locator("#liveTradingPanel .live-trading-card-chart-level.midpoint").count(), 0, "lane 1 has no midpoints");
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("a parked second lane is drawn as parked, and never as lane 1's numbers", async () => {
  const harness = await createHarness({ lanes: lanesDocument({ laneTwoEnabled: false }), laneTwo: laneTwoSnapshot() });
  try {
    const { page } = await openLiveTrading(harness);
    await page.locator('[data-live-lane="ftmo-2"]').click();
    await page.locator(".live-trading-lane-notice").waitFor();
    assert.match(await page.locator(".live-trading-lane-notice").innerText(), /parked/i);
    assert.equal(await page.locator("#liveTradingPanel .live-trading-card").count(), 0, "no charts are drawn from lane 1");
    assert.doesNotMatch(await page.locator(".live-trading-chips").innerText(), /\*\*\*614/);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("a missing second lane says so and offers no ticket action", async () => {
  const harness = await createHarness({ lanes: lanesDocument(), laneTwo: null });
  try {
    const { page } = await openLiveTrading(harness);
    await page.locator('[data-live-lane="ftmo-2"]').click();
    await page.locator(".live-trading-lane-notice").waitFor();
    assert.match(await page.locator(".live-trading-lane-notice").innerText(), /no snapshot here/i);
    assert.equal(await page.locator("#liveTradingPanel .live-trading-close-button").count(), 0);
    assert.equal(await page.locator("#liveTradingPanel .live-trading-card").count(), 0);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("a stale second lane is labelled stale and its positions cannot be closed from here", async () => {
  const harness = await createHarness({ lanes: lanesDocument(), laneTwo: laneTwoSnapshot({ ageSeconds: 7200 }) });
  try {
    const { page } = await openLiveTrading(harness);
    await page.locator('[data-live-lane="ftmo-2"]').click();
    await page.locator(".live-trading-lane-notice").waitFor();
    assert.match(await page.locator(".live-trading-lane-notice").innerText(), /stale/i);
    // Its figures are still drawn - they are real, just old - and no Close is offered against them.
    assert.ok(await page.locator("#liveTradingPanel .live-trading-card").count() > 0);
    assert.equal(await page.locator("#liveTradingPanel .live-trading-close-button").count(), 0);
    assert.match(await page.locator(".live-trading-close-other").first().innerText(), /unverified/);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("the Close control names the ticket of the lane on screen and refuses the other lane's", async () => {
  const laneTwo = laneTwoSnapshot();
  // Lane 2's own position is 900111; lane 1's snapshot carries two positions of its own magic.
  const harness = await createHarness({ lanes: lanesDocument(), laneTwo });
  try {
    const { page } = await openLiveTrading(harness);
    const laneOneButtons = await page.locator("#liveTradingPanel .live-trading-close-button").count();
    assert.ok(laneOneButtons > 0, "lane 1's own positions carry a Close");
    await selectLane(page, "ftmo-2", "222");
    const laneTwoButtons = page.locator("#liveTradingPanel .live-trading-close-button");
    assert.equal(await laneTwoButtons.count(), 1, "exactly lane 2's one position carries a Close");
    assert.equal(await laneTwoButtons.first().getAttribute("data-live-close-ask"), "900111");
    await page.close();
  } finally {
    await harness.close();
  }
});
