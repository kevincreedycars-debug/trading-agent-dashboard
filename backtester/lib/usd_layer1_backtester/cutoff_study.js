"use strict";

/**
 * What 05:00, 07:00 and 09:00 each know, scored on the same sessions (research only, 2026-11-10).
 *
 * The question the brief asks is not "is a later call better" in the abstract. It is: if the same rule waited
 * until 07:00 or 09:00 London, how many more sessions would it call, how accurate would those calls be on the
 * same four markets, and which line-to-line trades would it gain or lose against the 05:00 baseline?
 *
 * Three facts decide how far that can be answered here, and each is reported rather than assumed:
 *
 *  - The session never moves. Every cutoff predicts 05:00 London to 05:00 London on the next local date, so
 *    the outcome is identical across cutoffs and only the information changes.
 *  - The nightly macro legs do not refresh. FRED and central-bank prints in this frame land outside the
 *    05:00-09:00 London window, so the rates, VIX, credit and broad-dollar legs are byte-identical at all
 *    three cutoffs. Only gold and NAS100 are re-read from the cached hourly tape.
 *  - Line-to-line still cannot be scored. No 5-minute tape and no pre-session level ladder exists, so the
 *    trades a later cutoff gains or loses are named as candidates with the blocker attached, never priced.
 */

const contracts = require("./contracts");
const testsModule = require("./tests");

/** The three cutoffs the study compares, in London wall-clock hours. */
const CUTOFFS = Object.freeze([5, 7, 9]);

/** A later call is only comparable when the same inputs were available; otherwise the difference is data. */
function inputSignature(snapshot) {
  return (snapshot.missing || []).map((entry) => entry.key).sort().join(",");
}

function callOf(calls, date) {
  return (calls && calls.get(date)) || null;
}

function isEmptyCall(call) {
  return !call || call.direction === "NO_CALL";
}

function summarise(date, base, later) {
  return {
    date,
    from: base ? base.direction : null,
    from_conviction: base ? base.conviction : null,
    to: later ? later.direction : null,
    to_conviction: later ? later.conviction : null
  };
}

/**
 * Build the cutoff comparison.
 *
 * @param {object} options
 * @param {string[]} options.dates every eligible date.
 * @param {object} options.snapshotsByCutoff `{ 5: [...], 7: [...], 9: [...] }`.
 * @param {object} options.callsByCutoff `{ 5: Map, 7: Map, 9: Map }` of challenger v1 calls.
 * @param {object} options.outcomes `readSessionMoves` + `classifyMoves` output.
 * @param {Map<string,object>} [options.benchmarkCalls] challenger v0's 05:00 calls, for the benchmark column.
 */
