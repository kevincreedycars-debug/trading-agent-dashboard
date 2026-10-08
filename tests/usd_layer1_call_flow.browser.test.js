const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The USD one-pager is a claim about how one Layer 1 call is made, so the guard checks the picture
// and the claim together: eight chain steps in order, the ten weighted factors with their
// per-horizon weights, the deterministic score that turns the votes into the worked call, and the
// honesty notes. It also holds the page to the two things print kept breaking on: the horizon
// headers and the two-digit weights must stay on one line (an auto-laid-out table squeezed those
// columns below a single glyph), and the printed weights must stay dark on white paper.
// Since 2026-10-08 the page is reached from the shared top bar and from the rail's outbound entries, so the
// fourth test makes both hops rather than reading either entry's href, and the fifth holds the block's promise
// about the page: one bar and one rail on screen, both off the printed sheet, the sheet starting at its own edge.
const PAGE = path.resolve(__dirname, '../usd-layer1-call-flow.html');
const WIDTHS = [1440, 1180, 860, 721, 390];
// The box Chrome lays the printed sheet out in: 297x210mm A4 landscape minus the 8mm page margin.
const SHEET = { width: Math.round((297 - 16) / 25.4 * 96), height: Math.round((210 - 16) / 25.4 * 96) };
// Nothing on the printed sheet may be smaller than this, so a future edit that adds copy cannot pay
// for it by shrinking the type below the point where the sheet stops being readable on paper.
const PRINT_FLOOR = 7.5;
const STEPS = ['01 · TRIGGER', '02 · READ', '03 · PACK', '04 · RULEBOOK', '05 · MODEL', '06 · PARSE', '07 · SCORE', '08 · WRITE'];
const FACTORS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'];
const HORIZONS = ['24h', '3d', 'wk', 'nxt', 'mo'];
// The ten rows of per-horizon weights exactly as the rulebook lays them out, in reading order.
const WEIGHTS = [
  10, 8, 5, 4, 3,
  14, 16, 14, 12, 12,
  10, 16, 18, 20, 18,
  10, 16, 18, 18, 20,
  14, 14, 15, 6, 8,
  4, 8, 7, 5, 5,
  24, 8, 5, 6, 5,
  12, 10, 12, 18, 18,
  1, 3, 5, 10, 10,
  1, 1, 1, 1, 1
];

// No card may let its laid-out text spill past its own box. The page's head opts long tokens into
// overflow-wrap:anywhere, so a run with no whitespace is not itself a defect: what matters is
// whether the text actually overflows. scrollWidth above clientWidth means it does, which is the
// "text outgrows its card" case this guards against.
const overflowingCards = () => [...document.querySelectorAll('.node, .panel, .chips li')]
  .filter(node => node.scrollWidth > node.clientWidth + 1)
  .map(node => `${node.className}: content is ${node.scrollWidth}px wide in a ${node.clientWidth}px box`);

