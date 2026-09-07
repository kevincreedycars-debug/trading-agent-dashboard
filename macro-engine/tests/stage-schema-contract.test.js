"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const schema = fs.readFileSync(path.join(__dirname, "../sql/001_macro_stage_contract.sql"), "utf8");

test("staged schema preserves the required append-only macro-engine surfaces", () => {
  for (const table of [
    "event_records", "market_observations", "shock_candidates", "call_versions",
    "call_event_links", "call_state_transitions", "layer2_candidate_versions", "notification_records"
  ]) {
    assert.match(schema, new RegExp(`create table if not exists macro_stage\\.${table}`));
  }
  assert.match(schema, /revision_of_event_id text references macro_stage\.event_records/);
  assert.match(schema, /next_review_at <= hard_expires_at/);
  assert.match(schema, /BASELINE' and baseline_call_id = call_id/);
  assert.match(schema, /Do not apply to the live Inputs Database project/);
});
