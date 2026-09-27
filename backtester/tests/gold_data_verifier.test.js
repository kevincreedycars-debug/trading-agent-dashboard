const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const registry = require("../registries/gold_data_verifier_sampling.v1.json");
const {
  createRng,
  sampleIndices,
  recomputeEvaluationResult,
  flattenReportCells,
  verifyCheckerRows,
  verifyLedger,
  verifyReportCells,
  verifyCaptureEnvelopes,
  runVerification,
  formatSummary
} = require("../lib/gold_data_verifier");

const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

function checkerRow(overrides = {}) {
  const stored = {
    direction: "BULLISH",
    predicted_conviction: 55,
    headline_confidence_pct: 55,
    strength_bucket: "MODERATE",
    bull_case_pct: 60,
    bear_case_pct: 40,
    net_edge_pct: 20,
    participation_pct: 30,
    active_directional_weight: 30,
    bull_weighted_total: 18,
    bear_weighted_total: 12,
    evaluation_result: "CORRECT",
    evaluation_reason: "agent_direction_matches_market_outcome",
    flat_threshold_used: 0.3,
    weighted_score: { active_weight: 30, weight_margin: 20 },
    ...overrides.stored
  };
  const checker = overrides.checker === null ? undefined : { ...stored, ...overrides.checker };
  return {
    prediction_id: overrides.prediction_id || "synthetic-row",
    snapshot_date: "2024-01-02",
    stored,
    ...(checker ? { checker } : {}),
    differences: overrides.differences || [
      { key: "Direction", difference: "0", status: "PASS" },
      { key: "Predicted Conviction %", difference: 0, status: "PASS" }
    ],
    factor_comparisons: overrides.factor_comparisons || [
      { factor_key: "F1", signal: { status: "PASS" }, weight: { status: "PASS" }, status: "PASS" }
    ],
    status: overrides.status || "PASS",
    evaluation_inputs: overrides.evaluation_inputs || { open_price: 100, close_price: 101, close_date: "2024-01-03" }
  };
}

function checkerDataset(rows, summary = {}) {
  return {
    fields_compared: ["direction", "predicted_conviction", "bull_case_pct", "bear_case_pct", "net_edge_pct", "evaluation_result", "flat_threshold_used"],
    summary: { rows_checked: rows.length, pass: rows.length, fail: 0, tolerance_pass: 0, missing_data: 0, exact_matches: rows.length, ...summary },
    rows
  };
}

test("sampling is seeded, unique and reproducible", () => {
  const first = sampleIndices(500, 40, createRng(20260927));
  const repeat = sampleIndices(500, 40, createRng(20260927));
  const other = sampleIndices(500, 40, createRng(20260928));
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, other);
  assert.equal(new Set(first).size, 40);
  assert.equal(sampleIndices(10, 99, createRng(1)).length, 10, "sample size is capped at the population");
});

test("the 24h evaluation label reproduces from recorded prices", () => {
  assert.equal(recomputeEvaluationResult(checkerRow()).result, "CORRECT");
  assert.equal(recomputeEvaluationResult(checkerRow({ evaluation_inputs: { open_price: 100, close_price: 99 } })).result, "WRONG");
  assert.equal(recomputeEvaluationResult(checkerRow({ evaluation_inputs: { open_price: 100, close_price: 100.1 } })).result, "FLAT");
  assert.equal(recomputeEvaluationResult(checkerRow({ stored: { direction: "BEARISH_LEAN" }, evaluation_inputs: { open_price: 100, close_price: 99 } })).result, "CORRECT");
  assert.equal(recomputeEvaluationResult(checkerRow({ evaluation_inputs: { open_price: 100 } })).result, "NOT_EVALUABLE");
  assert.equal(recomputeEvaluationResult(checkerRow({ stored: { direction: "NO_CLEAR_BIAS" } })).result, "NO_CALL");
});

test("a clean checker dataset passes and a tampered value is caught", () => {
  const clean = verifyCheckerRows(checkerDataset([checkerRow(), checkerRow({ prediction_id: "second" })]), { seed: 7, sample_size: 2 });
  assert.equal(clean.status, "pass");
  assert.equal(clean.mismatch_count, 0);
  assert.equal(clean.sampled, 2);

  const tampered = checkerRow();
  tampered.checker.predicted_conviction = 40;
  const caught = verifyCheckerRows(checkerDataset([tampered]), { seed: 7, sample_size: 1 });
  assert.equal(caught.status, "fail");
  assert.ok(caught.mismatches.some(row => row.check === "compared_field_matches:predicted_conviction"));

  const staleDifference = checkerRow({ differences: [{ key: "Direction", difference: "BEARISH", status: "FAIL" }] });
  const caughtDifference = verifyCheckerRows(checkerDataset([staleDifference]), { seed: 7, sample_size: 1 });
  assert.equal(caughtDifference.status, "fail");
  assert.ok(caughtDifference.mismatches.some(row => row.check === "difference_entry_is_pass"));
});

