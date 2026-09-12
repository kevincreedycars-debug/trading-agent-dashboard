const DIRECTION_VALUES = new Set(["BULLISH", "BEARISH", "FLAT"]);
const OPERATORS = new Set(["equals", "gte", "lte", "between"]);

const { parseTimestamp } = require('./gold_timestamped_evaluation');
const DAY_MS = 86400000;

function normalizeDirection(value) {
  const direction = String(value || "").trim().toUpperCase();
  return DIRECTION_VALUES.has(direction) ? direction : null;
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function wilsonInterval(successes, total) {
  if (!total) return { lower_pct: null, upper_pct: null };
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + (z ** 2 / total);
  const centre = (p + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * total)) / total) / denominator;
  return { lower_pct: round((centre - margin) * 100), upper_pct: round((centre + margin) * 100) };
}

function resultStats(rows, expectedDirection) {
  const returns = rows.map(row => row.return_pct).filter(Number.isFinite).sort((a, b) => a - b);
  const bullish = rows.filter(row => row.outcome_direction === "BULLISH").length;
  const bearish = rows.filter(row => row.outcome_direction === "BEARISH").length;
  const flat = rows.filter(row => row.outcome_direction === "FLAT").length;
  const directional = bullish + bearish;
  const successes = expectedDirection === "BULLISH" ? bullish : bearish;
  const hitRate = directional ? (successes / directional) * 100 : null;
  return {
    observation_count: rows.length,
    return_observations: returns.length,
    mean_return_pct: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
    median_return_pct: returns.length ? (returns[Math.floor((returns.length - 1) / 2)] + returns[Math.floor(returns.length / 2)]) / 2 : null,
    bullish_count: bullish,
    bearish_count: bearish,
    flat_count: flat,
    directional_count: directional,
    expected_direction_count: successes,
    directional_hit_rate_pct: round(hitRate),
    directional_hit_rate_95pct_wilson: wilsonInterval(successes, directional)
  };
}

function assertRegistry(registry) {
  if (!registry || typeof registry !== "object") throw new Error("A research registry object is required.");
  if (!Array.isArray(registry.features) || !Array.isArray(registry.hypotheses)) {
    throw new Error("Registry requires features and hypotheses arrays.");
  }
  const featureKeys = new Set();
  for (const feature of registry.features) {
    if (!feature || typeof feature.key !== "string" || !feature.key.trim() || featureKeys.has(feature.key)) {
      throw new Error("Every registry feature requires a unique key.");
    }
    featureKeys.add(feature.key);
  }
  const hypothesisIds = new Set();
  for (const hypothesis of registry.hypotheses) {
    if (!hypothesis || typeof hypothesis.id !== "string" || !hypothesis.id.trim() || hypothesisIds.has(hypothesis.id)) {
      throw new Error("Every hypothesis requires a unique id.");
    }
    if (!featureKeys.has(hypothesis.feature_key)) throw new Error(`Unknown feature_key in hypothesis ${hypothesis.id}.`);
    if (!OPERATORS.has(hypothesis?.cohort?.operator)) throw new Error(`Invalid cohort operator in hypothesis ${hypothesis.id}.`);
    const cohort = hypothesis.cohort;
    if (cohort.operator === 'equals') {
      if (!['string', 'number', 'boolean'].includes(typeof cohort.value) ||
          (typeof cohort.value === 'number' && !Number.isFinite(cohort.value))) throw new Error('Invalid equality value.');
    } else {
      const values = cohort.operator === 'between' ? [cohort.minimum, cohort.maximum] : [cohort.value];
      if (values.some(value => typeof value !== 'number' || !Number.isFinite(value)) ||
          (cohort.operator === 'between' && cohort.minimum > cohort.maximum)) throw new Error('Invalid numeric cohort bounds.');
    }
    if (!DIRECTION_VALUES.has(hypothesis.expected_outcome_direction) || hypothesis.expected_outcome_direction === "FLAT") {
      throw new Error(`Hypothesis ${hypothesis.id} requires BULLISH or BEARISH expected_outcome_direction.`);
    }
    hypothesisIds.add(hypothesis.id);
  }
}

