const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

test('Gold evidence page works offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const artifact = require('../../data/gold-evidence-audit.json');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(path.resolve(__dirname, '../../gold-backtesting.html')).href);
      assert.equal(await page.locator('#total').textContent(), String(artifact.coverage.source_rows));
      assert.equal(await page.locator('#factors tr').count(), 10);
      assert.equal(await page.locator('#stored-pilot').isVisible(), true);
      assert.equal(await page.locator('#pilot-calls').textContent(), '154');
      assert.equal(await page.locator('#pilot-strict').textContent(), '0');
      assert.equal(await page.locator('#pilot-cohorts tr').count(), 5);
      assert.equal(await page.locator('#pilot-factors tr').count(), 10);
      assert.match(await page.locator('#pilot-defect').textContent(), /143 of 147/);
      await page.getByText('Stored factor pairs and correlation', { exact: true }).click();
      assert.equal(await page.locator('#pilot-pairs tr').count(), 45);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByText('Stored factor pairs and correlation', { exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#filter').fill('F10');
      assert.equal(await page.locator('#factors tr').count(), 1);
      await page.locator('#year').selectOption('2024');
      assert.match(await page.locator('#factors tr').textContent(), /F10/);
      await page.locator('#filter').fill('not-a-factor');
      assert.equal(await page.locator('#factor-empty').isVisible(), true);
      await page.locator('#filter').fill('');
      await page.locator('#year').selectOption('all');
      await page.getByText('Factor pairs: agreement and outcome coverage', { exact: true }).click();
      assert.equal(await page.locator('#pairs tr').count(), 45);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByText('Factor pairs: agreement and outcome coverage', { exact: true }).click();
      const screenshot = path.resolve(__dirname, `../../tmp/gold-research-${width}.png`);
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.resolve(__dirname, `../../tmp/gold-research-top-${width}.png`) });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
