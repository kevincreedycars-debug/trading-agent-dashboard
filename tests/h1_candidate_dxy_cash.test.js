"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ID,
  VERSION,
  QUESTION,
  INSTRUMENT_BLOCK,
  READ_RULES,
  FLAT_BAND,
  priceAtBoundary,
  scoreSession,
  scoreLane,
  assertNoLookahead,
  flipsBetween,
  wilsonLowerBound,
  buildCandidate,
} = require("../lib/layer1_backtesting/h1_candidate_dxy_cash");
const { readRun } = require("../lib/layer1_backtesting/h1_population");
const { loadSeries, SCORED_WINDOW } = require("../backtester/lib/usd_layer1_backtester/dxy_series");

const ROOT = path.resolve(__dirname, "..");
const COMMITTED = path.join(ROOT, "data", "usd-layer1-backtester", "h1-v1", "candidate-dxy-cash.json");

/** A tape of hourly closes, keyed the way the exporter writes them: by bar opening instant. */
function tape(closes) {
  return { closes: new Map(Object.entries(closes)) };
}

const SESSION = {
  date: "2025-03-04",
  cutoff_at_utc: "2025-03-04T05:00:00.000Z",
  endpoint_at_utc: "2025-03-05T05:00:00.000Z",
  window_hours: 24,
  models: { current: { direction: "BULLISH" } },
};

test("the tape stamps bars by opening instant, so the 05:00 boundary is read from the 04:00 bar", () => {
  const series = tape({
    "2025-03-04T04:00:00.000Z": 104.0,
    "2025-03-04T05:00:00.000Z": 104.5,
    "2025-03-05T04:00:00.000Z": 104.2,
    "2025-03-05T05:00:00.000Z": 103.9,
  });

  const admissible = priceAtBoundary(series, SESSION.cutoff_at_utc, READ_RULES.admissible.shift_hours);
  assert.equal(admissible.price, 104.0);
  assert.equal(admissible.bar_open_at_utc, "2025-03-04T04:00:00.000Z");
  assert.equal(admissible.bar_close_at_utc, SESSION.cutoff_at_utc, "the bar closes exactly at the cutoff");

  const asPublished = priceAtBoundary(series, SESSION.cutoff_at_utc, READ_RULES.as_published.shift_hours);
  assert.equal(asPublished.price, 104.5);
  assert.equal(asPublished.bar_close_at_utc, "2025-03-04T06:00:00.000Z", "run-v1's read completes an hour late");
});

test("a missing bar leaves the boundary unpriced and names the hour it wanted", () => {
  const series = tape({ "2025-03-04T05:00:00.000Z": 104.5 });
  const read = priceAtBoundary(series, SESSION.cutoff_at_utc, 1);
  assert.equal(read.price, null);
  assert.equal(read.reason, "no bar opens at 2025-03-04T04:00:00.000Z");
  assert.equal(priceAtBoundary(null, SESSION.cutoff_at_utc, 1).price, null);
});

test("a session scores hit, miss, flat or no_call and never borrows a price", () => {
  const series = tape({
    "2025-03-04T04:00:00.000Z": 100,
    "2025-03-05T04:00:00.000Z": 100.5,
  });
  const up = scoreSession({ session: SESSION, series, shiftHours: 1, bandPct: FLAT_BAND.pct });
  assert.equal(up.move_pct, 0.5);
  assert.equal(up.market_direction, "UP");
  assert.equal(up.outcome, "hit");
  assert.equal(up.start.leak_hours, 0);
  assert.equal(up.end.leak_hours, 0);

  const down = scoreSession({
    session: SESSION,
    series: tape({ "2025-03-04T04:00:00.000Z": 100, "2025-03-05T04:00:00.000Z": 99.5 }),
    shiftHours: 1,
    bandPct: FLAT_BAND.pct,
  });
  assert.equal(down.outcome, "miss");

  const flat = scoreSession({
    session: SESSION,
    series: tape({ "2025-03-04T04:00:00.000Z": 100, "2025-03-05T04:00:00.000Z": 100.05 }),
    shiftHours: 1,
    bandPct: FLAT_BAND.pct,
  });
  assert.equal(flat.market_direction, "FLAT");
  assert.equal(flat.outcome, "flat");

  const called = scoreSession({
    session: { ...SESSION, models: { current: { direction: "NO_CALL" } } },
    series,
    shiftHours: 1,
    bandPct: FLAT_BAND.pct,
  });
  assert.equal(called.outcome, "no_call");

  const unpriced = scoreSession({
    session: SESSION,
    series: tape({ "2025-03-04T04:00:00.000Z": 100 }),
    shiftHours: 1,
    bandPct: FLAT_BAND.pct,
  });
  assert.equal(unpriced.outcome, "no_outcome");
  assert.match(unpriced.reason, /^closing endpoint unpriced: no bar opens at 2025-03-05T04:00:00\.000Z$/);
});

