'use strict';
// Build the durable Gold 28-factor outcome summary consumed by the self-contained research page
// (gold-backtest-outcomes.html). Every value comes from the accepted 024 artifacts; nothing is
// computed from outcomes here and no accuracy, ranking or edge claim is produced.
const crypto = require('node:crypto');
const fs = require('node:fs');

const SCHEMA = 'gold-28-factor-outcomes-v1';
const EXPECTED = Object.freeze({ run_id: 'gold-combination-run-024-20260926-rev3', candidates: 4956,
  attempts: 4782540, matched_anchors: 441781, observations: 441319 });

function requireValue(condition, message) { if (!condition) throw new Error(message); }
function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }

// The page quotes the accepted verdict page rather than paraphrasing it, so the wording stays the
// worker's and every sentence traces to one hashed artifact.
function quotesFromVerdict(pageText) {
  const wanted = [
    'the 2023-2026 archive can *describe* this space, but it cannot support *choosing* from it',
    'Nothing here is a verdict on accuracy, prediction, timing or edge.',
    'The attempts are dependent, because every candidate shares anchors, so their results move together.',
    'Two things could settle the question, and neither is authorized by this assignment.'
  ];
  const flattened = pageText.replace(/\*/g, '').replace(/\s+/g, ' ');
  return wanted.map(sentence => {
    const plain = sentence.replace(/\*/g, '').replace(/\s+/g, ' ');
    requireValue(flattened.includes(plain), `Verdict page does not contain the expected sentence: ${sentence}`);
    return plain;
  });
}

