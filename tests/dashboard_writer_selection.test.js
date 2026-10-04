const test = require("node:test");
const assert = require("node:assert/strict");

const { REQUIRED_AGENTS, selectLatestLayer1RowsByAgent } = require("../lib/dashboard_writer_selection");

function makeRow(agent, createdAt, extra = {}) {
  return {
    agent_name: agent,
    layer: 1,
    created_at: createdAt,
    direction_24h: "BULLISH",
    ...extra
  };
}

test("selects the latest usable row for each required agent", () => {
  const rows = [
    makeRow("USD", "2026-08-04T06:00:00.000Z", { source_run_id: "run-b" }),
    makeRow("USD", "2026-08-04T05:00:00.000Z", { source_run_id: "run-a" }),
    makeRow("EUR", "2026-08-04T06:01:00.000Z", { source_run_id: "run-b" }),
    makeRow("GOLD", "2026-08-04T06:02:00.000Z", { source_run_id: "run-b" }),
    makeRow("NQ", "2026-08-04T06:03:00.000Z", { source_run_id: "run-b" }),
    makeRow("BTC", "2026-08-04T06:04:00.000Z", { source_run_id: "run-b" })
  ];

  const result = selectLatestLayer1RowsByAgent(rows);
  assert.deepEqual(result.missingAgents, []);
  assert.equal(result.selected.USD.source_run_id, "run-b");
  assert.equal(result.consistencyStatus, "MATCHED");
});

test("fails closed when any required agent is missing", () => {
  const rows = REQUIRED_AGENTS.filter((agent) => agent !== "BTC").map((agent, index) => (
    makeRow(agent, `2026-08-04T06:0${index}:00.000Z`)
  ));

  const result = selectLatestLayer1RowsByAgent(rows);
  assert.deepEqual(result.missingAgents, ["BTC"]);
});

test("preserves mixed-run latest-per-agent selection while flagging mismatched provenance", () => {
  const rows = [
    makeRow("USD", "2026-08-04T06:10:00.000Z", { source_run_id: "run-new" }),
    makeRow("EUR", "2026-08-04T06:11:00.000Z", { source_run_id: "run-new" }),
    makeRow("GOLD", "2026-08-04T06:12:00.000Z", { source_run_id: "run-new" }),
    makeRow("NQ", "2026-08-04T06:13:00.000Z", { source_run_id: "run-new" }),
    makeRow("BTC", "2026-08-04T05:55:00.000Z", { source_run_id: "run-old" })
  ];

  const result = selectLatestLayer1RowsByAgent(rows);
  assert.equal(result.selected.BTC.source_run_id, "run-old");
  assert.equal(result.consistencyStatus, "MISMATCHED");
  assert.equal(result.sourceRunConsistency, "MISMATCHED");
});

test("ignores malformed recent rows until it finds the latest usable row for that agent", () => {
  const rows = [
    makeRow("USD", "2026-08-04T06:10:00.000Z", { direction_24h: "" }),
    makeRow("USD", "2026-08-04T06:09:00.000Z", { raw_agent_output: "{\"direction_24h\":\"BEARISH\"}" }),
    makeRow("EUR", "2026-08-04T06:11:00.000Z"),
    makeRow("GOLD", "2026-08-04T06:12:00.000Z"),
    makeRow("NQ", "2026-08-04T06:13:00.000Z"),
    makeRow("BTC", "2026-08-04T06:14:00.000Z")
  ];

  const result = selectLatestLayer1RowsByAgent(rows);
  assert.equal(result.selected.USD.created_at, "2026-08-04T06:09:00.000Z");
});

