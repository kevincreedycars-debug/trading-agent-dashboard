/**
 * The separately versioned H1 backtest candidate for test 1 on the FTMO `DXY.cash` tape.
 *
 * `USD-L1-25F-H1-v0.1.0` is the supplied package and it stays frozen. This file declares a *different*
 * version of the backtest, `USD-L1-25F-H1-v0.1.1-dxy-cash`, whose only differences from run-v1's
 * `dxy_direction_broker_cfd` lane are:
 *
 *   1. the DXY input is the archived `DXY.cash` hourly tape (amendment `H1-A01`), never the ICE index;
 *   2. the 05:00 London value is read from the bar that *ends* at the cutoff, because that is the last
 *      print a reader could have known at 05:00:00.
 *
 * Point 2 is a correction, not a preference. The exported tape stamps bars by their opening instant
 * (proved below against the open-labelled OANDA EUR/USD H1: same-hour log-return correlation -0.97, with
 * |r| < 0.02 at every other shift, in both DST seasons). So the close of the bar stamped 05:00 is the
 * price at 06:00, and run-v1's `inputs.priceAtHour(series, cutoff)` - which returns exactly that close -
 * reads one hour past the cutoff. Both readings are published here: the corrected one as the candidate's
 * answer, and the run-v1 reading beside it, which reproduces run-v1's published counts exactly and shows
 * which sessions the leak reclassifies.
 *
 * The session contract is unchanged: 05:00 Europe/London to 05:00 London on the next local date, resolved
 * from the calendar so DST follows. A Friday session therefore ends at Saturday 05:00, when the broker
 * prints nothing, so Fridays are unpriced. That is reported as unpriced, not filled from a neighbouring
 * hour and not replaced by a shorter Friday window: the Friday alternative is a separate versioned
 * proposal (`friday_endpoint_proposal`) and is deliberately *not* applied.
 *
 * Research only. It reads the committed run-v1 artefact, the exported tape and the imported evidence
 * bundles; it reads no network and writes nothing.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const outcomes = require("../../backtester/lib/usd_layer1_backtester/outcomes");
const { loadSeries, SCORED_WINDOW } = require("../../backtester/lib/usd_layer1_backtester/dxy_series");
const { ICE_AMENDMENT } = require("./h1_source_amendments");
const { RUN_PATH, summarisePopulation, weekdayOf } = require("./h1_population");

const ID = "usd_l1_25f_h1_dxy_cash";
const VERSION = "USD-L1-25F-H1-v0.1.1-dxy-cash";
const LINEAGE = "USD-L1-25F-H1-v0.1.0";
const DECLARED_ON = "2026-11-19";
const TEST_ID = "dxy_direction_broker_cfd";
const TEST_ORDINAL = 1;
const AMENDMENT_ID = "H1-A01";
const EVIDENCE_DIR = "data/usd-layer1-backtester/h1-v1";
const INPUT_KEYS = ["vix", "front", "spread", "real", "broad", "ice", "gold", "qqq", "calendar"];
const HOUR_MS = 3600000;

/**
 * The line's question, asked of the instrument this lane actually reads. run-v1 words it about "official cash
 * DXY"; that wording is kept beside it as `question_as_published`, because naming the official index is exactly
 * what a broker-CFD figure may not do.
 */
const QUESTION =
  "Did the DXY.cash tape move in the direction called, from 05:00 London to 05:00 the next local calendar day?";

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

const SESSION_CONTRACT =
  "05:00 Europe/London on the session date to 05:00 Europe/London on the next local date, resolved from the " +
  "calendar rather than by adding a fixed hour count; every scheduled weekday window happens to be 24 hours " +
  "because the UK change falls on a Sunday, and a 23h or 25h window would be carried as such if one arose";

