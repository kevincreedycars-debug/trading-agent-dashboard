// Browser test for the FTMO 1 Performance panel on the Live Trading view.
//
// The numbers themselves are held by tests/live_trading_performance.test.js. What this test adds is what that
// one cannot see: that the panel reaches a screen above Open positions, that the four instrument cards have
// moved below Closed trades, that Weekday is the tab a reader lands on, that a weekend day with nothing on it
// draws a count of zero and a blank rate rather than a zero per cent, and that the rows underneath add back to
// the total the Closed trades table states for the same snapshot.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const feedPath = path.join(repoRoot, "data", "live-trading.json");

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

// The committed snapshot with three chosen closed trades in it: two on Monday 2 November 2026, one of them a
// loss, and one on the Saturday that carries a comment naming no rule. Three trades are enough to make every
// column of the table say something different - a share, a rate, a blank - without inventing a fortnight.
function feedWithThreeCloses() {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  feed.generated_at_utc = new Date().toISOString();
  feed.stale_after_seconds = 900;
  const close = (utc, net, comment, asset, symbol) => ({
    position_id: Math.abs(net * 1000) + 100000000,
    symbol,
    dashboard_asset: asset,
    side: "buy",
    volume: 0.01,
    price_open: 100,
    price_close: 101,
    profit: net,
    commission: 0,
    swap: 0,
    net_profit: net,
    magic: 20261004,
    comment,
    deal_count: 2,
    opened: { time_server: utc, time_utc: utc },
    closed: { time_server: utc, time_utc: utc },
    duration_seconds: 600
  });
  feed.closed_trades = [
    close("2026-11-02T10:00:00+00:00", 5, "l2l-rule-eur", "EUR", "EURUSD"),
    close("2026-11-02T11:00:00+00:00", -2.5, "l2l-rule-eur", "EUR", "EURUSD"),
    close("2026-11-07T12:00:00+00:00", -0.5, "loop-proof-close", "BTC", "BTCUSD")
  ];
  feed.history = {
    ...feed.history,
    window_days: 14,
    from_utc: "2026-10-26T00:00:00+00:00",
    to_utc: "2026-11-09T18:00:00+00:00",
    deal_count: 6,
    closed_positions: 3
  };
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


test("the FTMO 1 performance panel reads above Open positions and the instrument cards sit last", async () => {
  const server = await startServer(feedWithThreeCloses());
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trading"]');
    await page.waitForSelector("#liveTradingPanel .live-trading-performance", { timeout: 20000 });

    // Waiting for a row rather than for the panel keeps this an assertion about a rendered snapshot instead of a
    // race with the first, empty paint.
    await page.waitForSelector("#liveTradingPerformanceBody-weekday tbody tr", { timeout: 20000 });

    // The reading order the owner asked for, read off the DOM rather than off the source: the panel, then what
    // is open, then what closed, then the four instrument cards.
    const order = await page.evaluate(() => {
      const panel = document.getElementById("liveTradingPanel");
      const blocks = [...panel.children];
      const at = (predicate) => blocks.findIndex(predicate);
      return {
        performance: at(node => node.classList.contains("live-trading-performance")),
        positions: at(node => node.classList.contains("live-trading-table-panel")
          && /open positions/i.test(node.textContent || "")),
        closed: at(node => node.classList.contains("live-trading-table-panel")
          && /closed trades/i.test(node.textContent || "")),
        cards: at(node => node.classList.contains("live-trading-grid")),
        readbackPanels: panel.querySelectorAll(".live-trading-table-panel:not(.live-trading-rule-panel)").length
      };
    });
    assert.ok(order.performance >= 0 && order.positions > order.performance, "the panel sits above Open positions");
    assert.ok(order.closed > order.positions, "Closed trades sits under Open positions");
    assert.ok(order.cards > order.closed, "the four instrument cards sit below Closed trades");
    // The two read-back tables are still the only two table panels on the section: the performance panel is not
    // one of them, so the close-control and read-back checks keep finding the tables they mean.
    assert.equal(order.readbackPanels, 2);

    // One total at the top, and it is the Closed trades table's own count and money for this snapshot.
    const totals = await page.evaluate(() => [...document.querySelectorAll("#liveTradingPanel .live-trading-performance-totals dd")]
      .map(node => node.textContent.trim()));
    assert.deepEqual(totals, ["+2.00 USD", "33.3%", "3"]);
    const closedMeta = await page.evaluate(() => {
      const section = [...document.querySelectorAll("#liveTradingPanel .live-trading-table-panel")]
        .find(node => /closed trades/i.test(node.textContent || ""));
      return section ? section.querySelector(".live-trading-table-meta").textContent.trim() : "";
    });
    assert.match(closedMeta, /3 closed in the last 14 days/);
    assert.match(closedMeta, /net \+2\.00 USD/);

    // The reporting dates sit on the same row as the title, and they are the window this snapshot states rather
    // than a date the page chose: from 26 Oct 2026 to 09 Nov 2026, fourteen days.
    const period = await page.evaluate(() => {
      const heading = document.getElementById("liveTradingPerformanceHeading");
      const line = heading.parentElement.querySelector(".live-trading-performance-period");
      const row = heading.parentElement;
      return {
        sameRow: Boolean(line) && line.parentElement === heading.parentElement,
        text: line ? line.textContent.trim() : "",
        title: line ? (line.getAttribute("title") || "") : "",
        display: getComputedStyle(row).display,
        wrap: getComputedStyle(row).flexWrap
      };
    });
    assert.equal(period.sameRow, true, "the dates sit beside the heading, in the heading's own row");
    assert.equal(period.text, "26 Oct 2026 \u2013 09 Nov 2026 UTC \u00b7 14-day window");
    // The exact stamps are kept on the line so the shorter wording loses nothing.
    assert.match(period.title, /2026-10-26 00:00Z/);
    assert.match(period.title, /2026-11-09 18:00Z/);
    // And the row is a wrapping flex row: an edit that pushes the dates back underneath the title fails here.
    assert.equal(period.display, "flex");
    assert.equal(period.wrap, "wrap");


    // Weekday is the tab a reader lands on, and it is the only breakdown shown.
    const tabs = await page.evaluate(() => [...document.querySelectorAll("#liveTradingPanel [data-live-performance-tab]")]
      .map(node => ({
        key: node.dataset.livePerformanceTab,
        selected: node.getAttribute("aria-selected"),
        active: node.classList.contains("is-active")
      })));
    assert.deepEqual(tabs.map(tab => tab.key), ["weekday", "strategy", "asset"]);
    assert.deepEqual(tabs.map(tab => tab.selected), ["true", "false", "false"]);
    assert.deepEqual(tabs.map(tab => tab.active), [true, false, false]);
    assert.equal(await page.evaluate(() => document.getElementById("liveTradingPerformanceBody-strategy").hidden), true);

    // Monday carries two trades, one win and one loss: a share, a rate and a signed net.
    const monday = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#liveTradingPerformanceBody-weekday tbody tr")]
        .find(node => /^Monday/.test((node.textContent || "").trim()));
      return row ? [...row.children].map(cell => cell.textContent.trim()) : [];
    });
    assert.deepEqual(monday, ["Monday", "2", "66.7%", "1", "1", "0", "50.0%", "+2.50 USD"]);

    // Saturday traded once and lost it, Sunday traded nothing: the blank rate is what tells the two apart.
    const weekend = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#liveTradingPerformanceBody-weekday tbody tr")];
      const text = (label) => {
        const row = rows.find(node => new RegExp(`^${label}`).test((node.textContent || "").trim()));
        return row ? [...row.children].map(cell => cell.textContent.trim()) : [];
      };
      return { saturday: text("Saturday"), sunday: text("Sunday") };
    });
    assert.deepEqual(weekend.saturday, ["Saturday", "1", "33.3%", "0", "1", "0", "0.0%", "-0.50 USD"]);
    assert.deepEqual(weekend.sunday, ["Sunday", "0", "0.0%", "0", "0", "0", "", "0.00 USD"]);
    assert.equal(await page.evaluate(() => {
      const row = [...document.querySelectorAll("#liveTradingPerformanceBody-weekday tbody tr")]
        .find(node => /^Sunday/.test((node.textContent || "").trim()));
      return row.classList.contains("live-trading-performance-idle");
    }), true);

    // The strategy tab names the rule on two trades and keeps the third under Unknown strategy, and the caption
    // says which recorded comment could not be read as one.
    await page.click('[data-live-performance-tab="strategy"]');
    const strategy = await page.evaluate(() => {
      const body = document.getElementById("liveTradingPerformanceBody-strategy");
      return {
        hidden: body.hidden,
        weekdayHidden: document.getElementById("liveTradingPerformanceBody-weekday").hidden,
        rows: [...body.querySelectorAll("tbody tr")].map(node => [...node.children].map(cell => cell.textContent.trim())),
        selected: document.querySelector('[data-live-performance-tab="strategy"]').getAttribute("aria-selected")
      };
    });
    assert.equal(strategy.hidden, false);
    assert.equal(strategy.weekdayHidden, true);
    assert.equal(strategy.selected, "true");
    assert.deepEqual(strategy.rows.map(row => row[0]), ["l2l-rule-eur", "Unknown strategy"]);
    assert.deepEqual(strategy.rows[1], ["Unknown strategy", "1", "33.3%", "0", "1", "0", "0.0%", "-0.50 USD"]);
    const caption = await page.innerText("#liveTradingPanel .live-trading-performance .live-trading-table-caption");
    assert.match(caption, /loop-proof-close/);
    assert.match(caption, /14-day window/);

    // And the rows still add up to the headline: three trades and two dollars, whichever tab is showing.
    const assetSums = await page.evaluate(() => {
      const body = document.getElementById("liveTradingPerformanceBody-asset");
      const rows = [...body.querySelectorAll("tbody tr")];
      return {
        trades: rows.reduce((total, row) => total + Number(row.children[1].textContent.trim()), 0),
        cents: rows.reduce((total, row) => total + Math.round(Number(
          row.children[7].textContent.replace(/[^0-9.+-]/g, "")
        ) * 100), 0)
      };
    });
    assert.equal(assetSums.trades, 3);
    assert.equal(assetSums.cents, 200);
  } finally {
    await browser.close();
    await server.close();
  }
});
