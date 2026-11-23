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
const challengerV1 = require("./challenger_v1");
const currentModel = require("./current_model");
const dataPath = require("./data_path");
const dxySeries = require("./dxy_series");
const factors = require("./factors");
const inputs = require("./inputs");
const reproduce = require("./reproduce");
const snapshotsModule = require("./snapshots");
const outcomesModule = require("./outcomes");
const testsModule = require("./tests");
const reviewModule = require("./adjudication_review");
const modelIdentity = require("./model_identity");
const ruleWiring = require("./rule_wiring");
const cutoffModule = require("./cutoff_study");
const de2y = require("./de_2y");
const levelProvenanceModule = require("./level_provenance");
const { buildExecutionDemo } = require("./demo");
const votesModule = require("../../../lib/usd_l1_votes");

/** The ladder the two line-to-line tests replay, and the sweep status the panel leads with. */
const LADDER_PATHS = Object.freeze([
  path.join("data", "l2l-levels.json"),
  path.join("backtester", "tmp", "usd-session-research", "raw", "main", "data__l2l-levels.json")
]);
const TICK_SWEEP_PATH = path.join("data", "usd-layer1-backtester", "l2l-tick-sweep-v1.json");

/**
 * Every derived value the two models read, saved beside each session so the day can be re-run from the
 * artefact alone. The challenger reads the first nine; the current model's replay row reads the rest.
 */
const SAVED_INPUT_KEYS = Object.freeze([
  "vix_level",
  "vix_d5_chg",
  "us_2y_d5_bps",
  "us_10y_real_d5_bps",
  "broad_dollar_d5_pct",
  "gold_d5_pct",
  "nasdaq100_d5_pct",
  "eurusd_d5_pct",
  "usdjpy_d5_pct",
  "usdjpy_d1_pct",
  "usdchf_d1_pct",
  "us_2y_yield",
  "de_2y_yield",
  "us_de_2y_spread",
  "us_de_2y_spread_d5_bps",
  "us_2y_d20_bps",
  "us_10y_real_yield",
  "us_10y_real_d20_bps",
  "us_10y_yield",
  "us_10y_d5_bps",
  "vix_d1_chg",
  "broad_dollar",
  "broad_dollar_d1_pct",
  "broad_dollar_d20_pct",
  "gold_price",
  "gold_d1_pct",
  "gold_d20_pct",
  "nasdaq100_price",
  "nasdaq100_d1_pct",
  "nasdaq100_d20_pct"
]);

