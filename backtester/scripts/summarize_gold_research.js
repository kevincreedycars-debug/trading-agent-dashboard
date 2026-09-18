const fs = require('node:fs');
const crypto = require('node:crypto');
const { testCondition } = require('../lib/gold_research_experiments');
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
function score(rows, sign) {
  const correct = rows.filter(row => row.sign === sign).length;
  const wrong = rows.filter(row => row.sign === -sign).length;
  const flat = rows.length - correct - wrong, n = correct + wrong;
  return { observations: rows.length, correct, wrong, flat,
    directional_accuracy_pct: n ? 100 * correct / n : null,
    accuracy_including_flat_pct: rows.length ? 100 * correct / rows.length : null };
}
function interval(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  return valid.length ? { lower: valid[Math.floor(0.025 * (valid.length - 1))], upper: valid[Math.floor(0.975 * (valid.length - 1))], finite_draws: valid.length } : null;
}
// Paired calendar-month resampling; conditional diagnostics, not post-search inference.
function blockDiagnostic(rows, conditions, sign, draws = 2000) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.decision_time.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const blocks = [...groups.values()];
  if (!blocks.length) return { months: 0, draws, accuracy_pct: null, matched_minus_usable_pp: null };
  let state = 20260918;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const accuracy = [], deltas = [];
  for (let i = 0; i < draws; i++) {
    const sample = Array.from({ length: blocks.length }, () => blocks[Math.floor(random() * blocks.length)]).flat();
    const usable = sample.filter(row => conditions.every(c => testCondition(row, c) !== null));
    const matched = usable.filter(row => conditions.every(c => testCondition(row, c) === true));
    const a = score(matched, sign).directional_accuracy_pct, b = score(usable, sign).directional_accuracy_pct;
    accuracy.push(a === null ? NaN : a); deltas.push(a === null || b === null ? NaN : a - b);
  }
  return { months: blocks.length, draws, seed: 20260918, accuracy_pct: interval(accuracy), matched_minus_usable_pp: interval(deltas),
    limitation: 'Descriptive paired month-block percentile interval; few blocks, historical vintage uncertainty and hypothesis selection are not resolved. No significance or qualification claim.' };
}
function summarize(report, dataset) {
  const callById = new Map(dataset.calls.map(call => [call.prediction_id, call]));
  const names = new Map(report.event_family_coverage.map(row => [row.feature, row.event_name]));
  const labels = conditions => conditions.map(c => ({ ...c, label: names.get(c.feature) ?? c.feature }));
  const selectedIds = [...new Set([report.selected_by_training_only, ...Object.values(report.selected_by_class_training_only)].filter(Boolean))];
  const selected = selectedIds.map(id => {
    const candidate = report.experiments.find(row => row.id === id), sign = candidate.expected_direction === 'BULLISH' ? 1 : -1;
    const matched = report.rows.filter(row => candidate.conditions.every(c => testCondition(row, c) === true));
    const yearly = {};
    for (const year of [...new Set(report.rows.map(row => row.decision_time.slice(0, 4)))]) yearly[year] = score(matched.filter(row => row.decision_time.startsWith(year)), sign);
    const validation = report.rows.filter(row => row.partition === 'validation');
    const uniqueReleases = {};
    for (const partition of ['training', 'validation']) {
      const keys = new Set();
      for (const row of matched.filter(row => row.partition === partition)) {
        const call = callById.get(row.prediction_id);
        for (const c of candidate.conditions.filter(c => c.feature.startsWith('event_'))) {
          const feature = [...(call.features || []), ...(call.retrospective_event_features || [])].find(f => f.name === c.feature);
          if (feature) keys.add(`${c.feature.replace(/_(surprise|age_hours)$/, '')}:${feature.observed_at}`);
        }
      }
      uniqueReleases[partition] = keys.size;
    }
    return { id, conditions: labels(candidate.conditions), expected_direction: candidate.expected_direction,
      training: candidate.training, validation: candidate.validation,
      validation_cohort: candidate.feature_coverage.validation,
      validation_call_coverage_pct: 100 * candidate.validation.observations / validation.length,
      matched_constant_direction_note: 'A fixed bullish/bearish rule equals that constant direction on the exact matched days. Compare selection versus all feature-usable days and the complement; this is not an identical-sample model victory.',
      yearly, unique_event_releases: uniqueReleases,
      validation_month_blocks: blockDiagnostic(validation, candidate.conditions, sign) };
  });
  const rank = (a, b) => b.training.ex_flat_accuracy_pct - a.training.ex_flat_accuracy_pct || b.training.directional_observations - a.training.directional_observations || a.id.localeCompare(b.id);
  const singleVariables = [...new Set(report.experiments.filter(x => x.conditions.length === 1 && !x.event_conditioned).map(x => x.conditions[0].feature))].sort().map(feature => {
    const best = report.experiments.filter(x => x.training_eligible && x.conditions.length === 1 && x.conditions[0].feature === feature).sort(rank)[0];
    return best ? { feature, selected_by_training: best.id, condition: best.conditions[0], direction: best.expected_direction,
      training: best.training, validation: best.validation, baseline: best.feature_coverage.validation.comparable_constant_direction } : { feature, selected_by_training: null };
  });
  return { coverage: report.coverage, candidate_count: report.candidate_count, eligible_training_candidates: report.eligible_training_candidates,
    eligible_event_candidates: report.experiments.filter(x => x.event_conditioned && x.training_eligible).length,
    selected, single_variables: singleVariables, live_qualified: false };
}
function run(args = process.argv.slice(2)) {
  if (args.length !== 3) throw new Error('Usage: EXPERIMENTS.json EVENT_DATASET.json NEW_REPORT.json');
  const raw = args.slice(0, 2).map(file => fs.readFileSync(file));
  const [experiments, dataset] = raw.map(value => JSON.parse(value));
  if (experiments.input_sha256?.[0] !== hash(raw[1])) throw new Error('Experiment/dataset lineage mismatch');
  const report = summarize(experiments, dataset);
  report.source_sha256 = raw.map(hash);
  fs.writeFileSync(args[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ selected: report.selected, single_variables: report.single_variables.length }, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run, score, blockDiagnostic, summarize };
