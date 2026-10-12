#!/usr/bin/env node
"use strict";

/**
 * Produces the USD 24-hour research cards: per-family evidence, counterevidence, timing contrast,
 * data requirements and the measured results of that family's candidate rules.
 *
 * Usage:
 *   node backtester/scripts/build_usd_24h_research_cards.js [--dataset=PATH] [--registry=PATH] [--out=PATH] [--doc=PATH]
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { sha256 } = require("../lib/usd24h/acquire");
const { loadDataset } = require("../lib/usd24h/experiments");
const { FAMILIES, featurePairs, pearson, quarterSignStability, tercileHitRates } = require("../lib/usd24h/research_cards");
const { RULES } = require("../lib/usd24h/rules");
const { PERIOD_ORDER, rowsInPeriod } = require("../lib/usd24h/splits");

const DEFAULT_DATASET = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const DEFAULT_REGISTRY = path.resolve(__dirname, "../../data/usd-24h-experiment-registry.json");
const DEFAULT_OUT = path.resolve(__dirname, "../../data/usd-24h-research-cards.json");
const DEFAULT_DOC = path.resolve(__dirname, "../../docs/review/usd-24h-ruleset-v1/USD_24H_RESEARCH_CARDS.md");

const SIGNAL_FLOOR = 0.08;
const EXPLANATION_RATIO = 2;

/** Declared verdict rule, applied identically to every feature. */
function verdictFor(forwardByPeriod, trailing, stability) {
  const magnitudes = PERIOD_ORDER.map((period) => Math.abs(forwardByPeriod[period].r ?? 0));
  const signs = PERIOD_ORDER.map((period) => Math.sign(forwardByPeriod[period].r ?? 0));
  if (magnitudes.every((magnitude) => magnitude < SIGNAL_FLOOR)) {
    return "no_measurable_forward_signal";
  }
  const trailingMagnitude = Math.abs(trailing.r ?? 0);
  const forwardMagnitude = Math.max(...magnitudes);
  if (trailingMagnitude > EXPLANATION_RATIO * forwardMagnitude) {
    return "explains_the_closed_window_not_the_next_one";
  }
  if (signs[0] !== 0 && signs[1] !== 0 && signs[0] !== signs[1]) {
    return "forward_sign_unstable_between_periods";
  }
  if (stability.positive_quarters > 0 && stability.negative_quarters > 0 &&
      Math.min(stability.positive_quarters, stability.negative_quarters) >= 3) {
    return "forward_sign_unstable_across_quarters";
  }
  return "weak_forward_relation";
}

function measureFeature(rows, featureKey) {
  const forwardByPeriod = {};
  for (const period of PERIOD_ORDER) {
    forwardByPeriod[period] = pearson(featurePairs(rowsInPeriod(rows, period), featureKey).forward);
  }
  const trailing = pearson(featurePairs(rows, featureKey).trailing);
  const stability = quarterSignStability(rows, featureKey);
  const terciles = tercileHitRates(rows, featureKey);
  return {
    feature: featureKey,
    forward_r_by_period: forwardByPeriod,
    trailing_r: trailing,
    quarter_sign_stability: stability,
    tercile_up_shares: terciles,
    verdict: verdictFor(forwardByPeriod, trailing, stability)
  };
}

function ruleArmLookup(registry) {
  const byId = new Map(registry.results.map((result) => [result.config_id, result]));
  return (id) => {
    const result = byId.get(id);
    if (!result) return null;
    return {
      config_id: id,
      dev: result.metrics.dev.ex_flat_accuracy_pct,
      validation: result.metrics.validation.ex_flat_accuracy_pct,
      holdout: result.metrics.holdout.ex_flat_accuracy_pct,
      validation_coverage_pct: result.metrics.validation.directional_coverage_pct,
      holdout_decided: result.metrics.holdout.correct + result.metrics.holdout.wrong
    };
  };
}

