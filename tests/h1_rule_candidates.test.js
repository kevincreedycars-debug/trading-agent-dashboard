"use strict";

/**
 * The three H1 rule candidates are published as data. These tests hold them to the measured state of the
 * committed evidence: if a bundle is imported or a clock assumption moves, the published counts must move
 * with it, and the candidates must still refuse to change what the coverage gate scores.
 */

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { VERSION, buildRuleCandidates } = require("../lib/layer1_backtesting/h1_rule_candidates");
const { loadEvidence } = require("../lib/layer1_backtesting/h1_evidence");
const { INPUT_ORDER, CONTRACTS } = require("../lib/layer1_backtesting/h1_coverage");
const { readRun } = require("../lib/layer1_backtesting/h1_population");

const ROOT = path.resolve(__dirname, "..");
const SCREEN = path.join(ROOT, "data", "usd-layer1-backtester", "backtesting-screen-v1.json");

function build() {
  const run = readRun({ root: ROOT });
  const bundles = loadEvidence({ root: ROOT, keys: INPUT_ORDER, contracts: CONTRACTS });
  return buildRuleCandidates({ run, bundles, contracts: CONTRACTS });
}

const published = build();

test("the candidates are versioned proposals that the coverage gate does not read", () => {
  assert.equal(VERSION, "h1-rule-candidates-v1");
  assert.equal(published.version, VERSION);
  assert.equal(published.status, "proposed");
  assert.equal(published.applied, false);
  assert.match(published.note, /keeps the supplied rules/);
  assert.deepEqual(
    published.candidates.map((candidate) => candidate.id),
    ["H1-C01", "H1-C02", "H1-C03"]
  );
  for (const candidate of published.candidates) {
    assert.equal(candidate.status, "proposed");
    assert.ok(candidate.disproof.length > 40, `${candidate.id} must name what would void it`);
    assert.ok(candidate.does_not_license.length > 40, `${candidate.id} must name what it does not license`);
    assert.ok(candidate.evidence.length >= 2, `${candidate.id} must cite its evidence`);
  }
});

test("H1-C01 measures the freshness rule on the publication clock at the supplied window", () => {
  const candidate = published.candidates.find((item) => item.id === "H1-C01");
  const effect = candidate.effect;
  assert.equal(effect.measurable, true);
  assert.equal(effect.sessions, 725);
  assert.equal(effect.window_hours, CONTRACTS.broad.hours);
  assert.equal(effect.supplied_fresh, 564);
  assert.equal(effect.supplied_blocked, 161);
  // The same window, measured from the release instead of the observation, blocks nothing extra.
  assert.equal(effect.proposed_fresh, 725);
  assert.equal(effect.proposed_blocked, 0);
  assert.equal(effect.gained, 161);
  assert.equal(effect.lost, 0);
  assert.deepEqual(effect.gained_by_weekday, { Monday: 145, Tuesday: 16 });
  assert.equal(effect.observation_age_hours.max, 249);
  assert.equal(effect.observation_age_hours.over_window, 161);
  assert.equal(effect.publication_age_hours.max, 175.75);
  assert.equal(effect.publication_age_hours.over_window, 0);
  assert.deepEqual(effect.release_is_latest_at_cutoff, { asserted: 725, sessions: 725 });
  assert.equal(candidate.supplied_rule, "fresh = cutoff - observed_at_utc <= 192h");
  assert.match(candidate.supplied_outcome, /564 of 725 mornings fresh/);
});

test("H1-C02 is published unmeasured because no schedule vintage is imported", () => {
  const candidate = published.candidates.find((item) => item.id === "H1-C02");
  assert.equal(candidate.input, "calendar");
  assert.equal(candidate.effect.measurable, false);
  assert.match(candidate.effect.reason, /no imported calendar bundle/);
  assert.match(candidate.supplied_outcome, /no imported calendar bundle/);
  assert.equal(candidate.effect.sessions, undefined, "an unmeasured candidate carries no invented count");
});

test("H1-C03 costs 28 mornings under the strict Bundesbank bound", () => {
  const candidate = published.candidates.find((item) => item.id === "H1-C03");
  const effect = candidate.effect;
  assert.equal(effect.measurable, true);
  assert.equal(effect.sessions, 725);
  assert.equal(effect.window_hours, CONTRACTS.spread.hours);
  assert.equal(effect.fresh, 697);
  assert.equal(effect.blocked, 28);
  assert.equal(effect.blocked_max_age_hours, 151);
  assert.equal(effect.same_day_gain_upper_bound, effect.blocked);
  assert.equal(effect.blocked_first, "2024-01-03");
  assert.equal(effect.blocked_last, "2026-09-09");
  assert.match(candidate.supplied_rule, /T\+1 at 23:59 Europe\/Berlin/);
  assert.match(candidate.proposed_rule, /Keep the strict bound as the default/);
});

test("the rebuild is deterministic and the committed screen carries the same block", () => {
  assert.deepEqual(build(), published);
  const stored = JSON.parse(fs.readFileSync(SCREEN, "utf8"));
  assert.deepEqual(stored.h1.coverage.rule_candidates, published);
  // The amended contracts that the candidates are measured against travel with the same block.
  const a02 = stored.h1.coverage.source_amendments.find((item) => item.id === "H1-A02");
  assert.ok(a02, "H1-A02 is published in the screen");
  assert.ok(a02.equivalence, "H1-A02 publishes its equivalence measurement");
  assert.equal(a02.equivalence.identical_mornings, 552);
  assert.equal(a02.equivalence.compared_mornings, 661);
  assert.equal(a02.equivalence.clean_week_identical_mornings, 540);
  assert.match(a02.equivalence.disproof_hook, /npm run check:h1-a02/);
});