test('the USD call map renders offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(PAGE).href);
      await page.locator('ol.flow').waitFor();
      assert.equal(await page.locator('.flow .node').count(), 8, `at ${width}px the chain keeps its eight steps`);
      assert.deepEqual(await page.locator('.flow .node .step').allTextContents(), STEPS, `at ${width}px the eight steps stay in order`);
      assert.equal(await page.locator('.tool tbody tr').count(), 10, 'the table lists all ten factors');
      assert.deepEqual(await page.locator('.tool tbody tr td:first-child').allTextContents(), FACTORS, `at ${width}px the ten factors stay in order`);
      assert.deepEqual(await page.locator('.tool thead th').allTextContents(), ['#', 'Factor & signal rule', ...HORIZONS], 'the table keeps its seven columns');
      assert.deepEqual((await page.locator('.tool td.num').allTextContents()).map(value => Number(value)), WEIGHTS, `at ${width}px the per-horizon weights are unchanged`);
      assert.deepEqual(await page.evaluate(overflowingCards), [], `at ${width}px no card text may outgrow its own box`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `at ${width}px the map must not scroll sideways`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.flow')).gridTemplateColumns.split(' ').length), 8, 'wide screens read the chain as one eight-across run');
    const shot = process.env.USD_FLOW_SHOT;
    if (shot) {
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      await page.screenshot({ path: shot, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.flow')).gridTemplateColumns.split(' ').length), 2, 'narrow screens read the chain two-up');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, [], 'the map must render without script errors offline');
  } finally { await browser.close(); }
});


test('the USD call map still prints as one readable A4 landscape sheet', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize(SHEET);
    await page.emulateMedia({ media: 'print' });
    await page.goto(pathToFileURL(PAGE).href);
    await page.locator('ol.flow').waitFor();
    const sheet = await page.evaluate(() => {
      const bottom = Math.max(...[...document.querySelectorAll('main *')].map(el => el.getBoundingClientRect().bottom));
      const leaf = [...document.querySelectorAll('main *')].filter(el => el.childElementCount === 0 && el.textContent.trim());
      const sizes = leaf.map(el => parseFloat(getComputedStyle(el).fontSize)).filter(size => size > 0);
      const lines = el => { const range = document.createRange(); range.selectNodeContents(el); return range.getClientRects().length; };
      const channels = value => value.match(/\d+/g).map(Number);
      return {
        sheetHeight: innerHeight,
        contentBottom: bottom,
        smallestPrintText: Math.min(...sizes),
        flowColumns: getComputedStyle(document.querySelector('.flow')).gridTemplateColumns.split(' ').length,
        gridColumns: getComputedStyle(document.querySelector('main')).gridTemplateColumns.split(' ').length,
        headers: [...document.querySelectorAll('.tool thead th')].map(th => ({ text: th.textContent, lines: lines(th) })),
        nums: [...document.querySelectorAll('.tool td.num')].map(td => ({ text: td.textContent, lines: lines(td) })),
        numColor: channels(getComputedStyle(document.querySelector('.tool td.num')).color)
      };
    });
    assert.equal(sheet.sheetHeight, SHEET.height, 'the page box is a full A4 landscape sheet');
    assert.equal(sheet.flowColumns, 8, 'print keeps the eight steps as one horizontal run');
    assert.equal(sheet.gridColumns, 12, 'print keeps the twelve-column grid');
    assert.equal(sheet.contentBottom <= sheet.sheetHeight, true, `the whole page must fit one sheet, got ${Math.round(sheet.contentBottom)}px of ${sheet.sheetHeight}px`);
    assert.equal(sheet.smallestPrintText >= PRINT_FLOOR, true, `printed type must stay at or above the ${PRINT_FLOOR}px floor, smallest was ${sheet.smallestPrintText}px`);
    // The horizon headers and the two-digit weights once broke onto two clipped lines in print, so
    // every header cell and every weight cell must still render as a single line.
    assert.deepEqual(sheet.headers.filter(cell => cell.lines > 1).map(cell => cell.text), [], 'no horizon header may wrap in print');
    assert.deepEqual(sheet.nums.filter(cell => cell.lines > 1).map(cell => cell.text), [], 'no factor weight may wrap in print');
    assert.equal(sheet.nums.length, 50, 'all fifty per-horizon weights are printed');
    // The weights printed near-white on white paper once, so the ink has to stay dark.
    assert.equal(Math.max(...sheet.numColor) < 128, true, `printed weights must stay dark, got rgb(${sheet.numColor.join(', ')})`);
  } finally { await browser.close(); }
});


