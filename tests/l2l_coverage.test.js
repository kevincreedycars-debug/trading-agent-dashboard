// Contract tests for the coverage rule: at least ten full L2L lines above price and ten below, from each
// instrument's own seeds and spacing, for every instrument the ladder marks.
//
// The rule replaced a fixed depth on 2026-11-21, after BTCUSD spent a fortnight below the lowest generated
// line with no next line to aim a target at. What is asserted here is therefore the shape of the guarantee
// rather than one ladder: price above and below the old range, a gap that is many steps wide, a price sitting
// exactly on a line, repeated generation, a restart, the FTMO 2 midpoint grid, and target selection. Every
// generated price has to be the same step of the same measurement, no existing price may move, and a
// confirmation that happened before a line existed may not become an order.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const coverage = require("../lib/l2l_coverage.js");
const { planCoverage, writePlan, parsePrices } = require("../scripts/ensure-l2l-coverage.js");
const levelsStore = require("../lib/l2l_levels_store.js");

const repoRoot = path.join(__dirname, "..");
const committed = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "l2l-levels.json"), "utf8"));
const btc = committed.instruments.find(entry => entry.symbol === "BTCUSD");
const NOW = "2026-11-21T12:00:00.000Z";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function instrumentLevels(symbol) {
  return clone(committed.instruments.find(entry => entry.symbol === symbol).levels);
}

// The hand-marked base the coverage rule was written against: the committed file's two seeds and ten steps
// each way, rebuilt here so a test starts from the ladder the user knows rather than from the generator's own
// output. The committed file itself has already been extended, which is why this exists.
function baseLadder(symbol) {
  const instrument = committed.instruments.find(entry => entry.symbol === symbol);
  const seeds = instrument.levels.filter(level => level.role === "seed");
  const prices = seeds.map(level => Number(level.price));
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const spacing = Number((high - low).toFixed(6));
  const template = instrument.levels.find(level => level.role === "derived") || seeds[0];
  const levels = seeds.map(level => ({ ...level }));
  const add = (price, step) => levels.push({
    ...template,
    label: `derived ${Number(price.toFixed(6))}`,
    price: Number(price.toFixed(6)),
    role: "derived",
    spacing_price: spacing,
    spacing_points: null,
    anchor_high: high,
    anchor_low: low,
    note: `Step ${step > 0 ? `+${step}` : step} of the L2L distance ${spacing}.`
  });
  for (let step = 1; step <= 10; step += 1) add(high + step * spacing, step);
  for (let step = 1; step <= 10; step += 1) add(low - step * spacing, -step);
  return levels.sort((a, b) => Number(b.price) - Number(a.price));
}

// A levels document in the shape planCoverage expects, with every instrument at its hand-marked base.
function baseState() {
  return {
    ...clone(committed),
    instruments: committed.instruments.map(instrument => ({
      ...instrument,
      levels: baseLadder(instrument.symbol)
    }))
  };
}

// The prices of one instrument's ladder, highest first, as numbers.
function pricesOf(levels) {
  return levels.map(level => Number(level.price)).sort((a, b) => b - a);
}

function onGrid(level, measure) {
  const step = (Number(level.price) - measure.anchorHigh) / measure.spacing;
  return Math.abs(step - Math.round(step)) <= 1e-6;
}

test("the floor is ten full lines a side, on the measurement the file already carries", () => {
  assert.equal(coverage.MIN_LEVELS_PER_SIDE, 10);
  assert.equal(coverage.MAX_GENERATED_STEPS, 60);
  // And one name: the levels document knows the coverage writer by the name the generator stamps on a line.
  assert.equal(levelsStore.MARKED_BY.coverage, coverage.GENERATED_MARKED_BY);

  const measure = coverage.measureLadder(btc.levels);
  assert.equal(measure.ok, true);
  assert.equal(measure.anchorHigh, 84568.53);
  assert.equal(measure.anchorLow, 83113.66);
  assert.equal(measure.spacing, 1454.87);
  assert.equal(measure.anchorSource, "derived provenance");

  // Two hand-marked levels with no generated copy yet are still a measurement.
  const seedsOnly = coverage.measureLadder([
    { price: 85500, role: "seed" },
    { price: 84500, role: "seed" }
  ]);
  assert.equal(seedsOnly.ok, true);
  assert.equal(seedsOnly.spacing, 1000);
  assert.equal(seedsOnly.anchorSource, "seed pair");

  // One level is no distance at all, and a file whose generated lines disagree is refused rather than
  // re-measured: re-measuring would move prices orders may already reference.
  assert.equal(coverage.measureLadder([{ price: 85500, role: "seed" }]).ok, false);
  assert.equal(coverage.measureLadder([
    { price: 85500, role: "derived", anchor_high: 85500, anchor_low: 84500, spacing_price: 1000 },
    { price: 86500, role: "derived", anchor_high: 86500, anchor_low: 84500, spacing_price: 2000 }
  ]).ok, false);
});

