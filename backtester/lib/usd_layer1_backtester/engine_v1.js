"use strict";

/**
 * The one USD-session decision engine (research only).
 *
 * A morning arrives with votes already computed and with the readings those votes came from. The engine runs six
 * named checks in one fixed order, in one place, so the replay and the shadow workflow cannot drift apart:
 *
 *   E1 cutoff      - the session is the 05:00-London window and no reading is stamped after its cutoff;
 *   E2 gate        - the frozen RG-4 volatility gate is open at the cutoff (data, not opinion);
 *   E3 provenance  - every vote belongs to exactly one direction row that may vote this morning;
 *   E4 coverage    - enough of the book is readable for the decision file's eligibility rule;
 *   E5 call        - the family vote leaves the 0.20 deadband and nets away from zero;
 *   E6 trade       - the provisional trade rule is met (event family readable, all twelve signals usable).
 *
 * Failing E1 to E4 is a `blocked` morning: the fail-safe refuses to emit anything rather than explaining a gap
 * away. Failing E5 or E6 is an `abstained` morning: the data was good enough and the book chose not to call. Only
 * a morning that passes all six is `allowed`. Every refusal and every cap is written into `fired_rules`, which is
 * the log the run persists, so a claim about a morning can always be traced to the check that produced it.
 *
 * The arithmetic is not reimplemented here. Bands, deadband, family means, caps and the trade rule come from
 * `decision_rules_v1`, which reads the frozen 25-row book through `factor_rulebook_v1` and `factor_access_v1`.
 * The engine adds ordering, refusal and the record. Nothing here trades, sizes, or claims an edge.
 */

const rulebook = require("./factor_rulebook_v1");
const access = require("./factor_access_v1");
const decision = require("./decision_rules_v1");
const sessionInterface = require("../usd_session_engine_interface");

const VERSION = "usd-session-engine-v1";
const BOOK_VERSION = rulebook.VERSION;
const DECISION_VERSION = decision.VERSION;
const INTERFACE_VERSION = "usd-session-engine-interface-v2";

const OUTCOMES = Object.freeze({
  ALLOWED: "allowed",
  BLOCKED: "blocked",
  ABSTAINED: "abstained"
});

/** The six checks, in the order they run. A blocked check outranks an abstaining one and stops the sequence. */
const CHECKS = Object.freeze([
  Object.freeze({ id: "E1", name: "cutoff", label: "readings stamped before the 05:00-London cutoff", on_fail: OUTCOMES.BLOCKED }),
  Object.freeze({ id: "E2", name: "gate", label: "the RG-4 volatility gate is open at the cutoff", on_fail: OUTCOMES.BLOCKED }),
  Object.freeze({ id: "E3", name: "provenance", label: "every vote belongs to a direction row that may vote", on_fail: OUTCOMES.BLOCKED }),
  Object.freeze({ id: "E4", name: "coverage", label: "enough of the book is readable for the eligibility rule", on_fail: OUTCOMES.BLOCKED }),
  Object.freeze({ id: "E5", name: "call", label: "the family vote leaves the deadband and nets away from zero", on_fail: OUTCOMES.ABSTAINED }),
  Object.freeze({ id: "E6", name: "trade", label: "the provisional trade rule is met", on_fail: OUTCOMES.ABSTAINED })
]);
const CHECK_BY_ID = new Map(CHECKS.map((check) => [check.id, check]));

/** The 05:00-London session for a UTC date, or the reason it cannot be resolved. */
function cutoffFor(date) {
  if (!date) return { session: null, error: "the morning carries no date, so its cutoff cannot be resolved" };
  const dayMs = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(dayMs)) return { session: null, error: `unparseable morning date ${date}` };
  try {
    return { session: sessionInterface.resolveSession(dayMs), error: null };
  } catch (error) {
    return { session: null, error: error.message };
  }
}


/** Late prints and unclocked prints, straight off the access record. */
function cutoffOffenders(morning, cutoffMs) {
  const offenders = [];
  if (!morning) return offenders;
  for (const factor of morning.factors) {
    for (const input of factor.inputs) {
      const printMs = input.print_date ? Date.parse(input.print_date) : NaN;
      if (!Number.isFinite(printMs)) {
        // A reading that is absent anyway is a gap for the access record to report, not a late print.
        if (input.value === null) continue;
        offenders.push(`${input.key}: no print date on the reading ${factor.id} consumes`);
      } else if (Number.isFinite(cutoffMs) && printMs > cutoffMs) {
        offenders.push(`${input.key}: printed ${input.print_date}, after the cutoff ${new Date(cutoffMs).toISOString()}`);
      }
    }
  }
  return offenders;
}

/**
 * Attribute each vote to the row that owns it. A vote with no owner, an owner that may not vote this morning, or
 * a signal the decision file does not define is a provenance failure rather than a vote to be discounted.
 */
