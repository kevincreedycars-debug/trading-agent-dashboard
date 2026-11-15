"use strict";

/**
 * The 4 November 2026 final adjudication, reduced to the table the panel needs (research only).
 *
 * The backtester's own claim, written on 2026-11-08, was that twenty-four of the twenty-five factor chains
 * had no adjudication and that the VIX chain's research was the only delivered stage. That claim was true of
 * the committed Research Library registry it joined against, and false of the research itself: on 2026-11-04
 * the same programme registered twenty-five factor adjudications, a final analysis, a final red-team and a
 * final adjudication, 27 files whose ids and SHA-256 hashes the adjudication's own header records. Those
 * bytes live in the hosted store and on `research/usd-f2-stage1-20261103`; they never entered
 * `data/research-library/documents.json`, so every registry-driven reader still saw "0 of 25".
 *
 * This module closes that gap in one direction only: it takes what the adjudication concluded and writes it
 * against each of the twenty-five catalogue factor ids, together with what data actually existed at the
 * cutoff, so the panel can answer, for one morning at a time:
 *
 *   which factor voted, which one only shaped the conviction, which one was counted inside another factor,
 *   which one the research says to leave out, and which one had no data at 05:00 at all.
 *
 * Nothing here re-decides a finding, moves a weight or scores a factor. `verdict` is the adjudication's own
 * Q1 disposition, shortened; `reason` states why the implemented rule treats the factor the way it does.
 * Every row carries the registered document id and hash it was read from.
 */

const fs = require("node:fs");
const path = require("node:path");

const inputs = require("./inputs");

const MANIFEST_PATH = path.join(
  inputs.REPO_ROOT,
  "data",
  "research",
  "usd-session",
  "final-adjudication-manifest.json"
);

const ADJUDICATION_DOC =
  "docs/research/final/usd/final-asset-analysis/USD_Asset_Level_Final_Adjudication_Stage3_2026-11-04.md";

const ADJUDICATION_DATE = "2026-11-04";

/** The six things a factor can do to a morning's call. These are the panel's column values. */
const EFFECTS = Object.freeze({
  direction: "Direction",
  conviction: "Conviction only",
  no_call: "No call",
  counted_elsewhere: "Counted elsewhere",
  excluded: "Deliberately excluded",
  missing: "Missing data"
});

/** What the data behind a factor looked like in this checkout, independently of whether it voted. */
const DATA_CLASSES = Object.freeze({
  intraday_bar: "Hourly bar at the cutoff",
  daily_close: "Daily close, printed before the cutoff",
  derived_only: "No independent series exists",
  register_metadata: "The run's own integrity ledger",
  absent: "Not available at the cutoff"
});

/** What stands between a factor and a validated place in the model. One class per factor. */
const GAPS = Object.freeze({
  code: "Needs code",
  data: "Needs historical data",
  exclusion: "Exclusion the research supports"
});

/**
 * The twenty-five rows.
 *
 * `inputs` names the snapshot values the factor is read from; `mechanisms` names the challenger v1
 * mechanisms that carry it; `treatment` is the designed effect when the input is present (a day can downgrade
 * `direction` to `conviction` or `missing`, never the other way round).
 */
