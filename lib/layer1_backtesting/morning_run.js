"use strict";

/**
 * One dated historical morning, replayed through the same Layer 1 engine.
 *
 * This module is deliberately a report builder, not a second decision engine. The current adapter, the
 * legacy 25-row book and the H1 candidate are declarations in models.js/h1_candidate.js; this file calls
 * engine.decide() and records what each model was allowed to see. It never fills an H1 value from a nearby
 * legacy field and never scores a blocked morning.
 *
 * Research only. It reads committed artefacts and writes a deterministic report.
 */

const fs = require("node:fs");
const path = require("node:path");

const { decide, sha256, stableStringify } = require("./engine");
const { createModels } = require("./models");
const { buildH1Coverage, CONTRACTS, INPUT_ORDER, LABELS, REQUIRED_TYPES } = require("./h1_coverage");
const { buildH1Model, decideH1Historical } = require("./h1_candidate");
const { loadPackage } = require("./h1_package");

const SCHEMA_VERSION = "layer1-morning-run.v1";
const BUILT_ON = "2026-11-17";
const DEFAULT_DATE = "2024-03-26";
const LEGACY_AUDIT = {
  path: "docs/research/usd-session/v1/layer1_backtest_report.md",
  section: "5. Readiness",
  source: "data/usd-layer1-backtester/run-v1.json validity_gate.ladder",
  label: "legacy run-v1 input-clock gate",
  note:
    "The 0 of 725 clocked/identified result belongs to the original run-v1 validity gate. It is not H1 coverage and is not a statement about the H1 candidate.",
};
const EXTERNAL_STATE = {
  verified_on: "2026-11-17",
  supabase: {
    project: "eaolqbrlywczinfordvg",
    reachable: true,
    infrastructure_status:
      "historical warehouse / snapshot builder / replay engine / outcome evaluation / research SQL all Complete; 604 snapshot rows; 2,416 predictions; 12,080 evaluation rows; first 2024-01-02, last 2026-04-30",
    public_view_rows: {
      research_prediction_primary_summary: 5304,
      research_prediction_usd_benchmark_summary: 2416,
      research_usd_24h_direction_accuracy: 1,
      research_accuracy_by_confidence_bucket: 29,
      research_overall_win_rate: 1,
      research_factor_reliability: 69,
      research_dashboard_infrastructure_status: 1,
    },
    newest_primary_snapshot: "2026-04-30",
    blocker:
      "the publishable key can read the public views only; runtime view definitions, grants and the 0-row anonymous base-table reads need a database/service-role connection",
  },
  n8n: {
    host: "silver17.app.n8n.cloud",
    healthz: "HTTP 200",
    history_api: "HTTP 401 Unauthorized for /rest/executions and /rest/workflows",
    blocker: "no n8n API key, session cookie or login is present; run history and schedule state remain unverified",
  },
  usd_24h_research_dataset: {
    schema_version: "usd-24h-research-dataset-v1",
    bytes: 2133936,
    sha256: "03ad563748a72ece6dab41e1915c1d91d37888266c16a5e65fa944afa4664442",
    rows: 584,
    evaluable_rows: 583,
    window: "2024-01-02 to 2026-04-30",
    call_time_et: "09:30:00",
    outcome_instrument: "DXY",
    found_at: [
      "D:/trading-agent-dashboard-codex/.local/worktrees/citation-registry/data/usd-24h-research-dataset.json",
      "D:/trading-agent-dashboard-codex.worktrees/ws-c-research/data/usd-24h-research-dataset.json",
    ],
    blocker:
      "absent from canonical and strategy HEAD; the recovered population is a 09:30 ET DXY study, not a 05:00 London H1 input",
  },
};
const REACH_SUMMARY_PATH = "data/half-l2l-reach-summary.json";


const FACTOR_IDS = {
  F1: "live.f1-vix-level",
  F2: "live.f2-us-2y-delta",
  F3: "live.f3-us-de-2y-spread-delta",
  F4: "live.f4-real-yield-delta",
  F5: "live.f5-dxy-delta",
  F6: "live.f6-gold-delta",
  F7: "live.f7-economic-surprise",
  F8: "live.f8-fed-bias",
  F9: "live.f9-dollar-smile",
  F10: "live.f10-equity-versus-usd",
};

