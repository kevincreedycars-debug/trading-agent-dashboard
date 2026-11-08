"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const contracts = require("../lib/usd_layer1_backtester/contracts");
const challenger = require("../lib/usd_layer1_backtester/challenger");
const currentModel = require("../lib/usd_layer1_backtester/current_model");
const accounts = require("../lib/usd_layer1_backtester/accounts");
const outcomes = require("../lib/usd_layer1_backtester/outcomes");
const tests = require("../lib/usd_layer1_backtester/tests");
const run = require("../lib/usd_layer1_backtester/run");
const { assertResearchPath, ALLOWED_ROOT } = require("../scripts/lib/research_path_guard");

/**
 * USD Layer 1 backtester engine (research only).
 *
 * These tests cover the frozen parameters, the two models' call records, the four tests' arithmetic and the
 * account rule. Where a check needs the published run, it reads the committed artefact rather than a local
 * cache, so the suite passes on a checkout with no 05:00 frame.
 */

const REPO_ROOT = path.resolve(__dirname, "../..");
const ARTEFACT_PATH = path.join(REPO_ROOT, "data", "usd-layer1-backtester", "run-v1.json");

function artefact() {
  return JSON.parse(fs.readFileSync(ARTEFACT_PATH, "utf8"));
}

test("the North Star is the brief's wording, verbatim, in code and in the artefact", () => {
  assert.match(contracts.NORTH_STAR_TEXT, /^Does one independent USD call at 05:00 London/);
  assert.match(contracts.NORTH_STAR_TEXT, /full-level L2L trading results at 5R/);
  assert.match(contracts.NORTH_STAR_TEXT, /half-level L2L trading results at 3R/);
  assert.match(contracts.NORTH_STAR_TEXT, /\u00a3100,000/);
  assert.ok(fs.existsSync(ARTEFACT_PATH), "the published artefact must exist for the panel to render");
  assert.equal(artefact().north_star, contracts.NORTH_STAR_TEXT);
  assert.equal(artefact().schema_version, contracts.SCHEMA_VERSION);
});

test("the four tests are named once and every lane has a coverage row", () => {
  const published = artefact();
  assert.deepEqual(contracts.TESTS.map((entry) => entry.ordinal), [1, 2, 3, 4]);
  for (const entry of contracts.TESTS) {
    assert.ok(published.tests[entry.id], `${entry.id} must be present`);
    assert.notEqual(published.coverage.by_test[entry.id], undefined, `${entry.id} needs a coverage row`);
  }
});

test("the challenger is frozen: version, equal weights and no fitted parameter", () => {
  assert.equal(challenger.VERSION, "usd-layer1-challenger-v0");
  assert.equal(challenger.RULES.equal_weight, 1);
  for (const mechanism of challenger.MECHANISMS) {
    assert.equal(typeof mechanism.vote, "function", `${mechanism.id} needs a vote rule`);
    assert.ok(mechanism.rule && mechanism.threshold, `${mechanism.id} must state its rule and threshold`);
  }
  assert.ok(challenger.MECHANISMS.length >= 6, "the minimum-data rule needs at least six mechanisms");
  assert.ok(challenger.EXCLUDED_INPUTS.length >= 10, "overlapping inputs must be documented, not silently dropped");
  for (const entry of challenger.EXCLUDED_INPUTS) {
    assert.ok(entry.reason && entry.reason.length > 10, `${entry.key} needs a reason`);
  }
});

test("a challenger call is deterministic and carries its own arithmetic", () => {
  const snapshot = {
    values: {
      vix_level: 20,
      vix_d5_chg: 2,
      us_2y_d5_bps: 9,
      us_10y_real_d5_bps: 7,
      broad_dollar_d5_pct: 0.4,
      gold_d5_pct: -0.6,
      nasdaq100_d5_pct: -0.7,
      eurusd_d5_pct: -0.3,
      usdjpy_d5_pct: 0.5
    }
  };
  const first = challenger.evaluate(snapshot);
  const second = challenger.evaluate(snapshot);
  assert.deepEqual(first.mechanisms, second.mechanisms);
  assert.equal(first.direction, "BULLISH");
  assert.equal(first.raw_score, 8);
  assert.equal(first.conviction, 5);
  assert.equal(first.usable_mechanisms, 9);
  assert.match(first.reason, /net \+8/);
});

test("a snapshot with too little data refuses to call and names the missing inputs", () => {
  const call = challenger.evaluate({ values: { vix_level: 30 } });
  assert.equal(call.direction, "NO_CALL");
  assert.equal(call.conviction, null);
  assert.match(call.reason, /minimum is 6/);
  assert.ok(call.missing_inputs.includes("gold_d5_pct"));
  assert.equal(call.raw_score, 1);
});

