const crypto = require("node:crypto");

// Independent re-checking of already-gathered Gold output. Pure functions only:
// callers load the artefacts, this module re-derives the values it checks and
// never trusts a stored summary. No evaluation is re-run and nothing is written.
const VERSION = "gold-data-verifier-v1";
const DEFAULT_TOLERANCE = 1e-9;
const LEDGER_STATUS_VALUES = ["reported", "ineligible", "empty"];
const CHECKER_PASS = "PASS";
const CHECKER_FIELDS = [
  "direction", "predicted_conviction", "headline_confidence_pct", "strength_bucket",
  "bull_case_pct", "bear_case_pct", "net_edge_pct", "participation_pct",
  "active_directional_weight", "bull_weighted_total", "bear_weighted_total",
  "factor_scores", "evaluation_result", "evaluation_reason", "flat_threshold_used"
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// mulberry32: small, dependency-free, deterministic across Node versions and platforms.
function createRng(seed) {
  let state = Math.trunc(seed) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleIndices(populationSize, sampleSize, rng) {
  if (!Number.isInteger(populationSize) || populationSize < 0) throw new Error("populationSize must be a non-negative integer");
  if (typeof rng !== "function") throw new Error("rng must be a function");
  const size = Math.min(Math.max(Math.trunc(sampleSize) || 0, 0), populationSize);
  const pool = Array.from({ length: populationSize }, (_, index) => index);
  for (let position = 0; position < size; position += 1) {
    const swap = position + Math.floor(rng() * (populationSize - position));
    const held = pool[position];
    pool[position] = pool[swap];
    pool[swap] = held;
  }
  return pool.slice(0, size).sort((left, right) => left - right);
}

function valueEquals(left, right, tolerance) {
  if (typeof left === "number" && typeof right === "number") return Math.abs(left - right) <= tolerance;
  if (left && right && typeof left === "object" && typeof right === "object") {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!(key in left) || !(key in right)) continue; // composition gaps are recorded separately
      if (!valueEquals(left[key], right[key], tolerance)) return false;
    }
    return true;
  }
  return left === right;
}

function compositionGaps(left, right, path = "") {
  const gaps = [];
  for (const key of new Set([...Object.keys(left || {}), ...Object.keys(right || {})])) {
    const leftValue = left ? left[key] : undefined;
    const rightValue = right ? right[key] : undefined;
    const nested = leftValue && rightValue && typeof leftValue === "object" && typeof rightValue === "object";
    if (nested) {
      gaps.push(...compositionGaps(leftValue, rightValue, `${path}.${key}`));
      continue;
    }
    if (leftValue === undefined && rightValue !== undefined) gaps.push(`${path}.${key} (right only)`);
    if (rightValue === undefined && leftValue !== undefined) gaps.push(`${path}.${key} (left only)`);
  }
  return gaps;
}

function createCollector(target) {
  const checks = new Map();
  const observations = [];
  const mismatches = [];
  return {
    expect(check, condition, detail = {}) {
      const row = checks.get(check) || { check, evaluated: 0, failed: 0 };
      row.evaluated += 1;
      if (!condition) {
        row.failed += 1;
        if (mismatches.length < 200) mismatches.push({ check, ...detail });
      }
      checks.set(check, row);
    },
    observe(check, payload) {
      observations.push({ check, ...payload });
    },
    finish(extra) {
      return {
        target,
        ...extra,
        asserted_checks: [...checks.values()],
        observations,
        mismatch_count: mismatches.length,
        mismatches,
        status: mismatches.length ? "fail" : "pass"
      };
    }
  };
}
// The 24-hour evaluation label re-derived from the recorded prices alone.
function recomputeEvaluationResult(row) {
  const stored = row.stored || {};
  const inputs = row.evaluation_inputs || {};
  const open = inputs.open_price;
  const close = inputs.close_price;
  if (typeof open !== "number" || typeof close !== "number" || open === 0) {
    return { result: "NOT_EVALUABLE", basis: "price_not_recorded" };
  }
  if (stored.direction === "NO_CLEAR_BIAS") return { result: "NO_CALL", basis: "no_directional_call" };
  const pct = (close / open - 1) * 100;
  if (Math.abs(pct) <= stored.flat_threshold_used) return { result: "FLAT", basis: "inside_flat_threshold", pct_change_pct: pct };
  const bullish = String(stored.direction).startsWith("BULLISH");
  return { result: (pct > 0) === bullish ? "CORRECT" : "WRONG", basis: "outside_flat_threshold", pct_change_pct: pct };
}

