// The USD Layer 1 H1 v0.1.1 timing proposal, written as a pure reading over a recorded ICE fixing pair so it can
// be reviewed, tested and lifted into a package without touching the frozen v0.1.0 candidate.
//
// Why it exists: `backtester/packages/USD-L1-25F-H1-v0.1.0/inputs.json` gives the ICE row a maximum age of zero
// hours, and both `engine.js` (lines 15-18) and `lib/layer1_backtesting/h1_candidate.js` (lines 59-63) require
// observed <= published <= received <= cutoff. Together those force observed = published = received = the cutoff
// instant, so the supplied fixture only passes because `verify.js` stamps all three clocks at the cutoff itself.
// A real collector cannot produce a zero-latency receipt at 05:00:00.000, and no historical archive can, so the
// ICE vote can never be proven live under v0.1.0 as written (review finding H1R-03, severity: defect).
//
// What v0.1.1 proposes instead: the ICE input is the 05:00 London fixing, observed and published at that 05:00
// stamp, and *received at or before* the decision cutoff rather than exactly at it. The fixing used is the latest
// eligible one, and it must be paired with the fixing before it so the declared return "(previous eligible 05:00
// fixing -> current 05:00, simple return in percent)" describes two real observations.
//
// What it deliberately does not weaken: nothing may be published or received after the cutoff, an intraday print
// is not the declared instrument, a broker DXY proxy is still refused, a repeated fixing is refused rather than
// read as a 0.00% neutral vote, and no fill, carry-forward or interpolation is allowed. A missing or stale input
// still blocks the whole morning.
//
// This is a proposal, not deployed code: no I/O, no clock of its own, no package edit.
"use strict";

// The two maximum ages under review. Option A is the wording recorded in H1R-03 ("a maximum age of 24 hours").
// Option B is the default here, because a 24-hour cap structurally excludes every Monday (145 of 725 scheduled
// mornings, 20.0%) and every post-holiday morning: the most recent eligible 05:00 fixing then sits 72 hours back.
// The other daily inputs in v0.1.0 already carry a 96-hour cap, so Option B reuses the declared freshness scale
// instead of inventing a new one.
const MAX_AGE_HOURS = Object.freeze({ A: 24, B: 96 });
const DEFAULT_OPTION = "B";

const ICE_CONTRACT = Object.freeze({
  input: "ice",
  source: "ICE",
  instrument: "US Dollar Index spot",
  transform: "previous eligible London 05:00 fixing to latest London 05:00 fixing received at or before the cutoff, simple return in percent",
  max_age_hours: MAX_AGE_HOURS,
  default_option: DEFAULT_OPTION,
  refused_sources: Object.freeze(["CFD", "DXY.cash", "broker"]),
});

const CODE = Object.freeze({
  ok: "ice_ok",
  missing: "ice_missing",
  unclocked: "ice_unclocked",
  notFiveOClock: "ice_not_five_o_clock_london",
  sourceMismatch: "ice_source_mismatch",
  publicationLate: "ice_publication_after_cutoff",
  receiptLate: "ice_receipt_after_cutoff",
  receiptBeforePublication: "ice_receipt_before_publication",
  observationAfterPublication: "ice_observation_after_publication",
  stale: "ice_stale",
  sameFixing: "ice_same_fixing",
  missingValue: "ice_missing_value",
  unknownOption: "ice_unknown_option",
});

