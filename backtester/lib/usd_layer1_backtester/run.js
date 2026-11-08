"use strict";

/**
 * Build the run artefact the panel renders (research only).
 *
 * One function, one artefact: the North Star, the frozen parameters both models were scored with, the four
 * tests, the per-session drill-down and the execution demo. Everything is derived in this process from files
 * that are named in `provenance`, so a figure on the panel can always be traced back to a row.
 *
 * The engine writes the artefact into the ignored research folder. Publishing a copy under `data/` for the
 * dashboard is a separate, explicit step in `backtester/scripts/run_usd_layer1_backtest.js`.
 */

const fs = require("node:fs");
const path = require("node:path");

const contracts = require("./contracts");
const challenger = require("./challenger");
const currentModel = require("./current_model");
const inputs = require("./inputs");
const snapshotsModule = require("./snapshots");
const outcomesModule = require("./outcomes");
const testsModule = require("./tests");
const { buildExecutionDemo } = require("./demo");

const MARKET_SERIES_FILES = Object.freeze({
  EURUSD: "oanda_eur_usd_h1.csv",
  XAUUSD: "oanda_xau_usd_h1.csv",
  BTCUSD: "binance_btcusdt_1h.csv",
  NAS100: "oanda_nas100_usd_h1.csv"
});

/** Load every series the run needs, and say which ones were absent. */
function loadSeries(rootDir) {
  const cacheDir = path.join(rootDir, "backtester", "tmp");
  const seriesByMarket = {};
  const provenance = [];
  for (const market of contracts.MARKETS) {
    const file = path.join(cacheDir, MARKET_SERIES_FILES[market.key]);
    const series = inputs.readHourlySeries(file);
    seriesByMarket[market.key] = series;
    if (series) {
      provenance.push({
        ...inputs.describeFile(file, `${market.label} one-hour closes, used for the session outcome`),
        rows: series.bars,
        start: series.first,
        end: series.last
      });
    }
  }
  const goldFile = path.join(cacheDir, MARKET_SERIES_FILES.XAUUSD);
  const nasdaqFile = path.join(cacheDir, MARKET_SERIES_FILES.NAS100);
  return {
    seriesByMarket,
    modelSeries: {
      gold: seriesByMarket.XAUUSD,
      nasdaq100: seriesByMarket.NAS100
    },
    provenance,
    files: { goldFile, nasdaqFile }
  };
}

/** Count the sessions a model actually called, rather than the sessions it was asked about. */
function modelCoverage({ dates, calls, name }) {
  const convictions = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const missingCounts = {};
  let called = 0;
  let noCall = 0;
  for (const date of dates) {
    const call = calls.get(date);
    if (!call || call.direction === "NO_CALL") {
      noCall += 1;
      continue;
    }
    called += 1;
    if (call.conviction) convictions[call.conviction] = (convictions[call.conviction] || 0) + 1;
    for (const key of call.missing_inputs || []) missingCounts[key] = (missingCounts[key] || 0) + 1;
  }
  return {
    model: name,
    sessions_eligible: dates.length,
    calls_reconstructed: called,
    no_call_sessions: noCall,
    call_coverage_pct: dates.length ? Math.round((called / dates.length) * 10000) / 100 : null,
    convictions,
    inputs_missing_histogram: missingCounts
  };
}


