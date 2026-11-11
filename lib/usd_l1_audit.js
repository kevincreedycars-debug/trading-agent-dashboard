/**
 * The 25-factor morning audit, shared by the research engine and the dashboard panel.
 *
 * One morning, twenty-five registered factors, one explicit status each: did this factor move the call,
 * was it read but inside its threshold, was its input missing or stale at the cutoff, is it counted through
 * another factor, or did the research deliberately exclude it? The same function answers that question in
 * the run (so the artefact's aggregate counts and the panel's per-date table cannot disagree) and in the
 * browser (so any of the 725 sessions can be opened, not only the days that were worked by hand).
 *
 * Nothing here decides a rule. The thresholds and treatments are the frozen ones written in
 * `backtester/lib/usd_layer1_backtester/` and shipped in the artefact's factor spec; this file only reads
 * them against one session's saved values and the challenger's own votes.
 *
 * Research only. No network, no warehouse, no production path.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.UsdL1Audit = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AUDIT_VERSION = "usd-l1-audit-v1";

  /**
   * The status vocabulary. `kind` groups the six classes the brief asks to be kept apart: a directional
   * reading, a neutral one, missing or stale data, a factor counted elsewhere, a deliberate exclusion and
   * the data-quality gate. `tone` is the panel's colour token, not a judgement.
   */
  const STATUS = {
    voted_bull: { label: "Voted bullish USD", short: "bullish", tone: "bull", kind: "direction" },
    voted_bear: { label: "Voted bearish USD", short: "bearish", tone: "bear", kind: "direction" },
    no_trigger: { label: "Read, threshold not met", short: "no trigger", tone: "flat", kind: "neutral" },
    missing: { label: "Missing at the cutoff", short: "missing", tone: "missing", kind: "data" },
    no_input: { label: "No input exists for it", short: "no input", tone: "missing", kind: "data" },
    counted_elsewhere: { label: "Counted through another factor", short: "counted elsewhere", tone: "muted", kind: "combined" },
    excluded: { label: "Deliberately excluded", short: "excluded", tone: "muted", kind: "excluded" },
    gate_passed: { label: "Gate passed", short: "gate passed", tone: "flat", kind: "gate" },
    gate_blocked: { label: "Gate blocked the call", short: "gate blocked", tone: "warn", kind: "gate" }
  };

  /** The order the table prints in: readings first, then the data problems, then the non-reads. */
  const STATUS_ORDER = Object.freeze([
    "voted_bull",
    "voted_bear",
    "no_trigger",
    "gate_passed",
    "gate_blocked",
    "missing",
    "no_input",
    "counted_elsewhere",
    "excluded"
  ]);

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function round(value, decimals = 4) {
    if (!isNumber(value)) return null;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  function formatValue(value) {
    if (!isNumber(value)) return "n/a";
    const magnitude = Math.abs(value);
    const decimals = magnitude >= 1000 ? 0 : magnitude >= 100 ? 1 : magnitude >= 1 ? 2 : 4;
    return String(Number(value.toFixed(decimals)));
  }

  /**
   * Values and print metadata for one session.
   *
   * The engine saves every value it read (`saved_inputs`), the audit-only values (`audit_values`), and a
   * metadata row per input (`input_meta` = [key, print_date, staleness_business_days, source_id]). A value
   * without metadata is still usable, but then its staleness is unknown and the audit says so rather than
   * guessing zero.
   */
  function readSession(session) {
    const values = Object.assign({}, (session && session.audit_values) || {}, (session && session.saved_inputs) || {});
    const meta = new Map();
    for (const entry of asArray(session && session.input_meta)) {
      if (!Array.isArray(entry) || !entry[0]) continue;
      meta.set(entry[0], {
        print_date: entry[1] || null,
        staleness_business_days: isNumber(entry[2]) ? entry[2] : null,
        source_id: isNumber(entry[3]) ? entry[3] : null
      });
    }
    const mechanisms = new Map();
    const call = session && session.models ? session.models.challenger_v1 || null : null;
    for (const entry of asArray(call && call.mechanisms)) {
      if (!Array.isArray(entry) || !entry[0]) continue;
      mechanisms.set(entry[0], { id: entry[0], value: entry[1], vote: entry[2], weight: entry[3] });
    }
    return { values, meta, mechanisms, call };
  }

  function readingFor(spec, session) {
    const mechanism = session.mechanisms.get(spec.id) || null;
    return {
      id: spec.id,
      label: spec.label || spec.id,
      input: spec.input,
      rule: spec.rule || null,
      threshold: spec.threshold || null,
      value: mechanism ? mechanism.value : null,
      vote: mechanism ? mechanism.vote : null,
      weight: mechanism ? mechanism.weight : null,
      live: Boolean(mechanism && isNumber(mechanism.value))
    };
  }

  function inputFor(spec, session) {
    const value = session.values[spec.key];
    const meta = session.meta.get(spec.key) || null;
    const staleness = meta ? meta.staleness_business_days : null;
    return {
      key: spec.key,
      value: isNumber(value) ? value : null,
      print_date: meta ? meta.print_date : null,
      staleness_business_days: staleness,
      fresh_business_days: isNumber(spec.fresh_business_days) ? spec.fresh_business_days : null,
      stale: isNumber(staleness) && isNumber(spec.fresh_business_days) ? staleness > spec.fresh_business_days : false,
      source: spec.source || null,
      source_id: meta ? meta.source_id : null,
      present: isNumber(value)
    };
  }

  /**
   * One factor's status for one morning.
   *
   * Order matters. A deliberate exclusion stays an exclusion even on a day when the input happened to be
   * present, and a data absence is reported as missing even when the factor is wired into a mechanism, so
   * "not read" and "could not be read" never look the same.
   */
  function auditFactor(factor, session) {
    const inputs = asArray(factor.inputs).map((spec) => inputFor(spec, session));
    const readings = asArray(factor.mechanisms).map((spec) => readingFor(spec, session));
    const live = readings.filter((reading) => reading.live);
    const net = round(
      live.reduce(
        (total, reading) => total + (isNumber(reading.vote) ? reading.vote : 0) * (isNumber(reading.weight) ? reading.weight : 1),
        0
      ),
      4
    );
    const missingInputs = inputs.filter((input) => !input.present);
    const staleInputs = inputs.filter((input) => input.stale);
    const flags = [];
    if (staleInputs.length) flags.push("stale_print");
    if (missingInputs.length && missingInputs.length < inputs.length) flags.push("partial_data");

    const readingLine = live.length
      ? live
          .map(
            (reading) =>
              `${reading.id} ${reading.vote > 0 ? "+1" : reading.vote < 0 ? "-1" : "0"} (${reading.input} ${formatValue(reading.value)})`
          )
          .join("; ")
      : "";

    let status = "no_input";
    let detail = "";

    if (factor.treatment === "excluded") {
      status = "excluded";
      detail = factor.reason || "The research records this factor as a deliberate exclusion.";
    } else if (factor.treatment === "counted_elsewhere") {
      const carrier = asArray(factor.mechanisms).map((spec) => spec.id).join(" and ") || "another factor's mechanism";
      if (live.length || inputs.some((input) => input.present)) {
        status = "counted_elsewhere";
        detail = `${readingLine ? `${readingLine}. ` : ""}Read through ${carrier} only, so this morning is not counted twice.`;
      } else {
        status = "missing";
        detail = `No value at the cutoff, and this factor is read through ${carrier} anyway, so nothing stands in for it.`;
      }
    } else if (factor.treatment === "no_call") {
      const blocked = !session.call || session.call.direction === "NO_CALL";
      status = blocked ? "gate_blocked" : "gate_passed";
      detail = session.call
        ? blocked
          ? `The gate stopped the call: ${session.call.reason || "no direction was issued"}`
          : `The gate passed: ${session.call.usable_mechanisms} of ${asArray(session.call.mechanisms).length} mechanisms live, ` +
            `${Math.round((session.call.agreement || 0) * 100)}% agreement, ${Math.round((session.call.participation || 0) * 100)}% participation.`
        : "This morning has no challenger call to gate.";
    } else if (live.length && net !== null && net !== 0) {
      status = net > 0 ? "voted_bull" : "voted_bear";
      detail = `${readingLine}. This factor's net ${net > 0 ? "adds" : "subtracts"} ${formatValue(Math.abs(net))} of the book.`;
    } else if (live.length) {
      status = "no_trigger";
      detail = `${readingLine}. The reading is live but inside its threshold, so it shaped participation, not direction.`;
    } else if (inputs.some((input) => input.present)) {
      status = "no_trigger";
      detail = `A value was available (${inputs
        .filter((input) => input.present)
        .map((input) => input.key)
        .join(", ")}), but no rule reads it here.`;
    } else {
      status = inputs.length ? "missing" : "no_input";
      detail = inputs.length
        ? `No usable value at the cutoff for ${inputs.map((input) => input.key).join(", ")}.`
        : "No staged input exists for this factor at the 05:00 cutoff.";
    }

    if (staleInputs.length) {
      detail += ` Stale print: ${staleInputs
        .map(
          (input) =>
            `${input.key} is ${input.staleness_business_days} business days old against a ${input.fresh_business_days}-day freshness limit`
        )
        .join("; ")}.`;
    }

    const meta = STATUS[status];
    return {
      factor_id: factor.factor_id,
      label: factor.label,
      treatment: factor.treatment,
      gap: factor.gap || null,
      gap_label: factor.gap_label || null,
      disposition: factor.disposition || null,
      document_id: factor.document_id || (factor.document && factor.document.document_id) || null,
      status,
      status_label: meta.label,
      status_short: meta.short,
      tone: meta.tone,
      kind: meta.kind,
      flags,
      net,
      inputs,
      readings,
      detail
    };
  }

  /** Count the statuses, because a morning's audit is a distribution before it is a story. */
  function summarise(rows) {
    const counts = {};
    for (const key of STATUS_ORDER) counts[key] = 0;
    const kinds = { direction: 0, neutral: 0, data: 0, combined: 0, excluded: 0, gate: 0 };
    let staleInputs = 0;
    let factorsWithAValue = 0;
    for (const row of asArray(rows)) {
      counts[row.status] = (counts[row.status] || 0) + 1;
      if (kinds[row.kind] !== undefined) kinds[row.kind] += 1;
      if (asArray(row.flags).includes("stale_print")) staleInputs += 1;
      if (asArray(row.inputs).some((input) => input.present)) factorsWithAValue += 1;
    }
    return {
      counts,
      kinds,
      factors_with_a_value: factorsWithAValue,
      factors_with_a_directional_reading: kinds.direction,
      factors_stale: staleInputs,
      factors: asArray(rows).length
    };
  }

  /**
   * The whole table for one morning.
   *
   * @param {object} options
   * @param {object[]} options.factors the frozen factor spec shipped in the artefact.
   * @param {object} options.session one row from `sessions[]`.
   * @returns {object} the call that was made or declined, the twenty-five rows, and their summary.
   */
  function auditMorning({ factors, session } = {}) {
    if (!session) throw new Error("the audit needs one session");
    if (!asArray(factors).length) throw new Error("the audit needs the factor spec");
    const state = readSession(session);
    const rows = asArray(factors).map((factor) => auditFactor(factor, state));
    const call = state.call || null;
    return {
      version: AUDIT_VERSION,
      date: session.date || null,
      cutoff_at_utc: session.cutoff_at_utc || null,
      endpoint_at_utc: session.endpoint_at_utc || null,
      split: session.split || null,
      model: call ? call.model || "challenger_v1" : null,
      call: call
        ? {
            direction: call.direction,
            conviction: call.conviction,
            usable_mechanisms: call.usable_mechanisms,
            agreement: call.agreement,
            participation: call.participation,
            missing_inputs: asArray(call.missing_inputs),
            reason: call.reason
          }
        : null,
      rules: {
        fired: rows
          .filter((row) => row.status === "voted_bull" || row.status === "voted_bear")
          .map((row) => ({ factor_id: row.factor_id, label: row.label, net: row.net })),
        held_back: rows.filter((row) => row.status === "no_trigger").map((row) => row.factor_id),
        gate: rows.filter((row) => row.status === "gate_blocked" || row.status === "gate_passed").map((row) => row.factor_id)
      },
      rows,
      summary: summarise(rows)
    };
  }

  return {
    AUDIT_VERSION,
    STATUS,
    STATUS_ORDER,
    auditFactor,
    auditMorning,
    summarise,
    readSession
  };
});
