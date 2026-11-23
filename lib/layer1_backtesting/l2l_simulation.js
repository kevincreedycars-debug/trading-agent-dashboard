"use strict";

/**
 * The frozen Layer 2 level path simulation behind tests 3 and 4 (research only).
 *
 * This module is the *rule engine*, not a result. It answers "given a level ladder, a one-hour tape and
 * the frozen management rule, did the path reach its target before its stop?" and it is fully unit-tested
 * on synthetic tapes. What it cannot do is invent a 5-minute tape or a ladder that was not archived, so
 * tests 3 and 4 remain unscored on history: the simulation is implemented and tested, the historical data
 * is absent. Those two facts are reported separately everywhere this module is referenced.
 *
 * Frozen rules:
 *   full_5r - the original level ladder, entry on a touch of the level, a 1R stop behind the entry and a
 *             5R target.
 *   half_3r - the original ladder plus the midpoint of every adjacent pair, the same entry and stop, and a
 *             3R target.
 *
 * Conservative resolution, declared before use:
 *   - a level is filled only when the tape trades through it, never on a touch of the close alone;
 *   - if one candle touches both the stop and the target, the stop is taken;
 *   - a gap through the stop exits at the open, which is worse than the stop price;
 *   - a path that never fills is `no_fill`, and a filled path that touches neither is `open` and is never
 *     counted as a win or a loss.
 */

const RULES = Object.freeze({
  full_5r: Object.freeze({
    id: "full_5r",
    label: "Original levels with the frozen 5R rules",
    ladder: "original_levels",
    target_r: 5,
    stop_r: 1,
    frozen: "the rule is the geometry and the management multiple, not a fitted parameter"
  }),
  half_3r: Object.freeze({
    id: "half_3r",
    label: "Original levels plus midpoints with the frozen 3R rules",
    ladder: "levels_plus_midpoints",
    target_r: 3,
    stop_r: 1,
    frozen: "a separately frozen geometry, not a sensitivity check on full_5r"
  })
});

function assertFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function assertCandles(candles) {
  if (!Array.isArray(candles) || candles.length === 0) throw new Error("a tape needs at least one candle");
  for (const [index, candle] of candles.entries()) {
    if (!candle || typeof candle !== "object") throw new Error(`candle ${index} must be an object`);
    for (const field of ["open", "high", "low", "close"]) assertFinite(candle[field], `candle ${index} ${field}`);
    if (candle.high < candle.low) throw new Error(`candle ${index} high is below its low`);
  }
  return candles;
}

/** Sort and de-duplicate a level ladder. Direction decides which end is nearest the entry. */
function normaliseLadder(levels) {
  if (!Array.isArray(levels) || levels.length === 0) throw new Error("a ladder needs at least one level");
  const unique = Array.from(new Set(levels.map((level, index) => assertFinite(level, `level ${index}`))));
  return unique.sort((left, right) => left - right);
}

/** The midpoint of every adjacent pair, merged into the original ladder and sorted. */
function midpointLadder(levels) {
  const original = normaliseLadder(levels);
  const midpoints = [];
  for (let index = 0; index < original.length - 1; index += 1) {
    midpoints.push((original[index] + original[index + 1]) / 2);
  }
  return Array.from(new Set(original.concat(midpoints))).sort((left, right) => left - right);
}

function ladderFor(rule, levels) {
  return rule.ladder === "levels_plus_midpoints" ? midpointLadder(levels) : normaliseLadder(levels);
}


/**
 * Walk one path.
 *
 * @param {object} input
 * @param {"long"|"short"} input.direction
 * @param {number} input.entry the level that must be traded through before the position exists
 * @param {number} input.stop the stop price, one R behind the entry
 * @param {object|string} input.rule a RULES entry or its id
 * @param {Array<object>} input.tape one-hour candles in time order
 * @param {number} [input.spread] round-turn cost in price units, subtracted once from the R result
 */