/** The words the panel shows for what is holding each lane up. */
function coverageByTest({ dates, outcomes, callsByModel, demo, flatBands }) {
  const outcomeDates = dates.filter((date) =>
    Object.values(outcomes[date] || {}).some((entry) => entry && entry.present));
  const scorableTwo = dates.filter((date) =>
    Object.values(outcomes[date] || {}).some((entry) => entry && entry.direction && entry.direction !== "FLAT"));
  const callsReady = (model) => dates.filter((date) => {
    const call = callsByModel[model].get(date);
    return call && call.direction !== "NO_CALL";
  }).length;

  return {
    dxy_direction: {
      usable_sessions: 0,
      sessions_with_a_call: { current: callsReady("current"), challenger: callsReady("challenger") },
      holding_it_up: [
        "no licensed ICE cash DXY history, so neither endpoint of the session can be priced for this test",
        "the FRED DTWEXBGS series stored as dxy_level is a lagged broad index and is refused as a substitute"
      ],
      unblocks_when: "a licensed cash DXY history with 05:00 and next-05:00 London prints is staged"
    },
    four_markets: {
      usable_sessions: scorableTwo.length,
      sessions_with_any_outcome: outcomeDates.length,
      sessions_with_a_call: { current: callsReady("current"), challenger: callsReady("challenger") },
      holding_it_up: [
        `${dates.length - outcomeDates.length} sessions have no cached one-hour tape for at least one market`,
        "the DXY-confirmed column needs the same licensed series test 1 is waiting for"
      ],
      unblocks_when: "the one-hour caches are refreshed to the end of the eligible window"
    },
    l2l_full_5r: {
      usable_sessions: 0,
      holding_it_up: [
        "no 5-minute tape exists in this checkout beyond the two-day EUR/USD demo",
        "no archived level ladder exists for any of the four markets before the setups",
        "no reconstructed 05:00 call exists for the demo's dates, so the demo cannot carry a model comparison"
      ],
      unblocks_when: "M5 tapes and pre-session level ladders are archived per market per session",
      demo_accounts: demo && demo.available ? demo.accounts.map((account) => account.id) : []
    },
    l2l_half_3r: {
      usable_sessions: 0,
      holding_it_up: [
        "the half grid inherits every blocker of the full grid, since a midpoint needs an original pair first",
        "no midpoint has ever fired on the demo tape, so the 3R geometry is exercised but not yet validated"
      ],
      unblocks_when: "M5 tapes and pre-session level ladders are archived per market per session",
      demo_accounts: demo && demo.available ? demo.accounts.map((account) => account.id) : []
    },
    flat_bands: flatBands
  };
}

/** The stage ladder the progress strip shows, with the current stage marked. */
function buildProgress({ dates, coverage, tests }) {
  const scoredTwo = tests.four_markets.models.challenger.markets.EURUSD.overall;
  const stages = [
    {
      key: "engine",
      label: "Engine and frozen parameters",
      state: "done",
      detail:
        "the challenger's equal-weight mechanisms, conviction bands, minimum-data rule and the current model's " +
        "own replay are frozen in code and unit-tested before any date is scored"
    },
    {
      key: "calls",
      label: "Daily call reconstruction",
      state: "done",
      detail:
        `${dates.length} eligible 05:00 sessions reconstructed for both models: ` +
        `${coverage.by_model.current.calls_reconstructed} current calls and ` +
        `${coverage.by_model.challenger.calls_reconstructed} challenger calls`
    },
    {
      key: "test2",
      label: "Test 2 - four markets",
      state: scoredTwo.scored ? "running" : "waiting",
      detail: scoredTwo.scored
        ? `${scoredTwo.scored} EUR/USD sessions scored for the challenger (${scoredTwo.hits} right, ` +
          `${scoredTwo.misses} wrong, ${scoredTwo.flat} flat)`
        : "no session has both a call and a usable outcome yet"
    },
    {
      key: "test1",
      label: "Test 1 - DXY direction",
      state: "blocked",
      detail: "waiting on a licensed ICE cash DXY history; no substitute is used"
    },
    {
      key: "tests34",
      label: "Tests 3 and 4 - L2L execution",
      state: "blocked",
      detail: "waiting on 5-minute tapes and pre-session level ladders per market; the two-day demo runs meanwhile"
    }
  ];
  return {
    current_stage: "test2",
    current_stage_label: "Test 2 - four markets",
    current_stage_detail: stages[2].detail,
    stages
  };
}