function provenanceOffenders(votes, morning) {
  const offenders = [];
  const signalIds = new Set(decision.SIGNALS.map((signal) => signal.id));
  const mayVote = new Map(morning ? morning.factors.map((factor) => [factor.id, factor]) : []);
  const provenance = {};
  for (const [signalId, raw] of Object.entries(votes || {})) {
    if (!signalIds.has(signalId)) {
      offenders.push(`${signalId}: the decision file defines no such signal`);
      continue;
    }
    const vote = decision.normaliseVote(raw);
    const owner = rulebook.ownerOfSignal(signalId);
    provenance[signalId] = { vote, factor_id: owner };
    if (vote === null) continue;
    if (!owner) {
      offenders.push(`${signalId}: no single direction row owns the signal`);
      continue;
    }
    if (!morning) {
      offenders.push(`${signalId}: the morning has no access record, so the vote cannot be attributed`);
      continue;
    }
    const factor = mayVote.get(owner);
    if (!factor) {
      offenders.push(`${signalId}: owner ${owner} is missing from the access record`);
    } else if (!factor.may_vote) {
      offenders.push(`${signalId}: ${owner} is ${factor.state} (${factor.reason}) and may not vote`);
    }
  }
  return { offenders, provenance };
}

function firedRule(checkId, kind, reason, factorIds = []) {
  const check = CHECK_BY_ID.get(checkId);
  const interactions = [...new Set(factorIds.flatMap((id) => rulebook.interactionsForRow(id).map((entry) => entry.id)))];
  return Object.freeze({
    rule_id: checkId,
    check: check ? check.name : null,
    kind,
    reason,
    factor_ids: Object.freeze(factorIds.slice()),
    interaction_ids: Object.freeze(interactions)
  });
}


/**
 * Decide one morning. Both paths call this: the replay passes a stored session, the shadow workflow passes the
 * readings it staged before the cutoff. Nothing about the answer depends on which of the two is asking.
 */