/** The instrument, quoted in the project's own words. Never described as the ICE index. */
const INSTRUMENT_BLOCK = Object.freeze({
  id: ICE_AMENDMENT.instrument.id,
  symbol: ICE_AMENDMENT.instrument.symbol,
  label: ICE_AMENDMENT.instrument.label,
  provider: ICE_AMENDMENT.instrument.provider,
  kind: ICE_AMENDMENT.instrument.kind,
  is_official_cash_dxy: false,
  quote_convention: "index points",
  digits: ICE_AMENDMENT.instrument.digits,
  usd_bullish_predicts: "UP",
  series_file: ICE_AMENDMENT.instrument.series_file,
  provenance_file: ICE_AMENDMENT.instrument.provenance_file,
  sha256: ICE_AMENDMENT.instrument.sha256,
  bars: ICE_AMENDMENT.instrument.bars,
  first_bar_utc: ICE_AMENDMENT.instrument.first_bar_utc,
  last_bar_utc: ICE_AMENDMENT.instrument.last_bar_utc,
  what_it_is_not: ICE_AMENDMENT.instrument.what_it_is_not,
  why_the_official_lane_stays_blocked:
    "a broker CFD's 05:00 print is one broker's quote, not a licensed index settlement, so no figure from this " +
    "tape may be reported as test 1's official answer; the official ICE lane remains blocked and this candidate " +
    "is labelled as the broker lane it is",
});

/**
 * The two readings of "the 05:00 London price". `shift_hours` is how far the chosen bar's opening stamp sits
 * before the boundary, so the bar closes at `boundary - shift + 1h`.
 */
const READ_RULES = Object.freeze({
  admissible: {
    id: "close_of_the_bar_ending_at_the_boundary",
    shift_hours: 1,
    observable_at: "the boundary itself",
    why:
      "the exported tape stamps bars by opening instant, so the bar stamped 04:00 closes at 05:00: it is the last " +
      "print a reader has when the cutoff arrives",
  },
  as_published: {
    id: "close_of_the_bar_opening_at_the_boundary",
    shift_hours: 0,
    observable_at: "one hour after the boundary",
    why:
      "this is what run-v1's `inputs.priceAtHour(series, cutoff)` returns: the close of the bar stamped 05:00, which " +
      "only completes at 06:00. It is published here to reproduce run-v1 and to size the leak; it is not admissible",
  },
});

/** The frozen flat band, quoted from run-v1's test 1 block rather than re-measured on this lane. */
const FLAT_BAND = Object.freeze({
  pct: 0.086,
  rule: "20th percentile of the absolute 05:00-to-05:00 move over development dates, rounded to 3 decimals",
  sample: 59,
  source: "data/usd-layer1-backtester/run-v1.json tests.dxy_direction_broker_cfd.instrument.flat_band_pct",
  applied_as: "|move| <= flat_band_pct is FLAT; a FLAT session is reported as flat and not scored",
});

const LABEL_CONVENTION = Object.freeze({
  tape_stamp: "bar opening instant in UTC (the exporter converts the terminal's server clock to UTC)",
  proven_by:
    "same-hour log-return correlation against the open-labelled OANDA EUR/USD H1: r = -0.9698 over 9,152 hours, " +
    "-0.9710 across April-September and -0.9685 across October-March, while every other shift (-2, -1, +1, +2) " +
    "sits at |r| < 0.02; a close-labelled tape would peak at shift +1",
  consequence:
    "the close stamped 05:00 belongs to 05:00-06:00 and is knowable only at 06:00, so the admissible 05:00 print is " +
    "the close of the 04:00 stamped bar",
});

/** The Friday alternative, stated so it cannot be mistaken for something this candidate already does. */
const FRIDAY_ENDPOINT_PROPOSAL = Object.freeze({
  status: "separate_versioned_proposal_not_applied",
  question: "score a Friday session to Friday 23:00 Europe/London (the broker's own week close) instead of Saturday 05:00",
  why_it_is_not_applied:
    "it answers a different question - a 18-hour window in place of the 24-hour one every other weekday answers - so " +
    "it cannot enter the same denominator; it would need its own version and its own reported figure",
  what_it_would_take:
    "a declared window length, a declared daily-rollover instant, a flat band re-frozen on that window, and the same " +
    "leakage proof for its closing price",
});

