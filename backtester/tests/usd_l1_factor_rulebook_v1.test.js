const test = require("node:test");
const assert = require("node:assert/strict");

const rulebook = require("../lib/usd_layer1_backtester/factor_rulebook_v1");
const { FACTOR_PLAN } = require("../lib/usd_layer1_backtester/daily_audit_v1");
const { REVIEW } = require("../lib/usd_layer1_backtester/adjudication_review");
const decision = require("../lib/usd_layer1_backtester/decision_rules_v1");

/**
 * The frozen factor rulebook (config/usd_l1_factor_rulebook_v1.json). These tests hold the book to the modules it
 * defers to: the audit plan for the twenty-five rows and their inputs, the adjudication review for the verdicts, and
 * the decision file for the signals. A book that stays internally consistent while drifting from those three is
 * worse than no book, so the drift cases below are tested as failures rather than assumed away.
 */

const clone = () => JSON.parse(JSON.stringify(rulebook.CONFIG));
const failedChecks = (config) => rulebook.validateRulebook(config).checks.filter((check) => !check.ok).map((check) => check.name);

test("the shipped book passes every load-time check", () => {
  assert.equal(rulebook.STATUS, "FROZEN_EXPERIMENTAL");
  assert.equal(rulebook.VERSION, "usd-l1-factor-rulebook-v1.0.0");
  assert.equal(rulebook.FROZEN_ON, "2026-11-15");
  assert.equal(rulebook.VALIDATION.ok, true, rulebook.VALIDATION.errors.join("; "));
  assert.equal(rulebook.VALIDATION.checks.length, 13);
  assert.equal(rulebook.ROWS.length, 25);
  assert.equal(rulebook.INTERACTIONS.length, 10);
  assert.equal(Object.keys(rulebook.OPEN_JUDGEMENTS).length, 3);
});

test("the rows are the audit plan's twenty-five factors, with the plan's roles and inputs", () => {
  assert.equal(FACTOR_PLAN.length, 25);
  for (const entry of FACTOR_PLAN) {
    const row = rulebook.rowFor(entry.id);
    assert.ok(row, `${entry.id} is missing from the book`);
    assert.equal(row.role, entry.role);
    assert.equal(row.name, entry.name);
    assert.deepEqual(row.inputs.slice().sort(), entry.inputs.slice().sort());
  }
});

test("the direction rows own every decision signal exactly once", () => {
  const owners = new Map();
  for (const row of rulebook.ROWS) {
    for (const signal of row.signals) {
      if (row.role !== "direction") continue;
      owners.set(signal, (owners.get(signal) || 0) + 1);
    }
  }
  for (const signal of decision.SIGNALS) {
    assert.equal(owners.get(signal.id), 1, `${signal.id} has ${owners.get(signal.id) || 0} direction owners`);
  }
  assert.equal(rulebook.voteRows().length, 11);
  const familyIds = new Set(decision.FAMILIES.map((family) => family.id));
  const votedFamilies = new Set(
    rulebook.voteRows().flatMap((row) => row.signals.map((signal) => decision.SIGNALS.find((entry) => entry.id === signal).family_id))
  );
  assert.deepEqual([...votedFamilies].sort(), [...familyIds].sort());
});

test("no silent row carries a signal the book does not already count", () => {
  for (const row of rulebook.ROWS) {
    if (row.role === "direction" || row.role === "counted_elsewhere") continue;
    assert.deepEqual(row.signals, [], `${row.id} is ${row.role} but carries ${row.signals.join(", ")}`);
  }
  for (const row of rulebook.rowsForRole("counted_elsewhere")) {
    for (const signal of row.signals) {
      assert.ok(
        rulebook.voteRows().some((voter) => voter.signals.includes(signal)),
        `${row.id} counts ${signal}, which no direction row votes`
      );
    }
  }
});

test("every staged input resolves to its declared age profile", () => {
  const expected = {
    fred_daily: 4,
    bundesbank_daily: 5,
    intraday_bar: 1,
    derived_spread: 5
  };
  for (const [id, age] of Object.entries(expected)) {
    assert.equal(rulebook.AGE_PROFILES[id].max_age_business_days, age, id);
  }
  for (const input of Object.keys(rulebook.INPUT_AGES)) {
    const profile = rulebook.ageProfileFor(input);
    assert.ok(profile, `${input} has no age profile`);
    assert.equal(profile.max_age_business_days, expected[profile.profile_id], input);
  }
  for (const leg of rulebook.AGE_PROFILES.derived_spread.clock_from) {
    assert.ok(rulebook.INPUT_AGES[leg], `spread clock leg ${leg} is unmapped`);
  }
  assert.equal(rulebook.maxAgeBusinessDays("not_a_staged_series"), null);
});