test("a boundary read that completes after the boundary is refused, not warned about", () => {
  const series = tape({ "2025-03-04T04:00:00.000Z": 100, "2025-03-04T05:00:00.000Z": 101, "2025-03-05T04:00:00.000Z": 102, "2025-03-05T05:00:00.000Z": 103 });
  const leaked = scoreLane({ sessions: [SESSION], series, rule: READ_RULES.as_published, bandPct: FLAT_BAND.pct });
  assert.throws(() => assertNoLookahead(leaked.records), /use a bar that closes after the boundary/);
  assert.equal(assertNoLookahead(leaked.records, { requireAdmissible: false }).violations, 2);
  const clean = scoreLane({ sessions: [SESSION], series, rule: READ_RULES.admissible, bandPct: FLAT_BAND.pct });
  assert.equal(assertNoLookahead(clean.records).violations, 0);
});

test("the flat band is what separates a flip from a verdict change", () => {
  const admissible = {
    records: [
      { date: "2025-03-04", call: "BULLISH", move_pct: 0.04, outcome: "flat" },
      { date: "2025-03-05", call: "BEARISH", move_pct: -0.12, outcome: "hit" },
    ],
  };
  const asPublished = {
    records: [
      { date: "2025-03-04", call: "BULLISH", move_pct: 0.12, outcome: "hit" },
      { date: "2025-03-05", call: "BEARISH", move_pct: -0.12, outcome: "hit" },
    ],
  };
  const flips = flipsBetween(admissible, asPublished);
  assert.equal(flips.count, 1);
  assert.deepEqual(flips.transitions, { hit_to_flat: 1 });
  assert.equal(flips.sessions[0].date, "2025-03-04");
});

test("the published lower bound is reproduced by the Wilson formula, not by a constant", () => {
  assert.equal(wilsonLowerBound(141, 284), 43.88);
  assert.equal(wilsonLowerBound(0, 0), null);
});


