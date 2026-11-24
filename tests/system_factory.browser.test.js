// Browser guard for the Architecture tab's interactive factory, run against the real page and the real scripts.
//
// The factory is drawn from `lib/system-factory.js` with the vendored `lib/vendor/three.min.js`, from a local
// model. This guard holds four contracts:
//   1. the scene mounts at the normal entry point and every station answers the same five questions, with every
//      evidence link resolving to a committed file;
//   2. the USD research journey runs from the inputs to the factor register, a documented factor and the four
//      replay tests;
//   3. the EUR/USD journey runs from two independent calls through the Layer 2 join into both live lanes and the
//      conditional payout;
//   4. the flat board is a real fallback: with WebGL reporting itself absent the page falls back on its own, and
//      with reduced motion the scene draws a still frame instead of an animation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const factoryScript = fs.readFileSync(path.join(repoRoot, "lib", "system-factory.js"), "utf8");
const mapScript = fs.readFileSync(path.join(repoRoot, "lib", "system-map.js"), "utf8");
const usdRun = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "usd-layer1-backtester", "run-v1.json"), "utf8"));

const QUESTIONS = [
  "1. What does this station do?",
  "2. What inputs does it receive, and where do they come from?",
  "3. Which tools, workflows or code implement it?",
  "4. Which documents and decision rules govern it?",
  "5. What does it produce, and which station consumes that output?"
];

const browserBlockedPorts = new Set([2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080, 28017]);

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

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

async function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(fs.readFileSync(filePath));
  });
  await listenForBrowser(server);
  server.origin = `http://127.0.0.1:${server.address().port}`;
  return server;
}

async function openFactory(context, origin) {
  const page = await context.newPage();
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
    return route.abort();
  });
  await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".overview-map-link", { timeout: 30000 });
  await page.click(".overview-map-link");
  await page.waitForSelector('[data-factory-scene][data-scene-state="ready"]', { timeout: 30000 });
  return page;
}

async function statusesOf(page, links) {
  return page.evaluate(async hrefs => {
    const out = {};
    for (const href of hrefs) {
      try {
        out[href] = (await fetch(href)).status;
      } catch (error) {
        out[href] = "error";
      }
    }
    return out;
  }, links);
}