const REVIEW = Object.freeze([
  Object.freeze({
    factor_id: "live.f1-vix-level",
    label: "F1 VIX level and risk regime",
    disposition: "Blocked",
    verdict:
      "Exact-session direction and incremental value are unmeasured; conditional regime candidates only.",
    candidate: "Cboe spot VIX: level and delta(K), signs unresolved, source-specific age required.",
    data_class: "daily_close",
    inputs: Object.freeze(["vix_level", "vix_d5_chg"]),
    mechanisms: Object.freeze(["vix_regime", "vix_momentum"]),
    treatment: "direction",
    gap: "code",
    reason:
      "The only chain with a delivered research report, and the adjudication still blocks it: the level is a " +
      "last-close read with an unarchived receipt clock, and the 16/25 pair is a rulebook threshold with no " +
      "accepted exact-session advantage. It votes because the published rule states a direction, not because " +
      "the research measured one."
  }),
  Object.freeze({
    factor_id: "risk.vix-level-and-change-at-cutoff",
    label: "VIX level and change at the cutoff",
    disposition: "Blocked",
    verdict: "Matched spot VIX duplicates F1; consolidate ownership and remove any independent duplicate vote.",
    candidate: "Same VIX lineage as F1; a close-to-cutoff change only if both actual observations exist.",
    data_class: "daily_close",
    inputs: Object.freeze(["vix_level", "vix_d5_chg"]),
    mechanisms: Object.freeze(["vix_regime", "vix_momentum"]),
    treatment: "counted_elsewhere",
    gap: "exclusion",
    reason:
      "The adjudication's explicit instruction is that this chain must not carry a second vote on the same " +
      "morning's VIX. It is read through F1's two mechanisms and adds nothing of its own."
  }),
  Object.freeze({
    factor_id: "live.f2-us-2y-delta",
    label: "F2 US 2Y yield delta",
    disposition: "Blocked",
    verdict: "A plausible policy channel does not establish next-session direction; no fixed sign or weight survives.",
    candidate: "FRED/H.15 DGS2: level and delta(K) in bp, sign unresolved, publication and receipt required.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_2y_yield", "us_2y_d5_bps"]),
    mechanisms: Object.freeze(["us_2y"]),
    treatment: "direction",
    gap: "code",
    reason:
      "The 5-day DGS2 change is present at every cutoff, so the factor can vote; the sign (+ for higher " +
      "front-end yields) is the published rulebook's, which the adjudication declined to validate."
  }),
  Object.freeze({
    factor_id: "live.f3-us-de-2y-spread-delta",
    label: "F3 US-DE 2Y spread delta",
    disposition: "Blocked",
    verdict: "Relative-policy mechanism survives; the exact-session predictive contribution has no measurement.",
    candidate: "DGS2 against a German 2Y series whose source, convention and calendar are unresolved.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_2y_yield", "de_2y_yield"]),
    mechanisms: Object.freeze([]),
    treatment: "direction",
    gap: "code",
    reason:
      "Both legs are now staged: FRED DGS2 and the Bundesbank BBSIS daily 2.0-year zero-coupon spot rate, each read at " +
      "05:00 London from the newest observation strictly older than the session date. The differential is present on " +
      "every replayed morning, but the frozen RG-1 change (2026-11-13) is an experimental rule and the convention is " +
      "not the CMT/Schatz equality the adjudication refused, so nothing here validates the factor."
  }),
  Object.freeze({
    factor_id: "live.f4-real-yield-delta",
    label: "F4 US 10Y real yield delta",
    disposition: "Blocked",
    verdict: "Real-rate mechanisms survive conditionally; exact-session direction is unmeasured.",
    candidate: "DFII10 level and delta(K); optional DFII5 and matched nominals; no independent triple.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_10y_real_yield", "us_10y_real_d5_bps"]),
    mechanisms: Object.freeze(["us_10y_real"]),
    treatment: "direction",
    gap: "code",
    reason:
      "DFII10's 5-day change is in the frame at every cutoff and carries one vote; the adjudication keeps " +
      "the real-rate channel as a candidate and refuses to call the sign established."
  }),

  Object.freeze({
    factor_id: "rates.us-front-end-delta",
    label: "US front-end delta",
    disposition: "Blocked",
    verdict: "Exact-session benefit of front-end innovations is unmeasured; DGS2 alone duplicates F2.",
    candidate: "DGS2 plus a named bill or 3M series; a spread only after explicit harmonisation.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_2y_yield", "us_3m_yield"]),
    mechanisms: Object.freeze(["us_2y"]),
    treatment: "counted_elsewhere",
    gap: "exclusion",
    reason:
      "The US leg is the same DGS2 coordinate F2 already reads, and the bill leg adds no established " +
      "information at this horizon; it is read through F2's mechanism with no extra weight."
  }),
  Object.freeze({
    factor_id: "rates.relative-front-end-delta",
    label: "Relative front-end delta",
    disposition: "Blocked",
    verdict: "Relative policy is supported as a channel, not as an established London-session forecast.",
    candidate: "Foreign front-end series against a matched US leg; country set, curve type and sources unresolved.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_2y_yield", "de_2y_yield"]),
    mechanisms: Object.freeze([]),
    treatment: "direction",
    gap: "code",
    reason:
      "One foreign front end is staged (Germany, Bundesbank BBSIS 2.0-year spot) against the matched US DGS2 leg, so " +
      "the five-business-day differential change RG-1 reads exists on 661 of 725 mornings. It shares RG-1's vote " +
      "with F3 by construction, which is the same counting rule v1 applies to every shared source."
  }),
  Object.freeze({
    factor_id: "rates.real-yield-delta",
    label: "Real yield delta",
    disposition: "Blocked",
    verdict: "Real-rate and maturity-shape hypotheses remain unvalidated for the exact target.",
    candidate: "DFII10, optional DFII5, real-curve difference or a matched breakeven basis.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_10y_real_yield", "us_10y_real_d5_bps"]),
    mechanisms: Object.freeze(["us_10y_real"]),
    treatment: "counted_elsewhere",
    gap: "exclusion",
    reason:
      "The same DFII10 coordinate as F4; the 5-year real leg is collinear with it. Read through F4's " +
      "mechanism, with no second vote for the same real-rate observation."
  }),
  Object.freeze({
    factor_id: "rates.term-premium-and-curve",
    label: "Term premium and curve",
    disposition: "Blocked",
    verdict: "Neither slope nor estimated premium has accepted exact-session predictive evidence.",
    candidate: "Matched DGS10/DGS2 slope and delta; an optional term-premium model with period-available parameters.",
    data_class: "daily_close",
    inputs: Object.freeze(["us_2y_yield", "us_10y_yield"]),
    mechanisms: Object.freeze([]),
    treatment: "excluded",
    gap: "exclusion",
    reason:
      "The slope is determined by its own two legs, which F2 and F4 already read, and a term-premium model " +
      "cannot be backdated with full-sample estimates. Counting the curve as a third directional input would " +
      "count the same two observations twice."
  }),
  Object.freeze({
    factor_id: "rates.credit-spread-delta",
    label: "Credit spread delta",
    disposition: "Blocked",
    verdict: "The credit mechanism and evidence from other outcomes do not establish exact-session USD prediction.",
    candidate: "ICE BofA US HY OAS (BAMLH0A0HYM2) level and delta(K) in bp, sign unresolved.",
    data_class: "daily_close",
    inputs: Object.freeze(["credit_spread_hy", "credit_spread_d5_bps"]),
    mechanisms: Object.freeze([]),
    treatment: "excluded",
    gap: "code",
    reason:
      "The HY OAS series is present at the cutoff, so the data gap is closed; the sign is unresolved and no " +
      "pre-registered coefficient exists, so the honest state is a recorded exclusion rather than a vote " +
      "whose direction nobody chose."
  }),

  Object.freeze({
    factor_id: "live.f5-dxy-delta",
    label: "F5 DXY delta",
    disposition: "Blocked",
    verdict: "Lagged broad-dollar information is a candidate; the exact-session DXY effect is unmeasured.",
    candidate: "FRED DTWEXBGS as an explicitly broad index: logret(K) or level, point-in-time obtainable.",
    data_class: "daily_close",
    inputs: Object.freeze(["broad_dollar", "broad_dollar_d5_pct"]),
    mechanisms: Object.freeze(["broad_dollar_momentum"]),
    treatment: "direction",
    gap: "data",
    reason:
      "The factor is read from FRED DTWEXBGS, which is not ICE cash DXY: the adjudication rejects every " +
      "broad-index or futures substitution for the declared endpoint, so this vote is a labelled proxy and " +
      "can never be evidence about F5's own candidate."
  }),
  Object.freeze({
    factor_id: "live.f6-gold-delta",
    label: "F6 Gold delta",
    disposition: "Blocked",
    verdict: "Conditional gold mechanisms survive, not an exact-session inverse-dollar forecast.",
    candidate: "A verified XAU/USD bullion stream or a declared contract; logret(K) with frozen hours.",
    data_class: "intraday_bar",
    inputs: Object.freeze(["gold_price", "gold_d5_pct"]),
    mechanisms: Object.freeze(["gold"]),
    treatment: "direction",
    gap: "data",
    reason:
      "A gold quote exists at the cutoff from the cached hourly series, but the adjudication does not " +
      "certify Coinbase XAU-USD as the instrument behind this factor, and gold's dollar relation is partly the " +
      "numeraire identity rather than information."
  }),
  Object.freeze({
    factor_id: "live.f9-dollar-smile",
    label: "F9 Dollar Smile regime",
    disposition: "Blocked",
    verdict: "A descriptive mechanism survives; no exact-session measured smile rule is established.",
    candidate: "No independent raw series: interactions among retained VIX, policy, growth or funding coordinates only.",
    data_class: "derived_only",
    inputs: Object.freeze(["vix_level", "vix_d5_chg"]),
    mechanisms: Object.freeze([]),
    treatment: "counted_elsewhere",
    gap: "exclusion",
    reason:
      "The adjudication's finding is structural: a deterministic smile built from the VIX level adds no raw " +
      "information conditional on its own inputs. It is read inside F1's mechanisms and carries no vote of " +
      "its own, and neither the historical weight 12 nor the coded 1 is validated."
  }),
  Object.freeze({
    factor_id: "live.f10-equity-versus-usd",
    label: "F10 Equity versus USD",
    disposition: "Blocked",
    verdict: "Equity/FX common-shock mechanisms survive; the next-session lead is unmeasured.",
    candidate: "A verified QQQ payload or a separately registered equity feature; logret(K), sign unresolved.",
    data_class: "intraday_bar",
    inputs: Object.freeze(["nasdaq100_price", "nasdaq100_d5_pct"]),
    mechanisms: Object.freeze(["equities"]),
    treatment: "direction",
    gap: "data",
    reason:
      "The vote uses a NAS100 index quote, while the published rule names QQQ; the adjudication refuses to " +
      "treat QQQ, Nasdaq-100 and NQ as interchangeable, so the instrument identity is an open data gap even " +
      "though a price exists."
  }),
  Object.freeze({
    factor_id: "live.f7-economic-surprise",
    label: "F7 US economic surprise",
    disposition: "Blocked",
    verdict: "The stored signal cannot certify the highest-weight family; traceable innovations remain candidates.",
    candidate: "Official first actual against genuinely earlier archived consensus; the opaque usd_signal is excluded.",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "Nothing in the checkout carries a first print, the consensus as known before it, or a release clock at " +
      "05:00. The stored usd_signal string is excluded by the adjudication, so the factor is absent rather " +
      "than approximated."
  }),

  Object.freeze({
    factor_id: "live.f8-fed-bias",
    label: "F8 Fed bias",
    disposition: "Blocked",
    verdict: "No exact-session role is established for a timeless bias string; dated text innovation is a separate candidate.",
    candidate: "Versioned statement, projections or minutes with a prior comparator and a frozen extractor.",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "No historical Fed-bias snapshots or statement archive exist at the cutoff, and an unversioned " +
      "hawkish/dovish word is explicitly excluded. A dated text innovation would also need a " +
      "model-information boundary before it could vote."
  }),
  Object.freeze({
    factor_id: "macro.release-surprise-at-first-print",
    label: "Release surprise at first print",
    disposition: "Blocked",
    verdict: "A sound surprise definition survives, but the exact-session effect and the complete dataset are unmeasured.",
    candidate: "surprise = first actual - prior consensus, plus separate revision news, standardisation unresolved.",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "The same missing archive as F7. The adjudication keeps the definition and rejects memory-based or " +
      "revised values as substitutes, so no number is manufactured for this row."
  }),
  Object.freeze({
    factor_id: "fx.usd-session-momentum",
    label: "USD session momentum",
    disposition: "Blocked",
    verdict: "Other-window FX momentum does not establish one- or five-day DXY direction in this session.",
    candidate: "The same official DXY source as the label: logret(K) at declared trailing endpoints.",
    data_class: "daily_close",
    inputs: Object.freeze(["eurusd", "eurusd_d5_pct", "usdjpy", "usdjpy_d5_pct"]),
    mechanisms: Object.freeze(["eurusd_mirror", "usdjpy_mirror"]),
    treatment: "direction",
    gap: "data",
    reason:
      "The candidate needs the official DXY path, which is not licensed; the implemented vote reads EUR/USD " +
      "and USD/JPY five-day changes instead. Both are declared proxies, they share one family weight, and " +
      "they are not evidence for this factor's own definition."
  }),
  Object.freeze({
    factor_id: "fx.usd-overnight-range-position",
    label: "USD overnight range position",
    disposition: "Blocked",
    verdict: "The candidate state survives; treating a historical range as a hard future bound is rejected.",
    candidate: "RP=(C-L)/(H-L) and RW=(H-L)/C from same-source admissible observations in (t0-L_RANGE, t0].",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "The range needs an intraday same-source dollar path and an admissible cutoff quote; neither exists. " +
      "A EUR/USD-only range would be a different instrument and is not adopted under the dollar's name."
  }),
  Object.freeze({
    factor_id: "fx.usd-session-volatility-regime",
    label: "USD session volatility regime",
    disposition: "Blocked",
    verdict: "Dispersion evidence is not evidence of superior no-call decisions for the exact session.",
    candidate: "RV = sqrt(sum(r_i^2)) over same-source past DXY log returns on a frozen sampling grid.",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "Realised volatility needs same-source intraday dollar returns; the daily broad index cannot supply " +
      "them, and an equity or gold volatility proxy would describe a different asset."
  }),

  Object.freeze({
    factor_id: "risk.usd-safe-haven-demand",
    label: "USD safe-haven demand",
    disposition: "Blocked",
    verdict: "Haven and funding mechanisms do not establish a universal or exact-session USD sign.",
    candidate: "A funding basis, an option-skew series or timestamped positioning flow, all sources unresolved.",
    data_class: "daily_close",
    inputs: Object.freeze(["gold_d1_pct", "usdjpy_d1_pct", "usdchf_d1_pct"]),
    mechanisms: Object.freeze([]),
    treatment: "direction",
    gap: "code",
    reason:
      "The specified combination (gold, JPY, CHF) is reconstructible from series this checkout already holds, and RG-5 " +
      "(frozen 2026-11-13) votes once on the two agreeing legs with CHF as confirmation only, which is how the same " +
      "print is not counted twice. The research's own candidate is a funding basis, skew or positioning series, which " +
      "we do not hold, so the staged legs are declared proxies and the instrument rung stays unverified."
  }),
  Object.freeze({
    factor_id: "risk.risk-on-off-cross-asset-state",
    label: "Risk-on and risk-off cross-asset state",
    disposition: "Blocked",
    verdict: "The conditional state is a research candidate; exact-session directional value is unmeasured.",
    candidate: "Retained VIX, equity, gold and credit coordinates, standardised, with interactions unresolved.",
    data_class: "daily_close",
    inputs: Object.freeze(["vix_level", "nasdaq100_price", "gold_price", "credit_spread_hy"]),
    mechanisms: Object.freeze(["vix_regime", "equities", "gold"]),
    treatment: "counted_elsewhere",
    gap: "code",
    reason:
      "The state is exactly its own components, so it is read through the risk, equity and gold mechanisms " +
      "with no composite vote. Building the composite and its third state is unstarted code, not missing data."
  }),
  Object.freeze({
    factor_id: "calendar.known-releases-between-cutoff-and-endpoint",
    label: "Known releases inside the window",
    disposition: "Partial",
    verdict: "Calendar context is valid if archived; direction, confidence and abstention effects are unmeasured.",
    candidate: "A versioned official schedule known by t0, with event type and phases, as a boolean or categorical.",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "The one factor the adjudication rates better than blocked, and the one with no input at all: no " +
      "versioned event schedule with release instants is archived at the cutoff, so a scheduled CPI cannot " +
      "be named as known, let alone as an outcome."
  }),
  Object.freeze({
    factor_id: "calendar.days-since-and-until-high-impact-events",
    label: "Distance from high-impact events",
    disposition: "Blocked",
    verdict: "Distance is observable context if the schedule is archived, not an established direction or measured positioning.",
    candidate: "Signed seconds to the next known event and since the last, by event type, with an explicit unknown state.",
    data_class: "absent",
    inputs: Object.freeze([]),
    mechanisms: Object.freeze([]),
    treatment: "missing",
    gap: "data",
    reason:
      "Same archive as the previous row, plus a clock convention that does not exist here. Filling zero or " +
      "infinity for 'no known event', as the deployed code does, is what the adjudication forbids."
  }),
  Object.freeze({
    factor_id: "data.quality-gate-for-abstention",
    label: "Data quality gate for abstention",
    disposition: "Addressed",
    verdict: "Reject invalid indispensable inputs or use a prespecified fallback; integrity is required, predictive gain unmeasured.",
    candidate: "The per-source timing, identity and completeness ledger with declared model criticality.",
    data_class: "register_metadata",
    inputs: Object.freeze([
      "vix_level",
      "us_2y_yield",
      "us_10y_real_yield",
      "broad_dollar",
      "gold_price",
      "nasdaq100_price"
    ]),
    mechanisms: Object.freeze([]),
    treatment: "no_call",
    gap: "code",
    reason:
      "This is the only factor the adjudication certifies as required, and it is not a directional sensor. " +
      "It decides whether the day produces a call at all, through the minimum-data and agreement gates; a " +
      "per-source age ledger is the missing code."
  })
]);

