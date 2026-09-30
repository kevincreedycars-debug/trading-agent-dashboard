const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

// The Live Trading section is a read-only broker snapshot published at the owner's instruction, so the
// guard checks three things a markup assertion would miss: the rail entry the user actually clicks, the
// cards rendered from the shipped snapshot rather than a fixture, and the honesty mechanism that keeps a
// stale M5 series from wearing the live read. A copy that quietly gained an order control, or one that
// presented an hours-old bar series as current, would still pass a "the tab exists" check.
const repoRoot = path.resolve(__dirname, "..");
const snapshot = readJson("data/live-trading.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function escapeForRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function servedInstruments(feed) {
  return (feed.instruments || []).filter(instrument => instrument?.available === true && instrument?.m5);
}

// Mirrors the page's own coverage sentence, derived from the feed so it cannot drift from the artifact.
function currentBarPhrase(feed) {
  const served = servedInstruments(feed);
  const current = served.filter(instrument => instrument.m5.stale !== true).length;
  return current === served.length
    ? `all ${served.length} instruments on a current M5 bar`
    : `${current} of ${served.length} instruments on a current M5 bar`;
}

// Serves the published dashboard from this checkout, so the panel is proved against the shipped
// snapshot. Only the live-trading file is overridable: the stale-read rule needs a series whose newest
// bar is genuinely old, and waiting for the terminal to produce one is not a test.
async function createHarness() {
  let liveTrading = null;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (pathname === "/data/live-trading.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(liveTrading || snapshot));
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
    setLiveTrading(value) { liveTrading = value; },
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  };
}

async function openLiveTrading(context, origin) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  const button = page.locator('button.tab-button[data-tab="live-trading"]');
  await button.waitFor();
  await button.click();
  await page.locator("#liveTradingView.active-view").waitFor();
  await page.locator("#liveTradingPanel .live-trading-banner").waitFor();
  // The panel paints once before the snapshot fetch settles (label AGE UNKNOWN, no cards) and repaints
  // with the data, so the guard waits for the cards rather than for the banner.
  await page.waitForFunction(() => document.querySelectorAll("#liveTradingPanel .live-trading-card").length > 0);
  return { page, button, errors };
}

test("the published dashboard opens the read-only Live Trading section", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const { page, button, errors } = await openLiveTrading(context, harness.origin);

    assert.equal(await page.locator('button.tab-button[data-tab="live-trading"]').count(), 1, "the rail must carry exactly one Live Trading entry");
    assert.equal((await button.textContent()).trim(), "Live Trading");
    assert.equal(await button.isVisible(), true);
    assert.equal(await button.evaluate(node => node.previousElementSibling?.textContent?.trim()), "Live", "the entry must sit under its own Live group label");
    assert.equal(await page.locator("#architectureView.active-view").count(), 0, "opening Live Trading must close the other views");

    const updated = await page.locator("#liveTradingUpdated").textContent();
    assert.match(updated, new RegExp(escapeForRegExp(snapshot.generated_at_utc)), "the header must name the snapshot the panel is showing");
    assert.equal(await page.locator("#liveTradingPanel .live-trading-card").count(), snapshot.instruments.length, "every instrument in the shipped snapshot must render one card");
    assert.ok(await page.locator("#liveTradingPanel .live-trading-chip").count() >= 12, "the account chips must state the broker facts the section shows");
    const bannerText = await page.locator("#liveTradingPanel .live-trading-banner p").textContent();
    const badge = (await page.locator("#liveTradingPanel .live-trading-badge").textContent()).trim();
    // The shipped snapshot may be inside or past its own staleness window by the time the suite runs, so
    // the guard asserts the relation the page must hold rather than a figure that ages: a fresh badge
    // carries the M5 coverage count, a stale badge says nothing is writing to the file.
    assert.ok(["FRESH", "STALE"].includes(badge), `the banner must state the snapshot's age, saw ${badge}`);
    if (badge === "FRESH") {
      assert.match(bannerText, new RegExp(escapeForRegExp(currentBarPhrase(snapshot))), "a fresh snapshot must state how many instruments are on a current M5 bar");
    } else {
      assert.match(bannerText, /Nothing is writing to this file/, "a stale snapshot must say why the feed has stopped");
    }

    const firstCard = await page.locator("#liveTradingPanel .live-trading-card").first().textContent();
    for (const label of ["Bid", "Ask", "M5 close", "Newest M5 bar"]) {
      assert.ok(firstCard.includes(label), `a card must show ${label}`);
    }

    const provenance = await page.locator("#liveTradingPanel .live-trading-provenance").textContent();
    assert.match(provenance, /Read-only\./);
    assert.match(provenance, /no order code/);
    assert.match(provenance, /not a signal/);

    const controls = '#liveTradingView button, #liveTradingView input, #liveTradingView select, #liveTradingView form, #liveTradingView textarea';
    assert.equal(await page.locator(controls).count(), 0, "the read-only section must offer no control that could be mistaken for an order path");

    assert.equal(snapshot.read_only, true, "the shipped snapshot must declare itself read-only");
    assert.equal(snapshot.order_functions_called, false, "the shipped snapshot must record that the producer called no order function");
    assert.deepEqual(errors, [], "opening the section must not raise a script error");
  } finally { await harness.close(); }
});

test("a stale M5 series is labelled stale, never presented as a live read", async () => {
  const harness = await createHarness();
  try {
    const fresh = clone(snapshot);
    fresh.generated_at_utc = new Date(Date.now() - 60000).toISOString();
    harness.setLiveTrading(fresh);

    const freshContext = await harness.createContext();
    const { page: freshPage } = await openLiveTrading(freshContext, harness.origin);
    assert.equal((await freshPage.locator("#liveTradingPanel .live-trading-badge").textContent()).trim(), "FRESH", "a snapshot inside its window is labelled fresh");
    assert.match(
      await freshPage.locator("#liveTradingPanel .live-trading-banner p").textContent(),
      new RegExp(escapeForRegExp(currentBarPhrase(fresh)))
    );
    assert.equal(await freshPage.locator("#liveTradingPanel .live-trading-alert").count(), 0, "a current series needs no alert");
    assert.match(
      (await freshPage.locator("#liveTradingPanel .live-trading-card").first().locator(".live-trading-direction").textContent()).trim(),
      /^5M (UP|DOWN|FLAT)$/
    );
    await freshContext.close();

    const stale = clone(fresh);
    const served = servedInstruments(stale)[0];
    served.m5.stale = true;
    served.m5.note = "The newest M5 bar in this snapshot is 2h 10m old, so this card is not a current 5M read.";
    harness.setLiveTrading(stale);

    const staleContext = await harness.createContext();
    const { page: stalePage } = await openLiveTrading(staleContext, harness.origin);
    const staleCard = stalePage.locator("#liveTradingPanel .live-trading-card").first();
    assert.equal((await stalePage.locator("#liveTradingPanel .live-trading-badge").textContent()).trim(), "FRESH", "the snapshot itself can still be inside its window");
    assert.equal((await staleCard.locator(".live-trading-direction").textContent()).trim(), "5M STALE", "a stale series must not wear the live direction badge");
    assert.match(await staleCard.locator(".live-trading-alert").textContent(), /not a current 5M read/, "the card must say why it is not a live read");
    assert.match(
      await stalePage.locator("#liveTradingPanel .live-trading-banner p").textContent(),
      new RegExp(escapeForRegExp(currentBarPhrase(stale))),
      "the banner must drop to the reduced coverage count when a series is stale"
    );
    await staleContext.close();
  } finally { await harness.close(); }
});
