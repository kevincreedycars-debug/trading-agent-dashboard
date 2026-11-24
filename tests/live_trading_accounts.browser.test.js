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

// The code block the trader writes: a git blob that means the same commit everywhere git runs, and the sha256 of
// the bytes on that host's disk. It is part of the ordinary heartbeat now, so the fixture carries it unless a test
// asks for a record from before the block existed.
const TRADER_CODE = {
  script: "scripts/run-live-trading-trader.js",
  sha256: "b6422a720f1117274560c226e6aa690a0ad3d6132d8643cae0152d9751c13580",
  git_blob: "f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958",
  checkout_head: "c5abd0ac"
};

function heartbeat({ writtenAtMs, armed = true, status = "nothing_to_place", host = "PC-DESKTOP-A17", code = TRADER_CODE, coverage = null }) {
  return {
    schema_version: "live-trading-trader-status-v1",
    lane: "ftmo-1",
    host: { computer: host, platform: "win32", checkout: "live-trading" },
    expected_interval_seconds: 300,
    at_utc: new Date(writtenAtMs).toISOString(),
    written_at_utc: new Date(writtenAtMs).toISOString(),
    armed,
    status,
    code,
    reason: "no pair was left a ticket this run: every row states why, whether that is the rule, the account or the market.",
    account: { login_masked: "***614", server: "FTMO-Server" },
    terminal: { positions_open: 1, orders_open: 0, ours: 1 },
    close_requests: { enabled: true, error: null, taken: null },
    ...(coverage === null ? {} : { coverage }),
    duration_seconds: 1.67
  };
}

// The coverage block as the trader publishes it: the floor it aimed at, the rows it planned, and - when the floor
// did not hold - the asset and the reason, in the run's own words. `short` is the subset with lines that still fall
// below the floor, and the withheld entries are the symbols that took no new ticket because of it.
function coverageBlock({ status = "covered", extended = false, minPerSide = 10, short = [], failures = [], withheld = [] } = {}) {
  return {
    lane: "ftmo-1",
    status,
    checked_at_utc: "2026-11-23T18:36:30.000Z",
    extended,
    levels_available_at_utc: extended ? "2026-11-23T18:36:30.000Z" : null,
    min_per_side: minPerSide,
    short,
    failures,
    entries_withheld: withheld
  };
}

// The document's own `generated_at_utc` is the publish instant: the heartbeat and this document travel in one
// commit, so the strip judges the record by its age *when that commit was made*, and the commit's own age is a
// separate fact. Every case here is a publish that just happened carrying whatever the loop last wrote, which is
// the ordinary state of a page between publishes.
function lanesWith(trader, publishedAgeSeconds = 30) {
  const document = JSON.parse(JSON.stringify(lanesDocument));
  document.generated_at_utc = new Date(Date.now() - publishedAgeSeconds * 1000).toISOString();
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
    for (const expected of ["Live L2L Directional", "FTMO 1 · 5R", "ACTIVE", "enabled", "***614 / FTMO-Server", "armed", "nothing_to_place", "PC-DESKTOP-A17"]) {
      assert.ok(card.includes(expected), `the card must state ${expected}`);
    }
    // The heartbeat row carries both the age and the instant, so a reader can see which run wrote it.
    assert.match(card, /Last strategy tick\s*1m ago - \d{4}-\d{2}-\d{2}T/, "the strategy tick row must carry its age and its timestamp");
    // The snapshot row is the account's own snapshot age, drawn from the snapshot rather than the heartbeat.
    assert.match(card, /Last broker update\s*[0-9]+[a-z]? ?[0-9]*m? ?ago|[0-9]+d ago/, "the card must state the broker snapshot's age");

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
    assert.equal((await card.locator(".live-trading-lane-badge").textContent()).trim(), "STALE", "the badge says the state in one word");
    assert.equal((await card.locator("h4").textContent()).trim(), "Live L2L Directional", "the model keeps its name when the lane goes stale");

    const alert = await card.locator(".live-trading-lane-alert").textContent();
    assert.match(alert, /No heartbeat for 3h 12m ago - past the 15m window/, "the alert must state the silence and the window it broke");
    assert.match(alert, /armed when it last wrote/, "the alert must say the armed record is history");
    assert.match(alert, /nothing here shows a loop running now/, "the alert must refuse to present the record as a running loop");
    // The button that selects this lane must say the same word the card does, from the same rule.
    const selectorState = await page.locator('[data-live-lane="ftmo-1"] .live-trading-lane-badge').textContent();
    assert.equal(selectorState.trim(), "Stale", "the selector states the same stale word the card carries");

    const text = await card.textContent();
    assert.match(text, /armed when last seen - no run since/, "the trader row must not read as simply armed");
    assert.equal(/the loop last ran/i.test(text), false, "a stale card must not say the loop last ran as though it were current");
  } finally {
    await harness.close();
  }
});

