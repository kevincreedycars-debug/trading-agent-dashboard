const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

// The accounts strip is the one place the published page says whether a loop is behind an account, and the
// one place a stale record could be mistaken for a healthy one. These tests serve the shipped page with
// controlled artifacts: a heartbeat written a minute ago, the same heartbeat written three hours ago, and the
// parked second lane. The stale case is the point of the file - a card that still says "armed" with no age
// beside it, or no warning above the rows, is the failure this strip exists to prevent.
const repoRoot = path.resolve(__dirname, "..");
const snapshot = readJson("data/live-trading.json");
const lanesDocument = readJson("data/live-trading-lanes.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function heartbeat({ writtenAtMs, armed = true, status = "nothing_to_place", host = "PC-DESKTOP-A17" }) {
  return {
    schema_version: "live-trading-trader-status-v1",
    lane: "ftmo-1",
    host: { computer: host, platform: "win32", checkout: "live-trading" },
    expected_interval_seconds: 300,
    at_utc: new Date(writtenAtMs).toISOString(),
    written_at_utc: new Date(writtenAtMs).toISOString(),
    armed,
    status,
    reason: "no pair was left a ticket this run: every row states why, whether that is the rule, the account or the market.",
    account: { login_masked: "***614", server: "FTMO-Server" },
    terminal: { positions_open: 1, orders_open: 0, ours: 1 },
    close_requests: { enabled: true, error: null, taken: null },
    duration_seconds: 1.67
  };
}

function lanesWith(trader) {
  const document = JSON.parse(JSON.stringify(lanesDocument));
  const primary = document.lanes.find((lane) => lane.id === "ftmo-1");
  primary.trader = trader;
  return document;
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

// The page as shipped, with the lanes document and the primary lane's heartbeat replaced. Every other file is
// served from this checkout, so the strip is proved against the real script, styles and snapshot.
async function createHarness({ lanes, trader }) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    if (pathname === "/data/live-trading-lanes.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(lanes));
      return;
    }
    if (pathname === "/data/live-trading-trader.ftmo-1.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(trader));
      return;
    }
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  return {
    origin,
    browser,
    createContext: () => browser.newContext(),
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  };
}

async function openLiveTrading(context, origin, viewport = { width: 1440, height: 1000 }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize(viewport);
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  const button = page.locator('button.tab-button[data-tab="live-trading"]');
  await button.waitFor();
  await button.click();
  await page.locator("#liveTradingView.active-view").waitFor();
  await page.waitForFunction(() => document.querySelectorAll("#liveTradingPanel .live-trading-lane-card").length >= 2);
  return { page, errors };
}

function cardText(page, lane) {
  return page.locator(`#liveTradingPanel .live-trading-lane-card[data-lane="${lane}"]`).textContent();
}


test("each account card states the lane, the arming, the heartbeat and its age, the last result, the snapshot age and the host", async () => {
  const now = Date.now();
  const trader = heartbeat({ writtenAtMs: now - 60_000 });
  const harness = await createHarness({ lanes: lanesWith(trader), trader });
  try {
    const context = await harness.createContext();
    const { page, errors } = await openLiveTrading(context, harness.origin);
    assert.deepEqual(errors, [], "opening the section must not raise a script error");

    const card = await cardText(page, "ftmo-1");
    for (const expected of ["FTMO account 1", "LIVE", "enabled", "***614 / FTMO-Server", "armed", "nothing_to_place", "PC-DESKTOP-A17"]) {
      assert.ok(card.includes(expected), `the card must state ${expected}`);
    }
    // The heartbeat row carries both the age and the instant, so a reader can see which run wrote it.
    assert.match(card, /Heartbeat\s*1m ago - \d{4}-\d{2}-\d{2}T/, "the heartbeat row must carry its age and its timestamp");
    // The snapshot row is the account's own snapshot age, drawn from the snapshot rather than the heartbeat.
    assert.match(card, /Snapshot\s*[0-9]+[a-z]? ?[0-9]*m? ?ago|[0-9]+d ago/, "the card must state the snapshot's age");

    const rows = await page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row').count();
    assert.ok(rows >= 7, `the primary card must draw its rows, saw ${rows}`);
    assert.equal(
      await page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-alert').count(),
      0,
      "a fresh heartbeat must not raise the stale warning"
    );
  } finally {
    await harness.close();
  }
});

