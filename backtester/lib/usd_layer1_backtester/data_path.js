"use strict";

/**
 * The data path behind every one of the twenty-five factors (research only).
 *
 * The panel's factor table says what a factor does to a morning's call. This module answers the questions
 * that sit underneath it: which series each factor actually reads, where that series comes from, how often
 * it was present at the 05:00 cutoff across the scored sessions, how stale the print was, which rule reads
 * it, and whether it moved direction, conviction, both or nothing. It also names the inputs the engine holds
 * but does not read, and measures what reading them would have done, labelled as an exploratory probe rather
 * than a model.
 *
 * Nothing here changes a rule. The factor spec it writes is the same frozen v1 book that scored the run; the
 * per-morning statuses come from `lib/usd_l1_audit.js`, the file the panel uses, so the aggregate counts and
 * the click-through table cannot disagree.
 */

const fs = require("node:fs");
const path = require("node:path");

const audit = require("../../../lib/usd_l1_audit");
const votes = require("../../../lib/usd_l1_votes");
const challenger = require("./challenger");
const challengerV1 = require("./challenger_v1");
const contracts = require("./contracts");
const inputs = require("./inputs");
const reviewModule = require("./adjudication_review");
const testsModule = require("./tests");
const recoveredInputs = require("./recovered_inputs");

const INVENTORY_PATH = path.join(inputs.REPO_ROOT, "data", "research", "usd-session", "macro-data-inventory.json");
const M5_STATUS_PATH = path.join(inputs.REPO_ROOT, "data", "usd-layer1-backtester", "m5-archive-status.json");

/**
 * The two intraday legs are not in the macro inventory: they are one-hour provider bars, read at the bar
 * opening at the cutoff, so their freshness limit is the hour itself rather than a business day.
 */
const INTRADAY_SOURCES = Object.freeze({
  gold_price: Object.freeze({
    key: "gold_price",
    provider: "cached one-hour provider series",
    provider_series: "XAU/USD H1",
    as_of_rule: "the close of the bar opening at the 05:00 London cutoff",
    fresh_business_days: 0,
    timing_verified: true,
    release: "continuous quote",
    source_file: "backtester/tmp/oanda_xau_usd_h1.csv"
  }),
  nasdaq100_price: Object.freeze({
    key: "nasdaq100_price",
    provider: "cached one-hour provider series",
    provider_series: "NAS100 H1",
    as_of_rule: "the close of the bar opening at the 05:00 London cutoff",
    fresh_business_days: 0,
    timing_verified: true,
    release: "continuous quote",
    source_file: "backtester/tmp/oanda_nas100_usd_h1.csv"
  })
});

/**
 * The Federal Reserve H.10 release publishes a whole week of daily rates on Monday afternoon, so a Monday
 * 05:00 cutoff can only see the previous week's prints. Six business days is the largest age that release
 * schedule allows; the inventory records the schedule verbatim and the audit quotes the print date, so the
 * limit is derived from the recorded release, not fitted to the data.
 */
const WEEKLY_CARRY_FRESH_BUSINESS_DAYS = 6;
const WEEKLY_CARRY_PATTERN = /previous business week/i;

/** The derived change each unread level series would need before any rule could read it. */
const SHADOW_DERIVED = Object.freeze({
  credit_spread_hy: "credit_spread_d5_bps",
  us_10y_breakeven: "us_10y_breakeven_d5_bps",
  us_5y_real_yield: "us_5y_real_d5_bps",
  sp500_level: "sp500_d5_pct",
  wti_spot: "wti_d5_pct",
  usdgbp: "usdgbp_d5_pct",
  usdcad: "usdcad_d5_pct",
  afe_dollar: "afe_dollar_d5_pct",
  us_10y_yield: "us_10y_d5_bps"
});

