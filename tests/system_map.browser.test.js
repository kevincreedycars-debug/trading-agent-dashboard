// Browser guard for the Architecture tab's offline eight-asset map, run against the real page and the real scripts.
//
// The map is drawn from `lib/system-map.js` and has to stay self-contained: no fetch, no image request, no external
// stylesheet. The first case opens the dashboard with every non-local request aborted and then follows the Overview
// link, so a map that reaches outside the origin fails there. It also holds the embed contract - the host supplies the
// heading, so the map's own hero and hologram stay out of it - and the focus behaviour: one pressed chip, a changed join
// line, and Escape back to the uncommitted view.
//
// The second case is the layout guard. It walks the widths the page's own tests use, plus 1101px, the first pixel above
// the point where the board starts to scroll, and 1280px, where the stage column is wide enough for the long title. At
// every width no node title, node sub, stage title or stage sub may overflow its box, and the row labels must stay inside
// the scroller at scrollLeft 0, 18, 80 and 240. That last assertion is the one that fails if the left gutter moves back
// from the non-scrolling scroller to the scrollable grid, which is what used to cut the mobile row label off.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const mapScript = fs.readFileSync(path.join(repoRoot, "lib", "system-map.js"), "utf8");
const mapStyles = fs.readFileSync(path.join(repoRoot, "system-map.css"), "utf8");
const indexPage = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const hostScript = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");

// Chromium refuses a set of ports even on loopback (4045 among them). An OS-assigned ephemeral port can land on
// one, which made this guard fail before the page was ever read. Bind until the port is one the browser will open.
const browserBlockedPorts = new Set([2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080, 28017]);

async function listenForBrowser(server) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve, reject) => {
      const onError = error => {
        server.off("error", onError);
        reject(error);
      };
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", onError);
        resolve();
      });
    });
    if (!browserBlockedPorts.has(server.address().port)) return;
    await new Promise(resolve => server.close(resolve));
  }
  throw new Error("could not bind a port Chromium will open");
}


function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(fs.readFileSync(filePath));
  });
  await listenForBrowser(server);
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  };
}

