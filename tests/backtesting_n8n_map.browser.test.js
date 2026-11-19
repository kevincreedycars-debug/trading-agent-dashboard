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
    assert.equal(await model.locator("option").count(), 2);
    assert.equal(await recordedCase.locator("option").count(), 4);
    assert.match(await model.locator("option").nth(0).textContent(), /usd-layer1-challenger-v0/);
    assert.match(await model.locator("option").nth(1).textContent(), /usd-layer1-challenger-v1/);

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
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
