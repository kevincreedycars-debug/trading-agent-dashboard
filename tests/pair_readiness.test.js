const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PAIR_EVIDENCE, REQUIRED_EVIDENCE, getPairReadiness } = require("../lib/pair_readiness");

test("only evidence-complete pairs are eligible for live signals", () => {
  ["EUR/USD", "XAU/USD", "NQ/USD", "BTC/USD"].forEach((pair) => {
    assert.equal(getPairReadiness(pair).liveEligibility, "READY", pair);
  });
  ["GBP/USD", "EUR/GBP", "XAG/USD", "WTI/USD", "BTC/GBP"].forEach((pair) => {
    assert.equal(getPairReadiness(pair).liveEligibility, "ONBOARDING", pair);
  });
});

test("every registered pair carries the full evidence contract", () => {
  Object.entries(PAIR_EVIDENCE).forEach(([pair, evidence]) => {
    assert.deepEqual(Object.keys(evidence).sort(), [...REQUIRED_EVIDENCE].sort(), pair);
  });
});

test("unknown pairs fail closed into onboarding", () => {
  const readiness = getPairReadiness("UNLISTED/USD");
  assert.equal(readiness.liveEligibility, "ONBOARDING");
  assert.deepEqual(readiness.missingEvidence, REQUIRED_EVIDENCE);
});

test("signal board derives eligibility from the evidence registry", () => {
  const script = fs.readFileSync(path.resolve(__dirname, "..", "script.js"), "utf8");
  assert.match(script, /pairReadinessLib\.getPairReadiness\(config\.pairLabel\)/);
});