/** The historical hourly ADR study, kept under its own benchmark label and never mixed with the four tests. */
function readBenchmark(rootDir) {
  const comparisonPath = path.join(rootDir, "data", "usd-24h-baseline-comparison.json");
  const manifestPath = path.join(rootDir, "data", "usd-24h-research-dataset.json");
  if (!fs.existsSync(comparisonPath)) return { available: false, reason: "data/usd-24h-baseline-comparison.json is not present" };
  const comparison = JSON.parse(fs.readFileSync(comparisonPath, "utf8"));
  const arm = comparison.arms && comparison.arms.engine_replayed_asof ? comparison.arms.engine_replayed_asof : null;
  const metrics = arm && arm.metrics ? arm.metrics : {};
  const compact = {};
  for (const [key, value] of Object.entries(metrics)) {
    compact[key] = {
      scheduled: value.scheduled,
      directional_calls: value.directional_calls,
      ex_flat_accuracy_pct: value.ex_flat_accuracy_pct,
      ex_flat_lower_bound_pct: value.ex_flat_lower_bound_pct ?? null,
      flat: value.flat,
      wrong: value.wrong,
      correct: value.correct
    };
  }
  const manifest = fs.existsSync(manifestPath)
    ? (() => {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        return { window: parsed.window || null, rows: Array.isArray(parsed.rows) ? parsed.rows.length : null };
      })()
    : null;
  return {
    available: true,
    label: contracts.LABELS.benchmark,
    source: "data/usd-24h-baseline-comparison.json (arm engine_replayed_asof) over data/usd-24h-research-dataset.json",
    scope: "09:30 ET call to the next 16:00 ET close on FRED DTWEXBGS; a different session, a different series",
    splits: comparison.splits || null,
    dataset: manifest,
    metrics: compact,
    not_comparable_because:
      "the benchmark measures a 09:30 ET to 16:00 ET horizon on a lagged broad index, so it is reported beside the " +
      "four tests and never scored as one of them"
  };
}

/** Every input the run read, so the artefact can be traced back to files and their hashes. */
function describeProvenance({ rootDir, frame, inventory, loaded, demo }) {
  const entries = [];
  entries.push({
    ...inputs.describeFile(inputs.FRAME_PATH, "05:00 macro as-of frame (values published by the cutoff, with staleness)"),
    rows: frame.rows.length,
    start: frame.rows[0].date,
    end: frame.rows[frame.rows.length - 1].date
  });
  for (const entry of loaded.provenance) entries.push(entry);
  if (inventory) {
    entries.push({
      ...inputs.describeFile(
        inputs.INVENTORY_PATH,
        "committed macro inventory: the declared as-of rule and provider provenance"
      ),
      rows: inventory.series_count
    });
  }
  return {
    inputs: entries,
    inventory,
    frame_note: frame.note || null,
    frame_generated_at: frame.generated_at || null,
    demo_ledgers: demo && demo.available ? demo.provenance : null,
    notes: [
      "the frame is local evidence under backtester/tmp/ and is deliberately not committed; it is rebuilt from public FRED",
      "acquisition by `npm run macro-inventory`, and its sha256 is recorded above so a rerun can be compared",
      "the one-hour outcome and price series are cached provider downloads; their sha256 and row counts are above",
      "nothing in this run reads the network, the warehouse, the dispatcher, the live trader or an order-routing path"
    ],
    root: path.relative(path.resolve(__dirname, "../../.."), path.resolve(rootDir || path.resolve(__dirname, "../../..")))
  };
}

/** The per-date row lists are for tests and CSV export; the session rows already carry the same detail. */
function stripRowLists(value) {
  if (Array.isArray(value)) return value.map(stripRowLists);
  if (value && typeof value === "object") {
    const copy = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "rows" && Array.isArray(entry)) continue;
      copy[key] = stripRowLists(entry);
    }
    return copy;
  }
  return value;
}

/**
 * Build the whole artefact.
 *
 * @param {object} [options]
 * @param {string} [options.rootDir] repository root.
 * @param {string} [options.generatedAt] ISO timestamp to stamp the artefact with.
 */
