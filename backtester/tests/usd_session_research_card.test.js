const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { checkResearchCard, assertResearchCard, ResearchCardSchemaError } =
  require("../lib/usd_session_research_card");

/**
 * Research-card schema contract for the USD session programme
 * (docs/research/usd-session/v1/research-card.schema.json).
 */

const schema = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../docs/research/usd-session/v1/research-card.schema.json"), "utf8")
);
const template = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../docs/research/usd-session/v1/research-cards/_template.usd-session-card.json"),
    "utf8"
  )
);

const clone = () => JSON.parse(JSON.stringify(template));

test("the shipped template validates against the shipped schema", () => {
  const result = checkResearchCard(template, schema);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("every field the brief requires is a required schema property", () => {
  const required = new Set(schema.required);
  for (const field of [
    "mechanism",
    "direction_claim",
    "session_role",
    "observable_by_cutoff",
    "reaction_vs_predictive",
    "historical_data_requirements",
    "live_data_requirements",
    "dependencies_and_overlap",
    "hypothesis",
    "parameters",
    "rejection_test",
    "evidence"
  ]) {
    assert.ok(required.has(field), `${field} must be required`);
  }
});

test("a card with a missing required top-level field is rejected and named", () => {
  const card = clone();
  delete card.rejection_test;
  const result = checkResearchCard(card, schema);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("rejection_test")));
});

test("a card with an unencoded enum is rejected", () => {
  const card = clone();
  card.session_role = "weighted_vote_and_gate";
  const result = checkResearchCard(card, schema);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("session_role")));
});

test("evidence must declare whether it was actually fetched", () => {
  const card = clone();
  delete card.evidence[0].fetched;
  const result = checkResearchCard(card, schema);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("evidence[0]")));
});

test("a card_id outside the dotted lowercase form is rejected", () => {
  const card = clone();
  card.card_id = "FX USD Momentum!";
  const result = checkResearchCard(card, schema);
  assert.equal(result.ok, false);
});

test("assertResearchCard throws a named error carrying every violation", () => {
  const card = clone();
  card.family = "vibes";
  card.hypothesis.expected_effect_size = "big";
  assert.throws(() => assertResearchCard(card, schema), (error) => {
    assert.ok(error instanceof ResearchCardSchemaError);
    assert.ok(error.errors.length >= 2);
    return true;
  });
});

test("all card files under the research folder validate", () => {
  const cardDir = path.resolve(__dirname, "../../docs/research/usd-session/v1/research-cards");
  const files = fs.readdirSync(cardDir).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 1, "expected at least the template card");
  for (const file of files) {
    const card = JSON.parse(fs.readFileSync(path.join(cardDir, file), "utf8"));
    const result = checkResearchCard(card, schema);
    assert.deepEqual(result.errors, [], `${file} must validate`);
  }
});