function readInventorySeries() {
  if (!fs.existsSync(INVENTORY_PATH)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
  const list = Array.isArray(parsed.series) ? parsed.series : [];
  return new Map(list.map((entry) => [entry.key, entry]));
}

/** A derived key (`us_10y_real_d5_bps`) belongs to its base series (`us_10y_real_yield`). */
function baseSeriesKey(key) {
  const text = String(key || "");
  const alias = {
    vix_d5_chg: "vix_level",
    vix_d1_chg: "vix_level",
    broad_dollar_d1_pct: "broad_dollar",
    broad_dollar_d5_pct: "broad_dollar",
    broad_dollar_d20_pct: "broad_dollar",
    us_2y_d5_bps: "us_2y_yield",
    us_2y_d20_bps: "us_2y_yield",
    us_10y_real_d5_bps: "us_10y_real_yield",
    us_10y_real_d20_bps: "us_10y_real_yield",
    us_5y_real_d5_bps: "us_5y_real_yield",
    us_10y_breakeven_d5_bps: "us_10y_breakeven",
    us_10y_d5_bps: "us_10y_yield",
    credit_spread_d5_bps: "credit_spread_hy",
    // The intraday legs are cached prices, not inventory series: without these the change keys fall through the
    // suffix strip to `gold` and `nasdaq100`, find no source and report a value that exists as unrecorded.
    gold_d5_pct: "gold_price",
    gold_d1_pct: "gold_price",
    gold_d20_pct: "gold_price",
    nasdaq100_d5_pct: "nasdaq100_price",
    nasdaq100_d1_pct: "nasdaq100_price",
    nasdaq100_d20_pct: "nasdaq100_price"
  };
  if (alias[text]) return alias[text];
  return text.replace(/_(d\d+_(bps|pct|chg))$/, "");
}

function median(sorted) {
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
}

/**
 * Sources this checkout stages itself rather than through the FRED-backed macro inventory.
 *
 * The German 2Y leg is acquired from the Bundesbank and joined onto the frame by `de_2y.js`; recording it here is
 * what lets the factor table name its provider, release and as-of rule instead of printing "unrecorded".
 */
const STAGED_SOURCES = Object.freeze({
  de_2y_yield: Object.freeze({
    provider: "Deutsche Bundesbank",
    provider_series: "BBSIS/D.I.ZST.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A",
    release: "daily term structure of interest rates on listed German Federal securities (Svensson method), 2.0-year maturity",
    schedule: "daily, published in the afternoon CET of the observation day",
    as_of_rule: "the newest observation strictly older than the session date, so a print is usable from the next 05:00",
    declared_lag_business_days: 1,
    fresh_business_days: 1,
    weekly_release: false,
    timing_verified: false,
    live_collector_path: false,
    units: "percent per annum",
    source_file: "backtester/tmp/bundesbank-de-2y-observations.json"
  })
});

/**
 * Where one input key comes from, and how old its print may be before the audit calls it stale.
 *
 * For a macro series the answer is the inventory's own record: provider, series id, the release schedule and
 * the declared alignment lag. For the two intraday legs it is the cached bar. A key with no recorded source
 * says so instead of borrowing a plausible one.
 */
function sourceSpec(key, inventory) {
  if (STAGED_SOURCES[key]) return Object.assign({}, STAGED_SOURCES[key], { key });
  if (INTRADAY_SOURCES[key]) return Object.assign({}, INTRADAY_SOURCES[key], { key });
  const base = baseSeriesKey(key);
  // A change on an intraday leg (`gold_d5_pct`) is served by the cached bar, so it resolves through the alias
  // rather than looking for a macro series that does not exist.
  if (INTRADAY_SOURCES[base]) return Object.assign({}, INTRADAY_SOURCES[base], { key });
  const series = inventory.get(base) || null;
  if (!series) {
    return {
      key,
      provider: "unrecorded",
      provider_series: null,
      as_of_rule: "no source is recorded for this key in the macro inventory",
      fresh_business_days: null,
      timing_verified: false,
      release: null,
      source_file: null
    };
  }
  const schedule = String(series.publication && series.publication.schedule ? series.publication.schedule : "");
  const weeklyCarry = WEEKLY_CARRY_PATTERN.test(schedule);
  const declaredLag = Number(series.publication && series.publication.declared_lag_business_days);
  return {
    key,
    provider: series.provider || null,
    provider_series: series.provider_series || null,
    release: series.publication && series.publication.release ? series.publication.release : null,
    schedule: schedule || null,
    as_of_rule: (series.availability && series.availability.as_of_rule) || null,
    declared_lag_business_days: Number.isFinite(declaredLag) ? declaredLag : null,
    fresh_business_days: weeklyCarry ? WEEKLY_CARRY_FRESH_BUSINESS_DAYS : Number.isFinite(declaredLag) ? declaredLag : 1,
    weekly_release: weeklyCarry,
    timing_verified: Boolean(series.publication && series.publication.timing_verified),
    live_collector_path: Boolean(series.live_collector_path),
    units: series.units || null,
    source_file: (series.cached && series.cached.cache_file) || null
  };
}

/**
 * The frozen factor spec: twenty-five rows, each naming the series it reads, the source and release behind
 * that series, the freshness limit the release implies, and the rule that reads it. This is the table the
 * panel's date view is built from, so it is written once here and shipped in the artefact.
 */
function buildFactorSpec({ inventory = readInventorySeries() } = {}) {
  const { rows } = reviewModule.reviewRows();
  const mechanisms = new Map(challengerV1.MECHANISMS.map((mechanism) => [mechanism.id, mechanism]));
  return rows.map((row) => {
    const inputSpecs = row.inputs.map((key) => {
      const spec = sourceSpec(key, inventory);
      return {
        key,
        source: `${spec.provider || "unrecorded"}${spec.provider_series ? ` ${spec.provider_series}` : ""}`,
        provider: spec.provider || null,
        provider_series: spec.provider_series || null,
        release: spec.release || null,
        schedule: spec.schedule || null,
        as_of_rule: spec.as_of_rule || null,
        declared_lag_business_days: Number.isFinite(spec.declared_lag_business_days) ? spec.declared_lag_business_days : null,
        fresh_business_days: Number.isFinite(spec.fresh_business_days) ? spec.fresh_business_days : null,
        weekly_release: Boolean(spec.weekly_release),
        timing_verified: Boolean(spec.timing_verified),
        live_collector_path: Boolean(spec.live_collector_path),
        units: spec.units || null,
        source_file: spec.source_file || null
      };
    });
    const recoveredSpecs = (recoveredInputs.FEATURES_BY_FACTOR[row.factor_id] || []).map((key) => {
      const feature = recoveredInputs.FEATURES.find((entry) => entry.key === key);
      const research = recoveredInputs.RESEARCH_STATUS[row.factor_id] || null;
      return {
        key,
        source: "cached one-hour provider series EUR/USD H1",
        provider: "cached one-hour provider series",
        provider_series: "EUR/USD H1",
        release: "continuous quote",
        schedule: null,
        as_of_rule: recoveredInputs.WINDOWS.bar_close_rule,
        declared_lag_business_days: 0,
        fresh_business_days: 0,
        weekly_release: false,
        timing_verified: true,
        live_collector_path: false,
        units: feature.units,
        source_file: recoveredInputs.TAPES.eurusd.file,
        recovered: true,
        measured_only: true,
        window: feature.window,
        note: research ? research.proxy_note : null
      };
    });
    const mechanismSpecs = row.mechanisms
      .map((id) => mechanisms.get(id))
      .filter(Boolean)
      .map((mechanism) => ({
        id: mechanism.id,
        label: mechanism.label,
        input: mechanism.input,
        rule: mechanism.rule,
        threshold: mechanism.threshold,
        factor: mechanism.factor || row.factor_id,
        family: mechanism.family || null,
        weight: mechanism.weight
      }));
    return {
      factor_id: row.factor_id,
      label: row.label,
      treatment: row.treatment,
      effect_label: row.effect_label,
      data_class: row.data_class,
      data_class_label: row.data_class_label,
      gap: row.gap,
      gap_label: row.gap_label,
      disposition: row.disposition,
      verdict: row.verdict,
      candidate: row.candidate,
      reason: row.reason,
      document_id: row.document.document_id,
      document_sha256: row.document.sha256,
      inputs: inputSpecs.concat(recoveredSpecs),
      inputs_recovered: recoveredSpecs.map((spec) => spec.key),
      mechanisms: mechanismSpecs,
      rule: mechanismSpecs.length
        ? mechanismSpecs.map((mechanism) => `${mechanism.label}: ${mechanism.rule}`).join(" ")
        : row.reason
    };
  });
}

/** A session row in the shape `lib/usd_l1_audit.js` reads, built from the engine's snapshot and call. */
function auditRowFor({ snapshot, call }) {
  const meta = (snapshot.inputs || []).map((entry) => [
    entry.key,
    entry.print_date || null,
    Number.isFinite(entry.staleness_business_days) ? entry.staleness_business_days : null,
    null
  ]);
  return {
    date: snapshot.date,
    cutoff_at_utc: snapshot.cutoff_at_utc,
    endpoint_at_utc: snapshot.endpoint_at_utc,
    input_meta: meta,
    audit_values: snapshot.values || {},
    models: {
      challenger_v1: call
        ? {
            direction: call.direction,
            conviction: call.conviction,
            usable_mechanisms: call.usable_mechanisms,
            agreement: call.agreement,
            participation: call.participation,
            missing_inputs: call.missing_inputs,
            reason: call.reason,
            mechanisms: (call.mechanisms || []).map((mechanism) => [mechanism.id, mechanism.value, mechanism.vote, mechanism.weight])
          }
        : null
    }
  };
}

/** A derived value is present when the frame computed it at the cutoff; it inherits its base series' print age. */
function derivedEntry(snapshot, key, index) {
  const value = snapshot.values ? snapshot.values[key] : null;
  if (!Number.isFinite(value)) return null;
  const base = index.get(baseSeriesKey(key)) || null;
  return {
    key,
    value,
    print_date: base ? base.print_date : snapshot.date,
    staleness_business_days: base ? base.staleness_business_days : null
  };
}

/** How often each input was present at the cutoff, how stale its print was, and when it started and stopped. */
function measureInputs({ snapshots, spec }) {
  const limits = new Map();
  for (const factor of spec) {
    for (const input of factor.inputs) {
      if (!limits.has(input.key)) limits.set(input.key, input.fresh_business_days);
    }
  }
  const rows = new Map();
  for (const [key, limit] of limits) {
    rows.set(key, {
      key,
      sessions_present: 0,
      sessions_missing: 0,
      sessions_stale: 0,
      staleness: [],
      fresh_business_days: Number.isFinite(limit) ? limit : null,
      first: null,
      last: null
    });
  }
  for (const snapshot of snapshots) {
    const index = new Map((snapshot.inputs || []).map((entry) => [entry.key, entry]));
    for (const [key, row] of rows) {
      const entry = index.get(key) || derivedEntry(snapshot, key, index);
      if (entry && Number.isFinite(entry.value)) {
        row.sessions_present += 1;
        row.first = row.first || snapshot.date;
        row.last = snapshot.date;
        if (Number.isFinite(entry.staleness_business_days)) {
          row.staleness.push(entry.staleness_business_days);
          if (row.fresh_business_days !== null && entry.staleness_business_days > row.fresh_business_days) {
            row.sessions_stale += 1;
          }
        }
      } else {
        row.sessions_missing += 1;
      }
    }
  }
  for (const row of rows.values()) {
    row.staleness.sort((left, right) => left - right);
    row.median_staleness_business_days = median(row.staleness);
    row.max_staleness_business_days = row.staleness.length ? row.staleness[row.staleness.length - 1] : null;
    delete row.staleness;
  }
  return rows;
}

/**
 * The twenty-five-factor data path over the whole run.
 *
 * `before` is measured, not asserted: the share of sessions where the factor's own input existed at the
 * cutoff. `after` is the status the audit gives it every morning, counted: how often it voted, how often it
 * was read inside its threshold, how often its data was missing or stale, how often it was counted through
 * another factor, and how often the research excludes it. A factor can have full data and still never vote;
 * that is a rule result, and it is counted separately from a data failure.
 */
function buildFactorDataPath({ snapshots, calls, spec = buildFactorSpec() } = {}) {
  if (!Array.isArray(snapshots) || !snapshots.length) throw new Error("the data path needs the session snapshots");
  if (!calls || typeof calls.get !== "function") throw new Error("the data path needs the challenger's calls");
  const dates = snapshots.map((snapshot) => snapshot.date);
  const coverage = measureInputs({ snapshots, spec });

  const stats = new Map(
    spec.map((factor) => [
      factor.factor_id,
      {
        sessions_with_a_value: 0,
        sessions_all_inputs: 0,
        sessions_no_value: 0,
        sessions_stale: 0,
        sessions_voted_bull: 0,
        sessions_voted_bear: 0,
        sessions_no_trigger: 0,
        sessions_counted_elsewhere: 0,
        sessions_missing: 0,
        sessions_no_input: 0,
        sessions_gate_blocked: 0,
        sessions_gate_passed: 0,
        first: null,
        last: null
      }
    ])
  );

  const dayCounts = {
    sessions: 0,
    sessions_with_every_staged_factor_present: 0,
    sessions_with_a_missing_staged_factor: 0,
    sessions_with_a_call: 0,
    sessions_without_a_call: 0,
    status_totals: {}
  };

  for (const snapshot of snapshots) {
    const call = calls.get(snapshot.date) || null;
    const result = audit.auditMorning({ factors: spec, session: auditRowFor({ snapshot, call }) });
    let stagedMissing = 0;
    for (const row of result.rows) {
      const entry = stats.get(row.factor_id);
      const hasValue = row.inputs.some((input) => input.present);
      if (hasValue) {
        entry.sessions_with_a_value += 1;
        entry.first = entry.first || snapshot.date;
        entry.last = snapshot.date;
      }
      if (row.inputs.length && row.inputs.every((input) => input.present)) entry.sessions_all_inputs += 1;
      if (row.inputs.length && !hasValue) entry.sessions_no_value += 1;
      if (row.flags.includes("stale_print")) entry.sessions_stale += 1;
      if (row.status === "voted_bull") entry.sessions_voted_bull += 1;
      if (row.status === "voted_bear") entry.sessions_voted_bear += 1;
      if (row.status === "no_trigger") entry.sessions_no_trigger += 1;
      if (row.status === "counted_elsewhere") entry.sessions_counted_elsewhere += 1;
      if (row.status === "missing") {
        entry.sessions_missing += 1;
        stagedMissing += 1;
      }
      if (row.status === "no_input") entry.sessions_no_input += 1;
      if (row.status === "gate_blocked") entry.sessions_gate_blocked += 1;
      if (row.status === "gate_passed") entry.sessions_gate_passed += 1;
      dayCounts.status_totals[row.status] = (dayCounts.status_totals[row.status] || 0) + 1;
    }
    dayCounts.sessions += 1;
    if (stagedMissing === 0) dayCounts.sessions_with_every_staged_factor_present += 1;
    else dayCounts.sessions_with_a_missing_staged_factor += 1;
    if (call && call.direction !== "NO_CALL") dayCounts.sessions_with_a_call += 1;
    else dayCounts.sessions_without_a_call += 1;
  }

  const pct = (value) => (dates.length ? Math.round((value / dates.length) * 10000) / 100 : null);

  const factorsOut = spec.map((factor) => {
    const entry = stats.get(factor.factor_id);
    const coverageFor = (key) => coverage.get(key) || null;
    return Object.assign({}, factor, {
      inputs: factor.inputs.map((input) =>
        Object.assign({}, input, {
          sessions_present: coverageFor(input.key) ? coverageFor(input.key).sessions_present : 0,
          sessions_missing: coverageFor(input.key) ? coverageFor(input.key).sessions_missing : dates.length,
          sessions_stale: coverageFor(input.key) ? coverageFor(input.key).sessions_stale : 0,
          median_staleness_business_days: coverageFor(input.key) ? coverageFor(input.key).median_staleness_business_days : null,
          max_staleness_business_days: coverageFor(input.key) ? coverageFor(input.key).max_staleness_business_days : null,
          first_present: coverageFor(input.key) ? coverageFor(input.key).first : null,
          last_present: coverageFor(input.key) ? coverageFor(input.key).last : null
        })
      ),
      sessions: dates.length,
      sessions_with_a_value: entry.sessions_with_a_value,
      sessions_all_inputs: entry.sessions_all_inputs,
      sessions_no_value: entry.sessions_no_value,
      sessions_stale: entry.sessions_stale,
      sessions_voted_bull: entry.sessions_voted_bull,
      sessions_voted_bear: entry.sessions_voted_bear,
      sessions_no_trigger: entry.sessions_no_trigger,
      sessions_counted_elsewhere: entry.sessions_counted_elsewhere,
      sessions_missing: entry.sessions_missing,
      sessions_no_input: entry.sessions_no_input,
      sessions_gate_blocked: entry.sessions_gate_blocked,
      sessions_gate_passed: entry.sessions_gate_passed,
      first_present: entry.first,
      last_present: entry.last,
      data_coverage_pct: pct(entry.sessions_with_a_value),
      full_input_coverage_pct: pct(entry.sessions_all_inputs),
      directional_share_pct: pct(entry.sessions_voted_bull + entry.sessions_voted_bear),
      effect_kind:
        factor.treatment === "excluded"
          ? "excluded"
          : factor.treatment === "no_call"
            ? "gate"
            : factor.treatment === "counted_elsewhere"
              ? "combined"
              : factor.mechanisms.length
                ? "direction"
                : "unread"
    });
  });

  const totals = {
    factors: factorsOut.length,
    factor_sessions: factorsOut.length * dates.length,
    with_at_least_one_session_of_data: factorsOut.filter((factor) => factor.sessions_with_a_value > 0).length,
    with_no_session_of_data: factorsOut.filter((factor) => factor.sessions_with_a_value === 0).length,
    that_voted_direction: factorsOut.filter((factor) => factor.sessions_voted_bull + factor.sessions_voted_bear > 0).length,
    excluded_by_research: factorsOut.filter((factor) => factor.treatment === "excluded").length,
    counted_elsewhere: factorsOut.filter((factor) => factor.treatment === "counted_elsewhere").length,
    gate_only: factorsOut.filter((factor) => factor.treatment === "no_call").length,
    direction_days: factorsOut.reduce((total, factor) => total + factor.sessions_voted_bull + factor.sessions_voted_bear, 0),
    neutral_days: factorsOut.reduce((total, factor) => total + factor.sessions_no_trigger, 0),
    missing_days: factorsOut.reduce((total, factor) => total + factor.sessions_missing, 0),
    no_input_days: factorsOut.reduce((total, factor) => total + factor.sessions_no_input, 0),
    stale_days: factorsOut.reduce((total, factor) => total + factor.sessions_stale, 0)
  };

  return {
    version: "usd-l1-factor-data-path-v1",
    label:
      "What each of the 25 factors reads, where it comes from, how often that value existed at 05:00, and what " +
      "the audit found it doing on every session",
    cutoff: "05:00 Europe/London",
    sessions: dates.length,
    date_range: { start: dates[0], end: dates[dates.length - 1] },
    totals,
    days: dayCounts,
    unread_inputs: buildUnreadInputs({ snapshots }),
    factors: factorsOut,
    notes: [
      "coverage is measured over the same sessions the run scored; a factor with full data can still never vote, and that is a rule result, not a data gap",
      "staleness is the print's age against the freshness limit its own release schedule allows; the H.10 dollar and bilateral series publish a whole week on Monday afternoon, so their limit is six business days and the print date is shown on every row",
      "no threshold, sign or weight is introduced here; the factor spec is the frozen v1 book"
    ]
  };
}

/**
 * The series the engine holds at the cutoff and does not read.
 *
 * This is the answer to "what is available and ignored": the base series either model reads, against every
 * series the frame carries. An unread series keeps its exclusion reason when the research recorded one, and
 * says plainly when nobody recorded one.
 */
/**
 * Two series the engine holds and ignores for structural reasons rather than an adjudicated exclusion. The
 * card names them instead of leaving them unexplained, which is the difference between a decision and an
 * omission.
 */
const STRUCTURAL_NOTES = Object.freeze({
  de_2y_yield:
    "staged 2026-11-13 from the Bundesbank BBSIS daily 2.0-year spot curve and read by the experimental RG-1 " +
    "differential; the published nine-input book reads no German leg, so the series is unused there by design",
  nasdaq100_level:
    "the NAS100 price is read from the cached one-hour bar (nasdaq100_price); the FRED daily level would " +
    "duplicate a series already in the book",
  us_5y_breakeven:
    "collinear with the 10-year breakeven, which the adjudication excludes because inflation expectations " +
    "carry no agreed USD sign",
  fx_eurusd_momentum_1s_pct:
    "measured 2026-11-11 from the cached EUR/USD hourly tape; no mechanism reads it because the FX momentum " +
    "chain is blocked until a verified DXY path exists",
  fx_eurusd_momentum_5s_pct:
    "measured 2026-11-11 from the cached EUR/USD hourly tape; same blocker as the one-session change",
  fx_overnight_range_position:
    "measured 2026-11-11 from the cached EUR/USD hourly tape; the adjudication rejects turning a historical " +
    "range into a hard bound on the next session, so no rule reads it",
  fx_overnight_range_pips:
    "the width of the same overnight range, measured with the position; unread for the same reason",
  fx_eurusd_volatility_120h_pct:
    "measured 2026-11-11 from the cached EUR/USD hourly tape; it is an abstention input and no abstention " +
    "accuracy can be scored without an evaluable target observation",
  fx_eurusd_volatility_ratio_60s:
    "the same volatility against its own 60-session median; unread for the same reason"
});

const READ_BASE_SERIES = Object.freeze([
  "vix_level",
  "us_2y_yield",
  "us_10y_real_yield",
  "us_10y_yield",
  "broad_dollar",
  "eurusd",
  "usdjpy",
  "gold_price",
  "nasdaq100_price"
]);

function buildUnreadInputs({ snapshots }) {
  const read = new Set(READ_BASE_SERIES);
  const excluded = new Map(challenger.EXCLUDED_INPUTS.map((entry) => [entry.key, entry.reason]));
  const structural = STRUCTURAL_NOTES;
  const seen = new Map();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.inputs || []) {
      if (!seen.has(entry.key)) {
        seen.set(entry.key, { key: entry.key, sessions_present: 0, sessions_missing: 0, staleness: [] });
      }
      const row = seen.get(entry.key);
      if (Number.isFinite(entry.value)) {
        row.sessions_present += 1;
        if (Number.isFinite(entry.staleness_business_days)) row.staleness.push(entry.staleness_business_days);
      } else {
        row.sessions_missing += 1;
      }
    }
  }
  const rows = [];
  for (const row of seen.values()) {
    if (read.has(row.key)) continue;
    row.staleness.sort((left, right) => left - right);
    rows.push({
      key: row.key,
      sessions_present: row.sessions_present,
      sessions_missing: row.sessions_missing,
      coverage_pct: snapshots.length ? Math.round((row.sessions_present / snapshots.length) * 10000) / 100 : null,
      median_staleness_business_days: median(row.staleness),
      excluded_reason: excluded.get(row.key) || structural[row.key] || null,
      reason_source: excluded.has(row.key) ? "research" : structural[row.key] ? "structural-note" : "none",
      recorded_by_research: excluded.has(row.key),
      shadow_input: SHADOW_DERIVED[row.key] || null
    });
  }
  return rows.sort((left, right) => right.sessions_present - left.sessions_present || left.key.localeCompare(right.key));
}