function buildArtefact({ rootDir, generatedAt } = {}) {
  const root = rootDir || path.resolve(__dirname, "../../..");
  const frame = inputs.readFrame();
  const inventory = inputs.readInventory();
  const loaded = loadSeries(root);
  const snapshots = snapshotsModule.buildSnapshots({ frame, series: loaded.modelSeries });
  const dates = snapshots.map((snapshot) => snapshot.date);
  const stamp = generatedAt || new Date().toISOString();

  const callsByModel = { current: new Map(), challenger: new Map() };
  for (const snapshot of snapshots) {
    callsByModel.current.set(snapshot.date, currentModel.evaluate(snapshot));
    callsByModel.challenger.set(snapshot.date, challenger.evaluate(snapshot));
  }

  const developmentDates = dates.filter((date) => testsModule.splitOf(date).key === "development");
  const moves = outcomesModule.readSessionMoves({ sessions: snapshots, seriesByMarket: loaded.seriesByMarket });
  const flatBands = outcomesModule.freezeFlatBands(moves, developmentDates);
  const outcomes = outcomesModule.classifyMoves(moves, flatBands);

  const demo = buildExecutionDemo({ rootDir: root });
  const test1 = testsModule.testDxyDirection({ dates, callsByModel });
  const test2 = testsModule.testFourMarkets({ dates, callsByModel, outcomes });
  const test3 = testsModule.testLineToLine({
    id: "l2l_full_5r",
    ordinal: 3,
    geometry: {
      grid: "original marked levels only",
      target: "next original level in the trade direction",
      stop: "entry-to-target distance divided by 5"
    },
    demo
  });
  const test4 = testsModule.testLineToLine({
    id: "l2l_half_3r",
    ordinal: 4,
    geometry: {
      grid: "original marked levels plus one midpoint between each adjacent pair",
      target: "next adjacent level on the combined grid",
      stop: "entry-to-target distance divided by three"
    },
    demo
  });

  const coverage = {
    by_model: {
      current: modelCoverage({ dates, calls: callsByModel.current, name: "current" }),
      challenger: modelCoverage({ dates, calls: callsByModel.challenger, name: "challenger" })
    },
    by_test: coverageByTest({ dates, outcomes, callsByModel, demo, flatBands })
  };
  const tests = stripRowLists({
    dxy_direction: test1,
    four_markets: test2,
    l2l_full_5r: test3,
    l2l_half_3r: test4
  });
  const progress = buildProgress({ dates, coverage, tests });

  return {
    schema_version: contracts.SCHEMA_VERSION,
    generated_at: stamp,
    research_only: true,
    north_star: contracts.NORTH_STAR_TEXT,
    labels: contracts.LABELS,
    run: {
      run_version: contracts.RUN_VERSION,
      challenger_version: challenger.VERSION,
      challenger_frozen_on: challenger.FROZEN_ON,
      challenger_frozen_before: challenger.FROZEN_BEFORE,
      current_model_version: contracts.CURRENT_MODEL_VERSION,
      session_contract: contracts.SESSION_CONTRACT,
      account: contracts.ACCOUNT,
      conviction: contracts.CONVICTION,
      markets: contracts.MARKETS,
      splits: testsModule.SPLITS,
      flat_bands: flatBands,
      date_range: { start: dates[0], end: dates[dates.length - 1] },
      sessions_eligible: dates.length,
      sessions_processed: snapshots.length,
      last_update: stamp,
      official_dxy: contracts.OFFICIAL_DXY,
      challenger_mechanisms: challenger.MECHANISMS.map((mechanism) => ({
        id: mechanism.id,
        label: mechanism.label,
        factor: mechanism.factor,
        input: mechanism.input,
        rule: mechanism.rule,
        threshold: mechanism.threshold,
        weight: challenger.RULES.equal_weight
      })),
      challenger_rules: {
        min_usable_mechanisms: challenger.RULES.min_usable_mechanisms,
        agreement_deadband: challenger.RULES.agreement_deadband,
        conviction_bands: challenger.RULES.conviction_bands
      },
      challenger_excluded_inputs: challenger.EXCLUDED_INPUTS,
      absent_inputs: inputs.ABSENT_INPUTS
    },
    progress,
    coverage,
    tests,
    sessions: buildSessionRows({ snapshots, callsByModel, outcomes }),
    execution_demo: demo,
    benchmarks: { hourly_adr: readBenchmark(root) },
    provenance: describeProvenance({ rootDir: root, frame, inventory, loaded, demo })
  };
}