function simulatePath({ direction, entry, stop, rule = "full_5r", tape, spread = 0 } = {}) {
  if (direction !== "long" && direction !== "short") throw new Error("direction must be long or short");
  const selected = typeof rule === "string" ? RULES[rule] : rule;
  if (!selected || !RULES[selected.id]) throw new Error(`unknown frozen rule ${JSON.stringify(rule && rule.id)}`);
  const entryPrice = assertFinite(entry, "entry");
  const stopPrice = assertFinite(stop, "stop");
  assertFinite(spread, "spread");
  if (spread < 0) throw new Error("spread must not be negative");
  const candles = assertCandles(tape);
  const risk = direction === "long" ? entryPrice - stopPrice : stopPrice - entryPrice;
  if (!(risk > 0)) throw new Error("a long stop must sit below its entry and a short stop above it");
  const target = direction === "long"
    ? entryPrice + risk * selected.target_r
    : entryPrice - risk * selected.target_r;

  let fillIndex = null;
  for (const [index, candle] of candles.entries()) {
    // The candle must trade through the level: a level far below the tape is not a fill, and a level above
    // it is not either. A gap that skips the level entirely is not modelled here and is reported as no_fill
    // rather than assumed.
    const tradedThrough = candle.low <= entryPrice && candle.high >= entryPrice;
    if (!tradedThrough) continue;
    fillIndex = index;
    break;
  }
  if (fillIndex === null) {
    return {
      rule: selected.id,
      outcome: "no_fill",
      filled: false,
      entry: entryPrice,
      stop: stopPrice,
      target,
      risk,
      candles_held: 0,
      r_gross: null,
      r_net: null,
      first_event: "never_filled"
    };
  }

  for (let index = fillIndex; index < candles.length; index += 1) {
    const candle = candles[index];
    const stopHit = direction === "long" ? candle.low <= stopPrice : candle.high >= stopPrice;
    const targetHit = direction === "long" ? candle.high >= target : candle.low <= target;
    if (stopHit) {
      // A gap through the stop fills at the open, which is worse than the stop price itself.
      const gapped = direction === "long" ? candle.open < stopPrice : candle.open > stopPrice;
      const exit = gapped ? candle.open : stopPrice;
      const rGross = direction === "long" ? (exit - entryPrice) / risk : (entryPrice - exit) / risk;
      return {
        rule: selected.id,
        outcome: "stop",
        filled: true,
        entry: entryPrice,
        stop: stopPrice,
        target,
        risk,
        exit,
        exit_index: index,
        candles_held: index - fillIndex + 1,
        r_gross: rGross,
        r_net: rGross - spread / risk,
        first_event: targetHit ? "stop_and_target_same_candle" : "stop",
        conservative: targetHit
      };
    }
    if (targetHit) {
      return {
        rule: selected.id,
        outcome: "target",
        filled: true,
        entry: entryPrice,
        stop: stopPrice,
        target,
        risk,
        exit: target,
        exit_index: index,
        candles_held: index - fillIndex + 1,
        r_gross: selected.target_r,
        r_net: selected.target_r - spread / risk,
        first_event: "target"
      };
    }
  }

  const last = candles[candles.length - 1];
  const rGross = direction === "long" ? (last.close - entryPrice) / risk : (entryPrice - last.close) / risk;
  return {
    rule: selected.id,
    outcome: "open",
    filled: true,
    entry: entryPrice,
    stop: stopPrice,
    target,
    risk,
    exit: last.close,
    exit_index: candles.length - 1,
    candles_held: candles.length - fillIndex,
    r_gross: rGross,
    r_net: rGross - spread / risk,
    first_event: "still_open"
  };
}

/** Score a set of paths without hiding fills the tape could not support. */
function summarisePaths(paths) {
  const counts = { target: 0, stop: 0, open: 0, no_fill: 0 };
  for (const path of paths) counts[path.outcome] = (counts[path.outcome] || 0) + 1;
  const resolved = counts.target + counts.stop;
  return {
    paths: paths.length,
    ...counts,
    resolved,
    hit_rate: resolved === 0 ? null : counts.target / resolved,
    note: "Only filled paths that reached a target or a stop enter the hit rate; no_fill and open are reported beside it, never inside it."
  };
}

