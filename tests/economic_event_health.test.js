const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEconomicEventFailureHealth,
  deriveEconomicEventGate
} = require("../lib/economic_event_health");

test("economic-event gate blocks provider failures", () => {
  const result = deriveEconomicEventGate([{ json: { error: { message: "RapidAPI request timed out" } } }]);
  assert.equal(result.gate, "BLOCKED");
  assert.match(result.error, /timed out/i);
});

test("economic-event gate permits error-free collector output", () => {
  assert.deepEqual(deriveEconomicEventGate([{ json: { event_name: "CPI" } }]), { gate: "PASS", error: null });
});

test("economic-event failure health marks every dependent agent critical", () => {
  const health = buildEconomicEventFailureHealth({
    generatedAt: "2026-08-30T12:00:00.000Z",
    error: "Provider returned HTTP 429"
  });

  assert.equal(health.overall_status, "CRITICAL");
  assert.equal(health.source_failure_count, 1);
  assert.equal(health.sources.economic_events.execution_status, "failed");
  assert.deepEqual(Object.keys(health.agents), ["USD", "EUR", "GOLD", "NQ", "BTC"]);
  assert.ok(Object.values(health.agents).every((agent) => agent.overall_status === "CRITICAL"));
});
