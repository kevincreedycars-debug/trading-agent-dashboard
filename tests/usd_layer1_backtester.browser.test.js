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

    // Progress: run version, date range, dates processed, current stage and each stage.
    const progressText = await page.textContent("[data-usd-l1-progress='true']");
    assert.match(progressText, new RegExp(artefact.run.run_version));
    assert.match(progressText, new RegExp(artefact.run.challenger_version));
    assert.match(
      progressText,
      new RegExp(`${artefact.results.dates_processed} dates`),
      "the panel states dates processed rather than a bare fraction"
    );
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

    // Test 2: four markets, correct / scored beside every percentage, and the pending DXY column.
    await page.click("[data-usd-l1-tab='four_markets']");
    await page.waitForSelector("[data-usd-l1-test-body='four_markets']");
    const marketRows = await page.$$eval("[data-usd-l1-market]", (nodes) =>
      nodes.map((node) => node.textContent.replace(/\s+/g, " ")));
    assert.equal(marketRows.length, 4, "EUR/USD, XAU/USD, BTC/USD and NAS100 each get a row");
    for (const rowText of marketRows) {
      assert.match(rowText, /\d+ \/ \d+ · [\d.]+%/, "every accuracy carries its numerator and denominator");
      assert.match(rowText, /pending test/, "the DXY-confirmed column reports its pending state");
    }
    const differenceText = await page.textContent("[data-usd-l1-call-difference='true']");
    assert.match(differenceText, /\d+ dates/, "the 697-against-490 explanation names its counts");

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