test("nested blocks are compared where both sides carry them", () => {
  const drift = checkerRow({ stored: { weighted_score: { active_weight: 30, weight_margin: 20 } }, checker: { weighted_score: { active_weight: 30, weight_margin: 12 } } });
  const caught = verifyCheckerRows(checkerDataset([drift]), { seed: 3, sample_size: 1 });
  assert.equal(caught.status, "fail");
  assert.ok(caught.mismatches.some(row => row.check === "nested_block_matches:weighted_score"));

  const compositional = checkerRow({ stored: { weighted_score: { active_weight: 30 } }, checker: { weighted_score: { active_weight: 30, extra_key: 1 } } });
  const tolerated = verifyCheckerRows(checkerDataset([compositional]), { seed: 3, sample_size: 1 });
  assert.equal(tolerated.status, "pass", "one-sided keys are a composition note, not a value disagreement");
  assert.ok(tolerated.observations.some(row => row.check === "nested_composition_gaps"));
});
function ledgerRecord(overrides = {}) {
  const n = overrides.n ?? 25;
  const direction = overrides.direction || { positive: 15, negative: 10, exact_zero: 0 };
  return {
    candidate_id: overrides.candidate_id || "daily_snapshot_anchors|all_computed|h24_post_event|and|a:above|b:exact_zero|ctx=none",
    status: overrides.status || "reported",
    attempts: overrides.attempts ?? 100,
    matched_anchors: overrides.matched_anchors ?? n,
    n,
    direction,
    magnitude_pct: { n: overrides.magnitude_n ?? n, median: 0.1 },
    year_breakdown: overrides.year_breakdown || [
      { year: 2024, n, direction },
      { year: 2025, n: 0, direction: { positive: 0, negative: 0, exact_zero: 0 } }
    ],
    eligibility: overrides.eligibility || { min_n: 20, verdict: "eligible", reason: "computed observations meet min_n" },
    exclusions: overrides.exclusions || { entry_unresolved: 1, endpoint_unresolved: 2, blocking_absence_in_window: 3, outcome_computed: 94, reconciliation_ok: true },
    endpoint_denominators: overrides.endpoint_denominators || {
      all_computed: { n: 25 }, exact_offset_elapsed: { n: 20 }, delayed_offset_endpoint: { n: 5 }, session_close_endpoint: { n: 0 }, reconciliation_ok: true
    }
  };
}

test("a clean ledger sample passes and each arithmetic break is caught", () => {
  const clean = verifyLedger([ledgerRecord({ candidate_id: "a" }), ledgerRecord({ candidate_id: "b" })], { seed: 11, sample_size: 2, declared_min_n: 20 });
  assert.equal(clean.status, "pass");
  assert.equal(clean.sample_keys.length, 2);

  const brokenDirection = verifyLedger([ledgerRecord({ direction: { positive: 15, negative: 9, exact_zero: 0 } })], { seed: 11, sample_size: 1 });
  assert.ok(brokenDirection.mismatches.some(row => row.check === "direction_counts_sum_to_n"));

  const brokenPartition = verifyLedger([ledgerRecord({ exclusions: { entry_unresolved: 1, endpoint_unresolved: 2, blocking_absence_in_window: 3, outcome_computed: 90, reconciliation_ok: true } })], { seed: 11, sample_size: 1 });
  assert.ok(brokenPartition.mismatches.some(row => row.check === "exclusion_reasons_partition_attempts"));

  const brokenDenominators = verifyLedger([ledgerRecord({ endpoint_denominators: { all_computed: { n: 25 }, exact_offset_elapsed: { n: 19 }, delayed_offset_endpoint: { n: 5 }, session_close_endpoint: { n: 0 } } })], { seed: 11, sample_size: 1 });
  assert.ok(brokenDenominators.mismatches.some(row => row.check === "endpoint_denominators_sum_to_all_computed"));

  const brokenYear = verifyLedger([ledgerRecord({ year_breakdown: [{ year: 2024, n: 20, direction: { positive: 12, negative: 8, exact_zero: 0 } }] })], { seed: 11, sample_size: 1 });
  assert.ok(brokenYear.mismatches.some(row => row.check === "year_breakdown_sums_to_n"));

  const wrongStatus = verifyLedger([ledgerRecord({ status: "reported", n: 12 })], { seed: 11, sample_size: 1 });
  assert.ok(wrongStatus.mismatches.some(row => row.check === "reported_meets_min_n"), "a reported candidate below min_n is a contradiction");
});