/** Read the 27 registered inputs the adjudication's header names. */
function readManifest() {
  const absolute = path.resolve(MANIFEST_PATH);
  if (!fs.existsSync(absolute)) {
    throw new Error(
      `the 2026-11-04 adjudication manifest is missing at ${path.relative(inputs.REPO_ROOT, absolute)}; ` +
        "the factor review cannot name the documents it was read from"
    );
  }
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const registered = Array.isArray(parsed.registered_inputs) ? parsed.registered_inputs : [];
  const factorDocs = registered.filter((entry) => entry.role === "factor_adjudication");
  if (registered.length !== 27 || factorDocs.length !== 25) {
    throw new Error(
      "the adjudication manifest must carry 27 registered inputs and 25 factor adjudications, " +
        `found ${registered.length} and ${factorDocs.length}`
    );
  }
  return { ...parsed, registered_inputs: registered, factor_documents: factorDocs };
}


/** Join each factor row to the document it was read from, and refuse a review that misses a factor. */
function reviewRows() {
  const manifest = readManifest();
  const index = new Map(manifest.factor_documents.map((entry) => [entry.factor_id, entry]));
  const seen = new Set();
  const rows = REVIEW.map((entry) => {
    if (seen.has(entry.factor_id)) throw new Error(`the factor review names ${entry.factor_id} twice`);
    seen.add(entry.factor_id);
    const document = index.get(entry.factor_id);
    if (!document) {
      throw new Error(`the adjudication manifest has no document for ${entry.factor_id}`);
    }
    return {
      ...entry,
      effect_label: EFFECTS[entry.treatment],
      data_class_label: DATA_CLASSES[entry.data_class],
      gap_label: GAPS[entry.gap],
      document: {
        document_id: document.document_id,
        version: document.version,
        sha256: document.sha256
      }
    };
  });
  if (rows.length !== 25) throw new Error(`the factor review must cover 25 factors, found ${rows.length}`);
  return { rows, manifest };
}

