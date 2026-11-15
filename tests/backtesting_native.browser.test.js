"use strict";

// The Backtesting tab as a reader meets it: the normal side menu, the North Star above a selectable map, the three
// columns that answer "what are we testing, on which markets, using which rules", a scored morning, a blocked
// morning, all twenty-five factors, and the same layout on a phone.
//
// Everything is read from the two committed artefacts; this test never writes to them.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const run = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "usd-layer1-backtester", "run-v1.json"), "utf8"));
const engine = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "usd-layer1-backtester", "engine-v1.json"), "utf8"));

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function serveRepo() {
  return http.createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
    const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    response.end(fs.readFileSync(filePath));
  });
}

const BLOCKED_PORTS = new Set([4045, 5060, 5061, 6000, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);

async function listenSafe(server) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    if (!BLOCKED_PORTS.has(server.address().port)) return;
    await new Promise((resolve) => server.close(resolve));
  }
  throw new Error("no usable local port for the dashboard test server");
}

function scoredDate(market) {
  return [...run.sessions]
    .reverse()
    .find((session) => {
      const result = session.results && session.results.challenger_v1 ? session.results.challenger_v1[market] : null;
      return result === "hit" || result === "miss";
    }).date;
}

const BLOCKED_DATE = [...engine.morning_states].reverse().find((morning) => morning.outcome === "blocked").date;

async function openTab(page, base) {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator('[data-tab="usd-layer1-backtester"]').click();
  await page.waitForSelector("[data-bt-map='true'] .bt-columns", { timeout: 25000 });
  await page.waitForSelector("[data-bt-path]", { timeout: 25000 });
}