test("keeps the latest row when duplicate recent rows exist for the same agent", () => {
  const rows = [
    makeRow("USD", "2026-08-04T06:10:00.000Z", { source_run_id: "run-a", refresh_request_id: "req-a" }),
    makeRow("USD", "2026-08-04T06:10:00.000Z", { source_run_id: "run-a", refresh_request_id: "req-a", reasoning_summary: "duplicate row" }),
    makeRow("EUR", "2026-08-04T06:11:00.000Z", { source_run_id: "run-a", refresh_request_id: "req-a" }),
    makeRow("GOLD", "2026-08-04T06:12:00.000Z", { source_run_id: "run-a", refresh_request_id: "req-a" }),
    makeRow("NQ", "2026-08-04T06:13:00.000Z", { source_run_id: "run-a", refresh_request_id: "req-a" }),
    makeRow("BTC", "2026-08-04T06:14:00.000Z", { source_run_id: "run-a", refresh_request_id: "req-a" })
  ];

  const result = selectLatestLayer1RowsByAgent(rows);
  assert.equal(result.selected.USD.created_at, "2026-08-04T06:10:00.000Z");
  assert.equal(result.sourceRunConsistency, "MATCHED");
  assert.equal(result.refreshRequestConsistency, "MATCHED");
});

test("sorts by timestamp instead of input order", () => {
  const rows = [
    makeRow("USD", "2026-08-04T06:00:00.000Z", { source_run_id: "run-old" }),
    makeRow("USD", "2026-08-04T06:20:00.000Z", { source_run_id: "run-new" }),
    makeRow("EUR", "2026-08-04T06:11:00.000Z", { source_run_id: "run-new" }),
    makeRow("GOLD", "2026-08-04T06:12:00.000Z", { source_run_id: "run-new" }),
    makeRow("NQ", "2026-08-04T06:13:00.000Z", { source_run_id: "run-new" }),
    makeRow("BTC", "2026-08-04T06:14:00.000Z", { source_run_id: "run-new" })
  ];

  const result = selectLatestLayer1RowsByAgent(rows.reverse());
  assert.equal(result.selected.USD.source_run_id, "run-new");
});

test("handles more than 1000 historical rows without changing the chosen latest rows", () => {
  const rows = [];
  for (let index = 0; index < 1100; index += 1) {
    rows.push(makeRow("USD", `2026-07-01T00:${String(index % 60).padStart(2, "0")}:00.000Z`, { source_run_id: `old-${index}` }));
  }
  rows.push(makeRow("USD", "2026-08-04T06:20:00.000Z", { source_run_id: "run-current" }));
  rows.push(makeRow("EUR", "2026-08-04T06:21:00.000Z", { source_run_id: "run-current" }));
  rows.push(makeRow("GOLD", "2026-08-04T06:22:00.000Z", { source_run_id: "run-current" }));
  rows.push(makeRow("NQ", "2026-08-04T06:23:00.000Z", { source_run_id: "run-current" }));
  rows.push(makeRow("BTC", "2026-08-04T06:24:00.000Z", { source_run_id: "run-current" }));

  const result = selectLatestLayer1RowsByAgent(rows);
  assert.equal(result.selected.USD.source_run_id, "run-current");
  assert.equal(result.selectedRows.length, 5);
});

test("does not silently fall back to an older complete run when the latest publication is incomplete", () => {
  const olderCompleteRun = REQUIRED_AGENTS.map((agent, index) => (
    makeRow(agent, `2026-08-04T05:${10 + index}:00.000Z`, { source_run_id: "run-complete", refresh_request_id: "req-complete" })
  ));
  const newerPartialRun = [
    makeRow("USD", "2026-08-04T06:10:00.000Z", { source_run_id: "run-partial", refresh_request_id: "req-partial" }),
    makeRow("EUR", "2026-08-04T06:11:00.000Z", { source_run_id: "run-partial", refresh_request_id: "req-partial" }),
    makeRow("GOLD", "2026-08-04T06:12:00.000Z", { source_run_id: "run-partial", refresh_request_id: "req-partial" }),
    makeRow("NQ", "2026-08-04T06:13:00.000Z", { source_run_id: "run-partial", refresh_request_id: "req-partial" })
  ];

  const result = selectLatestLayer1RowsByAgent([...olderCompleteRun, ...newerPartialRun]);
  assert.equal(result.selected.BTC.source_run_id, "run-complete");
  assert.equal(result.consistencyStatus, "MISMATCHED");
  assert.equal(result.sourceRunConsistency, "MISMATCHED");
  assert.equal(result.refreshRequestConsistency, "MISMATCHED");
});
