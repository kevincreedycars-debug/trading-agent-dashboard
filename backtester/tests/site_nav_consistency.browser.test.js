// The same top bar and the same side rail on all fourteen served pages is a promise about the bytes a reader is
// served, so this guard proves both halves of it: first that each page's marker block is the partial's render
// byte for byte, then that the fourteen pages, opened in a browser, show one bar, one rail, working links and no
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
// rather than quietly redefining the agreement. The bar itself is now only the brand and, on the dashboard, the
// date and two clocks: the eight page links it used to carry live in the rail's Old documentation disclosure.
// Five of them are pages of their own rather than dashboard views: the Backtest Flow page, the printable call map
// (added 2026-10-04, the fifth), the USD one-pager (2026-10-08, the sixth), the USD Layer 1 logic dossier
// (2026-10-09, the seventh) and the what-moves-gold page (2026-10-04, the eighth). Each carries the block like
// every other page, each keeps the bar and the rail off its own printed sheet, and each is reached the same way
// from every page. Backtesting is not retired: it stays a live rail tab, and the standalone page links to it.
const BRAND = "Asset Directional Movement Dashboard";
const DOC_LABELS = ["North Star Brief", "Standing Dashboard", "Gold", "Backtest Flow", "Call Map", "USD Call Map", "USD Logic Dossier", "What moves gold"];
const DOC_HREFS = ["dashboard-northstar.html", "standing-dashboard.html", "gold.html", "backtest-flow.html", "layer1-call-flow.html", "usd-layer1-call-flow.html", "usd-layer1-logic.html", "what-moves-gold.html"];
const DOC_SUMMARY = "Old documentation";
const GROUPS = ["Operate", "Live", "Evidence", "System"];
const RAIL_LABELS = [
  "Overview", "USD", "EUR", "Gold", "Silver", "NQ", "BTC", "WTI", "GBP", "Pair Analysis",
  "Live Trading", "Live cTrader Copier", "Research Library", "Backtesting", "Backtest / Accuracy",
  "Backtest Engine", "Research Proof Map", "Factor Edge Lab", "Shadow Logic Backtest", "Architecture",
  "Live Trade Logic",
];
const RAIL_TABS = [
  "overview", "USD", "EUR", "GOLD", "SILVER", "NQ", "BTC", "WTI", "GBP", "layer2",
  "live-trading", "live-ctrader-copier", "research-library", "usd-layer1-backtester", "backtest",
  "backtest-engine", "research-proof-map", "factor-edge-lab", "shadow-logic-backtest", "architecture",
  "live-trade-logic",
];
// Off the dashboard the gold entry is the gold tabs page rather than the dashboard's own gold view: that page
// is what the label names, and its hash handling already works with no script of its own. Backtesting's public
// hash is #backtesting, the deep-link form its view has always read, not the state id it is stored under.
const RAIL_HREFS = RAIL_TABS.map((tab) => {
  if (tab === "GOLD") return "gold.html#direction";
  if (tab === "usd-layer1-backtester") return "index.html#backtesting";
  return `index.html#${tab}`;
});
const MARK = "ADM";
const HEAD_LABEL = "Control Room";
const FOOT = "Published dashboard";
// The widths the other page guards already use. gold-factor-wip.html scrolled 59px sideways at 390px before
// this change - measured by opening the published page, which carries no rail and no bar - so the draft page
// is held to that ceiling while the thirteen other standalone pages and the dashboard are held to the viewport.
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
    const details = rail ? rail.querySelector("nav details.side-rail-details") : null;
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
      docsSummary: text(details && details.querySelector("summary")),
      docsOpen: Boolean(details && details.open),
      documentation: details ? Array.from(details.querySelectorAll(".side-rail-details-body .side-rail-link")).map(link => ({
        label: link.textContent.trim(),
        href: link.getAttribute("href"),
        target: link.getAttribute("target"),
      })) : [],
      dots: rail ? rail.querySelectorAll(".side-rail-foot .side-rail-status-dot").length : 0,
    };
  });
}
// The eight retired bar links sit behind a native disclosure so they cost the rail none of its width. A guard
// that clicks one has to open it first, exactly as a reader would; setting `open` directly keeps the guard from
// depending on where the summary happens to sit under a sticky bar.
async function revealDocumentation(scope) {
  const details = scope.locator(".side-rail nav details.side-rail-details").first();
  await details.evaluate(node => { node.open = true; });
  return details.locator(".side-rail-details-body");
}

