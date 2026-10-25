// The Open positions table's own hand-close, read off a real page.
//
// The document tests in tests/live_trading_close_request.test.js hold the log's own rules and the loop's
// tests hold what the tick does with a row. What neither can see is whether a reader can actually reach the
// control: whether the table offers it on the right row, whether the confirm strip states the ticket, whether
// the fast route is a real hand-over to this PC, and whether the log route commits one row through the
// reader's own token. That is what this case loads the real page for.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const feedPath = path.join(repoRoot, "data", "live-trading.json");
const LANE_MAGIC = 20261004;

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

// The committed snapshot with two open positions: one this lane's own loop placed, which is the only kind a
// Close button is ever offered on, and one another path's, which must say whose it is instead.
function feedWithTwoPositions() {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  feed.generated_at_utc = new Date().toISOString();
  feed.stale_after_seconds = 900;
  feed.account.positions_open = 2;
  feed.positions = [
    {
      ticket: 300456025,
      symbol: "XAUUSD",
      dashboard_asset: "GOLD",
      side: "buy",
      volume: 0.01,
      price_open: 4140.51,
      price_current: 4148.2,
      stop_loss: 4140.51,
      take_profit: 4180.0,
      profit: 7.69,
      swap: 0,
      floating_pct: 0.18,
      magic: LANE_MAGIC,
      comment: "l2l-rule-gold",
      opened: { time_server: "2026-10-15T20:41:30+00:00", time_utc: "2026-10-15T20:41:30Z" },
      updated: { time_server: "2026-10-16T12:00:00+00:00", time_utc: "2026-10-16T12:00:00Z" }
    },
    {
      ticket: 111222333,
      symbol: "EURUSD",
      dashboard_asset: "EUR",
      side: "sell",
      volume: 0.05,
      price_open: 1.0842,
      price_current: 1.0839,
      stop_loss: 1.0862,
      take_profit: 1.0802,
      profit: 1.5,
      swap: 0,
      floating_pct: 0.03,
      magic: 8888,
      comment: "placed by hand in the terminal",
      opened: { time_server: "2026-10-16T08:00:00+00:00", time_utc: "2026-10-16T08:00:00Z" },
      updated: { time_server: "2026-10-16T12:00:00+00:00", time_utc: "2026-10-16T12:00:00Z" }
    }
  ];
  return feed;
}

async function startServer(feed, { omit = [] } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    // A case can hide one published file, which is how the page is tested as a reader finds it before a
    // document has been published at all.
    if (omit.includes(pathname)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
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

function textOf(locator) {
  return locator.evaluate(node => (node.textContent || "").replace(/\s+/g, " ").trim());
}

// The page as a reader gets it, with the panel already drawn, and the GitHub calls answered by the test so no
// case reaches the network.
async function openPanel(page, origin, { put } = {}) {
  await page.route("https://api.github.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not Found" }) });
      return;
    }
    if (put) put.push({ url: request.url(), body: JSON.parse(request.postData() || "{}") });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ content: { sha: "commit-blob-sha" }, commit: { sha: "abcdef1234567890" } })
    });
  });
  await page.goto(`${origin}/index.html#live-trading`, { waitUntil: "domcontentloaded" });
  await page.click('[data-tab="live-trading"]');
  await page.waitForSelector("#liveTradingPanel .live-trading-table-panel");
  // The Open positions panel, selected by its own heading rather than by position: the section carries a
  // working-orders table and a closed-trades table beside it, and which comes first is a layout decision
  // these checks should not depend on.
  const panel = page
    .locator("#liveTradingPanel .live-trading-table-panel")
    .filter({ has: page.locator("h3", { hasText: "Open positions" }) })
    .first();
  await panel.waitFor({ state: "attached", timeout: 15000 });
  // Every case here serves a snapshot with positions in it, and the panel is drawn once on load and again when
  // the feed arrives: waiting for a row is what keeps a check from reading the first, empty render.
  await panel.locator("tbody tr").first().waitFor({ state: "attached", timeout: 15000 });
  return panel;
}

function rowFor(panel, ticket) {
  return panel.locator("tbody tr", { hasText: `#${ticket}` }).first();
}

