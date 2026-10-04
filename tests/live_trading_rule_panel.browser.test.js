// One browser test for the L2L entry rule as the page states it, run against the real page and the real
// artifacts.
//
// The rule has been a tested module since it was written and no page loaded it, so nothing on screen could
// say what any pair was waiting for. What is asserted here is that the page now states a stage for every one
// of the four pairs, that the stage it states is the one the shared module computes from the same artifacts
// - so the page and the checker cannot drift - and that a call whose own window has closed is refused rather
// than traded on. The second case hands the page live calls and a five-minute candle that really does close
// beyond a marked level, and holds it to the ticket the module produces for that candle: the three prices in
// the table, and the same three drawn on the chart.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const strategy = require("../lib/l2l_strategy.js");

const repoRoot = path.resolve(__dirname, "..");
const feedPath = path.join(repoRoot, "data", "live-trading.json");
const levelsPath = path.join(repoRoot, "data", "l2l-levels.json");
const layer1Path = path.join(repoRoot, "data", "layer1.json");

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

// The committed feed with every M5 block moved a week back in time, so the newest bar has certainly closed
// and the reading the page states does not depend on the clock this check happens to run on. Nothing else is
// touched: the quotes, the contract facts and the price neighbourhoods stay the published ones.
function oldBarsFeed() {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const week = 7 * 24 * 60 * 60 * 1000;
  feed.instruments.forEach(instrument => {
    const block = instrument.m5;
    if (!block || !Array.isArray(block.bars)) return;
    block.bars = block.bars.map(bar => ({ ...bar, time_utc: new Date(Date.parse(bar.time_utc) - week).toISOString() }));
  });
  return feed;
}

// The committed Layer 1 artifact with the calls moved a week into the past or a day into the future, so the
// two cases read the same whatever the clock says: an expired call is expired, and a live one is live.
function datedCalls(offsetMs, status) {
  const layer1 = JSON.parse(fs.readFileSync(layer1Path, "utf8"));
  const stamp = new Date(Date.now() + offsetMs).toISOString();
  layer1.agents.forEach(agent => {
    agent.expires_at = stamp;
    agent.forecast_window_end = stamp;
    agent.effective_status = status;
    agent.status_at_build = status;
    if (agent.priority_call) agent.priority_call.forecast_window_end = stamp;
  });
  return layer1;
}

async function startServer({ feed, levels, layer1 }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const send = body => {
      const text = typeof body === "string" ? body : JSON.stringify(body);
      res.writeHead(200, { "Content-Type": contentType(pathname), "Cache-Control": "no-store" });
      res.end(text);
    };

    if (pathname === "/data/live-trading.json") return send(feed);
    if (pathname === "/data/l2l-levels.json") return send(levels);
    if (pathname === "/data/layer1.json") return send(layer1);

    const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(fs.readFileSync(filePath));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  };
}

function ruleReadout() {
  const panel = document.querySelector("#liveTradingPanel .live-trading-rule-panel");
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  const rows = Array.from(panel.querySelectorAll("tbody tr"));
  const cell = (row, index) => text(row.children[index - 1]);
  return {
    meta: text(panel.querySelector(".live-trading-table-meta")),
    caption: text(panel.querySelector(".live-trading-table-caption")),
    headings: Array.from(panel.querySelectorAll("thead th")).map(text),
    assets: rows.map(row => text(row.querySelector(".live-trading-asset"))),
    symbols: rows.map(row => text(row.querySelector(".live-trading-table-symbol"))),
    calls: rows.map(row => text(row.querySelector(".live-trading-direction")) || text(row.querySelector("td .live-trading-stage"))),
    stages: rows.map(row => text(row.querySelectorAll("td")[1]?.querySelector(".live-trading-stage"))),
    limits: rows.map(row => cell(row, 7)),
    stops: rows.map(row => cell(row, 8)),
    targets: rows.map(row => cell(row, 9)),
    reads: rows.map(row => text(row.querySelector(".live-trading-rule-read")))
  };
}

function chartReadout() {
  const panel = document.getElementById("liveTradingPanel");
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  return {
    ruleLines: Array.from(panel.querySelectorAll(".live-trading-chart-rule")).map(node => node.getAttribute("class")),
    ruleTags: Array.from(panel.querySelectorAll(".live-trading-chart-rule-tag")).map(text),
    caption: text(panel.querySelector(".live-trading-chart-caption"))
  };
}

