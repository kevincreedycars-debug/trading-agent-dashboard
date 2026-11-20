/**
 * H1 rule candidates: the supplied rules that no H1 morning can satisfy as written, restated as
 * versioned proposals with a measured effect.
 *
 * The supplied H1.1 rulebook measures freshness as the age of the newest *observation* behind a
 * record. Two of its inputs cannot meet that on their own terms:
 *
 *   - H.10 (`broad`) is a weekly release. The value dated Friday is first published on the following
 *     Monday at 16:15 ET, so at a Monday 05:00 London cutoff the newest observation behind the
 *     latest release is ten or eleven days old while the release itself is hours old.
 *   - the event schedule (`calendar`) is knowledge, not an observation. A schedule published months
 *     in advance is not stale; it is in force until a later schedule replaces it.
 *
 * Neither supplied rule is relaxed here. Each keeps its place, and the alternative is written beside
 * it with the number of mornings it would move, so the decision can be taken on evidence instead of
 * on convenience. Nothing in this file changes an eligibility count: the coverage gate keeps using
 * the supplied rules, and these candidates are published as data.
 *
 * Research only.
 */
"use strict";

const { evaluateEvidence } = require("./h1_evidence");

const VERSION = "h1-rule-candidates-v1";
const HOUR = 3600000;

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function weekdayName(ms) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(ms).getUTCDay()];
}

