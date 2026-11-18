// Guard for the document library the Architecture map opens beneath each replay chamber.
//
// The library is presentation data over committed files, so the test holds three things: every path it names exists,
// the five groups and the four USD tests carry the statements the map renders, and nothing operator-owned is linked.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const libraryPath = path.join(repoRoot, "lib", "factory-library.js");

function loadLibrary() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(libraryPath, "utf8"), sandbox, { filename: "lib/factory-library.js" });
  // Round-tripped through JSON so the sandbox's array prototypes cannot make identical data compare unequal.
  const library = JSON.parse(JSON.stringify(sandbox.window.FactoryLibrary));
  library.groupById = id => library.groups.find(group => group.id === id) || null;
  library.documentsFor = (code, groupId) =>
    library.assets[code] ? library.assets[code].documents.filter(doc => doc.group === groupId) : [];
  library.countsFor = code => {
    const asset = library.assets[code];
    if (!asset) return { documents: 0, used: 0, related: 0, tests: 0, gaps: 0 };
    const used = asset.documents.filter(doc => doc.used).length;
    return {
      documents: asset.documents.length,
      used,
      related: asset.documents.length - used,
      tests: asset.tests.length,
      gaps: asset.gaps.length
    };
  };
  return library;
}

test("the library keeps the five groups in investigation order, for all eight assets", () => {
  const library = loadLibrary();
  assert.equal(library.schemaVersion, "factory-library-v1");
  assert.deepEqual(library.groups.map(group => group.id), ["research", "model", "inputs", "replay", "results"]);
  assert.deepEqual(
    library.groups.map(group => group.label),
    [
      "Research and adjudication",
      "Model and decision rules",
      "Historical inputs",
      "Replay and validation checks",
      "Results"
    ]
  );
  assert.deepEqual(Object.keys(library.assets).sort(), ["BTC", "EUR", "GBP", "GOLD", "NQ", "SILVER", "USD", "WTI"]);
  for (const group of library.groups) {
    assert.ok(group.note.length > 20, `${group.id} explains itself`);
  }
  for (const [code, asset] of Object.entries(library.assets)) {
    assert.equal(asset.code, code);
    assert.ok(asset.chamber.length > 20, `${code} states what its chamber does`);
    assert.ok(asset.documents.length > 0, `${code} names at least one document`);
  }
});

test("every document and every test artefact the library names is committed", () => {
  const library = loadLibrary();
  const ids = new Set();
  for (const [code, asset] of Object.entries(library.assets)) {
    for (const doc of asset.documents) {
      assert.ok(!ids.has(doc.id), `${doc.id} is unique`);
      ids.add(doc.id);
      assert.ok(library.groupById(doc.group), `${doc.id} names a real group`);
      assert.match(doc.path, /^[a-z0-9_]+\/[^:\s]+$/, `${doc.id} is a repository-relative path`);
      assert.match(doc.path, /\.[a-z0-9]+$/, `${doc.id} names a file`);
      assert.ok(fs.existsSync(path.join(repoRoot, doc.path)), `${code} ${doc.id} -> ${doc.path} exists`);
      assert.ok(doc.title.length > 3, `${doc.id} has a title`);
      assert.ok(doc.question.endsWith("?"), `${doc.id} asks a question`);
      assert.ok(doc.belongsTo.length > 3, `${doc.id} names what it belongs to`);
      assert.equal(typeof doc.used, "boolean", `${doc.id} says whether the replay reads it`);
    }
    for (const testCase of asset.tests) {
      assert.ok(fs.existsSync(path.join(repoRoot, testCase.resultPath)), `${code} ${testCase.id} artefact exists`);
      assert.ok(testCase.market.length > 10, `${code} ${testCase.id} names its market`);
      assert.ok(testCase.logic.length > 20, `${code} ${testCase.id} states its logic`);
      assert.ok(testCase.data.length > 20, `${code} ${testCase.id} names the data it needs`);
      assert.ok(testCase.resultNote.length > 20, `${code} ${testCase.id} names its result artefact`);
      assert.ok(["blocked", "scored"].includes(testCase.status), `${code} ${testCase.id} has a known status`);
    }
  }
});

