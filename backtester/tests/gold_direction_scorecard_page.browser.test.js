const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The page is a research surface, so it is checked as one: the drift floor must be visible next to
// every hit rate, the unscored and unreadable states must be on the page rather than hidden, and
// nothing may overflow its card at either layout.
// Measuring the document and the metric cards is not enough: a side-by-side card can starve a table
// column until a header or a cell token breaks mid-word ("Weig ht", "decla red") or until the cell's
// own text escapes its box, and the card quietly gains a horizontal scrollbar. So this probe measures
// the longest unbreakable run in every header and body cell against that cell's own content box. A
// <wbr> ends a run deliberately, because the page inserts one after identifier separators and every
// eight characters of a digest, which is a readable break rather than an accidental one.
const starvedCells = () => {
  const measure = document.createElement('span');
  measure.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;white-space:nowrap;';
  document.body.appendChild(measure);
  const softText = node => {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.nodeValue;
      else if (child.tagName === 'WBR') text += '\u200b';
      else text += softText(child);
    }
    return text;
  };
  const widestRun = node => {
    const style = getComputedStyle(node);
    measure.style.font = style.font;
    measure.style.fontWeight = style.fontWeight;
    measure.style.fontFamily = style.fontFamily;
    measure.style.fontSize = style.fontSize;
    measure.style.letterSpacing = style.letterSpacing;
    let widest = { width: 0, run: '' };
    for (const token of softText(node).split(/[\s\u200b\u00ad]+/).filter(Boolean)) {
      measure.textContent = token;
      const size = measure.getBoundingClientRect().width;
      if (size > widest.width) widest = { width: size, run: token };
    }
    return widest;
  };
  const report = [];
  for (const table of document.querySelectorAll('table')) {
    const label = table.closest('.table-wrap')?.getAttribute('aria-label') || table.id || 'table';
    for (const wrapper of [table.closest('.table-wrap')]) {
      if (wrapper && wrapper.scrollWidth - wrapper.clientWidth > 1) {
        report.push(`${label}: the card scrolls ${wrapper.scrollWidth - wrapper.clientWidth}px`);
      }
    }
    const first = table.querySelector('tbody td');
    const stacked = first ? getComputedStyle(first).display === 'block' : false;
    const cells = [...table.querySelectorAll('thead th')].map(cell => ['header', cell])
      .concat(stacked ? [] : [...table.querySelectorAll('tbody td')].map(cell => ['cell', cell]));
    for (const [kind, cell] of cells) {
      const style = getComputedStyle(cell);
      const inner = cell.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const { width, run } = widestRun(cell);
      if (width > inner + 1) {
        report.push(`${label}: ${kind} "${run}" needs ${Math.round(width)}px in ${Math.round(inner)}px`);
      }
    }
  }
  return [...new Set(report)];
};

test('no table column is starved or broken mid-word at any width', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [1440, 860, 768, 721, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(path.resolve(__dirname, '../../gold-direction-scorecard.html')).href);
      await page.locator('#rows tr').first().waitFor();
      assert.deepEqual(await page.evaluate(starvedCells), [], `at ${width}px no table text may outgrow its own column`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `at ${width}px the page must not scroll sideways`);
    }
  } finally { await browser.close(); }
});

test('the Gold direction scorecard renders offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const data = require('../../data/gold-direction-scorecard-20260927.json');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(path.resolve(__dirname, '../../gold-direction-scorecard.html')).href);
      assert.equal(await page.locator('#c-scored').textContent(), '25');
      assert.equal(await page.locator('#c-unscored').textContent(), '20');
      assert.equal(await page.locator('#c-neutral').textContent(), '6');
      assert.equal(await page.locator('#c-factors').textContent(), '7 of 10');
      assert.equal(await page.locator('#c-session-n').textContent(), '964');
      assert.equal(await page.locator('#c-week-n').textContent(), '960');
      assert.equal(await page.locator('#c-session-floor').textContent(), '55.81% up');
      assert.equal(await page.locator('#c-week-floor').textContent(), '58.23% up');
      assert.match(await page.locator('#flags').textContent(), /prediction claimed false, accuracy claimed false/);
      assert.match(await page.locator('#verdict-line').textContent(), /25 no information/);
      assert.equal(await page.locator('#coverage tr').count(), 15);
      assert.match(await page.locator('#coverage').textContent(), /2023-01-02T23:00:00\.000Z/);
      assert.equal(await page.locator('#by-year tr').count(), 4);
      assert.equal(await page.locator('#variables tr').count(), data.coverage.variable_coverage.length);
      assert.equal(await page.locator('#baselines tr').count(), 6);
      assert.equal(await page.locator('#factors tr').count(), 10);
      assert.equal(await page.locator('#rows tr').count(), 25);
      assert.equal(await page.locator('#unscored tr').count(), data.unscored.length);
      assert.equal(await page.locator('#neutral tr').count(), data.neutral_states.length);
      assert.equal(await page.locator('#blocked tr').count(), data.blocked.length);
      assert.equal(await page.locator('#limits li').count(), data.limits.length);
      assert.equal(await page.locator('#change-it li').count(), data.what_would_change_it.length);
      assert.equal(await page.locator('#sources tr').count(), data.sources.length);
      assert.equal(await page.locator('#rows tr .strip span').count() > 0, true, 'every scored state shows its year strip');
      assert.equal(await page.locator('#rows tr .num').count() >= 25, true, 'every scored state shows its drift edge as a number');
      assert.match(await page.locator('#footer-line').textContent(), /gold-direction-scorecard-v1/);
      assert.match(await page.locator('#parameters-line').textContent(), /no information unless/);
      assert.equal(await page.locator('.notice').first().isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const widest = await page.locator('.metric strong').evaluateAll(nodes => Math.max(...nodes.map(node => node.scrollWidth - node.clientWidth)));
      assert.equal(widest <= 1, true, 'no metric value may clip its card');
      const screenshot = path.resolve(__dirname, `../../tmp/gold-direction-scorecard-${width}.png`);
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