/** The inputs the panel prints with their source and print date in the worked-call view. */
const TRACED_INPUT_KEYS = Object.freeze([...new Set([...SAVED_INPUT_KEYS, "nasdaq100_price"])]);

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
  // The broker's DXY.cash tape is a separate lane, loaded from its own export and never mixed into the four
  // markets. When the export is absent the lane reports that instead of borrowing another series.
  const dxyFile = path.join(cacheDir, "ftmo_dxy_cash_h1.csv");
  const dxyTape = dxySeries.loadSeries(dxyFile);
  if (dxyTape) {
    provenance.push({
      ...inputs.describeFile(
        dxyFile,
        "DXY.cash one-hour closes (FTMO Global Markets spot CFD, UTC-stamped by the exporter); broker-DXY lane only"
      ),
      rows: dxyTape.bars,
      start: dxyTape.first,
      end: dxyTape.last,
      instrument_kind: dxySeries.INSTRUMENT.kind,
      is_official_cash_dxy: false
    });
  }
  return {
    seriesByMarket,
    modelSeries: {
      gold: seriesByMarket.XAUUSD,
      nasdaq100: seriesByMarket.NAS100
    },
    dxyTape,
    provenance,
    files: { goldFile, nasdaqFile, dxyFile }
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
function coverageByTest({ dates, outcomes, callsByModel, demo, flatBands, dxyBroker = null }) {
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
    dxy_direction_broker_cfd: dxyBroker
      ? {
          usable_sessions: dxyBroker.usable_sessions,
          sessions_with_a_call: {
            current: dxyBroker.models?.current?.calls_made || 0,
            challenger: dxyBroker.models?.challenger?.calls_made || 0,
            challenger_v1: dxyBroker.models?.challenger_v1?.calls_made || 0
          },
          paired_sessions: {
            current: dxyBroker.models?.current?.paired_sessions || 0,
            challenger: dxyBroker.models?.challenger?.paired_sessions || 0,
            challenger_v1: dxyBroker.models?.challenger_v1?.paired_sessions || 0
          },
          holding_it_up: [
            "this lane is a broker CFD and not the licensed ICE index, so it is reported beside test 1, never as test 1",
            "the broker tape starts on 2024-12-10, so sessions before it cannot be priced even though the calls exist"
          ],
          unblocks_when: "nothing: it is measured as far as its own tape reaches; the official lane still waits on ICE"
        }
      : null,
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
      detail:
        "waiting on a licensed ICE cash DXY history; no substitute is used. Measured beside it: the FTMO " +
        "DXY.cash spot CFD tape, reported as its own instrument"
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

/** The ladder file this checkout carries, or `null` if neither copy is present. */
function readLadderFor(rootDir) {
  for (const relative of LADDER_PATHS) {
    const ladder = levelProvenanceModule.readLadder(path.join(rootDir, relative));
    if (ladder) return { ladder, source: relative.replace(/\\/g, "/") };
  }
  return { ladder: null, source: null };
}

/** The published tick-sweep status, or `null`: the panel must not imply a replay that has not been run. */
function readTickSweep(rootDir) {
  const file = path.join(rootDir, TICK_SWEEP_PATH);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
}

/** One model's summary as it travels in the window comparison. */
function summariseDirectionModel(block) {
  const overall = (block && block.overall) || {};
  return {
    calls_made: (block && block.calls_made) || 0,
    paired_sessions: (block && block.paired_sessions) || 0,
    scored: overall.scored || 0,
    hits: overall.hits || 0,
    misses: overall.misses || 0,
    flat: overall.flat || 0,
    no_call: overall.no_call || 0,
    no_outcome: overall.no_outcome || 0,
    accuracy_pct: overall.accuracy_pct === undefined ? null : overall.accuracy_pct,
    lower_bound_pct: overall.lower_bound_pct === undefined ? null : overall.lower_bound_pct
  };
}

/**
 * The three numbers the panel leads with, in the order the research asks for them.
 *
 * A lead number is not a new measurement: each one restates a block that is already in the artefact and names
 * the block it came from, so a reader who doubts the headline can open the table behind it. When a number has
 * not been produced yet - the tick sweep has not been published, or the ladder is absent - it says so instead
 * of showing a zero that would read as a measurement.
 */
function buildLeadNumbers({ broker, levelProvenance = null, tickSweep = null }) {
  const models = (broker && broker.models) || {};
  const dxy = {};
  for (const model of ["current", "challenger", "challenger_v1"]) {
    const overall = (models[model] && models[model].overall) || {};
    dxy[model] = {
      scored: overall.scored || 0,
      hits: overall.hits || 0,
      misses: overall.misses || 0,
      flat: overall.flat || 0,
      no_call: overall.no_call || 0,
      accuracy_pct: overall.accuracy_pct === undefined ? null : overall.accuracy_pct,
      lower_bound_pct: overall.lower_bound_pct === undefined ? null : overall.lower_bound_pct
    };
  }
  const priced = (broker && broker.usable_sessions) || 0;
  const perAsset = (levelProvenance && levelProvenance.totals
    ? levelProvenance.totals.sessions_with_usable_levels
    : null) || { EURUSD: 0, XAUUSD: 0, NAS100: 0, BTCUSD: 0 };
  const allFour = (levelProvenance && levelProvenance.totals
    ? levelProvenance.totals.sessions_eligible_for_all_four
    : 0) || 0;
  const sweepRules = (tickSweep && Array.isArray(tickSweep.rules) ? tickSweep.rules : null) || null;

  return [
    {
      order: 1,
      key: "dxy_sessions_scored",
      headline: `${priced} DXY sessions priced at both 05:00 London endpoints`,
      value: priced,
      unit: "sessions",
      per_model: dxy,
      source: "tests.dxy_direction_broker_cfd (models.<model>.overall)",
      note:
        "DXY.cash, the broker's spot CFD on the dollar index, scored from 05:00 London to 05:00 the next " +
        "calendar day inside its declared window; the official ICE cash lane stays blocked"
    },
    {
      order: 2,
      key: "sessions_with_usable_original_levels",
      headline: allFour
        ? `${allFour} sessions carry the original L2L levels on all four assets`
        : "no session carries an original L2L level",
      value: allFour,
      unit: "sessions",
      per_asset: perAsset,
      source: "level_provenance.totals.sessions_with_usable_levels",
      note: levelProvenance && levelProvenance.available
        ? `the ladder is one hand-marked grid per asset stamped ${levelProvenance.ladder_stamp_utc}; only a ` +
          "session that starts after that stamp can be priced by it"
        : "data/l2l-levels.json is absent, so no session can be priced by an original level"
    },
    {
      order: 3,
      key: "trades_replayed",
      headline: sweepRules
        ? `${sweepRules.reduce((total, rule) => total + (rule.fills || 0), 0)} trades replayed across ${
            sweepRules.length
          } rule and model columns`
        : "the tick replay has not been published for these sessions",
      value: sweepRules ? sweepRules.reduce((total, rule) => total + (rule.fills || 0), 0) : null,
      unit: "fills",
      per_rule: sweepRules,
      source: "data/usd-layer1-backtester/l2l-tick-sweep-v1.json",
      note: sweepRules
        ? "one call per session per model, one percent of the running balance risked per filled trade on each " +
          `${
            contracts.ACCOUNT.currency === "GBP" ? "\u00a3" : `${contracts.ACCOUNT.currency} `
          }${contracts.ACCOUNT.starting_balance.toLocaleString("en-GB")} account`
        : "run node backtester/scripts/run_l2l_tick_sweep.js --publish to produce it"
    }
  ];
}

/**
 * The results block that sits at the top of the panel.
 *
 * It is derived from the four test blocks rather than recomputed, so the headline cannot drift from the
 * tables: every number here is the same numerator and denominator the tab shows, with the arithmetic
 * spelled out, and the panel re-derives each one from the session rows to prove it.
 */
function buildResults({ tests, coverage, dates, demo, levelProvenance = null, tickSweep = null }) {
  const dxy = tests.dxy_direction || {};
  const broker = tests.dxy_direction_broker_cfd || null;
  const four = tests.four_markets || {};
  const markets = {};
  for (const market of contracts.MARKETS) {
    const current = (four.models && four.models.current && four.models.current.markets
      ? four.models.current.markets[market.key]
      : null) || {};
    const challengerMarket = (four.models && four.models.challenger && four.models.challenger.markets
      ? four.models.challenger.markets[market.key]
      : null) || {};
    const comparison = (four.comparisons && four.comparisons.markets
      ? four.comparisons.markets[market.key]
      : null) || {};
    markets[market.key] = {
      label: market.label,
      current: {
        hits: current.overall ? current.overall.hits || 0 : 0,
        scored: current.overall ? current.overall.scored || 0 : 0,
        flat: current.overall ? current.overall.flat || 0 : 0,
        accuracy_pct: current.overall ? current.overall.accuracy_pct : null
      },
      challenger: {
        hits: challengerMarket.overall ? challengerMarket.overall.hits || 0 : 0,
        scored: challengerMarket.overall ? challengerMarket.overall.scored || 0 : 0,
        flat: challengerMarket.overall ? challengerMarket.overall.flat || 0 : 0,
        accuracy_pct: challengerMarket.overall ? challengerMarket.overall.accuracy_pct : null
      },
      comparison: {
        corrected: comparison.corrected || 0,
        spoiled: comparison.spoiled || 0,
        matched: comparison.matched || 0
      }
    };
  }

  const demoVariant = (key) => {
    const variant = (demo && demo.variants ? demo.variants[key] : null) || {};
    const totals = variant.totals || {};
    return {
      label: demo ? demo.label : null,
      sessions: demo && demo.available && Array.isArray(demo.sessions) ? demo.sessions.length : 0,
      fills: totals.fills || 0,
      targets: totals.targets || 0,
      stops: totals.stops || 0,
      working: totals.working || 0,
      r_gross: totals.rGross || 0,
      closed: (totals.targets || 0) + (totals.stops || 0)
    };
  };

  const fourScored = {};
  for (const market of contracts.MARKETS) {
    fourScored[market.key] = {
      current: markets[market.key].current.scored,
      challenger: markets[market.key].challenger.scored
    };
  }

  return {
    dates_processed: dates.length,
    headline_dates: `${dates.length} dates processed`,
    lead_numbers: buildLeadNumbers({ broker, levelProvenance, tickSweep }),
    calls: {
      current: coverage.by_model && coverage.by_model.current ? coverage.by_model.current.calls_reconstructed : 0,
      challenger:
        coverage.by_model && coverage.by_model.challenger ? coverage.by_model.challenger.calls_reconstructed : 0,
      challenger_v1:
        coverage.by_model && coverage.by_model.challenger_v1
          ? coverage.by_model.challenger_v1.calls_reconstructed
          : 0,
      no_call_current:
        coverage.by_model && coverage.by_model.current ? coverage.by_model.current.no_call_sessions : 0,
      no_call_challenger:
        coverage.by_model && coverage.by_model.challenger ? coverage.by_model.challenger.no_call_sessions : 0
    },
    // A second instrument on test 1, not a fifth test: the four tests stay four. The panel renders this beside
    // the blocked official card, labelled with the broker's own symbol.
    dxy_broker_cfd: broker
      ? {
          id: broker.id,
          status: broker.status,
          label: broker.instrument ? broker.instrument.label : "DXY.cash (FTMO spot CFD)",
          instrument: broker.instrument,
          official: false,
          usable_sessions: broker.usable_sessions || 0,
          flat_band_pct: broker.flat_band_pct,
          worked_example: broker.worked_example,
          models: Object.fromEntries(
            Object.entries(broker.models || {}).map(([model, entry]) => [
              model,
              {
                calls_made: entry.calls_made,
                sessions_with_price: entry.sessions_with_price,
                paired_sessions: entry.paired_sessions,
                hits: entry.overall.hits,
                scored: entry.overall.scored,
                misses: entry.overall.misses,
                flat: entry.overall.flat,
                no_call: entry.overall.no_call,
                no_outcome: entry.overall.no_outcome,
                accuracy_pct: entry.overall.accuracy_pct,
                lower_bound_pct: entry.overall.lower_bound_pct,
                by_conviction: entry.by_conviction
              }
            ])
          ),
          note:
            "same question and same geometry as test 1, on FTMO's DXY.cash spot CFD: a real named instrument, " +
            "not the licensed ICE cash index, so this figure stands beside test 1 and never replaces it"
        }
      : null,
    tests: [
      {
        id: "dxy_direction",
        ordinal: 1,
        label: "Official DXY",
        status: dxy.status || "blocked",
        status_label: "0 scored \u00b7 awaiting DXY prices",
        scored: { current: 0, challenger: 0 },
        calls_ready: {
          current: dxy.models && dxy.models.current ? dxy.models.current.calls_made || 0 : 0,
          challenger: dxy.models && dxy.models.challenger ? dxy.models.challenger.calls_made || 0 : 0
        },
        usable_sessions: 0,
        missing_input: "licensed ICE cash DXY history at both 05:00 London endpoints",
        note:
          "no percentage is shown because no session can be priced for this test yet; the calls that are " +
          "waiting to be scored sit beside each model"
      },
      {
        id: "four_markets",
        ordinal: 2,
        label: "Four-market direction",
        status: four.usable_sessions ? "scored" : "blocked",
        status_label: `${four.usable_sessions || 0} sessions with a scorable move`,
        scored: { current: sumScores(fourScored, "current"), challenger: sumScores(fourScored, "challenger") },
        usable_sessions: four.usable_sessions || 0,
        markets,
        scoring_note:
          "a session counts once per market per model: scored means a call and a move outside that market's frozen " +
          "flat band, so a model's scored count is its own calls minus its no-call and flat days",
        comparison_note:
          "the same-date comparison counts only sessions where both models called and both were scoreable; " +
          "corrected means the challenger was right where the current model was wrong, spoiled the reverse",
        missing_input: "the DXY-confirmed column needs the same licensed series test 1 is waiting for",
        note: "a flat session is counted as flat and never as a hit"
      },
      {
        id: "l2l_full_5r",
        ordinal: 3,
        label: "Full L2L at 5R",
        status: "blocked",
        status_label: "0 closed trades scored \u00b7 demo only",
        scored: { current: 0, challenger: 0 },
        usable_sessions: 0,
        missing_input: "5-minute tapes and pre-session level ladders for each market",
        usable_dates: `0 of ${dates.length} sessions have an archived tape and ladder for all four markets`,
        demo: demoVariant("full"),
        note: "the two-day EUR/USD demo is labelled separately and is not a scored result"
      },
      {
        id: "l2l_half_3r",
        ordinal: 4,
        label: "Half L2L at 3R",
        status: "blocked",
        status_label: "0 closed trades scored \u00b7 demo only",
        scored: { current: 0, challenger: 0 },
        usable_sessions: 0,
        missing_input: "the same tapes and ladders, plus the midpoint grid they imply",
        usable_dates: `0 of ${dates.length} sessions have an archived tape and ladder for all four markets`,
        demo: demoVariant("half"),
        note: "the half grid inherits every blocker of the full grid, since a midpoint needs an original pair first"
      }
    ]
  };
}

/** Sum one model's scored sessions across the four markets. */
function sumScores(scored, model) {
  return Object.values(scored).reduce((total, entry) => total + (entry[model] || 0), 0);
}

/**
 * The current model's own rules, restated for the panel.
 *
 * The current model is not re-implemented here: its factor roster and weights come from the production
 * replay core through `current_model.evaluate`, which is why every row's factor signals are recorded beside
 * the call.
 */
function describeCurrentModelRules() {
  return {
    version: contracts.CURRENT_MODEL_VERSION,
    engine: "backtester/replay/usd/usd_replay_core.js (unchanged; replayed, never re-weighted)",
    scale: "0-100 conviction on the model's own scale, banded to 1-5 for comparison only",
    conviction_mapping: contracts.CONVICTION.current_model_mapping,
    factor_source:
      "the per-session factor signals and weights are the production model's own breakdown for that morning",
    absent_inputs: inputs.ABSENT_INPUTS,
    substitutions: [
      {
        factor: "F5 dollar momentum",
        stands_in: "FRED DTWEXBGS, stored as dxy_level",
        why: "no licensed ICE cash DXY exists in this checkout"
      },
      {
        factor: "F3 US-DE 2-year spread",
        stands_in: "no substitute: the spread is passed as null and the factor scores NEUTRAL",
        why: "no 05:00 cache of the German 2-year series exists"
      }
    ],
    missing_data_rules: [
      "a factor whose input is absent scores NEUTRAL with the input named in the row's missing list",
      "the model still returns its own label and conviction; nothing is imputed to fill the gap",
      "when the model returns NO_CLEAR_BIAS the row is recorded as no call and the reason is kept"
    ]
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
 * The one morning the panel works in full for the broker-DXY lane.
 *
 * Picked by rule rather than taste: the first session where both models made a call and the broker tape
 * prices both endpoints. The block carries the two bars, the two prices, the arithmetic and each model's
 * predicted direction, so a reader can redo the sum without opening a file.
 */
function buildDxyWorkedExample({ dates, prices, callsByModel, band }) {
  const date = dates.find((candidate) => {
    const price = prices[candidate];
    if (!price || !price.present) return false;
    return ["current", "challenger"].every((model) => {
      const call = callsByModel[model] ? callsByModel[model].get(candidate) : null;
      return call && call.direction !== "NO_CALL";
    });
  });
  if (!date) return null;
  const price = prices[date];
  const actual = !Number.isFinite(band) || Math.abs(price.move_pct) > band
    ? (price.move_pct > 0 ? "UP" : "DOWN")
    : "FLAT";
  const models = ["current", "challenger"].map((model) => {
    const call = callsByModel[model].get(date);
    const predicted = call.direction === "BULLISH" ? "UP" : "DOWN";
    return {
      model,
      call_direction: call.direction,
      conviction: call.conviction,
      predicted,
      hit: actual === "FLAT" ? null : predicted === actual
    };
  });
  return {
    date,
    open_bar: price.open_bar,
    open: price.open,
    close_bar: price.close_bar,
    close: price.close,
    move_pct: price.move_pct,
    actual,
    flat_band_pct: Number.isFinite(band) ? band : null,
    arithmetic: `(${price.close} / ${price.open} - 1) * 100 = ${price.move_pct}`,
    models,
    reading:
      "a USD-bullish call predicts this index rises, so a positive move is a hit for BULLISH and a miss for BEARISH"
  };
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
  // The German 2Y leg is joined onto the frame before any snapshot is built, so every morning reads the same
  // T-1 as-of rule for both legs and no later date's print can leak into a 05:00 decision.
  const frame = de2y.attachToFrame(inputs.readFrame());
  const inventory = inputs.readInventory();
  const loaded = loadSeries(root);
  const snapshots = snapshotsModule.buildSnapshots({ frame, series: loaded.modelSeries });
  const dates = snapshots.map((snapshot) => snapshot.date);
  const stamp = generatedAt || new Date().toISOString();

  const callsByModel = { current: new Map(), challenger: new Map(), challenger_v1: new Map() };
  for (const snapshot of snapshots) {
    callsByModel.current.set(snapshot.date, currentModel.evaluate(snapshot));
    callsByModel.challenger.set(snapshot.date, challenger.evaluate(snapshot));
    callsByModel.challenger_v1.set(snapshot.date, challengerV1.evaluate(snapshot));
  }

  // The refresh study: the same v1 rule, read again at 07:00 and 09:00 London on every session.
  const snapshotsByCutoff = { 5: snapshots };
  const callsByCutoff = { 5: callsByModel.challenger_v1 };
  for (const hour of cutoffModule.CUTOFFS) {
    if (hour === 5) continue;
    const built = snapshotsModule.buildSnapshots({ frame, series: loaded.modelSeries, cutoffHour: hour });
    snapshotsByCutoff[hour] = built;
    const calls = new Map();
    for (const snapshot of built) calls.set(snapshot.date, challengerV1.evaluate(snapshot));
    callsByCutoff[hour] = calls;
  }
  // Kept under its own key so the factor review can compare a day against the frozen benchmark.
  callsByCutoff.benchmark_v0 = callsByModel.challenger;

  const developmentDates = dates.filter((date) => testsModule.splitOf(date).key === "development");
  const moves = outcomesModule.readSessionMoves({ sessions: snapshots, seriesByMarket: loaded.seriesByMarket });
  const flatBands = outcomesModule.freezeFlatBands(moves, developmentDates);
  const outcomes = outcomesModule.classifyMoves(moves, flatBands);

  const demo = buildExecutionDemo({ rootDir: root });
  const cutoffStudy = cutoffModule.buildCutoffStudy({
    dates,
    snapshotsByCutoff,
    callsByCutoff,
    outcomes,
    benchmarkCalls: callsByModel.challenger
  });
  const factorReview = buildFactorReviewBlock({
    snapshotsByCutoff,
    callsByCutoff,
    cutoffStudy,
    dates
  });
  const test1 = testsModule.testDxyDirection({ dates, callsByModel });
  // The broker CFD lane: the same 05:00-to-05:00 question put to a named, non-official instrument. It keeps its
  // own id and label so its figure can never be read as test 1's answer, and the official lane above stays blocked.
  //
  // It is scored inside its declared window only (`SCORED_WINDOW.first_session`, the instrument's own first bar,
  // 2024-12-10): `DXY.cash` bars and two-sided ticks both begin there, so a session in the window can be checked
  // against the instrument's own tape and a session before it has no tape at all. The window and its count of
  // sessions before it travel in the artefact rather than being implied by the figure. The sessions outside the
  // window are counted, not dropped silently.
  const dxyWindow = dxySeries.scoredWindow(dates);
  const dxyWindowSet = new Set(dxyWindow.dates);
  const dxyPricesAll = dxySeries.buildSessionPrices({ sessions: snapshots, series: loaded.dxyTape });
  const dxyPrices = {};
  for (const date of dxyWindow.dates) dxyPrices[date] = dxyPricesAll[date];
  const dxyBand = dxySeries.freezeFlatBand(
    dxyPrices,
    developmentDates.filter((date) => dxyWindowSet.has(date))
  );
  const test1Broker = testsModule.testDxyDirection({
    dates: dxyWindow.dates,
    callsByModel,
    prices: loaded.dxyTape ? dxyPrices : null,
    flatBandPct: dxyBand.flat_band_pct,
    instrument: {
      ...dxySeries.INSTRUMENT,
      flat_band_pct: dxyBand.flat_band_pct,
      flat_band_rule: dxyBand.rule,
      flat_band_sample: dxyBand.sample,
      rows: loaded.dxyTape ? loaded.dxyTape.bars : 0,
      first_bar: loaded.dxyTape ? loaded.dxyTape.first : null,
      last_bar: loaded.dxyTape ? loaded.dxyTape.last : null,
      scored_window: dxyWindow.meta,
      overlay: "usd_bullish_predicts=UP: a USD-bullish call predicts the dollar index rises"
    },
    workedExample: buildDxyWorkedExample({
      dates: dxyWindow.dates,
      prices: dxyPrices,
      callsByModel,
      band: dxyBand.flat_band_pct
    })
  });
  // The reported anchor, scored as its own window. An earlier cycle dated the instrument's tick tape to
  // 2025-01-08: that was the first *sampled* anchor at which ticks appeared, with ten months between the
  // anchors either side. Both windows are scored here so the figure can be read against either, and the
  // difference is stated rather than left to the reader to reconstruct.
  const reportedAnchor = "2025-01-08";
  const reportedDates = dxyWindow.dates.filter((date) => date >= reportedAnchor);
  const test1BrokerReported = testsModule.testDxyDirection({
    dates: reportedDates,
    callsByModel,
    prices: loaded.dxyTape ? dxyPrices : null,
    flatBandPct: dxyBand.flat_band_pct,
    instrument: { ...dxySeries.INSTRUMENT, scored_window: { ...dxyWindow.meta, first_session: reportedAnchor } }
  });
  const perModelSummary = (block) =>
    Object.fromEntries(
      Object.entries((block && block.models) || {}).map(([model, entry]) => [model, summariseDirectionModel(entry)])
    );
  test1Broker.window_sensitivity = {
    question:
      "does the figure depend on which boundary the window starts at: the instrument's own first bar, or the " +
      "earlier reported 2025-01-08 anchor",
    lane_window: {
      first_session: (dxyWindow.meta && dxyWindow.meta.first_session) || null,
      sessions: dxyWindow.dates.length,
      priced_sessions: dxyWindow.dates.filter((date) => dxyPrices[date] && dxyPrices[date].present).length,
      per_model: perModelSummary(test1Broker)
    },
    reported_anchor: {
      first_session: reportedAnchor,
      sessions: reportedDates.length,
      priced_sessions: reportedDates.filter((date) => dxyPrices[date] && dxyPrices[date].present).length,
      per_model: perModelSummary(test1BrokerReported)
    },
    boundary_source: dxyWindow.meta && dxyWindow.meta.boundary_source ? dxyWindow.meta.boundary_source : null,
    reading:
      "the 2025-01-08 anchor drops the sessions between 2024-12-10 and 2025-01-07; it changes the scored count " +
      "and nothing else about the rule, the band or the instrument"
  };
  // The same-date comparison: only the sessions where both models called and the tape printed both endpoints, so
  // "corrected" and "spoiled" are differences on identical dates rather than on different samples.
  const calledDirection = (call) => call && (call.direction === "BULLISH" || call.direction === "BEARISH");
  const rightFor = (call, entry) =>
    entry && entry.present && calledDirection(call)
      ? (entry.move_pct > 0 ? "UP" : "DOWN") === (call.direction === "BULLISH" ? "UP" : "DOWN")
      : null;
  const matched = {
    sessions: 0,
    current: { right: 0, wrong: 0 },
    challenger: { right: 0, wrong: 0 },
    both_right: 0,
    both_wrong: 0,
    current_only: 0,
    challenger_only: 0
  };
  for (const date of dxyWindow.dates) {
    const entry = dxyPrices[date];
    const currentCall = callsByModel.current.get(date);
    const challengerCall = callsByModel.challenger.get(date);
    const currentRight = rightFor(currentCall, entry);
    const challengerRight = rightFor(challengerCall, entry);
    if (currentRight === null || challengerRight === null) continue;
    matched.sessions += 1;
    if (currentRight) matched.current.right += 1;
    else matched.current.wrong += 1;
    if (challengerRight) matched.challenger.right += 1;
    else matched.challenger.wrong += 1;
    if (currentRight && !challengerRight) matched.current_only += 1;
    if (!currentRight && challengerRight) matched.challenger_only += 1;
    if (!currentRight && !challengerRight) matched.both_wrong += 1;
    if (currentRight && challengerRight) matched.both_right += 1;
  }
  test1Broker.window_sensitivity.matched_dates = {
    ...matched,
    note:
      "date-for-date comparison on the sessions where both models called and the tape priced both 05:00 endpoints; " +
      "current_only counts sessions the current model got right and the challenger wrong, challenger_only the reverse"
  };


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
      challenger: modelCoverage({ dates, calls: callsByModel.challenger, name: "challenger" }),
      challenger_v1: modelCoverage({ dates, calls: callsByModel.challenger_v1, name: "challenger_v1" })
    },
    by_test: coverageByTest({ dates, outcomes, callsByModel, demo, flatBands, dxyBroker: test1Broker })
  };
  const tests = stripRowLists({
    dxy_direction: test1,
    dxy_direction_broker_cfd: test1Broker,
    four_markets: test2,
    l2l_full_5r: test3,
    l2l_half_3r: test4
  });
  const progress = buildProgress({ dates, coverage, tests });
  const sourceLegend = { list: [], index: new Map() };
  const sessions = buildSessionRows({ snapshots, callsByModel, outcomes, sourceLegend });
  const factorAccounting = factors.buildFactorAccounting();
  const assumptionLedger = factors.buildAssumptionLedger({ flatBands, splits: testsModule.SPLITS });
  const challengerStatus = factors.buildChallengerStatus({ accounting: factorAccounting });
  const reproduction = reproduce.buildReproduction({ rows: sessions, tests });
  const ladderCopy = readLadderFor(root);
  const levelProvenance = levelProvenanceModule.buildLevelProvenance({
    ladder: ladderCopy.ladder,
    dates,
    source: ladderCopy.source
  });
  const tickSweep = readTickSweep(root);
  const results = buildResults({ tests, coverage, dates, demo, levelProvenance, tickSweep });
  const factorSpec = dataPath.buildFactorSpec();
  const factorDataPath = dataPath.buildFactorDataPath({ snapshots, calls: callsByModel.challenger_v1, spec: factorSpec });
  const recovery = dataPath.buildRecovery({ snapshots, callsV1: callsByModel.challenger_v1, spec: factorSpec });
  const m5Coverage = dataPath.buildM5Coverage();
  const shadowInputs = dataPath.buildShadowArms({
    snapshots,
    dates,
    outcomes,
    callsV1: callsByModel.challenger_v1
  });
  // The identity and validity layer: which model made each call, which of the twenty-five factors it actually
  // reads, and which mornings carried every required input. It sits beside the tests rather than inside them,
  // because it withholds calls instead of scoring them.
  const validityGate = modelIdentity.buildValidityGate({
    sessions,
    // The measured spec, not the bare one: the requirement table reports how often each staged input actually
    // carried a value, and only `buildFactorDataPath` fills `sessions_present` per input.
    factors: factorDataPath.factors,
    markets: contracts.MARKETS.map((market) => market.key)
  });
  const identityCheck = modelIdentity.buildIdentityCheck({
    factors: factorSpec,
    mechanisms: challengerV1.MECHANISMS
  });

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
        vote_spec: mechanism.vote_spec,
        weight: challenger.RULES.equal_weight
      })),
      challenger_rules: {
        equal_weight: challenger.RULES.equal_weight,
        min_usable_mechanisms: challenger.RULES.min_usable_mechanisms,
        agreement_deadband: challenger.RULES.agreement_deadband,
        agreement_deadband_pct: Math.round(challenger.RULES.agreement_deadband * 100),
        conviction_bands: challenger.RULES.conviction_bands,
        interpreter: votesModule.VOTES_VERSION,
        vote_reading: "+1 is a bullish USD reading, -1 bearish, 0 means the input was live but inside its threshold",
        gates: [
          {
            id: "min_usable_mechanisms",
            rule: `no call when fewer than ${challenger.RULES.min_usable_mechanisms} of ${challenger.MECHANISMS.length} mechanisms have a value`,
            why: "a thin book is a data problem, not a directional signal"
          },
          {
            id: "agreement_deadband",
            rule: `no call when agreement is inside ${challenger.RULES.agreement_deadband}, meaning no side holds ${Math.round(challenger.RULES.agreement_deadband * 100)}% of the live mechanisms`,
            why: "a split book is a coin toss and is recorded as such"
          }
        ],
        missing_data_rules: [
          "a value counts only when it is a finite number at the 05:00 cutoff; null, blank or a later revision is missing",
          "a missing mechanism does not vote, is named in the row's missing list, and lowers participation",
          "a missing input never zero-votes and is never filled from a later print or a neighbouring session",
          "every excluded input is listed with its reason, so an exclusion is a decision rather than an omission"
        ]
      },
      current_model_rules: describeCurrentModelRules(),
      challenger_excluded_inputs: challenger.EXCLUDED_INPUTS,
      absent_inputs: inputs.ABSENT_INPUTS
    },
    results,
    factor_accounting: factorAccounting,
    challenger_v1: {
      version: challengerV1.VERSION,
      name: challengerV1.NAME,
      parent: challengerV1.PARENT_VERSION,
      frozen_on: challengerV1.FROZEN_ON,
      frozen_before: challengerV1.FROZEN_BEFORE,
      status: challengerV1.STATUS,
      families: challengerV1.FAMILIES,
      mechanisms: challengerV1.MECHANISMS.map((mechanism) => ({
        id: mechanism.id,
        label: mechanism.label,
        factor: mechanism.factor,
        family: mechanism.family,
        input: mechanism.input,
        rule: mechanism.rule,
        threshold: mechanism.threshold,
        vote_spec: mechanism.vote_spec,
        weight: mechanism.weight
      })),
      rules: challengerV1.RULES
    },
    factor_review: factorReview,
    validity_gate: validityGate,
    model_identity: identityCheck,
    experimental_rules: ruleWiring.summarise(snapshots),
    factor_data_path: factorDataPath,
    recovery,
    m5_coverage: m5Coverage,
    level_provenance: levelProvenance,
    l2l_tick_sweep: tickSweep,
    shadow_inputs: shadowInputs,
    cutoff_study: cutoffStudy,
    assumption_ledger: assumptionLedger,
    challenger_status: challengerStatus,
    reproduction,
    input_source_legend: sourceLegend.list,
    progress,
    coverage,
    tests,
    sessions,
    execution_demo: demo,
    benchmarks: { hourly_adr: readBenchmark(root) },
    provenance: describeProvenance({ rootDir: root, frame, inventory, loaded, demo })
  };
}