function buildGoldBacktestOutcomes({ summaryPath, descriptivePath, registryPath, verdictPath, declarationCommit,
  declarationRegistrySha, candidateListSha }) {
  const summary = readJson(summaryPath);
  const descriptive = readJson(descriptivePath);
  const registry = readJson(registryPath);
  const verdictText = fs.readFileSync(verdictPath, 'utf8');
  const status = summary.status_totals || {};
  const attempts = summary.attempt_totals || {};
  const total = Object.values(status).reduce((sum, value) => sum + Number(value || 0), 0);
  requireValue(summary.run_id === EXPECTED.run_id, `Unexpected run id ${summary.run_id}`);
  requireValue(summary.exploratory === true && summary.prediction_claimed === false && summary.accuracy_claimed === false
    && summary.trading_result_computed === false, 'The accepted summary must be exploratory with no prediction, accuracy or trading-result claim');
  requireValue(Number(summary.candidate_count) === EXPECTED.candidates, 'Candidate count drifted from the accepted 4,956');
  requireValue(total === EXPECTED.candidates, `Status totals must sum to ${EXPECTED.candidates}, found ${total}`);
  requireValue(Number(attempts.attempts) === EXPECTED.attempts && Number(attempts.matched_anchors) === EXPECTED.matched_anchors
    && Number(attempts.n) === EXPECTED.observations, 'Attempt, matched-anchor or observation total drifted from the accepted run');
  requireValue(Number(attempts.exact_offset_elapsed) + Number(attempts.delayed_offset_endpoint) + Number(attempts.session_close_endpoint)
    === Number(attempts.n), 'Endpoint denominators do not reconcile');
  const quantiles = (descriptive.n_distribution || {}).all_attempts || {};
  const unavailability = descriptive.unavailability || {};
  const unavailableAnchors = unavailability.candidates_with_any_unavailable_anchor ?? unavailability.candidates_with_unavailable_anchors ?? 0;
  const unavailableMedian = unavailability.anchors_unavailable_median ?? 0;
  const unavailableMax = unavailability.anchors_unavailable_max ?? 0;
  const notComputed = unavailability.matched_outcome_not_computed_totals ?? summary.rows?.endpoint_groups?.outcome_not_computed ?? 0;
  requireValue(unavailableAnchors > 0 && notComputed > 0, 'The descriptive analysis is missing its unavailability or not-computed totals');
  return {
    schema_version: SCHEMA, research_only: true, exploratory: true, prediction_claimed: false,
    accuracy_claimed: false, trading_result_computed: false,
    headline: 'Exploratory census of the 28 measured Gold factors on already-consumed intervals: it can describe the space, it cannot choose from it.',
    run_id: summary.run_id,
    declaration: {
      commit: declarationCommit,
      registry_path: 'backtester/registries/gold_combination_batch_daily_h24_and.v2.json',
      registry_sha256: declarationRegistrySha, candidate_list_sha256: candidateListSha,
      cell: { cohort: 'daily_snapshot_anchors', horizon: 'h24_post_event', endpoint_group: 'all_computed', operator: 'and',
        context_field: 'prior_5session_return_sign' },
      atoms_declared: 51, applicable_variables: 22, cross_variable_pairs: 1239, context_options: 4,
      candidates_declared: Number(registry.batch?.declared_universe ?? EXPECTED.candidates),
      cap: Number(registry.batch?.cap ?? 0), selection: 'complete_enumeration', ranking: 'none', truncation: 'none',
      declared_before_evaluation: true
    },
    coverage: {
      candidates_declared: EXPECTED.candidates, candidates_evaluated: EXPECTED.candidates,
      status_totals: { reported: Number(status.reported), ineligible: Number(status.ineligible), empty: Number(status.empty), unavailable: Number(status.unavailable) },
      attempts: Number(attempts.attempts), matched_anchors: Number(attempts.matched_anchors), observations: Number(attempts.n),
      direction_split: { positive: Number(attempts.positive), negative: Number(attempts.negative), exact_zero: Number(attempts.exact_zero) },
      anchors: { scheduled: Number(summary.rows?.anchors ?? 0), computed_outcomes: Number(summary.rows?.computed_outcomes ?? 0) },
      duration_ms: Number(summary.duration_ms || 0)
    },
    denominators: {
      rule: 'exact_offset_elapsed + delayed_offset_endpoint + session_close_endpoint = all_computed',
      all_computed: Number(attempts.n), exact_offset_elapsed: Number(attempts.exact_offset_elapsed),
      delayed_offset_endpoint: Number(attempts.delayed_offset_endpoint), session_close_endpoint: Number(attempts.session_close_endpoint),
      reconciled: true
    },
    candidate_n: { median: Number(quantiles.median ?? 0), q1: Number(quantiles.q1 ?? 0), q3: Number(quantiles.q3 ?? 0),
      min: Number(quantiles.min ?? 0), max: Number(quantiles.max ?? 0),
      reported_by_bucket: (descriptive.n_distribution || {}).reported_by_bucket || {},
      year_support_buckets: (summary.year_support || {}).buckets || {} },
    exclusions: [
      { label: 'Candidates below the declared min_n of 20', count: Number(status.ineligible) },
      { label: 'Candidates whose atoms and context never coexisted on one anchor', count: Number(status.empty) },
      { label: `Candidates with at least one unavailable input on an anchor (median ${unavailableMedian}, maximum ${unavailableMax})`, count: Number(unavailableAnchors) },
      { label: 'Matched outcomes not computed', count: Number(notComputed) }
    ],
    limits: Array.isArray(summary.limits) ? summary.limits : [],
    dependence: summary.dependence || {},
    verdict: { path: 'docs/GOLD_BACKTEST_VERDICT_20260925.md', sha256: sha256File(verdictPath), quotes: quotesFromVerdict(verdictText) },
    what_would_change_it: [
      'The sealed prospective window, whose evaluation stays sealed until 2027-03-25T15:00:00Z.',
      'A new licensed dataset with declared vintages; either path needs its own bounded assignment, and neither exists today.'
    ],
    sources: [
      { label: 'Declaration registry', path: 'backtester/registries/gold_combination_batch_daily_h24_and.v2.json', sha256: declarationRegistrySha },
      { label: 'Run ledger', path: 'combination-ledger.jsonl', sha256: (summary.ledger || {}).sha256 || null },
      { label: 'Run summary', path: 'combination-summary.json', sha256: sha256File(summaryPath) },
      { label: 'Run manifest', path: 'execution-manifest.json', sha256: (summary.manifest || {}).sha256 || null },
      { label: 'Accepted verdict page', path: 'docs/GOLD_BACKTEST_VERDICT_20260925.md', sha256: sha256File(verdictPath) }
    ]
  };
}

module.exports = { SCHEMA, EXPECTED, buildGoldBacktestOutcomes, quotesFromVerdict };

