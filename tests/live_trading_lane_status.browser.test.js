// The status button beside the account selector.
//
// One word for the account on screen, and a press opens the facts behind it. The tests here are about the two
// ways that word can lie: saying "live" for a lane that is silent, on the wrong account or not allowed to
// trade, and answering for the wrong account - a lane with no data of its own must never be described with the
// other lane's numbers. The freshness assertions are made twice on one page, because the point of the button
// is that the ages move while somebody is looking rather than being frozen at the moment of the fetch.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const laneOneSnapshotBase = readJson("data/live-trading.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

// A snapshot of one account, built from the real published one so the charts and tables below the status have
// something true to draw. The account block, the terminal flags and the age are the caller's, which is all
// this test reads.
function snapshot({ login, server = "FTMO-Server", ageSeconds = 0, connected = true, tradeAllowed = true } = {}) {
  const copy = JSON.parse(JSON.stringify(laneOneSnapshotBase));
  copy.account = { ...copy.account, login_masked: login, server };
  copy.terminal = { ...(copy.terminal || {}), connected, trade_allowed: tradeAllowed, tradeapi_disabled: false, build: 6314 };
  copy.positions = [];
  copy.orders = [];
  copy.closed_trades = [];
  copy.account.positions_open = 0;
  copy.account.orders_open = 0;
  copy.stale_after_seconds = 900;
  copy.generated_at_utc = new Date(Date.now() - ageSeconds * 1000).toISOString();
  return copy;
}

function heartbeat({ lane, writtenAt, armed, status = "nothing_to_place", grid, rMultiple, magic, paused = false, cap = null, login }) {
  const at = writtenAt || new Date().toISOString();
  const document = {
    schema_version: "live-trading-trader-status-v1",
    lane,
    host: { computer: "PC-LANE", platform: "win32", checkout: lane },
    expected_interval_seconds: 300,
    at_utc: at,
    written_at_utc: at,
    armed,
    status,
    reason: status === "nothing_to_place" ? "no pair was left a ticket this run" : null,
    account: { login_masked: login, server: lane === "ftmo-2" ? "FTMO-Server3" : "FTMO-Server" },
    strategy: { grid, r_multiple: rMultiple, magic, entries_paused: paused, identity_checked: true },
    entries_paused: paused,
    duration_seconds: 1.2
  };
  if (cap !== null) {
    document.caps = { expire_minutes: null, max_open: null, max_per_day: cap, trade_day: "2026-11-09", trade_day_timezone: "Europe/Prague" };
  }
  return document;
}


function lanesDocument({ laneTwoEnabled = true, laneTwoLogin = "***222", laneTwoServer = "FTMO-Server3" } = {}) {
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
        account_login_masked: laneTwoLogin,
        account_server: laneTwoServer,
        status: laneTwoEnabled ? "published" : "disabled",
        trader: { published: "data/live-trading-trader.ftmo-2.json" }
      }
    ]
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

async function createHarness({ lanes, laneOne = null, laneTwo = null, heartbeats = {} } = {}) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const json = body => {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    const missing = () => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    };
    if (pathname === "/data/live-trading-lanes.json") return json(lanes);
    if (pathname === "/data/live-trading.json") return laneOne ? json(laneOne) : missing();
    if (pathname === "/data/live-trading.account2.json") return laneTwo ? json(laneTwo) : missing();
    if (pathname === "/data/live-trading-trader.ftmo-1.json") return heartbeats["ftmo-1"] ? json(heartbeats["ftmo-1"]) : missing();
    if (pathname === "/data/live-trading-trader.ftmo-2.json") return heartbeats["ftmo-2"] ? json(heartbeats["ftmo-2"]) : missing();
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return missing();
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
  await page.locator("#liveTradingPanel .live-trading-status-button").waitFor();
  await page.locator("#liveTradingPanel .live-trading-chips", { hasText: /\*\*\*614/ }).waitFor();
  return { page, errors };
}

async function selectLane(page, id, login) {
  await page.locator(`[data-live-lane="${id}"]`).click();
  await page.locator(`[data-live-lane="${id}"][aria-pressed="true"]`).waitFor();
  await page.locator("#liveTradingPanel .live-trading-chips", { hasText: new RegExp(login) }).waitFor();
}

const statusWord = async page => (await page.locator("#liveTradingPanel .live-trading-status-word").innerText()).trim();
const statusState = async page => page.locator("#liveTradingPanel #liveTradingStatus").getAttribute("data-live-status-state");