function instant(value) {
  const parsed = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

// London wall time from a UTC instant, using the tz database rather than a hard-coded summer offset: the 05:00
// fixing is 05:00 local in both GMT and BST, which is 05:00Z in winter and 04:00Z in summer.
const LONDON_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function londonStamp(value) {
  const parsed = instant(value);
  if (parsed === null) return null;
  const parts = {};
  for (const part of LONDON_CLOCK.formatToParts(new Date(parsed))) parts[part.type] = part.value;
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

/** True only for an exact 05:00:00 Europe/London stamp: a fixing, not an intraday print. */
function isFiveOClockLondon(value) {
  return londonStamp(value) === "05:00:00";
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function reject(code, detail, extra) {
  return { ok: false, code, detail, value_pct: null, ...extra };
}

/**
 * Assess one recorded ICE fixing pair against the proposed v0.1.1 rule.
 *
 * `record` is a stored evidence row, never a computed one:
 *   {
 *     source: "ICE", instrument: "US Dollar Index spot",
 *     published_at_utc, received_at_utc,
 *     latest:   { fixing_at_utc, value },
 *     previous: { fixing_at_utc, value }
 *   }
 *
 * `cutoff_at_utc` is the session's decision cutoff from the session resolver. `option` selects the maximum age:
 * "A" for the recorded 24-hour wording, "B" for the proposed 96-hour default.
 */
function assessIceFixing(record, { cutoff_at_utc: cutoffAtUtc, option = DEFAULT_OPTION } = {}) {
  const cutoff = instant(cutoffAtUtc);
  if (!record || typeof record !== "object") return reject(CODE.missing, "no ICE row was recorded");
  if (cutoff === null) return reject(CODE.unclocked, "the session cutoff is not a finite instant");

  const latest = record.latest || {};
  const previous = record.previous || {};
  const observed = instant(latest.fixing_at_utc);
  const earlier = instant(previous.fixing_at_utc);
  const published = instant(record.published_at_utc);
  const received = instant(record.received_at_utc);
  const clocks = {
    observed_at_utc: latest.fixing_at_utc || null,
    published_at_utc: record.published_at_utc || null,
    received_at_utc: record.received_at_utc || null,
    cutoff_at_utc: cutoffAtUtc || null,
  };
  if ([observed, earlier, published, received].some((value) => value === null)) {
    return reject(CODE.unclocked, "a fixing, publication or receipt clock is missing or unparseable", { clocks });
  }

  if (String(record.source || "") !== ICE_CONTRACT.source
    || String(record.instrument || "") !== ICE_CONTRACT.instrument) {
    return reject(CODE.sourceMismatch, "the row is not ICE US Dollar Index spot", { clocks });
  }
  if (!isFiveOClockLondon(observed)) {
    return reject(CODE.notFiveOClock, `the latest observation is ${londonStamp(observed)} London, not a 05:00 fixing`, { clocks });
  }
  if (!isFiveOClockLondon(earlier)) {
    return reject(CODE.notFiveOClock, `the previous observation is ${londonStamp(earlier)} London, not a 05:00 fixing`, { clocks });
  }
  if (observed <= earlier) {
    return reject(CODE.sameFixing, "the latest fixing is not later than the previous one", { clocks });
  }
  if (observed > published) {
    return reject(CODE.observationAfterPublication, "the observation is stamped after publication", { clocks });
  }
  if (published > cutoff) {
    return reject(CODE.publicationLate, "the fixing was published after the decision cutoff", { clocks });
  }
  if (received < published) {
    return reject(CODE.receiptBeforePublication, "the receipt is stamped before publication", { clocks });
  }
  if (received > cutoff) {
    return reject(CODE.receiptLate, "the receipt is stamped after the decision cutoff", { clocks });
  }
  const maxAgeHours = MAX_AGE_HOURS[option];
  if (!Number.isFinite(maxAgeHours)) {
    return reject(CODE.unknownOption, `unknown option ${String(option)}: no maximum age is defined`, { clocks });
  }
  const ageHours = (cutoff - observed) / 3600000;
  if (ageHours > maxAgeHours) {
    return reject(CODE.stale, `the fixing is ${ageHours.toFixed(1)} hours old against a ${maxAgeHours} hour cap`, { clocks, age_hours: ageHours });
  }

  const latestValue = numeric(latest.value);
  const previousValue = numeric(previous.value);
  if (latestValue === null || previousValue === null || latestValue <= 0 || previousValue <= 0) {
    return reject(CODE.missingValue, "a fixing value is missing, non-numeric or not positive", { clocks });
  }
  const valuePct = Number((((latestValue / previousValue) - 1) * 100).toFixed(6));
  return {
    ok: true,
    code: CODE.ok,
    detail: `latest 05:00 fixing ${ageHours.toFixed(1)} hours before the cutoff, cap ${maxAgeHours} hours`,
    value_pct: valuePct,
    age_hours: ageHours,
    clocks,
  };
}


// The six entries of the v0.1.1 proposal set. The Markdown companion states them in prose; this array is the
// machine-readable decision sheet, mirrored to `H1_V0_1_1_PROPOSALS_20261118.json` and kept in sync by the test.
const PROPOSALS = Object.freeze([
  {
    id: "P-01",
    finding: "H1R-03",
    severity: "defect",
    title: "ICE 05:00 timing: receive by the cutoff, not at it",
    status: "proposed_not_applied",
    current: "ice max_age_hours 0 with observed <= published <= received <= cutoff forces all three clocks onto the cutoff instant",
    proposed: "observed and published at the 05:00 London fixing stamp, received at or before the cutoff, latest eligible fixing no older than 96 hours (option A: 24 hours), two distinct fixings",
    default_if_no_reply: "option B, 96 hour cap",
    touches_arithmetic: false,
    touches_counts: false,
    needs_new_data: true,
    verification: "docs/strategy/proposals/H1_ICE_TIMING_20261118.test.js",
  },
  {
    id: "P-02",
    finding: "H1R-01",
    severity: "assumption",
    title: "The front-end change is a spread operand, not a ninth gate",
    status: "proposed_not_applied",
    current: "front is a standalone required input that no family reads",
    proposed: "eight inputs plus the named operand front; the presence test moves inside the spread row",
    default_if_no_reply: "accept the wording, defer the count change",
    touches_arithmetic: false,
    touches_counts: true,
    needs_new_data: false,
    verification: "contract check reports inputs 8, operands [front], same spread value",
  },
  {
    id: "P-03",
    finding: "H1R-02",
    severity: "gap",
    title: "The VIX row measured the level only",
    status: "proposed_not_applied",
    current: "the row names level and change; the executable reads the level",
    proposed: "retitle the row as level-only and record the change feature as a v0.2 candidate",
    default_if_no_reply: "retitle as level-only",
    touches_arithmetic: false,
    touches_counts: false,
    needs_new_data: false,
    verification: "text-only patch: outputs, fixture digests and coverage counts unchanged",
  },
  {
    id: "P-04",
    finding: "H1R-04",
    severity: "gap",
    title: "F23 calendar distance is declared but not implemented",
    status: "proposed_not_applied",
    current: "two calendar rows share one count; distance has no executable representation",
    proposed: "record F23 as unimplemented in the rulebook table, with the reason",
    default_if_no_reply: "declare unimplemented",
    touches_arithmetic: false,
    touches_counts: false,
    needs_new_data: false,
    verification: "shared-evidence table shows one implemented and one declared-only feature",
  },
  {
    id: "P-05",
    finding: "H1R-06",
    severity: "presentation",
    title: "The trace's front vote is reported-only",
    status: "proposed_not_applied",
    current: "votes.front sits in the trace while frontCounted is false",
    proposed: "rename it frontReportedOnly and publish the six counted votes beside the family means",
    default_if_no_reply: "accept",
    touches_arithmetic: false,
    touches_counts: false,
    needs_new_data: false,
    verification: "regenerated v0.1.1 fixture trace; guard test over the counted set",
  },
  {
    id: "P-06",
    finding: "H1R-10",
    severity: "gap",
    title: "A zero event count from an incomplete calendar is not evidence",
    status: "proposed_not_applied",
    current: "the count is the only calendar feature; four release families are unarchived",
    proposed: "rulebook sentence: an incomplete calendar blocks the morning instead of reporting no release",
    default_if_no_reply: "accept",
    touches_arithmetic: false,
    touches_counts: false,
    needs_new_data: true,
    verification: "rulebook row text; coverage keeps calendar in the blocker list",
  },
]);

module.exports = {
  CODE,
  DEFAULT_OPTION,
  ICE_CONTRACT,
  MAX_AGE_HOURS,
  PROPOSALS,
  assessIceFixing,
  isFiveOClockLondon,
  londonStamp,
};