test("price below the published range is covered, and every existing line keeps its price", () => {
  const before = baseLadder("BTCUSD");
  const result = coverage.ensureCoverage({
    levels: before,
    price: 76500,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.after.covered, true);
  assert.ok(result.after.above >= 10 && result.after.below >= 10);

  // Nothing was dropped, and every original price is present with the same provenance.
  const afterPrices = new Set(pricesOf(result.levels));
  for (const level of before) {
    assert.equal(afterPrices.has(Number(level.price)), true, `${level.price} must survive the extension`);
    const kept = result.levels.find(entry => Number(entry.price) === Number(level.price));
    assert.deepEqual(kept, level);
  }
  assert.equal(result.levels.length, before.length + result.added.length);

  // Every generated line is a step of the same measurement, snapped to the instrument's grid.
  const measure = coverage.measureLadder(result.levels);
  for (const price of result.added) {
    assert.equal(onGrid({ price }, measure), true, `${price} is not on the ladder's grid`);
  }
  assert.equal(result.retained.missing.length, 0);
});

test("price above the published range is covered the same way", () => {
  const result = coverage.ensureCoverage({
    levels: baseLadder("BTCUSD"),
    price: 105000,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });
  assert.equal(result.ok, true);
  assert.ok(result.addedAbove >= 10);
  assert.ok(result.after.below >= 10 && result.after.above >= 10);
  // The target a long would aim at exists, and it is above price.
  assert.ok(result.after.nextAbove > 105000);
});

test("a gap many steps wide is covered, and the cap is what refuses an impossible one", () => {
  const gapped = coverage.ensureCoverage({
    levels: baseLadder("BTCUSD"),
    price: 30000,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });
  assert.equal(gapped.ok, true);
  assert.equal(gapped.after.below, 10);
  assert.ok(gapped.addedBelow <= coverage.MAX_GENERATED_STEPS);

  // One step beyond the cap cannot be reached: the generator says so rather than inventing a line, and the
  // caller has the asset and the reason for the page and the log.
  const impossible = coverage.ensureCoverage({
    levels: baseLadder("BTCUSD"),
    price: 1,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });
  assert.equal(impossible.ok, false);
  assert.match(impossible.reason, /60 steps|cap/);
  assert.equal(impossible.symbol, "BTCUSD");
});


test("a price exactly on a line counts that line for neither side", () => {
  // 68564.96 is step -11 of the BTCUSD ladder: a real published price, not a contrived one.
  const onLevel = 68564.96;
  assert.equal(baseLadder("BTCUSD").some(level => level.price === onLevel), true);
  const result = coverage.ensureCoverage({
    levels: baseLadder("BTCUSD"),
    price: onLevel,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });
  assert.equal(result.ok, true);
  assert.equal(result.before.above + result.before.below, pricesOf(result.levels).length - result.added.length - 1);
  assert.equal(result.after.covered, true);
  assert.ok(result.after.above >= 10 && result.after.below >= 10);
  assert.ok(!result.added.includes(onLevel), "the line price itself must not be generated twice");
  const unique = new Set(pricesOf(result.levels));
  assert.equal(unique.size, result.levels.length, "no price may appear twice");
});

test("repeated generation adds nothing, and a restart reproduces the same answer", () => {
  const first = coverage.ensureCoverage({
    levels: baseLadder("BTCUSD"),
    price: 76500,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });
  // The same tick twice: the second run reads the first run's output and must change nothing, including the
  // timestamps of the lines the first run added - a retry is not a new availability time.
  const again = coverage.ensureCoverage({
    levels: first.levels,
    price: 76500,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: "2026-11-21T12:05:00.000Z"
  });
  assert.equal(again.changed, false);
  assert.equal(again.added.length, 0);
  assert.deepEqual(again.levels, first.levels);

  // A restart reads the file back from disk, not from the previous process's memory.
  const restarted = JSON.parse(JSON.stringify({ instruments: [{ symbol: "BTCUSD", levels: first.levels }] }));
  const afterRestart = coverage.ensureCoverage({
    levels: restarted.instruments[0].levels,
    price: 76500,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: "2026-11-22T09:00:00.000Z"
  });
  assert.equal(afterRestart.changed, false);
  assert.deepEqual(afterRestart.levels, first.levels);
});

test("the half grid is one midpoint between each adjacent pair, and it never sets the floor", () => {
  // A full ladder as the file stores it: two seeds and the generated copies that record their anchors.
  const levels = [
    { price: 86500, role: "derived", anchor_high: 85500, anchor_low: 84500, spacing_price: 1000 },
    { price: 85500, role: "seed" },
    { price: 84500, role: "seed" },
    { price: 83500, role: "derived", anchor_high: 85500, anchor_low: 84500, spacing_price: 1000 }
  ];
  const half = coverage.midpointGrid(levels);
  assert.deepEqual(half.map(level => level.price), [86500, 86000, 85500, 85000, 84500, 84000, 83500]);
  assert.deepEqual(half.filter(level => level.role === "midpoint").map(level => level.price), [86000, 85000, 84000]);

  // FTMO 2's floor is judged on the full lines, so its counts are the full ladder's counts.
  const full = coverage.coverageOf(levels, 84500);
  const withMidpoints = coverage.coverageOf(half, 84500, { includeMidpoints: true });
  assert.equal(full.above, 2);
  assert.equal(full.below, 1);
  assert.equal(withMidpoints.above, 4);
  assert.equal(withMidpoints.below, 2);
  assert.equal(withMidpoints.covered, false);
  assert.equal(withMidpoints.minPerSide, 10);

  // A generator run over a half grid does not mistake a midpoint for a line of the ladder: the floor is met
  // with full lines and the midpoint that was already there is carried through untouched.
  const generated = coverage.ensureCoverage({
    levels: half,
    price: 84500,
    point: 1,
    symbol: "TEST",
    nowUtc: NOW
  });
  assert.equal(generated.ok, true);
  assert.equal(generated.levels.some(level => level.role === "midpoint"), true);
  assert.equal(generated.after.above, 10);
  assert.equal(generated.after.below, 10);
});


test("the next target each way is the nearest line, which is what a ticket aims at", () => {
  const result = coverage.ensureCoverage({
    levels: baseLadder("BTCUSD"),
    price: 76500,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW
  });
  const prices = pricesOf(result.levels);
  const above = prices.filter(price => price > 76500);
  const below = prices.filter(price => price < 76500);
  assert.equal(result.after.nextAbove, Math.min(...above));
  assert.equal(result.after.nextBelow, Math.max(...below));
});


test("all four instruments keep ten full lines a side at the feed's own prices, and the file still validates", () => {
  const feed = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "live-trading.json"), "utf8"));
  const state = baseState();
  const plan = planCoverage({ state, feed, nowUtc: NOW });
  assert.deepEqual(plan.failures, []);
  assert.equal(plan.ok, true);
  assert.deepEqual(
    plan.rows.map(row => row.symbol).sort(),
    ["BTCUSD", "EURUSD", "US100.cash", "XAUUSD"]
  );
  for (const row of plan.rows) {
    assert.equal(row.covered, true, `${row.symbol} must be covered`);
    assert.ok(row.above >= 10, `${row.symbol} above=${row.above}`);
    assert.ok(row.below >= 10, `${row.symbol} below=${row.below}`);
    assert.equal(row.min_per_side, 10);
    assert.equal(row.status, "extended", "the hand-marked base is short at these prices, so every pair extends");
    assert.ok(row.range.low < row.price && row.price < row.range.high);
  }

  // The document the plan would write is a valid levels artifact, and a second plan over it changes nothing.
  assert.deepEqual(levelsStore.validateLevelsState(plan.state), []);
  const settled = planCoverage({ state: plan.state, feed, nowUtc: "2026-11-21T13:00:00.000Z" });
  assert.equal(settled.changed, false);
  assert.deepEqual(settled.failures, []);

  // The committed file has already been extended by the same rule, so the same plan over it is a no-op that
  // still reports every instrument as covered.
  const committedPlan = planCoverage({ state: committed, feed, nowUtc: NOW });
  assert.equal(committedPlan.ok, true);
  assert.equal(committedPlan.changed, false);
  assert.ok(committedPlan.rows.every(row => row.covered === true));

  // Nothing the file already marked is gone or moved.
  for (const instrument of state.instruments) {
    const after = plan.state.instruments.find(entry => entry.symbol === instrument.symbol);
    for (const level of instrument.levels) {
      const kept = after.levels.find(entry => Number(entry.price) === Number(level.price));
      assert.ok(kept, `${instrument.symbol} ${level.price} must survive`);
      assert.equal(kept.marked_at_utc, level.marked_at_utc);
      assert.equal(kept.label, level.label);
    }
  }
});