test("ledger totals are recounted over the whole file, not the sample", () => {
  const records = [ledgerRecord({ candidate_id: "a", n: 25 }), ledgerRecord({ candidate_id: "b", n: 12, status: "ineligible", matched_anchors: 12, direction: { positive: 7, negative: 5, exact_zero: 0 }, year_breakdown: [{ year: 2024, n: 12, direction: { positive: 7, negative: 5, exact_zero: 0 } }], endpoint_denominators: { all_computed: { n: 12 }, exact_offset_elapsed: { n: 12 }, delayed_offset_endpoint: { n: 0 }, session_close_endpoint: { n: 0 } } })];
  const declared = { status_totals: { reported: 1, ineligible: 1 }, observations: 37, matched_anchors: 37, direction_split: { positive: 22, negative: 15, exact_zero: 0 }, denominators: { all_computed: 37, exact_offset_elapsed: 32, delayed_offset_endpoint: 5, session_close_endpoint: 0 } };
  const reconciled = verifyLedger(records, { seed: 5, sample_size: 1, declared_min_n: 20, declared_totals: declared });
  assert.equal(reconciled.status, "pass", JSON.stringify(reconciled.mismatches));
  assert.equal(reconciled.observations.find(row => row.check === "whole_file_census").recounted.observations, 37);

  const stale = verifyLedger(records, { seed: 5, sample_size: 1, declared_min_n: 20, declared_totals: { ...declared, observations: 36 } });
  assert.equal(stale.status, "fail");
  assert.ok(stale.mismatches.some(row => row.check === "declared_observations_reconcile"), "sampling one record still recounts the whole file");

  // A declared status class with no members (for example unavailable 0) reconciles with an absent count.
  const withAbsentClass = verifyLedger(records, { seed: 5, sample_size: 1, declared_min_n: 20, declared_totals: { ...declared, status_totals: { ...declared.status_totals, unavailable: 0 } } });
  assert.equal(withAbsentClass.status, "pass", JSON.stringify(withAbsentClass.mismatches));
});
function envelopeEntry(overrides = {}) {
  const payload = Buffer.from(overrides.payload || JSON.stringify({ observations: [{ date: "2024-01-01", value: 1 }, { date: "2024-01-02", value: 2 }] }));
  const metadata = {
    schema_version: "gold-qualification-capture-envelope-v1",
    assignment: "test-assignment",
    source_id: "fred_dfii10_daily",
    request_identity: "test-request",
    raw_sha256: overrides.raw_sha256 || sha256(payload),
    retrieved_at_utc: "2024-01-02T00:00:00.000Z",
    coverage_start_utc: "2024-01-01T00:00:00.000Z",
    coverage_end_utc: "2024-01-02T00:00:00.000Z",
    earliest_availability_utc: "2024-01-01T15:00:00.000Z",
    latest_availability_utc: "2024-01-02T15:00:00.000Z",
    observation_count: overrides.observation_count ?? 2,
    parser_version: "test-parser",
    synthetic: overrides.synthetic ?? false,
    state: overrides.state || "complete_sealed"
  };
  const envelope = { metadata, sealed_raw_payload_base64: payload.toString("base64"), bindings: { manifest_sha256: "a".repeat(64), contract_sha256: "b".repeat(64) } };
  const envelopeRaw = Buffer.from(JSON.stringify(envelope));
  const index = {
    ...metadata,
    bindings: envelope.bindings,
    sealed_payload_sha256: overrides.sealed_payload_sha256 || metadata.raw_sha256,
    envelope_sha256: overrides.envelope_sha256 || sha256(envelopeRaw),
    capture_plan_sha256: "c".repeat(64),
    recovery_of: null
  };
  return { key: overrides.key || "lane/envelope-1", envelope_raw: envelopeRaw, index_raw: Buffer.from(JSON.stringify(index)) };
}

