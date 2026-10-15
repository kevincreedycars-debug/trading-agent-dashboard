"use strict";

/**
 * Build the USD research handoff bundle under docs/research/handoff/usd/v1/.
 *
 * The user asked for a standardised handoff built by extracting what the existing system actually does:
 * one shared context document, one factor register in JSON and Markdown, one self-contained research pack
 * per registered factor, one output template with the card schema reconciled to it, and one manifest that
 * both documents the bundle and feeds the dashboard's research tracker.
 *
 * Every USD factor in the committed Research Library catalogue gets its own self-contained brief pack here,
 * all twenty-five of them: the ten the deployed node computes today, whose packs are baseline audits of
 * executing code, and the fifteen session-research factors, whose packs are the research assignment for a
 * factor that has no rule in force. A pack carries the session context, the factor's own context, the
 * research prompt and the output instructions, so it can be handed to a model on its own.
 *
 * Nothing here invents a rule, a sign, a weight or a performance number. Every fact is extracted from the
 * artefacts named in `source_refs`, and anything unavailable is written as unavailable.
 *
 *   node scripts/build_research_handoff.js write   # regenerate the bundle, its zip and the tracker file
 *   node scripts/build_research_handoff.js check    # fail if any generated file is stale on disk
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = "docs/research/handoff/usd/v1";
const PACK_DIR = `${OUT_DIR}/packs`;
const CARD_SCHEMA_VERSION = "usd-session-research-card-v3";
const CONTEXT_VERSION = "usd-session-context-20261014.1";
const PACK_VERSION = "2.0.0";
const EXTRACTED_AT = "2026-10-15";
const EXTRACTION_BRANCH = "research/usd-session-20261013";
const EXTRACTION_COMMIT = "d07af11166ea1d39e5f4184e85a993e03bcb7137";
// Two different facts, kept apart because they carry different dates and version numbers: the audited
// baseline is the repository export, measured against the live workflow on 2026-10-11 while it was v154;
// the executing version is v155, published on 2026-10-12 by the supervised live apply of the
// null-conversion guard. The export's `Calculate USD Conviction` jsCode is the same bytes v155 executes.
const DEPLOYED_WORKFLOW = "USD Layer 1 Agent, workflow OCt1tB9yVMUgFTha: executing version v155 (version id 0fb553c2-b1f1-4afa-bfdc-1166b60a6a79, versionCounter 155, published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-conversion guard, nodes_sha256 b2583215ca256a96dd0d7693635a66681fff42595805cdb254d48ae52960b974); the audited baseline is the repository export exports/usd_layer1_agent.json, measured against v154 on 2026-10-11 (scoped export 2026-10-11T18:59:54.307Z), whose Calculate USD Conviction jsCode sha256 is 580f0aa34bc1dd5d210e0dc3391dd653414ac1f68fbc0594133dc597a29254d4, the same bytes the executing version runs";
const COLLECTOR_WORKFLOW = "Data Collector - USD, export exports/usd_collector.json (repository snapshot; the live collector id was not in the scoped identity file)";
const RUNTIME = "n8n Cloud, workspace https://silver17.app.n8n.cloud (project ISQG9XU7TGTT6Fcu)";

const HORIZON = {
  horizon_id: "london-0500-to-london-0500-next-day",
  start: "05:00 Europe/London",
  end: "05:00 Europe/London on the next local date",
  nominal_hours: 24,
  session_start_weekdays: [1, 2, 3, 4, 5],
  note:
    "One 24-hour session whose two ends are London wall-clock times one local date apart. The first " +
    "statement of this target was 05:00 London to 17:00 America/New_York on the same local date; it was " +
    "withdrawn on 2026-10-14 and anything still carrying it is superseded. A session starts on a " +
    "Monday-to-Friday local date only: the London spring (01:00Z, last Sunday of March) and autumn " +
    "(01:00Z, last Sunday of October) transitions fall inside the session that starts on the preceding " +
    "Saturday, so that start measures 23 hours in spring and 25 in autumn and is not a session. The " +
    "Friday session therefore contains Friday's US close and ends on Saturday morning, which is intended. " +
    "Every eligible session is exactly 24 hours, held by test over every Monday-to-Friday start from 2023 " +
    "to 2027 (backtester/tests/usd_session_engine_interface.test.js)."
};

const TARGET = {
  intended_label_instrument: "DXY",
  quote_source: null,
  verification_state: "UNVERIFIED",
  rule:
    "No intraday DXY print exists in this repository or in the live collector, so the label instrument and " +
    "the quote source are unverified at both ends. If a claim is really about EUR/USD, a custom basket or " +
    "any other instrument, name that instrument and say so; never present another instrument as DXY. The " +
    "live collector prices the dollar with FRED DTWEXBGS, which is a feature and cannot be the session " +
    "label: H.10 publishes on Mondays at 16:15 ET for the previous business week, so at a 05:00 London " +
    "cutoff that value is 2 to 6 business days old (median 4)."
};

// ---------------------------------------------------------------------------
// Shared text carried by every pack. It is defined once here so that 25 packs
// cannot drift apart, and the handoff test asserts the same facts appear in the
// register, in the context document and in the tracker tasks.
// ---------------------------------------------------------------------------

const OBJECTIVE =
  "Forecast the direction of the US dollar over one session: the sign of the change in the label instrument " +
  "from 05:00 Europe/London to 05:00 Europe/London on the next local date.";

const READER =
  "You are writing for one reader who trades the US dollar and needs to know what is actually true, not what " +
  "sounds plausible.";

const HORIZON_BLOCK = [
  "- Start: 05:00 Europe/London. End: 05:00 Europe/London on the next local date. Both ends are London",
  "  wall-clock times one local date apart, so no US or EU changeover date can move the window and a fixed",
  "  hour count is never used to build it.",
  "- Eligible starts are Monday to Friday local dates only. The London spring transition (01:00Z, last Sunday",
  "  of March) and autumn transition (01:00Z, last Sunday of October) fall inside the session that starts on",
  "  the preceding Saturday, so that start measures 23 hours in spring and 25 in autumn and is not a session.",
  "  Every eligible session is therefore exactly 24 hours.",
  "- The Friday session contains Friday's US close and ends on Saturday morning. That is intended.",
  "- A session whose start or endpoint print is missing is never filled, forward-carried, interpolated or",
  "  silently extended to Monday. The one proposed missing-quote policy - to be frozen, together with the flat",
  "  band and the study's own tie policy, before any candidate is scored, and recorded in the session contract",
  "  where the entry still reads UNDECIDED - is that such a session is a data exclusion: it leaves the scored",
  "  sample and is reported as coverage rather than as an abstention.",
  "- A data exclusion and a model abstention are different objects and are counted and scored separately. An",
  "  abstention is the model declining to give a direction on a session whose two ends both exist; that",
  "  session stays in the scored sample and is scored as a no-call, and it is never reported as coverage lost.",
  "- The label's flat band and the study's own tie policy for scoring are still undecided; they must be frozen",
  "  with the missing-quote policy before any candidate is scored and may not be borrowed from the closed",
  "  24-hour study."
].join("\n");

const AVAILABILITY_BLOCK = [
  "- No intraday dollar-index print exists in this repository or in the live collector. The label instrument",
  "  and its quote source are UNVERIFIED at both ends.",
  "- The live collector takes one snapshot per day at the 09:30 ET pipeline time and prices the dollar with",
  "  FRED DTWEXBGS: the Federal Reserve publishes H.10 on Mondays at 16:15 ET for the previous business week,",
  "  so at a 05:00 London cutoff that value is 2 to 6 business days old (median 4).",
  "- H.15 interest-rate series (DGS2, DGS3MO, DGS10, DFII5, DFII10, T5YIE, T10YIE) are 1 to 2 business days",
  "  old; market-close series (VIXCLS, SP500, NASDAQ100, SOFR, BAMLH0A0HYM2) 1 to 2; WTI spot 1 to 4.",
  "  The publication time was verified on the provider's own page only for the H.10 family; the other",
  "  families carry a declared one-business-day assumption.",
  "- Hourly OANDA caches exist for EUR/USD, XAU/USD and NAS100 only, and only to 2026-04-30.",
  "- Coinbase spot (gold, BTC and several pairs) is genuine intraday information; the NQ field is an Alpha",
  "  Vantage GLOBAL_QUOTE on QQQ, an ETF, not the index.",
  "- The paid calendar feed stores the release and its scheduled time, no consensus snapshot and no",
  "  first-print vintage; ALFRED vintage CSVs need a key.",
  "- Daily macro series are the previous close at 05:00 London, correctly lagged, never the same morning."
].join("\n");

const ENGINE_BLOCK = [
  "- The published call is produced by the deterministic node Calculate USD Conviction in the live workflow",
  "  USD Layer 1 Agent (OCt1tB9yVMUgFTha). Two versions matter and they are not the same fact. The executing",
  "  version is v155, published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-conversion",
  "  guard (version id 0fb553c2-b1f1-4afa-bfdc-1166b60a6a79, versionCounter 155, nodes_sha256 b2583215ca25",
  "  6a96dd0d7693635a66681fff42595805cdb254d48ae52960b974). The audited baseline is the repository export",
  "  exports/usd_layer1_agent.json, measured against v154 on 2026-10-11 (scoped export",
  "  2026-10-11T18:59:54.307Z); its Calculate USD Conviction jsCode",
  "  (580f0aa34bc1dd5d210e0dc3391dd653414ac1f68fbc0594133dc597a29254d4) is the same bytes the executing",
  "  version runs, so the arithmetic audited here is the arithmetic in force. The model writes the per-factor",
  "  verdict strings; the code computes every published number, and where they disagree the code wins.",
  "- Coded 24h weights: F1 10, F2 14, F3 10, F4 10, F5 14, F6 4, F7 24, F8 12, F9 1, F10 1 (sum 100).",
  "  The rulebook logic/agent_usd_direction.md v2.1, which the workflow fetches from GitHub on every run,",
  "  publishes F1 10, F2 14, F3 16, F4 14, F5 6, F6 5, F7 3, F8 18, F9 12, F10 2. Both are live and nothing",
  "  reconciles them.",
  "- conviction = round(winning weight / active weight * 100): a share of active evidence, not a probability.",
  "  It can read 100% while half the weight is missing, because a missing input moves to the neutral pile",
  "  instead of into active. Direction carries the suffix _LEAN when |netEdge| < 20; NO_CLEAR_BIAS requires an",
  "  exact tie of the two weight sums, and the deployed 24h vector can produce one (F2 + F3 + F4 + F6 + F8 = 50",
  "  against F1 + F5 + F7 + F9 + F10 = 50), so abstention is reachable arithmetic rather than a designed gate.",
  "  The dashboard publishes a second, separately derived strength bucket, so two strength labels can disagree",
  "  on the same row.",
  "- F7 (coded 24 points) copies a pre-computed usd_signal with no consensus, no first print and no age.",
  "  F8 (12 points) reads a categorical bias string with no vintage. Together 36 of the 100 coded points",
  "  cannot be reproduced from reachable data.",
  "- A missing input scores the factor NEUTRAL and names the missing input; the substitution ladder (d1 to d5",
  "  to d20, gold 5d to 1d, NQ 1d to 5d) records only a warning string and is invisible in the numeric",
  "  payload; snapshot selection has no cutoff bound, no per-field age and no revision exclusion."
].join("\n");

const PROHIBITIONS = [
  "Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not",
  "measured it, say it is unmeasured. Numbers you remember are not evidence.",
  "Do not use hindsight: never state what a past period would have predicted using information that was not",
  "available at that time, and do not present a later revision as a first print.",
  "Cite only sources you actually fetched in this session, with the link and the passage you relied on.",
  "Where you are uncertain, say so and give the reason; an unresolved question is a valid return.",
  "State effects that are already in the price at the cutoff rather than counting them again as predictive.",
  "Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.",
  "Name the instrument a claim is really about. Never present another instrument as DXY.",
  "No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by",
  "this pack, and none may be proposed as part of the deliverable."
].join("\n");

const RETURN_RULES = [
  "Return one JSON document for this factor, and nothing else in the JSON file.",
  "Use the field list in section 7 of this pack exactly; a required field left empty is not an accepted card.",
  "At most two programmable hypotheses. If you cannot state a hypothesis a program could evaluate session by",
  "session without judgement, return one, or return none and say why.",
  "Every parameter must carry the values you allow, a default and the rule for choosing it on training rows",
  "only, declared before validation.",
  "Every claim in the verdict must be traceable to an entry in evidence, or be labelled as a judgement.",
  "Return the file plus a short note listing the sources you fetched and the questions you could not resolve."
].join("\n");

const CARD_FIELDS = [
  "card_id", "schema_version", "created_at", "author", "status", "title", "asset", "factor_id", "task_id",
  "card_version", "model", "family", "assignment_id", "session_horizon", "calendar_and_quote_handling",
  "verdict", "mechanism", "direction_claim", "session_role", "observable_by_cutoff", "reaction_vs_predictive",
  "historical_data_requirements", "live_data_requirements", "missing_or_stale_handling",
  "dependencies_and_overlap", "hypotheses", "rejection_test", "falsification_tests", "evidence",
  "limitations", "open_questions"
];

// ---------------------------------------------------------------------------
// The ten factors the deployed USD node computes today, extracted on 2026-10-13 from
// exports/usd_layer1_agent.json (workflow OCt1tB9yVMUgFTha; audited baseline measured at v154 on 2026-10-11,
// executing version v155 since 2026-10-12) and logic/agent_usd_direction.md
// v2.1. These are executing code, not candidates. Their packs are baseline audits: the question is
// whether the deployed sign, weight, threshold and lookback are justified.
// ---------------------------------------------------------------------------

const LIVE_FACTORS = [
  {
    task_id: "USD-BASELINE-AUDIT-01",
    factor_id: "live.f1-vix-level",
    order: 1,
    label: "F1 VIX level and risk regime",
    group: "live_engine",
    family: "risk_conditions",
    role: "regime context",
    deployed: true,
    definition: "The VIX level at the cutoff read as the risk regime the dollar is trading in; the deployed code reads the level only, while the rulebook also describes 1-day and 5-day modifiers that do not execute.",
    inputs: [
      { input: "vix_level", source: "FRED VIXCLS, stored by the USD collector", units: "index", transform: "level, no transformation", lookback: "none", cutoff: "1 to 2 business days old at 05:00 London; this family's publication time carries a declared assumption, not a verified schedule" }
    ],
    rule: "VIX > 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH. Level only. Threshold 25 / 16. Coded weight 10, rulebook weight 10, deployed in signals.F1.",
    missing_stale: "A missing level scores F1 NEUTRAL and names the missing input. The null-versus-unavailable guard was repaired in the repository on 2026-10-11 and applied to the live workflow on 2026-10-12, which published v155; with every input present the repaired engine returns the recorded verdicts unchanged, so no recorded call with a complete input set moved.",
    deps: [],
    overlap: "F9 (Dollar Smile) reads the same VIX level with the bias string and F10 gates on the same 25 / 16 thresholds, so one input informs three factors.",
    hist_avail: "FRED VIXCLS daily, cached from 2023-04-03 in the closed study's cache and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage.",
    live_avail: "Collected once per day at the 09:30 ET pipeline time, with no as-of check against the 05:00 London cutoff and no per-field age.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F1 (thresholds 25 and 16, weight 10)",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 exposed to the model)"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 1 - VIX Level and Risk Regime'",
      "logic/agent_usd_direction.md section 15 rule 4 ('VIX > 25 activates safe-haven USD logic')"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline: no research card has been run on it and it is not a candidate." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 1", quote: "VIX > 25 activates safe-haven USD logic and supports USD; VIX below 16 reads as risk-on and pressures USD; 16 to 25 is neutral because domestic drivers dominate." }
      ],
      questions: [
        "On a 24-hour London-to-London window, is the level of VIX or the change in VIX the informative quantity, and does the 25 / 16 split survive an honest test?",
        "Is the safe-haven bid that VIX > 25 is meant to signal already in the price at 05:00 London, given that the cutoff follows the US session that produced that print?",
        "What does the 1-to-2-business-day staleness do to the mechanism, and does the sign depend on what caused the volatility (growth, policy, funding)?"
      ],
      counterarguments: [
        "A level rule on a lagged daily index may describe the past week rather than the next 24 hours.",
        "The dollar is not unconditionally a safe haven: in funding stress the euro or yen can outperform, and three deployed factors share this input."
      ],
      timing: "VIXCLS is a market-close series: at 05:00 London the available value reflects the previous US close, and this family's publication time was not verified on its own page.",
      hypothesis_seed: "State whether the sign of the relation between the VIX regime and the next 24-hour dollar change is stable, or flips, and name the flag that separates the two regimes.",
      falsification: "Name a regime split and a metric, computed on training sessions only, on which the deployed 25 / 16 level rule would be shown worse than the flat base rate.",
      gap: "No verified publication time for VIXCLS; no vintage; no intraday VIX at the cutoff."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-02",
    factor_id: "live.f2-us-2y-delta",
    order: 2,
    label: "F2 US 2Y yield delta",
    group: "live_engine",
    family: "rates_and_policy_expectations",
    role: "direction",
    deployed: true,
    definition: "The change in the US 2-year Treasury yield as a proxy for repricing of the US policy path.",
    inputs: [
      { input: "us_2y_d5_bps, us_2y_d20_bps", source: "FRED DGS2, stored by the USD collector", units: "basis points", transform: "difference of the level over the lookback", lookback: "5 days on 24h, 20 days on longer timeframes", cutoff: "1 to 2 business days old; a daily series, so the cutoff value is the previous close" }
    ],
    rule: "At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL. Threshold +/- 5 bps. Coded weight 14, rulebook weight 14.",
    missing_stale: "A missing delta scores NEUTRAL and names the missing input; the 20d-to-5d substitution on longer timeframes is only a warning string.",
    deps: ["A rate series whose publication schedule is verified at the cutoff."],
    overlap: "F3 contains the US leg, so a move in DGS2 enters twice when both are active; F4 moves with nominal yields through the inflation-expectation leg.",
    hist_avail: "FRED DGS2 daily in the closed study's cache from 2023-04-03 and in the macro frame from 2024-01-02; latest published values only.",
    live_avail: "Collected daily; the H.15 family is 1 to 2 business days old at the cutoff and its exact publication time was not verified in this cycle.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F2 via signalFromDelta(us2yDelta, 5, -5, ...)",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (us_2y_d5_bps, us_2y_d20_bps)"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 2 - US 2-Year Yield Delta'",
      "logic/agent_usd_direction.md section 15 rules 1 and 3 ('always use delta, not level'; 'relative rates matter more than absolute US rates')"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 2", quote: "Rising US front-end yields support USD, falling front-end yields pressure USD; the 5-day change is the operative input." }
      ],
      questions: [
        "Does a 5-day change in the US 2Y belong on a 24-hour window, or does the window need the previous session's move instead?",
        "How much of the yield move visible at 05:00 London was already priced into the dollar at the US close, and how would you measure that without hindsight?",
        "Is the +/- 5 bps threshold defensible across rate regimes, or should it scale with realised yield volatility, and which part of the 2Y move (policy expectations versus term premium) carries the dollar sign?"
      ],
      counterarguments: [
        "A 5-day lookback on a series that is 1 to 2 business days stale describes a window that ended before the previous US close.",
        "In a carry or risk-premium regime higher short rates can coincide with a weaker dollar, and the 2Y enters twice if F3 is active."
      ],
      timing: "The cutoff reads the previous close, so the factor describes the accrued move rather than anything that happened in the London morning.",
      hypothesis_seed: "Propose at most two program-evaluable statements of the relation between the accrued front-end move and the next 24-hour dollar change, each with a bounded lookback and a regime condition, and say which one the deployed rule most resembles.",
      falsification: "Name the split and the metric on which the deployed +/- 5 bps threshold would be rejected, computed on training sessions only.",
      gap: "No verified H.15 publication time; no vintage; nothing measures how much of the accrued move is already priced."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-03",
    factor_id: "live.f3-us-de-2y-spread-delta",
    order: 3,
    label: "F3 US-DE 2Y spread delta",
    group: "live_engine",
    family: "relative_rates",
    role: "direction",
    deployed: true,
    definition: "The five-day change in the US minus German 2-year yield spread, read as the relative-rate stance behind the dollar; the deployed code reads one fixed five-day change at every timeframe, and the rulebook factor is the same spread delta with the same thresholds.",
    inputs: [
      { input: "us_de_2y_spread_d5_bps", source: "computed in the collector from FRED DGS2 (node 'HTTP Request | US 2Y Treasury Yield - FRED API') and a Bundesbank CSV German 2Y node ('HTTP Request | Germany 2Y Yield'), stored by the USD collector", units: "basis points", transform: "five-day difference of the spread level", lookback: "5 days at every timeframe", cutoff: "inherits the older leg; the German CSV and the US close are 1 to 2 business days old at 05:00 London" }
    ],
    rule: "At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL, on one fixed five-day window. Threshold +/- 5 bps. Coded weight 10, rulebook weight 16.",
    missing_stale: "A missing spread delta scores NEUTRAL and names the missing input; the input pack also lists `de_2y_yield`, `us_de_2y_spread` and `us_de_2y_spread_d5_bps` as must-be-neutral if unavailable. The spread's 1-day and 20-day deltas are exposed to the model and never read by the code, and the collector stores no 20-day German 2Y delta at all.",
    deps: ["A German 2Y series whose publication schedule, holidays and as-of dates match the US leg."],
    overlap: "Shares its US leg with F2, so a US 2Y move is weighted twice when both factors are active; the German leg arrives from a different vendor and calendar from the US leg it is subtracted from.",
    hist_avail: "The US leg is in the closed study's cache from 2023-04-03 and in the 22-series macro frame from 2024-01-02; the Bundesbank German 2Y series was not traced in either cached frame in this cycle.",
    live_avail: "One row per day at the 09:30 ET pipeline time, no vintage, and the German CSV's as-of date is not asserted in the row.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F3 = signalFromDelta(inputs.us_de_2y_spread_d5_bps, 5, -5, ...) at every timeframe",
      "exports/usd_collector.json -> Normalise Market Snapshot: us_de_2y_spread = spread(us2y.latest, de2y.latest), us_de_2y_spread_d5_bps = spreadD5(us2y, de2y); de2y parsed by bundesbankCsv",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (us_de_2y_spread, us_de_2y_spread_d1_bps, us_de_2y_spread_d5_bps, us_de_2y_spread_d20_bps)"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 3 - US/Germany 2-Year Rate Differential Delta' (weight 16; widening by 5 bps or more BULLISH, narrowing by 5 bps or more BEARISH)"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 3", quote: "This is one of the strongest USD drivers because currencies are relative. Rising US yields only matter if US yields are rising faster than foreign yields." }
      ],
      questions: [
        "Is the spread delta the right way to express relative rates on a 24-hour window, or does the level of the spread matter more than its five-day change?",
        "How much of the German leg is already priced at 05:00 London before the European curve has opened, and does the Bundesbank series update at a time that makes the factor usable at the cutoff?",
        "Does the factor add anything over F2 in a test, or does the German leg only rescale a signal that F2 already carries?"
      ],
      counterarguments: [
        "A five-day change built from two series with different release calendars and no vintage can compare two different as-of dates.",
        "The factor differences two yields that have each already moved; when both legs move together it degenerates towards F2 with added noise.",
        "The coded weight is 10 while the rulebook weight is 16, so the factor the rulebook calls one of the strongest carries a mid-rank weight in the executed arithmetic."
      ],
      timing: "The cutoff reads each leg's latest published value, so the five-day move ends before the previous US close.",
      hypothesis_seed: "State at most two program-evaluable versions of the relative-rate claim, each with an explicit window end, and say which one the deployed five-day spread delta approximates.",
      falsification: "Name the split and the metric on which the deployed +/- 5 bps spread threshold would be rejected, computed on training sessions only.",
      gap: "The German series' publication schedule was not verified; no vintage for either leg; the F2/F3 double count of the US leg is unmeasured."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-04",
    factor_id: "live.f4-real-yield-delta",
    order: 4,
    label: "F4 US 10Y real yield delta",
    group: "live_engine",
    family: "rates_inflation",
    role: "direction",
    deployed: true,
    definition: "The change in the US 10-year TIPS real yield, read as the real-rate leg of dollar strength; the code prefers the 20-day change on the two long timeframes and the 5-day change elsewhere, and the rulebook names the 5-day change with the 20-day input quoted as available if present.",
    inputs: [
      { input: "us_10y_real_yield_d5_bps, us_10y_real_yield_d20_bps", source: "FRED DFII10 (node 'HTTP Request | TIPS 10Y Real Yield - FRED Api'), stored by the USD collector", units: "basis points", transform: "difference of the level over the lookback", lookback: "5 days on 24h, 3d and current_week; 20 days on next_week and current_month when the optional field is present", cutoff: "Federal Reserve H.15 family, 1 to 2 business days old at 05:00 London, median 1" }
    ],
    rule: "At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL, on whichever lookback the timeframe selects. Threshold +/- 5 bps. Coded weight 10, rulebook weight 14.",
    missing_stale: "A missing delta scores NEUTRAL and names the missing input; the 20d-to-5d substitution on the two long timeframes is only a warning string, and because the 20-day field is optional in the snapshot a null there silently changes the lookback the factor is scored on.",
    deps: ["A verified H.15 publication time and vintage for the real-yield series."],
    overlap: "Moves with F2 whenever breakevens are flat, because the nominal 10-year and real 10-year series share the same policy-path news; it is also the rate-side twin of F6, which reads gold as the other side of the same real-rate complex.",
    hist_avail: "FRED DFII10 in the closed study's cache from 2023-04-03 and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage.",
    live_avail: "Collected daily at the 09:30 ET pipeline time with no as-of check against the 05:00 London cutoff and no per-field age; revisions of the H.15 series are not detectable because no vintage is stored.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F4 = signalFromDelta(realYieldDelta, 5, -5, ...), where realYieldDelta takes us_10y_real_yield_d20_bps on next_week and current_month, else us_10y_real_yield_d5_bps",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (us_10y_real_yield, us_10y_real_yield_d5_bps, us_10y_real_yield_d20_bps)"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 4 - US 10-Year Real Yield Delta' (weight 14; rising by 5 bps or more over 5 days BULLISH, falling by 5 bps or more BEARISH, us_10y_real_yield_d20_bps listed as an input)"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 4", quote: "Rising real yields tighten financial conditions and support USD. Falling real yields usually pressure USD and support gold." }
      ],
      questions: [
        "Does a real-yield change carry a dollar sign on a 24-hour window, and does the sign survive when the move comes from breakevens rather than from real rates?",
        "Is a five-day real-yield change a forecast at the cutoff, or a description of a move the dollar has already priced at the previous close?",
        "Which series should represent the real yield - TIPS 10Y, a fitted curve, or a survey measure - given the release lag and revision behaviour of the series actually collected?"
      ],
      counterarguments: [
        "The 20-day arm that long timeframes use is never exercised at the 24-hour horizon where the published call is read, so the documented 20-day input does not affect the number a reader sees first.",
        "Real yields, gold and the dollar are three readings of one risk complex; F4, F6 and F1 can move together and each still adds weight to the same story.",
        "The coded weight is 10 against a rulebook weight of 14, and the sign is asserted in both without a stated mechanism for the 24-hour window."
      ],
      timing: "The cutoff reads the latest published real yield, which is one to two business days old before the five-day window is formed.",
      hypothesis_seed: "State at most two program-evaluable claims about the real-rate change and the next 24-hour dollar move, each naming its window and regime, and say which the deployed rule most resembles.",
      falsification: "Name the split and the metric on which the deployed +/- 5 bps real-yield threshold would be rejected on training sessions only, and state what the result would look like if the threshold were the five-day standard deviation of the series instead.",
      gap: "No verified H.15 publication time or vintage; the real-versus-breakeven decomposition is not recoverable from the stored inputs."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-05",
    factor_id: "live.f5-dxy-delta",
    order: 5,
    label: "F5 DXY delta",
    group: "live_engine",
    family: "price_confirmation",
    role: "direction",
    deployed: true,
    definition: "The percentage change in the dollar index the collector stores as `dxy_level`, read as confirmation that the market is already expressing dollar strength or weakness; the code reads a 1-day change on 24h with a tighter threshold and a 5-day or 20-day change on the longer timeframes.",
    inputs: [
      { input: "dxy_d1, dxy_d5, dxy_d20", source: "collected by the USD collector node 'HTTP Request | DXY - FRED Dollar Index - FRED API' and turned into percentage changes by fredPct (offsets of 1, 5 and 20 observations of the returned series); target_source_assessment.md records the stored series as FRED DTWEXBGS, the Federal Reserve H.10 nominal broad U.S. dollar index, not the ICE DXY basket, and the source page states that all values are subject to revision", units: "per cent change of the index level", transform: "percentage change over 1, 5 or 20 observations of the series", lookback: "1 day on 24h; 5 days on 3d and current_week; 20 days on next_week and current_month when dxy_d20 is present", cutoff: "2 to 6 business days old at 05:00 London, median 4, because the H.10 family is released on Mondays at 16:15 ET for the previous business week" }
    ],
    rule: "On 24h: at or above +0.15 per cent BULLISH, at or below -0.15 per cent BEARISH, otherwise NEUTRAL. On every other timeframe: +/- 0.30 per cent. Coded weight 14 on 24h, rulebook weight 6.",
    missing_stale: "A missing delta scores NEUTRAL and names the missing input. The substitutions are silent and one of them changes the test: on 24h a null `dxy_d1` moves the factor to `dxy_d5` while the threshold stays at the 1-day 0.15 per cent, so a five-day move is judged on the tighter band, and on the two long timeframes a null `dxy_d20` moves it to `dxy_d5`. Neither substitution reaches the numeric payload.",
    deps: ["A dollar index whose release schedule is daily rather than weekly, and a decision on which index the label instrument uses."],
    overlap: "The collected series is a broad dollar index, so whenever the session label is built from the same index family the factor contains part of the target; it also restates F2, F3 and F4 as a price rather than as a yield, and the rulebook makes it the primary tiebreaker, a role the code never grants it.",
    hist_avail: "FRED DTWEXBGS is a daily series available well before the closed study's cache (2023-04-03) and the macro frame (2024-01-02); latest published values only, no vintage, so revisions are invisible.",
    live_avail: "One collector row per day at the 09:30 ET pipeline time and no per-field age, so the newest observation is already several business days old at the 05:00 London cutoff.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F5 = signalFromDelta(dxyDelta, tf === '24h' ? 0.15 : 0.3, tf === '24h' ? -0.15 : -0.3, ...) with dxyDelta = dxy_d20 on next_week and current_month, else dxy_d1 on 24h, else dxy_d5",
      "exports/usd_collector.json -> Normalise Market Snapshot: const dxy = fredPct(dxyRaw); dxy_level = dxy.latest, dxy_d1 = dxy.d1, dxy_d5 = dxy.d5, dxy_d20 = dxy.d20"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 5 - DXY 5-Day Delta' (weight 6; up more than 0.30 per cent over 5 days BULLISH, down more than 0.30 per cent BEARISH, and the same section names DXY the primary tiebreaker when weighted scores are balanced)",
      "logic/agent_usd_direction.md section 7, 'Step 3 - Tiebreaker Rules' (DXY 5d first, then US 2Y 5d, real yield 5d, VIX 5d; no code path reads this order)"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline; coded and rulebook weights differ most here in rank terms, 14 against 6." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 5", quote: "DXY momentum is not a primary macro driver, but it confirms whether the market is already expressing USD strength or weakness. DXY is also the primary tiebreaker when weighted scores are balanced." }
      ],
      questions: [
        "If the factor is a price that confirms a move already visible in the target, what is left for it to predict on a 24-hour window, and how would you state that claim so a test can reject it?",
        "Is a 1-day change in a weekly-released broad index usable at a 05:00 London cutoff at all, or does the factor need a different dollar price series?",
        "Does the 0.15 per cent 24-hour threshold come from anything measurable, or would a volatility-scaled band change the factor's contribution on quiet sessions?"
      ],
      counterarguments: [
        "The newest observation of a weekly-released index is up to six business days old at the cutoff, so the 1-day change on 24h describes a move that ended before the previous week.",
        "A factor built from the same index family as the label risks restating the target instead of forecasting it, and the label instrument is not yet fixed in this handoff.",
        "The coded 24-hour weight of 14 is more than twice the rulebook weight of 6, in the direction that increases the influence of the most target-like factor."
      ],
      timing: "The cutoff reads a stale observation and applies the session-timeframe threshold to it, and a substituted five-day change can be judged against the 1-day band.",
      hypothesis_seed: "State at most two program-evaluable claims about dollar-index momentum and the next 24-hour change that are not restatements of the target, and say which the deployed rule most resembles.",
      falsification: "Name the split and the metric on which the deployed 0.15 per cent 24-hour threshold would be rejected on training sessions only, and say what the factor still contributes once the label's own lagged change is controlled for.",
      gap: "The label instrument is not fixed; no vintage on a series the source states is revised; the substituted-window against threshold mismatch is unmeasured."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-06",
    factor_id: "live.f6-gold-delta",
    order: 6,
    label: "F6 Gold delta",
    group: "live_engine",
    family: "safe_haven_overlap",
    role: "direction",
    deployed: true,
    definition: "The change in the spot gold price, read as the anti-dollar leg: gold weakness is scored as dollar support and gold strength as dollar pressure; the deployed code inverts the sign against a 0.1 per cent band, and the rulebook states the same inversion without a numeric band.",
    inputs: [
      { input: "gold_d1_pct, gold_d5_pct, gold_d20_pct", source: "Coinbase spot quote collected by the node 'HTTP Request | Gold - Coinbase'; the percentage changes are computed by the collector's historyPct against its own previously stored snapshot rows ('Supabase | Get Previous Market Snapshots'), so the window is counted in stored pipeline rows rather than in calendar days or exchange sessions", units: "per cent change", transform: "percentage change against the row 1, 5 or 20 positions back in the collector's own history, with a fallback to the 1-day column when the 5-day column is missing", lookback: "5 stored rows on 24h, 3d and current_week; 20 stored rows on next_week and current_month when gold_d20_pct is present, otherwise the 5-row arm", cutoff: "spot quote read at the 09:30 ET pipeline time, so the observed price is not a 05:00 London print and no as-of check is applied" }
    ],
    rule: "Gold below -0.1 per cent reads BULLISH, gold above +0.1 per cent BEARISH, inside +/- 0.1 per cent NEUTRAL, on the selected lookback. Coded weight 4 on 24h, rulebook weight 5.",
    missing_stale: "A missing gold delta scores NEUTRAL and names the missing input; the input pack silently substitutes `gold_d1_pct` for a missing `gold_d5_pct` and records only a warning string, so a one-row move can be labelled and scored as a five-day move, and the row counts themselves depend on how often the collector ran.",
    deps: ["A gold price series with a fixed daily benchmark time, and a window counted in calendar or session time rather than in pipeline rows."],
    overlap: "F4 already reads the real-rate complex from the other side, and F1, F9 and F10 read the same risk appetite through VIX and equities; when gold and the dollar rise together the rulebook tells the model to flag a safe-haven conflict, while the code carries a conflict penalty that is hard-coded to zero.",
    hist_avail: "A Coinbase spot price is retrievable historically, but the closed study's cache and the macro frame record no gold series traced in this cycle, so the row-based window has no obvious historical equivalent.",
    live_avail: "One quote per collector run, no vintage, no benchmark time, and the deltas are only as regular as the pipeline's run history.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F6: gold below -0.1 per cent BULLISH, above +0.1 per cent BEARISH, with goldDelta = gold_d20_pct on next_week and current_month, else gold_d5_pct",
      "exports/usd_layer1_agent.json -> Build USD Input Pack: goldD5 = gold_d5_pct if present else gold_d1_pct, with the warning 'gold_d5_pct missing; using gold_d1_pct fallback'",
      "exports/usd_collector.json -> Normalise Market Snapshot: const goldPrice = coinbasePrice(goldRaw); goldD1Pct = historyPct(goldPrice, 'gold_price', 0), goldD5Pct = historyPct(goldPrice, 'gold_price', 4), goldD20Pct = historyPct(goldPrice, 'gold_price', 19)"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 6 - Gold 5-Day Delta' (weight 5; gold falling over 5 days BULLISH, rising over 5 days BEARISH, gold flat NEUTRAL, plus the instruction to flag a possible safe-haven conflict when gold rises while the dollar strengthens)"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 6", quote: "Gold is a clean anti-USD signal in normal regimes. If gold is rising while USD is also strengthening, flag a possible safe-haven conflict." }
      ],
      questions: [
        "Does a spot gold quote have a benchmark time that can be read at 05:00 London, or is the factor measuring whichever intraday print the pipeline happened to see?",
        "Is the inverse gold-dollar relation a stable mechanism or a regime artefact, and what does the factor add beyond the real-yield factor that reads the same complex?",
        "How should the five-day window be counted - calendar sessions, business days, or the stored collector rows the code actually uses - and does the choice change the factor's history?"
      ],
      counterarguments: [
        "A Coinbase spot quote carries no official close, so the price and the row-counted window are pipeline artefacts rather than market benchmarks.",
        "The code's 0.1 per cent band appears nowhere in the rulebook, which states no threshold at all, and the rulebook's safe-haven conflict flag has no code behind it.",
        "Gold, real yields and the dollar are three readings of one complex, and with a coded weight of 4 the factor's only content is its sign."
      ],
      timing: "The price is read at the pipeline's run time rather than at the cutoff, and the row-based window can begin and end at places no trading calendar recognises.",
      hypothesis_seed: "State at most two program-evaluable claims for an inverse gold-dollar relation over the next 24 hours, each with a stated benchmark time and window, and say which one the deployed spot-and-row-count rule most resembles.",
      falsification: "Name the split and the metric on which the deployed +/- 0.1 per cent gold band would be rejected on training sessions only, and say what the result would be if the sign were simply carried from the real-yield factor of the same complex.",
      gap: "No benchmark time for the collected gold price; no gold series traced in the historical frame; the conflict flag exists only in the rulebook."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-07",
    factor_id: "live.f7-economic-surprise",
    order: 7,
    label: "F7 US economic surprise",
    group: "live_engine",
    family: "event_surprises",
    role: "direction",
    deployed: true,
    definition: "The dollar-side read of the most recent completed US release: the collector stores a per-event signal string and the conviction node copies that string; the magnitude of the surprise, the consensus it was measured against and the event's age are never read.",
    inputs: [
      { input: "latest_us_event.usd_signal", source: "the event row the collector stores ('Supabase | Get Today USD Economic Events'), passed through 'Code | Derive USD Eco Inputs' to 'Normalise Market Snapshot'; the string is one of BULLISH, BEARISH or NEUTRAL and its producer is not reachable in the collector export, because every node that would compute it from a calendar ('HTTP Request | Eco Calendar Recent - Finnhub', 'HTTP Request | Eco Calendar Upcoming - Finnhub', 'Code | Process Eco Data', 'Code | Derive Fed Bias') is an entry point with no consumer in this workflow", units: "categorical string", transform: "none; the string is scored as it is stored", lookback: "the single latest completed event the row carries, whatever its age", cutoff: "no as-of check; the stored event also carries date and time fields that the signal rule never reads" }
    ],
    rule: "BULLISH reads BULLISH (positive US surprise supports USD), BEARISH reads BEARISH, any other string or a missing event reads NEUTRAL. No threshold, no surprise magnitude. Coded weight 24 on 24h, 8 on 3d, 5 on current_week, 6 on next_week, 5 on current_month; rulebook weight 3 inside a 72-hour window.",
    missing_stale: "A null `latest_us_event` scores NEUTRAL with the evidence string 'No recent US event'. The collector also appends latest_us_event to the snapshot's missing array and marks source_status partial, but the agent end sees only the null, so a partial row and a healthy row produce the same factor reading. A stale event is indistinguishable from a fresh one: nothing holds the rulebook's 72-hour window, and neither a consensus revision nor a first print is detectable.",
    deps: ["A consensus forecast archive with a first-print vintage, so that a surprise magnitude can be formed and dated."],
    overlap: "A release moves the same rates and price inputs that F2, F4 and F5 read, so one surprise can enter the score three or four times; F8 is derived from the same stored event rows and F9 reads the same regime.",
    hist_avail: "No consensus or first-print archive is committed. The calendar in the closed study's data records release times without consensus values and an ALFRED vintage file needs a key, so a historical surprise series cannot be rebuilt from this repository.",
    live_avail: "One row per day, with an event date and time stored but never tested for age, and no vintage of either the consensus or the stored string.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F7: BULLISH if ev.usd_signal === 'BULLISH', BEARISH if 'BEARISH', else NEUTRAL (weight 24 on 24h)",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (latest_us_event exposed to the model and listed among the must-be-neutral inputs when absent)",
      "exports/usd_collector.json -> Normalise Market Snapshot: latestUsEvent = ecoDataRaw?.latest_us_event || null, followed by checkMissing('latest_us_event', latestUsEvent). The helper latestUsEventFromEcoData, which would recompute usd_signal from actual against forecast and invert the sign for Unemployment Rate and Initial Jobless Claims, and the helper upcomingEventsFromEcoData are both defined and never called, so the stored string is read unexamined"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 7 - US Economic Surprise Direction' (weight 3; the expected input structure carries an age_hours field and a 72-hour window; only confirmed actual-versus-consensus data may be counted)"
    ],
    status: { research: "blocked", review: "pending", backtest: "not_tested", note: "Highest coded weight on the 24h timeframe at 24 points, against a rulebook weight of 3." },
    blockers: ["No consensus or first-print vintage source is reachable from this repository."],
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 7", quote: "Recent US data beat consensus BULLISH; missed consensus BEARISH; no significant US data in last 72 hours NEUTRAL; input missing NEUTRAL with missing input note. Only count confirmed actual-vs-consensus data. Never judge a release by absolute strength." }
      ],
      questions: [
        "Which consensus should the surprise be measured against, and where is a first-print vintage that survives revision so the surprise is not restated after the fact?",
        "The rulebook model input carries age_hours and a 72-hour window while the stored row carries a date and a time; what is the correct age measure at a 05:00 London cutoff, and what should happen when the latest completed release is a week old?",
        "Does an event surprise still carry information about the next 24 hours once the rates and dollar moves the release caused are already in the cutoff prices read by F2, F4 and F5?"
      ],
      counterarguments: [
        "The string that decides 24 of the 100 points is produced outside the reachable workflow, so its sign convention, its consensus and its treatment of an in-line print cannot be checked from this repository.",
        "A release whose effect is already in the price at 05:00 London is not a forecast, and this factor cannot distinguish the two unless the event's timestamp is read and the cutoff move is netted off.",
        "The rulebook's own 72-hour condition is unimplemented, so the deployed factor can score a week-old event as a fresh catalyst."
      ],
      timing: "The event row is read once per collector run, and nothing checks whether the release preceded the cutoff or falls inside the session being forecast.",
      hypothesis_seed: "State at most two program-evaluable claims linking a dated, consensus-measured surprise to the next 24-hour dollar change, each naming the release set, the age window and the sign convention, and say which the deployed stored-string rule most resembles.",
      falsification: "Name the split and the metric on which the deployed 24-point weight on a stored string would be rejected on training sessions only, and say what the result looks like if the factor were replaced by the price move the release caused before the cutoff.",
      gap: "No consensus archive, no first-print vintage, no producer for the usd_signal string inside this repository, and no age test."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-08",
    factor_id: "live.f8-fed-bias",
    order: 8,
    label: "F8 Fed bias",
    group: "live_engine",
    family: "policy_stance",
    role: "direction",
    deployed: true,
    definition: "The stored Fed-bias string, tested for the words hawkish or dovish, read as the direction of policy expectations. The rulebook factor is the change in bias; only the current string is retained, so no change can be measured, and the code tests the absolute state the rulebook says not to trade.",
    inputs: [
      { input: "fed_bias", source: "computed inside the collector by 'Code | Derive USD Eco Inputs' from the last eight completed events of the stored calendar: plus one for a BULLISH usd_signal and minus one for a BEARISH one, doubled when the event's impact rank is three, summed and labelled hawkish at two or more, dovish at minus two or less, neutral otherwise. A second implementation in the same export, 'Code | Derive Fed Bias', would score the same events plus or minus one; that node has no consumer and never runs", units: "categorical string (hawkish | neutral | dovish | unknown)", transform: "substring test for hawkish and for dovish", lookback: "the current string only", cutoff: "no as-of check; the string is recomputed once per collector run from whichever completed events the stored calendar holds" }
    ],
    rule: "A string containing 'hawkish' reads BULLISH, one containing 'dovish' BEARISH, neutral NEUTRAL, 'unknown' is treated as a missing input and scores NEUTRAL. No threshold, no comparison against a prior reading. Coded weight 12 on 24h, 10 on 3d, 12 on current_week, 18 on next_week, 18 on current_month; rulebook weight 18, described there as the highest-weight factor and explicitly a delta.",
    missing_stale: "An absent or 'unknown' string scores NEUTRAL and names the missing input. The two-point cutoff behind the string is a coded constant with no stated calibration, the eight-event window is undocumented, and because only the current string survives, no amount of stored data can show whether the bias changed since the previous session.",
    deps: ["A retained vintage of the bias string, or of the events behind it, so that a change in bias can be measured."],
    overlap: "F7 is built from the same stored event rows and contributes to the same score, F2 and F4 read the same policy path through yields, and F9 uses this string as a gate, so one policy story can carry five factors.",
    hist_avail: "No fed_bias series appears in the closed study's data or in the 22-series macro frame, and the events behind the score are not archived with consensus values, so the factor has no history to test as specified.",
    live_avail: "One string per collector run, no vintage, no stored score as evidence, and no age attached to the events inside it.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F8: BULLISH when the lowercased string includes 'hawkish', BEARISH when it includes 'dovish', NEUTRAL otherwise or when the string is empty or 'unknown' (weight 12 on 24h)",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (fed_bias exposed to the model and listed among the must-be-neutral inputs when unknown)",
      "exports/usd_collector.json -> Normalise Market Snapshot: fedBiasRaw = getNode('Code | Derive USD Eco Inputs'), fedBias = fedBiasRaw?.fed_bias || 'unknown', checkMissing('fed_bias', ...)",
      "exports/usd_collector.json -> Code | Derive Fed Bias (a second, unconnected implementation of the same idea that no node consumes)"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 8 - Fed Bias Delta' (weight 18; BULLISH only when the bias moved more hawkish than the prior reading, BEARISH when it moved more dovish, and 'the market trades the change in Fed bias, not the absolute state')",
      "logic/agent_usd_direction.md section 15 (weight table listing Factor 8 at 18)"
    ],
    status: { research: "blocked", review: "pending", backtest: "not_tested", note: "Coded weight 12 on the 24h timeframe while the rulebook calls it the highest-weight factor at 18; the implemented rule contradicts the rulebook's stated mechanism." },
    blockers: ["No vintage of the bias string is retained, so no change can be measured."],
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 8", quote: "The market trades the change in Fed bias, not the absolute state. This is the highest-weight factor because Fed repricing is usually one of the strongest USD drivers." }
      ],
      questions: [
        "What is the prior reading the rulebook's delta is measured from, and what storage change would make a bias vintage retrievable without touching the live path?",
        "Should policy expectations be read from a categorical string at all, or from a market-implied series such as the front-end of the curve, and how would the two be compared on the same sessions?",
        "Was the two-point hawkish and dovish cutoff of the collector's scoring ever calibrated, and what does the string read on in-line weeks?"
      ],
      counterarguments: [
        "A level-in-disguise test on a hidden score is not the change the rulebook asks for, and with the current storage the deployed rule cannot be made to match the rulebook.",
        "A string recomputed from eight events carries the same events F7 already scores, so the same release can be counted twice at a combined 36 coded points.",
        "The scoring constant, the eight-event window and the impact-rank doubling are undocumented choices that a reader of the published call cannot see."
      ],
      timing: "The string is recomputed once per collector run from completed events, so at 05:00 London it can already include releases from the session being forecast, depending on when the pipeline last ran.",
      hypothesis_seed: "State at most two program-evaluable claims that use a difference in policy expectation, not a state, and that a stored daily vintage could evaluate session by session, naming the series that carries the difference.",
      falsification: "Name the split and the metric on which the deployed absolute-string rule would be rejected on training sessions only, and state what the same test would show for the delta the rulebook describes.",
      gap: "No vintage of the string or of the events behind it; no calibration of the two-point cutoff; the second implementation of the factor is orphaned."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-09",
    factor_id: "live.f9-dollar-smile",
    order: 9,
    label: "F9 Dollar Smile regime",
    group: "live_engine",
    family: "risk_regime",
    role: "regime context",
    deployed: true,
    definition: "The Dollar Smile read of the regime: the dollar is expected to be bid at the two extremes of the smile and offered in the middle, so the deployed rule looks for a high-volatility regime or for a calm regime whose bias string is not hawkish. The rulebook's bullish left side, US growth outperforming global growth with a hawkish Fed, has no input in the code.",
    inputs: [
      { input: "vix_level, fed_bias", source: "FRED VIXCLS through the collector's vix_level field and the collector-derived fed_bias string", units: "index level and categorical string", transform: "level comparisons at 25 and 16 plus a substring test for hawkish", lookback: "levels only; no change in VIX and no change in bias is read, although the rulebook lists vix_d1 and vix_d5", cutoff: "inherits both inputs: VIXCLS is a market-close series and the bias string is recomputed once per collector run" }
    ],
    rule: "VIX above 25 reads BULLISH; VIX below 16 while the bias string does not contain 'hawkish' reads BEARISH; every other case NEUTRAL. Coded weight 1 on 24h, 3 on 3d, 5 on current_week, 10 on next_week, 10 on current_month; rulebook weight 12.",
    missing_stale: "A missing VIX level returns NEUTRAL with the evidence string 'No clear Dollar Smile edge', which is the same answer the factor gives whenever VIX sits between 16 and 25 or the bias string is unknown, so a missing input and an uninformative regime are indistinguishable in the payload. The rulebook's permission to score NEUTRAL to avoid double-counting F1 is not implemented as a test.",
    deps: ["A verified publication time for VIXCLS, a retained vintage of the bias string, and a growth measure for the smile's left side."],
    overlap: "F1 applies the same 25 and 16 thresholds to the same VIX level, F10 gates on them again, and F8 reads the same bias string, so this factor adds only the 'not hawkish' test on top of F1 on the timeframe where both are scored.",
    hist_avail: "VIXCLS is reachable from 2023-04-03 in the closed study's cache and from 2024-01-02 in the 22-series macro frame, but the second condition needs a bias history that is not committed and the left side needs a growth series the collector never stores, so at most the high-volatility arm can be reconstructed.",
    live_avail: "Both inputs are read once per collector run with no per-field age and no stored regime label.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F9: BULLISH when vix_level > 25, BEARISH when vix_level < 16 and the bias string does not include 'hawkish', else NEUTRAL (weight 1 on 24h)",
      "exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 and fed_bias exposed to the model)",
      "exports/usd_collector.json -> Normalise Market Snapshot: equities_regime is stored from the same 16 and 25 thresholds but no conviction factor reads it"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 9 - Dollar Smile Regime' (weight 12; BULLISH on VIX above 25 or an active crisis, BULLISH on US growth outperforming global growth with a hawkish Fed, BEARISH on moderate US growth with decent global growth; the section instructs 'Avoid double-counting Factor 1' and permits NEUTRAL when Factor 1 already carries the whole risk signal)"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline; the coded weight of 1 on the 24h timeframe makes the smile's separate content nearly invisible in the published number." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 9", quote: "VIX > 25 or active crisis BULLISH; US growth outperforming global growth with hawkish Fed BULLISH; US growth moderate and global growth decent BEARISH; insufficient regime evidence NEUTRAL. Avoid double-counting Factor 1." }
      ],
      questions: [
        "Does the smile hold as a regime description on a 24-hour window, and which of its three arms is actually testable with data this repository can reach?",
        "If the smile's middle is defined by moderate US growth against decent global growth, which growth measures should represent the two sides, and how do they avoid becoming a second reading of F1?",
        "Should F9 abstain whenever F1 already carries the risk signal, as the rulebook permits, and does that abstention change the published direction or only the strength label?"
      ],
      counterarguments: [
        "The implemented BEARISH arm, calm VIX and a bias string that is not hawkish, is not the middle of the smile the rulebook describes, so the deployed factor is a different rule wearing the smile's name.",
        "With F1 reading the same thresholds at weight 10 and this factor at weight 1 on the 24h timeframe, the factor's marginal contribution to the published number is a rounding step.",
        "The left side of the smile, US exceptionalism, has no input at all, so the rulebook's second bullish arm cannot be implemented from the collector as it stands."
      ],
      timing: "The regime is read from a market-close VIX level and a string recomputed once per collector run, so the label can describe the previous US close rather than the London morning being traded.",
      hypothesis_seed: "State at most two program-evaluable claims about the dollar's behaviour at the extremes of the smile versus its middle, each naming the regime proxy, the window and how double-counting with F1 is removed.",
      falsification: "Name the split and the metric on which the deployed calm-VIX-and-not-hawkish arm would be rejected on training sessions only, and state what the same test shows for a factor that abstains whenever F1 is active.",
      gap: "No growth measure for the smile's left side, no bias vintage, no published calibration for the 25 and 16 thresholds."
    }
  },
  {
    task_id: "USD-BASELINE-AUDIT-10",
    factor_id: "live.f10-equity-versus-usd",
    order: 10,
    label: "F10 Equity versus USD",
    group: "live_engine",
    family: "cross_asset_appetite",
    role: "regime context",
    deployed: true,
    definition: "The cross-asset read of equities against the dollar, gated by the same VIX regime: in calm markets a rising equity market is read as dollar-negative and a falling one as dollar-positive, and in stressed markets a falling equity market is read as dollar-positive. The rulebook's neutral-regime row, equities moving inside 16 to 25, is unhandled in code and falls into the same NEUTRAL branch as a missing input.",
    inputs: [
      { input: "nq_d1_pct on 24h, else nq_d5_pct, and vix_level", source: "Alpha Vantage GLOBAL_QUOTE on QQQ for the price; the one-day change is the vendor's own change-percent field and the five-day change is computed by historyPct against the collector's stored rows; VIXCLS for the gate", units: "per cent change and index level", transform: "sign of the equity change inside a VIX regime; the 24h arm prefers nq_d1_pct and falls back to nq_d5_pct when absent", lookback: "one day on 24h; five stored rows on every other timeframe", cutoff: "the quote is read at the pipeline run time and the daily change is the vendor's figure, not a change measured between the cutoff and the session end" }
    ],
    rule: "VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH; every other combination NEUTRAL. No percentage threshold; only the sign of the change is read. Coded weight 1 at every timeframe; rulebook weight 2.",
    missing_stale: "A missing NQ change or a missing VIX level returns NEUTRAL with the evidence string 'Missing NQ/VIX'. The unhandled combinations, VIX above 25 with NQ up and the whole 16-to-25 band, also read NEUTRAL, and the payload does not distinguish an unhandled regime from absent data.",
    deps: ["An equity series whose change is measured against the cutoff rather than supplied by a vendor, and a decision on whether the factor should use the index or the ETF."],
    overlap: "F1 and F9 apply the same 25 and 16 thresholds, F6 reads the same risk appetite through gold, and the factor is the risk-appetite leg of the story F9's smile is built on.",
    hist_avail: "FRED NASDAQ100 is in the 22-series macro frame from 2024-01-02, but the live factor prices QQQ through Alpha Vantage, so the reconstructable series is not the collected one, and the vendor's change-percent field cannot be reproduced from a cached frame.",
    live_avail: "One row per collector run: the five-day arm counts stored rows and the one-day arm is the vendor's figure, with no age attached to either and no regime label stored alongside the call.",
    code_refs: [
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F10: BEARISH when vix_level < 16 and the NQ change is positive, BULLISH when vix_level < 16 and it is negative, BULLISH when vix_level > 25 and it is negative, else NEUTRAL (weight 1 at every timeframe)",
      "exports/usd_layer1_agent.json -> Calculate USD Conviction, nqDelta = nq_d1_pct on 24h when present, else nq_d5_pct",
      "exports/usd_collector.json -> Normalise Market Snapshot: nq = alphaQuote(getNode('HTTP Request | NQ - Alpha Vantage')), nqD5Pct = historyPct(nq.price, 'nq_price', 4), nqD20Pct = historyPct(nq.price, 'nq_price', 19); equities_regime is stored from the VIX thresholds and read by no factor"
    ],
    book_refs: [
      "logic/agent_usd_direction.md section 5, 'Factor 10 - Equity Direction vs USD Correlation Regime' (weight 2; risk-on with VIX below 16 and equities rising BEARISH, falling BULLISH, risk-off with VIX above 25 and equities falling BULLISH, neutral regime NEUTRAL, input missing NEUTRAL with a missing-input note; 'The USD/equity relationship changes by regime' and 'Do not force this factor unless the regime is clear')"
    ],
    status: { research: "ready", review: "pending", backtest: "not_tested", note: "Deployed baseline; a one-point weight on every timeframe, on an ETF quote rather than the index." },
    pack: {
      excerpts: [
        { path: "logic/agent_usd_direction.md", lines: "section 5, Factor 10", quote: "The USD/equity relationship changes by regime. Do not force this factor unless the regime is clear." }
      ],
      questions: [
        "Which equity instrument belongs in this factor, the index or the liquid ETF the collector actually prices, and does the choice change the sign inside the calm regime?",
        "Does a same-day equity change say anything about the next 24 hours once the dollar move that accompanied it is already in the cutoff prices, and how would that be separated without hindsight?",
        "What should the factor return in the 16-to-25 band and when equities are up while VIX is above 25, given that the rulebook's neutral row and the code's default agree only by accident?"
      ],
      counterarguments: [
        "Counting stored collector rows for the five-day window makes the factor's history depend on the pipeline's own run history rather than on a trading calendar.",
        "The risk-appetite signal is already carried by F1 and F9 through the same thresholds, so within calm markets the factor mostly restates F1 with the opposite sign convention.",
        "The QQQ proxy is an ETF with its own tracking, hours and dividend effects, described in the rulebook as NQ, the index it is not."
      ],
      timing: "The vendor quote is read at the pipeline run time and its one-day change is the vendor's own field, so the factor can describe a move that ended before the cutoff and can restate it again during the session.",
      hypothesis_seed: "State at most two program-evaluable claims about the sign of the equity-dollar relation by regime, each naming the instrument, the cutoff-to-cutoff change measure and the regime proxy, and say which the deployed sign-only rule most resembles.",
      falsification: "Name the split and the metric on which the deployed sign-only rule inside the calm regime would be rejected on training sessions only, and state the result for a rule that abstains in the 16-to-25 band.",
      gap: "No index-level equity series traced in the live input, no cutoff-to-cutoff change measure, no decision on the neutral band."
    }
  }
];

// ---------------------------------------------------------------------------
// The fifteen session-research factors the committed catalogue carries. Each one is an assignment, not a
// baseline: no rule is in force for any of them, so its pack asks the question rather than auditing an
// answer. Every fact about what the system currently does is extracted from the artefacts named in section
// 5 of the pack, and every data statement is repeated from the shared availability block so that a pack can
// be read on its own.
//
// The catalogue stays the authority for a factor's id, label, role and status: the builder refuses to write
// unless these entries cover the catalogue's non-live factors exactly and agree with each row.
// ---------------------------------------------------------------------------

const SESSION_FACTOR_BRIEFS = [
  {
    factor_id: "fx.usd-session-momentum",
    card_family: "usd_price_behaviour",
    context:
      "The trailing move in the label instrument at the cutoff, read as continuation or fade inside the " +
      "session that follows: the change over the previous day and over the previous five days, taken from " +
      "the series the label is priced from.",
    questions: [
      "Does the trailing move of the label instrument carry information about the next 05:00-to-05:00 session, and does the answer survive the trailing window ending before the previous US close?",
      "Is the relation continuation or fade, and does the answer change with the trailing window (one day against five) or with the volatility regime of the instrument?",
      "Which part of the trailing move is a reaction already in the price at the cutoff, and which part, if any, is still predictive over the following 24 hours?"
    ],
    counterarguments: [
      "A one-day trailing move built from daily values is not the same object as the session's own cutoff-to-cutoff change, and the two can carry opposite signs on the same day.",
      "Momentum is the weakest claim available on a 24-hour horizon: the evidence said to support continuation is what a mean-reversion reading would use for the opposite sign.",
      "With no verified intraday label print, the trailing move can only be built from a daily series that updates after the cutoff, so the window the card names may not exist at 05:00."
    ],
    timing: "Acts from the cutoff, and if it acts at all it is the first thing to be absorbed, because a trailing move is public information.",
    overlap: "Shares its entire input with the overnight range position card, and with every other price-based card.",
    data_asks: "One daily series for the label instrument with its publication time, plus any intraday source and the time at which it prints; state which series is used at each end of the session.",
    hypothesis_seed: "State at most two program-evaluable versions of the continuation claim, each naming the trailing window, the direction test and the regime it assumes.",
    falsification: "Name the split and the metric on which the continuation sign would be rejected on training sessions only, and say what the fade version would have to show before it replaced it.",
    gap: "The label instrument and its quote source are undecided, so the trailing window has no defined series yet."
  },
  {
    factor_id: "fx.usd-overnight-range-position",
    card_family: "usd_price_behaviour",
    context:
      "Where the label instrument sits inside its own recent range at the cutoff, read as a bound on the " +
      "session's move rather than as a direction: the position is a ratio, so it states how much room is " +
      "left before the recent range is exceeded, not where the next 24 hours will end.",
    questions: [
      "Does the position of the label instrument inside its recent range at the cutoff say anything about the direction of the next London-to-London session, or only about the size of its move?",
      "Which range is the right one (five days, twenty days, the previous session), and does the answer survive a change of window?",
      "Is this information already carried by the trailing-move card, given that both are built from the same closes?"
    ],
    counterarguments: [
      "A range position is a rescaled price level: on a 24-hour window it may behave as a rebound measure rather than as information about direction.",
      "The range is defined by the same series that defines the label, so one error in that series moves both sides of any test.",
      "Because no verified intraday print exists, the range can only be assembled from daily values that update after the cutoff, which is the objection the momentum card already carries."
    ],
    timing: "Read at the cutoff; if it carries anything it is a bound on the session rather than a trigger inside it.",
    overlap: "Shares its entire input with the momentum card, so a rule using both is likely to weight one idea twice.",
    data_asks: "Daily history for the label instrument long enough for the chosen window, and a stated rule for what happens when the endpoint print is missing.",
    hypothesis_seed: "State at most two program-evaluable claims about range position and the next session, one about direction and one about the size of the move, each with its window and its parameter rule.",
    falsification: "Name the metric and the split on which the direction claim would be rejected, and the result that would show the card carries only a size bound.",
    gap: "No label instrument, no decision on the window, and no separate treatment of a missing endpoint print."
  },
  {
    factor_id: "fx.usd-session-volatility-regime",
    card_family: "usd_price_behaviour",
    context:
      "Realised volatility of the label instrument at the cutoff, read first as an abstention gate: in some " +
      "regimes a directional call of the required size cannot be justified from the data, and the honest " +
      "return for the session is to withhold rather than to publish a weak call.",
    questions: [
      "Which realised-volatility measure, on which window, separates the sessions in which a directional call was justified from those in which it was not?",
      "Does the volatility regime change the sign or the size of the other factors' relation, and if it changes the size, by how much before the relation stops being usable?",
      "What is the exact rule that turns the measure into an abstention, stated so that it can be computed at the cutoff and evaluated on training sessions only?"
    ],
    counterarguments: [
      "A gate that removes the hardest sessions flatters every other factor's measured behaviour, so it has to be judged on what it removes as well as on what it keeps.",
      "Volatility measured from daily values lags the regime it is meant to describe, so the measure may be classifying yesterday's state.",
      "The gate is only meaningful once a flat band and a minimum effect exist, and neither has been frozen."
    ],
    timing: "Read at the cutoff; it decides whether the session is scored at all rather than what the call is.",
    overlap: "Overlaps the data-quality gate: two gates that fire on the same sessions must be one rule, not two.",
    data_asks: "Daily history of the label instrument long enough for the chosen window, with the missing-print rule, and a statement of whether any intraday source exists.",
    hypothesis_seed: "State at most two program-evaluable abstention rules, each naming the measure, the window, the cut and the sessions it removes.",
    falsification: "Name the split and the metric on which the gate would be rejected, including what the other cards look like once the gate is removed.",
    gap: "No frozen flat band, no minimum effect, and no label instrument."
  },
  {
    factor_id: "risk.vix-level-and-change-at-cutoff",
    card_family: "risk_conditions",
    context:
      "The VIX level and its change at the cutoff read as risk regime rather than as a direction of its own. " +
      "The deployed rulebook describes one-day and five-day modifiers on top of the level; the executing " +
      "code reads the level only, so the card has to say which of the two it is testing.",
    questions: [
      "Does the VIX level at the cutoff carry information about the next London-to-London session once the change over one day and over five days is known?",
      "Are the documented 16 and 25 bands the right cuts on this horizon, and what do the same data say about a rule that abstains inside the middle band?",
      "Is the VIX a regime card, as deployed, or does it carry a direction of its own once the change term is included?"
    ],
    counterarguments: [
      "The deployed bands are asserted with no provenance, and the middle band is where most observations sit, so a level rule may carry little on the sessions that matter.",
      "The VIX is itself an equity-volatility measure: reading it as a dollar regime double-counts the cross-asset card if both are used.",
      "A VIX change measured from daily values updates after the cutoff and describes a move that is already in the price."
    ],
    timing: "Read at the cutoff; any change term ends before the previous US close.",
    overlap: "Overlaps the cross-asset risk state card and the volatility-regime gate: the three can restate one risk reading.",
    data_asks: "The VIX series with its publication time and revision behaviour, and enough history to place the 16 and 25 bands in context.",
    hypothesis_seed: "State at most two program-evaluable claims: one for the level as a regime with the bands as parameters, and one for the change as a separate term.",
    falsification: "Name the split and the metric on which the deployed bands would be rejected, and the result that would show the card adds nothing to the cross-asset card.",
    gap: "No vintage and no first print, no evidence for either band, and no measured overlap with the cross-asset card."
  },
  {
    factor_id: "risk.risk-on-off-cross-asset-state",
    card_family: "cross_assets",
    context:
      "Equities, credit, gold and crypto at the cutoff read as one risk state, with the double count against " +
      "the VIX card and the dollar's two possible roles (insurance and carry) named explicitly rather than " +
      "left implicit in a single sign.",
    questions: [
      "Which combination of equities, credit, gold and crypto at the cutoff, if any, separates the sessions in which the dollar rose from the sessions in which it fell?",
      "Does the dollar trade as a risk-off asset, as a carry asset, or does the answer depend on which asset is leading the move?",
      "How much of this card is already in the VIX card, and what does it add that the VIX level does not already carry?"
    ],
    counterarguments: [
      "Four assets read at one cutoff can be combined in many ways, and with 24-hour sessions the number of ways grows faster than the information they carry.",
      "Gold and crypto are quoted by different sources with different hours, so a combined risk state compares readings that are not simultaneous.",
      "If the state is built from changes measured to the previous close, it describes the session that has just ended rather than the one being predicted."
    ],
    timing: "Read at the cutoff from sources with different hours, at least one of which is a vendor quote taken at an unverified moment.",
    overlap: "The largest overlap in the set: the VIX card, the credit-spread card and the safe-haven card all read parts of one state.",
    data_asks: "Named series and quotes for each asset, the publication or quote time of each, and the history available for each; where a series is not observable at the cutoff, say so.",
    hypothesis_seed: "State at most two program-evaluable versions of the risk-state claim, each naming its assets, its combine rule and the regime it assumes.",
    falsification: "Name the split and the metric on which the combined state would be rejected, and the result that would show the VIX card alone already carries it.",
    gap: "Prices for the different assets come from sources with different hours, and no index-level equity series is traced in the live input."
  },
  {
    factor_id: "risk.usd-safe-haven-demand",
    card_family: "cross_assets",
    context:
      "Whether the dollar is being bought as insurance rather than for carry on the day in question, which " +
      "reverses the sign of the same risk move: the factor is about which of the dollar's two roles is " +
      "operating, not about the risk move itself.",
    questions: [
      "Is there an observable at the cutoff that distinguishes insurance demand for the dollar from carry demand, without using the session's own outcome?",
      "Does the sign of the dollar's response to a risk move depend on that distinction, and can the distinction be tested session by session?",
      "Which existing quantity could serve as the observable (funding, the shape of the front end, gold, the VIX term structure), and what would have to be true for it to be admissible?"
    ],
    counterarguments: [
      "Insurance demand is usually identified after the fact, from the direction the dollar took, which is the label itself.",
      "Any proxy fitted on both sides of the same session reintroduces hindsight.",
      "The distinction may be unobservable at a 05:00 cutoff with the sources that exist, in which case a return saying so is the correct answer."
    ],
    timing: "Must act at the cutoff; the card's whole difficulty is that insurance demand may only be visible during the session.",
    overlap: "Shares the cross-asset state, and would double-count it if both are used without a stated separation rule.",
    data_asks: "Name the candidate observables and each one's publication time, and state plainly which are unavailable at the cutoff.",
    hypothesis_seed: "State at most two program-evaluable versions of the insurance claim, each naming its observable and the moment at which it is read.",
    falsification: "Name the test that would show the distinction is unobservable at the cutoff rather than merely hard, and the metric on which the sign-flip claim would be rejected.",
    gap: "No candidate observable has been shown to exist at the cutoff, so a negative answer is a legitimate return."
  },
  {
    factor_id: "data.quality-gate-for-abstention",
    card_family: "data_quality",
    context:
      "Which data states should force an abstention instead of a weak call. The live collector keeps no " +
      "as-of check and no staleness test, and a missing input currently moves to the neutral pile rather " +
      "than stopping the call, so the gate has to be defined before it can be applied.",
    questions: [
      "Which per-input conditions (age, revision state, a missing endpoint, a source that did not update) can be detected at the cutoff, and which cannot?",
      "What is the smallest set of conditions that should withhold a call, and what does withholding cost in coverage terms?",
      "The proposed missing-quote policy drops a session whose start or endpoint print is missing and counts it as a data exclusion rather than an abstention: what would have to be shown for a stated bound to beat the drop, and how would that be tested without letting an exclusion be scored as a call?"
    ],
    counterarguments: [
      "A gate that removes sessions with stale data is a filter fitted to the sources available today and may not survive a source change.",
      "Because the deployed pipeline records no per-field age, any gate built now has to name the age itself, which names a fact the collector does not store.",
      "Withholding is a return too, and a gate that is never exercised is not yet a rule."
    ],
    timing: "Computed at the cutoff from the state of each input, before any factor is scored.",
    overlap: "Overlaps the volatility-regime gate: two gates that fire on the same sessions must be one rule, not two.",
    data_asks: "For every input named by the other cards, its publication time, its expected refresh, and whether a missing value can be told apart from an unchanged one.",
    hypothesis_seed: "State at most two program-evaluable gate rules, each naming the condition, the check and the sessions it removes.",
    falsification: "Name the metric on which the gate would be rejected, including its effect on coverage and on the other cards' measured behaviour.",
    gap: "The deployed collector stores no as-of check and no per-field age, so the gate rests on state the pipeline does not yet record."
  },
  {
    factor_id: "rates.us-front-end-delta",
    card_family: "rates_and_policy_expectations",
    context:
      "Two-year and three-month US yields and their changes as policy-expectation proxies, with the " +
      "publication lag of each series stated rather than assumed, because the change a cutoff sees ended " +
      "before the previous US close.",
    questions: [
      "Does a front-end yield change carry information about the next London-to-London session, and does the answer differ between the two-year and the three-month series?",
      "Is the level of the front end or its change the informative object on this horizon?",
      "How much of a change measured to the previous close is already in the price by the cutoff?"
    ],
    counterarguments: [
      "Both series publish with a lag, so the change visible at the cutoff is one that ended before the previous US close.",
      "The policy path is one idea: a front-end change and a real-yield change are two readings of the same news and can be counted twice.",
      "A change measured from daily values is not the same object as the reaction to a single release."
    ],
    timing: "Read at the cutoff from values published one to two business days earlier.",
    overlap: "Contains the same series as the relative front-end card's US leg, and shares the nominal news with the real-yield card.",
    data_asks: "Both yield series with their publication times, their revision behaviour and the history available for each.",
    hypothesis_seed: "State at most two program-evaluable claims, one for each series, each naming the window, the sign and the lag it assumes.",
    falsification: "Name the split and the metric on which a five-business-day change and a five-basis-point threshold would be rejected on training sessions only.",
    gap: "No vintage and no first print, and a publication lag that makes the value the cutoff sees older than the window it describes."
  },
  {
    factor_id: "rates.relative-front-end-delta",
    card_family: "rates_and_policy_expectations",
    context:
      "The US front end against the German and other available G10 front ends, with each foreign leg named " +
      "rather than implied: a relative rate is only as good as the foreign series behind it, and a spread " +
      "built from calendars that differ can compare two different as-of dates.",
    questions: [
      "Does the US-minus-foreign front-end spread change carry more information about the dollar than the US front end alone?",
      "Is the foreign leg genuinely observable at the cutoff, and at what lag does its source publish?",
      "Which foreign legs can be named with a real series, and what does the card do where one cannot be named?"
    ],
    counterarguments: [
      "A spread built from two series with different publication calendars can compare two different as-of dates.",
      "When both legs move together the spread degenerates towards the US-only card with added noise.",
      "Only one foreign front end is reachable today, so the card's breadth depends on sources that may not exist."
    ],
    timing: "Read at the cutoff, with each leg's age set by its own source's lag.",
    overlap: "Contains the US-only card by construction, so weighting both counts one idea twice.",
    data_asks: "For each named foreign leg, the series, its source, its publication time and its licensing position; state where a leg is unavailable rather than substituting a proxy.",
    hypothesis_seed: "State at most two program-evaluable spread claims, each naming both legs, the window and the sign.",
    falsification: "Name the split and the metric on which the spread would be rejected, including its comparison against the US-only card.",
    gap: "Only one foreign front end is reachable, and neither its publication schedule nor its licensing has been settled."
  },
  {
    factor_id: "rates.real-yield-delta",
    card_family: "rates_and_policy_expectations",
    context:
      "Ten-year and five-year real yields and the breakeven split, separating the nominal part of a move " +
      "from the inflation part, because the two have different implications for the dollar and only one of " +
      "them has to do with the real cost of money.",
    questions: [
      "Does a real-yield change carry a dollar sign on a 24-hour window, and does the sign survive when the move comes from breakevens rather than from real rates?",
      "Is a real-yield change a forecast at the cutoff, or a description of a move the previous close already priced?",
      "Which series should represent the real yield (a TIPS yield, a fitted curve, a survey measure) given the release lag and revision behaviour actually available?"
    ],
    counterarguments: [
      "Real yields, gold and the dollar are three readings of one complex and can move together, so the card can add weight to a story that is already carried.",
      "Breakevens are a difference of two published series and inherit both lags.",
      "The real yield moves less than the noise in the daily series, so a five-basis-point threshold may be measuring the threshold rather than the world."
    ],
    timing: "Read at the cutoff from values one to two business days old.",
    overlap: "Shares the nominal ten-year news with the curve card and is the rate-side twin of the gold reading in the cross-asset state.",
    data_asks: "The real-yield, nominal and breakeven series with their publication times, their revision behaviour and the history available for each.",
    hypothesis_seed: "State at most two program-evaluable claims, one for the real part of the move and one for the breakeven part.",
    falsification: "Name the split and the metric on which a five-business-day real-yield change with a five-basis-point threshold would be rejected on training sessions only.",
    gap: "No vintage and no first print, and no separation of the two legs that can be computed at the cutoff without lags."
  },
  {
    factor_id: "rates.term-premium-and-curve",
    card_family: "rates_and_policy_expectations",
    context:
      "The ten-year minus two-year slope and whether its level or its change carries information across the " +
      "session, read as a regime that conditions the other cards rather than as a direction of its own.",
    questions: [
      "Does the curve's level or its change carry information about the dollar over the next 24 hours, and which of the two survives a change of window?",
      "Is the curve a regime that conditions the other cards, or does it carry a direction of its own?",
      "Where a term-premium measure is unavailable, does the slope say anything the front-end card does not already say?"
    ],
    counterarguments: [
      "The slope is a difference of two series used elsewhere in the set, so it can restate the front-end card with the sign reversed.",
      "A curve change measured from daily values updates after the cutoff.",
      "Term premium is usually a model output rather than an observed series, so using one would hide a modelling assumption inside the factor."
    ],
    timing: "Read at the cutoff from values one to two business days old.",
    overlap: "Built from the ten-year and two-year series the front-end and real-yield cards already use.",
    data_asks: "The two yield series with their publication times and, if a term-premium measure is proposed, its source, its model and its availability.",
    hypothesis_seed: "State at most two program-evaluable claims, one for the level and one for the change, each with its regime reading declared.",
    falsification: "Name the split and the metric on which the level or the change would be rejected, and the comparison against the front-end card.",
    gap: "No term-premium measure is reachable today, and the slope duplicates series other cards already use."
  },
  {
    factor_id: "rates.credit-spread-delta",
    card_family: "rates_and_policy_expectations",
    context:
      "High-yield spread change as a growth and risk proxy, with its overlap against the cross-asset risk " +
      "card bounded rather than assumed away: a credit spread, equities and the VIX can be three readings " +
      "of one state.",
    questions: [
      "Does a high-yield spread change at the cutoff carry information about the dollar over the next session, over and above the cross-asset risk state?",
      "Is the spread change a risk-appetite measure or a growth measure on this horizon, and does the interpretation change the sign?",
      "Is a credit spread observable at the cutoff with the sources in hand, and at what lag?"
    ],
    counterarguments: [
      "Credit spreads, equities and the VIX are one risk complex, so three readings of it can be counted as three independent factors.",
      "Spread changes are small and the series publish with a lag, so the measured change can describe a period that ended before the previous close.",
      "A risk proxy whose sign depends on whether the move is driven by growth or by funding is not usable as a single factor."
    ],
    timing: "Read at the cutoff from a series that publishes with a lag.",
    overlap: "Overlaps the cross-asset risk state and the VIX card, and the three must be bounded against each other before any weight is considered.",
    data_asks: "The spread series, its source, its publication time and its history, plus the comparison series it is to be tested against.",
    hypothesis_seed: "State at most two program-evaluable claims, each naming the spread, the window and the risk interpretation it assumes.",
    falsification: "Name the split and the metric on which the spread change would be rejected, tested against the cross-asset card rather than alone.",
    gap: "The overlap with the cross-asset card is unmeasured, and the series' availability at the cutoff is unverified."
  },
  {
    factor_id: "calendar.known-releases-between-cutoff-and-endpoint",
    card_family: "calendar_context",
    context:
      "Which releases are scheduled between the cutoff and the endpoint, and how a known-but-unreleased " +
      "event may be used without using its outcome: the factor is a quality gate on the session, since the " +
      "schedule is known at 05:00 and the release itself is not.",
    questions: [
      "Does the presence of a scheduled high-impact release inside the window change the dollar's behaviour in the sessions around it, using only what was known at the cutoff?",
      "Which scheduled events should force a session to be excluded, and which should only be flagged?",
      "Can a scheduled event be used as a state at the cutoff without its outcome ever entering the calculation?"
    ],
    counterarguments: [
      "A paid external calendar is a dependency: if the feed fails, the gate silently stops firing.",
      "Excluding sessions with high-impact releases removes exactly the sessions in which a directional call matters most.",
      "The scheduled time alone is weak information, because most of the effect usually belongs to the release itself, which may not be used."
    ],
    timing: "Known at the cutoff and constant through the session; it flags or excludes rather than predicts.",
    overlap: "Overlaps the distance-from-events card and the data-quality gate.",
    data_asks: "The release calendar with the times it records, and a statement of whether the schedule itself existed at the cutoff.",
    hypothesis_seed: "State at most two program-evaluable gate rules, each naming the event class, the window check and the action taken.",
    falsification: "Name the metric on which the gate would be rejected, including the coverage it removes and the effect on the sessions it keeps.",
    gap: "The calendar is a paid external feed that is not fully inventoried here, and its failure mode is untested."
  },
  {
    factor_id: "calendar.days-since-and-until-high-impact-events",
    card_family: "calendar_context",
    context:
      "Positioning measured as distance from known high-impact dates, using only the release calendar and " +
      "never the surprise: the factor asks whether proximity to a scheduled event changes the dollar's " +
      "behaviour over the session that follows.",
    questions: [
      "Does the number of days since, or until, a high-impact release change the dollar's behaviour over the next session?",
      "Is the effect a regime that conditions the other cards, or does it carry a direction of its own?",
      "Which event classes belong in the distance measure, and how is that choice kept from becoming a fitted parameter?"
    ],
    counterarguments: [
      "With few high-impact events per quarter the distance measure changes slowly and may be indistinguishable from a slow-moving trend.",
      "The choice of which events count is itself a parameter, and with a small sample the choice can drive the result.",
      "This card and the known-releases gate read the same calendar and can restate one another."
    ],
    timing: "Known at the cutoff and constant through the session.",
    overlap: "Shares the calendar input with the known-releases gate.",
    data_asks: "The same calendar with its recorded times, plus a stated rule for how event classes are selected before any test is run.",
    hypothesis_seed: "State at most two program-evaluable claims, each naming the event classes, the distance measure and the window.",
    falsification: "Name the split and the metric on which the distance measure would be rejected, with the event-class rule fixed before the test.",
    gap: "No predeclared event-class rule and no settled calendar source."
  },
  {
    factor_id: "macro.release-surprise-at-first-print",
    card_family: "macroeconomic_releases",
    context:
      "The first-print surprise of a release, measured against the consensus that was published before it. " +
      "This is the honest test of the deployed engine's highest-weight family, which reads a pre-computed " +
      "signal with no consensus, no first print and no age, so the audit cannot treat that signal as a " +
      "baseline.",
    questions: [
      "Is the consensus that was published before a release reachable with a timestamp, and if it is not, what does that cost the family?",
      "Where a first print and a consensus do exist, does the surprise carry information about the dollar over the following London-to-London session?",
      "How much of the reaction to a release is already in the price by the cutoff, given that the release itself usually sits inside the previous session?"
    ],
    counterarguments: [
      "First prints are revised routinely and a vintage that keeps the first print is a paid product; without it the card can only be built from the latest version, which is hindsight.",
      "The deployed engine's treatment of this family is a pre-computed signal with no consensus and no age, so there is no honest baseline to compare against.",
      "Releases are few, so a card of this kind is the most likely in the set to be fitted to a handful of observations."
    ],
    timing: "Only a release published before the cutoff may be used; anything published after it is a reaction belonging to the session being predicted.",
    overlap: "Overlaps the front-end and real-yield cards, which react to the same releases.",
    data_asks: "A consensus source with a publication timestamp, a first-print vintage, and the release calendar with the times it records; state plainly if any of the three is unreachable.",
    hypothesis_seed: "State at most two program-evaluable claims, each naming the release class, the surprise measure and the inclusion rule, or state that no such claim can be tested with the data available.",
    falsification: "Name the split and the metric on which the surprise claim would be rejected on training sessions only, and what the card returns if no consensus source exists.",
    gap: "No consensus and no first-print vintage are reachable from this repository: the vintage CSV needs a key and the live calendar feed stores no consensus snapshot. The card is blocked on data access, not on effort, and a return saying so is the expected answer."
  }
];

// ---------------------------------------------------------------------------
// Provenance. Every factor the register carries already exists in the committed
// Research Library catalogue, so the builder reads that catalogue and refuses to
// write unless the two agree. Nothing here is a second source of truth for a
// factor's id, label, role, status or weight.
// ---------------------------------------------------------------------------

const CATALOG_PATH = "data/research-library/catalog.json";
const REGISTER_JSON_PATH = `${OUT_DIR}/USD_FACTOR_REGISTER.json`;
const REGISTER_MD_PATH = `${OUT_DIR}/USD_FACTOR_REGISTER.md`;
const TEMPLATE_PATH = `${OUT_DIR}/RESEARCH_OUTPUT_TEMPLATE.md`;
const CARD_SCHEMA_PATH = `${OUT_DIR}/research_card.schema.json`;
const CARD_SCHEMA_BASE_PATH = "docs/research/usd-session/v1/research-card.schema.json";
const MANIFEST_PATH = `${OUT_DIR}/HANDOFF_MANIFEST.json`;
const TRACKER_PATH = `${OUT_DIR}/tracker_tasks.json`;
const START_HERE_PATH = `${OUT_DIR}/START_HERE.md`;
const BRIEF_INDEX_PATH = `${OUT_DIR}/BRIEF_INDEX.json`;
const ZIP_PATH = `${OUT_DIR}/usd-research-handoff-v1.zip`;
const PILOT_DIR = `${OUT_DIR}/pilot`;
const PILOT_START_HERE_PATH = `${PILOT_DIR}/VIX_PILOT_START_HERE.md`;
const PILOT_ZIP_PATH = `${PILOT_DIR}/usd-vix-pilot-v1.zip`;
const PILOT_ZIP_ROOT = "usd-vix-pilot-v1";
const PILOT_VERSION = "1.0.0";
const PILOT_FACTOR_ID = "live.f1-vix-level";
// ---------------------------------------------------------------------------
// The deep-research tier: the primary deliverable of this handoff and the three steps that follow it.
// It is versioned on its own, so correcting the programme does not move the bytes of the packs
// (pack version 2.0.0), of the dispatched pilot package (package 1.0.0) or of the twenty-five briefs.
// ---------------------------------------------------------------------------
const DEEP_RESEARCH_DIR = `${OUT_DIR}/deep-research`;
const DEEP_RESEARCH_VERSION = "1.0.0";
const DEEP_RESEARCH_START_HERE_PATH = `${DEEP_RESEARCH_DIR}/START_HERE.md`;
const REPORT_BRIEF_PATH = `${DEEP_RESEARCH_DIR}/VIX_COMPREHENSIVE_REPORT_BRIEF.md`;
const NEUTRAL_CONTEXT_PACK_PATH = `${DEEP_RESEARCH_DIR}/CONTEXT_PACK_NEUTRAL.md`;
const RED_TEAM_BRIEF_PATH = `${DEEP_RESEARCH_DIR}/RED_TEAM_REVIEW_BRIEF.md`;
const SYNTHESIS_BRIEF_PATH = `${DEEP_RESEARCH_DIR}/SYNTHESIS_AND_CARDS_BRIEF.md`;
const BACKTEST_BRIEF_PATH = `${DEEP_RESEARCH_DIR}/BACKTEST_HANDOFF_BRIEF.md`;
const SESSION_CONTRACT_PATH = "docs/research/usd-session/v1/session_contract_v1.json";

const PRIMARY_DELIVERABLE =
  "A comprehensive, source-backed report investigating how VIX - its level, its change and its " +
  "interactions with the other factors in this system - relates to the subsequent direction of the US " +
  "dollar over one session: 05:00 Europe/London to 05:00 Europe/London on the next local date.";

// The order the owner set: research, then an independent attack, then the revised synthesis with its
// cards, then the measurement. A card is the third step's output, so it is never the first deliverable.
const DEEP_RESEARCH_STEPS = [
  {
    step: 1,
    id: "deep-research",
    name: "Deep research with Astra",
    owner: "one frontier-model session, prepared and run by the owner",
    deliverable:
      "The report, plus the source note: every source actually fetched, its link, the passage relied on and the questions left unresolved.",
    gate:
      "The report is a literature-and-evidence synthesis. It measures nothing of our own session, and nothing in it is a finding about this system until step 2 and step 4 have run."
  },
  {
    step: 2,
    id: "red-team",
    name: "Independent red-team review",
    owner: "a reviewer that is not the author's session and did not write the report",
    deliverable:
      "An issue register: every load-bearing claim quoted, the exact defect named, the evidence that would settle it, and a verdict per claim.",
    gate:
      "Only what survives the attack is carried into the synthesis. A claim that cannot be assessed from the sources given is marked as such rather than repaired by argument."
  },
  {
    step: 3,
    id: "synthesis-and-cards",
    name: "Revised synthesis and structured research cards",
    owner: "the synthesising session, on the red team's register",
    deliverable:
      "The revised report with every issue marked folded, contested or open, and one research card per factor the synthesis supports, on the card schema.",
    gate:
      "The limit of at most two programmable hypotheses applies here, to an individual card, and only here; the discovery phase of steps 1 and 2 is not limited to two."
  },
  {
    step: 4,
    id: "backtest",
    name: "Backtesting under a frozen session and data contract",
    owner: "the backtesting lane, after the design is frozen",
    deliverable:
      "Candidate results on the frozen design, with coverage, sample size, uncertainty, stability across periods and the event-day split reported.",
    gate:
      "Nothing is scored before the design is frozen, and no weight, sign, threshold or lookback changes because a backtest passed."
  }
];

// The one place the two-hypothesis limit is stated, so the report brief, the card brief and the tests
// read the same sentence instead of three paraphrases of it.
const HYPOTHESIS_LIMIT_SCOPE =
  "At most two programmable hypotheses per returned card. That limit is a card rule: it applies to the " +
  "individual research card in step 3, and it does not apply to the discovery phase, where a report may " +
  "state, compare and rank as many candidate relations as its sources support.";

const CONTEXT_AND_LIMIT =
  "The rule in force and the data reachable today are context for this programme, not limits on it. The " +
  "deployed sign, weight, threshold and lookback are the object of an audit; they are never evidence for " +
  "a claim. A review may use any source it can fetch and cite, whether or not this repository can " +
  "reproduce it. What is missing blocks one thing only: empirical validation of our exact session. It " +
  "does not block research into mechanisms, evidence and interactions, and it is never a reason to " +
  "narrow the question to what this repository happens to hold.";

// Every entry in the zip sits under this folder, so extracting the archive gives one named directory.
const ZIP_ROOT = "usd-research-handoff-v1";
// A fixed timestamp keeps the archive byte-stable between runs; the files inside carry their own dates.
const ZIP_DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 15;
const ZIP_DOS_TIME = 0;

// The pack carries a finer grouping than the card schema, so the card family is derived
// rather than chosen by hand: a pack can never hand a researcher a family the schema rejects.
const CARD_FAMILY_BY_PACK_FAMILY = {
  risk_conditions: "risk_conditions",
  rates_and_policy_expectations: "rates_and_policy_expectations",
  relative_rates: "rates_and_policy_expectations",
  rates_inflation: "rates_and_policy_expectations",
  price_confirmation: "usd_price_behaviour",
  safe_haven_overlap: "cross_assets",
  event_surprises: "macroeconomic_releases",
  policy_stance: "rates_and_policy_expectations",
  risk_regime: "risk_conditions",
  cross_asset_appetite: "cross_assets"
};

// The families the card schema accepts, taken from docs/research/usd-session/v1/research-card.schema.json.
const CARD_FAMILIES = Object.freeze([
  "rates_and_policy_expectations",
  "macroeconomic_releases",
  "risk_conditions",
  "usd_price_behaviour",
  "cross_assets",
  "calendar_context",
  "data_quality"
]);

function packPathFor(factor) {
  const slug = String(factor.factor_id).replace(/^live\./, "").replace(/\./g, "-");
  return `${PACK_DIR}/${slug}.md`;
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function asBuffer(content) {
  return Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
}

function sha256(content) {
  return crypto.createHash("sha256").update(asBuffer(content)).digest("hex");
}

function catalogueLiveFactors() {
  const catalog = readJson(CATALOG_PATH);
  const usd = (catalog.assets || []).find(entry => entry.asset === "USD");
  if (!usd) throw new Error(`${CATALOG_PATH} carries no USD asset`);
  return (usd.factors || []).filter(factor => String(factor.factor_id || "").startsWith("live."));
}

/**
 * The whole USD catalogue, split the way the two artefacts that carry it are split.
 * This bundle carries the deployed factors; the session-research factors belong to the library's own
 * task set and to `docs/research/usd-session/v1`. The counts are read from the catalogue so that a
 * factor added there cannot leave this note claiming a total that no longer holds.
 */
