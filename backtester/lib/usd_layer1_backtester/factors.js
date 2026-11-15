"use strict";

/**
 * The 25-factor account for the challenger (research only).
 *
 * The panel has to answer one question for every one of the twenty-five registered factor chains: does the
 * challenger read it, read it only in combination with another factor, use it only to decide whether to
 * abstain, or leave it out? That answer is written here, once, against the catalogue's own factor ids, and
 * the run refuses to build if a chain is unaccounted for. The research decision and the implemented rule are
 * joined in the same row, so a reader can see which published decision the code actually carries.
 *
 * Two further tables sit beside it: the assumption ledger (which parameter came from research, which is a
 * developer assumption and which was fitted, with the dates each was fixed on) and the challenger's own
 * status as a preliminary model, including the work needed to complete it.
 */

const fs = require("node:fs");
const path = require("node:path");

const contracts = require("./contracts");
const challenger = require("./challenger");
const inputs = require("./inputs");

const CATALOGUE_PATH = path.join(inputs.REPO_ROOT, "data", "research-library", "catalog.json");

/** The four treatments, in the words the panel prints. */
const TREATMENTS = Object.freeze({
  used: "Used",
  combined: "Combined with another factor",
  abstain: "Used to decide whether to abstain",
  excluded: "Excluded"
});

/**
 * The account itself, keyed by catalogue factor id.
 *
 * `mechanisms` names the implemented mechanism(s) that carry the factor; `reason` states why the treatment
 * is what it is. Nothing here changes a rule: it describes the frozen challenger v0 as committed.
 */
const ACCOUNT = Object.freeze({
  "live.f1-vix-level": {
    treatment: "used",
    mechanisms: ["vix_regime", "vix_momentum"],
    reason:
      "the only chain with a delivered research report; its level and its five-day change are two equal-weight " +
      "mechanisms, so the factor carries two votes of nine rather than one"
  },
  "risk.vix-level-and-change-at-cutoff": {
    treatment: "combined",
    mechanisms: ["vix_regime", "vix_momentum"],
    reason:
      "the risk topic's own statement of the same data; it is read through the two VIX mechanisms and carries " +
      "no extra weight, so the same morning is not counted twice"
  },
  "live.f2-us-2y-delta": { treatment: "used", mechanisms: ["us_2y"], reason: "one mechanism, 5bp either side" },
  "live.f3-us-de-2y-spread-delta": {
    treatment: "used",
    mechanisms: ["eurusd_mirror"],
    reason:
      "no 05:00 German 2-year cache exists, so the relative-rate read is expressed in EUR/USD momentum and " +
      "labelled as a stand-in; the spread itself is in the excluded list"
  },
  "live.f4-real-yield-delta": {
    treatment: "used",
    mechanisms: ["us_10y_real"],
    reason: "the 10-year real leg is the mechanism; the 5-year real leg is excluded as collinear"
  },
  "rates.us-front-end-delta": {
    treatment: "combined",
    mechanisms: ["us_2y"],
    reason: "carried by the F2 mechanism; the 3-month leg is excluded as collinear with the 2-year leg"
  },
  "rates.relative-front-end-delta": {
    treatment: "combined",
    mechanisms: ["eurusd_mirror"],
    reason: "carried by the same EUR/USD mirror that carries F3, with no separate weight"
  },
  "rates.real-yield-delta": {
    treatment: "combined",
    mechanisms: ["us_10y_real"],
    reason: "carried by the F4 mechanism, which reads the real-yield leg rather than the nominal one"
  },
  "rates.term-premium-and-curve": {
    treatment: "excluded",
    mechanisms: [],
    reason:
      "the 10-year minus 2-year spread is computed in every snapshot but no mechanism reads it: its USD sign " +
      "is not settled by any delivered research, so version 0 leaves it out rather than guess"
  },
  "rates.credit-spread-delta": {
    treatment: "excluded",
    mechanisms: [],
    reason: "overlaps the VIX reading and its USD sign needs the adjudication first; the input is in the excluded list"
  },
  "live.f5-dxy-delta": {
    treatment: "used",
    mechanisms: ["broad_dollar_momentum"],
    reason:
      "read from FRED DTWEXBGS as a declared stand-in for ICE cash DXY; the substitution is labelled everywhere " +
      "and is refused for test 1, which needs the official series"
  },
  "live.f6-gold-delta": { treatment: "used", mechanisms: ["gold"], reason: "one mechanism, 0.5% either side, USD inverted" },
  "live.f9-dollar-smile": {
    treatment: "used",
    mechanisms: ["usdjpy_mirror"],
    reason: "read through USD/JPY momentum as the funding-currency leg of the smile"
  },
  "live.f10-equity-versus-usd": {
    treatment: "used",
    mechanisms: ["equities"],
    reason: "read through NAS100 five-day momentum, USD inverted; the S&P level is excluded as overlapping"
  },
  "live.f7-economic-surprise": {
    treatment: "excluded",
    mechanisms: [],
    reason: "no committed US event history reaches the 05:00 cutoff with surprise scores, so the input does not exist"
  },
  "live.f8-fed-bias": {
    treatment: "excluded",
    mechanisms: [],
    reason: "no historical Fed-bias snapshots exist at the cutoff; scoring it would mean inventing the input"
  },
  "macro.release-surprise-at-first-print": {
    treatment: "excluded",
    mechanisms: [],
    reason: "same missing archive as F7: no first-print surprise series is available at the cutoff"
  },
  "fx.usd-session-momentum": {
    treatment: "excluded",
    mechanisms: [],
    reason:
      "version 0 reads five-day changes at the cutoff and no intra-session tape, so session momentum has no " +
      "input here; the mirror mechanisms use a five-day window and say so"
  },
  "fx.usd-overnight-range-position": {
    treatment: "excluded",
    mechanisms: [],
    reason: "no overnight range is carried in the as-of frame, and no intraday tape is read at all"
  },
  "fx.usd-session-volatility-regime": {
    treatment: "excluded",
    mechanisms: [],
    reason:
      "needs a five-minute tape, which does not exist for these dates; the VIX regime mechanism stands in and " +
      "is labelled as VIX, never as this factor"
  },
  "risk.usd-safe-haven-demand": {
    treatment: "combined",
    mechanisms: ["vix_regime", "gold", "usdjpy_mirror"],
    reason: "read through the VIX regime, gold and USD/JPY mechanisms; it carries no vote of its own"
  },
  "risk.risk-on-off-cross-asset-state": {
    treatment: "combined",
    mechanisms: ["vix_regime", "equities"],
    reason: "read through the VIX regime and NAS100 mechanisms; it carries no vote of its own"
  },
  "calendar.known-releases-between-cutoff-and-endpoint": {
    treatment: "excluded",
    mechanisms: [],
    reason:
      "no event calendar is staged at the cutoff, so version 0 has no release gate at all; a scheduled-release " +
      "abstention rule is a named gap rather than an implemented one"
  },
  "calendar.days-since-and-until-high-impact-events": {
    treatment: "excluded",
    mechanisms: [],
    reason: "same missing calendar; nothing in version 0 reads the distance to a high-impact release"
  },
  "data.quality-gate-for-abstention": {
    treatment: "abstain",
    mechanisms: ["min_usable_mechanisms", "agreement_deadband"],
    reason:
      "implemented as the two abstention gates: fewer than six of nine mechanisms with a value, or agreement " +
      "inside the 0.20 deadband, and the day is recorded as no call with the missing inputs named"
  }
});


