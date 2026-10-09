const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// The dossier page is a reading copy of `docs/analysis-engine/USD_LAYER1_LOGIC.md`, so the guard holds the
// three things that would make it something else: a page a reader cannot reach or read, a page that
// summarises the dossier instead of carrying it, and a download that hands over a file which is no longer
// the dossier. It reads the Markdown itself and compares against it, so an edit to the dossier cannot leave
// the page behind, and it runs the builder's own `--check` as a separate opinion on the same question.
const ROOT = path.resolve(__dirname, '..');
const PAGE = path.resolve(ROOT, 'usd-layer1-logic.html');
const SOURCE = path.resolve(ROOT, 'docs/analysis-engine/USD_LAYER1_LOGIC.md');
const TEXT = path.resolve(ROOT, 'docs/analysis-engine/USD_LAYER1_LOGIC.md.txt');
const BUILDER = path.resolve(ROOT, 'backtester/scripts/build_usd_layer1_logic_page.js');
const SECTIONS = 11;
const WIDTHS = [1440, 1180, 860, 721, 390];

const markdown = fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const lines = markdown.split('\n');
const TITLE = lines.find(line => line.startsWith('# ')).slice(2).trim();
const TITLES = lines.filter(line => line.startsWith('## ')).map(line => line.slice(3).trim());
const TABLES = lines.filter(line => /^\|[\s:|-]+\|$/.test(line.trim())).length;
const CODE_BLOCKS = lines.filter(line => /^```/.test(line)).length / 2;

// The opening words of each section, stripped of their markup: the page has to carry the dossier's own
// sentences, so the guard looks for them rather than for a count of headings.
const OPENINGS = lines.flatMap((line, index) => {
  if (!line.startsWith('## ')) return [];
  for (let cursor = index + 1; cursor < lines.length; cursor++) {
    const candidate = lines[cursor].trim();
    if (!candidate || candidate.startsWith('#') || candidate.startsWith('|') || candidate.startsWith('```') || /^(-{3,}|[-*] |\d+[.)] )/.test(candidate)) continue;
    return [candidate.replace(/[`*]/g, '').replace(/\s+/g, ' ').slice(0, 60)];
  }
  return [];
});
const flatten = value => value.replace(/\s+/g, ' ').trim();

const overflowing = () => [...document.querySelectorAll('.page-head, .chapter, .preamble, .index, footer, .chips li, .download-row')]
  .filter(node => node.scrollWidth > node.clientWidth + 1)
  .map(node => `${node.className || node.tagName}: content is ${node.scrollWidth}px wide in a ${node.clientWidth}px box`);

const sideways = () => document.documentElement.scrollWidth > window.innerWidth + 1;

test('the dashboard reaches the USD logic dossier and the page leads back', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(path.resolve(ROOT, 'index.html')).href);
    const link = page.locator('a.topbar-link[href="usd-layer1-logic.html"]');
    assert.equal(await link.count(), 1, 'the dashboard topbar must carry exactly one dossier link');
    assert.equal(await link.isVisible(), true);
    assert.equal(await page.locator('a.side-rail-link[href="usd-layer1-logic.html"]').count(), 1, 'the side rail must carry the same route');
    await link.click();
    await page.waitForURL(/usd-layer1-logic\.html$/);
    assert.equal(flatten(await page.locator('h1').textContent()), TITLE, 'the page must carry the dossier title');
    assert.equal(await page.locator('a.back[href="index.html"]').isVisible(), true, 'the page must link back to the dashboard');
    assert.equal(await page.locator('.download[href="docs/analysis-engine/USD_LAYER1_LOGIC.md.txt"]').count(), 1, 'the download must be the page download');
  } finally { await browser.close(); }
});

test('the dossier page renders offline at desktop and narrow widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = request.url();
      if (!url.startsWith('file:') && !/fonts\.(googleapis|gstatic)\.com/.test(url)) external.push(url);
    });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'domcontentloaded' });
      await page.locator('.doc').waitFor();
      assert.equal(await page.locator('.chapter').count(), SECTIONS, `at ${width}px the page keeps all ${SECTIONS} sections`);
      assert.equal(await page.locator('script, img, iframe').count(), 0, 'the page loads no script, image or frame of its own');
      assert.deepEqual(await page.evaluate(overflowing), [], `at ${width}px no panel may let its text outgrow its own box`);
      assert.equal(await page.evaluate(sideways), false, `at ${width}px the page itself may not scroll sideways`);
      // A wide table is allowed to scroll, but only inside its own frame: that is what keeps the page still.
      const wrappers = await page.locator('.table-wrap').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).overflowX));
      assert.deepEqual(wrappers, wrappers.map(() => 'auto'), 'every table scrolls inside its own frame');
    }
    assert.deepEqual(external, [], 'the page must pull nothing but its own font files');
    assert.deepEqual(errors, [], 'the page must render without script errors offline');
  } finally { await browser.close(); }
});

test('the page carries the dossier rather than a summary of it', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.locator('.doc').waitFor();
    assert.deepEqual(await page.locator('.chapter h2').allTextContents(), TITLES, 'every section heading is the dossier heading');
    assert.deepEqual(await page.locator('.toc a').allTextContents(), TITLES, 'the index lists the sections in order');
    // Every index link has to land on a section that exists, which is what a reader clicks first.
    const anchors = await page.locator('.toc a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href').slice(1)));
    const ids = await page.locator('.chapter').evaluateAll(nodes => nodes.map(node => node.id));
    assert.deepEqual(anchors, ids, 'every index anchor must resolve to a section');
    assert.equal(await page.locator('.table-wrap').count(), TABLES, 'the page carries every table in the dossier');
    assert.equal(await page.locator('pre.code').count(), CODE_BLOCKS, 'the page carries every code block in the dossier');
    const text = flatten(await page.locator('.doc').textContent());
    for (const opening of OPENINGS) {
      assert.equal(text.includes(opening), true, `the page must carry the opening of a section: "${opening}"`);
    }
    // The one number the dossier exists to settle, quoted in its own alignment-free form.
    assert.equal(text.includes('0.85*0.45 + 0.99*0.35 + 0.70*0.20 = 0.869'), true, 'the headline reconciliation is on the page');
    assert.match(text, /different quantities stored under the same field name/);
    assert.match(await page.locator('footer').textContent(), /not proof of what the live workspace runs today/, 'the export-is-a-snapshot limit stays on the page');
  } finally { await browser.close(); }
});
test('the download link hands the reader the Markdown source itself', async () => {
  // The download is a static-host behaviour, not a file:// one: a browser only turns the `download`
  // attribute into a saved file over HTTP, so this test serves the repository the way the site is served.
  const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const file = path.resolve(ROOT, urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.txt') || file.endsWith('.md') ? 'text/plain; charset=utf-8' : 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/usd-layer1-logic.html`);
    const link = page.locator('a.download');
    assert.equal(await link.getAttribute('download'), 'USD_LAYER1_LOGIC.md.txt', 'the link must save the file under a .txt name');
    assert.equal(await link.isVisible(), true);
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    assert.equal(download.suggestedFilename(), 'USD_LAYER1_LOGIC.md.txt');
    const saved = path.join(os.tmpdir(), `usd-layer1-logic-${process.pid}.md.txt`);
    await download.saveAs(saved);
    const handed = fs.readFileSync(saved, 'utf8').replace(/\r\n/g, '\n');
    fs.unlinkSync(saved);
    // The point of the download is that it is the dossier, not a rendering of it: the Markdown markers,
    // the code fences and the tables all arrive as written.
    assert.equal(handed, markdown, 'the download must be the committed dossier');
    assert.equal(handed, fs.readFileSync(TEXT, 'utf8').replace(/\r\n/g, '\n'), 'the committed .txt must be the file the link serves');
    assert.equal(handed.split('\n')[0], `# ${TITLE}`, 'the download starts with the dossier title');
    assert.match(handed, /^## \d+\. /m, 'the download keeps the Markdown headings the page renders');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('the builder reports the page and the download in step with the dossier', () => {
  const result = spawnSync(process.execPath, [BUILDER, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, `--check must find no drift, it said: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /usd-layer1-logic\.html: unchanged/);
  assert.match(result.stdout, /USD_LAYER1_LOGIC\.md\.txt: unchanged/);
  assert.match(result.stdout, /0 change\(s\) in 2 generated file\(s\); 11 sections from \d+ source lines\./);
});

test('the printed dossier lands as ink on paper', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1180, height: 900 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.emulateMedia({ media: 'print' });
    const sheet = await page.evaluate(() => {
      const numbers = value => (value.match(/[\d.]+/g) || []).map(Number);
      const rgb = value => numbers(value).slice(0, 3);
      const alpha = value => (numbers(value).length > 3 ? numbers(value)[3] : 1);
      const channel = value => { const part = value / 255; return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4); };
      const lum = channels => channels.map(channel).reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
      const contrast = (fore, back) => {
        const [high, low] = [lum(fore), lum(back)].sort((a, b) => b - a);
        return (high + 0.05) / (low + 0.05);
      };
      // A printed line sits on the nearest opaque ancestor that is not a gradient wash, or on the sheet itself.
      const behind = element => {
        for (let node = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (alpha(style.backgroundColor) > 0.5 && !style.backgroundImage.includes('gradient')) return rgb(style.backgroundColor);
        }
        return [255, 255, 255];
      };
      const shown = element => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };
      const flooded = [];
      let palest = { ink: Infinity, text: '', color: '', behind: [] };
      for (const element of document.querySelectorAll('body *')) {
        if (!shown(element)) continue;
        const style = getComputedStyle(element);
        const fill = rgb(style.backgroundColor);
        // A pale tint is fine on paper; a panel that still fills with ink is not, and a code block that
        // keeps its dark background would arrive as a black box on the sheet.
        if (alpha(style.backgroundColor) > 0.5 && lum(fill) < 0.8) flooded.push(`${element.tagName.toLowerCase()}.${element.className} fills with rgb(${fill.join(', ')})`);
        const own = [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
        if (!own) continue;
        const ink = contrast(rgb(style.color), behind(element));
        if (ink < palest.ink) palest = { ink, text: element.textContent.trim().slice(0, 32), color: style.color, behind: behind(element) };
      }
      return { scheme: getComputedStyle(document.documentElement).colorScheme, ink: getComputedStyle(document.body).color, back: getComputedStyle(document.body).backgroundColor, flooded, palest };
    });
    assert.equal(sheet.scheme, 'light', 'the printed sheet must ask for the light scheme');
    assert.equal(sheet.back, 'rgb(255, 255, 255)', 'the printed sheet must land on white paper');
    assert.deepEqual(sheet.flooded, [], 'no panel may flood the sheet with ink');
    assert.equal(sheet.palest.ink >= 4.5, true, `every printed line must clear 4.5:1 on the sheet, ${sheet.palest.ink.toFixed(2)}:1 was the worst: "${sheet.palest.text}" in ${sheet.palest.color} on rgb(${sheet.palest.behind.join(', ')})`);
  } finally { await browser.close(); }
});

