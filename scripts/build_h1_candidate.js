#!/usr/bin/env node
/**
 * Build the separately versioned H1 candidate for test 1 on the FTMO `DXY.cash` tape.
 *
 * Usage:
 *   node scripts/build_h1_candidate.js            write data/usd-layer1-backtester/h1-v1/candidate-dxy-cash.json
 *   node scripts/build_h1_candidate.js --check     rebuild and compare with the committed artefact
 *   node scripts/build_h1_candidate.js --print     print the answer and write nothing
 *   node scripts/build_h1_candidate.js --quiet     write, and print one line
 *
 * Deterministic: it reads the committed run-v1 panel, the exported tape and the committed evidence bundles,
 * and stamps no generation time, so `--check` compares content rather than a timestamp.
 *
 * Research only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { loadSeries } = require("../backtester/lib/usd_layer1_backtester/dxy_series");
const { readRun } = require("../lib/layer1_backtesting/h1_population");
const { buildCandidate, VERSION } = require("../lib/layer1_backtesting/h1_candidate_dxy_cash");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = "data/usd-layer1-backtester/h1-v1/candidate-dxy-cash.json";
const SCREEN_PATH = "data/usd-layer1-backtester/backtesting-screen-v1.json";

function readCoverage() {
  const absolute = path.join(ROOT, SCREEN_PATH);
  if (!fs.existsSync(absolute)) return null;
  const screen = JSON.parse(fs.readFileSync(absolute, "utf8"));
  return (screen.h1 && screen.h1.coverage) || null;
}

function build() {
  const run = readRun({ root: ROOT });
  const series = loadSeries(path.join(ROOT, "backtester", "tmp", "ftmo_dxy_cash_h1.csv"));
  return buildCandidate({ root: ROOT, run, series, coverage: readCoverage() });
}

function printAnswer(candidate) {
  console.log(`${candidate.version}  (lineage ${candidate.lineage})`);
  console.log(`instrument        ${candidate.instrument.symbol} - ${candidate.instrument.label}, broker CFD, not ICE`);
  console.log(`read rule         ${candidate.input_rule.adopted.id}`);
  console.log(`window            ${candidate.window.sessions} sessions from ${candidate.window.first_session}`);
  console.log(
    `answer            ${candidate.answer.priced} priced / ${candidate.answer.scored} scored / ${candidate.answer.hits}H-${candidate.answer.misses}M / ${candidate.answer.accuracy_pct}% (lower ${candidate.answer.lower_bound_pct}%)`
  );
  console.log(
    `as published      ${candidate.as_published_lane.counts.priced} priced / ${candidate.as_published_lane.counts.scored} scored / ${candidate.as_published_lane.counts.hits}H-${candidate.as_published_lane.counts.misses}M / ${candidate.as_published_lane.counts.accuracy_pct}%`
  );
  console.log(`reproduces run-v1 ${candidate.reproduction.matches}`);
  console.log(`flips             ${candidate.flips.count}`);
  for (const flip of candidate.flips.sessions) {
    console.log(
      `  ${flip.date} call ${flip.call}: admissible ${flip.admissible.outcome} at ${flip.admissible.move_pct}% vs published ${flip.as_published.outcome} at ${flip.as_published.move_pct}%`
    );
  }
  console.log(`leakage           admissible ${candidate.leakage.admissible.violations}, as published ${candidate.leakage.as_published.violations}`);
  console.log(`fridays           ${candidate.fridays.window_fridays} in window, ${candidate.fridays.priced} priced, ${candidate.fridays.unpriced} unpriced`);
  console.log(`eligible mornings ${candidate.inputs.fully_eligible_mornings}`);
}

function main(argv) {
  const candidate = build();
  const text = `${JSON.stringify(candidate, null, 2)}\n`;
  const absolute = path.join(ROOT, OUT_PATH);

  if (argv.includes("--check")) {
    const committed = fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null;
    if (committed === null) {
      console.error(`${OUT_PATH} is missing; run without --check to write it`);
      return 1;
    }
    if (committed !== text) {
      console.error(`${OUT_PATH} does not match the committed run, the tape and the evidence bundles`);
      return 1;
    }
    console.log(`${VERSION} reproduces ${OUT_PATH}`);
    return 0;
  }

  if (argv.includes("--print")) {
    printAnswer(candidate);
    return 0;
  }

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, text);
  if (argv.includes("--quiet")) {
    console.log(`${VERSION}: ${candidate.answer.scored} scored, written to ${OUT_PATH}`);
  } else {
    printAnswer(candidate);
    console.log(`written           ${OUT_PATH}`);
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
