// One browser test for the marked levels on the live chart, run against the real page and the real feed.
//
// The user's report is why it exists: the marks were published and the chart showed none of them. A BTCUSD
// ladder step is about 1,455 points while the 120 M5 bars the window draws span a few hundred, so every
// marked line sat outside the price scale. What is asserted here is that the ladder is still visible: the two
// nearest lines each side of the bars are drawn on the scale by default - the levels a five-minute close is
// read against - and the rest are counted on a tab on the edge they sit past, naming how many and the nearest
// price. That tab fits the whole ladder in one click, and the reader's choice of scale survives a reload
// instead of resetting to a chart with their own lines off-screen again.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const store = require("../lib/l2l_levels_store.js");

const repoRoot = path.resolve(__dirname, "..");
const feedPath = path.join(repoRoot, "data", "live-trading.json");
const STAMP = "2026-10-04T12:00:00.000Z";
const SPOT = 85170.6;

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

// The user's own shape, built through the shared module so the fixture cannot drift from the document the
// page reads: two hand-marked BTCUSD seeds and the ladder the dashboard derives from the distance between
// them, which is the ladder committed in data/l2l-levels.json.
function markedLevelsState() {
  let state = store.createEmptyState(STAMP, store.MARKED_BY.dashboard);
  [83113.66, 84568.53].forEach(price => {
    const edit = store.normaliseEdit({ action: "add", symbol: "BTCUSD", price, kind: "l2l", direction: "both", timeframe: "H1" }, STAMP);
    assert.equal(edit.error, undefined, edit.error);
    const applied = store.applyLevelEdit(state, edit.edit, STAMP);
    assert.equal(applied.error, undefined, applied.error);
    state = applied.state;
  });
  const duplicate = store.normaliseEdit({ action: "duplicate", symbol: "BTCUSD", timeframe: "H1" }, STAMP);
  assert.equal(duplicate.error, undefined, duplicate.error);
  const derived = store.applyLevelEdit(state, duplicate.edit, STAMP);
  assert.equal(derived.error, undefined, derived.error);
  assert.equal(derived.state.instruments.find(entry => entry.symbol === "BTCUSD").levels.length, 22);
  return derived.state;
}

// The committed feed with its BTCUSD M5 bars pulled tight around one price, so the window the chart draws is
// the same on every run and the ladder is guaranteed to be outside it. Nothing else in the feed is touched.
function tightBtcFeed() {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const instrument = (feed.instruments || []).find(entry => entry.symbol === "BTCUSD");
  assert.ok(instrument && instrument.m5 && Array.isArray(instrument.m5.bars), "the committed feed carries BTCUSD M5 bars");
  const bars = instrument.m5.bars;
  instrument.m5.bars = bars.map((bar, index) => {
    const close = Number((SPOT + (index - bars.length) * 0.25).toFixed(2));
    return { ...bar, open: close - 0.4, high: close + 0.6, low: close - 0.8, close };
  });
  instrument.m5.range_high = SPOT + 1;
  instrument.m5.range_low = SPOT - bars.length * 0.25;
  instrument.quote = { ...(instrument.quote || {}), bid: SPOT, ask: SPOT + 1 };
  return feed;
}