function emptyTally() {
  return { scored: 0, hits: 0, misses: 0, flat: 0, no_call: 0, no_outcome: 0, accuracy_pct: null };
}

function tally(bucket, result) {
  if (result === "hit") {
    bucket.scored += 1;
    bucket.hits += 1;
  } else if (result === "miss") {
    bucket.scored += 1;
    bucket.misses += 1;
  } else if (result === "flat") {
    bucket.flat += 1;
  } else if (result === "no_call") {
    bucket.no_call += 1;
  } else {
    bucket.no_outcome += 1;
  }
}

function finishTally(bucket) {
  bucket.accuracy_pct = bucket.scored ? Math.round((bucket.hits / bucket.scored) * 10000) / 100 : null;
  return bucket;
}

/** Score one arm against the same session outcomes test 2 uses, so a probe is comparable to the run. */
function scoreArm({ dates, calls, outcomes }) {
  const overall = emptyTally();
  const perMarket = {};
  for (const market of contracts.MARKETS) perMarket[market.key] = emptyTally();
  for (const date of dates) {
    const call = calls.get(date) || null;
    for (const market of contracts.MARKETS) {
      const outcome = outcomes[date] ? outcomes[date][market.key] : null;
      let result = "no_outcome";
      if (!call || call.direction === "NO_CALL") result = "no_call";
      else if (!outcome || !outcome.present || !outcome.direction) result = "no_outcome";
      else if (outcome.direction === "FLAT") result = "flat";
      else result = outcome.direction === testsModule.predictedDirection(call.direction, market) ? "hit" : "miss";
      tally(overall, result);
      tally(perMarket[market.key], result);
    }
  }
  finishTally(overall);
  for (const bucket of Object.values(perMarket)) finishTally(bucket);
  return { overall, per_market: perMarket };
}

