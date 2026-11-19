"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const access = require("../lib/usd_layer1_backtester/factor_access_v1");
const engine = require("../lib/usd_layer1_backtester/engine_v1");
const rulebook = require("../lib/usd_layer1_backtester/factor_rulebook_v1");
const decision = require("../lib/usd_layer1_backtester/decision_rules_v1");
const script = require("../scripts/run_usd_l1_engine_v1");

/** Every input the book reads, stamped fresh, so a synthetic morning can be readable end to end. */
function freshSession(overrides = {}) {
  const values = {};
  const meta = [];
  for (const key of Object.keys(rulebook.INPUT_AGES)) {
    values[key] = key.includes("pct") || key.includes("_chg") ? 1.5 : 100;
    meta.push([key, "2024-03-05", 0, 1]);
  }
  for (const [key, staleness] of Object.entries(overrides)) {
    const entry = meta.find((tuple) => tuple[0] === key);
    if (entry) entry[2] = staleness;
    else values[key] = null;
  }
  return {
    date: "2024-03-05",
    cutoff_at_utc: "2024-03-05T05:00:00.000Z",
    inputs: values,
    saved_inputs: {},
    audit_values: {},
    input_meta: meta
  };
}

const FULL_VOTES = Object.freeze({
  vix_level: 1,
  vix_change: 1,
  us_2y: 1,
  real_yield: 1,
  relative_front_end: 1,
  broad_dollar: 1,
  session_momentum: 1,
  overnight_range: 1,
  gold: 1,
  equities: 1,
  safe_haven: 1,
  fed_bias: 1
});

const FED_AVAILABLE = Object.freeze({ "live.f8-fed-bias": { available: true, statement_date: "2024-02-06", bias: "hawkish" } });

test("a fresh morning lets every direction row vote and reads the whole book", () => {
  const morning = access.assessMorning(freshSession(), { events: FED_AVAILABLE });
  assert.equal(morning.factors.length, 25);
  assert.equal(morning.coverage.vote_rows, 11);
  assert.equal(morning.coverage.vote_rows_valid, 11);
  assert.equal(morning.coverage.signals_reachable, 12);
  assert.equal(morning.blockers.length, 0);
  assert.equal(
    morning.coverage.not_read,
    rulebook.rowsForRole("excluded").length + rulebook.rowsForRole("calendar_window").length + rulebook.rowsForRole("event_missing").length
  );
});

test("a print older than its declared age makes the row unreadable, not neutral", () => {
  const morning = access.assessMorning(freshSession({ broad_dollar_d5_pct: 9 }), { events: FED_AVAILABLE });
  const row = morning.factors.find((factor) => factor.id === "live.f5-dxy-delta");
  assert.equal(row.state, access.STATES.MISSING_OR_STALE);
  assert.equal(row.may_vote, false);
  assert.match(row.reason, /stale: broad_dollar_d5_pct/);
  assert.ok(morning.blockers.some((blocker) => blocker.id === "live.f5-dxy-delta"));
});

test("a derived spread inherits the age of its oldest leg", () => {
  const derivedSession = (overrides = {}) => {
    const session = freshSession(overrides);
    session.input_meta = session.input_meta.filter((tuple) => tuple[0] !== "us_de_2y_spread_d5_bps");
    return session;
  };
  const fresh = access.assessInput(derivedSession(), "us_de_2y_spread_d5_bps");
  assert.equal(fresh.clock, "legs");
  assert.equal(fresh.staleness_business_days, 0);
  assert.equal(fresh.state, access.INPUT_STATES.FRESH);
  const stale = access.assessInput(derivedSession({ de_2y_yield: 6 }), "us_de_2y_spread_d5_bps");
  assert.equal(stale.staleness_business_days, 6);
  assert.equal(stale.state, access.INPUT_STATES.STALE);
});

