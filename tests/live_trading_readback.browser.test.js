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

// The newest bars of the committed feed with a round trip hung on two of them, so the markers on the canvas
// can be asserted by where the bars actually are. The trade itself is synthetic and says so: what is under
// test is where a trade is drawn - the bar its own time falls in and the price the terminal reported - not
// whether a real one happened, which the read-back test above covers against the trade this lane placed.
function feedWithMarkedBars() {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  feed.generated_at_utc = new Date().toISOString();
  const instrument = feed.instruments.find(entry => entry.symbol === "BTCUSD");
  const bars = instrument.m5.bars;
  assert.ok(Array.isArray(bars) && bars.length >= 6, "the committed feed must carry BTCUSD M5 bars");
  const entryBar = bars[bars.length - 4];
  const exitBar = bars[bars.length - 2];
  // 30 and 90 seconds into their own bars, so each time belongs to exactly one drawn bar and is not on a
  // boundary where "the bar it happened in" would be a matter of opinion.
  const entryTime = new Date(Date.parse(entryBar.time_utc) + 30000).toISOString();
  const exitTime = new Date(Date.parse(exitBar.time_utc) + 90000).toISOString();
  // Prices well inside the bars' own range but far apart on the scale, so a marker drawn at the wrong price
  // cannot pass as a marker drawn at the right one.
  const lows = Math.min(...bars.map(bar => Number(bar.low)));
  const highs = Math.max(...bars.map(bar => Number(bar.high)));
  const entryPrice = Number((lows + (highs - lows) * 0.1).toFixed(2));
  const exitPrice = Number((highs - (highs - lows) * 0.1).toFixed(2));
  // The stop and the target the entry carried, on either side of it and inside the bars' own range, so the
  // position tool's two bands can be told apart on the scale rather than from the pixels alone.
  const stopPrice = Number((lows + (highs - lows) * 0.04).toFixed(2));
  const targetPrice = Number((highs - (highs - lows) * 0.04).toFixed(2));
  feed.closed_trades = [
    {
      position_id: 297645550,
      symbol: "BTCUSD",
      dashboard_asset: "BTC",
      side: "buy",
      volume: 0.01,
      price_open: entryPrice,
      price_close: exitPrice,
      // The levels the entry deal carried, which are what the position tool is drawn from.
      stop_loss: stopPrice,
      take_profit: targetPrice,
      profit: 0.19,
      commission: -0.56,
      swap: 0,
      net_profit: -0.37,
      magic: 20261004,
      comment: "live-trading-marker-fixture",
      deal_count: 2,
      entry_deal: 278466153,
      exit_deal: 278466158,
      opened: { time_server: entryBar.time_server, time_utc: entryTime },
      closed: { time_server: exitBar.time_server, time_utc: exitTime },
      duration_seconds: Math.round((Date.parse(exitTime) - Date.parse(entryTime)) / 1000)
    }
  ];
  // And one open position on the same symbol with a stop and a target attached, opened in the same bar the
  // closed trade's entry marker sits on, so the shaded band can be asserted against a bar that is already
  // located by the test below. It carries the same two levels the closed trade carried, so both bands are
  // drawn from the same three prices and differ only in what they mean.
  feed.account.positions_open = 1;
  feed.positions = [
    {
      ticket: 297646459,
      symbol: "BTCUSD",
      dashboard_asset: "BTC",
      side: "buy",
      volume: 0.01,
      price_open: entryPrice,
      price_current: entryPrice,
      stop_loss: stopPrice,
      take_profit: targetPrice,
      profit: 0,
      swap: 0,
      magic: 20261004,
      comment: "live-trading-position-fixture",
      opened: { time_server: entryBar.time_server, time_utc: entryTime },
      updated: { time_server: entryBar.time_server, time_utc: entryTime }
    }
  ];
  return { feed, entryTime, exitTime, entryPrice, exitPrice, stopPrice, targetPrice };
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

    // And a snapshot that carries no position block at all still says the one fact it has: the account it
    // read reports nothing open, so nothing has been open since the last publish.
    await page.evaluate(async () => {
      const feed = await (await fetch("./data/live-trading.json", { cache: "no-store" })).json();
      feed.generated_at_utc = new Date().toISOString();
      feed.account.positions_open = 0;
      delete feed.positions;
      renderLiveTrading(feed);
    });
    const noBlock = await page.innerText("#liveTradingPanel .live-trading-table-panel");
    assert.match(noBlock, /carries no position block/);
    assert.match(noBlock, /nothing has been open since the last publish/);
  } finally {
    await browser.close();
    await server.close();
  }
});

