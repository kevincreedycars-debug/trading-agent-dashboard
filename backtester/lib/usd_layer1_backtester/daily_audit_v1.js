"use strict";

/**
 * The per-morning access ledger and outcome join for USD Layer 1 decision rules v1 (research only).
 *
 * Two passes are kept separate:
 *   1. `buildCalls` writes one row per eligible morning from the stored inputs and the frozen rules.
 *   2. `scoreCalls` joins the DXY endpoints afterwards, so a call cannot be edited to fit the price.
 *
 * A factor with no source is recorded as a gap. It is never turned into a zero vote and never borrows a
 * value from a neighbouring session or a later print.
 */

const fs = require("node:fs");
const path = require("node:path");

const decision = require("./decision_rules_v1");
const eventCalendar = require("./event_calendar_v1");
const f8 = require("./f8_fed_bias");

const DAILY_CALLS = "data/usd-layer1-backtester/usd-l1-daily-calls-v1.json";
const FACTOR_CSV = "data/usd-layer1-backtester/usd-l1-factor-access-v1.csv";
const DXY_CSV = "data/usd-layer1-backtester/usd-l1-dxy-endpoints-v1.csv";

const DXY_ENDPOINTS = "backtester/tmp/ftmo_dxy_cash_h1.csv";
const MARKET_FILES = Object.freeze({
  EURUSD: { label: "EUR/USD", file: "backtester/tmp/oanda_eur_usd_h1.csv", usdBullishPredicts: "DOWN" },
  XAUUSD: { label: "Gold", file: "backtester/tmp/oanda_xau_usd_h1.csv", usdBullishPredicts: "DOWN" },
  BTCUSD: { label: "BTC/USD", file: "backtester/tmp/binance_btcusdt_1h.csv", usdBullishPredicts: "DOWN" },
  NAS100: { label: "NAS100", file: "backtester/tmp/oanda_nas100_usd_h1.csv", usdBullishPredicts: "DOWN" }
});

/**
 * The 25 intended factors, their role in the frozen decision, and the stored inputs they read.
 *
 * `role` is one of: direction, counted_elsewhere, excluded, inactive, event_missing, gate.
 */
