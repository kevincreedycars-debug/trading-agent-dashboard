"use strict";

/**
 * Replay the frozen USD-session rulebook through the one engine (`engine_v1.decide`) and write the record.
 *
 * The votes are not rebuilt here: they come from `signalVotes` in the decision-rules page builder, which is the
 * code the published decision page already uses. The engine then runs its six checks over those votes and the
 * access record they were drawn from. The script also replays the same mornings through `decision_rules_v1` the
 * way the page does and refuses to write anything if the engine's arithmetic differs on a single morning: the
 * point of this file is that one engine serves both paths, not that a second opinion was produced.
 *
 * Usage:
 *   node backtester/scripts/run_usd_l1_engine_v1.js --write
 *   node backtester/scripts/run_usd_l1_engine_v1.js --check
 *
 * Research only. Nothing here reads the network, the warehouse, the dispatcher or a production path, and a green
 * replay is not evidence of live deployment, causal feature timing or trading edge.
 */

const fs = require("node:fs");
const path = require("node:path");

const engine = require("../lib/usd_layer1_backtester/engine_v1");
const access = require("../lib/usd_layer1_backtester/factor_access_v1");
const decision = require("../lib/usd_layer1_backtester/decision_rules_v1");
const rulebook = require("../lib/usd_layer1_backtester/factor_rulebook_v1");
const ruleWiring = require("../lib/usd_layer1_backtester/rule_wiring");
const f8 = require("../lib/usd_layer1_backtester/f8_fed_bias");
const pageBuilder = require("./build_usd_l1_decision_rules_page");

const ROOT = path.join(__dirname, "..", "..");
const RUN_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json");
const OUT_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "engine-v1.json");
const FILE_NAME = "engine-v1.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** The fed archive entry for one morning, in the shape the access record expects for an event row. */
function eventsFor(fedLabel) {
  if (!fedLabel) return {};
  return {
    "live.f8-fed-bias": {
      available: fedLabel.available === true,
      statement_date: fedLabel.statement_date || null,
      released_at_utc: fedLabel.released_at_utc || null,
      bias: fedLabel.bias || null,
      direction: Number.isFinite(fedLabel.direction) ? fedLabel.direction : null,
      age_calendar_days: Number.isFinite(fedLabel.age_calendar_days) ? fedLabel.age_calendar_days : null
    }
  };
}

/**
 * Replay every stored morning. `pageMorning` is the same morning decided by `decision_rules_v1` alone, so the
 * invariance comparison is a statement about the engine's arithmetic rather than about the data.
 */
function replayRun(run, options = {}) {
  const rootDir = options.rootDir || ROOT;
  const archive = options.archive || f8.loadArchive({ rootDir });
  const mornings = [];
  const decisions = [];
  const mismatches = [];
  const morningStates = [];
  for (const session of Array.isArray(run.sessions) ? run.sessions : []) {
    const snapshot = {
      date: session.date,
      cutoff_at_utc: session.cutoff_at_utc,
      values: { ...(session.saved_inputs || {}), ...(session.audit_values || {}) },
      input_meta: session.input_meta || []
    };
    const wiring = ruleWiring.evaluate(snapshot);
    const fedLabel = f8.labelAsOf(archive, { cutoffUtc: session.cutoff_at_utc });
    const votes = pageBuilder.signalVotes(session, wiring, fedLabel);
    const gateOpen = wiring.gate?.tradeable === true;
    const gateStatus = wiring.gate?.status || "undefined";
    const events = eventsFor(fedLabel);
    const decided = engine.decide({
      date: session.date,
      cutoff_at_utc: session.cutoff_at_utc,
      votes,
      gateOpen,
      gateStatus,
      session,
      events,
      source: "replay"
    });
    const pageMorning = decision.evaluateMorning({
      date: session.date,
      votes,
      gateOpen,
      gateStatus,
      calendarStaged: decision.CONFIG.event_context.calendar_staged
    });
    for (const field of ["direction", "band", "trade", "eligible", "net_score", "usable_signals", "usable_families"]) {
      if (JSON.stringify(decided.decision[field]) !== JSON.stringify(pageMorning[field])) {
        mismatches.push({ date: session.date, field, engine: decided.decision[field], page: pageMorning[field] });
      }
    }
    decisions.push(decided);
    mornings.push(decided.access);
    morningStates.push(morningState(decided, votes));
  }
  return { decisions, mornings, morningStates, mismatches };
}

/**
 * One morning compressed to what a dashboard needs to explain it: which of the six checks refused, and what each
 * of the twenty-five rows was allowed to do. The strings are positional, in rulebook row order, and the legend
 * beside them in the artefact spells out every code: a reader never has to guess what a letter means.
 */
