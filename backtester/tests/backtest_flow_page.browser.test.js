const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The map is a picture of a boundary, so the guard checks the picture and the claim together: both
// lanes carry the right number of steps in order, the crossing band states what may and may not
// cross, and no step's own text can escape or break mid-word inside its card at any width the page
// is read at. A lane that quietly reflowed into an unreadable column, or a caption that drifted away
// from the downstream-only rule, would still pass a plain href check.
const PAGE = path.resolve(__dirname, '../../backtest-flow.html');
const WIDTHS = [1440, 1180, 860, 768, 721, 390];

// Longest unbreakable run per element, measured in that element's own font, against its content box.
// A <wbr> ends a run deliberately; whitespace and soft hyphens do too.
const starvedText = () => {
  const measure = document.createElement('span');
  measure.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;white-space:nowrap';
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
  const report = [];
  for (const node of document.querySelectorAll('.node, .barrier-pair > div, .panel')) {
    const style = getComputedStyle(node);
    measure.style.font = style.font;
    measure.style.fontFamily = style.fontFamily;
    measure.style.fontSize = style.fontSize;
    measure.style.fontWeight = style.fontWeight;
    measure.style.letterSpacing = style.letterSpacing;
    const inner = node.getBoundingClientRect().width
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    for (const run of softText(node).split(/[\s\u200b\u00ad]+/).filter(Boolean)) {
      measure.textContent = run;
      const width = measure.getBoundingClientRect().width;
      if (width > inner + 1) report.push(`${node.className}: "${run}" needs ${Math.round(width)}px in ${Math.round(inner)}px`);
    }
  }
  return [...new Set(report)];
};

test('the system map renders offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(PAGE).href);
      await page.locator('#lane-live-title').waitFor();
      assert.equal(await page.locator('.lane-live .node').count(), 6, `at ${width}px the live lane keeps its six steps`);
      assert.equal(await page.locator('.lane-research .node').count(), 6, `at ${width}px the backtest lane keeps its six steps`);
      assert.equal(await page.locator('.lane-live .arrow').count(), 5);
      assert.equal(await page.locator('.lane-research .arrow').count(), 5);
      assert.equal(await page.locator('.lane-live .node .step').first().textContent(), '01 · COLLECT');
      assert.equal(await page.locator('.lane-live .node .step').last().textContent(), '06 · PUBLISH');
      assert.equal(await page.locator('.lane-research .node .step').first().textContent(), '01 · COPY');
      assert.equal(await page.locator('.lane-research .node .step').last().textContent(), '06 · PUBLISH');
      assert.match(await page.locator('#barrier-title').textContent(), /Read-only boundary/);
      assert.match(await page.locator('.barrier').textContent(), /never reads a research artifact/);
      assert.match(await page.locator('.barrier').textContent(), /Research may never write/);
      // A dropped closing tag once nested one panel grid inside another and the grid still looked
      // plausible in a screenshot, so the structure itself is asserted here.
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('section.columns')].map(section => section.children.length)), [2, 2], 'each two-up band holds exactly two panels');
      assert.equal(await page.evaluate(() => document.querySelectorAll('.panel .panel, .lane .lane').length), 0, 'no panel or lane may be nested inside another');
      assert.deepEqual(await page.evaluate(starvedText), [], `at ${width}px no step text may outgrow its own card`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `at ${width}px the map must not scroll sideways`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.lane-live .flow')).flexDirection), 'row', 'wide screens read each lane as one left-to-right run');
    // The header and the boundary band each wrap a run of sections, so a dropped closing tag silently
    // drags the lanes, the panels and the footer inside them while still looking nearly right. Assert
    // the two bands close before what follows them.
    assert.equal(await page.evaluate(() => document.querySelectorAll('header section, .barrier .lane, .barrier .columns, .barrier footer, header footer').length), 0, 'the header and the boundary band must close before the lanes and panels that follow them');
    assert.equal(await page.evaluate(() => document.querySelectorAll('main > .lane-live, main > .barrier, main > .lane-research').length), 3, 'both lanes and the boundary band sit directly in main');
    assert.match(await page.locator('section.columns').first().textContent(), /Layer 1 tiles/);
    assert.match(await page.locator('section.columns').first().textContent(), /Layer 2 grid/);
    assert.match(await page.locator('footer').textContent(), /backtest_flow_page/);
    const shot = process.env.FLOW_SHOT;
    if (shot) {
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      await page.screenshot({ path: shot, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.lane-live .flow')).flexDirection), 'column', 'narrow screens stack each lane');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, [], 'the map must render without script errors offline');
  } finally { await browser.close(); }
});

test('the dashboard reaches the system map', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
    const link = page.locator('a.topbar-link[href="backtest-flow.html"]');
    assert.equal(await link.count(), 1, 'the dashboard topbar must link to the system map');
    assert.equal(await link.isVisible(), true);
    await link.click();
    await page.waitForURL(/backtest-flow\.html$/);
    assert.equal(await page.locator('.node').count(), 12, 'the map opens with both lanes complete');
    assert.match(await page.locator('#lane-research-title').textContent(), /earns the right to be shown/);
  } finally { await browser.close(); }
});