function catalogueScope() {
  const catalog = readJson(CATALOG_PATH);
  const usd = (catalog.assets || []).find(entry => entry.asset === "USD");
  if (!usd) throw new Error(`${CATALOG_PATH} carries no USD asset`);
  const factors = usd.factors || [];
  const live = factors.filter(factor => String(factor.factor_id || "").startsWith("live."));
  const session = factors.filter(factor => !String(factor.factor_id || "").startsWith("live."));
  const sessionGroups = {};
  for (const factor of session) {
    const group = factor.group || "ungrouped";
    sessionGroups[group] = (sessionGroups[group] || 0) + 1;
  }
  return { total: factors.length, live: live.length, session: session.length, sessionGroups };
}

function catalogueSessionFactors() {
  const catalog = readJson(CATALOG_PATH);
  const usd = (catalog.assets || []).find(entry => entry.asset === "USD");
  if (!usd) throw new Error(`${CATALOG_PATH} carries no USD asset`);
  return (usd.factors || []).filter(factor => !String(factor.factor_id || "").startsWith("live."));
}

/**
 * Which library task covers each factor, read from the committed catalogue's own `covers` lists rather
 * than restated here, so a task that stops covering a factor is visible instead of silently ignored.
 */
function catalogueTaskByFactor() {
  const catalog = readJson(CATALOG_PATH);
  const map = {};
  for (const task of catalog.tasks || []) {
    for (const factorId of task.covers || []) {
      if (!map[factorId]) map[factorId] = task.task_id;
    }
  }
  return map;
}