function morningState(decided, votes) {
  const verdictById = new Map(decided.trace.factor_verdicts.map((verdict) => [verdict.factor_id, verdict]));
  const accessById = new Map((decided.access ? decided.access.factors : []).map((factor) => [factor.id, factor]));
  let states = "";
  let voteChars = "";
  let ageChars = "";
  for (const row of rulebook.ROWS) {
    const verdict = verdictById.get(row.id) || null;
    const record = accessById.get(row.id) || null;
    const ages = record
      ? record.inputs.map((input) => (Number.isFinite(input.staleness_business_days) ? input.staleness_business_days : 0))
      : [];
    const oldest = ages.length ? Math.max(...ages) : 0;
    states += STATE_CODE[verdict ? verdict.state : access.STATES.NOT_READ] || "N";
    const vote = factorVote(votes, row.id);
    voteChars += vote > 0 ? "+" : vote < 0 ? "-" : "0";
    ageChars += String(Math.min(oldest, 9));
  }
  const checks = {};
  for (const check of decided.checks) checks[check.id] = check.passed;
  return {
    date: decided.date,
    outcome: decided.outcome,
    direction: decided.direction,
    band: decided.band,
    band_label: decided.band_label,
    trade: decided.trade,
    checks,
    states,
    votes: voteChars,
    ages: ageChars
  };
}

/** The state codes the artefact stores: one letter per row, in rulebook row order. */
const STATE_CODE = Object.freeze({
  [access.STATES.VALID_UNCHANGED]: "V",
  [access.STATES.VERIFIED_ABSENT]: "A",
  [access.STATES.MISSING_OR_STALE]: "S",
  [access.STATES.NOT_READ]: "N"
});


/** The vote a single row contributed: the mean of the signals it owns, or zero when none of them is usable. */
function factorVote(votes, factorId) {
  const usable = rulebook
    .signalsFor(factorId)
    .map((signalId) => (votes ? votes[signalId] : null))
    .filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  const mean = usable.reduce((total, value) => total + value, 0) / usable.length;
  return mean > 0 ? 1 : mean < 0 ? -1 : 0;
}

/** The rulebook as the dashboard reads it: names, roles, the adjudication's treatment and the owning signals. */
function bookDetail() {
  return {
    version: rulebook.VERSION,
    frozen_on: rulebook.FROZEN_ON,
    rows: rulebook.ROWS.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      role_label: row.role_label,
      treatment: row.adjudication ? row.adjudication.treatment : null,
      disposition: row.adjudication ? row.adjudication.disposition : null,
      verdict: row.adjudication ? row.adjudication.verdict : null,
      inputs: row.inputs,
      signals: rulebook.signalsFor(row.id)
    })),
    signals: decision.SIGNALS.map((signal) => ({
      id: signal.id,
      label: signal.label,
      family_id: signal.family_id,
      family_label: signal.family_label,
      factor_id: signal.factor_id,
      owner: rulebook.ownerOfSignal(signal.id),
      vote_rule: signal.vote_rule,
      source: signal.source
    })),
    families: decision.FAMILIES.map((family) => ({ id: family.id, label: family.label, weight: family.weight })),
    eligibility: decision.CONFIG.eligibility
  };
}


/** The four checks the artefact has to survive before it is written, each stated as a named assertion. */
function assertionsFor({ decisions, mismatches }) {
  const order = engine.CHECKS.map((check) => check.id);
  const sixChecks = decisions.every(
    (decided) => decided.checks.length === 6 && decided.checks.map((check) => check.id).join(",") === order.join(",")
  );
  const silent = decisions.filter(
    (decided) => decided.outcome !== engine.OUTCOMES.ALLOWED && decided.fired_rules.filter((rule) => rule.kind !== "cap").length === 0
  );
  const knownRules = new Set(engine.CHECKS.map((check) => check.id));
  const unknownRules = [...new Set(decisions.flatMap((decided) => decided.fired_rules.map((rule) => rule.rule_id)))].filter(
    (ruleId) => !knownRules.has(ruleId) && !/^CAP-\d+$/.test(ruleId)
  );
  const workedDate = decision.CONFIG.worked_morning.date;
  const proof = decisions.find((decided) => decided.date === workedDate) || null;
  return [
    {
      id: "invariance",
      label: "the engine's arithmetic matches decision_rules_v1 on every morning",
      ok: mismatches.length === 0,
      detail: mismatches.length ? `${mismatches.length} field mismatches, first ${JSON.stringify(mismatches[0])}` : "no mismatches"
    },
    {
      id: "six_checks",
      label: "every morning ran the six checks in the declared order",
      ok: sixChecks,
      detail: `${decisions.length} mornings`
    },
    {
      id: "no_silent_refusal",
      label: "every blocked or abstained morning names the rule that refused it",
      ok: silent.length === 0,
      detail: silent.length ? `${silent.length} silent mornings, first ${silent[0].date}` : "every refusal is attributed"
    },
    {
      id: "proof_morning",
      label: `the worked morning ${workedDate} carries a full trace`,
      ok: Boolean(proof) && proof.trace.factor_verdicts.length === rulebook.ROWS.length && unknownRules.length === 0,
      detail: proof
        ? `${proof.outcome} ${proof.direction} band ${proof.band === null ? "none" : proof.band}, ${proof.trace.factor_verdicts.length} factor verdicts`
        : "the worked morning is missing from the run"
    }
  ];
}

