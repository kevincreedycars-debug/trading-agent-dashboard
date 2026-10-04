// The same top bar and the same side rail on all ten served pages is a promise about the bytes a reader is
// served, so this guard proves both halves of it: first that each page's marker block is the partial's render
// byte for byte, then that the ten pages, opened in a browser, show one bar, one rail, working links and no
// layout damage. A page edited on its own, a lost or re-ordered entry, a renamed label, a rail entry that
// points at nothing, a rail that covers a table or a page the block widened all fail here.
//
// The block lives in one place - backtester/partials/shared_nav.html, written into the pages by
// backtester/scripts/build_shared_nav.js - and both files are read here rather than copied, so this guard
// fails the moment a page and the partial disagree.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");

const nav = require("../scripts/build_shared_nav.js");

const root = nav.ROOT;
const builder = path.join(root, "backtester", "scripts", "build_shared_nav.js");

// The navigation the user asked for, label by label and in order, pinned here so a partial that drifts fails
// rather than quietly redefining the agreement. The bar's fifth entry is the printable call map: it is
// a page a reader opens and prints rather than a dashboard view, so it carries no rail of its own, is not one
// of the builder's nav pages, and is reached the same way from every page. The sixth is the what-moves-gold
// page published 2026-10-04, which is a builder page and carries the block like the other standalone pages.
const BRAND = "Asset Directional Movement Dashboard";
const BAR_LABELS = ["North Star Brief", "Standing Dashboard", "Gold", "Backtest Flow", "Call Map", "What moves gold"];
const BAR_HREFS = ["dashboard-northstar.html", "standing-dashboard.html", "gold.html", "backtest-flow.html", "layer1-call-flow.html", "what-moves-gold.html"];
const GROUPS = ["Operate", "Live", "Evidence", "System"];
const RAIL_LABELS = [
  "Overview", "USD", "EUR", "Gold", "Silver", "NQ", "BTC", "WTI", "GBP", "Pair Analysis",
  "Live Trading", "Backtest / Accuracy", "Backtest Engine", "Research Proof Map", "Factor Edge Lab",
  "Shadow Logic Backtest", "Architecture",
];
const RAIL_TABS = [
  "overview", "USD", "EUR", "GOLD", "SILVER", "NQ", "BTC", "WTI", "GBP", "layer2",
  "live-trading", "backtest", "backtest-engine", "research-proof-map", "factor-edge-lab",
  "shadow-logic-backtest", "architecture",
];
// Off the dashboard the gold entry is the gold tabs page rather than the dashboard's own gold view: that page
// is what the label names, and its hash handling already works with no script of its own.
const RAIL_HREFS = RAIL_TABS.map((tab, index) => (index === 3 ? "gold.html#direction" : `index.html#${tab}`));
// The rail also ends with one outbound entry, added 2026-10-04: like the bar's fifth entry it leaves the
// dashboard set for the printable call map, so it is written as a link in both variants rather than as a
// data-tab button, and it is pinned here for the same reason the labels are.
const RAIL_OUTBOUND_HREFS = ["layer1-call-flow.html"];
const RAIL_OUTBOUND_LABELS = ["Call Map"];
const MARK = "ADM";
const HEAD_LABEL = "Control Room";
const FOOT = "Published dashboard";
// The widths the other page guards already use. gold-factor-wip.html scrolled 59px sideways at 390px before
// this change - measured by opening the published page, which carries no rail and no bar - so the draft page
// is held to that ceiling while the eight other pages are held to the viewport.
const WIDTHS = [1440, 1180, 860, 768, 721, 390];
const PUBLISHED_OVERFLOW = { "gold-factor-wip.html": 59 };
const ONE_REQUEST_PAGES = ["gold-factor-wip.html"];
const RESEARCH_PAGE = "gold-backtesting.html";
const DRAFT_PAGE = "gold-factor-wip.html";

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

