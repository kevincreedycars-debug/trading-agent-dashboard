// Contract tests for the marked L2L levels artifact, the local marking tool that writes it, and the
// dashboard wiring that reads it back.
//
// The levels file is the only artifact a person edits by hand, so what is asserted here is that a hand
// edit cannot produce a shape the published chart would misread, and that the writing half exists only
// on loopback.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  SCHEMA_VERSION,
  KNOWN_INSTRUMENTS,
  DEFAULT_STATE_PATH,
  createEmptyState,
  normaliseEdit,
  applyLevelEdit,
  serialiseState,
  readState,
  validateLevelsState,
  startServer
} = require("../scripts/l2l-levels-tool.js");

const root = path.resolve(__dirname, "..");
const levelsPath = path.join(root, "data", "l2l-levels.json");
const toolPath = path.join(root, "scripts", "l2l-levels-tool.js");
const scriptPath = path.join(root, "script.js");
const STAMP = "2026-10-01T09:00:00Z";

function addRequest(overrides = {}) {
  return {
    action: "add",
    symbol: "XAUUSD",
    price: 2650.55,
    kind: "l2l",
    direction: "long",
    timeframe: "M5",
    ...overrides
  };
}

function editOrFail(body) {
  const parsed = normaliseEdit(body, STAMP);
  assert.equal(parsed.error, undefined, parsed.error);
  return parsed.edit;
}

function applyOrFail(state, body) {
  const applied = applyLevelEdit(state, editOrFail(body), STAMP);
  assert.equal(applied.error, undefined, applied.error);
  return applied.state;
}

function levelsFor(state, symbol) {
  return state.instruments.find(instrument => instrument.symbol === symbol).levels;
}