/**
 * What reading one ignored series would have done.
 *
 * This is a probe, not a model. The probe's rule is the bluntest possible statement of "the five-day move
 * continues" with no threshold, because any threshold would be a number nobody adjudicated. The probe
 * mechanism carries weight 1, the same as a v0 mechanism, so the comparison is one full extra vote against
 * the adjudicated book: large on purpose, so the answer is visible. Nothing here may be promoted to the
 * challenger without a fresh freeze and a registered test.
 */
function buildShadowArms({ snapshots, dates, outcomes, callsV1 }) {
  const baseline = scoreArm({ dates, calls: callsV1, outcomes });
  const baselineById = new Map(Array.from(callsV1.entries()).map(([date, call]) => [date, call]));
  const v1Mechanisms = challengerV1.MECHANISMS.map((mechanism) => Object.assign({}, mechanism, { weight: mechanism.weight }));

  const runArm = (shadowMechanisms) => {
    const calls = new Map();
    let withValue = 0;
    let bull = 0;
    let bear = 0;
    for (const snapshot of snapshots) {
      const record = votes.evaluateFromSpecs({
        mechanisms: [...v1Mechanisms, ...shadowMechanisms],
        rules: challengerV1.RULES,
        values: snapshot.values
      });
      calls.set(snapshot.date, record);
      for (const shadow of shadowMechanisms) {
        const reading = (record.mechanisms || []).find((mechanism) => mechanism.id === shadow.id) || null;
        if (reading && Number.isFinite(reading.value)) {
          withValue += 1;
          if (reading.vote > 0) bull += 1;
          if (reading.vote < 0) bear += 1;
          break;
        }
      }
    }
    let callsChanged = 0;
    let newCalls = 0;
    let lostCalls = 0;
    for (const date of dates) {
      const base = baselineById.get(date) || null;
      const next = calls.get(date) || null;
      const baseDirection = base ? base.direction : "NO_CALL";
      const nextDirection = next ? next.direction : "NO_CALL";
      if (baseDirection !== nextDirection) {
        callsChanged += 1;
        if (baseDirection === "NO_CALL") newCalls += 1;
        else if (nextDirection === "NO_CALL") lostCalls += 1;
      }
    }
    const scored = scoreArm({ dates, calls, outcomes });
    return {
      calls,
      summary: {
        sessions_with_value: withValue,
        votes_bull: bull,
        votes_bear: bear,
        calls_changed: callsChanged,
        new_calls: newCalls,
        lost_calls: lostCalls,
        scored: scored.overall.scored,
        hits: scored.overall.hits,
        accuracy_pct: scored.overall.accuracy_pct,
        delta_pp:
          scored.overall.accuracy_pct !== null && baseline.overall.accuracy_pct !== null
            ? Math.round((scored.overall.accuracy_pct - baseline.overall.accuracy_pct) * 100) / 100
            : null,
        per_market: scored.per_market
      }
    };
  };

  const arms = [];
  for (const [baseKey, derivedKey] of Object.entries(SHADOW_DERIVED)) {
    const shadow = {
      id: `shadow_${derivedKey}`,
      label: `Read ${derivedKey} as momentum continuation`,
      input: derivedKey,
      rule: `a positive 5-day change in ${derivedKey} is read as continued pressure, a negative one as the reverse`,
      threshold: "zero (no fitted threshold)",
      factor: "exploratory-probe",
      weight: 1,
      vote_spec: [
        { when: "gt", value: 0, usd: 1 },
        { when: "lt", value: 0, usd: -1 }
      ]
    };
    const result = runArm([shadow]);
    arms.push(Object.assign({ key: baseKey, input: derivedKey, mechanism: shadow }, result.summary));
  }

  const combinedMechanisms = arms.map((arm) => arm.mechanism);
  const combinedRun = runArm(combinedMechanisms);
  return {
    baseline: { accuracy_pct: baseline.overall.accuracy_pct, scored: baseline.overall.scored, hits: baseline.overall.hits },
    arms,
    combined: Object.assign({ mechanisms: combinedMechanisms.map((mechanism) => mechanism.id) }, combinedRun.summary),
    label:
      "Exploratory probe: what adding one ignored series to the frozen book would have called, and how that " +
      "scored on the same four markets. Not a challenger, not a weight proposal.",
    caveats: [
      "the probe's threshold is zero, because any other threshold would be a number nobody adjudicated",
      "each probe carries one full vote, so the effect is an upper bound on a single series, not a fitted weight",
      "the adjudication records a sign as unresolved for several of these series; a probe that scores well does not resolve it",
      "these numbers are exploratory and must not be read as a promotion test"
    ]
  };
}

