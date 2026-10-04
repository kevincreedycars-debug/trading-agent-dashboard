const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The one-pager is a claim about how the eight Layer 1 calls are made, so the guard checks the
// picture and the claim together: seven chain steps in order, eight asset rows that name the
// rulebook each agent reads, the nine nodes inside one agent, and the honesty flags that say which
// rulebooks are still drafts. It also holds the page to the two things it promises about itself:
// no text may outgrow its own card, and the whole page must still fit one A4 landscape sheet when
// printed, without the print type being shrunk under the legibility floor.
// The page is reached from the shared top bar and, since 2026-10-04, from the rail's one outbound entry,
// so the last test makes both hops rather than reading either entry's href. Both entries live in
// backtester/partials/shared_nav.html and are rendered into all ten published pages by
// backtester/scripts/build_shared_nav.js, which is what keeps the dashboard's own copy of them in step
// with every other page's.
const PAGE = path.resolve(__dirname, '../layer1-call-flow.html');
const WIDTHS = [1440, 1180, 860, 721, 390];
// The box Chrome lays the printed sheet out in: 297x210mm A4 landscape minus the 8mm page margin.
const SHEET = { width: Math.round((297 - 16) / 25.4 * 96), height: Math.round((210 - 16) / 25.4 * 96) };
// Nothing on the printed sheet may be smaller than this, so a future edit that adds copy cannot pay
// for it by shrinking the type below the point where the sheet stops being readable on paper.
const PRINT_FLOOR = 7.5;
const ASSETS = ['USD', 'EUR', 'GOLD', 'SILVER', 'NQ', 'BTC', 'WTI', 'GBP'];
const CHAIN = ['01 · TRIGGER', '02 · COLLECT', '03 · STORE', '04 · SEALED LAYER 1', '05 · STORE', '06 · LAYER 2', '07 · PUBLISH'];

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
  for (const node of document.querySelectorAll('.node, .panel, .chips li, .legend li')) {
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

test('the Layer 1 call map renders offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(PAGE).href);
      await page.locator('ol.flow').waitFor();
      assert.equal(await page.locator('.flow .node').count(), 7, `at ${width}px the chain keeps its seven steps`);
      assert.equal(await page.locator('.flow .arrow').count(), 6);
      assert.deepEqual(await page.locator('.flow .node .step').allTextContents(), CHAIN, `at ${width}px the seven steps stay in order`);
      assert.deepEqual(await page.locator('.tool tbody tr td:first-child').allTextContents(), ASSETS);
      assert.equal(await page.locator('.tool tbody tr').count(), 8, 'the run has exactly eight assets');
      assert.equal(await page.locator('.panel-steps .steps li').count(), 9, 'one agent still runs nine nodes');
      assert.equal(await page.locator('.legend li').count(), 4, 'the colour legend still names all four kinds');
      // A dropped closing tag once nested one panel inside another and the grid still looked
      // plausible in a screenshot, so the structure itself is asserted here.
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('main > .two-up, main > .columns')].map(section => section.children.length)), [2, 2], 'each two-up band holds exactly two panels');
      assert.equal(await page.evaluate(() => document.querySelectorAll('.panel .panel, .node .node, .band .columns, .band .two-up, header .panel').length), 0, 'no panel or chain card may be nested inside another');
      assert.deepEqual(await page.evaluate(starvedText), [], `at ${width}px no card text may outgrow its own card`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `at ${width}px the map must not scroll sideways`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.flow')).flexDirection), 'row', 'wide screens read the chain as one left-to-right run');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.two-up')).gridTemplateColumns.split(' ').length), 2, 'wide screens read the two-up band as two columns');
    const shot = process.env.LAYER1_FLOW_SHOT;
    if (shot) {
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      await page.screenshot({ path: shot, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.flow')).flexDirection), 'column', 'narrow screens stack the chain');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, [], 'the map must render without script errors offline');
  } finally { await browser.close(); }
});

test('the call map still prints as one readable A4 landscape sheet', async () => {
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
      const panels = [...document.querySelectorAll('.panel')].map(el => {
        const style = getComputedStyle(el);
        return [el.className, style.gridColumnStart, style.gridRowStart];
      });
      return {
        sheetHeight: innerHeight,
        contentBottom: bottom,
        smallestPrintText: Math.min(...sizes),
        flowDirection: getComputedStyle(document.querySelector('.flow')).flexDirection,
        wrappers: [...document.querySelectorAll('.two-up, .columns')].map(el => getComputedStyle(el).display),
        columns: getComputedStyle(document.querySelector('main')).gridTemplateColumns.split(' ').length,
        panels
      };
    });
    assert.equal(sheet.sheetHeight, SHEET.height, 'the page box is a full A4 landscape sheet');
    assert.equal(sheet.flowDirection, 'row', 'print keeps the seven steps as one horizontal run');
    // The two on-screen wrappers drop out of the print flow, so their panels become grid items of
    // main. If that regressed, the four panels would stack down the sheet and spill onto page two.
    assert.deepEqual(sheet.wrappers, ['contents', 'contents'], 'the print grid owns the four panels');
    assert.equal(sheet.columns, 3, 'print reads the sheet as three columns');
    assert.deepEqual(sheet.panels, [
      ['panel panel-steps', '1', '3'],
      ['panel panel-assets', '2', '3'],
      ['panel panel-guarantees', '3', '3'],
      ['panel panel-limits', '3', '4']
    ], 'steps | assets | guarantees over limits');
    assert.equal(sheet.contentBottom <= sheet.sheetHeight, true, `the whole page must fit one sheet, got ${Math.round(sheet.contentBottom)}px of ${sheet.sheetHeight}px`);
    assert.equal(sheet.smallestPrintText >= PRINT_FLOOR, true, `printed type must stay at or above the ${PRINT_FLOOR}px floor, smallest was ${sheet.smallestPrintText}px`);
  } finally { await browser.close(); }
});

