"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { build, OUT_PATH } = require("../scripts/build_backtesting_screen");
const { createLedger, saveDecision } = require("../lib/layer1_backtesting/ledger");
const { REQUIRED_TYPES, matchEventTypes } = require("../lib/layer1_backtesting/h1_coverage");

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

test("the requested H1 package is registered, verified byte for byte and reproducible from its own runner", () => {
  const pkg = screen.package_identity;
  assert.equal(pkg.requested, "USD-L1-25F-H1-v0.1.0");
  assert.equal(pkg.status, "PRESENT");
  const h1 = screen.h1.package;
  assert.equal(h1.status, "VERIFIED");
  assert.equal(h1.package.root, "backtester/packages/USD-L1-25F-H1-v0.1.0");
  assert.equal(h1.package.commit, "60e695bccabd9a370cc2688a1f791d07dd94720d");
  assert.equal(h1.internal_checksums.verified, h1.internal_checksums.declared);
  assert.equal(h1.internal_checksums.declared, 16);
  assert.deepEqual(h1.internal_checksums.mismatches, []);
  assert.equal(h1.acceptance.exit_code, 0);
  assert.equal(h1.acceptance.status, "PASS");
  assert.equal(h1.declared_hashes.rulebook_sha256, "e2e29421a95f903123d6353c8a7f7b323f418ef7392384b21bfe8b559511c80b");
  assert.equal(h1.archive.sha256, "1c82e9048a3cf2237ffea6873b8099389d09fccefa083cd38ccb87517e3672e0");
  assert.equal(h1.contents.rows, 25);
  assert.ok(
    screen.provenance.inputs.some((input) => input.path === "backtester/packages/USD-L1-25F-H1-v0.1.0/inputs.json"),
    "the H1 input contract must be a named provenance input"
  );
  assert.ok(
    screen.provenance.inputs.some((input) => input.path === "data/usd-layer1-backtester/event-calendar-v1.json"),
    "the staged event calendar must be a named provenance input"
  );
  assert.equal(screen.h1.fixtures.status, "ALL_MATCH");
  assert.equal(screen.h1.fixtures.matched, 5);
  assert.equal(screen.h1.fixtures.total, 5);
  assert.equal(screen.audit && screen.decisions.length, 5);
  assert.equal(screen.morning_run.date, "2024-03-26");
  assert.equal(screen.morning_run.strict_evidence.ready, false);
  assert.equal(screen.morning_run.models.current.direction, "BEARISH");
  assert.equal(screen.morning_run.models.h1.outcome, "blocked");
});

test("every one of the 25 adjudications is accounted for, with the shared evidence and the findings visible", () => {
  const review = screen.h1.review;
  assert.equal(review.rows.length, 25);
  assert.equal(review.summary.adjudications, 25);
  assert.equal(review.summary.with_declared_input, 15);
  assert.equal(review.summary.no_declared_input, 10);
  assert.equal(review.summary.votes, 8);
  assert.deepEqual(review.summary.votes_by_family_series, { rates: 2, momentum: 2, cross_market: 2 });
  assert.equal(review.summary.distinct_vote_series, 6);
  assert.equal(review.summary.gate_inputs, 2);
  assert.equal(review.summary.required_not_voting_rows, 2);
  assert.equal(review.accounting.all_pass, true, "the accounting checks must all pass");
  assert.equal(review.arithmetic.matched, review.arithmetic.tokens);
  assert.deepEqual(review.arithmetic.mismatches, []);
  for (const row of review.rows) {
    assert.ok(row.treatment && row.effect && row.assumption, `${row.id} must state its treatment and assumption`);
    assert.ok(Array.isArray(row.discrepancies));
  }
  const vix = review.shared_evidence.find((item) => item.input === "vix");
  assert.equal(vix.reads, 3);
  assert.equal(vix.votes, 0);
  assert.equal(vix.non_voting, true);
  const spread = review.shared_evidence.find((item) => item.input === "spread");
  assert.equal(spread.reads, 2);
  assert.equal(spread.votes, 1);
  const codes = review.discrepancies.map((item) => item.code);
  assert.ok(codes.includes("zero_age_contradicts_receipt"), "the ICE zero-age contradiction must be recorded");
  assert.ok(codes.includes("required_input_cannot_vote"));
  for (const item of review.discrepancies) {
    assert.ok(item.finding && item.consequence && item.rows.length && item.status);
  }
});