test("the results sit at the top, every factor is accounted for and a call re-runs from its saved inputs", async () => {
  const before = sha256(fs.readFileSync(artefactPath, "utf8"));
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "USD L1 Backtester" }).click();
    await page.waitForSelector("[data-usd-l1-results='true']", { timeout: 20000 });

    // 1. The results block leads the panel and states dates processed on its own.
    const order = await page.evaluate(() => {
      const results = document.querySelector("[data-usd-l1-results='true']");
      const method = document.querySelector("[data-usd-l1-call-method='true']");
      const progress = document.querySelector("[data-usd-l1-progress='true']");
      return {
        resultsTop: results.getBoundingClientRect().top,
        progressTop: progress.getBoundingClientRect().top,
        methodTop: method.getBoundingClientRect().top
      };
    });
    assert.ok(order.resultsTop < order.progressTop, "the results block comes before the progress strip");
    assert.ok(order.progressTop < order.methodTop, "the call method follows the progress strip");
    const datesProcessed = await page.getAttribute("[data-usd-l1-dates-processed]", "data-usd-l1-dates-processed");
    assert.equal(Number(datesProcessed), artefact.results.dates_processed);
    assert.match(
      (await page.textContent("[data-usd-l1-dates-processed]")).trim(),
      /^\d+ dates processed$/,
      "the headline states dates processed and nothing else"
    );
    const resultRows = await page.$$eval("[data-usd-l1-results-test]", (nodes) =>
      nodes.map((node) => node.getAttribute("data-usd-l1-results-test")));
    assert.deepEqual(resultRows, ["dxy_direction", "four_markets", "l2l_full_5r", "l2l_half_3r"]);
    const dxyStatus = await page.textContent("[data-usd-l1-results-test='dxy_direction'] .usd-l1-status");
    assert.equal(dxyStatus.trim(), "0 scored · awaiting DXY prices");

    // 2. Every one of the 25 factors is accounted for, with its treatment and the rule that implements it.
    const factorRows = await page.$$eval("[data-usd-l1-factor]", (nodes) =>
      nodes.map((node) => node.textContent.replace(/\s+/g, " ")));
    assert.equal(factorRows.length, 25, "all twenty-five registered factors are listed");
    const treatmentPattern = /Used to decide whether to abstain|Combined with another factor|Excluded|Used/;
    const treatments = new Set();
    for (const rowText of factorRows) {
      const match = rowText.match(treatmentPattern);
      assert.ok(match, "every factor carries one of the four treatments");
      treatments.add(match[0]);
    }
    assert.equal(treatments.size, 4, "all four treatments appear in the table");
    const methodText = await page.textContent("[data-usd-l1-call-method='true']");
    assert.match(methodText, /preliminary/i, "the model is labelled preliminary");
    assert.match(methodText, /What would complete the challenger/i);
    assert.match(methodText, /Fitted on data/i, "the fitted parameters are labelled as fitted");
    assert.equal((await page.$$("[data-usd-l1-band]")).length, 5, "five conviction bands are shown");

    // 3. The worked call shows its inputs, its mechanism contributions and its arithmetic.
    const worked = await page.textContent("[data-usd-l1-worked='true']");
    assert.match(worked, /What was available by 05:00 London/);
    assert.match(worked, /Each mechanism's contribution/);
    assert.match(worked, /Why the current model read it differently/);
    assert.match(worked, /no-call example/i);
    assert.equal(
      (await page.$$("[data-usd-l1-worked-mechanism]")).length,
      artefact.run.challenger_mechanisms.length,
      "every mechanism is traced for the worked day"
    );
    assert.ok((await page.$$("[data-usd-l1-worked-input]")).length >= 5, "the input table lists traced inputs");

    // 4. Re-running from the saved inputs reproduces the stored call, in the browser.
    await page.click("[data-usd-l1-rerun]");
    await page.waitForSelector("[data-usd-l1-rerun-result]", { timeout: 20000 });
    const reRun = (await page.textContent("[data-usd-l1-rerun-result]")).trim();
    assert.match(reRun, /identical to the stored call/, `the re-run must reproduce: ${reRun}`);
    assert.ok(!/did not reproduce/.test(reRun));

    // 5. Any percentage opens the dates behind it, with its numerator and denominator.
    await page.click("[data-usd-l1-results-market='EURUSD'] [data-usd-l1-evidence='result|EURUSD|challenger|scored']");
    await page.waitForSelector("[data-usd-l1-evidence-panel]", { timeout: 20000 });
    const arithmetic = (await page.textContent(".usd-l1-evidence-arithmetic")).replace(/\s+/g, " ");
    const eurusd = artefact.results.tests.find((entry) => entry.id === "four_markets").markets.EURUSD.challenger;
    assert.match(
      arithmetic,
      new RegExp(`${eurusd.hits} correct / ${eurusd.scored} scored`),
      `the drawer prints the artefact's own numerator and denominator: ${arithmetic}`
    );
    const listed = await page.getAttribute(".usd-l1-evidence-list", "data-usd-l1-evidence-count");
    assert.equal(Number(listed), eurusd.scored, "the drawer lists one row per scored session");

    // 6. A trade figure opens its ledger, with its own arithmetic.
    await page.click("[data-usd-l1-tab='l2l_full_5r']");
    await page.waitForSelector("[data-usd-l1-test-body='l2l_full_5r'] [data-usd-l1-evidence^='trades']", {
      timeout: 20000
    });
    await page.click("[data-usd-l1-test-body='l2l_full_5r'] [data-usd-l1-evidence^='trades']");
    await page.waitForSelector("[data-usd-l1-evidence-panel^='trades']", { timeout: 20000 });
    const tradeArithmetic = await page.textContent(
      "[data-usd-l1-evidence-panel^='trades'] .usd-l1-evidence-arithmetic"
    );
    assert.match(tradeArithmetic, /winning \/ \d+ closed/, "the ledger states its win rate arithmetic");
    assert.match(tradeArithmetic, /ending balance £/, "the ledger states its ending balance");
    assert.match(tradeArithmetic, /max drawdown £/, "the ledger states its drawdown");

    assert.deepEqual(pageErrors, [], "the panel renders without a page error");
    assert.equal(sha256(fs.readFileSync(artefactPath, "utf8")), before, "the panel only reads the artefact");
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

