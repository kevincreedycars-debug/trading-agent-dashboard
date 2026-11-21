"use strict";

// The live Backtesting page's Layer 1 map: shared header/rail, model and case filters, clickable nodes,
// execution links, blocked receipted state and the H1 exclusion. It reads committed artefacts only.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const ledger = JSON.parse(fs.readFileSync(path.join(rootDir, "data/usd-layer1-backtester/n8n/run-ledger-v1.json"), "utf8").replace(/^\uFEFF/, ""));
const ledgerRecords = ledger.records.length;
const duplicatesPrevented = (ledger.runs || []).reduce((total, run) => total + (run.duplicate_keys || []).length, 0);

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
  throw new Error("no usable local port for the Layer 1 map test");
}

test("the Layer 1 map is visible, filterable and linked to the recorded n8n executions", async () => {
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
    await page.goto(`${base}/backtesting.html#n8nmap`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("text=USD Layer 1 n8n map", { timeout: 30000 });
    await page.waitForSelector(".map-board", { timeout: 30000 });

    assert.equal(await page.locator("header .topbar-brand").textContent(), "Asset Directional Movement Dashboard");
    assert.equal(await page.locator("aside.side-rail").count(), 1);
    assert.equal(await page.locator(".map-stat").filter({ hasText: "725 / 725" }).count(), 1);
    assert.equal(await page.locator(".map-stat").filter({ hasText: "0 / 725" }).count(), 1);
    assert.equal(await page.locator(".map-stat").filter({ hasText: "2175 / 2175" }).count(), 1);

    const model = page.locator(".n8n-head select").nth(0);
    const recordedCase = page.locator(".n8n-head select").nth(1);
    assert.ok(await model.locator("option").count() >= 2);
    assert.equal(await recordedCase.locator("option").count(), 4);
    const modelTexts = await model.locator("option").allTextContents();
    assert.equal(modelTexts.some((text) => /usd-layer1-challenger-v0/.test(text)), true);
    assert.equal(modelTexts.some((text) => /usd-layer1-challenger-v1/.test(text)), true);

    const child = page.locator(".map-node").filter({ hasText: "Challenger v0" }).first();
    assert.match(await child.textContent(), /usd-layer1-challenger-v0/);
    assert.match(await child.textContent(), /allowed/);
    await child.locator("button").click();
    const links = await page.locator(".map-detail").first().locator("a").evaluateAll((nodes) => nodes.map((node) => node.href));
    assert.equal(links.some((href) => /\/execution\/5472$/.test(href)), true);

    await model.selectOption("challenger_v1");
    await page.waitForFunction(() => [...document.querySelectorAll(".map-node")].some((node) => node.textContent.includes("usd-layer1-challenger-v1")), { timeout: 10000 });
    const v1Child = page.locator(".map-node").filter({ hasText: "usd-layer1-challenger-v1" }).first();
    assert.match(await v1Child.textContent(), /Challenger v1/);
    await v1Child.locator("button").click();
    const v1Links = await page.locator(".map-detail").first().locator("a").evaluateAll((nodes) => nodes.map((node) => node.href));
    assert.equal(v1Links.some((href) => /\/execution\/5473$/.test(href)), true);

    await recordedCase.selectOption("2024-01-10-receipted");
    await page.waitForFunction(() => document.querySelector("#view") && document.querySelector("#view").textContent.includes("receipted_incomplete"), { timeout: 10000 });
    assert.match(await page.locator(".map-node").filter({ hasText: "Independent validation" }).first().textContent(), /blocked/);
    assert.match(await page.locator(".map-node").filter({ hasText: "Decision" }).first().textContent(), /blocked/);
    assert.match(await page.locator("#view").textContent(), /receipted_incomplete/);
    assert.match(await page.locator("#view").textContent(), /not scored/);

    await page.locator(".map-node").filter({ hasText: "H1 candidate" }).first().locator("button").click();
    assert.match(await page.locator(".map-detail").first().textContent(), /USD-L1-25F-H1-v0.1.0/);
    assert.match(await page.locator(".map-detail").first().textContent(), /Never substitute/);
    await page.waitForSelector("text=Batch runs, restart recovery and independent checks", { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector("#view").textContent.includes("persisted records"), { timeout: 30000 });
    assert.equal(await page.locator(".map-stat").filter({ hasText: `${ledgerRecords} / ${ledgerRecords}` }).count(), 1);
    assert.equal(await page.locator(".map-stat").filter({ hasText: String(duplicatesPrevented) }).filter({ hasText: "duplicate results prevented" }).count(), 1);
    assert.match(await page.locator("#view").textContent(), /Run history/);
    assert.match(await page.locator("#view").textContent(), /Historical input availability/);
    assert.match(await page.locator("#view").textContent(), /not established/);
    assert.match(await page.locator("#view").textContent(), /Execution map - every recorded morning/);
    const ledgerLinks = await page.locator(".map-links a").evaluateAll((nodes) => nodes.map((node) => node.href));
    assert.equal(ledgerLinks.some((href) => /\/execution\/5512$/.test(href)), true);
    assert.equal(ledgerLinks.some((href) => /\/execution\/5525$/.test(href)), true);
    await page.evaluate(() => { location.hash = "#tests"; });
    await page.waitForSelector("text=One row per scheduled morning", { timeout: 30000 });
    assert.ok(await page.locator("input[type=checkbox]").count() >= 4, "every test module has a checkbox");
    const moduleChips = page.locator(".chips button").filter({ hasText: "Original Layer 2 levels" }).first();
    assert.ok(await moduleChips.count() >= 1);
    await moduleChips.click();
    await page.waitForFunction(() => document.querySelector("#view").textContent.includes("Simulation:"), { timeout: 10000 });
    const testText = await page.locator("#view").textContent();
    assert.match(testText, /implemented and tested/);
    assert.match(testText, /historical inputs: absent/);
    assert.match(testText, /7 unit cases/);
    await page.evaluate(() => { location.hash = "#n8nmap"; });
    await page.waitForSelector(".map-board", { timeout: 30000 });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