function censusCheckerRows(rows) {
  const totals = { rows_checked: rows.length, pass: 0, fail: 0, tolerance_pass: 0, missing_data: 0, exact_matches: 0, difference_entries: 0, factor_comparisons: 0, not_evaluable: 0 };
  for (const row of rows) {
    if (row.status === CHECKER_PASS) totals.pass += 1;
    else if (row.status === "FAIL") totals.fail += 1;
    else if (String(row.status).includes("TOLERANCE")) totals.tolerance_pass += 1;
    else if (String(row.status).includes("MISSING")) totals.missing_data += 1;
    const entries = row.differences || [];
    totals.difference_entries += entries.length;
    totals.factor_comparisons += (row.factor_comparisons || []).length;
    if (entries.length && entries.every(entry => entry.difference === 0 || entry.difference === "0")) totals.exact_matches += 1;
    if (row.stored && row.stored.evaluation_result === "NOT_EVALUABLE") totals.not_evaluable += 1;
  }
  return totals;
}
function verifyCheckerRows(dataset, options = {}) {
  const rows = dataset.rows || [];
  const compared = dataset.fields_compared && dataset.fields_compared.length ? dataset.fields_compared : CHECKER_FIELDS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const rng = options.rng || createRng(options.seed ?? 0);
  const indices = sampleIndices(rows.length, options.sample_size ?? rows.length, rng);
  const collector = createCollector("checker_rows");
  const gaps = new Set();
  const recomputation = { recomputed: 0, price_absent: 0 };
  for (const index of indices) {
    const row = rows[index];
    const key = row.prediction_id || `row:${index}`;
    const stored = row.stored || {};
    const checker = row.checker || {};
    collector.expect("row_status_is_pass", row.status === CHECKER_PASS, { key, actual: row.status });
    for (const field of compared) {
      if (stored[field] === undefined || checker[field] === undefined) continue;
      collector.expect(`compared_field_matches:${field}`, valueEquals(stored[field], checker[field], tolerance), { key, expected: stored[field], actual: checker[field] });
    }
    for (const field of Object.keys(stored)) {
      if (!(field in checker) || typeof stored[field] !== "object" || stored[field] === null) continue;
      for (const gap of compositionGaps(stored[field], checker[field], field)) gaps.add(gap);
      collector.expect(`nested_block_matches:${field}`, valueEquals(stored[field], checker[field], tolerance), { key, field });
    }
    for (const entry of row.differences || []) {
      collector.expect("difference_entry_is_pass", entry.status === CHECKER_PASS, { key, entry: entry.key, actual: entry.status });
      collector.expect(`difference_is_zero:${entry.key}`, entry.difference === 0 || entry.difference === "0", { key, entry: entry.key, actual: entry.difference });
    }
    for (const comparison of row.factor_comparisons || []) {
      collector.expect("factor_comparison_is_pass", comparison.status === CHECKER_PASS, { key, factor: comparison.factor_key, actual: comparison.status });
      if (comparison.signal) collector.expect("factor_signal_is_pass", comparison.signal.status === CHECKER_PASS, { key, factor: comparison.factor_key, actual: comparison.signal.status });
      if (comparison.weight) collector.expect("factor_weight_is_pass", comparison.weight.status === CHECKER_PASS, { key, factor: comparison.factor_key, actual: comparison.weight.status });
    }
    const bull = stored.bull_case_pct;
    const bear = stored.bear_case_pct;
    collector.expect("net_edge_is_bull_minus_bear", Math.abs((stored.net_edge_pct ?? NaN) - ((bull ?? NaN) - (bear ?? NaN))) <= tolerance, { key, actual: stored.net_edge_pct });
    collector.expect("participation_equals_active_weight", stored.participation_pct === stored.active_directional_weight, { key, participation: stored.participation_pct, active: stored.active_directional_weight });
    collector.expect("active_weight_is_bull_plus_bear", (stored.active_directional_weight ?? NaN) === (stored.bull_weighted_total ?? 0) + (stored.bear_weighted_total ?? 0), { key, active: stored.active_directional_weight });
    const caseSplit = (bull ?? 0) + (bear ?? 0);
    collector.expect("case_split_is_whole_or_absent", Math.abs(caseSplit - 100) <= tolerance || (bull === 0 && bear === 0), { key, case_split: caseSplit });
    const expected = recomputeEvaluationResult(row);
    if (expected.basis === "price_not_recorded") {
      recomputation.price_absent += 1;
      collector.expect("not_evaluable_when_price_absent", expected.result === stored.evaluation_result, { key, expected: expected.result, actual: stored.evaluation_result });
    } else {
      recomputation.recomputed += 1;
      collector.expect("evaluation_result_reproduces_from_prices", expected.result === stored.evaluation_result, { key, expected: expected.result, actual: stored.evaluation_result, basis: expected.basis });
    }
  }
  const census = censusCheckerRows(rows);
  const declared = dataset.summary || {};
  for (const field of ["rows_checked", "pass", "fail", "missing_data", "exact_matches"]) {
    if (declared[field] === undefined) continue;
    collector.expect(`declared_summary_reconciles:${field}`, declared[field] === census[field], { expected: declared[field], actual: census[field] });
  }
  collector.observe("declared_summary", { declared, recounted: census });
  collector.observe("sampled_recomputation", recomputation);
  if (gaps.size) collector.observe("nested_composition_gaps", { paths: [...gaps].sort() });
  return collector.finish({ source: options.source || null, population: rows.length, sampled: indices.length, sample_keys: indices.map(index => rows[index].prediction_id || `row:${index}`) });
}
function denominatorValue(block, key) {
  const value = (block || {})[key];
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof value.n === "number") return value.n;
  return null;
}