function featureMatches(feature, cohort) {
  if (!feature || !cohort) return false;
  const value = feature.value;
  if (cohort.operator === "equals") return value === cohort.value;
  const numeric = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(numeric)) return false;
  if (cohort.operator === "gte") return numeric >= Number(cohort.value);
  if (cohort.operator === "lte") return numeric <= Number(cohort.value);
  return numeric >= Number(cohort.minimum) && numeric <= Number(cohort.maximum);
}

function partitionFor(row, splitAt, embargoMs) {
  if (row.outcome_end_ms <= splitAt) return "training";
  if (row.decision_ms >= splitAt + embargoMs) return "validation";
  return null;
}

function normaliseObservations(dataset, splitAt, embargoMs) {
  if (!Array.isArray(dataset?.observations)) throw new Error("Dataset requires an observations array.");
  const duplicateIds = new Set();
  const seenIds = new Set();
  for (const observation of dataset.observations) {
    const id = String(observation?.observation_id || "");
    if (id && seenIds.has(id)) duplicateIds.add(id);
    seenIds.add(id);
  }
  const accepted = [];
  const excluded = [];
  dataset.observations.forEach((observation, source_index) => {
    const observationId = String(observation?.observation_id || "");
    const reject = reason => excluded.push({ observation_id: observationId || null, source_index, reason });
    if (!observationId) return reject("missing_observation_id");
    if (duplicateIds.has(observationId)) return reject("duplicate_observation_id");
    const decisionMs = parseTimestamp(observation.decision_time);
    const outcomeEndMs = parseTimestamp(observation.outcome_end_time);
    const entryMs = parseTimestamp(observation.entry_time ?? observation.decision_time);
    const direction = normalizeDirection(observation.outcome_direction);
    if (decisionMs === null) return reject("invalid_decision_time");
    if (outcomeEndMs === null || outcomeEndMs < decisionMs) return reject("invalid_outcome_end_time");
    if (entryMs === null || entryMs < decisionMs) return reject('invalid_entry_time');
    if (outcomeEndMs - entryMs !== DAY_MS) return reject('horizon_not_24_elapsed_hours_from_entry');
    if (!direction) return reject("invalid_outcome_direction");
    const partition = partitionFor({ decision_ms: decisionMs, outcome_end_ms: outcomeEndMs }, splitAt, embargoMs);
    if (!partition) return reject("split_overlap_or_embargo");
    accepted.push({
      observation_id: observationId,
      source_index,
      decision_ms: decisionMs,
      decision_time: new Date(decisionMs).toISOString(),
      outcome_end_ms: outcomeEndMs,
      outcome_direction: direction,
      return_pct: typeof observation.return_pct === 'number' && Number.isFinite(observation.return_pct) ? observation.return_pct : null,
      features: observation.features && typeof observation.features === "object" ? observation.features : {},
      partition
    });
  });
  return { accepted, excluded };
}

function evaluateHypothesis(hypothesis, rows) {
  const byPartition = {};
  for (const partition of ["training", "validation"]) {
    const partitionRows = rows.filter(row => row.partition === partition);
    const usable = [];
    const excluded = { missing_feature: 0, invalid_feature_value: 0, invalid_feature_availability: 0, late_feature: 0 };
    for (const row of partitionRows) {
      const feature = row.features[hypothesis.feature_key];
      if (!feature || !Object.prototype.hasOwnProperty.call(feature, "value")) {
        excluded.missing_feature += 1;
        continue;
      }
      const value = feature.value;
      if (!['number', 'string', 'boolean'].includes(typeof value) ||
          (typeof value === 'number' && !Number.isFinite(value)) ||
          (typeof value === 'string' && !value.trim()) ||
          (hypothesis.cohort.operator !== 'equals' && typeof value !== 'number')) {
        excluded.invalid_feature_value++;
        continue;
      }
      const availableMs = parseTimestamp(feature.available_at);
      if (availableMs === null) {
        excluded.invalid_feature_availability += 1;
        continue;
      }
      if (availableMs > row.decision_ms) {
        excluded.late_feature += 1;
        continue;
      }
      usable.push(row);
    }
    const cohort = usable.filter(row => featureMatches(row.features[hypothesis.feature_key], hypothesis.cohort));
    const baseline = resultStats(usable, hypothesis.expected_outcome_direction);
    const cohortStats = resultStats(cohort, hypothesis.expected_outcome_direction);
    byPartition[partition] = {
      outcome_eligible_observations: partitionRows.length,
      feature_usable_observations: usable.length,
      feature_exclusions: excluded,
      cohort: cohortStats,
      cohort_observation_ids: cohort.map(row => row.observation_id),
      complement: resultStats(usable.filter(row => !cohort.includes(row)), hypothesis.expected_outcome_direction),
      comparable_feature_baseline: baseline,
      numeric_return_association: numericAssociation(usable, hypothesis.feature_key),
      association_vs_feature_baseline_pct_points: (
        cohortStats.directional_hit_rate_pct === null || baseline.directional_hit_rate_pct === null
          ? null
          : round(cohortStats.directional_hit_rate_pct - baseline.directional_hit_rate_pct)
      )
    };
  }
  return {
    id: hypothesis.id,
    label: hypothesis.label || hypothesis.id,
    feature_key: hypothesis.feature_key,
    cohort: hypothesis.cohort,
    expected_outcome_direction: hypothesis.expected_outcome_direction,
    research_status: hypothesis.research_status || "exploratory",
    results: byPartition
  };
}