/** Read the registered catalogue the account is joined to. */
function readCatalogue(file = CATALOGUE_PATH) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const chains = Array.isArray(parsed.factor_chains) ? parsed.factor_chains : [];
  return {
    file,
    described: inputs.describeFile(file, "registered factor catalogue: the 25 chains the account is joined to"),
    chains
  };
}

/** The implemented rule for one treatment, in the words the panel prints beside the treatment. */
function implementedRuleFor(entry) {
  if (entry.treatment === "excluded") return "no rule reads it";
  if (entry.treatment === "abstain") {
    return (
      `abstain when fewer than ${challenger.RULES.min_usable_mechanisms} of ${challenger.MECHANISMS.length} ` +
      `mechanisms have a value, or when agreement is inside ${challenger.RULES.agreement_deadband}`
    );
  }
  const mechanisms = challenger.MECHANISMS.filter((mechanism) => entry.mechanisms.includes(mechanism.id));
  return mechanisms
    .map((mechanism) => `${mechanism.id}: ${mechanism.rule} (weight ${challenger.RULES.equal_weight})`)
    .join("; ");
}

/**
 * Build the 25-row account, joined to the catalogue by factor id.
 *
 * @param {object} [options]
 * @param {object} [options.catalogue] a catalogue from `readCatalogue`.
 * @returns {object} every registered factor with its treatment, the implemented rule and the reason.
 */
