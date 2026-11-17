/**
 * Data readiness for the Layer 1 backtest.
 *
 * Readiness is not the model's opinion: it is whether the declared inputs for the intended model were present,
 * fresh, clocked and named at the cutoff. This file reports that four-rung ladder per model per morning, joins
 * every missing field to the factor rows that read it, and states what has to be obtained.
 *
 * The distinction the report must keep: a blocked morning is a gap in the evidence; an abstention is a book that
 * had the evidence and chose not to call. They are never merged.
 *
 * Research only.
 */
"use strict";

const RUNGS = ["present", "fresh", "clocked", "identified"];

function indexRequirements(table) {
  const byField = new Map();
  for (const row of table || []) {
    for (const field of row.fields || []) {
      if (!byField.has(field)) byField.set(field, []);
      byField.get(field).push({
        factor_id: row.factor_id,
        label: row.label,
        role: row.role,
        role_label: row.role_label,
        source: row.source,
        missing_action: row.missing_action,
        candidate: row.candidate,
      });
    }
  }
  return byField;
}

function explainFields(fields, byField) {
  return (fields || []).map((field) => ({
    field,
    factors: (byField.get(field) || []).map((factor) => factor.factor_id),
    obtain: (byField.get(field) || []).map((factor) => ({
      factor: factor.factor_id,
      source: factor.source,
      action: factor.missing_action,
      candidate: factor.candidate,
    })),
  }));
}

/**
 * One morning for one model.
 *
 * @param {object} day the validity-gate row for the date
 * @param {object} morning the engine morning row for the date (candidate only)
 * @param {Map} byField requirement rows indexed by input field
 * @param {"control"|"candidate"} modelId
 */
function readinessForDay(day, morning, byField, modelId) {
  const missing = (day.missing || []).slice();
  const stale = (day.stale || []).slice();
  const unclocked = (day.unclocked || []).slice();
  const wrongInstrument = (day.wrong_instrument || []).slice();
  const detail = explainFields([...new Set([...missing, ...stale, ...unclocked])], byField);

  if (modelId === "control") {
    const ready = day.data_gate !== "insufficient_data";
    return {
      date: day.date,
      model: "control",
      status: ready ? "ready" : "blocked",
      code: ready ? day.data_gate : "insufficient_data",
      reason: ready ? null : day.reason || "a required input was missing or older than its freshness limit",
      rungs: {
        present: missing.length === 0,
        fresh: stale.length === 0,
        clocked: "not_required",
        identified: "not_required",
      },
      missing,
      stale,
      unclocked,
      wrong_instrument: wrongInstrument,
      missing_detail: detail,
    };
  }

  // The candidate: the intended model is undefined on every morning, so the strict gate is never open.
  const intended = day.intended || "undefined_rule";
  const blockedChecks =
    morning && morning.checks ? ["E1", "E2", "E3", "E4"].filter((id) => morning.checks[id] === false) : [];
  return {
    date: day.date,
    model: "candidate",
    status: "blocked",
    code: intended,
    reason:
      intended === "undefined_rule"
        ? "the intended 25-factor model has no defined rule on this morning, so no reading can make it valid"
        : day.reason || "the strict gate is not open",
    rungs: {
      present: missing.length === 0,
      fresh: stale.length === 0,
      // No receipt archive exists, so the clock rung cannot pass on any morning: it is unrecorded, not passed.
      clocked: false,
      identified: false,
    },
    blocked_checks: blockedChecks,
    missing,
    stale,
    unclocked,
    wrong_instrument: wrongInstrument,
    missing_detail: detail,
  };
}

