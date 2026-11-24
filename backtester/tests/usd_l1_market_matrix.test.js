"use strict";

// The market x test matrix: configuration, not code.
//
// These cases pin the property the build depends on - one primary market and N additional markets, each
// receiving all three tests, with a duplicate primary refused - and they pin the two configurations the
// programme actually uses: the committed DXY + seven (24 combinations) and a smaller one that must work with
// no code change.

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const matrixModule = require("../lib/usd_layer1_backtester/market_matrix");

const ROOT = path.resolve(__dirname, "../..");
const market = (key, role, predicts = "DOWN") => ({
  key,
  role,
  label: key,
  instrument_kind: "fx_pair",
  series_file: `backtester/tmp/${key.toLowerCase()}_h1.csv`,
  quote_convention: "USD per unit",
  usd_bullish_predicts: predicts,
  digits: 5
});

test("the committed configuration is DXY plus seven markets, which is 24 combinations per strategy", () => {
  const loaded = matrixModule.loadMatrix({ rootDir: ROOT });
  const described = matrixModule.describeMatrix(loaded.matrix, loaded);
  assert.equal(described.primary_market, "DXY");
  assert.deepEqual(described.additional_markets, [
    "EURUSD",
    "XAUUSD",
    "XAGUSD",
    "NAS100",
    "BTCUSD",
    "WTIUSD",
    "GBPUSD"
  ]);
  assert.equal(described.market_count, 8);
  assert.equal(described.test_count, 3);
  assert.equal(described.combination_count, 24);
  assert.equal(new Set(described.combinations.map((entry) => entry.id)).size, 24);
  assert.deepEqual(described.tests.map((entry) => entry.id), ["direction", "l2l_full_5r", "l2l_half_3r"]);
  for (const entry of described.markets) {
    for (const id of matrixModule.TEST_IDS) {
      assert.ok(
        described.combinations.some((combination) => combination.market === entry.key && combination.test === id),
        `${entry.key} must carry ${id}`
      );
    }
  }
  assert.equal(described.source, "backtester/config/usd_layer1_market_matrix.json");
  assert.match(described.sha256, /^[0-9a-f]{64}$/);
});

test("another asset configuration needs no code change", () => {
  const smaller = matrixModule.validateMatrix({
    primary_market: "DXY",
    tests: matrixModule.TEST_IDS,
    additional_markets: ["EURUSD"],
    markets: [
      { ...market("DXY", "primary", "UP"), official_series: { available: false } },
      market("EURUSD", "additional")
    ]
  });
  assert.equal(matrixModule.buildCombinations(smaller).length, 6);
  assert.deepEqual(smaller.additional_markets, ["EURUSD"]);
});

test("a duplicate primary market is refused, whether repeated by key or by role", () => {
  const repeatedKey = {
    primary_market: "DXY",
    markets: [{ ...market("DXY", "primary", "UP") }, { ...market("DXY", "additional") }]
  };
  assert.throws(() => matrixModule.validateMatrix(repeatedKey), /primary market appears twice/);

  const listedAsAdditional = {
    primary_market: "DXY",
    additional_markets: ["DXY", "EURUSD"],
    markets: [{ ...market("DXY", "primary", "UP") }, market("EURUSD", "additional")]
  };
  assert.throws(() => matrixModule.validateMatrix(listedAsAdditional), /listed as additional/);

  const twoPrimaries = {
    primary_market: "DXY",
    markets: [{ ...market("DXY", "primary", "UP") }, { ...market("EURUSD", "primary") }]
  };
  assert.throws(() => matrixModule.validateMatrix(twoPrimaries), /exactly one primary market/);
});

test("an unknown test, a missing quote convention and an unusable digit count are refused", () => {
  const base = {
    primary_market: "DXY",
    markets: [{ ...market("DXY", "primary", "UP") }, market("EURUSD", "additional")]
  };
  assert.throws(
    () => matrixModule.validateMatrix({ ...base, tests: ["direction", "l2l_full_5r", "something_else"] }),
    /does not implement/
  );
  const noConvention = {
    ...base,
    markets: [{ ...market("DXY", "primary", "UP"), quote_convention: "" }, market("EURUSD", "additional")]
  };
  assert.throws(() => matrixModule.validateMatrix(noConvention), /missing quote_convention/);
  const badDigits = {
    ...base,
    markets: [{ ...market("DXY", "primary", "UP"), digits: -1 }, market("EURUSD", "additional")]
  };
  assert.throws(() => matrixModule.validateMatrix(badDigits), /unusable digits/);
});