function decide({
  date = null,
  cutoff_at_utc = null,
  votes = {},
  gateOpen = null,
  gateStatus = null,
  session = null,
  morning = null,
  events = {},
  calendar_staged = decision.CONFIG.event_context.calendar_staged,
  source = "backtest"
} = {}) {
  const accessRecord = morning || (session ? access.assessMorning(session, { events }) : null);
  const { session: resolved, error: cutoffError } = cutoffFor(date);
  const cutoffMs = resolved ? Date.parse(resolved.cutoff_at_utc) : NaN;
  const evaluated = decision.evaluateMorning({ date, votes, gateOpen, gateStatus, calendarStaged: calendar_staged });
  const eligibility = decision.CONFIG.eligibility;
  const checks = [];
  const fired = [];

  const e1 = [];
  if (cutoffError) e1.push(cutoffError);
  if (resolved && cutoff_at_utc && Date.parse(cutoff_at_utc) !== cutoffMs) {
    e1.push(`the morning is stamped ${cutoff_at_utc}, but the declared session cuts off at ${resolved.cutoff_at_utc}`);
  }
  e1.push(...cutoffOffenders(accessRecord, cutoffMs));

  const e2 = [];
  if (gateOpen !== true) {
    e2.push(gateStatus === "closed" ? "the RG-4 volatility gate is closed" : "the RG-4 volatility gate is undefined at the cutoff");
    const gateState = accessRecord && accessRecord.gate ? accessRecord.gate.state : null;
    if (gateState && gateState !== access.STATES.VALID_UNCHANGED) {
      e2.push(`the gate reading ${accessRecord.gate.input} is ${gateState}`);
    }
  }

  const { offenders: e3, provenance } = provenanceOffenders(votes, accessRecord);

  const e4 = [];
  if (evaluated.usable_signals < eligibility.min_usable_signals) {
    e4.push(`only ${evaluated.usable_signals} of ${decision.SIGNAL_COUNT} voting signals are usable; the rule needs ${eligibility.min_usable_signals}`);
  }
  if (evaluated.usable_families < eligibility.min_usable_families) {
    e4.push(`only ${evaluated.usable_families} of ${decision.FAMILIES.length} families are usable; the rule needs ${eligibility.min_usable_families}`);
  }
  const blockedFactors = accessRecord ? accessRecord.blockers.map((blocker) => blocker.id) : [];

  record("E1", e1);
  record("E2", e2, ["data.quality-gate-for-abstention"]);
  record("E3", e3, [...new Set(Object.values(provenance).map((entry) => entry.factor_id).filter(Boolean))]);
  record("E4", e4, blockedFactors);

  const called = evaluated.direction !== "NO_CALL";
  record("E5", called ? [] : [evaluated.reasons.find((reason) => /deadband/.test(reason)) || "the family vote nets to no direction"]);
  const tradeMet = evaluated.trade === true;
  const tradeReasons = evaluated.reasons.filter((reason) => /provisional trade rule/.test(reason));
  record("E6", tradeMet ? [] : tradeReasons.length ? tradeReasons : ["the provisional trade rule is not met"], [], called);

  const blocked = checks.some((check) => check.passed === false && CHECK_BY_ID.get(check.id).on_fail === OUTCOMES.BLOCKED);
  const abstained = checks.some((check) => check.passed === false && CHECK_BY_ID.get(check.id).on_fail === OUTCOMES.ABSTAINED);
  const outcome = blocked ? OUTCOMES.BLOCKED : abstained ? OUTCOMES.ABSTAINED : OUTCOMES.ALLOWED;

  for (const cap of evaluated.caps_applied) {
    fired.push(
      Object.freeze({
        rule_id: `CAP-${cap.max_band}`,
        check: "E5",
        kind: "cap",
        reason: `${cap.cap} capped the band at ${cap.max_band} from ${cap.from_band}`,
        factor_ids: Object.freeze([]),
        interaction_ids: Object.freeze([])
      })
    );
  }


  const observations = accessRecord
    ? accessRecord.factors.flatMap((factor) =>
        factor.inputs.map((input) => ({
          key: input.key,
          value: input.value,
          observed_at_utc: input.print_date,
          source: input.clock,
          factor_id: factor.id
        }))
      )
    : [];

  const trace = {
    ...sessionInterface.buildTraceRecord({
      session: resolved,
      observations,
      factor_verdicts: accessRecord
        ? accessRecord.factors.map((factor) => ({
            factor_id: factor.id,
            role: factor.role,
            state: factor.state,
            may_vote: factor.may_vote,
            reason: factor.reason
          }))
        : [],
      combination: {
        families: evaluated.families,
        net_score: evaluated.net_score,
        agreement: evaluated.agreement,
        participation: evaluated.participation
      },
      decision: { outcome, direction: evaluated.direction, band: evaluated.band, trade: evaluated.trade }
    }),
    engine_version: VERSION,
    interface_version: INTERFACE_VERSION,
    note: "replay and shadow record only: the six checks ran in one engine, and no deployment is implied"
  };

  return Object.freeze({
    version: VERSION,
    book_version: BOOK_VERSION,
    decision_version: DECISION_VERSION,
    source,
    date,
    cutoff_at_utc: resolved ? resolved.cutoff_at_utc : cutoff_at_utc,
    outcome,
    direction: evaluated.direction,
    band: evaluated.band,
    band_label: evaluated.band_label,
    trade: evaluated.trade,
    checks: Object.freeze(checks),
    fired_rules: Object.freeze(fired),
    provenance: Object.freeze(provenance),
    coverage: accessRecord ? accessRecord.coverage : null,
    blockers: accessRecord ? accessRecord.blockers : Object.freeze([]),
    decision: evaluated,
    access: accessRecord,
    trace: Object.freeze(trace)
  });

  /** Append one check result and, when it failed, the rule it fired. A skip is recorded, never silently passed. */
  function record(id, offenders, factorIds = [], applicable = true) {
    const check = CHECK_BY_ID.get(id);
    const passed = applicable ? offenders.length === 0 : null;
    const recorded = applicable ? offenders.slice() : [];
    checks.push(
      Object.freeze({
        id,
        name: check.name,
        label: check.label,
        passed,
        applicable,
        offenders: Object.freeze(recorded),
        factor_ids: Object.freeze(factorIds.slice())
      })
    );
    if (passed === false) {
      fired.push(firedRule(id, check.on_fail === OUTCOMES.BLOCKED ? "block" : "abstain", recorded.join("; "), factorIds));
    }
  }
}


/** Counts across a run: outcomes, which check refused, and which rules fired most often. */
function summarise(decisions = []) {
  const list = Array.isArray(decisions) ? decisions : [];
  const outcomes = { allowed: 0, blocked: 0, abstained: 0 };
  const checkFailures = {};
  const ruleCounts = {};
  const directions = { BULLISH: 0, BEARISH: 0, NO_CALL: 0 };
  for (const decision of list) {
    outcomes[decision.outcome] = (outcomes[decision.outcome] || 0) + 1;
    directions[decision.direction] = (directions[decision.direction] || 0) + 1;
    for (const check of decision.checks) {
      if (check.passed === false) checkFailures[check.id] = (checkFailures[check.id] || 0) + 1;
    }
    for (const rule of decision.fired_rules) {
      ruleCounts[rule.rule_id] = (ruleCounts[rule.rule_id] || 0) + 1;
    }
  }
  return {
    version: VERSION,
    mornings: list.length,
    first_date: list.length ? list[0].date : null,
    last_date: list.length ? list[list.length - 1].date : null,
    outcomes,
    directions,
    check_failures: checkFailures,
    rule_counts: ruleCounts,
    traded: list.filter((decision) => decision.trade).length
  };
}

module.exports = {
  VERSION,
  BOOK_VERSION,
  DECISION_VERSION,
  INTERFACE_VERSION,
  OUTCOMES,
  CHECKS,
  decide,
  summarise,
  cutoffFor,
  provenanceOffenders
};
