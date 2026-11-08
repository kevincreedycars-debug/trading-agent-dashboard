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
    // forty-eighth of the bars' own span away, so every one of the four marked lines and the three midpoints the half
    // grid inserts between them is inside the card's scale rather than off its edge.
    const step = span > 0 ? span / 24 : Math.abs(lastClose) * 0.0001;
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
  // One closed trade on this account's own paper, so the chart's position-size band has something to draw: the
  // tool's title states the lot, and 0.05 is a size lane 1 does not trade. Its two times are taken from the bars the
  // snapshot already carries, so the entry falls inside the window the chart draws.
  const eur = snapshot.instruments.find(instrument => instrument.symbol === "EURUSD");
  const eurBars = eur && Array.isArray(eur.m5?.bars) ? eur.m5.bars : [];
  snapshot.closed_trades = eurBars.length >= 2
    ? [{
      position_id: 900301,
      ticket: 900301,
      symbol: "EURUSD",
      dashboard_asset: "EUR",
      side: "buy",
      volume: 0.05,
      price_open: 1.1,
      price_close: 1.105,
      stop_loss: 1.0999,
      take_profit: 1.2,
      profit: 2.5,
      net_profit: 2.5,
      magic: 20261005,
      comment: "l2l-rule-eur",
      opened: { time_utc: eurBars[eurBars.length - 2].time_utc },
      closed: { time_utc: eurBars[eurBars.length - 1].time_utc }
    }]
    : [];
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

// What the selector has to get right on the picture rather than in the tables: the same symbol, drawn twice, with each
// lane's own levels, its own midpoints (only the half grid has them), its own entry band and its own position size.
// The readout is the page's own text - the full chart's level labels and entry band, the card's dashed midpoints and
// legend - because a chart that drew lane 1's prices under lane 2's name would look perfectly ordinary in a count.
function fullChartReadout() {
  const panel = document.getElementById("liveTradingPanel");
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  const drawn = Array.from(panel.querySelectorAll(".live-trading-chart-level-tag")).map(text);
  return {
    tags: drawn,
    levels: drawn.filter(tag => !tag.startsWith("midpoint ")),
    positionEntries: Array.from(panel.querySelectorAll(".live-trading-chart-position-label.entry"))
      .map(text)
      .filter(label => label.startsWith("ENTRY "))
      .map(label => Number(label.slice(6).replace(/,/g, ""))),
    toolTitles: Array.from(panel.querySelectorAll(".live-trading-chart-tool title")).map(text)
  };
}

// The card chart of one symbol: its marked lines and its dashed midpoints, as the geometry the card actually drew.
// Reading `y1` rather than counting classes is what lets a midpoint be checked against the lines it sits between.
function cardChartReadout(symbol) {
  const card = Array.from(document.querySelectorAll("#liveTradingPanel .live-trading-card"))
    .find(node => (node.querySelector(".live-trading-symbol")?.textContent || "").trim() === symbol);
  if (!card) return null;
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  const lines = Array.from(card.querySelectorAll(".live-trading-card-chart-level")).map(node => ({
    midpoint: node.classList.contains("midpoint"),
    y: Number(node.getAttribute("y1"))
  })).filter(line => Number.isFinite(line.y));
  return {
    lines,
    levels: lines.filter(line => !line.midpoint).length,
    midpoints: lines.filter(line => line.midpoint).length,
    legend: text(card.querySelector(".live-trading-card-chart-legend"))
  };
}

// Every drawn midpoint sits between an original line above it and one below it: the half grid inserts a line
// halfway, so a midpoint outside the marked lines it belongs to would be a line at a price nobody marked.
function midpointsSitBetweenLevels(readout, where) {
  const sorted = readout.lines.slice().sort((a, b) => a.y - b.y);
  for (let index = 0; index < sorted.length; index += 1) {
    if (!sorted[index].midpoint) continue;
    const above = sorted.slice(0, index).some(line => !line.midpoint);
    const below = sorted.slice(index + 1).some(line => !line.midpoint);
    assert.ok(above && below, `${where}: the midpoint at ${sorted[index].y} sits between two marked lines`);
  }
}