test('the call map keeps its honesty flags and its guard test', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.locator('ol.flow').waitFor();
    const pageText = await page.evaluate(() => document.body.textContent);
    const assets = await page.locator('.panel-assets').textContent();
    const limits = await page.locator('.panel-limits').textContent();
    const guarantees = await page.locator('.panel-guarantees').textContent();
    // Three rulebooks publish as live while their own headers still call them drafts, and WTI is the
    // one asset whose facts do not come from the shared snapshot. A tidy rewrite of this page that
    // drops either note would leave the picture looking cleaner than the pipeline is.
    assert.match(assets, /SILVER[\s\S]*header still says inactive draft/, 'the silver rulebook draft header is stated with its row');
    assert.match(assets, /WTI[\s\S]*header still says research only/, 'the WTI rulebook draft header is stated with its row');
    assert.match(assets, /GBP[\s\S]*header still says research only/, 'the GBP rulebook draft header is stated with its row');
    assert.match(limits, /Three rulebooks still carry draft headers/);
    assert.match(limits, /the shared snapshot has no WTI columns/, 'the one extra data path is stated');
    assert.match(limits, /A published call is not a proven edge/, 'the page says a call is not an edge');
    assert.match(limits, /in this repo still name only the original five assets/, 'the partial workflow mirror is stated');
    assert.match(guarantees, /The model returns factor signals only/, 'the code-decides-conviction split is stated');
    assert.match(guarantees, /never recomputes one/, 'Layer 2 is stated as downstream-only');
    assert.match(pageText, /gpt-4\.1-mini/, 'the model the agents call is named');
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

test('the dashboard reaches the Layer 1 call map from the shared top bar and the rail', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    // The one-pager is only useful if a published page opens it, so the guard makes the hop from the
    // bar entry the shared navigation renders instead of reading its href: an entry that was
    // renamed, hidden or pointed at a missing file fails here, the same way the site-nav guard holds
    // the other four bar entries. The map is a page a reader prints rather than a dashboard view, so
    // where the rail offers it - it has since 2026-10-04, in the System group beside Architecture - it
    // offers it as an outbound link, never as a tab: the rail's tabs drive dashboard views by data-tab
    // and this is not one.
    const bar = page.locator('.topbar.site-nav a.topbar-link[href="layer1-call-flow.html"]');
    assert.equal(await bar.count(), 1, 'the dashboard bar must link to the call map');
    assert.equal(await bar.textContent(), 'Layer 1 Calls', 'the bar entry must carry the label the navigation agreed');
    assert.equal(await bar.getAttribute('target'), '_top', 'the bar entry must leave any frame it is shown in');
    const rail = page.locator('nav#agentTabs a.side-rail-link[href="layer1-call-flow.html"]');
    assert.equal(await rail.count(), 1, 'the rail must offer the map as one of its outbound entries');
    assert.equal(await rail.textContent(), 'Layer 1 Calls', 'the rail entry must carry the label the navigation agreed');
    assert.equal(await rail.getAttribute('target'), '_top', 'the rail entry must leave any frame it is shown in');
    assert.equal(await page.locator('nav#agentTabs a[href="layer1-call-flow.html"][data-tab]').count(), 0, 'the map must not be a rail tab: the rail drives dashboard views');
    assert.equal(await bar.isVisible(), true, 'the bar entry must be visible in a 1440px window');
    await bar.click();
    await page.waitForURL(/layer1-call-flow\.html$/);
    assert.equal(await page.locator('ol.flow > .node').count(), 7, 'the bar entry opens the map with all seven chain steps');
    assert.match(await page.locator('h1').textContent(), /How the Layer 1 calls are made/);
    await page.goBack();
    await page.waitForURL(/index\.html$/);
    // The rail entry is the second way in, from the same page.
    await rail.click();
    await page.waitForURL(/layer1-call-flow\.html$/);
    assert.equal(await page.locator('ol.flow > .node').count(), 7, 'the rail entry opens the map with all seven chain steps');
  } finally { await browser.close(); }
});