test("the USD chamber exposes four tests, matching the run artefact's own sections", () => {
  const library = loadLibrary();
  const usd = library.assets.USD;
  const run = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/usd-layer1-backtester/run-v1.json"), "utf8"));
  assert.deepEqual(usd.tests.map(item => item.id), [
    "dxy_direction",
    "four_markets",
    "l2l_full_5r",
    "l2l_half_3r"
  ]);
  assert.deepEqual(usd.tests.map(item => item.code), ["T1", "T2", "T3", "T4"]);
  for (const testCase of usd.tests) {
    assert.ok(run.tests[testCase.artefactKey], `${testCase.id} points at tests.${testCase.artefactKey} in the run`);
    assert.equal(testCase.resultPath, "data/usd-layer1-backtester/run-v1.json");
  }
  // The two line-to-line tests are blocked in the artefact, and the library must not present them as results.
  for (const id of ["l2l_full_5r", "l2l_half_3r"]) {
    const testCase = usd.tests.find(item => item.id === id);
    assert.equal(testCase.status, "blocked");
    assert.match(testCase.statusLabel, /blocked/i);
    assert.match(testCase.resultNote, /blocked|blocker/i);
  }
  assert.equal(usd.tests.find(item => item.id === "four_markets").status, "scored");
  const t2 = usd.tests.find(item => item.id === "four_markets");
  assert.ok(t2.historical, "T2 carries the historical rows it renders");
  assert.equal(t2.historical.generatedAt, run.generated_at, "the historical date is the artefact's own timestamp");
  assert.equal(t2.historical.artefactPath, "data/usd-layer1-backtester/run-v1.json");
  assert.match(run.run.current_model_version, /agent_usd_direction\.md/, "the model note names the baseline the artefact records");
  const currentMarkets = Object.values(run.tests.four_markets.models.current.markets);
  assert.equal(t2.historical.rows.length, 4, "T2 renders all four markets");
  for (const row of t2.historical.rows) {
    const market = currentMarkets.find(item => item.label === row.market);
    assert.ok(market, `${row.market} is a market in tests.four_markets.models.current`);
    assert.equal(row.scored, market.overall.scored, `${row.market} scored-session count matches the artefact`);
    assert.equal(row.accuracyPct, market.overall.accuracy_pct, `${row.market} accuracy matches the artefact`);
  }
});

test("the library separates what the replay reads from related research", () => {
  const library = loadLibrary();
  const usd = library.assets.USD;
  const logic = usd.documents.find(doc => doc.path === "logic/agent_usd_direction.md");
  const catalogue = usd.documents.find(doc => doc.path === "data/research-library/catalog.json");
  assert.equal(logic.used, true, "the replay core reads the logic document");
  assert.equal(catalogue.used, false, "the 25-chain catalogue is related research");
  for (const [code, asset] of Object.entries(library.assets)) {
    const used = asset.documents.filter(doc => doc.used);
    assert.ok(used.length > 0, `${code} names at least one document the replay reads`);
    used.forEach(doc => assert.doesNotMatch(doc.path, /catalog\.json|handoff|prompt/, `${doc.id} is not research-only`));
  }
});

test("an asset without a documented replay shows its evidence and names the gap", () => {
  const library = loadLibrary();
  for (const code of ["SILVER", "WTI", "GBP"]) {
    const asset = library.assets[code];
    assert.deepEqual(asset.tests, [], `${code} offers no test it cannot run`);
    const gaps = asset.gaps.map(gap => gap.group);
    assert.ok(gaps.includes("inputs"), `${code} says its historical inputs are missing`);
    assert.ok(gaps.includes("replay"), `${code} says its replay runner is missing`);
    assert.ok(
      asset.gaps.every(gap => gap.text.length > 20),
      `${code} writes each gap out`
    );
    assert.ok(
      asset.documents.some(doc => doc.group === "model"),
      `${code} still shows the logic document it does have`
    );
  }
  for (const code of ["EUR", "GOLD", "NQ", "BTC"]) {
    const asset = library.assets[code];
    assert.deepEqual(asset.tests, [], `${code} has no documented test set`);
    assert.ok(
      asset.gaps.some(gap => gap.group === "results"),
      `${code} records that no replay report is committed`
    );
    assert.ok(
      asset.documents.every(doc => doc.group !== "results"),
      `${code} does not invent a result document`
    );
  }
});

test("the library links no operator material and no collector export", () => {
  const library = loadLibrary();
  const withheld = [
    /^docs\/live-trading\/(?:VPS_|LANE2_VPS|FTMO_SETUP_GUIDE|SECOND_LANE_HALF_L2L|STRATEGY_LIVE)/,
    /^exports\/[a-z0-9_]+_collector\.json$/
  ];
  for (const [code, asset] of Object.entries(library.assets)) {
    for (const doc of asset.documents) {
      for (const pattern of withheld) {
        assert.doesNotMatch(doc.path, pattern, `${code} ${doc.id} must not link operator material`);
      }
    }
    for (const testCase of asset.tests) {
      for (const pattern of withheld) {
        assert.doesNotMatch(testCase.resultPath, pattern, `${code} ${testCase.id} must not link operator material`);
      }
    }
  }
});

test("the library counts what it renders", () => {
  const library = loadLibrary();
  for (const [code, asset] of Object.entries(library.assets)) {
    const counts = library.countsFor(code);
    assert.equal(counts.documents, asset.documents.length);
    assert.equal(counts.used, asset.documents.filter(doc => doc.used).length);
    assert.equal(counts.related, counts.documents - counts.used);
    assert.equal(counts.tests, asset.tests.length);
    assert.equal(counts.gaps, asset.gaps.length);
    const grouped = library.groups.reduce((total, group) => total + library.documentsFor(code, group.id).length, 0);
    assert.equal(grouped, counts.documents, `${code} spreads every document across the five groups`);
  }
});