/**
 * The twenty-five-factor review, worked for the days the panel can open.
 *
 * The static table is the whole review: every factor, the adjudication's verdict, the data class, the
 * treatment and the gap. The worked days add the part that only a single morning can show: which factor voted,
 * which one was counted elsewhere, and which one had no value at the cutoff. Days are picked for a reason and
 * the reason is printed with them, so a reader never has to guess why 2024-02-20 is on the list.
 */
function buildFactorReviewBlock({ snapshotsByCutoff, callsByCutoff, cutoffStudy, dates }) {
  const { rows, manifest } = reviewModule.reviewRows();
  const gaps = reviewModule.buildGaps();
  const rules = challengerV1.RULES;
  const picks = [];
  const add = (date, why, cutoff = 5) => {
    if (!date || picks.some((entry) => entry.date === date)) return;
    picks.push({ date, why, cutoff });
  };
  const v1 = callsByCutoff[5];
  const v0 = callsByCutoff.benchmark_v0 || null;

  const firstDifference = dates.find((date) => {
    const base = v0 ? v0.get(date) : null;
    const next = v1.get(date) || null;
    return base && next && base.direction !== next.direction;
  });
  add(firstDifference, "the first day the family weighting changed the call against the frozen benchmark");

  const thin = dates.find((date) => {
    const call = v1.get(date);
    return call && call.direction === "NO_CALL" && call.usable_mechanisms < rules.min_usable_mechanisms;
  });
  add(thin, "the first day the minimum-data gate stopped the call");

  const split = dates.find((date) => {
    const call = v1.get(date);
    return (
      call &&
      call.direction === "NO_CALL" &&
      call.usable_mechanisms >= rules.min_usable_mechanisms &&
      call.agreement < rules.agreement_deadband
    );
  });
  add(split, "the first day the agreement deadband stopped the call");

  const gained = cutoffStudy.changes[9] ? cutoffStudy.changes[9].gained[0] : null;
  add(gained ? gained.date : null, "the first day a 09:00 refresh produced a call the 05:00 book did not make", 9);
  const lost = cutoffStudy.changes[9] ? cutoffStudy.changes[9].lost[0] : null;
  add(lost ? lost.date : null, "the first day a 09:00 refresh lost a call the 05:00 book made", 9);

  const thinGold = dates.find((date) => {
    const snapshot = (snapshotsByCutoff[5] || []).find((entry) => entry.date === date);
    return snapshot && snapshot.missing.some((entry) => entry.key === "gold_price" || entry.key === "nasdaq100_price");
  });
  add(thinGold, "the first day the intraday gold and NAS100 legs were missing from the cache");

  add(dates[0], "the first session in the run");
  add(dates[dates.length - 1], "the last session in the run");

  const days = picks.map((pick) => {
    const snapshots = snapshotsByCutoff[pick.cutoff] || [];
    const snapshot = snapshots.find((entry) => entry.date === pick.date);
    const calls = callsByCutoff[pick.cutoff];
    const call = calls ? calls.get(pick.date) : null;
    const baselineCall = pick.cutoff === 5 ? null : v1.get(pick.date);
    return {
      date: pick.date,
      why: pick.why,
      cutoff_local: `${String(pick.cutoff).padStart(2, "0")}:00`,
      review: snapshot && call ? reviewModule.buildFactorReview({ snapshot, call }) : null,
      baseline:
        baselineCall && pick.cutoff !== 5
          ? {
              cutoff_local: "05:00",
              direction: baselineCall.direction,
              conviction: baselineCall.conviction,
              raw_score: baselineCall.raw_score,
              agreement: baselineCall.agreement,
              usable_mechanisms: baselineCall.usable_mechanisms,
              reason: baselineCall.reason
            }
          : null
    };
  });

  return {
    adjudication: {
      document: reviewModule.ADJUDICATION_DOC,
      date: reviewModule.ADJUDICATION_DATE,
      registered_inputs: manifest.registered_inputs.length,
      factor_adjudications: manifest.factor_documents.length,
      final_stages: manifest.registered_inputs.length - manifest.factor_documents.length,
      source_branch: manifest.source_document ? manifest.source_document.branch : null,
      source_commit: manifest.source_document ? manifest.source_document.commit : null
    },
    registration: reviewModule.registrationStatus({ manifest }),
    reconciliation: {
      backtester_claim:
        "challenger v0 was frozen on 2026-11-08 on the recorded premise that 24 of the 25 factor chains had " +
        "no adjudication and only the VIX chain had delivered research",
      what_the_registry_held:
        "data/research-library/documents.json carried 42 documents, one of them a returned report, and " +
        "node scripts/build_research_library.js verify reported 25 chains with 0 complete",
      what_the_registry_holds_now:
        "the same registry now cites all 27 package inputs (25 factor adjudications plus the final analysis and " +
        "final red-team) with the ids and hashes the adjudication names, none of them public, and a second " +
        "import adds nothing; chain progress is unchanged because no parent document is held here",
      what_the_research_held:
        "on 2026-11-04 the same programme registered 25 factor adjudications plus a final analysis, a " +
        "red-team and a final adjudication, 27 files whose ids and hashes the adjudication verifies",
      conclusion:
        "the two accounts describe different stores, not different findings: the adjudications were returned " +
        "and never registered in the committed library, so every registry-driven reader still saw 0 of 25"
    },
    factor_count: rows.length,
    rows: rows.map((row) => ({
      factor_id: row.factor_id,
      label: row.label,
      disposition: row.disposition,
      verdict: row.verdict,
      data_class: row.data_class,
      data_class_label: row.data_class_label,
      treatment: row.treatment,
      effect_label: row.effect_label,
      gap: row.gap,
      gap_label: row.gap_label,
      document_id: row.document.document_id,
      document_sha256: row.document.sha256
    })),
    gaps,
    days
  };
}