const FACTOR_PLAN = Object.freeze([
  {
    id: "live.f1-vix-level",
    name: "VIX level and risk regime",
    role: "direction",
    signals: ["vix_level"],
    inputs: ["vix_level", "vix_d5_chg"],
    source: "FRED VIXCLS (stored daily print)",
    freshness: "daily print, used through the following London morning",
    calculation: "Frozen VIX regime vote from the nine-input book: high/rising volatility votes USD-weak, low/falling votes USD-strong.",
    gap_cause: "none",
    fix: "Read from stored FRED print and metadata; no backfill needed."
  },
  {
    id: "risk.vix-level-and-change-at-cutoff",
    name: "VIX level and change at the cutoff",
    role: "counted_elsewhere",
    signals: ["vix_level", "vix_change"],
    inputs: ["vix_level", "vix_d5_chg"],
    source: "FRED VIXCLS (stored daily print)",
    freshness: "daily print; change is a five-session difference",
    calculation: "Two frozen VIX signals read the same print; F1 and this row share it and cannot vote twice.",
    gap_cause: "none",
    fix: "Shared with F1; counted once in the twelve-signal book."
  },
  {
    id: "live.f2-us-2y-delta",
    name: "US 2Y yield, five-session change",
    role: "direction",
    signals: ["us_2y"],
    inputs: ["us_2y_d5_bps", "us_2y_yield"],
    source: "FRED DGS2 (stored daily print)",
    freshness: "daily print, five-session change",
    calculation: "Sign of the five-session change in basis points: up +1 USD, down -1, unchanged 0.",
    gap_cause: "none",
    fix: "Read from the stored FRED print; no backfill needed."
  },
  {
    id: "live.f3-us-de-2y-spread-delta",
    name: "US minus Germany 2Y spread, five-session change",
    role: "counted_elsewhere",
    signals: ["relative_front_end"],
    inputs: ["us_de_2y_spread_d5_bps", "us_2y_yield", "de_2y_yield"],
    source: "FRED DGS2 and Bundesbank BBSIS 2Y",
    freshness: "daily prints; both legs must be present",
    calculation: "F3 is the same print as the frozen relative-front-end signal and never votes twice.",
    gap_cause: "none",
    fix: "Bundesbank 2Y leg is stored; missing legs are recorded, never filled."
  },
  {
    id: "live.f4-real-yield-delta",
    name: "US 10Y real yield, five-session change",
    role: "direction",
    signals: ["real_yield"],
    inputs: ["us_10y_real_d5_bps", "us_10y_real_yield"],
    source: "FRED DFII10 (stored daily print)",
    freshness: "daily print, five-session change",
    calculation: "Sign of the five-session change in basis points: up +1 USD, down -1, unchanged 0.",
    gap_cause: "none",
    fix: "Read from the stored FRED print; no backfill needed."
  },
  {
    id: "rates.us-front-end-delta",
    name: "US front-end rate change",
    role: "counted_elsewhere",
    signals: ["us_2y"],
    inputs: ["us_2y_d5_bps"],
    source: "FRED DGS2",
    freshness: "daily print, five-session change",
    calculation: "Same print as the US 2Y signal; counted once.",
    gap_cause: "none",
    fix: "Shared with the US 2Y signal."
  },
  {
    id: "rates.relative-front-end-delta",
    name: "US minus Germany front-end spread",
    role: "direction",
    signals: ["relative_front_end"],
    inputs: ["us_de_2y_spread_d5_bps", "us_2y_yield", "de_2y_yield"],
    source: "FRED DGS2 and Bundesbank BBSIS 2Y",
    freshness: "daily prints; both legs must be present",
    calculation: "Sign of the five-session spread change: widening +1 USD, narrowing -1, unchanged 0.",
    gap_cause: "none",
    fix: "Stored Bundesbank 2Y leg; a missing leg is a recorded abstention."
  },
  {
    id: "rates.real-yield-delta",
    name: "US real yield change",
    role: "counted_elsewhere",
    signals: ["real_yield"],
    inputs: ["us_10y_real_d5_bps"],
    source: "FRED DFII10",
    freshness: "daily print, five-session change",
    calculation: "Same print as the real-yield signal; counted once.",
    gap_cause: "none",
    fix: "Shared with the real-yield signal."
  },
  {
    id: "rates.term-premium-and-curve",
    name: "Term premium and curve",
    role: "excluded",
    signals: [],
    inputs: [],
    source: "No staged input in v1",
    freshness: "not applicable",
    calculation: "The research excluded this factor from the voting book; the row proves it was reviewed.",
    gap_cause: "excluded",
    fix: "No backfill: exclusion is the frozen disposition."
  },
  {
    id: "rates.credit-spread-delta",
    name: "Credit spread change",
    role: "excluded",
    signals: [],
    inputs: [],
    source: "No staged input in v1",
    freshness: "not applicable",
    calculation: "The research excluded this factor from the voting book; the row proves it was reviewed.",
    gap_cause: "excluded",
    fix: "No backfill: exclusion is the frozen disposition."
  },
  {
    id: "live.f5-dxy-delta",
    name: "Broad dollar momentum",
    role: "direction",
    signals: ["broad_dollar"],
    inputs: ["broad_dollar_d5_pct", "broad_dollar_d1_pct"],
    source: "FRED DTWEXBGS, a declared stand-in for ICE DXY",
    freshness: "daily H.10 print; the stored print date is checked",
    calculation: "Frozen five-session broad-dollar vote: rise +1 USD, fall -1.",
    gap_cause: "none",
    fix: "Read from the stored H.10 print; not an ICE cash DXY substitute for test 1."
  },
  {
    id: "live.f6-gold-delta",
    name: "Gold five-session change",
    role: "direction",
    signals: ["gold"],
    inputs: ["gold_d5_pct", "gold_price"],
    source: "Cached gold H1 and daily series",
    freshness: "intraday cache at 05:00; five-session change",
    calculation: "Frozen gold vote: a rising five-session gold price votes USD-weak, falling votes USD-strong.",
    gap_cause: "none",
    fix: "Read from the stored gold cache; missing prints are recorded."
  },
  {
    id: "live.f9-dollar-smile",
    name: "Dollar smile",
    role: "counted_elsewhere",
    signals: ["vix_level", "vix_change"],
    inputs: ["vix_level", "vix_d5_chg"],
    source: "FRED VIXCLS",
    freshness: "daily print",
    calculation: "The smile is represented by the two VIX signals; it is not a third vote.",
    gap_cause: "none",
    fix: "Shared with the risk family."
  },
  {
    id: "live.f10-equity-versus-usd",
    name: "Equity versus USD",
    role: "direction",
    signals: ["equities"],
    inputs: ["nasdaq100_d5_pct", "nasdaq100_price"],
    source: "Cached NAS100 daily and H1 series",
    freshness: "intraday cache at 05:00; five-session change",
    calculation: "Frozen equity vote: equities rising votes USD-weak, falling votes USD-strong.",
    gap_cause: "none",
    fix: "Read from the stored NAS100 cache; missing prints are recorded."
  },
  {
    id: "live.f7-economic-surprise",
    name: "Economic surprise / release surprise",
    role: "event_missing",
    signals: [],
    inputs: [],
    source: "Staged event calendar v1 carries the release timing for FOMC statements only; no consensus or first-print history is staged",
    freshness: "requires release time and first print versus consensus",
    calculation: "Timing is now staged for one event type, but a surprise needs the consensus and the first print, so it still cannot be computed at 05:00. It is a recorded gap, not a neutral vote.",
    gap_cause: "release_consensus_missing",
    fix: "Stage consensus and first print per release; a calendar alone cannot produce a surprise."
  },
  {
    id: "live.f8-fed-bias",
    name: "F8 Fed bias",
    role: "direction",
    signals: ["fed_bias"],
    inputs: [],
    source: "Federal Reserve FOMC statement archive, read by release timestamp",
    freshness: "latest statement at or before the cutoff remains valid until superseded",
    calculation: "RG-2: hawkish shift +1 USD, dovish shift -1, neutral 0. No new statement means the last one still stands.",
    gap_cause: "none",
    fix: "Historical statements carry release times; no daily collection needed."
  },
  {
    id: "macro.release-surprise-at-first-print",
    name: "Release surprise at first print",
    role: "event_missing",
    signals: [],
    inputs: [],
    source: "Staged event calendar v1 carries the timing only; no consensus history is staged",
    freshness: "requires first print, consensus and release time",
    calculation: "The release clock is staged for FOMC statements; the first print and the consensus are not, so the surprise cannot be computed.",
    gap_cause: "release_consensus_missing",
    fix: "Stage a historical release archive with first print and consensus; no gap fill is permitted."
  },
  {
    id: "fx.usd-session-momentum",
    name: "USD session momentum",
    role: "direction",
    signals: ["session_momentum"],
    inputs: ["fx_eurusd_momentum_1s_pct", "fx_eurusd_momentum_5s_pct"],
    source: "EUR/USD and USD/JPY cached H1 tape at 05:00",
    freshness: "one-hour bar opening at the cutoff",
    calculation: "Mean of the EUR/USD and USD/JPY mirror votes; both legs must exist.",
    gap_cause: "none",
    fix: "Read from the intraday cache; after 2026-04-30 the cache is absent and the gate is undefined."
  },
  {
    id: "fx.usd-overnight-range-position",
    name: "USD overnight range position",
    role: "direction",
    signals: ["overnight_range"],
    inputs: ["fx_overnight_range_position", "fx_overnight_range_pips"],
    source: "EUR/USD cached H1 overnight range",
    freshness: "one-hour bar opening at the cutoff",
    calculation: "RG-3: position above 0.7 votes USD-strong, below 0.3 USD-weak, otherwise 0.",
    gap_cause: "none",
    fix: "Read from the intraday cache; a missing range is a recorded abstention."
  },
  {
    id: "fx.usd-session-volatility-regime",
    name: "USD session volatility regime",
    role: "inactive",
    signals: [],
    inputs: ["fx_eurusd_volatility_ratio_60s", "fx_eurusd_volatility_120h_pct"],
    source: "EUR/USD cached H1 volatility",
    freshness: "60-session ratio at 05:00",
    calculation: "Does not vote. It is the RG-4 gate: tradeable only when the ratio is at least 1.0.",
    gap_cause: "none",
    fix: "Gate reads the stored ratio; after 2026-04-30 the ratio is absent, so the gate is undefined."
  },
  {
    id: "risk.usd-safe-haven-demand",
    name: "Safe-haven demand",
    role: "direction",
    signals: ["safe_haven"],
    inputs: ["gold_d1_pct", "usdjpy_d1_pct", "usdchf_d1_pct"],
    source: "Cached gold H1 and H.10 USD/JPY; CHF confirmation only",
    freshness: "prior-session changes at 05:00",
    calculation: "RG-5: gold and JPY both weaken by more than 0.25% votes +1 USD, both strengthen -1; CHF never votes alone.",
    gap_cause: "none",
    fix: "Read from stored prints; a missing leg is a recorded abstention."
  },
  {
    id: "risk.risk-on-off-cross-asset-state",
    name: "Risk-on / risk-off cross-asset state",
    role: "counted_elsewhere",
    signals: ["vix_level", "equities", "gold"],
    inputs: ["vix_level", "nasdaq100_d5_pct", "gold_d5_pct"],
    source: "FRED VIXCLS and cached equity/gold series",
    freshness: "daily and intraday prints",
    calculation: "Represented by the risk and cross-asset signals; it is not a separate vote.",
    gap_cause: "none",
    fix: "Shared with the risk and cross-asset families."
  },
  {
    id: "calendar.known-releases-between-cutoff-and-endpoint",
    name: "Known releases between cutoff and endpoint",
    role: "calendar_window",
    signals: [],
    inputs: [],
    source: "Staged event calendar v1 (FOMC statement release instants only)",
    freshness: "release instants are known before the cutoff; the FOMC publishes its meeting calendar a year ahead",
    calculation: "Counts the staged high-impact releases whose release instant falls after the 05:00 cutoff and at or before the 05:00 endpoint. The check runs on every morning and its scope is one event type.",
    gap_cause: "calendar_partial",
    fix: "Stage the remaining release types (CPI, employment situation, PCE, retail sales, ISM, GDP) with timestamps and impact; the band-5 cap stays until then."
  },
  {
    id: "calendar.days-since-and-until-high-impact-events",
    name: "Days since and until high-impact events",
    role: "calendar_window",
    signals: [],
    inputs: [],
    source: "Staged event calendar v1 (FOMC statement release instants only)",
    freshness: "derived from the same staged release instants at the cutoff",
    calculation: "Calendar days from the cutoff to the last staged release on or before it, and to the next staged release after the endpoint. FOMC statements only.",
    gap_cause: "calendar_partial",
    fix: "Stage the remaining release types; the distance to an unlisted release cannot be computed from a list that does not contain it."
  },
  {
    id: "data.quality-gate-for-abstention",
    name: "Data-quality gate for abstention",
    role: "gate",
    signals: [],
    inputs: ["fx_eurusd_volatility_ratio_60s"],
    source: "Frozen decision code",
    freshness: "evaluated at every cutoff",
    calculation: "A missing required input abstains; it is never replaced by zero or a neighbour. RG-4 is the separate volatility gate.",
    gap_cause: "none",
    fix: "Enforced in code; the page counts abstentions and undefined gates separately."
  }
]);