/**
 * One value as it stood at the cutoff, with its print date, staleness and source.
 *
 * A base series is looked up in the snapshot's input list, which carries the print date and staleness. A
 * derived key (a five-day change, say) is read from the snapshot's values instead, because the frame computes
 * it at the cutoff from the same row; reporting it as absent would have been wrong in exactly the case this
 * review exists to show.
 */
function valueAt(snapshot, key) {
  const values = (snapshot && snapshot.values) || {};
  const raw = values[key];
  const value = Number.isFinite(raw) ? raw : null;
  const list = Array.isArray(snapshot && snapshot.inputs) ? snapshot.inputs : [];
  const entry = list.find((item) => item.key === key) || null;
  return {
    key,
    value,
    print_date: entry ? entry.print_date || null : snapshot && snapshot.date ? snapshot.date : null,
    staleness_business_days: entry ? entry.staleness_business_days : null,
    source: entry ? entry.source || null : "derived at the cutoff from the frame's own series",
    derived: !entry,
    availability: Number.isFinite(value) ? "usable" : "missing"
  };
}

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  const magnitude = Math.abs(value);
  const decimals = magnitude >= 100 ? 1 : magnitude >= 1 ? 2 : 4;
  return String(Number(value.toFixed(decimals)));
}


/**
 * Work out what one factor did to one morning's call.
 *
 * The order matters: a research exclusion is reported as an exclusion even when its inputs were present, and
 * a data absence is reported as missing even when the factor is wired into a mechanism.
 */
