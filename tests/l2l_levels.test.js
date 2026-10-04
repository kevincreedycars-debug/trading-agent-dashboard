// Contract tests for the marked L2L levels artifact, the two writers that can produce it, and the
// dashboard wiring that reads it back.
//
// The levels file is the only artifact a person edits by hand, so what is asserted here is that a hand
// edit cannot produce a shape the published chart would misread, that the document rules live in one
// shared module rather than in two writers, and that the published page's write path is bounded: one
// file, the reader's own repository, the reader's own token, kept in the reader's own browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// The document half - constants, edit rules, ladder arithmetic, the checker, the browser draft and the
// GitHub request builders - is shared by the loopback tool and the published page, so it is required from
// the one place that owns it.
const {
  SCHEMA_VERSION,
  KNOWN_INSTRUMENTS,
  DEFAULT_STATE_PATH,
  ALLOWED_ROLES,
  DERIVED_MARKED_BY,
  DEFAULT_DUPLICATE_STEPS,
  MAX_DUPLICATE_STEPS,
  MARKED_BY,
  DRAFT_KEY,
  SETTINGS_KEY,
  DEFAULT_REPO,
  DEFAULT_BRANCH,
  createEmptyState,
  normaliseEdit,
  normaliseStepCount,
  buildLadder,
  applyLevelEdit,
  serialiseState,
  validateLevelsState,
  readDraft,
  writeDraft,
  clearDraft,
  levelsStateStamp,
  chooseLevelsView,
  readSettings,
  writeSettings,
  clearSettings,
  parseRepo,
  encodeContentPath,
  toBase64,
  fromBase64,
  contentsUrl,
  buildReadRequest,
  buildCommitRequest,
  describeStatus,
  readRemoteLevels,
  commitLevels,
  normalisePublishTarget
} = require("../lib/l2l_levels_store.js");
// What only the loopback tool can do: read the file off this machine, and serve the repo.
const { readState, startServer } = require("../scripts/l2l-levels-tool.js");
// The ladder arithmetic the page loads as a plain script and the tests require directly.
const ladder = require("../lib/l2l_ladder.js");

const root = path.resolve(__dirname, "..");
const levelsPath = path.join(root, "data", "l2l-levels.json");
const toolPath = path.join(root, "scripts", "l2l-levels-tool.js");
const storePath = path.join(root, "lib", "l2l_levels_store.js");
const scriptPath = path.join(root, "script.js");
const indexPath = path.join(root, "index.html");
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

test("the committed artifact publishes exactly the known symbols and only valid marks", () => {
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  assert.deepEqual(
    state.instruments.map(instrument => instrument.symbol),
    KNOWN_INSTRUMENTS.map(entry => entry.symbol)
  );
  // The marks in this file are the user's own judgement, made on the mirrored chart and committed by
  // the page's own store, so the guard keeps their shape and provenance honest rather than requiring
  // the file to be empty. A symbol nothing is marked for still ships an empty levels array.
  state.instruments.forEach(instrument => {
    assert.ok(Array.isArray(instrument.levels), `${instrument.symbol} needs a levels array`);
  });
  assert.deepEqual(validateLevelsState(state), []);
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
  assert.match(normaliseEdit(addRequest({ role: "guess" }), STAMP).error, /role must be one of/);
  assert.equal(normaliseEdit(addRequest({ action: "clear" }), STAMP).error, undefined);
  assert.match(normaliseEdit({ action: "clear", symbol: "GBPUSD" }, STAMP).error, /unknown symbol/);
});

test("a marking request fills in what the click does not send", () => {
  const edit = editOrFail({ action: "add", symbol: "BTCUSD", price: 61000.129 });
  assert.equal(edit.level.kind, "l2l");
  assert.equal(edit.level.direction, "both");
  assert.equal(edit.level.role, "seed");
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
  const store = fs.readFileSync(storePath, "utf8");

  // The only write target is the levels file the tool was pointed at.
  const writes = source.match(/fs\.writeFileSync\([^,]+/g) || [];
  assert.equal(writes.length, 2);
  writes.forEach(target => assert.match(target, /statePath/));

  // No broker client, no shell, no outbound client: the artifact is hand-marked prices. The document
  // rules come from the module both writers share, and from nowhere else.
  const requires = [...source.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1]);
  assert.deepEqual(requires, ["fs", "http", "path", "../lib/l2l_levels_store.js"]);
  ["child_process", "net", "https", "axios", "MetaTrader5", "api.github.com"].forEach(banned => {
    assert.equal(source.includes(banned), false, `${banned} must not appear in the marking tool`);
  });

  assert.match(source, /const host = options\.host \|\| "127\.0\.0\.1";/);
  assert.match(source, /const \{[\s\S]*DEFAULT_STATE_PATH,[\s\S]*\} = levels;/);
  assert.match(store, /const DEFAULT_STATE_PATH = "data\/l2l-levels\.json";/);
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

test("the marking controls exist wherever there is a store to write to", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(script, /async function probeLiveTradingLevelsTool\(\) \{/);
  assert.match(script, /fetch\("\/api\/l2l-levels", \{ cache: "no-store" \}\)/);
  assert.match(script, /liveTradingLevelsEndpoint = await probeLiveTradingLevelsTool\(\);/);
  // Two stores can write: the loopback tool on this machine, or the shared module writing this browser's
  // draft and publishing it. A page with neither draws the levels read-only, so the guard is "can mark",
  // not "has the local tool".
  assert.match(script, /const liveTradingLevelsStore = \(typeof globalThis !== "undefined" && globalThis\.L2LLevelsStore\) \|\| null;/);
  assert.match(script, /function liveTradingLevelsCanMark\(\) \{/);
  assert.match(script, /return Boolean\(liveTradingLevelsEndpoint \|\| liveTradingLevelsStore\);/);
  assert.match(script, /const markingControls = liveTradingLevelsCanMark\(\)/);
  assert.match(script, /liveTradingMarking && liveTradingLevelsCanMark\(\)/);
  assert.match(script, /data-live-chart-mark/);
  assert.match(script, /data-live-level-remove/);

  // With the loopback tool the write is a POST to the same loopback endpoint, and a failure is shown
  // rather than swallowed.
  assert.match(script, /method: "POST"/);
  assert.match(script, /if \(!liveTradingLevelsEndpoint\) return applyLiveTradingLevelEdit\(payload\);/);
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
  // The caption counts the two kinds apart: the seeds are the measurement, the rest is its consequence.
  assert.match(script, /seedLevels\.length\} seed level\$\{seedLevels\.length === 1 \? "" : "s"\}/);
  assert.match(script, /\$\{derivedLevels\} derived/);
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

// The two hand-marked prices are the measurement; the ladder is what follows from it. Everything below
// is about that distinction holding in the file, because the published chart reads the file and not the
// chart session the levels were marked in.
function seedPair(priceA, priceB, overrides = {}) {
  let state = applyOrFail(createEmptyState(STAMP), addRequest({ price: priceA, role: "seed", ...overrides }));
  state = applyOrFail(state, addRequest({ price: priceB, role: "seed", ...overrides }));
  return state;
}

test("duplicating repeats the exact distance between the two seed levels", () => {
  const seeds = seedPair(4137.5, 3962.5, { timeframe: "H4" });
  const applied = applyLevelEdit(
    seeds,
    editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 2, below: 2, timeframe: "H4", point: 0.01 }),
    STAMP
  );
  assert.equal(applied.error, undefined, applied.error);
  assert.deepEqual(validateLevelsState(applied.state), []);

  // 175.00 apart: two steps above the top seed and two below the bottom seed, with nothing in between
  // because the two seeds are one step apart by definition.
  assert.deepEqual(
    levelsFor(applied.state, "XAUUSD").map(level => level.price),
    [4487.5, 4312.5, 4137.5, 3962.5, 3787.5, 3612.5]
  );
  assert.deepEqual(applied.generated, {
    count: 4,
    spacing_price: 175,
    spacing_points: 17500,
    anchor_high: 4137.5,
    anchor_low: 3962.5,
    above: 2,
    below: 2
  });

  const derived = levelsFor(applied.state, "XAUUSD").filter(level => level.role === "derived");
  derived.forEach(level => {
    assert.equal(level.spacing_price, 175);
    assert.equal(level.anchor_high, 4137.5);
    assert.equal(level.anchor_low, 3962.5);
    assert.equal(level.marked_by, DERIVED_MARKED_BY);
    assert.equal(level.timeframe, "H4");
    assert.equal(level.kind, "l2l");
    assert.equal(level.direction, "both");
  });
  assert.ok(derived.every(level => typeof level.note === "string" && level.note.includes("175")));
  // The anchors stay hand-marked seeds rather than being rewritten into generated copies.
  assert.deepEqual(
    levelsFor(applied.state, "XAUUSD").filter(level => level.role === "seed").map(level => level.price),
    [4137.5, 3962.5]
  );
});

test("duplicating again replaces the derived levels instead of stacking them", () => {
  const first = applyLevelEdit(seedPair(4137.5, 3962.5), editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 2, below: 2 }), STAMP);
  const second = applyLevelEdit(first.state, editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 1, below: 1 }), STAMP);
  assert.deepEqual(levelsFor(second.state, "XAUUSD").map(level => level.price), [4312.5, 4137.5, 3962.5, 3787.5]);
  assert.deepEqual(validateLevelsState(second.state), []);

  // Move a seed and the ladder moves with it, because it is measured every time rather than remembered.
  const moved = applyLevelEdit(second.state, editOrFail({ action: "remove", symbol: "XAUUSD", price: 4137.5 }), STAMP);
  const reseeded = applyLevelEdit(moved.state, editOrFail({ action: "add", symbol: "XAUUSD", price: 4200, role: "seed" }), STAMP);
  const third = applyLevelEdit(reseeded.state, editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 1, below: 0 }), STAMP);
  assert.deepEqual(levelsFor(third.state, "XAUUSD").map(level => level.price), [4437.5, 4200, 3962.5]);
  assert.deepEqual(validateLevelsState(third.state), []);
});

