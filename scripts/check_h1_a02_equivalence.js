/**
 * Verify H1-A02's measured equivalence claim against the tracked artefacts.
 *
 * The amendment `H1-A02` replaces the H.15 attribution of the 10-year real yield with the publisher of
 * record, the U.S. Department of the Treasury. It does not change the instrument, the units or the
 * five-interval transform, so the reconstruction must reproduce the legacy stored scalar
 * `inputs.us_10y_real_d5_bps` wherever the two windows are built the same way, and differ only where the
 * legacy scalar filled a day the Treasury did not publish.
 *
 * The numbers that claim rests on are stored in `REAL_AMENDMENT.equivalence`. This script recomputes them
 * from `data/usd-layer1-backtester/run-v1.json` and `data/usd-layer1-backtester/h1-v1/real.json` and exits
 * non-zero if any recorded figure has drifted. A clean-week share below the recorded value means the
 * transform, the units or the alignment is wrong, which voids the amendment; it is not a tuning target.
 *
 * Usage:
 *   node scripts/check_h1_a02_equivalence.js
 *   node scripts/check_h1_a02_equivalence.js --verbose
 *
 * Research only. Reads two committed files; writes nothing.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { amendmentFor } = require("../lib/layer1_backtesting/h1_source_amendments");

const ROOT = path.resolve(__dirname, "..");
const RUN_PATH = "data/usd-layer1-backtester/run-v1.json";
const BUNDLE_PATH = "data/usd-layer1-backtester/h1-v1/real.json";
const LEGACY_FIELD = "us_10y_real_d5_bps";
const IDENTICAL_WITHIN_BP = 0.005;
const CLEAN_WEEK_SPAN_DAYS = 7;

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function share(list, predicate) {
  if (!list.length) return null;
  return Math.round((list.filter(predicate).length / list.length) * 1000) / 10;
}

/**
 * One comparable morning: the legacy scalar, the Treasury reconstruction, their difference, and the
 * calendar span of the five-interval window the reconstruction actually used. A window that spans a
 * Treasury non-publication day is longer than seven calendar days; a clean week is exactly seven.
 */
function compare({ run, bundle }) {
  const records = new Map(bundle.records.map((record) => [record.session_date, record]));
  const comparable = [];
  for (const session of run.sessions) {
    const legacy = session.inputs ? session.inputs[LEGACY_FIELD] : undefined;
    const record = records.get(session.date);
    if (typeof legacy !== "number" || !record || !Array.isArray(record.operands)) continue;
    if (record.operands.length < 6) continue;
    const first = Date.parse(`${record.operands[0].observed_at_utc.slice(0, 10)}T00:00:00Z`);
    const last = Date.parse(`${record.operands[record.operands.length - 1].observed_at_utc.slice(0, 10)}T00:00:00Z`);
    comparable.push({
      date: session.date,
      legacy,
      treasury: Math.round(record.value * 1000) / 1000,
      delta_bp: Math.round((record.value - legacy) * 1000) / 1000,
      span_days: Math.round((last - first) / 86400000),
    });
  }
  const identical = (item) => Math.abs(item.delta_bp) < IDENTICAL_WITHIN_BP;
  const clean = comparable.filter((item) => item.span_days <= CLEAN_WEEK_SPAN_DAYS);
  const holiday = comparable.filter((item) => item.span_days > CLEAN_WEEK_SPAN_DAYS);
  const different = comparable.filter((item) => !identical(item));
  const deltas = different.map((item) => Math.abs(item.delta_bp));
  return {
    compared_mornings: comparable.length,
    identical_mornings: comparable.length - different.length,
    different_mornings: different.length,
    clean_week_windows: clean.length,
    clean_week_identical_mornings: clean.filter(identical).length,
    clean_week_identical_share: share(clean, identical),
    holiday_spanning_windows: holiday.length,
    holiday_spanning_identical_mornings: holiday.filter(identical).length,
    holiday_spanning_identical_share: share(holiday, identical),
    max_abs_delta_bp: deltas.length ? Math.max(...deltas) : null,
    mean_abs_delta_bp: deltas.length
      ? Math.round((deltas.reduce((sum, value) => sum + value, 0) / deltas.length) * 100) / 100
      : null,
    _comparable: comparable,
    _different: different,
  };
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const amendment = amendmentFor("real");
  if (!amendment || !amendment.equivalence) {
    throw new Error("h1-a02 equivalence: the `real` amendment carries no `equivalence` block");
  }
  const recorded = amendment.equivalence;
  const measured = compare({ run: readJson(RUN_PATH), bundle: readJson(BUNDLE_PATH) });
  const fields = [
    "compared_mornings",
    "identical_mornings",
    "different_mornings",
    "clean_week_windows",
    "clean_week_identical_mornings",
    "clean_week_identical_share",
    "holiday_spanning_windows",
    "holiday_spanning_identical_mornings",
    "holiday_spanning_identical_share",
    "max_abs_delta_bp",
    "mean_abs_delta_bp",
  ];
  const drift = fields.filter((field) => measured[field] !== recorded[field]);
  for (const field of fields) {
    const mark = measured[field] === recorded[field] ? "ok" : "DRIFT";
    console.log(`${mark.padEnd(5)} ${field}: recorded ${recorded[field]} / measured ${measured[field]}`);
  }
  if (verbose) {
    console.log("worst deltas");
    console.log(
      measured._different
        .slice()
        .sort((left, right) => Math.abs(right.delta_bp) - Math.abs(left.delta_bp))
        .slice(0, 12)
        .map(
          (item) =>
            `${item.date} legacy ${item.legacy} treasury ${item.treasury} delta ${item.delta_bp}bp span ${item.span_days}d`
        )
        .join("\n")
    );
  }
  if (drift.length) {
    console.error(
      `\nH1-A02 equivalence does not reproduce: ${drift.length} field(s) drifted (${drift.join(", ")}). ` +
        "Re-measure before quoting the amendment; do not edit the recorded figures to match."
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `\nH1-A02 equivalence reproduces: ${measured.identical_mornings} of ${measured.compared_mornings} mornings ` +
      `identical, clean-week share ${measured.clean_week_identical_share}%, holiday-spanning share ` +
      `${measured.holiday_spanning_identical_share}%.`
  );
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { compare, LEGACY_FIELD, IDENTICAL_WITHIN_BP, CLEAN_WEEK_SPAN_DAYS };
