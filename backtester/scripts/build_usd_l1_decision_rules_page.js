"use strict";

/**
 * Build the versioned USD Layer 1 decision-rules page.
 *
 * The page is generated from three committed inputs: the frozen rule configuration, the published run
 * artefact, and the two rule modules that already execute the staged factors. It is deterministic: no clock,
 * no network and no random id enters the output. `--check` fails when the committed page has drifted.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const decision = require("../lib/usd_layer1_backtester/decision_rules_v1");
const f8 = require("../lib/usd_layer1_backtester/f8_fed_bias");
const ruleWiring = require("../lib/usd_layer1_backtester/rule_wiring");

const ROOT = path.resolve(__dirname, "..", "..");
const PAGE_NAME = "usd-l1-decision-rules-v1.html";
const SUMMARY_NAME = "decision-rules-v1.json";

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ruleOf(wiring, ruleId) {
  return (wiring.factors || []).find((entry) => entry.rule === ruleId) || null;
}

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

/**
 * The twelve voting signals for one morning, each taken from the code that already computes it. A rule that
 * abstained stays null. Nothing is filled from a neighbouring session.
 */
function signalVotes(session, wiring, fedLabel) {
  const mechanisms = new Map((session.models?.challenger_v1?.mechanisms || []).map((entry) => [entry[0], entry[2]]));
  return {
    us_2y: finite(mechanisms.get("us_2y")),
    real_yield: finite(mechanisms.get("us_10y_real")),
    relative_front_end: finite(ruleOf(wiring, "RG-1")?.vote),
    vix_level: finite(mechanisms.get("vix_regime")),
    vix_change: finite(mechanisms.get("vix_momentum")),
    safe_haven: finite(ruleOf(wiring, "RG-5")?.vote),
    broad_dollar: finite(mechanisms.get("broad_dollar_momentum")),
    session_momentum: mean([
      finite(mechanisms.get("eurusd_mirror")),
      finite(mechanisms.get("usdjpy_mirror"))
    ]),
    overnight_range: finite(ruleOf(wiring, "RG-3")?.vote),
    gold: finite(mechanisms.get("gold")),
    equities: finite(mechanisms.get("equities")),
    fed_bias: fedLabel && fedLabel.available ? finite(fedLabel.direction) : null
  };
}

function readingFor(session, signalId, fedLabel) {
  const inputs = { ...(session.saved_inputs || {}), ...(session.audit_values || {}) };
  const show = (value, unit = "", digits = 2) =>
    Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : "absent";
  switch (signalId) {
    case "vix_level":
      return `VIX ${show(inputs.vix_level, "", 2)}`;
    case "vix_change":
      return `VIX five-session change ${show(inputs.vix_d5_chg, " pts", 2)}`;
    case "safe_haven":
      return `gold ${show(inputs.gold_d1_pct, "%", 3)} · USD/JPY ${show(inputs.usdjpy_d1_pct, "%", 3)}`;
    case "us_2y":
      return `US 2Y ${show(inputs.us_2y_d5_bps, " bps", 0)}`;
    case "real_yield":
      return `US 10Y real ${show(inputs.us_10y_real_d5_bps, " bps", 0)}`;
    case "relative_front_end":
      return `US–DE 2Y ${show(inputs.us_de_2y_spread_d5_bps, " bps", 0)}`;
    case "broad_dollar":
      return `broad dollar ${show(inputs.broad_dollar_d5_pct, "%", 3)}`;
    case "session_momentum":
      return `EUR/USD ${show(inputs.eurusd_d5_pct, "%", 3)} · USD/JPY ${show(inputs.usdjpy_d5_pct, "%", 3)}`;
    case "overnight_range":
      return `range position ${show(inputs.fx_overnight_range_position, "", 3)} · ${show(inputs.fx_overnight_range_pips, " pips", 1)}`;
    case "gold":
      return `gold ${show(inputs.gold_d5_pct, "%", 3)}`;
    case "equities":
      return `NAS100 ${show(inputs.nasdaq100_d5_pct, "%", 3)}`;
    case "fed_bias":
      return fedLabel && fedLabel.available
        ? `${fedLabel.bias} statement ${fedLabel.statement_date} · ${fedLabel.age_calendar_days} days old`
        : "no FOMC release before the cutoff";
    default:
      return "—";
  }
}

function evaluateRun(run, options = {}) {
  const rootDir = options.rootDir || ROOT;
  const archive = options.archive || f8.loadArchive({ rootDir });
  const mornings = [];
  for (const session of Array.isArray(run.sessions) ? run.sessions : []) {
    const snapshot = {
      date: session.date,
      cutoff_at_utc: session.cutoff_at_utc,
      values: { ...(session.saved_inputs || {}), ...(session.audit_values || {}) },
      input_meta: session.input_meta || []
    };
    const wiring = ruleWiring.evaluate(snapshot);
    const fedLabel = f8.labelAsOf(archive, { cutoffUtc: session.cutoff_at_utc });
    const votes = signalVotes(session, wiring, fedLabel);
    const result = decision.evaluateMorning({
      date: session.date,
      votes,
      gateOpen: wiring.gate?.tradeable === true,
      gateStatus: wiring.gate?.status || "undefined",
      calendarStaged: decision.CONFIG.event_context.calendar_staged
    });
    mornings.push({
      ...result,
      cutoff_at_utc: session.cutoff_at_utc,
      gate_status: wiring.gate?.status || "undefined",
      fed_statement: fedLabel && fedLabel.available
        ? {
            date: fedLabel.statement_date,
            released_at_utc: fedLabel.released_at_utc,
            bias: fedLabel.bias,
            direction: fedLabel.direction,
            age_calendar_days: fedLabel.age_calendar_days,
            url: fedLabel.url
          }
        : null,
      readings: Object.fromEntries(
        decision.SIGNALS.map((signal) => [signal.id, readingFor(session, signal.id, fedLabel)])
      )
    });
  }
  return { mornings, archive };
}



function loadAudit(rootDir) {
  const read = (name) => {
    const file = path.join(rootDir, "data", "usd-layer1-backtester", name);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  };
  return { current: read("audit-v1.json"), superseded: read("audit-v1-superseded.json") };
}

/**
 * The scoreboard is deliberately a separate reading from the rule book: it is produced by
 * `build_usd_l1_audit_v1.js` from the same artefact and the committed market tapes, and it is copied here
 * rather than recomputed so that the page and the audit file cannot disagree.
 */
function scoredBlock(audit) {
  if (!audit) return null;
  const market = (key) => {
    const entry = audit.markets[key];
    return entry
      ? {
          label: entry.label,
          calls: entry.calls,
          scored: entry.scored,
          hits: entry.hits,
          flat: entry.flat,
          unpriced: entry.unpriced,
          agreement_pct: entry.agreement_pct,
          wilson: entry.wilson
        }
      : null;
  };
  return {
    run: audit.generated_from.run,
    run_sha256: audit.generated_from.run_sha256,
    run_generated_at: audit.generated_from.run_generated_at,
    run_date_range: audit.generated_from.run_date_range,
    tape_ends: {
      dxy: { end: audit.generated_from.dxy?.end || null, label: audit.dxy.instrument?.label || "DXY.cash" },
      markets: Object.fromEntries(
        Object.entries(audit.generated_from.markets || {}).map(([key, entry]) => [
          key,
          { end: entry.end || null, label: audit.markets?.[key]?.label || key }
        ])
      )
    },
    dxy: {
      instrument: audit.dxy.instrument,
      flat_band_pct: audit.dxy.flat_band_pct,
      scored: audit.dxy.scored,
      hits: audit.dxy.hits,
      accuracy_pct: audit.dxy.accuracy_pct,
      wilson: audit.dxy.wilson,
      bands: audit.dxy.bands,
      trade: audit.dxy.trade,
      states: audit.dxy.states,
      clusters: audit.dxy.clusters || null
    },
    markets: { eurusd: market("EURUSD"), xauusd: market("XAUUSD"), nas100: market("NAS100"), btcusd: market("BTCUSD") },
    joint: audit.joint,
    outcome_check: audit.outcome_check,
    factor_access: audit.factor_access || null,
    event_calendar: audit.event_calendar || null,
    l2l: audit.l2l
  };
}

