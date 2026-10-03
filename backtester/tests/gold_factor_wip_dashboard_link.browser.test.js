const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The gold factor page is a draft published early at the user's request, so the guard checks the hop
// and the honesty mechanism together: the topbar link says it is a draft, the page opens from a static
// host with nothing else present, the banner still counts the answered questions, and no figure can
// arrive from outside the document. A copy that quietly gained a script, a stylesheet or a claim would
// still pass a plain href check.
const PAGE = path.resolve(__dirname, '../../gold-factor-wip.html');

test('the dashboard reaches the draft gold factor page', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
    const link = page.locator('a.topbar-link[href="gold-factor-wip.html"]');
    assert.equal(await link.count(), 1, 'the dashboard topbar must carry exactly one draft gold factor link');
    assert.equal(await link.isVisible(), true);
    assert.match(await link.textContent(), /draft/i, 'the label itself must show the draft status');
    await link.click();
    await page.waitForURL(/gold-factor-wip\.html$/);
    assert.equal(await page.title(), 'Gold factor work in progress (draft)');
    assert.equal(await page.locator('.draft').count(), 1, 'the draft banner must survive the copy');
    assert.match(await page.locator('.draft').textContent(), /50 of 50 answered/);
    assert.match(await page.locator('.meta').first().textContent(), /As of 30 September 2026/);
  } finally { await browser.close(); }
});

test('the draft page renders offline with nothing outside the document', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('file:')) external.push(request.url()); });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h2').count(), 5, 'the five numbered sections must all be present');
    assert.equal(await page.locator('script, link, img, iframe').count(), 0, 'a self-contained page loads no script, stylesheet, image or frame');
    assert.match(await page.locator('h2').last().textContent(), /What this page is not/);
    assert.match(await page.locator('footer').textContent(), /published on this dashboard by its owner/);
    assert.deepEqual(external, [], 'the page must not reach anything outside itself');
    assert.deepEqual(errors, [], 'the page must render without script errors offline');
  } finally { await browser.close(); }
});