test("sealed envelopes are re-hashed and tampering is caught", () => {
  const clean = verifyCaptureEnvelopes([envelopeEntry()], { seed: 2, sample_size: 1 });
  assert.equal(clean.status, "pass", JSON.stringify(clean.mismatches));
  assert.equal(clean.observations.find(row => row.check === "payload_observation_sources").observations, 1);

  const originalEnvelope = JSON.parse(envelopeEntry().envelope_raw.toString("utf8"));
  const declaredBefore = originalEnvelope.metadata.raw_sha256;
  const tamperedPayload = envelopeEntry({
    payload: Buffer.from(JSON.stringify({ observations: [{ date: "2024-01-01", value: 999 }] })),
    raw_sha256: declaredBefore,
    sealed_payload_sha256: declaredBefore
  });
  const caught = verifyCaptureEnvelopes([tamperedPayload], { seed: 2, sample_size: 1 });
  assert.equal(caught.status, "fail");
  assert.ok(caught.mismatches.some(row => row.check === "payload_hash_matches_declared_raw_hash"));

  const staleIndexPayload = verifyCaptureEnvelopes([envelopeEntry({ sealed_payload_sha256: "e".repeat(64) })], { seed: 2, sample_size: 1 });
  assert.ok(staleIndexPayload.mismatches.some(row => row.check === "index_payload_hash_matches_envelope"));

  const draft = verifyCaptureEnvelopes([envelopeEntry({ state: "draft" })], { seed: 2, sample_size: 1 });
  assert.ok(draft.mismatches.some(row => row.check === "state_is_complete_sealed"));

  const wrongFileHash = verifyCaptureEnvelopes([envelopeEntry({ envelope_sha256: "d".repeat(64) })], { seed: 2, sample_size: 1 });
  assert.ok(wrongFileHash.mismatches.some(row => row.check === "index_envelope_hash_matches_file"));

  const wrongCount = verifyCaptureEnvelopes([envelopeEntry({ observation_count: 3 })], { seed: 2, sample_size: 1 });
  assert.ok(wrongCount.mismatches.some(row => row.check === "payload_observation_count_matches_declared"));
});

test("synthetic drift fixtures are recorded, not reported as live faults", () => {
  const drift = {
    payload: Buffer.from(JSON.stringify({ observations: [{ date: "2024-01-01", value: 999 }] })),
    raw_sha256: "b".repeat(64),
    sealed_payload_sha256: "b".repeat(64),
    envelope_sha256: "d".repeat(64)
  };
  const synthetic = verifyCaptureEnvelopes([envelopeEntry({ ...drift, synthetic: true })], { seed: 2, sample_size: 1 });
  assert.equal(synthetic.status, "pass", "an injected fixture disagreement is not a live fault");
  assert.equal(synthetic.observations.find(row => row.check === "fixture_lanes").injected_disagreements > 0, true);

  const real = verifyCaptureEnvelopes([envelopeEntry({ ...drift, synthetic: false })], { seed: 2, sample_size: 1 });
  assert.equal(real.status, "fail", "the same disagreement on a real capture is a fault");
  assert.equal(real.observations.find(row => row.check === "fixture_lanes").sampled, 0);
  assert.ok(real.mismatches.some(row => row.check === "payload_hash_matches_declared_raw_hash"));

  // A test lane whose envelope predates a rewrite is matched by a declared pattern, not by metadata.
  const patterned = { ...envelopeEntry({ ...drift, synthetic: false }), key: "gold-017-t-seal-HUf2rE/attempt-1/capture.envelope.json" };
  const classified = verifyCaptureEnvelopes([patterned], { seed: 2, sample_size: 1, fixture_patterns: ["gold-017-t-seal-"] });
  assert.equal(classified.status, "pass");
  assert.deepEqual(classified.observations.find(row => row.check === "fixture_lanes"), { check: "fixture_lanes", sampled: 1, by_metadata: 0, by_pattern: 1, patterns_matched: ["gold-017-t-seal-"], injected_disagreements: 3 });
  assert.equal(verifyCaptureEnvelopes([patterned], { seed: 2, sample_size: 1, fixture_patterns: [] }).status, "fail");
});

function reportFixture() {
  const state = (name, n, positive, negative) => ({
    state: name,
    n,
    direction: { positive, negative, exact_zero: n - positive - negative },
    magnitude_pct: { n, median: 0.1 },
    year_breakdown: [{ year: 2024, n, direction: { positive, negative, exact_zero: n - positive - negative } }],
    small_sample: n < 20
  });
  return {
    minimum_observations: 20,
    variables: [{
      id: "us_10y_real_yield",
      cohorts: {
        daily_snapshot_anchors: {
          status: "measured",
          horizons: {
            h24_post_event: { groups: { all_computed: { states: [state("above_own_median", 100, 55, 45)] } } },
            d5_trading_days_post_event: { groups: { all_computed: { states: [state("below_own_median", 80, 30, 50)] } } }
          }
        },
        event_releases: { status: "not_applicable", reason: "no event cohort" }
      }
    }]
  };
}

