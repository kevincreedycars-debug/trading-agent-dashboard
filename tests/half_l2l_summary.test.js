"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { EXPECTED_SOURCE_BYTES, EXPECTED_SOURCE_SHA256, EXPECTED_SUMMARY_SHA256, EXPECTED_VERSION, FIELDS } = require("../scripts/build_half_l2l_reach_summary");

const ROOT = path.resolve(__dirname, "..");
const summary = JSON.parse(fs.readFileSync(path.join(ROOT, "data/half-l2l-reach-summary.json"), "utf8"));
const script = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("the published reach view loads a slim verified summary, not the missing 35 MB archive", () => {
  assert.deepEqual(Object.keys(summary).sort(), [...FIELDS].sort());
  assert.equal(Object.prototype.hasOwnProperty.call(summary, "row_level"), false);
  assert.equal(EXPECTED_VERSION, "half-l2l-reach-v2");
  assert.equal(EXPECTED_SOURCE_BYTES, 35346210);
  assert.equal(EXPECTED_SOURCE_SHA256, "b3cdd9b6e58a00e42ad20f2a2e0ab74e40c42a5d8aafcbf8c546a611c67db1f0");
  assert.equal(script.includes("./data/half-l2l-reach-summary.json?v=20261117-half-l2l-reach-summary-v1"), true);
  assert.equal(script.includes("half-l2l-reach-research.json?v=20260809-half-l2l-reach-v2"), false);
  assert.equal(index.includes("L2L Half-Distance Reach"), true);
  assert.equal(index.includes("L2L Directional Accuracy"), false);
});

test("the summary preserves the two 97% denominators and the reach definition", () => {
  const overall = summary.comparisons.overall;
  assert.equal(summary.meta.version, "half-l2l-reach-v2");
  assert.match(summary.meta.half_target_definition, /ADR20 \* 0\.25/);
  assert.match(summary.meta.adverse_boundary_policy, /Not supported/);
  assert.deepEqual(
    {
      hits: overall.layer1.halfOfStandard.hits,
      denominator: overall.layer1.halfOfStandard.eligibleCalls,
      rate: overall.layer1.halfOfStandard.hitRatePct,
    },
    { hits: 2418, denominator: 2493, rate: 97 }
  );
  assert.deepEqual(
    {
      hits: overall.layer2.halfOfStandard.hits,
      denominator: overall.layer2.halfOfStandard.eligibleCalls,
      rate: overall.layer2.halfOfStandard.hitRatePct,
    },
    { hits: 1549, denominator: 1592, rate: 97.3 }
  );
  assert.equal(summary.source_audit.length, 5);
  assert.ok(summary.manual_review && Array.isArray(summary.manual_review.sample_rows));
  assert.ok(fs.statSync(path.join(ROOT, "data/half-l2l-reach-summary.json")).size < 2_000_000);
});
