/**
 * H1 is a declaration in the shared Layer 1 engine, not a second backtester.
 *
 * The only executable arithmetic in this file is a thin adapter around the supplied candidate model. The
 * shared engine owns the gate, the ordered check chain, the outcome and the immutable record. The candidate's
 * acceptance fixtures are replayed through `engine.decide()` so a fixture passing here proves the registration
 * path, not a private copy of the submission.
 *
 * The historical session list is deliberately blocked by the H1.1 evidence contract: no H1 direction is
 * invented from legacy fields. Research only.
 */
"use strict";

const path = require("node:path");
const util = require("node:util");

const { decide } = require("./engine");
const { loadPackage } = require("./h1_package");

const H1_ID = "usd_l1_25f_h1";
const H1_VERSION = "USD-L1-25F-H1-v0.1.0";
const H1_RULEBOOK = "H1.1 nine-feature evidence contract (supplied RULEBOOK.md)";
const CONTROL_ID = "usd_h1_fixture_control";
const SESSION_CONTRACT = "05:00 Europe/London cutoff to 05:00 the next local day (24 hours, DST-following)";

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function valuesFromInputs(inputs) {
  const out = {};
  for (const key of ["vix", "front", "spread", "real", "broad", "ice", "gold", "qqq", "calendar"]) {
    const row = inputs[key];
    out[key] = row && finite(row.value) ? row.value : null;
  }
  return out;
}

/**
 * The H1.1 data contract, evaluated in input-file order so the first failing obstacle is reproducible.
 *
 * A fixture row carries all three clocks. A historical legacy field does not: this function is only used by
 * the synthetic fixture gate. Historical eligibility comes from the coverage audit, never from legacy values.
 */
function validateInputs(session, inputSpec) {
  const issues = [];
  const cutoff = Date.parse(session.cutoff_at_utc);
  for (const [key, contract] of Object.entries(inputSpec)) {
    const row = session.inputs && session.inputs[key];
    if (!row) {
      issues.push(`${key}: missing`);
      continue;
    }
    const clocks = [row.observed, row.published, row.received].map((value) => Date.parse(value));
    if (!clocks.every(Number.isFinite) || clocks[0] > clocks[1] || clocks[1] > clocks[2] || clocks[2] > cutoff) {
      issues.push(`${key}: invalid or late clock`);
    }
    if (cutoff - clocks[0] > contract[3] * 3600000) issues.push(`${key}: stale`);
    if (contract[0] !== row.source || contract[1] !== row.instrument || contract[2] !== row.transform) {
      issues.push(`${key}: source, instrument or transform mismatch`);
    }
    if (row.original !== true || !finite(row.value)) issues.push(`${key}: unavailable original value`);
  }
  return issues;
}

function fixtureSession(expected, { date, endDate, inputs }) {
  const session = loadSessionResolver();
  const start = session.resolveSession(Date.parse(`${date}T00:00:00Z`));
  const end = session.resolveSession(Date.parse(`${endDate}T00:00:00Z`));
  return {
    asset: "USD",
    date,
    endpoint_date: endDate,
    cutoff_at_utc: start.cutoff_at_utc,
    end_at_utc: end.cutoff_at_utc,
    window_hours: (Date.parse(end.cutoff_at_utc) - Date.parse(start.cutoff_at_utc)) / 3600000,
    inputs,
    evidence: "synthetic fixture",
  };
}

let sessionResolver = null;

/** Resolve the package's own session helper without keeping a second copy of the DST rules. */
function loadSessionResolver() {
  if (!sessionResolver) {
    const packageRoot = path.resolve(__dirname, "../../docs/research/usd-session/h1/v0.1.0/package");
    // eslint-disable-next-line global-require, import/no-dynamic-require
    sessionResolver = require(path.join(packageRoot, "reference/backtester/lib/usd_session_engine_interface.js"));
  }
  return sessionResolver;
}


/**
 * Build the H1 candidate declaration. The declared input contract is the supplied `inputs.json`, not a
 * hand-copied version of it.
 */