/** Wilson 95% lower bound on a hit rate, so a small sample cannot present a flattering point estimate. */
function wilsonLowerBound(hits, scored, z = 1.96) {
  if (!scored) return null;
  const p = hits / scored;
  const denominator = 1 + (z * z) / scored;
  const centre = p + (z * z) / (2 * scored);
  const spread = z * Math.sqrt((p * (1 - p)) / scored + (z * z) / (4 * scored * scored));
  return round(((centre - spread) / denominator) * 100, 2);
}

/** Count a lane's records with the same buckets run-v1 publishes. */
function summariseRecords(records) {
  const counts = { sessions: records.length, priced: 0, directional: 0, hits: 0, misses: 0, flat: 0, no_call: 0, no_outcome: 0 };
  for (const record of records) {
    if (record.move_pct !== null) counts.priced += 1;
    if (record.outcome === "hit" || record.outcome === "miss") {
      counts.directional += 1;
      if (record.outcome === "hit") counts.hits += 1;
      else counts.misses += 1;
    } else if (record.outcome === "flat") counts.flat += 1;
    else if (record.outcome === "no_call") counts.no_call += 1;
    else counts.no_outcome += 1;
  }
  const scored = counts.hits + counts.misses;
  return {
    ...counts,
    scored,
    accuracy_pct: scored ? round((counts.hits / scored) * 100, 2) : null,
    lower_bound_pct: wilsonLowerBound(counts.hits, scored),
  };
}

/**
 * Every selected bar must be complete at the boundary it is used at. A record whose opening print is only
 * known after the cutoff would make the lane clairvoyant, so this is an assertion, not a report.
 */
function assertNoLookahead(records, { requireAdmissible = true } = {}) {
  const violations = [];
  for (const record of records) {
    for (const leg of ["start", "end"]) {
      const chosen = record[leg];
      const boundary = leg === "start" ? record.cutoff_at_utc : record.endpoint_at_utc;
      if (chosen.leak_hours === null) continue;
      if (chosen.leak_hours > 0) violations.push({ date: record.date, leg, boundary, bar_close_at_utc: chosen.bar_close_at_utc, leak_hours: chosen.leak_hours });
    }
  }
  if (requireAdmissible && violations.length) {
    throw new Error(`h1 candidate ${VERSION}: ${violations.length} boundary read(s) use a bar that closes after the boundary it is used at`);
  }
  return { violations: violations.length, sample: violations.slice(0, 5), admissible: violations.length === 0 };
}

/** Score every session on one read rule. */
function scoreLane({ sessions, series, rule = READ_RULES.admissible, bandPct = FLAT_BAND.pct }) {
  const shiftHours = typeof rule === "number" ? rule : rule.shift_hours;
  const records = sessions.map((session) => scoreSession({ session, series, shiftHours, bandPct }));
  return {
    rule: typeof rule === "number" ? { shift_hours: rule } : { id: rule.id, shift_hours: rule.shift_hours, observable_at: rule.observable_at, why: rule.why },
    counts: summariseRecords(records),
    records,
  };
}

/** Which sessions change outcome between the corrected read and run-v1's read. */
function flipsBetween(admissible, asPublished) {
  const byDate = new Map(asPublished.records.map((record) => [record.date, record]));
  const flips = [];
  const transitions = {};
  for (const record of admissible.records) {
    const other = byDate.get(record.date);
    if (!other || other.outcome === record.outcome) continue;
    transitions[`${other.outcome}_to_${record.outcome}`] = (transitions[`${other.outcome}_to_${record.outcome}`] || 0) + 1;
    flips.push({
      date: record.date,
      call: record.call,
      admissible: { move_pct: record.move_pct, outcome: record.outcome },
      as_published: { move_pct: other.move_pct, outcome: other.outcome },
      why: "the 05:00-stamped bar's close includes the hour that follows the cutoff; the 04:00-stamped bar's close does not",
    });
  }

  return { count: flips.length, transitions, sessions: flips };
}