/**
 * The twenty-five briefs in catalogue order: the ten deployed factors, whose packs audit executing code,
 * and the fifteen session-research factors, whose packs are the research assignment. A row joins the
 * committed catalogue (the authority for id, label, role, status, rules and sources) with either the
 * register's extracted detail or the authored session brief, so one pack can be written from one row.
 */
function factorBriefRows() {
  const catalog = readJson(CATALOG_PATH);
  const usd = (catalog.assets || []).find(entry => entry.asset === "USD");
  if (!usd) throw new Error(`${CATALOG_PATH} carries no USD asset`);
  const taskByFactor = catalogueTaskByFactor();
  const briefByFactor = new Map(SESSION_FACTOR_BRIEFS.map(brief => [brief.factor_id, brief]));
  return (usd.factors || []).map((row, index) => {
    const factorId = String(row.factor_id || "");
    const live = factorId.startsWith("live.");
    const register = live ? LIVE_FACTORS.find(entry => entry.factor_id === factorId) || null : null;
    const brief = live ? null : briefByFactor.get(factorId) || null;
    return {
      position: index + 1,
      factor_id: factorId,
      label: row.label || factorId,
      group: row.group || "",
      role: row.role || "",
      asset: row.asset || usd.asset,
      live,
      catalogue: row,
      register,
      brief,
      task_id: live ? (register ? register.task_id : null) : taskByFactor[factorId] || null,
      pack_path: packPathFor({ factor_id: factorId }),
      research_status: row.research_status || "ready",
      review_status: row.review_status || "pending",
      backtest_status: row.backtest_status || "not_tested",
      blockers: Array.isArray(row.blockers) ? row.blockers.slice() : [],
      dependencies: Array.isArray(row.dependencies) ? row.dependencies.slice() : [],
      card_family: live && register ? cardFamilyFor(register.family) : brief ? brief.card_family : null,
      card_role: cardRoleFor(row.role),
      questions: live && register ? register.pack.questions : brief ? brief.questions : []
    };
  });
}