function countBy(list, key) {
  const map = new Map();
  for (const item of list) map.set(item[key], (map.get(item[key]) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

/**
 * Build the readiness section: the ladder, per-model counts, the datasets that block the most mornings, one
 * worked blocked morning, and one valid abstention for contrast.
 */
function buildReadiness({ run, engine }) {
  const table = (run.validity_gate && run.validity_gate.requirement_table) || [];
  const byField = indexRequirements(table);
  const days = (run.validity_gate && run.validity_gate.days) || [];
  const mornings = new Map((engine.morning_states || []).map((morning) => [morning.date, morning]));

  const rowsByModel = { control: [], candidate: [] };
  for (const day of days) {
    rowsByModel.control.push(readinessForDay(day, mornings.get(day.date), byField, "control"));
    rowsByModel.candidate.push(readinessForDay(day, mornings.get(day.date), byField, "candidate"));
  }

  const datasetCounts = new Map();
  for (const day of days) {
    for (const field of new Set(day.missing || [])) {
      if (!datasetCounts.has(field)) datasetCounts.set(field, { field, count: 0, factors: new Set() });
      const entry = datasetCounts.get(field);
      entry.count += 1;
      for (const factor of byField.get(field) || []) entry.factors.add(factor.factor_id);
    }
  }
  const datasets = [...datasetCounts.values()]
    .map((entry) => ({
      field: entry.field,
      mornings: entry.count,
      factors: [...entry.factors],
      obtain: explainFields([entry.field], byField)[0].obtain,
    }))
    .sort((a, b) => b.mornings - a.mornings);

  // The worked blocked morning: the first morning with a wide gap, so the explanation has something to name.
  const worked =
    rowsByModel.candidate.find((row) => row.missing.length >= 6 && (row.blocked_checks || []).includes("E2")) ||
    rowsByModel.candidate.find((row) => row.missing.length > 0) ||
    rowsByModel.candidate[0];

  // The contrast: a morning the book abstained on with every blocking check passed.
  const abstentionMorning = (engine.morning_states || []).find(
    (morning) =>
      morning.outcome === "abstained" &&
      ["E1", "E2", "E3", "E4"].every((id) => morning.checks && morning.checks[id] === true)
  );
  const abstentionDay = abstentionMorning ? days.find((day) => day.date === abstentionMorning.date) : null;

  return {
    as_of: {
      first_date: days.length ? days[0].date : null,
      last_date: days.length ? days[days.length - 1].date : null,
      sessions: days.length,
    },
    ladder: RUNGS.map((rung) => {
      const published = ((run.validity_gate && run.validity_gate.ladder) || []).filter(
        (entry) => entry.rung === rung && entry.scope === "sessions"
      )[0];
      return {
        rung,
        passing: published ? published.sessions_passing : null,
        sessions: published ? published.sessions : days.length,
        meaning: {
          present: "the field exists on the morning",
          fresh: "the print is inside the freshness its release allows",
          clocked: "a receipt proves the value was in hand at 05:00",
          identified: "the print names the instrument and the source",
        }[rung],
      };
    }),
    by_model: {
      control: {
        ready: rowsByModel.control.filter((row) => row.status === "ready").length,
        blocked: rowsByModel.control.filter((row) => row.status === "blocked").length,
        gate: "presence and freshness",
        note: "the narrow gate the published provisional numbers rest on",
      },
      candidate: {
        ready: rowsByModel.candidate.filter((row) => row.status === "ready").length,
        blocked: rowsByModel.candidate.filter((row) => row.status === "blocked").length,
        gate: "present + fresh + clocked + identified",
        note: "the strict gate the research requires; no morning passes it",
      },
    },
    reasons: countBy(rowsByModel.candidate, "code"),
    datasets,
    worked_morning: worked
      ? {
          ...worked,
          engine_outcome: mornings.get(worked.date) ? mornings.get(worked.date).outcome : null,
          engine_checks: mornings.get(worked.date) ? mornings.get(worked.date).checks : null,
          explain: [
            "The morning is blocked because the value the model would have read was not in hand at the cutoff, not because the model disliked the answer.",
            "The nine saved inputs are all the as-of frame carried; the rest of the required set is absent from the archive entirely.",
            "Closing the gap needs the prints listed against each field, dated before the cutoff, with a receipt that proves the 05:00 arrival.",
          ],
        }
      : null,
    contrast: abstentionMorning
      ? {
          date: abstentionMorning.date,
          direction: abstentionMorning.direction,
          band: abstentionMorning.band,
          band_label: abstentionMorning.band_label,
          trade: abstentionMorning.trade,
          checks: abstentionMorning.checks,
          readiness: abstentionDay ? readinessForDay(abstentionDay, abstentionMorning, byField, "control") : null,
          explain:
            "Every blocking check passed and the book still did not trade: the vote was directional but the band sat under the trade floor. This is an abstention, not a blocked morning, and it counts as evidence rather than as a gap.",
        }
      : null,
  };
}

module.exports = { RUNGS, buildReadiness, readinessForDay, indexRequirements, explainFields };