async function startServer({ feed, levels }) {
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

function chartReadout() {
  const panel = document.getElementById("liveTradingPanel");
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  return {
    lines: panel.querySelectorAll(".live-trading-chart-level").length,
    // Every drawn line carries its price in the axis box beside it, which is what the per-symbol check below
    // reads: the tag beside a line names the level, the box names the price on the scale.
    levelBoxes: Array.from(panel.querySelectorAll(".live-trading-chart-level-box-text"))
      .map(node => Number(text(node).replace(/,/g, ""))),
    edges: Array.from(panel.querySelectorAll(".live-trading-chart-level-edge")).map(text),
    caption: text(panel.querySelector(".live-trading-chart-caption")),
    chips: text(panel.querySelector(".live-trading-chart-levels")),
    fitActive: Boolean(panel.querySelector(".live-trading-chart-mode.active[data-live-chart-fit-levels]")),
    symbolActive: Boolean(panel.querySelector('.live-trading-chart-symbols .active[data-live-chart-symbol="BTCUSD"]'))
  };
}


test("the nearest marked lines each side are drawn, the rest is stated on the edges, and the scale survives a reload", async () => {
  const levels = markedLevelsState();
  const server = await startServer({ feed: tightBtcFeed(), levels });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector('[data-live-chart-symbol="BTCUSD"]', { timeout: 20000 });
    await page.click('[data-live-chart-symbol="BTCUSD"]');
    // The marks are read from the artifact the page fetches, not from a fixture inside the page.
    await page.waitForFunction(
      () => (document.getElementById("liveTradingPanel")?.textContent || "").includes("83113.66"),
      null,
      { timeout: 20000 }
    );

    const offScale = await page.evaluate(chartReadout);
    assert.equal(offScale.symbolActive, true);
    // The two nearest lines each side of the bars are on the scale before the reader touches anything: the
    // level above and the level below are what a five-minute close is read against.
    assert.equal(offScale.lines, 4, "the two nearest marked lines each side of the bars are drawn");
    assert.equal(offScale.edges.length, 2, "one tab on each edge says where the lines past the scale are");
    assert.match(offScale.edges[0], /^\u25b2 8 levels above \u00b7 nearest 88933\.14 \u00b7 click to fit$/);
    assert.match(offScale.edges[1], /^\u25bc 10 levels below \u00b7 nearest 81658\.79 \u00b7 click to fit$/);
    assert.match(offScale.caption, /2 seed levels \u00b7 20 derived \u00b7 4\/22 lines in view \(8 above, 10 below\)/);
    assert.match(offScale.caption, /ladder 68564\.96 to 99117\.23/);
    assert.match(offScale.chips, /83113\.66/);
    assert.equal(offScale.fitActive, false, "Fit levels is off: the scale stops at the nearest lines, not at the outermost one");

    // The tab is the Fit levels control, so the whole ladder is one click from being drawn.
    await page.click("#liveTradingPanel .live-trading-chart-level-edge.below rect");
    await page.waitForFunction(
      () => document.querySelectorAll("#liveTradingPanel .live-trading-chart-level").length === 22,
      null,
      { timeout: 5000 }
    );
    const fitted = await page.evaluate(chartReadout);
    assert.equal(fitted.lines, 22, "every marked line is drawn once the scale is fitted to them");
    assert.equal(fitted.edges.length, 0, "and nothing is left stated on the edge");
    assert.equal(fitted.fitActive, true);
    assert.match(fitted.caption, /22\/22 lines in view/);

    // The reader's view is remembered: the same symbol, drawn with the same scale, on the next load.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#liveTradingPanel .live-trading-chart-level").length === 22,
      null,
      { timeout: 20000 }
    );
    const reloaded = await page.evaluate(chartReadout);
    assert.equal(reloaded.symbolActive, true, "the symbol the reader chose is the one drawn after a reload");
    assert.equal(reloaded.fitActive, true, "and the fitted scale is still the one in force");
    assert.equal(reloaded.lines, 22);
    assert.equal(reloaded.edges.length, 0);
  } finally {
    await browser.close();
    await server.close();
  }
});

// The user's question is per pair, so every symbol the feed publishes is opened in turn against the committed
// levels artifact and the committed feed - not a fixture - and the price scale is measured against that
// symbol's own bars. The floor is two marked lines above the bars and two below: the entry rule is a
// five-minute close beyond a level, so the level above and the level below the price have to be on the scale
// wherever the price happens to be, without the reader pressing Fit levels. A symbol the artifact carries no
// levels for has nothing to draw, and is held to that instead of to the floor.
test("every symbol the artifact marks draws at least two lines each side of its own bars", async () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const levels = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "l2l-levels.json"), "utf8"));
  const server = await startServer({ feed, levels });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector('[data-live-chart-symbol="EURUSD"]', { timeout: 20000 });

    for (const entry of store.KNOWN_INSTRUMENTS) {
      const instrument = (feed.instruments || []).find(row => row.symbol === entry.symbol) || {};
      const marked = ((levels.instruments || []).find(row => row.symbol === entry.symbol) || {}).levels || [];
      const bars = instrument.m5 && Array.isArray(instrument.m5.bars) ? instrument.m5.bars : [];
      assert.ok(bars.length, `the feed publishes ${entry.dashboard_asset} M5 bars to measure the scale against`);

      await page.click(`[data-live-chart-symbol="${entry.symbol}"]`);
      // The caption opens with the symbol, so it is the signal that this chart and not the last one is drawn.
      await page.waitForFunction(
        symbol => (document.querySelector("#liveTradingPanel .live-trading-chart-caption")?.textContent || "")
          .trim()
          .startsWith(symbol),
        entry.symbol,
        { timeout: 20000 }
      );

      const readout = await page.evaluate(chartReadout);
      assert.equal(readout.lines, readout.levelBoxes.length, `${entry.dashboard_asset} prices every line it draws`);
      if (!marked.length) {
        assert.equal(readout.lines, 0, `${entry.dashboard_asset} marks no levels, so the chart draws none`);
        continue;
      }
      const prices = bars.flatMap(bar => [Number(bar.high), Number(bar.low)]);
      const barsTop = Math.max(...prices);
      const barsBottom = Math.min(...prices);
      const above = readout.levelBoxes.filter(price => price > barsTop).length;
      const below = readout.levelBoxes.filter(price => price < barsBottom).length;
      assert.ok(above >= 2, `${entry.dashboard_asset} draws ${above} marked lines above its bars; the rule reads two`);
      assert.ok(below >= 2, `${entry.dashboard_asset} draws ${below} marked lines below its bars; the rule reads two`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
