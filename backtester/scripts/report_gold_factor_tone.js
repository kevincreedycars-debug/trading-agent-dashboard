const fs = require('node:fs');
const crypto = require('node:crypto');
const { flattenReportCells } = require('../lib/gold_data_verifier');

// Descriptive re-cut of the accepted single-variable report on already-consumed intervals.
// It reports measured state-conditional rates as they stand. It selects nothing, ranks nothing,
// adds no measurement and makes no accuracy, timing or edge claim.
const VERSION = 'gold-factor-tone-v1';
const PRIMARY_HORIZON = 'h24_post_event';
const WEEK_HORIZON = 'd5_trading_days_post_event';
const COHORT = 'daily_snapshot_anchors';
const GROUP = 'all_computed';

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    const [name, inline] = arg.slice(2).split('=');
    const value = inline ?? args[index + 1];
    if (value === undefined) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    if (inline === undefined) index += 1;
  }
  return options;
}

function share(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function baselineFor(report, parameters, horizon) {
  const block = (report.baselines || {})[parameters.cohort];
  const horizonBlock = block ? block[horizon] : null;
  const group = horizonBlock && horizonBlock.groups ? horizonBlock.groups[parameters.group] : null;
  if (!group) return null;
  const direction = group.direction || {};
  const byYear = {};
  for (const year of group.year_breakdown || []) {
    const split = year.direction || {};
    const resolved = (split.positive || 0) + (split.negative || 0);
    if (resolved) byYear[year.year] = { n: year.n, positive_rate_pct: share(split.positive || 0, resolved) };
  }
  return {
    horizon,
    n: group.n,
    positive_rate_pct: share(direction.positive || 0, (direction.positive || 0) + (direction.negative || 0)),
    by_year: byYear
  };
}

function describeState(cell, baseline, parameters) {
  const direction = cell.state.direction || {};
  const positive = direction.positive || 0;
  const negative = direction.negative || 0;
  const zero = direction.exact_zero || 0;
  const resolved = positive + negative;
  const n = cell.state.n || 0;
  const majority = positive === negative ? 'tied' : (positive > negative ? 'positive' : 'negative');
  const positiveRate = share(positive, resolved);
  const excess = baseline && baseline.positive_rate_pct !== null && positiveRate !== null
    ? Math.round((positiveRate - baseline.positive_rate_pct) * 100) / 100
    : null;
  const years = (cell.state.year_breakdown || []).map(year => {
    const split = year.direction || {};
    const yearResolved = (split.positive || 0) + (split.negative || 0);
    const yearRate = share(split.positive || 0, yearResolved);
    const yearMajority = (split.positive || 0) === (split.negative || 0) ? 'tied' : ((split.positive || 0) > (split.negative || 0) ? 'positive' : 'negative');
    const yearBaseline = baseline && baseline.by_year ? baseline.by_year[year.year] : null;
    return {
      year: year.year,
      n: year.n,
      majority: yearMajority,
      majority_rate_pct: share(Math.max(split.positive || 0, split.negative || 0), yearResolved),
      positive_rate_pct: yearRate,
      excess_pp: yearBaseline ? Math.round((yearRate - yearBaseline.positive_rate_pct) * 100) / 100 : null
    };
  });
  const usable = years.filter(year => year.n >= parameters.min_year_n && year.excess_pp !== null);
  return {
    variable: cell.variable,
    cohort: cell.cohort,
    horizon: cell.horizon,
    group: cell.group,
    state: cell.state.state,
    n,
    positive,
    negative,
    exact_zero: zero,
    majority,
    majority_rate_pct: share(Math.max(positive, negative), resolved),
    positive_rate_pct: positiveRate,
    baseline_positive_rate_pct: baseline ? baseline.positive_rate_pct : null,
    excess_pp: excess,
    small_sample: cell.state.small_sample === true,
    years,
    years_observed: usable.length,
    years_same_majority: usable.filter(year => year.majority === majority).length,
    years_all_same_majority: usable.length > 0 && usable.every(year => year.majority === majority),
    years_excess_same_sign: excess !== null && usable.length >= 2 && usable.every(year => Math.sign(year.excess_pp) === Math.sign(excess))
  };
}
function buildToneReport(report, parameters) {
  const baselines = {};
  for (const horizon of parameters.horizons) baselines[horizon] = baselineFor(report, parameters, horizon);
  const cells = flattenReportCells(report).filter(cell =>
    cell.cohort === parameters.cohort && cell.group === parameters.group && parameters.horizons.includes(cell.horizon));
  const rows = cells.map(cell => describeState(cell, baselines[cell.horizon], parameters));
  const byVariable = new Map();
  for (const row of rows) {
    if (!byVariable.has(row.variable)) byVariable.set(row.variable, {});
    byVariable.get(row.variable)[`${row.horizon}|${row.state}`] = row;
  }
  const consistency = [];
  for (const row of rows) {
    if (row.horizon !== parameters.primary_horizon) continue;
    const opposite = byVariable.get(row.variable)[`${parameters.week_horizon}|${row.state}`];
    const shape = horizonRow => horizonRow ? {
      horizon: horizonRow.horizon,
      n: horizonRow.n,
      majority: horizonRow.majority,
      rate_pct: horizonRow.majority_rate_pct,
      positive_rate_pct: horizonRow.positive_rate_pct,
      baseline_positive_rate_pct: horizonRow.baseline_positive_rate_pct,
      excess_pp: horizonRow.excess_pp,
      small_sample: horizonRow.small_sample,
      years_observed: horizonRow.years_observed,
      years_all_same_majority: horizonRow.years_all_same_majority,
      years_excess_same_sign: horizonRow.years_excess_same_sign
    } : null;
    const above = horizonRow => horizonRow ? horizonRow.n >= parameters.min_n && Math.abs(horizonRow.excess_pp ?? 0) >= parameters.excess_pp : null;
    consistency.push({
      variable: row.variable,
      state: row.state,
      session: shape(row),
      week: shape(opposite),
      session_clears_majority_threshold: row.n >= parameters.min_n && row.majority_rate_pct >= parameters.threshold_pct,
      week_clears_majority_threshold: opposite ? opposite.n >= parameters.min_n && opposite.majority_rate_pct >= parameters.threshold_pct : null,
      session_above_baseline: above(row),
      week_above_baseline: above(opposite),
      session_and_week_same_majority: opposite ? opposite.majority === row.majority : null,
      session_and_week_same_excess_sign: opposite && opposite.excess_pp !== null && row.excess_pp !== null ? Math.sign(opposite.excess_pp) === Math.sign(row.excess_pp) : null
    });
  }
  consistency.sort((left, right) => Math.abs(right.session.excess_pp || 0) - Math.abs(left.session.excess_pp || 0));
  return { rows, consistency, baselines };
}
function summarise(tone, parameters) {
  const session = tone.consistency;
  return {
    baselines: tone.baselines,
    states_daily_cohort: session.length,
    states_clearing_majority_threshold_session: session.filter(row => row.session_clears_majority_threshold).length,
    states_clearing_majority_threshold_week: session.filter(row => row.week_clears_majority_threshold === true).length,
    states_clearing_majority_threshold_both: session.filter(row => row.session_clears_majority_threshold && row.week_clears_majority_threshold === true).length,
    states_above_baseline_session: session.filter(row => row.session_above_baseline).length,
    states_above_baseline_week: session.filter(row => row.week_above_baseline === true).length,
    states_above_baseline_both: session.filter(row => row.session_above_baseline && row.week_above_baseline === true).length,
    states_above_baseline_session_only: session.filter(row => row.session_above_baseline && row.week_above_baseline !== true).length,
    states_above_baseline_week_only: session.filter(row => !row.session_above_baseline && row.week_above_baseline === true).length,
    states_same_excess_sign_both_horizons: session.filter(row => row.session_and_week_same_excess_sign === true).length,
    states_opposite_excess_sign_both_horizons: session.filter(row => row.session_and_week_same_excess_sign === false).length,
    states_excess_sign_stable_across_years_session: session.filter(row => row.session_above_baseline && row.session.years_excess_same_sign).length,
    states_excess_sign_stable_across_years_week: session.filter(row => row.week_above_baseline === true && row.week.years_excess_same_sign).length,
    states_same_majority_both_horizons: session.filter(row => row.session_and_week_same_majority === true).length,
    states_opposite_majority_both_horizons: session.filter(row => row.session_and_week_same_majority === false).length
  };
}
function formatLines(tone, parameters) {
  const lines = [
    `Gold factor tone ${VERSION} | cohort ${parameters.cohort} | group ${parameters.group}`,
    `session ${parameters.primary_horizon} | week ${parameters.week_horizon} | min n ${parameters.min_n} | majority threshold ${parameters.threshold_pct}% | baseline excess ${parameters.excess_pp}pp`,
    `baselines ${JSON.stringify(Object.fromEntries(Object.entries(tone.baselines).map(([horizon, value]) => [horizon, value ? { n: value.n, positive_rate_pct: value.positive_rate_pct } : null])))}`,
    `summary ${JSON.stringify(summarise(tone, parameters))}`,
    '',
    'variable | state | session (positive rate / n / excess) | week (positive rate / n / excess) | same excess sign | excess stable years session/week | majority session/week'
  ];
  for (const row of tone.consistency.filter(entry => entry.session_above_baseline || entry.week_above_baseline === true)) {
    const session = `${row.session.positive_rate_pct}% / ${row.session.n} / ${row.session.excess_pp >= 0 ? '+' : ''}${row.session.excess_pp}pp`;
    const week = row.week ? `${row.week.positive_rate_pct}% / ${row.week.n} / ${row.week.excess_pp >= 0 ? '+' : ''}${row.week.excess_pp}pp` : 'n/a';
    lines.push(`${row.variable} | ${row.state} | ${session} | ${week} | ${row.session_and_week_same_excess_sign} | ${row.session.years_excess_same_sign} / ${row.week ? row.week.years_excess_same_sign : 'n/a'} | ${row.session.majority} / ${row.week ? row.week.majority : 'n/a'}`);
  }
  return lines;
}

function run(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (!options.report) throw new Error('Usage: node backtester/scripts/report_gold_factor_tone.js --report <individual-variable-report.json> [--out file]');
  const raw = fs.readFileSync(options.report);
  const report = JSON.parse(raw.toString('utf8'));
  const parameters = {
    cohort: options.cohort || COHORT,
    group: options.group || GROUP,
    primary_horizon: options.session || PRIMARY_HORIZON,
    week_horizon: options.week || WEEK_HORIZON,
    horizons: [options.session || PRIMARY_HORIZON, options.week || WEEK_HORIZON],
    min_n: Number(options['min-n'] || 30),
    min_year_n: Number(options['min-year-n'] || 20),
    excess_pp: Number(options.excess || 5),
    threshold_pct: Number(options.threshold || 60)
  };
  const tone = buildToneReport(report, parameters);
  const output = {
    version: VERSION,
    research_only: true,
    exploratory: true,
    prediction_claimed: false,
    accuracy_claimed: false,
    trading_result_computed: false,
    generated_at: new Date().toISOString(),
    source: { path: options.report, sha256: crypto.createHash('sha256').update(raw).digest('hex'), bytes: raw.length },
    parameters,
    summary: summarise(tone, parameters),
    limits: [
      'Descriptive re-cut of the accepted single-variable report on already-consumed intervals. It can describe this space; it cannot support choosing from it.',
      'Attempts are dependent: states share anchors and one instant can feed several variables.',
      'Excess is measured against the cohort baseline for the same horizon, so it describes a state relative to the cohort rather than an absolute rate.',
      'No significance, prediction, timing, profitability or trading edge claim is made or implied.',
      'No new data was gathered, no Layer 1 logic changed, and the sealed prospective window was not read.'
    ],
    states: tone.consistency
  };
  if (options.out) fs.writeFileSync(options.out, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
  console.log(formatLines(tone, parameters).join('\n'));
  if (options.out) console.log(`\nReport written: ${options.out}`);
  return output;
}

if (require.main === module) run();
module.exports = { VERSION, parseArgs, share, describeState, buildToneReport, summarise, formatLines, run };