function buildSavedInputs(snapshot) {
  const saved = {};
  const values = snapshot.values || {};
  for (const key of SAVED_INPUT_KEYS) {
    if (Number.isFinite(values[key])) saved[key] = values[key];
  }
  return saved;
}

/**
 * Every other value the cutoff produced, so the 25-factor audit can show a factor the two models do not vote
 * on (credit spreads, breakevens, the other dollar pairs) without re-reading the frame in the browser. The
 * panel merges this with `saved_inputs`; the call itself never reads it.
 */
function buildAuditValues(snapshot) {
  const values = snapshot.values || {};
  const extra = {};
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) continue;
    if (SAVED_INPUT_KEYS.includes(key)) continue;
    extra[key] = value;
  }
  return extra;
}

/**
 * The provenance of each saved value: the print date it came from and how stale that print was.
 *
 * The source string is stored once in the artefact's legend and referenced by index, so the same sentence is
 * not repeated 725 times. Every input the cutoff produced is listed, not only the ones a rule reads: the audit
 * has to be able to say that a factor had no value rather than guess it.
 */
function buildInputMeta(snapshot, sourceLegend) {
  const entries = Array.isArray(snapshot.inputs) ? snapshot.inputs : [];
  const meta = [];
  const sourceIdFor = (source) => {
    if (!sourceLegend || !sourceLegend.index || !sourceLegend.list) return 0;
    if (!sourceLegend.index.has(source)) {
      sourceLegend.list.push(source);
      sourceLegend.index.set(source, sourceLegend.list.length - 1);
    }
    return sourceLegend.index.get(source);
  };
  for (const entry of entries) {
    if (!Number.isFinite(entry.value)) continue;
    meta.push([entry.key, entry.print_date || null, entry.staleness_business_days, sourceIdFor(entry.source)]);
  }
  // A derived value (a five-day change, a curve difference) is computed at the cutoff from a base series that
  // is already in the list; it carries that series' print date and age, so the audit can age every factor.
  const seen = new Set(meta.map((entry) => entry[0]));
  const baseByKey = new Map(entries.filter((entry) => Number.isFinite(entry.value)).map((entry) => [entry.key, entry]));
  for (const [key, value] of Object.entries(snapshot.values || {})) {
    if (!Number.isFinite(value) || seen.has(key)) continue;
    const base = baseByKey.get(dataPath.baseSeriesKey(key)) || null;
    if (!base) continue;
    meta.push([key, base.print_date || null, base.staleness_business_days, sourceIdFor(base.source)]);
  }
  return meta;
}