test("H1 historical readiness is the measured nine-input audit, not a legacy score", () => {
  const h1 = screen.h1;
  assert.equal(h1.model.id, "usd_l1_25f_h1");
  assert.equal(h1.model.version, "USD-L1-25F-H1-v0.1.0");
  assert.equal(h1.coverage.inputs.length, 9);
  assert.equal(h1.coverage.scheduled, 725);
  assert.equal(h1.coverage.ready, 0);
  assert.equal(h1.coverage.blocked, 725);
  assert.equal(h1.coverage.sealed_ready, 0);
  assert.equal(h1.coverage.sealed_blocked, 725);
  assert.equal(h1.coverage.evidence_policy.historical_reconstruction.receipt_required, false);
  assert.equal(h1.coverage.evidence_policy.sealed_live_replay.receipt_required, true);
  assert.equal(h1.coverage.evidence_mode, "historical_reconstruction");
  assert.equal(h1.coverage.earliest_eligible, null);
  assert.equal(h1.historical.eligible, h1.coverage.ready);
  assert.equal(h1.historical.blocked, h1.coverage.blocked);
  assert.equal(h1.historical.performance, "UNSCORED");
  assert.equal(h1.coverage.event_calendar.complete, false);
  assert.equal(h1.coverage.receipts.recorded, 0);
  assert.equal(h1.coverage.binding.model_version, h1.model.version);
  assert.equal(h1.coverage.binding.run_id, "run-v1");
  assert.equal(h1.coverage.legacy_replacement.retired, true);
  for (const input of h1.coverage.inputs) {
    assert.ok(input.blocker_text, `${input.key} must name its first blocker`);
    assert.ok(input.acquisition, `${input.key} must name the acquisition`);
  }
  // No morning is ready: two inputs are still absent and the amended ice input reaches 455 of the 725.
  assert.equal(h1.coverage.mornings.every((morning) => morning.ready === false), true);
  const byKey = new Map(h1.coverage.inputs.map((input) => [input.key, input]));
  const amended = h1.coverage.inputs.filter((input) => input.amended);
  assert.deepEqual(
    amended.map((input) => input.key),
    ["real", "ice"],
    "the real and ice inputs are the two the audit evaluates under an amendment"
  );
  assert.equal(byKey.get("ice").eligible, 455);
  assert.equal(byKey.get("ice").blocked, 270);
  assert.equal(byKey.get("ice").supplied_contract.source, "ICE", "the v0.1.0 row is published beside the amendment");
  assert.equal(byKey.get("ice").is_official_cash_dxy, false);
  assert.equal(byKey.get("ice").code, "partial_evidence");
  assert.equal(byKey.get("real").supplied_contract.source, "Federal Reserve H.15", "H1-A02 names the publisher of record");
  assert.equal(byKey.get("real").source, "U.S. Department of the Treasury");
  // The imported evidence reaches every morning for four inputs, most of them for the broad dollar and the
  // spread, and none for the two inputs that are still absent.
  for (const [key, eligible] of [
    ["front", 725],
    ["real", 725],
    ["vix", 725],
    ["qqq", 725],
    ["broad", 564],
    ["ice", 455],
    ["spread", 697],
    ["gold", 0],
    ["calendar", 0],
  ]) {
    assert.equal(byKey.get(key).eligible, eligible, `${key} must report its own measured eligibility`);
  }
  for (const input of h1.coverage.inputs) {
    assert.equal(input.source.length > 0, true);
  }
  assert.equal(h1.coverage.mornings.length, 725);
  assert.ok(h1.coverage.mornings.every((morning) => morning.ready === false));
  assert.equal(h1.coverage.gaps.length, 5, "every input that still has a gap must appear");
  for (const gap of h1.coverage.gaps) {
    assert.ok(gap.dataset.includes("·"), `${gap.input} must name its dataset and source`);
    assert.ok(gap.factor_count > 0, `${gap.input} must name the factors it blocks`);
    assert.ok(gap.affected.sessions > 0 && gap.affected.first && gap.affected.last);
    assert.ok(gap.missing_evidence.length > 20, `${gap.input} must state the missing evidence`);
    assert.ok(gap.obtain.length > 20, `${gap.input} must state what to obtain`);
    assert.ok(gap.reusable_evidence, `${gap.input} must state what legacy evidence is reusable`);
    assert.ok(gap.remaining_requirement.length > 20, `${gap.input} must state what remains`);
    assert.ok(gap.user_action.length > 20, `${gap.input} must state the exact user action`);
    assert.ok(gap.import.target_file.startsWith("data/usd-layer1-backtester/h1-v1/"));
    assert.ok(gap.import.record_fields.includes("received_at_utc"));
  }
  const ice = h1.coverage.gaps.find((gap) => gap.input === "ice");
  assert.equal(ice.factor_count, 1);
  assert.equal(ice.factors[0].id, "fx.usd-session-momentum");
  // The amended input still owes 270 mornings: 246 before the tape's first usable 05:00 bar and 24
  // inside it (exchange holidays plus the archive's 2025-06 hole).
  assert.equal(ice.affected.sessions, 270);
  assert.equal(ice.code, "partial_evidence");
});