function buildData(options = {}) {
  const runPath = options.runPath || RUN_PATH;
  const run = options.run || readJson(runPath);
  const { decisions, mornings, morningStates, mismatches } = replayRun(run, options);
  const assertions = assertionsFor({ decisions, mismatches });
  const workedDate = decision.CONFIG.worked_morning.date;
  const proof = decisions.find((decided) => decided.date === workedDate) || null;
  return {
    schema_version: "usd-layer1-engine-v1",
    engine_version: engine.VERSION,
    book_version: engine.BOOK_VERSION,
    decision_version: engine.DECISION_VERSION,
    interface_version: engine.INTERFACE_VERSION,
    research_only: true,
    source: path.relative(ROOT, runPath).split(path.sep).join("/"),
    source_generated_at: run.generated_at || null,
    cutoff_contract: {
      local: "05:00 Europe/London",
      endpoint: "05:00 Europe/London the next day",
      zone_source: "usd_session_engine_interface.resolveSession"
    },
    book: rulebook.counts(),
    book_detail: bookDetail(),
    check_contract: engine.CHECKS.map((check) => ({
      id: check.id,
      name: check.name,
      label: check.label,
      on_fail: check.on_fail
    })),
    summary: engine.summarise(decisions),
    access: access.summarise(mornings),
    morning_states: morningStates,
    morning_state_legend: {
      order: "states, votes and ages are positional strings in book_detail.rows order",
      states: {
        V: "valid_unchanged: every reading inside its declared age at the cutoff",
        A: "verified_absent: the clock says the source had released nothing",
        S: "missing_or_stale: at least one input absent, unclocked or older than its declared age",
        N: "not_read: the book does not read this row, or the row marks a window"
      },
      votes: { "+": "the row's signals net bullish USD", "-": "the row's signals net bearish USD", "0": "no usable signal, or they cancel" },
      ages: "oldest input staleness in business days, capped at 9",
      checks: "E1 to E6, true when the check passed, false when it fired, null when it did not apply"
    },
    assertions,
    proof_morning: proof
      ? {
          date: proof.date,
          cutoff_at_utc: proof.cutoff_at_utc,
          outcome: proof.outcome,
          direction: proof.direction,
          band: proof.band,
          band_label: proof.band_label,
          trade: proof.trade,
          checks: proof.checks,
          fired_rules: proof.fired_rules,
          coverage: proof.coverage,
          blockers: proof.blockers,
          factor_states: proof.trace.factor_verdicts,
          note: "one worked morning, kept whole so a reader can re-derive the answer without rerunning the script"
        }
      : null,
    fired_rule_log: decisions.map((decided) => ({
      date: decided.date,
      outcome: decided.outcome,
      direction: decided.direction,
      band: decided.band,
      trade: decided.trade,
      fired_rules: decided.fired_rules.map((rule) => ({
        rule_id: rule.rule_id,
        kind: rule.kind,
        reason: rule.reason.length > 240 ? `${rule.reason.slice(0, 237)}...` : rule.reason,
        factor_ids: rule.factor_ids
      }))
    })),
    scope:
      "Replay of the checked-in run artefact through one engine. It proves the two paths share the six checks; it " +
      "does not prove live deployment, causal feature timing or trading edge."
  };
}


function serialise(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function build({ write = false } = {}) {
  const data = buildData();
  const text = serialise(data);
  if (write) fs.writeFileSync(OUT_PATH, text, "utf8");
  return { data, text, outPath: OUT_PATH };
}

function check() {
  const data = buildData();
  const text = serialise(data);
  const current = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, "utf8") : null;
  const drift = [];
  if (current === null) drift.push(`${FILE_NAME} is missing`);
  else if (current !== text) drift.push(`${FILE_NAME} does not match a fresh replay`);
  const failed = data.assertions.filter((assertion) => !assertion.ok);
  if (failed.length) drift.push(`assertions failed: ${failed.map((assertion) => assertion.id).join(", ")}`);
  return { ok: drift.length === 0, drift, data };
}

if (require.main === module) {
  const write = process.argv.includes("--write");
  const verify = process.argv.includes("--check");
  if (!write && !verify) {
    console.error("usage: node backtester/scripts/run_usd_l1_engine_v1.js --write|--check");
    process.exitCode = 2;
  } else if (write) {
    const result = build({ write: true });
    const failed = result.data.assertions.filter((assertion) => !assertion.ok);
    console.log(
      `wrote ${path.relative(ROOT, result.outPath)}: ${result.data.summary.mornings} mornings, ` +
        `${result.data.summary.outcomes.allowed} allowed, ${result.data.summary.outcomes.blocked} blocked, ` +
        `${result.data.summary.outcomes.abstained} abstained`
    );
    for (const assertion of failed) console.error(`assertion failed: ${assertion.id} - ${assertion.detail}`);
    if (failed.length) process.exitCode = 1;
  } else {
    const result = check();
    if (result.ok) {
      console.log(`current: ${FILE_NAME}`);
    } else {
      console.error(`stale: ${result.drift.join(", ")}`);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  FILE_NAME,
  OUT_PATH,
  RUN_PATH,
  ROOT,
  replayRun,
  morningState,
  bookDetail,
  assertionsFor,
  buildData,
  serialise,
  build,
  check
};

