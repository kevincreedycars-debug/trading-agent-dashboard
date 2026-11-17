/**
 * The five separate counts for OD-5, and the overlap between the two candidate call sets.
 *
 * `scheduled` is every morning the run covers. `reconstructed` is the coverage table's call count: what the
 * published replay rebuilt from stored inputs. `valid` is the strict evidence gate. `directional` is the engine's
 * gate-respecting call. `scored` is the denominator the published test actually used. They are different
 * populations and they are never added, subtracted or described as one another.
 *
 * Research only.
 */
"use strict";

const PUBLISHED_KEY = { control: "current", candidate: "challenger_v1" };

function measureFor(tests, testId, label) {
  const test = (tests.tests || []).find((entry) => entry.id === testId);
  if (!test) return null;
  return (test.measures || []).find((entry) => entry.label === label) || null;
}

function groupReasons(rows) {
  const counts = {};
  for (const row of rows) {
    const codes = (row.reasons || []).map((reason) => reason.code).join("+") || "no_reason";
    const key = `${row.outcome}:${codes}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function spanOf(dates) {
  return { count: dates.length, first: dates[0] || null, last: dates[dates.length - 1] || null };
}

function strictReady(readiness, role) {
  const rows = (readiness.rows && readiness.rows[role]) || [];
  if (rows.length) {
    return rows.filter((row) => row.status === "ready" && row.rungs && row.rungs.clocked === true && row.rungs.identified === true).length;
  }
  const ladder = readiness.ladder || [];
  const clocked = (ladder.find((rung) => rung.rung === "clocked") || {}).passing;
  const identified = (ladder.find((rung) => rung.rung === "identified") || {}).passing;
  return clocked === 0 || identified === 0 ? 0 : null;
}

/**
 * @param {object} options
 * @param {object} options.run the published run artefact
 * @param {object} options.decisions the engine's decisions for both models
 * @param {object} options.readiness the readiness section
 * @param {object} options.tests the four tests
 */
function buildCoverageTrace({ run, decisions, readiness, tests }) {
  const sessions = run.sessions || [];
  const coverage = (run.coverage && run.coverage.by_model) || {};
  const byModel = {};

  for (const [role, publishedKey] of Object.entries(PUBLISHED_KEY)) {
    const records = new Map(
      (decisions.records || []).filter((record) => record.model.role === role).map((record) => [record.date, record])
    );
    const reconstructedRows = sessions.filter((session) => {
      const model = (session.models && session.models[publishedKey]) || {};
      return model.direction && model.direction !== "NO_CALL";
    });
    const directionalRows = sessions
      .map((session) => records.get(session.date))
      .filter((record) => record && record.direction && record.direction !== "NO_CALL");
    const reconstructedDates = new Set(reconstructedRows.map((session) => session.date));
    const directionalDates = new Set(directionalRows.map((record) => record.date));
    const reconstructedOnly = [...reconstructedDates]
      .filter((date) => !directionalDates.has(date))
      .map((date) => records.get(date))
      .filter(Boolean);
    const directionalOnly = [...directionalDates].filter((date) => !reconstructedDates.has(date));
    const scored = measureFor(tests, "dxy_direction_broker_cfd", role);
    const table = coverage[publishedKey] || {};

    byModel[role] = {
      model_id: (decisions.by_model[role] || {}).model_id || null,
      label: role,
      role,
      scheduled: sessions.length,
      reconstructed: table.calls_reconstructed === undefined ? null : table.calls_reconstructed,
      reconstructed_pct: table.call_coverage_pct === undefined ? null : table.call_coverage_pct,
      valid_strict: strictReady(readiness, role),
      valid_narrow: role === "control" ? readiness.by_model.control.ready : null,
      directional: directionalDates.size,
      scored: scored ? scored.scored : null,
      scored_hits: scored ? scored.hits : null,
      scored_basis:
        role === "candidate"
          ? "the published broker-proxy test scores the reconstructed calls; 209 of them have a readable outcome, so the scored sample is not the 121 gated calls"
          : "the published broker-proxy test scores the reconstructed control calls with a readable outcome",
      overlap: {
        both: directionalRows.filter((record) => reconstructedDates.has(record.date)).length,
        reconstructed_only: reconstructedOnly.length,
        directional_only: directionalOnly.length,
      },
      reconstructed_only_by_reason: groupReasons(reconstructedOnly),
      directional_only_dates: directionalOnly.slice(0, 20),
      dates: {
        reconstructed: spanOf(reconstructedRows.map((session) => session.date)),
        directional: spanOf(directionalRows.map((record) => record.date)),
      },
      sources: [
        "data/usd-layer1-backtester/run-v1.json -> coverage.by_model",
        `data/usd-layer1-backtester/run-v1.json -> sessions[].models.${publishedKey}.direction`,
        "lib/layer1_backtesting/engine.js -> decide()",
        "data/usd-layer1-backtester/run-v1.json -> tests.dxy_direction_broker_cfd",
      ],
    };
  }

  return {
    definitions: {
      scheduled: "every morning in the run's session list",
      reconstructed: "the coverage table's rebuilt call count: a direction the replay reconstructed from stored inputs",
      valid: "mornings that pass the strict evidence gate: present, fresh, clocked and identified",
      directional: "mornings the decision engine records with a direction other than NO_CALL",
      scored: "mornings that entered the published test's accuracy denominator",
    },
    by_model: byModel,
    narrow_ready_control: readiness.by_model.control.ready,
    strict_rule: "the strict gate requires a 05:00 receipt and a named instrument; neither archive exists, so no morning is valid for either model",
    note:
      "Reconstructed calls and gated directional calls are different populations. The overlap and the exclusions are printed instead of asserting that one contains the other.",
  };
}

module.exports = { buildCoverageTrace, PUBLISHED_KEY };
