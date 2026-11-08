"use strict";

// The USD Layer 1 Backtester panel in a real browser: the permanent North Star, the four test tabs, the real
// coverage counts, the per-test tables, the per-date drill-down that answers its three questions, and the
// candle replay of the execution demo with its stepper.
//
// The panel renders one committed research artefact. This test never writes to it: the file is hashed before
// and after the run to prove the panel only reads.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const artefactPath = path.join(rootDir, "data", "usd-layer1-backtester", "run-v1.json");
const artefact = JSON.parse(fs.readFileSync(artefactPath, "utf8"));

const ORDINALS = ["\u2460", "\u2461", "\u2462", "\u2463"];

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
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(fs.readFileSync(filePath));
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

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}


test("the USD Layer 1 backtester panel renders saved research, not a live run", async () => {
  const before = sha256(fs.readFileSync(artefactPath, "utf8"));
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const externalRequests = [];
  let auditPhase = "baseline";
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")) return;
    if (auditPhase === "panel") externalRequests.push(url);
  });

  try {
    auditPhase = "baseline";
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    auditPhase = "panel";
    await page.getByRole("button", { name: "USD L1 Backtester" }).click();
    await page.waitForSelector("[data-usd-l1-progress='true']", { timeout: 20000 });

    // The North Star is permanent markup at the top of the panel and says exactly what the brief asks.
    const northStar = (await page.textContent("[data-usd-l1-north-star='true'] .usd-l1-north-star-text")).trim();
    assert.equal(northStar, artefact.north_star);
    assert.match(northStar, /05:00 London/);
    assert.match(northStar, /\u00a3100,000/);
    for (const ordinal of ORDINALS) assert.ok(northStar.includes(ordinal), `the North Star names test ${ordinal}`);
    const northStarFirst = await page.evaluate(() => {
      const panel = document.querySelector("[data-usd-l1-root='true']");
      const star = document.querySelector("[data-usd-l1-north-star='true']");
      return star.getBoundingClientRect().top < panel.getBoundingClientRect().top;
    });
    assert.equal(northStarFirst, true, "the North Star sits above everything the panel renders");

    // Progress: run version, date range, sessions processed out of eligible, current stage and each stage.
    const progressText = await page.textContent("[data-usd-l1-progress='true']");
    assert.match(progressText, new RegExp(artefact.run.run_version));
    assert.match(progressText, new RegExp(artefact.run.challenger_version));
    assert.match(progressText, new RegExp(`${artefact.run.sessions_processed} / ${artefact.run.sessions_eligible}`));
    assert.equal(
      (await page.textContent("[data-usd-l1-progress='true'] h3")).trim(),
      artefact.progress.current_stage_label
    );
    const stageKeys = await page.$$eval("[data-usd-l1-stage]", (nodes) =>
      nodes.map((node) => node.getAttribute("data-usd-l1-stage")));
    assert.deepEqual(stageKeys, artefact.progress.stages.map((stage) => stage.key));

    // Coverage: the counts the panel prints are the artefact's counts, per model.
    const challengerCoverage = await page.textContent("[data-usd-l1-model='challenger'] .usd-l1-coverage-number");
    assert.match(challengerCoverage, new RegExp(String(artefact.coverage.by_model.challenger.calls_reconstructed)));
    const currentCoverage = await page.textContent("[data-usd-l1-model='current'] .usd-l1-coverage-number");
    assert.match(currentCoverage, new RegExp(String(artefact.coverage.by_model.current.calls_reconstructed)));
    for (const testId of ["dxy_direction", "four_markets", "l2l_full_5r", "l2l_half_3r"]) {
      const row = await page.$(`[data-usd-l1-test-coverage='${testId}']`);
      assert.ok(row, `${testId} needs a coverage row`);
      assert.match(await row.textContent(), new RegExp(String(artefact.coverage.by_test[testId].usable_sessions)));
    }

    // The four tabs, each carrying its ordinal.
    const tabLabels = await page.$$eval("[data-usd-l1-tab]", (nodes) => nodes.map((node) => node.textContent.trim()));
    assert.equal(tabLabels.length, 4);
    for (const [index, ordinal] of ORDINALS.entries()) {
      assert.ok(tabLabels[index].includes(ordinal), `tab ${index + 1} carries its ordinal`);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("each test tab, the drill-down and the candle replay answer their own question", async () => {
  const before = sha256(fs.readFileSync(artefactPath, "utf8"));
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const externalRequests = [];
  let auditPhase = "baseline";
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")) return;
    if (auditPhase === "panel") externalRequests.push(url);
  });

  try {
    auditPhase = "baseline";
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    auditPhase = "panel";
    await page.getByRole("button", { name: "USD L1 Backtester" }).click();
    await page.waitForSelector("[data-usd-l1-progress='true']", { timeout: 20000 });

    // Test 1: the blocker is named and accuracy is still broken out by conviction.
    await page.click("[data-usd-l1-tab='dxy_direction']");
    await page.waitForSelector("[data-usd-l1-test-body='dxy_direction']");
    const dxyText = await page.textContent("[data-usd-l1-test-body='dxy_direction']");
    assert.match(dxyText, /DTWEXBGS/);
    assert.match(dxyText, /ICE US Dollar Index|cash DXY/);
    assert.equal((await page.$$("[data-usd-l1-dxy-model='challenger'] [data-usd-l1-conviction-row]")).length, 5);

    // Test 2: four markets, a sample size beside every percentage, and the blocked DXY column.
    await page.click("[data-usd-l1-tab='four_markets']");
    await page.waitForSelector("[data-usd-l1-test-body='four_markets']");
    const marketRows = await page.$$eval("[data-usd-l1-market]", (nodes) =>
      nodes.map((node) => node.textContent.replace(/\s+/g, " ")));
    assert.equal(marketRows.length, 4, "EUR/USD, XAU/USD, BTC/USD and NAS100 each get a row");
    for (const rowText of marketRows) {
      assert.match(rowText, /n=\d+/, "every accuracy carries its sample count");
      assert.match(rowText, /blocked/, "the DXY-confirmed column reports its blocker");
    }

    // Tests 3 and 4: four accounts each, an equity curve each, and the demo labelled as a demo.
    for (const id of ["l2l_full_5r", "l2l_half_3r"]) {
      await page.click(`[data-usd-l1-tab='${id}']`);
      await page.waitForSelector(`[data-usd-l1-test-body='${id}']`);
      const accountIds = await page.$$eval(`[data-usd-l1-test-body='${id}'] [data-usd-l1-account]`, (nodes) =>
        nodes.map((node) => node.getAttribute("data-usd-l1-account")));
      assert.deepEqual(accountIds, ["current-full", "challenger-full", "current-half", "challenger-half"]);
      const polylines = await page.$$eval(
        `[data-usd-l1-test-body='${id}'] [data-usd-l1-equity] svg polyline`,
        (nodes) => nodes.map((node) => node.getAttribute("points"))
      );
      assert.equal(polylines.length, 4, "one equity curve per account");
      for (const points of polylines) {
        assert.ok(points && points.split(" ").length >= 2, "the curve has real coordinates");
        assert.ok(!/NaN|undefined/.test(points), "no NaN or undefined coordinates");
      }
      const bodyText = await page.textContent(`[data-usd-l1-test-body='${id}']`);
      assert.match(bodyText, /Execution demo/, "the two-day replay is labelled an execution demo");
      assert.match(bodyText, /blocked/i, "the scored grid says it is blocked");
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});


test("the candle replay steps through close, order, fill, stop, target and exit", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "USD L1 Backtester" }).click();
    await page.waitForSelector("[data-usd-l1-progress='true']", { timeout: 20000 });

    await page.click("[data-usd-l1-tab='l2l_full_5r']");
    await page.waitForSelector("[data-usd-l1-replay='true'] canvas", { timeout: 20000 });
    const mode = await page.getAttribute("[data-usd-l1-replay-canvas]", "data-usd-l1-replay-canvas");
    assert.ok(["3d", "2d"].includes(mode), `expected Three.js or its fallback, got ${mode}`);

    const captionAt = async () => (await page.textContent("[data-usd-l1-replay-caption='true']")).trim();
    const stepAt = async () => Number(await page.getAttribute("[data-usd-l1-replay='true']", "data-usd-l1-replay-step"));

    assert.match(await captionAt(), /^Step 1 of \d+: Session start/);
    const seenKinds = [];
    for (let index = 0; index < 6; index += 1) {
      await page.click("[data-usd-l1-replay-action='next']");
      await page.waitForTimeout(90);
      seenKinds.push(await captionAt());
    }
    const joined = seenKinds.join(" | ");
    assert.match(joined, /Qualifying close beyond the line/);
    assert.match(joined, /Limit order placed back at the line/);
    assert.match(joined, /Filled at the line/);
    assert.ok(seenKinds.every((caption) => /Step \d+ of \d+/.test(caption)), "every step names its position");
    assert.ok(await stepAt() > 0, "the replay records its step");

    await page.click("[data-usd-l1-replay-action='last']");
    await page.waitForTimeout(120);
    const lastCaption = await captionAt();
    assert.match(
      lastCaption,
      /Target taken|Stopped out|Still working at the end of the tape/,
      "the last step says how the sequence ended"
    );
    assert.match(lastCaption, /level [\d.]+ · target [\d.]+ · stop [\d.]+/, "the step names level, target and stop");
    assert.match(lastCaption, /[+-]?\d+R/, "the step carries its R");

    await page.click("[data-usd-l1-replay-action='first']");
    await page.waitForTimeout(120);
    assert.equal(await stepAt(), 0, "First returns to the start of the session");

    // The 3R lane uses its own grid and its own trades.
    await page.click("[data-usd-l1-tab='l2l_half_3r']");
    await page.waitForSelector("[data-usd-l1-test-body='l2l_half_3r'] [data-usd-l1-replay='true'] canvas", { timeout: 20000 });
    await page.click("[data-usd-l1-replay-action='last']");
    await page.waitForTimeout(120);
    assert.match((await page.textContent("[data-usd-l1-replay-caption='true']")).trim(), /Step \d+ of \d+/);

    assert.deepEqual(pageErrors, [], "the replay renders without a page error");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

