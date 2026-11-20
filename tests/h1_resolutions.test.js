"use strict";

/**
 * The resolution note (`docs/research/usd-session/v1/H1_RULE_RESOLUTIONS_20261120.md`) is only true if the
 * payload says the same thing. These tests hold the published coverage to it: which amendment is accepted and
 * which is still pending, the front operand, the three measured candidates that are not applied, the licensed
 * gold input, the DXY.cash labelling, and the morning a first valid run would use.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { build } = require("../scripts/build_backtesting_screen");

const screen = build();
const coverage = screen.h1.coverage;
const input = (key) => coverage.inputs.find((row) => row.key === key);
const morning = (date) => coverage.mornings.find((row) => row.date === date);

test("the coverage is evaluated against the exact contract, with the pending amendment named", () => {
  assert.equal(coverage.binding.model_version, "USD-L1-25F-H1-v0.1.0");
  assert.match(coverage.binding.evaluated_contract, /H1-A01 v0\.1\.1 \(accepted by owner 2026-11-18\)/);
  assert.match(coverage.binding.evaluated_contract, /H1-A02 v0\.1\.2 \(proposed, pending owner\)/);
  assert.equal(screen.package_identity.requested, "USD-L1-25F-H1-v0.1.0");
  assert.match(coverage.binding.package_archive_sha256, /^1c82e904/);

  const check = coverage.contract_check;
  assert.equal(check.checked, true);
  assert.equal(check.inputs, 9);
  assert.deepEqual(check.mismatches, []);
  assert.deepEqual(
    check.amended_versions.map((row) => [row.input, row.id, row.version, row.status]),
    [
      ["ice", "H1-A01", "v0.1.1", "accepted_by_owner"],
      ["real", "H1-A02", "v0.1.2", "proposed_pending_owner"],
    ]
  );
  assert.deepEqual(check.pending_amendments, ["H1-A02"]);
  assert.deepEqual(input("real").amended.status, "proposed_pending_owner");
  assert.deepEqual(input("ice").amended.status, "accepted_by_owner");
});

test("the front operand is published as present and not counted by any family (P-02)", () => {
  assert.deepEqual(coverage.contract_check.not_read_by_any_family, ["front"]);
  assert.equal(input("front").eligible, coverage.counts.scheduled);
  assert.equal(input("front").identity_state, "verified_original");
  assert.equal(coverage.contract_check.inputs, 9, "the row count is unchanged: the operand is not a tenth or eighth input yet");
});

test("no rule candidate is applied and each publishes its measured effect", () => {
  const rc = coverage.rule_candidates;
  assert.equal(rc.status, "proposed");
  assert.equal(rc.applied, false);
  assert.deepEqual(
    rc.candidates.map((candidate) => candidate.id),
    ["H1-C01", "H1-C02", "H1-C03"]
  );

  const c01 = rc.candidates[0].effect;
  assert.equal(c01.gained, 161);
  assert.equal(c01.lost, 0);
  assert.equal(c01.supplied_fresh, 564);
  assert.equal(c01.proposed_fresh, 725);
  assert.equal(c01.publication_age_hours.over_window, 0);
  assert.equal(coverage.counts.by_input.broad.fresh, 564, "the gate keeps the supplied observation-age window");

  const c02 = rc.candidates[1].effect;
  assert.equal(c02.measurable, false);

  const c03 = rc.candidates[2].effect;
  assert.equal(c03.blocked, 28);
  assert.equal(c03.fresh, 697);
  assert.equal(c03.same_day_gain_upper_bound, 28);
  assert.equal(coverage.counts.by_input.spread.eligible, 697, "the strict Bundesbank bound still costs 28 mornings");

  assert.equal(coverage.ready, 0, "reading a proposal cannot make a morning eligible");
  assert.equal(coverage.earliest_eligible, null);
});

test("gold is a licensed purchase, never a free download and never an XAU/USD substitute", () => {
  const gold = input("gold");
  assert.equal(gold.identity_state, "identity_mismatch");
  assert.equal(gold.eligible, 0);
  assert.equal(gold.blocked, coverage.counts.scheduled);
  assert.match(gold.legacy_field, /OANDA XAU\/USD/);
  assert.match(gold.user_action, /IBA licence is required/);
  assert.match(gold.user_action, /do not substitute OANDA/i);
  assert.doesNotMatch(gold.user_action, /free to registered/i);
  assert.match(gold.remaining_requirement, /not the LBMA Gold Price PM USD auction/);

  const calendar = input("calendar");
  assert.equal(calendar.code, "incomplete_calendar");
  assert.equal(calendar.eligible, 0);
  assert.match(calendar.instrument, /FOMC policy decision/);
});

test("the DXY.cash tape is labelled as a broker CFD on the input and only takes effect under H1-A01", () => {
  const ice = input("ice");
  assert.equal(ice.amended.id, "H1-A01");
  assert.equal(ice.instrument_kind, "broker_cfd");
  assert.equal(ice.is_official_cash_dxy, false);
  assert.match(ice.instrument, /DXY\.cash/);
  assert.match(ice.identity_note, /broker CFD and not the official ICE index/);
  assert.equal(ice.identity_state, "amended_source");
  assert.equal(ice.eligible, coverage.counts.by_input.ice.present);
});

test("the first morning whose only blockers are the two missing inputs is 2024-12-12", () => {
  const target = morning("2024-12-12");
  assert.ok(target, "2024-12-12 must be a scheduled morning");
  assert.equal(target.ready, false);
  assert.deepEqual(
    target.blockers.map((blocker) => blocker.input),
    ["gold", "calendar"]
  );

  const missingOnly = coverage.mornings.filter((row) =>
    row.blockers.every((blocker) => blocker.input === "gold" || blocker.input === "calendar")
  );
  assert.equal(missingOnly.length, 336);
  assert.equal(missingOnly[0].date, "2024-12-12");
  assert.equal(missingOnly[missingOnly.length - 1].date, "2026-10-09");
  assert.equal(target.rungs.eligible, 7, "seven inputs qualify on that morning; only gold and calendar are absent");
});