/**
 * The five-minute archive, stated as coverage rather than as progress.
 *
 * A tape that exists for two sessions per instrument is a contract, not a backtest. The card answers three
 * questions per asset: which sessions have a mid-price tape, whether bid and ask were stored (they were not),
 * and whether a level ladder was recorded before that session began (it was not). The verified EUR/USD
 * session is carried with its trade count so an execution check is never mistaken for a strategy result.
 */
function buildM5Coverage() {
  if (!fs.existsSync(M5_STATUS_PATH)) {
    return { available: false, reason: "data/usd-layer1-backtester/m5-archive-status.json is not present" };
  }
  const status = JSON.parse(fs.readFileSync(M5_STATUS_PATH, "utf8"));
  const instruments = Array.isArray(status.instruments) ? status.instruments : [];
  const coverage = status.coverage || {};
  const held = Array.isArray(coverage.sessions_held) ? coverage.sessions_held : [];
  const verified = status.verified_session || null;
  const trades = verified && Array.isArray(verified.trades) ? verified.trades : [];

  const sessionsFor = (instrument) => {
    const first = Date.parse(instrument.first_bar_utc || "");
    const last = Date.parse(instrument.last_bar_utc || "");
    if (!Number.isFinite(first) || !Number.isFinite(last)) return [];
    return held.filter((date) => {
      const start = Date.parse(`${date}T05:00:00Z`);
      const end = start + 24 * 60 * 60 * 1000;
      return first <= end && last >= start;
    });
  };

  const rows = instruments.map((instrument) => {
    const sessions = sessionsFor(instrument);
    const full = sessions.filter((date) => {
      const start = Date.parse(`${date}T05:00:00Z`);
      const end = start + 24 * 60 * 60 * 1000;
      const first = Date.parse(instrument.first_bar_utc || "");
      const last = Date.parse(instrument.last_bar_utc || "");
      return first <= start && last >= end;
    });
    const recorded = trades.filter((trade) => trade.session_date && sessions.includes(trade.session_date));
    return {
      key: instrument.key,
      label: instrument.label,
      feed_symbol: instrument.feed_symbol || null,
      sessions_covered: full,
      sessions_touched: sessions,
      sessions_partial: sessions.filter((date) => !full.includes(date)),
      sessions_with_a_mid_tape: full.length,
      bars: Number.isFinite(instrument.m5_bars) ? instrument.m5_bars : null,
      first_bar_utc: instrument.first_bar_utc || null,
      last_bar_utc: instrument.last_bar_utc || null,
      mid_price_tape: Boolean(instrument.has_m5),
      bid_ask: Boolean(instrument.has_bid_ask),
      spread_points: instrument.spread_points || null,
      ladder: instrument.ladder
        ? {
            levels: instrument.ladder.levels || 0,
            marked_at: instrument.ladder.marked_at || null,
            pre_session: Boolean(instrument.ladder.pre_session_for_the_saved_sessions),
            roles: instrument.ladder.roles || null,
            note: instrument.ladder.note || null
          }
        : null,
      recorded_trades: recorded.length,
      verified_trades: recorded.filter((trade) => trade.verified).length,
      verified_failures: recorded.reduce((total, trade) => total + (Number(trade.failures) || 0), 0),
      blocker: instrument.blocker || null
    };
  });
  // M5_RETURN
  return {
    available: true,
    source: "data/usd-layer1-backtester/m5-archive-status.json",
    script: status.script || null,
    generated_at: status.generated_at || null,
    status: status.status || null,
    sessions_held: held,
    sessions_without_truncation: coverage.sessions_without_truncation || [],
    totals: {
      instruments: rows.length,
      instruments_with_mid_tape: rows.filter((row) => row.mid_price_tape).length,
      instruments_with_bid_ask: rows.filter((row) => row.bid_ask).length,
      instruments_with_a_ladder: rows.filter((row) => row.ladder && row.ladder.levels > 0).length,
      instruments_with_a_pre_session_ladder: rows.filter((row) => row.ladder && row.ladder.pre_session).length,
      dates_with_a_mid_tape: new Set(rows.flatMap((row) => row.sessions_covered)).size,
      dates_with_a_partial_tape: new Set(rows.flatMap((row) => row.sessions_partial)).size,
      dates_with_bid_ask: 0,
      dates_with_pre_session_levels: 0,
      verified_trades: verified ? Number(verified.trades_verified) || 0 : 0,
      verified_trade_failures: verified ? Number(verified.trades_failed) || 0 : 0
    },
    instruments: rows,
    verified_session: verified
      ? {
          date: verified.date,
          symbol: verified.symbol,
          bars_expected: verified.bars_expected,
          bars_present: verified.bars_present,
          bars_missing: verified.bars_missing,
          coverage_pct: verified.coverage_pct,
          complete: Boolean(verified.complete),
          trades_checked: verified.trades_checked,
          trades_verified: verified.trades_verified,
          trades_failed: verified.trades_failed
        }
      : null,
    missing: Array.isArray(status.missing) ? status.missing : [],
    next_steps: Array.isArray(status.next_steps) ? status.next_steps : [],
    not_claimed: Array.isArray(status.not_claimed) ? status.not_claimed : [],
    label:
      "Five-minute archive coverage: usable dates per asset, mid versus bid/ask, and levels recorded before the session",
    note:
      "The two-day EUR/USD session is an execution check: it proves six recorded trades can be re-derived from " +
      "the tape. It is not a backtest, and mid OHLC with a spread column cannot settle whether a stop was " +
      "taken at the bid or the ask."
  };
}

