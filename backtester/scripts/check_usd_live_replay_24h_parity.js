#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildReplayOutput, parseLogicVersion } = require("../replay/usd/usd_replay_core");

const fixturePath = path.resolve(__dirname, "../fixtures/usd_live_replay_24h_parity_fixture.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function pushMismatch(list, field, expected, actual) {
  if (stableStringify(expected) !== stableStringify(actual)) {
    list.push({ field, expected, actual });
  }
}

function replay24hSummary(output) {
  const tf = output.timeframe_models?.following_24hrs || {};
  const factorBreakdown = tf.factor_breakdown || {};
  const convictionModel = tf.conviction_model || {};
  return {
    direction_24h: output.direction_24h,
    conviction_24h: output.conviction_24h,
    strength_bucket: convictionModel.confidence_strength ?? null,
    bull_case_pct: convictionModel.bullish_argument_pct ?? null,
    bear_case_pct: convictionModel.bearish_argument_pct ?? null,
    net_edge_pct: convictionModel.net_edge_pct ?? null,
    participation_pct: convictionModel.directional_participation_pct ?? convictionModel.active_participation_pct ?? null,
    score_bullish: output.weighted_score?.bullish_count ?? null,
    score_bearish: output.weighted_score?.bearish_count ?? null,
    score_neutral: output.weighted_score?.neutral_count ?? null,
    weighted_score: {
      bullish_weight: output.weighted_score?.bullish_weight ?? null,
      bearish_weight: output.weighted_score?.bearish_weight ?? null,
      neutral_weight: output.weighted_score?.neutral_weight ?? null,
      active_weight: output.weighted_score?.active_weight ?? null,
      weight_margin: output.weighted_score?.weight_margin ?? null
    },
    factor_breakdown: Object.fromEntries(
      Object.entries(factorBreakdown).map(([key, value]) => [key, {
        signal: value?.signal ?? null,
        weight: value?.weight ?? null
      }])
    ),
    conviction_model: {
      bullish_argument_pct: convictionModel.bullish_argument_pct ?? null,
      bearish_argument_pct: convictionModel.bearish_argument_pct ?? null,
      neutral_pct: 100 - (output.weighted_score?.active_weight ?? 0),
      active_participation_pct: convictionModel.active_participation_pct ?? convictionModel.directional_participation_pct ?? null,
      net_edge_pct: convictionModel.net_edge_pct ?? null,
      final_conviction: convictionModel.final_confidence ?? output.conviction_24h ?? null,
      verdict_strength: convictionModel.confidence_strength ?? null
    },
    missing_inputs: Array.isArray(output.missing_inputs) ? output.missing_inputs : [],
    warnings_affecting_confidence: Array.isArray(output.risk_flags) ? output.risk_flags : []
  };
}

function main() {
  const logicDocumentVersion = parseLogicVersion();
  const replayOutput = buildReplayOutput(fixture.snapshot, logicDocumentVersion);
  const actual = replay24hSummary(replayOutput);
  const expected = fixture.expected_live_24h;
  const mismatches = [];

  pushMismatch(mismatches, "direction_24h", expected.direction_24h, actual.direction_24h);
  pushMismatch(mismatches, "conviction_24h", expected.conviction_24h, actual.conviction_24h);
  pushMismatch(mismatches, "strength_bucket", expected.strength_bucket, actual.strength_bucket);
  pushMismatch(mismatches, "bull_case_pct", expected.bull_case_pct, actual.bull_case_pct);
  pushMismatch(mismatches, "bear_case_pct", expected.bear_case_pct, actual.bear_case_pct);
  pushMismatch(mismatches, "net_edge_pct", expected.net_edge_pct, actual.net_edge_pct);
  pushMismatch(mismatches, "participation_pct", expected.participation_pct, actual.participation_pct);
  pushMismatch(mismatches, "score_bullish", expected.score_bullish, actual.score_bullish);
  pushMismatch(mismatches, "score_bearish", expected.score_bearish, actual.score_bearish);
  pushMismatch(mismatches, "score_neutral", expected.score_neutral, actual.score_neutral);
  pushMismatch(mismatches, "weighted_score", expected.weighted_score, actual.weighted_score);
  pushMismatch(mismatches, "factor_breakdown", expected.factor_breakdown, actual.factor_breakdown);
  pushMismatch(mismatches, "conviction_model", expected.conviction_model, actual.conviction_model);
  pushMismatch(mismatches, "missing_inputs", expected.missing_inputs, actual.missing_inputs);
  pushMismatch(mismatches, "warnings_affecting_confidence", expected.warnings_affecting_confidence, actual.warnings_affecting_confidence);

  console.log(`Fixture: ${fixturePath}`);
  console.log(`Live source of truth: ${fixture.meta.live_source_of_truth}`);
  console.log(`Replay source under test: ${fixture.meta.replay_source_under_test}`);
  console.log(`Snapshot date: ${fixture.snapshot.snapshot_date}`);
  console.log(`Parity result: ${mismatches.length ? "FAIL" : "PASS"}`);

  if (mismatches.length) {
    console.log("");
    console.log("Mismatches:");
    for (const mismatch of mismatches) {
      console.log(`- ${mismatch.field}`);
      console.log(`  expected: ${stableStringify(mismatch.expected)}`);
      console.log(`  actual:   ${stableStringify(mismatch.actual)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("Replay output matches frozen live USD 24H output for this snapshot.");
}

main();
