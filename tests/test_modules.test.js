"use strict";

// Guards the test-module contract: a selected module changes what is scored, not just what a record says.

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const modules = require(path.join(ROOT, "lib", "layer1_backtesting", "test_modules"));
const controller = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "backtest_controller"));
const ledgerLib = require(path.join(ROOT, "lib", "backtesting_n8n_run_ledger"));
const dataset = require(path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json"));

const DATE = "2024-01-10";
// The configured additional markets, read from the artefact rather than retyped.
const CONFIGURED = dataset.market_matrix.additional_markets;

function run(testModules) {
  return controller.runBacktest({
    dataset,
    model: "challenger_v1",
    dates: [DATE],
    testModules,
    includeDecisions: true
  });
}

test("the module contract names four modules, their markets and their history needs", () => {
  assert.deepEqual(modules.MODULE_IDS, [
    "dxy_direction_broker_cfd",
    "four_markets",
    "l2l_full_5r",
    "l2l_half_3r"
  ]);
  assert.deepEqual(modules.marketsFor(modules.resolveModules("four_markets")), ["EURUSD", "XAUUSD", "BTCUSD", "NAS100"]);
  assert.deepEqual(modules.marketsFor(modules.resolveModules(["dxy_direction_broker_cfd", "l2l_full_5r"])), []);
  assert.deepEqual(modules.simulationsFor(modules.resolveModules("l2l_half_3r")), ["half_3r"]);
  assert.throws(() => modules.resolveModules("not_a_test"), /unknown test module/);
  assert.throws(() => modules.resolveModules([]), /at least one test module/);
});

test("selecting test 2 alone scores every configured market; selecting 3 and 4 scores none", () => {
  const four = run("four_markets");
  assert.deepEqual(Object.keys(four.decisions[0].results), CONFIGURED);
  assert.deepEqual(four.test_configuration.scored_markets, CONFIGURED);
  assert.equal(four.test_configuration.defaulted, false);

  const paths = run(["l2l_full_5r", "l2l_half_3r"]);
  assert.deepEqual(paths.decisions[0].results, {});
  assert.deepEqual(paths.test_configuration.scored_markets, []);
  assert.deepEqual(paths.test_configuration.simulations, ["full_5r", "half_3r"]);
  const states = paths.decisions[0].tests.states;
  assert.deepEqual(states.map((state) => `${state.id}:${state.state}`), [
    "l2l_full_5r:blocked_on_history",
    "l2l_half_3r:blocked_on_history"
  ]);
  assert.match(states[0].reason, /5-minute tape and a level ladder/);

  const dxy = run("dxy_direction_broker_cfd");
  assert.equal(dxy.decisions[0].tests.states[0].state, "not_run");
  assert.match(dxy.decisions[0].tests.states[0].reason, /no broker DXY outcome per morning/);
});

test("an unselected module is absent rather than reported as not run", () => {
  const four = run("four_markets");
  const ids = four.decisions[0].tests.states.map((state) => state.id);
  assert.deepEqual(ids, ["four_markets"]);
  assert.ok(!ids.includes("l2l_full_5r"));
});

test("a session that carries a tape lets the path modules execute", () => {
  const session = dataset.sessions.find((entry) => entry.date === DATE);
  const withTape = Object.assign({}, session, {
    trade_paths: { markets: ["EURUSD"], EURUSD: { candles: [{ open: 1.1, high: 1.11, low: 1.09, close: 1.105 }] } }
  });
  const decision = controller.decideMorning(withTape, "challenger_v1", { testModules: "l2l_full_5r" });
  assert.equal(decision.tests.states[0].state, "scored");
  assert.deepEqual(decision.tests.states[0].markets, ["EURUSD"]);
});

test("the summary reports only the markets that were scored", () => {
  const restricted = run("four_markets");
  assert.deepEqual(Object.keys(restricted.summary.markets), CONFIGURED);
  assert.equal(restricted.summary.pooled.scored > 0, true);
  const paths = run("l2l_full_5r");
  assert.deepEqual(paths.summary.markets, {});
  assert.deepEqual(paths.summary.scored_markets, []);
  assert.equal(paths.summary.pooled.scored, 0);
});

test("the test selection is part of the experiment configuration, so two selections coexist", () => {
  const record = {
    schema_version: "usd-l1-n8n-cloud-execution-v2",
    date: DATE,
    validation_mode: "structural",
    selection: ["challenger_v1"],
    registry: { version: "test", fingerprint: "test" },
    dataset: { path: "data/usd-layer1-backtester/run-v1.json", run_version: "test" },
    models: {
      challenger_v1: { identity: "i", label: "l", role: "challenger", kind: "research", execution_id: "2", execution_url: "u2", workflow_id: "cw", decision: null }
    },
    comparison: null,
    n8n: { execution_id: "1", workflow_id: "w" },
    identity: {
      input: { dataset_path: "data/usd-layer1-backtester/run-v1.json", dataset_run_version: "test", dates: [DATE] },
      test_configuration: { schema_version: "usd-l1-test-configuration-v1", modules: ["four_markets"] }
    }
  };
  const decision = run("four_markets").decisions[0];
  record.models.challenger_v1.decision = decision;
  record.input_availability = {
    accepted: decision.validation.accepted,
    structural_accepted: decision.validation.accepted,
    reasons: [],
    declared_inputs: decision.validation.inputs.declared,
    present_inputs: decision.validation.inputs.present,
    missing_inputs: decision.validation.inputs.missing,
    missing_keys: decision.validation.inputs.missing_keys || [],
    stamped_before_cutoff: decision.validation.inputs.stamped_before_cutoff,
    receipted_complete: decision.validation.receipted.complete,
    unclocked_keys: []
  };
  const first = ledgerLib.normaliseRecord(record);
  const second = ledgerLib.normaliseRecord(Object.assign(JSON.parse(JSON.stringify(record)), {
    identity: Object.assign({}, record.identity, {
      test_configuration: { schema_version: "usd-l1-test-configuration-v1", modules: ["l2l_full_5r"] }
    })
  }));
  assert.notEqual(first.configuration.fingerprint, second.configuration.fingerprint);
  assert.deepEqual(first.calls.challenger_v1.tests.modules, ["four_markets"]);
  const verification = ledgerLib.verifyRecord(first, dataset);
  assert.equal(verification.verified, true, JSON.stringify(verification.mismatches));
});