test("gated blocked mornings contribute no direction, trade or scored outcome, while the legacy contradictions are preserved", () => {
  const integrity = screen.integrity;
  assert.equal(integrity.gated.model_id, "usd_candidate_25f_v1");
  assert.equal(integrity.gated.blocked, 541);
  assert.equal(integrity.gated.blocked_with_direction, 0);
  assert.equal(integrity.gated.blocked_with_trade, 0);
  assert.equal(integrity.gated.blocked_scored, 0);
  assert.equal(integrity.legacy.blocked, 541);
  assert.equal(integrity.legacy.blocked_with_direction, 75);
  assert.equal(integrity.legacy.blocked_with_trade, 21);
  assert.equal(integrity.legacy.preserved, true);
  assert.ok(integrity.legacy.sample_dates.direction.length > 0);
  assert.ok(integrity.legacy.sample_dates.trade.length > 0);
  assert.equal(integrity.h1.scheduled, 725);
  assert.equal(integrity.h1.directional, 0);
  assert.equal(integrity.h1.trades, 0);
  assert.equal(integrity.h1.scored, 0);
  for (const test of screen.tests.definitions) {
    for (const row of screen.tests.rows[test.id]) {
      assert.equal(row.h1.model_version, "USD-L1-25F-H1-v0.1.0");
      assert.equal(row.h1.status, "unscored");
      assert.equal(row.h1.direction, "NO_CALL");
      assert.equal(row.h1.trade_eligible, false);
      assert.equal(row.h1.scored, false);
    }
  }
  assert.match(screen.model_identity.statement, /CONFIG_BLOCKED applies to usd_candidate_25f_v1/);
  assert.match(screen.model_identity.statement, /H1.*unscored/);
  assert.match(screen.model_identity.statement, /broker DXY\.cash/);
});