test("a card names the code its heartbeat was written by, and says so plainly when the record is silent", async () => {
  const now = Date.now();
  const withCode = heartbeat({ writtenAtMs: now - 60_000 });
  const harness = await createHarness({ lanes: lanesWith(withCode), trader: withCode });
  try {
    const context = await harness.createContext();
    const { page, errors } = await openLiveTrading(context, harness.origin);
    assert.deepEqual(errors, [], "opening the section must not raise a script error");

    const row = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row', { hasText: "Trader code" });
    // The row states the head of the git blob - one number a reader can compare at a glance - and keeps both whole
    // digests in its tooltip, because the blob is the value `git rev-parse <rev>:<path>` answers with anywhere.
    assert.equal((await row.locator("dd").textContent()).trim(), "f43ac5ea318f");
    const title = await row.locator("dd").getAttribute("title");
    assert.match(title, /git blob f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958/);
    assert.match(title, /sha256 on that host b6422a720f1117274560c226e6aa690a0ad3d6132d8643cae0152d9751c13580/);
    assert.match(title, /checkout c5abd0ac/, "the pinned checkout is carried as a label beside the version");
    assert.match(title, /git rev-parse <rev>:scripts\/run-live-trading-trader\.js/, "the tooltip says which command compares it");
  } finally {
    await harness.close();
  }

  // A heartbeat written before the block existed: the card states the silence rather than an invented version, and
  // the strip stays healthy, because an older record is not a broken loop.
  const older = heartbeat({ writtenAtMs: now - 60_000, code: null });
  const silent = await createHarness({ lanes: lanesWith(older), trader: older });
  try {
    const context = await silent.createContext();
    const { page, errors } = await openLiveTrading(context, silent.origin);
    assert.deepEqual(errors, [], "an older heartbeat must not raise a script error");
    const row = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row', { hasText: "Trader code" });
    assert.equal((await row.locator("dd").textContent()).trim(), "not stated by this heartbeat");
    assert.match(await row.getAttribute("class"), /is-muted/, "an unstated version is drawn quietly, not as a fault");
    assert.equal(await row.locator("dd").getAttribute("title"), null, "there is nothing to tooltip when nothing was stated");
    assert.match((await cardText(page, "ftmo-1")), /ACTIVE/, "the card is still a running lane, whatever it can say about the build");
  } finally {
    await silent.close();
  }
});