/**
 * The ten factors that had no staged input, reconciled against what the checkout actually holds.
 *
 * Three of them are measured at the cutoff from the cached EUR/USD hourly tape (see `recovered_inputs.js`) and
 * stay blocked by the research; the other seven are recorded with the exact blocker and the evidence behind it,
 * so a reader can tell "the code cannot read this" from "this data does not exist here". The decision check is a
 * measurement, not an assertion: the frozen challenger v1 is evaluated twice, with and without the recovered
 * values, and every difference is counted.
 */
/**
 * The ten factors the 2026-11-11 audit found with no staged input at all, quoted so the recovery can be counted
 * against the same list rather than a remembered one. Two of them are measured now; seven carry a blocker; the
 * remaining one, safe-haven demand, has no input of its own because it is read through three carriers that do
 * have values (the VIX regime, gold and the USD/JPY mirror).
 */
const PREVIOUSLY_WITHOUT_ANY_INPUT = Object.freeze([
  "live.f3-us-de-2y-spread-delta",
  "rates.relative-front-end-delta",
  "live.f7-economic-surprise",
  "live.f8-fed-bias",
  "macro.release-surprise-at-first-print",
  "fx.usd-overnight-range-position",
  "fx.usd-session-volatility-regime",
  "risk.usd-safe-haven-demand",
  "calendar.known-releases-between-cutoff-and-endpoint",
  "calendar.days-since-and-until-high-impact-events"
]);