function censusLedger(records) {
  const totals = {
    records: records.length,
    status_totals: {},
    observations: 0,
    matched_anchors: 0,
    attempts: 0,
    direction_split: { positive: 0, negative: 0, exact_zero: 0 },
    endpoint_denominators: { exact_offset_elapsed: 0, delayed_offset_endpoint: 0, session_close_endpoint: 0, all_computed: 0 }
  };
  for (const record of records) {
    totals.status_totals[record.status] = (totals.status_totals[record.status] || 0) + 1;
    totals.observations += record.n || 0;
    totals.matched_anchors += record.matched_anchors || 0;
    totals.attempts += record.attempts || 0;
    for (const key of Object.keys(totals.direction_split)) totals.direction_split[key] += (record.direction || {})[key] || 0;
    for (const key of Object.keys(totals.endpoint_denominators)) totals.endpoint_denominators[key] += denominatorValue(record.endpoint_denominators, key) || 0;
  }
  return totals;
}
function verifyLedger(records, options = {}) {
  const rng = options.rng || createRng(options.seed ?? 0);
  const indices = sampleIndices(records.length, options.sample_size ?? records.length, rng);
  const collector = createCollector("combination_ledger");
  const declaredMinN = options.declared_min_n ?? null;
  const endpointParts = ["exact_offset_elapsed", "delayed_offset_endpoint", "session_close_endpoint"];
  const exclusionReasons = ["entry_unresolved", "endpoint_unresolved", "blocking_absence_in_window", "outcome_computed"];
  for (const index of indices) {
    const record = records[index];
    const key = record.candidate_id || `record:${index}`;
    const direction = record.direction || {};
    collector.expect("status_is_declared", LEDGER_STATUS_VALUES.includes(record.status), { key, actual: record.status });
    collector.expect("direction_counts_sum_to_n", record.n === (direction.positive || 0) + (direction.negative || 0) + (direction.exact_zero || 0), { key, n: record.n, direction });
    if (record.magnitude_pct) collector.expect("magnitude_n_equals_n", record.magnitude_pct.n === record.n, { key, magnitude_n: record.magnitude_pct.n, n: record.n });
    collector.expect("n_within_matched_anchors", (record.n || 0) <= (record.matched_anchors ?? Infinity), { key, n: record.n, matched_anchors: record.matched_anchors });
    const exclusions = record.exclusions || {};
    if (exclusionReasons.every(reason => typeof exclusions[reason] === "number")) {
      const partition = exclusionReasons.reduce((sum, reason) => sum + exclusions[reason], 0);
      collector.expect("exclusion_reasons_partition_attempts", partition === record.attempts, { key, partition, attempts: record.attempts });
    }
    collector.expect("exclusion_reconciliation_flag", exclusions.reconciliation_ok !== false, { key, actual: exclusions.reconciliation_ok });
    const parts = endpointParts.map(part => denominatorValue(record.endpoint_denominators, part));
    const allComputed = denominatorValue(record.endpoint_denominators, "all_computed");
    if (parts.every(value => typeof value === "number") && typeof allComputed === "number") {
      collector.expect("endpoint_denominators_sum_to_all_computed", parts.reduce((sum, value) => sum + value, 0) === allComputed, { key, parts, all_computed: allComputed });
    }
    if (Array.isArray(record.year_breakdown) && record.year_breakdown.length) {
      collector.expect("year_breakdown_sums_to_n", record.year_breakdown.reduce((sum, year) => sum + (year.n || 0), 0) === record.n, { key, n: record.n });
      collector.expect("year_breakdown_directions_sum_to_year_n", record.year_breakdown.every(year => {
        const split = year.direction || {};
        return ((split.positive || 0) + (split.negative || 0) + (split.exact_zero || 0)) === year.n;
      }), { key });
    }
    if (declaredMinN !== null) collector.expect("eligibility_min_n_is_declared", record.eligibility?.min_n === declaredMinN, { key, actual: record.eligibility?.min_n });
    if (typeof record.eligibility?.min_n === "number") {
      if (record.status === "reported") collector.expect("reported_meets_min_n", record.n >= record.eligibility.min_n, { key, n: record.n, min_n: record.eligibility.min_n });
      if (record.status === "ineligible") collector.expect("ineligible_below_min_n", record.n < record.eligibility.min_n, { key, n: record.n, min_n: record.eligibility.min_n });
    }
  }
  const census = censusLedger(records);
  const declared = options.declared_totals || null;
  if (declared) {
    for (const [status, count] of Object.entries(declared.status_totals || {})) {
      collector.expect(`declared_status_total_reconciles:${status}`, (census.status_totals[status] || 0) === count, { expected: count, actual: census.status_totals[status] || 0 });
    }
    if (typeof declared.observations === "number") collector.expect("declared_observations_reconcile", census.observations === declared.observations, { expected: declared.observations, actual: census.observations });
    if (typeof declared.matched_anchors === "number") collector.expect("declared_matched_anchors_reconcile", census.matched_anchors === declared.matched_anchors, { expected: declared.matched_anchors, actual: census.matched_anchors });
    for (const [sign, count] of Object.entries(declared.direction_split || {})) {
      collector.expect(`declared_direction_split_reconciles:${sign}`, census.direction_split[sign] === count, { expected: count, actual: census.direction_split[sign] });
    }
    if (declared.denominators) {
      collector.expect("declared_all_computed_reconciles", census.endpoint_denominators.all_computed === declared.denominators.all_computed, { expected: declared.denominators.all_computed, actual: census.endpoint_denominators.all_computed });
      collector.expect("declared_denominator_parts_reconcile", endpointParts.every(part => census.endpoint_denominators[part] === declared.denominators[part]), { recounted: census.endpoint_denominators, declared: declared.denominators });
    }
  }
  collector.observe("whole_file_census", { declared, recounted: census });
  return collector.finish({ source: options.source || null, population: records.length, sampled: indices.length, sample_keys: indices.map(index => records[index].candidate_id || `record:${index}`) });
}
function flattenReportCells(report) {
  const cells = [];
  for (const variable of report.variables || []) {
    for (const [cohort, block] of Object.entries(variable.cohorts || {})) {
      if (!block || typeof block !== "object" || !block.horizons) continue;
      for (const [horizon, horizonBlock] of Object.entries(block.horizons)) {
        for (const [group, groupBlock] of Object.entries(horizonBlock.groups || {})) {
          for (const state of groupBlock.states || []) {
            cells.push({ key: `${variable.id}|${cohort}|${horizon}|${group}|${state.state}`, variable: variable.id, cohort, horizon, group, state });
          }
        }
      }
    }
  }
  return cells;
}