// Serves the repository root, because these are published pages that load their own stylesheet, script and
// data by relative path, and because a file:// origin keeps the dashboard's script from storing the view.
function serve() {
  const types = { ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(root, requested);
    fs.readFile(file.startsWith(root) ? file : path.join(root, "index.html"), (error, content) => {
      response.writeHead(error ? 404 : 200, { "content-type": types[path.extname(file)] || "text/html; charset=utf-8" });
      response.end(error ? "Not found" : content);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Reads the navigation back the way a reader meets it, not the way the source writes it.
async function fingerprint(page) {
  return page.evaluate(() => {
    const text = node => (node ? node.textContent.trim() : null);
    const topbar = document.querySelector(".topbar");
    const rail = document.querySelector(".side-rail");
    const entries = rail ? Array.from(rail.querySelectorAll("nav .tab-button")) : [];
    return {
      topbars: document.querySelectorAll(".topbar").length,
      rails: document.querySelectorAll(".side-rail").length,
      railIds: rail ? Array.from(rail.querySelectorAll("[id]")).map(node => node.id) : [],
      brand: text(topbar && topbar.querySelector(".topbar-brand")),
      barEntries: Array.from(document.querySelectorAll(".topbar .topbar-meta .topbar-link")).map(link => ({
        label: link.textContent.trim(),
        href: link.getAttribute("href"),
        target: link.getAttribute("target"),
      })),
      liveSpans: topbar ? topbar.querySelectorAll("#currentDate, #topbarClock").length : 0,
      mark: text(rail && rail.querySelector(".side-rail-mark")),
      headLabel: text(rail && rail.querySelector(".side-rail-label")),
      groups: rail ? Array.from(rail.querySelectorAll("nav .side-rail-group")).map(span => span.textContent.trim()) : [],
      entries: entries.map(entry => ({
        tag: entry.tagName.toLowerCase(),
        label: entry.textContent.trim(),
        tab: entry.dataset.tab || null,
        href: entry.getAttribute("href"),
        target: entry.getAttribute("target"),
      })),
      foot: text(rail && rail.querySelector(".side-rail-foot > span:not(.side-rail-status-dot)")),
      outbound: rail ? Array.from(rail.querySelectorAll("nav .side-rail-link")).map(link => ({
        label: link.textContent.trim(),
        href: link.getAttribute("href"),
        target: link.getAttribute("target"),
      })) : [],
      dots: rail ? rail.querySelectorAll(".side-rail-foot .side-rail-status-dot").length : 0,
    };
  });
}
test("every page carries the partial's render byte for byte, in the page's own line endings", () => {
  let report = "";
  try {
    report = execFileSync(process.execPath, [builder, "--check"], { cwd: root, encoding: "utf8" });
  } catch (error) {
    report = error.stdout || "";
  }
  assert.match(report, /--check: 10 pages, 17 rail entries, 1 outbound, 0 change\(s\)/, "--check must find all ten pages current");
  assert.doesNotMatch(report, /: (refreshed|placed)$/m, "no page may still need the block written into it");
  nav.PAGES.forEach(page => {
    const source = read(page.file);
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    // The block is inserted into a page that already has its own line endings, so it must not mix them: a page
    // that gained a lone \\n inside a CRLF file would show the whole file as rewritten in review.
    const alien = eol === "\r\n" ? /(^|[^\r])\n/ : /\r/;
    assert.equal(alien.test(source), false, `${page.file} must keep one line ending from top to bottom`);
    assert.equal(source.split(nav.START).length - 1, 1, `${page.file} must carry exactly one SHARED-NAV block`);
    assert.equal(source.split(nav.END).length - 1, 1, `${page.file} must close its SHARED-NAV block exactly once`);
    const region = nav.findRegion(source);
    assert.ok(region, `${page.file} must carry a block that owns the line breaks around it`);
    assert.equal(region.text, nav.renderBlock(page.variant, eol), `${page.file} must carry the ${page.variant} render, not a hand-edited copy`);
    assert.equal(source.slice(region.start, region.end), region.text, `${page.file} must slice back to the same block`);
  });
});

test("the partial is the navigation that was agreed, in both variants", () => {
  const rows = (text, pattern) => Array.from(text.matchAll(pattern), match => match.slice(1).map(part => (part || "").trim()));
  ["dashboard", "standalone"].forEach(variant => {
    const block = nav.renderBlock(variant);
    assert.ok(block.includes(`<div class="topbar-brand">${BRAND}</div>`), `the ${variant} bar must name the brand`);
    assert.deepEqual(
      rows(block, /<a class="topbar-link" href="([^"]+)" target="_top">([^<]+)<\/a>/g),
      BAR_HREFS.map((href, index) => [href, BAR_LABELS[index]]),
      `the ${variant} bar must offer the pages in order`,
    );
    assert.equal(block.includes('<span id="currentDate">'), variant === "dashboard", "only the dashboard bar may carry the live spans");
    assert.deepEqual(
      rows(block, /<span class="side-rail-group">([^<]+)<\/span>/g).map(row => row[0]),
      GROUPS,
      `the ${variant} rail must group the entries the same way`,
    );
    assert.ok(block.includes(`<span class="side-rail-mark">${MARK}</span>`), `the ${variant} rail must carry its mark`);
    assert.ok(block.includes(`<span class="side-rail-label">${HEAD_LABEL}</span>`), `the ${variant} rail must name the control room`);
    assert.ok(block.includes(FOOT), `the ${variant} rail must carry its foot`);
    assert.ok(block.includes('<style id="shared-nav-css">'), `the ${variant} block must carry its own styling`);
    const entries = rows(block, /<(?:button|a) class="tab-button[^"]*" (data-tab|href)="([^"]+)"[^>]*>([^<]+)<\/(?:button|a)>/g);
    assert.deepEqual(entries.map(entry => entry[2]), RAIL_LABELS, `the ${variant} rail must offer the same seventeen labels in order`);
    // The outbound entry is not one of the seventeen: it leaves the dashboard set, so it is a link in both
    // variants and the dashboard's tab binder never sees it. Both variants must carry the same one.
    assert.deepEqual(
      rows(block, /<a class="side-rail-link" href="([^"]+)" target="_top">([^<]+)<\/a>/g).map(row => [row[0], row[1]]),
      RAIL_OUTBOUND_HREFS.map((href, index) => [href, RAIL_OUTBOUND_LABELS[index]]),
      `the ${variant} rail must carry the same outbound entries`,
    );
    if (variant === "dashboard") {
      assert.deepEqual(entries.map(entry => entry[1]), RAIL_TABS, "the dashboard rail must name the tabs its script knows");
      assert.deepEqual(entries.map(entry => entry[0]), RAIL_TABS.map(() => "data-tab"), "the dashboard rail must drive the views by data-tab");
      assert.equal((block.match(/class="side-rail-link"/g) || []).length, RAIL_OUTBOUND_HREFS.length, "an outbound entry must never be written as a tab");
    } else {
      assert.deepEqual(entries.map(entry => entry[1]), RAIL_HREFS, "the standalone rail must link to the pages and hashes its labels name");
      assert.deepEqual(entries.map(entry => entry[0]), RAIL_HREFS.map(() => "href"), "the standalone rail must be plain links");
      assert.equal((block.match(/target="_top"/g) || []).length, BAR_HREFS.length + RAIL_HREFS.length + RAIL_OUTBOUND_HREFS.length, "every standalone link must leave any frame it is shown in");
    }
  });
});
test("all ten served pages show one bar and one rail, and every link it offers goes somewhere", async () => {
  // The gold page's strip was re-ordered and widened on 2026-10-03 - Start here, Direction, Movement - L2L and half
  // L2L, Factor tables (draft) and Archive census - so the direction read and the two movement ranges sit together
  // and the two archive censuses moved to the end, and it gained a first tab on 2026-10-04, What moves gold, framing
  // the page published that day. What this guard owns is that the rail's gold entry still names a view that exists,
  // that the pages the strip frames are still framed, and that a hash naming one of them still lands on it; the
  // tidied page's own guard, gold_view_tidy.browser.test.js, holds the rest.
  const goldTabs = Array.from(read("gold.html").matchAll(/class="goldtabs-tab"[^>]*id="tab-([^"]+)"/g), match => match[1]);
  assert.deepEqual(goldTabs, ["whatmoves", "start", "direction", "movement", "factor", "archive"], "gold.html must carry the six agreed views in order");
  assert.ok(goldTabs.includes(RAIL_HREFS[3].split("#")[1]), "the rail's gold entry must name a view the gold page opens");
  const goldFrames = Array.from(read("gold.html").matchAll(/<iframe[^>]*src="([^"]+)"/g), match => match[1]);
  assert.deepEqual(
    goldFrames,
    ["what-moves-gold.html", "gold-direction-scorecard.html", "gold-factor-wip.html", "gold-backtesting.html", "gold-backtest-outcomes.html"],
    "gold.html must frame the five pages the strip names",
  );
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const page of nav.PAGES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const requests = [];
      context.on("request", request => requests.push(request.url()));
      const view = await context.newPage();
      await view.goto(`${base}/${page.file}`, { waitUntil: "load" });
      const seen = await fingerprint(view);
      const where = `${page.file} (${page.variant})`;
      assert.equal(seen.topbars, 1, `${where} must carry one bar`);
      assert.equal(seen.rails, 1, `${where} must carry one rail`);
      assert.equal(seen.brand, BRAND, `${where} must name the brand in its bar`);
      assert.deepEqual(
        seen.barEntries.map(entry => [entry.href, entry.label, entry.target]),
        BAR_HREFS.map((href, index) => [href, BAR_LABELS[index], "_top"]),
        `${where} must offer the pages in the order agreed`,
      );
      BAR_HREFS.forEach(href => assert.ok(fs.existsSync(path.join(root, href)), `${where} bar points at ${href}, which is not published`));
      assert.equal(seen.liveSpans, page.variant === "dashboard" ? 2 : 0, `${where} must carry the live spans on the dashboard only`);
      assert.equal(seen.mark, MARK, `${where} must carry the rail's mark`);
      assert.equal(seen.headLabel, HEAD_LABEL, `${where} must name the control room`);
      assert.deepEqual(seen.groups, GROUPS, `${where} must group the entries the same way`);
      assert.equal(seen.foot, FOOT, `${where} must carry the rail's foot`);
      assert.equal(seen.dots, 1, `${where} must show one status dot`);
      assert.deepEqual(seen.entries.map(entry => entry.label), RAIL_LABELS, `${where} must offer the same seventeen labels in order`);
      assert.deepEqual(
        seen.outbound.map(entry => [entry.href, entry.label, entry.target]),
        RAIL_OUTBOUND_HREFS.map((href, index) => [href, RAIL_OUTBOUND_LABELS[index], "_top"]),
        `${where} must carry the rail's outbound entries`,
      );
      RAIL_OUTBOUND_HREFS.forEach(href => assert.ok(fs.existsSync(path.join(root, href)), `${where} rail points at ${href}, which is not published`));
      if (page.variant === "dashboard") {
        assert.ok(seen.railIds.includes("agentTabs"), `${where} must keep the tab list id its script drives`);
        assert.deepEqual(seen.entries.map(entry => [entry.tag, entry.tab, entry.href]), RAIL_TABS.map(tab => ["button", tab, null]), `${where} must drive the views by data-tab`);
      } else {
        assert.equal(seen.railIds.includes("agentTabs"), false, `${where} must not borrow the dashboard's tab list id`);
        assert.deepEqual(seen.entries.map(entry => [entry.tag, entry.href, entry.tab, entry.target]), RAIL_HREFS.map(href => ["a", href, null, "_top"]), `${where} must link to the pages and hashes its labels name`);
        RAIL_HREFS.forEach(href => {
          const [file, hash] = href.split("#");
          assert.ok(fs.existsSync(path.join(root, file)), `${where} rail points at ${file}, which is not published`);
          assert.ok((file === "gold.html" ? goldTabs : RAIL_TABS).includes(hash), `${where} rail points at ${href}, which names no view`);
        });
      }
      // The draft page is served with no navigation of its own, so the block has to be the whole of what it
      // needs and nothing on it may be fetched from anywhere else. Its block is the standalone block the other
      // research pages carry, byte for byte, so this answers for them too - and the byte tests above already
      // pin every block to the partial, which carries no link, script, image or font of its own.
      const fetched = requests.filter(url => !url.endsWith("/favicon.ico"));
      if (ONE_REQUEST_PAGES.includes(page.file)) {
        assert.deepEqual(fetched, [`${base}/${page.file}`], `${where} must load nothing outside itself`);
      } else {
        assert.equal(fetched.some(url => /shared_nav|SHARED-NAV|shared-nav/.test(url)), false, `${where} must not fetch the navigation partial or its styling as a file`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
// A rail entry is only navigation if it lands where its label says, from every page that shows it, including
// from inside the frames the gold tabs page puts around those pages.
test("a rail entry lands on the view its label names, from any page and from inside a frame", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const rail = (page, label) => page.locator(".side-rail nav a.tab-button", { hasText: label });
  const opens = (page, selector) => page.waitForFunction(node => !!document.querySelector(node) && document.querySelector(node).classList.contains("active-view"), selector);
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const view = await context.newPage();

    // A research page is plain links into the dashboard, so the dashboard has to read the hash the link carries
    // and open that view; the page it opens on must not depend on the view a reader arrived with.
    await view.goto(`${base}/${RESEARCH_PAGE}`, { waitUntil: "load" });
    await rail(view, "Live Trading").click();
    await view.waitForURL(/#live-trading$/);
    await opens(view, "#liveTradingView");
    assert.equal(
      await view.locator('.side-rail nav .tab-button[data-tab="live-trading"]').evaluate(node => node.classList.contains("active")),
      true,
      "the rail must mark the entry it opened",
    );

    await view.goto(`${base}/${RESEARCH_PAGE}`, { waitUntil: "load" });
    await rail(view, "Architecture").click();
    await view.waitForURL(/#architecture$/);
    await opens(view, "#architectureView");

    // The rail's gold entry names the gold tabs page rather than the dashboard's own gold view.
    await view.goto(`${base}/${RESEARCH_PAGE}`, { waitUntil: "load" });
    await rail(view, "Gold").click();
    await view.waitForURL(/gold\.html#direction$/);
    await view.waitForFunction(() => {
      const tab = document.querySelector("#tab-direction");
      const panel = document.querySelector("#panel-direction");
      return !!tab && tab.getAttribute("aria-selected") === "true" && !!panel && panel.classList.contains("is-open");
    });

    // The bar's gold entry is the one entry the three published gold guards ask for, on the draft page too. It
    // opens the gold page with no hash, so it lands on that page's own first view - What moves gold, the tab the
    // strip gained on 2026-10-04 - while the rail's gold entry keeps naming Direction. Either way the reader lands
    // on a view the page opens, never on a bare strip.
    await view.goto(`${base}/${DRAFT_PAGE}`, { waitUntil: "load" });
    await view.locator('.topbar .topbar-link[href="gold.html"]').click();
    await view.waitForURL(/gold\.html$/);
    await view.waitForFunction(() => {
      const tab = document.querySelector("#tab-whatmoves");
      const panel = document.querySelector("#panel-whatmoves");
      return !!tab && tab.getAttribute("aria-selected") === "true" && !!panel && panel.classList.contains("is-open");
    });

    // The bar's Call Map entry leaves the dashboard set for the printable call map, which is what its label
    // names: the heading a reader came for, seven steps, and no rail of its own on arrival.
    await view.goto(`${base}/index.html`, { waitUntil: "load" });
    await view.locator(".topbar .topbar-link", { hasText: "Call Map" }).click();
    await view.waitForURL(/layer1-call-flow\.html$/);
    await view.waitForFunction(() => {
      const heading = document.querySelector("h1");
      return !!heading
        && heading.textContent.trim() === "How the calls are made"
        && document.querySelectorAll("ol.flow > li.node").length === 7;
    });

    // The rail carries the same outbound entry the bar does, so a reader who works from the rail reaches the
    // printable call map the same way: straight from the dashboard, and from inside a gold frame in the whole
    // window rather than inside the frame.
    await view.goto(`${base}/index.html`, { waitUntil: "load" });
    await view.locator(".side-rail nav .side-rail-link", { hasText: "Call Map" }).click();
    await view.waitForURL(/layer1-call-flow\.html$/);
    await view.waitForFunction(() => {
      const heading = document.querySelector("h1");
      return !!heading && heading.textContent.trim() === "How the calls are made";
    });
    await view.goto(`${base}/gold.html#direction`, { waitUntil: "load" });
    await view.locator('iframe[title="Gold direction scorecard"]').scrollIntoViewIfNeeded();
    await view.frameLocator('iframe[title="Gold direction scorecard"]').locator(".side-rail nav a.side-rail-link").click();
    await view.waitForURL(/\/layer1-call-flow\.html$/);

    // gold.html frames five of these pages. An entry clicked inside one of those frames has to move the whole
    // window, not open the dashboard inside the frame and leave the reader with two rails. The strip's views are
    // all named, so the frame is opened the way a reader opens it - by naming the view it wants.
    await view.goto(`${base}/gold.html#direction`, { waitUntil: "load" });
    // The tab leads with the caller's own record and shows the framed scorecard under it, so a reader scrolls to
    // the frame before using it; the guard does the same rather than reading the frame from off-screen.
    await view.locator('iframe[title="Gold direction scorecard"]').scrollIntoViewIfNeeded();
    await view.frameLocator('iframe[title="Gold direction scorecard"]').locator(".side-rail nav a.tab-button", { hasText: "Architecture" }).click();
    await view.waitForURL(/#architecture$/);
    assert.ok(view.url().endsWith("/index.html#architecture"), "an entry inside a frame must open the view in the whole window");
    await opens(view, "#architectureView");
    await context.close();

    // A hash naming no view is a reader with a stale link: the dashboard must still open, on its own default.
    const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const visitor = await fresh.newPage();
    await visitor.goto(`${base}/index.html#not-a-view`, { waitUntil: "load" });
    await opens(visitor, "#overviewView");
    await fresh.close();
  } finally {
    await browser.close();
    server.close();
  }
});
// How much a page scrolls sideways, and how much of its rail sits over a table, as the reader's browser lays
// it out.
async function measure(page) {
  return page.evaluate(() => {
    const rail = document.querySelector(".side-rail");
    const box = rail ? rail.getBoundingClientRect() : null;
    const overlaps = box && box.width && box.height
      ? Array.from(document.querySelectorAll("table, pre")).filter(node => {
          const table = node.getBoundingClientRect();
          if (!table.width || !table.height) return false;
          return table.left < box.right - 1 && table.right > box.left + 1 && table.top < box.bottom - 1 && table.bottom > box.top + 1;
        }).length
      : 0;
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0) - window.innerWidth,
      overlaps,
    };
  });
}

// The rail takes 232px of a reader's window on wide screens and a strip of it on narrow ones, so the block may
// not widen a page or sit on top of its tables at any width the other page guards check.
test("the block widens no page and covers no table", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const page of nav.PAGES) {
      const context = await browser.newContext();
      const view = await context.newPage();
      for (const width of WIDTHS) {
        await view.setViewportSize({ width, height: 900 });
        await view.goto(`${base}/${page.file}`, { waitUntil: "load" });
        const withBlock = await measure(view);
        const railVisible = await view.evaluate(() => {
          const rail = document.querySelector(".side-rail");
          const box = rail ? rail.getBoundingClientRect() : null;
          return !!box && box.width > 0 && box.height > 0;
        });
        // Take the block's own styling away and measure again: the difference is what the block costs the page.
        await view.evaluate(() => {
          const style = document.getElementById("shared-nav-css");
          if (style) style.disabled = true;
        });
        const withoutBlock = await measure(view);
        const where = `${page.file} at ${width}px`;
        assert.equal(railVisible, true, `${where} must show its rail`);
        assert.equal(withBlock.overlaps, 0, `${where} must not lay the rail over a table`);
        const ceiling = PUBLISHED_OVERFLOW[page.file] || 1;
        assert.ok(withBlock.overflow <= ceiling, `${where} must not scroll sideways past the ${ceiling}px it already did: ${withBlock.overflow}px`);
        assert.ok(withBlock.overflow <= Math.max(1, withoutBlock.overflow), `${where} must not be widened by the block: ${withBlock.overflow}px against ${withoutBlock.overflow}px without it`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
