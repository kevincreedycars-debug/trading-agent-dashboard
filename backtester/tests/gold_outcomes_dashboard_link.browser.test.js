const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Proves the dashboard hop actually lands on the outcomes page: asserting an href alone would not
// catch a wrong relative path or a link that is hidden behind an overlay.
test('the dashboard reaches the Gold 28-factor outcomes page', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
    const link = page.locator('a.topbar-link[href="gold-backtest-outcomes.html"]');
    assert.equal(await link.count(), 1, 'the dashboard topbar must link to the outcomes page');
    assert.equal(await link.isVisible(), true);
    await link.click();
    await page.waitForURL(/gold-backtest-outcomes\.html$/);
    assert.equal(await page.locator('#c-evaluated').textContent(), '4,956');
    assert.match(await page.locator('#quotes blockquote').first().textContent(), /describe this space/);
  } finally { await browser.close(); }
});