test("duplicating refuses anything it cannot measure or generate", () => {
  // Fewer than two seeds is nothing to measure, and the message says which symbol and how many it found.
  assert.match(
    applyLevelEdit(createEmptyState(STAMP), editOrFail({ action: "duplicate", symbol: "XAUUSD" }), STAMP).error,
    /needs the two seed levels marked first; XAUUSD has 0/
  );
  const one = applyOrFail(createEmptyState(STAMP), addRequest({ price: 2650.55, role: "seed" }));
  assert.match(
    applyLevelEdit(one, editOrFail({ action: "duplicate", symbol: "XAUUSD" }), STAMP).error,
    /needs the two seed levels marked first; XAUUSD has 1/
  );

  // A step count that is not a whole number inside the cap is refused rather than rounded.
  assert.match(
    normaliseEdit({ action: "duplicate", symbol: "XAUUSD", above: -1 }, STAMP).error,
    new RegExp(`above must be an integer between 0 and ${MAX_DUPLICATE_STEPS}`)
  );
  assert.match(normaliseEdit({ action: "duplicate", symbol: "XAUUSD", below: 2.5 }, STAMP).error, /below must be an integer/);
  assert.match(normaliseEdit({ action: "duplicate", symbol: "XAUUSD", above: MAX_DUPLICATE_STEPS + 1 }, STAMP).error, /above must be an integer/);
  assert.match(normaliseEdit({ action: "duplicate", symbol: "XAUUSD", point: 0 }, STAMP).error, /point must be a positive number/);
  assert.deepEqual(normaliseStepCount(undefined, "above"), { value: DEFAULT_DUPLICATE_STEPS });
  assert.deepEqual(normaliseStepCount(0, "above"), { value: 0 });

  // Nothing above and nothing below generates nothing, which is an error rather than an empty write.
  assert.match(
    applyLevelEdit(seedPair(2650.55, 2601.1), editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 0, below: 0 }), STAMP).error,
    /generated no new levels for XAUUSD/
  );
  // A request that carries no counts at all gets the documented default each way.
  const defaulted = editOrFail({ action: "duplicate", symbol: "XAUUSD" });
  assert.equal(defaulted.above, DEFAULT_DUPLICATE_STEPS);
  assert.equal(defaulted.below, DEFAULT_DUPLICATE_STEPS);
  assert.equal(defaulted.point, null);

  // A pair of seeds at the same price is not a distance, so the ladder builder refuses it.
  const flat = seedPair(2650.55, 2601.1).instruments.find(entry => entry.symbol === "XAUUSD").levels;
  assert.match(
    buildLadder(flat.map(level => ({ ...level, price: 2650.55 })), { symbol: "XAUUSD", above: 1, below: 1 }).error,
    /so there is no distance to repeat/
  );
  // A distance smaller than the instrument's own point grid collapses every step back onto a seed's
  // price, so the steps are skipped rather than written repeatedly at one price.
  assert.match(
    applyLevelEdit(
      seedPair(2601.1, 2601.100001),
      editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 2, below: 2, point: 0.01 }),
      STAMP
    ).error,
    /generated no new levels for XAUUSD/
  );
});

test("clearing a symbol removes its levels and refuses to invent any", () => {
  const marked = applyOrFail(seedPair(2650.55, 2601.1), addRequest({ price: 2775.25 }));
  assert.equal(levelsFor(marked, "XAUUSD").length, 3);

  const cleared = applyLevelEdit(marked, editOrFail({ action: "clear", symbol: "XAUUSD" }), STAMP);
  assert.equal(cleared.error, undefined, cleared.error);
  assert.deepEqual(levelsFor(cleared.state, "XAUUSD"), []);
  assert.deepEqual(cleared.generated, { cleared: true, symbol: "XAUUSD" });
  assert.deepEqual(validateLevelsState(cleared.state), []);
  // Only that symbol: clearing one instrument is not clearing the file.
  assert.deepEqual(levelsFor(cleared.state, "EURUSD"), []);

  assert.match(
    applyLevelEdit(cleared.state, editOrFail({ action: "clear", symbol: "XAUUSD" }), STAMP).error,
    /no levels marked for XAUUSD/
  );
});