// What the module itself reads from the artifacts the fixture serves, with the calls the page will hand over.
// The page is held to these rows, so a page that drifted from the module fails here rather than in review.
function expectedRows(feed, levels, calls) {
  return strategy.strategyReadings({
    instruments: feed.instruments.map(instrument => ({
      symbol: instrument.symbol,
      dashboard_asset: instrument.dashboard_asset,
      levels: (levels.instruments.find(entry => entry.symbol === instrument.symbol) || {}).levels,
      m5: instrument.m5,
      point: instrument.point
    })),
    positions: Array.isArray(feed.positions) ? feed.positions : [],
    calls,
    nowMs: Date.now()
  });
}

// The directions the committed artifact publishes for the four pairs, read the way the page reads them. The
// fixture's calls are renewed so the window is open, but the directions themselves are the artifact's own, so
// a refresh that flips a pair does not silently invalidate this check.
function publishedCalls(layer1) {
  const calls = {};
  for (const asset of ["EUR", "GOLD", "NQ", "BTC"]) {
    const agent = (layer1.agents || []).find(entry => entry.agent === asset) || {};
    calls[asset] = agent.priority_call?.direction || agent.calls?.["24h"]?.direction || null;
  }
  return calls;
}

// Three five-minute candles whose newest close really does finish beyond the seed level in the direction the
// artifact published: for a long, a candle that closes below the level followed by one that closes above it;
// for a short, the mirror image. The crossing is written into the fixture rather than hoped for from the
// published neighbourhood.
const SEED_LEVEL = 84568.53;

function crossingBars(side, lastMs) {
  const at = offset => new Date(lastMs + offset * 60000).toISOString();
  const above = { open: 84500, high: 85000, low: 84600, close: 84900 };
  const below = { open: 84600, high: 84640, low: 84100, close: 84200 };
  const before = side === "long"
    ? { open: 84350, high: 84510, low: 84450, close: 84500 }
    : { open: 84600, high: 84640, low: 84500, close: 84600 };
  const crossing = side === "long" ? above : below;
  return [
    { time_utc: at(-3), open: 84300, high: 84400, low: 84250, close: 84350, tick_volume: 10 },
    { time_utc: at(-2), ...before, tick_volume: 10 },
    { time_utc: at(-1), ...crossing, tick_volume: 10 }
  ];
}

function priceText(value, digits = 2) {
  return Number(value).toFixed(digits);
}