/** Why a Friday session cannot be priced on this contract, stated once. */
function fridayAccounting(records) {
  const rows = records.filter((record) => record.weekday === 5);
  const priced = rows.filter((record) => record.move_pct !== null).length;
  return {
    window_fridays: rows.length,
    priced,
    unpriced: rows.length - priced,
    why:
      "a Friday session runs to 05:00 London on Saturday, when the broker is closed, so no bar closes at the endpoint; " +
      "the row stays in the population and its missing endpoint is named, not interpolated",
    alternative_NOT_adopted: FRIDAY_ENDPOINT_PROPOSAL,
  };
}

/** The window-hour mix, so DST is visibly resolved by the calendar rather than by a fixed offset. */
function dstAccounting(sessions) {
  const windowMix = {};
  const cutoffHourMix = {};
  const transitions = [];
  let previousHour = null;
  for (const session of sessions) {
    const windowKey = `${session.window_hours}h`;
    windowMix[windowKey] = (windowMix[windowKey] || 0) + 1;
    const hour = session.cutoff_at_utc.slice(11, 13);
    cutoffHourMix[hour] = (cutoffHourMix[hour] || 0) + 1;
    if (previousHour !== null && previousHour !== hour) transitions.push({ date: session.date, from_utc_hour: previousHour, to_utc_hour: hour });
    previousHour = hour;
  }
  return {
    rule: SESSION_CONTRACT,
    source: "run-v1 sessions[].cutoff_at_utc and endpoint_at_utc, resolved once from Europe/London rules",
    window_hour_mix: windowMix,
    cutoff_utc_hour_mix: cutoffHourMix,
    transitions,
    note:
      "every Monday-to-Friday window is exactly 24 hours because the UK change happens at 01:00 on a Sunday, inside the gap " +
      "between a Friday session's Saturday 05:00 close and the next Monday's open; DST therefore shows up as the cutoff moving " +
      "between 05:00Z and 04:00Z, not as a 23h or 25h window. Both boundaries are read from the resolved session row, and the " +
      "admissible read shifts by one hour with them, so a 04:00Z cutoff reads the 03:00Z bar.",
  };
}

/** What the evidence directory holds, per input, kept separate from what a morning needs in total. */
function inputReadiness({ root, iceReport = null }) {
  const dir = path.join(root, EVIDENCE_DIR);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".json")) : [];
  const present = new Set(files.map((name) => name.replace(/\.json$/, "")));
  return Object.fromEntries(
    INPUT_KEYS.map((key) => {
      const has = present.has(key);
      const detail =
        key === "ice" && iceReport ? { records: iceReport.records, sessions_total: iceReport.sessions, excluded: iceReport.excluded } : null;

      return [key, { evidence_present: has, evidence_file: has ? `${EVIDENCE_DIR}/${key}.json` : null, detail }];
    })
  );
}

/**
 * Assemble the candidate.
 *
 * @param {object} options
 * @param {string} [options.root] repository root
 * @param {object} options.run the committed run-v1 panel
 * @param {object} [options.series] the tape from `loadSeries(root)`; when absent the lane is unpriced and says so
 * @param {object} [options.coverage] `screen.h1.coverage`, used only to quote per-input eligibility
 * @returns {object} the candidate artefact
 */