test('the USD call map keeps its worked example, honesty flags and guard test', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.locator('ol.flow').waitFor();
    const call = await page.locator('.panel-score .call').textContent();
    const mini = await page.locator('.panel-score .grid-mini').textContent();
    const score = await page.locator('.panel-score').textContent();
    assert.match(call, /BULLISH/, 'the worked call keeps its direction');
    assert.match(call, /conviction 85%/, 'the worked call keeps its confidence');
    assert.match(mini, /bull weight[\s\S]*84/, 'the worked bull weight is stated');
    assert.match(mini, /bear weight[\s\S]*15/, 'the worked bear weight is stated');
    assert.match(mini, /participation[\s\S]*99/, 'the worked participation is stated');
    assert.match(mini, /net edge[\s\S]*\+70/, 'the worked net edge is stated');
    assert.match(score, /VERY_STRONG/, 'the strength banding is stated');
    const guarantees = await page.locator('.panel-good').textContent();
    assert.match(guarantees, /Code decides; the model narrates/, 'the code-decides/model-narrates split is stated');
    assert.match(guarantees, /Missing data is neutral, not guessed/, 'missing data is stated as neutral');
    const limits = await page.locator('.panel-limits').textContent();
    assert.match(limits, /Rulebook header vs code/, 'the rulebook-versus-code gap is stated');
    assert.match(limits, /numbers are discarded/, "the model's own numbers are stated as discarded");
    assert.match(limits, /A published call is not a proven edge/, 'the page says a call is not an edge');
    // The page ends by naming the test that guards it, so the named file has to exist.
    const footer = await page.locator('footer').textContent();
    const named = footer.match(/[\w.]+\.browser\.test\.js/);
    assert.ok(named, 'the footer must name the guard test');
    assert.equal(fs.existsSync(path.resolve(__dirname, named[0].replace(/^tests\//, ''))), true, `the footer names ${named[0]}, which must exist`);
    // Every link in the footer has to resolve to a file that ships with the page.
    const links = await page.locator('footer a[href]').evaluateAll(anchors => anchors.map(a => a.getAttribute('href')));
    assert.equal(links.length >= 3, true, 'the footer keeps its source links');
    for (const href of links) {
      assert.equal(fs.existsSync(path.resolve(__dirname, '..', href)), true, `${href} must resolve from the page's folder`);
    }
  } finally { await browser.close(); }
});

test('the dashboard reaches the USD call map from the shared top bar and the rail', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    // The sheet is only useful if a published page opens it, so the guard makes the hop from the entries the
    // shared navigation renders instead of reading their hrefs: an entry that was renamed, hidden or pointed
    // at a missing file fails here, the same way the site-nav guard holds the other six bar entries. The page
    // is a sheet a reader prints rather than a dashboard view, so the rail offers it as an outbound link,
    // never as a tab: the rail drives dashboard views by data-tab and this is not one.
    const bar = page.locator('.topbar.site-nav a.topbar-link[href="usd-layer1-call-flow.html"]');
    assert.equal(await bar.count(), 1, 'the dashboard bar must link to the USD call map');
    assert.equal(await bar.textContent(), 'USD Call Map', 'the bar entry must carry the label the navigation agreed');
    assert.equal(await bar.getAttribute('target'), '_top', 'the bar entry must leave any frame it is shown in');
    const rail = page.locator('nav#agentTabs a.side-rail-link[href="usd-layer1-call-flow.html"]');
    assert.equal(await rail.count(), 1, 'the rail must offer the sheet as one of its outbound entries');
    assert.equal(await rail.textContent(), 'USD Call Map', 'the rail entry must carry the label the navigation agreed');
    assert.equal(await rail.getAttribute('target'), '_top', 'the rail entry must leave any frame it is shown in');
    assert.equal(await page.locator('nav#agentTabs a[href="usd-layer1-call-flow.html"][data-tab]').count(), 0, 'the sheet must not be a rail tab: the rail drives dashboard views');
    assert.equal(await bar.isVisible(), true, 'the bar entry must be visible in a 1440px window');
    await bar.click();
    await page.waitForURL(/usd-layer1-call-flow\.html$/);
    assert.equal(await page.locator('ol.flow > .node').count(), 8, 'the bar entry opens the sheet with all eight chain steps');
    assert.match(await page.locator('h1').textContent(), /How the USD Layer 1 call is made/);
    await page.goBack();
    await page.waitForURL(/index\.html$/);
    // The rail entry is the second way in, from the same page.
    await rail.click();
    await page.waitForURL(/usd-layer1-call-flow\.html$/);
    assert.equal(await page.locator('ol.flow > .node').count(), 8, 'the rail entry opens the sheet with all eight chain steps');
  } finally { await browser.close(); }
});

test('the USD call map carries the shared navigation on screen, and prints as the map alone', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.locator('ol.flow').waitFor();
    // One bar and one rail, and the sheet clear of the fixed rail: the rail is 232px wide at this width, so the
    // fact worth holding is that the block sits beside the map rather than over it.
    assert.equal(await page.locator('body > header.site-nav.topbar').count(), 1, 'the page must carry the shared bar as its own');
    assert.equal(await page.locator('body > aside.site-nav.side-rail').count(), 1, 'the page must carry the shared rail');
    assert.equal(await page.locator('.topbar.site-nav a.topbar-link[href="usd-layer1-call-flow.html"]').count(), 1, 'the sheet must be reachable from the bar on its own page');
    const shifted = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().left);
    assert.equal(Math.round(shifted), 232, `the fixed rail must sit beside the map, main starts at ${Math.round(shifted)}px`);
    // Print: the bar and the rail leave the sheet, and the sheet starts at its own left edge rather than 232px in.
    await page.emulateMedia({ media: 'print' });
    const sheet = await page.evaluate(() => ({
      bar: getComputedStyle(document.querySelector('body > header.site-nav')).display,
      rail: getComputedStyle(document.querySelector('body > aside.site-nav.side-rail')).display,
      left: Math.round(document.querySelector('main').getBoundingClientRect().left),
    }));
    assert.equal(sheet.bar, 'none', 'the printed sheet must carry no navigation bar');
    assert.equal(sheet.rail, 'none', 'the printed sheet must carry no side rail');
    assert.equal(sheet.left, 0, `the printed sheet must start at its own left edge, started at ${sheet.left}px`);
  } finally { await browser.close(); }
});