test("a call whose own window has closed is refused, and every pair still gets a row", async () => {
  const feed = oldBarsFeed();
  const levels = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const server = await startServer({ feed, levels, layer1: datedCalls(-7 * 24 * 60 * 60 * 1000, "EXPIRED") });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector("#liveTradingPanel .live-trading-rule-panel tbody tr", { timeout: 20000 });

    const panel = await page.evaluate(ruleReadout);
    // Every pair the feed publishes has a row, whether or not it has a call and whether or not it has marks.
    assert.deepEqual(panel.assets, ["EUR", "GOLD", "NQ", "BTC"]);
    assert.deepEqual(panel.symbols, ["EURUSD", "XAUUSD", "US100.cash", "BTCUSD"]);
    assert.ok(panel.headings.includes("Layer 1 call") && panel.headings.includes("Target (5R)"));

    // The artifact's own calls ran out on 2026-09-08 and only the older call is still stored, so no direction
    // is read: the row says which call is there and when its window closed, and the stage is "no call".
    assert.deepEqual(panel.calls, ["NO LIVE CALL", "NO LIVE CALL", "NO LIVE CALL", "NO LIVE CALL"]);
    assert.deepEqual(panel.stages, ["NO CALL", "NO CALL", "NO CALL", "NO CALL"]);
    assert.match(panel.meta, /^4 pairs \u00b7 0 confirmed \u00b7 0 waiting \u00b7 0 blocked \u00b7 4 no call/);
    for (const read of panel.reads) assert.match(read, /takes no trade without one/);
    // No row states a ticket, because no row is confirmed.
    assert.deepEqual(panel.limits, ["\u2014", "\u2014", "\u2014", "\u2014"]);

    // And the page says on the panel itself that the table cannot trade.
    assert.match(panel.caption, /places, sizes, amends and cancels nothing/);
    assert.match(panel.caption, /window has closed is not read as a direction at all/);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("live calls and a close beyond a marked level produce the module's own ticket, table and chart alike", async () => {
  const feed = oldBarsFeed();
  const levels = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const layer1 = datedCalls(24 * 60 * 60 * 1000, "ACTIVE");
  const calls = publishedCalls(layer1);
  const btcSide = strategy.sideForDirection(calls.BTC);
  assert.ok(btcSide, `the committed artifact publishes a direction for BTC (${calls.BTC}), which is what this case is about`);

  // The BTCUSD block is replaced with three five-minute candles whose newest close really does finish beyond
  // the seed level, taken in the direction the artifact published for it.
  const btc = feed.instruments.find(instrument => instrument.symbol === "BTCUSD");
  const lastMs = Math.max(...btc.m5.bars.map(bar => Date.parse(bar.time_utc)));
  btc.m5.bars = crossingBars(btcSide, lastMs);

  const server = await startServer({ feed, levels, layer1 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector("#liveTradingPanel .live-trading-rule-panel tbody tr", { timeout: 20000 });

    const expected = expectedRows(feed, levels, calls);
    const panel = await page.evaluate(ruleReadout);
    // The page states exactly what the module reads for each pair, in the feed's own order, and the same
    // counts it takes from those rows.
    assert.deepEqual(panel.symbols, expected.map(row => row.symbol));
    assert.deepEqual(panel.stages, expected.map(row => row.stage.replace(/-/g, " ").toUpperCase()));
    const counts = expected.reduce((totals, row) => Object.assign(totals, { [row.stage]: (totals[row.stage] || 0) + 1 }), {});
    assert.equal(panel.meta, [
      `${expected.length} pairs`,
      `${counts.confirmed || 0} confirmed`,
      `${counts.waiting || 0} waiting`,
      `${counts.blocked || 0} blocked`,
      `${counts["no-call"] || 0} no call`,
      `${counts["no-levels"] || 0} no levels`,
      `${counts.unavailable || 0} unavailable`
    ].join(" \u00b7 "));

    const btcRow = expected.find(row => row.symbol === "BTCUSD");
    assert.equal(btcRow.stage, "confirmed", "the crafted candle closes beyond a marked level");
    assert.equal(btcRow.level.price, SEED_LEVEL, "the level crossed is the marked seed");
    assert.equal(btcRow.plan.entry, SEED_LEVEL);
    assert.equal(btcRow.plan.r_multiple, 5);

    // The ticket the module produced is the ticket the table states, price for price, and the sentence beside
    // it is the module's own.
    assert.equal(panel.stages[3], "CONFIRMED");
    assert.equal(panel.limits[3], priceText(btcRow.plan.entry));
    assert.equal(panel.stops[3], priceText(btcRow.plan.stop));
    assert.equal(panel.targets[3], priceText(btcRow.plan.target));
    assert.equal(panel.reads[3], btcRow.reason);
    // The calls are live and stated as the artifact published them.
    assert.deepEqual(panel.calls, ["EUR", "GOLD", "NQ", "BTC"].map(asset => calls[asset]));

    // And the same three prices are drawn on the chart, from the module's own marker list.
    await page.click('[data-live-chart-symbol="BTCUSD"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#liveTradingPanel .live-trading-chart-rule").length === 3,
      null,
      { timeout: 20000 }
    );
    const chart = await page.evaluate(chartReadout);
    const markers = strategy.planMarkerPrices(btcRow);
    assert.deepEqual(chart.ruleTags, markers.map(marker => marker.label));
    assert.deepEqual(chart.ruleLines, markers.map(marker => `live-trading-chart-rule ${marker.key}`));
    assert.match(chart.caption, new RegExp(
      `L2L rule CONFIRMED: limit ${priceText(btcRow.plan.entry)}, stop ${priceText(btcRow.plan.stop)}, target ${priceText(btcRow.plan.target)} \\(5R\\)`
    ));
  } finally {
    await browser.close();
    await server.close();
  }
});


