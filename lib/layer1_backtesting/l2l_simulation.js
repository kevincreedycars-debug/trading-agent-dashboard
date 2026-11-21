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

module.exports = {
  RULES,
  normaliseLadder,
  midpointLadder,
  ladderFor,
  simulatePath,
  summarisePaths
};
