"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const INPUT_PATH = path.join(REPO_ROOT, "data/l2l-session-close-eur-h1-ta-v1.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "data/eur-h1-ta-directional-baseline-v1.json");
const VERSION = "eur-h1-ta-directional-baseline-v1";
const FOLDS = Object.freeze([
  { key: "TRAIN", start: "2024-01-01", end: "2024-12-31" },
  { key: "VALIDATION", start: "2025-01-01", end: "2025-09-30" },
  { key: "FINAL_TEST", start: "2025-10-01", end: "2026-04-30" }
]);

function sigmoid(value) {
  return value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
}

function featureNames(records) {
  return records[0]?.features.map((feature) => feature.name) || [];
}

function foldForDate(date) {
  return FOLDS.find((fold) => date >= fold.start && date <= fold.end)?.key || null;
}

function vectorFor(record, names) {
  const values = new Map(record.features.map((feature) => [feature.name, feature.value]));
  return names.map((name) => values.get(name));
}

function fitStandardizer(records, names) {
  const vectors = records.map((record) => vectorFor(record, names));
  const means = names.map((_, index) => vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length);
  const scales = names.map((_, index) => {
    const variance = vectors.reduce((sum, vector) => sum + (vector[index] - means[index]) ** 2, 0) / vectors.length;
    return Math.sqrt(variance) || 1;
  });
  return { means, scales };
}

function standardize(vector, standardizer) {
  return vector.map((value, index) => (value - standardizer.means[index]) / standardizer.scales[index]);
}

function label(record) {
  return record.label === "BULLISH" ? 1 : 0;
}

function fitLogisticRegression(records, names, options = {}) {
  const iterations = options.iterations || 1600;
  const learningRate = options.learningRate || 0.08;
  const l2 = options.l2 || 0.03;
  const standardizer = fitStandardizer(records, names);
  const rows = records.map((record) => ({ x: standardize(vectorFor(record, names), standardizer), y: label(record) }));
  const weights = new Array(names.length + 1).fill(0);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = new Array(weights.length).fill(0);
    for (const row of rows) {
      const probability = sigmoid(weights[0] + row.x.reduce((sum, value, index) => sum + value * weights[index + 1], 0));
      const error = probability - row.y;
      gradient[0] += error;
      row.x.forEach((value, index) => { gradient[index + 1] += error * value; });
    }
    weights.forEach((weight, index) => {
      const regularization = index === 0 ? 0 : l2 * weight;
      weights[index] -= learningRate * ((gradient[index] / rows.length) + regularization);
    });
  }
  return { weights, standardizer, names, trainingOptions: { iterations, learningRate, l2 } };
}

function predictProbability(model, record) {
  const vector = standardize(vectorFor(record, model.names), model.standardizer);
  return sigmoid(model.weights[0] + vector.reduce((sum, value, index) => sum + value * model.weights[index + 1], 0));
}

function summarizePredictions(model, records) {
  const nonFlat = records.filter((record) => record.label === "BULLISH" || record.label === "BEARISH");
  const predictions = nonFlat.map((record) => {
    const bullishProbability = predictProbability(model, record);
    const prediction = bullishProbability >= 0.5 ? "BULLISH" : "BEARISH";
    return { record, bullishProbability, prediction, correct: prediction === record.label };
  });
  const bullishActual = nonFlat.filter((record) => record.label === "BULLISH").length;
  const alwaysBullishCorrect = bullishActual;
  const correct = predictions.filter((item) => item.correct).length;
  return {
    count: nonFlat.length,
    correctCount: correct,
    accuracyPct: nonFlat.length ? Number(((correct / nonFlat.length) * 100).toFixed(2)) : null,
    alwaysBullishBaselinePct: nonFlat.length ? Number(((alwaysBullishCorrect / nonFlat.length) * 100).toFixed(2)) : null,
    deltaVsAlwaysBullishPct: nonFlat.length ? Number((((correct - alwaysBullishCorrect) / nonFlat.length) * 100).toFixed(2)) : null,
    predictions: predictions.map((item) => ({
      recordId: item.record.recordId,
      sessionDate: item.record.sessionDate,
      actual: item.record.label,
      prediction: item.prediction,
      bullishProbability: Number(item.bullishProbability.toFixed(6)),
      correct: item.correct
    }))
  };
}

function buildBaselineStudy(input = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"))) {
  const records = input.included.filter((record) => record.label === "BULLISH" || record.label === "BEARISH");
  const names = featureNames(records);
  const recordsByFold = Object.fromEntries(FOLDS.map((fold) => [fold.key, records.filter((record) => foldForDate(record.sessionDate) === fold.key)]));
  const model = fitLogisticRegression(recordsByFold.TRAIN, names);
  const validation = summarizePredictions(model, recordsByFold.VALIDATION);
  const finalTest = summarizePredictions(model, recordsByFold.FINAL_TEST);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      version: VERSION,
      researchOnly: true,
      dashboardModelUpdated: false,
      modelStatus: "FIXED_BASELINE_NOT_PRODUCTION_READY",
      modelDescription: "Fixed L2-regularised logistic regression on completed EUR/USD H1 technical features. No post-final-test tuning is permitted."
    },
    contract: { inputDatasetVersion: input.meta.version, inputPilotVersion: input.meta.pilotVersion, folds: FOLDS },
    featureNames: names,
    training: { recordCount: recordsByFold.TRAIN.length, model },
    validation: summarizePredictions(model, recordsByFold.VALIDATION),
    finalTest,
    conclusion: {
      passesValidationBaseline: validation.deltaVsAlwaysBullishPct > 0,
      passesFinalTestBaseline: finalTest.deltaVsAlwaysBullishPct > 0,
      readyForDashboard: false
    }
  };
}

module.exports = {
  FOLDS,
  INPUT_PATH,
  OUTPUT_PATH,
  VERSION,
  buildBaselineStudy,
  fitLogisticRegression,
  predictProbability,
  summarizePredictions
};