// The ladder's floor, on the card. A short side is not a market with no signals - it is a rule with no next line to
// aim at - so the row states the instrument and the counts the run measured rather than leaving the silence to be
// read as a verdict on the pair. The three shapes here are a floor that held, a ladder that fell short with the
// entry withheld, and a record written before the block existed; the fourth is a malformed block, which must leave
// the card drawn and the rest of its rows intact.
test("the card states the ladder's floor and names a short ladder as short, not as a quiet market", async () => {
  const now = Date.now();

  const held = heartbeat({ writtenAtMs: now - 60_000, coverage: coverageBlock() });
  const heldHarness = await createHarness({ lanes: lanesWith(held), trader: held });
  try {
    const context = await heldHarness.createContext();
    const { page, errors } = await openLiveTrading(context, heldHarness.origin);
    assert.deepEqual(errors, [], "a covered ladder must not raise a script error");
    const row = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row', { hasText: "Ladder coverage" });
    assert.equal((await row.locator("dd").textContent()).trim(), "held at 10 full lines each side");
    assert.equal(await row.getAttribute("class"), "live-trading-lane-row", "a floor that held is drawn without a warning tone");
    assert.match(
      await row.locator("dd").getAttribute("title"),
      /a next line to aim at in both directions/,
      "the tooltip says what a full ladder buys the rule"
    );
    await page.close();
  } finally {
    await heldHarness.close();
  }

  // The audit's own case: EURUSD has ten lines above and three below, so the rule has no next target under the
  // price and the run took no new entry there - while everything already working stayed reviewed, moved and exited.
  const reason = "the ladder stops 7 lines below the newest close and the step cap would not reach the floor";
  const short = heartbeat({
    writtenAtMs: now - 60_000,
    coverage: coverageBlock({
      status: "failed",
      short: [{ symbol: "EURUSD", asset: "EURUSD", above: 10, below: 3, reason }],
      failures: [{ symbol: "EURUSD", asset: "EURUSD", lane: "ftmo-1", reason }],
      withheld: ["EURUSD"]
    })
  });
  const shortHarness = await createHarness({ lanes: lanesWith(short), trader: short });
  try {
    const context = await shortHarness.createContext();
    const { page, errors } = await openLiveTrading(context, shortHarness.origin);
    assert.deepEqual(errors, [], "a short ladder must not raise a script error");
    const row = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row', { hasText: "Ladder coverage" });
    const value = (await row.locator("dd").textContent()).trim();
    assert.match(value, /^short - EURUSD 10 above \/ 3 below/, "the row states the instrument and both measured counts");
    assert.match(value, /no new entry on EURUSD this run/, "the row states the withheld entry beside the shortfall");
    assert.match(await row.getAttribute("class"), /is-stale/, "a shortfall is drawn as a warning, not as a quiet fact");
    const title = await row.locator("dd").getAttribute("title");
    assert.match(title, /does not reach the floor on one instrument/);
    assert.match(title, new RegExp(`EURUSD has 10 above / 3 below \\(${reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
    assert.match(title, /still reviewed, moved and exited/, "a withheld entry is never presented as an unmanaged account");
    await page.close();
  } finally {
    await shortHarness.close();
  }

  // A record written before the block existed states that plainly. It is not evidence of a shortfall, and it is not
  // drawn as a fault: the card is still the running lane's card.
  const older = heartbeat({ writtenAtMs: now - 60_000 });
  const olderHarness = await createHarness({ lanes: lanesWith(older), trader: older });
  try {
    const context = await olderHarness.createContext();
    const { page, errors } = await openLiveTrading(context, olderHarness.origin);
    assert.deepEqual(errors, [], "an older heartbeat must not raise a script error");
    const row = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row', { hasText: "Ladder coverage" });
    assert.equal((await row.locator("dd").textContent()).trim(), "not stated by this heartbeat");
    assert.match(await row.getAttribute("class"), /is-muted/, "an unstated floor is drawn quietly, not as a fault");
    assert.match(await cardText(page, "ftmo-1"), /ACTIVE/, "the lane is still a running lane, whatever it can say about its ladder");
    await page.close();
  } finally {
    await olderHarness.close();
  }

  // A block of the wrong shape: nothing is inferred from it, nothing throws, and the rows around it are still drawn.
  const malformed = heartbeat({
    writtenAtMs: now - 60_000,
    coverage: { status: 42, min_per_side: -3, short: "nope", failures: [null, 7], entries_withheld: { a: 1 } }
  });
  const malformedHarness = await createHarness({ lanes: lanesWith(malformed), trader: malformed });
  try {
    const context = await malformedHarness.createContext();
    const { page, errors } = await openLiveTrading(context, malformedHarness.origin);
    assert.deepEqual(errors, [], "a malformed coverage block must not take the card down");
    const row = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-1"] .live-trading-lane-row', { hasText: "Ladder coverage" });
    assert.equal((await row.locator("dd").textContent()).trim(), "the run stated no floor");
    assert.match(await cardText(page, "ftmo-1"), /Last strategy tick/, "the rows around it are still drawn");
    await page.close();
  } finally {
    await malformedHarness.close();
  }
});


// separate word beside it, and the account and its R sit beneath it as secondary detail. A case that only checked
// that "FTMO" was gone from the headline would not notice the account creeping back in, so each of the four parts
// is read from its own element. The two files that carry the same naming choice - this page and the lanes
// configuration - are compared here so they cannot drift apart quietly.
test("both strips read the model's name, with the state, the account and its R kept apart from it", async () => {
  const trader = heartbeat({ writtenAtMs: Date.now() - 60_000 });
  const harness = await createHarness({ lanes: lanesWith(trader), trader });
  try {
    const context = await harness.createContext();
    const { page, errors } = await openLiveTrading(context, harness.origin);
    assert.deepEqual(errors, [], "the strip must draw without a script error");
    const expected = [
      { id: "ftmo-1", name: "Live L2L Directional", account: "FTMO 1", r: 5 },
      { id: "ftmo-2", name: "Live 0.5L2L Directional", account: "FTMO 2", r: 3 }
    ];
    for (const lane of expected) {
      const card = page.locator(`#liveTradingPanel .live-trading-lane-card[data-lane="${lane.id}"]`);
      assert.equal((await card.locator("h4").textContent()).trim(), lane.name, "the card's headline is the model");
      assert.equal(
        (await card.locator(".live-trading-lane-identity").textContent()).trim(),
        `${lane.account} · ${lane.r}R`,
        "the account and its R are the line under the name"
      );
      const cardState = (await card.locator(".live-trading-lane-badge").textContent()).trim();
      assert.ok(["ACTIVE", "STALE", "PAUSED"].includes(cardState), `the badge is one of the three state words, got ${cardState}`);
      assert.notEqual(cardState.toLowerCase(), "ftmo", "the state never stands in for the name");

      const button = page.locator(`[data-live-lane="${lane.id}"]`);
      assert.equal((await button.locator(".live-trading-lane-label").textContent()).trim(), lane.name, "the selector's headline is the same model name");
      assert.match(
        (await button.locator(".live-trading-lane-note").textContent()).trim(),
        new RegExp(`^${lane.account} · ${lane.r}R`),
        "the selector's second line leads with the account and its R"
      );
      const buttonState = (await button.locator(".live-trading-lane-badge").textContent()).trim();
      assert.ok(["Active", "Stale", "Paused"].includes(buttonState), `the selector states the state in its own word, got ${buttonState}`);
      // One rule behind both words: a lane cannot read ACTIVE on the card and Stale on the button that selects it.
      assert.equal(cardState, buttonState.toUpperCase(), `the card and its selector must state one word for ${lane.id}`);
    }

    // The same two names in both documents that state them: the config the publisher reads and the artifact it
    // publishes. The page draws its own constant, so this is the guard against the three drifting apart.
    for (const relative of ["config/live-trading-lanes.json", "data/live-trading-lanes.json"]) {
      const lanes = readJson(relative).lanes;
      for (const lane of expected) {
        assert.equal(lanes.find((row) => row.id === lane.id).label, lane.name, `${relative} must carry the name the page draws`);
      }
    }

    // The third name is reserved before its lane exists, so the blind lane reads the same the day it is deployed.
    const script = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");
    assert.match(script, /"ftmo-3": "Live L2L Blind"/, "the blind lane's name is reserved in the page");
  } finally {
    await harness.close();
  }
});

// The parked lane this test draws is parked by its own fixture, not by whatever the published document happens to
// say today: both lanes are enabled in the artifact now that account 2 trades, and the card's disabled tone is
// still a thing the page must be able to draw.
function lanesWithParkedLane(trader, publishedAgeSeconds = 30) {
  const document = lanesWith(trader, publishedAgeSeconds);
  const parked = document.lanes.find((lane) => lane.id === "ftmo-2");
  parked.enabled = false;
  parked.trader = {};
  return document;
}

test("a disabled lane stays visibly disabled and is not dressed with a heartbeat it does not have", async () => {
  const trader = heartbeat({ writtenAtMs: Date.now() - 60_000 });
  const harness = await createHarness({ lanes: lanesWithParkedLane(trader), trader });
  try {
    const context = await harness.createContext();
    const { page } = await openLiveTrading(context, harness.origin);
    const card = page.locator('#liveTradingPanel .live-trading-lane-card[data-lane="ftmo-2"]');
    assert.match(await card.getAttribute("class"), /parked/, "the disabled lane must keep the parked tone");
    const badge = (await card.locator(".live-trading-lane-badge").textContent()).trim();
    assert.equal(badge, "PAUSED");
    assert.equal((await card.locator("h4").textContent()).trim(), "Live 0.5L2L Directional", "a parked lane keeps its model's name too");
    assert.match(await card.locator(".live-trading-lane-badge").getAttribute("title"), /Parked in config\/live-trading-lanes\.json/, "the badge's tooltip says why it is paused");
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