/**
 * One row per session: what was known at 05:00, what each model called, and what happened next.
 *
 * The drill-down reads these rows, so the panel can never show a call that the tables did not score. The
 * `saved_inputs` block is the complete set of values both models read that morning, so the panel can re-run
 * the call from the row itself; `input_meta` carries the print date and staleness of each of those values.
 */
function buildSessionRows({ snapshots, callsByModel, outcomes, sourceLegend = { list: [], index: new Map() } }) {
  return snapshots.map((snapshot) => {
    const date = snapshot.date;
    const currentCall = callsByModel.current.get(date);
    const challengerCall = callsByModel.challenger.get(date);
    const v1Call = callsByModel.challenger_v1 ? callsByModel.challenger_v1.get(date) : null;
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

    const results = { current: {}, challenger: {}, challenger_v1: {} };
    for (const [model, call] of [
      ["current", currentCall],
      ["challenger", challengerCall],
      ["challenger_v1", v1Call]
    ]) {
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
      saved_inputs: buildSavedInputs(snapshot),
      audit_values: buildAuditValues(snapshot),
      input_meta: buildInputMeta(snapshot, sourceLegend),
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
          reason: currentCall.reason,
          factors: currentCall.factors.map((factor) => [factor.id, factor.signal, factor.weight])
        },
        challenger: {
          direction: challengerCall.direction,
          conviction: challengerCall.conviction,
          raw_score: challengerCall.raw_score,
          usable_mechanisms: challengerCall.usable_mechanisms,
          agreement: challengerCall.agreement,
          participation: challengerCall.participation,
          missing_inputs: challengerCall.missing_inputs,
          reason: challengerCall.reason,
          mechanisms: challengerCall.mechanisms.map((mechanism) => [
            mechanism.id,
            mechanism.value,
            mechanism.vote
          ])
        },
        challenger_v1: v1Call
          ? {
              direction: v1Call.direction,
              conviction: v1Call.conviction,
              raw_score: v1Call.raw_score,
              usable_mechanisms: v1Call.usable_mechanisms,
              usable_weight: v1Call.usable_weight,
              total_weight: v1Call.total_weight,
              agreement: v1Call.agreement,
              participation: v1Call.participation,
              missing_inputs: v1Call.missing_inputs,
              reason: v1Call.reason,
              mechanisms: v1Call.mechanisms.map((mechanism) => [
                mechanism.id,
                mechanism.value,
                mechanism.vote,
                mechanism.weight
              ])
            }
          : null
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
  buildAuditValues,
  buildInputMeta,
  buildArtefact
};