test("report cells are flattened and their arithmetic is re-checked", () => {
  const report = reportFixture();
  const cells = flattenReportCells(report);
  assert.equal(cells.length, 2);
  assert.deepEqual([...cells.map(cell => cell.key)].sort(), [
    "us_10y_real_yield|daily_snapshot_anchors|d5_trading_days_post_event|all_computed|below_own_median",
    "us_10y_real_yield|daily_snapshot_anchors|h24_post_event|all_computed|above_own_median"
  ]);
  const clean = verifyReportCells(report, { seed: 4, sample_size: 2 });
  assert.equal(clean.status, "pass", JSON.stringify(clean.mismatches));

  const broken = reportFixture();
  broken.variables[0].cohorts.daily_snapshot_anchors.horizons.h24_post_event.groups.all_computed.states[0].direction = { positive: 55, negative: 44, exact_zero: 0 };
  const caught = verifyReportCells(broken, { seed: 4, sample_size: 2 });
  assert.equal(caught.status, "fail");
  assert.ok(caught.mismatches.some(row => row.check === "direction_counts_sum_to_cell_n"));

  // A year breakdown below its own cell n is allowed and recorded, above it is a fault.
  const partialYears = reportFixture();
  partialYears.variables[0].cohorts.daily_snapshot_anchors.horizons.h24_post_event.groups.all_computed.states[0].year_breakdown = [{ year: 2024, n: 90, direction: { positive: 50, negative: 40, exact_zero: 0 } }];
  const recorded = verifyReportCells(partialYears, { seed: 4, sample_size: 2 });
  assert.equal(recorded.status, "pass");
  assert.equal(recorded.observations.find(row => row.check === "year_breakdown_scope").below_cell_n, 1);

  const overAttributed = reportFixture();
  overAttributed.variables[0].cohorts.daily_snapshot_anchors.horizons.h24_post_event.groups.all_computed.states[0].year_breakdown = [{ year: 2024, n: 140, direction: { positive: 80, negative: 60, exact_zero: 0 } }];
  assert.ok(verifyReportCells(overAttributed, { seed: 4, sample_size: 2 }).mismatches.some(row => row.check === "year_breakdown_within_cell_n"));

  const wrongFlag = reportFixture();
  wrongFlag.variables[0].cohorts.daily_snapshot_anchors.horizons.h24_post_event.groups.all_computed.states[0].small_sample = true;
  assert.ok(verifyReportCells(wrongFlag, { seed: 4, sample_size: 2 }).mismatches.some(row => row.check === "small_sample_flag_matches_minimum_observations"));
});
test("the registry declares the sampling policy before any run", () => {
  assert.equal(registry.research_only, true);
  assert.equal(registry.status, "sampling_policy_declaration_not_evidence");
  assert.equal(registry.sampling.method, "seeded_fisher_yates_without_replacement");
  assert.equal(Number.isInteger(registry.sampling.seed), true);
  assert.equal(registry.sampling.max_sample_size >= registry.sampling.default_sample_size, true);
  assert.equal(registry.tolerances.float_absolute > 0, true);
  assert.equal(registry.limits.length > 0, true);
  const targets = registry.targets.map(target => target.id);
  assert.deepEqual(targets, ["checker_rows", "combination_ledger", "report_cells", "capture_envelopes"]);
  for (const target of registry.targets) assert.ok(target.checks.length > 0, `${target.id} declares checks`);
});

test("the orchestrator samples, aggregates and reports a status", () => {
  const report = runVerification({
    checker: checkerDataset([checkerRow({ prediction_id: "r1" }), checkerRow({ prediction_id: "r2" })]),
    ledger: [ledgerRecord({ candidate_id: "c1" }), ledgerRecord({ candidate_id: "c2" })],
    sample_size: 1,
    seed: 99
  }, registry);
  assert.equal(report.status, "pass");
  assert.equal(report.seed, 99);
  assert.equal(report.sample_size, 1);
  assert.equal(report.totals.targets_run, 2);
  assert.equal(report.totals.units_checked, 2);
  assert.deepEqual(report.targets.map(target => target.target), ["checker_rows", "combination_ledger"]);
  const lines = formatSummary(report);
  assert.equal(lines[0].includes("Gold data verifier"), true);
  assert.equal(lines.some(line => line.includes("checker_rows")), true);

  const failing = runVerification({
    checker: checkerDataset([{ ...checkerRow(), status: "FAIL" }]),
    sample_size: 1,
    seed: 99
  }, registry);
  assert.equal(failing.status, "fail");
  assert.equal(failing.totals.mismatch_count > 0, true);
});