function effectFor(entry, readings, values, call) {
  const usable = readings.filter((reading) => reading.state === "usable");
  const weighted = usable.reduce((total, reading) => total + reading.vote * reading.weight, 0);
  const net = round(weighted, 4);

  const missingKeys = values.filter((value) => value.availability === "missing").map((value) => value.key);
  const parts = usable.map(
    (reading) =>
      `${reading.id} ${reading.vote > 0 ? "+1" : reading.vote < 0 ? "-1" : "0"} ` +
      `(${reading.input} ${formatNumber(reading.value)})`
  );
  const readingLine = parts.length
    ? `${parts.join("; ")}. `
    : `No usable value at the cutoff for ${(missingKeys.length ? missingKeys : entry.inputs).join(", ") || "its declared input"}. `;

  if (entry.treatment === "excluded") {
    return { effect: "excluded", net: null, detail: `Not read. ${entry.reason}` };
  }
  if (entry.treatment === "counted_elsewhere") {
    const carrier = entry.mechanisms.length ? entry.mechanisms.join(" and ") : "another factor's mechanism";
    return {
      effect: "counted_elsewhere",
      net: null,
      detail: `${readingLine}Read through ${carrier} only, so this morning is not counted twice.`
    };
  }
  if (entry.treatment === "no_call") {
    const gateDetail =
      call.direction === "NO_CALL"
        ? `The gate stopped the call: ${call.reason}`
        : `The gate passed: ${call.usable_mechanisms} of ${call.mechanism_count} mechanisms live, ` +
          `${Math.round((call.agreement || 0) * 100)}% agreement, ${Math.round((call.participation || 0) * 100)}% participation.`;
    return {
      effect: call.direction === "NO_CALL" ? "no_call" : "conviction",
      net: null,
      detail: gateDetail
    };
  }
  if (usable.length) {
    const verdictLine =
      net === 0
        ? "The readings cancel, so the factor shaped participation and the conviction band, not the direction."
        : `This family's net is ${net > 0 ? "+" : ""}${formatNumber(net)} of the book.`;
    return { effect: net === 0 ? "conviction" : "direction", net, detail: `${readingLine}${verdictLine}` };
  }
  if (values.some((value) => value.availability === "usable")) {
    return { effect: "conviction", net: null, detail: `${readingLine}${entry.reason}` };
  }
  return { effect: "missing", net: null, detail: `${readingLine}${entry.reason}` };
}