// The canvas marks are the read-back drawn where the levels are: E for the entry of an executed trade and X
// for its exit, each on the bar its own time falls in and at the price the terminal reported.
test("the chart marks an executed round trip with an E and an X", async () => {
  const fixture = feedWithMarkedBars();
  const server = await startServer(fixture.feed);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector('[data-live-chart-symbol="BTCUSD"]', { timeout: 20000 });
    await page.click('[data-live-chart-symbol="BTCUSD"]');
    await page.waitForFunction(
      () => document.querySelectorAll(".live-trading-chart-trade").length === 2,
      null,
      { timeout: 20000 }
    );

    // The first point of each triangle is its apex, which is the price point moved by the marker's own size.
    // Both triangles are the same size, and the price point is the apex moved back towards the base.
    const MARKER_SIZE = 11; // script.js: `const size = 11;` in liveTradingChartTrades, pinned by tests/live_trading_feed.test.js
    const marks = await page.$$eval(".live-trading-chart-trade", nodes => nodes.map(node => {
      const points = (node.querySelector("polygon")?.getAttribute("points") || "").trim().split(/\s+/);
      const [x, y] = (points[0] || "").split(",").map(Number);
      return {
        classes: node.getAttribute("class") || "",
        label: node.querySelector("text")?.textContent || "",
        title: node.querySelector("title")?.textContent || "",
        x,
        y
      };
    }));
    const entry = marks.find(mark => mark.classes.includes("entry"));
    const exit = marks.find(mark => mark.classes.includes("exit"));
    assert.ok(entry && exit, "one entry marker and one exit marker");
    assert.equal(entry.label, "E");
    assert.equal(exit.label, "X");
    // A buy points up and the sell that closed it points down, the way a terminal draws the pair.
    assert.match(entry.classes, /\bbuy\b/);
    assert.match(exit.classes, /\bsell\b/);

    // Each marker sits on the bar its own trade time falls in: the entry is four bars back, the exit two.
    assert.ok(entry.x < exit.x, "the entry is drawn left of the exit");
    // And at the price the terminal reported, on a canvas where a higher price is a smaller y.
    const entryPointY = entry.y + MARKER_SIZE;
    const exitPointY = exit.y - MARKER_SIZE;
    assert.equal(Math.sign(entryPointY - exitPointY), Math.sign(fixture.exitPrice - fixture.entryPrice));
    assert.match(entry.title, new RegExp(`^Entry BUY ${fixture.entryPrice.toFixed(2)} BTCUSD at ${fixture.entryTime}$`));
    assert.match(exit.title, new RegExp(`^Exit SELL ${fixture.exitPrice.toFixed(2)} BTCUSD at ${fixture.exitTime}$`));

    const caption = await page.innerText("#liveTradingPanel .live-trading-chart-caption");
    assert.match(caption, /1 executed trade on this chart \(E entry, X exit\)/);
    assert.match(caption, /1 open position on this chart \(stop and target shaded\)/);

    // The open position is shaded from its stop to its target on the same bars and the same scale as the rest:
    // the band spans the two prices the terminal reports, the entry is drawn between them, and it starts on the
    // bar the position was opened in - the bar the closed trade's own entry triangle is on.
    const position = await page.$eval(".live-trading-chart-position", node => {
      const band = node.querySelector("rect.live-trading-chart-position-band");
      return {
        classes: node.getAttribute("class") || "",
        title: node.querySelector("title")?.textContent || "",
        band: {
          x: Number(band.getAttribute("x")),
          y: Number(band.getAttribute("y")),
          width: Number(band.getAttribute("width")),
          height: Number(band.getAttribute("height"))
        },
        lines: [...node.querySelectorAll("line.live-trading-chart-position-edge")].map(line => ({
          classes: line.getAttribute("class") || "",
          y: Number(line.getAttribute("y1"))
        })),
        labels: [...node.querySelectorAll("text.live-trading-chart-position-label")].map(text => text.textContent)
      };
    });
    assert.match(position.classes, /\bbuy\b/);
    const edgeOf = kind => position.lines.find(line => line.classes.includes(kind));
    assert.ok(edgeOf("target") && edgeOf("stop") && edgeOf("entry"), "a target line, a stop line and an entry line");
    // Higher price, smaller y: the target is above the entry and the stop is below it.
    assert.ok(edgeOf("target").y < edgeOf("entry").y, "the target is drawn above the entry");
    assert.ok(edgeOf("entry").y < edgeOf("stop").y, "the stop is drawn below the entry");
    // The band is exactly the span between those two edges.
    assert.ok(Math.abs(position.band.y - edgeOf("target").y) < 0.01);
    assert.ok(Math.abs((position.band.y + position.band.height) - edgeOf("stop").y) < 0.01);
    assert.ok(Math.abs(position.band.x - entry.x) < 0.01, "the band starts on the bar the position was opened in");
    assert.ok(position.band.width > 0);
    assert.deepEqual(
      position.labels.slice().sort(),
      [`TARGET ${fixture.targetPrice.toFixed(2)}`, `STOP ${fixture.stopPrice.toFixed(2)}`, `ENTRY ${fixture.entryPrice.toFixed(2)}`].sort()
    );
    assert.match(position.title, new RegExp(`^Open BUY BTCUSD from ${fixture.entryPrice.toFixed(2)} stop ${fixture.stopPrice.toFixed(2)} target ${fixture.targetPrice.toFixed(2)} opened `));

    // The closed trade the terminal bracketed carries its own position tool, drawn the way a charting
    // terminal draws one: a band from the entry down to the stop and one from the entry up to the target,
    // spanning the bars the trade was held for, and a line of arithmetic on each edge in the account's money
    // at the size that was actually traded.
    const tool = await page.$eval(".live-trading-chart-tool", node => {
      const bands = [...node.querySelectorAll("rect.live-trading-chart-tool-band")].map(band => ({
        classes: band.getAttribute("class") || "",
        y: Number(band.getAttribute("y")),
        height: Number(band.getAttribute("height")),
        width: Number(band.getAttribute("width"))
      }));
      const lines = [...node.querySelectorAll("line.live-trading-chart-tool-edge")].map(line => ({
        classes: line.getAttribute("class") || "",
        y: Number(line.getAttribute("y1"))
      }));
      return {
        classes: node.getAttribute("class") || "",
        title: node.querySelector("title")?.textContent || "",
        x: Number(node.querySelector("rect")?.getAttribute("x")),
        bands,
        lines,
        labels: [...node.querySelectorAll("text.live-trading-chart-tool-label")].map(text => text.textContent)
      };
    });
    assert.match(tool.classes, /\bbuy\b/);
    assert.equal(tool.bands.length, 2, "one band for the risk and one for the reward");
    const toolEdgeY = kind => tool.lines.find(line => line.classes.includes(kind))?.y;
    assert.ok(toolEdgeY("target") < toolEdgeY("entry") && toolEdgeY("entry") < toolEdgeY("stop"), "the reward sits above the risk on a buy");
    // The box spans the bars the trade was held for: it starts on the bar the entry triangle is on and runs
    // past the bar the exit triangle is on, which is what makes it a tool for that trade rather than a level.
    assert.ok(Math.abs(tool.x - entry.x) < 0.01, "the box starts on the bar the trade was entered in");
    assert.ok(tool.x + Math.max(...tool.bands.map(band => band.width)) > exit.x, "the box reaches the bar the trade was closed in");
    // Each edge states its own price, its distance and its percentage; the two edges state the money too, at
    // the 0.01 lot the fixture was traded in, and the entry line carries the size and the ratio between them.
    const price = value => value.toFixed(2);
    const atSize = distance => (Math.round(Number(distance.toFixed(2)) * 0.01 * 100) / 100).toFixed(2);
    const targetDistance = fixture.targetPrice - fixture.entryPrice;
    const stopDistance = fixture.entryPrice - fixture.stopPrice;
    const targetLabel = tool.labels.find(label => label.startsWith("Target: "));
    const stopLabel = tool.labels.find(label => label.startsWith("Stop: "));
    const entryLabel = tool.labels.find(label => label.startsWith("Entry: "));
    assert.ok(targetLabel && stopLabel && entryLabel, "the tool labels the target, the stop and the entry");
    assert.match(targetLabel, new RegExp(`^Target: ${price(fixture.targetPrice)} \u00b7 ${price(targetDistance)} \\([\\d.]+%\\) \u00b7 ${atSize(targetDistance)} USD reward$`));
    assert.match(stopLabel, new RegExp(`^Stop: ${price(fixture.stopPrice)} \u00b7 ${price(stopDistance)} \\([\\d.]+%\\) \u00b7 ${atSize(stopDistance)} USD risk$`));
    assert.match(entryLabel, new RegExp(`^Entry: ${price(fixture.entryPrice)} \u00b7 Qty 0\\.01 \u00b7 Risk/reward ratio [\\d.]+$`));
    assert.match(tool.title, new RegExp(`^BTCUSD BUY 0\\.01 lot, held from ${fixture.entryTime} to ${fixture.exitTime}\\.`));
    // And the caption counts it, so a box that failed to draw is a caption that says so.
    assert.match(caption, /1 executed trade with the position tool drawn/);

    // The lag is stated on the chart itself rather than left to a document, because a delayed chart that does
    // not say so is read as a live one.
    const lagNote = await page.innerText("#liveTradingPanel .live-trading-chart-lag");
    assert.match(lagNote, /^Snapshot, not a live feed:/);
    assert.match(lagNote, /The agent acts on the five-minute close itself/);
    const panels = await page.$$("#liveTradingPanel .live-trading-table-panel");
    const closedTrades = await panels[1].innerText();
    assert.match(closedTrades, /an entry is a triangle lettered E and its exit a triangle lettered X/);

    // A symbol with nothing read back carries no markers, and the caption claims none.
    await page.click('[data-live-chart-symbol="EURUSD"]');
    await page.waitForFunction(
      () => document.querySelectorAll(".live-trading-chart-trade").length === 0,
      null,
      { timeout: 20000 }
    );
    const eurCaption = await page.innerText("#liveTradingPanel .live-trading-chart-caption");
    assert.equal(/executed trade/.test(eurCaption), false);
  } finally {
    await browser.close();
    await server.close();
  }
});

