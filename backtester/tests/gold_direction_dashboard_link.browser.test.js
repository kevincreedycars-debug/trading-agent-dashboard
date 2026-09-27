const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Proves the dashboard hop actually lands on the direction scorecard: asserting an href alone would
// not catch a wrong relative path or a link hidden behind an overlay.
test('the dashboard reaches the Gold direction scorecard page', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
    const link = page.locator('a.topbar-link[href="gold-direction-scorecard.html"]');
    assert.equal(await link.count(), 1, 'the dashboard topbar must link to the direction scorecard');
    assert.equal(await link.isVisible(), true);
    await link.click();
    await page.waitForURL(/gold-direction-scorecard\.html$/);
    assert.equal(await page.locator('#c-scored').textContent(), '25');
    assert.equal(await page.locator('#rows tr').count(), 25);
    assert.equal(await page.locator('a[href="index.html"]').first().isVisible(), true, 'the page must link back to the dashboard');
  } finally { await browser.close(); }
});