function buildCandidate({ root = path.resolve(__dirname, "../.."), run, series = null, coverage = null } = {}) {
  if (!run || !Array.isArray(run.sessions)) throw new Error("run-v1 sessions are required");
  const test = (run.tests && run.tests[TEST_ID]) || null;
  if (!test) throw new Error(`run-v1 has no ${TEST_ID} test block`);
  const published = (test.models && test.models.current) || null;
  if (!published) throw new Error(`run-v1 ${TEST_ID} publishes no current-model block to reproduce`);

  const sessions = run.sessions.filter((session) => session.date >= SCORED_WINDOW.first_session);
  const admissible = scoreLane({ sessions, series, rule: READ_RULES.admissible });
  const asPublished = scoreLane({ sessions, series, rule: READ_RULES.as_published });
  const leakage = {
    admissible: assertNoLookahead(admissible.records),
    as_published: assertNoLookahead(asPublished.records, { requireAdmissible: false }),
  };

  const target = { ...published.overall, sessions_with_price: published.sessions_with_price };
  const measured = asPublished.counts;
  const compared = ["scored", "hits", "misses", "flat", "no_call", "no_outcome", "accuracy_pct", "lower_bound_pct"];
  const differences = compared.filter((field) => measured[field] !== target[field]);
  if (measured.priced !== target.sessions_with_price) differences.push("sessions_with_price");
  const reproduction = {
    target,
    measured,
    matches: differences.length === 0,
    differences,
    note: differences.length
      ? "the run-v1 read does not reproduce the published block; the candidate must not be reported until it does"
      : "the run-v1 read reproduces the published block field for field, so the corrected read differs from it only by the one-hour shift",
  };
  if (!reproduction.matches) {
    throw new Error(`h1 candidate ${VERSION}: the run-v1 read does not reproduce run-v1 (${differences.join(", ")})`);
  }

  const flips = flipsBetween(admissible, asPublished);
  const icePath = path.join(root, EVIDENCE_DIR, "ice.json");
  const iceReport = fs.existsSync(icePath) ? JSON.parse(fs.readFileSync(icePath, "utf8")).report : null;
  const population = summarisePopulation({ run });
  const answer = {
    ...admissible.counts,
    question: QUESTION,
    window_sessions: sessions.length,
    statement:
      `On the FTMO DXY.cash tape, reading the 05:00 London value from the bar that closes at 05:00, ` +
      `${admissible.counts.priced} of ${sessions.length} window sessions are priced and ${admissible.counts.scored} are directional ` +
      `(${admissible.counts.hits} hits, ${admissible.counts.misses} misses), ${admissible.counts.accuracy_pct}% with a 95% lower ` +
      `bound of ${admissible.counts.lower_bound_pct}%; ${admissible.counts.flat} are flat inside the ${FLAT_BAND.pct}% band and ` +
      `${admissible.counts.no_outcome} have no admissible price at one of the two boundaries. This is the broker lane, not the ` +
      `ICE cash index. The same tape read the run-v1 way gives ${asPublished.counts.hits} hits and ${asPublished.counts.misses} ` +
      `misses, so the correction moves ${asPublished.counts.hits - admissible.counts.hits} hits and reclassifies ${flips.count} of ` +
      `${sessions.length} sessions while leaving priced, scored, flat, no_call and no_outcome unchanged.`,
  };
  const comparison = {
    identical: ["priced", "scored", "flat", "no_call", "no_outcome"].filter((key) => admissible.counts[key] === asPublished.counts[key]),
    differ: ["hits", "misses", "accuracy_pct", "lower_bound_pct"].filter(
      (key) => admissible.counts[key] !== asPublished.counts[key]
    ),
    hits_delta: admissible.counts.hits - asPublished.counts.hits,
    misses_delta: admissible.counts.misses - asPublished.counts.misses,
    reclassified_sessions: flips.count,
    reclassified_of: sessions.length,
    note:
      "the shift does not change how many sessions are priced or scored; it changes which of them are scored, and the flat band " +
      "turns some of those into flat rather than into the opposite verdict",
  };

  return {
    schema_version: "h1-candidate-v1",
    research_only: true,
    id: ID,
    version: VERSION,
    lineage: LINEAGE,
    package_unchanged: LINEAGE,
    declared_on: DECLARED_ON,
    test: { id: TEST_ID, ordinal: TEST_ORDINAL, amendment: AMENDMENT_ID, question: QUESTION, question_as_published: test.question },
    instrument: INSTRUMENT_BLOCK,
    session_contract: SESSION_CONTRACT,
    label_convention: LABEL_CONVENTION,
    read_rules: READ_RULES,
    input_rule: { adopted: READ_RULES.admissible, published_for_reproduction: READ_RULES.as_published },
    flat_band: FLAT_BAND,
    lookback: {
      days: null,
      why:
        "test 1 reads no lookback: it asks for the forward move between two boundaries, so there is no window to " +
        "choose. The amendment's 5-day lookback governs the `ice` feature the model consumes, not this outcome",
    },
    freshness: {
      rule: "a boundary is priced only by a bar that is complete at that boundary, so the print is knowable at the boundary itself",
      start_bar_close_on_or_before: "cutoff_at_utc",
      end_bar_close_on_or_before: "endpoint_at_utc",
      borrowed_prices: 0,
    },
    timestamps: dstAccounting(sessions),
    window: { first_session: SCORED_WINDOW.first_session, sessions: sessions.length, boundary_source: SCORED_WINDOW.boundary_source },
    answer,
    admissible_lane: { rule: admissible.rule, counts: admissible.counts, records: admissible.records },
    as_published_lane: { rule: asPublished.rule, counts: asPublished.counts, records: asPublished.records },
    reproduction,
    comparison,
    flips,
    leakage,
    fridays: fridayAccounting(admissible.records),
    friday_endpoint_proposal: FRIDAY_ENDPOINT_PROPOSAL,
    denominators: {
      scheduled_sessions: population.rows.scheduled,
      scheduled_by_weekday: population.rows.weekdays,
      all_four_markets_present: population.joint.all_four_present,
      at_least_three_markets_present: (population.joint.present_counts[3] || 0) + (population.joint.present_counts[4] || 0),
      any_market_present: population.joint.any_present,
      control_scored_rows: population.control.scored_rows,
      fridays_without_eur_xau_nas: population.fridays.sessions,
      this_lane_window_sessions: sessions.length,
      published_four_markets_usable_sessions: population.published_counts.four_markets_usable_sessions.published,
      full_reconciliation: `${EVIDENCE_DIR}/population.json`,
    },
    inputs: {
      readiness: inputReadiness({ root, iceReport }),
      fully_eligible_mornings: coverage ? coverage.ready : null,
      earliest_eligible: coverage ? coverage.earliest_eligible : null,
      note:
        "per-input readiness is not the number of mornings that pass every gate; the second figure is published " +
        "separately and stays 0 until all nine inputs are present, fresh and clocked at the same cutoff",
    },
    out_of_scope: {
      ice: "procurement of the official ICE cash DXY history is dropped from this lane; the ICE lane stays blocked until a licensed series exists",
      official_answer: "no figure here may be reported as test 1's official answer, because the tape is a broker CFD",
    },
    source: { run: RUN_PATH, tape: INSTRUMENT_BLOCK.series_file, evidence: `${EVIDENCE_DIR}/*.json` },
  };
}