/**
 * Every disagreement between the authored session briefs and the committed catalogue, as readable lines.
 * The briefs are allowed to say more than the catalogue; they are not allowed to leave a factor without a
 * brief, to contradict its label, or to hand a pack a family the card schema would reject.
 */
function catalogueBriefProblems() {
  const problems = [];
  const catalogueRows = factorBriefRows();
  const sessionRows = catalogueRows.filter(row => !row.live);
  const briefIds = SESSION_FACTOR_BRIEFS.map(brief => brief.factor_id).slice().sort();
  const sessionIds = sessionRows.map(row => row.factor_id).slice().sort();

  if (briefIds.join(",") !== sessionIds.join(",")) {
    problems.push(
      `the authored session briefs and ${CATALOG_PATH} disagree on which session factors exist: ` +
      `briefs [${briefIds.join(", ")}] against catalogue [${sessionIds.join(", ")}]`
    );
  }

  for (const brief of SESSION_FACTOR_BRIEFS) {
    const row = sessionRows.find(entry => entry.factor_id === brief.factor_id);
    if (!row) continue;
    if (!CARD_FAMILIES.includes(brief.card_family)) {
      problems.push(`${brief.factor_id}: pack family ${brief.card_family} is not a card-schema family`);
    }
    for (const field of ["context", "timing", "overlap", "data_asks", "hypothesis_seed", "falsification", "gap"]) {
      if (!String(brief[field] || "").trim()) problems.push(`${brief.factor_id}: the brief has no ${field}`);
    }
    if (brief.questions.length < 2) problems.push(`${brief.factor_id}: the brief asks fewer than two questions`);
    if (brief.counterarguments.length < 2) problems.push(`${brief.factor_id}: the brief carries fewer than two counterarguments`);
    if (row.research_status === "blocked" && row.blockers.length === 0) {
      problems.push(`${brief.factor_id} is blocked in the catalogue and the pack would carry no blocker line`);
    }
  }

  const duplicated = SESSION_FACTOR_BRIEFS.map(brief => brief.factor_id).filter((id, index, all) => all.indexOf(id) !== index);
  for (const id of duplicated) problems.push(`${id}: the authored session briefs carry this factor more than once`);

  for (const row of catalogueRows) {
    if (!row.label || !row.role) problems.push(`${row.factor_id}: the catalogue row carries no label or role`);
    if (!row.live && !row.brief) problems.push(`${row.factor_id}: no self-contained brief is authored for this factor`);
  }
  return problems;
}

function cardFamilyFor(packFamily) {
  const family = CARD_FAMILY_BY_PACK_FAMILY[packFamily];
  if (!family) throw new Error(`no card family is mapped for the pack family ${packFamily}`);
  if (!CARD_FAMILIES.includes(family)) throw new Error(`${family} is not a card-schema family`);
  return family;
}

/**
 * Every disagreement between this register and the committed catalogue, as readable lines.
 * The register is allowed to say more than the catalogue; it is not allowed to contradict it.
 */
function catalogueAgreementProblems() {
  const problems = [];
  const catalogue = catalogueLiveFactors();
  const catalogueIds = catalogue.map(factor => factor.factor_id).slice().sort();
  const registerIds = LIVE_FACTORS.map(factor => factor.factor_id).slice().sort();

  if (catalogueIds.join(",") !== registerIds.join(",")) {
    problems.push(
      `the register and ${CATALOG_PATH} disagree on which live factors exist: ` +
      `register [${registerIds.join(", ")}] against catalogue [${catalogueIds.join(", ")}]`
    );
  }

  for (const factor of LIVE_FACTORS) {
    const row = catalogue.find(entry => entry.factor_id === factor.factor_id);
    if (!row) continue;

    for (const field of ["label", "group", "role"]) {
      if (row[field] !== factor[field]) {
        problems.push(`${factor.factor_id}: the register says ${field} = ${factor[field]} while the catalogue says ${row[field]}`);
      }
    }

    const catalogueStatus = row.research_status || "ready";
    if (catalogueStatus !== factor.status.research) {
      problems.push(`${factor.factor_id}: the register says research = ${factor.status.research} while the catalogue says ${catalogueStatus}`);
    }
    if (catalogueStatus === "blocked" && (factor.blockers || []).length === 0) {
      problems.push(`${factor.factor_id} is blocked in the catalogue and carries no blocker in the register`);
    }
    if (row.live_weight_coded !== codedWeight24h(factor.order)) {
      problems.push(`${factor.factor_id}: coded 24h weight ${codedWeight24h(factor.order)} in the register against ${row.live_weight_coded} in the catalogue`);
    }
    if (row.live_weight_rulebook !== RULEBOOK_WEIGHTS[`F${factor.order}`]) {
      problems.push(`${factor.factor_id}: rulebook weight ${RULEBOOK_WEIGHTS[`F${factor.order}`]} in the register against ${row.live_weight_rulebook} in the catalogue`);
    }
    cardFamilyFor(factor.family);
  }

  return problems;
}

// ---------------------------------------------------------------------------
// The deployed numbers: two live weight vectors, one aggregation formula and four
// rulebook modifiers the code returns as hard-coded zeros.
// ---------------------------------------------------------------------------

const CODED_WEIGHTS = {
  "24h": { F1: 10, F2: 14, F3: 10, F4: 10, F5: 14, F6: 4, F7: 24, F8: 12, F9: 1, F10: 1 },
  "3d": { F1: 8, F2: 16, F3: 16, F4: 16, F5: 14, F6: 8, F7: 8, F8: 10, F9: 3, F10: 1 },
  current_week: { F1: 5, F2: 14, F3: 18, F4: 18, F5: 15, F6: 7, F7: 5, F8: 12, F9: 5, F10: 1 },
  next_week: { F1: 4, F2: 12, F3: 20, F4: 18, F5: 6, F6: 5, F7: 6, F8: 18, F9: 10, F10: 1 },
  current_month: { F1: 3, F2: 12, F3: 18, F4: 20, F5: 8, F6: 5, F7: 5, F8: 18, F9: 10, F10: 1 }
};

const RULEBOOK_WEIGHTS = { F1: 10, F2: 14, F3: 16, F4: 14, F5: 6, F6: 5, F7: 3, F8: 18, F9: 12, F10: 2 };

const RULEBOOK_SOURCE =
  "logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two " +
  "vectors and the disagreements between them are catalogued in " +
  "docs/research/usd-session/v1/weight_vector_discrepancy.md";

function codedWeight24h(order) {
  return CODED_WEIGHTS["24h"][`F${order}`];
}

const AGGREGATION = {
  source: "exports/usd_layer1_agent.json -> Calculate USD Conviction, scoreTimeframe",
  formula:
    "conviction = round(winning side weight / active weight * 100), where active weight is the sum of the " +
    "bullish and bearish weights only",
  steps: [
    "Each factor returns a signal of BULLISH, BEARISH or NEUTRAL with an evidence string and a reason.",
    "The timeframe's coded weight is added to the pile of the signal that returned; a NEUTRAL factor's weight goes to the neutral pile and never to active weight.",
    "bullish_argument_pct = round(bullish weight / active weight * 100), and bearish_argument_pct the same on the bearish side.",
    "net_edge_pct = bullish_argument_pct - bearish_argument_pct.",
    "The direction is the heavier side; an exact tie returns NO_CLEAR_BIAS.",
    "A direction whose absolute net edge is below 20 is published with the suffix _LEAN.",
    "conviction is the winning side's percentage of active weight, and 0 when the direction is NO_CLEAR_BIAS.",
    "verdict_strength is bucketed from the absolute net edge: 40 or more VERY_STRONG, 25 or more STRONG, 15 or more MODERATE, otherwise WEAK."
  ],
  consequences: [
    "A missing input cannot lower conviction: its weight leaves active weight, so conviction is a share of the evidence that arrived and can read 100 while half the weight is absent.",
    "neutral_pct is a sum of weight points printed with a per-cent sign in the reason string, not a percentage of anything.",
    "NO_CLEAR_BIAS requires an exact tie of the two weight sums, so abstention is an arithmetic accident rather than a designed gate."
  ]
};

const MODIFIERS = {
  note:
    "logic/agent_usd_direction.md sections 8.2 to 8.5 describe a participation cap, a missing-input penalty, a " +
    "conflict penalty and an agreement boost. The conviction node implements none of them and returns the " +
    "rulebook's own names as fixed values, so no published call can have been moved by any of the four.",
  values: {
    participation: "the active weight in points, identical to participation_cap",
    participation_cap: "the active weight in points, so no capacity is ever withheld",
    conflict_penalty: 0,
    missing_input_penalty: 0,
    agreement_boost: 0,
    weighted_edge: "the absolute net edge divided by 100"
  },
  source: "exports/usd_layer1_agent.json -> Calculate USD Conviction, conviction_model legacy aliases"
};

const KNOWN_DEFECTS = [
  "Two weight vectors are live at once: the workflow fetches the rulebook on every run while the code uses its own constants, so the published number follows the code. F7 carries 24 coded points against a rulebook weight of 3 and F8 12 against 18, and nothing reconciles them.",
  "The F7 signal string is produced outside the reachable workflow, so 24 of the 100 coded points cannot be reproduced from this repository: every node in the collector export that could compute a surprise from a calendar is an entry point with no consumer.",
  "'Code | Derive Fed Bias' is a second implementation of the bias score with no consumer, and the collector's own data_quality note names it as the source of the live fed_bias, which is in fact computed by 'Code | Derive USD Eco Inputs'.",
  "The same data_quality note says latest_us_event is selected from the Finnhub economic calendar, while the live row is read from Supabase and the Finnhub chain never reaches the snapshot.",
  "The helpers latestUsEventFromEcoData and upcomingEventsFromEcoData, which would recompute the event signal from actual against forecast and invert the sign for Unemployment Rate and Initial Jobless Claims, are defined and never called.",
  "The four modifiers of rulebook section 8 are returned as constants: participation and participation_cap equal the active weight, and conflict_penalty, missing_input_penalty and agreement_boost are all zero.",
  "neutral_pct is a sum of weight points reported with a per-cent sign inside the reason string.",
  "Snapshot selection is sortedRows.find(isUsableUsdSnapshot) || sortedRows[0]: it has no as-of bound against the 05:00 London cutoff, no per-field age and no revision exclusion, and the fallback row may be missing inputs the pack requires.",
  "Gold, BTC and NQ history percentages count stored collector rows, so those lookbacks follow the pipeline's run history rather than a trading calendar.",
  "Fields exist in the stored row and are written as null on every run: spx_d1_pct, btc_dominance, latest_ez_event, ecb_bias, global_growth_regime, ez_stress_flag and geopolitical_risk_flag.",
  "equities_regime is computed from the 16 and 25 VIX thresholds, stored in the row and exposed to the model, and read by no conviction factor, which recomputes the regime from vix_level.",
  "WTI, Brent and the five FX pairs are fetched and transformed in the collector but are not first-class fields of the stored snapshot; they survive only inside raw_payload, with the US-DE 10Y and US-JP 10Y spreads.",
  "The dashboard publishes a second strength label derived separately from the same call, so two strength labels can disagree on one row.",
  "The label instrument and its quote source are still undecided: the collector prices the dollar with FRED DTWEXBGS, a weekly broad H.10 index 2 to 6 business days old at a 05:00 London cutoff, and no intraday dollar-index print exists in the repository or the collector."
];

const UNSCORED_COLLECTED_INPUTS = [
  { input: "btc_price, btc_d1_pct, btc_d5_pct, btc_d20_pct", collected: "Coinbase spot, stored in every snapshot row with windows counted in stored rows", why_unscored: "no live factor reads them, so crypto risk appetite is the one cross-asset complex the engine collects and ignores." },
  { input: "equities_regime", collected: "computed in the collector from the 16 and 25 VIX thresholds and exposed to the model", why_unscored: "the stored label is read by no factor, which recomputes the regime from vix_level." },
  { input: "wti, brent", collected: "FRED spot series fetched and converted to per-cent changes, kept only inside raw_payload", why_unscored: "they are not stored as snapshot fields, so no factor can read them and no review can audit them." },
  { input: "eurusd, usd_jpy, gbp_usd, usd_cad, aud_usd", collected: "FRED EUR/USD and Coinbase spot for the other four, kept only inside raw_payload", why_unscored: "the dollar's own crosses are collected daily and read by no factor." },
  { input: "us_de_10y_spread, us_jp_10y_spread", collected: "computed in the collector inside raw_payload", why_unscored: "no factor reads the longer-horizon relative-rate proxies." },
  { input: "vix_d1, vix_d5", collected: "stored in every snapshot row and exposed to the model", why_unscored: "the rulebook reads VIX level and change together and the code reads the level only." },
  { input: "us_10y_yield, us_10y_d5_bps", collected: "FRED DGS10 through the collector", why_unscored: "only the real 10Y is scored, so the nominal 10Y and its change are unused." },
  { input: "us_2y_d20_bps, dxy_d20, gold_d20_pct, nq_d20_pct, us_10y_real_yield_d20_bps", collected: "stored in the snapshot row", why_unscored: "only the timeframes longer than 24 hours read them, so at this study's horizon they are collected and never used." },
  { input: "us_de_2y_spread, us_de_2y_spread_d1_bps, us_de_2y_spread_d20_bps, de_2y_d5_bps", collected: "stored or exposed in the snapshot row, with the d1 and d20 spread legs never computed by the collector", why_unscored: "only the fixed five-day spread delta is scored." },
  { input: "spx_d1_pct, btc_dominance, latest_ez_event, ecb_bias, global_growth_regime, ez_stress_flag, geopolitical_risk_flag", collected: "declared in the snapshot row and written as null every run", why_unscored: "every rulebook factor that needs one of them, the left side of the Dollar Smile above all, is unimplementable from the collector as it stands." },
  { input: "upcoming_events", collected: "stored in every snapshot row from the same eco source", why_unscored: "no factor reads the forward calendar, so the collector knows what is scheduled inside the session and the engine does not." },
  { input: "sofr, BAMLH0A0HYM2, SP500, NASDAQ100", collected: "market-close FRED series reachable in the closed study's cached frame but not collected by the live pipeline", why_unscored: "funding and credit stress have no live factor, and the closed study's frame is where they could be tested first." }
];