test("the table offers Close on this lane's own ticket and never on another path's", async () => {
  const feed = feedWithTwoPositions();
  const server = await startServer(feed);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const panel = await openPanel(page, server.origin);

    const laneRow = rowFor(panel, 300456025);
    assert.equal(await laneRow.locator("[data-live-close-ask]").count(), 1, "this lane's own position can be asked out");

    const otherRow = rowFor(panel, 111222333);
    assert.equal(await otherRow.locator("[data-live-close-ask]").count(), 0, "another path's position is not this loop's to take out");
    assert.match(await textOf(otherRow), /another path's/);

    // The table says what the two routes are, and the note underneath says what has been asked for so far.
    const caption = await textOf(panel.locator(".live-trading-table-caption"));
    assert.match(caption, /Close now on this PC/);
    assert.match(caption, /Ask the loop instead/);
    assert.match(caption, /data\/live-trading-close-request\.json/);
    assert.match(caption, /carrying its own magic/);
    assert.match(await textOf(panel.locator(".live-trading-table-note-line")), /No close has been asked for from this page yet/);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("pressing Close states the ticket and offers both routes, and Cancel puts the row back", async () => {
  const feed = feedWithTwoPositions();
  const server = await startServer(feed);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const panel = await openPanel(page, server.origin);
    const laneRow = rowFor(panel, 300456025);

    await laneRow.locator("[data-live-close-ask]").click();
    await page.waitForSelector("#liveTradingPanel [data-live-close-now]");
    const confirm = page.locator("#liveTradingPanel .live-trading-close-confirm").first();
    const question = await textOf(confirm.locator(".live-trading-close-question"));
    assert.match(question, /Close #300456025/);
    assert.match(question, /BUY/);
    assert.match(question, /0\.01 lot/);
    assert.match(question, /XAUUSD/);

    // The fast route is a hand-over to this PC, so its href is the close link's own name and the ticket: that
    // is the whole contract the browser needs, and the page never prevents that navigation.
    const link = confirm.locator("[data-live-close-now]");
    assert.equal(await link.getAttribute("href"), "l2lclose:300456025");
    assert.equal(await confirm.locator("[data-live-close-loop]").count(), 1, "the log route is offered beside it on the published page");
    assert.match(await textOf(confirm.locator("[data-live-close-loop]")), /Ask the loop instead/);

    await confirm.locator("[data-live-close-cancel]").click();
    await page.waitForSelector("#liveTradingPanel tbody [data-live-close-ask]");
    assert.equal(await page.locator("#liveTradingPanel [data-live-close-now]").count(), 0, "the strip is closed again");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the fast route hands the ticket over and says what it handed over rather than what the trade did", async () => {
  const feed = feedWithTwoPositions();
  const server = await startServer(feed);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const panel = await openPanel(page, server.origin);
    // The navigation to a custom scheme is the browser's own and is not what this case measures: a capturing
    // listener stops it so the page's own line can be read. The page itself never calls preventDefault.
    await page.evaluate(() => {
      document.addEventListener("click", (event) => {
        if (event.target.closest("[data-live-close-now]")) event.preventDefault();
      }, true);
    });

    await rowFor(panel, 300456025).locator("[data-live-close-ask]").click();
    await page.waitForSelector("#liveTradingPanel [data-live-close-now]");
    await page.click("#liveTradingPanel [data-live-close-now]");

    const status = await textOf(page.locator("#liveTradingPanel .live-trading-close-status"));
    assert.match(status, /Handed ticket 300456025 to this PC's close link/);
    assert.match(status, /confirmation box/);
    assert.match(status, /no close link registered/, "the page never claims the trade is already out");
    assert.equal(await page.locator("#liveTradingPanel [data-live-close-loop]").count(), 1, "and the log route stays one press away");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the log route commits one row for the ticket, through the reader's own token", async () => {
  const feed = feedWithTwoPositions();
  const server = await startServer(feed);
  const browser = await chromium.launch();
  const puts = [];
  try {
    const page = await browser.newPage();
    const panel = await openPanel(page, server.origin, { put: puts });

    // The token is the reader's own, pasted into the publishing box that is already on this tab: the close
    // route reads it from the same place rather than asking for a second one.
    await page.fill("[data-live-publish-token]", "ghp_example_token");
    await page.click("[data-live-publish-save]");
    await rowFor(panel, 300456025).locator("[data-live-close-ask]").click();
    await page.waitForSelector("#liveTradingPanel [data-live-close-loop]");
    await page.click("#liveTradingPanel [data-live-close-loop]");
    await page.waitForFunction(() => {
      const node = document.querySelector("#liveTradingPanel .live-trading-close-status");
      return Boolean(node && /Asked: ticket 300456025/.test(node.textContent || ""));
    });

    assert.equal(puts.length, 1, "one ask is one commit");
    assert.match(puts[0].url, /api\.github\.com\/repos\/kevincreedycars-debug\/trading-agent-dashboard\/contents\/data\/live-trading-close-request\.json/);
    const committed = JSON.parse(Buffer.from(puts[0].body.content, "base64").toString("utf8"));
    assert.equal(committed.schema_version, "live-trading-close-request-v2");
    assert.equal(committed.requests.length, 1);
    assert.equal(committed.requests[0].ticket, 300456025);
    assert.equal(committed.requests[0].side, "buy");
    assert.equal(committed.requests[0].volume, 0.01);
    assert.equal(committed.requests[0].requested_by, "dashboard");
    assert.match(committed.requests[0].note, /Open positions table/);
    // The row names the lane the lanes document gives this page's own feed, and the masked account the snapshot
    // already shows. Without both, the loop that reads this file could not tell which terminal to close in.
    assert.equal(committed.requests[0].account.lane, "ftmo-1");
    assert.equal(committed.requests[0].account.login_masked, feed.account.login_masked);
    assert.equal(committed.requests[0].account.server, feed.account.server);
    assert.match(committed.requests[0].request_id, /^close-ftmo-1-300456025-/);
    assert.match(committed.requests[0].expires_at_utc, /^\d{4}-\d{2}-\d{2}T/);

    const status = await textOf(page.locator("#liveTradingPanel .live-trading-close-status"));
    assert.match(status, /Asked: ticket 300456025 is written into data\/live-trading-close-request\.json/);
    assert.match(status, /next tick, within five minutes/);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("without a token the log route says what is missing instead of failing quietly", async () => {
  const feed = feedWithTwoPositions();
  const server = await startServer(feed);
  const browser = await chromium.launch();
  const puts = [];
  try {
    const page = await browser.newPage();
    const panel = await openPanel(page, server.origin, { put: puts });
    await rowFor(panel, 300456025).locator("[data-live-close-ask]").click();
    await page.waitForSelector("#liveTradingPanel [data-live-close-loop]");
    await page.click("#liveTradingPanel [data-live-close-loop]");
    await page.waitForSelector("#liveTradingPanel .live-trading-close-status");

    const status = await textOf(page.locator("#liveTradingPanel .live-trading-close-status"));
    assert.match(status, /needs a GitHub token with Contents: read and write/);
    assert.match(status, /marked-levels box/);
    assert.equal(puts.length, 0, "nothing was committed");
    assert.equal(await page.locator("#liveTradingPanel [data-live-close-now]").count(), 1, "the fast route is still there");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("with no lanes document published yet, the ask still names the primary lane rather than being refused", async () => {
  // A reader can be holding a page whose cache-buster predates the lanes document, and asking must still work:
  // the fallback is the lane id the document gives the primary feed, which is the feed this page reads. An ask
  // that named no lane at all would be refused by the module, which is the failure this case exists to catch.
  const feed = feedWithTwoPositions();
  const server = await startServer(feed, { omit: ["/data/live-trading-lanes.json"] });
  const browser = await chromium.launch();
  const puts = [];
  try {
    const page = await browser.newPage();
    const panel = await openPanel(page, server.origin, { put: puts });
    await page.fill("[data-live-publish-token]", "ghp_example_token");
    await page.click("[data-live-publish-save]");
    await rowFor(panel, 300456025).locator("[data-live-close-ask]").click();
    await page.waitForSelector("#liveTradingPanel [data-live-close-loop]");
    await page.click("#liveTradingPanel [data-live-close-loop]");
    await page.waitForFunction(() => {
      const node = document.querySelector("#liveTradingPanel .live-trading-close-status");
      return Boolean(node && /Asked: ticket 300456025/.test(node.textContent || ""));
    });

    assert.equal(puts.length, 1, "the ask is committed anyway");
    const committed = JSON.parse(Buffer.from(puts[0].body.content, "base64").toString("utf8"));
    assert.equal(committed.schema_version, "live-trading-close-request-v2");
    assert.equal(committed.requests[0].account.lane, "ftmo-1");
    assert.equal(committed.requests[0].account.login_masked, feed.account.login_masked);
  } finally {
    await browser.close();
    await server.close();
  }
});