/**
 * The 25-row review for one morning.
 *
 * @param {object} options
 * @param {object} options.snapshot the 05:00 snapshot the call was made from.
 * @param {object} options.call the challenger v1 call for that snapshot.
 */
function buildFactorReview({ snapshot, call }) {
  if (!snapshot || !call) throw new Error("the factor review needs a snapshot and the call it produced");
  const { rows: baseRows, manifest } = reviewRows();
  const mechanismIndex = new Map(
    (Array.isArray(call.mechanisms) ? call.mechanisms : []).map((entry) => [entry.id, entry])
  );
  const counts = { direction: 0, conviction: 0, no_call: 0, counted_elsewhere: 0, excluded: 0, missing: 0 };

  const rows = baseRows.map((entry) => {
    const values = entry.inputs.map((key) => valueAt(snapshot, key));
    const readings = entry.mechanisms
      .map((id) => mechanismIndex.get(id))
      .filter(Boolean)
      .map((reading) => ({
        id: reading.id,
        input: reading.input,
        value: reading.value,
        vote: reading.vote,
        weight: reading.weight,
        state: reading.state
      }));
    const { effect, net, detail } = effectFor(entry, readings, values, call);
    counts[effect] += 1;
    return {
      factor_id: entry.factor_id,
      label: entry.label,
      disposition: entry.disposition,
      verdict: entry.verdict,
      candidate: entry.candidate,
      data_class: entry.data_class,
      data_class_label: entry.data_class_label,
      treatment: entry.treatment,
      gap: entry.gap,
      gap_label: entry.gap_label,
      reason: entry.reason,
      document: entry.document,
      values,
      readings,
      net,
      effect,
      effect_label: EFFECTS[effect],
      detail
    };
  });

  return {
    date: snapshot.date,
    cutoff_at_utc: snapshot.cutoff_at_utc,
    adjudication: {
      document: ADJUDICATION_DOC,
      date: ADJUDICATION_DATE,
      registered_inputs: manifest.registered_inputs.length,
      factor_adjudications: manifest.factor_documents.length
    },
    call: {
      model: call.model,
      direction: call.direction,
      conviction: call.conviction,
      raw_score: call.raw_score,
      agreement: call.agreement,
      participation: call.participation,
      usable_mechanisms: call.usable_mechanisms,
      mechanism_count: call.mechanism_count,
      reason: call.reason
    },
    counts,
    rows
  };
}