function buildData(run, runText, options = {}) {
  const rootDir = options.rootDir || ROOT;
  const configText = fs.readFileSync(path.join(rootDir, "config", "usd_l1_decision_rules_v1.json"), "utf8");
  const audits = loadAudit(rootDir);
  const { mornings } = evaluateRun(run, { ...options, rootDir });
  const totals = decision.aggregate(mornings);
  const gateBlocked = mornings.filter((morning) => morning.gate_status !== "open").length;
  const countBlocked = mornings.filter(
    (morning) =>
      morning.gate_status === "open" &&
      (morning.usable_signals < decision.CONFIG.eligibility.min_usable_signals ||
        morning.usable_families < decision.CONFIG.eligibility.min_usable_families)
  ).length;
  const gapRows = Array.isArray(run.factor_review?.rows) ? run.factor_review.rows : [];
  const gapCounts = gapRows.reduce((counts, row) => {
    const key = row.gap || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const workedDate = decision.CONFIG.worked_morning.date;
  const worked = mornings.find((morning) => morning.date === workedDate);
  if (!worked) {
    throw new Error(`worked morning ${workedDate} is not in the run artefact`);
  }
  return {
    version: decision.VERSION,
    status: decision.CONFIG.status,
    research_only: true,
    frozen_on: decision.FROZEN_ON,
    title: decision.CONFIG.title,
    scope: decision.CONFIG.scope,
    owner_decision: decision.CONFIG.owner_decision,
    cutoff: decision.CONFIG.cutoff,
    generated_from: {
      artefact: "data/usd-layer1-backtester/run-v1.json",
      artefact_sha256: sha256(runText),
      artefact_generated_at: run.generated_at || null,
      artefact_date_range: run.run?.date_range || null,
      config: "config/usd_l1_decision_rules_v1.json",
      config_sha256: sha256(configText)
    },
    headline: {
      sessions_replayed: totals.sessions,
      sessions_eligible: totals.eligible,
      directional_calls: totals.directional_calls,
      trade_qualified: totals.trade_qualified
    },
    totals,
    bands: decision.CONFIG.bands,
    eligibility_accounting: {
      sessions: totals.sessions,
      gate_blocked: gateBlocked,
      gate_closed: mornings.filter((morning) => morning.gate_status === "closed").length,
      gate_undefined: mornings.filter((morning) => morning.gate_status === "undefined").length,
      count_blocked: countBlocked,
      directional_calls: totals.directional_calls,
      deadband_no_calls: totals.no_calls,
      eligible: totals.eligible
    },
    direction_counts: {
      bullish: mornings.filter((morning) => morning.direction === "BULLISH").length,
      bearish: mornings.filter((morning) => morning.direction === "BEARISH").length
    },
    gap_table: {
      rows: gapRows.length,
      counts: gapCounts,
      source: "run-v1.json factor_review.rows",
      note: "Every one of the 25 intended factors is registered with its disposition and gap. This page does not re-score them."
    },
    families: decision.FAMILIES.map((family) => ({
      id: family.id,
      label: family.label,
      weight: family.weight,
      signals: family.signals.map((signal) => ({
        id: signal.id,
        label: signal.label,
        factor_id: signal.factor_id,
        source: signal.source,
        vote_rule: signal.vote_rule
      }))
    })),
    non_voting_gate: decision.CONFIG.non_voting_gate,
    eligibility: decision.CONFIG.eligibility,
    trade_rule: decision.CONFIG.trade_rule,
    scored_gate: decision.CONFIG.scored_gate || null,
    event_context: decision.CONFIG.event_context,
    worked_morning: {
      date: worked.date,
      why: decision.CONFIG.worked_morning.reason,
      cutoff_at_utc: worked.cutoff_at_utc,
      gate_status: worked.gate_status,
      direction: worked.direction,
      band: worked.band,
      band_label: worked.band_label,
      trade: worked.trade,
      net_score: worked.net_score,
      agreement: worked.agreement,
      participation: worked.participation,
      usable_signals: worked.usable_signals,
      usable_families: worked.usable_families,
      caps_applied: worked.caps_applied,
      reasons: worked.reasons,
      families: worked.families.map((family) => ({
        id: family.id,
        label: family.label,
        vote: family.vote,
        usable_signals: family.usable_signals,
        signals: family.signals
      })),
      signals: worked.signals.map((signal) => ({
        ...signal,
        reading: worked.readings[signal.id]
      })),
      fed_statement: worked.fed_statement
    },
    scored: {
      current: scoredBlock(audits.current),
      superseded: scoredBlock(audits.superseded)
    },
    limitations: decision.CONFIG.limitations
  };
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function voteClass(vote) {
  if (vote === null || vote === undefined) return "zero";
  if (vote > 0) return "pos";
  if (vote < 0) return "neg";
  return "zero";
}

function fmtVote(vote, digits = 2) {
  if (vote === null || vote === undefined) return "absent";
  return `${vote > 0 ? "+" : ""}${vote.toFixed(digits)}`;
}

function fmtPct(value, digits = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}

const STYLE = `
:root{color-scheme:dark;--bg:#080e16;--panel:#101b29;--panel2:#0c1622;--line:#304358;--text:#e8eef5;--muted:#b2c1d0;--amber:#f2c167;--blue:#8acfff;--green:#8fe0b0;--red:#f2a08a;--warn:#ffd2be}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 "IBM Plex Sans",system-ui,sans-serif}
main{max-width:1240px;margin:auto;padding:28px 24px 60px}h1,h2,h3,p{margin:0 0 12px;overflow-wrap:anywhere}
h1{font-size:clamp(26px,4vw,40px);line-height:1.15}h2{font-size:22px}h3{font-size:16px}a{color:var(--blue)}
header{display:flex;gap:24px;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
header>*{min-width:0}.links{display:flex;gap:16px;flex-wrap:wrap}.links>*{min-width:0;overflow-wrap:anywhere}
.eyebrow{font:12px/1.5 "IBM Plex Mono",monospace;letter-spacing:.12em;color:var(--amber);text-transform:uppercase}
.muted,small{color:var(--muted)}
.notice{border:1px solid #81642f;background:#211e17;padding:18px;margin:18px 0;color:#ffe0a2;overflow-wrap:anywhere}
.notice.critical{border-color:#9b5744;background:#281a18;color:var(--warn)}
.versionbar{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 4px}
.tag{border:1px solid var(--line);background:var(--panel2);padding:5px 9px;font:12px/1.4 "IBM Plex Mono",monospace;color:var(--muted)}
.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 10px}
.metric,.panel{border:1px solid var(--line);background:var(--panel);padding:18px;min-width:0;overflow-wrap:anywhere}
.metric strong{display:block;font:32px/1.3 "IBM Plex Mono",monospace;overflow-wrap:anywhere}
.metric span{color:var(--muted)}.metric-note{color:var(--muted);max-width:90ch}
.panel{margin-top:18px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.columns .panel{margin-top:0}
.table-wrap{overflow-x:auto;max-width:100%}
table{width:100%;min-width:0;border-collapse:collapse;text-align:left;font-size:14px}
th,td{padding:10px 12px;border-bottom:1px solid var(--line);overflow-wrap:anywhere;vertical-align:top}
th{color:var(--muted);font-weight:500}td:first-child{overflow-wrap:anywhere}
table.wide{min-width:540px}table.counts td:last-child,table.counts th:last-child{text-align:right;white-space:nowrap}
.num{font-family:"IBM Plex Mono",monospace}.pos{color:var(--green)}.neg{color:var(--red)}.zero{color:var(--muted)}
.step{display:grid;grid-template-columns:auto 1fr;gap:14px;margin:0 0 16px;align-items:start}
.step b{font:13px/1.5 "IBM Plex Mono",monospace;color:var(--amber);border:1px solid var(--line);background:var(--panel2);padding:4px 8px}
.step p{margin:0}
.formula{border-left:3px solid var(--amber);padding:10px 14px;background:var(--panel2);font-family:"IBM Plex Mono",monospace;font-size:14px;overflow-wrap:anywhere}
.call{border:1px solid var(--line);background:var(--panel2);padding:18px;margin:16px 0}
.call h2{margin-bottom:6px}.call .big{font:clamp(20px,3vw,28px)/1.3 "IBM Plex Mono",monospace;color:var(--green)}
.hash{font:12px/1.7 "IBM Plex Mono",monospace;overflow-wrap:anywhere;color:var(--muted)}
ul.limits{margin:0;padding-left:20px}ul.limits li{margin-bottom:10px;overflow-wrap:anywhere}
footer{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);overflow-wrap:anywhere}
@media(max-width:860px){.columns{grid-template-columns:1fr}}
@media(max-width:720px){main{padding:18px 12px 40px}header{flex-direction:column;gap:10px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metric,.panel{padding:14px}.metric strong{font-size:clamp(18px,5.5vw,28px)}th,td{padding:9px 7px}table{font-size:13px}
table.wide{min-width:0}table.wide thead{position:absolute;left:-9999px}table.wide tr{display:block;border-bottom:1px solid var(--line)}table.wide td{display:block;border:0;padding:4px 0}table.wide td:first-child{color:var(--muted)}}
@media(max-width:380px){.metrics{grid-template-columns:1fr}}
`;


function renderHead(data) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>USD Layer 1 Decision Rules v1 · Frozen research spec</title>
<style>${STYLE}</style>
</head>
<body><main>
<header>
  <div>
    <p class="eyebrow">USD Layer 1 · Frozen specification · Research only</p>
    <h1>USD Layer 1 decision rules, version 1</h1>
    <p class="muted">${esc(data.scope)}</p>
  </div>
  <nav class="links" aria-label="Related pages">
    <a href="index.html#backtesting">Open the Backtesting tab ↗</a>
    <a href="index.html">Dashboard home ↗</a>
    <a href="backtest-flow.html">Backtest flow ↗</a>
    <a href="data/usd-layer1-backtester/run-v1.json">Published artefact ↗</a>
  </nav>
</header>

<div class="versionbar">
  <span class="tag">${esc(data.version)}</span>
  <span class="tag">${esc(data.status)}</span>
  <span class="tag">frozen ${esc(data.frozen_on)}</span>
  <span class="tag">cutoff ${esc(data.cutoff)}</span>
</div>

<div class="notice critical">
  <strong>Read this first.</strong> These rules are a design decision frozen by judgement, not a result. They were
  written before this version's accuracy was evaluated, and no figure on this page is an edge claim. The published
  challenger now runs twelve signals: F8 Fed bias is the twelfth and the replay reads it from the 23-statement
  archive at each cutoff, so every count below depends on it. The event calendar is staged for FOMC statement timing
  only, which is why the band-4 cap stands and band 5 is unreachable. Every count on this page is
  a replay of version 1 over the stored session rows, with the F8 reading reconstructed from the Fed statement archive
  at the cutoff. Eligibility means the frozen signal-count, family-count and RG-4 gate; it does not mean the 05:00
  receipt check passed, which it did not on any morning. The replay runs to
  ${esc(data.generated_from.artefact_date_range?.end || "the last stored session")} on an artefact rebuilt
  ${esc(data.generated_from.artefact_generated_at || "at an unrecorded time")}; it replaces the earlier artefact, and
  <a href="data/usd-layer1-backtester/audit-v1-superseded.json">audit-v1-superseded.json</a> keeps the numbers it
  replaced.
</div>

<p class="eyebrow">Four headline counts · ${data.headline.sessions_replayed}-morning replay</p>
<div class="metrics" aria-label="Headline replay counts">
  <div class="metric" data-headline="sessions-replayed"><span>Mornings replayed</span><strong>${data.headline.sessions_replayed}</strong></div>
  <div class="metric" data-headline="sessions-eligible"><span>Mornings passing the frozen gate</span><strong>${data.headline.sessions_eligible}</strong></div>
  <div class="metric" data-headline="directional-calls"><span>Directional calls issued</span><strong>${data.headline.directional_calls}</strong></div>
  <div class="metric" data-headline="trade-qualified"><span>Provisional trade rule met</span><strong>${data.headline.trade_qualified}</strong></div>
</div>
<p class="metric-note">Eligibility is the binding constraint, not the direction.
${data.eligibility_accounting.gate_blocked} of ${data.eligibility_accounting.sessions} mornings failed the RG-4
volatility gate (${data.eligibility_accounting.gate_closed} closed,
${data.eligibility_accounting.gate_undefined} undefined), a further
${data.eligibility_accounting.count_blocked} open morning had too little of the book,
${data.eligibility_accounting.deadband_no_calls} eligible mornings sat inside the 0.20 deadband, and
${data.eligibility_accounting.directional_calls} produced a direction. Of those,
${data.direction_counts.bullish} were bullish and ${data.direction_counts.bearish} bearish. A no-call is never filled or
converted to a flat vote. These are replayed decisions under version 1, not the stored challenger's published
calls.</p>
`;
}


function renderDecision(data) {
  const signalCount = data.families.reduce((count, family) => count + family.signals.length, 0);
  const bandRows = data.bands
    .map((band) => {
      const counted = data.totals.band_counts.find((entry) => entry.band === band.band);
      return `<tr><td>Band ${band.band} · ${esc(band.label)}</td><td class="num">${band.min_agreement.toFixed(2)}</td><td class="num">${band.min_participation.toFixed(2)}</td><td class="num">${counted ? counted.count : 0}</td><td>${esc(band.meaning)}</td></tr>`;
    })
    .join("");
  return `
<section class="panel" id="decision" aria-labelledby="decision-title">
  <h2 id="decision-title">The decision, in order</h2>
  <p>The research fixes seven groups and one unit of say per family, but it never names the families, which factors
  vote, a combination rule, a band set or a gate. Version 1 chooses ${signalCount} voting signals across six voting
  families, keeps the seventh group as a non-voting quality gate, and applies these steps in order.</p>

  <div class="step"><b>01</b><p><strong>Vote inside each family.</strong> A signal votes +1 for USD strength, −1 for
  USD weakness, or 0. A signal with no value at the cutoff abstains; it is never replaced by zero, a later print or a
  neighbouring session. The family vote is the arithmetic mean of its usable signal votes.</p></div>

  <div class="step"><b>02</b><p><strong>Weight the families equally.</strong> ${data.families.length} families each
  cast one vote regardless of how many signals they contain, so rates cannot outvote commodities by having more
  columns. The quality gate does not vote.</p></div>

  <div class="step"><b>03</b><p><strong>Score agreement and participation.</strong> Both are needed because a book can
  agree strongly while most of it is absent.</p></div>
  <div class="formula">net score = Σ family votes<br>agreement = |net score| ÷ usable families<br>participation = usable voting signals ÷ ${signalCount}</div>

  <div class="step"><b>04</b><p><strong>Apply the gate.</strong> A direction needs at least
  ${data.eligibility.min_usable_signals} usable signals, at least ${data.eligibility.min_usable_families} usable
  families, and an RG-4 volatility gate that is defined and open. The event family must also be usable for the
  provisional trade rule, because a direction read without the event family is incomplete.</p></div>

  <div class="step"><b>05</b><p><strong>Apply the deadband.</strong> A morning inside
  <span class="num">0.20</span> agreement is a recorded no-call, not a coin toss and not a flat position.</p></div>

  <div class="step"><b>06</b><p><strong>Place the band, then cap it.</strong> A missing family caps the result at
  band 3. An unstaged event calendar caps it at band 4. Caps are recorded with the morning rather than silently
  reducing the score.</p></div>

  <div class="step"><b>07</b><p><strong>Answer the trade question.</strong> The provisional trade rule is met only at
  band 3 or above, with the RG-4 gate open, the event family usable, and all twelve signals usable. No
  sizing, entry, stop or execution is defined in this version.</p></div>

  <div class="table-wrap" tabindex="0" role="region" aria-label="Conviction bands and replay counts">
    <table class="wide">
      <thead><tr><th scope="col">Band</th><th scope="col">Min agreement</th><th scope="col">Min participation</th><th scope="col">Mornings</th><th scope="col">Meaning</th></tr></thead>
      <tbody>${bandRows}</tbody>
    </table>
  </div>
  <p class="hash">Band 5 is defined but cannot be reached in version 1 because the event calendar is not staged, and
  every band-4 result therefore carries that cap. The table counts only the ${data.headline.directional_calls}
  directional calls; eligible no-call mornings have no band.</p>
</section>`;
}


function renderFamilies(data) {
  const rows = data.families
    .flatMap((family) =>
      family.signals.map(
        (signal, index) => `<tr><td>${index === 0 ? `<strong>${esc(family.label)}</strong><br><span class="hash">weight ${family.weight}</span>` : ""}</td><td>${esc(signal.label)}<br><span class="hash">${esc(signal.factor_id)}</span></td><td>${esc(signal.source)}</td><td>${esc(signal.vote_rule)}</td></tr>`
      )
    )
    .join("");
  return `
<section class="panel" id="families" aria-labelledby="families-title">
  <h2 id="families-title">Six voting families, twelve signals</h2>
  <p>The research's seventh group is a data-quality gate, not a voter. Each family below carries weight 1, so the
  family vote is its mean signal vote and the book is family-balanced by construction. The table names the frozen
  source and the rule each signal follows; it does not add a factor that is absent from the artefact or drop one that
  the research requires.</p>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Voting families and their signals">
    <table class="wide">
      <thead><tr><th scope="col">Family</th><th scope="col">Signal</th><th scope="col">Frozen source at 05:00</th><th scope="col">Vote rule</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="hash"><strong>Non-voting gate.</strong> ${esc(data.non_voting_gate.rule)}</p>
</section>`;
}

function renderWorked(data) {
  const worked = data.worked_morning;
  const familyLabels = new Map(worked.families.map((family) => [family.id, family.label]));
  const signalRows = worked.signals
    .map(
      (signal) => `<tr data-signal="${esc(signal.id)}"><td>${esc(familyLabels.get(signal.family_id) || signal.family_id)}</td><td>${esc(signal.label)}</td><td class="num">${esc(signal.reading)}</td><td class="num ${voteClass(signal.vote)}">${fmtVote(signal.vote)}</td></tr>`
    )
    .join("");
  const familyRows = worked.families
    .map(
      (family) => `<tr><td>${esc(family.label)}</td><td class="num">${family.usable_signals}/${family.signals}</td><td class="num ${voteClass(family.vote)}">${fmtVote(family.vote)}</td></tr>`
    )
    .join("");
  const band = data.bands.find((entry) => entry.band === worked.band) || null;
  const nextBand = data.bands.find((entry) => entry.band === worked.band + 1) || null;
  const fed = worked.fed_statement;
  const fedText = fed
    ? `The event family is usable because RG-2 has a release before the cutoff: the ${esc(fed.date)} statement was
       released at ${esc(fed.released_at_utc)}, ${fed.age_calendar_days} calendar days earlier, and the archived label
       is <strong>${esc(fed.bias)}</strong> (vote ${fmtVote(fed.direction)}). A statement released after 05:00 London
       would have made the family unusable and blocked the trade rule.`
    : "No FOMC statement was released before the cutoff, so the event family would be unusable.";
  const tradeText = worked.trade
    ? "The provisional trade rule is met."
    : `The provisional trade rule is not met: band ${worked.band} is below the band-3 floor.`;
  return `
<section class="panel" id="worked-morning" aria-labelledby="worked-title">
  <p class="eyebrow">One worked morning</p>
  <h2 id="worked-title">2024-02-06 · 05:00 London</h2>
  <div class="call" data-worked-morning="${esc(worked.date)}" data-worked-direction="${esc(worked.direction)}" data-worked-band="${esc(worked.band)}" data-worked-trade="${worked.trade}">
    <p class="eyebrow">Result</p>
    <p class="big">${esc(worked.direction)} · Band ${worked.band} ${esc(worked.band_label)} · ${worked.trade ? "trade" : "no trade"}</p>
    <p>All ${worked.usable_signals} voting signals and all ${worked.usable_families} families resolve. The net score is
    <span class="num">${fmtVote(worked.net_score)}</span> across ${worked.usable_families} families, which is
    <span class="num">${fmtPct(worked.agreement)}</span> agreement at
    <span class="num">${fmtPct(worked.participation)}</span> participation. The RG-4 gate is
    <strong>${esc(worked.gate_status)}</strong>. ${tradeText}</p>
    <p class="hash">${band ? `Band ${band.band} needs agreement ≥ ${band.min_agreement.toFixed(2)} and participation ≥ ${band.min_participation.toFixed(2)}. ` : ""}${nextBand ? `Band ${nextBand.band} needs agreement ≥ ${nextBand.min_agreement.toFixed(2)}, which ${fmtPct(worked.agreement)} does not reach.` : ""}</p>
  </div>

  <div class="columns">
    <div class="panel">
      <h3>Family votes</h3>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Family votes for the worked morning">
        <table><thead><tr><th scope="col">Family</th><th scope="col">Signals</th><th scope="col">Vote</th></tr></thead><tbody>${familyRows}</tbody></table>
      </div>
      <p class="hash">Equal weight: each family contributes one vote. The net score is the sum, not an average across
      all twelve signals.</p>
    </div>
    <div class="panel">
      <h3>Eligibility and band</h3>
      <p>${worked.usable_signals}/12 usable signals · ${worked.usable_families}/6 usable families · RG-4
      ${esc(worked.gate_status)}.</p>
      <p>${worked.caps_applied.length ? `Caps applied: ${worked.caps_applied.map((cap) => esc(cap.cap)).join(", ")}.` : "No cap applied, because every family resolves and the result is below band 5."}</p>
      <p>${worked.reasons.length ? esc(worked.reasons.join(" ")) : "No eligibility or deadband reason was recorded."}</p>
      <p class="hash">${fedText}</p>
    </div>
  </div>

  <h3>The twelve readings</h3>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Signal readings for the worked morning">
    <table class="wide">
      <thead><tr><th scope="col">Family</th><th scope="col">Signal</th><th scope="col">Reading at the cutoff</th><th scope="col">Vote</th></tr></thead>
      <tbody>${signalRows}</tbody>
    </table>
  </div>
  <p class="hash">Readings come from the stored session rows; F8 is read from the Fed statement archive as stated above. This is not a re-download. A negative vote means the signal reads
  USD-weak, not that the underlying asset fell.</p>
</section>`;
}

function renderAccounting(data) {
  const account = data.eligibility_accounting;
  const rows = [
    ["Mornings in the replay", account.sessions, "Every session in the published artefact."],
    ["RG-4 gate closed", account.gate_closed, "The volatility gate is defined and closed; no direction."],
    ["RG-4 gate undefined", account.gate_undefined, "The gate has no value at the cutoff; no direction and no fill."],
    ["Open gate but too little of the book", account.count_blocked, "Fewer than six usable signals or fewer than four usable families."],
    ["Eligible mornings", account.eligible, "Gate open, six or more signals, four or more families."],
    ["No-call inside the deadband", account.deadband_no_calls, "Eligible, but agreement below 0.20 or a net score of exactly zero."],
    ["Directional calls", account.directional_calls, "Bullish or bearish, with a band."],
    ["Provisional trade rule met", data.headline.trade_qualified, "Band 3 or above, all twelve signals usable, and the event family usable."]
  ]
    .map(([label, count, note]) => `<tr><td>${esc(label)}</td><td class="num">${count}</td><td>${esc(note)}</td></tr>`)
    .join("");
  return `
<section class="panel" id="accounting" aria-labelledby="accounting-title">
  <h2 id="accounting-title">Where 725 mornings went</h2>
  <p>The gate does most of the work. This is not a filtering choice made after the fact: it is the frozen eligibility
  rule, applied to every morning in order, and a blocked morning is counted even when it never becomes a call.</p>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Eligibility accounting">
    <table class="wide"><thead><tr><th scope="col">Outcome</th><th scope="col">Mornings</th><th scope="col">What it means</th></tr></thead><tbody>${rows}</tbody></table>
  </div>
  <p class="hash">The four category rows — gate closed, gate undefined, too little of the book, eligible — sum to
  ${account.sessions}. The last three rows subdivide the eligible mornings and are not additional mornings. A morning
  is counted at the first failing step in this order: RG-4, signal and family minimums, deadband, call.</p>
</section>`;
}

function renderAccess(data) {
  const scored = data.scored?.current;
  const access = scored?.factor_access;
  if (!access) {
    return `
<section class="panel" id="access" aria-labelledby="access-title">
  <h2 id="access-title">Could the 05:00 read see all 25 factors?</h2>
  <p>The audit file carries no access ledger, so this page cannot answer the question. Run
  <span class="num">node backtester/scripts/build_usd_l1_audit_v1.js --write</span> and rebuild.</p>
</section>`;
  }
  const calendar = scored?.event_calendar;
  const dxy = scored.dxy;
  const best = access.best_morning;
  const never = (access.never_accounted || [])
    .map((entry) => `${entry.factor_id} (${Object.keys(entry.gap_causes).join(", ")} on all ${entry.mornings} mornings)`)
    .join("; ");
  const distributionRows = Object.entries(access.accounted_distribution || {})
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .map(
      ([count, mornings]) =>
        `<tr><td class="num">${esc(count)} of ${access.factors}</td><td class="num">${mornings}</td><td>${esc(
          Number(count) === access.ceiling ? "the ceiling reached in this replay" : ""
        )}</td></tr>`
    )
    .join("");
  const gapRows = Object.entries(access.directional?.gaps || {})
    .sort((left, right) => right[1] - left[1])
    .map(([factor, count]) => `<tr><td>${esc(factor)}</td><td class="num">${count}</td></tr>`)
    .join("");
  const calendarLine = calendar
    ? `The release clock was read on ${calendar.mornings_checked} mornings and found a staged FOMC statement inside the traded window on ${calendar.mornings_with_event_in_window}. Its scope is ${(calendar.scope?.staged_types || []).join(", ") || "nothing"}; ${(calendar.scope?.not_staged || []).length} other release types are not staged, so a morning with no staged release has been checked against FOMC statements only.`
    : "";
  return `
<section class="panel" id="access" aria-labelledby="access-title">
  <h2 id="access-title">Could the 05:00 read see all 25 factors?</h2>
  <p>Every replayed morning runs the same access ledger: each of the ${access.factors} researched factors is looked up at
  that morning's cutoff, and it counts as readable only when its value is present at the cutoff. Nothing is filled from a
  neighbouring session, and a factor the frozen rule does not vote with still gets a row. This section answers the first
  half of the question - what was visible - before any count of what the calls got right.</p>

  <div class="metrics" aria-label="Access headline counts">
    <div class="metric" data-access="viable-mornings"><span>Viable mornings</span><strong>${data.headline.sessions_eligible}</strong></div>
    <div class="metric" data-access="all-factor-mornings"><span>Mornings with all ${access.factors} readable</span><strong>${access.mornings_with_all_factors}</strong></div>
    <div class="metric" data-access="ceiling"><span>Best any morning reached</span><strong>${access.ceiling} of ${access.factors}</strong></div>
    <div class="metric" data-access="directional"><span>Directional calls</span><strong>${data.headline.directional_calls}</strong></div>
    <div class="metric" data-access="scored-dxy"><span>DXY calls scored</span><strong>${dxy.scored}</strong></div>
    <div class="metric" data-access="dxy-hits"><span>DXY calls right</span><strong>${dxy.hits}</strong></div>
  </div>
  <p class="metric-note">${esc(access.reading)} On the ${access.directional.mornings} directional calls the best morning
  reached ${access.directional.best?.accounted ?? 0} of ${access.factors}
  ${access.directional.best ? `(${esc(access.directional.best.date)})` : ""}. The answer to "all 25 on every viable morning"
  is therefore no, and the reason is structural: ${esc(never)}. It is not a sparse-data accident on a few dates.</p>

  <div class="columns">
    <div class="panel">
      <h3>How much of the 25 each morning could read</h3>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Factor access distribution">
        <table class="wide"><thead><tr><th scope="col">Factors readable</th><th scope="col">Mornings</th><th scope="col">Note</th></tr></thead><tbody>${distributionRows}</tbody></table>
      </div>
      <p class="hash">A morning below the ceiling is missing a stored print at its cutoff, most often the US 2Y and real
      yield legs that share one tape. A gap is counted as absent, never as neutral, which is why the frozen rule allows a
      call from six usable signals rather than twelve.</p>
    </div>
    <div class="panel">
      <h3>What was missing on the directional calls</h3>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Missing factors on directional calls">
        <table class="wide"><thead><tr><th scope="col">Factor</th><th scope="col">Calls missing it</th></tr></thead><tbody>${gapRows}</tbody></table>
      </div>
      <p class="hash">Counted per call, so the rows do not sum to the call count: one call can miss several factors. The
      two always-missing rows are the release surprise, which needs a consensus and a first print that are not staged.</p>
    </div>
  </div>

  <h3>The release clock, read at every cutoff</h3>
  <p>${esc(calendarLine)} The two calendar factors count as readable on every morning, which is exactly why the ceiling is
  ${access.ceiling} rather than ${access.ceiling + 1}: a calendar that was read is not a calendar that is complete.</p>
  <p>One fully traceable morning:
  <a href="#worked-morning">${esc(best?.date || data.worked_morning.date)} at 05:00 London</a> reached
  ${best?.accounted ?? 0} of ${access.factors}
  ${best && best.missing.length ? `, with ${esc(best.missing.join(" and "))} still unreadable` : ""}. Its twelve votes, the
  band arithmetic and the trade-rule test are printed line by line above, so the access count and the call on the same
  morning can be checked against each other.</p>
  <p class="hash">Access ledger: <a href="data/usd-layer1-backtester/audit-v1.json">audit-v1.json</a>, blocks
  <span class="num">factor_access</span> and <span class="num">event_calendar</span>, each written from one row per factor per
  morning. The per-row ledger is not committed because it runs to 18,125 rows; reproduce it with
  <span class="num">node backtester/scripts/build_usd_l1_audit_v1.js --write</span>.</p>
</section>`;
}

function renderScored(data) {
  const scored = data.scored?.current;
  if (!scored) {
    return `
<section class="panel" id="scored" aria-labelledby="scored-title">
  <h2 id="scored-title">The same calls, scored after the fact</h2>
  <p>No audit file was found at <span class="num">data/usd-layer1-backtester/audit-v1.json</span>. Run
  <span class="num">node backtester/scripts/build_usd_l1_audit_v1.js --write</span> and rebuild this page.</p>
</section>`;
  }
  const dxy = scored.dxy;
  const old = data.scored?.superseded;
  const marketRows = Object.values(scored.markets)
    .filter(Boolean)
    .map(
      (market) =>
        `<tr data-market="${esc(market.label)}"><td>${esc(market.label)}</td><td class="num">${market.calls}</td><td class="num">${market.scored}</td><td class="num">${market.hits}</td><td class="num">${fmtNumPct(market.agreement_pct)}</td><td class="num">${market.flat}</td><td class="num">${market.unpriced}</td><td>${esc(fmtWilson(market.wilson))}</td></tr>`
    )
    .join("");
  const bandRows = Object.entries(dxy.bands || {})
    .map(
      ([band, entry]) =>
        `<tr><td>Band ${esc(band)}</td><td class="num">${entry.calls}</td><td class="num">${entry.scored}</td><td class="num">${entry.hits}</td><td class="num">${fmtNumPct(entry.accuracy_pct)}</td><td>${esc(fmtWilson(entry.wilson))}</td></tr>`
    )
    .join("");
  const clusters = dxy.clusters || null;
  const gate = data.scored_gate || null;
  const belowBar = gate && Number.isFinite(dxy.accuracy_pct) ? dxy.accuracy_pct <= gate.dxy_accuracy_bar_pct : null;
  const clusterRows = clusters
    ? clusters.dimensions
        .map((dimension) =>
          dimension.rows
            .map(
              (row) =>
                `<tr data-cluster="${esc(dimension.id)}"><td>${esc(dimension.label)}</td><td>${esc(row.key)}</td><td class="num">${row.scored}</td><td class="num">${row.hits}</td><td class="num">${fmtNumPct(row.accuracy_pct)}</td><td>${esc(fmtWilson(row.wilson))}</td></tr>`
            )
            .join("")
        )
        .join("")
    : "";
  const freezeCopy = !gate
    ? `<p class="hash">No freeze rule is recorded in the config, so this page cannot say whether the scored bar has been met.</p>`
    : belowBar === null
      ? `<p class="hash">Freeze rule: ${esc(gate.rule)} No call was scored, so the bar has not been tested.</p>`
      : `<p class="hash" data-freeze="${belowBar ? "frozen" : "not_frozen"}">Freeze rule: ${esc(
          gate.rule
        )} Measured at ${fmtNumPct(dxy.accuracy_pct)} against a ${gate.dxy_accuracy_bar_pct}% bar, so the state is ${esc(
          belowBar ? gate.state : "BAR_CLEARED"
        )} as of ${esc(gate.frozen_on)}: nothing is re-fitted against these mornings, and the splits above name what a forward test would carry.</p>`;
  const clusterBlock = clusters
    ? `<h3>Where the misses cluster</h3>
  <p>${esc(clusters.reading)} Splits with fewer than ${clusters.min_sample} scored calls are printed but never used to
  pick the widest cluster, because a handful of sessions can produce any percentage.</p>
  <div class="table-wrap" tabindex="0" role="region" aria-label="DXY accuracy by split">
    <table class="wide"><thead><tr><th scope="col">Split</th><th scope="col">Group</th><th scope="col">Scored</th><th scope="col">Right</th><th scope="col">Accuracy</th><th scope="col">Interval</th></tr></thead><tbody>${clusterRows}</tbody></table>
  </div>
  <p class="hash">The two release-surprise factors are unreadable on every morning, so they cannot separate a hit from a
  miss; they appear in the factor-gap rows as a constant rather than as an explanation.</p>
  ${freezeCopy}`
    : `<h3>Where the misses cluster</h3>
  <p>The audit file carries no miss-cluster block, so this page cannot say where the misses sit. ${freezeCopy}</p>`;

  const superseded = old
    ? `<p class="hash">The earlier artefact, kept as
       <a href="data/usd-layer1-backtester/audit-v1-superseded.json">audit-v1-superseded.json</a>, produced
       ${old.dxy.scored} scored DXY calls with ${old.dxy.hits} hits against ${dxy.scored} and ${dxy.hits} now, and
       ${old.joint.directional_calls} directional calls instead of ${scored.joint.directional_calls}. It also records
       the tapes it read: ${joinSentence(describeTapeEnds(old))}, against
       ${joinSentence(describeTapeEnds(scored))} today, so every session past the old boundary was stored as absent.
       Today's tapes therefore disagree with those stored outcomes on ${old.outcome_check.mismatched} of
       ${old.outcome_check.checked} session-market rows over ${old.outcome_check.mismatch_dates} sessions; the current
       artefact disagrees on ${scored.outcome_check.mismatched}. That difference, not the build date, is why the old
       numbers are withdrawn.</p>`
    : `<p class="hash">No superseded audit file is present, so this page cannot show what the earlier artefact scored.</p>`;

  return `
<section class="panel" id="scored" aria-labelledby="scored-title">
  <h2 id="scored-title">The same calls, scored after the fact</h2>
  <p>Nothing above is an accuracy claim. This section is the one place where the calls are put against prices, and it
  is generated separately by <span class="num">backtester/scripts/build_usd_l1_audit_v1.js</span> from the published
  artefact and the committed market tapes, then copied here unchanged. The rule book was written before these outcomes
  were read, but the same sessions were in view when it was written, so every figure below is in-sample.</p>

  <div class="metrics" aria-label="Scored outcome counts">
    <div class="metric" data-scored="dxy"><span>DXY calls scored</span><strong>${dxy.scored}</strong></div>
    <div class="metric" data-scored="dxy-hits"><span>DXY direction right</span><strong>${dxy.hits}</strong></div>
    <div class="metric" data-scored="trade-hits"><span>Trade-rule calls right</span><strong>${dxy.trade.hits}</strong></div>
    <div class="metric" data-scored="all-four"><span>All four markets right</span><strong>${scored.joint.all_four_hit}</strong></div>
  </div>
  <p class="metric-note">The DXY score puts the v1 direction against
  <span class="num">${esc(dxy.instrument?.label || "DXY.cash")}</span> from 05:00 London to the next 05:00, counting a
  move inside ${((dxy.flat_band_pct ?? 0)).toFixed(3)}% as flat. ${dxy.hits} of ${dxy.scored} are right,
  ${fmtNumPct(dxy.accuracy_pct)}, ${fmtWilson(dxy.wilson)}. The ${dxy.trade.calls} mornings that met the provisional
  trade rule score ${dxy.trade.hits} of ${dxy.trade.scored} where the index has a print,
  ${fmtNumPct(dxy.trade.accuracy_pct)}, ${fmtWilson(dxy.trade.wilson)}. Of ${scored.joint.directional_calls}
  directional calls, ${scored.joint.any_four_hit} were right on at least one of the four markets and
  ${scored.joint.all_four_flat_or_unpriced} had no priced market at all.</p>

  <div class="columns">
    <div class="panel">
      <h3>By conviction band</h3>
      <div class="table-wrap" tabindex="0" role="region" aria-label="DXY accuracy by band">
        <table class="wide"><thead><tr><th scope="col">Band</th><th scope="col">Calls</th><th scope="col">Scored</th><th scope="col">Right</th><th scope="col">Accuracy</th><th scope="col">Interval</th></tr></thead><tbody>${bandRows}</tbody></table>
      </div>
      <p class="hash">A higher band was meant to mean more conviction. Band 5 never occurred, because the full-book cap
      needs a staged event calendar, so the top row is an empty promise rather than evidence.</p>
    </div>
    <div class="panel">
      <h3>Four markets, same call</h3>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Four-market agreement">
        <table class="wide"><thead><tr><th scope="col">Market</th><th scope="col">Calls</th><th scope="col">Scored</th><th scope="col">Right</th><th scope="col">Agreement</th><th scope="col">Flat</th><th scope="col">Unpriced</th><th scope="col">Interval</th></tr></thead><tbody>${marketRows}</tbody></table>
      </div>
      <p class="hash">A bearish dollar call is scored as EUR/USD down, gold down, the Nasdaq future down and bitcoin
      down, each with its own flat band. A market with no closing bar on the tape is counted as unpriced, never as a
      miss.</p>
    </div>
  </div>

  ${clusterBlock}

  <h3>Line to line, where the ladder may price</h3>
  <p>${l2lSentence(scored.l2l)}</p>
  ${superseded}
  <p class="hash">Audit file: <a href="data/usd-layer1-backtester/audit-v1.json">audit-v1.json</a> · run
  ${esc(scored.run)} · sha256 ${esc(scored.run_sha256)} · built ${esc(scored.run_generated_at || "unrecorded")} over
  ${esc(`${scored.run_date_range?.start} to ${scored.run_date_range?.end}`)} · tapes
  ${esc(joinSentence(describeTapeEnds(scored)))} · DXY tape to
  ${esc((scored.tape_ends.dxy.end || "unrecorded").slice(0, 10))}. Reproduce:
  <span class="num">node backtester/scripts/build_usd_l1_audit_v1.js --write</span>, then this page.</p>
</section>`;
}

function fmtNumPct(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
}

/** "a, b and c" — the house style for a list read aloud. */
function joinSentence(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "no tape recorded";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/** Group tape end dates by day, so the superseded note can say which markets stopped where. */
function describeTapeEnds(block) {
  const groups = new Map();
  for (const entry of Object.values(block?.tape_ends?.markets || {})) {
    if (!entry?.end) continue;
    const day = entry.end.slice(0, 10);
    groups.set(day, [...(groups.get(day) || []), entry.label]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, labels]) => `${joinSentence(labels)} to ${day}`);
}

function fmtWilson(wilson) {
  if (!wilson || !Number.isFinite(wilson.low_pct) || !Number.isFinite(wilson.high_pct)) return "not enough scored calls";
  return `95% interval ${wilson.low_pct.toFixed(1)}–${wilson.high_pct.toFixed(1)}%`;
}

function l2lSentence(l2l) {
  if (!l2l) return "No ladder replay was recorded with this audit.";
  if (l2l.status === "replayed") {
    const windows = (l2l.ladder?.eligible_sessions || []).length;
    const callList = (l2l.calls || []).map((call) => `${call.date} ${call.direction} band ${call.band}`);
    const barCount = (value) => `${value ?? 0} ${(value ?? 0) === 1 ? "bar" : "bars"}`;
    const matched = (l2l.symbols || []).reduce((sum, symbol) => sum + (symbol.bars_check?.matched || 0), 0);
    const mismatched = (l2l.symbols || []).reduce((sum, symbol) => sum + (symbol.bars_check?.mismatched_instants || 0), 0);
    const totals = l2l.totals || {};
    const full = totals.full_5r || {};
    const half = totals.half_3r || {};
    const contract = contractClause(l2l.contract, full, half);
    return `The ladder's own stamp is ${l2l.ladder?.stamp_utc || "unrecorded"}, which leaves ${windows} sessions
    that may be priced. ${
      callList.length
        ? `The only v1 ${callList.length === 1 ? "call" : "calls"} in that window ${callList.length === 1 ? "is" : "are"} ${callList.join(", ")}.`
        : "No v1 call falls in that window."
    }
    Replayed on EUR/USD, gold, the Nasdaq future and
    bitcoin, ${matched} bar instants reproduce from the sealed ticks with ${mismatched} mismatched; the full 5R
    geometry filled ${full.fills ?? 0} orders for ${full.targets ?? 0} targets and ${full.stops ?? 0} stops, with
    ${full.unfilled ?? 0} never filled, ${full.working ?? 0} still open and ${barCount(full.ambiguous)} that touched
    both levels, and the half-off 3R geometry filled ${half.fills ?? 0} for ${half.targets ?? 0} targets and
    ${half.stops ?? 0} stops, with ${half.unfilled ?? 0} never filled, ${half.working ?? 0} still open and
    ${half.ambiguous ?? 0} touched both.${contract}`;
  }
  if (l2l.status === "no_call_in_window") {
    return `No v1 call falls inside the ${(l2l.ladder?.eligible_sessions || []).length} sessions the ladder may
    price, so the ladder scoreboard is empty rather than zero.`;
  }
  return `The ladder scoreboard is not available here (${esc(l2l.status)}${l2l.reason ? `: ${esc(l2l.reason)}` : ""}).`;
}

/**
 * Say what the fills are and what the run's own verdict on Tests 3 and 4 still is.
 *
 * A fill count without its order count can be misread as a session count, and a replay without the blocked
 * verdict beside it can be misread as the test having been scored. Both readings are refused here in the same
 * sentence the numbers are printed in.
 */
function contractClause(contract, full, half) {
  if (!contract || !contract.tests) return "";
  const status = (test) => (test && test.status ? esc(test.status) : "unrecorded");
  const orders = (totals) => (totals.fills || 0) + (totals.unfilled || 0) + (totals.working || 0);
  const markets = (totals) => totals.sessions || 0;
  const ambiguous = full.ambiguous || 0;
  return ` Those are order counts, not session counts: the full 5R geometry put
  ${orders(full)} orders out across ${markets(full)} markets (${full.fills || 0} filled, ${full.unfilled || 0}
  never filled, ${full.working || 0} still working, and ${ambiguous} of those orders flagged ambiguous because
  the bar touched both levels), and the half 3R geometry put ${orders(half)} orders out across ${markets(half)}
  markets. This does not lift Tests 3 and 4: the run artefact still records the full 5R test ${status(contract.tests.full_5r)}
  and the half 3R test ${status(contract.tests.half_3r)}, because ${esc(contract.rule)}; ${esc(contract.replay_under)}.`;
}

function renderEvidence(data) {
  const gaps = data.gap_table.counts || {};
  return `
<section class="panel" id="evidence" aria-labelledby="evidence-title">
  <h2 id="evidence-title">What the page is built on</h2>
  <div class="columns">
    <div class="panel">
      <h3>Version and inputs</h3>
      <p>Rule version <span class="num">${esc(data.version)}</span>, frozen ${esc(data.frozen_on)} and marked
      ${esc(data.status)}. The page builder reads the config, the published artefact and the existing rule modules; it
      does not re-download a price or re-score an outcome.</p>
      <p class="hash">config ${esc(data.generated_from.config)}<br>sha256 ${esc(data.generated_from.config_sha256)}</p>
      <p class="hash">artefact ${esc(data.generated_from.artefact)}<br>sha256 ${esc(data.generated_from.artefact_sha256)}</p>
    </div>
    <div class="panel">
      <h3>25-row gap table</h3>
      <p>The artefact registers all ${data.gap_table.rows} intended factors with a disposition and a gap. The counts
      below are copied from that table, not recomputed here.</p>
      <p><span class="num">${gaps.code || 0}</span> need code · <span class="num">${gaps.data || 0}</span> need
      historical data · <span class="num">${gaps.exclusion || 0}</span> are exclusions the research supports.</p>
      <p class="hash">Source: ${esc(data.gap_table.source)}</p>
    </div>
  </div>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Reproduction commands">
    <table><thead><tr><th scope="col">Check</th><th scope="col">Command</th></tr></thead><tbody>
      <tr><td>Page and summary are current</td><td class="num">node backtester/scripts/build_usd_l1_decision_rules_page.js --check</td></tr>
      <tr><td>Scored outcomes are current</td><td class="num">node backtester/scripts/build_usd_l1_audit_v1.js --check</td></tr>
      <tr><td>Rule semantics and replay counts</td><td class="num">node --test backtester/tests/usd_layer1_decision_rules_v1.test.js</td></tr>
      <tr><td>Diagram nodes, evidence and mobile layout</td><td class="num">node --test tests/usd_layer1_diagram.browser.test.js</td></tr>
    </tbody></table>
  </div>
  <p class="hash">The Validity tab's decision diagram draws the same chain as 18 nodes and opens each family's
  registered factors from the 25-row table. Its browser test asserts the node count, the family evidence panel and a
  400px viewport, so the published page and the diagram cannot drift apart silently.</p>
</section>`;
}

function renderLimits(data) {
  const items = data.limitations.map((item) => `<li>${esc(item)}</li>`).join("");
  return `
<section class="panel" id="limitations" aria-labelledby="limits-title">
  <h2 id="limits-title">What this page does not claim</h2>
  <ul class="limits">${items}</ul>
  <p>The worked morning is an arithmetic demonstration, not a result; it was not selected for its outcome. The
  scored section reports hit counts and their intervals, and nothing else: no return, Sharpe, drawdown or comparison
  with the deployed model, no out-of-sample split, and no claim that a hit count above one half is an edge. The
  conviction bands are in-sample and band 5 never occurred. F8 is the one signal read outside the session row: it is
  reconstructed from the Fed statement archive by release time, not from a stored receipt.</p>
</section>`;
}



function renderPage(data) {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");
  return `${renderHead(data)}${renderDecision(data)}${renderFamilies(data)}${renderWorked(data)}${renderAccounting(data)}${renderAccess(data)}${renderScored(data)}${renderEvidence(data)}${renderLimits(data)}
<footer>
  <p>Research only. USD Layer 1 decision rules ${esc(data.version)}, frozen ${esc(data.frozen_on)}. This page is
  generated from committed inputs and is not a live signal, a deployment or a claim of trading edge.</p>
  <p class="hash">Machine-readable rules: <a href="config/usd_l1_decision_rules_v1.json">config/usd_l1_decision_rules_v1.json</a> ·
  Summary: <a href="data/usd-layer1-backtester/decision-rules-v1.json">data/usd-layer1-backtester/decision-rules-v1.json</a><br>
  Regenerate: <span class="num">node backtester/scripts/build_usd_l1_decision_rules_page.js --write</span> · Verify:
  <span class="num">node backtester/scripts/build_usd_l1_decision_rules_page.js --check</span></p>
</footer>
<script type="application/json" id="usd-l1-decision-rules-data">${payload}</script>
</main></body></html>
`;
}

function loadInputs(rootDir = ROOT) {
  const artefactPath = path.join(rootDir, "data", "usd-layer1-backtester", "run-v1.json");
  const runText = fs.readFileSync(artefactPath, "utf8");
  return { artefactPath, runText, run: JSON.parse(runText) };
}

function renderArtifacts(options = {}) {
  const rootDir = options.rootDir || ROOT;
  const { runText, run } = loadInputs(rootDir);
  const data = buildData(run, runText, { ...options, rootDir });
  return {
    data,
    html: renderPage(data),
    summary: `${JSON.stringify(data, null, 2)}\n`
  };
}

function build(options = {}) {
  const rootDir = options.rootDir || ROOT;
  const { data, html, summary } = renderArtifacts(options);
  const pagePath = path.join(rootDir, PAGE_NAME);
  const summaryPath = path.join(rootDir, "data", "usd-layer1-backtester", SUMMARY_NAME);
  if (!options.write) return { data, html, summary, pagePath, summaryPath, written: false };
  fs.writeFileSync(pagePath, html);
  fs.writeFileSync(summaryPath, summary);
  return { data, html, summary, pagePath, summaryPath, written: true };
}

function check(options = {}) {
  const rootDir = options.rootDir || ROOT;
  const { html, summary } = renderArtifacts(options);
  const pagePath = path.join(rootDir, PAGE_NAME);
  const summaryPath = path.join(rootDir, "data", "usd-layer1-backtester", SUMMARY_NAME);
  const drift = [];
  if (!fs.existsSync(pagePath) || fs.readFileSync(pagePath, "utf8") !== html) drift.push(PAGE_NAME);
  if (!fs.existsSync(summaryPath) || fs.readFileSync(summaryPath, "utf8") !== summary) drift.push(SUMMARY_NAME);
  return { ok: drift.length === 0, drift, pagePath, summaryPath };
}

if (require.main === module) {
  const write = process.argv.includes("--write");
  const verify = process.argv.includes("--check");
  if (!write && !verify) {
    console.error("usage: node backtester/scripts/build_usd_l1_decision_rules_page.js --write|--check");
    process.exitCode = 2;
  } else if (write) {
    const result = build({ write: true });
    console.log(`wrote ${path.relative(ROOT, result.pagePath)} and ${path.relative(ROOT, result.summaryPath)}`);
  } else {
    const result = check();
    if (result.ok) {
      console.log(`current: ${PAGE_NAME} and ${SUMMARY_NAME}`);
    } else {
      console.error(`stale: ${result.drift.join(", ")}`);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  PAGE_NAME,
  SUMMARY_NAME,
  ROOT,
  buildData,
  evaluateRun,
  signalVotes,
  ruleOf,
  renderPage,
  renderArtifacts,
  build,
  check
};