test("Backtesting is a native tab: normal menu, active styling, North Star above the map", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const tab = page.locator('[data-tab="usd-layer1-backtester"]');
    await openTab(page, base);
    assert.equal((await tab.textContent()).trim(), "Backtesting", "the side navigation names the tab Backtesting");

    assert.equal(await tab.getAttribute("class").then((value) => value.includes("active")), true);
    assert.equal(await page.locator("#usdLayer1BacktesterView").getAttribute("class").then((value) => value.includes("active-view")), true);
    assert.equal(await page.locator("#usdLayer1BacktesterView h2").textContent(), "What are we testing, on which markets, using which rules?");

    const order = await page.evaluate(() => {
      const star = document.querySelector("[data-usd-l1-north-star='true']");
      const map = document.querySelector("[data-bt-map='true']");
      return { star: star.getBoundingClientRect().top, map: map.getBoundingClientRect().top };
    });
    assert.ok(order.star < order.map, "the North Star sits above the visual map");

    const columns = await page.$$eval("[data-bt-column]", (nodes) => nodes.map((node) => node.getAttribute("data-bt-column")));
    assert.deepEqual(columns, ["snapshot", "decision", "tests"]);
    const model = (await page.textContent("[data-bt-model]")).trim();
    assert.match(model, new RegExp(engine.engine_version));
    assert.match(model, new RegExp(engine.book_version));
    const tests = await page.$$eval("[data-bt-test]", (nodes) => nodes.map((node) => node.textContent.replace(/\s+/g, " ").trim()));
    assert.equal(tests.length, 4);
    assert.deepEqual(
      tests.map((text) => text.slice(0, 1)),
      ["\u2460", "\u2461", "\u2462", "\u2463"]
    );
    assert.deepEqual(pageErrors, [], "the tab must render without page errors");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("test 3 on EUR/USD shows the call, the levels and where the path stops, and the demo date shows the trade", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    await openTab(page, base);
    await page.locator("[data-bt-test='l2l_full_5r']").click();
    await page.waitForSelector("[data-bt-path] [data-bt-step='levels']");

    // A morning with no archived ladder must say so where the path stops.
    const stopped = await page.getAttribute("[data-bt-missing]", "data-bt-missing");
    assert.ok(Number(stopped) > 0, "the selected morning has a missing item");
    const missing = await page.textContent("[data-bt-missing]");
    assert.match(missing, /no five-minute tape|no archived ladder/);
    const steps = await page.$$eval("[data-bt-step]", (nodes) =>
      nodes.map((node) => [node.getAttribute("data-bt-step"), node.getAttribute("data-bt-step-status")])
    );
    assert.deepEqual(steps.map((entry) => entry[0]), ["snapshot", "call", "levels", "entry", "risk", "outcome"]);
    assert.equal(steps.find((entry) => entry[0] === "entry")[1], "missing");

    // The two-day execution demo is the one date where the trade exists, and it is labelled as a demo.
    await page.fill("[data-bt-date-input]", "2026-11-05");
    await page.waitForTimeout(500);
    const demoText = await page.textContent("[data-bt-path]");
    assert.match(demoText, /stop 1\.12392/, "the demo date shows the coded stop");
    assert.match(demoText, /no engine state row|execution demo/, "the demo date admits what it is");
    const mode = await page.getAttribute("[data-bt-canvas]", "data-bt-diagram-mode");
    assert.ok(["webgl", "canvas2d"].includes(mode), `the map drew in ${mode}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("one scored morning and one blocked morning explain themselves", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    await openTab(page, base);
    await page.locator("[data-bt-test='four_markets']").click();
    await page.locator("[data-bt-market='EURUSD']").click();
    await page.fill("[data-bt-date-input]", scoredDate("EURUSD"));
    await page.waitForTimeout(500);

    const scored = await page.textContent("[data-bt-path]");
    assert.match(scored, /EUR\/USD prediction/);
    assert.match(scored, /EUR\/USD (UP|DOWN)/);
    assert.match(scored, /flat band/);
    const scoredStep = await page.getAttribute("[data-bt-step='scored']", "data-bt-step-status");
    assert.equal(scoredStep, "present");

    await page.fill("[data-bt-date-input]", BLOCKED_DATE);
    await page.waitForTimeout(500);
    const direction = (await page.textContent("[data-bt-direction]")).trim();
    assert.ok(["No call", "BULLISH", "BEARISH"].includes(direction));
    const outcome = await page.textContent("[data-bt-outcome]");
    assert.match(outcome, /blocked|abstained/);
    const failsafes = await page.$$eval("[data-bt-failsafe]", (nodes) =>
      nodes.map((node) => [node.getAttribute("data-bt-failsafe"), node.textContent.replace(/\s+/g, " ").trim()])
    );
    assert.ok(failsafes.length >= 6, "all six engine fail-safes are listed");
    const failed = failsafes.filter((entry) => /blocked|abstained/.test(entry[1]));
    assert.ok(failed.length >= 1, "at least one fail-safe status is shown for the blocked morning");
    assert.match(failed[0][1], /RG-4|usable|deadband|vote|trade rule|receipt|voting signals/i);

    const factors = await page.$$("[data-bt-factor]");
    assert.equal(factors.length, engine.book_detail.rows.length);
    await page.locator("[data-bt-section='factors'] > summary").click();
    await page.locator("[data-bt-factor='live.f1-vix-level'] > summary").click();
    const detail = await page.textContent("[data-bt-factor='live.f1-vix-level']");
    assert.match(detail, /Adjudication allowed/);
    assert.match(detail, /What the engine did/);
    assert.match(detail, /vix_level/);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});


test("a deep link opens the tab on the same test, market and morning, and the top menu links to it", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    await page.goto(`${base}/#backtesting/l2l_half_3r/NAS100/2026-10-12`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-bt-map='true'] .bt-columns", { timeout: 25000 });
    const active = await page.locator('[data-tab="usd-layer1-backtester"]').getAttribute("class");
    assert.ok(active.includes("active"));
    assert.equal((await page.textContent("[data-bt-snapshot-date]")).trim(), "2026-10-12");
    assert.equal(await page.getAttribute("[data-bt-test='l2l_half_3r']", "aria-pressed"), "true");
    assert.equal(await page.getAttribute("[data-bt-market='NAS100']", "aria-pressed"), "true");
    assert.match(page.url(), /#backtesting\/l2l_half_3r\/NAS100\/2026-10-12/);
    assert.equal(await page.getAttribute(".topbar-link[href='index.html#backtesting']", "href"), "index.html#backtesting");

    // The standalone rules page keeps working and leads a reader into the native tab.
    const rules = await context.newPage();
    await rules.goto(`${base}/usd-l1-decision-rules-v1.html`, { waitUntil: "networkidle" });
    const back = rules.locator('a[href="index.html#backtesting"]');
    assert.equal(await back.count(), 1, "the standalone page links into the Backtesting tab");
    await back.click();
    await rules.waitForSelector("[data-bt-map='true'] .bt-columns", { timeout: 25000 });
    assert.ok((await rules.locator('[data-tab="usd-layer1-backtester"]').getAttribute("class")).includes("active"));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the same information is readable on a phone, with no sideways scroll", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.locator('[data-tab="usd-layer1-backtester"]').click();
    await page.waitForSelector("[data-bt-map='true'] .bt-columns", { timeout: 25000 });
    const layout = await page.evaluate(() => {
      const map = document.querySelector("[data-bt-map='true']");
      const panel = document.querySelector("#usdLayer1BacktesterView .backtest-panel");
      const columns = [...document.querySelectorAll("[data-bt-column]")];
      return {
        mapOverflow: map.scrollWidth - map.clientWidth,
        mapWidth: Math.round(map.getBoundingClientRect().width),
        panelWidth: Math.round(panel.getBoundingClientRect().width),
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        distinctRows: new Set(columns.map((column) => Math.round(column.getBoundingClientRect().top))).size
      };
    });
    assert.ok(layout.mapOverflow <= 2, `the map must not scroll sideways (${layout.mapOverflow}px)`);
    assert.ok(layout.panelOverflow <= 2, `the panel must not scroll sideways (${layout.panelOverflow}px)`);
    assert.ok(layout.panelWidth <= 390 && layout.mapWidth <= 390, `the map fits the phone (${layout.mapWidth}px of ${layout.panelWidth}px)`);
    assert.equal(layout.distinctRows, 3, "the three columns stack on a phone");
    assert.ok((await page.textContent("[data-bt-path]")).includes("Where the path stops"));
    assert.equal((await page.$$("[data-bt-test]")).length, 4, "the four tests stay selectable on a phone");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});


test("a scored miss and a no-call morning each say why: refused inputs, deadband, accuracy count", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    // 12 October 2026: the engine called a bearish USD and EUR/USD moved the other way.
    await page.goto(`${base}/#backtesting/four_markets/EURUSD/2026-10-12`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-bt-path] [data-bt-accuracy]", { timeout: 25000 });
    assert.equal((await page.textContent("[data-bt-direction]")).trim(), "BEARISH");
    assert.equal(await page.getAttribute("[data-bt-accuracy]", "data-bt-accuracy"), "miss");
    const missText = await page.textContent("[data-bt-accuracy]");
    assert.match(missText, /counted as a miss/);
    assert.match(missText, /-0\.3194%/);
    assert.equal(await page.getAttribute("[data-bt-accuracy]", "data-bt-accuracy-move"), "-0.3194");
    assert.equal(await page.getAttribute("[data-bt-deadband]", "data-bt-deadband"), "passed");
    assert.equal(await page.getAttribute("[data-bt-vote]", "data-bt-vote-tally"), "2/5/2/2");
    assert.equal(await page.getAttribute("[data-bt-stale]", "data-bt-stale"), "4", "four inputs were refused");

    // 9 October 2026: two rows were refused, the vote cancelled inside the deadband, so there is no call to score.
    await page.goto(`${base}/#backtesting/four_markets/EURUSD/2026-10-09`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-bt-path] [data-bt-accuracy]", { timeout: 25000 });
    assert.equal((await page.textContent("[data-bt-direction]")).trim(), "No call");
    assert.equal(await page.getAttribute("[data-bt-accuracy]", "data-bt-accuracy"), "excluded");
    assert.match(await page.textContent("[data-bt-accuracy]"), /Excluded from directional accuracy/);
    assert.equal(await page.getAttribute("[data-bt-deadband]", "data-bt-deadband"), "abstained");
    assert.match(await page.textContent("[data-bt-deadband]"), /0\.20 deadband/);
    assert.match(await page.textContent("[data-bt-deadband]"), /inside the 0\.20 deadband or nets exactly zero/);
    assert.equal(await page.getAttribute("[data-bt-vote]", "data-bt-vote-tally"), "3/2/4/2");
    const stale = await page.$$eval("[data-bt-stale-row]", (nodes) =>
      nodes.map((node) => ({ row: node.getAttribute("data-bt-stale-row"), text: node.textContent.replace(/\s+/g, " ").trim() }))
    );
    assert.deepEqual(stale.map((entry) => entry.row).sort(), ["live.f5-dxy-delta", "risk.usd-safe-haven-demand"]);
    for (const key of ["usdjpy_d1_pct", "usdchf_d1_pct", "broad_dollar_d5_pct", "broad_dollar_d1_pct"]) {
      assert.ok(stale.some((entry) => entry.text.includes(key)), `the stale list names ${key}`);
    }
    assert.ok(stale.every((entry) => /unclocked/.test(entry.text)), "an unclocked print is named as the reason");
    const counted = await page.$$eval("[data-bt-vote-row]", (nodes) =>
      nodes.map((node) => ({ id: node.getAttribute("data-bt-vote-row"), counted: node.lastElementChild.textContent.trim() }))
    );
    assert.equal(counted.length, 11, "every direction row is listed");
    assert.deepEqual(
      counted.filter((entry) => entry.counted === "no").map((entry) => entry.id).sort(),
      ["live.f5-dxy-delta", "risk.usd-safe-haven-demand"],
      "the refused rows are the two that could not vote"
    );
    assert.deepEqual(pageErrors, [], "the tab must render both mornings without page errors");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the verified count leads the tab, with its rungs, blockers, tests and one blocked morning to open", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await openTab(page, base);
    const gate = run.validity_gate;
    assert.equal(
      await page.getAttribute("[data-bt-verify]", "data-bt-verify"),
      `${gate.research_gate.accepted} / ${gate.intended.sessions}`,
      "the strip leads with the gate's own count"
    );
    const lead = (await page.textContent("[data-bt-verify-lead]")).replace(/\s+/g, " ").trim();
    assert.match(lead, new RegExp(`^0 / 725 verified mornings$`));
    const why = (await page.textContent("[data-bt-verify-why]")).replace(/\s+/g, " ");
    assert.match(why, /CONFIG_BLOCKED/);
    assert.match(why, /rule_defined false/);

    const outcomes = await page.$$eval("[data-bt-verified-outcome]", (nodes) =>
      nodes.map((node) => [node.getAttribute("data-bt-verified-outcome"), node.lastElementChild.textContent.trim()])
    );
    assert.deepEqual(outcomes, [
      ["directional", "0"],
      ["abstained", "0"],
      ["trading", "0"]
    ]);

    const rungs = await page.$$eval("[data-bt-rung]", (nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-bt-rung"),
        text: node.textContent.replace(/\s+/g, " ").trim()
      }))
    );
    assert.deepEqual(rungs.map((rung) => rung.id), ["present", "fresh", "clocked", "identified"]);
    const ladder = gate.ladder.filter((row) => row.scope === "sessions");
    for (const [index, rung] of rungs.entries()) {
      assert.match(rung.text, new RegExp(`${ladder[index].sessions_passing} / 725`), `${rung.id} quotes the gate`);
    }
    assert.match(rungs[2].text, /^A receipt proves the print existed before 05:00 London 0 \/ 725/);

    const blockers = await page.$$eval("[data-bt-blocker]", (nodes) =>
      nodes.map((node) => ({ id: node.getAttribute("data-bt-blocker"), text: node.textContent.replace(/\s+/g, " ").trim() }))
    );
    assert.deepEqual(
      blockers.map((row) => row.id),
      ["undefined-rule", "unclocked", "wrong-instrument", "missing-input", "stale-input", "fed-bias-no-source"]
    );
    assert.match(blockers[0].text, /725 dates/);
    assert.match(blockers[0].text, /model_identity\.js/);
    const overlap = (await page.textContent("[data-bt-verify-overlap]")).replace(/\s+/g, " ");
    assert.match(overlap, /must not be added/);

    const tests = await page.$$eval("[data-bt-verified-test]", (nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-bt-verified-test"),
        text: node.textContent.replace(/\s+/g, " ").trim()
      }))
    );
    assert.deepEqual(tests.map((entry) => entry.id), ["dxy_direction", "four_markets", "l2l_full_5r", "l2l_half_3r"]);
    assert.ok(tests.every((entry) => /verified 0 \/ 725/.test(entry.text)), "each test carries its own zero denominator");
    const markets = await page.$$eval("[data-bt-verified-market]", (nodes) =>
      nodes.map((node) => node.getAttribute("data-bt-verified-market"))
    );
    assert.deepEqual(markets, ["EURUSD", "XAUUSD", "NAS100", "BTCUSD"]);

    assert.equal((await page.$$("[data-bt-verified-exemplar]")).length, 1, "the strip says no verified morning exists");
    const blocked = page.locator("[data-bt-verified-blocked]");
    assert.equal(await blocked.getAttribute("data-bt-verified-blocked"), engine.proof_morning.date);
    assert.equal(
      await blocked.locator("a").getAttribute("href"),
      `#backtesting/four_markets/EURUSD/${engine.proof_morning.date}`
    );
    await blocked.locator("a").click();
    await page.waitForSelector(`[data-bt-snapshot-date]`);
    assert.equal((await page.textContent("[data-bt-snapshot-date]")).trim(), engine.proof_morning.date);
    assert.deepEqual(pageErrors, [], "the strip renders without page errors");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const strip = document.querySelector("[data-bt-verify]");
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stripWidth: Math.round(strip.getBoundingClientRect().width),
        stripOverflow: strip.scrollWidth - strip.clientWidth
      };
    });
    assert.ok(layout.pageOverflow <= 2, `the strip must not scroll the phone sideways (${layout.pageOverflow}px)`);
    assert.ok(layout.stripWidth <= 390, `the strip fits the phone viewport (${layout.stripWidth}px)`);
    assert.ok(layout.stripOverflow <= 2, `the strip's own content must not overflow (${layout.stripOverflow}px)`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the miss and the no call stay readable on a phone, with no sideways scroll", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  try {
    for (const [date, expected] of [["2026-10-12", "miss"], ["2026-10-09", "excluded"]]) {
      await page.goto(`${base}/#backtesting/four_markets/EURUSD/${date}`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-bt-path] [data-bt-accuracy]", { timeout: 25000 });
      assert.equal(await page.getAttribute("[data-bt-accuracy]", "data-bt-accuracy"), expected, `${date} is ${expected}`);
      const layout = await page.evaluate(() => {
        const section = document.querySelector("[data-bt-vote]");
        const accuracy = document.querySelector("[data-bt-accuracy]");
        const panel = document.querySelector("#usdLayer1BacktesterView .backtest-panel");
        const table = document.querySelector(".bt-vote-table");
        const wrap = document.querySelector(".bt-vote-wrap");
        return {
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          sectionOverflow: section.scrollWidth - section.clientWidth,
          panelWidth: Math.round(panel.getBoundingClientRect().width),
          panelOverflow: panel.scrollWidth - panel.clientWidth,
          tableOverflow: table.scrollWidth - table.clientWidth,
          wrapOverflow: wrap.scrollWidth - wrap.clientWidth,
          accuracyWidth: accuracy.getBoundingClientRect().width,
          accuracyVisible: accuracy.getBoundingClientRect().height > 0
        };
      });
      assert.ok(layout.pageOverflow <= 2, `${date} must not scroll sideways (${layout.pageOverflow}px)`);
      assert.ok(layout.sectionOverflow <= 2, `${date} vote block must not overflow (${layout.sectionOverflow}px)`);
      assert.ok(layout.panelWidth <= 390, `${date} panel fits the phone viewport (${layout.panelWidth}px)`);
      assert.ok(layout.panelOverflow <= 2, `${date} panel must not push past the phone (${layout.panelOverflow}px)`);
      assert.ok(layout.tableOverflow <= 2, `${date} vote table must not scroll sideways (${layout.tableOverflow}px)`);
      assert.ok(layout.wrapOverflow <= 2, `${date} vote wrapper must not scroll sideways (${layout.wrapOverflow}px)`);
      assert.ok(layout.accuracyVisible && layout.accuracyWidth > 200, `${date} accuracy line is readable on a phone`);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