test("each row joins the registered adjudication verdict", () => {
  assert.equal(REVIEW.length, 25);
  for (const row of rulebook.ROWS) {
    assert.ok(row.adjudication, `${row.id} has no adjudication record`);
    assert.equal(row.adjudication.factor_id, row.id);
    assert.ok(rulebook.TREATMENTS.includes(row.adjudication.treatment), `${row.id}: ${row.adjudication.treatment}`);
    assert.ok(row.adjudication.verdict && row.adjudication.verdict.trim(), `${row.id} has no verdict text`);
  }
  assert.equal(rulebook.adjudicationFor("live.f1-vix-level").disposition, "Blocked");
  assert.equal(rulebook.adjudicationFor("no.such.factor"), null);
});

test("a row the plan names cannot be dropped from the book", () => {
  const config = clone();
  config.rows = config.rows.filter((row) => row.id !== "rates.credit-spread-delta");
  const failed = failedChecks(config);
  assert.ok(failed.includes("row count"));
  assert.ok(failed.includes("plan coverage"));
});

test("a row cannot borrow another role", () => {
  const config = clone();
  config.rows.find((row) => row.id === "live.f1-vix-level").role = "counted_elsewhere";
  const failed = failedChecks(config);
  assert.ok(failed.includes("role parity"));
  assert.ok(failed.includes("vote coverage"), "moving the only VIX owner away from direction must orphan its signals");
});

test("a signal the decision file does not define cannot vote", () => {
  const config = clone();
  config.rows.find((row) => row.id === "live.f5-dxy-delta").signals.push("not_a_signal");
  assert.ok(failedChecks(config).includes("signal ownership"));
});

test("an input with no age profile cannot enter the book", () => {
  const config = clone();
  const row = config.rows.find((entry) => entry.id === "live.f4-real-yield-delta");
  delete config.input_ages[row.inputs[0]];
  assert.ok(failedChecks(config).includes("row inputs"));
});

test("an interaction rule bound on one side only is rejected", () => {
  const config = clone();
  const row = config.rows.find((entry) => entry.id === "live.f1-vix-level");
  row.interactions = row.interactions.filter((id) => id !== "IR-1");
  assert.ok(failedChecks(config).includes("interaction rules"));
});

test("a repeated factor id is rejected before it can double a vote", () => {
  const config = clone();
  config.rows[1].id = config.rows[0].id;
  assert.ok(failedChecks(config).includes("row ids"));
});

test("a decision pointer to another version is rejected", () => {
  const config = clone();
  config.decision_rules.version = "usd-l1-decision-rules-v0.0.0";
  assert.ok(failedChecks(config).includes("decision pointer"));
});

test("an open question that points at the wrong row is rejected", () => {
  const config = clone();
  config.open_judgements["OJ-1"].row = "live.f2-us-2y-delta";
  assert.ok(failedChecks(config).includes("open judgements"));
});

test("the book is checked on load, not only when a test is run", () => {
  const loaded = rulebook.loadRulebook();
  assert.equal(loaded.validation.ok, true);
  assert.deepEqual(loaded.rows.map((row) => row.id), rulebook.ROWS.map((row) => row.id));
  assert.equal(loaded.interactions.length, 10);
  const broken = clone();
  broken.rows.length = 24;
  assert.throws(() => rulebook.assertRulebook(broken), /failed its load-time checks/);
});

test("the counts reconcile to twenty-five rows and eleven voters", () => {
  const counted = rulebook.counts();
  const byRole = Object.values(counted.by_role).reduce((sum, value) => sum + value, 0);
  assert.equal(byRole, 25);
  assert.equal(counted.vote_rows, 11);
  assert.equal(counted.joined_adjudications, 25);
  assert.equal(counted.interactions, 10);
  assert.equal(counted.open_judgements, 3);
  assert.equal(counted.age_profiles, 4);
  assert.equal(counted.inputs, 23);
});
