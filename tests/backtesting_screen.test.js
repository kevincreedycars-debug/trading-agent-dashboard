"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { build, OUT_PATH } = require("../scripts/build_backtesting_screen");
const { createLedger, saveDecision } = require("../lib/layer1_backtesting/ledger");

const ROOT = path.resolve(__dirname, "..");
const screen = build();
const html = fs.readFileSync(path.join(ROOT, "backtesting.html"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("the payload carries the two models, the session, the range and four tests with one row per morning", () => {
  assert.equal(screen.schema_version, "backtesting-screen.v1");
  assert.equal(screen.research_only, true);
  assert.equal(screen.summary.selected_models.length, 2);
  assert.equal(screen.summary.selected_models[0].role, "control");
  assert.equal(screen.summary.selected_models[1].role, "candidate");
  assert.equal(screen.summary.sessions, 725);
  assert.equal(screen.summary.first_date, "2024-01-02");
  assert.equal(screen.summary.last_date, "2026-10-12");
  assert.match(screen.summary.session, /05:00/);
  assert.equal(screen.tests.definitions.length, 4);
  for (const def of screen.tests.definitions) {
    assert.equal(screen.tests.rows[def.id].length, screen.summary.sessions, `${def.id} needs one row per scheduled morning`);
  }
  for (const model of screen.summary.selected_models) {
    assert.ok(model.version && model.executable_entry_points.length >= 2, `${model.id} needs a version and entry points`);
  }
});

test("the requested H1 package is verified as absent, with a search record rather than an assertion", () => {
  const pkg = screen.package_identity;
  assert.equal(pkg.requested, "USD-L1-25F-H1-v0.1.0");
  assert.equal(pkg.status, "NOT_PRESENT_IN_CHECKOUT");
  assert.equal(pkg.hits.length, 0, "the verifier must not match its own source file");
  assert.ok(pkg.searched.length > 40);
  assert.ok(pkg.blockers.length >= 2);
  assert.match(pkg.consequence, /legacy implemented book/);
  assert.equal(screen.audit && screen.decisions.length, 5);
});

test("all 25 adjudications are reviewed against the executable rules, with every hypothesis visible", () => {
  const mapping = screen.mapping_review;
  assert.equal(mapping.rows.length, 25);
  const counted = Object.values(mapping.summary.by_status).reduce((total, value) => total + value, 0);
  assert.equal(counted, 25);
  assert.equal(mapping.summary.mapped_and_executable, 7);
  assert.equal(mapping.summary.missing_implementation, 7);
  assert.match(mapping.verdict, /incomplete/);
  assert.ok(mapping.hypotheses.length >= 10);
  assert.ok(mapping.hypotheses.some((hypothesis) => hypothesis.id === "H-10" && /H1/.test(hypothesis.text)));
  for (const row of mapping.rows) assert.ok(row.status && row.treatment, `${row.factor_id} needs a status`);
});

test("every test references a stored decision record and none is missing", () => {
  const ledger = screen.ledger;
  assert.equal(ledger.entries, 2 * screen.summary.sessions);
  assert.equal(ledger.saves, ledger.entries);
  assert.equal(ledger.conflicts, 0);
  assert.equal(ledger.duplicates, 4 * 2 * screen.summary.sessions);
  for (const [testId, roles] of Object.entries(ledger.references)) {
    for (const [role, reference] of Object.entries(roles)) {
      assert.equal(reference.total, screen.summary.sessions, `${testId}/${role} must reference every morning`);
      assert.equal(reference.missing, 0, `${testId}/${role} must not have a dangling reference`);
      assert.ok(reference.sample.every((row) => row.decision_id.includes("@")), "a reference names the record");
    }
  }
  const row = screen.tests.rows.four_markets[0];
  assert.match(row.candidate.decision_id, /^usd_candidate_25f_v1@\d{4}-\d{2}-\d{2}$/);
});

test("the run audit catches a missing required input and a deliberately wrong model version", () => {
  const audit = screen.audit;
  assert.equal(audit.missing_input.caught, true);
  const missing = audit.missing_input.findings.find((finding) => finding.code === "missing_required_input");
  assert.ok(missing && missing.fields.length > 0);
  assert.equal(missing.severity, "error");
  assert.ok(audit.missing_input.findings.some((finding) => finding.code === "trade_on_blocked_morning"));
  assert.equal(audit.wrong_version.caught, true);
  assert.ok(audit.wrong_version.findings.some((finding) => finding.code === "model_version_mismatch"));
  assert.equal(audit.wrong_version.ledger_rejected, true);
  assert.equal(audit.clean.clean, true, "a clean record proves the audit does not fail everything");
  assert.equal(screen.legend.valid_abstention.includes("chose not to call"), true);
});

test("the five owner decisions are resolved, with the frozen flat bands returned per instrument", () => {
  assert.deepEqual(screen.decisions.map((entry) => entry.id), ["OD-1", "OD-2", "OD-3", "OD-4", "OD-5"]);
  for (const entry of screen.decisions) {
    assert.equal(entry.status, "resolved");
    assert.ok(entry.decision && entry.does_not_license);
  }
  const bands = screen.flat_bands;
  assert.equal(bands.status, "FROZEN_BEFORE_HOLDOUT_SCORING");
  assert.equal(bands.holdout.examined_for_band_selection, false);
  assert.equal(bands.instruments.length, 5);
  for (const instrument of bands.instruments) {
    assert.ok(instrument.band_pct > 0, `${instrument.instrument} needs a band`);
    assert.ok(instrument.sample > 0);
    assert.match(instrument.tie_treatment, /equals the band/);
  }
  assert.match(bands.tie_treatment.vote_tie, /NO_CALL/);
  assert.equal(bands.digest.length, 64);
});

test("the coverage trace reports five separate counts and never asserts containment", () => {
  const trace = screen.coverage_trace;
  const candidate = trace.by_model.candidate;
  const control = trace.by_model.control;
  assert.equal(candidate.scheduled, 725);
  assert.equal(candidate.reconstructed, 515);
  assert.equal(candidate.directional, 121);
  assert.equal(candidate.valid_strict, 0);
  assert.equal(candidate.overlap.both + candidate.overlap.reconstructed_only, candidate.reconstructed);
  assert.equal(candidate.overlap.both + candidate.overlap.directional_only, candidate.directional);
  assert.equal(control.scheduled, 725);
  assert.equal(control.reconstructed, 714);
  assert.equal(control.directional, 609);
  assert.match(candidate.scored_basis, /reconstructed/);
  assert.equal(trace.note.includes("instead of asserting that one contains the other"), true);
});

test("control parity is not claimed: spread, Fed bias, surprise and DXY each carry a finding", () => {
  const parity = screen.summary.parity;
  assert.equal(parity.verdict, "NOT_ESTABLISHED");
  assert.deepEqual(parity.factors.map((factor) => factor.id), ["F3", "F5", "F7", "F8"]);
  for (const factor of parity.factors) assert.ok(factor.finding.length > 20 && factor.status);
  const spread = parity.factors.find((factor) => factor.id === "F3");
  assert.equal(spread.mornings_with_value, 11);
});

test("a blocked morning opens its missing observation, the 05:00 requirement, affected dates and the unblock action", () => {
  const rows = screen.tests.rows.dxy_direction_broker_cfd;
  const blocked = rows.find((row) => row.candidate.status === "blocked" && row.candidate.gaps.length);
  assert.ok(blocked, "at least one blocked morning must carry a named gap");
  const gap = screen.tests.gaps[blocked.candidate.gaps[0]];
  assert.ok(gap.sources.length > 0);
  assert.match(gap.evidence_requirement, /05:00/);
  assert.equal(gap.affected.dates.length, gap.affected.count);
  assert.ok(gap.affected.first && gap.affected.last);
  assert.ok(gap.action.length > 10);
  const abstention = rows.find((row) => row.candidate.status === "valid_abstention");
  assert.ok(abstention, "a valid abstention must be a status of its own");
  assert.notEqual(abstention.candidate.status, "blocked");
  assert.equal(abstention.candidate.outcome, "abstained");
});

test("the committed payload reproduces byte for byte from the stored artefacts", () => {
  const fresh = build();
  const stored = fs.readFileSync(path.join(ROOT, OUT_PATH), "utf8");
  assert.equal(stored, `${JSON.stringify(fresh, null, 2)}\n`, "rerun node scripts/build_backtesting_screen.js");
  assert.equal(fresh.provenance.screen_sha256.length, 64);
  assert.equal(fresh.provenance.inputs.length >= 4, true);
  assert.equal(JSON.stringify(fresh).includes("[object Object]"), false);
  assert.equal(/\\bNaN\\b/.test(JSON.stringify(fresh)), false);
  assert.equal(/\\bundefined\\b/.test(JSON.stringify(fresh)), false);
});

test("the page loads the payload, opens from the main navigation and keeps the map and abstention status on screen", () => {
  assert.equal(index.includes('href="backtesting.html"'), true, "the main navigation must link the screen");
  assert.equal(html.includes('data/usd-layer1-backtester/backtesting-screen-v1.json'), true);
  for (const id of ["overview", "architecture", "tests", "ledger", "audit", "decisions"]) {
    assert.equal(html.includes(`${id}:"`), true, `the ${id} view must exist`);
  }
  assert.equal(html.includes('id="map"'), true);
  assert.equal(html.includes("valid_abstention"), true);
  assert.equal(html.includes("05:00"), true);
  assert.equal(html.includes("USD-L1-25F-H1-v0.1.0") || html.includes("package_identity"), true);
  assert.equal(html.includes("[object Object]"), false);
  assert.equal(html.includes("undefined</"), false);
});

test("the four H1 tests are labelled unscored for the requested package", () => {
  const official = screen.tests.definitions.find((def) => def.id === "dxy_direction");
  assert.equal(official.usable_sessions, 0);
  assert.match(official.status, /blocked/);
  const l2l = screen.tests.definitions.find((def) => def.id === "l2l_path");
  assert.equal(l2l.usable_sessions, 0);
  assert.match(screen.package_identity.consequence, /not the requested H1 package/);
  const broker = screen.tests.definitions.find((def) => def.id === "dxy_direction_broker_cfd");
  assert.match(broker.status, /proxy/);
});

test("the ledger saves once per model per morning and refuses a conflicting second save", () => {
  const ledger = createLedger();
  const record = { date: "2024-01-02", model: { id: "m1", version: "v1" }, outcome: "blocked", snapshot_sha256: "abc" };
  const first = saveDecision(ledger, record);
  assert.equal(first.duplicate, false);
  const second = saveDecision(ledger, { ...record });
  assert.equal(second.duplicate, true);
  assert.equal(ledger.saves, 1);
  assert.equal(ledger.duplicates, 1);
  assert.throws(() => saveDecision(ledger, { ...record, outcome: "allowed" }), /conflicting decision/);
  assert.equal(ledger.conflicts, 1);
});