test("switching accounts redraws the levels, the midpoints, the entry band and the position size", async () => {
  const harness = await createHarness({ lanes: lanesDocument(), laneTwo: laneTwoSnapshot() });
  try {
    const { page } = await openLiveTrading(harness);
    await page.click('[data-live-chart-symbol="EURUSD"]');
    await page.waitForFunction(
      () => (document.querySelector("#liveTradingPanel .live-trading-chart-caption")?.textContent || "").trim().startsWith("EURUSD"),
      null,
      { timeout: 20000 }
    );

    const laneOne = await page.evaluate(fullChartReadout);
    assert.ok(laneOne.levels.length > 0, "lane 1 draws the marked ladder for EURUSD");
    const laneOneCards = await page.evaluate(cardChartReadout, "EURUSD");
    assert.equal(laneOneCards.midpoints, 0, "lane 1's grid is the marked one: no midpoints on the card either");

    await selectLane(page, "ftmo-2", "222");
    await page.waitForFunction(
      () => {
        const card = Array.from(document.querySelectorAll("#liveTradingPanel .live-trading-card"))
          .find(node => (node.querySelector(".live-trading-symbol")?.textContent || "").trim() === "EURUSD");
        return Boolean(card && card.querySelector(".live-trading-card-chart-level.midpoint"));
      },
      null,
      { timeout: 20000 }
    );

    // The card is the half grid: this account's marked lines, and a dashed midpoint between them. The midpoint is
    // checked against the lines around it rather than against a count, because the card draws only the lines its own
    // candles' scale reaches.
    const laneTwoCards = await page.evaluate(cardChartReadout, "EURUSD");
    assert.ok(laneTwoCards.midpoints >= 1, "the half grid inserts midpoints on this account's card");
    assert.ok(laneTwoCards.levels >= 2, "and keeps the marked lines they are inserted between");
    assert.ok(laneTwoCards.lines.length > laneTwoCards.levels, "a midpoint is its own line, not a relabelled level");
    midpointsSitBetweenLevels(laneTwoCards, "EURUSD on FTMO 2");
    assert.match(laneTwoCards.legend, /marked level/);
    assert.match(laneTwoCards.legend, /midpoint \(0\.5 grid\)/);

    const laneTwo = await page.evaluate(fullChartReadout);
    // The original levels are this account's own: labels drawn from lane 1's ladder are gone rather than blended in.
    assert.ok(laneTwo.levels.length > 0, "lane 2 draws its own marked ladder");
    const shared = laneTwo.levels.filter(tag => laneOne.levels.includes(tag));
    assert.deepEqual(shared, [], "none of lane 1's level labels survives the switch");

    // The entry band and the position size are this account's: 0.05 lot on lane 2, and the entry the table states.
    assert.ok(
      laneTwo.positionEntries.some(value => Math.abs(value - 1.1) < 1e-6),
      `lane 2's open position is drawn at its own entry: ${laneTwo.positionEntries.join(", ")}`
    );
    assert.ok(
      laneTwo.toolTitles.some(title => /EURUSD BUY 0\.05 lot/.test(title)),
      `lane 2's closed trade is drawn at its own size: ${laneTwo.toolTitles.join(" | ")}`
    );

    await selectLane(page, "ftmo-1", "614");
    const back = await page.evaluate(fullChartReadout);
    const backCards = await page.evaluate(cardChartReadout, "EURUSD");
    assert.equal(backCards.midpoints, 0, "switching back removes the midpoints");
    assert.equal(backCards.legend.includes("midpoint"), false, "and the legend stops naming them");
    assert.equal(back.positionEntries.some(value => Math.abs(value - 1.1) < 1e-6), false, "and lane 2's entry band");
    assert.deepEqual(back.toolTitles.filter(title => /0\.05 lot/.test(title)), [], "and lane 2's position size");
    await page.close();
  } finally {
    await harness.close();
  }
});