test("an event row with no release before the cutoff is absent, never filled", () => {
  const absent = access.assessMorning(freshSession(), { events: { "live.f8-fed-bias": { available: false } } });
  const row = absent.factors.find((factor) => factor.id === "live.f8-fed-bias");
  assert.equal(row.state, access.STATES.VERIFIED_ABSENT);
  assert.equal(row.may_vote, false);
  const unread = access.assessFactor(freshSession(), "live.f8-fed-bias");
  assert.equal(unread.state, access.STATES.NOT_READ);
  assert.equal(access.assessFactor(freshSession(), "live.f7-economic-surprise").may_vote, false);
});

test("the engine runs the six checks in order on a morning it can call", () => {
  const decided = engine.decide({
    date: "2024-03-05",
    cutoff_at_utc: "2024-03-05T05:00:00.000Z",
    session: freshSession(),
    events: FED_AVAILABLE,
    votes: FULL_VOTES,
    gateOpen: true,
    gateStatus: "open",
    calendar_staged: true,
    source: "test"
  });
  assert.deepEqual(decided.checks.map((check) => check.id), ["E1", "E2", "E3", "E4", "E5", "E6"]);
  assert.ok(decided.checks.every((check) => check.passed === true), JSON.stringify(decided.checks.filter((check) => !check.passed)));
  assert.equal(decided.outcome, engine.OUTCOMES.ALLOWED);
  assert.equal(decided.direction, "BULLISH");
  assert.equal(decided.fired_rules.filter((rule) => rule.kind !== "cap").length, 0);
  assert.equal(decided.trace.factor_verdicts.length, 25);
  assert.equal(decided.trace.engine_version, engine.VERSION);
});

/** One synthetic morning decided by the engine, so each fail-safe can be exercised on its own. */
function decideOn(overrides = {}) {
  return engine.decide({
    date: "2024-03-05",
    cutoff_at_utc: "2024-03-05T05:00:00.000Z",
    session: freshSession(),
    events: FED_AVAILABLE,
    votes: FULL_VOTES,
    gateOpen: true,
    gateStatus: "open",
    calendar_staged: true,
    source: "test",
    ...overrides
  });
}

test("a vote from a row the book cannot read blocks the morning instead of being discounted", () => {
  const decided = decideOn({ session: freshSession({ broad_dollar_d5_pct: 9 }) });
  assert.equal(decided.outcome, engine.OUTCOMES.BLOCKED);
  const check = decided.checks.find((entry) => entry.id === "E3");
  assert.equal(check.passed, false);
  assert.match(check.offenders.join("; "), /broad_dollar: live\.f5-dxy-delta is missing_or_stale/);
  const fired = decided.fired_rules.find((rule) => rule.rule_id === "E3");
  assert.equal(fired.kind, "block");
  assert.ok(fired.factor_ids.includes("live.f5-dxy-delta"));
  assert.ok(fired.interaction_ids.length > 0, "a blocked row names the interaction rules that bind it");
});

test("an undefined gate blocks the morning before any arithmetic is reported", () => {
  const decided = decideOn({ gateOpen: false, gateStatus: "undefined" });
  assert.equal(decided.outcome, engine.OUTCOMES.BLOCKED);
  assert.equal(decided.checks.find((entry) => entry.id === "E2").passed, false);
  assert.ok(decided.fired_rules.some((rule) => rule.rule_id === "E2" && rule.kind === "block"));
});

test("a reading printed after the cutoff blocks the morning", () => {
  const session = freshSession();
  session.input_meta.find((tuple) => tuple[0] === "vix_level")[1] = "2024-03-06";
  const decided = decideOn({ session });
  assert.equal(decided.outcome, engine.OUTCOMES.BLOCKED);
  assert.match(decided.checks.find((entry) => entry.id === "E1").offenders.join("; "), /vix_level: printed 2024-03-06/);
});