test("writing is atomic, validated, and leaves a covered file untouched", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l2l-coverage-"));
  const file = path.join(dir, "l2l-levels.json");
  const feed = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "live-trading.json"), "utf8"));
  const state = baseState();

  const first = planCoverage({ state, feed, nowUtc: NOW });
  fs.writeFileSync(file, levelsStore.serialiseState(state), "utf8");
  const before = fs.readFileSync(file, "utf8");
  const written = writePlan(file, first);
  assert.equal(written.written, true);
  assert.deepEqual(written.errors, []);
  const after = fs.readFileSync(file, "utf8");
  assert.notEqual(after, before);
  assert.deepEqual(levelsStore.validateLevelsState(JSON.parse(after)), []);

  // The covered file is stable: the next plan writes nothing and the bytes do not move.
  const second = planCoverage({ state: JSON.parse(after), feed, nowUtc: "2026-11-21T13:00:00.000Z" });
  const secondWrite = writePlan(file, second);
  assert.equal(secondWrite.written, false);
  assert.equal(fs.readFileSync(file, "utf8"), after);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a referenced level is retained, and a missing one is reported rather than invented", () => {
  const levels = baseLadder("BTCUSD");
  const referenced = pricesOf(levels)[3];
  const result = coverage.ensureCoverage({
    levels,
    price: 76500,
    point: 0.01,
    symbol: "BTCUSD",
    nowUtc: NOW,
    retainPrices: [referenced, 12345.67]
  });
  assert.equal(result.ok, true);
  assert.equal(result.retained.missing.includes(referenced), false);
  // A price that is not in the file is not silently added as an off-grid level: it is reported so the caller
  // can tell a working order from a missing line.
  assert.deepEqual(result.retained.missing, [12345.67]);
});

