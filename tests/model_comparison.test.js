"use strict";

// Guards the aggregate model comparison: every registered research model is present, a fixture is labelled
// and excluded from research figures, and the artefact reproduces from the committed panel.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { build } = require("../scripts/build_usd_l1_model_comparison");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

const ROOT = path.join(__dirname, "..");

test("the aggregate comparison covers every registered model and labels the fixture", () => {
  const artefact = build();
  assert.deepEqual(artefact.models.map((entry) => entry.model), registry.MODEL_IDS);
  const fixture = artefact.models.find((entry) => entry.model === "fixture_constant");
  assert.equal(fixture.fixture, true);
  assert.equal(fixture.included_in_research_comparison, false);
  assert.match(fixture.note, /FIXTURE/);
  assert.deepEqual(artefact.research_models, ["challenger", "challenger_v1"]);
  assert.deepEqual(artefact.fixtures, ["fixture_constant"]);
  assert.ok(artefact.models.every((entry) => !entry.fixture || entry.role === "fixture"));
  assert.equal(artefact.validation_mode, "structural");
});

test("the committed comparison artefact reproduces and carries its agreement evidence", () => {
  const text = `${JSON.stringify(build(), null, 2)}\n`;
  const committed = fs.readFileSync(path.join(ROOT, "data/usd-layer1-backtester/model-comparison-v1.json"), "utf8").replace(/^\uFEFF/, "");
  assert.equal(committed, text, "regenerate with node scripts/build_usd_l1_model_comparison.js");
  const artefact = JSON.parse(committed);
  assert.equal(artefact.agreement.length, 1);
  const pair = artefact.agreement[0];
  assert.equal(pair.left, "challenger");
  assert.equal(pair.right, "challenger_v1");
  assert.match(pair.note, /not an accuracy or an edge claim/);
  assert.equal(artefact.labels.fixture_policy.includes("fixture"), true);
});