const REMAINING_WORK = [
  {
    id: "dxy_official",
    label: "Official ICE cash DXY direction",
    state: "unscored",
    need: "licensed ICE US Dollar Index 05:00 London fixings, the previous eligible fixing, and an H1-qualified call on each matched date",
    blocker: "the archive has no official ICE fixing; the 49.65% figure is a broker DXY.cash proxy and is not this test",
  },
  {
    id: "four_markets",
    label: "Four-market confirmation",
    state: "legacy_proxy_only",
    need: "matched-date 05:00-to-05:00 endpoints for EUR/USD, XAU/USD, BTC/USD and NAS100, separately, plus H1 decisions",
    blocker: "the legacy 439-536 scored rows per market use reconstructed calls and are not H1 decisions",
  },
  {
    id: "l2l_full_5r",
    label: "Original L2L 5R geometry",
    state: "blocked",
    need: "a trade-qualified call, contemporaneous pre-setup levels, and actionable bid/ask M5 sequencing with costs and sizing",
    blocker: "0 usable sessions: the archive has no pre-05:00 ladder or full M5 tape",
  },
  {
    id: "l2l_half_3r",
    label: "Original plus midpoint 3R geometry",
    state: "blocked",
    need: "the same M5 tape, levels and frozen 3R management, with full and midpoint geometry kept separate",
    blocker: "0 usable sessions: same two missing inputs as the 5R test",
  },
];

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, places = 6) {
  if (!finite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function signedWeight(signal, weight) {
  if (!finite(weight)) return 0;
  if (signal === "BULLISH") return weight;
  if (signal === "BEARISH") return -weight;
  return 0;
}

function factorIdForLabel(label) {
  const match = String(label || "").match(/^F(\d+)\b/);
  return match ? FACTOR_IDS[`F${match[1]}`] || null : null;
}

function requirementIndex(run) {
  const rows = (run.validity_gate && run.validity_gate.requirement_table) || [];
  const byField = new Map();
  for (const row of rows) {
    for (const field of row.fields || []) {
      if (!byField.has(field)) byField.set(field, []);
      byField.get(field).push(row);
    }
  }
  return { rows, byField };
}

function metaIndex(session) {
  const map = new Map();
  for (const row of session.input_meta || []) {
    if (Array.isArray(row) && row[0]) {
      map.set(row[0], { field: row[0], stamp: row[1], revision: row[2], lag_business_days: row[3] });
    }
  }
  return map;
}

function availability(meta, cutoffAtUtc) {
  if (!meta) {
    return {
      stamp: null,
      precision: "missing",
      observed_at_utc: null,
      published_at_utc: null,
      received_at_utc: null,
      age_hours: null,
      note: "no observation, publication or receipt metadata is stored",
    };
  }
  const exact = typeof meta.stamp === "string" && meta.stamp.includes("T");
  const observed = exact ? meta.stamp : null;
  const ageHours = exact ? (Date.parse(cutoffAtUtc) - Date.parse(meta.stamp)) / 3600000 : null;
  return {
    stamp: meta.stamp,
    precision: exact ? "timestamp" : "date",
    observed_at_utc: observed,
    published_at_utc: null,
    received_at_utc: null,
    age_hours: finite(ageHours) ? round(ageHours, 3) : null,
    revision: meta.revision,
    lag_business_days: meta.lag_business_days,
    note: exact
      ? `legacy snapshot timestamp ${meta.stamp}; it is a collector snapshot, not the original publication or a recipient receipt`
      : `date-only metadata ${meta.stamp}; no observation, publication or receipt clock`,
  };
}

function sourceForField(index, field) {
  const rows = index.byField.get(field) || [];
  const required = rows.find((row) => row.role === "required" || row.role === "gate") || rows[0];
  if (!required) return { source: null, factor_ids: [], factor_labels: [], freshness_business_days: null };
  return {
    source: required.source || null,
    factor_ids: rows.map((row) => row.factor_id),
    factor_labels: rows.map((row) => row.label),
    freshness_business_days: Array.isArray(required.freshness_business_days)
      ? Math.max(...required.freshness_business_days)
      : null,
  };
}

function controlFactors(run, session) {
  const rows = (run.validity_gate && run.validity_gate.requirement_table) || [];
  return ((session.models && session.models.current && session.models.current.factors) || []).map(
    ([label, signal, weight]) => {
      const id = factorIdForLabel(label);
      const row = rows.find((candidate) => candidate.factor_id === id) || {};
      return {
        factor_id: id,
        label,
        signal,
        weight: finite(weight) ? weight : null,
        signed_weight: signedWeight(signal, weight),
        fields: row.fields || [],
        source: row.source || null,
        applied: signal === "BULLISH" || signal === "BEARISH",
        note: id
          ? `directional factor ${id}; signed weight is the contribution shown by the published replay`
          : "factor id not mapped",
      };
    }
  );
}

function controlInputRows({ run, session, factorRows }) {
  const index = requirementIndex(run);
  const meta = metaIndex(session);
  const day = ((run.validity_gate && run.validity_gate.days) || []).find((row) => row.date === session.date) || {};
  return Object.keys(session.inputs || {}).map((field) => {
    const source = sourceForField(index, field);
    const factors = factorRows.filter((factor) => factor.fields.includes(field));
    const rowMeta = meta.get(field);
    return {
      key: field,
      value: session.inputs[field],
      source: source.source,
      factor_ids: source.factor_ids,
      factor_labels: source.factor_labels,
      availability: availability(rowMeta, session.cutoff_at_utc),
      freshness: {
        status: (day.stale || []).includes(field) ? "stale" : "fresh",
        max_business_days: source.freshness_business_days,
        lag_business_days: rowMeta ? rowMeta.lag_business_days : null,
        basis:
          "run-v1 validity_gate.days[].stale; the narrow legacy gate checks presence and freshness, not a receipt clock",
      },
      applied_rule: {
        model: "usd_control_v1",
        applied: factors.some((factor) => factor.applied),
        factor_ids: factors.map((factor) => factor.factor_id).filter(Boolean),
        note: factors.length
          ? "read by the published current-model factor trace"
          : "present in the snapshot but not read by a published current-model factor",
      },
      contribution: factors.map((factor) => ({
        factor_id: factor.factor_id,
        signal: factor.signal,
        weight: factor.weight,
        signed_weight: factor.signed_weight,
      })),
    };
  });
}

function h1FactorIdsForInput(rows, key) {
  return ((rows && rows.rows) || [])
    .filter((row) => row.source_key === key)
    .map((row) => ({ factor_id: row.id, role: row.prescribed_role || null }));
}

function h1InputRows({ coverage, rows, date }) {
  const morning = coverage.byDate.get(date);
  if (!morning) throw new Error(`morning run: no H1 coverage row for ${date}`);
  return INPUT_ORDER.map((key) => {
    const contract = CONTRACTS[key];
    const blocker = morning.blockers.find((candidate) => candidate.input === key);
    const factors = h1FactorIdsForInput(rows, key);
    return {
      key,
      label: LABELS[key],
      required: {
        source: contract.source,
        instrument: contract.instrument,
        transform: contract.transform,
        max_age_hours: contract.hours,
      },
      legacy_field: contract.legacy_field,
      value: morning.values[key],
      source: contract.source,
      availability: blocker ? blocker.clock : null,
      freshness: {
        max_age_hours: contract.hours,
        status: blocker && !blocker.failed_rungs.includes("fresh") ? "fresh" : "not_demonstrated",
        basis:
          "H1 requires a 05:00 receipt; the archive stores no observed/published/received triple for this input",
      },
      applied_rule: {
        model: "usd_l1_25f_h1",
        applied: false,
        factor_ids: factors.map((item) => item.factor_id),
        factor_roles: factors.map((item) => item.role).filter(Boolean),
        note: "not applied: the H1.1 evidence gate is closed, so no H1 arithmetic is allowed to run",
      },
      contribution: null,
      gate: blocker
        ? {
            code: blocker.code,
            failed_rungs: blocker.failed_rungs,
            identity_state: blocker.identity_state,
            text: blocker.text,
          }
        : null,
      recoverable: contract.reconstructable,
      acquisition: contract.acquisition,
    };
  });
}

function summarize(records) {
  const counts = { blocked: 0, abstained: 0, allowed: 0, directional: 0, no_call_allowed: 0, trade_eligible: 0 };
  const directions = { BULLISH: 0, BEARISH: 0, NO_CALL: 0 };
  for (const record of records) {
    counts[record.outcome] += 1;
    if (record.outcome === "allowed" && record.direction !== "NO_CALL") counts.directional += 1;
    if (record.outcome === "allowed" && record.direction === "NO_CALL") counts.no_call_allowed += 1;
    if (record.trade_eligible) counts.trade_eligible += 1;
    if (Object.prototype.hasOwnProperty.call(directions, record.direction)) directions[record.direction] += 1;
  }
  return {
    scheduled: records.length,
    ...counts,
    directions,
    performance: {
      status: counts.directional ? "UNSCORED" : "NO_DENOMINATOR",
      scored: 0,
      denominator: 0,
      note:
        "No outcome is attached to these decision records. A blocked morning does not enter a denominator, and no directional call has been scored by this run.",
    },
  };
}

function decideAll({ run, coverage, models }) {
  const control = [];
  const candidate = [];
  const h1 = [];
  for (const session of run.sessions || []) {
    const sessionView = {
      ...session,
      asset: "USD",
      run: session,
      h1_coverage: coverage.byDate.get(session.date),
    };
    control.push(decide(models.control, sessionView));
    candidate.push(decide(models.candidate, sessionView));
    h1.push(
      decide(models.h1, {
        asset: "USD",
        date: session.date,
        cutoff_at_utc: session.cutoff_at_utc,
        end_at_utc: session.endpoint_at_utc,
        window_hours: session.window_hours,
        inputs: null,
        h1_coverage: coverage.byDate.get(session.date),
        evidence: "historical reconstruction",
      })
    );
  }
  return { control, candidate, h1 };
}

function reachBlock(root) {
  const target = path.join(root, REACH_SUMMARY_PATH);
  if (!fs.existsSync(target)) return null;
  const summary = JSON.parse(fs.readFileSync(target, "utf8"));
  const overall = summary.comparisons && summary.comparisons.overall ? summary.comparisons.overall : {};
  const one = (layer) => {
    const row = (overall[layer] && overall[layer].halfOfStandard) || {};
    return {
      hits: row.hits,
      denominator: row.eligibleCalls,
      rate_pct: row.hitRatePct,
      wilson95: [row.wilson95LowPct, row.wilson95HighPct],
      definition: summary.meta ? summary.meta.half_target_definition : null,
    };
  };
  return {
    metric: "half-distance reach rate",
    not: "not directional accuracy, not a win rate, not an executable result",
    layer1: one("layer1"),
    layer2: one("layer2"),
    source: REACH_SUMMARY_PATH,
    source_version: summary.meta ? summary.meta.version : null,
  };
}


function modelView(record) {
  return {
    id: record.model.id,
    label: record.model.label,
    role: record.model.role,
    version: record.model.version,
    rulebook_version: record.model.rulebook_version,
    identity: record.identity,
    decision_id: record.decision_id,
    snapshot_sha256: record.snapshot_sha256,
    outcome: record.outcome,
    direction: record.direction,
    conviction: record.conviction,
    band: record.band,
    trade_eligible: record.trade_eligible,
    eligibility: record.eligibility,
    gate: record.gate,
    checks: record.checks,
    reasons: record.reasons,
    policy_trace: record.trace,
  };
}

function hashFile(root, relative) {
  const buffer = fs.readFileSync(path.join(root, relative));
  return { path: relative, bytes: buffer.length, sha256: sha256(buffer.toString("utf8")) };
}

function buildMorningRun({
  root = path.resolve(__dirname, "../.."),
  date = DEFAULT_DATE,
  run = null,
  engine = null,
  coverage = null,
  reach = null,
} = {}) {
  const runArtifact = run || readJson(root, "data/usd-layer1-backtester/run-v1.json");
  const engineArtifact = engine || readJson(root, "data/usd-layer1-backtester/engine-v1.json");
  const calendar = readJson(root, "data/usd-layer1-backtester/event-calendar-v1.json");
  const h1Package = loadPackage({ root });
  const h1Model = buildH1Model({ packageModel: h1Package.models });
  const h1Coverage =
    coverage ||
    buildH1Coverage({
      run: runArtifact,
      packageInputs: h1Package.inputs,
      calendar,
      rows: h1Package.rows,
      packageInfo: { requested: "USD-L1-25F-H1-v0.1.0" },
    });
  const models = createModels({ run: runArtifact, engine: engineArtifact, h1: h1Model });
  const session = (runArtifact.sessions || []).find((row) => row.date === date);
  if (!session) throw new Error(`morning run: ${date} is not a scheduled run-v1 morning`);

  const factorRows = controlFactors(runArtifact, session);
  const factorContributions = factorRows.map((factor) => ({
    factor_id: factor.factor_id,
    label: factor.label,
    signal: factor.signal,
    weight: factor.weight,
    signed_weight: factor.signed_weight,
    applied: factor.applied,
    rule: factor.note,
  }));
  const net = round(
    factorContributions.reduce((sum, factor) => sum + (factor.signed_weight || 0), 0),
    6
  );
  const sessionView = {
    ...session,
    asset: "USD",
    run: session,
    h1_coverage: h1Coverage.byDate.get(session.date),
  };
  const controlDecision = decide(models.control, sessionView);
  const candidateDecision = decide(models.candidate, sessionView);
  const h1Decision = decide(models.h1, {
    asset: "USD",
    date: session.date,
    cutoff_at_utc: session.cutoff_at_utc,
    end_at_utc: session.endpoint_at_utc,
    window_hours: session.window_hours,
    inputs: null,
    h1_coverage: h1Coverage.byDate.get(session.date),
    evidence: "historical reconstruction",
  });

  const all = decideAll({ run: runArtifact, coverage: h1Coverage, models });
  const sample = {
    control: summarize(all.control),
    candidate: summarize(all.candidate),
    h1: summarize(all.h1),
    classification:
      "blocked = evidence failed at a blocking check; abstained = every blocking check passed and the model declined; directional = allowed with BULLISH or BEARISH; no_call_allowed = allowed with NO_CALL. Performance is not scored until a directional denominator survives the gate.",
  };

  const ladder = (runArtifact.validity_gate && runArtifact.validity_gate.ladder) || [];
  const legacyInputClockAudit = {
    ...LEGACY_AUDIT,
    ladder,
    sessions: {
      present: (ladder.find((row) => row.rung === "present" && row.scope === "sessions") || {}).sessions_passing,
      fresh: (ladder.find((row) => row.rung === "fresh" && row.scope === "sessions") || {}).sessions_passing,
      clocked: (ladder.find((row) => row.rung === "clocked" && row.scope === "sessions") || {}).sessions_passing,
      identified: (ladder.find((row) => row.rung === "identified" && row.scope === "sessions") || {}).sessions_passing,
      total: (ladder.find((row) => row.rung === "present" && row.scope === "sessions") || {}).sessions,
    },
  };

  const h1Blockers = h1Coverage.byDate.get(date).blockers.map((blocker) => ({
    input: blocker.input,
    label: blocker.label,
    code: blocker.code,
    failed_rungs: blocker.failed_rungs,
    identity_state: blocker.identity_state,
    clock: blocker.clock,
    reason: blocker.text,
  }));
  const h1Inputs = h1InputRows({ coverage: h1Coverage, rows: h1Package.rows, date });


  const body = {
    schema_version: SCHEMA_VERSION,
    research_only: true,
    built_on: BUILT_ON,
    date,
    session: {
      contract: "05:00 Europe/London to 05:00 the next local day (24 hours, DST-following)",
      cutoff_at_utc: session.cutoff_at_utc,
      endpoint_at_utc: session.endpoint_at_utc,
      window_hours: session.window_hours,
    },
    strict_evidence: {
      ready: false,
      criterion:
        "present + fresh + verified 05:00 observation/publication/receipt + named instrument, for every required input",
      reason:
        "No morning in the archive carries a verified 05:00 receipt for every required input. The current adapter's allowed outcome is a narrow presence/freshness replay, not strict evidence; H1 is blocked by its nine-input contract.",
      current_model_evidence_grade: "narrow_presence_and_freshness_only",
      clocks_verified: false,
      h1_ready: h1Coverage.byDate.get(date).ready,
    },
    models: {
      current: modelView(controlDecision),
      legacy_candidate: modelView(candidateDecision),
      h1: modelView(h1Decision),
    },
    factors: {
      current: {
        net_signed_weight: net,
        published_conviction: session.models && session.models.current ? session.models.current.conviction : null,
        rows: factorContributions,
        note: "The signed weights sum to the published net weight. Weights are model weights, not measured edge.",
      },
      h1: {
        rows: [],
        note: "No H1 contribution exists on this morning: the evidence gate is closed, so the engine does not call H1 policy arithmetic.",
      },
    },
    inputs: {
      current: controlInputRows({ run: runArtifact, session, factorRows }),
      h1: h1Inputs,
    },
    h1_blockers: h1Blockers,
    h1_missing_evidence: h1Blockers.map((blocker) => {
      const input = h1Inputs.find((candidate) => candidate.key === blocker.input);
      return {
        input: blocker.input,
        required: input.required,
        issue: blocker.reason,
        action: input.acquisition,
      };
    }),
    recoverable_gaps: h1Inputs.map((input) => ({
      input: input.key,
      label: input.label,
      value: input.value,
      recoverable: input.recoverable,
      acquisition: input.acquisition,
    })),
    event_calendar: {
      status: h1Coverage.event_calendar.status,
      staged_types: h1Coverage.event_calendar.staged_types,
      required_types: REQUIRED_TYPES,
      matched_types: h1Coverage.event_calendar.matched_types,
      missing_types: h1Coverage.event_calendar.missing_types,
      events: h1Coverage.event_calendar.events,
      sessions_with_staged_event: h1Coverage.event_calendar.sessions_with_staged_event,
      calendar_count_for_morning: h1Coverage.byDate.get(date).calendar_count,
      note: h1Coverage.event_calendar.note,
    },
    sample_reconciliation: sample,
    legacy_input_clock_audit: legacyInputClockAudit,
    reach_benchmark: reach || reachBlock(root),
    external_state: EXTERNAL_STATE,
    remaining_work: REMAINING_WORK,
    labels: {
      zero_of_725: "legacy run-v1 input-clock gate; attached to the original audit, not to H1",
      ninety_seven: "half-distance reach rate; not directional accuracy or a win rate",
      performance: "UNSCORED: no valid directional denominator exists for H1",
    },
  };
  const sources = [
    "data/usd-layer1-backtester/run-v1.json",
    "data/usd-layer1-backtester/engine-v1.json",
    "data/usd-layer1-backtester/event-calendar-v1.json",
    "backtester/packages/USD-L1-25F-H1-v0.1.0/inputs.json",
    "backtester/packages/USD-L1-25F-H1-v0.1.0/rows.json",
    REACH_SUMMARY_PATH,
  ]
    .filter((relative) => fs.existsSync(path.join(root, relative)))
    .map((relative) => hashFile(root, relative));
  const artifactSha256 = sha256(stableStringify(body));
  return {
    ...body,
    provenance: {
      sources,
      artifact_sha256: artifactSha256,
      note:
        "The digest is over the body before this block. The report builder reruns the same committed artefacts and must reproduce it.",
    },
  };
}

module.exports = {
  SCHEMA_VERSION,
  BUILT_ON,
  DEFAULT_DATE,
  EXTERNAL_STATE,
  LEGACY_AUDIT,
  REACH_SUMMARY_PATH,
  FACTOR_IDS,
  REMAINING_WORK,
  availability,
  buildMorningRun,
  controlInputRows,
  h1InputRows,
  reachBlock,
  summarize,
};