const GAP_LABELS = Object.freeze({
  none: "No gap",
  excluded: "Reviewed; excluded by research",
  event_calendar_missing: "Event calendar / consensus not staged",
  release_consensus_missing: "Release timing staged; consensus and first print not staged",
  calendar_partial: "Calendar staged for one event type only",
  source_missing: "Named source absent",
  stale_input: "Input older than its freshness rule",
  missing_input: "Required input absent",
  gate_undefined: "RG-4 gate undefined",
  not_applicable: "Not applicable"
});

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sha256(text) {
  return require("node:crypto").createHash("sha256").update(text).digest("hex");
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;
}

function businessDaysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const start = new Date(`${String(fromDate).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(toDate).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header, rows) {
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function fmtValue(value, unit = "") {
  return Number.isFinite(value) ? `${value}${unit}` : "absent";
}

/**
 * The stored inputs with their print dates. `input_meta` tuples are `[key, printDate, staleness, freshness]`
 * where a zero freshness means "event print, no daily cadence" - exactly the cases that need a separate
 * release-time check rather than a daily age test.
 */
function inputLedger(session) {
  const values = { ...(session.saved_inputs || {}), ...(session.audit_values || {}) };
  const ledger = new Map();
  for (const entry of session.input_meta || []) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const [key, printDate, staleness, freshness] = entry;
    const value = finite(values[key]);
    const fresh = Number.isFinite(freshness) && freshness > 0
      ? Number.isFinite(staleness) && staleness <= freshness
      : null;
    ledger.set(key, {
      key,
      value,
      print_date: printDate || null,
      staleness: Number.isFinite(staleness) ? staleness : null,
      freshness: Number.isFinite(freshness) ? freshness : null,
      fresh
    });
  }
  return { values, ledger };
}

function signalFor(morning, id) {
  return (morning.signals || []).find((signal) => signal.id === id) || null;
}

function signalNames(morning, ids) {
  return (morning.signals || []).filter((signal) => ids.includes(signal.id));
}

/** One line that says what was checked, over which window, how much it found and how far its scope reaches. */
function calendarNote(read) {
  if (!read || read.status === "source_unavailable") {
    return `calendar unavailable at this cutoff${read?.reason ? ` (${read.reason})` : ""}`;
  }
  const last = read.last_event
    ? `${read.last_event.date} (${read.days_since_last} days before the cutoff)`
    : "none on or before the cutoff";
  const next = read.next_event
    ? `${read.next_event.date} (${read.days_until_next} days after the cutoff)`
    : "none staged after the window";
  const scope = (read.staged_types || []).join(", ") || "nothing";
  return `calendar v1 read ${read.window.from_utc} to ${read.window.to_utc}: ${read.events_in_window} staged release(s) inside the window; last staged release ${last}; next ${next}; scope ${scope} only`;
}

function factorRow({ session, morning, plan, archive, gate, calendar = null }) {
  const { ledger } = inputLedger(session);
  let calendarRead = null;
  const readCalendar = () => {
    if (!calendarRead) {
      calendarRead = eventCalendar.windowAsOf(calendar, {
        cutoffUtc: session.cutoff_at_utc,
        endpointUtc: session.endpoint_at_utc
      });
    }
    return calendarRead;
  };
  const inputEntries = plan.inputs.map((key) => ledger.get(key)).filter(Boolean);
  const present = inputEntries.filter((entry) => Number.isFinite(entry.value));
  const stale = inputEntries.filter((entry) => entry.fresh === false);
  const values = inputEntries
    .map((entry) => `${entry.key}=${fmtValue(entry.value)} [print ${entry.print_date}; ${entry.staleness}d/${entry.freshness}d]`)
    .join(" | ") || "no stored input";
  const asOf = inputEntries.map((entry) => entry.print_date).filter(Boolean).sort().slice(-1)[0] || null;
  const staleness = inputEntries.length
    ? Math.max(...inputEntries.map((entry) => (Number.isFinite(entry.staleness) ? entry.staleness : 0)))
    : null;
  const base = {
    date: session.date,
    eligible: Boolean(morning?.eligible),
    call_state: morning?.direction === "NO_CALL" ? "VALID_ABSTENTION" : morning?.direction || "NOT_REPLAYED",
    conviction: morning?.band ?? null,
    trade: Boolean(morning?.trade),
    factor_id: plan.id,
    factor_name: plan.name,
    role: plan.role,
    relevant_signal: plan.signals.join(" | ") || "—",
    latest_value: values,
    as_of_utc: asOf,
    staleness,
    freshness_rule: plan.freshness,
    source: plan.source,
    calculation: plan.calculation,
    event_dependency: plan.role === "event_missing" || plan.role === "calendar_window" || plan.id === "live.f8-fed-bias" ? "yes" : "no",
    fix: plan.fix,
    gap_cause: plan.gap_cause,
    state: "reviewed",
    accounted: true,
    timing_verified: false,
    availability_evidence: null,
    note: ""
  };

  if (plan.role === "excluded") {
    return { ...base, state: "reviewed_excluded", note: "Excluded by the research; no value is required for this rule." };
  }

  if (plan.role === "event_missing") {
    const read = readCalendar();
    return {
      ...base,
      state: read.status === "source_unavailable" ? "calendar_unavailable" : "timing_staged_no_consensus",
      accounted: false,
      gap_cause: read.status === "source_unavailable" ? "event_calendar_missing" : "release_consensus_missing",
      timing_verified: read.status !== "source_unavailable",
      availability_evidence: calendarNote(read),
      note: "The release clock is staged for FOMC statements, but the consensus and the first print are not, so the surprise cannot be computed. The frozen rule records this as a gap, not a zero vote."
    };
  }

  if (plan.role === "calendar_window") {
    const read = readCalendar();
    if (read.status === "source_unavailable") {
      return {
        ...base,
        latest_value: "no calendar could be read",
        state: "calendar_unavailable",
        accounted: false,
        gap_cause: "event_calendar_missing",
        availability_evidence: `the calendar could not be read (${read.reason || "unknown"})`,
        note: "The calendar was not read at this cutoff. That is a failed check and it caps the call; it is not an empty calendar."
      };
    }
    const windowText = `${read.window.from_utc} to ${read.window.to_utc}`;
    const values = plan.id === "calendar.days-since-and-until-high-impact-events"
      ? `${read.days_since_last === null ? "no staged release before the cutoff" : `${read.days_since_last} days since the last staged release`}; ` +
        `${read.days_until_next === null ? "no staged release after the window" : `${read.days_until_next} days until the next staged release`}; FOMC statements only`
      : read.events.length
        ? read.events.map((event) => `${event.label} released ${event.released_at_utc}`).join(" | ")
        : `0 staged releases between ${windowText}`;
    return {
      ...base,
      latest_value: values,
      as_of_utc: read.last_event?.released_at_utc ?? null,
      staleness: read.days_since_last,
      state: read.status,
      accounted: true,
      gap_cause: "calendar_partial",
      timing_verified: true,
      availability_evidence: calendarNote(read),
      note: read.status === "event_due_in_window"
        ? "A staged FOMC statement was released inside the traded window. The 05:00 call could not know it, so the outcome is event-contaminated rather than wrong."
        : "The calendar was read at this cutoff and no staged FOMC statement falls inside the traded window. Only FOMC timing is staged, so this is not proof that no other release was due."
    };
  }

  if (plan.role === "gate") {
    const status = gate?.status || "undefined";
    const ratio = finite(gate?.value);
    return {
      ...base,
      latest_value: Number.isFinite(ratio) ? `volatility ratio ${ratio}` : "volatility ratio absent",
      as_of_utc: Number.isFinite(ratio) ? session.cutoff_at_utc : null,
      state: status === "open" ? "gate_open" : status === "closed" ? "gate_closed" : "gate_undefined",
      accounted: status !== "undefined",
      gap_cause: status === "undefined" ? "gate_undefined" : "none",
      timing_verified: Number.isFinite(ratio),
      note: status === "undefined"
        ? "RG-4 has no value at the cutoff, so no direction may be issued."
        : `RG-4 is ${status}; the gate itself does not vote.`
    };
  }

  if (plan.role === "inactive") {
    const ratio = finite(gate?.value);
    return {
      ...base,
      latest_value: Number.isFinite(ratio) ? `volatility ratio ${ratio}` : "volatility ratio absent",
      state: Number.isFinite(ratio) ? "reviewed_inactive" : "inactive_source_missing",
      accounted: Number.isFinite(ratio),
      gap_cause: Number.isFinite(ratio) ? "none" : "missing_input",
      timing_verified: Number.isFinite(ratio),
      note: "Defined but not a voter in this frozen rule. It controls the RG-4 gate."
    };
  }

  if (plan.role === "counted_elsewhere") {
    const mapped = signalNames(morning, plan.signals);
    const usable = mapped.filter((signal) => signal.usable);
    return {
      ...base,
      state: usable.length ? "counted_elsewhere" : "counted_elsewhere_no_signal",
      accounted: usable.length > 0,
      gap_cause: usable.length ? "none" : (present.length ? "missing_input" : "source_missing"),
      timing_verified: present.some((entry) => Boolean(entry.print_date)),
      note: usable.length
        ? `Carried by ${usable.map((signal) => signal.id).join(", ")}; it does not cast a second vote.`
        : `The shared signal(s) ${plan.signals.join(", ")} were unavailable at this cutoff.`
    };
  }

  if (plan.id === "live.f8-fed-bias") {
    const label = f8.labelAsOf(archive, { cutoffUtc: session.cutoff_at_utc });
    if (label && label.available) {
      return {
        ...base,
        latest_value: `${label.bias} (direction ${label.direction}, shift ${label.shift})`,
        as_of_utc: label.released_at_utc,
        staleness: label.age_calendar_days,
        freshness_rule: "latest statement at or before the cutoff; valid until superseded",
        source: "Federal Reserve FOMC statement archive",
        state: "latest_release_valid",
        timing_verified: true,
        availability_evidence: `statement clock ${label.released_at_utc} read from the archived statement, ${label.age_calendar_days} calendar days before the cutoff; the unchanged statement still stands`,
        note: `Statement released ${label.released_at_utc}; no newer statement exists before this cutoff, so the unchanged statement still stands.`
      };
    }
    return {
      ...base,
      state: label?.reason === "archive_missing" ? "archive_missing" : "no_release_before_cutoff",
      accounted: false,
      gap_cause: "source_missing",
      timing_verified: true,
      availability_evidence: label?.reason === "archive_missing"
        ? "the FOMC statement archive is not loaded in this checkout"
        : `the archive holds no statement on or before ${session.cutoff_at_utc}; ${calendarNote(readCalendar())}`,
      note: label?.reason === "archive_missing"
        ? "The FOMC statement archive was not loaded, so no release could be read."
        : "No FOMC statement was released before the cutoff; the event family would be unusable."
    };
  }

  if (plan.role === "direction") {
    const signal = signalFor(morning, plan.signals[0]);
    if (signal && signal.usable) {
      return {
        ...base,
        state: "voting_present",
        accounted: true,
        gap_cause: "none",
        timing_verified: present.some((entry) => Boolean(entry.print_date)),
        note: `Votes ${signal.vote > 0 ? "+1" : signal.vote < 0 ? "-1" : "0"}.`
      };
    }
    if (present.length === plan.inputs.length && stale.length === 0) {
      return {
        ...base,
        state: "reviewed_no_vote",
        accounted: true,
        gap_cause: "none",
        timing_verified: true,
        note: "The inputs were present and fresh; the frozen rule abstained rather than voting."
      };
    }
    return {
      ...base,
      state: stale.length ? "stale_input" : "missing_input",
      accounted: false,
      gap_cause: stale.length ? "stale_input" : "missing_input",
      timing_verified: false,
      note: stale.length
        ? `At least one input is older than its freshness rule: ${stale.map((entry) => entry.key).join(", ")}.`
        : `Required input absent: ${plan.inputs.filter((key) => !present.some((entry) => entry.key === key)).join(", ") || "unknown"}.`
    };
  }

  return { ...base, note: "Reviewed; no rule action in this version." };
}

function outcomeLabel(direction, price) {
  if (!price || !price.present) return { status: "unpriced", reason: price ? price.reason : "no DXY session" };
  const moved = Math.abs(price.move_pct) <= price.flat_band_pct ? "FLAT" : price.move_pct > 0 ? "UP" : "DOWN";
  if (moved === "FLAT") return { status: "flat", moved, move_pct: price.move_pct, hit: null };
  const predicted = direction === "BULLISH" ? "UP" : "DOWN";
  return { status: "scored", moved, predicted, hit: predicted === moved, move_pct: price.move_pct };
}

/**
 * Build one call row per eligible morning. No price is read here, which is what keeps the saved call
 * separate from the scored outcome.
 */
function buildCalls({ run, archive, rootDir, evaluateRun, calendar = null }) {
  const evaluate = evaluateRun || require("../../scripts/build_usd_l1_decision_rules_page").evaluateRun;
  const result = evaluate(run, { archive, rootDir });
  const { mornings } = result;
  const staged = calendar || eventCalendar.loadCalendar({ rootDir });
  const resolvedArchive = archive || result.archive || null;
  const sessionsByDate = new Map((run.sessions || []).map((session) => [session.date, session]));
  const calls = [];
  for (const morning of mornings) {
    if (!morning.eligible) continue;
    const directionSign = morning.direction === "BULLISH" ? 1 : morning.direction === "BEARISH" ? -1 : 0;
    const forDirection = morning.signals.filter((signal) => signal.usable && directionSign && signal.vote * directionSign > 0);
    const against = morning.signals.filter((signal) => signal.usable && directionSign && signal.vote * directionSign < 0);
    const neutral = morning.signals.filter((signal) => signal.usable && signal.vote === 0);
    const session = sessionsByDate.get(morning.date) || null;
    calls.push({
      date: morning.date,
      cutoff_at_utc: morning.cutoff_at_utc,
      call_state: morning.direction === "NO_CALL" ? "VALID_ABSTENTION" : "DIRECTIONAL",
      direction: morning.direction,
      conviction: morning.band,
      trade: morning.trade,
      gate_status: morning.gate_status,
      usable_signals: morning.usable_signals,
      usable_families: morning.usable_families,
      net_score: morning.net_score,
      agreement: round(morning.agreement, 4),
      event_calendar: session
        ? eventCalendar.windowAsOf(staged, { cutoffUtc: session.cutoff_at_utc, endpointUtc: session.endpoint_at_utc })
        : null,
      participation: round(morning.participation, 4),
      caps_applied: morning.caps_applied,
      reasons: morning.reasons,
      factor_influence: {
        direction: forDirection.map((signal) => ({ id: signal.id, vote: signal.vote, weight: 1 })),
        against: against.map((signal) => ({ id: signal.id, vote: signal.vote, weight: 1 })),
        neutral: neutral.map((signal) => signal.id),
        conviction: [
          ...morning.caps_applied.map((cap) => `${cap.cap}: ${cap.why || "cap applied"}`),
          morning.usable_families < 6
            ? `${6 - morning.usable_families} family/families unavailable; participation ${round(morning.participation, 3)}`
            : null
        ].filter(Boolean),
        trade: morning.trade
          ? "Band 3 or above, all twelve signals usable, and the event family resolved."
          : `No trade: band ${morning.band}, ${morning.usable_signals}/12 signals, event family ${
              morning.families.find((family) => family.id === "event")?.vote !== null ? "usable" : "unusable"
            }.`,
        inactive: [
          { factor_id: "fx.usd-session-volatility-regime", why: "RG-4 gate, not a voter" },
          { factor_id: "rates.term-premium-and-curve", why: "excluded by research" },
          { factor_id: "rates.credit-spread-delta", why: "excluded by research" }
        ]
      },
      fed_statement: morning.fed_statement,
      readings: morning.readings
    });
  }
  return { mornings, calls, archive: resolvedArchive };
}

/** All 25 factor rows for every replayed morning, used for the access ledger. */
function buildFactorRows({ run, mornings, archive, calendar = null }) {
  const ruleWiring = require("./rule_wiring");
  const staged = calendar || eventCalendar.loadCalendar();
  const rows = [];
  for (const session of run.sessions) {
    const morning = mornings.find((entry) => entry.date === session.date);
    const wiring = ruleWiring.evaluate({
      date: session.date,
      values: { ...(session.saved_inputs || {}), ...(session.audit_values || {}) },
      input_meta: session.input_meta || []
    });
    const gate = (wiring.factors || []).find((entry) => entry.rule === "RG-4") || null;
    for (const plan of FACTOR_PLAN) {
      rows.push(factorRow({ session, morning, plan, archive, gate, calendar: staged }));
    }
  }
  return rows;
}

function buildDaily({ run, archive, rootDir, evaluateRun, calendar = null }) {
  const staged = calendar || eventCalendar.loadCalendar({ rootDir });
  const { mornings, calls, archive: resolvedArchive } = buildCalls({ run, archive, rootDir, evaluateRun, calendar: staged });
  const factorRows = buildFactorRows({ run, mornings, archive: resolvedArchive, calendar: staged });
  return { mornings, calls, factorRows, calendar: staged };
}

/** The audit's event-calendar block: what was checked, how far it reaches and which windows carried a release. */
function calendarSummary({ calendar, sessions = [] }) {
  return eventCalendar.summarise({ calendar, sessions });
}

function wilson(hits, n, z = 1.96) {
  if (!n) return { low_pct: null, high_pct: null };
  const p = hits / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return { low_pct: round(Math.max(0, centre - half) * 100, 1), high_pct: round(Math.min(1, centre + half) * 100, 1) };
}

function bandStats(rows) {
  const bands = {};
  for (const band of [1, 2, 3, 4, 5]) {
    const subset = rows.filter((row) => row.conviction === band);
    const scored = subset.filter((row) => row.score?.status === "scored");
    const hits = scored.filter((row) => row.score.hit).length;
    bands[band] = {
      calls: subset.length,
      scored: scored.length,
      hits,
      misses: scored.length - hits,
      accuracy_pct: scored.length ? round((hits / scored.length) * 100, 1) : null,
      wilson: wilson(hits, scored.length)
    };
  }
  return bands;
}

function scoreCalls({ calls, dxyPrices }) {
  return calls.map((call) => {
    if (call.direction === "NO_CALL") {
      return {
        ...call,
        score: {
          status: "abstained",
          reason: "No call was issued, so there is nothing to score. Treating a no-call as a direction would invent a call the rule did not make."
        }
      };
    }
    return { ...call, score: outcomeLabel(call.direction, dxyPrices[call.date] || null) };
  });
}

/** Price the four markets from their cached H1 tapes with the same 05:00 endpoints as the DXY lane. */
function loadMarketMoves({ sessions, rootDir }) {
  const { MARKETS } = require("./contracts");
  const inputs = require("./inputs");
  const outcomes = require("./outcomes");
  const seriesByMarket = {};
  for (const market of MARKETS) {
    const file = path.join(rootDir, "backtester", "tmp", market.outcome_series);
    seriesByMarket[market.key] = inputs.readHourlySeries(file);
  }
  const moves = outcomes.readSessionMoves({ sessions, seriesByMarket });
  const developmentDates = sessions.filter((session) => session.split === "development").map((session) => session.date);
  const bands = outcomes.freezeFlatBands(moves, developmentDates);
  return { moves, bands, seriesByMarket };
}

function marketOutcomes({ calls, moves, bands }) {
  const { MARKETS } = require("./contracts");
  const markets = {};
  for (const market of MARKETS) {
    const rows = calls
      .filter((call) => call.direction !== "NO_CALL")
      .map((call) => {
        const price = moves[call.date]?.[market.key] || null;
        if (!price || !price.present) {
          return { date: call.date, direction: call.direction, status: "unpriced", reason: price ? price.reason : "no session" };
        }
        const band = bands[market.key]?.flat_band_pct;
        const moved = !Number.isFinite(band) || Math.abs(price.move_pct) <= band ? "FLAT" : price.move_pct > 0 ? "UP" : "DOWN";
        if (moved === "FLAT") return { date: call.date, direction: call.direction, status: "flat", moved, move_pct: price.move_pct };
        const predicted = call.direction === "BULLISH" ? market.usd_bullish_predicts : "UP";
        return {
          date: call.date,
          direction: call.direction,
          status: "scored",
          moved,
          predicted,
          hit: moved === predicted,
          move_pct: price.move_pct
        };
      });
    const scored = rows.filter((row) => row.status === "scored");
    const hits = scored.filter((row) => row.hit).length;
    markets[market.key] = {
      key: market.key,
      label: market.label,
      flat_band_pct: bands[market.key]?.flat_band_pct ?? null,
      calls: rows.length,
      priced: rows.filter((row) => row.status !== "unpriced").length,
      scored: scored.length,
      hits,
      misses: scored.length - hits,
      flat: rows.filter((row) => row.status === "flat").length,
      unpriced: rows.filter((row) => row.status === "unpriced").length,
      agreement_pct: scored.length ? round((hits / scored.length) * 100, 1) : null,
      wilson: wilson(hits, scored.length),
      rows
    };
  }
  return markets;
}

function tradeSubset(rows) {
  const trade = rows.filter((row) => row.trade);
  const scored = trade.filter((row) => row.score?.status === "scored");
  const hits = scored.filter((row) => row.score.hit).length;
  return {
    calls: trade.length,
    scored: scored.length,
    hits,
    misses: scored.length - hits,
    accuracy_pct: scored.length ? round((hits / scored.length) * 100, 1) : null,
    wilson: wilson(hits, scored.length)
  };
}

function dxyEndpointsCsv(sessions, prices) {
  const rows = sessions.map((session) => {
    const price = prices[session.date] || {};
    return [
      session.date,
      session.cutoff_at_utc,
      session.endpoint_at_utc,
      price.open ?? "",
      price.open_bar || "",
      price.close ?? "",
      price.close_bar || "",
      price.present ? price.move_pct : "",
      price.present ? "" : price.reason || "no price",
      "DXY.cash (FTMO spot CFD)",
      "05:00-to-05:00 London"
    ];
  });
  return toCsv(
    ["date", "cutoff_at_utc", "endpoint_at_utc", "open", "open_bar_utc", "close", "close_bar_utc", "move_pct", "missing_reason", "instrument", "window"],
    rows
  );
}

function factorCsv(rows) {
  return toCsv(
    ["date", "eligible", "call_state", "conviction", "trade", "factor_id", "factor_name", "role", "relevant_signal", "state", "accounted", "latest_value", "as_of_utc", "staleness", "freshness_rule", "source", "timing_verified", "calculation", "event_dependency", "gap_cause", "fix", "availability_evidence", "note"],
    rows.map((row) => [
      row.date,
      row.eligible,
      row.call_state,
      row.conviction ?? "",
      row.trade,
      row.factor_id,
      row.factor_name,
      row.role,
      row.relevant_signal,
      row.state,
      row.accounted,
      row.latest_value,
      row.as_of_utc || "",
      row.staleness ?? "",
      row.freshness_rule,
      row.source,
      row.timing_verified,
      row.calculation,
      row.event_dependency,
      row.gap_cause,
      row.fix,
      row.availability_evidence || "",
      row.note
    ])
  );
}

function dailyCallsJson({ calls, scoredCalls, dxyPrices, run, generatedFrom }) {
  return {
    schema_version: "usd-l1-daily-calls-v1",
    research_only: true,
    version: decision.VERSION,
    frozen_on: decision.FROZEN_ON,
    generated_from: generatedFrom,
    declaration: "One row per eligible morning, written before the DXY outcome is joined. A call is never edited after its price is read.",
    counts: {
      eligible: calls.length,
      directional: calls.filter((call) => call.direction !== "NO_CALL").length,
      valid_abstentions: calls.filter((call) => call.direction === "NO_CALL").length,
      trade_qualified: calls.filter((call) => call.trade).length
    },
    calls,
    scoring: {
      rule: "DXY.cash 05:00 London to next calendar day 05:00 London; the open is the close of the bar opening at the cutoff and the close is the close of the bar opening at the endpoint. A move inside the frozen flat band is FLAT and is neither a hit nor a miss.",
      instrument: "DXY.cash (FTMO spot CFD), not ICE cash DXY",
      flat_band_pct: dxyPrices.flat_band_pct,
      results: Object.fromEntries(
        scoredCalls.map((call) => [
          call.date,
          {
            ...call.score,
            open: dxyPrices.prices[call.date]?.open ?? null,
            close: dxyPrices.prices[call.date]?.close ?? null,
            price_reason: dxyPrices.prices[call.date]?.reason || null
          }
        ])
      )
    }
  };
}

/**
 * The 25-factor ledger summary the page prints. A factor is "available at every replay date" only when
 * every stored morning records a value and a print instant; event factors with no staged archive and
 * reviewed exclusions are kept visible and counted separately.
 */
function summariseFactors(factorRows) {
  const byFactor = new Map();
  for (const row of factorRows) {
    if (!byFactor.has(row.factor_id)) {
      byFactor.set(row.factor_id, {
        factor_id: row.factor_id,
        factor_name: row.factor_name,
        role: row.role,
        source: row.source,
        freshness_rule: row.freshness_rule,
        calculation: row.calculation,
        fix: row.fix,
        mornings: 0,
        accounted: 0,
        timing_verified: 0,
        states: {},
        gap_causes: {}
      });
    }
    const entry = byFactor.get(row.factor_id);
    entry.mornings += 1;
    if (row.accounted) entry.accounted += 1;
    if (row.timing_verified) entry.timing_verified += 1;
    entry.states[row.state] = (entry.states[row.state] || 0) + 1;
    entry.gap_causes[row.gap_cause] = (entry.gap_causes[row.gap_cause] || 0) + 1;
  }
  return Array.from(byFactor.values()).map((entry) => ({
    ...entry,
    coverage_pct: entry.mornings ? round((entry.accounted / entry.mornings) * 100, 1) : null,
    timing_pct: entry.mornings ? round((entry.timing_verified / entry.mornings) * 100, 1) : null
  }));
}

/**
 * The access answer in one object: on how many mornings could the 05:00 read touch all 25 researched factors?
 * A row counts as readable only when its value is present at the cutoff; a partial calendar counts as readable
 * because the calendar was read, but it is reported separately so the ceiling is never confused with completeness.
 */
function factorAccess(factorRows = [], calls = []) {
  const factorIds = [...new Set(factorRows.map((row) => row.factor_id))];
  const byDate = new Map();
  for (const row of factorRows) {
    const entry = byDate.get(row.date) || { accounted: 0, missing: [] };
    if (row.accounted) entry.accounted += 1;
    else entry.missing.push(row.factor_id);
    byDate.set(row.date, entry);
  }
  const dates = [...byDate.keys()].sort();
  const counts = dates.map((date) => byDate.get(date).accounted);
  const ceiling = counts.length ? Math.max(...counts) : 0;
  const distribution = {};
  for (const count of counts) distribution[count] = (distribution[count] || 0) + 1;

  const never = new Map();
  for (const row of factorRows) {
    const entry = never.get(row.factor_id) || { factor_id: row.factor_id, accounted: 0, mornings: 0, gap_causes: {} };
    entry.mornings += 1;
    if (row.accounted) entry.accounted += 1;
    else entry.gap_causes[row.gap_cause] = (entry.gap_causes[row.gap_cause] || 0) + 1;
    never.set(row.factor_id, entry);
  }
  const neverAccounted = [...never.values()]
    .filter((entry) => entry.accounted === 0)
    .map((entry) => ({
      factor_id: entry.factor_id,
      mornings: entry.mornings,
      gap_causes: entry.gap_causes
    }));

  const callDates = calls.map((call) => call.date);
  const directionalDates = calls.filter((call) => call.call_state === "DIRECTIONAL").map((call) => call.date);
  const countedDates = (someDates) =>
    someDates.filter((date) => {
      const entry = byDate.get(date);
      return entry && entry.missing.length === 0;
    });
  const nearest = (someDates) => {
    let best = null;
    for (const date of someDates) {
      const entry = byDate.get(date);
      if (!entry) continue;
      if (!best || entry.accounted > best.accounted) best = { date, accounted: entry.accounted, missing: entry.missing };
    }
    return best;
  };
  const bestOverall = nearest(dates);
  const bestDirectional = nearest(directionalDates);
  const gapOnDirectional = {};
  for (const date of directionalDates) {
    const entry = byDate.get(date);
    for (const id of entry?.missing || []) gapOnDirectional[id] = (gapOnDirectional[id] || 0) + 1;
  }

  return {
    factors: factorIds.length,
    mornings: dates.length,
    mornings_with_all_factors: countedDates(dates).length,
    ceiling,
    ceiling_dates: dates.filter((date) => byDate.get(date).accounted === ceiling),
    accounted_distribution: distribution,
    never_accounted: neverAccounted,
    eligible: {
      mornings: callDates.length,
      mornings_with_all_factors: countedDates(callDates).length,
      best: nearest(callDates)
    },
    directional: {
      mornings: directionalDates.length,
      mornings_with_all_factors: countedDates(directionalDates).length,
      best: bestDirectional,
      gaps: gapOnDirectional
    },
    best_morning: bestOverall,
    reading: neverAccounted.length
      ? `No morning could read all ${factorIds.length}: the ceiling is ${ceiling} of ${factorIds.length}, because ${neverAccounted
          .map((entry) => entry.factor_id)
          .join(" and ")} cannot be computed on any morning.`
      : `All ${factorIds.length} factors were readable on ${countedDates(dates).length} of ${dates.length} mornings.`
  };
}

/**
 * Where the scored misses cluster. The headline accuracy is one number; this splits it by the things the
 * frozen rule actually claims should matter - direction, how many signals agreed, how many were readable,
 * whether a staged release fell in the traded window - and by the factor gaps on the morning itself.
 * Clusters are a description of what was measured, not a licence to re-fit: nothing here changes a rule.
 */
const SURPRISE_FACTOR_IDS = ["live.f7-economic-surprise", "macro.release-surprise-at-first-print"];

function missClusters({ scored = [], factorRows = [], minSample = 20 } = {}) {
  const scoredRows = scored.filter((call) => call.score?.status === "scored");
  const gapsByDate = new Map();
  for (const row of factorRows) {
    if (row.accounted) continue;
    const list = gapsByDate.get(row.date) || [];
    list.push(row.factor_id);
    gapsByDate.set(row.date, list);
  }

  const gapSignature = (date) => {
    const gaps = gapsByDate.get(date) || [];
    if (!gaps.length) return "all 25 readable";
    const surprise = gaps.filter((id) => SURPRISE_FACTOR_IDS.includes(id)).length;
    if (!surprise) return "a data gap, no release surprise";
    return surprise === gaps.length ? "release surprise only" : "release surprise and a data gap";
  };
  const agreementBucket = (call) => {
    const agreement = call.agreement ?? 0;
    if (agreement < 0.15) return "agreement under 0.15";
    if (agreement < 0.25) return "agreement 0.15 to 0.25";
    return "agreement 0.25 and over";
  };
  const signalsBucket = (call) => {
    const count = call.usable_signals ?? 0;
    if (count >= 12) return "all twelve signals";
    if (count >= 9) return "nine to eleven signals";
    return "six to eight signals";
  };

  const dimensions = [
    { id: "direction", label: "Direction", key: (call) => call.direction },
    { id: "agreement", label: "Signal agreement", key: agreementBucket },
    { id: "signals", label: "Usable signals", key: signalsBucket },
    {
      id: "event_window",
      label: "Staged release in the traded window",
      key: (call) => call.event_calendar?.status || "not recorded"
    },
    { id: "gap", label: "Factor gaps on the morning", key: (call) => gapSignature(call.date) }
  ];

  const table = dimensions.map((dimension) => {
    const groups = new Map();
    for (const call of scoredRows) {
      const key = dimension.key(call);
      const entry = groups.get(key) || { key, scored: 0, hits: 0 };
      entry.scored += 1;
      if (call.score.hit) entry.hits += 1;
      groups.set(key, entry);
    }
    const rows = [...groups.values()]
      .map((entry) => ({
        ...entry,
        misses: entry.scored - entry.hits,
        accuracy_pct: round((entry.hits / entry.scored) * 100, 1),
        wilson: wilson(entry.hits, entry.scored)
      }))
      .sort((left, right) => left.accuracy_pct - right.accuracy_pct);
    return { id: dimension.id, label: dimension.label, rows };
  });

  const admitted = [];
  for (const dimension of table) {
    for (const row of dimension.rows) {
      if (row.scored >= minSample) admitted.push({ dimension: dimension.id, label: dimension.label, ...row });
    }
  }
  admitted.sort((left, right) => left.accuracy_pct - right.accuracy_pct);
  const weakest = admitted[0] || null;
  const strongest = admitted[admitted.length - 1] || null;

  const hits = scoredRows.length ? scoredRows.filter((call) => call.score.hit).length : 0;
  const accuracy = scoredRows.length ? round((hits / scoredRows.length) * 100, 1) : null;

  return {
    scored: scoredRows.length,
    hits,
    accuracy_pct: accuracy,
    min_sample: minSample,
    dimensions: table,
    weakest,
    strongest,
    reading:
      scoredRows.length && weakest && strongest
        ? `${accuracy}% right over ${scoredRows.length} scored calls. Among splits with at least ${minSample} scored calls, ` +
          `the widest miss cluster is ${weakest.label.toLowerCase()} ${weakest.key} at ${weakest.accuracy_pct}% on ${weakest.scored}, ` +
          `and the strongest is ${strongest.label.toLowerCase()} ${strongest.key} at ${strongest.accuracy_pct}% on ${strongest.scored}.`
        : "No scored call was recorded, so there is no cluster to describe."
  };
}

function loadDxyPrices({ sessions, rootDir }) {
  const dxy = require("./dxy_series");
  const series = dxy.loadSeries(path.join(rootDir, DXY_ENDPOINTS));
  const developmentDates = sessions.filter((session) => session.split === "development").map((session) => session.date);
  const prices = dxy.buildSessionPrices({ sessions, series });
  const band = dxy.freezeFlatBand(prices, developmentDates);
  return { prices, series, flat_band_pct: band.flat_band_pct, flat_band_sample: band.sample, band_rule: band.rule, instrument: dxy.INSTRUMENT };
}

module.exports = {
  DAILY_CALLS,
  FACTOR_CSV,
  DXY_CSV,
  DXY_ENDPOINTS,
  MARKET_FILES,
  FACTOR_PLAN,
  GAP_LABELS,
  buildDaily,
  buildCalls,
  buildFactorRows,
  calendarSummary,
  calendarNote,
  factorAccess,
  missClusters,
  scoreCalls,
  loadDxyPrices,
  loadMarketMoves,
  marketOutcomes,
  tradeSubset,
  bandStats,
  wilson,
  inputLedger,
  businessDaysBetween,
  factorCsv,
  dxyEndpointsCsv,
  dailyCallsJson,
  summariseFactors,
  toCsv,
  csvCell,
  round,
  sha256
};