function buildH1Model({ packageModel }) {
  const candidate = packageModel.candidate;
  const inputSpec = candidate.inputs;
  return {
    id: H1_ID,
    label: "USD Layer 1 H1 candidate (25-row hypothesis book)",
    role: "candidate",
    asset: "USD",
    session: SESSION_CONTRACT,
    version: H1_VERSION,
    rulebook_version: H1_RULEBOOK,
    research_only: true,
    hypothesis_status: "pre-evaluation; fixture acceptance only",
    input_spec: inputSpec,
    identity: () => ({
      status: "FROZEN_H1_HYPOTHESIS",
      note: "The supplied H1 book is frozen for acceptance. A fixture match is not evidence of historical or live value.",
      unresolved: [
        "historical coverage is unmeasured by the supplied package",
        "sealed live replay has not been observed",
        "control parity on the nine-feature contract is open",
      ],
    }),
    evidence: [
      { path: "docs/research/usd-session/h1/v0.1.0/package/rows.json", role: "frozen 25-row mapping" },
      { path: "docs/research/usd-session/h1/v0.1.0/package/inputs.json", role: "nine-input evidence contract" },
      { path: "docs/research/usd-session/h1/v0.1.0/package/models.js", role: "supplied candidate arithmetic" },
      { path: "docs/research/usd-session/h1/v0.1.0/package/expected.json", role: "acceptance fixtures" },
    ],

    /**
     * A fixture is ready only if all nine synthetic rows carry the exact source, instrument, transform and
     * clocks. A historical morning is ready only if the coverage audit says so; a legacy count never upgrades it.
     */
    gate(session) {
      if (session.evidence === "synthetic fixture") {
        const issues = validateInputs(session, inputSpec);
        return {
          basis: "H1.1 synthetic fixture: all nine source/instrument/transform rows and clocks",
          code: issues.length ? "h1_fixture_evidence_invalid" : "h1_fixture_evidence_valid",
          ready: issues.length === 0,
          data_gate: issues.length ? "insufficient_data" : "complete",
          rungs: {
            present: !issues.some((line) => line.endsWith(": missing")),
            original: !issues.some((line) => line.includes("unavailable original value")),
            lookback: true,
            fresh: !issues.some((line) => line.includes(": stale")),
            clocked: !issues.some((line) => line.includes("clock")),
            receipt: !issues.some((line) => line.includes("clock")),
            identified: !issues.some((line) => line.includes("mismatch")),
          },
          missing: issues.filter((line) => line.endsWith(": missing")).map((line) => line.split(":")[0]),
          stale: issues.filter((line) => line.endsWith(": stale")).map((line) => line.split(":")[0]),
          unclocked: issues.filter((line) => line.includes("clock")).map((line) => line.split(":")[0]),
          wrong_instrument: issues.filter((line) => line.includes("mismatch")).map((line) => line.split(":")[0]),
          issues,
          reasons: issues,
          trace: issues,
        };
      }
      const coverage = session.h1_coverage || {};
      const blockers = coverage.blockers || [];
      const ready = coverage.ready === true;
      return {
        basis: "H1.1 historical evidence contract (instrument, lookback, freshness, 05:00 clocks)",
        code: ready ? "h1_historical_evidence_ready" : "h1_historical_evidence_blocked",
        ready,
        data_gate: ready ? "complete" : "insufficient_data",
        rungs: coverage.rungs || {},
        missing: blockers.map((blocker) => blocker.input),
        stale: [],
        unclocked: blockers.filter((blocker) => blocker.code === "unclocked").map((blocker) => blocker.input),
        wrong_instrument: blockers
          .filter((blocker) => blocker.code === "identity_mismatch")
          .map((blocker) => blocker.input),
        issues: blockers.map((blocker) => `${blocker.input}: ${blocker.code}`),
        reasons: blockers.map((blocker) => blocker.text),
        trace: blockers.map((blocker) => `${blocker.input}: ${blocker.code}`),
      };
    },


    checkChain: [
      {
        id: "C1",
        name: "session contract: a positive 24-hour window from the date's 05:00 London cutoff",
        on_fail: "block",
        evaluate(session) {
          const hours = session.window_hours;
          const passed = finite(hours) && hours > 0;
          return {
            passed,
            detail: passed ? `${hours} hour window ending at the next local 05:00` : "the session window is not positive",
            rule_ids: ["H1.1"],
          };
        },
      },
      {
        id: "H1.2",
        name: "VIX regime gate: VIX at or above 30 abstains",
        on_fail: "abstain",
        evaluate(session, { gate }) {
          if (gate.ready !== true) return { passed: null, detail: "not evaluated: evidence gate is closed", rule_ids: ["H1.2"] };
          const vix = valuesFromInputs(session.inputs).vix;
          const passed = finite(vix) && vix < 30;
          return {
            passed,
            detail: passed ? `VIX ${vix} is below the 30 regime threshold` : `VIX ${vix} is at or above 30`,
            rule_ids: ["H1.2"],
          };
        },
      },
      {
        id: "H1.3",
        name: "deadband: the family score is outside +/-0.20 before a call is published",
        on_fail: "abstain",
        evaluate(session, { gate }) {
          if (gate.ready !== true) return { passed: null, detail: "not evaluated: evidence gate is closed", rule_ids: ["H1.3"] };
          const values = valuesFromInputs(session.inputs);
          if (!Object.values(values).every(finite)) {
            return { passed: null, detail: "not evaluated: an input is missing", rule_ids: ["H1.3"] };
          }
          const native = candidate.decide(values);
          if (native.status === "blocked") {
            return { passed: null, detail: native.trace.join("; "), rule_ids: ["H1.3"] };
          }
          const magnitude = Math.abs(native.trace.score);
          return {
            passed: magnitude >= 0.2,
            detail: `family score ${native.trace.score.toFixed(4)} (|score| ${magnitude.toFixed(4)} against 0.20)`,
            rule_ids: ["H1.3"],
          };
        },
      },
    ],

    policy(session) {
      const values = valuesFromInputs(session.inputs);
      const native = candidate.decide(values);
      const eventGate = finite(values.calendar) && values.calendar > 0;
      return {
        direction: native.direction,
        conviction: native.conviction,
        band: native.conviction,
        trade: native.trade,
        eligibility: {
          eligible: native.trade === true,
          note:
            native.status === "blocked"
              ? "the supplied candidate rejected the value vector"
              : eventGate
                ? "a scheduled release in the session window suppresses trade but not the directional call"
                : native.status === "abstained"
                  ? "the candidate abstained; no trade"
                  : native.trade
                    ? "the candidate's band and event rules allow a trade"
                    : "the candidate's band is below the trade threshold",
        },
        trace: native.trace,
      };
    },
  };
}


