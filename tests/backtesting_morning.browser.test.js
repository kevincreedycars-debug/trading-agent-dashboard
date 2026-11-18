"use strict";

// Visual acceptance for the dated morning run. The page must show the control's narrow replay, H1 blocked,
// every input table and the legacy 0/725/reach labels without turning either into an H1 result.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
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

async function listenSafe(server) {
  const blocked = new Set([4045, 5060, 5061, 6000, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    if (!blocked.has(server.address().port)) return;
    await new Promise((resolve) => server.close(resolve));
  }
  throw new Error("no usable local port for the morning-run acceptance test");
}

test("the morning-run tab shows both models, every input and both preserved figures", async () => {
  const server = serveRepo();
  await listenSafe(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  try {
    await page.goto(`${base}/backtesting.html#morning`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("text=Current-model required inputs", { timeout: 30000 });
    const view = page.locator("#view");
    const text = await view.textContent();

    assert.match(await view.locator("h2").first().textContent(), /One historical morning/);
    assert.match(text, /No strict 05:00 morning/);
    assert.match(text, /2024-03-26/);
    assert.match(text, /BEARISH/);
    assert.match(text, /H1 candidate/);
    assert.match(text, /NO_CALL/);
    assert.match(text, /Current-model required inputs/);
    assert.match(text, /H1 required inputs/);
    assert.match(text, /0 of 725 — legacy input-clock audit, not H1/);
    assert.match(text, /196 direction flags/);
    assert.match(text, /62 trade flags/);
    assert.match(text, /21 trade flags sit on blocked mornings/);
    assert.match(text, /97% — half-distance reach, not accuracy/);
    assert.match(text, /2418 of 2493/);
    assert.match(text, /1549 of 1592/);
    assert.equal((await view.locator("table").count()) >= 5, true);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