function buildFactorAccounting({ catalogue = readCatalogue() } = {}) {
  const rows = catalogue.chains.map((chain) => {
    const entry = ACCOUNT[chain.factor_id];
    if (!entry) throw new Error(`factor ${chain.factor_id} is not accounted for in the challenger account`);
    const mechanisms = challenger.MECHANISMS.filter((mechanism) => entry.mechanisms.includes(mechanism.id));
    const thresholds = mechanisms.map((mechanism) => mechanism.threshold);
    return {
      factor_id: chain.factor_id,
      factor_label: chain.factor_label || chain.title,
      title: chain.title,
      group: chain.factor_group || null,
      role: chain.factor_role || null,
      chain_id: chain.chain_id,
      research_task: chain.dispatch && chain.dispatch.task_id ? chain.dispatch.task_id : null,
      research_state: chain.dispatch && chain.dispatch.state ? chain.dispatch.state : null,
      treatment: entry.treatment,
      treatment_label: TREATMENTS[entry.treatment],
      mechanisms: entry.mechanisms,
      thresholds: thresholds.filter((value, index) => thresholds.indexOf(value) === index),
      weight_total: mechanisms.length * challenger.RULES.equal_weight,
      implemented_rule: implementedRuleFor(entry),
      reason: entry.reason
    };
  });

  const unknown = Object.keys(ACCOUNT).filter(
    (factorId) => !catalogue.chains.some((chain) => chain.factor_id === factorId)
  );
  if (unknown.length) {
    throw new Error(`the account names factors the catalogue does not carry: ${unknown.join(", ")}`);
  }

  const counts = { used: 0, combined: 0, abstain: 0, excluded: 0 };
  for (const row of rows) counts[row.treatment] += 1;

  return {
    factor_count: rows.length,
    source: catalogue.described,
    treatments: TREATMENTS,
    counts,
    note:
      "every registered chain is listed once; 'combined' means the factor is read through another factor's " +
      "mechanism and carries no extra weight, so no morning is counted twice",
    rows
  };
}

/**
 * The assumption ledger: where each frozen parameter came from.
 *
 * Three classes only. `research` means a delivered, registered research document states it. `assumption`
 * means a developer chose it and declared it before any date was scored. `fitted` means it was measured from
 * data, and then only from development dates, with the dates named.
 */
