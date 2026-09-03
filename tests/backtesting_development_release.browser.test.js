const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

function serve() {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(root, requested);
    fs.readFile(file.startsWith(root) ? file : path.join(root, "index.html"), (error, content) => {
      response.writeHead(error ? 404 : 200);
      response.end(error ? "Not found" : content);
    });
  });
  return new Promise(resolve => server.listen(4173, () => resolve(server)));
}

test("Backtesting Development presents the XAU/USD research control board", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Backtesting Development" }).click();
    const panel = page.locator("#researchProofMapPanel");
    await panel.waitFor();
    await assert.doesNotReject(async () => {
      const text = await panel.innerText();
      assert.match(text, /XAU\/USD remains unqualified/);
      assert.match(text, /0\.5 L2L REACH/);
      assert.match(text, /Provide an MT5 data export or read-only feed/);
    });
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(desktopOverflow, false);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(mobileOverflow, false);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