function verifyReportCells(report, options = {}) {
  const cells = flattenReportCells(report);
  const rng = options.rng || createRng(options.seed ?? 0);
  const indices = sampleIndices(cells.length, options.sample_size ?? cells.length, rng);
  const collector = createCollector("report_cells");
  const minimumObservations = options.minimum_observations ?? report.minimum_observations ?? null;
  const byHorizon = {};
  const yearScope = { cells_with_year_breakdown: 0, exact: 0, below_cell_n: 0, unattributed_total: 0 };
  for (const index of indices) {
    const cell = cells[index];
    const state = cell.state || {};
    const direction = state.direction || {};
    byHorizon[cell.horizon] = (byHorizon[cell.horizon] || 0) + 1;
    collector.expect("direction_counts_sum_to_cell_n", state.n === (direction.positive || 0) + (direction.negative || 0) + (direction.exact_zero || 0), { key: cell.key, n: state.n, direction });
    if (state.magnitude_pct) collector.expect("magnitude_n_equals_cell_n", state.magnitude_pct.n === state.n, { key: cell.key, magnitude_n: state.magnitude_pct.n, n: state.n });
    if (Array.isArray(state.year_breakdown) && state.year_breakdown.length) {
      // The declared rule is that a year breakdown sums to its own subset n, never more.
      // A breakdown below the cell n means some observations carry no attributable year.
      const yearSum = state.year_breakdown.reduce((sum, year) => sum + (year.n || 0), 0);
      yearScope.cells_with_year_breakdown += 1;
      if (yearSum === state.n) yearScope.exact += 1;
      else {
        yearScope.below_cell_n += 1;
        yearScope.unattributed_total += state.n - yearSum;
      }
      collector.expect("year_breakdown_within_cell_n", yearSum <= state.n, { key: cell.key, year_sum: yearSum, n: state.n });
      collector.expect("year_breakdown_directions_sum_to_year_n", state.year_breakdown.every(year => {
        const split = year.direction || {};
        return ((split.positive || 0) + (split.negative || 0) + (split.exact_zero || 0)) === year.n;
      }), { key: cell.key });
    }
    if (typeof minimumObservations === "number") {
      collector.expect("small_sample_flag_matches_minimum_observations", state.small_sample === (state.n < minimumObservations), { key: cell.key, n: state.n, small_sample: state.small_sample });
    }
  }
  collector.observe("sampled_cells_by_horizon", byHorizon);
  collector.observe("year_breakdown_scope", yearScope);
  collector.observe("report_totals", { variables: (report.variables || []).length, cells_available: cells.length, minimum_observations: minimumObservations });
  return collector.finish({ source: options.source || null, population: cells.length, sampled: indices.length, sample_keys: indices.map(index => cells[index].key) });
}
function payloadObservationCount(payload) {
  let parsed;
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch (error) {
    return { found: false, reason: "payload_not_json" };
  }
  if (!parsed || typeof parsed !== "object") return { found: false, reason: "payload_not_object" };
  for (const candidate of ["observations", "rows", "data", "values"]) {
    if (Array.isArray(parsed[candidate])) return { found: true, field: candidate, count: parsed[candidate].length };
  }
  return { found: false, reason: "no_observation_array" };
}

