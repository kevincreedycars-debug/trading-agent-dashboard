/**
 * The two model declarations the Layer 1 backtesting area starts with.
 *
 * A model here is a declaration, not an engine: `gate`, `checkChain` and `policy` are read by
 * lib/layer1_backtesting/engine.js, which is the only code that turns them into a decision record. The
 * control replays the production USD model exactly as the published run did; the candidate replays the
 * frozen 25-row USD book (engine v1 / decision rules v1.0.0). Adding a second asset means adding a
 * declaration of this shape, not a second backtester.
 *
 * Research only. Nothing here reads the network or a production path.
 */
"use strict";

const CONTROL_ID = "usd_control_v1";
const CANDIDATE_ID = "usd_candidate_25f_v1";
const SESSION_CONTRACT = "05:00 Europe/London to 05:00 the next local day (a 24-hour window, DST-following)";

const CHECK_NAMES = {
  E1: "cutoff: the session is the 05:00-London window and no reading is stamped after its cutoff",
  E2: "gate: the RG-4 volatility gate is defined and open at the cutoff",
  E3: "provenance: every vote belongs to exactly one direction row that may vote this morning",
  E4: "coverage: enough of the book is readable for the decision file's eligibility rule",
  E5: "call: the family vote leaves the 0.20 deadband and nets away from zero",
  E6: "trade: the provisional trade rule is met (event family readable, all twelve signals usable)",
};