test("the factory mounts at the entry point and every station answers the five questions", async () => {
  assert.match(factoryScript, /"use strict"/);
  assert.doesNotMatch(factoryScript, /\bfetch\s*\(|XMLHttpRequest|sendBeacon/, "the factory must not call the network");
  assert.match(factoryScript, /REWARD_R_MULTIPLE = 5/, "the factory quotes the full-lane geometry from the strategy");
  assert.match(factoryScript, /HALF_LANE_R_MULTIPLE = 3/, "the factory quotes the half-lane geometry from the strategy");
  assert.match(mapScript, /lib\/system-factory\.js\?v=/, "the map loads the factory module by a versioned path");

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const page = await openFactory(context, server.origin);
    page.on("pageerror", error => errors.push(error.message));

    const shape = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const scene = root.querySelector("[data-factory-scene]");
      return {
        mode: root.dataset.mapMode,
        state: scene.dataset.sceneState,
        canvases: root.querySelectorAll("canvas").length,
        stations: root.querySelectorAll("[data-factory-station]").length,
        labels: root.querySelectorAll(".factory-label").length,
        legend: [...root.querySelectorAll(".factory-legend li")].map(li => li.textContent.trim()),
        illustrative: root.querySelector(".factory-illustrative").textContent.replace(/\s+/g, " ").trim(),
        hud: [...root.querySelectorAll(".factory-hud button")].map(button => button.textContent.trim()),
        scene: root.systemFactory.state(),
        inspector: root.querySelector(".factory-inspector-card").getAttribute("data-inspector-for")
      };
    });

    assert.equal(shape.mode, "factory", "the factory is the default Architecture view");
    assert.equal(shape.state, "ready");
    assert.equal(shape.canvases, 1, "one canvas: the scene, and no hologram in the embedded map");
    assert.equal(shape.stations, 50, "eight lanes of four stations, seven pair sockets, the shared stations and the floor");
    assert.equal(shape.labels, 50 + shape.scene.dependencies, "every upper station and every lower dependency node carries a label");
    assert.deepEqual(shape.legend, ["Incoming feeds", "Research", "Replay", "Gate", "L1 cores", "L2 join", "Execution", "Payout"]);
    assert.match(shape.illustrative, /Illustrative flow · no live data/, "the flow is labelled as illustrative");
    assert.deepEqual(shape.hud, ["Reset view", "+", "−", "Pause flow"]);
    assert.equal(shape.scene.connections, 42, "32 lane links, the execution splits, the blind chain, two hosting links and the payout links");
    assert.equal(shape.scene.hosting, 2, "the blind trader and the cTrader robot are hosted, not fed, by the terminal");
    assert.equal(shape.scene.reduced, false);
    assert.equal(shape.inspector, "", "the factory opens with the inspector empty");

    // A station in the 3D scene, selected through the index the scene publishes for keyboards and tests.
    await page.click('[data-factory-station="usd.core"]');
    await page.waitForSelector('[data-inspector-for="usd.core"]');
    const card = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const el = root.querySelector(".factory-inspector-card");
      return {
        title: el.querySelector("h3").textContent.trim(),
        sub: el.querySelector(".factory-inspector-sub").textContent.trim(),
        questions: [...el.querySelectorAll(".factory-answers h4")].map(h => h.textContent.trim()),
        rules: [...el.querySelectorAll(".factory-rules li")].map(li => li.textContent.trim()),
        next: [...el.querySelectorAll(".factory-answer-note")].map(p => p.textContent.replace(/\s+/g, " ").trim()),
        links: [...el.querySelectorAll("a[data-evidence-path]")].map(a => a.getAttribute("href")),
        selection: root.systemFactory.state().selection,
        boardFocus: root.dataset.focus,
        activeLabel: root.querySelector('[data-factory-label="usd.core"]').classList.contains("is-active"),
        otherActive: root.querySelector('[data-factory-label="eur.core"]').classList.contains("is-active")
      };
    });

    assert.equal(card.title, "USD L1 core");
    assert.match(card.sub, /independent engine · Established/);
    assert.deepEqual(card.questions, QUESTIONS, "every station answers the same five questions, in order");
    assert.match(card.rules.join(" "), /Ten weighted factors/, "the governing rule comes from the model the board shows");
    assert.match(card.next.join(" "), /Next: The Layer 2 junction/, "the inspector names the station that reads the output");
    assert.equal(card.selection.type, "station");
    assert.equal(card.selection.id, "usd.core");
    assert.equal(card.boardFocus, "asset", "the flat board follows the scene's selection");
    assert.equal(card.activeLabel, true, "the selected station's label is painted as the active route");
    assert.equal(card.otherActive, false, "no other lane is painted as active");

    assert.ok(card.links.length >= 5, "the inspector links the workflow, the logic document and the register");
    assert.ok(card.links.includes("exports/usd_layer1_agent.json"), "the engine export is the specific artefact, not a folder");
    assert.ok(card.links.includes("docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md"));
    const statuses = await statusesOf(page, card.links);
    for (const [href, status] of Object.entries(statuses)) {
      assert.equal(status, 200, `${href} must resolve from the preview root`);
    }

    // Escape clears the selection from the scene.
    await page.evaluate(() => document.querySelector("[data-factory-scene]").focus());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().selection),
      null,
      "Escape clears the scene selection"
    );
    assert.deepEqual(errors, [], "the scene must not throw while it mounts and answers");

    // The scene itself is the pointer target: project a station, click it, and the inspector opens for it.
    const projected = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.project("gold.core"));
    assert.equal(projected.visible, true);
    await page.mouse.click(projected.x, projected.y);
    await page.waitForSelector('[data-inspector-for="gold.core"]', { timeout: 5000 });
    assert.equal(
      await page.evaluate(() => document.querySelector('[data-inspector-for="gold.core"] h3').textContent.trim()),
      "GOLD L1 core",
      "clicking the mesh in the scene opens the same inspector the index does"
    );

    // Dragging orbits the camera; the target does not move. Wait for the focus tween to land first.
    await page.waitForTimeout(900);
    const before = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().view);
    const stage = await page.evaluate(() => {
      const box = document.querySelector("[data-factory-canvas]").getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await page.mouse.move(stage.x, stage.y);
    await page.mouse.down();
    await page.mouse.move(stage.x + 90, stage.y + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().view);
    assert.notEqual(after.theta, before.theta, "dragging orbits the camera");
    assert.deepEqual(after.target, before.target, "orbiting leaves the look-at point where it was");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the lower floor names its evidence and never promotes a planned path to live", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await openFactory(context, server.origin);

    const shell = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const floorbar = root.querySelector(".factory-floorbar");
      return {
        floorButtons: [...floorbar.querySelectorAll("[data-factory-floor]")].map(button => button.textContent.trim()),
        pressed: [...floorbar.querySelectorAll("[data-factory-floor]")].map(button => button.getAttribute("aria-pressed")),
        groups: [...root.querySelectorAll(".factory-dep-group-label")].map(label => label.textContent.trim()),
        chips: root.querySelectorAll("[data-factory-dependency]").length,
        state: root.systemFactory.state(),
        depIndexLabel: root.querySelector(".factory-dep-index .factory-index-label").textContent.replace(/\s+/g, " ").trim()
      };
    });

    assert.deepEqual(shell.floorButtons, ["Both", "Upper", "Lower"], "the floor switch offers both floors and each one alone");
    assert.deepEqual(shell.pressed, ["true", "false", "false"], "the composed view is the opening state");
    assert.equal(shell.chips, shell.state.dependencies, "every lower-floor node is reachable from the index");
    assert.equal(shell.groups.length, 6, "the index groups the lower floor by what a node supplies");
    assert.match(shell.depIndexLabel, /Lower floor · inputs, rules, replays and workflows/, "the lower index says what it holds");
    assert.equal(shell.state.floor, "whole", "the factory opens with both floors in view");

    await page.click('[data-factory-floor="lower"]');
    await page.waitForFunction(() => {
      const labels = [...document.querySelectorAll(".factory-label.is-dependency")];
      return labels.some(label => getComputedStyle(label).display !== "none");
    });
    const lower = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const stage = root.querySelector(".factory-stage").getBoundingClientRect();
      const dependencyLabels = [...root.querySelectorAll(".factory-label.is-dependency")]
        .filter(label => getComputedStyle(label).display !== "none");
      return {
        state: root.systemFactory.state(),
        pressed: [...root.querySelectorAll(".factory-floorbar [data-factory-floor]")].map(button => button.getAttribute("aria-pressed")),
        visibleStations: [...root.querySelectorAll(".factory-label:not(.is-dependency)")]
          .filter(label => getComputedStyle(label).display !== "none").length,
        visibleDependencies: dependencyLabels.length,
        clipped: dependencyLabels
          .filter(label => {
            const box = label.getBoundingClientRect();
            return box.left < stage.left || box.right > stage.right || box.top < stage.top || box.bottom > stage.bottom;
          })
          .map(label => label.innerText.replace(/\s+/g, " ").trim()),
        dependencyText: dependencyLabels.map(label => label.innerText.replace(/\s+/g, " ").trim())
      };
    });
    assert.equal(lower.state.floor, "lower");
    assert.deepEqual(lower.pressed, ["false", "false", "true"]);
    assert.equal(lower.visibleStations, 0, "the upper station labels leave the lower-floor view");
    assert.ok(lower.visibleDependencies > 0, "the lower floor names its own nodes");
    assert.deepEqual(lower.clipped, [], "no lower-floor label is cut by the stage edge");
    assert.ok(
      lower.dependencyText.some(text => /(Runs today|Replay|Documented|Research|Planned)$/i.test(text)),
      "a lower-floor label carries its evidence in words, not only in colour"
    );
    assert.ok(
      lower.dependencyText.some(text => /^[A-Z]{3}\s/i.test(text)),
      "a lower-floor label names the asset it belongs to"
    );

    // A direct dependency opens on the lower floor and carries its evidence stamp.
    await page.click('[data-factory-dependency="dep.usd.tests"]');
    await page.waitForSelector('[data-inspector-for="dep.usd.tests"]');
    const tests = await page.evaluate(() => {
      const card = document.querySelector('[data-inspector-for="dep.usd.tests"]');
      return {
        state: document.querySelector("[data-system-map]").systemFactory.state(),
        badge: card.querySelector(".factory-evidence-badge").textContent.replace(/\s+/g, " ").trim(),
        badgeClass: card.querySelector(".factory-evidence-badge").className,
        facts: card.textContent.replace(/\s+/g, " "),
        heading: card.querySelector("h3").textContent.trim()
      };
    });
    assert.equal(tests.state.selection.type, "dependency");
    assert.equal(tests.heading, "Four USD tests");
    assert.match(tests.badge, /Replay method/);
    assert.match(tests.badgeClass, /is-replay/);
    assert.match(tests.facts, /4 separate/, "the four USD tests stay four, never blended into one score");
    assert.match(tests.facts, /DXY direction/, "the tests are named as tests, not a verdict");


    // A planned path is not a live one: the cTrader relay says so in the card itself.
    await page.click('[data-factory-dependency="dep.shared.relay"]');
    await page.waitForSelector('[data-inspector-for="dep.shared.relay"]');
    const relay = await page.evaluate(() => {
      const card = document.querySelector('[data-inspector-for="dep.shared.relay"]');
      return {
        badge: card.querySelector(".factory-evidence-badge").textContent.replace(/\s+/g, " ").trim(),
        text: card.textContent.replace(/\s+/g, " ")
      };
    });
    assert.match(relay.badge, /Not evidenced/);
    assert.match(relay.text, /FTMO 1 is the intended source: design intent, not a configured source/i);
    assert.match(relay.text, /Configured source: Not evidenced/);
    assert.match(relay.text, /Observed copying: Not evidenced/);
    assert.match(relay.text, /Connection Not evidenced/);

    // A station carries a way down to what it stands on, and the way back returns to that station.
    await page.click('[data-factory-floor="upper"]');
    await page.click('[data-factory-station="usd.core"]');
    await page.waitForSelector('[data-factory-dependencies-open="usd.core"]');
    await page.click('[data-factory-dependencies-open="usd.core"]');
    await page.waitForSelector("[data-factory-dependency-return]");
    const entered = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.equal(entered.floor, "lower");
    assert.equal(entered.dependencyOrigin, "usd.core");
    assert.equal(entered.selection.type, "dependency");
    await page.click("[data-factory-dependency-return]");
    const returned = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.equal(returned.floor, "upper");
    assert.equal(returned.selection.id, "usd.core", "the way back lands on the station that sent you down");
    assert.equal(returned.dependencyOrigin, null);

    // Keyboard focus follows the lower floor while it is the active floor.
    await page.click('[data-factory-floor="lower"]');
    await page.evaluate(() => document.querySelector("[data-factory-scene]").focus());
    await page.keyboard.press("ArrowRight");
    const active = await page.evaluate(() => document.querySelector("[data-factory-scene]").getAttribute("aria-activedescendant"));
    assert.match(active, /^factory-dependency-/, "arrow keys point at lower-floor chips, not upper stations");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().selection.type),
      "dependency"
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the USD journey reaches the factor register, one documented factor and the four replay tests", async () => {

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await openFactory(context, server.origin);
    await page.evaluate(() => {
      document.querySelector("[data-factory-journey-select]").value = "usd-research";
    });
    await page.click("[data-factory-journey-start]");
    await page.waitForSelector("[data-factory-journey-active]");

    const titles = [];
    const indices = [];
    for (let step = 0; step < 9; step += 1) {
      titles.push((await page.locator("[data-factory-journey-title]").textContent()).trim());
      indices.push((await page.locator("[data-factory-journey-index]").textContent()).trim());

      if (step === 2) {
        const copy = await page.evaluate(() => document.querySelector("[data-factory-journey-active]").textContent);
        assert.match(copy, /USD research desk/, "the red-team step stands at the research desk");
      }

      if (step === 4) {
        const register = await page.evaluate(() => {
          const panel = document.querySelector('[data-factory-panel="factors"]');
          return {
            rows: [...panel.querySelectorAll("[data-factory-factor]")].map(button => button.getAttribute("data-factory-factor")),
            codes: [...panel.querySelectorAll(".factory-choice-code")].map(el => el.textContent.trim()),
            blocked: panel.querySelectorAll(".factory-choice-tag.is-blocked").length
          };
        });
        assert.equal(register.rows.length, 10, "the register lists the ten factors the engine computes");
        assert.deepEqual(register.codes, ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"]);
        assert.equal(register.blocked, 2, "F7 and F8 stay marked as blocked research");

        await page.click('[data-factory-factor="live.f5-dxy-delta"]');
        const factor = await page.evaluate(() => {
          const detail = document.querySelector("[data-factory-factor-detail]");
          return {
            id: detail.getAttribute("data-factory-factor-detail"),
            text: detail.textContent.replace(/\s+/g, " "),
            links: [...detail.querySelectorAll("a[data-evidence-path]")].map(a => a.getAttribute("href"))
          };
        });
        assert.equal(factor.id, "live.f5-dxy-delta");
        assert.match(factor.text, /research ready · review pending · backtest not tested/, "the register's own status words carry through");
        assert.match(factor.text, /\+0\.15 per cent BULLISH/, "the documented rule's threshold is quoted");
        assert.match(factor.text, /14 coded \/ 6 rulebook/, "the two weight vectors stay distinguishable");
        assert.match(factor.text, /signals\.F5/, "the rule points at the engine code that applies it");
        assert.ok(factor.links.includes("docs/research/factors/usd/live-f5-dxy-delta/01-research-prompt.md"));
        assert.ok(factor.links.includes("docs/research/factors/usd/live-f5-dxy-delta/02-red-team-prompt.md"));
        assert.ok(factor.links.includes("docs/research/factors/usd/live-f5-dxy-delta/03-adjudication-prompt.md"));
        const statuses = await statusesOf(page, factor.links);
        for (const [href, status] of Object.entries(statuses)) {
          assert.equal(status, 200, `${href} must resolve from the preview root`);
        }
      }

      if (step === 5) {
        const tests = await page.evaluate(() => {
          const panel = document.querySelector('[data-factory-panel="tests"]');
          return {
            rows: [...panel.querySelectorAll("[data-factory-test]")].map(button => button.getAttribute("data-factory-test")),
            active: panel.getAttribute("data-factory-test-active"),
            note: panel.querySelector(".factory-panel-note").textContent.replace(/\s+/g, " ").trim()
          };
        });
        assert.deepEqual(tests.rows, ["dxy", "four-market", "full-5r", "half-3r"], "the four tests are exposed one at a time");
        assert.equal(tests.active, "dxy");
        assert.match(tests.note, /implemented challenger/, "the replay's comparison book is named");
        assert.match(tests.note, /No replay uses all 25 registered factors/);

        await page.click('[data-factory-test="full-5r"]');
        const full = await page.evaluate(() => document.querySelector("[data-factory-test-detail]").textContent.replace(/\s+/g, " "));
        assert.match(full, /Full-level L2L results at 5R/);
        assert.match(full, /REWARD_R_MULTIPLE/, "the full test names the geometry it applies");

        await page.click('[data-factory-test="half-3r"]');
        const half = await page.evaluate(() => document.querySelector("[data-factory-test-detail]").textContent.replace(/\s+/g, " "));
        assert.match(half, /Half-level L2L results at 3R/);
        assert.match(half, /HALF_LANE_R_MULTIPLE/, "the half test names its own geometry");
        assert.match(half, /not committed in this checkout/, "an undocumented result is called undocumented");
      }

      if (step < 8) await page.click("[data-factory-journey-next]");
      await page.waitForTimeout(120);
    }

    assert.deepEqual(titles, [
      "Start where the USD inputs arrive",
      "Research writes the brief for each factor",
      "Red team attacks the brief",
      "Adjudication settles the rule",
      "Open the factor register and pick a documented factor",
      "The replay chamber runs four separate tests",
      "The L1 core turns the book into one call",
      "Validation stands between a rule and a live engine",
      "Only Layer 2 is allowed to join two assets"
    ]);
    assert.equal(indices[0], "Step 1 of 9");
    assert.equal(indices[8], "Step 9 of 9");

    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(200);
    assert.equal(await page.locator("[data-factory-journey-active]").count(), 0, "Finish exits the journey");
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().journey),
      null
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the EUR/USD journey joins two independent calls and reaches both live lanes", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await openFactory(context, server.origin);
    await page.evaluate(() => {
      document.querySelector("[data-factory-journey-select]").value = "eurusd-execution";
    });
    await page.click("[data-factory-journey-start]");
    await page.waitForSelector("[data-factory-journey-active]");

    const routeNow = () => page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const active = id => root.querySelector(`[data-factory-label="${id}"]`).classList.contains("is-active");
      return {
        selection: root.systemFactory.state().selection,
        eur: active("eur.core"),
        usd: active("usd.core"),
        full: active("lane.full"),
        half: active("lane.half"),
        gold: active("gold.core"),
        conditional: root.systemFactory.state().conditional
      };
    });

    // Step 1: one lane, on its own.
    let route = await routeNow();
    assert.deepEqual(route.selection, { type: "asset", id: "EUR" });
    assert.equal(route.eur, true, "the EUR lane is the route");
    assert.equal(route.usd, false, "USD is not part of the EUR call");
    assert.equal(route.gold, false);

    // Step 2: the second lane, still without a join.
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    route = await routeNow();
    assert.deepEqual(route.selection, { type: "asset", id: "USD" });
    assert.equal(route.usd, true);
    assert.equal(route.eur, false);

    // Steps 3 and 4: the Layer 2 join and its output.
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    route = await routeNow();
    assert.deepEqual(route.selection, { type: "pair", id: "EUR_USD" });
    assert.equal(route.eur, true, "both legs are lit on the pair");
    assert.equal(route.usd, true, "both legs are lit on the pair");
    assert.equal(route.full, true, "the route continues into lane 1");
    assert.equal(route.half, true, "the route continues into lane 2");
    assert.equal(route.conditional, 3, "the payout links are the only conditional ones");

    const pair = await page.evaluate(() => {
      const panel = document.querySelector('[data-factory-panel="pair"]');
      return {
        code: panel.getAttribute("data-factory-pair-active"),
        text: panel.textContent.replace(/\s+/g, " "),
        buttons: [...panel.querySelectorAll("[data-factory-pair]")].map(button => button.getAttribute("data-factory-pair"))
      };
    });
    assert.equal(pair.code, "EUR_USD");
    assert.equal(pair.buttons.length, 7, "all seven pairings stay selectable at the junction");
    assert.match(pair.text, /Target leg\. EUR 24H call/);
    assert.match(pair.text, /Quote leg\. USD 24H call/);
    assert.match(pair.text, /lower of the two confidences/);
    assert.match(pair.text, /no trade/, "the no-trade branch is stated, not implied");

    // The VPS, then the two lanes.
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);

    const lanes = await page.evaluate(() => {
      const panel = document.querySelector('[data-factory-panel="lanes"]');
      return {
        buttons: [...panel.querySelectorAll("[data-factory-lane]")].map(button => button.getAttribute("data-factory-lane")),
        text: panel.textContent.replace(/\s+/g, " ")
      };
    });
    assert.deepEqual(lanes.buttons, ["lane.full", "lane.half", "lane.blind"]);
    assert.match(lanes.text, /REWARD_R_MULTIPLE = 5/);
    assert.match(lanes.text, /HALF_LANE_R_MULTIPLE = 3/);
    assert.match(lanes.text, /No directional call/, "the blind lane says it takes no directional call");

    await page.click('[data-factory-lane="lane.half"]');
    await page.waitForSelector('[data-inspector-for="lane.half"]');
    const half = await page.evaluate(() => document.querySelector('[data-inspector-for="lane.half"]').textContent.replace(/\s+/g, " "));
    assert.match(half, /HALF_LANE_R_MULTIPLE = 3/);
    assert.match(half, /three to one, not five/);

    await page.click('[data-factory-lane="lane.full"]');
    await page.waitForSelector('[data-inspector-for="lane.full"]');
    const full = await page.evaluate(() => document.querySelector('[data-inspector-for="lane.full"]').textContent.replace(/\s+/g, " "));
    assert.match(full, /REWARD_R_MULTIPLE = 5/);
    assert.match(full, /five times the risk/);

    // The payout and the bank marker. Two steps remain with no panel, so the stepper advances twice.
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    const payout = await page.evaluate(() => {
      const card = document.querySelector('[data-inspector-for="payout"]');
      return {
        title: card.querySelector("h3").textContent.trim(),
        status: card.getAttribute("data-inspector-status"),
        undocumented: [...card.querySelectorAll(".factory-undocumented li")].map(li => li.textContent.trim()).join(" ")
      };
    });
    assert.equal(payout.title, "Approved payout");
    assert.equal(payout.status, "conditional");
    assert.match(payout.undocumented, /No payout workflow, transfer rule, payout schedule or bank instruction/);

    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => document.querySelector('[data-inspector-for="bank"] h3').textContent.trim()),
      "Personal bank account"
    );
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-factory-journey-index]").textContent.trim()),
      "Step 9 of 9"
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the flat board is the fallback when the browser reports no WebGL", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (String(type).toLowerCase().indexOf("webgl") === 0) return null;
        return original.call(this, type, ...rest);
      };
    });
    const page = await context.newPage();
    await page.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(server.origin) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      return route.abort();
    });
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".overview-map-link", { timeout: 30000 });
    await page.click(".overview-map-link");
    await page.waitForSelector("[data-system-map] .map-lane", { timeout: 30000 });

    const fallback = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        webgl: root.dataset.mapWebgl,
        mode: root.dataset.mapMode,
        canvases: root.querySelectorAll("canvas").length,
        factoryHidden: root.querySelector("[data-map-factory]").hidden,
        factoryDisabled: root.querySelector('[data-map-mode-set="factory"]').disabled,
        flatPressed: root.querySelector('[data-map-mode-set="flat"]').getAttribute("aria-pressed"),
        note: root.querySelector("[data-map-mode-note]").textContent.trim(),
        lanes: root.querySelectorAll(".map-lane").length,
        readout: root.querySelector("[data-map-readout] h2").textContent.trim()
      };
    });

    assert.equal(fallback.webgl, "no");
    assert.equal(fallback.mode, "flat", "a browser without WebGL lands on the board, not on an empty frame");
    assert.equal(fallback.canvases, 0, "no canvas is created when the browser cannot draw one");
    assert.equal(fallback.factoryHidden, true);
    assert.equal(fallback.factoryDisabled, true, "the factory switch is disabled, not silently broken");
    assert.equal(fallback.flatPressed, "true");
    assert.match(fallback.note, /No WebGL in this browser/);
    assert.equal(fallback.lanes, 8);
    assert.equal(fallback.readout, "One join, eight inputs");

    await page.click('[data-map-asset="EUR"]');
    assert.deepEqual(
      await page.evaluate(() => [...document.querySelectorAll(".map-lane.is-focus")].map(lane => lane.dataset.asset)),
      ["EUR"],
      "the flat board keeps its own selection behaviour"
    );

    await page.evaluate(() => document.querySelector('[data-map-mode-set="factory"]').click());
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").dataset.mapMode),
      "flat",
      "a disabled switch cannot force a canvas the browser cannot draw"
    );

    // The flat board carries both drill-downs as plain HTML, with real buttons for the keyboard.
    await page.click('[data-map-asset="USD"]');
    await page.waitForSelector("[data-flat-library]");
    await page.click("[data-flat-library]");
    await page.waitForSelector("[data-flat-library-panel]");
    const flatLibrary = await page.evaluate(() => {
      const panel = document.querySelector("[data-flat-library-panel]");
      return {
        groups: [...panel.querySelectorAll("[data-flat-group]")].map(el => el.getAttribute("data-flat-group")),
        docs: panel.querySelectorAll("[data-flat-doc]").length,
        tests: [...panel.querySelectorAll("[data-flat-test]")].map(el => el.getAttribute("data-flat-test"))
      };
    });
    assert.deepEqual(flatLibrary.groups, ["research", "model", "inputs", "replay", "results"]);
    assert.ok(flatLibrary.docs >= 5);
    assert.deepEqual(flatLibrary.tests, ["dxy_direction", "four_markets", "l2l_full_5r", "l2l_half_3r"]);

    await page.click('[data-flat-group="results"]');
    await page.click('[data-flat-test="l2l_half_3r"]');
    const flatTest = await page.evaluate(() =>
      document.querySelector("[data-flat-library-panel]").textContent.replace(/\s+/g, " ")
    );
    assert.match(flatTest, /Market\./);
    assert.match(flatTest, /Result artefact\./);
    const flatLinks = await page.evaluate(() =>
      [...document.querySelectorAll("[data-flat-library-panel] a[data-evidence-path]")].map(a => a.getAttribute("href"))
    );
    assert.ok(flatLinks.includes("data/usd-layer1-backtester/run-v1.json"));
    assert.equal((await statusesOf(page, flatLinks.slice(0, 1)))[flatLinks[0]], 200);

    await page.click('[data-flat-flow="USD"]');
    await page.waitForSelector("[data-flat-flow-panel]");
    const flatFlow = await page.evaluate(() => {
      const panel = document.querySelector("[data-flat-flow-panel]");
      return {
        nodes: [...panel.querySelectorAll("[data-flat-node]")].map(el => el.getAttribute("data-flat-node")),
        text: panel.textContent.replace(/\s+/g, " ")
      };
    });
    assert.equal(flatFlow.nodes.length, 9);
    assert.equal(flatFlow.nodes[0], "when-executed-by-another-workflow");
    assert.match(flatFlow.text, /Direct invocation/);
    assert.match(flatFlow.text, /Storage hand-off/);
    await page.click('[data-flat-node="calculate-usd-conviction"]');
    const flatNode = await page.evaluate(() =>
      document.querySelector("[data-flat-flow-panel]").textContent.replace(/\s+/g, " ")
    );
    assert.match(flatNode, /Purpose\./);
    assert.match(flatNode, /Passes on\./);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("reduced motion draws a still frame, and the keyboard selects a station", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await openFactory(context, server.origin);

    const first = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    await page.waitForTimeout(600);
    const second = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());

    assert.equal(second.reduced, true, "the scene reads the preference");
    assert.deepEqual(second.packet, first.packet, "packets do not travel under reduced motion");
    assert.deepEqual(second.view, first.view, "the camera does not drift under reduced motion");

    // Arrow keys move a focus cursor through the flow order; Enter opens the station it points at.
    await page.evaluate(() => document.querySelector("[data-factory-scene]").focus());
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-factory-scene]").getAttribute("aria-activedescendant")),
      "factory-station-usd-research"
    );
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-inspector-for="usd.research"]');
    assert.equal(
      await page.evaluate(() => document.querySelector('[data-inspector-for="usd.research"] h3').textContent.trim()),
      "USD research desk"
    );
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().reduced),
      true
    );

    // Reset puts the camera back on the composed overview, immediately rather than by tween.
    await page.click("[data-factory-reset]");
    const reset = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.equal(Math.abs(reset.view.distance - reset.overviewDistance) < 0.5, true, "Reset returns to the overview");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("every evidence link the factory can show resolves and stays inside the published scope", async () => {
  // A localhost 200 only proves the development server can read a file. This guard holds the two properties the
  // release needs: each target is a committed file that GitHub Pages serves from the repository root, and none of
  // them is operator material - a host, an address, login references, a deployment step, a provider endpoint or a
  // credential reference. Those files stay in the repository; the map must not send a visitor into them.
  const WITHHELD = [
    /^docs\/live-trading\/(?:VPS_|LANE2_VPS|FTMO_SETUP_GUIDE|SECOND_LANE_HALF_L2L|STRATEGY_LIVE)/,
    /^exports\/[a-z0-9_]+_collector\.json$/
  ];

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    // Reduced motion keeps the camera still, so the walk is about the links rather than about 46 camera tweens.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await openFactory(context, server.origin);

    // One in-page walk: the index renders a button per station, each click re-renders the card synchronously, so the
    // whole evidence surface is collected without 46 round trips.
    const walk = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const buttons = [...root.querySelectorAll("[data-factory-station]")];
      const links = new Set();
      const missing = [];
      for (const button of buttons) {
        button.click();
        const id = button.getAttribute("data-factory-station");
        const card = root.querySelector(".factory-inspector-card");
        if (!card || card.getAttribute("data-inspector-for") !== id) {
          missing.push(id);
          continue;
        }
        for (const link of card.querySelectorAll("a[data-evidence-path]")) links.add(link.getAttribute("href"));
      }
      return { count: buttons.length, missing, links: [...links] };
    });
    assert.equal(walk.count, 50, "the walk covers every station in the index");
    assert.deepEqual(walk.missing, [], "every index button opens its own inspector card");
    const hrefs = new Set(walk.links);

    // The two journey panels carry their own links, including the route into the 25-factor register.
    await page.evaluate(() => {
      document.querySelector("[data-factory-journey-select]").value = "usd-research";
    });
    await page.click("[data-factory-journey-start]");
    await page.waitForSelector("[data-factory-journey-active]");
    for (let step = 0; step < 4; step += 1) {
      await page.click("[data-factory-journey-next]");
      await page.waitForTimeout(120);
    }
    const factorPanelLinks = await page.evaluate(() =>
      [...document.querySelectorAll('[data-factory-panel="factors"] a[data-evidence-path]')].map(a => a.getAttribute("href"))
    );
    factorPanelLinks.forEach(href => hrefs.add(href));
    await page.click("[data-factory-journey-next]");
    await page.waitForTimeout(150);
    const testPanelLinks = await page.evaluate(() =>
      [...document.querySelectorAll('[data-factory-panel="tests"] a[data-evidence-path]')].map(a => a.getAttribute("href"))
    );
    testPanelLinks.forEach(href => hrefs.add(href));

    // The two drill-downs carry their own evidence, so the walk opens one library and one flow and collects those too.
    await page.click("[data-factory-journey-stop]");
    await page.waitForTimeout(150);
    await page.click('[data-factory-station="usd.replay"]');
    await page.waitForSelector("[data-factory-library-open]");
    await page.click("[data-factory-library-open]");
    await page.waitForSelector('[data-library-asset="USD"]');
    const libraryLinks = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const links = new Set();
      const groups = [...root.querySelectorAll("[data-factory-library-group]")].map(button => button.dataset.factoryLibraryGroup);
      groups.forEach(groupId => {
        root.querySelector(`[data-factory-library-group="${groupId}"]`).click();
        root.querySelectorAll("[data-factory-library-detail] a[data-evidence-path]").forEach(a => links.add(a.getAttribute("href")));
      });
      root.querySelectorAll('[data-factory-library-tests] [data-factory-library-test]').forEach(button => {
        button.click();
        root.querySelectorAll('[data-factory-library-test-detail] a[data-evidence-path]').forEach(a => links.add(a.getAttribute("href")));
      });
      return [...links];
    });
    libraryLinks.forEach(href => hrefs.add(href));
    const libraryPanelLinks = await page.evaluate(() =>
      [...document.querySelectorAll(".factory-library a[data-evidence-path]")].map(a => a.getAttribute("href"))
    );
    libraryPanelLinks.forEach(href => hrefs.add(href));
    await page.click("[data-factory-drilldown-close]");

    await page.click('[data-factory-station="usd.core"]');
    await page.waitForSelector("[data-factory-flow-open]");
    await page.click("[data-factory-flow-open]");
    await page.waitForSelector('[data-factory-flow="USD"]');
    const flowLinks = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const links = new Set();
      root.querySelectorAll("[data-factory-flow-node]").forEach(button => {
        button.click();
        root.querySelectorAll("[data-factory-flow-detail] a[data-evidence-path]").forEach(a => links.add(a.getAttribute("href")));
      });
      root.querySelectorAll('.factory-flow a[data-evidence-path]').forEach(a => links.add(a.getAttribute("href")));
      return [...links];
    });
    flowLinks.forEach(href => hrefs.add(href));
    await page.click("[data-factory-drilldown-close]");

    assert.ok(hrefs.size >= 55, `the walk collects the whole evidence surface, saw ${hrefs.size}`);

    for (const href of hrefs) {
      assert.match(href, /^[a-z0-9_]+\/[^:\s]+$/, `${href} is a repository-relative path`);
      assert.match(href, /\.[a-z0-9]+$/, `${href} names a file, not a folder`);
      for (const pattern of WITHHELD) {
        assert.doesNotMatch(href, pattern, `${href} is operator material and must not be linked from the map`);
      }
      assert.ok(fs.existsSync(path.join(repoRoot, href)), `${href} is a committed path`);
    }

    // The withheld files are withheld, not deleted: the inspector says so in its copy.
    assert.ok(fs.existsSync(path.join(repoRoot, "exports", "usd_collector.json")));
    assert.ok(fs.existsSync(path.join(repoRoot, "docs", "live-trading", "VPS_ACCESS_HANDOFF.md")));

    // The research desk routes a visitor to the 25-factor register and to the summary that separates the factor sets.
    assert.ok(hrefs.has("data/research-library/catalog.json"), "the 25-factor catalogue is reachable");
    assert.ok(hrefs.has("docs/dashboard-design/usd-factor-sets.md"), "the factor-set summary is reachable");
    assert.ok(hrefs.has("docs/dashboard-design/execution-path-summary.md"), "the execution summary is reachable");
    assert.ok(hrefs.has("docs/dashboard-design/execution-floor.md"), "the execution floor summary is reachable");
    assert.ok(hrefs.has("docs/dashboard-design/replay-libraries.md"), "the library summary is reachable");
    assert.ok(hrefs.has("docs/dashboard-design/n8n-agent-flows.md"), "the flow summary is reachable");

    const statuses = await statusesOf(page, [...hrefs]);
    for (const [href, status] of Object.entries(statuses)) {
      assert.equal(status, 200, `${href} must resolve from the preview root`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the USD chamber opens its library beneath the camera, and one test reaches its document", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await openFactory(context, server.origin);

    await page.click('[data-factory-station="usd.replay"]');
    await page.waitForSelector("[data-factory-library-open]");
    await page.click("[data-factory-library-open]");
    await page.waitForSelector('[data-library-asset="USD"]');

    const opened = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const state = root.systemFactory.state();
      const hidden = id => root.querySelector(`[data-factory-label="${id}"]`).classList.contains("is-hidden");
      return {
        library: state.library,
        view: state.view,
        chamberHidden: hidden("usd.replay"),
        neighbourHidden: hidden("usd.core"),
        shelfLabels: [...root.querySelectorAll("[data-factory-library-label]")].map(el =>
          el.textContent.replace(/\s+/g, " ").trim()
        ),
        groups: [...root.querySelectorAll("[data-factory-library-group]")].map(el => ({
          id: el.getAttribute("data-factory-library-group"),
          text: el.textContent.replace(/\s+/g, " ").trim(),
          pressed: el.getAttribute("aria-pressed")
        })),
        docs: [...root.querySelectorAll("[data-factory-library-doc]")].map(el => ({
          title: el.querySelector(".factory-library-doc-title").textContent.trim(),
          tag: el.querySelector(".factory-library-tag").textContent.trim()
        })),
        closeLabel: root.querySelector("[data-factory-drilldown-close]").textContent.trim()
      };
    });

    assert.equal(opened.library.asset, "USD");
    assert.equal(opened.library.group, "research", "the library opens on research and adjudication");
    assert.ok(opened.view.target[1] < 0, "the camera's target is below the floor, under the chamber");
    assert.ok(opened.view.phi > Math.PI / 2, "the camera looks up at the shelf");
    assert.equal(opened.chamberHidden, false, "the parent chamber keeps its label above the shelf");
    assert.equal(opened.neighbourHidden, true, "the rest of the factory is cleared out of the way");
    assert.deepEqual(opened.shelfLabels, [
      "Research 7 docs",
      "Model 5 docs",
      "Inputs 4 docs",
      "Replay 5 docs",
      "Results 3 docs"
    ]);
    assert.deepEqual(opened.groups.map(group => group.id), ["research", "model", "inputs", "replay", "results"]);
    assert.equal(opened.groups[0].pressed, "true");
    assert.match(opened.groups[0].text, /7 documents/);
    assert.match(opened.groups[0].text, /a named gap/, "the research group says its gap out loud");
    assert.ok(opened.docs.length >= 5, "the open group lists its documents");
    assert.ok(opened.docs.some(doc => doc.tag === "used by the replay"), "the tag separates what the replay reads");
    assert.ok(opened.docs.some(doc => doc.tag === "related research"), "related research is tagged separately");
    assert.match(opened.closeLabel, /Return to the USD replay chamber/);

    // One document answers its own question, and its link resolves.
    const doc = await page.evaluate(() => {
      document.querySelector('[data-factory-library-doc="USD.research.catalogue"]').click();
      const detail = document.querySelector("[data-factory-library-detail]");
      return {
        text: detail.textContent.replace(/\s+/g, " ").trim(),
        href: detail.querySelector("a[data-evidence-path]").getAttribute("href")
      };
    });
    assert.match(doc.text, /Belongs to/);
    assert.match(doc.text, /USD · research programme \(Set B\)/);
    assert.match(doc.text, /Question it answers/);
    assert.match(doc.text, /Related research: the replay does not read it\./);
    assert.equal(doc.href, "data/research-library/catalog.json");
    assert.equal((await statusesOf(page, [doc.href]))[doc.href], 200);

    // The four tests are separate, and T3 carries its market, logic, data and artefact.
    await page.click('[data-factory-library-group="results"]');
    const tests = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const buttons = [...root.querySelectorAll("[data-factory-library-test]")].map(el => ({
        id: el.getAttribute("data-factory-library-test"),
        tag: el.querySelector(".factory-choice-tag").textContent.trim()
      }));
      root.querySelector('[data-factory-library-test="l2l_full_5r"]').click();
      const detail = root.querySelector('[data-factory-library-test-detail="l2l_full_5r"]');
      return {
        buttons,
        text: detail.textContent.replace(/\s+/g, " ").trim(),
        href: detail.querySelector("a[data-evidence-path]").getAttribute("href")
      };
    });
    assert.deepEqual(tests.buttons.map(item => item.id), [
      "dxy_direction",
      "four_markets",
      "l2l_full_5r",
      "l2l_half_3r"
    ]);
    assert.deepEqual(tests.buttons.map(item => item.tag), ["blocked", "scored", "blocked", "blocked"]);
    assert.match(tests.text, /Market\./);
    assert.match(tests.text, /Logic\./);
    assert.match(tests.text, /Required data\./);
    assert.match(tests.text, /Result artefact\./);
    assert.match(tests.text, /Blocked for all four markets/);
    assert.equal(tests.href, "data/usd-layer1-backtester/run-v1.json");
    assert.equal((await statusesOf(page, [tests.href]))[tests.href], 200);

    // T2 finishes the inspector: the historical four-market rows are visible, labelled and linked back to the artefact.
    await page.click('[data-factory-library-test="four_markets"]');
    const t2 = await page.evaluate(() => {
      const detail = document.querySelector('[data-factory-library-test-detail="four_markets"]');
      const results = detail.querySelector('[data-factory-test-results="historical"]');
      return {
        note: results.querySelector(".factory-test-results-note").textContent.replace(/\s+/g, " ").trim(),
        headers: [...results.querySelectorAll("thead th")].map(el => el.textContent.trim()),
        rows: [...results.querySelectorAll("tbody tr")].map(row => [...row.children].map(el => el.textContent.trim())),
        href: results.querySelector("a[data-evidence-path]").getAttribute("href")
      };
    });
    assert.match(t2.note, /Historical, not live/);
    // The date on the card is the artefact's own stamp, formatted the way the page formats it, so a rebuilt
    // artefact does not need this guard retyped and cannot silently keep describing an older build.
    const stampLabel = new Date(usdRun.generated_at)
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
    assert.match(t2.note, new RegExp(`generated ${stampLabel.replace(/ /g, "\\s")}`));
    assert.deepEqual(t2.headers, ["Model", "Market", "Accuracy", "Scored sessions"]);
    // The card renders the four markets that carry a scored denominator. Three configured markets report
    // zero scored sessions and a null accuracy, and a null must never be printed as 0.00%.
    const expectedRows = Object.values(usdRun.tests.four_markets.models.current.markets)
      .filter(market => Number.isFinite(market.overall.accuracy_pct))
      .map(market => [
        "Current model",
        market.label,
        `${market.overall.accuracy_pct.toFixed(2)}%`,
        String(market.overall.scored)
      ]);
    const rowsByMarket = rows =>
      Object.fromEntries(rows.map(([model, market, accuracy, scored]) => [market, { model, accuracy, scored }]));
    assert.deepEqual(
      rowsByMarket(t2.rows),
      rowsByMarket(expectedRows),
      "the rendered T2 rows match the committed artefact's scored markets"
    );
    assert.equal(t2.href, "data/usd-layer1-backtester/run-v1.json");
    assert.equal((await statusesOf(page, [t2.href]))[t2.href], 200);

    // Keyboard: a group button is a real button, so Enter changes the group.
    await page.focus('[data-factory-library-group="model"]');
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().library.group),
      "model",
      "Enter on a focused group opens it"
    );

    // Escape returns to the chamber, with the same station selected.
    await page.evaluate(() => document.querySelector("[data-factory-scene]").focus());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const closed = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      return {
        library: root.systemFactory.state().library,
        selection: root.systemFactory.state().selection,
        card: root.querySelector(".factory-inspector-card").getAttribute("data-inspector-for")
      };
    });
    assert.equal(closed.library, null);
    assert.deepEqual(closed.selection, { type: "station", id: "usd.replay" });
    assert.equal(closed.card, "usd.replay", "the chamber's own card is back");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("each Layer 1 core opens the checked-in n8n flow, and a node answers", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await openFactory(context, server.origin);

    await page.click('[data-factory-station="usd.core"]');
    await page.waitForSelector("[data-factory-flow-open]");
    await page.click("[data-factory-flow-open]");
    await page.waitForSelector('[data-factory-flow="USD"]');

    const flow = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const panel = root.querySelector('[data-factory-flow="USD"]');
      return {
        status: panel.getAttribute("data-factory-flow-status"),
        title: panel.querySelector("h3").textContent.trim(),
        sub: panel.querySelector(".factory-inspector-sub").textContent.replace(/\s+/g, " ").trim(),
        sources: [...panel.querySelectorAll(".factory-flow-source h4")].map(el => el.textContent.trim()),
        nodes: [...panel.querySelectorAll("[data-factory-flow-node]")].map(el => el.textContent.replace(/\s+/g, " ").trim()),
        sink: panel.querySelector(".factory-flow-sink .factory-flow-source-name").textContent.trim(),
        links: [...panel.querySelectorAll("a[data-evidence-path]")].map(a => a.getAttribute("href")),
        state: root.systemFactory.state().flow
      };
    });
    assert.equal(flow.status, "verified", "USD is the one verified flow");
    assert.equal(flow.title, "USD Layer 1 Agent");
    assert.match(flow.sub, /9 nodes · 8 connections/);
    assert.deepEqual(flow.sources, ["Direct invocation", "Storage hand-off"]);
    assert.equal(flow.nodes.length, 9, "every node of the export is drawn");
    assert.match(flow.nodes[0], /01 TRIGGER When Executed by Another Workflow/);
    assert.match(flow.nodes[7], /08 SCORE Calculate USD Conviction/);
    assert.match(flow.sink, /Dashboard Writer/);
    assert.equal(flow.state.asset, "USD");
    assert.deepEqual(flow.links.filter(href => href.startsWith("exports/")), [], "no raw export is linked");
    assert.ok(flow.links.includes("docs/analysis-engine/USD_LAYER1_LOGIC.md"), "the dossier is the evidence");

    // A node answers with its own purpose, inputs, outputs and evidence.
    const node = await page.evaluate(() => {
      document.querySelector('[data-factory-flow-node="calculate-usd-conviction"]').click();
      const detail = document.querySelector('[data-factory-flow-detail]');
      return {
        text: detail.textContent.replace(/\s+/g, " ").trim(),
        href: detail.querySelector("a[data-evidence-path]").getAttribute("href"),
        state: document.querySelector("[data-system-map]").systemFactory.state().flow
      };
    });
    assert.match(node.text, /08 SCORE · Code/);
    assert.match(node.text, /Purpose\./);
    assert.match(node.text, /Receives\./);
    assert.match(node.text, /Passes on\./);
    assert.match(node.text, /overwritten here/, "the score node says it decides, not the model");
    assert.equal(node.href, "docs/analysis-engine/USD_LAYER1_LOGIC.md");
    assert.equal(node.state.node, "calculate-usd-conviction");
    assert.equal((await statusesOf(page, [node.href]))[node.href], 200);

    await page.click("[data-factory-drilldown-close]");
    await page.waitForSelector('[data-inspector-for="usd.core"]');
    assert.deepEqual(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().selection),
      { type: "station", id: "usd.core" },
      "closing the flow returns to the core"
    );

    // A flow that only an export supports is labelled as a documented workflow.
    await page.click('[data-factory-station="gold.core"]');
    await page.waitForSelector("[data-factory-flow-open]");
    await page.click("[data-factory-flow-open]");
    const gold = await page.evaluate(() => {
      const panel = document.querySelector('[data-factory-flow="GOLD"]');
      return {
        status: panel.getAttribute("data-factory-flow-status"),
        kicker: panel.querySelector(".factory-inspector-kicker").textContent.trim(),
        note: panel.querySelector(".factory-empty-copy").textContent.replace(/\s+/g, " ").trim()
      };
    });
    assert.equal(gold.status, "documented");
    assert.match(gold.kicker, /Documented workflow/);
    assert.match(gold.note, /checked-in export/);
    await page.click("[data-factory-drilldown-close]");

    // An agent with no export says so instead of drawing an empty diagram.
    await page.click('[data-factory-station="wti.core"]');
    await page.waitForSelector("[data-factory-flow-open]");
    await page.click("[data-factory-flow-open]");
    const wti = await page.evaluate(() => {
      const panel = document.querySelector("[data-inspector-for='wti.core']");
      return {
        text: panel.textContent.replace(/\s+/g, " ").trim(),
        close: Boolean(panel.querySelector("[data-factory-drilldown-close]"))
      };
    });
    assert.match(wti.text, /No workflow export/);
    assert.match(wti.text, /logic document is the only committed artefact/);
    assert.equal(wti.close, true);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the VPS floor journey reaches three traders, the blind path and the cTrader component", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await openFactory(context, server.origin);

    await page.evaluate(() => {
      document.querySelector("[data-factory-journey-select]").value = "execution-floor";
    });
    await page.click("[data-factory-journey-start]");
    await page.waitForSelector("[data-factory-journey-active]");

    const titles = [];
    const stations = [];
    let blind = null;
    let relay = null;
    for (let step = 0; step < 7; step += 1) {
      titles.push(await page.evaluate(() => document.querySelector("[data-factory-journey-title]").textContent.trim()));
      stations.push(
        await page.evaluate(() =>
          document.querySelector(".factory-journey-station button").textContent.trim()
        )
      );
      if (step === 1) {
        const lanes = await page.evaluate(() => {
          const panel = document.querySelector('[data-factory-panel="lanes"]');
          return {
            buttons: [...panel.querySelectorAll("[data-factory-lane]")].map(el => el.getAttribute("data-factory-lane")),
            text: panel.textContent.replace(/\s+/g, " ").trim()
          };
        });
        assert.deepEqual(lanes.buttons, ["lane.full", "lane.half", "lane.blind"]);
        assert.match(lanes.text, /FTMO 1/);
        assert.match(lanes.text, /FTMO 2/);
        assert.match(lanes.text, /FTMO 3/);
        assert.match(lanes.text, /No directional call/);
        assert.match(lanes.text, /no relay that copies one lane's orders/);
      }
      if (step === 5) {
        blind = await page.evaluate(() => {
          const card = document.querySelector('[data-inspector-for="lane.blind"]');
          return {
            status: card.getAttribute("data-inspector-status"),
            facts: [...card.querySelectorAll(".factory-state")].map(el => el.textContent.replace(/\s+/g, " ").trim()),
            text: card.textContent.replace(/\s+/g, " ").trim()
          };
        });
      }
      if (step === 6) {
        relay = await page.evaluate(() => {
          const root = document.querySelector("[data-system-map]");
          const card = root.querySelector('[data-inspector-for="relay.ctrader"]');
          return {
            status: card.getAttribute("data-inspector-status"),
            states: [...card.querySelectorAll(".factory-state")].map(el =>
              el.textContent.replace(/\s+/g, " ").trim()
            ),
            text: card.textContent.replace(/\s+/g, " ").trim(),
            scene: root.systemFactory.state()
          };
        });
      }
      if (step < 6) {
        await page.click("[data-factory-journey-next]");
        await page.waitForTimeout(120);
      }
    }
    assert.deepEqual(titles, [
      "One host, three traders",
      "FTMO 1 trades the original ladder at 5R",
      "FTMO 2 trades a half grid at 3R",
      "The blind trader brings its own market data",
      "Its entry is an M5 deviation, not a Layer 1 call",
      "FTMO 3 holds a 5R ticket no junction produced",
      "The cTrader component is separate, and its authorisation is pending"
    ]);
    assert.deepEqual(stations, [
      "VPS execution terminal",
      "FTMO lane 1 · full L2L 5R",
      "FTMO lane 2 · half L2L 3R",
      "Blind market data",
      "M5 deviation rule",
      "FTMO 3 · L2L blind 5R",
      "cTrader connection"
    ]);

    // The blind lane is connected but unarmed, and its own chain is what feeds it.
    assert.equal(blind.status, "blind");
    assert.ok(blind.facts.some(fact => /Connected, strategy unarmed/.test(fact)));
    assert.ok(blind.facts.some(fact => /connection test/i.test(fact)));
    assert.match(blind.text, /Nothing from Layer 1 or Layer 2 reaches it/);
    assert.match(blind.text, /No payout route is drawn from this lane/);

    // The cTrader component is drawn apart. Its source states are written out: an intended source, then what is
    // actually configured and observed.
    assert.equal(relay.status, "relay");
    assert.equal(relay.scene.hosting, 2, "hosting links are drawn as their own kind of link");
    assert.ok(relay.scene.hosting < relay.scene.connections, "hosting is not counted as data flow");
    assert.equal(relay.states.length, 6);
    assert.match(relay.states[0], /^Installation/);
    assert.match(relay.states[1], /^Account connection/);
    assert.match(relay.states[2], /^Trading authorisation Pending/);
    assert.match(relay.states[3], /^Relay design intent FTMO 1/);
    assert.match(relay.states[4], /^Configured source Not evidenced/);
    assert.match(relay.states[5], /^Observed copying Not evidenced/);
    assert.match(relay.text, /independent line-to-line robot/);
    assert.match(relay.text, /No relay implementation, configuration, source binding, copy log or copied-order count is committed/);
    assert.match(relay.text, /not a copy of another lane/);
    assert.equal(relay.scene.conditional, 3, "the payout links stay the only conditional ones");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the map and both drill-downs work with every non-local request blocked", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const blocked = [];
    await context.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(server.origin) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      blocked.push(url);
      return route.abort();
    });
    const page = await openFactory(context, server.origin);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.click('[data-factory-station="usd.replay"]');
    await page.waitForSelector("[data-factory-library-open]");
    await page.click("[data-factory-library-open]");
    await page.waitForSelector('[data-library-asset="USD"]');
    await page.click('[data-factory-library-group="results"]');
    await page.click('[data-factory-library-test="four_markets"]');
    await page.click("[data-factory-drilldown-close]");
    await page.click('[data-factory-station="usd.core"]');
    await page.waitForSelector("[data-factory-flow-open]");
    await page.click("[data-factory-flow-open]");
    await page.waitForSelector('[data-factory-flow="USD"]');
    await page.click('[data-factory-flow-node="supabase-get-many"]');
    await page.click("[data-factory-drilldown-close]");

    assert.deepEqual(errors, [], "no page error with the network cut");
    assert.deepEqual(
      blocked.filter(url => /n8n|supabase|co\.uk|broker|mt5|api/i.test(url)),
      [],
      "the map asks nothing of n8n, Supabase, the VPS or a broker"
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the phone layout keeps the scene, the panel and the station index usable", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await openFactory(context, server.origin);

    const layout = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const stage = root.querySelector("[data-factory-stage]");
      const side = root.querySelector(".factory-side");
      const stageBox = stage.getBoundingClientRect();
      const sideBox = side.getBoundingClientRect();
      return {
        stageWidth: stageBox.width,
        stageHeight: stageBox.height,
        sideTop: sideBox.top,
        stageBottom: stageBox.bottom,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stations: root.querySelectorAll("[data-factory-station]").length,
        hudTargets: [...root.querySelectorAll(".factory-hud button")].map(button => button.getBoundingClientRect().height)
      };
    });

    assert.ok(layout.stageWidth > 300, "the scene keeps its width on a phone");
    assert.ok(layout.stageHeight >= 300, "the scene keeps a usable height on a phone");
    assert.equal(layout.overflow, 0, "the factory does not push the page sideways");
    assert.ok(layout.sideTop >= layout.stageBottom - 1, "the inspector sits below the scene, not over it");
    assert.equal(layout.stations, 50, "every station stays reachable through the index");
    for (const height of layout.hudTargets) {
      assert.ok(height >= 28, "camera controls stay tappable");
    }

    // The lower floor is a phone view too: its labels fit the scene and the floor switch fits the stage.
    await page.click('.factory-floorbar [data-factory-floor="lower"]');
    await page.waitForFunction(() => {
      const labels = [...document.querySelectorAll(".factory-label.is-dependency")];
      return labels.some(label => getComputedStyle(label).display !== "none");
    });
    const phoneLower = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const stage = root.querySelector("[data-factory-stage]").getBoundingClientRect();
      const floorbar = root.querySelector(".factory-floorbar").getBoundingClientRect();
      const illustrative = root.querySelector(".factory-illustrative").getBoundingClientRect();
      const labels = [...root.querySelectorAll(".factory-label.is-dependency")]
        .filter(label => getComputedStyle(label).display !== "none");
      return {
        visible: labels.length,
        clipped: labels
          .filter(label => {
            const box = label.getBoundingClientRect();
            return box.left < stage.left || box.right > stage.right || box.top < stage.top || box.bottom > stage.bottom;
          })
          .map(label => label.innerText.replace(/\s+/g, " ").trim()),
        floorbarInside: floorbar.left >= stage.left && floorbar.right <= stage.right
          && floorbar.top >= stage.top && floorbar.bottom <= stage.bottom,
        bannerOverlapsFloorbar: illustrative.left < floorbar.right && illustrative.right > floorbar.left
          && illustrative.top < floorbar.bottom && illustrative.bottom > floorbar.top,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    assert.ok(phoneLower.visible > 0, "the lower floor names nodes on a phone");
    assert.deepEqual(phoneLower.clipped, [], "no lower-floor label is cut by the phone stage edge");
    assert.equal(phoneLower.floorbarInside, true, "the floor switch stays inside the scene on a phone");
    assert.equal(phoneLower.bannerOverlapsFloorbar, false, "the illustrative-flow note never covers the floor switch");
    assert.equal(phoneLower.overflow, 0, "the lower floor does not push the page sideways");
    await page.click('.factory-floorbar [data-factory-floor="upper"]');

    await page.click('[data-factory-station="eur.core"]');
    await page.waitForSelector('[data-inspector-for="eur.core"]');
    assert.equal(
      await page.evaluate(() => document.querySelector('[data-inspector-for="eur.core"] h3').textContent.trim()),
      "EUR L1 core"
    );
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state().selection.id),
      "eur.core"
    );

    // The library and the flow panel fit a phone too, with no sideways scroll.
    await page.click('[data-factory-station="eur.replay"]');
    await page.waitForSelector("[data-factory-library-open]");
    await page.click("[data-factory-library-open]");
    await page.waitForSelector('[data-library-asset="EUR"]');
    const libraryOverflow = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const panel = root.querySelector(".factory-inspector");
      return {
        doc: root.scrollWidth - root.clientWidth,
        panel: panel.scrollWidth - panel.clientWidth
      };
    });
    assert.ok(libraryOverflow.panel <= 1, `the library panel must not scroll sideways, saw ${libraryOverflow.panel}`);
    assert.ok(libraryOverflow.doc <= 1, "the library must not widen the page");
    await page.click("[data-factory-drilldown-close]");
    await page.click('[data-factory-station="eur.core"]');
    await page.waitForSelector("[data-factory-flow-open]");
    await page.click("[data-factory-flow-open]");
    await page.waitForSelector('[data-factory-flow="EUR"]');
    const flowOverflow = await page.evaluate(() => {
      const panel = document.querySelector("[data-system-map]").querySelector(".factory-inspector");
      return panel.scrollWidth - panel.clientWidth;
    });
    assert.ok(flowOverflow <= 1, `the flow panel must not scroll sideways, saw ${flowOverflow}`);
  } finally {
    await browser.close();
    await server.close();
  }
});
test("the VPS stop names all three FTMO lanes on desktop and phone", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 1440, height: 1000, isMobile: false, hasTouch: false },
      { width: 390, height: 844, isMobile: true, hasTouch: true }
    ]) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch
      });
      try {
        const page = await openFactory(context, server.origin);
        await page.click('[data-factory-station="vps"]');
        await page.waitForSelector('[data-inspector-for="vps"]');
        const labels = await page.evaluate(() => {
          const root = document.querySelector("[data-system-map]");
          const stage = root.querySelector("[data-factory-stage]").getBoundingClientRect();
          const read = id => {
            const el = root.querySelector(`[data-factory-label="${id}"]`);
            const box = el.getBoundingClientRect();
            return {
              id,
              hidden: el.classList.contains("is-hidden"),
              text: el.textContent.replace(/\s+/g, " ").trim(),
              inside: box.left >= stage.left - 1 && box.right <= stage.right + 1
                && box.top >= stage.top - 1 && box.bottom <= stage.bottom + 1,
              box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
            };
          };
          return {
            vps: read("vps"),
            lanes: ["lane.full", "lane.half", "lane.blind"].map(read)
          };
        });

        assert.equal(labels.vps.hidden, false, `the VPS terminal keeps its name at ${viewport.width}px`);
        for (const lane of labels.lanes) {
          assert.equal(lane.hidden, false, `${lane.id} is readable at ${viewport.width}px`);
          assert.match(lane.text, /FTMO/, `${lane.id} keeps its FTMO name`);
          assert.equal(lane.inside, true, `${lane.id} stays inside the stage at ${viewport.width}px`);
        }
        const boxes = [labels.vps, ...labels.lanes];
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i].box;
            const b = boxes[j].box;
            const overlaps = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
            assert.equal(overlaps, false, `${boxes[i].id} and ${boxes[j].id} do not overlap at ${viewport.width}px`);
          }
        }
        assert.ok(
          labels.lanes[2].box.top >= labels.lanes[1].box.bottom,
          `the blind lane keeps its own lower row at ${viewport.width}px`
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the phone camera controls stay clear of the fixed trader lamps and each control acts", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce"
    });
    const page = await openFactory(context, server.origin);

    // The fixed trader lamps sit at the bottom right on a phone. Put the stage bottom on the viewport bottom:
    // this is the scroll position where the old bottom-anchored HUD was intercepted by the lamps.
    await page.evaluate(() => {
      const stage = document.querySelector("[data-factory-stage]").getBoundingClientRect();
      window.scrollTo(0, window.scrollY + stage.bottom - window.innerHeight);
    });
    await page.waitForTimeout(100);

    const hitTest = await page.evaluate(() => {
      const root = document.querySelector("[data-system-map]");
      const controls = [...root.querySelectorAll("[data-factory-reset], [data-factory-zoom], [data-factory-pause]")].map(el => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return {
          text: el.textContent.trim(),
          covered: !(hit && (el === hit || el.contains(hit))),
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
        };
      });
      const strips = [...document.querySelectorAll(".trader-status-strips .live-trader-status")]
        .filter(el => getComputedStyle(el).display !== "none")
        .map(el => {
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            available: Boolean(box.width && box.height) && Boolean(hit && (el === hit || el.contains(hit))),
            box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
          };
        });
      return { controls, strips };
    });
    assert.equal(hitTest.controls.length, 4, "all four camera controls are present");
    for (const control of hitTest.controls) {
      assert.equal(control.covered, false, `${control.text} is tappable at the stage bottom`);
    }
    assert.ok(hitTest.strips.length >= 1, "the fixed trader lamps remain available");
    for (const strip of hitTest.strips) {
      assert.equal(strip.available, true, "a fixed trader lamp is visible and on top");
      for (const control of hitTest.controls) {
        const a = strip.box;
        const b = control.box;
        const overlaps = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        assert.equal(overlaps, false, "the fixed lamps never cover a camera control");
      }
    }

    const initial = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    await page.tap('[data-factory-zoom="in"]');
    const zoomedIn = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.ok(zoomedIn.view.distance < initial.view.distance, "Zoom in shortens the camera distance");

    await page.tap('[data-factory-zoom="out"]');
    const zoomedOut = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.ok(zoomedOut.view.distance > zoomedIn.view.distance, "Zoom out lengthens the camera distance");

    await page.tap('[data-factory-zoom="in"]');
    await page.tap("[data-factory-reset]");
    const reset = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.ok(Math.abs(reset.view.distance - reset.overviewDistance) < 0.5, "Reset view returns to the overview");

    await page.tap("[data-factory-pause]");
    const paused = await page.evaluate(() => document.querySelector("[data-system-map]").systemFactory.state());
    assert.equal(paused.paused, true, "Pause flow pauses the scene");
    assert.equal(
      await page.evaluate(() => document.querySelector("[data-factory-pause]").getAttribute("aria-pressed")),
      "true"
    );
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the relay evidence separates design intent from configuration and observation", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await openFactory(context, server.origin);
    await page.click('[data-factory-station="relay.ctrader"]');
    await page.waitForSelector('[data-inspector-for="relay.ctrader"]');
    const text = await page.evaluate(() =>
      document.querySelector('[data-inspector-for="relay.ctrader"]').textContent.replace(/\s+/g, " ").trim()
    );
    assert.match(text, /Relay design intent FTMO 1/, "the intended source is named as design intent");
    assert.match(text, /Configured source Not evidenced/, "a configured source is not claimed");
    assert.match(text, /Observed copying Not evidenced/, "observed copying is not claimed");
    assert.match(text, /'Inactive' and 'zero copied orders' are not claimed/, "the absent evidence is not turned into a state");
  } finally {
    await browser.close();
    await server.close();
  }
});