test("a cutoff that is not the 05:00-London instant blocks the morning", () => {
  const decided = decideOn({ cutoff_at_utc: "2024-03-05T06:00:00.000Z" });
  assert.equal(decided.outcome, engine.OUTCOMES.BLOCKED);
  assert.match(decided.checks.find((entry) => entry.id === "E1").offenders.join("; "), /declared session cuts off at/);
});

test("a deadband morning abstains and says which rule refused it", () => {
  const flat = Object.fromEntries(Object.keys(FULL_VOTES).map((signal) => [signal, 0]));
  const decided = decideOn({ votes: flat });
  assert.equal(decided.outcome, engine.OUTCOMES.ABSTAINED);
  assert.equal(decided.direction, "NO_CALL");
  const fired = decided.fired_rules.find((rule) => rule.rule_id === "E5");
  assert.equal(fired.kind, "abstain");
  assert.match(fired.reason, /deadband|nets to no direction/);
});

test("the replay path and the shadow path reach the same answer", () => {
  const session = freshSession();
  const morning = access.assessMorning(session, { events: FED_AVAILABLE });
  const fromSession = decideOn({ session });
  const fromMorning = decideOn({ session: null, morning });
  assert.equal(fromSession.outcome, fromMorning.outcome);
  assert.equal(fromSession.direction, fromMorning.direction);
  assert.equal(fromSession.band, fromMorning.band);
  assert.deepEqual(
    fromSession.checks.map((check) => [check.id, check.passed]),
    fromMorning.checks.map((check) => [check.id, check.passed])
  );
});

test("the shadow workflow refuses a seal it cannot stage, and decides one it can", () => {
  const os = require("node:os");
  const collection = require("../lib/usd_layer1_backtester/collection");
  const shadow = require("../scripts/run_usd_l1_shadow_decision");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usd-l1-shadow-"));
  const cutoff = "2024-03-05T05:00:00.000Z";
  const base = collection.seal({
    session_date: "2024-03-05",
    cutoff_at_utc: cutoff,
    sealed_at_utc: "2024-03-05T04:57:00.000Z",
    items: [{ source_id: "fred_vixcls", received_at_utc: "2024-03-05T04:52:00.000Z", payload: "vix" }]
  });

  const barePath = path.join(dir, "bare.json");
  fs.writeFileSync(barePath, JSON.stringify(base), "utf8");
  const bare = shadow.run({ sealed: barePath }, { today: "2024-03-05" });
  assert.equal(bare.status, "refused");
  assert.equal(bare.seal.ok, true);
  assert.equal(bare.staged.readings, 0);
  assert.equal(bare.decision.outcome, engine.OUTCOMES.BLOCKED);
  assert.ok(bare.decision.fired_rules.some((rule) => rule.rule_id === "E4"), "an unstaged morning fails coverage");

  const session = freshSession();
  const staged = {
    ...base,
    readings: { values: session.inputs, input_meta: session.input_meta },
    votes: { ...FULL_VOTES },
    events: { ...FED_AVAILABLE },
    gate: { open: true, status: "open" },
    calendar_staged: true
  };
  const stagedPath = path.join(dir, "staged.json");
  fs.writeFileSync(stagedPath, JSON.stringify(staged), "utf8");
  const decided = shadow.run({ sealed: stagedPath }, { today: "2024-03-05" });
  assert.equal(decided.status, "allowed", decided.reason);
  assert.equal(decided.decision.outcome, engine.OUTCOMES.ALLOWED);
  assert.equal(decided.decision.source, "shadow");
  assert.equal(decided.decision.book_version, engine.BOOK_VERSION);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the persisted artefact matches a fresh replay and passes its own assertions", () => {
  const result = script.check();
  assert.ok(result.ok, result.drift.join("; "));
  assert.deepEqual(result.data.assertions.map((assertion) => assertion.id), [
    "invariance",
    "six_checks",
    "no_silent_refusal",
    "proof_morning"
  ]);
  assert.ok(result.data.assertions.every((assertion) => assertion.ok));
  assert.ok(result.data.summary.mornings > 0);
  assert.equal(result.data.fired_rule_log.length, result.data.summary.mornings);
});

