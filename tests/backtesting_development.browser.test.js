const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    const safePath = filePath.startsWith(repoRoot) ? filePath : path.join(repoRoot, "index.html");

    fs.readFile(safePath, (error, content) => {
      response.writeHead(error ? 404 : 200);
      response.end(error ? "Not found" : content);
    });
  });

  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

test("Backtesting Development opens the XAU/USD tracker and reaches the L2L research", async () => {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const port = server.address().port;
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Backtesting Development" }).click();
    await page.waitForSelector("#backtestingDevelopmentPanel");

    const trackerText = await page.locator("#backtestingDevelopmentPanel").innerText();
    assert.match(trackerText, /XAU\/USD/);
    assert.match(trackerText, /What is next, and what is needed from you/);
    assert.match(trackerText, /Provide MT5 evidence feed or export/);
    assert.match(trackerText, /Individual elements/);

    const trackerLayout = await page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      panelOverflow: (() => {
        const panel = document.getElementById("backtestingDevelopmentPanel");
        return panel ? panel.scrollWidth > panel.clientWidth + 1 : true;
      })()
    }));
    assert.equal(trackerLayout.pageOverflow, false, "tracker should not create page-level overflow");
    assert.equal(trackerLayout.panelOverflow, false, "tracker panel should not overflow its container");

    await page.getByRole("button", { name: "Open L2L directional accuracy" }).click();
    await page.waitForSelector("[data-half-l2l-summary='true']");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Backtesting Development" }).click();
    await page.waitForSelector("#backtestingDevelopmentPanel");
    const mobileLayout = await page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      panelOverflow: (() => {
        const panel = document.getElementById("backtestingDevelopmentPanel");
        return panel ? panel.scrollWidth > panel.clientWidth + 1 : true;
      })()
    }));
    assert.equal(mobileLayout.pageOverflow, false, "mobile tracker should not create page-level overflow");
    assert.equal(mobileLayout.panelOverflow, false, "mobile tracker panel should not overflow its container");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