// ---------------------------------------------------------------------------
// The register: one JSON document and one Markdown rendering of the same facts.
// ---------------------------------------------------------------------------

function factorRegisterRow(factor) {
  return {
    order: factor.order,
    task_id: factor.task_id,
    factor_id: factor.factor_id,
    label: factor.label,
    group: factor.group,
    pack_family: factor.family,
    card_family: cardFamilyFor(factor.family),
    role: factor.role,
    card_role: cardRoleFor(factor.role),
    deployed: factor.deployed,
    definition: factor.definition,
    inputs: factor.inputs,
    rule: factor.rule,
    missing_stale: factor.missing_stale,
    dependencies: factor.deps,
    overlap: factor.overlap,
    historical_availability: factor.hist_avail,
    live_availability: factor.live_avail,
    code_refs: factor.code_refs,
    book_refs: factor.book_refs,
    weights: {
      coded_by_timeframe: Object.fromEntries(
        Object.keys(CODED_WEIGHTS).map(timeframe => [timeframe, CODED_WEIGHTS[timeframe][`F${factor.order}`]])
      ),
      coded_24h: codedWeight24h(factor.order),
      rulebook: RULEBOOK_WEIGHTS[`F${factor.order}`],
      rulebook_source: RULEBOOK_SOURCE
    },
    status: factor.status,
    blockers: factor.blockers || [],
    pack_path: packPathFor(factor),
    pack_questions: factor.pack.questions.length
  };
}

function registerDocument() {
  return {
    schema_version: "usd-factor-register-v1",
    asset: "USD",
    generated_at: EXTRACTED_AT,
    context_version: CONTEXT_VERSION,
    pack_version: PACK_VERSION,
    extraction: {
      branch: EXTRACTION_BRANCH,
      commit: EXTRACTION_COMMIT,
      deployed_workflow: DEPLOYED_WORKFLOW,
      collector_workflow: COLLECTOR_WORKFLOW,
      runtime: RUNTIME,
      card_schema: { path: CARD_SCHEMA_PATH, version: CARD_SCHEMA_VERSION, base: CARD_SCHEMA_BASE_PATH }
    },
    catalogue: {
      path: CATALOG_PATH,
      authority:
        "The committed catalogue is the authority for a live factor's id, label, group, role and status. " +
        "This register adds the extracted detail behind each factor and is refused if it contradicts the catalogue."
    },
    horizon: HORIZON,
    target: TARGET,
    weights: {
      coded_by_timeframe: CODED_WEIGHTS,
      rulebook: RULEBOOK_WEIGHTS,
      rulebook_source: RULEBOOK_SOURCE,
      discrepancy_document: "docs/research/usd-session/v1/weight_vector_discrepancy.md"
    },
    aggregation: AGGREGATION,
    modifiers: MODIFIERS,
    defects: KNOWN_DEFECTS,
    unscored_collected_inputs: UNSCORED_COLLECTED_INPUTS,
    factors: LIVE_FACTORS.map(factorRegisterRow)
  };
}

function registerMarkdown(register) {
  const lines = [];
  lines.push("# USD factor register (baseline audit, " + register.generated_at + ")");
  lines.push("");
  lines.push("Ten factors that the deployed node computes today, extracted from " +
    `${register.extraction.deployed_workflow} and ${RULEBOOK_SOURCE}. ` +
    "Each row is a baseline audit: the question is whether the deployed sign, weight, threshold and lookback are justified. " +
    `The authoritative catalogue of the same factors is \`${CATALOG_PATH}\`.`);
  lines.push("");
  lines.push("## Weights");
  lines.push("");
  lines.push("| Timeframe | " + LIVE_FACTORS.map(factor => `F${factor.order}`).join(" | ") + " |");
  lines.push("| --- |" + LIVE_FACTORS.map(() => " --- |").join(""));
  const timeframes = Object.keys(CODED_WEIGHTS);
  for (const timeframe of timeframes) {
    lines.push(`| coded ${timeframe} | ` + LIVE_FACTORS.map(factor => CODED_WEIGHTS[timeframe][`F${factor.order}`]).join(" | ") + " |");
  }
  lines.push("| rulebook | " + LIVE_FACTORS.map(factor => RULEBOOK_WEIGHTS[`F${factor.order}`]).join(" | ") + " |");
  lines.push("");
  lines.push(register.aggregation.formula + ".");
  lines.push("");
  lines.push("## Factors");
  lines.push("");
  lines.push("| # | Task | Factor | Role | Pack family | Card family | Research | Review | Backtest | Weight 24h coded / rulebook |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const factor of register.factors) {
    lines.push(
      `| ${factor.order} | ${factor.task_id} | ${factor.label} | ${factor.role} | ${factor.pack_family} | ` +
      `${factor.card_family} | ${factor.status.research} | ${factor.status.review} | ${factor.status.backtest} | ` +
      `${factor.weights.coded_24h} / ${factor.weights.rulebook} |`
    );
  }
  lines.push("");
  for (const factor of register.factors) {
    const pack = LIVE_FACTORS.find(entry => entry.factor_id === factor.factor_id).pack;
    lines.push(`### ${factor.label} (${factor.factor_id})`);
    lines.push("");
    lines.push(`- Rule: ${factor.rule}`);
    lines.push(`- Missing or stale: ${factor.missing_stale}`);
    lines.push(`- Overlap: ${factor.overlap}`);
    lines.push(`- History: ${factor.historical_availability}`);
    lines.push(`- Live: ${factor.live_availability}`);
    lines.push(`- Status: research ${factor.status.research}, review ${factor.status.review}, backtest ${factor.status.backtest}. ${factor.status.note}`);
    if (factor.blockers.length) lines.push(`- Blockers: ${factor.blockers.join("; ")}`);
    lines.push(`- Open questions: ${pack.questions.length} (see ${factor.pack_path})`);
    lines.push(`- Code: ${factor.code_refs.join(" | ")}`);
    lines.push("");
  }
  lines.push("## Defects in the deployed path");
  lines.push("");
  for (const defect of register.defects) lines.push(`- ${defect}`);
  lines.push("");
  lines.push("## Collected but not scored");
  lines.push("");
  lines.push("Every input below is already fetched or stored, so a card about it starts from data that exists. Nothing here is a recommendation.");
  lines.push("");
  for (const entry of register.unscored_collected_inputs) {
    lines.push(`- ${entry.input} - ${entry.collected}. Not scored because ${entry.why_unscored}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// One self-contained pack per factor. Section 7 of a pack is the return format,
// and section 8 is the work.
// ---------------------------------------------------------------------------

function packMarkdown(factor) {
  const cardFamily = cardFamilyFor(factor.family);
  const blockers = factor.blockers || [];
  const deps = factor.deps || [];
  const lines = [];

  lines.push(`# ${factor.label} - baseline audit pack (${factor.factor_id})`);
  lines.push("");
  lines.push(`- Task: ${factor.task_id}`);
  lines.push(`- Pack version ${PACK_VERSION}, context version ${CONTEXT_VERSION}, extracted ${EXTRACTED_AT} on branch \`${EXTRACTION_BRANCH}\` at \`${EXTRACTION_COMMIT}\`.`);
  lines.push(`- The card's \`family\` field must be \`${cardFamily}\`; the pack groups this factor under \`${factor.family}\`.`);
  lines.push(`- Catalogue status: research ${factor.status.research}, review ${factor.status.review}, backtest ${factor.status.backtest}. ${factor.status.note}`);
  if (blockers.length) lines.push(`- Blocked by: ${blockers.join("; ")}`);
  lines.push("");
  lines.push("## 1. What is asked");
  lines.push("");
  lines.push(OBJECTIVE);
  lines.push("");
  lines.push(READER);
  lines.push("");
  lines.push("Prohibitions:");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## 2. The session");
  lines.push("");
  lines.push(HORIZON_BLOCK);
  lines.push("");
  lines.push(`- The label instrument and its quote source are UNDECIDED. ${TARGET.rule}`);
  lines.push("");
  lines.push("## 3. The deployed baseline for this factor");
  lines.push("");
  lines.push(factor.definition);
  lines.push("");
  lines.push(`- Rule in code: ${factor.rule}`);
  lines.push(`- Input: ${factor.inputs.map(entry => `${entry.input} from ${entry.source} (${entry.units}; ${entry.transform}; lookback ${entry.lookback}; cutoff ${entry.cutoff})`).join(" | ")}`);
  lines.push(`- Weights: coded by timeframe ${JSON.stringify(Object.fromEntries(Object.keys(CODED_WEIGHTS).map(tf => [tf, CODED_WEIGHTS[tf][`F${factor.order}`]])))}; rulebook ${RULEBOOK_WEIGHTS[`F${factor.order}`]}. ${RULEBOOK_SOURCE}.`);
  lines.push(`- Missing or stale input: ${factor.missing_stale}`);
  lines.push("- Where this comes from in the code:");
  for (const reference of factor.code_refs) lines.push(`  - ${reference}`);
  lines.push("- Where the rulebook states it:");
  for (const reference of factor.book_refs) lines.push(`  - ${reference}`);
  lines.push(`- Rulebook passage the card must engage with: "${factor.pack.excerpts.map(excerpt => excerpt.quote).join(" ")}" (${factor.pack.excerpts.map(excerpt => `${excerpt.path}, ${excerpt.lines}`).join("; ")})`);
  lines.push("");
  lines.push("## 4. What data exists");
  lines.push("");
  lines.push(AVAILABILITY_BLOCK);
  lines.push("");
  lines.push(`- Historical availability for this factor: ${factor.hist_avail}`);
  lines.push(`- Live availability at the cutoff: ${factor.live_avail}`);
  lines.push(`- This factor needs: ${deps.length ? deps.join(" | ") : "nothing beyond the label instrument decision"}`);
  lines.push("");
  lines.push("## 5. The engine around the baseline");
  lines.push("");
  lines.push(ENGINE_BLOCK);
  lines.push("");
  lines.push(`- Aggregation: ${AGGREGATION.formula}. ${AGGREGATION.consequences.join(" ")}`);
  lines.push(`- Modifiers: ${MODIFIERS.note}`);
  lines.push("");
  lines.push("## 6. What is already open");
  lines.push("");
  for (const argument of factor.pack.counterarguments) lines.push(`- ${argument}`);
  lines.push(`- Overlap and double counting: ${factor.overlap}`);
  lines.push(`- Timing: ${factor.pack.timing}`);
  lines.push(`- Unresolved data gap: ${factor.pack.gap}`);
  lines.push("");
  lines.push("## 7. What to return");
  lines.push("");
  lines.push(RETURN_RULES);
  lines.push("");
  lines.push("The card's fields, in order, are: " + CARD_FIELDS.map(field => `\`${field}\``).join(", ") + ".");
  lines.push(`The schema is ${CARD_SCHEMA_PATH} (${CARD_SCHEMA_VERSION}); it extends ${CARD_SCHEMA_BASE_PATH} and the field list is the same one the template carries.`);
  lines.push("");
  lines.push("## 8. What to answer");
  lines.push("");
  for (const question of factor.pack.questions) lines.push(`- ${question}`);
  lines.push("");
  lines.push(`- Hypothesis: ${factor.pack.hypothesis_seed}`);
  lines.push(`- Falsification: ${factor.pack.falsification}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * One self-contained brief for a session-research factor: the same eight sections a baseline pack carries,
 * with section 3 answering "what is this factor and why is it under research" instead of "what does the
 * deployed node do with it". No rule is in force for these factors, so the pack hands over a question and
 * the instructions for answering it, and nothing in it presumes an answer.
 */
function sessionPackMarkdown(row) {
  const brief = row.brief;
  const catalogue = row.catalogue;
  const lines = [];

  lines.push(`# ${row.label} - research brief pack (${row.factor_id})`);
  lines.push("");
  lines.push(`- Task: ${row.task_id || "no library task covers this factor yet"}. Position ${row.position} of the twenty-five USD factors in \`${CATALOG_PATH}\`.`);
  lines.push(`- Pack version ${PACK_VERSION}, context version ${CONTEXT_VERSION}, written ${EXTRACTED_AT}.`);
  lines.push(`- This is a research assignment, not a baseline audit: no rule is in force for this factor and no deployed weight reads it.`);
  lines.push(`- The card's \`family\` field must be \`${row.card_family}\` and its \`session_role\` field must be \`${row.card_role}\`.`);
  lines.push(`- Catalogue status, read at ${EXTRACTED_AT}: research ${row.research_status}, review ${row.review_status}, backtest ${row.backtest_status}.`);
  if (row.blockers.length) lines.push(`- Blocked by: ${row.blockers.join("; ")}`);
  lines.push("");
  lines.push("## 1. What is asked");
  lines.push("");
  lines.push(OBJECTIVE);
  lines.push("");
  lines.push(READER);
  lines.push("");
  lines.push("Prohibitions:");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## 2. The session");
  lines.push("");
  lines.push(HORIZON_BLOCK);
  lines.push("");
  lines.push(`- The label instrument and its quote source are UNDECIDED. ${TARGET.rule}`);
  lines.push("");
  lines.push("## 3. The factor, and why it is under research");
  lines.push("");
  lines.push(brief.context);
  lines.push("");
  lines.push(`- Role in the session: ${row.role} (the card's \`session_role\` is \`${row.card_role}\`).`);
  lines.push(`- What the engine does with it today: nothing. There is no deployed weight, threshold, lookback or sign for this factor, and the catalogue's own words on the rule in force are: ${catalogue.current_rules.map(rule => `"${rule}"`).join(" ")}`);
  lines.push(`- The catalogue's brief for it, unchanged: "${catalogue.brief}"`);
  lines.push(`- Sources the library records for it: ${(catalogue.sources || []).join("; ") || "none recorded"}.`);
  lines.push(`- Dependencies recorded against it: ${row.dependencies.join(" | ") || "The label instrument and quote source decision."}`);
  lines.push("");
  lines.push("## 4. What data exists");
  lines.push("");
  lines.push(AVAILABILITY_BLOCK);
  lines.push("");
  lines.push(`- What this brief needs established before a test is designed: ${brief.data_asks}`);
  lines.push("- Say where an input is unavailable rather than substituting a proxy, and state the publication lag and revision behaviour of every series the card uses.");
  lines.push("");
  lines.push("## 5. The engine this factor would join");
  lines.push("");
  lines.push(ENGINE_BLOCK);
  lines.push("");
  lines.push(`- Aggregation: ${AGGREGATION.formula}. ${AGGREGATION.consequences.join(" ")}`);
  lines.push("- The ten deployed factors and their coded and rulebook weights are listed in `USD_FACTOR_REGISTER.json` beside this pack; none of those weights reads this factor, so a returned card changes nothing that runs today.");
  lines.push("");
  lines.push("## 6. What is already open");
  lines.push("");
  for (const argument of brief.counterarguments) lines.push(`- ${argument}`);
  lines.push(`- Overlap and double counting: ${brief.overlap}`);
  lines.push(`- Timing: ${brief.timing}`);
  lines.push(`- Unresolved data gap: ${brief.gap}`);
  lines.push("");
  lines.push("## 7. What to return");
  lines.push("");
  lines.push(RETURN_RULES);
  lines.push("");
  lines.push("The card's fields, in order, are: " + CARD_FIELDS.map(field => `\`${field}\``).join(", ") + ".");
  lines.push(`The schema is ${CARD_SCHEMA_PATH} (${CARD_SCHEMA_VERSION}); it extends ${CARD_SCHEMA_BASE_PATH} and the field list is the same one the template carries.`);
  lines.push(`The session horizon the card must state is \`${HORIZON.horizon_id}\`: ${HORIZON.start} to ${HORIZON.end}.`);
  lines.push("");
  lines.push("## 8. What to answer");
  lines.push("");
  for (const question of brief.questions) lines.push(`- ${question}`);
  lines.push("");
  lines.push(`- Hypothesis: ${brief.hypothesis_seed}`);
  lines.push(`- Falsification: ${brief.falsification}`);
  lines.push("");
  return lines.join("\n");
}

function cardRoleFor(catalogueRole) {
  const role = String(catalogueRole || "").trim().toLowerCase().replace(/\s+/g, "_");
  // The catalogue says "regime" for the session set and "regime context" for the deployed set; both are the
  // schema's regime_context role, and the mapping is stated rather than guessed at write time.
  const mapped = role === "regime" ? "regime_context" : role;
  const allowed = ["direction", "regime_context", "quality_gate", "abstention_gate", "diagnostic_only"];
  if (!allowed.includes(mapped)) throw new Error(`${catalogueRole} is not a card session_role`);
  return mapped;
}

function cardSchemaV3() {
  const str = (minLength, description) => (description ? { type: "string", minLength, description } : { type: "string", minLength });
  const strings = (minItems, description) => (description ? { type: "array", minItems, items: { type: "string" }, description } : { type: "array", minItems, items: { type: "string" } });

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: CARD_SCHEMA_VERSION,
    title: "USD baseline-audit research card",
    description:
      "One card per deployed factor for the USD 05:00 Europe/London to 05:00 Europe/London session study, both ends London " +
      "wall-clock times one local day apart and 24 nominal hours. The card is what a frontier researcher returns and a reviewer " +
      `attacks. It extends ${CARD_SCHEMA_BASE_PATH} (usd-session-research-card-v2) unchanged in its session_horizon, ` +
      "calendar_and_quote_handling and evidence blocks, and adds the fields a baseline audit of a deployed factor needs. " +
      "A card may conclude that a factor should not be used; no card approves a rule.",
    type: "object",
    additionalProperties: false,
    required: CARD_FIELDS,
    properties: {
      card_id: { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{2,63}$", description: "Stable id, e.g. fx.usd-f1-vix-regime-24h." },
      schema_version: { const: CARD_SCHEMA_VERSION },
      created_at: { type: "string", format: "date" },
      author: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "name"],
        properties: { kind: { enum: ["field-model", "frontier-reviewer", "coordinator"] }, name: { type: "string", minLength: 1 } }
      },
      status: { enum: ["stub", "research-drafted", "reviewed-a", "reviewed-b", "synthesised", "implemented", "tested", "rejected"] },
      title: str(4),
      asset: { const: "USD" },
      factor_id: str(4, "A factor_id carried by the register and by the committed catalogue."),
      task_id: str(3, "The audit task the card answers, e.g. USD-BASELINE-AUDIT-01."),
      card_version: { type: "integer", minimum: 1 },
      model: str(1, "The model that wrote the card. A card is evidence, not an approval."),
      family: { enum: CARD_FAMILIES },
      assignment_id: str(3),
      session_horizon: {
        type: "object",
        additionalProperties: false,
        required: ["horizon_id", "start_local", "start_zone", "end_local", "end_zone", "end_day_offset", "nominal_hours", "rule"],
        properties: {
          horizon_id: { const: HORIZON.horizon_id },
          start_local: { const: "05:00" },
          start_zone: { const: "Europe/London" },
          end_local: { const: "05:00" },
          end_zone: { const: "Europe/London" },
          end_day_offset: { const: 1 },
          nominal_hours: { const: 24 },
          rule: str(40, "The card's own statement of the window, including the Monday-to-Friday starts, the Friday session that contains the US close and the excluded London transitions.")
        }
      },
      calendar_and_quote_handling: {
        type: "object",
        additionalProperties: false,
        required: ["dst_rule", "weekend_rule", "missing_quote_rule"],
        properties: {
          dst_rule: str(40, "Both ends are London local times resolved from the declared transitions, and what the card's series does on the changeover dates."),
          weekend_rule: str(40, "Which sessions the card is eligible on, and what happens to the Friday session that ends on Saturday."),
          missing_quote_rule: str(40, "What happens when either London print is missing, stale or later revised.")
        }
      },
      verdict: { enum: ["supported", "rejected", "inconclusive", "not_testable"], description: "The card's conclusion about the deployed baseline. Not a promise of profit and not an approval." },
      mechanism: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "session_relevance", "economic_channel"],
        properties: { summary: str(40), session_relevance: str(20, "Why the effect should appear inside the 24-hour session."), economic_channel: str(10) }
      },
      direction_claim: {
        type: "object",
        additionalProperties: false,
        required: ["sign_expected", "magnitude_expected", "sign_change_conditions", "weakening_conditions", "already_priced_in_conditions"],
        properties: {
          sign_expected: { enum: ["BULLISH", "BEARISH", "REGIME_ONLY", "AMBIGUOUS"] },
          magnitude_expected: str(10),
          sign_change_conditions: strings(1),
          weakening_conditions: strings(1),
          already_priced_in_conditions: strings(1, "What is already in the price at 05:00 London, stated rather than counted again as predictive.")
        }
      },
      session_role: { enum: ["direction", "regime_context", "quality_gate", "abstention_gate", "diagnostic_only"], description: "The catalogue's role is a display string; the card uses this enum." },
      observable_by_cutoff: {
        type: "object",
        additionalProperties: false,
        required: ["available", "as_of_rule", "notes"],
        properties: { available: { type: "boolean" }, as_of_rule: str(20), notes: { type: "string" } }
      },
      reaction_vs_predictive: {
        type: "object",
        additionalProperties: false,
        required: ["classified", "explanation"],
        properties: { classified: { enum: ["predictive", "reaction_only", "mixed"] }, explanation: str(40) }
      },
      historical_data_requirements: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["series", "source", "frequency", "units", "history_start", "session_timing_rule", "vintage_available"],
          properties: {
            series: { type: "string" },
            source: { type: "string" },
            frequency: { enum: ["intraday_hourly", "intraday_minute", "daily", "weekly", "monthly", "event_driven"] },
            units: { type: "string" },
            history_start: { type: "string", format: "date" },
            session_timing_rule: str(20, "How a value is assigned to a session and to the 05:00 London cutoff, including changeover days, the excluded Saturday start, weekends, holidays and any missing bar or print."),
            vintage_available: { enum: ["yes", "no", "unknown"] }
          }
        }
      },
      live_data_requirements: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["series", "collector_path", "exists_today", "latency_note"],
          properties: { series: { type: "string" }, collector_path: { type: "string" }, exists_today: { enum: ["yes", "no", "partial"] }, latency_note: { type: "string" } }
        }
      },
      missing_or_stale_handling: {
        type: "object",
        additionalProperties: false,
        required: ["missing_rule", "stale_rule", "effect_on_score"],
        properties: {
          missing_rule: str(20, "What the factor does when its input is absent."),
          stale_rule: str(20, "The age test, if any, between the input's as-of time and the cutoff."),
          effect_on_score: str(20, "What a missing or stale input does to the published score, stated as arithmetic rather than as intent.")
        }
      },
      dependencies_and_overlap: {
        type: "object",
        additionalProperties: false,
        required: ["depends_on", "overlaps_with", "double_count_risk"],
        properties: { depends_on: { type: "array", items: { type: "string" } }, overlaps_with: { type: "array", items: { type: "string" } }, double_count_risk: str(20) }
      },
      hypotheses: {
        type: "array",
        maxItems: 2,
        description: "At most two programmable hypotheses. Each carries its parameters, declared before validation. One hypothesis, or none with a stated reason, is a valid return.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["programmable_statement", "null_hypothesis", "expected_effect_size", "eligible_rows_note", "parameters"],
          properties: {
            programmable_statement: str(40, "A statement a program could evaluate session by session without judgement."),
            null_hypothesis: str(20),
            expected_effect_size: str(10),
            eligible_rows_note: { type: "string" },
            parameters: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "values", "default", "selection_rule"],
                properties: { name: { type: "string" }, values: { type: "array", minItems: 1, items: {} }, default: {}, selection_rule: str(15, "How the value is chosen on training rows only, declared before validation.") }
              }
            }
          }
        }
      },
      rejection_test: {
        type: "object",
        additionalProperties: false,
        required: ["design", "metric", "reject_if", "cannot_conclude_if", "sample_and_period", "multiple_comparisons_note"],
        properties: {
          design: str(30), metric: str(10), reject_if: str(20), cannot_conclude_if: str(20),
          sample_and_period: str(20), multiple_comparisons_note: str(20)
        }
      },
      falsification_tests: {
        type: "array",
        minItems: 1,
        description: "What would have to be true for the claim to be abandoned, stated before the test is run.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "design", "metric", "reject_if", "cannot_conclude_if"],
          properties: { name: { type: "string" }, design: str(30), metric: str(10), reject_if: str(20), cannot_conclude_if: str(20) }
        }
      },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fetched", "url", "supports", "source_type"],
          properties: {
            fetched: { type: "boolean" },
            url: { type: "string" },
            supports: str(10),
            source_type: { enum: ["paper", "central_bank", "official_statistics", "textbook", "practitioner", "repository_artefact", "not_yet_fetched"] }
          }
        },
        description: "Only an entry with fetched: true may be cited as evidence. An intended but unfetched source carries fetched: false and source_type not_yet_fetched."
      },
      limitations: strings(1, "What this card could not establish, including anything unmeasured."),
      open_questions: strings(0)

    }
  };
}

