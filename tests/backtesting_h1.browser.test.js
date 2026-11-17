"use strict";

// H1 acceptance path as a reader meets it: the H1 tab must show the measured nine-input coverage audit, a
// selectable blocked morning, the supplied fixture replay and the verified package identity. It must not show
// the legacy run-v1 counts under H1. The test reads committed artefacts only.

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
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
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

async function listenSafe(server) {
  const blocked = new Set([4045, 5060, 5061, 6000, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    if (!blocked.has(server.address().port)) return;
    await new Promise((resolve) => server.close(resolve));
  }
  throw new Error("no usable local port for the H1 acceptance test");
}

test("the H1 tab renders measured coverage and a clickable blocked morning without legacy counts", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  try {
    await page.goto(`${base}/backtesting.html#h1`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("text=Input contract and measured coverage", { timeout: 30000 });

    assert.equal((await page.locator("#view h2").first().textContent()).trim(), "H1 candidate · nine-input coverage audit");
    assert.match(await page.locator("#view .banner strong").first().textContent(), /H1 historical coverage measured: 0 of 725 ready/);
    assert.equal(await page.locator("#view table").first().locator("tbody tr").count(), 9);

    const select = page.locator("#view select").first();
    assert.equal(await select.locator("option").count(), payload.h1.coverage.scheduled);
    await select.selectOption("2024-01-02");
    await page.waitForSelector("text=2024-01-02 · H1 blocked", { timeout: 10000 });

    const inspector = page.locator("#view .card").filter({ hasText: "2024-01-02 · H1 blocked" });
    assert.equal(await inspector.locator("tbody tr").count(), 9, "every H1 input must show its blocker");
    assert.equal((await inspector.locator("tbody tr").first().textContent()).includes("missing_value"), true);

    assert.equal(await page.getByText("5/5 supplied fixtures reproduced through the shared engine").count() >= 1, true);
    assert.equal(await page.getByText("USD-L1-25F-H1-v0.1.0").count() >= 1, true);
    assert.equal(await page.locator("#view").textContent().then((text) => /515 reconstructed|209 scored/.test(text)), false);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
