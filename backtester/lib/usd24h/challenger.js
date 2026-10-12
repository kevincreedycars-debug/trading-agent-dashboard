"use strict";

/**
 * A small, dependency-free L2-regularised logistic regression used as the statistical challenger.
 *
 * It is deliberately plain: features are standardised with training-period statistics, fitted by
 * full-batch gradient descent from a zero start, and every hyperparameter is declared in the
 * registry. Rows whose outcome is flat are excluded from fitting, because the classification target
 * is the direction of a decided move and a flat window has no direction.
 */

const DEFAULT_HYPERPARAMETERS = Object.freeze({
  lambda: 0.1,
  learning_rate: 0.05,
  iterations: 1500
});

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stdev(values, average) {
  if (values.length < 2) return 1;
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  const sd = Math.sqrt(variance);
  return sd === 0 ? 1 : sd;
}

function sigmoid(value) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

/** Fits the model on the supplied rows. Rows missing any feature are skipped. */
function fitLogistic(rows, featureNames, hyperparameters = {}) {
  const merged = { ...DEFAULT_HYPERPARAMETERS };
  for (const [key, value] of Object.entries(hyperparameters)) {
    if (value !== undefined && value !== null) merged[key] = value;
  }
  const { lambda, learning_rate: learningRate, iterations } = merged;
  const usable = rows.filter((row) =>
    row.outcome.evaluable &&
    row.outcome.market_outcome_direction !== "FLAT" &&
    featureNames.every((name) => Number.isFinite(row.features[name])));

  const columns = featureNames.map((name) => usable.map((row) => row.features[name]));
  const means = columns.map((values) => mean(values));
  const sds = columns.map((values, index) => stdev(values, means[index]));
  const X = usable.map((row) => featureNames.map((name, index) => (row.features[name] - means[index]) / sds[index]));
  const y = usable.map((row) => (row.outcome.market_outcome_direction === "BULLISH" ? 1 : 0));

  let weights = featureNames.map(() => 0);
  let intercept = 0;
  const n = Math.max(1, X.length);

  for (let step = 0; step < iterations; step += 1) {
    const gradient = weights.map(() => 0);
    let interceptGradient = 0;
    for (let index = 0; index < X.length; index += 1) {
      const linear = X[index].reduce((total, value, column) => total + value * weights[column], intercept);
      const error = sigmoid(linear) - y[index];
      interceptGradient += error;
      for (let column = 0; column < weights.length; column += 1) {
        gradient[column] += error * X[index][column];
      }
    }
    intercept -= (learningRate * interceptGradient) / n;
    weights = weights.map((weight, column) => weight - learningRate * (gradient[column] / n + lambda * weight));
  }

  return {
    feature_names: featureNames.slice(),
    means,
    standard_deviations: sds,
    weights,
    intercept,
    hyperparameters: { lambda, learning_rate: learningRate, iterations, target: "P(next-window outcome is BULLISH), flat rows excluded" },
    fitted_rows: usable.length,
    excluded_flat_rows: rows.filter((row) => row.outcome.evaluable && row.outcome.market_outcome_direction === "FLAT").length
  };
}

/** P(up) for one feature object; null when a required feature is missing. */
function predictLogistic(model, features) {
  const values = model.feature_names.map((name) => features[name]);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const standardised = values.map((value, index) => (value - model.means[index]) / model.standard_deviations[index]);
  const linear = standardised.reduce((total, value, index) => total + value * model.weights[index], model.intercept);
  return sigmoid(linear);
}

/** Direction and margin from a probability, using a declared decision threshold. */
function directionFromProbability(probability, threshold = 0.5) {
  if (probability === null || probability === undefined) return { direction: "NO_CLEAR_BIAS", reason: "missing_probability" };
  if (probability >= threshold) return { direction: "BULLISH", reason: "probability_above_threshold" };
  return { direction: "BEARISH", reason: "probability_below_threshold" };
}

module.exports = {
  DEFAULT_HYPERPARAMETERS,
  directionFromProbability,
  fitLogistic,
  predictLogistic,
  sigmoid
};
