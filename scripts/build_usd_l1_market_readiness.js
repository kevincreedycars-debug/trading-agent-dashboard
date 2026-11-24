#!/usr/bin/env node
"use strict";

/**
 * Build the small readiness artefact the Backtest Engine v2 page reads.
 *
 *   node scripts/build_usd_l1_market_readiness.js            write the artefact
 *   node scripts/build_usd_l1_market_readiness.js --check    rebuild and compare
 *   node scripts/build_usd_l1_market_readiness.js --print    print the summary only
 *
 * The published readiness of the market matrix already exists inside
 * `backtesting-screen-v1.json`, but that file is ~18 MB and the browser page must not fetch it to
 * learn four numbers. This script copies the matrix's own counts and per-cell verdicts into a small
 * derived artefact and pins the screen it came from by digest, so the page cannot drift from the
 * published matrix and a rebuild is all a new coordinator needs to refresh what the page shows.
 *
 * Nothing here computes readiness of its own: every published number is copied from the screen and
 * the build refuses to write when the screen does not hold the matrix it expects. The unpublished
 * scratch measurement is carried in a block that is explicitly not published.
 *
 * Research only. Reads committed files; no network, no workflow, no broker.
 */

const fs = require("node:fs");
const path = require("node:path");
const { canonicalText, sha256, stableStringify } = require("../lib/layer1_backtesting/engine");

const ROOT = path.resolve(__dirname, "..");
const SCREEN_PATH = "data/usd-layer1-backtester/backtesting-screen-v1.json";
const RUN_PATH = "data/usd-layer1-backtester/run-v1.json";
const ACQUISITION_PATH = "data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json";
const OUT_PATH = "data/usd-layer1-backtester/market-readiness-v1.json";

// The three markets whose one-hour series were acquired outside the checkout. The acquisition
// record is the evidence they exist; the screen is the evidence they are not published, because a
// committed cell may only use a committed series. Publishing a direction score waits on the
// distribution decision, not on more measurement.
const DISTRIBUTION_PENDING = Object.freeze({
  XAGUSD: "the acquired XAG_USD one-hour rows are held outside the checkout pending the data-distribution decision",
  WTIUSD: "the acquired WTICO_USD one-hour rows are held outside the checkout pending the data-distribution decision",
  GBPUSD: "the acquired GBP_USD one-hour rows are held outside the checkout pending the data-distribution decision"
});