async function withToolServer(handler) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l2l-levels-"));
  const statePath = path.join(dir, "l2l-levels.json");
  const server = await startServer({ root, statePath, port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await handler({ base, statePath });
  } finally {
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test("the committed levels artifact is present and valid", () => {
  assert.ok(fs.existsSync(levelsPath), "data/l2l-levels.json must be committed");
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  assert.deepEqual(validateLevelsState(state), []);
  assert.equal(state.schema_version, SCHEMA_VERSION);
});

test("the committed artifact starts every published symbol at zero levels", () => {
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  assert.deepEqual(
    state.instruments.map(instrument => instrument.symbol),
    KNOWN_INSTRUMENTS.map(entry => entry.symbol)
  );
  state.instruments.forEach(instrument => {
    assert.ok(Array.isArray(instrument.levels), `${instrument.symbol} needs a levels array`);
    assert.equal(instrument.levels.length, 0);
  });
  assert.equal(DEFAULT_STATE_PATH, "data/l2l-levels.json");
});

test("an empty state is what the tool writes when the file is missing", () => {
  const state = createEmptyState(STAMP);
  assert.deepEqual(validateLevelsState(state), []);
  assert.equal(state.instrument_count, KNOWN_INSTRUMENTS.length);
  assert.equal(state.generated_at_utc, STAMP);
});

test("the validator rejects edits a hand-written file could contain", () => {
  const base = createEmptyState(STAMP);
  const cases = [
    [/schema_version must be/, { ...base, schema_version: "l2l-levels-v0" }],
    [/instruments must be an array/, { ...base, instruments: "EURUSD" }],
    [/instrument_count must equal/, { ...base, instrument_count: 2 }],
    [/generated_at_utc must be a parseable timestamp/, { ...base, generated_at_utc: "yesterday" }],
    [/duplicate instrument/i, { ...base, instruments: base.instruments.concat([base.instruments[0]]), instrument_count: 5 }],
    [
      /requires a levels array/,
      {
        ...base,
        instruments: base.instruments.map(entry =>
          entry.symbol === "EURUSD" ? { symbol: "EURUSD", dashboard_asset: "EUR" } : entry)
      }
    ],
    [/must be a JSON object/, []],
    [/note must explain/, { ...base, note: "" }],
    [/marked_by must name the writer/, { ...base, marked_by: "" }]
  ];
  cases.forEach(([pattern, state]) => {
    assert.match(validateLevelsState(state).join("\n"), pattern);
  });
});

test("the validator rejects levels that could not have been marked", () => {
  const marked = applyOrFail(createEmptyState(STAMP), addRequest());
  const withLevel = override => ({
    ...marked,
    instruments: marked.instruments.map(entry =>
      entry.symbol === "XAUUSD"
        ? { ...entry, levels: entry.levels.map(level => ({ ...level, ...override })) }
        : entry)
  });

  assert.match(validateLevelsState(withLevel({ price: "2650.55" })).join("\n"), /positive numeric price/);
  assert.match(validateLevelsState(withLevel({ price: -1 })).join("\n"), /positive numeric price/);
  assert.match(validateLevelsState(withLevel({ kind: "fib" })).join("\n"), /kind must be one of/);
  assert.match(validateLevelsState(withLevel({ direction: "sideways" })).join("\n"), /direction must be one of/);
  assert.match(validateLevelsState(withLevel({ timeframe: "" })).join("\n"), /requires a timeframe/);
  assert.match(validateLevelsState(withLevel({ label: "" })).join("\n"), /requires a label/);
  assert.match(validateLevelsState(withLevel({ marked_at_utc: "nope" })).join("\n"), /marked_at_utc/);
  assert.match(validateLevelsState(withLevel({ marked_by: "" })).join("\n"), /marked_by/);

  const doubled = withLevel({});
  const gold = doubled.instruments.find(entry => entry.symbol === "XAUUSD");
  gold.levels.push({ ...gold.levels[0] });
  assert.match(validateLevelsState(doubled).join("\n"), /duplicates the price/);
});

test("a marking request is validated before it can reach the file", () => {
  assert.match(normaliseEdit(null, STAMP).error, /JSON object/);
  assert.match(normaliseEdit([], STAMP).error, /JSON object/);
  assert.match(normaliseEdit(addRequest({ action: "delete" }), STAMP).error, /action must be one of/);
  assert.match(normaliseEdit(addRequest({ symbol: "" }), STAMP).error, /symbol is required/);
  assert.match(normaliseEdit(addRequest({ symbol: "GBPUSD" }), STAMP).error, /unknown symbol/);
  assert.match(normaliseEdit(addRequest({ price: 0 }), STAMP).error, /positive number/);
  assert.match(normaliseEdit(addRequest({ price: "abc" }), STAMP).error, /positive number/);
  assert.match(normaliseEdit(addRequest({ kind: "fib" }), STAMP).error, /kind must be one of/);
  assert.match(normaliseEdit(addRequest({ direction: "sideways" }), STAMP).error, /direction must be one of/);
});

test("a marking request fills in what the click does not send", () => {
  const edit = editOrFail({ action: "add", symbol: "BTCUSD", price: 61000.129 });
  assert.equal(edit.level.kind, "l2l");
  assert.equal(edit.level.direction, "both");
  assert.equal(edit.level.timeframe, "M5");
  assert.equal(edit.level.label, "l2l 61000.129");
  assert.equal(edit.level.marked_at_utc, STAMP);
  assert.equal(edit.level.price, 61000.129);
  assert.equal(edit.level.marked_by, "dashboard marking tool");
});

test("adding a level writes it for that symbol only and keeps the file valid", () => {
  const state = applyOrFail(createEmptyState(STAMP), addRequest());
  assert.deepEqual(validateLevelsState(state), []);
  assert.equal(levelsFor(state, "XAUUSD").length, 1);
  assert.equal(levelsFor(state, "EURUSD").length, 0);
  assert.equal(levelsFor(state, "XAUUSD")[0].price, 2650.55);
  assert.equal(levelsFor(state, "XAUUSD")[0].direction, "long");
  assert.equal(state.generated_at_utc, STAMP);
});

test("levels are kept newest-price-first so the chart and the rule read the same order", () => {
  let state = createEmptyState(STAMP);
  state = applyOrFail(state, addRequest({ price: 2650.55 }));
  state = applyOrFail(state, addRequest({ price: 2775.25 }));
  state = applyOrFail(state, addRequest({ price: 2601.1 }));
  assert.deepEqual(levelsFor(state, "XAUUSD").map(level => level.price), [2775.25, 2650.55, 2601.1]);
  assert.deepEqual(validateLevelsState(state), []);
});

test("marking the same price twice replaces the level instead of stacking it", () => {
  let state = applyOrFail(createEmptyState(STAMP), addRequest({ kind: "l2l" }));
  state = applyOrFail(state, addRequest({ kind: "half-l2l", direction: "short" }));
  assert.equal(levelsFor(state, "XAUUSD").length, 1);
  assert.equal(levelsFor(state, "XAUUSD")[0].kind, "half-l2l");
  assert.equal(levelsFor(state, "XAUUSD")[0].direction, "short");
  assert.deepEqual(validateLevelsState(state), []);
});

test("removing a level deletes exactly that price and nothing else", () => {
  let state = createEmptyState(STAMP);
  state = applyOrFail(state, addRequest({ price: 2650.55 }));
  state = applyOrFail(state, addRequest({ price: 2601.1 }));
  const removed = applyLevelEdit(state, editOrFail({ action: "remove", symbol: "XAUUSD", price: 2650.55 }), STAMP);
  assert.equal(removed.error, undefined, removed.error);
  assert.deepEqual(levelsFor(removed.state, "XAUUSD").map(level => level.price), [2601.1]);
  assert.deepEqual(validateLevelsState(removed.state), []);
});

test("removing a price that was never marked is refused, not guessed at", () => {
  const state = applyOrFail(createEmptyState(STAMP), addRequest({ price: 2650.55 }));
  const removed = applyLevelEdit(state, editOrFail({ action: "remove", symbol: "XAUUSD", price: 2400 }), STAMP);
  assert.match(removed.error, /no level marked at 2400 for XAUUSD/);
  assert.equal(removed.state, undefined);
  assert.equal(levelsFor(state, "XAUUSD").length, 1);
});

test("a file missing a published symbol is rebuilt with all four", () => {
  const partial = {
    schema_version: SCHEMA_VERSION,
    generated_at_utc: STAMP,
    marked_by: "someone",
    note: "hand written",
    instrument_count: 1,
    instruments: [{ symbol: "EURUSD", dashboard_asset: "EUR", levels: [{ price: 1.1, label: "l2l", kind: "l2l", direction: "both", timeframe: "M5", marked_at_utc: STAMP, marked_by: "hand" }] }]
  };
  const state = applyOrFail(partial, addRequest());
  assert.deepEqual(
    state.instruments.map(entry => entry.symbol),
    KNOWN_INSTRUMENTS.map(entry => entry.symbol)
  );
  assert.equal(levelsFor(state, "EURUSD").length, 1, "the level already in the file survives");
  assert.deepEqual(validateLevelsState(state), []);
});

test("a level whose price is not a number is dropped rather than published", () => {
  const broken = createEmptyState(STAMP);
  broken.instruments[1].levels.push({ label: "l2l", price: "n/a" });
  const state = applyOrFail(broken, addRequest());
  assert.deepEqual(levelsFor(state, "XAUUSD").map(level => level.price), [2650.55]);
});

test("the written file is stable text with a single trailing newline", () => {
  const state = applyOrFail(createEmptyState(STAMP), addRequest());
  const text = serialiseState(state);
  assert.ok(text.endsWith("}\n"));
  assert.equal(text.endsWith("\n\n"), false);
  assert.deepEqual(JSON.parse(text), state);
  assert.match(text, /"schema_version": "l2l-levels-v1"/);
});

test("the tool serves the dashboard, seeds the file and answers the probe", async () => {
  await withToolServer(async ({ base, statePath }) => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);

    assert.equal(fs.existsSync(statePath), true, "the tool seeds a missing levels file");
    assert.deepEqual(validateLevelsState(JSON.parse(fs.readFileSync(statePath, "utf8"))), []);

    const probe = await fetch(`${base}/api/l2l-levels`);
    assert.equal(probe.status, 200);
    assert.equal(probe.headers.get("x-l2l-levels-tool"), "1");
    const body = await probe.json();
    assert.equal(body.ok, true);
    assert.equal(body.tool, "l2l-levels-tool");
    assert.ok(body.state_path.endsWith("l2l-levels.json"));
    assert.equal(body.state.instruments.length, KNOWN_INSTRUMENTS.length);
  });
});

