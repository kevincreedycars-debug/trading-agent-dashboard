"use strict";

// Tests the frozen Layer 2 path simulation on synthetic tapes only. A synthetic tape is a worked example,
// never a measured result: the point of these cases is that the rule engine behaves as declared, which is
// a different claim from "tests 3 and 4 were measured on history" (they were not - no tape or ladder exists).

const assert = require("node:assert/strict");
const test = require("node:test");

const l2l = require("../lib/layer1_backtesting/l2l_simulation");

const candle = (open, high, low, close) => ({ open, high, low, close });

test("the ladders are the frozen geometry, not a fitted parameter", () => {
  assert.deepEqual(l2l.normaliseLadder([1.1055, 1.1, 1.1055, 1.102]), [1.1, 1.102, 1.1055]);
  assert.deepEqual(l2l.midpointLadder([1.1, 1.11, 1.13]), [1.1, 1.105, 1.11, 1.12, 1.13]);
  assert.deepEqual(l2l.ladderFor(l2l.RULES.full_5r, [1.1, 1.11]), [1.1, 1.11]);
  assert.deepEqual(l2l.ladderFor(l2l.RULES.half_3r, [1.1, 1.11]), [1.1, 1.105, 1.11]);
  assert.equal(l2l.RULES.full_5r.target_r, 5);
  assert.equal(l2l.RULES.half_3r.target_r, 3);
});

test("a long path that reaches its target before its stop is a 5R target", () => {
  const path = l2l.simulatePath({
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r",
    tape: [
      candle(1.101, 1.1015, 1.0998, 1.1012),
      candle(1.1012, 1.1025, 1.101, 1.102),
      candle(1.102, 1.1075, 1.1018, 1.107)
    ]
  });
  assert.equal(path.outcome, "target");
  assert.ok(Math.abs(path.exit - 1.105) < 1e-9);
  assert.equal(path.r_gross, 5);
  assert.equal(path.candles_held, 3);
});

test("a stop that is touched in the same candle as the target wins, and a gap fills worse", () => {
  const sameCandle = l2l.simulatePath({
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r",
    tape: [candle(1.1, 1.106, 1.0985, 1.102)]
  });
  assert.equal(sameCandle.outcome, "stop");
  assert.equal(sameCandle.first_event, "stop_and_target_same_candle");
  assert.equal(sameCandle.conservative, true);
  assert.equal(sameCandle.r_gross, -1);

  const gap = l2l.simulatePath({
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r",
    tape: [candle(1.1, 1.1005, 1.0995, 1.1), candle(1.096, 1.097, 1.095, 1.096)]
  });
  assert.equal(gap.outcome, "stop");
  assert.equal(gap.exit, 1.096);
  assert.ok(gap.r_gross < -1, "a gap through the stop is worse than one R");
});

test("a short path mirrors the long path", () => {
  const path = l2l.simulatePath({
    direction: "short",
    entry: 1.1,
    stop: 1.101,
    rule: "half_3r",
    tape: [candle(1.1, 1.1005, 1.0995, 1.0995), candle(1.0995, 1.0996, 1.0965, 1.097)]
  });
  assert.equal(path.outcome, "target");
  assert.ok(Math.abs(path.exit - 1.097) < 1e-9);
  assert.equal(path.r_gross, 3);
});

test("a path that never fills and a path that never resolves are never counted as wins", () => {
  const noFill = l2l.simulatePath({
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r",
    tape: [candle(1.095, 1.096, 1.094, 1.095)]
  });
  assert.equal(noFill.outcome, "no_fill");
  assert.equal(noFill.r_gross, null);

  const open = l2l.simulatePath({
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r",
    tape: [candle(1.1, 1.101, 1.0995, 1.1005)]
  });
  assert.equal(open.outcome, "open");
  assert.equal(open.first_event, "still_open");

  const summary = l2l.summarisePaths([noFill, open]);
  assert.equal(summary.resolved, 0);
  assert.equal(summary.hit_rate, null);
  assert.equal(summary.no_fill, 1);
  assert.equal(summary.open, 1);
});

test("a spread is charged once and turns a 5R target into less than 5R", () => {
  const path = l2l.simulatePath({
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r",
    spread: 0.0002,
    tape: [candle(1.1, 1.106, 1.0998, 1.105)]
  });
  assert.equal(path.outcome, "target");
  assert.equal(path.r_gross, 5);
  assert.ok(path.r_net < 5 && path.r_net > 4.7);
});

test("invalid geometry is refused instead of silently scored", () => {
  assert.throws(() => l2l.simulatePath({ direction: "long", entry: 1.1, stop: 1.101, rule: "full_5r", tape: [candle(1.1, 1.1, 1.1, 1.1)] }), /stop must sit below/);
  assert.throws(() => l2l.simulatePath({ direction: "sideways", entry: 1.1, stop: 1.099, tape: [candle(1.1, 1.1, 1.1, 1.1)] }), /long or short/);
  assert.throws(() => l2l.simulatePath({ direction: "long", entry: 1.1, stop: 1.099, rule: "unknown", tape: [candle(1.1, 1.1, 1.1, 1.1)] }), /unknown frozen rule/);
  assert.throws(() => l2l.simulatePath({ direction: "long", entry: 1.1, stop: 1.099, tape: [] }), /at least one candle/);
});