function indexByDate(rows) {
  const map = new Map();
  for (const row of rows || []) map.set(row.date, row);
  return map;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Build both declarations from the published artefacts, so versions, thresholds and requirement rows are
 * never retyped here.
 *
 * @param {object} options
 * @param {object} options.run the published run-v1 artefact
 * @param {object} options.engine the published engine-v1 artefact
 * @returns {{control: object, candidate: object, h1: object|null, all: object[]}}
 */
function createModels({ run, engine, h1 = null }) {
  if (!run || !engine) throw new Error("models: run and engine artefacts are required");
  const days = indexByDate(run.validity_gate && run.validity_gate.days);
  const mornings = indexByDate(engine.morning_states);
  const unresolved =
    (run.validity_gate && run.validity_gate.intended_model && run.validity_gate.intended_model.unresolved) || [];
  const currentVersion = (run.run && run.run.current_model_version) || "production USD model";
  const book = engine.book || {};
  const decisionVersion = engine.decision_version || "usd-l1-decision-rules-v0";

  function dayFor(session) {
    const day = days.get(session.date);
    if (!day) throw new Error(`models: no validity-gate row for ${session.date}`);
    return day;
  }

  function morningFor(session) {
    const morning = mornings.get(session.date);
    if (!morning) throw new Error(`models: no engine morning for ${session.date}`);
    return morning;
  }

  const control = {
    id: CONTROL_ID,
    label: "Production control (current USD model, replayed)",
    short_label: "Production control",
    role: "control",
    asset: "USD",
    session: SESSION_CONTRACT,
    version: currentVersion,
    rulebook_version: (run.run && run.run.rulebook_version) || "agent_usd_direction.md",
    research_only: true,
    identity: () => ({
      status: "PROVISIONAL_BASELINE",
      note: "published provisionally: presence and freshness only, no verified 05:00 receipt",
      unresolved: [],
    }),
    evidence: [
      { path: "data/usd-layer1-backtester/run-v1.json", role: "published control decisions and outcomes" },
      { path: "backtester/replay/usd/usd_replay_core.js", role: "the production baseline's own replay code" },
    ],

    /**
     * The control's declared gate is deliberately narrow: presence and freshness of its inputs. It is the gate
     * the published provisional numbers already rest on, and it is labelled as such rather than upgraded.
     */
    gate(session) {
      const day = dayFor(session);
      const missing = (day.missing || []).slice();
      const stale = (day.stale || []).slice();
      const ready = day.data_gate !== "insufficient_data";
      return {
        basis: "presence and freshness (declared narrow gate)",
        code: ready ? "data_present_and_fresh" : "insufficient_data",
        ready,
        data_gate: day.data_gate || null,
        rungs: {
          present: missing.length === 0,
          fresh: stale.length === 0,
          clocked: "not_required",
          identified: "not_required",
        },
        missing,
        stale,
        unclocked: (day.unclocked || []).slice(),
        wrong_instrument: (day.wrong_instrument || []).slice(),
        reasons: ready ? [] : [day.reason || "a required input was missing or stale"],
      };
    },

    checkChain: [
      {
        id: "C1",
        name: "session contract: a 24-hour window that closes at the next 05:00 London",
        on_fail: "block",
        evaluate(session) {
          const start = Date.parse(session.cutoff_at_utc);
          const end = Date.parse(session.endpoint_at_utc);
          const hours = (end - start) / 3600000;
          return {
            passed: Number.isFinite(hours) && Math.round(hours) === 24,
            detail: `window is ${Number.isFinite(hours) ? Math.round(hours) : "unknown"} hours`,
          };
        },
      },
      {
        id: "C2",
        name: "snapshot: at least one model input was present at the cutoff",
        on_fail: "block",
        evaluate(session) {
          const current = (session.run && session.run.models && session.run.models.current) || {};
          const live = finite(current.factors_live) ? current.factors_live : 0;
          const values = Object.values(session.inputs || {}).filter(finite).length;
          return {
            passed: live > 0 && values > 0,
            detail: `${live} live factors, ${values} finite inputs on the saved snapshot`,
          };
        },
      },
      {
        id: "C3",
        name: "no future print: every input was printed at or before the cutoff",
        on_fail: "block",
        evaluate(session) {
          const cutoff = String(session.cutoff_at_utc || "");
          const offenders = (session.input_meta || [])
            .filter((row) => Array.isArray(row) && row[1] && String(row[1]).slice(0, 10) > cutoff.slice(0, 10))
            .map((row) => `${row[0]} printed ${row[1]}`);
          return {
            passed: offenders.length === 0,
            detail: offenders.length
              ? `${offenders.length} inputs are stamped after the cutoff`
              : "no print is stamped after the cutoff",
            offenders,
          };
        },
      },
      {
        id: "C4",
        name: "version stamped: the decision names the model and rulebook it came from",
        on_fail: "block",
        evaluate(session) {
          const current = (session.run && session.run.models && session.run.models.current) || {};
          const stamped = Boolean(currentVersion) && Boolean(current.direction);
          return { passed: stamped, detail: stamped ? `stamped ${currentVersion}` : "no version stamp" };
        },
      },
    ],

    policy(session) {
      const current = (session.run && session.run.models && session.run.models.current) || {};
      const direction = current.direction || "NO_CALL";
      const conviction = finite(current.conviction) ? current.conviction : null;
      const eligible = direction !== "NO_CALL" && conviction !== null && conviction >= 3;
      const reasons = [];
      if (direction === "NO_CALL") {
        reasons.push({
          code: "no_clear_bias",
          text: current.reason || "the current model returned NO_CLEAR_BIAS on this snapshot",
        });
      } else if (!eligible) {
        reasons.push({
          code: "below_trade_band",
          text: `conviction ${conviction} is below the production trade band of 3; the call is recorded, not traded`,
        });
      }
      return {
        direction,
        conviction,
        band: conviction,
        trade: eligible,
        eligibility: {
          eligible,
          min_conviction: 3,
          rule: "production conviction band 3 or higher, with a directional call",
          note: "a production band, not a validated edge",
        },
        reasons,
      };
    },
  };

  function satRaw(morning, id) {
    return Boolean(morning.checks && morning.checks[id] === true);
  }

  const candidate = {
    id: CANDIDATE_ID,
    label: "Legacy USD 25-factor book v1.0.0 (usd_candidate_25f_v1, not H1)",
    short_label: "Legacy book v1.0.0 (not H1)",
    role: "candidate",
    asset: "USD",
    session: SESSION_CONTRACT,
    version: `${book.version || "usd-l1-book-v1.0.0"} / ${decisionVersion}`,
    rulebook_version: (engine.book_detail && engine.book_detail.version) || book.version || null,
    research_only: true,
    identity: () => ({
      status: "CONFIG_BLOCKED",
      note:
        "the intended 25-factor agent has no single defined rule set; every morning is scored by the implemented book and none of those scores is a valid call for the intended model",
      unresolved: unresolved.slice(),
    }),
    evidence: [
      { path: "data/usd-layer1-backtester/engine-v1.json", role: "per-morning states, votes, checks and outcomes" },
      { path: "config/usd_l1_factor_rulebook_v1.json", role: "the frozen 25-row rulebook" },
      { path: "config/usd_l1_decision_rules_v1.json", role: "the frozen decision rules v1.0.0" },
    ],

    /**
     * The implemented book gates itself with E1-E4, so the declaration adds no second gate: it records how the
     * morning was admitted and carries the identity block separately, where it cannot be confused with data.
     */
    gate(session) {
      const day = dayFor(session);
      return {
        basis: "the book's own six checks (E1-E4 block, E5-E6 abstain)",
        code: "book_checks",
        ready: true,
        data_gate: day.implemented || null,
        intended: day.intended || null,
        rungs: {
          present: !(day.missing || []).length,
          fresh: !(day.stale || []).length,
          clocked: "not_recorded",
          identified: false,
        },
        missing: (day.missing || []).slice(),
        stale: (day.stale || []).slice(),
        unclocked: (day.unclocked || []).slice(),
        wrong_instrument: (day.wrong_instrument || []).slice(),
        reasons: [],
      };
    },

    checkChain: ["E1", "E2", "E3", "E4", "E5", "E6"].map((id) => ({
      id,
      name: CHECK_NAMES[id],
      on_fail: id === "E5" || id === "E6" ? "abstain" : "block",
      evaluate(session) {
        const morning = morningFor(session);
        const passed = morning.checks ? morning.checks[id] : null;
        const fired = (((session.fired && session.fired.fired_rules) || []).find((rule) => rule.rule_id === id)) || null;
        return {
          passed: passed === undefined ? null : passed,
          detail: fired
            ? fired.reason
            : passed === true
              ? "the check passed"
              : passed === false
                ? "the check did not pass on this morning"
                : "the check did not apply on this morning: the artefact carries no reading for it",
          offenders: fired ? fired.factor_ids || [] : [],
          rule_ids: fired ? [fired.rule_id] : [],
        };
      },
    })),

    policy(session) {
      const morning = morningFor(session);
      const band = morning.band === undefined ? null : morning.band;
      const direction = morning.direction || "NO_CALL";
      const tradeRuleMet = satRaw(morning, "E6");
      const eligible = direction !== "NO_CALL" && band !== null && band >= 3 && tradeRuleMet;
      const reasons = [];
      if (direction === "NO_CALL") {
        reasons.push({
          code: "deadband_or_zero",
          text: "the family vote sits inside the 0.20 deadband or nets exactly zero",
        });
      } else if (!eligible) {
        reasons.push({
          code: "trade_rule_not_met",
          text: "the provisional trade rule needs band 3 or higher, a readable event family and all twelve signals usable",
        });
      }
      return {
        direction,
        conviction: band,
        band,
        trade: eligible,
        eligibility: {
          eligible,
          min_band: 3,
          requires: ["RG-4 gate open", "event family readable", "all twelve signals usable", "band 3 or higher"],
          note: "provisional and research-only; no sizing, entry, stop or live execution is defined",
        },
        reasons,
      };
    },
  };

  return { control, candidate, h1, all: h1 ? [control, candidate, h1] : [control, candidate] };
}

module.exports = { createModels, CONTROL_ID, CANDIDATE_ID, SESSION_CONTRACT };