function cardSkeleton() {
  return {
    card_id: "fx.usd-baseline-factor-24h",
    schema_version: CARD_SCHEMA_VERSION,
    created_at: "<YYYY-MM-DD>",
    author: { kind: "<field-model|frontier-reviewer|coordinator>", name: "<who wrote it>" },
    status: "research-drafted",
    title: "<one line naming the claim>",
    asset: "USD",
    factor_id: "<the factor_id printed at the top of your pack>",
    task_id: "<the task_id printed at the top of your pack>",
    card_version: 1,
    model: "<the model that wrote this card>",
    family: "<the card family printed at the top of your pack>",
    assignment_id: "<the same task_id>",
    session_horizon: {
      horizon_id: HORIZON.horizon_id,
      start_local: "05:00",
      start_zone: "Europe/London",
      end_local: "05:00",
      end_zone: "Europe/London",
      end_day_offset: 1,
      nominal_hours: 24,
      rule: "<your own statement of the window: Monday-to-Friday starts, the Friday session that contains the US close, the excluded London transitions, and the label as the change in the label instrument between the two London instants>"
    },
    calendar_and_quote_handling: {
      dst_rule: "<what your series does on the London changeover dates>",
      weekend_rule: "<which sessions are eligible and what happens to the Friday session that ends on Saturday>",
      missing_quote_rule: "<what happens when either London print is missing, stale or revised>"
    },
    verdict: "<supported|rejected|inconclusive|not_testable>",
    mechanism: {
      summary: "<the mechanism in plain words>",
      session_relevance: "<why it should appear inside 24 hours>",
      economic_channel: "<the channel>"
    },
    direction_claim: {
      sign_expected: "<BULLISH|BEARISH|REGIME_ONLY|AMBIGUOUS>",
      magnitude_expected: "<what size, and how measured>",
      sign_change_conditions: ["<condition under which the sign flips>"],
      weakening_conditions: ["<condition under which the effect weakens>"],
      already_priced_in_conditions: ["<what is already in the price at 05:00 London>"]
    },
    session_role: "<direction|regime_context|quality_gate|abstention_gate|diagnostic_only>",
    observable_by_cutoff: { available: false, as_of_rule: "<the rule that decides what is observable>", notes: "<what the collector actually has>" },
    reaction_vs_predictive: { classified: "<predictive|reaction_only|mixed>", explanation: "<why>" },
    historical_data_requirements: [{
      series: "<series>",
      source: "<source>",
      frequency: "<intraday_hourly|intraday_minute|daily|weekly|monthly|event_driven>",
      units: "<units>",
      history_start: "<YYYY-MM-DD>",
      session_timing_rule: "<how a value is assigned to a session and to the cutoff, with missing bars named>",
      vintage_available: "<yes|no|unknown>"
    }],
    live_data_requirements: [{
      series: "<series>",
      collector_path: "<where the live value comes from today>",
      exists_today: "<yes|no|partial>",
      latency_note: "<age at 05:00 London>"
    }],
    missing_or_stale_handling: {
      missing_rule: "<what happens when the input is absent>",
      stale_rule: "<the age test, or none>",
      effect_on_score: "<what it does to the published number>"
    },
    dependencies_and_overlap: {
      depends_on: ["<other factor or source>"],
      overlaps_with: ["<factor id>"],
      double_count_risk: "<how the same news could be counted twice>"
    },
    hypotheses: [{
      programmable_statement: "<a statement a program could evaluate session by session>",
      null_hypothesis: "<the null>",
      expected_effect_size: "<what size, and why>",
      eligible_rows_note: "<which sessions are eligible>",
      parameters: [{ name: "<parameter>", values: ["<allowed value>"], default: "<default>", selection_rule: "<chosen on training rows only, declared before validation>" }]
    }],
    rejection_test: {
      design: "<the design>",
      metric: "<the metric>",
      reject_if: "<the rejection rule>",
      cannot_conclude_if: "<when the test proves nothing>",
      sample_and_period: "<sample and period>",
      multiple_comparisons_note: "<how many comparisons, and the correction>"
    },
    falsification_tests: [{
      name: "<test name>",
      design: "<the design>",
      metric: "<the metric>",
      reject_if: "<what abandons the claim>",
      cannot_conclude_if: "<when it proves nothing>"
    }],
    evidence: [{ fetched: false, url: "<the link you actually opened>", supports: "<the passage relied on>", source_type: "not_yet_fetched" }],
    limitations: ["<what this card could not establish>"],
    open_questions: ["<what remains unresolved>"]
  };
}