test("the validator holds a derived level to the measurement it came from", () => {
  const seeds = seedPair(2650.55, 2601.1);
  const applied = applyLevelEdit(seeds, editOrFail({ action: "duplicate", symbol: "XAUUSD", above: 1, below: 0 }), STAMP);
  const withLevel = override => ({
    ...applied.state,
    instruments: applied.state.instruments.map(entry =>
      entry.symbol === "XAUUSD"
        ? { ...entry, levels: entry.levels.map(level => (level.role === "derived" ? { ...level, ...override } : level)) }
        : entry)
  });

  assert.match(validateLevelsState(withLevel({ role: "guess" })).join("\n"), /role must be one of seed, derived/);
  assert.match(validateLevelsState(withLevel({ spacing_price: null })).join("\n"), /is derived and requires a positive spacing_price/);
  assert.match(validateLevelsState(withLevel({ anchor_high: 1, anchor_low: 2601.1 })).join("\n"), /is derived and requires anchor_high above anchor_low/);
  assert.match(validateLevelsState(withLevel({ spacing_points: -1 })).join("\n"), /spacing_points must be a positive integer or null/);
  assert.deepEqual(validateLevelsState(applied.state), []);
  assert.deepEqual(ALLOWED_ROLES, ["seed", "derived"]);

  // A file written before roles existed still validates: without a role a level reads as a seed, which
  // is what every hand-marked level is.
  const legacy = createEmptyState(STAMP);
  legacy.instruments[1].levels.push({
    label: "l2l", price: 2650.55, kind: "l2l", direction: "both", timeframe: "M5", marked_at_utc: STAMP, marked_by: "hand"
  });
  assert.deepEqual(validateLevelsState(legacy), []);
});