test("an armed heartbeat that stopped writing is drawn as stale, not as a running loop", async () => {
  const now = Date.now();
  const trader = heartbeat({ writtenAtMs: now - (3 * 60 + 12) * 60_000 });
  const harness = await createHarness({ lanes: lanesWith(trader), trader });
  try {
    const context = await harness.createContext();
    const { page, errors } = await openLiveTrading(context, harness.origin);
    assert.deepEqual(errors, []);

    const card = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"]');
    assert.match(await card.getAttribute("class"), /stale/, "the card must carry the stale tone rather than the live one");
    assert.match((await card.locator(".live-trading-lane-badge").textContent()).trim(), /HEARTBEAT STALE/);

    const alert = await card.locator(".live-trading-lane-alert").textContent();
    assert.match(alert, /No heartbeat for 3h 12m ago - past the 15m window/, "the alert must state the silence and the window it broke");
    assert.match(alert, /armed when it last wrote/, "the alert must say the armed record is history");
    assert.match(alert, /nothing here shows a loop running now/, "the alert must refuse to present the record as a running loop");

    const text = await card.textContent();
    assert.match(text, /armed when last seen - no run since/, "the trader row must not read as simply armed");
    assert.equal(/the loop last ran/i.test(text), false, "a stale card must not say the loop last ran as though it were current");
  } finally {
    await harness.close();
  }
});

test("a disabled lane stays visibly disabled and is not dressed with a heartbeat it does not have", async () => {
  const trader = heartbeat({ writtenAtMs: Date.now() - 60_000 });
  const harness = await createHarness({ lanes: lanesWith(trader), trader });
  try {
    const context = await harness.createContext();
    const { page } = await openLiveTrading(context, harness.origin);
    const card = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-2"]');
    assert.match(await card.getAttribute("class"), /parked/, "the disabled lane must keep the parked tone");
    const badge = (await card.locator(".live-trading-lane-badge").textContent()).trim();
    assert.equal(badge, "DISABLED");
    const text = await card.textContent();
    assert.ok(text.includes("not published for a disabled lane"), "the disabled lane must say its snapshot is not published");
    assert.equal(/\barmed\b/.test(text), false, "a lane with no trader must not show an arming state");
    assert.ok(text.includes("Parked in config/live-trading-lanes.json"), "the disabled lane must say why it is parked");
  } finally {
    await harness.close();
  }
});

test("the strip is readable on a phone: rows stack and nothing overflows its card", async () => {
  const trader = heartbeat({ writtenAtMs: Date.now() - 60_000 });
  const harness = await createHarness({ lanes: lanesWith(trader), trader });
  try {
    const context = await harness.createContext();
    const { page } = await openLiveTrading(context, harness.origin, { width: 390, height: 844 });
    const overflow = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("#liveTradingPanel .live-trading-lane-card"));
      return {
        page: document.documentElement.scrollWidth - window.innerWidth,
        cards: cards.map((card) => card.scrollWidth - card.clientWidth)
      };
    });
    assert.ok(overflow.page <= 1, `the page must not scroll sideways at 390px, overflows by ${overflow.page}px`);
    assert.deepEqual(overflow.cards.filter((value) => value > 1), [], "no card may overflow sideways on a phone");

    const columns = await page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row').first()
      .evaluate((row) => getComputedStyle(row).gridTemplateColumns.split(" ").filter(Boolean).length);
    assert.equal(columns, 1, "a phone must stack each row's label above its value rather than squeeze two columns");
  } finally {
    await harness.close();
  }
});