/**
 * The fixture control is the production baseline adapter, bound to exactly its four published inputs. It is
 * useful as an arithmetic control only; it does not establish nine-feature parity.
 */
function buildFixtureControl({ packageModel }) {
  const current = packageModel.current;
  const inputSpec = current.inputs;
  return {
    id: CONTROL_ID,
    label: "Fixture control: production USD baseline adapter (four inputs)",
    role: "control",
    asset: "USD",
    session: SESSION_CONTRACT,
    version: current.version,
    rulebook_version: "agent_usd_direction.md",
    research_only: true,
    input_spec: inputSpec,
    identity: () => ({
      status: "FIXTURE_CONTROL_ONLY",
      note: "Four inputs only. The control's gate does not check the other five H1 inputs or the 05:00 receipt clocks.",
      unresolved: ["control parity on the nine-feature H1 contract is OPEN"],
    }),
    evidence: [
      {
        path: "docs/research/usd-session/h1/v0.1.0/package/reference/backtester/lib/usd_layer1_backtester/current_model.js",
        role: "production baseline arithmetic",
      },
      { path: "docs/research/usd-session/h1/v0.1.0/package/expected.json", role: "baseline fixture" },
    ],
    gate(session) {
      if (session.evidence !== "synthetic fixture") {
        return {
          basis: "fixture control only",
          code: "control_not_available_for_historical_h1",
          ready: false,
          data_gate: "insufficient_data",
          rungs: {},
          missing: [],
          stale: [],
          unclocked: [],
          wrong_instrument: [],
          issues: ["the four-input fixture control is not a historical H1 control"],
          reasons: ["the four-input fixture control is not a historical H1 control"],
          trace: [],
        };
      }
      const issues = validateInputs(session, inputSpec);
      return {
        basis: "fixture control: four input rows only",
        code: issues.length ? "fixture_control_invalid" : "fixture_control_valid",
        ready: issues.length === 0,
        data_gate: issues.length ? "insufficient_data" : "complete",
        rungs: { present: issues.length === 0 },
        missing: [],
        stale: [],
        unclocked: [],
        wrong_instrument: [],
        issues,
        reasons: issues,
        trace: issues,
      };
    },
    checkChain: [
      {
        id: "C1",
        name: "fixture session window",
        on_fail: "block",
        evaluate(session) {
          return { passed: finite(session.window_hours) && session.window_hours > 0, detail: "fixture only" };
        },
      },
    ],
    policy(session) {
      const values = valuesFromInputs(session.inputs);
      const native = current.decide(values, session.date);
      return {
        direction: native.direction,
        conviction: native.conviction,
        band: native.conviction,
        trade: native.trade,
        eligibility: { eligible: native.trade === true, note: "fixture arithmetic control; not an H1 decision" },
        trace: native.trace,
      };
    },
  };
}


function fixtureInputs(expected) {
  return clone(expected.fixture.inputs);
}

function recordAsExpected(record, session) {
  const blocked = record.outcome === "blocked";
  return {
    model: record.model.version,
    date: record.date,
    cutoff: session.cutoff_at_utc,
    end: session.end_at_utc,
    evidence: session.evidence,
    status: blocked ? "blocked" : record.outcome === "abstained" ? "abstained" : "directional",
    direction: record.direction === "NO_CALL" ? null : record.direction,
    conviction: record.conviction,
    trade: record.trade_eligible,
    trace: blocked ? record.gate.trace : record.trace,
  };
}