function read(relative) {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  return { bytes, value: JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")) };
}

function digest(bytes) {
  return sha256(bytes.toString("utf8"));
}

function missingFrom(blockers) {
  const names = [];
  for (const blocker of blockers || []) {
    if (/tape/i.test(blocker)) names.push("bid/ask 5-minute tape");
    else if (/ladder/i.test(blocker)) names.push("pre-session level ladder");
  }
  return Array.from(new Set(names));
}

function marketEntry(row) {
  const direction = row.tests.direction;
  const pending = DISTRIBUTION_PENDING[row.market];
  const entry = {
    key: row.market,
    label: row.label,
    role: row.role,
    broker_symbol: row.broker_symbol,
    broker_symbol_confirmed: row.broker_symbol_confirmed,
    direction: {
      status: direction.status,
      publication: direction.status === "scored"
        ? "published"
        : direction.status === "proxy_scored"
          ? "published_on_a_named_proxy"
          : pending
            ? "pending_data_distribution"
            : "blocked_on_input",
      reason: direction.reason,
      scored_sessions: direction.scored
    }
  };
  if (pending) entry.direction.distribution = pending;
  for (const test of ["l2l_full_5r", "l2l_half_3r"]) {
    const cell = row.tests[test];
    entry[test] = {
      status: cell.status,
      missing: missingFrom(cell.blockers),
      sessions_with_tape_and_ladder: cell.sessions_with_tape_and_ladder,
      reason: cell.reason
    };
  }
  return entry;
}

function build() {
  const screen = read(SCREEN_PATH);
  const run = read(RUN_PATH);
  const acquisition = read(ACQUISITION_PATH);
  const matrix = screen.value.market_matrix;
  if (!matrix || !matrix.counts || !Array.isArray(matrix.rows) || matrix.rows.length !== matrix.market_count) {
    throw new Error(`${SCREEN_PATH} does not carry the market matrix this artefact derives from`);
  }
  const counts = matrix.counts;
  const combinations = matrix.market_count * matrix.test_count;
  const total = counts.scored + counts.proxy_scored + counts.measured_tick_replay + counts.blocked;
  if (total !== combinations) {
    throw new Error(`the matrix counts (${total}) do not add up to ${combinations} market x test cells`);
  }
  const markets = matrix.rows.map(marketEntry);
  const acquired = new Map((acquisition.value.markets || []).map(entry => [entry.market, entry]));
  for (const key of Object.keys(DISTRIBUTION_PENDING)) {
    const held = acquired.get(key);
    const cell = markets.find(entry => entry.key === key);
    if (!held || !cell || cell.direction.status !== "blocked") {
      throw new Error(`${key} must be blocked in the screen and present in the acquisition record`);
    }
    cell.direction.acquisition = {
      instrument: held.instrument,
      rows: held.rows,
      csv_sha256: held.csv_sha256,
      sessions: held.boundary_coverage.sessions,
      cutoff_present: held.boundary_coverage.cutoff_present,
      endpoint_present: held.boundary_coverage.endpoint_present,
      both_present: held.boundary_coverage.both_present,
      licence: acquisition.value.licence && (acquisition.value.licence.position || acquisition.value.licence.status)
        ? (acquisition.value.licence.position || acquisition.value.licence.status)
        : null
    };
  }
  const body = {
    schema_version: "usd-l1-market-readiness-v1",
    research_only: true,
    generated_at: screen.value.generated_at,
    title: "Published readiness of the USD Layer 1 market matrix",
    published: {
      matrix_id: matrix.id,
      fingerprint: matrix.fingerprint,
      markets: matrix.market_count,
      tests: matrix.test_count,
      combinations,
      measured_at: screen.value.generated_at,
      counts: {
        scored: counts.scored,
        proxy_scored: counts.proxy_scored,
        measured_tick_replay: counts.measured_tick_replay,
        blocked: counts.blocked,
        ready: counts.ready,
        proxy_ready: counts.proxy_ready
      },
      note: matrix.note
    },
    unpublished_research: {
      id: "h1-present-scratch-20261124",
      published: false,
      status: "scratch_measurement",
      label: "Scratch run with the H1-present one-hour series in the working tree",
      counts: { scored: 7, proxy_scored: 1, measured_tick_replay: 8, blocked: 8 },
      provenance: "measured in a scratch run; no committed artefact carries it and no published count includes it",
      note: "This is research evidence, not live readiness. The published matrix above is the only readiness this page reports."
    },
    markets,
    advantage: {
      status: "not_established",
      statement: "No cell in the published matrix establishes a predictive advantage; the matrix reports measurement status, not accuracy or edge."
    },
    refresh: {
      build: "npm run build:usd-l1-market-readiness",
      check: "npm run check:usd-l1-market-readiness",
      inputs: [SCREEN_PATH, RUN_PATH, ACQUISITION_PATH],
      contract: "A coordinator build regenerates this artefact from the published screen; the page reads it at open, so refreshing the map needs no UI edit."
    },
    provenance: {
      screen_sha256: digest(screen.bytes),
      screen_bytes: screen.bytes.length,
      panel_sha256: digest(run.bytes),
      panel_bytes: run.bytes.length,
      acquisition_sha256: digest(acquisition.bytes),
      acquisition_bytes: acquisition.bytes.length,
      note: "Every published count is copied from the screen's own market_matrix block; the build fails rather than inventing a number."
    }
  };
  return { ...body, readiness_sha256: sha256(stableStringify(body)) };
}

function summary(record) {
  const counts = record.published.counts;
  return [
    `${record.title} (${record.schema_version})`,
    `${record.published.markets} markets x ${record.published.tests} tests = ${record.published.combinations} cells, measured ${record.published.measured_at}`,
    `published: scored ${counts.scored} · proxy ${counts.proxy_scored} · measured_tick_replay ${counts.measured_tick_replay} · blocked ${counts.blocked}`,
    `unpublished scratch: ${record.unpublished_research.counts.scored}/${record.unpublished_research.counts.proxy_scored}/${record.unpublished_research.counts.measured_tick_replay}/${record.unpublished_research.counts.blocked} (not live readiness)`,
    `advantage: ${record.advantage.status}`
  ].join("\n") + "\n";
}

function main(argv) {
  const record = build();
  const text = `${JSON.stringify(record, null, 2)}\n`;
  const target = path.join(ROOT, OUT_PATH);
  if (argv.includes("--print")) {
    process.stdout.write(summary(record));
    return 0;
  }
  if (argv.includes("--check")) {
    if (!fs.existsSync(target)) {
      process.stderr.write(`missing ${OUT_PATH}; run node scripts/build_usd_l1_market_readiness.js\n`);
      return 1;
    }
    if (canonicalText(fs.readFileSync(target, "utf8")) !== canonicalText(text)) {
      process.stderr.write(`${OUT_PATH} differs from a fresh build; rerun the builder\n`);
      return 1;
    }
    process.stdout.write(`market readiness reproduces: ${record.readiness_sha256}\n`);
    return 0;
  }
  fs.writeFileSync(target, text, "utf8");
  process.stdout.write(summary(record));
  process.stdout.write(`wrote ${OUT_PATH} (${record.readiness_sha256})\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { build, summary, OUT_PATH, DISTRIBUTION_PENDING };
