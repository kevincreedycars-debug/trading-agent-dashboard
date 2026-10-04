// One browser test for zooming the M5 price pane, run against the real page and the real feed.
//
// The user's requirement is a floor rather than a feature: however far the five-minute chart is magnified,
// the two nearest marked levels each side have to stay on the picture, because that is the level a
// five-minute close is read against. What is asserted here is that the zoom control changes the number of
// bars drawn, that the price scale is rebuilt from those bars - so two marked lines above and two below
// survive every step - that the ends of the ladder are the ends, and that the reader's magnification is
// still there after a reload and answers the wheel over the pane.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const feedPath = path.join(repoRoot, "data", "live-trading.json");
const levelsPath = path.join(repoRoot, "data", "l2l-levels.json");

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
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
  const zoomButton = direction => panel.querySelector(`[data-live-chart-zoom="${direction}"]`);
  return {
    bars: panel.querySelectorAll(".live-trading-chart-body").length,
    volumes: panel.querySelectorAll(".live-trading-chart-volume").length,
    lines: panel.querySelectorAll(".live-trading-chart-level").length,
    levelBoxes: Array.from(panel.querySelectorAll(".live-trading-chart-level-box-text"))
      .map(node => Number(text(node).replace(/,/g, ""))),
    caption: text(panel.querySelector(".live-trading-chart-caption")),
    zoomIn: Boolean(zoomButton("1") && !zoomButton("1").disabled),
    zoomOut: Boolean(zoomButton("-1") && !zoomButton("-1").disabled)
  };
}

test("the M5 pane zooms, and two marked levels each side survive every step", async () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const levels = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const btcBars = feed.instruments.find(instrument => instrument.symbol === "BTCUSD").m5.bars;
  assert.equal(btcBars.length, 120, "the feed publishes 120 M5 bars for BTCUSD");

  const server = await startServer({ feed, levels });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector('[data-live-chart-symbol="BTCUSD"]', { timeout: 20000 });
    await page.click('[data-live-chart-symbol="BTCUSD"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#liveTradingPanel .live-trading-chart-body").length === 120,
      null,
      { timeout: 20000 }
    );

    // The floor, checked at every magnification: the drawn bars are the newest `drawn` of the block, and at
    // least two marked lines sit above their high and two below their low, which is what the rule reads.
    const checkWindow = async (drawn, step) => {
      await page.waitForFunction(
        count => document.querySelectorAll("#liveTradingPanel .live-trading-chart-body").length === count,
        drawn,
        { timeout: 10000 }
      );
      const readout = await page.evaluate(chartReadout);
      assert.equal(readout.bars, drawn, `zoom ${step}\u00d7 draws ${drawn} bars`);
      // The volume histogram and the level lines are drawn from the same window, so the canvas moves together.
      assert.equal(readout.volumes, drawn, `zoom ${step}\u00d7 draws a volume bar for every bar`);
      const window = btcBars.slice(btcBars.length - drawn);
      const prices = window.flatMap(bar => [Number(bar.high), Number(bar.low)]);
      const top = Math.max(...prices);
      const bottom = Math.min(...prices);
      const above = readout.levelBoxes.filter(price => price > top).length;
      const below = readout.levelBoxes.filter(price => price < bottom).length;
      assert.ok(above >= 2, `zoom ${step}\u00d7 draws ${above} marked lines above the bars; the rule reads two`);
      assert.ok(below >= 2, `zoom ${step}\u00d7 draws ${below} marked lines below the bars; the rule reads two`);
      assert.equal(readout.lines, readout.levelBoxes.length, "every drawn line is priced on the scale");
      return readout;
    };

    // Every published bar, and nothing further to zoom out to.
    const opening = await checkWindow(120, 1);
    assert.match(opening.caption, /all 120 M5 bars drawn/);
    assert.equal(opening.zoomOut, false, "the widest view has nothing further to zoom out to");
    assert.equal(opening.zoomIn, true);

    // Each press halves the window, and the caption says which window it is rather than leaving it to be
    // counted off the picture.
    await page.click('[data-live-chart-zoom="1"]');
    const half = await checkWindow(60, 2);
    assert.match(half.caption, /60 of 120 M5 bars drawn \(zoom 2\u00d7\)/);

    // The magnification is the reader's, so it survives a reload the way the symbol and the scale do.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    const reloaded = await checkWindow(60, 2);
    assert.match(reloaded.caption, /60 of 120 M5 bars drawn/);

    await page.click('[data-live-chart-zoom="1"]');
    await checkWindow(30, 4);
    await page.click('[data-live-chart-zoom="1"]');
    const closest = await checkWindow(15, 8);
    assert.equal(closest.zoomIn, false, "the closest step is the end of the ladder");
    assert.equal(closest.zoomOut, true);

    // Zooming back out is the same control in the other direction.
    await page.click('[data-live-chart-zoom="-1"]');
    await checkWindow(30, 4);

    // A wheel over the price pane zooms it, the way a terminal does.
    await page.hover(".live-trading-chart-plot");
    await page.mouse.wheel(0, -120);
    await checkWindow(15, 8);

    // And the ladder is still reachable in one click at the closest magnification, so zooming in never hides a
    // published line: it is drawn, or counted on the tab that brings it back.
    await page.click("#liveTradingPanel .live-trading-chart-level-edge.below rect");
    await page.waitForFunction(
      () => document.querySelectorAll("#liveTradingPanel .live-trading-chart-level").length === 22,
      null,
      { timeout: 10000 }
    );
    const fitted = await page.evaluate(chartReadout);
    assert.equal(fitted.bars, 15, "fitting the ladder to the scale does not change the window of bars");
  } finally {
    await browser.close();
    await server.close();
  }
});