test("a marking click posted to the tool reaches the file, and a bad one does not", async () => {
  await withToolServer(async ({ base, statePath }) => {
    const marked = await fetch(`${base}/api/l2l-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addRequest({ price: 2650.55 }))
    });
    assert.equal(marked.status, 200);
    const markedBody = await marked.json();
    assert.equal(markedBody.ok, true);
    assert.equal(markedBody.state.instruments.find(entry => entry.symbol === "XAUUSD").levels.length, 1);

    const onDisk = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.deepEqual(validateLevelsState(onDisk), []);
    assert.equal(onDisk.instruments.find(entry => entry.symbol === "XAUUSD").levels[0].price, 2650.55);

    const unchanged = serialiseState(onDisk);
    const rejected = await fetch(`${base}/api/l2l-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addRequest({ symbol: "GBPUSD" }))
    });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).ok, false);
    assert.equal(serialiseState(JSON.parse(fs.readFileSync(statePath, "utf8"))), unchanged);

    const notJson = await fetch(`${base}/api/l2l-levels`, { method: "POST", body: "not json" });
    assert.equal(notJson.status, 400);
    assert.equal(serialiseState(JSON.parse(fs.readFileSync(statePath, "utf8"))), unchanged);
  });
});

test("removing through the tool deletes the level and refuses an unknown price", async () => {
  await withToolServer(async ({ base, statePath }) => {
    const post = payload => fetch(`${base}/api/l2l-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    await post(addRequest({ price: 2650.55 }));
    await post(addRequest({ price: 2601.1 }));

    const removed = await post({ action: "remove", symbol: "XAUUSD", price: 2650.55 });
    assert.equal(removed.status, 200);
    const gone = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.deepEqual(gone.instruments.find(entry => entry.symbol === "XAUUSD").levels.map(level => level.price), [2601.1]);

    const again = await post({ action: "remove", symbol: "XAUUSD", price: 2650.55 });
    assert.equal(again.status, 404);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(statePath, "utf8")).instruments.find(entry => entry.symbol === "XAUUSD").levels.map(level => level.price),
      [2601.1]
    );
  });
});

test("the tool refuses to write a file its own checker would reject", async () => {
  await withToolServer(async ({ base, statePath }) => {
    const handEdited = createEmptyState(STAMP);
    handEdited.instruments.find(entry => entry.symbol === "EURUSD").levels.push({
      label: "l2l",
      price: 1.1,
      kind: "fib",
      direction: "both",
      timeframe: "M5",
      marked_at_utc: STAMP,
      marked_by: "hand"
    });
    fs.writeFileSync(statePath, serialiseState(handEdited));
    assert.match(validateLevelsState(readState(statePath)).join("\n"), /kind must be one of/);

    const response = await fetch(`${base}/api/l2l-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addRequest())
    });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /Refusing to write a levels file that would not validate/);
    assert.equal(serialiseState(readState(statePath)), serialiseState(handEdited), "the broken file is left untouched");
  });
});