function numericAssociation(rows, key) {
  const pairs = rows.filter(row => typeof row.features[key].value === 'number' && Number.isFinite(row.return_pct));
  if (pairs.length < 2) return { observations: pairs.length, pearson_r: null };
  const meanX = pairs.reduce((sum, row) => sum + row.features[key].value, 0) / pairs.length;
  const meanY = pairs.reduce((sum, row) => sum + row.return_pct, 0) / pairs.length;
  let covariance = 0, varianceX = 0, varianceY = 0;
  for (const row of pairs) {
    const x = row.features[key].value - meanX, y = row.return_pct - meanY;
    covariance += x * y; varianceX += x * x; varianceY += y * y;
  }
  const r = covariance / Math.sqrt(varianceX * varianceY);
  return { observations: pairs.length, pearson_r: Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null };
}

function buildVariableEventResearchReport(dataset, registry, options) {
  assertRegistry(registry);
  const splitAt = parseTimestamp(options?.split_at);
  const embargoMs = options?.embargo_ms;
  if (splitAt === null || !Number.isSafeInteger(embargoMs) || embargoMs < 0 || !Number.isSafeInteger(splitAt + embargoMs)) {
    throw new Error("Explicit split_at timestamp and non-negative integer embargo_ms are required.");
  }
  const normalised = normaliseObservations(dataset, splitAt, embargoMs);
  return {
    version: "variable-event-research-v2",
    enforced_horizon: '24_elapsed_hours_from_entry',
    research_only: true,
    causal_claims_permitted: false,
    outcome_contract_id: registry.outcome_contract_id || null,
    registry_version: registry.version || null,
    data_kind: dataset.data_kind || "unspecified",
    split_at: new Date(splitAt).toISOString(),
    embargo_ms: embargoMs,
    untouched_holdout_claimed: false,
    limitations: [
      "Results are associations, not causal claims about variables or events.",
      "The registry and split must be committed before a validation result can be described as confirmatory.",
      "Feature availability is accepted from supplied timestamps; this tool does not authenticate source publication times.",
      "Overlapping decision horizons can create dependent observations; counts are not automatically independent trials.",
      "Wilson intervals assume independent Bernoulli trials and are descriptive only here; they are not adjusted for dependence or multiple hypotheses.",
      "No trading costs, spread, fill, or executable P&L are modelled."
    ],
    coverage: {
      source_observations: dataset.observations.length,
      accepted_observations: normalised.accepted.length,
      training_observations: normalised.accepted.filter(row => row.partition === "training").length,
      validation_observations: normalised.accepted.filter(row => row.partition === "validation").length,
      excluded_observations: normalised.excluded.length
    },
    excluded_observations: normalised.excluded,
    features: registry.features,
    hypotheses: registry.hypotheses.map(hypothesis => evaluateHypothesis(hypothesis, normalised.accepted))
  };
}

module.exports = { buildVariableEventResearchReport, parseTimestamp, resultStats };
