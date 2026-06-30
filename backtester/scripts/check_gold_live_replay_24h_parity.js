#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { computeHeadlineConfidenceFromRow } = require("../lib/headline_confidence");
const { buildReplayOutput, parseLogicVersion } = require("../replay/gold/gold_replay_core");

const fixturePath = path.resolve(__dirname, "../fixtures/gold_live_replay_24h_parity_fixture.json");
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
  const tf = output.timeframe_models?.["24h"] || {};
  const factorBreakdown = tf.factor_breakdown || {};
  const convictionModel = tf.conviction_model || {};
  return {
    direction_24h: output.direction_24h,
    conviction_24h: output.conviction_24h,
    headline_confidence_pct: computeHeadlineConfidenceFromRow({
      predicted_direction: output.direction_24h,
      bull_case_pct: convictionModel.bullish_argument_pct ?? convictionModel.bull_case ?? null,
      bear_case_pct: convictionModel.bearish_argument_pct ?? convictionModel.bear_case ?? null,
      participation_pct: convictionModel.directional_participation_pct ?? convictionModel.active_participation_pct ?? convictionModel.participation ?? null,
      net_edge_pct: convictionModel.net_edge_pct ?? convictionModel.net_edge ?? null,
      conviction_model: convictionModel
    }).value,
    strength_bucket: convictionModel.verdict_strength ?? null,
    bull_case_pct: convictionModel.bullish_argument_pct ?? convictionModel.bull_case ?? null,
    bear_case_pct: convictionModel.bearish_argument_pct ?? convictionModel.bear_case ?? null,
    net_edge_pct: convictionModel.net_edge_pct ?? convictionModel.net_edge ?? null,
    participation_pct: convictionModel.directional_participation_pct ?? convictionModel.active_participation_pct ?? convictionModel.participation ?? null,
    score_bullish: output.score_bullish ?? null,
    score_bearish: output.score_bearish ?? null,
    score_neutral: output.score_neutral ?? null,
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
        weight: value?.weight ?? null,
        evidence: value?.evidence ?? null,
        reason: value?.reason ?? null
      }])
    ),
    conviction_model: {
      bullish_argument_pct: convictionModel.bullish_argument_pct ?? convictionModel.bull_case ?? null,
      bearish_argument_pct: convictionModel.bearish_argument_pct ?? convictionModel.bear_case ?? null,
      neutral_pct: convictionModel.neutral_pct ?? convictionModel.neutral_evidence_pct ?? null,
      active_participation_pct: convictionModel.active_participation_pct ?? convictionModel.directional_participation_pct ?? convictionModel.participation ?? null,
      net_edge_pct: convictionModel.net_edge_pct ?? convictionModel.net_edge ?? null,
      final_conviction: convictionModel.final_conviction ?? output.conviction_24h ?? null,
      verdict_strength: convictionModel.verdict_strength ?? null
    },
    warnings: Array.isArray(output.warnings) ? output.warnings : []
  };
}

function main() {
  const replayOutput = buildReplayOutput(fixture.snapshot, parseLogicVersion());
  const actual = replay24hSummary(replayOutput);
  const expected = fixture.expected_live_24h;
  const mismatches = [];

  pushMismatch(mismatches, "direction_24h", expected.direction_24h, actual.direction_24h);
  pushMismatch(mismatches, "conviction_24h", expected.conviction_24h, actual.conviction_24h);
  pushMismatch(mismatches, "headline_confidence_pct", expected.headline_confidence_pct, actual.headline_confidence_pct);
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
  pushMismatch(mismatches, "warnings", expected.warnings, actual.warnings);

  console.log(`Fixture: ${fixturePath}`);
  console.log(`Live factor intent source: ${fixture.meta.live_factor_intent_source}`);
  console.log(`Live parity target: ${fixture.meta.live_24h_parity_target}`);
  console.log(`Replay source under test: ${fixture.meta.replay_source_under_test}`);
  console.log(`Snapshot date: ${fixture.snapshot.snapshot_date}`);
  console.log(`Primary parity result: ${mismatches.length ? "FAIL" : "PASS"}`);

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
  console.log("Replay output matches the frozen live GOLD 24H output for the primary snapshot.");
}

main();