/** Where the committed library keeps its registry; the registration block is counted from this file. */
const REGISTRY_PATH = path.join(inputs.REPO_ROOT, "data", "research-library", "documents.json");

/**
 * How the 4 November package stands in the committed library.
 *
 * This is deliberately a separate count from any claim about the model. Registering a document says the library
 * knows its id, version and hash; it says nothing about whether a rule built on that factor works. The panel
 * shows the two numbers apart for the same reason: "25/25 registered" and "0 of 25 directional rules validated"
 * are both true at once, and only one of them is progress.
 */
function registrationStatus({ manifest = readManifest(), registry = null } = {}) {
  const parsed = registry || JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  const documents = Array.isArray(parsed.documents) ? parsed.documents : [];
  const byId = new Map(documents.map((document) => [document.document_id, document]));
  let inputsRegistered = 0;
  let factorsRegistered = 0;
  let privateDocuments = 0;
  const missing = [];
  for (const entry of manifest.registered_inputs) {
    const document = byId.get(entry.document_id);
    const version =
      document &&
      (Array.isArray(document.versions) ? document.versions : []).find(
        (candidate) => Number(candidate.version) === Number(entry.version)
      );
    if (!document || !version || version.sha256 !== entry.sha256) {
      missing.push(entry.document_id);
      continue;
    }
    inputsRegistered += 1;
    if (entry.role === "factor_adjudication") factorsRegistered += 1;
    if (document.public_download !== true) privateDocuments += 1;
  }
  const ids = documents.map((document) => document.document_id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const output = manifest.output || {};
  const factorTotal = manifest.factor_documents.length;
  const awaiting = REVIEW.length;
  return {
    package_id: "usd-final-adjudication-20261104",
    manifest: path.relative(inputs.REPO_ROOT, MANIFEST_PATH).replace(/\\/g, "/"),
    label: factorRegisteredLabel(factorsRegistered, factorTotal),
    inputs_registered: inputsRegistered,
    inputs_total: manifest.registered_inputs.length,
    factor_adjudications_registered: factorsRegistered,
    factor_adjudications_total: factorTotal,
    duplicates: duplicates.length,
    duplicate_ids: duplicates,
    private_documents: privateDocuments,
    public_documents: inputsRegistered - privateDocuments,
    missing,
    note:
      "A second import adds nothing: the record is keyed by document id and the hash has to match. Each record is " +
      "a citation into the hosted store, so it is private, it claims no delivered stage, and it moved no chain " +
      "progress.",
    output: {
      document: output.repo_path || ADJUDICATION_DOC,
      content_sha256: output.sha256 || null,
      declared_inputs: manifest.registered_inputs.length,
      registered_as_input: output.registered_as_input === true,
      verified: Boolean(output.sha256) && output.registered_as_input !== true,
      note:
        "The final adjudication is the package's output. It is verified separately against its own bytes and is " +
        "never counted among the 27 inputs it judged."
    },
    validation: {
      directional_rules_awaiting_validation: awaiting,
      directional_rules_validated: 0,
      label: `Directional rules awaiting validation: ${awaiting}`,
      note:
        "No sign, weight or threshold is validated by registration. The adjudication's own candidate stays " +
        "CONFIG_BLOCKED, and CONFIG_BLOCKED is not a market abstention."
    }
  };
}

function factorRegisteredLabel(registered, total) {
  return `${registered}/${total} factor adjudications registered`;
}

/** What stands between this review and a validated model, grouped the three ways the brief asks for. */
function buildGaps() {
  const { rows } = reviewRows();
  const counts = { code: 0, data: 0, exclusion: 0 };
  const groups = { code: [], data: [], exclusion: [] };
  for (const row of rows) {
    counts[row.gap] += 1;
    groups[row.gap].push({
      factor_id: row.factor_id,
      label: row.label,
      requirement:
        row.gap === "data"
          ? `Stage ${row.candidate}`
          : row.gap === "code"
            ? `Build and register ${row.candidate}`
            : "No build: the adjudication removes this factor from independent scoring",
      reason: row.reason
    });
  }
  return {
    labels: GAPS,
    counts,
    groups,
    note:
      "A gap is what stands between the factor and a validated place in the call, not a judgement about its " +
      "economic importance. Fourteen factors need a series this checkout does not hold at 05:00, six need " +
      "code and a pre-registered coefficient, and five are removed by the research itself."
  };
}

module.exports = {
  MANIFEST_PATH,
  REGISTRY_PATH,
  ADJUDICATION_DOC,
  ADJUDICATION_DATE,
  EFFECTS,
  DATA_CLASSES,
  GAPS,
  REVIEW,
  readManifest,
  reviewRows,
  buildFactorReview,
  buildGaps,
  registrationStatus
};