/**
 * The close of the one-hour bar the rule selects for a boundary, with the instant that close becomes known.
 *
 * Zero tolerance by design: if the tape has no bar opening at the selected hour, the boundary is unpriced.
 * Nothing is borrowed from a neighbouring hour.
 */
function priceAtBoundary(series, boundaryIso, shiftHours) {
  if (!series) return { price: null, bar_open_at_utc: null, bar_close_at_utc: null, reason: "the tape is not present in this checkout" };
  const boundary = Date.parse(boundaryIso);
  if (!Number.isFinite(boundary)) {
    return { price: null, bar_open_at_utc: null, bar_close_at_utc: null, reason: `unparseable boundary ${boundaryIso}` };
  }
  const bar = new Date(boundary - shiftHours * HOUR_MS).toISOString();
  const price = series.closes.get(bar);
  if (!Number.isFinite(price)) {
    return { price: null, bar_open_at_utc: null, bar_close_at_utc: null, reason: `no bar opens at ${bar}` };
  }
  return { price, bar_open_at_utc: bar, bar_close_at_utc: new Date(Date.parse(bar) + HOUR_MS).toISOString(), reason: null };
}

/** Minutes a selected close sits after the boundary it is used at: the size of any leak, in hours. */
function leakHours(barCloseIso, boundaryIso) {
  if (!barCloseIso || !boundaryIso) return null;
  const delta = Date.parse(barCloseIso) - Date.parse(boundaryIso);
  return Number.isFinite(delta) ? round(delta / HOUR_MS, 3) : null;
}