test("every page carries the partial's render byte for byte, in the page's own line endings", () => {
  let report = "";
  try {
    report = execFileSync(process.execPath, [builder, "--check"], { cwd: root, encoding: "utf8" });
  } catch (error) {
    report = error.stdout || "";
  }
  assert.match(report, /--check: 14 pages, 21 rail entries, 8 outbound, 0 change\(s\)/, "--check must find all fourteen pages current");
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
    // The clock sits immediately below the block on every standalone page, and nowhere on the dashboard: script.js
    // already drives the dashboard's two nodes. It is inline, so the draft page still loads nothing outside itself.
    const clockCount = source.split(nav.CLOCK_START).length - 1;
    if (page.variant === "standalone") {
      assert.equal(clockCount, 1, `${page.file} must carry exactly one SHARED-CLOCK block`);
      assert.equal(source.slice(region.end).startsWith(nav.CLOCK_START), true, `${page.file} must put the clock immediately below the bar and rail`);
      const clockRegion = nav.findClockRegion(source);
      assert.ok(clockRegion, `${page.file} must carry a clock block that owns its trailing line break`);
      assert.equal(clockRegion.text, nav.renderClock(eol), `${page.file} must carry the shared clock script, not a hand-edited copy`);
    } else {
      assert.equal(clockCount, 0, `${page.file} must leave the clock to script.js`);
    }
  });
});

