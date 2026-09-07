const test = require("node:test");
const assert = require("node:assert/strict");

const {
  addSeconds,
  buildLayer1,
  buildLayer2,
  buildPublishedLayer1,
  buildPublishedLayer2,
  buildWorkflowStatus
} = require("./helpers/refreshWorkflowHarness");

test("buildWorkflowStatus derives failed step and reason from failed steps", () => {
  const status = buildWorkflowStatus({
    status: "failed",
    startedAt: "2026-08-18T08:00:00.000Z",
    finishedAt: "2026-08-18T08:05:00.000Z",
    steps: [
      { name: "USD Collector", status: "failed", error: "Collector timeout" }
    ]
  });

  assert.equal(status.failed_step, "USD Collector");
  assert.equal(status.error?.step, "USD Collector");
  assert.equal(status.error?.reason, "Collector timeout");
});

test("buildPublishedLayer1 stamps dashboard publication freshness", () => {
  const publishedAt = "2026-08-18T08:39:40.000Z";
  const artifact = buildPublishedLayer1(publishedAt);

  assert.equal(artifact.dashboard_meta?.last_updated_et, publishedAt);
  assert.ok(Array.isArray(artifact.agents));
  assert.ok(artifact.agents.length > 0);
  assert.equal(artifact.generated_at, undefined);
  assert.ok(artifact.agents.every((agent) => agent.generated_at));
  assert.ok(artifact.agents.every((agent) => agent.sealed_at));
  assert.ok(artifact.agents.every((agent) => agent.last_run_et));
});

test("buildPublishedLayer2 stamps dashboard publication freshness", () => {
  const publishedAt = "2026-08-18T08:39:20.000Z";
  const artifact = buildPublishedLayer2(publishedAt);

  assert.equal(artifact.dashboard_meta?.last_updated_et, publishedAt);
  assert.ok(Array.isArray(artifact.pairs));
  assert.ok(artifact.pairs.length > 0);
  assert.equal(artifact.generated_at, undefined);
  assert.ok(artifact.pairs.every((pair) => pair.generated_at));
  assert.ok(artifact.pairs.every((pair) => pair.sealed_at));
  assert.ok(artifact.pairs.every((pair) => pair.valid_from));
});

test("buildLayer helpers preserve mutable artifact shape without publication metadata rewrites", () => {
  const generatedAt = "2026-08-18T09:00:00.000Z";
  const layer1 = buildLayer1(generatedAt);
  const layer2 = buildLayer2(generatedAt);

  assert.equal(layer1.generated_at, generatedAt);
  assert.equal(layer2.generated_at, generatedAt);
  assert.equal(layer1.source_run_id, null);
  assert.equal(layer2.source_run_id, null);
});

test("addSeconds returns stable ISO timestamp offsets", () => {
  const base = "2026-08-18T10:00:00.000Z";
  assert.equal(addSeconds(base, 5), "2026-08-18T10:00:05.000Z");
  assert.equal(addSeconds(base, -30), "2026-08-18T09:59:30.000Z");
});