test("a split decision inside the deadband is a recorded no-call, not a coin toss", () => {
  const call = challenger.evaluate({
    values: {
      vix_level: 20,
      vix_d5_chg: 0.2,
      us_2y_d5_bps: 9,
      us_10y_real_d5_bps: -9,
      broad_dollar_d5_pct: 0.01,
      gold_d5_pct: 0.05,
      nasdaq100_d5_pct: 0.1,
      eurusd_d5_pct: 0.02,
      usdjpy_d5_pct: -0.02
    }
  });
  assert.equal(call.direction, "NO_CALL");
  assert.equal(call.raw_score, 0);
  assert.match(call.reason, /deadband/);
});

test("the current model's conviction is banded, never recomputed", () => {
  assert.equal(currentModel.bandConviction(80), 5);
  assert.equal(currentModel.bandConviction(79.9), 4);
  assert.equal(currentModel.bandConviction(65), 4);
  assert.equal(currentModel.bandConviction(50), 3);
  assert.equal(currentModel.bandConviction(35), 2);
  assert.equal(currentModel.bandConviction(12), 1);
  assert.equal(currentModel.bandConviction(null), null);
  assert.equal(currentModel.baseDirection("BULLISH_LEAN"), "BULLISH");
  assert.equal(currentModel.baseDirection("BEARISH_LEAN"), "BEARISH");
  assert.equal(currentModel.baseDirection("NO_CLEAR_BIAS"), "NO_CALL");
});


test("the current model's replay row substitutes the broad dollar for DXY and invents nothing else", () => {
  const row = currentModel.toReplayRow({
    date: "2025-06-10",
    values: { broad_dollar: 121.1, broad_dollar_d1_pct: 0.1, broad_dollar_d5_pct: 0.4, vix_level: 17.2 }
  });
  assert.equal(row.dxy_level, 121.1);
  assert.equal(row.fed_bias, null);
  assert.equal(row.us_de_2y_spread, null);
  assert.equal(row.snapshot_date, "2025-06-10");
  assert.equal(row.equities_regime, "neutral");
});

test("a session outcome is read from the 05:00 bars and a missing bar stays missing", () => {
  const series = {
    closes: new Map([
      ["2025-06-10T04:00:00.000Z", 1.1],
      ["2025-06-11T04:00:00.000Z", 1.111]
    ]),
    file: "test.csv"
  };
  const moves = outcomes.readSessionMoves({
    sessions: [
      { date: "2025-06-10", cutoff_at_utc: "2025-06-10T04:00:00.000Z", endpoint_at_utc: "2025-06-11T04:00:00.000Z" }
    ],
    seriesByMarket: { EURUSD: series }
  });
  assert.equal(moves["2025-06-10"].EURUSD.present, true);
  assert.equal(moves["2025-06-10"].EURUSD.move_pct, 1);
  assert.equal(moves["2025-06-10"].XAUUSD.present, false);
  assert.match(moves["2025-06-10"].XAUUSD.reason, /not cached/);
});

test("the flat band is frozen from development dates only", () => {
  const moves = {
    "2024-02-01": { EURUSD: { present: true, move_pct: 0.2 } },
    "2024-02-02": { EURUSD: { present: true, move_pct: -0.4 } },
    "2024-02-05": { EURUSD: { present: true, move_pct: 0.6 } },
    "2026-01-05": { EURUSD: { present: true, move_pct: 9 } }
  };
  const bands = outcomes.freezeFlatBands(moves, ["2024-02-01", "2024-02-02", "2024-02-05"]);
  assert.equal(bands.EURUSD.sample, 3);
  assert.ok(bands.EURUSD.flat_band_pct > 0 && bands.EURUSD.flat_band_pct < 0.6);
  assert.equal(bands.BTCUSD.flat_band_pct, null);
});

test("a USD-bullish call predicts the market falls, and a flat session is never scored", () => {
  const market = contracts.MARKETS[0];
  assert.equal(tests.predictedDirection("BULLISH", market), "DOWN");
  assert.equal(tests.predictedDirection("BEARISH", market), "UP");
  assert.equal(tests.predictedDirection("NO_CALL", market), null);
  const scored = tests.scoreMarketDirection({
    market,
    calls: new Map([
      ["2025-01-02", { direction: "BULLISH", conviction: 4 }],
      ["2025-01-03", { direction: "BULLISH", conviction: 2 }],
      ["2025-01-06", { direction: "BULLISH", conviction: 3 }]
    ]),
    outcomes: {
      "2025-01-02": { EURUSD: { present: true, direction: "DOWN", move_pct: -0.3 } },
      "2025-01-03": { EURUSD: { present: true, direction: "UP", move_pct: 0.3 } },
      "2025-01-06": { EURUSD: { present: true, direction: "FLAT", move_pct: 0.01 } }
    },
    dates: ["2025-01-02", "2025-01-03", "2025-01-06"]
  });
  assert.equal(scored.overall.scored, 2);
  assert.equal(scored.overall.hits, 1);
  assert.equal(scored.overall.misses, 1);
  assert.equal(scored.overall.flat, 1);
  assert.equal(scored.overall.accuracy_pct, 50);
  assert.equal(scored.by_conviction[4].scored, 1);
  assert.equal(scored.by_conviction[2].misses, 1);
});