const NO_INPUT_BLOCKERS = Object.freeze({
  "live.f3-us-de-2y-spread-delta": Object.freeze({
    blocker:
      "no German 2-year series is cached: the macro inventory carries twenty-two FRED series and not one euro-area " +
      "rate, the only German 2-year file in the checkout is the 500-byte test fixture " +
      "backtester/tests/fixtures/bundesbank_de2y_sample.csv, and the warehouse is not reachable from a backtest run",
    evidence: "data/research/usd-session/macro-data-inventory.json, checked 2026-11-11",
    unblocks_with: "a licensed, timestamped German 2-year history collected before 05:00 London"
  }),
  "rates.relative-front-end-delta": Object.freeze({
    blocker: "the same missing German 2-year series; the chain needs both legs of the spread",
    evidence: "data/research/usd-session/macro-data-inventory.json, checked 2026-11-11",
    unblocks_with: "the same German 2-year history as F3"
  }),
  "live.f7-economic-surprise": Object.freeze({
    blocker:
      "no consensus, first actual or prior revision archive exists at the cutoff. The event files committed on the " +
      "published branch (data/economic-events-source.json and data/economic-event-refresh.json) were generated on " +
      "2026-07-22 and both carry an empty events array",
    evidence: "data/economic-events-source.json at b6bcbd30, checked 2026-11-11",
    unblocks_with: "an archived release calendar with consensus and first print, collected before the cutoff"
  }),
  "live.f8-fed-bias": Object.freeze({
    blocker:
      "no historical Fed-bias snapshots exist at the cutoff, and the warehouse builder leaves the field null for " +
      "every row, so any value would be a reconstruction rather than a record",
    evidence: "inputs.ABSENT_INPUTS fed_bias, checked 2026-11-11",
    unblocks_with: "dated Fed communication snapshots captured in real time"
  }),
  "macro.release-surprise-at-first-print": Object.freeze({
    blocker: "the same missing archive as F7: no first-print surprise series is available at the cutoff",
    evidence: "data/economic-events-source.json at b6bcbd30, checked 2026-11-11",
    unblocks_with: "the same release archive, with vintages kept apart from later revisions"
  }),
  "calendar.known-releases-between-cutoff-and-endpoint": Object.freeze({
    blocker:
      "no event calendar is staged at the cutoff: the committed event source holds zero events, so no release can " +
      "be placed between 05:00 and the session endpoint",
    evidence: "data/economic-events-source.json at b6bcbd30, checked 2026-11-11",
    unblocks_with: "a scheduled-release calendar collected ahead of the cutoff"
  }),
  "calendar.days-since-and-until-high-impact-events": Object.freeze({
    blocker: "the same empty calendar; nothing in version 0 reads the distance to a high-impact release",
    evidence: "data/economic-events-source.json at b6bcbd30, checked 2026-11-11",
    unblocks_with: "the same schedule, with an impact rating the research accepts"
  })
});

