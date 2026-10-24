"use strict";

// The export script's own rules: where a stored row is written on disk, and when a copy counts as
// verified. The network half is exercised by running the script itself; these cases pin the parts
// that decide whether a copy can land outside the export folder or be trusted.

const test = require("node:test");
const assert = require("node:assert/strict");

const { safeSegment, documentRelativePath, manifestEntry, summarise } = require("../scripts/research_library_export.js");

const SHA = "e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d";

function row(overrides) {
  return Object.assign({
    id: "d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc",
    topic_id: "usd-factor-live-f1-vix-level",
    stage: 1,
    version: 1,
    title: "F1 VIX level and risk regime - Research",
    kind: "report",
    original_filename: "VIX_USD_Research_Report.md",
    sha256: SHA,
    bytes: 84056,
    storage_path: `usd-factor-live-f1-vix-level/1/v1-${SHA}.md`,
    parent_research_id: null,
    parent_research_ref: "",
    parent_red_team_id: null,
    parent_red_team_ref: "",
    uploaded_by: "4c7abd3d-e6a0-4d9d-b6cb-4d289d8a0063",
    uploaded_at: "2026-10-20T19:25:28.825673+00:00",
    notes: ""
  }, overrides || {});
}

test("a stored row is exported beside a folder named after its chain and stage", () => {
  assert.equal(documentRelativePath(row()), `documents/usd-factor-live-f1-vix-level/1/v1-${SHA}.md`);
  assert.equal(documentRelativePath(row({ original_filename: "note.txt" })), `documents/usd-factor-live-f1-vix-level/1/v1-${SHA}.txt`);
  assert.equal(documentRelativePath(row({ original_filename: "no-extension" })), `documents/usd-factor-live-f1-vix-level/1/v1-${SHA}.md`);
  assert.equal(documentRelativePath(row({ stage: 3, version: 2 })), `documents/usd-factor-live-f1-vix-level/3/v2-${SHA}.md`);
});

test("a row that could write outside the export folder is refused", () => {
  assert.throws(() => documentRelativePath(row({ topic_id: "../elsewhere" })), /path character/);
  assert.throws(() => documentRelativePath(row({ topic_id: ".." })), /unusable/);
  assert.throws(() => documentRelativePath(row({ topic_id: "" })), /unusable/);
  assert.throws(() => documentRelativePath(row({ sha256: "../../escape" })), /path character/);
  assert.throws(() => safeSegment("C:\\Windows", "topic_id"), /path character/);
  assert.throws(() => safeSegment("a/b", "topic_id"), /path character/);
});

test("a stage or version outside the store's own range is refused", () => {
  assert.throws(() => documentRelativePath(row({ stage: 4 })), /stage is not 1, 2 or 3/);
  assert.throws(() => documentRelativePath(row({ stage: 0 })), /stage is not 1, 2 or 3/);
  assert.throws(() => documentRelativePath(row({ version: 0 })), /positive integer/);
  assert.throws(() => documentRelativePath(row({ version: 1.5 })), /positive integer/);
});

test("a copy counts as verified only when its bytes hash to the recorded sha256", () => {
  const good = manifestEntry(row(), documentRelativePath(row()), SHA);
  assert.equal(good.verified, true);
  assert.equal(good.sha256, SHA);
  assert.equal(good.computed_sha256, SHA);
  assert.equal(good.file, `documents/usd-factor-live-f1-vix-level/1/v1-${SHA}.md`);

  const damaged = manifestEntry(row(), documentRelativePath(row()), "0".repeat(64));
  assert.equal(damaged.verified, false);

  const missing = manifestEntry(row(), documentRelativePath(row()), "");
  assert.equal(missing.verified, false);
  assert.equal(missing.computed_sha256, "");
});

test("the manifest carries the parent links the stage gate depends on", () => {
  const stageTwo = manifestEntry(row({
    id: "11111111-2222-4333-8444-555555555555",
    stage: 2,
    kind: "review",
    parent_research_id: "d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc",
    parent_research_ref: ""
  }), documentRelativePath(row({ stage: 2 })), SHA);
  assert.equal(stageTwo.parent_research_id, "d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc");
  assert.equal(stageTwo.parent_research_ref, "");
  assert.equal(stageTwo.stage, 2);
});

test("the summary counts what was verified and what was not", () => {
  const documents = [
    manifestEntry(row(), "documents/a/1/v1-aa.md", SHA),
    manifestEntry(row({ id: "second" }), "documents/a/1/v2-bb.md", "f".repeat(64))
  ];
  assert.deepEqual(summarise(documents), { documents: 2, verified: 1, failed: 1, bytes: 168112 });
  assert.deepEqual(summarise([]), { documents: 0, verified: 0, failed: 0, bytes: 0 });
});