test("the committed candidate reproduces from run-v1, the tape and the evidence bundles", () => {
  const run = readRun({ root: ROOT });
  const series = loadSeries(path.join(ROOT, "backtester", "tmp", "ftmo_dxy_cash_h1.csv"));
  const screen = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "usd-layer1-backtester", "backtesting-screen-v1.json"), "utf8"));
  const committed = JSON.parse(fs.readFileSync(COMMITTED, "utf8"));
  const rebuilt = buildCandidate({ root: ROOT, run, series, coverage: screen.h1.coverage });
  assert.deepEqual(rebuilt, committed, "the artefact is a function of the committed inputs, with no hand edits");

  assert.equal(committed.id, ID);
  assert.equal(committed.version, VERSION);
  assert.equal(committed.lineage, "USD-L1-25F-H1-v0.1.0");
  assert.equal(committed.research_only, true);

  // Test 1's DXY input is the broker tape, and every label says so.
  assert.equal(committed.instrument.symbol, "DXY.cash");
  assert.equal(committed.instrument.kind, "broker_cfd");
  assert.equal(committed.instrument.is_official_cash_dxy, false);
  assert.equal(committed.instrument.why_the_official_lane_stays_blocked.length > 40, true);
  assert.equal(committed.out_of_scope.official_answer.includes("broker CFD"), true);

  // The question is asked of the tape this lane reads; run-v1's "official cash DXY" wording is kept, labelled.
  assert.equal(committed.test.question, QUESTION);
  assert.equal(committed.test.question.includes("official"), false);
  assert.match(committed.test.question_as_published, /official cash DXY/);
  assert.equal(committed.answer.question, QUESTION);
  assert.match(committed.session_contract, /every scheduled weekday window happens to be 24 hours/);

  // The corrected read, with the reproduction read beside it.
  assert.equal(committed.input_rule.adopted.id, READ_RULES.admissible.id);
  assert.equal(committed.input_rule.published_for_reproduction.id, READ_RULES.as_published.id);
  assert.equal(committed.reproduction.matches, true, committed.reproduction.differences.join(", "));
  assert.equal(committed.leakage.admissible.violations, 0, "no admissible read may see a price it could not have had");
  assert.equal(committed.leakage.as_published.violations > 0, true, "the leak is measured, not assumed");

  assert.equal(committed.window.first_session, SCORED_WINDOW.first_session);
  assert.equal(committed.window.sessions, 480);
  assert.equal(committed.answer.priced, 360);
  assert.equal(committed.answer.scored, 284);
  assert.equal(committed.answer.hits, 139);
  assert.equal(committed.answer.misses, 145);
  assert.equal(committed.answer.flat, 70);
  assert.equal(committed.answer.no_call, 7);
  assert.equal(committed.answer.no_outcome, 119);
  assert.equal(committed.answer.accuracy_pct, 48.94);
  assert.equal(committed.answer.lower_bound_pct, 43.18);

  assert.equal(committed.as_published_lane.counts.hits, 141);
  assert.equal(committed.as_published_lane.counts.misses, 143);
  assert.equal(committed.as_published_lane.counts.accuracy_pct, 49.65);

  assert.equal(committed.comparison.hits_delta, -2);
  assert.equal(committed.comparison.misses_delta, 2);
  assert.deepEqual(committed.comparison.identical, ["priced", "scored", "flat", "no_call", "no_outcome"]);
  assert.equal(committed.flips.count, 39);
  assert.equal(
    Object.values(committed.flips.transitions).reduce((total, count) => total + count, 0),
    committed.flips.count
  );

  // Fridays stay in the population and stay unpriced: the endpoint is Saturday 05:00.
  assert.equal(committed.fridays.window_fridays > 0, true);
  assert.equal(committed.fridays.priced, 0);
  assert.equal(committed.fridays.window_fridays, committed.fridays.unpriced);
  assert.equal(committed.friday_endpoint_proposal.status, "separate_versioned_proposal_not_applied");

  // DST is carried by the resolved session rows: the UK change falls in the Fri-close/Mon-open gap, so every
  // window is 24h and the change shows up as the cutoff moving between 05:00Z and 04:00Z.
  assert.deepEqual(committed.timestamps.window_hour_mix, { "24h": 480 });
  assert.deepEqual(Object.keys(committed.timestamps.cutoff_utc_hour_mix).sort(), ["04", "05"]);
  assert.equal(
    committed.timestamps.cutoff_utc_hour_mix["04"] + committed.timestamps.cutoff_utc_hour_mix["05"],
    committed.window.sessions
  );
  assert.equal(committed.timestamps.transitions.length > 0, true);
  for (const transition of committed.timestamps.transitions) {
    assert.equal(transition.date.startsWith("20"), true);
    assert.notEqual(transition.from_utc_hour, transition.to_utc_hour);
  }
  assert.match(committed.timestamps.note, /not as a 23h or 25h window/);

  // Denominators are quoted, not re-derived, and the unreproducible one is named as such.
  assert.equal(committed.denominators.scheduled_sessions, 725);
  assert.equal(committed.denominators.control_scored_rows, 675);
  assert.equal(committed.denominators.all_four_markets_present, 566);
  assert.equal(committed.denominators.published_four_markets_usable_sessions, 685);

  // Per-input readiness is reported separately from fully eligible mornings.
  assert.equal(committed.inputs.readiness.ice.evidence_present, true);
  assert.equal(committed.inputs.readiness.ice.detail.records, 455);
  assert.equal(committed.inputs.readiness.vix.evidence_present, true, "the Cboe close was imported on 2026-11-20");
  assert.equal(committed.inputs.readiness.gold.evidence_present, false, "no LBMA fixing was acquired");
  assert.equal(committed.inputs.fully_eligible_mornings, 0);
});