test("the partial is the navigation that was agreed, in both variants", () => {
  const rows = (text, pattern) => Array.from(text.matchAll(pattern), match => match.slice(1).map(part => (part || "").trim()));
  ["dashboard", "standalone"].forEach(variant => {
    const block = nav.renderBlock(variant);
    assert.ok(block.includes(`<div class="topbar-brand">${BRAND}</div>`), `the ${variant} bar must name the brand`);
    // The bar keeps only the brand, the date and the two clocks. The eight page links live in the rail's
    // disclosure now, so a topbar-link anywhere means the old bar has crept back.
    assert.doesNotMatch(block, /class="topbar-link"/, `the ${variant} bar must not carry page links`);
    assert.ok(block.includes('<span id="currentDate">'), `the ${variant} bar must carry the date`);
    assert.ok(block.includes('id="topbarClock"'), `the ${variant} bar must carry the dual clock`);
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
    assert.deepEqual(entries.map(entry => entry[2]), RAIL_LABELS, `the ${variant} rail must offer the same twenty-one labels in order`);

    // The eight retired bar links are one disclosure, closed until a reader opens it. They leave the dashboard
    // set, so they are anchors in both variants, carry no data-tab and carry target="_top" for the gold frames.
    const details = block.match(/<details class="side-rail-details">[\s\S]*?<\/details>/);
    assert.ok(details, `the ${variant} rail must carry the Old documentation disclosure`);
    const detailsBlock = details[0];
    assert.deepEqual(
      rows(detailsBlock, /<summary[^>]*>([^<]+)<\/summary>/g).map(row => row[0]),
      [DOC_SUMMARY],
      `the ${variant} rail must name the disclosure ${DOC_SUMMARY}`,
    );
    assert.doesNotMatch(detailsBlock, /<details[^>]*\sopen\b/, `the ${variant} disclosure must start closed`);
    assert.deepEqual(
      rows(detailsBlock, /<a class="side-rail-link" href="([^"]+)" target="_top">([^<]+)<\/a>/g),
      DOC_HREFS.map((href, index) => [href, DOC_LABELS[index]]),
      `the ${variant} rail must carry the eight documentation links in the order agreed`,
    );
    assert.equal((detailsBlock.match(/<a class="side-rail-link"/g) || []).length, DOC_HREFS.length, "the disclosure must not grow a ninth entry");

    if (variant === "dashboard") {
      assert.deepEqual(entries.map(entry => entry[1]), RAIL_TABS, "the dashboard rail must name the tabs its script knows");
      assert.deepEqual(entries.map(entry => entry[0]), RAIL_TABS.map(() => "data-tab"), "the dashboard rail must drive the views by data-tab");
      assert.equal((block.match(/<a [^>]*target="_top"/g) || []).length, DOC_HREFS.length, "only the documentation leaves the dashboard, and every link must leave any frame it is shown in");
    } else {
      assert.deepEqual(entries.map(entry => entry[1]), RAIL_HREFS, "the standalone rail must link to the pages and hashes its labels name");
      assert.deepEqual(entries.map(entry => entry[0]), RAIL_HREFS.map(() => "href"), "the standalone rail must be plain links");
      assert.equal((block.match(/<a [^>]*target="_top"/g) || []).length, RAIL_HREFS.length + DOC_HREFS.length, "every standalone link must leave any frame it is shown in");
    }
  });
});
test("all fourteen served pages show one bar and one rail, and every link it offers goes somewhere", async () => {
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
      assert.deepEqual(seen.barEntries, [], `${where} must keep page links out of the bar`);
      DOC_HREFS.forEach(href => assert.ok(fs.existsSync(path.join(root, href.split("#")[0])), `${where} documentation points at ${href}, which is not published`));
      assert.equal(seen.liveSpans, 2, `${where} must carry the date and dual clock in its bar`);
      assert.match(await view.locator("#topbarClock").textContent(), /^UK \d{2}:\d{2} \| ET \d{2}:\d{2}$/, `${where} must show both live times`);
      const dateText = await view.locator("#currentDate").textContent();
      assert.doesNotMatch(dateText, /Loading/, `${where} must fill in the date`);
      assert.match(dateText, /^\w+day, \d{1,2} \w+ \d{4}$/, `${where} must date the header in full`);
      assert.equal(seen.mark, MARK, `${where} must carry the rail's mark`);
      assert.equal(seen.headLabel, HEAD_LABEL, `${where} must name the control room`);
      assert.deepEqual(seen.groups, GROUPS, `${where} must group the entries the same way`);
      assert.equal(seen.foot, FOOT, `${where} must carry the rail's foot`);
      assert.equal(seen.dots, 1, `${where} must show one status dot`);
      assert.deepEqual(seen.entries.map(entry => entry.label), RAIL_LABELS, `${where} must offer the same twenty-one labels in order`);
      assert.equal(seen.docsSummary, DOC_SUMMARY, `${where} must keep the retired bar links under one disclosure`);
      assert.equal(seen.docsOpen, false, `${where} must keep Old documentation closed until a reader opens it`);
      assert.deepEqual(
        seen.documentation.map(entry => [entry.href, entry.label, entry.target]),
        DOC_HREFS.map((href, index) => [href, DOC_LABELS[index], "_top"]),
        `${where} must carry the eight documentation links in the order agreed`,
      );
      if (page.variant === "dashboard") {
        assert.ok(seen.railIds.includes("agentTabs"), `${where} must keep the tab list id its script drives`);
        assert.deepEqual(seen.entries.map(entry => [entry.tag, entry.tab, entry.href]), RAIL_TABS.map(tab => ["button", tab, null]), `${where} must drive the views by data-tab`);
      } else {
        assert.equal(seen.railIds.includes("agentTabs"), false, `${where} must not borrow the dashboard's tab list id`);
        assert.deepEqual(seen.entries.map(entry => [entry.tag, entry.href, entry.tab, entry.target]), RAIL_HREFS.map(href => ["a", href, null, "_top"]), `${where} must link to the pages and hashes its labels name`);
        RAIL_HREFS.forEach(href => {
          const [file, hash] = href.split("#");
          // The dashboard stores the native backtester view under usd-layer1-backtester but has always read
          // #backtesting as its public deep link, so the standalone rail keeps naming the public hash.
          const view = hash === "backtesting" ? "usd-layer1-backtester" : hash;
          assert.ok(fs.existsSync(path.join(root, file)), `${where} rail points at ${file}, which is not published`);
          assert.ok((file === "gold.html" ? goldTabs : RAIL_TABS).includes(view), `${where} rail points at ${href}, which names no view`);
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

    // The Old documentation Gold entry is the one entry the three published gold guards ask for, on the draft
    // page too. It opens the gold page with no hash, so it lands on that page's own first view - What moves gold,
    // the tab the strip gained on 2026-10-04 - while the rail's gold entry keeps naming Direction. Either way the
    // reader lands on a view the page opens, never on a bare strip.
    await view.goto(`${base}/${DRAFT_PAGE}`, { waitUntil: "load" });
    await (await revealDocumentation(view)).locator('a[href="gold.html"]').click();
    await view.waitForURL(/gold\.html$/);
    await view.waitForFunction(() => {
      const tab = document.querySelector("#tab-whatmoves");
      const panel = document.querySelector("#panel-whatmoves");
      return !!tab && tab.getAttribute("aria-selected") === "true" && !!panel && panel.classList.contains("is-open");
    });

    // The Old documentation Call Map entry leaves the dashboard set for the printable call map, which is what its
    // label names: the heading a reader came for, seven steps, and the shared bar and rail on arrival.
    await view.goto(`${base}/index.html`, { waitUntil: "load" });
    await (await revealDocumentation(view)).locator('a[href="layer1-call-flow.html"]').click();
    await view.waitForURL(/layer1-call-flow\.html$/);
    await view.waitForFunction(() => {
      const heading = document.querySelector("h1");
      return !!heading
        && heading.textContent.trim() === "How the calls are made"
        && document.querySelectorAll("ol.flow > li.node").length === 7;
    });

    // The rail carries the same entries wherever it appears, so a reader who works from the rail reaches the
    // printable maps the same way: straight from the dashboard, and from inside a gold frame in the whole window
    // rather than inside the frame.
    await view.goto(`${base}/index.html`, { waitUntil: "load" });
    await (await revealDocumentation(view)).locator('a[href="layer1-call-flow.html"]').click();
    await view.waitForURL(/layer1-call-flow\.html$/);
    await view.waitForFunction(() => {
      const heading = document.querySelector("h1");
      return !!heading && heading.textContent.trim() === "How the calls are made";
    });
    await view.goto(`${base}/gold.html#direction`, { waitUntil: "load" });
    await view.locator('iframe[title="Gold direction scorecard"]').scrollIntoViewIfNeeded();
    await (await revealDocumentation(view.frameLocator('iframe[title="Gold direction scorecard"]')))
      .locator('a[href="layer1-call-flow.html"]').click();
    await view.waitForURL(/\/layer1-call-flow\.html$/);

    // The same disclosure inside the same frame reaches the USD one-pager, published 2026-10-08: the two maps
    // carry labels of their own rather than one reading twice.
    await view.goto(`${base}/gold.html#direction`, { waitUntil: "load" });
    await view.locator('iframe[title="Gold direction scorecard"]').scrollIntoViewIfNeeded();
    await (await revealDocumentation(view.frameLocator('iframe[title="Gold direction scorecard"]')))
      .locator('a[href="usd-layer1-call-flow.html"]').click();
    await view.waitForURL(/\/usd-layer1-call-flow\.html$/);
    await view.waitForFunction(() => {
      const heading = document.querySelector("h1");
      return !!heading && heading.textContent.trim() === "How the USD Layer 1 call is made";
    });

    // And the USD Layer 1 logic dossier, published 2026-10-09: the same click inside the same frame lands on the
    // reading page behind that call, which opens on the dossier's own title and carries the whole text rather
    // than a summary of it. Its own guard reads the Markdown under it and compares.
    await view.goto(`${base}/gold.html#direction`, { waitUntil: "load" });
    await view.locator('iframe[title="Gold direction scorecard"]').scrollIntoViewIfNeeded();
    await (await revealDocumentation(view.frameLocator('iframe[title="Gold direction scorecard"]')))
      .locator('a[href="usd-layer1-logic.html"]').click();
    await view.waitForURL(/\/usd-layer1-logic\.html$/);
    await view.waitForFunction(() => {
      const heading = document.querySelector("h1");
      return !!heading && heading.textContent.trim() === "USD Layer 1 — complete logic dossier";
    });

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
// The standalone backtester is reached two ways a reader actually uses: the link on the dashboard's Backtesting
// tab, and the link on backtesting.html. Both must land on the same guarded page, and the page's own controls
// must still drive the panel once the shared navigation has replaced the stale hand-written copy it shipped with.
test("the standalone backtester opens from both entry points, and its controls still work", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const panelReady = view => view.waitForFunction(() => {
    const panel = document.querySelector("#usdLayer1Panel");
    return !!panel
      && !!panel.querySelector('[data-usd-l1-tabs="true"]')
      && panel.querySelectorAll("[data-usd-l1-tab]").length === 4
      && !panel.querySelector(".empty-state");
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const view = await context.newPage();

    await view.goto(`${base}/index.html#backtesting`, { waitUntil: "load" });
    await view.waitForFunction(() => document.querySelector("#usdLayer1BacktesterView")?.classList.contains("active-view"));
    const dashboardBar = await view.locator(".topbar").evaluate(node => {
      const box = node.getBoundingClientRect();
      return { height: box.height, links: node.querySelectorAll(".topbar-link").length };
    });
    assert.ok(dashboardBar.height <= 50, `the dashboard bar must stay compact: ${dashboardBar.height}px`);
    assert.equal(dashboardBar.links, 0, "the dashboard bar must not carry page links");
    assert.match(await view.locator("#topbarClock").textContent(), /UK \d{2}:\d{2} \| ET \d{2}:\d{2}/, "the dashboard clock must show both live times");
    assert.doesNotMatch(await view.locator("#currentDate").textContent(), /Loading/, "the dashboard date must be filled in");
    const scope = view.locator("details.usd-l1-eligibility").first();
    await scope.evaluate(node => { node.open = true; });
    await scope.locator('a[href="usd-layer1-backtester.html"]').click();
    await view.waitForURL(/\/usd-layer1-backtester\.html$/);
    await panelReady(view);
    assert.equal(await view.locator(".topbar").evaluate(node => node.getBoundingClientRect().height <= 50), true, "the standalone bar must stay compact");
    assert.equal(await view.locator(".topbar .topbar-link").count(), 0, "the standalone bar must not carry page links");
    assert.match(await view.locator("#topbarClock").textContent(), /^UK \d{2}:\d{2} \| ET \d{2}:\d{2}$/, "the standalone clock must show both live times");
    assert.doesNotMatch(await view.locator("#currentDate").textContent(), /Loading/, "the standalone date must be filled in");
    assert.equal(await view.locator(".side-rail nav details.side-rail-details").evaluate(node => node.open), false, "Old documentation must start closed on the backtester");

    await view.locator('button[data-usd-l1-tab="four_markets"]').click();
    await view.waitForFunction(() => document.querySelector('button[data-usd-l1-tab="four_markets"]')?.getAttribute("aria-selected") === "true");
    assert.equal(await view.locator('[data-usd-l1-test-body="four_markets"]').count(), 1, "the Four markets tab must open its own body");
    await view.locator('button[data-usd-l1-session-filter="scored"]').click();
    await view.waitForFunction(() => document.querySelector('button[data-usd-l1-session-filter="scored"]')?.classList.contains("active"));
    assert.ok(await view.locator(".usd-l1-session-row").count() > 0, "the Scored only filter must leave sessions listed");
    await context.close();

    const second = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const fromBox = await second.newPage();
    await fromBox.goto(`${base}/backtesting.html`, { waitUntil: "load" });
    const library = fromBox.locator('details:has(a[href="usd-layer1-backtester.html"])').first();
    await library.evaluate(node => { node.open = true; });
    await library.locator('a[href="usd-layer1-backtester.html"]').first().click();
    await fromBox.waitForURL(/\/usd-layer1-backtester\.html$/);
    await panelReady(fromBox);
    assert.equal(await fromBox.locator(".side-rail").count(), 1, "the backtesting.html entry must land on the guarded page");
    assert.equal(await fromBox.locator(".topbar .topbar-link").count(), 0, "the page reached from backtesting.html must use the compact bar");
    await second.close();
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

// Below 901px the disclosure is one more chip in the strip. Opened, its eight links become a panel over the
// page, and every one of them has to sit inside the window whichever way the strip is scrolled. This measures
// the panel in place: a containment property on an ancestor would trap the panel inside the scrolled strip, and
// the last link would land off screen - which is exactly what the strip did before the panel was positioned
// against the window.
async function measureDocumentation(page, expectedLinks) {
  return page.evaluate(count => {
    const details = document.querySelector(".side-rail nav details.side-rail-details");
    if (!details) return null;
    const body = details.querySelector(".side-rail-details-body");
    const links = body ? Array.from(body.querySelectorAll(".side-rail-link")) : [];
    details.open = true;
    const rect = node => {
      const box = node.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    const inside = box => box.width > 0 && box.height > 0 && box.top >= -0.5 && box.left >= -0.5 && box.bottom <= window.innerHeight + 0.5 && box.right <= window.innerWidth + 0.5;
    const measured = {
      position: getComputedStyle(body).position,
      body: rect(body),
      links: links.map(rect),
      allInside: links.length === count && links.every(link => inside(rect(link))),
      overflow: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0) - window.innerWidth,
    };
    details.open = false;
    return measured;
  }, expectedLinks);
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
        // Put the block's styling back for the next width: a disabled style element survives a same-page reload
        // in this browser session, and the next iteration has to measure the block, not the page without it.
        await view.evaluate(() => {
          const style = document.getElementById("shared-nav-css");
          if (style) style.disabled = false;
        });
        const where = `${page.file} at ${width}px`;
        assert.equal(railVisible, true, `${where} must show its rail`);
        assert.equal(withBlock.overlaps, 0, `${where} must not lay the rail over a table`);
        const ceiling = PUBLISHED_OVERFLOW[page.file] || 1;
        assert.ok(withBlock.overflow <= ceiling, `${where} must not scroll sideways past the ${ceiling}px it already did: ${withBlock.overflow}px`);
        assert.ok(withBlock.overflow <= Math.max(1, withoutBlock.overflow), `${where} must not be widened by the block: ${withBlock.overflow}px against ${withoutBlock.overflow}px without it`);
        // In the narrow strip the opened disclosure is an overlay, not a part of the strip: its links must not
        // be clipped by the strip's horizontal scroll, and opening it must not widen the page either.
        if (width <= 900) {
          const opened = await measureDocumentation(view, DOC_HREFS.length);
          assert.ok(opened, `${where} must carry the Old documentation disclosure`);
          assert.equal(opened.position, "fixed", `${where} must open the disclosure against the window, not inside the strip`);
          assert.equal(opened.allInside, true, `${where} must keep all ${DOC_HREFS.length} disclosed links in the window: ${JSON.stringify(opened)}`);
          assert.ok(opened.overflow <= ceiling, `${where} must not be widened by the opened disclosure: ${opened.overflow}px`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