/**
 * Replay the supplied fixtures through the shared engine and compare the full output, including the factor
 * trace, with `expected.json`.
 */
function runH1Fixtures({ root, models }) {
  const { expected } = loadPackage({ root });
  const base = expected.fixture;
  const callInputs = fixtureInputs(expected);
  const abstainInputs = clone(callInputs);
  abstainInputs.vix.value = 30;
  const blockedInputs = clone(callInputs);
  delete blockedInputs.calendar;
  const dstInputs = clone(callInputs);
  const cases = [];
  const add = (id, label, model, inputRows, date = base.date, endDate = base.endDate, expectedValue = expected[id]) => {
    const session = fixtureSession(expected, { date, endDate, inputs: clone(inputRows) });
    const record = decide(model, session);
    const actual =
      id === "dst"
        ? [session.cutoff_at_utc, session.end_at_utc]
        : recordAsExpected(record, session);
    const match = util.isDeepStrictEqual(actual, expectedValue);
    cases.push({
      id,
      label,
      model_id: model.id,
      model_version: model.version,
      date,
      end_date: endDate,
      expected: expectedValue,
      actual,
      match,
      diff: match ? null : { expected: expectedValue, actual },
      fixture_scope: id === "dst" ? "DST cutoff and endpoint only, as published" : "full output and factor trace",
    });
  };

  add("call", "H1 call fixture", models.h1, callInputs);
  add("baseline", "Production baseline on the four shared inputs", models.fixtureControl, callInputs);
  add("abstain", "H1 abstention at VIX 30", models.h1, abstainInputs);
  add("blocked", "H1 blocked when the calendar row is absent", models.h1, blockedInputs);
  add("dst", "Session boundary across the October 2026 DST transition", models.h1, dstInputs, "2026-10-23", "2026-10-26");
  const matched = cases.filter((item) => item.match).length;

  return {
    cases,
    matched,
    total: cases.length,
    status: matched === cases.length ? "ALL_MATCH" : "MISMATCH",
    label: `${matched}/${cases.length} supplied fixtures reproduced through the shared engine`,
    control: {
      model_id: models.fixtureControl.id,
      model_version: models.fixtureControl.version,
      inputs: 4,
      h1_inputs: 9,
      overlapping_inputs: 4,
      parity_status: "OPEN",
      note:
        "The baseline fixture reproduces the production adapter on four inputs. It is not a nine-feature control, and its gate does not check 05:00 receipts.",
    },
    counts_binding: {
      model_id: models.h1.id,
      model_version: models.h1.version,
      run_id: "h1-fixture-replay",
      gate: H1_RULEBOOK,
    },
  };
}

/**
 * Run H1 on every published morning. The coverage audit is the gate, so every record is blocked until real
 * evidence exists. This is what stops a legacy 0/725 or 209-scored count from being reused as H1 evidence.
 */
function decideH1Historical({ run, coverage, model }) {
  const byDate = coverage.byDate;
  const records = [];
  for (const session of run.sessions || []) {
    const cov = byDate.get(session.date);
    if (!cov) throw new Error(`h1 candidate: no coverage row for ${session.date}`);
    records.push(
      decide(model, {
        asset: "USD",
        date: session.date,
        cutoff_at_utc: session.cutoff_at_utc,
        end_at_utc: session.end_at_utc,
        window_hours: session.window_hours,
        inputs: null,
        h1_values: session.h1_values || null,
        input_meta: session.input_meta || null,
        h1_coverage: cov,
        evidence: "historical reconstruction",
      })
    );
  }
  const eligible = records.filter((record) => record.outcome !== "blocked").length;
  return {
    records,
    summary: {
      scheduled: records.length,
      blocked: records.filter((record) => record.outcome === "blocked").length,
      abstained: records.filter((record) => record.outcome === "abstained").length,
      directional: records.filter((record) => record.outcome === "allowed").length,
      eligible,
      trade_eligible: records.filter((record) => record.trade_eligible).length,
      earliest_eligible: eligible ? records.find((record) => record.outcome !== "blocked").date : null,
      performance: "UNSCORED",
      note:
        "Zero H1 decisions are published historically because the H1.1 evidence contract is unmet. The count is a coverage fact, not a model result.",
    },
  };
}

module.exports = {
  CONTROL_ID,
  H1_ID,
  H1_RULEBOOK,
  H1_VERSION,
  SESSION_CONTRACT,
  buildFixtureControl,
  buildH1Model,
  decideH1Historical,
  fixtureSession,
  recordAsExpected,
  runH1Fixtures,
  validateInputs,
  valuesFromInputs,
};