test("prices are parsed from the command line in one documented shape", () => {
  assert.deepEqual(parsePrices(["BTCUSD=76500,EURUSD=1.161"]), { BTCUSD: 76500, EURUSD: 1.161 });
  assert.throws(() => parsePrices(["BTCUSD"]), /SYMBOL=PRICE/);
  assert.throws(() => parsePrices(["BTCUSD=0"]), /SYMBOL=PRICE/);
});

test("a coverage failure names the asset and the reason, and the trader keeps what it has", () => {
  const state = {
    ...clone(committed),
    instruments: committed.instruments.map(instrument => (
      instrument.symbol === "BTCUSD"
        ? { ...instrument, levels: instrument.levels.filter(level => level.role !== "derived").slice(0, 1) }
        : instrument
    ))
  };
  const feed = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "live-trading.json"), "utf8"));
  const plan = planCoverage({ state, feed, nowUtc: NOW, lane: "ftmo-2" });
  assert.equal(plan.ok, false);
  const failure = plan.failures.find(row => row.symbol === "BTCUSD");
  assert.ok(failure, "the asset must be named");
  assert.equal(failure.asset, "BTC");
  assert.equal(failure.lane, "ftmo-2");
  assert.match(failure.reason, /seed levels/);
  // The other three are still covered: one asset's missing measurement does not stop the rest.
  assert.equal(plan.rows.filter(row => row.covered).length, 3);
});