/**
 * One session, scored on one read rule.
 *
 * @param {object} options
 * @param {object} options.session a run-v1 session
 * @param {object} options.series the tape from `loadSeries`
 * @param {number} options.shiftHours 1 for the admissible read, 0 for run-v1's read
 * @param {number} options.bandPct the frozen flat band
 * @returns {object} the record
 */
function scoreSession({ session, series, shiftHours, bandPct }) {
  const direction = (session.models && session.models.current && session.models.current.direction) || "NO_CALL";
  const start = priceAtBoundary(series, session.cutoff_at_utc, shiftHours);
  const end = priceAtBoundary(series, session.endpoint_at_utc, shiftHours);
  const priced = Number.isFinite(start.price) && Number.isFinite(end.price);
  const record = {
    date: session.date,
    weekday: weekdayOf(session.date),
    cutoff_at_utc: session.cutoff_at_utc,
    endpoint_at_utc: session.endpoint_at_utc,
    window_hours: session.window_hours,
    call: direction,
    start: {
      price: start.price,
      bar_open_at_utc: start.bar_open_at_utc,
      bar_close_at_utc: start.bar_close_at_utc,
      leak_hours: leakHours(start.bar_close_at_utc, session.cutoff_at_utc),
    },
    end: {
      price: end.price,
      bar_open_at_utc: end.bar_open_at_utc,
      bar_close_at_utc: end.bar_close_at_utc,
      leak_hours: leakHours(end.bar_close_at_utc, session.endpoint_at_utc),
    },
    move_pct: null,
    market_direction: null,
    band_pct: bandPct,
    outcome: "no_outcome",
    reason: null,
  };
  if (!priced) {
    record.reason = !Number.isFinite(start.price) ? `opening endpoint unpriced: ${start.reason}` : `closing endpoint unpriced: ${end.reason}`;
    record.outcome = direction === "NO_CALL" ? "no_call" : "no_outcome";
    return record;
  }
  const move = (end.price / start.price - 1) * 100;
  record.move_pct = outcomes.round(move, 4);
  record.market_direction = Math.abs(record.move_pct) <= bandPct ? "FLAT" : record.move_pct > 0 ? "UP" : "DOWN";
  const result = outcomes.callOutcome({
    callDirection: direction,
    marketDirection: record.market_direction,
    market: { usd_bullish_predicts: "UP" },
  });
  record.outcome = result === "unscored" ? "no_call" : result;
  return record;
}

module.exports = {
  ID,
  VERSION,
  LINEAGE,
  DECLARED_ON,
  TEST_ID,
  TEST_ORDINAL,
  AMENDMENT_ID,
  QUESTION,
  INSTRUMENT_BLOCK,
  READ_RULES,
  FLAT_BAND,
  LABEL_CONVENTION,
  FRIDAY_ENDPOINT_PROPOSAL,
  SESSION_CONTRACT,
  wilsonLowerBound,
  summariseRecords,
  priceAtBoundary,
  scoreSession,
  scoreLane,
  assertNoLookahead,
  flipsBetween,
  fridayAccounting,
  buildCandidate,
};