test("the tool serves files read-only and cannot be walked out of the repo", async () => {
  await withToolServer(async ({ base }) => {
    const artifact = await fetch(`${base}/data/l2l-levels.json`);
    assert.equal(artifact.status, 200);
    assert.match(artifact.headers.get("content-type"), /application\/json/);

    const write = await fetch(`${base}/data/l2l-levels.json`, { method: "POST", body: "{}" });
    assert.equal(write.status, 405);

    const escape = await fetch(`${base}/..%2f..%2fpackage.json`);
    assert.equal(escape.status, 403);

    const missing = await fetch(`${base}/data/does-not-exist.json`);
    assert.equal(missing.status, 404);
  });
});

test("the tool stays on loopback, writes one file and pulls in no other machinery", () => {
  const source = fs.readFileSync(toolPath, "utf8");

  // The only write target is the levels file the tool was pointed at.
  const writes = source.match(/fs\.writeFileSync\([^,]+/g) || [];
  assert.equal(writes.length, 2);
  writes.forEach(target => assert.match(target, /statePath/));

  // No broker client, no shell, no outbound client: the artifact is hand-marked prices.
  const requires = [...source.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1]);
  assert.deepEqual(requires, ["fs", "http", "path"]);
  ["child_process", "net", "https", "axios", "MetaTrader5"].forEach(banned => {
    assert.equal(source.includes(banned), false, `${banned} must not appear in the marking tool`);
  });

  assert.match(source, /const host = options\.host \|\| "127\.0\.0\.1";/);
  assert.match(source, /const DEFAULT_STATE_PATH = "data\/l2l-levels\.json";/);
  // A validation mode exists so the committed artifact can be checked without starting a server.
  assert.match(source, /if \(args\.check\) \{/);
});

test("the dashboard reads the levels artifact and merges it onto the feed", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.match(script, /const liveTradingLevelsUrl = "\.\/data\/l2l-levels\.json/);
  assert.match(script, /fetchLocalJson\(liveTradingLevelsUrl\)/);
  assert.match(script, /liveTradingLevelsData = liveTradingLevelsResult\.value;/);
  assert.match(script, /liveTradingData = applyLiveTradingLevels\(liveTradingData, liveTradingLevelsData\);/);
  assert.match(script, /function applyLiveTradingLevels\(data, levelsData\) \{/);
  assert.match(script, /levels: liveTradingChartLevelsFor\(marked\)/);
  // The lines still ride the candle price scale they were drawn on in stage 1.
  assert.match(script, /live-trading-chart-level/);
});

test("the marking controls exist only where the local tool answers", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(script, /async function probeLiveTradingLevelsTool\(\) \{/);
  assert.match(script, /fetch\("\/api\/l2l-levels", \{ cache: "no-store" \}\)/);
  assert.match(script, /liveTradingLevelsEndpoint = await probeLiveTradingLevelsTool\(\);/);
  assert.match(script, /const markingControls = liveTradingLevelsEndpoint/);
  assert.match(script, /liveTradingMarking && liveTradingLevelsEndpoint/);
  assert.match(script, /data-live-chart-mark/);
  assert.match(script, /data-live-level-remove/);

  // Writing is a POST to the same loopback endpoint, and a failure is shown rather than swallowed.
  assert.match(script, /method: "POST"/);
  assert.match(script, /Could not save the level: \$\{err\.message\}/);
  assert.match(script, /Could not remove the level: \$\{err\.message\}/);

  assert.match(css, /\.live-trading-chart-mark \{/);
  assert.match(css, /\.live-trading-chart-mark\.active/);
  assert.match(css, /\.live-trading-chart-plot\.marking/);
  assert.match(css, /\.live-trading-chart-level-chip/);
});

test("a click on the chart is turned into a price on the price scale it was drawn with", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  // The plot keeps its scale so the pointer can be mapped back through the same geometry.
  assert.match(script, /liveTradingChartScale = \{ width, height, plotY0, plotY1, min, max \};/);
  assert.match(script, /function liveTradingMarkedPriceFromPointer\(svg, clientY\) \{/);
  assert.match(script, /getBoundingClientRect\(\)/);
  assert.match(script, /const price = liveTradingMarkedPriceFromPointer\(svg, event\.clientY\);/);
  // A keyboard-activated click carries no coordinates and must not mark anything.
  assert.match(script, /event\.clientY > 0/);
  // A marked level is a price a trader would type, so it snaps to the instrument's point grid.
  assert.match(script, /function liveTradingSnapPrice\(instrument, price\) \{/);
  assert.match(script, /Math\.round\(price \/ point\) \* point/);
});

test("the section states the level spacing the rule cares about", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.match(script, /function liveTradingLevelSpacing\(instrument\) \{/);
  assert.match(script, /minGapPoints/);
  assert.match(script, /function liveTradingLevelBadge\(instrument\) \{/);
  assert.match(script, /const levelBadge = liveTradingLevelBadge\(instrument\);/);
  assert.match(script, /marked level\$\{markedLevels\.length === 1 \? "" : "s"\}/);
  assert.match(script, /data\/l2l-levels\.json<\/span>\$\{escapeHtml\(levelsStamp\)\}/);
});

test("the levels artifact is not a second order or credential surface", () => {
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const text = JSON.stringify(state);
  ["password", "login", "account", "balance", "volume", "lot", "stop_loss", "take_profit"].forEach(term => {
    assert.equal(text.includes(term), false, `${term} must not appear in the levels artifact`);
  });
  assert.equal("levels" in state.instruments[0], true);
});




