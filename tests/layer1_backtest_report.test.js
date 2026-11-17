const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { SCHEMA_VERSION } = require("../lib/layer1_backtesting/report");
const { renderMarkdown } = require("../lib/layer1_backtesting/markdown");
const { sha256, stableStringify } = require("../lib/layer1_backtesting/engine");
const { build, DOC_PATH, RUN_PATH, ENGINE_PATH } = require("../scripts/build_layer1_backtest_report");

/**
 * The Layer 1 backtest report is one artefact rendered twice: an ignored JSON for the provenance digest and a
 * committed markdown for the reader. These tests hold the two together, so a number cannot appear in the prose
 * that the engine did not produce, and the committed markdown cannot drift from a fresh build.
 */

const ROOT = path.resolve(__dirname, "..");

/** Build once: the report reads two multi-megabyte artefacts and every test below reads the same object. */
let cached = null;
function report() {
  if (!cached) cached = build();
  return cached;
}

test("the engine reconciles both models against the published artefacts with no mismatch", () => {
  const reportObject = report();
  assert.equal(reportObject.schema_version, SCHEMA_VERSION);
  assert.equal(reportObject.decisions.mismatch_count, 0);
  assert.equal(reportObject.decisions.reconciliation.mismatch, 0);
  for (const role of ["control", "candidate"]) {
    const summary = reportObject.decisions.by_model[role];
    assert.ok(summary, `${role} must be summarised`);
    assert.equal(summary.sessions, reportObject.scope.sessions);
    assert.equal(
      summary.allowed + summary.abstained + summary.blocked,
      summary.sessions,
      `${role} outcomes must partition the sessions`
    );
    assert.equal(summary.reconciling.mismatch, 0, `${role} must not contradict its own artefact`);
    assert.ok(summary.reconciling.match > 0, `${role} must reconcile at least one field`);
  }
});

test("a field the artefact never published is counted, not scored as wrong", () => {
  const reportObject = report();
  const control = reportObject.decisions.by_model.control;
  const candidate = reportObject.decisions.by_model.candidate;
  const totals = reportObject.decisions.reconciliation;
  assert.ok(control.reconciling.not_published > 0, "the published control artefact omits fields the engine holds");
  assert.equal(
    totals.fields_compared,
    totals.match + totals.engine_stricter + totals.mismatch,
    "an unpublished field is held apart from the compared ones"
  );
  assert.equal(
    totals.not_published,
    control.reconciling.not_published + candidate.reconciling.not_published,
    "the per-model counts add up to the totals"
  );
  assert.equal(
    totals.match,
    control.reconciling.match + candidate.reconciling.match,
    "the per-model matches add up to the totals"
  );
});


test("every finding states a claim, prints its numbers and points at the artefact it came from", () => {
  const { findings } = report();
  assert.deepEqual(
    findings.map((finding) => finding.id),
    ["F1", "F2", "F3", "F4", "F5", "F6", "F7"]
  );
  for (const finding of findings) {
    assert.ok(finding.claim.length > 40, `${finding.id} must make a claim, not a label`);
    assert.ok(Object.keys(finding.numbers || {}).length > 0, `${finding.id} must print numbers`);
    assert.ok((finding.evidence || []).length > 0, `${finding.id} must cite evidence`);
    for (const entry of finding.evidence) {
      assert.ok(fs.existsSync(path.join(ROOT, entry.path)), `${finding.id} cites a missing file: ${entry.path}`);
    }
  }
});

test("the owner decisions and blockers are carried into the report rather than left implicit", () => {
  const reportObject = report();
  assert.deepEqual(
    reportObject.owner_decisions.map((entry) => entry.id),
    ["OD-1", "OD-2", "OD-3", "OD-4", "OD-5"]
  );
  for (const entry of reportObject.owner_decisions) {
    assert.equal(entry.status, "resolved", `${entry.id} must be resolved`);
    assert.ok(entry.question && entry.decision && entry.does_not_license, `${entry.id} must be answerable`);
    assert.ok(Array.isArray(entry.effect) && entry.effect.length > 0, `${entry.id} must state its effect`);
  }
  assert.ok(reportObject.blockers.length > 0);
  for (const blocker of reportObject.blockers) assert.ok(blocker.id && blocker.detail && blocker.effect);
});

test("the markdown is rendered from the same object, with no placeholder text", () => {
  const reportObject = report();
  const markdown = renderMarkdown(reportObject);
  for (const heading of [
    "## 1. Scope",
    "## 2. The engine and the two models",
    "## 3. Decisions",
    "## 4. Findings",
    "## 5. Readiness",
    "## 6. The four tests",
    "## 7. Blockers",
    "## 8. Owner decisions",
    "## 9. What this report does not claim",
    "## 10. Limitations",
    "## Provenance",
  ]) {
    assert.ok(markdown.includes(heading), `missing section: ${heading}`);
  }
  for (const id of ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "OD-1", "OD-2", "OD-3", "OD-4", "OD-5"]) {
    assert.ok(markdown.includes(id), `missing ${id} in the markdown`);
  }
  assert.equal(markdown.includes("[object Object]"), false);
  assert.equal(/\bundefined\b/.test(markdown), false);
  assert.equal(/\bNaN\b/.test(markdown), false);
  assert.ok(markdown.endsWith("\n"));
  assert.ok(
    markdown.includes(reportObject.provenance.report_sha256),
    "the prose must carry the digest it came from"
  );
});

test("a report from another schema is refused rather than rendered half-way", () => {
  assert.throws(
    () => renderMarkdown({ ...report(), schema_version: "layer1-backtest-report.v0" }),
    /expected a layer1-backtest-report\.v1 report/
  );
  assert.throws(() => renderMarkdown(null), /expected a layer1-backtest-report\.v1 report/);
});

test("the committed markdown equals a fresh render of the stored artefacts", () => {
  const committed = fs.readFileSync(path.join(ROOT, DOC_PATH), "utf8");
  assert.equal(committed, renderMarkdown(report()), `${DOC_PATH} is stale; rerun the builder`);
});

test("the provenance digest is reproducible and the inputs are the files it names", () => {
  const reportObject = report();
  const { provenance, ...body } = reportObject;
  assert.equal(provenance.report_sha256, sha256(stableStringify(body)));
  const paths = provenance.inputs.map((input) => input.path);
  for (const required of [RUN_PATH, ENGINE_PATH]) assert.ok(paths.includes(required), `${required} must be stamped`);
  for (const input of provenance.inputs) {
    const buffer = fs.readFileSync(path.join(ROOT, input.path));
    assert.equal(input.bytes, buffer.length, `${input.path} byte count`);
    assert.equal(input.sha256, sha256(buffer.toString("utf8")), `${input.path} digest`);
  }
});

