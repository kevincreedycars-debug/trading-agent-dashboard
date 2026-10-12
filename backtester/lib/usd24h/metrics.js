"use strict";

/**
 * Scoring for one arm over one chronological period.
 *
 * Denominators follow the delivery contract: correct, wrong, flat, no-call and not-evaluable are all
 * disclosed, ex-flat directional accuracy and accuracy over every directional call are both shown,
 * and a Wilson interval is attached so a point estimate is never reported without its uncertainty.
 */

const Z_95 = 1.959963984540054;

function wilsonInterval(successes, total, z = Z_95) {
  if (!total) return { low: null, high: null, point: null };
  const phat = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = (phat + (z * z) / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / total + (z * z) / (4 * total * total))) / denominator;
  return {
    point: Number((phat * 100).toFixed(2)),
    low: Number((Math.max(0, centre - margin) * 100).toFixed(2)),
    high: Number((Math.min(1, centre + margin) * 100).toFixed(2))
  };
}

function quarterKey(dateLiteral) {
  const [year, month] = dateLiteral.split("-").map(Number);
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

/**
 * Scores an arm whose calls are keyed by snapshot date.
 * Each call is `{ direction, coverage_pct, net_edge_pct, conviction }`; a missing entry is a no-call.
 */
function scoreArm(rows, calls) {
  const counts = {
    scheduled: 0,
    directional_calls: 0,
    bullish_calls: 0,
    bearish_calls: 0,
    no_clear_bias: 0,
    correct: 0,
    wrong: 0,
    flat: 0,
    not_evaluable: 0
  };
  const perQuarter = new Map();
  const perSide = { BULLISH: { calls: 0, correct: 0 }, BEARISH: { calls: 0, correct: 0 } };
  let absoluteMoveSum = 0;
  let absoluteMoveCount = 0;

  for (const row of rows) {
    counts.scheduled += 1;
    const call = calls.get(row.snapshot_date) || { direction: null };
    const direction = call.direction || null;

    if (!row.outcome.evaluable) {
      counts.not_evaluable += 1;
      continue;
    }
    if (!direction || (direction !== "BULLISH" && direction !== "BEARISH")) {
      counts.no_clear_bias += 1;
      continue;
    }

    counts.directional_calls += 1;
    if (direction === "BULLISH") counts.bullish_calls += 1;
    if (direction === "BEARISH") counts.bearish_calls += 1;
    if (!perSide[direction]) perSide[direction] = { calls: 0, correct: 0 };
    perSide[direction].calls += 1;

    const market = row.outcome.market_outcome_direction;
    let result;
    if (market === "FLAT") {
      counts.flat += 1;
      result = "FLAT";
    } else if (market === direction) {
      counts.correct += 1;
      perSide[direction].correct += 1;
      result = "CORRECT";
    } else {
      counts.wrong += 1;
      result = "WRONG";
    }

    if (!perQuarter.has(quarterKey(row.snapshot_date))) perQuarter.set(quarterKey(row.snapshot_date), []);
    perQuarter.get(quarterKey(row.snapshot_date)).push(result);
    absoluteMoveSum += Math.abs(row.outcome.pct_change);
    absoluteMoveCount += 1;
  }

  const decided = counts.correct + counts.wrong;
  const interval = wilsonInterval(counts.correct, decided);
  const quarters = Array.from(perQuarter.entries())
    .map(([quarter, results]) => {
      const quarterDecided = results.filter((result) => result !== "FLAT").length;
      const quarterCorrect = results.filter((result) => result === "CORRECT").length;
      return {
        quarter,
        directional_calls: results.length,
        decided: quarterDecided,
        ex_flat_accuracy_pct: quarterDecided ? Number(((quarterCorrect / quarterDecided) * 100).toFixed(2)) : null
      };
    })
    .sort((left, right) => (left.quarter < right.quarter ? -1 : 1));
  const stableQuarters = quarters.filter((quarter) => quarter.decided >= 15);

  return {
    scheduled: counts.scheduled,
    directional_calls: counts.directional_calls,
    directional_coverage_pct: counts.scheduled ? Number(((counts.directional_calls / counts.scheduled) * 100).toFixed(2)) : null,
    bullish_calls: counts.bullish_calls,
    bearish_calls: counts.bearish_calls,
    no_clear_bias: counts.no_clear_bias,
    correct: counts.correct,
    wrong: counts.wrong,
    flat: counts.flat,
    not_evaluable: counts.not_evaluable,
    ex_flat_accuracy_pct: interval.point,
    ex_flat_accuracy_ci_95: { low: interval.low, high: interval.high },
    accuracy_all_directional_calls_pct: counts.directional_calls
      ? Number(((counts.correct / counts.directional_calls) * 100).toFixed(2))
      : null,
    bullish_accuracy_pct: perSide.BULLISH.calls
      ? Number(((perSide.BULLISH.correct / perSide.BULLISH.calls) * 100).toFixed(2))
      : null,
    bearish_accuracy_pct: perSide.BEARISH.calls
      ? Number(((perSide.BEARISH.correct / perSide.BEARISH.calls) * 100).toFixed(2))
      : null,
    mean_absolute_realised_move_pct: absoluteMoveCount ? Number((absoluteMoveSum / absoluteMoveCount).toFixed(4)) : null,
    quarters,
    stable_quarter_count: stableQuarters.length,
    min_stable_quarter_accuracy_pct: stableQuarters.length
      ? Math.min(...stableQuarters.map((quarter) => quarter.ex_flat_accuracy_pct))
      : null
  };
}

/** Brier score, log loss and reliability bins for a probability arm; the probability is P(USD up). */
function scoreProbabilityArm(rows, probabilities) {
  let brierSum = 0;
  let logLossSum = 0;
  let count = 0;
  const bins = Array.from({ length: 10 }, () => ({ n: 0, forecastSum: 0, upSum: 0 }));
  for (const row of rows) {
    const probability = probabilities.get(row.snapshot_date);
    if (probability === null || probability === undefined || !row.outcome.evaluable) continue;
    if (row.outcome.market_outcome_direction === "FLAT") continue;
    const outcome = row.outcome.market_outcome_direction === "BULLISH" ? 1 : 0;
    const clamped = Math.min(1 - 1e-6, Math.max(1e-6, probability));
    brierSum += (clamped - outcome) ** 2;
    logLossSum += -(outcome * Math.log(clamped) + (1 - outcome) * Math.log(1 - clamped));
    const binIndex = Math.min(9, Math.floor(clamped * 10));
    bins[binIndex].n += 1;
    bins[binIndex].forecastSum += clamped;
    bins[binIndex].upSum += outcome;
    count += 1;
  }
  return {
    evaluated: count,
    brier_score: count ? Number((brierSum / count).toFixed(4)) : null,
    log_loss: count ? Number((logLossSum / count).toFixed(4)) : null,
    reliability_bins: bins
      .map((bin, index) => ({
        bin: `${index * 10}-${index * 10 + 10}`,
        n: bin.n,
        mean_forecast: bin.n ? Number((bin.forecastSum / bin.n).toFixed(4)) : null,
        observed_up_share: bin.n ? Number((bin.upSum / bin.n).toFixed(4)) : null
      }))
      .filter((bin) => bin.n > 0)
  };
}

module.exports = {
  Z_95,
  quarterKey,
  scoreArm,
  scoreProbabilityArm,
  wilsonInterval
};
