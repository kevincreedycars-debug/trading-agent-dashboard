// The control room - backtest-engine-v2.html - is the one page here that draws itself from a view manifest and
// the published artefacts that manifest names, so this guard holds the two promises that keep it honest: the
// page shows what the manifest writes (bands, steps, order, state words, wires) and it shows it without a
// reader having to pan sideways, lose a caption under a wire, or open a sheet that will not close.
//
// The wires are the part most likely to drift, because they are measured from laid-out ports: a change to a
// grid gap, a node's span or the zoom transform can leave a line ending in mid-air. Every wire is therefore
// checked against the ports it claims to join, at rest and again after the reader zooms.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const PAGE = "backtest-engine-v2.html";
const MANIFEST = path.join(root, "backtester", "assets", "backtest-engine-v2.manifest.json");
const WIDTHS = [1440, 1180, 860, 768, 390];
const STATE_RANK = ["blocked", "stale", "pending", "unknown", "complete"];

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

// The page fetches artefacts by relative path, so it is opened over HTTP rather than from file://.
function serve() {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json"
  };
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(root, requested);
    fs.readFile(file.startsWith(root) ? file : path.join(root, "index.html"), (error, content) => {
      response.writeHead(error ? 404 : 200, {
        "content-type": types[path.extname(file)] || "application/octet-stream"
      });
      response.end(error ? "Not found" : content);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Everything the page drew, read back the way a reader meets it.
function readFlow(page) {
  return page.evaluate(() => {
    const text = node => (node ? node.textContent.trim() : null);
    const bands = Array.from(document.querySelectorAll(".cr-band")).map(band => ({
      id: band.dataset.band,
      label: text(band.querySelector(".cr-band-label")),
      caption: text(band.querySelector(".cr-band-caption"))
    }));
    const nodes = Array.from(document.querySelectorAll(".cr-node")).map(node => {
      const chip = node.querySelector(".cr-chip");
      return {
        id: node.dataset.node,
        index: text(node.querySelector(".cr-node-index")),
        title: text(node.querySelector(".cr-node-title")),
        state: node.dataset.state,
        chip: text(chip),
        chipState: chip ? chip.dataset.state : null,
        pips: Array.from(node.querySelectorAll(".cr-pip")).map(pip => pip.dataset.state),
        kind: text(node.querySelector(".cr-node-kind") || node.querySelector(".cr-kind")),
        band: node.closest(".cr-band").dataset.band,
        outPort: !!node.querySelector(".cr-port-out") && node.querySelector(".cr-port-out").offsetParent !== null,
        inPort: !!node.querySelector(".cr-port-in") && node.querySelector(".cr-port-in").offsetParent !== null
      };
    });
    return {
      bands,
      nodes,
      wires: document.querySelectorAll("#crWires path.cr-wire").length,
      flowWires: document.querySelectorAll("#crWires path.cr-wire-flow").length,
      hint: text(document.getElementById("crHint")),
      announce: text(document.getElementById("crAnnounce"))
    };
  });
}

// Each wire is two paths - the rule and the travelling dot - and both must join the same pair of ports. The
// page draws in scaler-local coordinates, so the ports are read the same way here: rect deltas divided by the
// zoom the scaler's own box reports.
function readWires(page) {
  return page.evaluate(() => {
    const scaler = document.getElementById("crScaler");
    const box = scaler.getBoundingClientRect();
    const zoom = box.width / scaler.offsetWidth || 1;
    const centre = node => {
      const rect = node.getBoundingClientRect();
      return {
        x: (rect.left + rect.width / 2 - box.left) / zoom,
        y: (rect.top + rect.height / 2 - box.top) / zoom
      };
    };
    const visible = selector => Array.from(document.querySelectorAll(selector))
      .filter(node => node.offsetParent !== null)
      .map(centre);
    return {
      outs: visible(".cr-port-out"),
      ins: visible(".cr-port-in"),
      paths: Array.from(document.querySelectorAll("#crWires path")).map(node => {
        const numbers = (node.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g) || [];
        const points = numbers.map(Number);
        return {
          start: { x: points[0], y: points[1] },
          end: { x: points[points.length - 2], y: points[points.length - 1] }
        };
      })
    };
  });
}

function nearest(points, at) {
  return points.reduce((best, point) => {
    const distance = Math.hypot(point.x - at.x, point.y - at.y);
    return distance < best ? distance : best;
  }, Infinity);
}

async function open(browser, base, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const view = await context.newPage();
  const errors = [];
  view.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  view.on("pageerror", error => errors.push(String(error)));
  await view.goto(`${base}/${PAGE}`, { waitUntil: "load" });
  // The page is ready when the hint reports the artefacts it read, which only happens after the flow renders.
  await view.waitForFunction(() => {
    const hint = document.getElementById("crHint");
    return hint && /artefacts read/.test(hint.textContent || "");
  }, null, { timeout: 15000 });
  return { context, view, errors };
}

// The manifest is the page's only script: what it writes is what the reader must see, in that order.
test("the page draws the bands, steps and state words the manifest writes", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { context, view, errors } = await open(browser, base, 1440);
    const flow = await readFlow(view);
    assert.deepEqual(errors, [], "the page must open without a script or console error");

    assert.deepEqual(
      flow.bands.map(band => band.id),
      manifest.bands.map(band => band.id),
      "the bands must be the manifest's bands, in the manifest's order"
    );
    flow.bands.forEach((band, index) => {
      assert.equal(band.label, manifest.bands[index].label, `${band.id} must carry the manifest's label`);
      assert.equal(band.caption, manifest.bands[index].caption, `${band.id} must carry the manifest's caption`);
    });

    assert.deepEqual(
      flow.nodes.map(node => node.id),
      manifest.nodes.map(node => node.id),
      "the steps must be the manifest's steps, in the manifest's order"
    );
    flow.nodes.forEach((node, index) => {
      const written = manifest.nodes[index];
      assert.equal(node.title, written.title, `${node.id} must carry the manifest's title`);
      assert.equal(node.band, written.band, `${node.id} must stand in the band the manifest gives it`);
      assert.equal(node.index, String(index + 1).padStart(2, "0"), `${node.id} must carry its own place in the path`);
    });

    // A legend label is the only word a state is allowed to be called.
    const words = Object.fromEntries(manifest.legend.map(entry => [entry.state, entry.label]));
    flow.nodes.forEach(node => {
      assert.equal(node.chipState, node.state, `${node.id}'s chip must name the state it was drawn in`);
      assert.equal(node.chip, words[node.state], `${node.id} must say "${words[node.state]}"`);
    });
    assert.equal(flow.hint.includes("artefacts read"), true, "the status line must report the artefacts it read");
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// The badge is the worst of the three dimensions, never better than any one of them, and the three are always
// shown so the badge cannot hide a stronger statement than the one it makes.
test("no step claims more than its own dimensions show", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { context, view } = await open(browser, base, 1440);
    const flow = await readFlow(view);
    flow.nodes.forEach(node => {
      assert.equal(node.pips.length, 3, `${node.id} must show software, data and research unsummarised`);
      const named = node.pips.filter(state => state !== "inactive");
      const worst = named.length ? STATE_RANK.find(state => named.includes(state)) : "inactive";
      assert.equal(node.state, worst, `${node.id} must read ${worst}, the worst of its own dimensions`);
    });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// Every line must join a port, and a port must exist only where a line joins it: a wire ending in mid-air or a
// port with nothing attached are the two ways this drawing goes wrong when a gap or a span changes.
test("every wire joins the two ports it claims, and no port is drawn without a wire", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { context, view } = await open(browser, base, 1440);
    const flow = await readFlow(view);
    const wires = await readWires(view);

    assert.equal(wires.paths.length, manifest.edges.length * 2, "each joined pair draws its rule and its dot");
    wires.paths.forEach((wire, index) => {
      assert.ok(nearest(wires.outs, wire.start) <= 1.5, `wire ${index} must start on a port it leaves`);
      assert.ok(nearest(wires.ins, wire.end) <= 1.5, `wire ${index} must end on a port it enters`);
    });

    const tails = new Set(manifest.edges.map(edge => edge.from));
    const heads = new Set(manifest.edges.map(edge => edge.to));
    flow.nodes.forEach(node => {
      assert.equal(node.outPort, tails.has(node.id), `${node.id} must show an out-port only if something follows it`);
      assert.equal(node.inPort, heads.has(node.id), `${node.id} must show an in-port only if something reaches it`);
    });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// A wire crosses the caption of the band it enters, so the caption is lifted above the drawing and carries a
// dark halo: a caption struck through by a line was the first thing this page got wrong.
test("a wire never strikes through a band's caption", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { context, view } = await open(browser, base, 1440);
    const headsAbove = await view.evaluate(() => {
      const reading = [];
      document.querySelectorAll(".cr-band-head").forEach(head => {
        const caption = head.querySelector(".cr-band-caption");
        const style = getComputedStyle(caption);
        reading.push({
          z: Number(getComputedStyle(head).zIndex),
          position: getComputedStyle(head).position,
          halo: style.textShadow !== "none" && style.textShadow.includes("px")
        });
      });
      return reading;
    });
    assert.equal(headsAbove.length, manifest.bands.length, "every band must keep its head");
    headsAbove.forEach((head, index) => {
      assert.ok(head.position === "relative" && head.z > 0, `band ${index}'s caption must be drawn above the wires`);
      assert.equal(head.halo, true, `band ${index}'s caption must carry the halo that breaks the line around it`);
    });
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// The page is read on a phone as often as on a desktop, and the flow may not push the reader sideways.
test("the flow fits the reader at every width and never scrolls sideways", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const width of WIDTHS) {
      const { context, view } = await open(browser, base, width);
      const measured = await view.evaluate(() => {
        const stage = document.getElementById("crStage");
        const node = document.querySelector(".cr-node");
        return {
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          stageScroll: stage.scrollWidth - stage.clientWidth,
          node: Math.round(node.getBoundingClientRect().width)
        };
      });
      assert.ok(measured.sideways <= 1, `at ${width}px the page must not scroll sideways (${measured.sideways}px)`);
      assert.ok(measured.stageScroll <= 1, `at ${width}px the flow must not need panning (${measured.stageScroll}px)`);
      assert.ok(measured.node >= 280, `at ${width}px a step must stay wide enough to read (${measured.node}px)`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});



// Choosing a step is the page's one interaction: it fills the panel, dims the lines that do not touch the step,
// and on a phone it opens a sheet that Escape closes. The panel must also go back to its empty state, so a
// reader is never left looking at the wrong step's detail.
test("choosing a step fills the panel, dims the other lines, and Escape puts both away", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const touching = manifest.edges.filter(edge => edge.from === "controller" || edge.to === "controller").length;
  try {
    const wide = await open(browser, base, 1440);
    const panel = () => wide.view.evaluate(() => ({
      title: document.querySelector("#crInspectorTitle").textContent.trim(),
      kicker: document.querySelector("#crInspectorKicker").textContent.trim(),
      muted: document.querySelectorAll(".cr-wire.is-muted").length,
      pressed: document.querySelector('[data-node="controller"]').getAttribute("aria-pressed"),
      announce: document.getElementById("crAnnounce").textContent.trim()
    }));

    await wide.view.click('[data-node="controller"]');
    const chosen = await panel();
    assert.equal(chosen.title, "Paired controller", "the panel must name the step that was chosen");
    assert.match(chosen.kicker, /Step 05/, "the panel must say where in the path the step stands");
    assert.equal(chosen.pressed, "true", "the chosen step must say it is pressed");
    assert.equal(chosen.muted, manifest.edges.length - touching, "only lines that do not touch the step dim");
    assert.match(chosen.announce, /Paired controller/, "a reader on a screen reader must hear the choice");

    await wide.view.keyboard.press("Escape");
    const cleared = await panel();
    assert.equal(cleared.title, "Choose a step", "Escape must return the panel to its empty state");
    assert.equal(cleared.muted, 0, "no line may stay dim once nothing is chosen");
    assert.equal(cleared.pressed, "false", "no step may stay pressed once nothing is chosen");

    // The steps answer the arrow keys as well as Tab, so the flow can be walked without a mouse.
    await wide.view.focus('[data-node="sources"]');
    await wide.view.keyboard.press("ArrowDown");
    const walked = await wide.view.evaluate(() => document.activeElement.dataset.node);
    assert.equal(walked, "panel", "ArrowDown must walk to the next step");
    await wide.context.close();

    const phone = await open(browser, base, 390);
    const sheet = () => phone.view.evaluate(() => {
      const panel = document.getElementById("crInspector");
      return {
        open: panel.classList.contains("is-open"),
        visibility: getComputedStyle(panel).visibility
      };
    });
    await phone.view.click('[data-node="evidence"]');
    const opened = await sheet();
    assert.equal(opened.open, true, "on a phone a chosen step must open the sheet");
    assert.equal(opened.visibility, "visible", "the open sheet must be visible, not merely moved");
    await phone.view.keyboard.press("Escape");
    // The sheet hides once it has finished sliding out, not the instant it is told to go.
    await phone.view.waitForFunction(
      () => getComputedStyle(document.getElementById("crInspector")).visibility === "hidden",
      null,
      { timeout: 2000 }
    );
    assert.equal((await sheet()).open, false, "a closed sheet must not say it is open");
    assert.equal((await sheet()).visibility, "hidden", "the closed sheet must be out of the way of the flow");
    await phone.context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// Zoom scales the drawing, and the lines are drawn from ports measured in the scaled space: a zoom that forgot
// to divide by the factor would leave every line pointing at where its port used to be.
test("zooming keeps every wire on its port, and Fit puts the flow back", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const readout = view => view.evaluate(() => document.getElementById("crZoomValue").textContent.trim());
  try {
    const { context, view } = await open(browser, base, 1440);
    assert.equal(await readout(view), "100%", "the flow opens at its own size");
    await view.click("#crZoomOut");
    await view.click("#crZoomOut");
    assert.equal(await readout(view), "80%", "two steps out must show 80%");
    await view.waitForTimeout(150);
    const zoomed = await readWires(view);
    assert.equal(zoomed.paths.length, manifest.edges.length * 2, "zooming must not lose a line");
    zoomed.paths.forEach((wire, index) => {
      assert.ok(nearest(zoomed.outs, wire.start) <= 1.5, `zoomed wire ${index} must still start on its port`);
      assert.ok(nearest(zoomed.ins, wire.end) <= 1.5, `zoomed wire ${index} must still end on its port`);
    });
    await view.click("#crZoomFit");
    assert.equal(await readout(view), "100%", "Fit must put the flow back to its own size");
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// The page never types a verification date. Each source declares which field of its own artefact carries the
// time it was built, and this guard reads that field back from the file itself: a source that cannot be read is
// named as unavailable rather than dropped, and one whose artefact carries no timestamp says so.
test("every source is stamped by its own artefact, or says it has no timestamp", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { context, view, errors } = await open(browser, base, 1440);
    const read = await view.evaluate(() => Array.from(document.querySelectorAll(".cr-source")).map(item => ({
      key: item.dataset.source,
      state: item.dataset.state,
      label: item.querySelector(".cr-source-link").textContent.trim(),
      href: item.querySelector(".cr-source-link").getAttribute("href"),
      stamp: item.querySelector(".cr-source-stamp").textContent.trim()
    })));
    assert.deepEqual(errors, [], "reading the sources must not raise a page or console error");
    assert.equal(read.length, Object.keys(manifest.sources).length, "every source in the manifest must appear once");
    for (const entry of read) {
      const source = manifest.sources[entry.key];
      assert.equal(entry.label, source.label, `${entry.key} must carry the manifest's label`);
      assert.equal(entry.href, source.url, `${entry.key} must link to the artefact the manifest names`);
      if (!source.verified_at) {
        assert.equal(entry.state, "unstamped", `${entry.key} publishes no timestamp and must say so`);
        assert.match(entry.stamp, /no timestamp published/i);
        continue;
      }
      const artefact = JSON.parse(fs.readFileSync(path.join(root, source.url), "utf8").replace(/^\uFEFF/, ""));
      const raw = source.verified_at.split(".").reduce((value, part) => (value == null ? value : value[part]), artefact);
      assert.ok(raw, `${entry.key} must carry ${source.verified_at}`);
      assert.equal(entry.state, "read", `${entry.key} was read`);
      assert.match(entry.stamp, /^verified /, `${entry.key} must show its own verification stamp`);
    }
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

// The two claims the page must keep apart: the fresh-call proof establishes call generation (eight cases, one
// captured execution) and the readiness counts are the published matrix's, with the scratch 7/1/8/8 kept out.
test("the fresh-call proof and the published readiness are read from their artefacts", async () => {
  const fresh = JSON.parse(fs.readFileSync(path.join(root, "data", "usd-layer1-backtester", "n8n", "fresh-call-v1.json"), "utf8").replace(/^\uFEFF/, ""));
  const readiness = JSON.parse(fs.readFileSync(path.join(root, "data", "usd-layer1-backtester", "market-readiness-v1.json"), "utf8"));
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { context, view } = await open(browser, base, 1440);
    await view.click('[data-node="freshcall"]');
    const freshPanel = await view.evaluate(() => ({
      state: document.querySelector('[data-node="freshcall"]').dataset.state,
      body: document.getElementById("crInspectorBody").textContent
    }));
    assert.equal(freshPanel.state, "pending", "call generation is complete; the model logic behind it is still pending");
    for (const token of [fresh.live_call.execution.id, fresh.live_call.child_executions[0].execution_id, fresh.live_call.child_executions[1].execution_id]) {
      assert.ok(freshPanel.body.includes(token), `the proof must name execution ${token}`);
    }
    assert.match(freshPanel.body, /8 of 8 calls/, "the panel must state the rehearsal result in the artefact's own words");
    assert.doesNotMatch(freshPanel.body, /7 of 8|replays a stored call/i, "the superseded wording must not survive");

    await view.keyboard.press("Escape");
    await view.click('[data-node="outcomes"]');
    const outcomes = await view.evaluate(() => document.getElementById("crInspectorBody").textContent);
    const counts = readiness.published.counts;
    assert.ok(outcomes.includes(String(counts.scored)), `the panel must show ${counts.scored} scored cells`);
    assert.ok(outcomes.includes(String(counts.blocked)), `the panel must show ${counts.blocked} blocked cells`);
    assert.match(outcomes, /pending data distribution/i, "XAG/WTI/GBP direction must wait on the distribution route");
    assert.match(outcomes, /not established/i, "no cell may claim a predictive advantage");
    assert.match(outcomes, /unpublished research evidence, not live readiness/i, "the scratch run must be labelled unpublished");
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});