test("the button follows the selector, and its panel states the facts behind the word", async () => {
  const harness = await createHarness({
    lanes: lanesDocument(),
    laneOne: snapshot({ login: "***614" }),
    laneTwo: snapshot({ login: "***222", server: "FTMO-Server3" }),
    heartbeats: {
      "ftmo-1": heartbeat({ lane: "ftmo-1", armed: true, grid: "full", rMultiple: 5, magic: 20261004, login: "***614" }),
      "ftmo-2": heartbeat({ lane: "ftmo-2", armed: false, grid: "half", rMultiple: 3, magic: 20261005, cap: 4, login: "***222" })
    }
  });
  try {
    const { page, errors } = await openLiveTrading(harness);
    // Lane 1: a fresh armed heartbeat, a fresh feed, an account that matches and a terminal that allows it.
    assert.equal(await statusWord(page), "Live \u00b7 armed");
    assert.equal(await statusState(page), "live");
    assert.equal(await page.locator("#liveTradingStatusPanel").isVisible(), false, "closed until it is pressed");

    await page.locator("#liveTradingPanel .live-trading-status-button").click();
    assert.equal(await page.locator("#liveTradingStatusPanel").isVisible(), true);
    assert.equal(await page.locator("#liveTradingPanel .live-trading-status-button").getAttribute("aria-expanded"), "true");
    const laneOnePanel = await page.locator("#liveTradingStatusPanel").innerText();
    assert.match(laneOnePanel, /\*\*\*614 on FTMO-Server/);
    assert.match(laneOnePanel, /feed age[\s\S]*inside the 15m window/i);
    assert.match(laneOnePanel, /last tick \(uk\)[\s\S]*UK/i);
    assert.match(laneOnePanel, /tick outcome[\s\S]*nothing to place, armed/i);
    assert.match(laneOnePanel, /trading permission[\s\S]*algo trading allowed/i);
    assert.match(laneOnePanel, /loaded rules[\s\S]*full grid \u00b7 5R \u00b7 magic 20261004/i);
    assert.match(laneOnePanel, /effective cap[\s\S]*not stated by the heartbeat/i);
    assert.match(laneOnePanel, /identity check[\s\S]*verified against the lane's private identity file/i);
    assert.match(laneOnePanel, /Live \u00b7 armed/);

    // Switching account moves the button and the open panel together, and no lane-1 figure follows it.
    await selectLane(page, "ftmo-2", "222");
    assert.equal(await statusWord(page), "Monitoring \u00b7 unarmed");
    assert.equal(await statusState(page), "monitoring");
    assert.equal(await page.locator("#liveTradingStatusPanel").isVisible(), true, "the panel stays open across a switch");
    const laneTwoPanel = await page.locator("#liveTradingStatusPanel").innerText();
    assert.match(laneTwoPanel, /\*\*\*222 on FTMO-Server3/);
    assert.match(laneTwoPanel, /half grid \u00b7 3R \u00b7 magic 20261005[\s\S]*restated by the heartbeat/);
    assert.match(laneTwoPanel, /4 a day, as the last run recorded it/);
    assert.match(laneTwoPanel, /nothing to place, unarmed/);
    assert.doesNotMatch(laneTwoPanel, /614/, "lane 1's login is nowhere in lane 2's panel");
    assert.doesNotMatch(await page.locator("#liveTradingPanel .live-trading-status-meta").innerText(), /614/);
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await harness.close();
  }
});



test("a silent loop reads stale, in UK time, and the page re-reads its own holding without a reload", async () => {
  // A July instant, so the UK clock and UTC differ by an hour: 12:00Z is 13:00 in London.
  const oldAt = "2026-07-01T12:00:00Z";
  const harness = await createHarness({
    lanes: lanesDocument(),
    laneOne: snapshot({ login: "***614" }),
    laneTwo: snapshot({ login: "***222", server: "FTMO-Server3" }),
    heartbeats: {
      "ftmo-1": heartbeat({ lane: "ftmo-1", armed: true, writtenAt: oldAt, grid: "full", rMultiple: 5, magic: 20261004, login: "***614" }),
      "ftmo-2": heartbeat({ lane: "ftmo-2", armed: false, grid: "half", rMultiple: 3, magic: 20261005, cap: 4, login: "***222" })
    }
  });
  try {
    const { page, errors } = await openLiveTrading(harness);
    assert.equal(await statusWord(page), "Stale");
    await page.locator("#liveTradingPanel .live-trading-status-button").click();
    const stalePanel = await page.locator("#liveTradingStatusPanel").innerText();
    assert.match(stalePanel, /last tick \(uk\)[\s\S]*2026-07-01 13:00:00 UK/i);
    assert.match(stalePanel, /outside the 15 minute window/);

    // The clock the panel runs on is installed, and one repaint of the page's own holding moves the word: the
    // same page, the same fetched artifacts, only the record replaced with a current one.
    assert.equal(await page.evaluate(() => typeof liveTradingStatusClock), "number");
    await page.evaluate(() => {
      const nowIso = new Date().toISOString();
      const artifact = liveTradingLanes.statuses["ftmo-1"];
      artifact.data.written_at_utc = nowIso;
      artifact.data.at_utc = nowIso;
      renderLiveTradingStatus();
    });
    assert.equal(await statusWord(page), "Live \u00b7 armed");
    assert.match(await page.locator("#liveTradingStatusPanel").innerText(), /inside the 15m window/);
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("an account the lanes file does not name is a mismatch, not a live lane", async () => {
  const harness = await createHarness({
    lanes: lanesDocument({ laneTwoLogin: "***222" }),
    laneOne: snapshot({ login: "***614" }),
    laneTwo: snapshot({ login: "***999", server: "FTMO-Server3" }),
    heartbeats: {
      "ftmo-1": heartbeat({ lane: "ftmo-1", armed: true, grid: "full", rMultiple: 5, magic: 20261004, login: "***614" }),
      "ftmo-2": heartbeat({ lane: "ftmo-2", armed: true, grid: "half", rMultiple: 3, magic: 20261005, cap: 4, login: "***999" })
    }
  });
  try {
    const { page } = await openLiveTrading(harness);
    await selectLane(page, "ftmo-2", "999");
    // Armed and fresh, but on an account nobody configured: the word says mismatch whatever else agrees.
    assert.equal(await statusWord(page), "Account mismatch");
    assert.equal(await statusState(page), "mismatch");
    await page.locator("#liveTradingPanel .live-trading-status-button").click();
    const panel = await page.locator("#liveTradingStatusPanel").innerText();
    assert.match(panel, /\*\*\*999/);
    assert.match(panel, /\*\*\*222/);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("a lane with no snapshot of its own says status unknown and borrows nothing", async () => {
  const harness = await createHarness({
    lanes: lanesDocument(),
    laneOne: snapshot({ login: "***614" }),
    laneTwo: null,
    heartbeats: {
      "ftmo-1": heartbeat({ lane: "ftmo-1", armed: true, grid: "full", rMultiple: 5, magic: 20261004, login: "***614" })
    }
  });
  try {
    const { page } = await openLiveTrading(harness);
    await page.locator('[data-live-lane="ftmo-2"]').click();
    await page.locator('[data-live-lane="ftmo-2"][aria-pressed="true"]').waitFor();
    assert.equal(await statusWord(page), "Status unknown");
    assert.equal(await statusState(page), "unknown");
    await page.locator("#liveTradingPanel .live-trading-status-button").click();
    const panel = await page.locator("#liveTradingStatusPanel").innerText();
    assert.doesNotMatch(panel, /614/, "the other account's numbers are not used as a stand-in");
    assert.match(panel, /none of the other account's figures stands in for them/);
    await page.close();
  } finally {
    await harness.close();
  }
});

test("entries switched off are named as paused even while the loop is armed", async () => {
  const harness = await createHarness({
    lanes: lanesDocument(),
    laneOne: snapshot({ login: "***614" }),
    laneTwo: snapshot({ login: "***222", server: "FTMO-Server3" }),
    heartbeats: {
      "ftmo-1": heartbeat({ lane: "ftmo-1", armed: true, grid: "full", rMultiple: 5, magic: 20261004, login: "***614" }),
      "ftmo-2": heartbeat({ lane: "ftmo-2", armed: true, grid: "half", rMultiple: 3, magic: 20261005, paused: true, cap: 4, login: "***222" })
    }
  });
  try {
    const { page } = await openLiveTrading(harness);
    await selectLane(page, "ftmo-2", "222");
    assert.equal(await statusWord(page), "Entries paused");
    assert.equal(await statusState(page), "paused");
    await page.close();
  } finally {
    await harness.close();
  }
});

