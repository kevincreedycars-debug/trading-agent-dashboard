"use strict";

/**
 * Chronological periods for the USD 24-hour study.
 *
 * Development is where thresholds, weights and the challenger are fitted, validation is where the
 * frozen family of rule sets is compared, and the holdout is read once after the winner is frozen.
 * The periods partition the dataset with no gaps and no overlap.
 */

const SPLITS = Object.freeze({
  dev: { start: "2024-01-02", end: "2025-03-31" },
  validation: { start: "2025-04-01", end: "2025-10-31" },
  holdout: { start: "2025-11-03", end: "2026-04-30" }
});

const PERIOD_ORDER = Object.freeze(["dev", "validation", "holdout"]);

function periodOf(dateLiteral) {
  for (const period of PERIOD_ORDER) {
    const split = SPLITS[period];
    if (dateLiteral >= split.start && dateLiteral <= split.end) return period;
  }
  return null;
}

function rowsInPeriod(rows, period) {
  const split = SPLITS[period];
  if (!split) throw new Error(`Unknown period: ${period}`);
  return rows.filter((row) => row.snapshot_date >= split.start && row.snapshot_date <= split.end);
}

function rowsOnOrBefore(rows, period) {
  const split = SPLITS[period];
  if (!split) throw new Error(`Unknown period: ${period}`);
  return rows.filter((row) => row.snapshot_date <= split.end);
}

module.exports = {
  PERIOD_ORDER,
  SPLITS,
  periodOf,
  rowsInPeriod,
  rowsOnOrBefore
};
