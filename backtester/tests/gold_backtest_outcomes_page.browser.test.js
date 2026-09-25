const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

test('the Gold 28-factor outcomes page renders offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const outcomes = require('../../data/gold-28-factor-outcomes-20260925.json');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(path.resolve(__dirname, '../../gold-backtest-outcomes.html')).href);
      assert.equal(await page.locator('#c-evaluated').textContent(), '4,956');
      assert.equal(await page.locator('#c-reported').textContent(), '2,745');
      assert.equal(await page.locator('#c-ineligible').textContent(), '704');
      assert.equal(await page.locator('#c-empty').textContent(), '1,507');
      assert.equal(await page.locator('#c-attempts').textContent(), '4,782,540');
      assert.equal(await page.locator('#c-anchors').textContent(), '441,781');
      assert.equal(await page.locator('#c-observations').textContent(), '441,319');
      assert.equal(await page.locator('#c-median').textContent(), '74');
      assert.equal(await page.locator('#c-attempts').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true,
        'the largest metric value must fit its card without clipping or sideways overflow');
      assert.match(await page.locator('#headline').textContent(), /cannot choose from it|cannot be used to choose/i);
      assert.match(await page.locator('#flags').textContent(), /prediction claimed false, accuracy claimed false/);
      assert.equal(await page.locator('#declaration tr').count(), 10);
      assert.match(await page.locator('#declaration-hashes').textContent(), new RegExp(outcomes.declaration.commit));
      assert.equal(await page.locator('#denominators tr').count(), 4);
      assert.match(await page.locator('#denominators tr').last().textContent(), /441,319/);
      assert.equal(await page.locator('#directions tr').count(), 3);
      assert.equal(await page.locator('#exclusions tr').count(), outcomes.exclusions.length);
      assert.equal(await page.locator('#quantiles tr').count(), 5);
      assert.equal(await page.locator('#buckets tr').count(), Object.keys(outcomes.candidate_n.reported_by_bucket).length);
      assert.equal(await page.locator('#limits li').count(), outcomes.limits.length);
      assert.match(await page.locator('#dependence').textContent(), /dependent/i);
      assert.equal(await page.locator('#quotes blockquote').count(), outcomes.verdict.quotes.length);
      assert.match(await page.locator('#verdict-ref').textContent(), /GOLD_BACKTEST_VERDICT_20260925\.md/);
      assert.equal(await page.locator('#sources tr').count(), outcomes.sources.length);
      assert.match(await page.locator('#footer-line').textContent(), /gold-combination-run-024-20260926-rev3/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('h1').isVisible(), true);
      const screenshot = path.resolve(__dirname, `../../tmp/gold-outcomes-${width}.png`);
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