function countBy(list, keyFn) {
  const out = {};
  for (const item of list) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/**
 * Measure H1-C01: what the supplied observation-age rule blocks on `broad`, and what a
 * publication-age rule with the same 192-hour window and a "latest release at the cutoff"
 * requirement would do instead.
 */
function broadFreshnessEffect({ run, bundles, contracts }) {
  const bundle = bundles.broad;
  const contract = contracts.broad;
  if (!bundle || !bundle.present || !bundle.valid) {
    return { measurable: false, reason: "the broad bundle is absent or invalid, so neither rule can be measured" };
  }
  const observationAges = [];
  const publicationAges = [];
  const suppliedBlocked = [];
  const proposedBlocked = [];
  let releaseLatest = 0;
  for (const session of run.sessions) {
    const record = bundle.records.get(session.date);
    if (!record) continue;
    const cutoff = Date.parse(session.cutoff_at_utc);
    const observationAge = (cutoff - Date.parse(record.observed_at_utc)) / HOUR;
    const publicationAge = (cutoff - Date.parse(record.published_at_utc)) / HOUR;
    observationAges.push(observationAge);
    publicationAges.push(publicationAge);
    if (record.release_is_latest_at_cutoff === true) releaseLatest += 1;
    const supplied = evaluateEvidence({ key: "broad", record, session, contract });
    if (!supplied.fresh) suppliedBlocked.push({ session, observationAge, publicationAge });
    const proposedFresh =
      publicationAge >= 0 && publicationAge <= contract.hours && record.release_is_latest_at_cutoff === true;
    if (!proposedFresh) proposedBlocked.push({ session, observationAge, publicationAge });
  }
  const gained = suppliedBlocked.filter(
    (item) => !proposedBlocked.some((other) => other.session.date === item.session.date)
  );
  const lost = proposedBlocked.filter(
    (item) => !suppliedBlocked.some((other) => other.session.date === item.session.date)
  );
  return {
    measurable: true,
    sessions: observationAges.length,
    window_hours: contract.hours,
    supplied_fresh: observationAges.length - suppliedBlocked.length,
    supplied_blocked: suppliedBlocked.length,
    proposed_fresh: observationAges.length - proposedBlocked.length,
    proposed_blocked: proposedBlocked.length,
    gained: gained.length,
    lost: lost.length,
    gained_by_weekday: countBy(gained, (item) => weekdayName(Date.parse(item.session.cutoff_at_utc))),
    gained_first: gained.length ? gained[0].session.date : null,
    gained_last: gained.length ? gained[gained.length - 1].session.date : null,
    observation_age_hours: {
      min: round(Math.min(...observationAges)),
      max: round(Math.max(...observationAges)),
      over_window: observationAges.filter((age) => age > contract.hours).length,
    },
    publication_age_hours: {
      min: round(Math.min(...publicationAges)),
      max: round(Math.max(...publicationAges)),
      over_window: publicationAges.filter((age) => age > contract.hours).length,
    },
    release_is_latest_at_cutoff: { asserted: releaseLatest, sessions: observationAges.length },
  };
}


/**
 * Measure H1-C02 on the calendar bundle when one exists. Without imported calendar evidence the
 * candidate is published unmeasured rather than with an invented count.
 */
function calendarApplicabilityEffect({ run, bundles, contracts }) {
  const bundle = bundles.calendar;
  const contract = contracts.calendar;
  if (!bundle || !bundle.present || !bundle.valid) {
    return {
      measurable: false,
      reason:
        "no imported calendar bundle exists, so the supplied freshness rule and the applicability rule both block every morning; the size of the proposal cannot be measured until a schedule is imported",
    };
  }
  let sessions = 0;
  let suppliedFresh = 0;
  let proposedApplicable = 0;
  for (const session of run.sessions) {
    const record = bundle.records.get(session.date);
    if (!record) continue;
    sessions += 1;
    const cutoff = Date.parse(session.cutoff_at_utc);
    const supplied = evaluateEvidence({ key: "calendar", record, session, contract });
    if (supplied.fresh) suppliedFresh += 1;
    const published = Date.parse(record.published_at_utc);
    const applicable =
      Number.isFinite(published) &&
      published <= cutoff &&
      record.release_is_latest_at_cutoff === true &&
      supplied.schedule_complete;
    if (applicable) proposedApplicable += 1;
  }
  return { measurable: true, sessions, supplied_fresh: suppliedFresh, proposed_applicable: proposedApplicable };
}

/**
 * Measure what the conservative Bundesbank publication bound on `spread` costs. The bundle is built
 * with the strict next-day bound; the same-day alternative cannot be simulated from it, because the
 * value that would become eligible is an operand the bundle deliberately does not carry.
 */
function spreadClockEffect({ run, bundles, contracts }) {
  const bundle = bundles.spread;
  const contract = contracts.spread;
  if (!bundle || !bundle.present || !bundle.valid) {
    return { measurable: false, reason: "the spread bundle is absent or invalid" };
  }
  let sessions = 0;
  const blocked = [];
  for (const session of run.sessions) {
    const record = bundle.records.get(session.date);
    if (!record) continue;
    sessions += 1;
    const result = evaluateEvidence({ key: "spread", record, session, contract });
    if (!result.fresh) {
      blocked.push({ date: session.date, observed: record.observed_at_utc, age_hours: round(result.age_hours) });
    }
  }
  return {
    measurable: true,
    window_hours: contract.hours,
    sessions,
    fresh: sessions - blocked.length,
    blocked: blocked.length,
    blocked_first: blocked.length ? blocked[0].date : null,
    blocked_last: blocked.length ? blocked[blocked.length - 1].date : null,
    blocked_max_age_hours: blocked.length ? Math.max(...blocked.map((item) => item.age_hours)) : null,
    same_day_gain_upper_bound: blocked.length,
  };
}

function describeFreshness(effect, labels) {
  if (!effect || effect.measurable === false) return effect ? effect.reason : "not measured";
  return labels;
}

/**
 * @param {object} args
 * @param {object} args.run the run-v1 sessions
 * @param {object} args.bundles the loaded evidence bundles, keyed by input
 * @param {object} args.contracts the supplied-or-amended contracts, keyed by input
 * @returns {object} versioned candidates; deterministic, so the screen rebuilds byte for byte
 */
function buildRuleCandidates({ run, bundles, contracts }) {
  if (!run || !Array.isArray(run.sessions) || !run.sessions.length) {
    throw new Error("h1 rule candidates: run-v1 sessions are required");
  }
  if (!bundles) throw new Error("h1 rule candidates: the evidence bundles are required");
  if (!contracts) throw new Error("h1 rule candidates: the contracts are required");
  const broad = broadFreshnessEffect({ run, bundles, contracts });
  const calendar = calendarApplicabilityEffect({ run, bundles, contracts });
  const spread = spreadClockEffect({ run, bundles, contracts });
  const window = contracts.broad.hours;
  return {
    version: VERSION,
    status: "proposed",
    applied: false,
    note:
      "These candidates are published as data. The coverage gate keeps the supplied rules, so no morning becomes eligible from reading this file; a candidate changes a count only after the decision owner accepts it and the contract is amended in `h1_source_amendments.js`.",
    candidates: [
      {
        id: "H1-C01",
        input: "broad",
        title: "Measure H.10 freshness on the publication clock, not the observation date",
        status: "proposed",
        supplied_rule: `fresh = cutoff - observed_at_utc <= ${window}h`,
        supplied_outcome: describeFreshness(
          broad,
          `${broad.supplied_fresh} of ${broad.sessions} mornings fresh; ${broad.supplied_blocked} blocked although the newest release at the cutoff was hours old`
        ),
        proposed_rule:
          `fresh = cutoff - published_at_utc <= the same ${window}h window AND release_is_latest_at_cutoff = true. The window is unchanged; only the quantity it measures changes, from the observation date to the release time of the newest publication.`,
        rationale:
          "H.10 is a weekly release. Its Friday value is first published on the following Monday at 16:15 ET, so an observation-age rule charges the model for the publisher's cadence rather than for the age of the information it holds. The latest-release condition keeps the rule strict: a record whose release was already superseded at the cutoff stays blocked.",
        effect: broad,
        evidence: [
          "The Federal Reserve publishes H.10 on Monday at 16:15 ET, covering the previous business week.",
          "Every broad record is rebuilt offline from the dated weekly release pages, so published_at_utc is the release page date and the vintage is a first publication.",
          "No publication age exceeds the supplied window; the observation ages do, on Mondays and on the Tuesdays that follow a market holiday.",
        ],
        disproof:
          "Find one session where the newest H.10 release published at or before the cutoff is not the record's release, or where a release page shows a value that was first published earlier than the dated page carrying it. Either finding voids the candidate for that session.",
        does_not_license:
          "It does not shorten the window, accept a bounded or reconstructed release time, or carry over to another input: each input needs its own cadence argument.",
      },
      {
        id: "H1-C02",
        input: "calendar",
        title: "Treat an event schedule as applicable knowledge, not as a decaying observation",
        status: "proposed",
        supplied_rule: `fresh = cutoff - observed_at_utc <= ${contracts.calendar.hours}h, with the required release types present`,
        supplied_outcome: describeFreshness(
          calendar,
          `${calendar.supplied_fresh} of ${calendar.sessions} mornings fresh under the supplied rule`
        ),
        proposed_rule:
          "A schedule record is applicable at a cutoff when (a) it was published at or before the cutoff, (b) it is the newest schedule vintage published by the cutoff, (c) it covers the forward window the rule needs, and (d) it names every required release type. Condition (b) replaces the 24h decay window: a calendar is superseded, not stale.",
        rationale:
          "A 24-hour window measures when a document was last observed, which for a schedule published months ahead is months. The risk it prices is different: using a revision that did not exist at the cutoff, or a release date that moved after the cutoff. Conditions (a), (b) and (d) price that risk directly, and for the case that matters they are stricter than an age window.",
        subsequent_changes:
          "A release rescheduled after the cutoff keeps its pre-cutoff date inside the record, because that is the date the model could have known. The movement is stored as a separate amendment with its own publication time and can never rewrite an earlier morning. If a release inside the window is added after the cutoff, the morning keeps the record it was built from and the addition is reported as a data revision, not silently absorbed.",
        effect: calendar,
        evidence: [
          "The supplied contract asks for event windows and a known-release list, both derived from a schedule rather than from an observation.",
          "BLS, BEA and FOMC publish their schedules in advance and revise them; the revision is the event to price, not the reading.",
          "No calendar bundle has been imported yet, so the proposal is published without a measured count instead of with an estimated one.",
        ],
        disproof:
          "Find one session where the schedule in force at the cutoff differs from the newest schedule published by the cutoff for a release inside the window, or where a post-cutoff revision changes a date the model would have used. Either finding voids the candidate for that session.",
        does_not_license:
          "It does not license a schedule without a publication timestamp, a scraped calendar of unknown vintage, or dropping the required release-type check. It also does not license reading a release outcome early.",
      },
      {
        id: "H1-C03",
        input: "spread",
        title: "Decide the Bundesbank same-day publication bound on evidence, not on convenience",
        status: "proposed",
        supplied_rule:
          "published_at_utc = T+1 at 23:59 Europe/Berlin, a bound that cannot be earlier than the real publication; freshness window 96h",
        supplied_outcome: describeFreshness(
          spread,
          `${spread.fresh} of ${spread.sessions} mornings fresh; ${spread.blocked} blocked, worst age ${spread.blocked_max_age_hours}h against a ${spread.window_hours}h window`
        ),
        proposed_rule:
          "Keep the strict bound as the default. A same-day bound may be adopted only if the Bundesbank's own BBSIS update stamp is captured for the dates in question, showing the T value available before the next 05:00 London cutoff.",
        rationale:
          "The strict bound is the only one that cannot be a lookahead. Its cost is now visible: every operand is only available from 23:59 Berlin on the day after its date, so the newest common observation at a cutoff is at least one day older than the date it carries, and a holiday on either side adds days. On 28 mornings that pushes the age past the 96h window, to a worst case of 151h.",
        effect: spread,
        evidence: [
          "Two observed BBSIS refreshes, both same-day: `last update,2026-11-19 12:22:17` (the file already carried the 2026-11-19 value) and `last update,2026-11-20 12:29:01` (the file already carried the 2026-11-20 value), both read on 2026-11-20. Neither is a historical 2024 stamp.",
          "The strict bound (23:59 Europe/Berlin on T+1) sits 35.5 hours after the later observed refresh, so it cannot be earlier than a refresh that keeps the same daily pattern; that the 2024 pattern was the same is supported by two stamps a year apart and is not proven by them.",
        ],
        disproof:
          "Capture one historical BBSIS update stamp for a 2024 date that is later than the following 05:00 London cutoff. That voids the same-day claim for that date and keeps the strict bound.",
        does_not_license:
          "It does not license dropping the publication clock, using a US close as a Berlin publication time, or filling a missing common date. The spread is still built on common observation dates only.",
      },
    ],
  };
}

module.exports = { VERSION, buildRuleCandidates };

