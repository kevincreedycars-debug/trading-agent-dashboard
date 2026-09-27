const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, share, describeState, buildToneReport, summarise, formatLines } = require("../scripts/report_gold_factor_tone");

const PARAMETERS = {
  cohort: "daily_snapshot_anchors",
  group: "all_computed",
  primary_horizon: "h24_post_event",
  week_horizon: "d5_trading_days_post_event",
  horizons: ["h24_post_event", "d5_trading_days_post_event"],
  min_n: 100,
  min_year_n: 20,
  excess_pp: 5,
  threshold_pct: 60
};

function state(name, n, positive, negative, years) {
  return {
    state: name,
    n,
    direction: { positive, negative, exact_zero: n - positive - negative },
    magnitude_pct: { n, median: 0.1 },
    year_breakdown: years,
    small_sample: n < 20
  };
}

function reportFixture() {
  const year = (value, n, positive) => ({ year: value, n, direction: { positive, negative: n - positive, exact_zero: 0 } });
  return {
    minimum_observations: 20,
    baselines: {
      daily_snapshot_anchors: {
        h24_post_event: { groups: { all_computed: { n: 500, direction: { positive: 280, negative: 220, exact_zero: 0 }, year_breakdown: [year(2024, 250, 140), year(2025, 250, 140)] } } },
        d5_trading_days_post_event: { groups: { all_computed: { n: 500, direction: { positive: 300, negative: 200, exact_zero: 0 }, year_breakdown: [year(2024, 250, 150), year(2025, 250, 150)] } } }
      }
    },
    variables: [{
      id: "us_10y_real_yield",
      cohorts: {
        daily_snapshot_anchors: {
          status: "measured",
          horizons: {
            h24_post_event: {
              groups: {
                all_computed: {
                  states: [
                    state("above_own_median", 200, 130, 70, [year(2024, 100, 65), year(2025, 100, 65)]),
                    state("at_or_below_own_median", 300, 150, 150, [year(2024, 150, 70), year(2025, 150, 90)])
                  ]
                }
              }
            },
            d5_trading_days_post_event: {
              groups: {
                all_computed: {
                  states: [
                    state("above_own_median", 200, 150, 50, [year(2024, 100, 75), year(2025, 100, 75)]),
                    state("at_or_below_own_median", 300, 150, 150, [year(2024, 150, 75), year(2025, 150, 75)])
                  ]
                }
              }
            }
          }
        }
      }
    }]
  };
}

test("args and shares are parsed without guessing", () => {
  const options = parseArgs(["--report", "a.json", "--min-n=100", "--excess", "5"]);
  assert.deepEqual(options, { report: "a.json", "min-n": "100", excess: "5" });
  assert.equal(share(1, 3), 33.33);
  assert.equal(share(1, 0), null);
  assert.throws(() => parseArgs(["nope"]), /Unknown argument/);
});

test("state rows carry the baseline excess and its year stability", () => {
  const report = reportFixture();
  const tone = buildToneReport(report, PARAMETERS);
  assert.equal(tone.baselines.h24_post_event.positive_rate_pct, 56);
  assert.equal(tone.baselines.d5_trading_days_post_event.positive_rate_pct, 60);
  const aboveSession = tone.rows.find(row => row.horizon === "h24_post_event" && row.state === "above_own_median");
  assert.equal(aboveSession.positive_rate_pct, 65);
  assert.equal(aboveSession.excess_pp, 9);
  assert.equal(aboveSession.baseline_positive_rate_pct, 56);
  assert.equal(aboveSession.years_excess_same_sign, true);
  const belowSession = tone.rows.find(row => row.horizon === "h24_post_event" && row.state === "at_or_below_own_median");
  assert.equal(belowSession.excess_pp, -6);
  assert.equal(belowSession.years_excess_same_sign, false);
});

test("summaries separate the rate threshold from the baseline excess", () => {
  const tone = buildToneReport(reportFixture(), PARAMETERS);
  const summary = summarise(tone, PARAMETERS);
  assert.equal(summary.states_daily_cohort, 2);
  assert.equal(summary.states_clearing_majority_threshold_session, 1);
  assert.equal(summary.states_above_baseline_session, 2);
  assert.equal(summary.states_above_baseline_week, 2);
  assert.equal(summary.states_above_baseline_both, 2);
  assert.equal(summary.states_excess_sign_stable_across_years_session, 1);
  const lines = formatLines(tone, PARAMETERS);
  assert.equal(lines[0].includes("gold-factor-tone-v1"), true);
  assert.equal(lines.some(line => line.includes("us_10y_real_yield")), true);
  assert.equal(lines.some(line => line.includes("+9pp")), true);
});