async function openDashboard(page, origin, query) {
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
    return route.abort();
  });
  await page.goto(`${origin}/index.html${query || ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".overview-map-link", { timeout: 20000 });
}

test("the overview link opens an embedded map that asks for nothing outside this origin", async () => {
  // Static half of the same rule: the module and its stylesheet carry no request of their own.
  assert.doesNotMatch(mapScript, /\bfetch\s*\(|XMLHttpRequest|sendBeacon/, "the map must not call the network");
  assert.doesNotMatch(mapStyles, /@import|url\s*\(/, "the map stylesheet must not load a font, image or frame");
  assert.match(indexPage, /system-map\.css\?v=20261115-factory-3d/, "the page must request the current map stylesheet");
  assert.match(hostScript, /lib\/system-map\.js\?v=20261115-factory-3d/, "the host must request the current map script");
  assert.match(mapScript, /lib\/vendor\/three\.min\.js/, "the factory loads the vendored three.js bundle, not a CDN");
  assert.match(mapScript, /registered 25 factors/, "the map must record that the programme registered 25 factors");
  assert.doesNotMatch(mapScript, /25-factor challenger/, "no label may call the implemented challenger a 25-factor model");
  assert.match(mapScript, /no replay uses all 25/, "the map must not imply a replay used all 25 factors");

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = [];
    const external = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(server.origin) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      external.push(url);
      return route.abort();
    });
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".overview-map-link", { timeout: 20000 });

    assert.equal(await page.locator("[data-map-board]").count(), 0, "the map is not built until the Architecture tab is opened");
    assert.equal(
      await page.evaluate(() => document.getElementById("architectureView").classList.contains("active-view")),
      false,
      "the dashboard starts on Overview"
    );

    await page.click(".overview-map-link");
    // The factory is the default view: the flat board is in the DOM but hidden, so the guard waits on the scene.
    await page.waitForSelector("[data-factory-scene]", { state: "attached", timeout: 20000 });
    // The factory is the default view, so the shape is read once the scene reports that it is ready.
    await page.waitForSelector('[data-factory-scene][data-scene-state="ready"]', { timeout: 30000 });

    const shape = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        hash: location.hash,
        tab: document.querySelector('.tab-button[data-tab="architecture"]').classList.contains("active"),
        embed: root.dataset.embed,
        mode: root.dataset.mapMode,
        hero: root.querySelectorAll(".map-hero").length,
        canvases: root.querySelectorAll("canvas").length,
        hologram: root.querySelectorAll(".map-hologram").length,
        lanes: root.querySelectorAll(".map-lane").length,
        nodes: root.querySelectorAll(".map-node").length,
        stages: root.querySelectorAll(".map-stage-head").length,
        assets: root.querySelectorAll("[data-map-asset]").length,
        pairs: root.querySelectorAll("[data-map-pair]").length,
        rows: [...root.querySelectorAll(".map-row-code")].map(el => el.textContent.trim()),
        join: root.querySelector("[data-map-join-state]").textContent.trim(),
        readout: root.querySelector("[data-map-readout] h2").textContent.trim(),
        tiers: [...root.querySelectorAll("[data-map-asset]")].map(button => [button.dataset.mapAsset, button.querySelector(".map-chip-sub").textContent.trim()]),
        planned: [...root.querySelectorAll("[data-map-pair] .map-chip-plan")].map(tag => tag.closest("[data-map-pair]").dataset.mapPair),
        scripts: [...document.scripts].filter(script => /system-map\.js/.test(script.src)).length
      };
    });

    assert.equal(shape.hash, "#architecture");
    assert.equal(shape.tab, true);
    assert.equal(shape.embed, "true");
    assert.equal(shape.hero, 0, "the host supplies the heading, so the map's own hero stays out");
    assert.equal(shape.mode, "factory", "the factory is the default Architecture view");
    assert.equal(shape.hologram, 0, "the embedded map has no hologram canvas");
    assert.equal(shape.canvases, 1, "the factory mounts one canvas and nothing else draws into the map");
    assert.equal(shape.lanes, 8);
    assert.equal(shape.nodes, 48);
    assert.equal(shape.stages, 6);
    assert.equal(shape.assets, 8);
    assert.equal(shape.pairs, 7);
    assert.deepEqual(shape.rows, ["USD", "EUR", "GOLD", "SILVER", "NQ", "BTC", "WTI", "GBP"]);
    assert.equal(shape.join, "Eight calls in · one pair out");
    assert.equal(shape.readout, "One join, eight inputs");
    assert.deepEqual(shape.tiers, [
      ["USD", "established"],
      ["EUR", "established"],
      ["GOLD", "established"],
      ["SILVER", "onboarding"],
      ["NQ", "established"],
      ["BTC", "established"],
      ["WTI", "onboarding"],
      ["GBP", "onboarding"]
    ], "five established engines and three onboarding engines stay distinguishable");
    assert.deepEqual(shape.planned, ["XAG_USD", "WTI_USD", "GBP_USD"], "the three planned pairings alone carry the planned tag");
    assert.equal(shape.scripts, 1, "the module is injected once");
    assert.deepEqual(
      external.filter(url => /system-map/i.test(url)),
      [],
      "opening the map asks for nothing outside the origin"
    );


    await page.click('[data-map-asset="USD"]');
    const usdCopy = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const usd = root.querySelector('.map-lane[data-asset="USD"]');
      return {
        sub: usd.querySelectorAll(".map-node-sub")[2].textContent.trim(),
        note: root.querySelector("[data-map-readout] .map-readout-note").textContent.trim()
      };
    });
    assert.equal(usdCopy.sub, "Implemented challenger", "the replay names the implemented challenger, not a 25-factor model");
    assert.match(usdCopy.note, /registered 25 factors/, "the note records that the programme registered 25 factors");
    assert.match(usdCopy.note, /no replay uses all 25/, "the note must not imply a replay used all 25 factors");

    await page.click('[data-map-asset="EUR"]');
    const focused = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        focus: root.dataset.focus,
        pressed: root.querySelector('[data-map-asset="EUR"]').getAttribute("aria-pressed"),
        join: root.querySelector("[data-map-join-state]").textContent.trim(),
        lanes: [...root.querySelectorAll(".map-lane.is-focus")].map(lane => lane.dataset.asset)
      };
    });
    assert.equal(focused.focus, "asset");
    assert.equal(focused.pressed, "true");
    assert.equal(focused.join, "EUR call in · Layer 2 reads all eight");
    assert.deepEqual(focused.lanes, ["EUR"]);

    await page.click('[data-map-pair="EUR_USD"]');
    const paired = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        focus: root.dataset.focus,
        pair: root.querySelector('[data-map-pair="EUR_USD"]').getAttribute("aria-pressed"),
        join: root.querySelector("[data-map-join-state]").textContent.trim()
      };
    });
    assert.equal(paired.focus, "pair");
    assert.equal(paired.pair, "true");
    assert.equal(paired.join, "EUR/USD · target + USD");

    await page.click('[data-map-pair="XAG_USD"]');
    const plannedReadout = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        badges: [...root.querySelectorAll("[data-map-readout] .map-tier")].map(el => el.textContent.trim()),
        join: root.querySelector("[data-map-join-state]").textContent.trim()
      };
    });
    assert.ok(plannedReadout.badges.includes("Planned pairing"), "an onboarding target's pair is labelled planned");
    assert.equal(plannedReadout.join, "XAG/USD · target + USD");

    await page.keyboard.press("Escape");
    const reset = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        focus: root.dataset.focus,
        pressed: [...root.querySelectorAll("[data-map-asset], [data-map-pair], [data-map-lane]")]
          .filter(button => button.getAttribute("aria-pressed") === "true").length,
        join: root.querySelector("[data-map-join-state]").textContent.trim()
      };
    });
    assert.equal(reset.focus, "all");
    assert.equal(reset.pressed, 0);
    assert.equal(reset.join, "Eight calls in · one pair out");
    assert.deepEqual(pageErrors, [], "the page must not throw while the map opens");
  } finally {
    await browser.close();
    await server.close();
  }
});


// The widths the page's own guards use, plus the two sides of the node-label breakpoint and the first pixel above the
// board's scroll floor. 1101px is the case the old fixed icon broke: the board scrolled but the card did not.
const WIDTHS = [1440, 1280, 1101, 1024, 900, 768, 390];

test("the map keeps every label whole and its row labels in view from wide to phone", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    // The flat board is the alternative view, so its layout guard opens the page pinned to it.
    await openDashboard(page, server.origin, "?map=flat");
    await page.goto(`${server.origin}/index.html?map=flat#architecture`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-system-map] .map-lane", { timeout: 20000 });
    await page.waitForTimeout(350);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(220);
      const measured = await page.evaluate(() => {
        const map = document.querySelector("[data-system-map]");
        const scroller = map.querySelector(".map-scroller");
        const clipped = [];
        for (const node of map.querySelectorAll(".map-node-title, .map-node-sub, .map-stage-title, .map-stage-sub")) {
          if (node.scrollWidth > node.clientWidth + 1) {
            clipped.push(`${node.className}: ${node.textContent.trim()} ${node.scrollWidth}/${node.clientWidth}`);
          }
        }
        const label = map.querySelector(".map-row-label");
        const labelRect = label.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        return {
          sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          clipped,
          nodes: map.querySelectorAll(".map-node").length,
          scrollable: scroller.scrollWidth - scroller.clientWidth > 2,
          tabindex: scroller.getAttribute("tabindex"),
          role: scroller.getAttribute("role"),
          label: { left: labelRect.left, right: labelRect.right, height: labelRect.height },
          scroller: { left: scrollerRect.left, right: scrollerRect.right }
        };
      });

      assert.equal(measured.sideways, false, `at ${width}px the page must not scroll sideways`);
      assert.deepEqual(measured.clipped, [], `at ${width}px every node and stage label must fit its box`);
      assert.equal(measured.nodes, 48, `at ${width}px all forty-eight nodes stand`);
      assert.equal(
        measured.tabindex === "0",
        measured.scrollable,
        `at ${width}px the board is focusable exactly when it scrolls`
      );
      assert.equal(measured.role === "region", measured.scrollable, `at ${width}px the board is a region exactly when it scrolls`);
      assert.ok(measured.label.left >= measured.scroller.left - 0.5, `at ${width}px the row label starts inside the board`);
      assert.ok(measured.label.right <= measured.scroller.right + 0.5, `at ${width}px the row label ends inside the board`);
      assert.ok(measured.label.height >= 44, `at ${width}px the row label is a full-height tap target`);
    }


    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(220);
    const mobile = await page.evaluate(() => {
      const map = document.querySelector("[data-system-map]");
      const scroller = map.querySelector(".map-scroller");
      const label = map.querySelector(".map-row-label");
      const scrollerRect = scroller.getBoundingClientRect();
      const positions = [0, 18, 80, 240].map(left => {
        scroller.scrollLeft = left;
        const rect = label.getBoundingClientRect();
        return { left, rectLeft: rect.left, rectRight: rect.right, width: rect.width, height: rect.height };
      });
      const pad = {
        scroller: getComputedStyle(scroller).paddingLeft,
        grid: getComputedStyle(map.querySelector(".map-board-grid")).paddingLeft
      };
      scroller.scrollLeft = 240;
      label.scrollIntoView({ block: "center" });
      scroller.scrollLeft = 240;
      const rect = label.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        positions,
        scroller: { left: scrollerRect.left, right: scrollerRect.right, width: scrollerRect.width },
        pad,
        hit: Boolean(hit && hit.closest("[data-map-lane]")),
        labelText: label.textContent.trim().replace(/\s+/g, " ")
      };
    });

    for (const position of mobile.positions) {
      assert.ok(
        position.rectLeft >= mobile.scroller.left - 0.5 && position.rectRight <= mobile.scroller.right + 0.5,
        `at scrollLeft ${position.left}px the row label must stay fully visible`
      );
      assert.equal(position.width, 76, `at scrollLeft ${position.left}px the label keeps its width`);
      assert.ok(position.height >= 44, `at scrollLeft ${position.left}px the label keeps its tap height`);
    }
    assert.equal(mobile.pad.scroller, "18px", "the left gutter belongs to the non-scrolling scroller");
    assert.equal(mobile.pad.grid, "0px", "the scrollable grid carries no left padding to clip the label");
    assert.equal(mobile.hit, true, "the row label is the hit target at its centre");
    assert.equal(mobile.labelText, "USD US dollar");

    await page.evaluate(() => {
      const scroller = document.querySelector(".map-scroller");
      scroller.scrollLeft = 0;
      scroller.focus();
    });
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const keyboard = await page.evaluate(() => {
      const scroller = document.querySelector(".map-scroller");
      return {
        left: scroller.scrollLeft,
        outline: getComputedStyle(scroller).outlineStyle,
        focused: document.activeElement === scroller
      };
    });
    assert.ok(keyboard.left > 0, "a focused board scrolls with an arrow key");
    assert.equal(keyboard.focused, true);
    assert.equal(keyboard.outline, "solid", "the focused board draws its focus ring");
  } finally {
    await browser.close();
    await server.close();
  }
});
