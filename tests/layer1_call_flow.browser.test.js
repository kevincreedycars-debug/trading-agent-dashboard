const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The one-pager is a claim about how the calls are made, in both layers, so the guard checks the
// picture and the claim together: seven chain steps in order, eight asset rows that name the rulebook
// each agent reads, the nine nodes inside one Layer 1 agent, the five steps that turn finished calls
// into ranked pairs, and the honesty flags that say which rulebooks are still drafts and which Layer 2
// rules only the export proves. It also holds the page to the two things it promises about itself:
// no text may outgrow its own card, and the whole page must still fit one A4 landscape sheet when
// printed, without the print type being shrunk under the legibility floor.
// The page is reached from the shared top bar and, since 2026-10-04, from the rail's one outbound entry,
// so the fourth test makes both hops rather than reading either entry's href. Both entries live in
// backtester/partials/shared_nav.html and are rendered into all twelve published pages by
// backtester/scripts/build_shared_nav.js, which is what keeps the dashboard's own copy of them in step
// with every other page's. Since the same date this page carries that block itself - the map is a page a
// reader navigates to, not only a sheet - so the fifth test holds the block's two promises about it: the
// bar and the rail are on screen and off the printed sheet, and the sheet is still the map alone, with the
// white palette the switcher previews held to a contrast floor rather than only to a colour list.
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
  for (const node of document.querySelectorAll('.node, .panel, .chips li, .legend li, .tool th, .tool td')) {
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
      assert.equal(await page.locator('.panel-layer2 .steps li').count(), 5, 'Layer 2 is still explained in five steps');
      assert.equal(await page.locator('.legend li').count(), 4, 'the colour legend still names all four kinds');
      // A dropped closing tag once nested one panel inside another and the grid still looked
      // plausible in a screenshot, so the structure itself is asserted here.
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('main > .two-up, main > .columns')].map(section => section.children.length)), [2, 3], 'the two-up band holds two panels and the columns band holds three');
      assert.equal(await page.evaluate(() => document.querySelectorAll('.panel .panel, .node .node, .band .columns, .band .two-up, header .panel').length), 0, 'no panel or chain card may be nested inside another');
      assert.deepEqual(await page.evaluate(starvedText), [], `at ${width}px no card text may outgrow its own card`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `at ${width}px the map must not scroll sideways`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    // The shared rail takes a fixed 232px off the map's column from 901px up, so the chain's run is measured
    // against the column the map actually has rather than against the window: at 1440px with the rail beside
    // it there is no room for seven cards on one line, and the map stacks them rather than breaking a word.
    // Given the column back - a wider window, so the rail's 232px no longer decides - the run returns.
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.flow')).flexDirection), 'column', 'the shared rail leaves the chain stacked at 1440px');
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.flow')).flexDirection), 'row', 'a window wide enough to hold the map beside the rail reads the chain as one run');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.two-up')).gridTemplateColumns.split(' ').length), 2, 'wide screens read the two-up band as two columns');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.columns')).gridTemplateColumns.split(' ').length), 3, 'wide screens read the columns band as three columns');
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
    // main. If that regressed, the five panels would stack down the sheet and spill onto page two.
    assert.deepEqual(sheet.wrappers, ['contents', 'contents'], 'the print grid owns the five panels');
    assert.equal(sheet.columns, 3, 'print reads the sheet as three columns');
    assert.deepEqual(sheet.panels, [
      ['panel panel-steps', '1', '3'],
      ['panel panel-assets', '2', '3'],
      ['panel panel-layer2', '2', '4'],
      ['panel panel-guarantees', '3', '3'],
      ['panel panel-limits', '3', '4']
    ], 'steps | assets over Layer 2 | guarantees over limits');
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
    const layer2 = await page.locator('.panel-layer2').textContent();
    // Three rulebooks publish as live while their own headers still call them drafts, and WTI is the
    // one asset whose facts do not come from the shared snapshot. A tidy rewrite of this page that
    // drops either note would leave the picture looking cleaner than the pipeline is.
    assert.match(assets, /SILVER[\s\S]*inactive draft/, 'the silver rulebook draft header is stated with its row');
    assert.match(assets, /WTI[\s\S]*research only/, 'the WTI rulebook draft header is stated with its row');
    assert.match(assets, /GBP[\s\S]*research only/, 'the GBP rulebook draft header is stated with its row');
    assert.match(limits, /Three rulebooks still carry draft headers/);
    assert.match(limits, /the shared snapshot has no WTI columns/, 'the one extra data path is stated');
    assert.match(limits, /A published call is not a proven edge/, 'the page says a call is not an edge');
    assert.match(limits, /in this repo still name only the original five assets/, 'the partial workflow mirror is stated');
    assert.match(guarantees, /The model returns factor signals only/, 'the code-decides-conviction split is stated');
    assert.match(guarantees, /never recomputes one/, 'Layer 2 is stated as downstream-only');
    assert.match(guarantees, /selection, not an order/, 'Layer 2 is stated as a list of pairs rather than an order');
    assert.match(pageText, /gpt-4\.1-mini/, 'the model the agents call is named');
    // Layer 2's own rules are the part of this page a reader cannot see on a dashboard tab, so the
    // numbers that decide a pair are pinned here: the threshold, the average, the seven live pair
    // names, the reason the dropped pairs carry, and the file they all land in.
    assert.match(layer2, /60 or more/, 'the pair conviction threshold is stated');
    assert.match(layer2, /round\(\(base \+ USD\) \/ 2\)/, 'the pair confidence formula is stated');
    assert.match(layer2, /no clear bias/, 'the no-clear-bias filter is stated');
    assert.match(layer2, /EUR\/USD[\s\S]*XAU\/USD[\s\S]*XAG\/USD[\s\S]*BTC\/USD[\s\S]*NQ\/USD[\s\S]*WTI\/USD[\s\S]*GBP\/USD/, 'the seven live pair names are stated');
    assert.match(layer2, /avoid_today/, 'the avoided pairs and their reasons are stated');
    assert.match(layer2, /data\/layer2\.json/, 'the file Layer 2 writes is named');
    assert.match(limits, /average, not a probability/, 'the pair number is stated as an average');
    assert.match(limits, /today_call/, 'the dormant model-authored path is stated');
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