test("H1 decisions are saved once and the audit catches a missing input, a wrong version and the wrong saved decision", () => {
  const historical = screen.h1.historical;
  const audit = screen.h1.audit;
  assert.equal(historical.ledger.entries, 725);
  assert.equal(historical.ledger.model_id, "usd_l1_25f_h1");
  assert.equal(historical.ledger.model_version, "USD-L1-25F-H1-v0.1.0");
  assert.equal(historical.ledger.rulebook_digest, screen.h1.package.declared_hashes.rulebook_sha256);
  assert.equal(historical.rows.length, 725);
  const ids = new Set(historical.rows.map((row) => row.decision_id));
  assert.equal(ids.size, 725, "every saved decision id must be unique");
  assert.ok(historical.rows.every((row) => /^usd_l1_25f_h1@\d{4}-\d{2}-\d{2}$/.test(row.decision_id)));
  assert.ok(
    historical.rows.every((row) => row.outcome === "blocked" && (row.direction === null || row.direction === "NO_CALL")),
    "a blocked H1 morning carries no direction"
  );
  assert.equal(audit.reconciliation.reconciled, true);
  assert.equal(audit.reconciliation.scheduled, 725);
  assert.equal(audit.reconciliation.saved, 725);
  assert.equal(audit.missing_input.caught, true);
  assert.ok(audit.missing_input.blockers.length > 0);
  assert.equal(audit.wrong_version.caught, true);
  assert.equal(audit.wrong_version.ledger_rejected, true);
  assert.equal(audit.wrong_saved_decision.clean, false);
  assert.ok(audit.wrong_saved_decision.findings.some((finding) => finding.code === "wrong_saved_decision"));
  assert.equal(audit.own_reference_clean.clean, true);
  assert.equal(audit.clean.clean, true);
});

test("no legacy figure can appear as an H1 result, and the unmeasured label is kept for an unmeasured audit", () => {
  // The one place a legacy figure may appear is the note that retires it, which names what it replaced.
  const h1 = { ...screen.h1, coverage: { ...screen.h1.coverage } };
  const retired = h1.coverage.legacy_replacement;
  delete h1.coverage.legacy_replacement;
  const json = JSON.stringify(h1);
  for (const legacy of ["515 reconstructed", "209 scored", "121 directional"]) {
    assert.equal(json.includes(legacy), false, `the H1 subtree must not carry the legacy phrase ${legacy}`);
  }
  assert.match(retired.previous_label, /515 reconstructed/);
  assert.equal(retired.retired, true);
  assert.equal(screen.h1.coverage.unmeasured_label, "H1 historical coverage unmeasured; earliest eligible morning unknown");
  assert.equal(screen.h1.coverage.status, "measured");
  assert.equal(screen.h1.coverage.label.includes("0 of 725 ready"), true);
  assert.equal(screen.h1.historical.performance, "UNSCORED");
  assert.equal(screen.h1.historical.earliest_eligible, null);
  assert.equal(screen.h1.historical.earliest_eligible_label.includes("none"), true);
  const h1Section = html.slice(html.indexOf("function renderH1"), html.indexOf("let disposeMap"));
  assert.equal(/515|209|121/.test(h1Section), false);
});

test("the evaluation contract is frozen before scoring, with eligible dates, benchmarks, execution rules and measures", () => {
  const contract = screen.h1.scoring_contract;
  assert.equal(contract.status, "FROZEN_BEFORE_SCORING");
  assert.equal(contract.frozen_on, "2026-11-17");
  assert.equal(contract.digest.length, 64);
  assert.equal(contract.eligible_dates.h1_ready, 0);
  assert.equal(contract.eligible_dates.scheduled, 725);
  assert.equal(contract.eligible_dates.earliest_eligible, null);
  assert.deepEqual(contract.benchmarks.map((item) => item.id), [
    "dxy_direction_broker_cfd",
    "four_markets",
    "l2l_full_5r",
    "l2l_half_3r",
  ]);
  assert.match(contract.execution_rules.entry, /five-minute close/);
  assert.match(contract.execution_rules.sizing, /1 per cent/);
  assert.equal(contract.success_measures.directional_target_pct, 60);
  assert.equal(contract.success_measures.no_aggregate.length > 10, true);
  assert.equal(contract.flat_bands.digest.length, 64);
  assert.equal(contract.coverage_disclosure.required, true);
  assert.ok(contract.open_discrepancies.length >= 4);
  assert.equal(contract.pair_combination.status, "separate future test");
});

