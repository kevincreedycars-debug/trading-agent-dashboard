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
    assert.equal(shape.stations, 46, "eight lanes of four stations, seven pair sockets, and the shared stations");
    assert.equal(shape.labels, 46);
    assert.deepEqual(shape.legend, ["Incoming feeds", "Research", "Replay", "Gate", "L1 cores", "L2 join", "Execution", "Payout"]);
    assert.match(shape.illustrative, /Illustrative flow · no live data/, "the flow is labelled as illustrative");
    assert.deepEqual(shape.hud, ["Reset view", "+", "−", "Pause flow"]);
    assert.equal(shape.scene.connections, 38, "32 lane links, two execution splits, two payout links and the bank link");
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
    assert.deepEqual(lanes.buttons, ["lane.full", "lane.half"]);
    assert.match(lanes.text, /REWARD_R_MULTIPLE = 5/);
    assert.match(lanes.text, /HALF_LANE_R_MULTIPLE = 3/);

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
    assert.equal(walk.count, 46, "the walk covers every station in the index");
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

    assert.ok(hrefs.size >= 40, `the walk collects the whole evidence surface, saw ${hrefs.size}`);

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

    const statuses = await statusesOf(page, [...hrefs]);
    for (const [href, status] of Object.entries(statuses)) {
      assert.equal(status, 200, `${href} must resolve from the preview root`);
    }
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
    assert.equal(layout.stations, 46, "every station stays reachable through the index");
    for (const height of layout.hudTargets) {
      assert.ok(height >= 28, "camera controls stay tappable");
    }

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
  } finally {
    await browser.close();
    await server.close();
  }
});
