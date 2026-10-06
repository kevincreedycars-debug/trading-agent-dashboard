// One browser test for dragging the M5 price pane, run against the real page and the real feed.
//
// The reader's request is the feature: the wheel zooms the window, and the hand moves it. What is asserted
// here is that a drag slides the window through the published block and pushes the price scale with it, that
// the caption and the legend name the window the pane is really drawing rather than the block it came from,
// that both axes stop at their ends, that a double click is the way back to the view the page opens on, and
// that a pan is never also a mark: the click a drag ends in is swallowed once, and the click after it still
// marks the level it was aimed at.
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

// Everything the assertions read off the page, in one pass: the picture as it is drawn, the numbers the
// caption states about it and the legend's own copy of the bar it is showing. The level lines and their price
// boxes are emitted a level at a time, so index i of those two lists is the same line.
function chartReadout() {
  const panel = document.getElementById("liveTradingPanel");
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  const svg = panel.querySelector(".live-trading-chart-svg");
  const rect = svg ? svg.getBoundingClientRect() : null;
  const viewBox = String(svg?.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  const bodies = Array.from(panel.querySelectorAll(".live-trading-chart-body"));
  const plot = panel.querySelector(".live-trading-chart-plot");
  let last = null;
  try {
    last = JSON.parse(panel.querySelector("[data-live-chart-legend]")?.dataset?.liveLast || "null");
  } catch (err) {
    last = null;
  }
  return {
    bars: bodies.length,
    volumes: panel.querySelectorAll(".live-trading-chart-volume").length,
    lines: panel.querySelectorAll(".live-trading-chart-level").length,
    levelPrices: Array.from(panel.querySelectorAll(".live-trading-chart-level-box-text"))
      .map(node => Number(text(node).replace(/,/g, ""))),
    levelYs: Array.from(panel.querySelectorAll(".live-trading-chart-level"))
      .map(node => Number(node.getAttribute("y1"))),
    barXs: bodies.map(node => Number(node.getAttribute("x"))),
    barYs: bodies.map(node => Number(node.getAttribute("y"))),
    caption: text(panel.querySelector(".live-trading-chart-caption")),
    markStatus: text(panel.querySelector(".live-trading-chart-mark-status")),
    levels: panel.querySelectorAll("[data-live-level-remove]").length,
    panning: Boolean(plot && plot.classList.contains("panning")),
    // The crosshair as the pointer last left it: null when it is put away, and otherwise the height it was drawn
    // at, so a drag can be read as taking the reading away and putting it back.
    crosshair: (() => {
      const group = plot?.querySelector?.(".live-trading-chart-crosshair");
      if (!group || group.style.display === "none") return null;
      const line = group.querySelector(".live-trading-chart-crosshair-x");
      return line ? Number(line.getAttribute("y1")) : null;
    })(),
    last,
    // The box the canvas is fitted into and the canvas the page thinks in, which is what turns the pointer's
    // pixels into the numbers the drag moves the pane by.
    frame: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    canvas: { width: Number(viewBox[2]), height: Number(viewBox[3]) }
  };
}


test("the M5 pane is dragged by the hand, and a pan never also marks a level", async () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const levels = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const btcBars = feed.instruments.find(instrument => instrument.symbol === "BTCUSD").m5.bars;
  const total = btcBars.length;
  assert.equal(total, 120, "the feed publishes 120 M5 bars for BTCUSD");

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

    // The pane a drag is measured on: the newest half of the block, so a slide of ten bars has room to move in
    // both directions. `factor` is the page's own fit of the canvas into its box and `pitch` the canvas' bar
    // spacing, so a drag of ten bars is ten of those pitches times that factor, in the browser's own pixels.
    await page.click('[data-live-chart-zoom="1"]');
    await page.waitForFunction(
      () => document.querySelectorAll("#liveTradingPanel .live-trading-chart-body").length === 60,
      null,
      { timeout: 10000 }
    );
    const opening = await page.evaluate(chartReadout);
    assert.match(opening.caption, /60 of 120 M5 bars drawn \(zoom 2\u00d7\)/);
    assert.equal(opening.bars, 60);
    assert.equal(opening.volumes, 60, "the volume histogram is drawn from the window the bars are drawn from");
    assert.equal(opening.last.close, Number(btcBars[total - 1].close), "the legend opens on the newest bar");
    assert.equal(opening.last.high, Number(btcBars[total - 1].high), "and carries the whole bar, not just its close");
    assert.doesNotMatch(opening.caption, /dragged/, "the page opens on a view nothing has dragged");
    assert.equal(opening.panning, false, "and on a picture the hand is not on");
    assert.equal(opening.crosshair, null, "and the crosshair is away, because the pointer is not on the canvas");

    const factor = Math.min(
      opening.frame.width / opening.canvas.width,
      opening.frame.height / opening.canvas.height
    );
    const pitch = Math.abs(opening.barXs[1] - opening.barXs[0]);
    assert.ok(factor > 0 && pitch > 0, "the canvas is laid out, so a drag in bars can be measured in pixels");
    const barPixels = pitch * factor;

    // One gesture: press, move, release, with the pane read between the two moves as well, so the class the drag
    // puts on the picture while it is in flight is checked rather than assumed.
    const drag = async (dx, dy) => {
      const from = await page.evaluate(chartReadout);
      const x = from.frame.x + from.frame.width / 2;
      const y = from.frame.y + from.frame.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
      const mid = await page.evaluate(chartReadout);
      await page.mouse.move(x + dx, y + dy, { steps: 4 });
      await page.mouse.up();
      return { mid, after: await page.evaluate(chartReadout) };
    };
    const clickCenter = async () => {
      const at = await page.evaluate(chartReadout);
      await page.mouse.click(at.frame.x + at.frame.width / 2, at.frame.y + at.frame.height / 2);
    };
    // How far back from the newest bar the caption says the window has been slid. Zero is the view the page
    // opens on, which is the only state with no pan in the caption at all.
    const draggedBack = caption => {
      const match = caption.match(/dragged (\d+) bars? back from the newest/);
      return match ? Number(match[1]) : 0;
    };
    const pricePan = caption => caption.match(/dragged the price scale ([\d.]+)% (up|down)/);
    // The published lines by price: a line is worth comparing before and after only by its price, because a
    // drag that moves the scale can bring a different line onto the picture.
    const lineYs = readout => new Map(readout.levelPrices.map((price, index) => [price, readout.levelYs[index]]));

    // Ten bars to the right: the window slides back through the published block, the picture keeps its sixty
    // bars, and both the caption and the legend name the older window rather than the block's newest bar.
    const right = await drag(10 * barPixels, 0);
    assert.equal(right.mid.panning, true, "the pane carries the drag class while the hand is on it");
    assert.equal(right.after.panning, false, "and puts it away when the hand comes off");
    assert.equal(
      right.mid.crosshair,
      null,
      "a drag in flight takes the crosshair away, because the hand is moving the picture rather than reading a bar"
    );
    assert.ok(
      Number.isFinite(right.after.crosshair),
      `and the release puts it back at the point the hand let go (read ${right.after.crosshair})`
    );
    assert.ok(
      right.after.crosshair >= 0 && right.after.crosshair <= right.after.canvas.height,
      "on the pane it belongs to, rather than where the scale has since been pushed to"
    );
    assert.equal(right.after.bars, 60, "a slide keeps the same number of bars on the picture");
    assert.equal(right.after.volumes, 60, "and the same volume bars under them");
    assert.equal(pricePan(right.after.caption), null, "a sideways drag moves no price");
    const back = draggedBack(right.after.caption);
    assert.ok(back >= 9 && back <= 11, `dragging ten bars to the right says ${back} bars back`);
    const shown = total - 1 - back;
    assert.equal(right.after.last.close, Number(btcBars[shown].close), `the legend follows the slide back to bar ${shown}`);
    assert.equal(right.after.last.high, Number(btcBars[shown].high), "and reads the whole of that bar");
    // The floor the zoom is held to as well, on the window the drag is really drawing: two published lines each
    // side of those bars, so a five-minute close is still read against a level while the window is slid.
    const drawn = btcBars.slice(total - 60 - back, total - back);
    const drawnPrices = drawn.flatMap(bar => [Number(bar.high), Number(bar.low)]);
    const above = right.after.levelPrices.filter(price => price > Math.max(...drawnPrices)).length;
    const below = right.after.levelPrices.filter(price => price < Math.min(...drawnPrices)).length;
    assert.ok(above >= 2, `the dragged window draws ${above} marked lines above its own bars; the rule reads two`);
    assert.ok(below >= 2, `the dragged window draws ${below} marked lines below its own bars; the rule reads two`);

    // The other direction is the same control: four bars forward of where the last drag left the window, which
    // is nearer the newest bar without being on it, and the caption counts the new distance rather than adding
    // the two together.
    const forward = await drag(-4 * barPixels, 0);
    const nearer = draggedBack(forward.after.caption);
    assert.ok(nearer < back && nearer > 0, `dragging the other way takes ${back} bars back to ${nearer}`);
    assert.equal(forward.after.last.close, Number(btcBars[total - 1 - nearer].close));

    // A double click is the reader's own way back to the view the page opens on: the newest window of bars, the
    // scale those bars and their nearest lines make, and a caption with no drag left in it.
    await page.mouse.dblclick(
      forward.after.frame.x + forward.after.frame.width / 2,
      forward.after.frame.y + forward.after.frame.height / 2
    );
    const reset = await page.evaluate(chartReadout);
    assert.match(reset.caption, /60 of 120 M5 bars drawn \(zoom 2\u00d7\)/);
    assert.doesNotMatch(reset.caption, /dragged/, "the double click puts both axes back");
    assert.equal(reset.last.close, Number(btcBars[total - 1].close), "and the legend with them");
    assert.deepEqual(reset.barXs, opening.barXs, "the picture is the one the page opened on, bar for bar");
    assert.deepEqual(reset.levelYs, opening.levelYs, "and line for line");


    // Down pushes the price scale rather than shrinking it: the window the bars made keeps its span and is moved,
    // so every published line on the picture moves by the pointer's own distance, no bar moves sideways, and the
    // caption states which way and by how much of the pane.
    const beforeDown = await page.evaluate(chartReadout);
    const down = await drag(0, 40);
    assert.equal(down.after.bars, 60, "a vertical drag draws the same window of bars");
    assert.deepEqual(down.after.barXs, beforeDown.barXs, "and moves none of them across the picture");
    assert.equal(down.after.last.close, Number(btcBars[total - 1].close), "the newest bar is still the one drawn");
    const panned = pricePan(down.after.caption);
    assert.ok(panned, `a downward drag states the scale it moved: ${down.after.caption}`);
    assert.equal(panned[2], "down", "the pane followed the hand down, and says so");
    assert.ok(Number(panned[1]) > 0 && Number(panned[1]) < 75, `the scale stays on the pane at ${panned[1]}%`);
    const travel = 40 / factor;
    const wasYs = lineYs(beforeDown);
    const nowYs = lineYs(down.after);
    const shared = Array.from(wasYs.keys()).filter(price => nowYs.has(price));
    assert.ok(shared.length >= 2, "the drag is read against lines that stayed on the picture");
    for (const price of shared) {
      const shift = nowYs.get(price) - wasYs.get(price);
      assert.ok(
        Math.abs(shift - travel) <= 2.5,
        `the line at ${price} moved ${shift.toFixed(1)} canvas units; the hand moved ${travel.toFixed(1)}`
      );
    }

    // The release is a reading again as well as the end of a gesture: the crosshair comes back at the point the
    // hand let go, measured in the canvas' own units, which the pane's slide does not change.
    const releaseY = down.after.canvas.height / 2 + 40 / factor;
    assert.ok(
      Math.abs(down.after.crosshair - releaseY) <= 2.5,
      `the crosshair is back where the hand let go (${down.after.crosshair} against ${releaseY.toFixed(1)})`
    );
    // opened on rather than to an offset of its own, which is what makes a drag reversible by hand.
    const up = await drag(0, -40);
    assert.equal(pricePan(up.after.caption), null, "a drag back the way it came leaves no price offset behind");
    assert.deepEqual(up.after.levelYs, opening.levelYs, "and the scale the page opened on");
    assert.deepEqual(up.after.barXs, opening.barXs);

    // The ends are the ends in this direction too: three quarters of the pane, past which the window the bars
    // were fitted into would be pushed off the canvas entirely.
    const far = await drag(0, 600);
    const clamped = pricePan(far.after.caption);
    assert.ok(clamped, `the clamped drag still states its scale: ${far.after.caption}`);
    assert.equal(Number(clamped[1]), 75, "a drag past the end stops at three quarters of the pane");
    assert.equal(clamped[2], "down");
    assert.ok(
      far.after.barYs.some(y => y >= 0 && y <= far.after.canvas.height),
      "and part of the bars is still on the canvas, which is what the end is for"
    );
    // And the double click is the way back from the far end as well.
    await page.mouse.dblclick(
      far.after.frame.x + far.after.frame.width / 2,
      far.after.frame.y + far.after.frame.height / 2
    );
    const backFromClamp = await page.evaluate(chartReadout);
    assert.match(backFromClamp.caption, /60 of 120 M5 bars drawn \(zoom 2\u00d7\)/);
    assert.deepEqual(backFromClamp.levelYs, opening.levelYs);

    // A pan must never also mark a level. Arming the marking and dragging the canvas marks nothing, because the
    // click a drag ends in is the tail of the drag rather than a press on the chart; the press after it is a
    // real click and marks the level it was aimed at, so the swallow is one click and not a mode.
    const published = levels.instruments.find(entry => entry.symbol === "BTCUSD").levels.length;
    await page.waitForSelector("#liveTradingPanel [data-live-chart-mark]", { timeout: 10000 });
    await page.click("#liveTradingPanel [data-live-chart-mark]");
    const armed = await page.evaluate(chartReadout);
    assert.equal(armed.levels, published, "the pair draws a chip for every published level");
    assert.match(armed.markStatus, /Click the chart/, "and says what the next click on the chart will do");
    const draggedOver = await page.evaluate(chartReadout);
    const pannedWhileMarking = await drag(60, 0);
    assert.ok(
      draggedBack(pannedWhileMarking.after.caption) >= 1,
      `the drag moved the pane instead of marking: ${pannedWhileMarking.after.caption}`
    );
    assert.equal(pannedWhileMarking.after.markStatus, draggedOver.markStatus, "a drag marks no level");
    assert.equal(pannedWhileMarking.after.levels, published, "and adds no chip to the pair");
    await clickCenter();
    await page.waitForFunction(
      () => /^Marked /.test((document.querySelector("#liveTradingPanel .live-trading-chart-mark-status")?.textContent || "").trim()),
      null,
      { timeout: 10000 }
    );
    assert.equal((await page.evaluate(chartReadout)).levels, published + 1, "the click after the drag marks the level it was aimed at");
  } finally {
    await browser.close();
    await server.close();
  }
});