/**
 * Cut a tape to one session.
 *
 * Both L2L tests are defined on the 05:00 London session, so the simulation may see only
 * `[cutoff, endpoint)`: a bar stamped at or after the endpoint belongs to the next session and is dropped.
 * The counts travel with the tape so a caller can prove the bound did the work, and an unparseable or
 * non-increasing window is refused rather than guessed.
 *
 * @param {object} input
 * @param {Array<object>} input.candles bars carrying `time_utc` (or `time`).
 * @param {string} input.cutoff_at_utc the session's 05:00 London start.
 * @param {string} input.endpoint_at_utc the following 05:00 London.
 * @returns {object} the kept candles, the dropped counts and the resolved window.
 */
function sessionTape({ candles, cutoff_at_utc, endpoint_at_utc } = {}) {
  const start = Date.parse(cutoff_at_utc);
  const end = Date.parse(endpoint_at_utc);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("a session tape needs a parseable cutoff_at_utc and endpoint_at_utc");
  }
  if (!(end > start)) throw new Error("the session endpoint must be after its cutoff");
  if (!Array.isArray(candles)) throw new Error("a session tape needs a candle list");
  const kept = [];
  let before = 0;
  let after = 0;
  for (const candle of candles) {
    const raw = candle && (candle.time_utc || candle.time || candle.t);
    const stamp = Date.parse(raw || "");
    if (!Number.isFinite(stamp)) throw new Error("every candle in a session tape needs a parseable time");
    if (stamp < start) {
      before += 1;
      continue;
    }
    if (stamp >= end) {
      after += 1;
      continue;
    }
    kept.push(candle);
  }
  return {
    candles: kept,
    cutoff_at_utc: new Date(start).toISOString(),
    endpoint_at_utc: new Date(end).toISOString(),
    window_hours: (end - start) / (60 * 60 * 1000),
    dropped_before_cutoff: before,
    dropped_at_or_after_endpoint: after
  };
}

/**
 * Simulate one path inside one session.
 *
 * This is the only entry point the two scored L2L tests may use: the tape is cut at the following 05:00
 * London before the rule is walked, so a position cannot be carried into the next session and a target that
 * only prints after the endpoint cannot be counted. A position still open when the session ends is closed at
 * the last close inside the session and reported `open`, with `closed_at_session_end: true`.
 *
 * @param {object} input
 * @param {object} input.session `{ date, cutoff_at_utc, endpoint_at_utc }`.
 * @param {Array<object>} input.candles the broader tape; bars outside the session are dropped and counted.
 * @param {string} input.direction `long` or `short`.
 * @param {number} input.entry a level on the ladder.
 * @param {number} input.stop the stop price.
 * @param {object|string} input.rule a RULES entry or its id.
 * @param {number} [input.spread]
 */
function simulateSessionPath({ session, candles, ...rest } = {}) {
  if (!session || !session.cutoff_at_utc || !session.endpoint_at_utc) {
    throw new Error("simulateSessionPath needs a session with cutoff_at_utc and endpoint_at_utc");
  }
  const bounded = sessionTape({
    candles,
    cutoff_at_utc: session.cutoff_at_utc,
    endpoint_at_utc: session.endpoint_at_utc
  });
  if (bounded.candles.length === 0) throw new Error("the session tape carries no candles inside the session");
  const result = simulatePath({ ...rest, tape: bounded.candles });
  return {
    ...result,
    session: {
      date: session.date || null,
      cutoff_at_utc: bounded.cutoff_at_utc,
      endpoint_at_utc: bounded.endpoint_at_utc,
      window_hours: bounded.window_hours
    },
    session_bound: {
      candles_in_session: bounded.candles.length,
      dropped_before_cutoff: bounded.dropped_before_cutoff,
      dropped_at_or_after_endpoint: bounded.dropped_at_or_after_endpoint,
      rule: "a bar at or after the following 05:00 London belongs to the next session and is never simulated"
    },
    closed_at_session_end: result.outcome === "open"
  };
}

module.exports = {
  RULES,
  normaliseLadder,
  midpointLadder,
  ladderFor,
  simulatePath,
  summarisePaths,
  sessionTape,
  simulateSessionPath
};
