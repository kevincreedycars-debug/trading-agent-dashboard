// The gold page was tidied on 2026-10-03: one strip, five views - Start here, Direction, Movement - L2L and half
// L2L, Factor tables (draft) and Archive census - with the user's standing rule applied, that wherever a rate is
// printed the direction read and the two movement shares are printed together, each with its own sample count and
// its own plain-words line. This guard holds the parts a reader would notice if they broke: the five views and
// their order, the four pages still framed and still carrying their own honesty lines, every printed rate carrying
// its sample, the direction-and-two-ranges block on each view written into this page, the old census hashes still
// landing, and a layout that does not scroll sideways at any width the other page guards check.
//
// It reads gold.html's own source for the markers and opens the page in a browser for the behaviour. It never
// edits the four framed pages: the tidy was not allowed to touch them, and this guard reads them only to prove
// that.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const PAGE = "gold.html";
const VIEWS = ["start", "direction", "movement", "factor", "archive"];
const LABELS = ["Start here", "Direction", "Movement - L2L and half L2L", "Factor tables (draft)", "Archive census"];
const INLINE_VIEWS = ["start", "direction", "movement"];
const FRAMES = [
  "gold-direction-scorecard.html",
  "gold-factor-wip.html",
  "gold-backtesting.html",
  "gold-backtest-outcomes.html",
];
// The four framed pages keep their own honesty markers; the tidy may not have touched them, so the guard reads
// them here as well as in their own guards.
const FRAMED_MARKERS = {
  "gold-direction-scorecard.html": [/Research only/i],
  "gold-factor-wip.html": [/what this page is not/i, /\bAs of\b/, /answered/i],
  "gold-backtesting.html": [/25\s+unordered/i],
  "gold-backtest-outcomes.html": [/cannot support choosing/i],
};
// Every rate the tidied page prints, with the sample count printed in the same row.
const RATES = [
  ["56.84%", "570"], ["46.32%", "570"], ["45.63%", "355"], ["61.13%", "355"],
  ["64.04%", "570"], ["38.42%", "570"], ["40.00%", "300"], ["53.33%", "270"],
  ["97.89%", "558"], ["75.26%", "429"], ["51.52%", "429"], ["40.09%", "429"],
  ["8.39%", "429"], ["68.49%", "570"], ["55.20%", "570"],
];
const SIZES = ["1.4472%", "0.7236%", "0.3618%", "0.6701%"];
const WIDTHS = [1440, 1180, 860, 768, 721, 390];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