function verifyCaptureEnvelopes(entries, options = {}) {
  const rng = options.rng || createRng(options.seed ?? 0);
  const indices = sampleIndices(entries.length, options.sample_size ?? entries.length, rng);
  const collector = createCollector("capture_envelopes");
  const fixturePatterns = options.fixture_patterns || [];
  const metadataFields = ["schema_version", "assignment", "source_id", "request_identity", "raw_sha256", "retrieved_at_utc", "coverage_start_utc", "coverage_end_utc", "earliest_availability_utc", "latest_availability_utc", "observation_count", "parser_version", "synthetic", "state"];
  const payloadSources = {};
  let fixtureSamples = 0;
  let fixtureMismatches = 0;
  let fixtureByMetadata = 0;
  let fixtureByPattern = 0;
  const fixturePatternsSeen = new Set();
  for (const index of indices) {
    const entry = entries[index];
    const key = entry.key || `entry:${index}`;
    let envelope = entry.envelope;
    let indexEntry = entry.index;
    if (!envelope) {
      try { envelope = JSON.parse(entry.envelope_raw.toString("utf8")); } catch (error) { collector.expect("envelope_is_readable_json", false, { key }); continue; }
    }
    if (!indexEntry && entry.index_raw) {
      try { indexEntry = JSON.parse(entry.index_raw.toString("utf8")); } catch (error) { collector.expect("index_is_readable_json", false, { key }); continue; }
    }
    const metadata = envelope.metadata || {};
    const payload = Buffer.from(envelope.sealed_raw_payload_base64 || "", "base64");
    // Synthetic fixture lanes deliberately carry injected drift to prove the collectors detect it,
    // so their value disagreements are recorded as fixtures rather than reported as live faults.
    // A lane counts as a fixture when its metadata declares synthetic true, or when its key matches
    // one of the fixture patterns declared in the sampling registry.
    const matchedPattern = fixturePatterns.find(pattern => key.includes(pattern)) || null;
    const isFixtureLane = metadata.synthetic === true || matchedPattern !== null;
    const fixtureNotes = [];
    const checkValue = (check, condition, detail) => {
      if (isFixtureLane) {
        if (!condition) fixtureNotes.push({ check, ...detail });
        return;
      }
      collector.expect(check, condition, detail);
    };
    if (isFixtureLane) fixtureSamples += 1;
    if (metadata.synthetic === true) fixtureByMetadata += 1;
    else if (matchedPattern) {
      fixtureByPattern += 1;
      fixturePatternsSeen.add(matchedPattern);
    }
    collector.expect("state_is_complete_sealed", metadata.state === "complete_sealed", { key, actual: metadata.state });
    checkValue("payload_hash_matches_declared_raw_hash", sha256(payload) === metadata.raw_sha256, { key, declared: metadata.raw_sha256, recomputed: sha256(payload) });
    collector.expect("synthetic_flag_is_declared", typeof metadata.synthetic === "boolean", { key });
    if (indexEntry) {
      if (entry.envelope_raw) checkValue("index_envelope_hash_matches_file", sha256(entry.envelope_raw) === indexEntry.envelope_sha256, { key, declared: indexEntry.envelope_sha256, recomputed: sha256(entry.envelope_raw) });
      checkValue("index_payload_hash_matches_envelope", indexEntry.sealed_payload_sha256 === metadata.raw_sha256, { key, index: indexEntry.sealed_payload_sha256, envelope: metadata.raw_sha256 });
      for (const field of metadataFields) {
        if (indexEntry[field] === undefined || metadata[field] === undefined) continue;
        checkValue(`index_matches_envelope:${field}`, JSON.stringify(indexEntry[field]) === JSON.stringify(metadata[field]), { key, field, index: indexEntry[field], envelope: metadata[field] });
      }
      if (indexEntry.bindings && envelope.bindings) {
        checkValue("index_bindings_match_envelope", JSON.stringify(indexEntry.bindings) === JSON.stringify(envelope.bindings), { key });
      }
      collector.expect("index_declares_capture_plan_hash", typeof indexEntry.capture_plan_sha256 === "string" && indexEntry.capture_plan_sha256.length === 64, { key });
    }
    const count = payloadObservationCount(payload);
    const label = count.found ? count.field : count.reason;
    payloadSources[label] = (payloadSources[label] || 0) + 1;
    if (count.found) checkValue("payload_observation_count_matches_declared", count.count === metadata.observation_count, { key, payload: count.count, declared: metadata.observation_count });
    if (fixtureNotes.length) fixtureMismatches += fixtureNotes.length;
  }
  collector.observe("payload_observation_sources", payloadSources);
  collector.observe("fixture_lanes", { sampled: fixtureSamples, by_metadata: fixtureByMetadata, by_pattern: fixtureByPattern, patterns_matched: [...fixturePatternsSeen].sort(), injected_disagreements: fixtureMismatches });
  return collector.finish({ source: options.source || null, population: entries.length, sampled: indices.length, sample_keys: indices.map(index => entries[index].key || `entry:${index}`) });
}
function runVerification(sources = {}, registry = {}) {
  const sampling = registry.sampling || {};
  const seed = Number.isFinite(sources.seed) ? sources.seed : (sampling.seed ?? 0);
  const requested = sources.sample_size ?? sampling.default_sample_size ?? 40;
  const maximum = sampling.max_sample_size ?? 5000;
  const sampleSize = Math.min(Math.max(Math.trunc(requested) || 0, 1), maximum);
  const tolerance = sources.tolerance ?? (registry.tolerances ? registry.tolerances.float_absolute ?? DEFAULT_TOLERANCE : DEFAULT_TOLERANCE);
  const declaredMinN = registry.declared_min_n ?? null;
  const targets = [];
  if (sources.checker) {
    targets.push(verifyCheckerRows(sources.checker, { rng: createRng(seed), sample_size: sampleSize, tolerance, source: sources.checker_source || null }));
  }
  if (sources.ledger) {
    targets.push(verifyLedger(sources.ledger, { rng: createRng(seed), sample_size: sampleSize, declared_min_n: declaredMinN, declared_totals: sources.declared_ledger_totals || null, source: sources.ledger_source || null }));
  }
  if (sources.report) {
    targets.push(verifyReportCells(sources.report, { rng: createRng(seed), sample_size: sampleSize, source: sources.report_source || null }));
  }
  if (sources.captures) {
    targets.push(verifyCaptureEnvelopes(sources.captures, { rng: createRng(seed), sample_size: sampleSize, fixture_patterns: sources.fixture_patterns ?? registry.fixture_lane_patterns ?? [], source: sources.captures_source || null }));
  }
  const mismatchCount = targets.reduce((sum, target) => sum + target.mismatch_count, 0);
  return {
    version: VERSION,
    registry_version: registry.version ?? null,
    seed,
    sample_size: sampleSize,
    tolerance,
    declared_min_n: declaredMinN,
    targets,
    skipped: sources.skipped || [],
    totals: {
      targets_run: targets.length,
      units_checked: targets.reduce((sum, target) => sum + target.sampled, 0),
      population_units: targets.reduce((sum, target) => sum + target.population, 0),
      mismatch_count: mismatchCount
    },
    status: mismatchCount ? "fail" : (targets.length ? "pass" : "nothing_checked")
  };
}

function formatSummary(report) {
  const lines = [`Gold data verifier ${report.version} | seed ${report.seed} | sample ${report.sample_size} per target | status ${report.status}`];
  for (const target of report.targets) {
    lines.push(`- ${target.target}: ${target.status} | population ${target.population} | sampled ${target.sampled} | mismatches ${target.mismatch_count}`);
    for (const check of target.asserted_checks) lines.push(`    ${check.check}: ${check.evaluated - check.failed}/${check.evaluated} held`);
    for (const mismatch of target.mismatches.slice(0, 5)) lines.push(`    MISMATCH ${JSON.stringify(mismatch)}`);
  }
  for (const skipped of report.skipped) lines.push(`- skipped ${skipped.target}: ${skipped.reason}`);
  return lines;
}

module.exports = {
  VERSION,
  DEFAULT_TOLERANCE,
  LEDGER_STATUS_VALUES,
  CHECKER_FIELDS,
  createRng,
  sampleIndices,
  valueEquals,
  recomputeEvaluationResult,
  censusCheckerRows,
  censusLedger,
  flattenReportCells,
  verifyCheckerRows,
  verifyLedger,
  verifyReportCells,
  verifyCaptureEnvelopes,
  runVerification,
  formatSummary
};