test("H1 release-type matching is exact, with only the stated FOMC equivalence", () => {
  const matched = matchEventTypes(REQUIRED_TYPES, ["fomc_statement"]);
  assert.deepEqual(matched.matched, ["FOMC policy decision"]);
  assert.deepEqual(matched.missing, ["CPI", "Employment Situation", "advance GDP", "Personal Income and Outlays"]);
  assert.deepEqual(matchEventTypes(["CPI"], ["core_cpi_adjacent"]).missing, ["CPI"]);
  assert.deepEqual(matchEventTypes(["Employment Situation"], ["employment situation"]).matched, ["Employment Situation"]);
  assert.deepEqual(screen.h1.coverage.event_calendar.missing_types, matched.missing);
  assert.deepEqual(screen.h1.coverage.event_calendar.matched_types, matched.matched);
});

test("the H1 view cannot render the legacy counts under the H1 selector", () => {
  const start = html.indexOf("function renderH1");
  const end = html.indexOf("let disposeMap", start);
  assert.ok(start > 0 && end > start, "the H1 renderer must exist as its own function");
  const section = html.slice(start, end);
  assert.equal(/515|209|121|coverage_trace/.test(section), false, "legacy counts and the legacy trace must not appear in H1");
  assert.equal(section.includes("c.ready"), true);
  assert.equal(section.includes("c.blocked"), true);
  assert.equal(section.includes("legacy_replacement"), true);
  assert.equal(screen.summary.h1.legacy_replacement.previous_label.includes("0/725"), true);
  assert.equal(screen.summary.h1.label.includes("0 of 725 ready"), true);
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

test("the morning-run payload keeps H1 blocked and the legacy 0/725 attached to its original audit", () => {
  const morning = screen.morning_run;
  assert.equal(morning.models.current.outcome, "allowed");
  assert.equal(morning.models.current.trade_eligible, true);
  assert.equal(morning.models.h1.outcome, "blocked");
  assert.equal(morning.models.h1.direction, "NO_CALL");
  assert.equal(morning.models.h1.conviction, null);
  assert.equal(morning.models.h1.trade_eligible, false);
  assert.equal(morning.h1_blockers.length, 3, "ice, gold and calendar still block this morning");
  assert.deepEqual(morning.h1_blockers.map((blocker) => blocker.input), ["ice", "gold", "calendar"]);
  assert.equal(morning.inputs.current.length, 12);
  assert.equal(morning.inputs.h1.length, 9);
  assert.equal(morning.sample_reconciliation.h1.blocked, 725);
  assert.equal(morning.sample_reconciliation.h1.directional, 0);
  assert.equal(morning.legacy_input_clock_audit.sessions.clocked, 0);
  assert.equal(morning.legacy_input_clock_audit.sessions.total, 725);
  assert.match(morning.legacy_input_clock_audit.source, /validity_gate\.ladder/);
  assert.equal(morning.reach_benchmark.layer1.hits, 2418);
  assert.equal(morning.reach_benchmark.layer1.denominator, 2493);
  assert.equal(morning.reach_benchmark.layer2.hits, 1549);
  assert.equal(morning.reach_benchmark.layer2.denominator, 1592);
  assert.equal(JSON.stringify(morning).includes("515 reconstructed"), false);
  assert.equal(JSON.stringify(morning).includes("209 scored"), false);
});


test("the page loads the payload, opens from the main navigation and keeps the map and abstention status on screen", () => {
  assert.equal(index.includes('href="backtesting.html"'), true, "the main navigation must link the screen");
  assert.equal(html.includes('data/usd-layer1-backtester/backtesting-screen-v1.json'), true);
  for (const id of ["overview", "architecture", "tests", "morning", "ledger", "audit", "decisions", "h1"]) {
    assert.equal(html.includes(`${id}:"`), true, `the ${id} view must exist`);
  }
  assert.equal(html.includes("H1 candidate"), true);
  assert.equal(html.includes("renderH1"), true);
  assert.equal(html.includes("renderMorningRun"), true);
  assert.equal(html.includes("One historical morning"), true);
  assert.equal(html.includes('id="map"'), true);
  assert.equal(html.includes("valid_abstention"), true);
  assert.equal(html.includes("05:00"), true);
  assert.equal(html.includes("USD-L1-25F-H1-v0.1.0") || html.includes("package_identity"), true);
  assert.equal(html.includes("[object Object]"), false);
  assert.equal(html.includes("undefined</"), false);
});

test("the four agreed tests are preserved, each with its own readiness for the requested package", () => {
  assert.deepEqual(
    screen.tests.definitions.map((def) => def.id),
    ["dxy_direction_broker_cfd", "four_markets", "l2l_full_5r", "l2l_half_3r"]
  );
  const byId = Object.fromEntries(screen.tests.definitions.map((def) => [def.id, def]));
  assert.match(byId.dxy_direction_broker_cfd.status, /proxy/);
  assert.equal(byId.dxy_direction_broker_cfd.usable_sessions, 360);
  assert.equal(byId.four_markets.usable_sessions, 685);
  assert.equal(byId.l2l_full_5r.usable_sessions, 0);
  assert.match(byId.l2l_full_5r.status, /blocked/);
  assert.equal(byId.l2l_half_3r.usable_sessions, 0);
  assert.match(byId.l2l_half_3r.status, /blocked/);
  for (const definition of screen.tests.definitions) {
    assert.equal(definition.h1_readiness.eligible_mornings, 0, `${definition.id} must not claim an H1 morning`);
    assert.equal(definition.h1_readiness.scheduled_mornings, 725);
    assert.match(definition.h1_readiness.status, /blocked/);
    assert.equal(definition.h1_readiness.blocked_by.length, 5, `${definition.id} must name every blocking input`);
  }
  const supplementary = screen.tests.supplementary;
  assert.equal(supplementary.length, 1);
  assert.equal(supplementary[0].id, "dxy_direction");
  assert.equal(supplementary[0].agreed_four, false);
  assert.match(supplementary[0].status, /blocked/);
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
test("the market x test matrix is carried to the screen with a reason per blocked combination", () => {
  const matrix = screen.market_matrix;
  assert.equal(matrix.primary_market, "DXY");
  assert.equal(matrix.market_count, 8);
  assert.equal(matrix.test_count, 3);
  assert.equal(matrix.combination_count, 24);
  assert.equal(matrix.rows.length, 8);
  assert.deepEqual(matrix.tests.map((entry) => entry.id), ["direction", "l2l_full_5r", "l2l_half_3r"]);
  const dxy = matrix.rows.find((row) => row.market === "DXY");
  assert.equal(dxy.tests.direction.status, "proxy_scored");
  assert.equal(dxy.tests.l2l_full_5r.status, "blocked");
  assert.equal(dxy.tests.l2l_half_3r.status, "blocked");
  const gbp = matrix.rows.find((row) => row.market === "GBPUSD");
  assert.equal(gbp.tests.direction.status, "blocked");
  assert.match(gbp.tests.direction.reason, /no cached one-hour series/);
  assert.match(gbp.tests.l2l_full_5r.reason, /no 5-minute tape/);
  const total = matrix.counts.scored + matrix.counts.proxy_scored + matrix.counts.blocked;
  assert.equal(total, 24);
  assert.match(matrix.note, /never shown as a scored zero/);
});