test('the dashboard reaches the call map from the shared top bar and the rail', async () => {
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
    assert.equal(await bar.textContent(), 'Call Map', 'the bar entry must carry the label the navigation agreed');
    assert.equal(await bar.getAttribute('target'), '_top', 'the bar entry must leave any frame it is shown in');
    const rail = page.locator('nav#agentTabs a.side-rail-link[href="layer1-call-flow.html"]');
    assert.equal(await rail.count(), 1, 'the rail must offer the map as one of its outbound entries');
    assert.equal(await rail.textContent(), 'Call Map', 'the rail entry must carry the label the navigation agreed');
    assert.equal(await rail.getAttribute('target'), '_top', 'the rail entry must leave any frame it is shown in');
    assert.equal(await page.locator('nav#agentTabs a[href="layer1-call-flow.html"][data-tab]').count(), 0, 'the map must not be a rail tab: the rail drives dashboard views');
    assert.equal(await bar.isVisible(), true, 'the bar entry must be visible in a 1440px window');
    await bar.click();
    await page.waitForURL(/layer1-call-flow\.html$/);
    assert.equal(await page.locator('ol.flow > .node').count(), 7, 'the bar entry opens the map with all seven chain steps');
    assert.match(await page.locator('h1').textContent(), /How the calls are made/);
    await page.goBack();
    await page.waitForURL(/index\.html$/);
    // The rail entry is the second way in, from the same page.
    await rail.click();
    await page.waitForURL(/layer1-call-flow\.html$/);
    assert.equal(await page.locator('ol.flow > .node').count(), 7, 'the rail entry opens the map with all seven chain steps');
  } finally { await browser.close(); }
});



