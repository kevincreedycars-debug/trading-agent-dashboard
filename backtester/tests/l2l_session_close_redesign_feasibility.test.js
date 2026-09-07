const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RESULTS,
  classifyFeatureField,
  classifyResult,
  parseSqlColumns
} = require("../lib/l2l_session_close_redesign_feasibility");

test("sql parser extracts column names before constraints", () => {
  const sql = `
create table example (
  id uuid primary key,
  snapshot_date date,
  raw_vix_level numeric,
  latest_us_event_time timestamptz,
  constraint example_pk primary key (id)
);`;
  assert.deepEqual(parseSqlColumns(sql), ["id", "snapshot_date", "raw_vix_level", "latest_us_event_time"]);
});

test("feature classifier marks date-only market fields as ambiguous", () => {
  const field = classifyFeatureField("dxy_d5");
  assert.equal(field.include, true);
  assert.equal(field.lookaheadAssessment, "AMBIGUOUS_DATE_ONLY_BEFORE_SESSION");
});

test("feature classifier allows exact event timestamps subject to pre-session filtering", () => {
  const field = classifyFeatureField("latest_us_event_time");
  assert.equal(field.include, true);
  assert.equal(field.lookaheadAssessment, "DEFENSIBLE_IF_FILTERED_STRICTLY_BEFORE_SESSION_START");
});

test("overall result prioritises non-defensible timing", () => {
  const result = classifyResult(
    { timingDefensible: false },
    {
      configuredReadOnlyEnvironmentAvailable: false,
      usdLocalSnapshotSourceUnavailable: true,
      localSourceStopAtOrBefore2026_04_30: true
    }
  );
  assert.equal(result, RESULTS.INPUT_TIMING_NOT_DEFENSIBLE);
});