// A view's own markup: its panel, up to the next panel, so a claim about one tab cannot be satisfied by another.
function panelSource(source, view) {
  const start = source.indexOf(`id="panel-${view}"`);
  assert.ok(start > -1, `gold.html must carry a panel for the ${view} view`);
  const next = source.indexOf('<section class="goldtabs-panel"', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

// Serves the repository root: these are published pages that load their own stylesheet and frames by relative path.
function serve() {
  const types = { ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "") || PAGE;
    const file = path.resolve(root, requested);
    fs.readFile(file.startsWith(root) ? file : path.join(root, PAGE), (error, content) => {
      response.writeHead(error ? 404 : 200, { "content-type": types[path.extname(file)] || "text/html; charset=utf-8" });
      response.end(error ? "Not found" : content);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("the strip carries the five agreed views, in order, each with its own panel", () => {
  const source = read(PAGE);
  const tabs = Array.from(
    source.matchAll(/class="goldtabs-tab"[^>]*id="tab-([^"]+)"[^>]*>([\s\S]*?)<\/button>/g),
    match => ({ id: match[1], label: match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }),
  );
  assert.deepEqual(tabs.map(tab => tab.id), VIEWS, "gold.html must carry the five agreed views in this order");
  assert.deepEqual(tabs.map(tab => tab.label), LABELS, "and each view must be labelled as the user confirmed it");
  VIEWS.forEach(view => {
    assert.match(source, new RegExp(`aria-controls="panel-${view}"`), `the ${view} tab must point at its own panel`);
  });
  assert.equal((source.match(/id="panel-/g) || []).length, VIEWS.length, "no view may be added or dropped quietly");
  assert.equal((source.match(/class="goldtabs-tab"/g) || []).length, VIEWS.length, "the strip and the panels stay one for one");
});

test("the four pages are still framed, in the tidied order, and none of them was rewritten", () => {
  const source = read(PAGE);
  const frames = Array.from(source.matchAll(/<iframe[^>]*src="([^"]+)"/g), match => match[1]);
  assert.deepEqual(frames, FRAMES, "gold.html must frame the four pages it always framed");
  FRAMES.forEach(file => {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} must still be published at its own address`);
  });
  Object.entries(FRAMED_MARKERS).forEach(([file, patterns]) => {
    const page = read(file);
    patterns.forEach(pattern => assert.match(page, pattern, `${file} must keep its own honesty line (${pattern})`));
  });
});

test("every rate the tidied page prints carries its own sample count and a plain-words line", () => {
  const source = read(PAGE);
  const rows = Array.from(source.matchAll(/<tr>([\s\S]*?)<\/tr>/g), match => match[1]);
  RATES.forEach(([figure, sample]) => {
    assert.ok(source.includes(figure), `the page must print ${figure}`);
    const row = rows.find(candidate => candidate.includes(figure));
    assert.ok(row, `${figure} must be printed in a table row so its sample can sit beside it`);
    assert.match(row, new RegExp(`<td[^>]*>[^<]*\\b${sample}\\b[^<]*<`), `${figure} must carry its sample count ${sample}`);
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), match => match[1]);
    assert.ok(cells.length >= 3, `${figure} must sit in a row with its figure, its sample and its plain words`);
    assert.ok(cells[cells.length - 1].replace(/<[^>]+>/g, "").trim().length > 12, `${figure} must carry a plain-words line`);
  });
  SIZES.forEach(size => assert.ok(source.includes(size), `the page must print the day size ${size}`));
});

test("the direction read and both movement shares are printed together on every view written into this page", () => {
  const source = read(PAGE);
  INLINE_VIEWS.forEach(view => {
    const panel = panelSource(source, view);
    assert.equal((panel.match(/goldtabs-trio"/g) || []).length, 1, `the ${view} view must carry the three-reads block`);
    assert.equal((panel.match(/class="goldtabs-card"/g) || []).length, 3, `the ${view} block must show the three reads, no more and no fewer`);
    ["56.84%", "46.32%", "97.89%", "75.26%", "0.3618%", "0.7236%"].forEach(figure => {
      assert.ok(panel.includes(figure), `the ${view} view must show ${figure} beside the other two reads`);
    });
  });
});

test("the tidied page states what it is not, with its dates, on the view a reader lands on", () => {
  // Read the words, not the line breaks: the page wraps its sentences, and a claim about what the page says must
  // not depend on where a wrap fell.
  const flat = text => text.replace(/\s+/g, " ");
  const source = flat(read(PAGE));
  const start = flat(panelSource(read(PAGE), "start")).toLowerCase();
  ["not a signal", "not a forecast and not a trading result", "3 october 2026", "28 september 2026",
    "unordered 25-row history window", "570 archived gold call sessions", "21,871 complete hourly xau/usd bars",
  ].forEach(line => assert.ok(start.includes(line), `the landing view must say "${line}"`));
  assert.ok(source.includes("can describe this space, but it cannot support choosing from it"),
    "the archive censuses must carry the archive's own verdict where they are shown");
  assert.ok(source.includes("is the prerequisite the user asked for ahead of any forward record"),
    "the collector fault must be named as outstanding on the page");
});

// Opens on the view whose tab says it is selected and whose panel says it is open - the two things a reader sees.
async function openView(page, view) {
  await page.waitForFunction(name => {
    const tab = document.querySelector("#tab-" + name);
    const panel = document.querySelector("#panel-" + name);
    return !!tab && tab.getAttribute("aria-selected") === "true" && !!panel && panel.classList.contains("is-open");
  }, view);
}

test("the views open by hash, by click and by arrow key, and the old census hashes still land", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const view = await context.newPage();
    // A reader arriving with no hash, or with a stale one, lands on Start here rather than on a blank strip.
    await view.goto(`${base}/${PAGE}`, { waitUntil: "load" });
    await openView(view, "start");
    // The rail's gold entry, and any shared link, still lands on Direction.
    await view.goto(`${base}/${PAGE}#direction`, { waitUntil: "load" });
    await openView(view, "direction");
    // Each view opens by click, and the hash it writes reopens the same view on a reload.
    for (const name of VIEWS) {
      await view.locator(`#tab-${name}`).click();
      await openView(view, name);
      await view.reload({ waitUntil: "load" });
      await openView(view, name);
    }
    // The arrow keys move the selection the strip promises they move.
    await view.locator("#tab-start").click();
    await view.locator("#tab-start").press("ArrowRight");
    await openView(view, "direction");
    // A hash that named a census before the tidy opens the archive view and scrolls to the page it names.
    for (const [hash, anchor] of [["backtesting", "frame-backtesting"], ["outcomes", "frame-outcomes"]]) {
      await view.goto(`${base}/${PAGE}#${hash}`, { waitUntil: "load" });
      await openView(view, "archive");
      const inView = await view.evaluate(id => {
        const frame = document.getElementById(id);
        if (!frame) return false;
        const box = frame.getBoundingClientRect();
        return box.width > 0 && box.top < window.innerHeight && box.bottom > 0;
      }, anchor);
      assert.equal(inView, true, `#${hash} must scroll the archive view to ${anchor}`);
    }
    await view.goto(`${base}/${PAGE}#not-a-view`, { waitUntil: "load" });
    await openView(view, "start");
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test("no view of the tidied page scrolls sideways at any width the other guards check, and every frame loads", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const sideways = page => page.evaluate(() => Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0,
  ) - window.innerWidth);
  try {
    const context = await browser.newContext();
    const view = await context.newPage();
    for (const width of WIDTHS) {
      await view.setViewportSize({ width, height: 900 });
      for (const name of VIEWS) {
        await view.goto(`${base}/${PAGE}#${name}`, { waitUntil: "load" });
        await openView(view, name);
        const overflow = await sideways(view);
        assert.ok(overflow <= 1, `the ${name} view must not scroll sideways at ${width}px: ${overflow}px`);
      }
    }
    // The four pages the strip frames are framed exactly once, and both censuses load when their view opens.
    await view.setViewportSize({ width: 1440, height: 900 });
    await view.goto(`${base}/${PAGE}#archive`, { waitUntil: "load" });
    for (const file of FRAMES) {
      assert.equal(await view.locator(`iframe[src="${file}"]`).count(), 1, `${file} must be framed exactly once`);
    }
    await view.waitForFunction(() => Array.from(document.querySelectorAll("#panel-archive iframe"))
      .every(frame => !!frame.contentDocument && frame.contentDocument.readyState === "complete"));
    const loaded = await view.evaluate(() => Array.from(document.querySelectorAll("#panel-archive iframe"))
      .map(frame => frame.contentDocument.title));
    assert.equal(loaded.length, 2, "the archive view must frame both censuses");
    loaded.forEach(title => assert.match(title, /gold/i, "each census frame must show a gold page"));
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});