test('the map carries the shared navigation on screen, and prints as the map alone', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.locator('ol.flow').waitFor();
    // One bar, one rail, one switcher, and the map clear of the fixed rail. The rail is 232px wide at this
    // width, so the two facts worth holding are that the block is on the page and that it is beside the map
    // rather than over it.
    assert.equal(await page.locator('body > header.site-nav.topbar').count(), 1, 'the page must carry the shared bar as its own');
    assert.equal(await page.locator('body > aside.site-nav.side-rail').count(), 1, 'the page must carry the shared rail');
    assert.equal(await page.locator('.topbar.site-nav a.topbar-link[href="layer1-call-flow.html"]').count(), 1, 'the map must be reachable from the bar on its own page');
    const toggle = page.locator('#sheetToggle');
    assert.equal(await toggle.count(), 1, 'the title block must offer the sheet switcher');
    assert.equal(await toggle.isVisible(), true, 'the switcher must be visible in a 1440px window');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false', 'the page opens on the dark screen palette');
    const shifted = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().left);
    assert.equal(Math.round(shifted), 232, `the fixed rail must sit beside the map, main starts at ${Math.round(shifted)}px`);
    // The switcher's own promise: the sheet turns white and the ink turns dark, and every colour the reader
    // reads words in - heading, lede, eyebrow, link, arrow, tagline - stays above the floor the paper
    // palette was chosen for. The ratios are measured from the page rather than from a list of hex values.
    const ink = () => page.evaluate(() => {
      const channel = value => { const part = value / 255; return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4); };
      const lum = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel)
        .reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
      const ratio = (fore, back) => {
        const [high, low] = [lum(fore), lum(back)].sort((a, b) => b - a);
        return (high + 0.05) / (low + 0.05);
      };
      const inkOf = selector => getComputedStyle(document.querySelector(selector)).color;
      const back = getComputedStyle(document.body).backgroundColor;
      return {
        paper: document.documentElement.getAttribute('data-theme'),
        back,
        readings: ['h1', '.lede', '.eyebrow', 'footer a', '.flow .arrow', '.node .tagline']
          .map(selector => [selector, Math.round(ratio(inkOf(selector), back) * 100) / 100]),
      };
    });
    const dark = await ink();
    assert.equal(dark.paper, null, 'the page opens with no paper attribute on it');
    await toggle.click();
    const paper = await ink();
    assert.equal(paper.paper, 'paper', 'the switcher must mark the page as the paper sheet');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'the switcher must report its own state');
    assert.equal(paper.back, 'rgb(255, 255, 255)', 'the paper sheet must be white behind the map');
    assert.notEqual(dark.back, paper.back, 'the two views must not read the same behind the map');
    assert.deepEqual(paper.readings.filter(([, value]) => value < 4.5), [], 'every colour on the paper sheet must stay legible');
    assert.equal(paper.readings[0][1] >= 7, true, `the heading's own ink must stay well above legibility, got ${paper.readings[0][1]}`);
    // Turning the palette over may not cost a card its text, at a wide or a narrow window.
    assert.deepEqual(await page.evaluate(starvedText), [], 'the paper sheet may not starve a card of its text');
    await page.setViewportSize({ width: 390, height: 900 });
    assert.deepEqual(await page.evaluate(starvedText), [], 'the paper sheet may not starve a card of its text at 390px');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the paper sheet must not scroll sideways at 390px');
    await page.setViewportSize({ width: 1440, height: 900 });
    await toggle.click();
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-theme')), false, 'the switcher must turn back to the dark screen sheet');
    // Print, from the dark view: the bar, the rail and the switcher leave the sheet, the sheet starts at its
    // own left edge rather than 232px in, and it lands on paper ink whatever the screen shows.
    await page.emulateMedia({ media: 'print' });
    const sheet = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return {
        bar: getComputedStyle(document.querySelector('body > header.site-nav')).display,
        rail: getComputedStyle(document.querySelector('body > aside.site-nav.side-rail')).display,
        toggle: getComputedStyle(document.querySelector('#sheetToggle')).display,
        left: Math.round(document.querySelector('main').getBoundingClientRect().left),
        ink: style.color,
        back: style.backgroundColor,
      };
    });
    assert.equal(sheet.bar, 'none', 'the printed sheet must carry no navigation bar');
    assert.equal(sheet.rail, 'none', 'the printed sheet must carry no side rail');
    assert.equal(sheet.toggle, 'none', 'the printed sheet must carry no screen control');
    assert.equal(sheet.left, 0, `the printed sheet must start at its own left edge, started at ${sheet.left}px`);
    assert.equal(sheet.ink, 'rgb(15, 23, 32)', 'print must land on the paper ink even from the dark view');
    assert.equal(sheet.back, 'rgb(255, 255, 255)', 'print must land on white paper even from the dark view');
  } finally { await browser.close(); }
});