function buildAssumptionLedger({ flatBands = {}, splits = {} } = {}) {
  const development = splits.development || {};
  const markets = Object.keys(flatBands);
  const fittedWindows = markets.map((market) => ({
    market,
    value: flatBands[market].flat_band_pct,
    sample: flatBands[market].sample,
    dates: `${development.start} to ${development.end}`
  }));

  const rows = [
    {
      parameter: "VIX regime thresholds",
      value: "above 25 bids USD, below 16 releases it",
      class: "research",
      source:
        "the registered VIX chain's delivered report (USD-BASELINE-AUDIT-01, dispatched 2026-10-15) and the " +
        "production regime rule restated in current_model.deriveEquitiesRegime",
      dates: "research delivered 2026-10-15; unchanged since",
      note: "the only one of the twenty-five chains with a delivered research report"
    },
    {
      parameter: "Equal weight per mechanism",
      value: `1 (${challenger.MECHANISMS.length} mechanisms, ${challenger.MECHANISMS.length} points in total)`,
      class: "assumption",
      source:
        "the null hypothesis: no combined 25-factor adjudication exists to weight them, so every mechanism gets " +
        "the same say",
      dates: "declared and frozen 2026-11-08, before the first date was scored",
      note: "replacing this with an adjudicated weighting is a new version, not a tuning step"
    },
    {
      parameter: "Rate and FX thresholds",
      value:
        "5bp on both yield legs; 0.15% on the dollar, EUR/USD and USD/JPY; 0.5% on gold and NAS100; 1 index " +
        "point on the VIX change",
      class: "assumption",
      source: "round numbers chosen so a move has to be visible on a five-day window, declared before scoring",
      dates: "frozen 2026-11-08",
      note: "no threshold was fitted to an outcome"
    },
    {
      parameter: "Minimum usable mechanisms",
      value: `${challenger.RULES.min_usable_mechanisms} of ${challenger.MECHANISMS.length}`,
      class: "assumption",
      source:
        "a participation floor, so a day with mostly missing inputs becomes a named no-call rather than a thin call",
      dates: "frozen 2026-11-08",
      note: "the first of the two abstention gates"
    },
    {
      parameter: "Agreement deadband",
      value:
        `${challenger.RULES.agreement_deadband} (${Math.round(challenger.RULES.agreement_deadband * 100)}% of ` +
        "live mechanisms on the winning side)",
      class: "assumption",
      source: "a coin-toss guard, so a split book is recorded as no call",
      dates: "frozen 2026-11-08",
      note: "the second abstention gate"
    },
    {
      parameter: "Five conviction bands",
      value: challenger.RULES.conviction_bands
        .map((band) => `${band.conviction}: ${band.min_agreement} agreement / ${band.min_participation} participation`)
        .join(", "),
      class: "assumption",
      source: "an equal-interval ladder over agreement and participation, declared before scoring",
      dates: "frozen 2026-11-08",
      note: `the provisional trade threshold is conviction ${contracts.CONVICTION.trade_threshold} or higher`
    },
    {
      parameter: "Provisional trade threshold",
      value: `conviction ${contracts.CONVICTION.trade_threshold} and above`,
      class: "assumption",
      source: "a placeholder to be reviewed on evidence; every call below it is still recorded and scored",
      dates: "frozen 2026-11-08",
      note: "no trade simulation runs on it yet, because tests 3 and 4 have no tape"
    },
    {
      parameter: "Split windows",
      value: Object.keys(splits)
        .map((key) => `${splits[key].label}: ${splits[key].start} to ${splits[key].end}`)
        .join("; "),
      class: "assumption",
      source: "declared before scoring so the unseen windows stay unseen",
      dates: "frozen 2026-11-08",
      note: "parameters may only be fitted on the development window"
    },
    {
      parameter: "Current model conviction mapping",
      value: contracts.CONVICTION.current_model_mapping.bands
        .map((band) => `${band.conviction} at ${band.min}+`)
        .join(", "),
      class: "assumption",
      source: "the current model's own 0-100 conviction is banded onto the shared 1-5 scale for comparison only",
      dates: "frozen 2026-11-08",
      note: "the current model's own conviction is never recomputed"
    },
    {
      parameter: "Broad-dollar stand-in",
      value: "FRED DTWEXBGS read as the dollar's own momentum",
      class: "assumption",
      source: "no licensed ICE cash DXY exists in this checkout; the substitute is labelled in every row it touches",
      dates: "in force since the first snapshot, 2026-11-08",
      note: "refused for test 1, which needs the official series"
    },
    {
      parameter: "Flat bands (the only fitted numbers in the run)",
      value: fittedWindows.map((entry) => `${entry.market} ${entry.value}%`).join(", "),
      class: "fitted",
      source: markets.length
        ? `${flatBands[markets[0]].rule}; fitted separately per market`
        : "no flat band was measurable",
      dates: development.start
        ? `fitted on ${development.start} to ${development.end} only (${fittedWindows
            .map((entry) => `${entry.market} n=${entry.sample}`)
            .join(", ")})`
        : "development dates unavailable",
      note:
        "fitted once, before any date was scored, and applied unchanged to every window; a development-window " +
        "score is therefore in-sample for the band, while the unseen windows are not"
    }
  ];

  const counts = { research: 0, assumption: 0, fitted: 0 };
  for (const row of rows) counts[row.class] += 1;
  return {
    classes: { research: "From research", assumption: "Developer assumption", fitted: "Fitted on data" },
    counts,
    rows
  };
}

/** What stands between version 0 and a finished challenger. */
function buildChallengerStatus({ accounting } = {}) {
  const counts = accounting ? accounting.counts : { used: 0, combined: 0, abstain: 0, excluded: 0 };
  const undelivered = 25 - 1;
  return {
    preliminary: true,
    label:
      "Preliminary model: challenger v0 is the equal-weight null hypothesis, built before the 25-factor " +
      "adjudication exists, and it is the baseline any real challenger has to beat",
    why_preliminary: [
      `${undelivered} of the 25 factor chains have no adjudication, so no combined weighting can be implemented`,
      `${counts.excluded} factors are excluded outright and ${counts.combined} are read only through another factor's mechanism`,
      "the calendar and event factors have no staged input, so the model has no release gate",
      "no parameter was fitted except the flat bands, which measure noise rather than signal"
    ],
    completing_work: [
      "receive the remaining 24 chain adjudications and the combined 25-factor adjudication, then implement it as challenger v1 with fitted weights and a fresh freeze",
      "stage an event calendar and first-print surprise series at the 05:00 cutoff, then implement the release gate the calendar factors describe",
      "stage Fed-bias and economic-surprise snapshots, or record them as permanently absent with the reason",
      "licence ICE cash DXY so F5 reads the official series instead of FRED DTWEXBGS",
      "archive five-minute tapes and pre-session level ladders per market so tests 3 and 4 can score",
      "re-freeze, re-score every window and republish the artefact; no tuning of v0 against these results in the meantime"
    ],
    guardrail:
      "version 0 is frozen: any change to a weight, threshold, gate or band is a new version string, not an edit"
  };
}

module.exports = {
  CATALOGUE_PATH,
  TREATMENTS,
  ACCOUNT,
  readCatalogue,
  buildFactorAccounting,
  buildAssumptionLedger,
  buildChallengerStatus
};

