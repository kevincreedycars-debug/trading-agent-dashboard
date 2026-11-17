/**
 * The H1 historical coverage audit.
 *
 * It answers one question for every published morning: does the archive contain the exact evidence H1.1 asks
 * for, or only a legacy field that happens to be nearby? A present value is not enough. The audit walks the
 * declared source, instrument, transform, lookback, freshness and all three clocks, and records the first
 * missing rung for each input.
 *
 * This is an audit, not a model run. It reads only the committed run-v1 artefact, the staged event calendar and
 * the supplied input contract. Research only.
 */
"use strict";

const REQUIRED_TYPES = [
  "CPI",
  "Employment Situation",
  "advance GDP",
  "Personal Income and Outlays",
  "FOMC policy decision",
];
const STAGED_TYPES = ["fomc_statement"];
const TYPE_EQUIVALENTS = {
  "FOMC policy decision": ["fomc_statement"],
};

function normalizeEventType(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Match the five required release types against the staged calendar by exact normalised type, with only the named
 * statement-to-decision equivalence. Substring matching is deliberately avoided: "CPI" must not match a type that
 * merely contains those letters.
 */
function matchEventTypes(requiredTypes, stagedTypes) {
  const staged = stagedTypes.map(normalizeEventType).filter(Boolean);
  const matched = [];
  const missing = [];
  for (const type of requiredTypes) {
    const aliases = (TYPE_EQUIVALENTS[type] || []).map(normalizeEventType);
    const present = staged.some((candidate) => candidate === normalizeEventType(type) || aliases.includes(candidate));
    (present ? matched : missing).push(type);
  }
  return { matched, missing };
}
const INPUT_ORDER = ["vix", "front", "spread", "real", "broad", "ice", "gold", "qqq", "calendar"];
const RUN_ID = "run-v1";
const ID = "h1_coverage_audit";
const VERSION = "1.0.0";
const BASIS =
  "H1.1 input source/instrument/transform, five-interval lookback, freshness and 05:00 observed/published/received clocks";

const CONTRACTS = {
  vix: {
    source: "Cboe",
    instrument: "VIX spot close",
    transform: "index points, latest completed close",
    hours: 96,
    legacy_field: "inputs.vix_level",
    identity: "named_alias",
    lookback_required: false,
    availability:
      "FRED VIXCLS is an alias for the Cboe VIX close, but the archive stores neither the Cboe record nor a receipt clock. The 05:00 availability is unproven.",
    publication: "Cboe publishes the daily VIX close after the US cash close (usually 16:15 ET).",
    reconstructable:
      "Cboe daily close history and release calendar can reconstruct the publication timestamp; recipient receipt cannot be reconstructed.",
    acquisition:
      "Acquire the Cboe VIX official close history and the collector receipt at 05:00 London. Retain the exact close used and its observed/published/received clocks for every session.",
    code: "unclocked",
  },
  front: {
    source: "Federal Reserve H.15",
    instrument: "DGS2",
    transform: "5 completed observation intervals, bp",
    hours: 96,
    legacy_field: "inputs.us_2y_d5_bps",
    identity: "named_alias",
    lookback_required: true,
    availability:
      "Only the five-interval change is stored. The five DGS2 observations, their vintages and clocks are absent, so the change cannot be reconciled to H1's declared transform.",
    publication: "The Federal Reserve publishes H.15 at 16:15 ET on the release day.",
    reconstructable:
      "FRED ALFRED vintages reconstruct the publication series; recipient receipt at 05:00 London cannot be reconstructed from the archive.",
    acquisition:
      "Acquire the H.15 DGS2 daily series with ALFRED vintages and the five raw observations behind each change. Record publication and collector receipt clocks.",
    code: "derived_only",
  },
  spread: {
    source: "H.15 + Bundesbank BBSIS",
    instrument: "DGS2 minus DE sovereign Svensson 2.0-year zero-coupon spot",
    transform: "5 common observation intervals, change of spread in bp",
    hours: 96,
    legacy_field:
      "inputs.us_de_2y_spread_d5_bps (absent from run-v1 inputs; only a same-day level appears in saved_inputs)",
    identity: "missing",
    lookback_required: true,
    availability:
      "No DGS2-minus-Bundesbank spread is present in the H1 input fields. The archive cannot construct the declared five common-interval change or its clocks.",
    publication: "H.15 publishes at 16:15 ET; Bundesbank BBSIS publishes its yield curve on its own schedule.",
    reconstructable:
      "Both publication series are public and can reconstruct the spread and publication times; no receipt clock is archived.",
    acquisition:
      "Acquire H.15 DGS2 and Bundesbank BBSIS 2.0-year Svensson zero-coupon spot histories. Compute the spread only on common observation dates and retain all five operands, publication times and collector receipts.",
    code: "missing_value",
  },

  real: {
    source: "Federal Reserve H.15",
    instrument: "DFII10",
    transform: "5 completed observation intervals, bp",
    hours: 96,
    legacy_field: "inputs.us_10y_real_d5_bps",
    identity: "named_alias",
    lookback_required: true,
    availability:
      "Only the five-interval change is stored. The five DFII10 observations and their vintages are absent, so the exact H1 transform is unverified.",
    publication: "The Federal Reserve publishes H.15 at 16:15 ET on the release day.",
    reconstructable:
      "FRED ALFRED vintages reconstruct the publication series; recipient receipt at 05:00 London cannot be reconstructed.",
    acquisition:
      "Acquire the H.15 DFII10 daily series with ALFRED vintages and the five raw observations behind each change. Record publication and receipt clocks.",
    code: "derived_only",
  },
  broad: {
    source: "Federal Reserve H.10",
    instrument: "DTWEXBGS",
    transform: "5 observation intervals, simple return in percent",
    hours: 192,
    legacy_field: "inputs.broad_dollar_d5_pct",
    identity: "named_alias",
    lookback_required: true,
    availability:
      "Only the five-interval return is stored. The five DTWEXBGS observations and their vintages are absent, so the return and its clocks cannot be verified.",
    publication: "The Federal Reserve publishes H.10 on Monday at 16:15 ET.",
    reconstructable:
      "FRED ALFRED vintages reconstruct the publication series; recipient receipt at 05:00 London cannot be reconstructed.",
    acquisition:
      "Acquire the H.10 DTWEXBGS daily series with ALFRED vintages and the five raw observations behind each return. Record publication and receipt clocks.",
    code: "derived_only",
  },
  ice: {
    source: "ICE",
    instrument: "US Dollar Index spot",
    transform: "previous eligible London 05:00 fixing to current 05:00, simple return in percent",
    hours: 0,
    legacy_field: "none (run-v1 stores no ICE DXY fixing)",
    identity: "missing",
    lookback_required: true,
    availability:
      "There is no ICE US Dollar Index spot fixing in the archive. A broker DXY proxy is not the declared instrument and cannot substitute.",
    publication: "ICE publishes the US Dollar Index spot fixing after the 05:00 London fixing time.",
    reconstructable:
      "The licensed ICE fixing history and release timestamp can reconstruct publication; the collector receipt cannot be reconstructed.",
    acquisition:
      "Acquire licensed ICE US Dollar Index spot 05:00 London fixing history and the previous eligible fixing. Record the exact fixing, publication timestamp and collector receipt.",
    code: "missing_value",
  },

  gold: {
    source: "LBMA",
    instrument: "LBMA Gold Price PM USD",
    transform: "5 completed fixing intervals, simple return in percent",
    hours: 96,
    legacy_field: "inputs.gold_d5_pct (derived from gold_price, an OANDA XAU/USD quote)",
    identity: "identity_mismatch",
    lookback_required: true,
    availability:
      "The legacy gold return is derived from an OANDA XAU/USD quote, not the LBMA Gold Price PM USD auction. The instrument identity fails before the missing five fixings are considered.",
    publication: "LBMA publishes the PM auction price shortly after the 15:00 London auction.",
    reconstructable:
      "LBMA auction records reconstruct the PM publication time; the archive contains neither the auction records nor a receipt.",
    acquisition:
      "Acquire the LBMA Gold Price PM USD auction history (do not substitute OANDA XAU/USD). Retain five completed fixings, publication timestamps and collector receipts.",
    code: "identity_mismatch",
  },
  qqq: {
    source: "Nasdaq",
    instrument: "QQQ official close",
    transform: "5 completed close intervals, split-adjusted as known at cutoff, simple return in percent",
    hours: 96,
    legacy_field: "inputs.nasdaq100_d5_pct (derived from nasdaq100_price, the Nasdaq-100 index)",
    identity: "identity_mismatch",
    lookback_required: true,
    availability:
      "The legacy return is the Nasdaq-100 index, not the QQQ ETF's official close. The instrument identity fails, and the five closes and split adjustment are absent.",
    publication: "Nasdaq publishes the official QQQ closing price after the 16:00 ET close.",
    reconstructable:
      "Nasdaq official close history reconstructs the publication time; the archive contains neither the official closes nor a receipt.",
    acquisition:
      "Acquire Nasdaq official QQQ closing prices (not the Nasdaq-100 index) and five completed closes, split-adjusted as known at each cutoff. Record publication and receipt clocks.",
    code: "identity_mismatch",
  },
  calendar: {
    source: "BLS + BEA + Federal Reserve",
    instrument: "CPI, Employment Situation, advance GDP, Personal Income and Outlays, FOMC policy decisions",
    transform: "scheduled release count in [cutoff,endpoint), complete archived schedules required",
    hours: 24,
    legacy_field: "data/usd-layer1-backtester/event-calendar-v1.json (FOMC statements only)",
    identity: "incomplete",
    lookback_required: true,
    availability:
      "Only the FOMC statement archive is staged. CPI, Employment Situation, advance GDP, Personal Income and Outlays schedules are absent, so the event window cannot be answered for the complete declared calendar.",
    publication:
      "BLS, BEA and the Federal Reserve publish release schedules in advance; individual release timestamps are archived by each agency.",
    reconstructable:
      "Official schedules and release timestamps reconstruct the published release times; collector receipt times are not archived.",
    acquisition:
      "Acquire complete archived BLS, BEA and Federal Reserve schedules for CPI, Employment Situation, advance GDP, Personal Income and Outlays and FOMC decisions. Record each release timestamp and collector receipt.",
    code: "incomplete_calendar",
  },
};


const LABELS = {
  vix: "VIX close",
  front: "DGS2 5d",
  spread: "US-DE 2Y spread 5d",
  real: "DFII10 5d",
  broad: "DTWEXBGS 5d",
  ice: "ICE DXY 05:00 fixing",
  gold: "LBMA gold PM 5d",
  qqq: "QQQ close 5d",
  calendar: "Release calendar",
};

const META_FIELDS = {
  vix: ["vix_level"],
  front: ["us_2y_d5_bps"],
  spread: [],
  real: ["us_10y_real_d5_bps"],
  broad: ["broad_dollar_d5_pct"],
  ice: [],
  gold: ["gold_d5_pct"],
  qqq: ["nasdaq100_d5_pct"],
  calendar: [],
};

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function valueFor(session, key) {
  if (key === "calendar") return session.h1_calendar_count === undefined ? null : session.h1_calendar_count;
  if (key === "spread") {
    const saved = session.saved_inputs || {};
    return finite(saved.us_de_2y_spread_d5_bps) ? saved.us_de_2y_spread_d5_bps : null;
  }
  const field = {
    vix: "vix_level",
    front: "us_2y_d5_bps",
    real: "us_10y_real_d5_bps",
    broad: "broad_dollar_d5_pct",
    ice: null,
    gold: "gold_d5_pct",
    qqq: "nasdaq100_d5_pct",
  }[key];
  if (!field) return null;
  const value = (session.inputs || {})[field];
  return finite(value) ? value : null;
}

function metaFor(session, key) {
  const names = META_FIELDS[key] || [];
  const rows = session.input_meta || [];
  for (const [name, stamp, revision, lag] of rows) {
    if (names.includes(name)) return { field: name, stamp, revision, lag_business_days: lag };
  }
  return null;
}

function clockEvidence(meta) {
  if (!meta) {
    return {
      observed: null,
      published: null,
      received: null,
      note: "no observation, publication or receipt metadata is stored",
    };
  }
  const exact = typeof meta.stamp === "string" && meta.stamp.includes("T");
  return {
    observed: exact ? meta.stamp : null,
    published: null,
    received: null,
    note: exact
      ? `legacy snapshot timestamp ${meta.stamp}; it is a collector snapshot, not the original publication or a recipient receipt`
      : `date-only metadata ${meta.stamp}; no observation, publication or receipt clock`,
  };
}

function identityFor(key, present) {
  if (key === "gold" || key === "qqq") return "identity_mismatch";
  if (key === "calendar") return "incomplete";
  if (key === "ice") return "missing";
  if (key === "spread") return present ? "derived_alias" : "missing";
  return present ? "named_alias" : "missing";
}

function rungsFor(key, present) {
  const named = ["named_alias", "derived_alias"].includes(identityFor(key, present));
  const identity = false;
  return {
    present,
    original: false,
    lookback: key === "vix" ? present : false,
    fresh: false,
    clocked: false,
    receipt: false,
    identity,
    schedule_complete: key !== "calendar",
    named,
    eligible: false,
  };
}

function failedRungs(rungs) {
  return Object.entries(rungs)
    .filter(([key, value]) => !["named", "eligible"].includes(key) && value === false)
    .map(([key]) => key);
}

function blockerFor(key, present, rungs, meta) {
  const contract = CONTRACTS[key];
  const failed = failedRungs(rungs);
  let code = contract.code;
  if (key === "calendar") code = "incomplete_calendar";
  else if (!present) code = "missing_value";
  else if (contract.identity === "identity_mismatch") code = "identity_mismatch";
  else if (["front", "spread", "real", "broad"].includes(key)) code = "derived_only";
  else if (!rungs.clocked) code = "unclocked";
  else if (!rungs.receipt) code = "unverified_receipt";
  else if (!rungs.fresh) code = "stale_or_unproven";
  else if (!rungs.original) code = "unverified_original";
  else if (!rungs.identity) code = "identity_unverified";
  return {
    input: key,
    label: LABELS[key],
    code,
    text: `${LABELS[key]}: ${present ? "" : "no value in the archive; "}${contract.availability}`,
    failed_rungs: failed,
    identity_state: identityFor(key, present),
    clock: clockEvidence(meta),
  };
}

/**
 * The rows that read each input, so a gap names the adjudications it blocks and not only the series.
 */
function factorsByInput(rows) {
  const map = new Map();
  for (const row of (rows && rows.rows) || []) {
    if (!row.source_key) continue;
    if (!map.has(row.source_key)) map.set(row.source_key, []);
    map.get(row.source_key).push({
      id: row.id,
      name: row.name,
      role: String(row.prescribed_role || "").replace(/^HYPOTHESIS:\s*/, ""),
    });
  }
  return map;
}

/** Where an acquired series is expected to land, and what each record must carry. */
function importSpec(key) {
  return {
    target_file: `data/usd-layer1-backtester/h1-v1/${key}.json`,
    record_fields: [
      "session_date",
      "observed_at_utc",
      "published_at_utc",
      "received_at_utc",
      "vintage",
      "original",
      "source",
      "instrument",
      "transform",
      "value",
      "operands",
    ],
    check:
      "re-run node scripts/build_backtesting_screen.js: the coverage audit re-reads the file, and --check fails until the committed payload matches",
  };
}

/**
 * Audit every published session against the nine H1 inputs.
 *
 * @param {object} options
 * @param {object} options.run the published run-v1 artefact
 * @param {object} options.packageInputs the supplied inputs.json
 * @param {object} options.calendar the staged event calendar
 * @param {object} options.packageInfo verified package identity
 * @param {object} [options.rows] the supplied rows.json, used to name the factors each gap blocks
 * @returns {object} coverage record; `byDate` is a non-enumerable lookup for the engine
 */
function buildH1Coverage({ run, packageInputs, calendar, packageInfo, rows }) {
  if (!run || !Array.isArray(run.sessions) || !run.sessions.length) {
    throw new Error("h1 coverage: run-v1 sessions are required");
  }
  if (!packageInputs) throw new Error("h1 coverage: the supplied inputs.json is required");
  if (!calendar || !Array.isArray(calendar.events)) throw new Error("h1 coverage: the staged event calendar is required");

  const mismatches = INPUT_ORDER.filter((key) => {
    const spec = packageInputs[key];
    const contract = CONTRACTS[key];
    return (
      !spec ||
      spec[0] !== contract.source ||
      spec[1] !== contract.instrument ||
      spec[2] !== contract.transform ||
      spec[3] !== contract.hours
    );
  });
  if (mismatches.length) {
    throw new Error(`h1 coverage: the audit contract differs from inputs.json for ${mismatches.join(", ")}`);
  }

  const accumulator = Object.fromEntries(
    INPUT_ORDER.map((key) => [
      key,
      {
        present: 0,
        named: 0,
        original: 0,
        lookback: 0,
        fresh: 0,
        clocked: 0,
        receipt: 0,
        identity: 0,
        schedule_complete: 0,
        eligible: 0,
        present_dates: [],
        missing_dates: [],
        incomplete_dates: [],
        unclocked_dates: [],
        blocked_dates: [],
        clock_sample: null,
        identity_state: null,
      },
    ])
  );
  const mornings = [];
  const profiles = new Map();
  const byDate = new Map();
  let sessionsWithEvent = 0;

  for (const session of run.sessions) {
    const cutoff = Date.parse(session.cutoff_at_utc);
    const endpoint = Date.parse(session.endpoint_at_utc);
    if (!Number.isFinite(cutoff) || !Number.isFinite(endpoint) || endpoint <= cutoff) {
      throw new Error(`h1 coverage: ${session.date} has no positive 05:00-to-05:00 session`);
    }
    const calendarCount = calendar.events.filter((event) => {
      const at = Date.parse(event.released_at_utc);
      return Number.isFinite(at) && at >= cutoff && at < endpoint;
    }).length;
    if (calendarCount > 0) sessionsWithEvent += 1;
    const enriched = { ...session, h1_calendar_count: calendarCount };
    const values = {};
    const blockers = [];
    const rungCounts = {
      present: 0,
      original: 0,
      lookback: 0,
      fresh: 0,
      clocked: 0,
      receipt: 0,
      identity: 0,
      schedule_complete: 0,
      eligible: 0,
    };

    for (const key of INPUT_ORDER) {
      const value = valueFor(enriched, key);
      const present = finite(value);
      const meta = metaFor(enriched, key);
      const rungs = rungsFor(key, present);
      const blocker = blockerFor(key, present, rungs, meta);
      const acc = accumulator[key];
      values[key] = value;
      blockers.push(blocker);
      for (const rung of Object.keys(rungCounts)) {
        if (rungs[rung] === true) {
          rungCounts[rung] += 1;
          acc[rung] += 1;
        }
      }
      if (present) acc.present_dates.push(session.date);
      else acc.missing_dates.push(session.date);
      if (rungs.eligible !== true) acc.blocked_dates.push(session.date);
      if (rungs.named) acc.named += 1;
      if (!rungs.clocked) acc.unclocked_dates.push(session.date);
      if (key === "calendar" && !rungs.schedule_complete) acc.incomplete_dates.push(session.date);
      if (!acc.clock_sample && meta) acc.clock_sample = clockEvidence(meta).note;
      if (!acc.identity_state) acc.identity_state = blocker.identity_state;
    }

    const ready = blockers.length === 0;
    const signature = ready ? "ready" : blockers.map((blocker) => `${blocker.input}:${blocker.code}`).join("|");
    if (!profiles.has(signature)) {
      profiles.set(signature, { signature, ready, blockers, rungs: rungCounts, dates: [] });
    }
    profiles.get(signature).dates.push(session.date);
    mornings.push({
      date: session.date,
      ready,
      signature,
      calendar_count: calendarCount,
      blockers: blockers.map((blocker) => ({ input: blocker.input, code: blocker.code })),
      values,
      rungs: rungCounts,
    });
    byDate.set(session.date, {
      date: session.date,
      ready,
      signature,
      blockers,
      rungs: rungCounts,
      values,
      calendar_count: calendarCount,
    });
  }

  const factorIndex = factorsByInput(rows);
  const inputs = INPUT_ORDER.map((key) => {
    const contract = CONTRACTS[key];
    const acc = accumulator[key];
    const factors = (factorIndex.get(key) || []).map((factor) => ({ ...factor }));
    return {
      key,
      label: LABELS[key],
      code: acc.present === 0 ? "missing_value" : key === "spread" ? "derived_only" : contract.code,
      source: contract.source,
      instrument: contract.instrument,
      transform: contract.transform,
      hours: contract.hours,
      legacy_field: contract.legacy_field,
      factors,
      factor_count: factors.length,
      identity_state: acc.identity_state || contract.identity,
      identity_note:
        contract.identity === "identity_mismatch"
          ? "The legacy field is a different instrument. It cannot be relabelled as the H1 input."
          : contract.identity === "incomplete"
            ? "Only one of the five declared release families is staged."
            : "The legacy field is a named alias, not a verified original observation.",
      present: acc.present,
      named: acc.named,
      original: acc.original,
      lookback: acc.lookback,
      fresh: acc.fresh,
      clocked: acc.clocked,
      receipt: acc.receipt,
      identity: acc.identity,
      schedule_complete: acc.schedule_complete,
      eligible: acc.eligible,
      missing: acc.missing_dates.length,
      incomplete: acc.incomplete_dates.length,
      blocked: run.sessions.length - acc.eligible,
      missing_dates: acc.missing_dates,
      incomplete_dates: acc.incomplete_dates,
      blocked_dates_sample: acc.blocked_dates.slice(0, 12),
      blocked_first: acc.blocked_dates[0] || null,
      blocked_last: acc.blocked_dates[acc.blocked_dates.length - 1] || null,
      present_sample: acc.present_dates.slice(0, 12),
      unclocked_sample: acc.unclocked_dates.slice(0, 12),
      clock_sample: acc.clock_sample || "no observation, publication or receipt metadata is stored",
      blocker_text: `${LABELS[key]}: ${contract.availability}`,
      availability: contract.availability,
      publication: contract.publication,
      reconstructable: contract.reconstructable,
      acquisition: contract.acquisition,
      import: importSpec(key),
      publication_reconstruction: {
        publication_rule: contract.publication,
        publication_reconstructable: true,
        receipt_reconstructable: false,
        method: contract.reconstructable,
      },
    };
  });

  const gaps = inputs
    .filter((input) => input.eligible === 0)
    .map((input) => ({
      input: input.key,
      label: input.label,
      code: input.code,
      dataset: `${input.source} · ${input.instrument}`,
      transform: input.transform,
      factors: input.factors,
      factor_count: input.factor_count,
      affected: {
        sessions: input.blocked,
        first: input.blocked_first,
        last: input.blocked_last,
        sample: input.blocked_dates_sample,
      },
      missing_evidence: input.availability,
      obtain: input.acquisition,
      import: input.import,
    }));

  const ready = mornings.filter((morning) => morning.ready).length;
  const blocked = mornings.length - ready;
  const earliestEligible = mornings.find((morning) => morning.ready)?.date || null;
  const profileList = Array.from(profiles.values()).sort((a, b) => a.signature.localeCompare(b.signature));
  const byInput = Object.fromEntries(
    inputs.map((input) => [
      input.key,
      {
        present: input.present,
        named: input.named,
        original: input.original,
        lookback: input.lookback,
        fresh: input.fresh,
        clocked: input.clocked,
        receipt: input.receipt,
        identity: input.identity,
        schedule_complete: input.schedule_complete,
        eligible: input.eligible,
        missing: input.missing,
        incomplete: input.incomplete,
        blocked: input.blocked,
        code: input.code,
      },
    ])
  );

  const statusLabel =
    ready === 0
      ? `H1 historical coverage measured: 0 of ${mornings.length} ready; earliest eligible morning: none`
      : `H1 historical coverage measured: ${ready} of ${mornings.length} ready; earliest eligible morning: ${earliestEligible}`;
  const unmeasuredLabel = "H1 historical coverage unmeasured; earliest eligible morning unknown";
  const stagedTypes = [...new Set(((calendar && calendar.events) || []).map((event) => event.type).filter(Boolean))].sort();
  const typeMatch = matchEventTypes(REQUIRED_TYPES, stagedTypes);

  const result = {
    status: "measured",
    measured_on: "2026-11-17",
    basis: BASIS,
    label: statusLabel,
    unmeasured_label: unmeasuredLabel,
    legacy_replacement: {
      previous_label: "legacy run-v1 coverage (0/725, 515 reconstructed, 121 directional, 209 scored)",
      replacement_label: unmeasuredLabel,
      retired: true,
      note:
        "Those legacy counts remain available under the legacy control only. They are not H1 counts and must never be rendered under the H1 selector.",
    },
    scheduled: mornings.length,
    ready,
    blocked,
    earliest_eligible: earliestEligible,
    earliest_eligible_search: earliestEligible
      ? "first ready morning in run-v1 order"
      : "none: every morning fails at least one H1.1 rung",
    counts: {
      scheduled: mornings.length,
      ready,
      blocked,
      earliest_eligible: earliestEligible,
      by_input: byInput,
    },
    rungs: {
      present: mornings.reduce((sum, morning) => sum + morning.rungs.present, 0),
      original: mornings.reduce((sum, morning) => sum + morning.rungs.original, 0),
      lookback: mornings.reduce((sum, morning) => sum + morning.rungs.lookback, 0),
      fresh: mornings.reduce((sum, morning) => sum + morning.rungs.fresh, 0),
      clocked: mornings.reduce((sum, morning) => sum + morning.rungs.clocked, 0),
      receipt: mornings.reduce((sum, morning) => sum + morning.rungs.receipt, 0),
      identity: mornings.reduce((sum, morning) => sum + morning.rungs.identity, 0),
      schedule_complete: mornings.reduce((sum, morning) => sum + morning.rungs.schedule_complete, 0),
      eligible: mornings.reduce((sum, morning) => sum + morning.rungs.eligible, 0),
    },
    inputs,
    gaps,
    mornings,
    profiles: Object.fromEntries(profileList.map((profile) => [profile.signature, profile])),
    profile_count: profileList.length,
    event_calendar: {
      version: calendar.version || null,
      status: calendar.status || null,
      staged_types: stagedTypes,
      required_types: REQUIRED_TYPES,
      matched_types: typeMatch.matched,
      missing_types: typeMatch.missing,
      events: (calendar.events || []).length,
      sessions_with_staged_event: sessionsWithEvent,
      complete: false,
      note: typeMatch.missing.length
        ? `The staged archive carries ${stagedTypes.join(", ") || "no event types"}; ${typeMatch.missing.length} of ${REQUIRED_TYPES.length} required release types are absent. A zero event count under this partial calendar cannot establish that no omitted release occurred.`
        : "Every required release type has at least one staged event, but a staged schedule is not a complete historical calendar; verify the omission set before claiming complete coverage.",
    },
    receipts: {
      recorded: 0,
      reconstructed: 0,
      publication_reconstructable_inputs: inputs.filter(
        (input) => input.publication_reconstruction.publication_reconstructable
      ).length,
      receipt_reconstructable_inputs: inputs.filter(
        (input) => input.publication_reconstruction.receipt_reconstructable
      ).length,
      note:
        "No collector receipt exists in the archive. Official publication timestamps can be reconstructed from public archives, but publication is not recipient receipt and neither proves 05:00 availability.",
    },
    source_legend: run.input_source_legend || [],
    contract_check: {
      checked: true,
      package_version: packageInfo?.requested || null,
      inputs: INPUT_ORDER.length,
      mismatches,
    },
    next_data_action: {
      priority: 1,
      title: "Acquire the missing H1 evidence, starting with ICE and the complete release calendar",
      detail:
        "There is no eligible H1 morning. First acquire licensed ICE DXY 05:00 fixings and the missing BLS/BEA/Fed schedules. Then replace the OANDA gold and Nasdaq-100 proxies with LBMA PM and QQQ closes, and add observed/published/received clocks to every input.",
      inputs: ["ice", "calendar", "gold", "qqq", "vix", "front", "spread", "real", "broad"],
      steps: [
        "License ICE US Dollar Index spot 05:00 London fixings and retain the previous eligible fixing.",
        "Archive complete CPI, Employment Situation, advance GDP, Personal Income and Outlays and FOMC schedules with release timestamps.",
        "Replace OANDA XAU/USD and Nasdaq-100 proxies with LBMA Gold Price PM USD and Nasdaq official QQQ closes.",
        "Retain five raw operands and a collector receipt for VIX, DGS2, the US-DE 2Y spread, DFII10 and DTWEXBGS.",
        "Re-run the coverage audit; it will publish ready/blocked counts and the earliest eligible morning without reusing legacy counts.",
      ],
    },
    binding: {
      model_id: "usd_l1_25f_h1",
      model_version: "USD-L1-25F-H1-v0.1.0",
      run_id: RUN_ID,
      run_version: run.run?.run_version || null,
      run_generated_at: run.generated_at || null,
      run_first_session: run.sessions[0].date,
      run_last_session: run.sessions[run.sessions.length - 1].date,
      gate: "H1.1 nine-feature evidence contract",
      basis: BASIS,
      package_archive_sha256: packageInfo?.archive?.sha256 || null,
    },
  };
  Object.defineProperty(result, "byDate", { value: byDate, enumerable: false });
  return result;
}

module.exports = {
  ID,
  VERSION,
  RUN_ID,
  BASIS,
  INPUT_ORDER,
  REQUIRED_TYPES,
  STAGED_TYPES,
  TYPE_EQUIVALENTS,
  CONTRACTS,
  LABELS,
  factorsByInput,
  importSpec,
  matchEventTypes,
  buildH1Coverage,
};