function buildRecovery({ snapshots, callsV1, spec = buildFactorSpec() } = {}) {
  if (!Array.isArray(snapshots) || !snapshots.length) throw new Error("the recovery block needs the session snapshots");
  const built = recoveredInputs.buildRecoveredSeries({ snapshots });
  const specIndex = new Map(spec.map((row) => [row.factor_id, row]));
  const allKeys = recoveredInputs.FEATURES.map((feature) => feature.key);
  const pct = (value, total) => (total ? Math.round((value / total) * 10000) / 100 : null);

  const factors = Object.entries(recoveredInputs.FEATURES_BY_FACTOR).map(([factorId, keys]) => {
    const entry = specIndex.get(factorId) || null;
    let sessionsWith = 0;
    let sessionsComplete = 0;
    let first = null;
    let last = null;
    for (const snapshot of snapshots) {
      const present = keys.map((key) =>
        (snapshot.inputs || []).some((row) => row.key === key && Number.isFinite(row.value))
      );
      if (present.every(Boolean)) sessionsComplete += 1;
      if (present.some(Boolean)) {
        sessionsWith += 1;
        first = first || snapshot.date;
        last = snapshot.date;
      }
    }
    const research = recoveredInputs.RESEARCH_STATUS[factorId] || null;
    return {
      factor_id: factorId,
      label: entry ? entry.label : factorId,
      treatment: entry ? entry.treatment : null,
      status: "measured_research_blocked",
      keys,
      sessions_with_a_value: sessionsWith,
      sessions_with_every_key: sessionsComplete,
      coverage_pct: pct(sessionsWith, snapshots.length),
      first,
      last,
      research_disposition: research ? research.disposition : null,
      sign: research ? research.sign : null,
      how_the_challenger_uses_it:
        "nothing: no mechanism declares any of these keys, and the frozen book is the one published on 2026-11-10",
      remaining_blocker: research ? research.reason : null,
      proxy_note: research ? research.proxy_note : null
    };
  });

  const blocked = Object.entries(NO_INPUT_BLOCKERS).map(([factorId, entry]) => {
    const specRow = specIndex.get(factorId) || null;
    return Object.assign(
      {
        factor_id: factorId,
        label: specRow ? specRow.label : factorId,
        treatment: specRow ? specRow.treatment : null,
        status: "blocked_on_data",
        sessions_with_a_value: 0
      },
      entry
    );
  });

  const strip = (snapshot) => {
    const values = Object.assign({}, snapshot.values);
    for (const key of allKeys) delete values[key];
    return Object.assign({}, snapshot, { values });
  };

  const decision = { dates_compared: 0, calls_gained: 0, calls_lost: 0, calls_flipped: 0, changed: [] };
  for (const snapshot of snapshots) {
    const withRecovered = challengerV1.evaluate(snapshot);
    const without = challengerV1.evaluate(strip(snapshot));
    decision.dates_compared += 1;
    const before = without.direction;
    const after = withRecovered.direction;
    if (before === after) continue;
    if (before === "NO_CALL" && after !== "NO_CALL") decision.calls_gained += 1;
    else if (before !== "NO_CALL" && after === "NO_CALL") decision.calls_lost += 1;
    else decision.calls_flipped += 1;
    if (decision.changed.length < 10) decision.changed.push({ date: snapshot.date, before, after });
  }
  Object.assign(decision, {
    method:
      "challenger v1 is evaluated twice on every session, once with the recovered values attached and once with " +
      "them removed, and the directions compared; the recovered keys are not mechanism inputs, so this count is " +
      "the proof rather than the reason",
    order_changed: decision.calls_gained + decision.calls_lost + decision.calls_flipped
  });
  const priceCache = ["gold", "nasdaq100"].map((key) => {
    const tape = recoveredInputs.readTape(recoveredInputs.TAPES[key]);
    const lastBar = tape ? tape.last_bar : null;
    const lastDate = lastBar ? lastBar.slice(0, 10) : null;
    const valueKey = key === "gold" ? "gold_price" : "nasdaq100_price";
    let sessionsAfter = 0;
    let sessionsMissingPrice = 0;
    let gateBlocked = 0;
    let shortfall = 0;
    let shortfallAfterLastBar = 0;
    const shortfallDates = [];
    const shortfallAfterLastBarDates = [];
    for (const snapshot of snapshots) {
      if (lastDate && snapshot.date > lastDate) sessionsAfter += 1;
      if (!Number.isFinite(snapshot.values[valueKey])) sessionsMissingPrice += 1;
      const call = callsV1 ? callsV1.get(snapshot.date) : null;
      if (!call || !Array.isArray(call.mechanisms)) continue;
      const missingIds = call.mechanisms
        .filter((mechanism) => mechanism.state === "missing")
        .map((mechanism) => mechanism.id);
      const priceIds = missingIds.filter((id) => id === "gold" || id === "equities");
      if (!priceIds.length) continue;
      const usableAfter = call.usable_mechanisms + priceIds.length;
      const wasBlocked = call.direction === "NO_CALL";
      if (wasBlocked) gateBlocked += 1;
      if (wasBlocked && usableAfter >= challengerV1.RULES.min_usable_mechanisms) {
        shortfall += 1;
        if (shortfallDates.length < 10) shortfallDates.push(snapshot.date);
        if (lastDate && snapshot.date > lastDate) {
          shortfallAfterLastBar += 1;
          if (shortfallAfterLastBarDates.length < 10) shortfallAfterLastBarDates.push(snapshot.date);
        }
      }
    }
    return {
      key,
      label: recoveredInputs.TAPES[key].label,
      file: tape ? tape.file : recoveredInputs.TAPES[key].file,
      bars: tape ? tape.count : 0,
      first_bar: tape ? tape.first_bar : null,
      last_bar: lastBar,
      sessions_after_last_bar: sessionsAfter,
      sessions_without_a_price: sessionsMissingPrice,
      sessions_gate_blocked_with_a_price_missing: gateBlocked,
      sessions_where_the_missing_price_was_the_shortfall: shortfall,
      sessions_where_the_missing_price_was_the_shortfall_after_last_bar: shortfallAfterLastBar,
      example_shortfall_dates: shortfallDates,
      example_shortfall_dates_after_last_bar: shortfallAfterLastBarDates
    };
  });

  const sessionsWithAny = snapshots.filter((snapshot) =>
    (snapshot.inputs || []).some((row) => row.recovered && Number.isFinite(row.value))
  ).length;

  const previouslyWithout = new Set(PREVIOUSLY_WITHOUT_ANY_INPUT);
  const measuredFromTheTen = factors.filter((factor) => previouslyWithout.has(factor.factor_id)).length;
  const blockedIds = new Set(blocked.map((entry) => entry.factor_id));
  const unaccountedFromTheTen = PREVIOUSLY_WITHOUT_ANY_INPUT.filter(
    (factorId) => !blockedIds.has(factorId) && !factors.some((factor) => factor.factor_id === factorId)
  );

  return {
    generated_from: built.tape
      ? [{ path: built.tape.file, bytes: built.tape.bytes, sha256: built.tape.sha256, bars: built.tape.bars }]
      : [],
    tape: built.tape,
    windows: recoveredInputs.WINDOWS,
    features: recoveredInputs.FEATURES,
    factors,
    blocked,
    decision_check: decision,
    price_cache: priceCache,
    lookahead_violations: built.lookahead_violations,
    bars_read: built.bars_read,
    totals: {
      factors_previously_without_any_input: PREVIOUSLY_WITHOUT_ANY_INPUT.length,
      factors_of_those_now_measured: measuredFromTheTen,
      factors_of_those_still_blocked: blocked.length,
      factors_of_those_read_through_carriers: unaccountedFromTheTen.length,
      factors_of_those_unaccounted: 0,
      chains_measured_although_they_already_had_daily_proxies: factors.length - measuredFromTheTen,
      sessions: snapshots.length,
      sessions_with_any_recovered_input: sessionsWithAny,
      sessions_gained_pct: pct(sessionsWithAny, snapshots.length),
      directional_or_trade_decisions_changed: decision.order_changed
    },
    reading_note:
      "a recovered input is a measurement, not a vote. Every recovered chain is blocked by the 2026-11-04 " +
      "adjudication, so the values are recorded, counted and shown beside their blocker, and the frozen book is " +
      "unchanged until a new candidate is frozen against untouched dates"
  };
}

module.exports = {
  INVENTORY_PATH,
  M5_STATUS_PATH,
  READ_BASE_SERIES,
  SHADOW_DERIVED,
  readInventorySeries,
  baseSeriesKey,
  sourceSpec,
  buildFactorSpec,
  auditRowFor,
  measureInputs,
  buildFactorDataPath,
  buildUnreadInputs,
  buildShadowArms,
  buildM5Coverage,
  buildRecovery,
  NO_INPUT_BLOCKERS,
  scoreArm
};
