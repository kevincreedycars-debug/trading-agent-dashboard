"use strict";

/**
 * USD Layer 1 decision rules, version 1 (research only).
 *
 * The research names an intended 25-factor book but leaves the decision undefined. This module is the explicit
 * choice: six voting families, one unit of say per family, a 0.20 deadband, five conviction bands and a
 * provisional trade rule. It computes a decision from signal votes only. It never reads a price, fills a gap,
 * reweights a family or scores an outcome, so it cannot turn a missing input into a neutral vote.
 *
 * The configuration is the contract. Everything here is a pure function of that file and the votes passed in.
 */

const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "..", "config", "usd_l1_decision_rules_v1.json");
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

const VERSION = CONFIG.version;
const FROZEN_ON = CONFIG.frozen_on;
const FAMILIES = CONFIG.families.map((family) => ({
  ...family,
  signals: family.signals.map((signal) => ({ ...signal }))
}));
const SIGNALS = FAMILIES.flatMap((family) =>
  family.signals.map((signal) => ({ ...signal, family_id: family.id, family_label: family.label }))
);
const BANDS = CONFIG.bands.map((band) => ({ ...band })).sort((a, b) => b.band - a.band);
const SIGNAL_COUNT = SIGNALS.length;

function finite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normaliseVote(value) {
  const parsed = finite(value);
  if (parsed === null) return null;
  return Math.max(-1, Math.min(1, parsed));
}

function familyVotes(votes = {}) {
  return FAMILIES.map((family) => {
    const usable = family.signals
      .map((signal) => normaliseVote(votes[signal.id]))
      .filter((vote) => vote !== null);
    const vote = usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
    return {
      id: family.id,
      label: family.label,
      vote,
      usable_signals: usable.length,
      signals: family.signals.length
    };
  });
}

function bandFor(agreement, participation) {
  for (const band of BANDS) {
    if (agreement >= band.min_agreement && participation >= band.min_participation) return band;
  }
  return null;
}


/**
 * One morning. `votes` is keyed by signal id and holds -1, 0 or +1; `null` and `undefined` mean absent, never
 * zero. `gateOpen` is RG-4's answer: only `true` lets a morning trade.
 */
function evaluateMorning({
  date = null,
  votes = {},
  gateOpen = null,
  gateStatus = null,
  calendarStaged = CONFIG.event_context.calendar_staged
} = {}) {
  const families = familyVotes(votes);
  const usableSignals = SIGNALS.filter((signal) => normaliseVote(votes[signal.id]) !== null).length;
  const usableFamilies = families.filter((family) => family.vote !== null).length;
  const eligibility = CONFIG.eligibility;
  const reasons = [];
  const capsApplied = [];
  let eligible = true;

  if (usableSignals < eligibility.min_usable_signals) {
    eligible = false;
    reasons.push(
      `only ${usableSignals} of ${SIGNAL_COUNT} voting signals are usable; the rule needs ${eligibility.min_usable_signals}`
    );
  }
  if (usableFamilies < eligibility.min_usable_families) {
    eligible = false;
    reasons.push(
      `only ${usableFamilies} of ${FAMILIES.length} families are usable; the rule needs ${eligibility.min_usable_families}`
    );
  }
  if (gateOpen !== true) {
    eligible = false;
    reasons.push(
      gateStatus === "closed"
        ? "the RG-4 volatility gate is closed"
        : "the RG-4 volatility gate is undefined at the cutoff"
    );
  }

  const familySum = families
    .filter((family) => family.vote !== null)
    .reduce((sum, family) => sum + family.vote, 0);
  const agreement = usableFamilies ? Math.abs(familySum) / usableFamilies : 0;
  const participation = usableSignals / SIGNAL_COUNT;

  let direction = "NO_CALL";
  let band = null;
  let uncappedBand = null;
  let trade = false;

  if (eligible && agreement >= 0.2 && familySum !== 0) {
    direction = familySum > 0 ? "BULLISH" : "BEARISH";
    const candidate = bandFor(agreement, participation);
    uncappedBand = candidate ? candidate.band : null;
    band = uncappedBand;

    if (usableFamilies < FAMILIES.length && band !== null && band > 3) {
      band = 3;
      capsApplied.push({ cap: "missing family", max_band: 3, from_band: uncappedBand });
    }
    if (!calendarStaged && band !== null && band > 4) {
      band = 4;
      capsApplied.push({ cap: "event calendar not staged", max_band: 4, from_band: uncappedBand });
    }

    const eventFamily = families.find((family) => family.id === "event");
    const allSignalsUsable = usableSignals === SIGNAL_COUNT;
    trade =
      band !== null &&
      band >= CONFIG.trade_rule.min_band &&
      eventFamily &&
      eventFamily.vote !== null &&
      allSignalsUsable;
    if (band !== null && band >= CONFIG.trade_rule.min_band && eventFamily && eventFamily.vote === null) {
      reasons.push("the event family is unusable, so the provisional trade rule is not met");
    }
    if (band !== null && band >= CONFIG.trade_rule.min_band && !allSignalsUsable) {
      reasons.push("not all twelve voting signals are usable, so the provisional trade rule is not met");
    }
  } else if (eligible) {
    reasons.push("the family vote sits inside the 0.20 deadband or nets exactly zero");
  }

  const bandConfig = band === null ? null : CONFIG.bands.find((entry) => entry.band === band) || null;

  return {
    version: VERSION,
    date,
    signals: SIGNALS.map((signal) => {
      const vote = normaliseVote(votes[signal.id]);
      return {
        id: signal.id,
        label: signal.label,
        family_id: signal.family_id,
        factor_id: signal.factor_id,
        vote,
        usable: vote !== null
      };
    }),
    families,
    usable_signals: usableSignals,
    usable_families: usableFamilies,
    net_score: familySum,
    agreement,
    participation,
    eligible,
    direction,
    band,
    band_label: bandConfig ? bandConfig.label : null,
    uncapped_band: uncappedBand,
    caps_applied: capsApplied,
    trade: Boolean(trade),
    reasons
  };
}

function aggregate(mornings = []) {
  const bandCounts = CONFIG.bands.map((band) => ({
    band: band.band,
    label: band.label,
    count: 0
  }));
  const totals = {
    version: VERSION,
    frozen_on: FROZEN_ON,
    sessions: mornings.length,
    eligible: 0,
    directional_calls: 0,
    no_calls: 0,
    trade_qualified: 0,
    band_counts: bandCounts,
    band_5_calls: 0,
    capped_mornings: 0
  };
  for (const morning of mornings) {
    if (morning.eligible) totals.eligible += 1;
    if (morning.direction !== "NO_CALL") {
      totals.directional_calls += 1;
      const entry = bandCounts.find((band) => band.band === morning.band);
      if (entry) entry.count += 1;
      if (morning.band === 5) totals.band_5_calls += 1;
    } else if (morning.eligible) {
      totals.no_calls += 1;
    }
    if (morning.trade) totals.trade_qualified += 1;
    if (morning.caps_applied.length) totals.capped_mornings += 1;
  }
  return totals;
}

module.exports = {
  CONFIG,
  FAMILIES,
  SIGNALS,
  BANDS,
  VERSION,
  FROZEN_ON,
  SIGNAL_COUNT,
  normaliseVote,
  familyVotes,
  bandFor,
  evaluateMorning,
  aggregate
};