test("every morning carries one positional state per rulebook row, and the legend explains each code", () => {
  const data = JSON.parse(fs.readFileSync(script.OUT_PATH, "utf8"));
  const legend = data.morning_state_legend;
  assert.ok(legend, "the positional strings need a legend beside them");
  assert.deepEqual(Object.keys(legend.states).sort(), ["A", "N", "S", "V"]);
  assert.equal(data.morning_states.length, data.summary.mornings);
  assert.deepEqual(
    data.morning_states.map((morning) => morning.date),
    data.fired_rule_log.map((morning) => morning.date),
    "the state log and the fired-rule log describe the same mornings in the same order"
  );

  const rowCount = data.book_detail.rows.length;
  assert.equal(rowCount, rulebook.ROWS.length);
  for (const morning of data.morning_states) {
    assert.equal(morning.states.length, rowCount, `${morning.date} states`);
    assert.equal(morning.votes.length, rowCount, `${morning.date} votes`);
    assert.equal(morning.ages.length, rowCount, `${morning.date} ages`);
    assert.match(morning.states, /^[VASN]+$/, `${morning.date} uses only declared state codes`);
    assert.match(morning.votes, /^[+\-0]+$/, `${morning.date} uses only declared vote codes`);
    assert.match(morning.ages, /^\d+$/, `${morning.date} ages are single digits`);
    assert.deepEqual(Object.keys(morning.checks), ["E1", "E2", "E3", "E4", "E5", "E6"]);
  }

  // The per-morning letters must add up to the aggregate the artefact already publishes, or one of them is lying.
  data.book_detail.rows.forEach((row, index) => {
    const aggregate = data.access.by_factor.find((entry) => entry.id === row.id);
    assert.ok(aggregate, `${row.id} has an aggregate record`);
    const valid = data.morning_states.filter((morning) => morning.states[index] === "V").length;
    assert.equal(valid, aggregate.states.valid_unchanged, `${row.id} valid_unchanged count`);
  });
});

test("a fired rule and a failed check are the same statement on every morning", () => {
  const data = JSON.parse(fs.readFileSync(script.OUT_PATH, "utf8"));
  const statesByDate = new Map(data.morning_states.map((morning) => [morning.date, morning]));
  for (const logged of data.fired_rule_log) {
    const morning = statesByDate.get(logged.date);
    assert.ok(morning, `${logged.date} has a state row`);
    for (const rule of logged.fired_rules) {
      if (!/^CAP-/.test(rule.rule_id)) assert.equal(morning.checks[rule.rule_id], false, `${logged.date} ${rule.rule_id}`);
    }
    for (const [id, passed] of Object.entries(morning.checks)) {
      if (passed === false) {
        assert.ok(
          logged.fired_rules.some((rule) => rule.rule_id === id),
          `${logged.date} ${id} failed without a fired rule`
        );
      }
    }
  }
});

test("book_detail names every row, its role and the treatment the adjudication allowed", () => {
  const detail = script.bookDetail();
  assert.equal(detail.rows.length, rulebook.ROWS.length);
  assert.equal(detail.signals.length, decision.SIGNALS.length);
  for (const row of detail.rows) {
    assert.ok(row.id && row.name && row.role_label, `${row.id} is named`);
    assert.ok(Object.values(rulebook.TREATMENTS).includes(row.treatment), `${row.id} carries a declared treatment`);
    assert.ok(Array.isArray(row.inputs) && Array.isArray(row.signals));
  }
  for (const signal of detail.signals) {
    assert.ok(signal.owner, `${signal.id} names the row that owns it`);
    assert.ok(detail.rows.some((row) => row.id === signal.owner));
  }
  const roles = detail.rows.reduce((counts, row) => ({ ...counts, [row.role]: (counts[row.role] || 0) + 1 }), {});
  assert.deepEqual(roles, rulebook.counts().by_role);
});