test("the fingerprint follows the selection, not the labels or the file's formatting", () => {
  const base = matrixModule.validateMatrix({
    primary_market: "DXY",
    markets: [{ ...market("DXY", "primary", "UP") }, market("EURUSD", "additional")]
  });
  const relabelled = matrixModule.validateMatrix({
    primary_market: "DXY",
    markets: [
      { ...market("DXY", "primary", "UP"), label: "the dollar index" },
      { ...market("EURUSD", "additional"), label: "euro" }
    ]
  });
  const different = matrixModule.validateMatrix({
    primary_market: "DXY",
    markets: [
      { ...market("DXY", "primary", "UP") },
      { ...market("EURUSD", "additional"), usd_bullish_predicts: "UP" }
    ]
  });
  assert.equal(matrixModule.marketFingerprint(base), matrixModule.marketFingerprint(relabelled));
  assert.notEqual(matrixModule.marketFingerprint(base), matrixModule.marketFingerprint(different));
});
test("readiness blocks a market on its own missing dataset and releases it only when every requirement exists", () => {
  const matrix = matrixModule.validateMatrix({
    primary_market: "DXY",
    markets: [
      { ...market("DXY", "primary", "UP"), official_series: { available: false } },
      market("EURUSD", "additional")
    ]
  });
  const blocked = matrixModule.evaluateReadiness({
    matrix,
    seriesByMarket: { DXY: {}, EURUSD: {} },
    m5ByMarket: { EURUSD: { sessions: 1, mid_tape_sessions: 1, bid_ask: false, dates: ["2026-10-05"] } },
    ladderByMarket: { EURUSD: { sessions: 6, dates: ["2026-10-05"] } }
  });
  const dxy = blocked.rows.find((row) => row.market === "DXY");
  assert.equal(dxy.tests.direction.status, "proxy_ready");
  assert.match(dxy.tests.direction.reason, /proxy/);
  assert.equal(dxy.tests.l2l_full_5r.status, "blocked");
  const eur = blocked.rows.find((row) => row.market === "EURUSD");
  assert.equal(eur.tests.direction.status, "ready");
  assert.equal(eur.tests.l2l_full_5r.status, "blocked");
  assert.match(eur.tests.l2l_full_5r.reason, /bid\/ask/);
  assert.equal(
    blocked.counts.blocked + blocked.counts.ready + blocked.counts.proxy_ready,
    blocked.combination_count
  );

  const ready = matrixModule.evaluateReadiness({
    matrix,
    seriesByMarket: { DXY: {}, EURUSD: {} },
    m5ByMarket: { EURUSD: { sessions: 1, mid_tape_sessions: 1, bid_ask: true, dates: ["2026-10-05"] } },
    ladderByMarket: { EURUSD: { sessions: 1, dates: ["2026-10-05"] } }
  });
  const readyEur = ready.rows.find((row) => row.market === "EURUSD");
  assert.equal(readyEur.tests.l2l_full_5r.status, "ready");
  assert.equal(readyEur.tests.l2l_full_5r.sessions_with_tape_and_ladder, 1);
  assert.equal(readyEur.tests.l2l_half_3r.status, "ready");

  const noOverlap = matrixModule.evaluateReadiness({
    matrix,
    seriesByMarket: { DXY: {}, EURUSD: {} },
    m5ByMarket: { EURUSD: { sessions: 1, mid_tape_sessions: 1, bid_ask: true, dates: ["2026-11-05"] } },
    ladderByMarket: { EURUSD: { sessions: 1, dates: ["2026-10-05"] } }
  });
  assert.match(
    noOverlap.rows.find((row) => row.market === "EURUSD").tests.l2l_full_5r.reason,
    /no single session/
  );
});
test("a run's scored sessions replace readiness with scored, and a blocked combination stays blocked", () => {
  const matrix = matrixModule.validateMatrix({
    primary_market: "DXY",
    markets: [{ ...market("DXY", "primary", "UP") }, market("EURUSD", "additional")]
  });
  const readiness = matrixModule.evaluateReadiness({ matrix, seriesByMarket: { DXY: {}, EURUSD: {} } });
  const applied = matrixModule.applyRunResults(readiness, {
    direction: { DXY: 205, EURUSD: 314 },
    l2l_full_5r: { DXY: 0, EURUSD: 0 }
  });
  const dxy = applied.rows.find((row) => row.market === "DXY");
  assert.equal(dxy.tests.direction.status, "scored");
  assert.equal(dxy.tests.direction.scored, 205);
  assert.equal(dxy.tests.l2l_full_5r.status, "blocked");
  assert.equal(applied.run_counts.scored, 2);
  assert.equal(applied.combination_count, 6);
});