/**
 * One row per session: what was known at 05:00, what each model called, and what happened next.
 *
 * The drill-down reads these rows, so the panel can never show a call that the tables did not score.
 */
function buildSessionRows({ snapshots, callsByModel, outcomes }) {
  return snapshots.map((snapshot) => {
    const date = snapshot.date;
    const currentCall = callsByModel.current.get(date);
    const challengerCall = callsByModel.challenger.get(date);
    const split = testsModule.splitOf(date);

    const perMarket = {};
    for (const market of contracts.MARKETS) {
      const outcome = outcomes[date] ? outcomes[date][market.key] : null;
      perMarket[market.key] = {
        direction: outcome ? outcome.direction : null,
        move_pct: outcome && Number.isFinite(outcome.move_pct) ? outcome.move_pct : null,
        flat_band_pct: outcome ? outcome.flat_band_pct : null,
        present: outcome ? Boolean(outcome.present) : false,
        reason: outcome && !outcome.present ? outcome.reason : null
      };
    }

    const results = { current: {}, challenger: {} };
    for (const [model, call] of [["current", currentCall], ["challenger", challengerCall]]) {
      for (const market of contracts.MARKETS) {
        const outcome = outcomes[date] ? outcomes[date][market.key] : null;
        if (!call || call.direction === "NO_CALL") results[model][market.key] = "no_call";
        else if (!outcome || !outcome.direction) results[model][market.key] = "no_outcome";
        else if (outcome.direction === "FLAT") results[model][market.key] = "flat";
        else {
          results[model][market.key] =
            outcome.direction === testsModule.predictedDirection(call.direction, market) ? "hit" : "miss";
        }
      }
    }

    return {
      date,
      cutoff_at_utc: snapshot.cutoff_at_utc,
      cutoff_offset_abbrev: snapshot.cutoff_offset_abbrev,
      endpoint_at_utc: snapshot.endpoint_at_utc,
      window_hours: snapshot.window_hours,
      split: split.label,
      split_key: split.key,
      inputs: {
        vix_level: snapshot.values.vix_level,
        vix_d5_chg: snapshot.values.vix_d5_chg,
        us_2y_d5_bps: snapshot.values.us_2y_d5_bps,
        us_10y_real_d5_bps: snapshot.values.us_10y_real_d5_bps,
        broad_dollar_d5_pct: snapshot.values.broad_dollar_d5_pct,
        gold_d5_pct: snapshot.values.gold_d5_pct,
        nasdaq100_d5_pct: snapshot.values.nasdaq100_d5_pct,
        eurusd_d5_pct: snapshot.values.eurusd_d5_pct,
        usdjpy_d5_pct: snapshot.values.usdjpy_d5_pct,
        gold_price: snapshot.values.gold_price,
        nasdaq100_price: snapshot.values.nasdaq100_price,
        eurusd: snapshot.values.eurusd
      },
      inputs_missing: snapshot.missing.map((entry) => entry.key),
      models: {
        current: {
          direction: currentCall.direction,
          direction_label: currentCall.direction_label,
          conviction: currentCall.conviction,
          conviction_raw: currentCall.conviction_raw,
          net_weight: currentCall.raw_score.net_weight,
          factors_live: currentCall.inputs_used.length,
          missing_inputs: currentCall.missing_inputs,
          reason: currentCall.reason
        },
        challenger: {
          direction: challengerCall.direction,
          conviction: challengerCall.conviction,
          raw_score: challengerCall.raw_score,
          usable_mechanisms: challengerCall.usable_mechanisms,
          agreement: challengerCall.agreement,
          participation: challengerCall.participation,
          missing_inputs: challengerCall.missing_inputs,
          reason: challengerCall.reason
        }
      },
      outcomes: perMarket,
      results
    };
  });
}

module.exports = {
  MARKET_SERIES_FILES,
  loadSeries,
  modelCoverage,
  coverageByTest,
  buildProgress,
  readBenchmark,
  describeProvenance,
  buildSessionRows,
  stripRowLists,
  buildArtefact
};