function outputTemplateMarkdown() {
  const lines = [];
  lines.push("# How to return a research card");
  lines.push("");
  lines.push(OBJECTIVE);
  lines.push("");
  lines.push("Return one JSON document per card and nothing else in that file, plus a short note listing the sources you fetched and the questions you could not resolve.");
  lines.push("");
  lines.push("## Rules");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push(RETURN_RULES);
  lines.push("");
  lines.push(`Validate against \`${CARD_SCHEMA_PATH}\` (${CARD_SCHEMA_VERSION}), which extends \`${CARD_SCHEMA_BASE_PATH}\` and keeps that schema's session_horizon, calendar_and_quote_handling and evidence blocks unchanged.`);
  lines.push("");
  lines.push("## The fields, in the order the schema requires them");
  lines.push("");
  for (const field of CARD_FIELDS) lines.push(`- \`${field}\``);
  lines.push("");
  lines.push("## A skeleton to copy");
  lines.push("");
  lines.push("Every angle bracket is a placeholder and an empty required string is not an accepted card. The session_horizon constants and the asset are already correct and must not be changed.");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(cardSkeleton(), null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## What happens after you return it");
  lines.push("");
  lines.push("- The card is research evidence. It is not an approval and it changes nothing in the live engine.");
  lines.push("- A reviewer attacks the card against the same pack, and only a recorded review can accept a hypothesis.");
  lines.push("- Only a backtest run under the frozen evaluation design can test it, and the label instrument decision comes before any of that.");
  lines.push("");
  return lines.join("\n");
}

/**
 * The numbered list of all twenty-five briefs: id, label, which half of the programme it belongs to, the
 * library task that covers it and the pack that carries it. It exists so a reader can find one brief
 * without opening the bundle, and so a completeness check has one machine-readable statement of coverage.
 */
function briefIndexDocument() {
  const rows = factorBriefRows();
  return {
    schema_version: "usd-research-brief-index-v1",
    generated_at: EXTRACTED_AT,
    asset: "USD",
    bundle: OUT_DIR,
    catalogue: {
      path: CATALOG_PATH,
      authority:
        "The committed catalogue is the authority for a factor's id, label, group, role, status and rule in " +
        "force. This index adds the pack path and the covering task, and the builder refuses to write unless " +
        "the two agree factor by factor."
    },
    horizon: HORIZON,
    download: {
      path: ZIP_PATH,
      root: ZIP_ROOT,
      note:
        "Every file in this bundle except the manifest and the zip itself, stored uncompressed so the " +
        "archive is reproducible byte for byte."
    },
    scope: {
      total: rows.length,
      live_engine_audits: rows.filter(row => row.live).length,
      session_research: rows.filter(row => !row.live).length,
      note:
        "One pack per factor: a baseline audit for a factor the deployed node computes today, a research " +
        "assignment for a factor with no rule in force. Nothing here approves a factor or asserts a result."
    },
    deep_research: {
      version: DEEP_RESEARCH_VERSION,
      directory: DEEP_RESEARCH_DIR,
      primary_deliverable: PRIMARY_DELIVERABLE,
      start_here: DEEP_RESEARCH_START_HERE_PATH,
      report_brief: REPORT_BRIEF_PATH,
      context_pack: NEUTRAL_CONTEXT_PACK_PATH,
      sequence: DEEP_RESEARCH_STEPS.map(step => `${step.step}. ${step.name}`),
      note:
        "The deep-research tier, versioned on its own: the report is the primary deliverable, the briefs below are " +
        "the card step, and the packs of a factor are the assignment that produces its card. The pilot package " +
        `${PILOT_VERSION} stays frozen and is not the deep research assignment.`
    },
    briefs: rows.map(row => ({
      position: row.position,
      factor_id: row.factor_id,
      label: row.label,
      group: row.group,
      role: row.role,
      card_family: row.card_family,
      card_role: row.card_role,
      kind: row.live ? "baseline_audit" : "research_assignment",
      task_id: row.task_id,
      pack_path: row.pack_path,
      research_status: row.research_status,
      review_status: row.review_status,
      backtest_status: row.backtest_status,
      blockers: row.blockers,
      dependencies: row.dependencies,
      questions: row.questions.length
    }))
  };
}

// ---------------------------------------------------------------------------
// The downloadable bundle: a stored (uncompressed) zip of the generated files, written by this script so
// no external tool or dependency is involved and the bytes are identical on every machine and every run.
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const chunks = [];
  const directory = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = asBuffer(entry.content);
    const checksum = crc32(content);
    const local = Buffer.alloc(30 + name.length);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(ZIP_DOS_TIME, 10);
    local.writeUInt16LE(ZIP_DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    const header = Buffer.alloc(46 + name.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(ZIP_DOS_TIME, 12);
    header.writeUInt16LE(ZIP_DOS_DATE, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(content.length, 20);
    header.writeUInt32LE(content.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    name.copy(header, 46);

    chunks.push(local, content);
    directory.push(header);
    offset += local.length + content.length;
  }

  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(directory.length, 8);
  end.writeUInt16LE(directory.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, central, end]);
}

// ---------------------------------------------------------------------------
// The deep-research tier: one primary deliverable and the three steps after it. Every fact these
// documents state is read from the session contract, the committed catalogue or the extracted register,
// and the builder refuses to write when the contract and this bundle disagree.
// ---------------------------------------------------------------------------

/** The session contract, or an error: the pack may not describe a session the contract no longer holds. */
function sessionContract() {
  const contract = readJson(SESSION_CONTRACT_PATH);
  const problems = contractAgreementProblems(contract);
  if (problems.length) {
    throw new Error(`${SESSION_CONTRACT_PATH} disagrees with this bundle: ${problems.join("; ")}`);
  }
  return contract;
}

/** Every disagreement between the session contract and the constants this bundle is written from. */
function contractAgreementProblems(contract = readJson(SESSION_CONTRACT_PATH)) {
  const problems = [];
  const cutoff = `${contract.cutoff.local} ${contract.cutoff.zone}`;
  const endpoint = `${contract.endpoint.local} ${contract.endpoint.zone} on the next local date`;
  if (contract.horizon_id !== HORIZON.horizon_id) {
    problems.push(`the contract's horizon_id is ${contract.horizon_id} while this bundle writes ${HORIZON.horizon_id}`);
  }
  if (cutoff !== HORIZON.start) problems.push(`the contract's cutoff is ${cutoff} while this bundle writes ${HORIZON.start}`);
  if (endpoint !== HORIZON.end) problems.push(`the contract's endpoint is ${endpoint} while this bundle writes ${HORIZON.end}`);
  if (contract.endpoint.nominal_hours !== HORIZON.nominal_hours) {
    problems.push(`the contract's nominal hours are ${contract.endpoint.nominal_hours} while this bundle writes ${HORIZON.nominal_hours}`);
  }
  const weekdays = (contract.endpoint.session_start_weekdays || []).join(",");
  if (weekdays !== HORIZON.session_start_weekdays.join(",")) {
    problems.push(`the contract's session starts are ${weekdays} while this bundle writes ${HORIZON.session_start_weekdays.join(",")}`);
  }
  if (contract.outcome_instrument.proposed_code !== TARGET.intended_label_instrument) {
    problems.push(
      `the contract proposes the label ${contract.outcome_instrument.proposed_code} while this bundle writes ${TARGET.intended_label_instrument}`
    );
  }
  if (contract.outcome_instrument.verification_state !== TARGET.verification_state) {
    problems.push(
      `the contract's label verification state is ${contract.outcome_instrument.verification_state} while this bundle writes ${TARGET.verification_state}`
    );
  }
  if ((contract.outcome_instrument.proposed_quote_source || null) !== TARGET.quote_source) {
    problems.push("the contract names a label quote source while this bundle writes none");
  }
  return problems;
}

/**
 * The decisions the session contract still leaves open, read from the contract rather than restated, so a
 * decision frozen elsewhere leaves this list by itself instead of leaving a stale row behind it.
 */
function unresolvedDecisionRows(contract = sessionContract()) {
  return [
    {
      decision: "label instrument and quote source",
      state: contract.outcome_instrument.verification_state,
      detail: contract.outcome_instrument.blocking_question
    },
    {
      decision: "missing-quote policy",
      state: String(contract.eligibility.missing_quote_policy).split(" - ")[0],
      detail: contract.eligibility.missing_quote_policy
    },
    { decision: "flat band", state: contract.flat_handling.status, detail: contract.flat_handling.note },
    { decision: "ties in scoring", state: String(contract.eligibility.ties).split(" - ")[0], detail: contract.eligibility.ties },
    {
      decision: "exchange holidays and the session calendar",
      state: String(contract.eligibility.exchange_holidays).split(" - ")[0],
      detail: contract.eligibility.exchange_holidays
    }
  ];
}

function deepResearchStartHereMarkdown() {
  const contract = sessionContract();
  const relative = filePath => filePath.replace(`${OUT_DIR}/`, "");
  const lines = [];
  lines.push("# USD deep research - start here");
  lines.push("");
  lines.push(
    `Generated ${EXTRACTED_AT} on branch \`${EXTRACTION_BRANCH}\` at \`${EXTRACTION_COMMIT}\`. Deep-research tier ` +
    `${DEEP_RESEARCH_VERSION}, context version ${CONTEXT_VERSION}, pack version ${PACK_VERSION}, card schema ${CARD_SCHEMA_VERSION}.`
  );
  lines.push("");
  lines.push("## The primary deliverable");
  lines.push("");
  lines.push(PRIMARY_DELIVERABLE);
  lines.push("");
  lines.push(
    "That report is the primary deliverable of this programme. A returned research card is neither a substitute for " +
    "it nor its equal: the twenty-five briefs one level up are per-factor assignments whose returns are cards, and a " +
    "card is the third step below rather than the first."
  );
  lines.push("");
  lines.push("## The four steps, in this order");
  lines.push("");
  for (const step of DEEP_RESEARCH_STEPS) {
    lines.push(`**${step.step}. ${step.name}**`);
    lines.push("");
    lines.push(`- Owner: ${step.owner}.`);
    lines.push(`- Deliverable: ${step.deliverable}`);
    lines.push(`- Gate: ${step.gate}`);
    lines.push("");
  }
  lines.push("## The files in this folder");
  lines.push("");
  lines.push(`- \`${relative(REPORT_BRIEF_PATH)}\` - step 1, the primary deliverable, in full.`);
  lines.push(`- \`${relative(NEUTRAL_CONTEXT_PACK_PATH)}\` - the factual context a report may assume, with every prior conclusion and proposed hypothesis left out on purpose.`);
  lines.push(`- \`${relative(RED_TEAM_BRIEF_PATH)}\` - step 2: attack the report claim by claim before anything is synthesised.`);
  lines.push(`- \`${relative(SYNTHESIS_BRIEF_PATH)}\` - step 3: the revised synthesis and the structured cards.`);
  lines.push(`- \`${relative(BACKTEST_BRIEF_PATH)}\` - step 4: what must be frozen before anything is scored.`);
  lines.push(`- \`${relative(DEEP_RESEARCH_START_HERE_PATH)}\` - this note.`);
  lines.push("");
  lines.push("## What is context and what is a limit");
  lines.push("");
  lines.push(`- ${CONTEXT_AND_LIMIT}`);
  lines.push(`- ${HYPOTHESIS_LIMIT_SCOPE}`);
  lines.push(
    "- The label decision and the frozen evaluation design belong to step 4's owner, not to the report: a report may " +
    "say what its sources imply for the missing-quote policy, the flat band and the tie rule, and it freezes none of them."
  );
  lines.push("");
  lines.push("## The session every file here is written for");
  lines.push("");
  lines.push(
    `Start ${HORIZON.start}, end ${HORIZON.end}, ${HORIZON.nominal_hours} nominal hours, a start on a Monday-to-Friday ` +
    `local date only. The contract behind that is \`${SESSION_CONTRACT_PATH}\`, horizon \`${contract.horizon_id}\`, ` +
    "corrected 2026-10-14; the context pack states the whole of it, and no file in this folder may describe another window."
  );
  lines.push("");
  lines.push("## How a return is handled");
  lines.push("");
  lines.push(
    `- The report and its source note upload against \`${pilotBriefRow().task_id}\` for \`${PILOT_FACTOR_ID}\` in the ` +
    "Research Library, the task that covers the factor. An upload records evidence; it is not an approval."
  );
  lines.push(
    "- The card that came back from pilot 1 is recorded as preliminary, unreviewed and not backtested in the " +
    "hand-written record beside the frozen package (`pilot/PILOT_1_RETURN_STATUS.md`, in the repository rather than " +
    "inside this archive), and it is not the completion of that task."
  );
  lines.push(
    "- The library's review assignments for the twenty-five factors are the card-step reviews. The red team of step 2 " +
    "is a separate, earlier pass over the report and is recorded on its own."
  );
  lines.push("");
  lines.push("## The prohibitions this tier carries");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## What is not claimed");
  lines.push("");
  lines.push("- No backtest was run for any factor here and no performance figure is asserted anywhere in it.");
  lines.push("- A report is evidence, a review is an opinion on evidence, a card is a hypothesis and a passing backtest is not a deployment.");
  lines.push("- Nothing here made or authorised a change to anything that runs: no production, workflow, dashboard, feed, dispatcher, database or configuration change.");
  lines.push("");
  lines.push("## Regenerating it");
  lines.push("");
  lines.push(
    "`node scripts/build_research_handoff.js write` writes this folder with the rest of the bundle, and `check` fails " +
    `if a file here is stale, if the context pack stops matching \`${SESSION_CONTRACT_PATH}\`, or if the catalogue and ` +
    "the briefs stop agreeing."
  );
  lines.push("");
  return lines.join("\n");
}

function comprehensiveReportBriefMarkdown() {
  const rows = factorBriefRows();
  const vixReaders = rows
    .filter(row => row.live && row.register && row.register.inputs.some(input => /vix/i.test(input.input)))
    .map(row => `\`${row.factor_id}\``);
  const relative = filePath => filePath.replace(`${OUT_DIR}/`, "");
  const lines = [];
  lines.push("# VIX and the subsequent direction of the US dollar - comprehensive research brief (live.f1-vix-level)");
  lines.push("");
  lines.push(
    `- Task: \`${pilotBriefRow().task_id}\`. Report brief ${DEEP_RESEARCH_VERSION} of the deep-research tier, context version ` +
    `${CONTEXT_VERSION}, pack version ${PACK_VERSION}, extracted ${EXTRACTED_AT} on branch \`${EXTRACTION_BRANCH}\` at \`${EXTRACTION_COMMIT}\`.`
  );
  lines.push(
    `- Read [\`${relative(NEUTRAL_CONTEXT_PACK_PATH)}\`](${relative(NEUTRAL_CONTEXT_PACK_PATH)}) first. It carries the session, the existing factors, the rules in force, the data that exists and the decisions that are open - and nothing else, on purpose.`
  );
  lines.push("- This brief is step 1 of four. A research card is step 3's output, under the same task, and it is not what this brief asks for.");
  lines.push("");
  lines.push("## 1. What is asked");
  lines.push("");
  lines.push("Produce one comprehensive, source-backed report. It is the primary deliverable of this programme:");
  lines.push("");
  lines.push(PRIMARY_DELIVERABLE);
  lines.push("");
  lines.push(
    "We have a rule in force that reads the VIX level as a risk regime, and a session we have defined but have not " +
    "measured, because the instrument that would label it has no verified quote source. Neither of those is the " +
    "question. The question is what the evidence actually says about how VIX and the things it interacts with relate " +
    "to where the dollar goes next, inside this window, and where that evidence is thin, contradictory or absent."
  );
  lines.push("");
  lines.push(
    "Return the report as markdown, plus the source note described in section 6. Format the report with the sections " +
    "of section 3 in that order: a reader who disagrees with you should be able to find the weakness."
  );
  lines.push("");
  lines.push("## 2. The session the report is written for");
  lines.push("");
  lines.push(
    `- Start ${HORIZON.start}. End ${HORIZON.end}. Both ends are London wall-clock times one local date apart; every ` +
    `eligible session is exactly ${HORIZON.nominal_hours} hours. The contract is \`${SESSION_CONTRACT_PATH}\`.`
  );
  lines.push(
    "- The label instrument is proposed as DXY and is UNVERIFIED: no intraday dollar-index print exists in this " +
    "repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: " +
    "if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument " +
    "in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else."
  );
  lines.push(
    "- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET " +
    "close, a median 30.5 elapsed hours. The closed 24-hour study behind it overlaps the corrected session for 14.5 " +
    "nominal hours (15.5 in the weeks when New York has changed and London has not) and leaves the session's first 9.5 " +
    "hours unmeasured. Read every number in this repository as belonging to one of those windows, and say which."
  );
  lines.push("");
  lines.push("## 3. What the report must cover");
  lines.push("");
  lines.push("1. What VIX is and what it measures, from sources: the level, the index family around it, the futures term structure, and anything published about volatility of volatility. Name the instrument and the window of every claim.");
  lines.push("2. The proposed mechanisms by which VIX would move the dollar inside a 24-hour London-to-London window - safe-haven demand, risk appetite and cross-asset correlation, carry and funding, policy expectations, positioning and flows - and the observable each mechanism would leave at the cutoff.");
  lines.push("3. Level against change: whether the level, the 1-day change or a longer change is the informative quantity, and on what evidence that judgement rests.");
  lines.push(`4. Interactions with the factors in this system, taken from the context pack's factor table: for each one, whether the sources support an interaction with VIX, what the two together would imply, and which pairs would double-count one input. The deployed set already reads VIX in ${vixReaders.length} places - ${vixReaders.join(", ")} - and the session set carries its own VIX card, so name every overlap you rely on and every overlap you are introducing.`);
  lines.push("5. Where the relation weakens, changes sign or stops being informative: growth shocks against policy and funding shocks, low-volatility regimes, event days, month-end and quarter-end, and what the sources say distinguishes them.");
  lines.push("6. What is already in the price at the cutoff, given that 05:00 London follows the US close that produced the VIX print, and how a study could tell a reaction from a prediction.");
  lines.push("7. The cross-asset carriers of the same channel: equities, credit, gold, rates and crypto, with the same instrument and window labelling.");
  lines.push("8. Event and calendar conditioning inside the window, including the release calendar and the H.10 timing.");
  lines.push("9. What the sources cannot settle: contradictions, weak identification, period dependence, and claims that are plausible but unsourced.");
  lines.push("10. What our own session cannot be measured on yet, stated plainly, and what that does not block.");
  lines.push("11. Candidate relations, unranked: as many as the sources support, each with the window it was evidenced on, the direction, the condition under which it holds and what would falsify it.");
  lines.push("12. Open questions, and what you would need to fetch or measure next.");
  lines.push("13. What is not claimed, in your own words.");
  lines.push("");
  lines.push("## 4. Evidence standards");
  lines.push("");
  lines.push("- Cite only what you actually fetched in this session: the link, the passage you relied on, when the source is dated, and what that passage supports.");
  lines.push("- Label the window of every piece of evidence. A close-to-close daily relation, an intraday slice, an options-implied measure and a 30-hour study window are four different objects; none of them may be presented as evidence about our 05:00-to-05:00 session.");
  lines.push("- Keep mechanism apart from measurement. A coherent argument for why a channel exists is not a measurement of it, and a modelled or simulated figure is not an observed one.");
  lines.push("- Where sources disagree, give both and say which one you find better identified and why.");
  lines.push("- Prefer primary sources - the exchange, the index provider, the Federal Reserve, the paper itself - over summaries, and say when only a summary was reachable.");
  lines.push("- Name the instrument a claim is really about, every time. Never present another instrument as DXY.");
  lines.push("- A relation that exists on another asset, another window or another era is reported as exactly that.");
  lines.push("");
  lines.push("## 5. Context, not a limit");
  lines.push("");
  lines.push(`- ${CONTEXT_AND_LIMIT}`);
  lines.push(`- ${HYPOTHESIS_LIMIT_SCOPE}`);
  lines.push(
    "- The label instrument and quote source are unverified, and the missing-quote policy, the flat band and the tie " +
    "rule are open decisions listed in the context pack. None of them is frozen here, none of them is yours to freeze, " +
    "and the report may say what the sources imply for each of them."
  );
  lines.push("");
  lines.push("## 6. What to return");
  lines.push("");
  lines.push("1. The report, as markdown, with the sections of section 3 in that order and an explicit what-is-not-claimed section.");
  lines.push("2. The source note: every source you fetched, its link, the passage you relied on, what it supports, the window it concerns and whether it is primary; then the questions you could not resolve and what you could not reach behind a paywall or a login.");
  lines.push(
    `3. Both upload against \`${pilotBriefRow().task_id}\` for \`${PILOT_FACTOR_ID}\` in the Research Library. An upload records ` +
    "evidence; it is not an approval, and it moves no factor's status."
  );
  lines.push("");
  lines.push("## 7. Prohibitions");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## 8. What happens after you return it");
  lines.push("");
  lines.push(
    "An independent red team attacks the report claim by claim (step 2, `" +
    `${relative(RED_TEAM_BRIEF_PATH)}` +
    "`). Only what survives is carried into the revised synthesis and the structured research cards (step 3, `" +
    `${relative(SYNTHESIS_BRIEF_PATH)}` +
    "`), where the per-card limit of at most two programmable hypotheses applies. Nothing is scored before the session " +
    "and data contract is frozen (step 4, `" +
    `${relative(BACKTEST_BRIEF_PATH)}` +
    "`), and no weight, sign, threshold or lookback changes because a report or a backtest exists."
  );
  lines.push("");
  lines.push("## 9. What this brief is not");
  lines.push("");
  lines.push("- Not a research card: a card is step 3's output, on the schema, and the two-hypothesis limit is not a limit on this report.");
  lines.push("- Not an audit of our deployed rule, and not an approval of it or of any replacement: the deployed rule is context to be tested against the evidence, never evidence for a claim.");
  lines.push("- Not a measurement of our session: the report says what is known and how well, and states plainly what the missing label data leaves unmeasured.");
  lines.push("- Not a backtest, a performance figure, an accuracy rate or a sample size, and it asserts none.");
  lines.push("- Not a live change of any kind: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this brief.");
  lines.push("");
  lines.push("## 10. The other nine deployed factors and the fifteen session factors");
  lines.push("");
  lines.push(
    `This brief is the programme's first report and its subject is VIX. The other factor ids in the context pack get ` +
    `their own assignments: the deployed set audits code that runs (tasks \`USD-BASELINE-AUDIT-01\` to \`USD-BASELINE-AUDIT-10\`, ` +
    `one per factor, of which only \`${pilotBriefRow().task_id}\` is addressed here), and the fifteen session factors carry the two field packages. ` +
    "The same four steps apply to them when their turns come."
  );
  lines.push("");
  return lines.join("\n");
}

function neutralContextPackMarkdown() {
  const contract = sessionContract();
  const scope = catalogueScope();
  const rows = factorBriefRows();
  const lines = [];
  lines.push("# Neutral context pack - what a VIX report may assume");
  lines.push("");
  lines.push(
    `Generated ${EXTRACTED_AT} on branch \`${EXTRACTION_BRANCH}\` at \`${EXTRACTION_COMMIT}\`. Deep-research tier ` +
    `${DEEP_RESEARCH_VERSION}, context version ${CONTEXT_VERSION}. Facts only, read from \`${SESSION_CONTRACT_PATH}\`, ` +
    `\`${CATALOG_PATH}\` and the extracted register.`
  );
  lines.push("");
  lines.push("## 0. Why this pack exists and what it deliberately leaves out");
  lines.push("");
  lines.push(
    "The report of step 1 is written without our own earlier thinking in front of it. Anchoring is the failure mode " +
    "here: a reader handed our questions will answer our questions, and a reader handed a hypothesis will test that " +
    "hypothesis rather than find the right one."
  );
  lines.push("");
  lines.push("So this pack carries five things and nothing else:");
  lines.push("");
  lines.push("1. the session definition (section 1);");
  lines.push("2. the factors that exist in this system (section 2);");
  lines.push("3. the rules that execute today, as code facts (section 3);");
  lines.push("4. the data that exists and its staleness at the cutoff (section 4);");
  lines.push("5. the decisions still open (section 5).");
  lines.push("");
  lines.push("It deliberately excludes, and no sentence in it is derived from:");
  lines.push("");
  lines.push("- every prior research conclusion in this repository about VIX, about the dollar and about this session;");
  lines.push("- every proposed hypothesis, hypothesis seed, falsification prompt and rejection test for any factor;");
  lines.push("- every card verdict, ranking, score, weight of importance or recommendation, and the assembled synthesis of the earlier session research;");
  lines.push("- the register's and the briefs' own research prompts, open questions, counterarguments, timing notes, overlap notes, data asks and gap statements - the fields written to steer a card answer rather than to state a fact about the system;");
  lines.push("- the returned card of pilot 1 and the source note with it, which are recorded elsewhere as preliminary and unreviewed.");
  lines.push("");
  lines.push(
    "Those texts are kept out on purpose, and the omission is checkable rather than promised: the pack is generated " +
    "without those fields, and the guards fail if any of them appears in it. If a claim in the report matters, it " +
    "must come from a source the report itself fetched, not from this file."
  );
  lines.push("");
  lines.push(
    "A row in this pack is a fact about what is deployed or what is reachable. It is not a finding, not an " +
    "endorsement, and not an ordering by expected value: the factor order below is the committed catalogue's order."
  );
  lines.push("");
  lines.push("## 1. The session");
  lines.push("");
  lines.push(`- Contract: \`${SESSION_CONTRACT_PATH}\`, horizon_id \`${contract.horizon_id}\`, status \`${contract.status}\`, corrected ${contract.horizon_corrected_at}, production_enabled ${contract.production_enabled}, trade_eligible ${contract.trade_eligible}.`);
  lines.push(`- Start: ${HORIZON.start}. End: ${HORIZON.end}. Nominal length ${HORIZON.nominal_hours} hours; one directional call per local date is the design's intent.`);
  lines.push(`- Weekday rule: ${contract.endpoint.session_start_rule}`);
  lines.push(`- Zone rule: ${contract.cutoff.utc_rule}; the London transitions carried by the contract are ${contract.cutoff.bst_2026_start_utc} and ${contract.cutoff.bst_2026_end_utc}.`);
  lines.push(`- As-of rule for every input: ${contract.cutoff.asof_rule}`);
  lines.push(`- The deployed engine's own window, for contrast: ${contract.contract_vs_deployed_engine.deployed_cutoff} to ${contract.contract_vs_deployed_engine.deployed_endpoint}, a measured median of ${contract.contract_vs_deployed_engine.measured_median_elapsed_hours} elapsed hours.`);
  lines.push(`- How the deployed engine's own calls relate to this window: ${contract.contract_vs_deployed_engine.scoring_rule}`);
  lines.push(`- What the closed study behind it measured: ${contract.contract_vs_deployed_engine.measured_against_the_corrected_window}`);
  lines.push(`- Families declared over the whole USD programme: ${contract.scope.families.join(", ")}.`);
  lines.push("");
  lines.push(`## 2. The factors that exist (${scope.total}: ${scope.live} deployed, ${scope.session} session-research)`);
  lines.push("");
  lines.push("| # | Factor id | Label | Group | Role | Rule in force | Research | Review | Backtest | Covered by |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const order = row.live && row.register ? `F${row.register.order}` : null;
    const rule = order
      ? `deployed, 24h weight ${CODED_WEIGHTS["24h"][order]} coded / ${RULEBOOK_WEIGHTS[order]} rulebook`
      : "none in force";
    lines.push(
      `| ${row.position} | \`${row.factor_id}\` | ${row.label} | ${row.group} | ${row.role} | ${rule} | ` +
      `${row.research_status} | ${row.review_status} | ${row.backtest_status} | ${row.task_id ? `\`${row.task_id}\`` : "no task"} |`
    );
  }
  lines.push("");
  lines.push(
    `A factor's own brief is not part of this pack: the ${scope.total} packs are assignments one level up in \`${PACK_DIR.replace(`${OUT_DIR}/`, "")}\`, ` +
    "and they carry the research prompts this pack deliberately omits."
  );
  lines.push("");
  lines.push("## 3. The rules that execute today");
  lines.push("");
  lines.push(
    `These are code facts, taken from the register beside \`${CATALOG_PATH}\`, from exports/usd_layer1_agent.json and ` +
    "from logic/agent_usd_direction.md v2.1. They are the object of the audit. They are never evidence for a claim " +
    "about VIX, about the dollar or about the session."
  );
  lines.push("");
  lines.push("### 3.1 The path that produces the published call");
  lines.push("");
  lines.push(`- The published call is produced by the deterministic node Calculate USD Conviction in the live workflow USD Layer 1 Agent (OCt1tB9yVMUgFTha). ${DEPLOYED_WORKFLOW}.`);
  lines.push(`- The model writes the per-factor verdict strings; the code computes every published number, and where they disagree the code wins. Collector: ${COLLECTOR_WORKFLOW}; runtime: ${RUNTIME}.`);
  lines.push(`- ${MODIFIERS.note}`);
  lines.push(`- ${AGGREGATION.formula}. The published strength label and the dashboard's separately derived bucket can disagree on the same row; the full arithmetic is stated in \`${OUT_DIR}/USD_SYSTEM_CONTEXT.md\` and in \`${OUT_DIR}/USD_FACTOR_REGISTER.md\`.`);
  lines.push("");
  lines.push("### 3.2 The two weight vectors, by timeframe");
  lines.push("");
  lines.push(`| Vector | ${LIVE_FACTORS.map(factor => `F${factor.order}`).join(" | ")} |`);
  lines.push(`| --- |${LIVE_FACTORS.map(() => " --- |").join("")}`);
  for (const timeframe of Object.keys(CODED_WEIGHTS)) {
    lines.push(`| coded ${timeframe} | ${LIVE_FACTORS.map(factor => CODED_WEIGHTS[timeframe][`F${factor.order}`]).join(" | ")} |`);
  }
  lines.push(`| rulebook v2.1 | ${LIVE_FACTORS.map(factor => RULEBOOK_WEIGHTS[`F${factor.order}`]).join(" | ")} |`);
  lines.push("");
  lines.push(`Aggregation: ${AGGREGATION.formula}.`);
  lines.push("");
  lines.push("### 3.3 Each deployed factor's rule, as the code reads it");
  lines.push("");
  for (const factor of LIVE_FACTORS) {
    lines.push(`- **F${factor.order} ${factor.label}** (\`${factor.factor_id}\`, task \`${factor.task_id}\`) - ${factor.rule}`);
    for (const input of factor.inputs) {
      lines.push(`  - input \`${input.input}\` from ${input.source}; units ${input.units}; transform ${input.transform}; lookback ${input.lookback}; at the cutoff ${input.cutoff}`);
    }
    lines.push(`  - missing or stale: ${factor.missing_stale}`);
    lines.push(`  - code: ${factor.code_refs.join(" | ")}`);
  }
  lines.push("");
  lines.push("### 3.4 Recorded defects in that path");
  lines.push("");
  lines.push("Code facts, recorded from reading the exports. They are not findings about VIX or about the dollar, and no report is asked to accept them:");
  lines.push("");
  for (const defect of KNOWN_DEFECTS) lines.push(`- ${defect}`);
  lines.push("");
  lines.push("## 4. The data that exists, and what is stale at the cutoff");
  lines.push("");
  lines.push(AVAILABILITY_BLOCK);
  lines.push("");
  lines.push("### 4.1 Availability of each deployed factor's own inputs");
  lines.push("");
  for (const factor of LIVE_FACTORS) {
    lines.push(`- F${factor.order} ${factor.label}: history - ${factor.hist_avail} Live - ${factor.live_avail}`);
  }
  lines.push("");
  lines.push("### 4.2 Sources already reviewed for the label, and why none of them is the session label yet");
  lines.push("");
  lines.push(
    `Recorded in \`${SESSION_CONTRACT_PATH}\`. This is a factual assessment of reachability, not a conclusion about ` +
    "the factor: a report that needs an intraday dollar print should read it as the list of what this repository tried."
  );
  lines.push("");
  for (const candidate of contract.outcome_instrument.repo_candidates_reviewed) {
    lines.push(`- ${candidate.candidate}: usable for an intraday session - ${candidate.usable_for_intraday_session}. ${candidate.why}`);
  }
  lines.push(`- Fallback if the label stays unresolved: ${contract.outcome_instrument.fallback_if_unresolved}`);
  lines.push("");
  lines.push("### 4.3 Collected by the live pipeline but read by no factor");
  lines.push("");
  lines.push("Every input below is already fetched or stored, so a study of it would not start from nothing:");
  lines.push("");
  for (const entry of UNSCORED_COLLECTED_INPUTS) {
    lines.push(`- ${entry.input} - ${entry.collected} Not scored because ${entry.why_unscored}`);
  }
  lines.push("");
  lines.push("## 5. The decisions that are still open");
  lines.push("");
  lines.push(
    `Read from \`${SESSION_CONTRACT_PATH}\`; a decision frozen there leaves this list by itself. An open decision is ` +
    "not a recommendation, and neither this pack nor the report freezes any of them."
  );
  lines.push("");
  lines.push("| Decision | State | The contract's own words |");
  lines.push("| --- | --- | --- |");
  for (const row of unresolvedDecisionRows(contract)) {
    lines.push(`| ${row.decision} | ${row.state} | ${row.detail} |`);
  }
  lines.push("");
  lines.push(
    `Scoring, where the contract has decided: primary metric - ${contract.scoring.primary}; must report - ` +
    `${contract.scoring.must_report.join(", ")}. Abstention allowed: ${contract.scoring.abstention_allowed}. ` +
    `Publication of a probability: ${contract.scoring.probability_publication}.`
  );
  lines.push("");
  lines.push("## 6. What this pack is not");
  lines.push("");
  lines.push("- Not a summary of our research and not a position on VIX: it holds no conclusion, no hypothesis, no ranking and no recommendation.");
  lines.push("- Not exhaustive of the question: it describes this system. The evidence a report needs may be entirely outside it, and the brief expects that.");
  lines.push("- Not an approval of anything: a row here records what is deployed or reachable, and a defect recorded here is a code observation rather than a verdict on a factor.");
  lines.push("- Not authorisation for any change: no production, workflow, dashboard, feed, dispatcher, database or configuration change follows from it.");
  lines.push("");
  return lines.join("\n");
}

function redTeamReviewBriefMarkdown() {
  const relative = filePath => filePath.replace(`${OUT_DIR}/`, "");
  const lines = [];
  lines.push("# Independent red-team review of the VIX report - step 2 brief");
  lines.push("");
  lines.push(
    `- Task: \`${pilotBriefRow().task_id}\`. Step 2 of four of the deep-research tier ${DEEP_RESEARCH_VERSION}, context version ` +
    `${CONTEXT_VERSION}. The report under review is the return of [\`${relative(REPORT_BRIEF_PATH)}\`](${relative(REPORT_BRIEF_PATH)}).`
  );
  lines.push("- Attach the report and its source note, and nothing else about its reasoning.");
  lines.push("");
  lines.push("## 1. What you are for");
  lines.push("");
  lines.push(
    "Your job is to find what is wrong, unsupported or overstated in the report before the synthesis carries it further. " +
    "A report that survives an honest attack is worth more than a report that was never attacked, so the review is " +
    "expected to damage claims and to say which ones stood up. It is not a summary, not a rewrite and not a vote."
  );
  lines.push("");
  lines.push("## 2. Independence rules");
  lines.push("");
  lines.push("- You are not the author's session and you did not write the report; do not ask it what it meant. The report must stand on the words it contains.");
  lines.push("- Open the sources yourself wherever they are reachable, and say which ones you could re-fetch. Where a source is behind a login or a paywall and you cannot reach it, judge only on the quotation given and mark the claim's status accordingly.");
  lines.push("- Judge claims, not style, and attack the strongest version of a claim rather than a weakened one.");
  lines.push("- Say when a claim is right and only its scope is too wide: a narrower true claim is a result, not a loss.");
  lines.push("");
  lines.push("## 3. What to attack, claim by claim");
  lines.push("");
  lines.push("- Traceability: does the passage cited actually say what the claim says, and is the link the source itself rather than a summary of it?");
  lines.push("- Window: is the evidence about our 05:00 London to 05:00 London session, or about a daily close-to-close day, an intraday slice or another window, presented as if it were ours?");
  lines.push("- Instrument: is a claim really about EUR/USD, a basket or a future, presented under the DXY name?");
  lines.push("- Mechanism against measurement: is a plausible channel being used as if the relation had been measured?");
  lines.push("- Already priced: does the claim count an effect as predictive that the cutoff has already absorbed?");
  lines.push("- Identification and scope: sample period, era dependence, regime dependence, conditioning-on-the-outcome, survivorship in the sources chosen, base rates behind a conditional claim, and any number that has no stated origin.");
  lines.push("- Counter-evidence: is the strongest contrary evidence in the sources the report fetched absent, or present and dismissed without a reason?");
  lines.push("- Internal consistency: does one section contradict another, and does the what-is-not-claimed section match what the body actually does?");
  lines.push("- Overlap: does the report lean on an interaction that double-counts one input across factors, and does it say so?");
  lines.push("");
  lines.push("## 4. A verdict for every load-bearing claim");
  lines.push("");
  lines.push("- `SUPPORTED` - the sources given support it as stated.");
  lines.push("- `NARROWED` - something in it is supported, and the supported part is stated here in your own words.");
  lines.push("- `NOT_SUPPORTED` - the sources given do not support it, or contradict it; say which.");
  lines.push("- `UNASSESSABLE` - it could not be judged from the sources given; say what would settle it.");
  lines.push("");
  lines.push("For each claim also give: the claim quoted, severity (fatal, material, cosmetic), what is wrong, and the evidence that would resolve it. End with two lists: what survives the attack unchanged, and what the review could not reach at all.");
  lines.push("");
  lines.push("## 5. What to return");
  lines.push("");
  lines.push("1. The issue register, claim by claim, with the verdicts of section 4.");
  lines.push("2. The two closing lists: what survives, and what this review could not reach.");
  lines.push("3. A short note of the sources you re-fetched and those you could not, and the questions you could not resolve.");
  lines.push(
    `4. Upload it against \`${pilotBriefRow().task_id}\` in the Research Library, beside the report it attacks. An upload records ` +
    "evidence; it is not an approval, and it moves no factor's status."
  );
  lines.push("");
  lines.push("## 6. Prohibitions");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## 7. What this review is not");
  lines.push("");
  lines.push("- Not the card review of step 3: no card exists yet, and nothing here approves a hypothesis.");
  lines.push("- Not a rewrite of the report: the synthesiser revises it, and every issue you raised must be answered or left visibly open.");
  lines.push("- Not a place to impose the card rule: " + HYPOTHESIS_LIMIT_SCOPE + " A report of twenty sourced candidate relations is a better report than one with two, and the attack is on whether each of them is supported.");
  lines.push("- Not a decision on the label instrument, the missing-quote policy, the flat band or the tie rule: those are open, and this brief freezes none of them.");
  lines.push("- Not a live change of any kind: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by it.");
  lines.push("");
  return lines.join("\n");
}

function synthesisAndCardsBriefMarkdown() {
  const relative = filePath => filePath.replace(`${OUT_DIR}/`, "");
  const lines = [];
  lines.push("# Revised synthesis and structured research cards - step 3 brief");
  lines.push("");
  lines.push(
    `- Task: \`${pilotBriefRow().task_id}\`. Step 3 of four of the deep-research tier ${DEEP_RESEARCH_VERSION}, context version ` +
    `${CONTEXT_VERSION}, card schema ${CARD_SCHEMA_VERSION}.`
  );
  lines.push(
    `- Inputs: the report of [\`${relative(REPORT_BRIEF_PATH)}\`](${relative(REPORT_BRIEF_PATH)}) and the issue register of [\`${relative(RED_TEAM_BRIEF_PATH)}\`](${relative(RED_TEAM_BRIEF_PATH)}). Nothing else is synthesised.`
  );
  lines.push("");
  lines.push("## 1. What is asked");
  lines.push("");
  lines.push("Two deliverables, in this order:");
  lines.push("");
  lines.push("1. the revised report, with every issue from the register answered or left visibly open;");
  lines.push("2. one structured research card per factor the synthesis supports, on the card schema.");
  lines.push("");
  lines.push("The cards come out of the revised synthesis. A card written before the register is answered is a second draft of the first report, not a result of this step.");
  lines.push("");
  lines.push("## 2. The revised synthesis");
  lines.push("");
  lines.push("- Keep the section order of the report brief and keep the source note with it.");
  lines.push("- Mark every issue from the register as `folded` (and say what changed), `contested` (and say what evidence would settle it and why the claim is kept) or `open` (and say plainly that it is unresolved).");
  lines.push("- A claim repeated more confidently is not a claim with better evidence. Downgrade what the attack weakened, and delete what it destroyed.");
  lines.push("- Say what changed and why, in a short section of its own, so a reader can see the effect of the attack rather than having to reconstruct it.");
  lines.push("- What the sources cannot settle stays stated as such through the revision; the session's own measurement gap is stated, not filled.");
  lines.push("");
  lines.push("## 3. The structured cards");
  lines.push("");
  lines.push(
    `- Schema: \`${CARD_SCHEMA_PATH}\` (${CARD_SCHEMA_VERSION}), which extends \`${CARD_SCHEMA_BASE_PATH}\`. Field list, order and a copyable skeleton: [\`${relative(TEMPLATE_PATH)}\`](${relative(TEMPLATE_PATH)}). The factor's own assignment is its pack one level up in \`${relative(PACK_DIR)}/\`.`
  );
  lines.push(`- ${HYPOTHESIS_LIMIT_SCOPE}`);
  lines.push("- Every card carries: the session horizon block, the calendar and quote handling, what was observable at the cutoff with each input's staleness, whether the relation is a reaction or a prediction, the mechanism, the direction claim, the session role, the programmable hypotheses with the values each parameter may take, its default and the rule for choosing it on training rows only, the result that would falsify each one, the rejection test, the evidence, the limitations and the open questions.");
  lines.push("- Every claim in a card's verdict is traceable to an entry in its evidence, or is labelled as a judgement. An empty required field is not an accepted card.");
  lines.push("- Cards are tied to sessions, not to instruments: a card that needs a different window or a different instrument says so instead of borrowing ours.");
  lines.push("- A card is evidence. It is not a rule, not an approval and not a change to anything that runs.");
  lines.push("");
  lines.push("## 4. Identity, evidence and registration");
  lines.push("");
  lines.push("- One card per factor id. `card_version` increments, a revision supersedes the earlier card rather than overwriting it, and `supersedes` names it.");
  lines.push("- A card's evidence is the revised report and the register behind it: cite the entry, and keep the source note's link with it.");
  lines.push(
    `- The preliminary card of pilot 1 - recorded as preliminary, unreviewed and not backtested in \`pilot/PILOT_1_RETURN_STATUS.md\` - may be ` +
    "read as an input. Where a card contradicts it, say so; never treat it as reviewed, as tested or as the completion of the task."
  );
  lines.push(
    `- Upload the revised synthesis and the cards against \`${pilotBriefRow().task_id}\` in the Research Library. An upload records ` +
    "evidence; it is not an approval, and it moves no factor's status."
  );
  lines.push("");
  lines.push("## 5. Prohibitions");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## 6. What this step is not");
  lines.push("");
  lines.push("- Not step 4: no card is scored here, no sample, no coverage and no performance number is produced.");
  lines.push("- Not an approval: a review accepts or rejects a card, and this step is not that review.");
  lines.push("- Not a decision on the label instrument, the missing-quote policy, the flat band or the tie rule.");
  lines.push("- Not a live change of any kind: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by it.");
  lines.push("");
  return lines.join("\n");
}

function backtestHandoffBriefMarkdown() {
  const contract = sessionContract();
  const relative = filePath => filePath.replace(`${OUT_DIR}/`, "");
  const lines = [];
  lines.push("# Backtesting under a frozen session and data contract - step 4 brief");
  lines.push("");
  lines.push(
    `- Task: \`${pilotBriefRow().task_id}\`. Step 4 of four of the deep-research tier ${DEEP_RESEARCH_VERSION}, context version ` +
    `${CONTEXT_VERSION}. The candidates it may score are the cards of [\`${relative(SYNTHESIS_BRIEF_PATH)}\`](${relative(SYNTHESIS_BRIEF_PATH)}), not the prose of a report.`
  );
  lines.push(`- The design lives in \`${SESSION_CONTRACT_PATH}\`. This brief does not change it; it states what has to be closed before anything is scored.`);
  lines.push("");
  lines.push("## 1. Nothing is scored before the design is frozen");
  lines.push("");
  lines.push(
    "A number produced before the design is fixed is a number that can be fitted, and every later comparison " +
    "against it is contaminated. So the freeze comes first, in one recorded step, with the open entries of the " +
    "contract resolved in writing: the label instrument and its quote source, the missing-quote policy, the flat " +
    "band, the tie rule and the session calendar."
  );
  lines.push("");
  lines.push("## 2. What the freeze has to contain");
  lines.push("");
  lines.push(`- The session: ${HORIZON.start} to ${HORIZON.end}, Monday-to-Friday starts only, ${HORIZON.nominal_hours} nominal hours, resolved from the declared London transitions and never by adding hours, held by test over every start from 2023 to 2027.`);
  lines.push("- The session calendar: exchange holidays carried as data rather than inferred, so a holiday session is a stated exclusion and not a silent one.");
  lines.push("- The label: the instrument and the quote source that price both ends of the session. Until that is closed nothing below can be computed, because both end prints come from it. Calling the label DXY while it is priced from something else is a defect, not a simplification.");
  lines.push("- The missing-quote policy: one policy, frozen, with a session whose start or endpoint print is missing counted as a data exclusion that leaves the scored sample and is reported as coverage. The one proposed policy is that one, and it stays explicitly proposed until the freeze records it: this bundle does not freeze it and neither does the report.");
  lines.push("- The flat band and the tie rule, re-derived for this session and frozen with the rest. The closed 24-hour study's 0.1 percentage-point band was fitted to a daily index over a nominal day and may not be borrowed.");
  lines.push("- The split: which sessions are training and which are validation, fixed chronologically and declared before any result is seen. A parameter chosen on validation sessions is a parameter chosen on the answer.");
  lines.push("- The input as-of rule, per input: every value carries an observation instant at or before the cutoff, no later revision is used as if it were a first print, and a daily series is the previous close with its declared staleness rather than the same morning's print.");
  lines.push(`- The scoring: primary metric ${contract.scoring.primary}; abstention allowed (${contract.scoring.abstention_allowed}); a data exclusion and a model abstention counted and reported separately.`);
  lines.push("");
  lines.push("## 3. What any run must report");
  lines.push("");
  lines.push(`- ${contract.scoring.must_report.join("; ")}.`);
  lines.push("- Which sessions were excluded and why, so coverage can be read as coverage rather than as a result.");
  lines.push(`- The deployed engine's stored calls score on this label only as a diagnostic arm, and every table says so: ${contract.contract_vs_deployed_engine.scoring_rule}`);
  lines.push("- A parameter's chosen value, the range it was chosen from and the training-only rule that chose it, exactly as the card declared them before the run.");
  lines.push("");
  lines.push("## 4. What a passing run would not mean");
  lines.push("");
  lines.push("- Not a deployment: no weight, sign, threshold or lookback changes because a backtest passed.");
  lines.push("- Not an approval: a reviewer accepts a card on evidence, and a backtest is one input to that review.");
  lines.push(`- Not a probability: ${contract.scoring.probability_publication}.`);
  lines.push("- Not a licence to reopen the design: if the freeze has to change, the previous results are void and the freeze is recorded again before the next run.");
  lines.push("");
  lines.push("## 5. What is deliberately deferred here");
  lines.push("");
  lines.push("- The missing-quote policy stays proposed, not frozen: it is settled by the owner with the methodology review, and the VIX return is one input to that decision rather than the decision.");
  lines.push("- No per-factor interface work is added by this bundle: nothing here changes a live node, a feed, a dashboard or a configuration.");
  lines.push("- The label decision precedes everything else, and no scoring run starts while it is open.");
  lines.push("");
  lines.push("## 6. Prohibitions");
  lines.push("");
  lines.push(PROHIBITIONS);
  lines.push("");
  lines.push("## 7. What this brief is not");
  lines.push("");
  lines.push("- Not a result: it produces no number by itself and asserts none.");
  lines.push("- Not authorisation to touch the live system: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by it.");
  lines.push("");
  return lines.join("\n");
}

/** The deep-research documents, in the order a reader should meet them. */
function deepResearchDocuments() {
  return [
    { path: DEEP_RESEARCH_START_HERE_PATH, content: deepResearchStartHereMarkdown() },
    { path: REPORT_BRIEF_PATH, content: comprehensiveReportBriefMarkdown() },
    { path: NEUTRAL_CONTEXT_PACK_PATH, content: neutralContextPackMarkdown() },
    { path: RED_TEAM_BRIEF_PATH, content: redTeamReviewBriefMarkdown() },
    { path: SYNTHESIS_BRIEF_PATH, content: synthesisAndCardsBriefMarkdown() },
    { path: BACKTEST_BRIEF_PATH, content: backtestHandoffBriefMarkdown() }
  ];
}

function handoffManifest(bundleFiles) {
  const register = registerDocument();
  return {
    schema_version: "usd-research-handoff-manifest-v1",
    generated_at: EXTRACTED_AT,
    bundle: OUT_DIR,
    context_document: `${OUT_DIR}/USD_SYSTEM_CONTEXT.md`,
    context_version: CONTEXT_VERSION,
    pack_version: PACK_VERSION,
    card_schema: { path: CARD_SCHEMA_PATH, version: CARD_SCHEMA_VERSION, base: CARD_SCHEMA_BASE_PATH },
    catalogue: {
      path: CATALOG_PATH,
      live_factors: LIVE_FACTORS.length,
      session_factors: SESSION_FACTOR_BRIEFS.length,
      total_factors: LIVE_FACTORS.length + SESSION_FACTOR_BRIEFS.length,
      agreement: "Checked by the builder before anything is written: the ten live factor ids, labels, group, role, research status and both weight columns must match the committed catalogue, the fifteen authored session briefs must cover the catalogue's non-live factors exactly, and a blocked factor must carry its blocker."
    },
    extraction: {
      branch: EXTRACTION_BRANCH,
      commit: EXTRACTION_COMMIT,
      deployed_workflow: DEPLOYED_WORKFLOW,
      collector_workflow: COLLECTOR_WORKFLOW,
      runtime: RUNTIME
    },
    counts: {
      factors: register.factors.length,
      packs: factorBriefRows().length,
      live_packs: LIVE_FACTORS.length,
      session_packs: SESSION_FACTOR_BRIEFS.length,
      deep_research_documents: deepResearchDocuments().length,
      deep_research_steps: DEEP_RESEARCH_STEPS.length,
      defects: register.defects.length,
      unscored_collected_inputs: register.unscored_collected_inputs.length,
      open_questions: factorBriefRows().reduce((total, row) => total + row.questions.length, 0),
      pilot_packages: 1
    },
    brief_index: BRIEF_INDEX_PATH,
    download: { path: ZIP_PATH, root: ZIP_ROOT },
    deep_research: {
      version: DEEP_RESEARCH_VERSION,
      directory: DEEP_RESEARCH_DIR,
      primary_deliverable: PRIMARY_DELIVERABLE,
      start_here: DEEP_RESEARCH_START_HERE_PATH,
      report_brief: REPORT_BRIEF_PATH,
      context_pack: NEUTRAL_CONTEXT_PACK_PATH,
      red_team_brief: RED_TEAM_BRIEF_PATH,
      synthesis_brief: SYNTHESIS_BRIEF_PATH,
      backtest_brief: BACKTEST_BRIEF_PATH,
      report: {
        factor_id: PILOT_FACTOR_ID,
        task_id: pilotBriefRow().task_id,
        subject: "VIX and its interactions with the other factors, against the subsequent direction of the US dollar over the session below.",
        context_source: SESSION_CONTRACT_PATH
      },
      sequence: DEEP_RESEARCH_STEPS.map(step => `${step.step}. ${step.name}`),
      hypothesis_limit_scope: HYPOTHESIS_LIMIT_SCOPE,
      context_not_limit: CONTEXT_AND_LIMIT,
      note:
        "The primary deliverable of this handoff is the report of step 1, not a research card. The tier is " +
        "versioned separately from the packs (pack version 2.0.0) and from the frozen pilot package (1.0.0), so " +
        "correcting the programme moved no dispatched byte: the twenty-five briefs, the card schema, the template " +
        "and the pilot archive are the same bytes they were before this tier existed. The context pack is generated " +
        "from the session contract, the committed catalogue and the extracted register, and the builder refuses to " +
        "write when the contract and the bundle disagree."
    },
    pilot: {
      package: PILOT_ZIP_PATH,
      package_root: PILOT_ZIP_ROOT,
      package_version: PILOT_VERSION,
      start_here: PILOT_START_HERE_PATH,
      factor_id: PILOT_FACTOR_ID,
      brief: pilotBriefRow().pack_path,
      template: TEMPLATE_PATH,
      card_schema: CARD_SCHEMA_PATH,
      note:
        "The first pilot package: one brief (the VIX baseline audit) with the output template and the full " +
        "card schema, in one archive. The brief's field list names the card's fields; the schema carries the " +
        "JSON structure they live in, so the pilot cannot be run from the field list alone. The brief, the " +
        "template and the schema inside the archive are the same bytes as the files at the paths above."
    },
    files: bundleFiles.map(file => ({ path: file.path, bytes: asBuffer(file.content).length, sha256: sha256(file.content) })),
    sources: [
      { path: CATALOG_PATH, note: "Authority for all twenty-five USD factor rows and for which library task covers each session factor." },
      { path: SESSION_CONTRACT_PATH, note: "The session contract: horizon, weekday and DST rule, the label's verification state, the open decisions and the scoring design the context pack states." },
      { path: "exports/usd_layer1_agent.json", note: "The published call's conviction node and the input pack." },
      { path: "exports/usd_collector.json", note: "The collector's normalising node and the inputs it stores." },
      { path: "logic/agent_usd_direction.md", note: "The rulebook the workflow fetches on every run." },
      { path: `${OUT_DIR}/USD_SYSTEM_CONTEXT.md`, note: "The shared context document of this bundle." }
    ],
    manifest_note:
      "This file does not hash itself, and the zip holds every other generated file except this manifest, so " +
      "nothing here hashes a file that contains it. The hashes above cover every other generated file in the " +
      "bundle, so a stale artefact is detectable; the sources are recorded rather than enforced, because a " +
      "source may legitimately change after the bundle was written, and the write mode refreshes both.",
    not_claimed: [
      "No live deployment, workflow, dashboard, feed or database change was made or is authorised by this bundle.",
      "No backtest was run for any factor here and no performance figure is asserted anywhere in it.",
      "A pack is an assignment, a passing schema check is not a review, and a reviewed hypothesis is not a tested one."
    ]
  };
}

function trackerDocument() {
  const catalogue = catalogueLiveFactors();
  const briefRows = factorBriefRows();
  const liveTasks = LIVE_FACTORS.map(factor => {
    const row = catalogue.find(entry => entry.factor_id === factor.factor_id) || {};
    const research = row.research_status || "ready";
    const blockers = Array.isArray(row.blockers) ? row.blockers.slice() : [];
    return {
      task_id: factor.task_id,
      factor_id: factor.factor_id,
      order: factor.order,
      position: (briefRows.find(entry => entry.factor_id === factor.factor_id) || {}).position || null,
      kind: "baseline_audit",
      label: factor.label,
      asset: "USD",
      group: factor.group,
      role: factor.role,
      card_role: cardRoleFor(factor.role),
      role_note: "The catalogue's role is a display string; a card's session_role field must use card_role.",
      pack_family: factor.family,
      card_family: cardFamilyFor(factor.family),
      pack_path: packPathFor(factor),
      card_schema: CARD_SCHEMA_PATH,
      card_schema_version: CARD_SCHEMA_VERSION,
      context_version: CONTEXT_VERSION,
      pack_version: PACK_VERSION,
      research_status: research,
      review_status: row.review_status || "pending",
      backtest_status: row.backtest_status || "not_tested",
      blockers,
      next_action: research === "blocked" && blockers.length
        ? `Resolve the blocker before a card can be written: ${blockers.join("; ")}`
        : "Hand the pack to a field model, then send the returned card to reviewer A against the same pack.",
      open_questions: factor.pack.questions.length
    };
  });

  const sessionTasks = briefRows
    .filter(entry => !entry.live)
    .map(entry => ({
      task_id: entry.task_id,
      factor_id: entry.factor_id,
      order: null,
      position: entry.position,
      kind: "research_assignment",
      label: entry.label,
      asset: "USD",
      group: entry.group,
      role: entry.role,
      card_role: entry.card_role,
      role_note: "The catalogue's role is a display string; a card's session_role field must use card_role.",
      card_family: entry.card_family,
      pack_path: entry.pack_path,
      card_schema: CARD_SCHEMA_PATH,
      card_schema_version: CARD_SCHEMA_VERSION,
      context_version: CONTEXT_VERSION,
      pack_version: PACK_VERSION,
      research_status: entry.research_status,
      review_status: entry.review_status,
      backtest_status: entry.backtest_status,
      blockers: entry.blockers,
      dependencies: entry.dependencies,
      next_action: entry.research_status === "blocked" && entry.blockers.length
        ? `Resolve the blocker before a card can be written: ${entry.blockers.join("; ")}`
        : `Hand ${entry.pack_path} to a field model, then send the returned card to reviewer A against the same pack.`,
      open_questions: entry.questions.length
    }));

  const tasks = [...liveTasks, ...sessionTasks];

  const byStatus = {};
  for (const task of tasks) byStatus[task.research_status] = (byStatus[task.research_status] || 0) + 1;

  return {
    schema_version: "research-handoff-tracker-tasks-v1",
    generated_at: EXTRACTED_AT,
    asset: "USD",
    authority: {
      path: CATALOG_PATH,
      rule:
        "Statuses are copied from the committed catalogue by factor_id when this file is written. The file is a projection " +
        "for a task tracker, it is never edited by hand, and it never becomes a second source of truth."
    },
    context_document: `${OUT_DIR}/USD_SYSTEM_CONTEXT.md`,
    context_version: CONTEXT_VERSION,
    pack_version: PACK_VERSION,
    tasks,
    totals: {
      tasks: tasks.length,
      live_tasks: liveTasks.length,
      session_tasks: sessionTasks.length,
      blocked: tasks.filter(task => task.research_status === "blocked").length,
      by_research_status: byStatus,
      open_questions: tasks.reduce((total, task) => total + task.open_questions, 0)
    }
  };
}

function startHereMarkdown(register) {
  const rows = factorBriefRows();
  const scope = catalogueScope();
  const relative = filePath => filePath.replace(`${OUT_DIR}/`, "");
  const sessionBreakdown = Object.entries(scope.sessionGroups)
    .map(([group, count]) => `${count} in \`${group}\``)
    .join(", ");
  const lines = [];

  lines.push("# USD research handoff - start here");
  lines.push("");
  lines.push(`Generated ${EXTRACTED_AT} on branch \`${EXTRACTION_BRANCH}\` at \`${EXTRACTION_COMMIT}\`. Context version ${CONTEXT_VERSION}, pack version ${PACK_VERSION}.`);
  lines.push("");
  lines.push(`This bundle is the standardised handoff for the USD research programme: ${rows.length} self-contained briefs, one per USD factor in the committed Research Library catalogue, each carrying its own context, its research prompt and its output instructions. Hand one brief to one model and a card comes back. Nothing here is a forecast, a performance number or an approval.`);
  lines.push("");
  lines.push(`Every brief uses one session: ${HORIZON.start} to ${HORIZON.end}. Missing quotes have one proposed policy, to be frozen before any candidate is scored: a session whose start or endpoint print is missing is a data exclusion - it leaves the scored sample and is counted as coverage, and nothing is filled, forward-carried or interpolated. A data exclusion is not a model abstention, and the two are counted and scored separately. The label's flat band and the study's own tie policy for scoring are still undecided and are assumed by no brief.`);
  lines.push("");
  lines.push("## Download");
  lines.push("");
  lines.push(`- The whole bundle as one archive: [\`${relative(ZIP_PATH)}\`](${relative(ZIP_PATH)}) - every file below, ${rows.length} briefs and the deep-research tier included, stored uncompressed so the archive is reproducible.`);
  lines.push(`- The same list as data: [\`${relative(BRIEF_INDEX_PATH)}\`](${relative(BRIEF_INDEX_PATH)}) - factor id, label, half, covering task, status and pack path for all ${rows.length} briefs.`);
  lines.push(`- The deep-research tier, which is the primary deliverable: [\`${relative(DEEP_RESEARCH_START_HERE_PATH)}\`](${relative(DEEP_RESEARCH_START_HERE_PATH)}), with the report brief [\`${relative(REPORT_BRIEF_PATH)}\`](${relative(REPORT_BRIEF_PATH)}) and the neutral context pack [\`${relative(NEUTRAL_CONTEXT_PACK_PATH)}\`](${relative(NEUTRAL_CONTEXT_PACK_PATH)}).`);
  lines.push(`- The first pilot package, the VIX brief with the output template and the full card schema in one archive: [\`${relative(PILOT_ZIP_PATH)}\`](${relative(PILOT_ZIP_PATH)}), opening at [\`${relative(PILOT_START_HERE_PATH)}\`](${relative(PILOT_START_HERE_PATH)}).`);
  lines.push("");
  lines.push("## The primary deliverable, and where a card sits");
  lines.push("");
  lines.push(PRIMARY_DELIVERABLE);
  lines.push("");
  lines.push(
    `The report is step 1 of [\`${relative(DEEP_RESEARCH_START_HERE_PATH)}\`](${relative(DEEP_RESEARCH_START_HERE_PATH)}); an independent red-team review is step 2, ` +
    "the revised synthesis with its structured research cards is step 3, and backtesting under a frozen session and data contract is step 4. The " +
    `${rows.length} briefs below are the card step, so a returned card is a later output and not a substitute for the report.`
  );
  lines.push("");
  lines.push("## The twenty-five briefs");
  lines.push("");
  lines.push("| # | Factor id | Label | Half | Covered by | Research | Brief |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const half = row.live ? "deployed baseline audit" : "session research";
    const task = row.task_id ? `\`${row.task_id}\`` : "no task";
    lines.push(`| ${row.position} | \`${row.factor_id}\` | ${row.label} | ${half} | ${task} | ${row.research_status} | [\`${relative(row.pack_path)}\`](${relative(row.pack_path)}) |`);
  }
  lines.push("");
  lines.push(`All ${scope.total} USD factors in the committed catalogue (\`${CATALOG_PATH}\`) have exactly one brief here: ${scope.live} deployed factors, whose packs audit code that runs, and ${scope.session} session-research factors (${sessionBreakdown}), which have no rule in force. A brief is an assignment, so a returned card is evidence; it becomes a rule only after a review accepts it and a backtest supports it.`);
  lines.push("");
  lines.push("## How to run one brief");
  lines.push("");
  lines.push("1. Open the brief you want from the table above, or take the same brief from the Research Library tab of the dashboard, where each of the 25 factors carries its own Copy prompt and Download actions.");
  lines.push("2. Paste it into your own ChatGPT session. Nothing in this repository calls a model API, and no brief authorises a workflow, feed, dashboard or configuration change.");
  lines.push(`3. Return one JSON card per brief, following [\`${relative(CARD_SCHEMA_PATH)}\`](${relative(CARD_SCHEMA_PATH)}) (${CARD_SCHEMA_VERSION}) and the template \`${relative(TEMPLATE_PATH)}\`, then upload it against the covering task id. An upload records evidence; it is not an approval.`);
  lines.push("4. Send the returned cards to reviewer A and reviewer B, who now cover all twenty-five entries and their overlaps, then to the synthesis.");
  lines.push("");
  lines.push("## Read in this order");
  lines.push("");
  lines.push(`1. \`${relative(`${OUT_DIR}/USD_SYSTEM_CONTEXT.md`)}\` - the system as it is: objective, the path from inputs to the published call, the rules and weights that execute, the code, the defects and the source table.`);
  lines.push(`2. \`${relative(REGISTER_MD_PATH)}\` and \`${relative(REGISTER_JSON_PATH)}\` - the ${register.factors.length} deployed factors with their rules, inputs, weights, availability and open questions.`);
  lines.push(`3. \`${PACK_DIR.replace(`${OUT_DIR}/`, "")}/\` - the ${rows.length} briefs, one per factor. Hand one brief to one frontier model.`);
  lines.push(`4. \`${relative(TEMPLATE_PATH)}\` and \`${relative(CARD_SCHEMA_PATH)}\` - what comes back and how it is validated.`);
  lines.push(`5. \`${relative(TRACKER_PATH)}\` - all ${rows.length} briefs as tracker rows, with statuses copied from the committed catalogue.`);
  lines.push(`6. \`${relative(MANIFEST_PATH)}\` - what was generated, with a hash for every other file in the bundle.`);
  lines.push("");
  lines.push("## What is not claimed");
  lines.push("");
  for (const claim of handoffManifest([]).not_claimed) lines.push(`- ${claim}`);
  lines.push(`- A brief states a question, not a finding. Coverage of ${rows.length} of ${scope.total} factors says every factor has an assignment; it says nothing about any factor's behaviour.`);
  lines.push("");
  lines.push("## Regenerating it");
  lines.push("");
  lines.push(`\`node scripts/build_research_handoff.js write\` rebuilds every file here, including the archive, and \`check\` fails if any of them is stale, if the register contradicts \`${CATALOG_PATH}\`, or if the catalogue's session factors and the authored briefs disagree.`);
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// The first pilot package. The VIX brief's own section 7 lists the card's field
// names and points at the template and the schema; a pilot return needs the three
// together, because the schema is what states the complete JSON structure - which
// fields are required, the nested objects and their required keys, the enums and
// the length minimums - and the field list alone does not.
// ---------------------------------------------------------------------------

function pilotBriefRow() {
  const row = factorBriefRows().find(item => item.factor_id === PILOT_FACTOR_ID);
  if (!row) throw new Error(`${PILOT_FACTOR_ID} is not one of the briefs this bundle publishes`);
  return row;
}

function pilotStartHereMarkdown() {
  const row = pilotBriefRow();
  const briefFile = row.pack_path.replace(`${PACK_DIR}/`, "");
  const lines = [];

  lines.push("# USD research pilot 1 - the VIX baseline audit as one package");
  lines.push("");
  lines.push(`Generated ${EXTRACTED_AT} on branch \`${EXTRACTION_BRANCH}\` at \`${EXTRACTION_COMMIT}\`. Pilot package ${PILOT_VERSION}, context version ${CONTEXT_VERSION}, pack version ${PACK_VERSION}, card schema ${CARD_SCHEMA_VERSION}.`);
  lines.push("");
  lines.push(`This package is one brief, not the programme: the VIX factor \`${row.factor_id}\` (task \`${row.task_id}\`), the output template that shows the shape of a return, and the complete card schema. The three are packed together because the brief lists the card's field names while the schema states the JSON structure those names live in - which block is required, which fields are objects, what those objects must contain, which values are allowed and where a list or a string has a minimum length. A return assembled from the field list alone is not a valid card.`);
  lines.push("");
  lines.push("## What is inside");
  lines.push("");
  lines.push(`- \`${briefFile}\` - the brief, byte-identical to the bundle's own \`packs/${briefFile}\`. It carries the session, the deployed baseline for this factor, the research prompt, the prohibitions and the output instructions.`);
  lines.push("- `RESEARCH_OUTPUT_TEMPLATE.md` - the same field list in the order the card must carry it, with the placeholders a return replaces.");
  lines.push(`- \`research_card.schema.json\` (${CARD_SCHEMA_VERSION}) - the structure a returned card is validated against, extending \`${CARD_SCHEMA_BASE_PATH}\`.`);
  lines.push("- `VIX_PILOT_START_HERE.md` - this note.");
  lines.push("");
  lines.push("## How the pilot runs");
  lines.push("");
  lines.push(`1. Read \`${briefFile}\` first; it is the brief and it is self-contained for everything except the structure of the return.`);
  lines.push("2. Open the schema before writing: every field of the card is listed in the brief, but the required blocks (`session_horizon`, `calendar_and_quote_handling`, `observable_by_cutoff`, `historical_data_requirements`, `live_data_requirements`, `missing_or_stale_handling`, `dependencies_and_overlap`, `evidence`, `limitations`, `open_questions`) carry their own required keys, and the enums are closed.");
  lines.push("3. Paste the brief into your own model session. Nothing in this repository calls a model API, and no brief authorises a workflow, feed, dashboard or configuration change.");
  lines.push(`4. Return one JSON document for the factor, following the schema, plus the short note the brief asks for: every source you actually fetched, with its link and the passage you relied on, and the questions you could not resolve. Upload it against \`${row.task_id}\` in the Research Library. An upload records evidence; it is not an approval.`);
  lines.push("");
  lines.push("## What this pilot is and is not");
  lines.push("");
  lines.push(`- It is a **baseline audit**: the VIX factor is one of the ten the deployed node computes today (${DEPLOYED_WORKFLOW}), so the question is whether the deployed sign, weight, threshold and lookback are justified, and the deployed values are the object of the audit rather than evidence for the claim.`);
  lines.push("- It is not a review, a backtest or a rule. A returned card is evidence; it becomes a rule only after a review accepts it and a backtest supports it.");
  lines.push("- It asserts nothing about this factor's behaviour: no accuracy, no sample size and no performance number exists for it here, and none may be invented.");
  for (const claim of handoffManifest([]).not_claimed) lines.push(`- ${claim}`);
  lines.push("");
  lines.push("## The prohibitions the brief carries");
  lines.push("");
  for (const line of PROHIBITIONS.split("\n")) lines.push(line);
  lines.push("");
  lines.push("## Answers to anticipate");
  lines.push("");
  lines.push("- A return that says part of the mechanism cannot be tested on this horizon with the data that is reachable is a valid return; the brief asks for it to be stated plainly rather than substituted.");
  lines.push("- Every parameter you propose must carry the values you allow, a default and the rule for choosing it on training sessions only, declared before validation.");
  lines.push("");
  lines.push(`The whole bundle, all ${factorBriefRows().length} briefs, is one level up: \`${START_HERE_PATH.replace(`${OUT_DIR}/`, "")}\` describes it.`);
  lines.push("");
  return lines.join("\n");
}

function buildPilot(files) {
  const briefPath = pilotBriefRow().pack_path;
  const byPath = new Map(files.map(file => [file.path, file]));
  const note = pilotStartHereMarkdown();
  // The note is the package's own file; the other three are the bundle's files, byte for byte, so the
  // package cannot drift from the bundle it came out of. Only the note and the archive join the bundle.
  const members = [
    { name: "VIX_PILOT_START_HERE.md", content: note },
    { name: briefPath.split("/").pop(), content: byPath.get(briefPath).content },
    { name: "RESEARCH_OUTPUT_TEMPLATE.md", content: byPath.get(TEMPLATE_PATH).content },
    { name: "research_card.schema.json", content: byPath.get(CARD_SCHEMA_PATH).content }
  ];
  const zip = {
    path: PILOT_ZIP_PATH,
    // Flat inside the archive: the pilot is four files a reader takes out and puts side by side.
    content: zipStore(members.map(member => ({
      name: `${PILOT_ZIP_ROOT}/${member.name}`,
      content: asBuffer(member.content)
    })))
  };
  return { members, zip, files: [{ path: PILOT_START_HERE_PATH, content: note }, zip] };
}

function buildBundle() {
  const register = registerDocument();
  const files = [];

  files.push({ path: REGISTER_JSON_PATH, content: `${JSON.stringify(register, null, 2)}\n` });
  files.push({ path: REGISTER_MD_PATH, content: registerMarkdown(register) });
  for (const row of factorBriefRows()) {
    files.push({ path: row.pack_path, content: row.live && row.register ? packMarkdown(row.register) : sessionPackMarkdown(row) });
  }
  files.push({ path: BRIEF_INDEX_PATH, content: `${JSON.stringify(briefIndexDocument(), null, 2)}\n` });
  files.push({ path: TEMPLATE_PATH, content: outputTemplateMarkdown() });
  files.push({ path: CARD_SCHEMA_PATH, content: `${JSON.stringify(cardSchemaV3(), null, 2)}\n` });
  files.push({ path: TRACKER_PATH, content: `${JSON.stringify(trackerDocument(), null, 2)}\n` });
  files.push({ path: START_HERE_PATH, content: startHereMarkdown(register) });
  // The deep-research tier: the primary deliverable of this handoff and the three steps after it.
  for (const file of deepResearchDocuments()) files.push(file);
  // The pilot package is one brief plus the two files its section 7 points at. It is built before the
  // bundle archive so the archive carries it too, and its own zip is stored rather than compressed.
  for (const file of buildPilot(files).files) files.push(file);
  files.push({
    path: ZIP_PATH,
    content: zipStore(files.map(file => ({
      name: `${ZIP_ROOT}/${file.path.replace(`${OUT_DIR}/`, "")}`,
      content: asBuffer(file.content)
    })))
  });
  files.push({ path: MANIFEST_PATH, content: `${JSON.stringify(handoffManifest(files), null, 2)}\n` });

  return files;
}

function main() {
  const mode = process.argv[2];
  if (mode !== "write" && mode !== "check") {
    console.error("usage: node scripts/build_research_handoff.js write|check");
    process.exit(2);
  }

  const problems = catalogueAgreementProblems().concat(catalogueBriefProblems(), contractAgreementProblems());
  if (problems.length) {
    console.error(`refusing to ${mode}: the bundle contradicts the catalogue or the session contract`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  let files;
  try {
    files = buildBundle();
  } catch (error) {
    console.error(`refusing to ${mode}: ${error.message}`);
    process.exit(1);
  }

  if (mode === "write") {
    for (const file of files) {
      const absolute = path.join(ROOT, file.path);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, asBuffer(file.content));
    }
    console.log(`wrote ${files.length} files under ${OUT_DIR} for ${factorBriefRows().length} factors`);
    return;
  }

  const stale = [];
  for (const file of files) {
    const absolute = path.join(ROOT, file.path);
    if (!fs.existsSync(absolute) || !fs.readFileSync(absolute).equals(asBuffer(file.content))) stale.push(file.path);
  }

  if (stale.length) {
    console.error(`checked ${files.length} files under ${OUT_DIR}: ${stale.length} missing or stale`);
    for (const file of stale) console.error(`- ${file}`);
    console.error("run: node scripts/build_research_handoff.js write");
    process.exit(1);
  }

  console.log(`checked ${files.length} files under ${OUT_DIR}: all current, one brief per factor for ${factorBriefRows().length} factors, and the briefs agree with ${CATALOG_PATH}`);
}

module.exports = {
  LIVE_FACTORS,
  SESSION_FACTOR_BRIEFS,
  CODED_WEIGHTS,
  RULEBOOK_WEIGHTS,
  RULEBOOK_SOURCE,
  AGGREGATION,
  MODIFIERS,
  KNOWN_DEFECTS,
  UNSCORED_COLLECTED_INPUTS,
  ENGINE_BLOCK,
  AVAILABILITY_BLOCK,
  PROHIBITIONS,
  CARD_FIELDS,
  CARD_FAMILIES,
  CARD_SCHEMA_PATH,
  CARD_SCHEMA_VERSION,
  CARD_SCHEMA_BASE_PATH,
  TEMPLATE_PATH,
  CATALOG_PATH,
  OUT_DIR,
  PACK_DIR,
  REGISTER_JSON_PATH,
  TRACKER_PATH,
  MANIFEST_PATH,
  START_HERE_PATH,
  BRIEF_INDEX_PATH,
  ZIP_PATH,
  ZIP_ROOT,
  PILOT_DIR,
  PILOT_START_HERE_PATH,
  PILOT_ZIP_PATH,
  PILOT_ZIP_ROOT,
  PILOT_VERSION,
  PILOT_FACTOR_ID,
  DEEP_RESEARCH_DIR,
  DEEP_RESEARCH_VERSION,
  DEEP_RESEARCH_START_HERE_PATH,
  REPORT_BRIEF_PATH,
  NEUTRAL_CONTEXT_PACK_PATH,
  RED_TEAM_BRIEF_PATH,
  SYNTHESIS_BRIEF_PATH,
  BACKTEST_BRIEF_PATH,
  SESSION_CONTRACT_PATH,
  PRIMARY_DELIVERABLE,
  DEEP_RESEARCH_STEPS,
  HYPOTHESIS_LIMIT_SCOPE,
  CONTEXT_AND_LIMIT,
  sessionContract,
  contractAgreementProblems,
  unresolvedDecisionRows,
  deepResearchStartHereMarkdown,
  comprehensiveReportBriefMarkdown,
  neutralContextPackMarkdown,
  redTeamReviewBriefMarkdown,
  synthesisAndCardsBriefMarkdown,
  backtestHandoffBriefMarkdown,
  deepResearchDocuments,
  CONTEXT_VERSION,
  PACK_VERSION,
  EXTRACTED_AT,
  HORIZON,
  TARGET,
  packPathFor,
  cardFamilyFor,
  cardRoleFor,
  catalogueLiveFactors,
  catalogueSessionFactors,
  catalogueTaskByFactor,
  factorBriefRows,
  catalogueBriefProblems,
  catalogueAgreementProblems,
  catalogueScope,
  registerDocument,
  registerMarkdown,
  packMarkdown,
  sessionPackMarkdown,
  briefIndexDocument,
  cardSchemaV3,
  cardSkeleton,
  outputTemplateMarkdown,
  zipStore,
  crc32,
  handoffManifest,
  pilotBriefRow,
  pilotStartHereMarkdown,
  buildPilot,
  trackerDocument,
  startHereMarkdown,
  buildBundle,
  main
};

if (require.main === module) main();