function buildCards(dataset, registry) {
  const lookupArm = ruleArmLookup(registry);
  return FAMILIES.map((family) => {
    const rules = RULES.filter((rule) => rule.family === family.id);
    const measurements = family.features.map((feature) => ({ ...measureFeature(dataset.rows, feature.key), label: feature.label }));
    const ruleArms = rules
      .map((rule) => ({
        rule_id: rule.id,
        status: rule.status,
        arm: lookupArm(`single_${rule.id}`) || lookupArm(`single_${rule.id}_reversed`) || lookupArm(`single_${rule.id}_lag1`)
      }))
      .filter((entry) => entry.status !== "not_evaluable" || entry.arm);
    const verdicts = measurements.map((measurement) => measurement.verdict);
    const familyVerdict = family.rules_status === "declared but not evaluable"
      ? "not_evaluable_missing_source"
      : verdicts.includes("weak_forward_relation")
        ? "weak_forward_relation_only"
        : verdicts.some((verdict) => verdict.startsWith("forward_sign_unstable"))
          ? "contradictory_across_periods"
          : "no_measurable_forward_signal";
    return {
      family: family.id,
      label: family.label,
      verdict: familyVerdict,
      candidate_rules: rules.map((rule) => ({
        id: rule.id,
        feature: rule.feature,
        bullish: rule.bullish,
        bearish: rule.bearish,
        weight: rule.weight,
        condition: rule.condition,
        status: rule.status,
        rationale: rule.rationale
      })),
      rule_arms: ruleArms,
      measurements,
      data_requirements: family.data_requirements,
      missing_inputs: family.missing_inputs
    };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = args.dataset ? path.resolve(args.dataset) : DEFAULT_DATASET;
  const registryPath = args.registry ? path.resolve(args.registry) : DEFAULT_REGISTRY;
  const outPath = args.out ? path.resolve(args.out) : DEFAULT_OUT;
  const docPath = args.doc ? path.resolve(args.doc) : DEFAULT_DOC;

  const dataset = loadDataset(datasetPath);
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const cards = buildCards(dataset, registry);

  const payload = {
    schema_version: "usd-24h-research-cards-v1",
    generated_at: new Date().toISOString(),
    dataset_sha256: sha256(fs.readFileSync(datasetPath, "utf8")),
    registry_sha256: sha256(fs.readFileSync(registryPath, "utf8")),
    verdict_rule: {
      signal_floor_abs_r: SIGNAL_FLOOR,
      explanation_ratio: EXPLANATION_RATIO,
      statement: "A feature is prospective evidence only when its forward correlation clears the declared floor in some period and is not swamped by its correlation with the window that has just closed; a sign change between development and validation, or sign flips in several quarters, is recorded as contradictory rather than as support."
    },
    cards
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, renderMarkdown(payload), "utf8");

  for (const card of cards) {
    process.stdout.write(`${card.family.padEnd(22)} ${card.verdict}\n`);
  }
  process.stdout.write(`cards: ${outPath}\ndoc: ${docPath}\n`);
}

main();

function renderMarkdown(payload) {
  const lines = [];
  lines.push("# USD 24-hour research cards");
  lines.push("");
  lines.push(`Generated ${payload.generated_at} from dataset \`${payload.dataset_sha256.slice(0, 16)}\` and experiment registry \`${payload.registry_sha256.slice(0, 16)}\`.`);
  lines.push("");
  lines.push("Every number below is measured on `data/usd-24h-research-dataset.json`, built from as-of observations at a declared 09:30 ET cutoff. `forward r` correlates an input with the return of the next window; `trailing r` correlates the same input with the window that has just closed. An input that only tracks its own window has explained the past, not predicted the future.");
  lines.push("");
  lines.push("## Verdict rule");
  lines.push("");
  lines.push(`- Signal floor: absolute forward correlation of ${payload.verdict_rule.signal_floor_abs_r} in at least one period.`);
  lines.push(`- Explanation ratio: a trailing correlation more than ${payload.verdict_rule.explanation_ratio} times the forward correlation marks the input as explanatory.`);
  lines.push("- A sign change between development and validation, or sign flips in several quarters, is recorded as contradictory.");
  lines.push("");
  for (const card of payload.cards) {
    lines.push(`## ${card.label} (\`${card.family}\`)`);
    lines.push("");
    lines.push(`Verdict: **${card.verdict}**`);
    lines.push("");
    if (card.candidate_rules.length) {
      lines.push("### Candidate rules (maximum four per family)");
      lines.push("");
      lines.push("| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |");
      lines.push("| --- | --- | --- | --- | --- | --- |");
      for (const rule of card.candidate_rules) {
        lines.push(`| \`${rule.id}\` | ${rule.feature} | ${rule.bullish.comparator} ${rule.bullish.threshold} | ${rule.bearish.comparator} ${rule.bearish.threshold} | ${rule.weight} | ${rule.status} |`);
      }
      lines.push("");
      lines.push("Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:");
      lines.push("");
      lines.push("| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |");
      lines.push("| --- | --- | --- | --- | --- | --- |");
      for (const arm of card.rule_arms) {
        const metrics = arm.arm || {};
        lines.push(`| \`${arm.rule_id}\` | ${metrics.dev ?? "-"} | ${metrics.validation ?? "-"} | ${metrics.validation_coverage_pct ?? "-"} | ${metrics.holdout ?? "-"} | ${metrics.holdout_decided ?? "-"} |`);
      }
      lines.push("");
    }
    if (card.measurements.length) {
      lines.push("### Evidence and counterevidence");
      lines.push("");
      lines.push("| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |");
      lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
      for (const measurement of card.measurements) {
        const shown = ["dev", "validation", "holdout"].map((period) => {
          const entry = measurement.forward_r_by_period[period];
          return `${entry.r ?? "-"} (${entry.n})`;
        });
        const stability = measurement.quarter_sign_stability;
        const terciles = measurement.tercile_up_shares;
        lines.push(`| ${measurement.label} | ${shown[0]} | ${shown[1]} | ${shown[2]} | ${measurement.trailing_r.r ?? "-"} (${measurement.trailing_r.n}) | ${terciles ? `${terciles.bottom_tercile_up_share_pct}% (n=${terciles.bottom_tercile_n})` : "-"} | ${terciles ? `${terciles.top_tercile_up_share_pct}% (n=${terciles.top_tercile_n})` : "-"} | ${stability.positive_quarters}/${stability.quarters} | ${measurement.verdict} |`);
      }
      lines.push("");
    }
    lines.push("### Historical data requirements");
    lines.push("");
    for (const requirement of card.data_requirements) lines.push(`- ${requirement}`);
    lines.push("");
    lines.push("### Unavailable or proxy inputs");
    lines.push("");
    for (const missing of card.missing_inputs) lines.push(`- ${missing}`);
    lines.push("");
  }
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Correlations and hit shares are descriptive measurements on one dataset, not significance claims.");
  lines.push("- The dataset uses latest-published values, so every relation above is a declared reconstruction, not a vintage replay.");
  lines.push("- No result here establishes a trading edge: spreads, costs, fills and complete paths are out of scope.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}