test("corrected and spoiled are counted only where both models called and the market moved", () => {
  const market = contracts.MARKETS[0];
  const comparison = tests.compareModels({
    market,
    currentCalls: new Map([
      ["2025-01-02", { direction: "BULLISH", conviction: 3 }],
      ["2025-01-03", { direction: "BEARISH", conviction: 3 }],
      ["2025-01-06", { direction: "BULLISH", conviction: 3 }],
      ["2025-01-07", { direction: "NO_CALL", conviction: null }]
    ]),
    challengerCalls: new Map([
      ["2025-01-02", { direction: "BEARISH", conviction: 3 }],
      ["2025-01-03", { direction: "BULLISH", conviction: 3 }],
      ["2025-01-06", { direction: "BEARISH", conviction: 3 }],
      ["2025-01-07", { direction: "BEARISH", conviction: 3 }]
    ]),
    outcomes: {
      "2025-01-02": { EURUSD: { present: true, direction: "UP", move_pct: 0.3 } },
      "2025-01-03": { EURUSD: { present: true, direction: "UP", move_pct: 0.3 } },
      "2025-01-06": { EURUSD: { present: true, direction: "FLAT", move_pct: 0.01 } },
      "2025-01-07": { EURUSD: { present: true, direction: "UP", move_pct: 0.3 } }
    },
    dates: ["2025-01-02", "2025-01-03", "2025-01-06", "2025-01-07"]
  });
  assert.equal(comparison.matched, 2);
  assert.equal(comparison.corrected, 1);
  assert.equal(comparison.spoiled, 1);
  assert.equal(comparison.both_right, 0);
});

test("test 1 refuses to score without official cash DXY and reports what is waiting", () => {
  const record = tests.testDxyDirection({
    dates: ["2025-01-02", "2025-01-03"],
    callsByModel: {
      current: new Map([
        ["2025-01-02", { direction: "BULLISH", conviction: 4 }],
        ["2025-01-03", { direction: "NO_CALL" }]
      ]),
      challenger: new Map([["2025-01-02", { direction: "BEARISH", conviction: 3 }]])
    }
  });
  assert.equal(record.status, "blocked");
  assert.equal(record.usable_sessions, 0);
  assert.equal(record.awaiting_prices_sessions, 1);
  assert.equal(record.models.current.overall.scored, 0);
  assert.match(record.blocker.reason, /H\.10|lag/i);
});

test("accounts risk 1% of their own running balance and round to the lot step", () => {
  assert.equal(accounts.roundLots(11.899, { lotStep: 0.01, minLot: 0.01 }), 11.89);
  assert.equal(accounts.roundLots(0.004, { lotStep: 0.01, minLot: 0.01 }), null);
  const trades = [
    { id: "full-1", geometry: "full", fillTimeUtc: "2026-11-05T10:40:00Z", rGross: -1, riskPerLot: 84, sessionDate: "2026-11-05" },
    { id: "full-2", geometry: "full", fillTimeUtc: "2026-11-06T06:50:00Z", rGross: 5, riskPerLot: 84, sessionDate: "2026-11-06" },
    { id: "half-1", geometry: "half", fillTimeUtc: "2026-11-05T11:00:00Z", rGross: 3, riskPerLot: 42, sessionDate: "2026-11-05" }
  ];
  const account = accounts.runAccount({
    account: { id: "full", label: "Full", geometry: "full", model: "current" },
    trades,
    startingBalance: 100000,
    riskPct: 1,
    instrument: { lotStep: 0.01, minLot: 0.01 }
  });
  assert.equal(account.fills, 2);
  assert.equal(account.wins, 1);
  assert.equal(account.losses, 1);
  const firstLots = accounts.roundLots((100000 * 0.01) / 84, { lotStep: 0.01, minLot: 0.01 });
  const balanceAfterFirst = 100000 - firstLots * 84;
  const secondLots = accounts.roundLots((balanceAfterFirst * 0.01) / 84, { lotStep: 0.01, minLot: 0.01 });
  assert.equal(account.ending_balance, Math.round((balanceAfterFirst + secondLots * 84 * 5) * 100) / 100);
  assert.ok(account.max_drawdown.amount > 0);
  assert.equal(account.equity_curve.length, 3);
});

test("a trade that is still working is carried as open, never counted as a fill", () => {
  const account = accounts.runAccount({
    account: { id: "full", label: "Full", geometry: "full", model: "current" },
    trades: [{ id: "full-1", geometry: "full", fillTimeUtc: "2026-11-06T18:00:00Z", rGross: null, riskPerLot: 84 }],
    startingBalance: 100000,
    riskPct: 1,
    instrument: { lotStep: 0.01, minLot: 0.01 }
  });
  assert.equal(account.fills, 0);
  assert.equal(account.ending_balance, 100000);
  assert.equal(account.skipped.length, 1);
  assert.match(account.skipped[0].reason, /still working/);
});

test("the four accounts are the four slots the brief names", () => {
  assert.deepEqual(
    accounts.FOUR_ACCOUNTS.map((entry) => entry.id),
    ["current-full", "challenger-full", "current-half", "challenger-half"]
  );
});

