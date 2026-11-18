"use strict";

// The reader-facing identity and integrity gates: the Tests tab must name the legacy book and show
// H1 as an unscored third identity; the Overview must show the 75/21 legacy contradictions beside
// the gated zeroes. It reads the committed payload only.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const payload = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "usd-layer1-backtester", "backtesting-screen-v1.json"), "utf8"));

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function serveRepo() {
  return http.createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
    const relativePath = urlPath === "/" ? "backtesting.html" : urlPath.replace(/^\/+/, "");
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

test("the Tests tab separates the legacy book, the production control and the unscored H1 candidate", async () => {
  const server = serveRepo();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  try {
    await page.goto(`${base}/backtesting.html#tests`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("text=One row per scheduled morning", { timeout: 30000 });
    const headers = await page.locator("#view table").first().locator("thead th").allTextContents();
    assert.deepEqual(headers, [
      "Morning",
      "Legacy book v1.0.0 (not H1)",
      "Production control",
      "H1 v0.1.0 (unscored)",
      "Direction / band",
      "Decision record",
      "",
    ]);
    assert.match(await page.locator("#view").textContent(), /Test 1 is the agreed direction test on the named broker DXY\.cash series/);
    assert.match(await page.locator("#view").textContent(), /official ICE cash DXY series is a separate supplementary evaluation lane/);

    await page.goto(`${base}/backtesting.html#overview`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("text=Artefact integrity: blocked mornings cannot score", { timeout: 30000 });
    const overview = await page.locator("#view").textContent();
    assert.match(overview, /Gated decision records/);
    assert.match(overview, /Legacy engine-v1 \(audit evidence\)/);
    assert.match(overview, /CONFIG_BLOCKED applies to usd_candidate_25f_v1 only/);
    assert.match(overview, /75/);
    assert.match(overview, /21/);
    assert.equal(payload.integrity.gated.blocked_with_direction, 0);
    assert.equal(payload.integrity.gated.blocked_with_trade, 0);
    assert.equal(payload.integrity.legacy.blocked_with_direction, 75);
    assert.equal(payload.integrity.legacy.blocked_with_trade, 21);

    await page.goto(`${base}/backtesting.html#architecture`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#map", { timeout: 30000 });
    await page.waitForTimeout(500);
    assert.equal(await page.locator("#map").isVisible(), true);
    assert.match(await page.locator("#view").textContent(), /How the architecture fits together/);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
