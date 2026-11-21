"use strict";

// The Layer 1 map's view model. Every assertion reads the committed n8n evidence summary; no test
// calls n8n, re-scores a decision, or treats reproduction as performance.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const map = require("../lib/backtesting_n8n_map");
const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "usd-layer1-backtester", "n8n-execution-evidence-v1.json"), "utf8"));

function caseById(id) {
  return map.selectCase(evidence, id);
}

test("the selected identities are the registered models, never H1", () => {
  const options = map.modelOptions(evidence);
  assert.deepEqual(options.map((entry) => entry.id), ["usd-layer1-challenger-v0", "usd-layer1-challenger-v1", "usd-layer1-fixture-constant-v0"]);
  assert.equal(evidence.identities.selected.length, 3);
  assert.equal(evidence.identities.selected.find((entry) => entry.key === "fixture_constant").role, "fixture");
  assert.equal(evidence.identities.not_invoked.find((entry) => entry.key === "h1").version, "USD-L1-25F-H1-v0.1.0");
  assert.equal(evidence.identities.selected.some((entry) => /H1/i.test(entry.id)), false);
  assert.match(evidence.identities.not_invoked.find((entry) => entry.key === "current").reason, /replay core reads local files/);
});

test("the four recorded cases have the expected outcomes", () => {
  assert.deepEqual(map.caseOptions(evidence).map((entry) => [entry.id, entry.outcome]), [
    ["2024-01-10-structural", "allowed"],
    ["2024-01-10-receipted", "blocked"],
    ["2024-01-06-structural", "blocked"],
    ["2024-01-02-structural", "abstained"]
  ]);
});

test("2024-01-10 structural accepts nine inputs but only two carry a full pre-cutoff timestamp", () => {
  const entry = caseById("2024-01-10-structural");
  const model = entry.models.challenger;
  assert.equal(model.status, "allowed");
  assert.equal(model.call.direction, "BULLISH");
  assert.equal(model.validation.cutoff_at_utc, "2024-01-10T05:00:00.000Z");
  assert.equal(model.validation.contract_cutoff_at_utc, "2024-01-10T05:00:00.000Z");
  assert.equal(model.validation.accepted, true);
  assert.equal(model.validation.present_inputs, 9);
  assert.equal(model.validation.declared_inputs, 9);
  assert.equal(model.validation.stamped_before_cutoff, 2);
  assert.equal(model.validation.receipted_complete, false);
  assert.equal(model.validation.unclocked_keys.length, 7);
  assert.equal(entry.parent_execution.status, "success");
  assert.equal(entry.parent_execution.id, "5471");
  assert.equal(model.execution_id, "5472");
});

test("the receipted gate blocks the same morning and leaves it unscored", () => {
  const entry = caseById("2024-01-10-receipted");
  for (const model of [entry.models.challenger, entry.models.challenger_v1]) {
    assert.equal(model.status, "blocked");
    assert.equal(model.validation.accepted, false);
    assert.deepEqual(model.validation.reasons, ["receipted_incomplete"]);
    assert.equal(model.results, null);
  }
});

test("a missing date blocks explicitly and missing inputs abstain rather than inventing a call", () => {
  const missingDate = caseById("2024-01-06-structural");
  assert.equal(missingDate.models.challenger.status, "blocked");
  assert.deepEqual(missingDate.models.challenger.validation.reasons, ["not_in_dataset"]);
  assert.equal(missingDate.models.challenger.results, null);

  const missingInputs = caseById("2024-01-02-structural");
  assert.equal(missingInputs.models.challenger.status, "abstained");
  assert.equal(missingInputs.models.challenger.validation.accepted, true);
  assert.equal(missingInputs.models.challenger.validation.present_inputs, 0);
  assert.equal(missingInputs.models.challenger.validation.missing_inputs, 9);
  assert.equal(missingInputs.models.challenger.results.EURUSD, "no_call");
});

test("the map graph carries sources, gate, child, decision, outcomes, tests and execution links", () => {
  const graph = map.graph(evidence, "2024-01-10-structural", "challenger");
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.deepEqual([...byId.keys()], ["dataset", "parent", "child", "validation", "decision", "outcomes", "tests", "execution", "comparison", "h1"]);
  assert.equal(byId.get("child").status, "allowed");
  assert.equal(byId.get("validation").status, "accepted");
  assert.equal(byId.get("tests").status, "partial");
  assert.equal(byId.get("h1").status, "not_invoked");
  assert.match(byId.get("child").links.find((link) => link.label === "Execution 5472").href, /\/execution\/5472$/);
  assert.match(byId.get("parent").links.find((link) => link.label === "Execution 5471").href, /\/execution\/5471$/);
  assert.deepEqual(graph.edges.filter((edge) => edge.status === "blocked"), []);
  assert.equal(graph.edges.some((edge) => edge.from === "h1" && edge.status === "not_invoked"), true);
});

test("the model rules are the frozen nine mechanisms and v1 splits shared families", () => {
  const v0 = map.ruleRows(evidence, "challenger");
  const v1 = map.ruleRows(evidence, "challenger_v1");
  assert.equal(v0.length, 9);
  assert.equal(v1.length, 9);
  assert.equal(v0.every((rule) => rule.weight === 1), true);
  assert.equal(v1.some((rule) => rule.weight === 0.5), true);
  assert.deepEqual(v0.map((rule) => rule.input), v1.map((rule) => rule.input));
});

test("the four backtests keep their own statuses and do not claim performance", () => {
  const tests = map.testRows(evidence);
  assert.deepEqual(tests.map((row) => [row.ordinal, row.status]), [[1, "scored_proxy"], [2, "scored"], [3, "blocked"], [4, "blocked"]]);
  assert.equal(tests[0].usable_sessions, 360);
  assert.equal(tests[2].usable_sessions, 0);
  assert.equal(evidence.performance.status, "not established as an edge");
  assert.equal(evidence.reproduction.parity.decision_matches, 2175);
  assert.equal(evidence.reproduction.parity.result_matches, 8700);
  assert.equal(Object.prototype.hasOwnProperty.call(evidence.performance, "parity"), false);
  assert.match(evidence.reproduction.parity.note, /not accuracy and not an edge claim/);
});

test("the historical validity summary is separate and late-print evidence is explicitly absent", () => {
  const headline = map.headline(evidence);
  assert.equal(headline.structural, "725 / 725");
  assert.equal(headline.receipted, "0 / 725");
  assert.equal(headline.late, 0);
  assert.equal(headline.parity, "2175 / 2175");
  assert.equal(headline.performance, "not established as an edge");
  assert.match(evidence.historical_validity.note, /not demonstrated by history/);
});

test("every raw evidence path and real n8n identity is present", () => {
  for (const entry of evidence.execution_cases) {
    assert.equal(fs.existsSync(path.join(ROOT, entry.raw_evidence)), true, entry.raw_evidence);
  }
  assert.deepEqual(evidence.workflows.parent.id, "89uk5JnPbWPL5lGD");
  const childIds = evidence.workflows.children.map((child) => child.id);
  assert.ok(childIds.includes("giGJKNQw5WLh1xbX"));
  assert.ok(childIds.includes("42sxXHScRvE3qSTX"));
  const fixture = evidence.workflows.children.find((child) => child.kind === "fixture");
  if (fixture) assert.match(fixture.url, /^https:\/\/silver17\.app\.n8n\.cloud\/workflow\//);
  assert.equal(evidence.workflows.parent.active, false);
  assert.equal(evidence.workflows.children.every((child) => child.trigger.includes("cannot self-start")), true);
});