test("duplicating through the tool writes the ladder and reports the spacing", async () => {
  await withToolServer(async ({ base, statePath }) => {
    const post = payload => fetch(`${base}/api/l2l-levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    await post(addRequest({ price: 2650.55, role: "seed" }));
    await post(addRequest({ price: 2601.1, role: "seed" }));

    const duplicated = await post({ action: "duplicate", symbol: "XAUUSD", above: 1, below: 1, timeframe: "H1", point: 0.01 });
    assert.equal(duplicated.status, 200);
    const body = await duplicated.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.generated, {
      count: 2,
      spacing_price: 49.45,
      spacing_points: 4945,
      anchor_high: 2650.55,
      anchor_low: 2601.1,
      above: 1,
      below: 1
    });

    const onDisk = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.deepEqual(validateLevelsState(onDisk), []);
    const gold = onDisk.instruments.find(entry => entry.symbol === "XAUUSD");
    // 2650.55 + 49.45 snaps back onto the point grid at 2700.00; the low step is 2601.1 - 49.45.
    assert.deepEqual(gold.levels.map(level => level.price), [2700, 2650.55, 2601.1, 2551.65]);
    assert.deepEqual(gold.levels.map(level => level.role), ["derived", "seed", "seed", "derived"]);
    assert.ok(gold.levels.filter(level => level.role === "derived").every(level => level.timeframe === "H1"));

    // Duplicating with nothing to measure is a 404 with the reason, and the file is left as it was.
    const untouched = serialiseState(onDisk);
    const refused = await post({ action: "duplicate", symbol: "EURUSD" });
    assert.equal(refused.status, 404);
    assert.match((await refused.json()).error, /needs the two seed levels marked first; EURUSD has 0/);
    assert.equal(serialiseState(JSON.parse(fs.readFileSync(statePath, "utf8"))), untouched);

    // Clearing the symbol empties it and leaves the rest of the file valid.
    const cleared = await post({ action: "clear", symbol: "XAUUSD" });
    assert.equal(cleared.status, 200);
    const afterClear = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.deepEqual(afterClear.instruments.find(entry => entry.symbol === "XAUUSD").levels, []);
    assert.deepEqual(validateLevelsState(afterClear), []);
  });
});

test("the dashboard duplicates from the marked seeds and can clear them again", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  // The two actions the toolbar offers beside Mark level, and the requests they send.
  assert.match(script, /async function duplicateLiveTradingLevels\(\) \{/);
  assert.match(script, /action: "duplicate"/);
  assert.match(script, /async function clearLiveTradingLevels\(\) \{/);
  assert.match(script, /action: "clear", symbol: instrument\.symbol/);
  assert.match(script, /data-live-level-duplicate/);
  assert.match(script, /data-live-level-clear/);
  assert.match(script, /Could not duplicate the levels: \$\{err\.message\}/);
  assert.match(script, /Could not clear the levels: \$\{err\.message\}/);

  // A click marks a seed, and it says which timeframe it was read on.
  assert.match(script, /role: "seed",/);
  assert.match(script, /timeframe: liveTradingTimeframeMeta\(liveTradingChartTimeframe\)\.label/);
  assert.match(script, /function liveTradingSeedLevels\(instrument\) \{/);
  assert.match(script, /function liveTradingDerivedLevelCount\(instrument\) \{/);

  // The two step counts sit beside the button and are read without redrawing the panel under the caret.
  assert.match(script, /let liveTradingLadderSteps = \{ above: null, below: null \};/);
  assert.match(script, /const LIVE_TRADING_LADDER_DEFAULT_STEPS = \d+;/);
  assert.match(script, /panel\.addEventListener\("input", event => \{/);
  assert.match(script, /data-live-ladder-above/);
  assert.match(script, /data-live-ladder-below/);
  // The button is drawn wherever marking is possible, and only with two seeds to measure.
  assert.match(script, /const markingControls = liveTradingLevelsCanMark\(\)/);
  assert.match(script, /seedLevels\.length >= 2 \? "" : " disabled"/);
  // The reported spacing is what the file says, not a number the page worked out for itself.
  assert.match(script, /generated\.spacing_points/);
  assert.match(script, /generated\.anchor_low, instrument\.digits\)\} to \$\{liveTradingLevelPriceText\(generated\.anchor_high/);
  // Both actions share one request: the plain duplication and the extension the alert offers.
  assert.match(script, /async function requestLiveTradingLadder\(above, below, describe\) \{/);
  assert.match(script, /await requestLiveTradingLadder\(above, below, "Duplicating"\);/);

  assert.match(css, /\.live-trading-chart-ladder \{/);
  assert.match(css, /\.live-trading-chart-ladder-step \{/);
  assert.match(css, /\.live-trading-chart-ladder-step:focus/);
  assert.match(css, /\.live-trading-chart-mark:disabled/);
  assert.match(css, /\.live-trading-chart-level-chip\.derived \{/);
});




// The ladder arithmetic and the out-of-bounds alert. `data/l2l-levels.json` is the published artifact,
// `lib/l2l_ladder.js` is the one place its geometry is worked out, and the dashboard is where a reader
// sees the result. Everything below holds the three together.
function ladderLevels(options = {}) {
  const above = options.above === undefined ? 10 : options.above;
  const below = options.below === undefined ? 10 : options.below;
  const measurement = { spacing_price: 175, anchor_high: 4137.5, anchor_low: 3962.5 };
  const levels = [
    { price: 4137.5, role: "seed", ...measurement },
    { price: 3962.5, role: "seed", ...measurement }
  ];
  for (let index = 1; index <= above; index += 1) {
    levels.push({ price: 4137.5 + index * 175, role: "derived", ...measurement });
  }
  for (let index = 1; index <= below; index += 1) {
    levels.push({ price: 3962.5 - index * 175, role: "derived", ...measurement });
  }
  return levels;
}

test("the shared ladder module owns the numbers the writer and the page both use", () => {
  // Ten each way is the default ladder the user asked for, and one ladder step is the alert band.
  assert.equal(ladder.DEFAULT_STEPS, 10);
  assert.equal(ladder.EXTEND_STEPS, 10);
  assert.equal(ladder.ALERT_BAND_STEPS, 1);
  assert.ok(ladder.MAX_STEPS >= ladder.DEFAULT_STEPS * 3, "the cap has to leave room for extensions");
  assert.deepEqual([...ladder.STATES], ["none", "approaching", "beyond"]);
  // The writer refuses a count above its own cap, so the two numbers have to be the same number.
  assert.equal(DEFAULT_DUPLICATE_STEPS, ladder.DEFAULT_STEPS);
  assert.equal(MAX_DUPLICATE_STEPS, ladder.MAX_STEPS);
  // Only positive prices are read, and a level without a role counts as a hand-marked seed.
  const read = ladder.readLevels([{ price: "1.1" }, { price: 0 }, { price: 2, role: "derived" }, null]);
  assert.deepEqual(read.map(entry => [entry.price, entry.role]), [[1.1, "seed"], [2, "derived"]]);
});

test("the ladder bounds come from the published levels, not from a guess", () => {
  const stats = ladder.ladderStats(ladderLevels(), { point: 0.01 });
  assert.equal(stats.available, true);
  assert.equal(stats.seedCount, 2);
  assert.equal(stats.derivedCount, 20);
  assert.equal(stats.anchorHigh, 4137.5);
  assert.equal(stats.anchorLow, 3962.5);
  assert.equal(stats.outerHigh, 5887.5);
  assert.equal(stats.outerLow, 2212.5);
  assert.equal(stats.spacing, 175);
  assert.equal(stats.spacingPoints, 17500);
  assert.equal(stats.above, 10);
  assert.equal(stats.below, 10);

  // Two seeds and no duplication are not a ladder: there is no published line to be close to.
  const seedsOnly = ladder.ladderStats([{ price: 4137.5, role: "seed" }, { price: 3962.5, role: "seed" }], { point: 0.01 });
  assert.equal(seedsOnly.available, false);
  assert.equal(seedsOnly.outerHigh, null);
  assert.equal(seedsOnly.seedCount, 2);
  assert.equal(seedsOnly.spacing, null);
  assert.equal(ladder.ladderStats(null).available, false);
});

test("the alert fires one ladder step from the outermost line and once price is past it", () => {
  const levels = ladderLevels();

  const inside = ladder.ladderAlert(levels, 4000, { point: 0.01, steps: 10 });
  assert.equal(inside.active, false);
  assert.equal(inside.state, "none");
  assert.equal(inside.side, null);
  assert.equal(inside.nextSteps, null);

  // 5787.5 is exactly one step (175) inside the top line 5887.5, which is where the band starts.
  const high = ladder.ladderAlert(levels, 5787.5, { point: 0.01, steps: 10 });
  assert.equal(high.active, true);
  assert.equal(high.state, "approaching");
  assert.equal(high.side, "high");
  assert.equal(high.level, 5887.5);
  assert.equal(high.distancePoints, -10000);
  assert.deepEqual(high.nextSteps, { side: "high", addedAbove: 10, addedBelow: 0, above: 20, below: 10, spacing: 175 });

  const past = ladder.ladderAlert(levels, 6000, { point: 0.01, steps: 10 });
  assert.equal(past.state, "beyond");
  assert.equal(past.side, "high");
  assert.equal(past.distancePoints, 11250);

  // The same rule below: 2300 is inside the band above the bottom line 2212.5.
  const low = ladder.ladderAlert(levels, 2300, { point: 0.01, steps: 10 });
  assert.equal(low.state, "approaching");
  assert.equal(low.side, "low");
  assert.deepEqual(low.nextSteps, { side: "low", addedAbove: 0, addedBelow: 10, above: 10, below: 20, spacing: 175 });
  assert.equal(ladder.ladderAlert(levels, 2000, { point: 0.01, steps: 10 }).state, "beyond");

  // A price the snapshot does not carry raises nothing rather than a made-up reading, and a ladder whose
  // own file records no distance cannot be judged at all.
  assert.equal(ladder.ladderAlert(levels, null, { point: 0.01 }).active, false);
  assert.equal(ladder.ladderAlert(levels, Number.NaN, { point: 0.01 }).active, false);
  assert.equal(ladder.ladderAlert([{ price: 4137.5, role: "seed" }, { price: 4137.5, role: "derived" }], 4137.5).active, false);
});

test("an extension repeats the measurement ten more steps on the side that ran out", () => {
  const stats = ladder.ladderStats(ladderLevels(), { point: 0.01 });
  assert.deepEqual(ladder.ladderExtension(stats, "high", { steps: 10 }), {
    side: "high", addedAbove: 10, addedBelow: 0, above: 20, below: 10, spacing: 175
  });
  assert.deepEqual(ladder.ladderExtension(stats, "low", { steps: 10 }), {
    side: "low", addedAbove: 0, addedBelow: 10, above: 10, below: 20, spacing: 175
  });
  // With no side to extend - a caller reading the ladder without an alert - both directions grow.
  assert.deepEqual(ladder.ladderExtension(stats, null, { steps: 10 }), {
    side: null, addedAbove: 10, addedBelow: 10, above: 20, below: 20, spacing: 175
  });
  // The default step count is the module's own, so an extension with no count still adds ten.
  assert.equal(ladder.ladderExtension(stats, "high").addedAbove, ladder.EXTEND_STEPS);

  // Nothing to extend is null rather than a request for zero levels.
  assert.equal(ladder.ladderExtension(null, "high"), null);
  assert.equal(ladder.ladderExtension({ available: false, above: 0, below: 0 }, "high"), null);
  // A side already at the cap cannot grow further, while the other side still can.
  const atCap = { available: true, above: ladder.MAX_STEPS, below: 0, spacing: 175 };
  assert.equal(ladder.ladderExtension(atCap, "high", { steps: 10 }), null);
  assert.deepEqual(ladder.ladderExtension(atCap, "low", { steps: 10 }), {
    side: "low", addedAbove: 0, addedBelow: 10, above: ladder.MAX_STEPS, below: 10, spacing: 175
  });
});

test("the level lines stay at their price: drawn across the plot, counted when out of view", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  // A line spans the whole plot at the price it was published at, so scanning back and forward reads the
  // same numbers rather than a ladder re-based to whatever window is on screen.
  assert.match(script, /x1="\$\{plotX0\}" y1="\$\{ly\.toFixed\(2\)\}" x2="\$\{plotX1\}" y2="\$\{ly\.toFixed\(2\)\}"/);
  // A line outside the drawn window is counted rather than clamped onto the edge, which would draw a
  // ladder that is not there.
  assert.match(script, /const inView = levels\.filter\(level => Number\(level\.price\) >= min && Number\(level\.price\) <= max\);/);
  assert.equal(script.includes("const ly = Math.min(plotY1, Math.max(plotY0, yAt(price)));"), false);
  assert.match(script, /liveTradingChartScale\.levelView = \{/);
  assert.match(script, /lines in view/);
  // Ten steps each way only widen the window when the reader asks, so the candles stay readable.
  assert.match(script, /if \(liveTradingChartFitLevels\) \{/);
  assert.match(script, /data-live-chart-fit-levels/);
  assert.match(script, /liveTradingChartFitLevels = !liveTradingChartFitLevels;/);
  // The outer bounds are on the caption either way, so the panel always says where the ladder ends.
  assert.match(script, /ladder \$\{liveTradingLevelPriceText\(ladderStats\.outerLow, digits\)\} to \$\{liveTradingLevelPriceText\(ladderStats\.outerHigh, digits\)\}/);
});

test("the dashboard raises the out-of-bounds alert and offers the extension", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  // The page loads the shared module before the script that reads it.
  const moduleTag = html.indexOf("lib/l2l_ladder.js");
  const scriptTag = html.indexOf("script.js?v=");
  assert.ok(moduleTag > 0 && moduleTag < scriptTag, "lib/l2l_ladder.js has to load before script.js");
  assert.match(script, /const liveTradingLadderMath = \(typeof globalThis !== "undefined" && globalThis\.L2LLadder\) \|\| null;/);
  assert.match(script, /function liveTradingLadderStats\(instrument\) \{/);
  assert.match(script, /function liveTradingLadderAlert\(instrument\) \{/);
  assert.match(script, /function liveTradingLadderAlertNotice\(alert, instrument, digits\) \{/);
  assert.match(script, /function liveTradingLadderExtensionPlan\(instrument\) \{/);
  // The reading is the live mid, then the bid, then the newest M5 close: never an invented price.
  assert.match(script, /function liveTradingAlertPrice\(instrument\) \{/);
  assert.match(script, /const newest = bars\[bars\.length - 1\];/);
  // It is announced as a reading, and the sentence names the bound it is about.
  assert.match(script, /class="live-trading-chart-ladder-alert \$\{escapeHtml\(ladderAlert\.state\)\}" role="status" aria-live="polite"/);
  assert.match(script, /Ladder alert: \$\{symbol\} \$\{price\} is past the \$\{side\} ladder bound/);
  assert.match(script, /is within one ladder step of the \$\{side\} bound/);
  assert.match(script, /Repeat the same L2L distance for \$\{count\} more levels \$\{where\}/);
  assert.match(script, /live-trading-chart-badge alert" title="Live price has reached the outermost published L2L level"/);
  // The extension is the only action the alert offers, and it asks for the published counts plus ten.
  assert.match(script, /async function extendLiveTradingLadder\(side\) \{/);
  assert.match(script, /data-live-level-extend="\$\{ladderAlert\?\.side === "low" \? "low" : "high"\}"/);
  assert.match(script, /liveTradingLadderMath\.ladderExtension\(stats, alert\.side, \{ steps: LIVE_TRADING_LADDER_EXTEND_STEPS \}\)/);
  assert.match(script, /extendLiveTradingLadder\(extendButton\.dataset\.liveLevelExtend \|\| null\);/);
  // Clearing a symbol puts the two step boxes back to the default ladder width.
  assert.match(script, /liveTradingLadderSteps = \{ above: null, below: null \};/);

  assert.match(css, /\.live-trading-chart-ladder-alert \{/);
  assert.match(css, /\.live-trading-chart-ladder-alert\.beyond \{/);
  assert.match(css, /\.live-trading-chart-badge\.alert \{/);
  assert.match(css, /\.live-trading-chart-mark\.extend \{/);
  assert.match(css, /\.live-trading-chart-level\.alert \{/);
});

// The two-tier store of the published page: this browser's own draft first, then a commit to the reader's
// own repository through the reader's own token. The published artifact is what everyone reads, so the
// tests below hold the page, the module and that artifact together around the split.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// A fetch that records what it was asked for, so a request can be asserted without a network. The reply can
// be a response, a function of the call, or an Error to throw.
function recordingFetch(reply) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const answer = typeof reply === "function" ? reply(url, init, calls.length) : reply;
    if (answer instanceof Error) throw answer;
    return answer;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("the page loads the shared levels store before the script that reads it", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  const script = fs.readFileSync(scriptPath, "utf8");
  const store = fs.readFileSync(storePath, "utf8");

  // One module, loaded by the page and required by the loopback tool, so the two writers cannot drift.
  const moduleTag = html.indexOf("lib/l2l_levels_store.js");
  const scriptTag = html.indexOf("script.js?v=");
  assert.ok(moduleTag > 0, "index.html has to load lib/l2l_levels_store.js");
  assert.ok(moduleTag < scriptTag, "lib/l2l_levels_store.js has to load before script.js");
  assert.match(html, /<script src="lib\/l2l_levels_store\.js\?v=[^"]+"><\/script>/);
  assert.match(store, /globalRoot\.L2LLevelsStore = factory\(\);/);
  assert.match(store, /module\.exports = factory\(\);/);

  // The page never re-implements the edit rules: it applies the same edit the tool would, through the
  // module, and names the dashboard as the writer.
  assert.match(script, /function applyLiveTradingLevelEdit\(payload\) \{/);
  assert.match(script, /liveTradingLevelsStore\.normaliseEdit\(payload, nowIso\)/);
  assert.match(script, /liveTradingLevelsStore\.applyLevelEdit\(/);
  assert.match(script, /liveTradingLevelsStore\.MARKED_BY\.dashboard/);
});

test("a mark made without the loopback tool is kept in this browser first", () => {
  const script = fs.readFileSync(scriptPath, "utf8");

  // The draft is written on every accepted edit, with the sha the page had read, so a later publish knows
  // what it was based on.
  assert.match(script, /liveTradingLevelsStore\.writeDraft\(liveTradingLevelsStorage\("persistent"\), liveTradingLevelsData, \{/);
  assert.match(script, /base_sha: liveTradingPublish\.remote_sha/);
  assert.match(script, /function liveTradingReadDraft\(\) \{/);
  // It is the version shown only where the page is the local copy: a page served by the loopback tool has
  // the file on this machine instead, and must not show a stale browser copy over it.
  assert.match(script, /const draft = liveTradingLevelsEndpoint \? null : liveTradingReadDraft\(\);/);
  assert.match(script, /liveTradingPublish\.draft_saved_at_utc = draft\.saved_at_utc;/);
  assert.match(script, /liveTradingPublish\.remote_sha = draft\.base_sha \|\| null;/);
  // The draft is shown only when it is newer than the file committed to the repository, so a stale copy left
  // in one browser cannot hide the levels every other reader sees.
  assert.match(script, /liveTradingLevelsStore\.chooseLevelsView\(liveTradingLevelsData, draft\)/);
  assert.match(script, /liveTradingPublish\.shown_source = view\.source;/);
  // What the reader is told, and the copy they can keep by hand even if storage was refused.
  assert.match(script, /Saved in this browser: publish it to make it live\./);
  assert.match(script, /function liveTradingExportLevels\(\) \{/);
  assert.match(script, /liveTradingLevelsStore\.serialiseState\(liveTradingLevelsData\)/);
  assert.match(script, /link\.download = "l2l-levels\.json";/);
  assert.match(script, /data-live-level-export/);
  assert.match(script, /and is not published yet, so nobody else sees it/);
});

test("publishing sends one file to the reader's own repository and nothing else", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  // The box is drawn only where this browser is the store: with the loopback tool the file on this machine
  // is already the local copy, so there is nothing for the page to publish.
  assert.match(script, /if \(!liveTradingLevelsCanMark\(\) \|\| liveTradingLevelsEndpoint\) return "";/);
  assert.match(script, /\$\{liveTradingPublishPanel\(\)\}/);
  assert.match(script, /data-live-publish-repo/);
  assert.match(script, /data-live-publish-branch/);
  assert.match(script, /data-live-publish-token/);
  assert.match(script, /data-live-publish-remember/);
  assert.match(script, /data-live-publish-save/);
  // The token is a password field held in this tab unless the reader asks for it on the device, and
  // Disconnect takes it out of both. It is never written into the levels document.
  assert.match(script, /class="live-trading-chart-publish-input token" id="liveTradingPublishToken" type="password"/);
  assert.match(script, /function liveTradingDisconnectPublish\(\) \{/);
  assert.match(script, /liveTradingLevelsStore\.clearSettings\(liveTradingLevelsStorage\("persistent"\), liveTradingLevelsStorage\("session"\)\);/);
  assert.match(script, /data-live-level-disconnect/);
  assert.match(script, /never written into the levels file/);

  // One file, one commit, in the reader's own repository: the sha the page read is what stops a newer
  // published version from being replaced silently, and Publish anyway is the reader's own decision.
  assert.match(script, /const result = await liveTradingLevelsStore\.commitLevels\(\{/);
  assert.match(script, /path: target\.path,/);
  assert.match(script, /expectedSha: liveTradingPublish\.remote_sha,/);
  assert.match(script, /force: force === true/);
  assert.match(script, /liveTradingPublish\.conflict = result\.conflict === true;/);
  assert.match(script, /data-live-level-publish-force/);
  assert.match(script, /publishLiveTradingLevels\(false, panel\);/);
  assert.match(script, /publishLiveTradingLevels\(true, panel\);/);
  // Reading the published file back is the same one path, and it reports a missing file as the first
  // publish creating it rather than as a failure.
  assert.match(script, /await liveTradingLevelsStore\.readRemoteLevels\(\{/);
  assert.match(script, /data-live-level-reload/);
  assert.match(script, /the first publish creates it/);
  // The draft is cleared once the file it held is published, so the two tiers cannot disagree after a
  // commit.
  assert.match(script, /liveTradingClearDraft\(\);/);
  assert.match(script, /Publishing needs a GitHub token with Contents: read and write on this repository\./);

  // This path places nothing and talks to no one else.
  ["whatsapp", "twilio", "SendOrder", "order_send", "MetaTrader5", "child_process"].forEach(banned => {
    assert.equal(script.includes(banned), false, `${banned} must not appear in the dashboard`);
  });

  // The box is read without re-rendering the panel, for the same reason the ladder boxes are: a re-render
  // on every keystroke would take the caret out of the box being typed in.
  assert.match(script, /\[data-live-publish-repo\], \[data-live-publish-branch\], \[data-live-publish-token\], \[data-live-publish-remember\]/);
  assert.match(script, /\[data-live-publish-remember\]"\)\) liveTradingReadPublishInputs\(panel\);/);

  assert.match(css, /\.live-trading-chart-publish \{/);
  assert.match(css, /\.live-trading-chart-publish-input/);
  assert.match(css, /\.live-trading-chart-publish-input\.token/);
  assert.match(css, /\.live-trading-chart-mark\.publish/);
  assert.match(css, /\.live-trading-chart-publish-status/);
});

test("the browser draft and the publishing settings stay in the browser", () => {
  const device = fakeStorage();
  const tab = fakeStorage();
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));

  assert.equal(readDraft(device), null);
  assert.equal(writeDraft(device, state, { saved_at_utc: STAMP, base_sha: "abc123" }), true);
  const draft = readDraft(device);
  assert.equal(draft.saved_at_utc, STAMP);
  assert.equal(draft.base_sha, "abc123");
  assert.equal(serialiseState(draft.state), serialiseState(state));

  // A draft that no longer validates is ignored rather than loaded, so a half-written or hand-edited entry
  // cannot replace the published levels with something the chart would misread.
  device.setItem(DRAFT_KEY, JSON.stringify({ saved_at_utc: STAMP, base_sha: null, state: { instruments: [] } }));
  assert.equal(readDraft(device), null);
  device.setItem(DRAFT_KEY, "{not json");
  assert.equal(readDraft(device), null);
  clearDraft(device);
  assert.equal(readDraft(device), null);

  // The token is kept in this tab unless the reader asks for it on the device, and Disconnect takes it out
  // of both. Nothing here writes it into the levels document.
  assert.deepEqual(readSettings(device, tab), {
    repo: DEFAULT_REPO, branch: DEFAULT_BRANCH, remember: false, token: "", token_scope: "none"
  });
  assert.deepEqual(writeSettings(device, tab, { repo: "owner/repo", branch: "main", token: "ghp_example", remember: false }), {
    stored: true, token_scope: "session"
  });
  assert.equal(device.getItem(SETTINGS_KEY), null);
  assert.equal(readSettings(device, tab).token, "ghp_example");
  assert.equal(readSettings(device, tab).token_scope, "session");
  assert.equal(serialiseState(state).includes("ghp_example"), false);

  assert.deepEqual(writeSettings(device, tab, { repo: "owner/repo", branch: "trunk", token: "ghp_example", remember: true }), {
    stored: true, token_scope: "device"
  });
  assert.equal(readSettings(device, tab).token_scope, "device");
  assert.equal(readSettings(device, tab).branch, "trunk");
  clearSettings(device, tab);
  assert.equal(readSettings(device, tab).token, "");
  assert.equal(readSettings(device, tab).token_scope, "none");

  // A browser that refuses storage still marks: the write reports false rather than throwing.
  const refused = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); }
  };
  assert.equal(writeDraft(refused, state, { saved_at_utc: STAMP }), false);
  assert.equal(readDraft(refused), null);
  assert.equal(readSettings(refused, refused).token_scope, "none");
});

test("the publishing target is one repository, one branch and one path", () => {
  const target = normalisePublishTarget({
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    path: DEFAULT_STATE_PATH
  });
  assert.deepEqual(target, {
    ok: true,
    owner: "kevincreedycars-debug",
    repo: "trading-agent-dashboard",
    branch: "main",
    path: "data/l2l-levels.json"
  });

  // A pasted URL or a .git suffix names the same repository, because that is what a reader copies off
  // GitHub. The branch and the path fall back to the artifact's own.
  assert.deepEqual(parseRepo("https://github.com/kevincreedycars-debug/trading-agent-dashboard.git"), {
    owner: "kevincreedycars-debug", repo: "trading-agent-dashboard"
  });
  const defaults = normalisePublishTarget({ repo: DEFAULT_REPO });
  assert.equal(defaults.branch, DEFAULT_BRANCH);
  assert.equal(defaults.path, DEFAULT_STATE_PATH);

  // Anything that is not owner/repo is refused with an example of what is.
  ["", "/", "trading-agent-dashboard", "a/b/c", "own er/repo"].forEach(value => {
    assert.equal(parseRepo(value), null, `${value} is not a repository`);
    const refused = normalisePublishTarget({ repo: value, branch: "main", path: DEFAULT_STATE_PATH });
    assert.equal(refused.ok, false);
    assert.match(refused.error, /owner\/repo, for example/);
  });

  // The path keeps its slashes; only the characters inside each segment are encoded.
  assert.equal(encodeContentPath("data/l2l-levels.json"), "data/l2l-levels.json");
  assert.equal(encodeContentPath("data/sub dir/l2l-levels.json"), "data/sub%20dir/l2l-levels.json");
  assert.equal(contentsUrl("owner", "repo", "data/l2l-levels.json"), "https://api.github.com/repos/owner/repo/contents/data/l2l-levels.json");
});

test("the two request builders are the whole of the network surface", () => {
  const read = buildReadRequest({ owner: "owner", repo: "repo", branch: "release/2026", token: "ghp_example", path: "data/l2l-levels.json" });
  assert.equal(read.url, "https://api.github.com/repos/owner/repo/contents/data/l2l-levels.json?ref=release%2F2026");
  assert.equal(read.init.method, "GET");
  assert.equal(read.init.body, undefined, "a read cannot write anything");
  assert.equal(read.init.headers.Authorization, "Bearer ghp_example");
  assert.equal(read.init.headers.Accept, "application/vnd.github+json");
  assert.equal(read.init.headers["X-GitHub-Api-Version"], "2022-11-28");

  const write = buildCommitRequest({
    owner: "owner", repo: "repo", branch: "main", token: "ghp_example",
    path: "data/l2l-levels.json", content: "{\"a\":1}", sha: "abc123", message: "Mark L2L levels"
  });
  assert.equal(write.url, "https://api.github.com/repos/owner/repo/contents/data/l2l-levels.json");
  assert.equal(write.init.method, "PUT");
  assert.deepEqual(JSON.parse(write.init.body), {
    message: "Mark L2L levels",
    content: toBase64("{\"a\":1}"),
    branch: "main",
    sha: "abc123"
  });
  // A file that does not exist yet is created without a sha.
  const create = buildCommitRequest({
    owner: "owner", repo: "repo", branch: "main", token: "ghp_example",
    path: "data/l2l-levels.json", content: "{}", message: "First publish"
  });
  assert.equal("sha" in JSON.parse(create.init.body), false);

  // Every failure names a remedy and never repeats what was sent, so a token cannot be printed by accident
  // into a status line or a screenshot.
  assert.match(describeStatus(401), /^GitHub refused the token \(401\)/);
  assert.match(describeStatus(403), /Contents: read and write/);
  assert.match(describeStatus(404), /Check the repository name/);
  assert.match(describeStatus(409), /Reload the page and publish again/);
  assert.equal(describeStatus(422), describeStatus(409));
  assert.match(describeStatus(500), /the commit did not happen/);
  [401, 403, 404, 409, 422, 500].forEach(status => {
    assert.equal(describeStatus(status).includes("ghp_"), false);
    assert.equal(describeStatus(status).includes("Bearer"), false);
  });
});

test("reading the published file back turns the repository answer into the same document", async () => {
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const target = { owner: "kevincreedycars-debug", repo: "trading-agent-dashboard", branch: "main", path: DEFAULT_STATE_PATH, token: "ghp_example" };

  const fetchImpl = recordingFetch(jsonResponse({ sha: "abc123", content: toBase64(serialiseState(state)) }));
  const remote = await readRemoteLevels({ fetchImpl, ...target });
  assert.equal(remote.ok, true);
  assert.equal(remote.sha, "abc123");
  assert.equal(remote.missing, false);
  assert.equal(serialiseState(remote.state), serialiseState(state));

  // One GET of one file on one branch, with the reader's token as a header.
  assert.equal(fetchImpl.calls.length, 1);
  const [call] = fetchImpl.calls;
  assert.equal(call.url, "https://api.github.com/repos/kevincreedycars-debug/trading-agent-dashboard/contents/data/l2l-levels.json?ref=main");
  assert.equal(call.init.method, "GET");
  assert.equal(call.init.cache, "no-store");

  // A file that is not there yet is not an error: the first publish creates it.
  const absent = await readRemoteLevels({ fetchImpl: recordingFetch(jsonResponse({ message: "Not Found" }, 404)), ...target });
  assert.deepEqual(absent, { ok: true, status: 404, sha: null, state: null, missing: true });

  // An answer that cannot be read leaves the caller with nothing to replace, rather than guessing.
  const unreadable = await readRemoteLevels({
    fetchImpl: recordingFetch({ ok: true, status: 200, json: async () => { throw new Error("not json"); } }),
    ...target
  });
  assert.equal(unreadable.ok, false);
  assert.match(unreadable.error, /could not be read as JSON/);
  const notADocument = await readRemoteLevels({
    fetchImpl: recordingFetch(jsonResponse({ sha: "abc123", content: toBase64("not a levels file") })),
    ...target
  });
  assert.equal(notADocument.ok, true);
  assert.equal(notADocument.state, null);
  assert.equal(notADocument.missing, false);

  // A refused token and an unreachable host are reported as such, with no part of the request repeated.
  const refused = await readRemoteLevels({ fetchImpl: recordingFetch(jsonResponse({ message: "Bad credentials" }, 401)), ...target });
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 401);
  assert.match(refused.error, /401/);
  assert.equal(refused.error.includes("ghp_example"), false);
  const offline = await readRemoteLevels({ fetchImpl: recordingFetch(new Error("network down")), ...target });
  assert.equal(offline.ok, false);
  assert.equal(offline.status, 0);
  assert.match(offline.error, /Could not reach GitHub: network down/);
});

test("a commit refuses a bad document, a missing token and a file that moved", async () => {
  const state = applyOrFail(JSON.parse(fs.readFileSync(levelsPath, "utf8")), addRequest());
  const target = {
    owner: "kevincreedycars-debug",
    repo: "trading-agent-dashboard",
    branch: "main",
    path: DEFAULT_STATE_PATH
  };
  const everything = recordingFetch(jsonResponse({}, 200));

  // A document the shared checker would reject never reaches the network.
  const invalid = await commitLevels({
    fetchImpl: everything, ...target, token: "ghp_example", state: { schema_version: SCHEMA_VERSION }, message: "x"
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /Refusing to publish a levels file that would not validate/);
  assert.equal(everything.calls.length, 0);

  // Without a token there is nothing to authorise the write with.
  const bare = await commitLevels({ fetchImpl: everything, ...target, token: "", state, message: "x" });
  assert.equal(bare.ok, false);
  assert.match(bare.error, /A GitHub token is needed to publish/);
  assert.equal(everything.calls.length, 0);

  // A published file that moved since this page read it is not replaced silently: the refusal happens
  // after the read and before the write, and names the way out.
  const movedFetch = recordingFetch(jsonResponse({ sha: "newer_sha", content: toBase64(serialiseState(state)) }));
  const moved = await commitLevels({
    fetchImpl: movedFetch, ...target, token: "ghp_example", state, message: "x", expectedSha: "older_sha"
  });
  assert.equal(moved.ok, false);
  assert.equal(moved.conflict, true);
  assert.equal(moved.status, 409);
  assert.equal(moved.sha, "newer_sha");
  assert.match(moved.error, /publish anyway/);
  assert.equal(movedFetch.calls.length, 1);
  assert.equal(movedFetch.calls[0].init.method, "GET");

  // Publish anyway writes over it, and still names the sha being replaced.
  const forceFetch = recordingFetch(url => (url.includes("?ref=")
    ? jsonResponse({ sha: "newer_sha", content: toBase64(serialiseState(state)) })
    : jsonResponse({ content: { sha: "written_sha" }, commit: { sha: "commit_sha_1234567", html_url: "https://github.com/commit/1234567" } })));
  const forced = await commitLevels({
    fetchImpl: forceFetch, ...target, token: "ghp_example", state, message: "Mark L2L levels", expectedSha: "older_sha", force: true
  });
  assert.equal(forced.ok, true);
  assert.equal(forced.sha, "written_sha");
  assert.equal(forced.commit_sha, "commit_sha_1234567");
  assert.equal(forced.commit_url, "https://github.com/commit/1234567");
  assert.deepEqual(forceFetch.calls.map(call => call.init.method), ["GET", "PUT"]);
  const pushed = JSON.parse(forceFetch.calls[1].init.body);
  assert.equal(pushed.branch, "main");
  assert.equal(pushed.sha, "newer_sha");
  assert.equal(Buffer.from(pushed.content, "base64").toString("utf8"), serialiseState(state));

  // The first publish creates the file: the read answers 404, so the write carries no sha.
  const createFetch = recordingFetch(url => (url.includes("?ref=")
    ? jsonResponse({ message: "Not Found" }, 404)
    : jsonResponse({ content: { sha: "created_sha" }, commit: { sha: "created_commit" } })));
  const created = await commitLevels({ fetchImpl: createFetch, ...target, token: "ghp_example", state, message: "First publish" });
  assert.equal(created.ok, true);
  assert.equal(created.sha, "created_sha");
  assert.equal("sha" in JSON.parse(createFetch.calls[1].init.body), false);

  // A refused or failed write is reported with its own status and never with the token in it.
  for (const status of [401, 403, 409, 500]) {
    const failing = recordingFetch(url => (url.includes("?ref=")
      ? jsonResponse({ sha: "abc123", content: toBase64(serialiseState(state)) })
      : jsonResponse({ message: "no" }, status)));
    const result = await commitLevels({ fetchImpl: failing, ...target, token: "ghp_example", state, message: "x" });
    assert.equal(result.ok, false, `HTTP ${status} must not read as success`);
    assert.equal(result.status, status);
    assert.match(result.error, new RegExp(String(status)));
    assert.equal(result.error.includes("ghp_example"), false);
    assert.equal(failing.calls.length, 2);
  }
});

test("a browser without fetch reports it instead of throwing", async () => {
  const state = JSON.parse(fs.readFileSync(levelsPath, "utf8"));
  const target = { owner: "owner", repo: "repo", branch: "main", path: DEFAULT_STATE_PATH, token: "ghp_example" };

  // The stub stands in for a browser with no fetch at all: the global is missing rather than failing.
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = undefined;
    const remote = await readRemoteLevels({ ...target });
    assert.equal(remote.ok, false);
    assert.match(remote.error, /cannot reach GitHub/);
    const commit = await commitLevels({ ...target, state, message: "x" });
    assert.equal(commit.ok, false);
    assert.match(commit.error, /cannot reach GitHub/);
  } finally {
    globalThis.fetch = realFetch;
  }
});


// ---- Which copy of the levels the chart shows -----------------------------------------------------------

test("a mark already in the repository outranks a stale draft in one browser", () => {
  const base = applyOrFail(createEmptyState(STAMP), addRequest({ symbol: "BTCUSD", price: 83113.66 }));
  const published = {
    ...applyOrFail(base, addRequest({ symbol: "BTCUSD", price: 84568.53 })),
    generated_at_utc: "2026-10-04T13:00:00Z"
  };
  const draftNewer = {
    state: {
      ...applyOrFail(published, addRequest({ symbol: "BTCUSD", price: 87223.4 })),
      generated_at_utc: "2026-10-04T14:00:00Z"
    },
    saved_at_utc: "2026-10-04T14:00:00Z"
  };
  const draftStale = {
    state: { ...createEmptyState(STAMP), generated_at_utc: "2026-10-04T09:00:00Z" },
    saved_at_utc: "2026-10-04T09:00:00Z",
    base_sha: "abc123"
  };

  // Something marked in the repository is the durable copy, so a draft that predates it is set aside rather
  // than hiding the published levels. This is the shape the user reported: marks committed, and a chart
  // that showed none of them.
  const staleView = chooseLevelsView(published, draftStale);
  assert.equal(staleView.source, "published");
  assert.equal(serialiseState(staleView.state), serialiseState(published));
  assert.equal(levelsFor(staleView.state, "BTCUSD").length, 2);

  // A draft made after the published file is a change nobody has published yet, so it is what the reader is
  // shown - and the page says so rather than leaving them to guess which copy they are looking at.
  const newerView = chooseLevelsView(published, draftNewer);
  assert.equal(newerView.source, "draft");
  assert.equal(levelsFor(newerView.state, "BTCUSD").length, 3);
  assert.equal(newerView.published_at_utc, "2026-10-04T13:00:00Z");

  // Nothing published yet: the draft is all there is, and it is shown.
  assert.equal(chooseLevelsView(null, draftNewer).source, "draft");
  assert.equal(serialiseState(chooseLevelsView(null, draftNewer).state), serialiseState(draftNewer.state));
  // No draft: the published file is shown unchanged. Neither: nothing to show.
  assert.equal(chooseLevelsView(published, null).source, "published");
  assert.equal(chooseLevelsView(null, null).source, "none");
  assert.equal(chooseLevelsView(null, null).state, null);

  // A draft that cannot prove it is newer - no stamp, an unreadable one, or a published file with no stamp -
  // never hides a committed mark, and a draft with no state at all is not a copy of anything.
  assert.equal(chooseLevelsView(published, { state: draftNewer.state, saved_at_utc: "not a date" }).source, "published");
  assert.equal(chooseLevelsView({ ...published, generated_at_utc: undefined }, draftNewer).source, "published");
  assert.equal(chooseLevelsView(published, { saved_at_utc: "2026-10-04T14:00:00Z" }).source, "published");

  // The stamp reading the decision rests on, in one place.
  assert.equal(levelsStateStamp("2026-10-04T14:00:00Z") > levelsStateStamp("2026-10-04T13:00:00Z"), true);
  assert.equal(levelsStateStamp(""), null);
  assert.equal(levelsStateStamp(undefined), null);
});

test("the chart states a marked ladder it cannot draw, and keeps the reader's view", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  // A ladder step is far wider than the window 120 bars span, so the marked lines can all sit outside the
  // drawn price scale. The lines inside the window are drawn as lines; the ones outside it get a tab on the
  // edge they sit past, naming the count and the nearest price, and that tab is the Fit levels control, so
  // the ladder is either drawn or stated with one click to bring it into view.
  assert.match(script, /const levelsAbove = levels\s+\.filter\(level => Number\(level\.price\) > max\)/);
  assert.match(script, /const levelsBelow = levels\s+\.filter\(level => Number\(level\.price\) < min\)/);
  assert.match(script, /class="live-trading-chart-level-edge \$\{side\}" data-live-chart-fit-levels role="button" tabindex="0"/);
  assert.match(script, /nearest \$\{liveTradingPrice\(Number\(group\[0\]\.price\), digits\)\}/);
  assert.match(script, /\$\{levelEdgeTabs\}/);
  assert.equal(css.includes(".live-trading-chart-level-edge-box"), true);
  assert.equal(css.includes(".live-trading-chart-level-edge-text"), true);

  // The view the reader sets travels with the tab state, so a reload shows the same symbol, timeframe, style
  // and scale instead of an unfitted default with their own lines off-screen again.
  assert.match(script, /liveTradingChart: \{\s+symbol: liveTradingChartSymbol,\s+timeframe: liveTradingChartTimeframe,\s+mode: liveTradingChartMode,\s+fitLevels: liveTradingChartFitLevels\s+\}/);
  assert.match(script, /const savedChart = parsed\.liveTradingChart && typeof parsed\.liveTradingChart === "object"/);
  assert.match(script, /if \(LIVE_TRADING_TIMEFRAMES\.some\(entry => entry\.key === savedChart\.timeframe\)\) liveTradingChartTimeframe = savedChart\.timeframe;/);
  assert.match(script, /if \(savedChart\.mode === "line" \|\| savedChart\.mode === "candles"\) liveTradingChartMode = savedChart\.mode;/);
  assert.match(script, /liveTradingChartFitLevels = savedChart\.fitLevels === true;/);
  // Every chart control that changes the view writes it: symbol, timeframe, style and the fit control.
  assert.equal(
    (script.match(/saveNavigationState\(\);\s+renderLiveTrading\(liveTradingData \|\| \{\}\);/g) || []).length,
    4
  );
});