function buildCutoffStudy({ dates, snapshotsByCutoff, callsByCutoff, outcomes, benchmarkCalls = null }) {
  const threshold = contracts.CONVICTION.trade_threshold;
  const index = {};
  for (const hour of CUTOFFS) {
    const list = Array.isArray(snapshotsByCutoff[hour]) ? snapshotsByCutoff[hour] : [];
    index[hour] = new Map(list.map((snapshot) => [snapshot.date, snapshot]));
  }

  const matched = [];
  const excluded = [];
  for (const date of dates) {
    const signatures = CUTOFFS.map((hour) => {
      const snapshot = index[hour].get(date);
      return snapshot ? inputSignature(snapshot) : null;
    });
    const hasOutcome = Object.values(outcomes[date] || {}).some((entry) => entry && entry.present);
    if (!hasOutcome) {
      excluded.push({ date, reason: "no cached one-hour outcome tape for any of the four markets" });
      continue;
    }
    if (signatures.some((signature) => signature === null)) {
      excluded.push({ date, reason: "no snapshot at one of the three cutoffs" });
      continue;
    }
    if (new Set(signatures).size > 1) {
      excluded.push({
        date,
        reason: "a later cutoff lost or gained an input, so the difference would be data, not timing"
      });
      continue;
    }
    matched.push(date);
  }

  const perCutoff = {};
  for (const hour of CUTOFFS) {
    const calls = callsByCutoff[hour];
    const convictions = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let called = 0;
    for (const date of matched) {
      const call = callOf(calls, date);
      if (isEmptyCall(call)) continue;
      called += 1;
      if (call.conviction) convictions[call.conviction] += 1;
    }
    const markets = {};
    for (const market of contracts.MARKETS) {
      const overall = testsModule.scoreMarketDirection({ market, calls, outcomes, dates: matched }).overall;
      markets[market.key] = {
        label: market.label,
        hits: overall.hits,
        scored: overall.scored,
        flat: overall.flat,
        accuracy_pct: overall.accuracy_pct,
        lower_bound_pct: overall.lower_bound_pct
      };
    }
    perCutoff[hour] = {
      cutoff_local: `${String(hour).padStart(2, "0")}:00`,
      calls: called,
      no_call: matched.length - called,
      coverage_pct: matched.length ? Math.round((called / matched.length) * 10000) / 100 : null,
      convictions,
      markets
    };
  }

  const benchmark = benchmarkCalls
    ? (() => {
        let called = 0;
        for (const date of matched) if (!isEmptyCall(callOf(benchmarkCalls, date))) called += 1;
        const markets = {};
        for (const market of contracts.MARKETS) {
          const overall = testsModule.scoreMarketDirection({ market, calls: benchmarkCalls, outcomes, dates: matched })
            .overall;
          markets[market.key] = {
            label: market.label,
            hits: overall.hits,
            scored: overall.scored,
            flat: overall.flat,
            accuracy_pct: overall.accuracy_pct,
            lower_bound_pct: overall.lower_bound_pct
          };
        }
        return {
          model: "usd-layer1-challenger-v0",
          calls: called,
          coverage_pct: matched.length ? Math.round((called / matched.length) * 10000) / 100 : null,
          markets,
          note: "the frozen benchmark, scored at 05:00 on exactly these dates, so the comparison is like for like"
        };
      })()
    : null;


  const changes = {};
  for (const hour of CUTOFFS.filter((entry) => entry !== 5)) {
    const gained = [];
    const lost = [];
    const flipped = [];
    for (const date of matched) {
      const base = callOf(callsByCutoff[5], date);
      const later = callOf(callsByCutoff[hour], date);
      const baseEmpty = isEmptyCall(base);
      const laterEmpty = isEmptyCall(later);
      if (baseEmpty && !laterEmpty) gained.push(summarise(date, base, later));
      else if (!baseEmpty && laterEmpty) lost.push(summarise(date, base, later));
      else if (!baseEmpty && !laterEmpty && base.direction !== later.direction) {
        flipped.push(summarise(date, base, later));
      }
    }
    changes[hour] = {
      gained,
      lost,
      flipped,
      unchanged: matched.length - gained.length - lost.length - flipped.length
    };
  }

  /**
   * The line-to-line consequence, stated as candidates.
   *
   * A trade needs a call at or above the provisional threshold. "Gained" means the later cutoff produces such
   * a call where 05:00 produced none; "missed" is the reverse; "reversed" is a trade in the other direction.
   */
  const trades = {};
  for (const hour of CUTOFFS.filter((entry) => entry !== 5)) {
    const qualifies = (call) => call && call.direction !== "NO_CALL" && (call.conviction || 0) >= threshold;
    const gained = changes[hour].gained.filter((entry) => qualifies(callOf(callsByCutoff[hour], entry.date)));
    const missed = changes[hour].lost.filter((entry) => qualifies(callOf(callsByCutoff[5], entry.date)));
    const reversed = changes[hour].flipped.filter(
      (entry) =>
        qualifies(callOf(callsByCutoff[5], entry.date)) && qualifies(callOf(callsByCutoff[hour], entry.date))
    );
    trades[hour] = {
      status: "unmeasured",
      threshold,
      gained: { count: gained.length, dates: gained.map((entry) => entry.date) },
      missed: { count: missed.length, dates: missed.map((entry) => entry.date) },
      reversed: { count: reversed.length, dates: reversed.map((entry) => entry.date) },
      // A call at or above the threshold is trade-eligible; whether the trade would have been gained or missed
      // is a pricing question, and no tape here can answer it. The two lines are reported separately so the
      // count is never read as a result.
      additional_trade_eligible_calls: gained.length,
      trade_eligible_label: `${gained.length} additional trade-eligible call${gained.length === 1 ? "" : "s"}`,
      measured: false,
      consequence_label: "Trades gained or missed: unmeasured.",
      scored_sessions: 0,
      blocker: contracts.BLOCKERS.no_m5_tape,
      note:
        "Each dated row is a trade the later cutoff would take or skip. None is priced: without a five-minute " +
        "tape and a pre-session level ladder no fill, stop, target or R exists, and inventing one would be the " +
        "estimate this programme refuses."
    };
  }

  return {
    cutoffs: CUTOFFS.map((hour) => `${String(hour).padStart(2, "0")}:00`),
    matching_dates: matched.length,
    excluded_dates: excluded.length,
    excluded_examples: excluded.slice(0, 6),
    per_cutoff: perCutoff,
    benchmark,
    changes,
    trades,
    post_release: {
      cohort: "POST_RELEASE_REFRESH",
      declared:
        "a separate cohort for a refresh issued after a scheduled release, scored apart from the 05:00 book",
      dates: 0,
      status: "blocked",
      blockers: [
        "no archived release calendar with release instants, so a session cannot be attributed to a release",
        "no first-print or consensus archive, so the refresh could not know more than the 05:00 book anyway"
      ],
      note:
        "Declared and empty on purpose. Pooling a post-release refresh into this comparison would mix two " +
        "information sets and flatter whichever one happened to see the print."
    },
    refresh_note:
      "Only gold and NAS100 are re-read at 07:00 and 09:00. The rates, VIX, credit and broad-dollar legs are " +
      "daily prints that do not change between 05:00 and 09:00 London, and the EUR/USD and USD/JPY legs stay " +
      "at their daily close so the 05:00 baseline is the same input set it was frozen with.",
    l2l_status: `blocked: ${contracts.BLOCKERS.no_m5_tape}; ${contracts.BLOCKERS.no_level_ladder}`,
    threshold_note:
      "directional accuracy is the share of scored sessions where the market moved against the USD call; a " +
      "flat session inside the frozen band is counted separately and never as a hit"
  };
}

module.exports = { CUTOFFS, inputSignature, buildCutoffStudy };

