"use strict";

/**
 * The market x test matrix (research only, 2026-11-23).
 *
 * The programme is one USD call a day scored on a set of markets. Which markets is a configuration
 * decision, not a code decision: this module loads one declared document, checks it, and turns it into
 * the combination ledger every other surface reads - the engine's scoring, the run artefact, the
 * experiment identity, the data requirements, the comparison tables and the panel.
 *
 * Three tests exist and every selected market receives all three:
 *
 *   direction     - directional accuracy of the USD call on that market's own 05:00-to-05:00 move;
 *   l2l_full_5r   - the original level ladder with the frozen 5R rules;
 *   l2l_half_3r   - the original levels plus midpoints with the frozen 3R rules.
 *
 * A configuration of one primary market and N additional markets therefore has 3 x (1 + N)
 * combinations. The initial authorised configuration is DXY plus seven markets: 24 per strategy.
 *
 * A market is never assumed to have data. Every combination reports ready or blocked with its own
 * reason, because "no cached series" and "no M5 tape" are different missing datasets and neither may
 * be shown as a scored zero.
 *
 * The primary market is unique by construction: a duplicate key, or the primary repeated in the
 * additional list, is refused instead of silently scored twice.
 *
 * Nothing here reads the network or a production path; the only file it reads is the config document.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/** The declared document, relative to the repository root. */
const MATRIX_PATH = path.join("backtester", "config", "usd_layer1_market_matrix.json");

/** The three tests every selected market receives, in the order the panel shows them. */
const TEST_TYPES = Object.freeze([
  Object.freeze({
    id: "direction",
    ordinal: 1,
    label: "Directional accuracy",
    question:
      "Did the market move the way the USD call said it should, from 05:00 London to 05:00 the next local day?",
    requires: Object.freeze(["session_outcome_series"])
  }),
  Object.freeze({
    id: "l2l_full_5r",
    ordinal: 2,
    label: "Original L2L 5R",
    question:
      "Applying the USD-implied direction to this market's original levels, what does the frozen 5R path produce?",
    requires: Object.freeze(["m5_tape", "level_snapshot"])
  }),
  Object.freeze({
    id: "l2l_half_3r",
    ordinal: 3,
    label: "0.5 L2L 3R",
    question: "With one midpoint between adjacent originals, what does the frozen 3R path produce?",
    requires: Object.freeze(["m5_tape", "level_snapshot"])
  })
]);

const TEST_IDS = Object.freeze(TEST_TYPES.map((test) => test.id));
const DIRECTIONS = Object.freeze(["UP", "DOWN"]);
const ROLES = Object.freeze(["primary", "additional"]);

/** Why a combination cannot be scored. Fixed vocabulary; the panel prints these sentences. */
const REASONS = Object.freeze({
  no_session_outcome_series:
    "no cached one-hour series for this market in this checkout, so neither 05:00 London endpoint can be priced",
  proxy_series:
    "scored on the broker DXY.cash series, a named proxy for the official index, and never reported as it",
  no_m5_tape: "no 5-minute tape was archived for this market before the setup",
  no_actionable_bid_ask_tape:
    "a mid-price 5-minute tape exists for this market, but no bid/ask path, so the spread a fill would pay cannot be reconstructed",
  no_level_ladder: "no level ladder for this market was archived before the setup",
  no_shared_session:
    "no single session has both an archived 5-minute tape and a level ladder marked before that session",
  duplicate_primary_market: "the primary market appears twice in the configuration",
  unknown_test: "the configuration asks for a test the engine does not implement",
  missing_field: "the market entry is missing a declared field"
});

class MatrixConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "MatrixConfigError";
  }
}

function sha256(text) {
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

/** Deterministic JSON: sorted keys, so the fingerprint does not depend on declaration order. */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}
function requireField(market, field, index) {
  if (market[field] === undefined || market[field] === null || market[field] === "") {
    throw new MatrixConfigError(`market ${index} (${market.key || "no key"}) is missing ${field}`);
  }
  return market[field];
}

/**
 * Check one declared document and return it frozen.
 *
 * The checks are the rules the rest of the engine relies on: one primary market, no repeated key, no
 * unknown test, and a quote convention that says which way a USD-bullish call predicts the market.
 */
function validateMatrix(config) {
  if (!config || typeof config !== "object") throw new MatrixConfigError("the matrix document must be an object");
  if (!Array.isArray(config.markets) || config.markets.length === 0) {
    throw new MatrixConfigError("the matrix must declare at least one market");
  }
  const declaredTests = Array.isArray(config.tests) && config.tests.length ? config.tests : TEST_IDS;
  const seenTests = new Set();
  for (const test of declaredTests) {
    if (!TEST_IDS.includes(test)) throw new MatrixConfigError(`${REASONS.unknown_test}: ${JSON.stringify(test)}`);
    if (seenTests.has(test)) throw new MatrixConfigError(`test ${test} is declared twice`);
    seenTests.add(test);
  }
  if (seenTests.size !== TEST_IDS.length) {
    throw new MatrixConfigError(`the matrix must declare all three tests; declared ${[...seenTests].join(", ")}`);
  }

  const keys = new Set();
  const markets = config.markets.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new MatrixConfigError(`market ${index} must be an object`);
    for (const field of ["key", "label", "instrument_kind", "series_file", "quote_convention", "digits"]) {
      requireField(raw, field, index);
    }
    const key = String(raw.key).trim().toUpperCase();
    if (keys.has(key)) throw new MatrixConfigError(`${REASONS.duplicate_primary_market}: ${key}`);
    keys.add(key);
    if (!DIRECTIONS.includes(raw.usd_bullish_predicts)) {
      throw new MatrixConfigError(
        `market ${key} must say what a USD-bullish call predicts (UP or DOWN), not ` +
          JSON.stringify(raw.usd_bullish_predicts)
      );
    }
    if (!Number.isInteger(raw.digits) || raw.digits < 0 || raw.digits > 8) {
      throw new MatrixConfigError(`market ${key} has an unusable digits value ${JSON.stringify(raw.digits)}`);
    }
    if (raw.role !== undefined && !ROLES.includes(raw.role)) {
      throw new MatrixConfigError(`market ${key} has an unknown role ${JSON.stringify(raw.role)}`);
    }
    return Object.freeze({
      ...raw,
      key,
      role: raw.role || "additional",
      broker_symbol: raw.broker_symbol || null,
      ladder_symbol: raw.ladder_symbol || null,
      official_series: raw.official_series ? Object.freeze({ ...raw.official_series }) : null
    });
  });
  const primaries = markets.filter((market) => market.role === "primary");
  if (primaries.length !== 1) {
    throw new MatrixConfigError(
      `exactly one primary market is required; found ${primaries.length} ` +
        `(${primaries.map((market) => market.key).join(", ") || "none"})`
    );
  }
  const primary = primaries[0];
  if (config.primary_market && String(config.primary_market).toUpperCase() !== primary.key) {
    throw new MatrixConfigError(`primary_market names ${config.primary_market} but the role marks ${primary.key}`);
  }
  if (markets.length < 2) {
    throw new MatrixConfigError("a matrix needs the primary market and at least one additional market");
  }
  if (Array.isArray(config.additional_markets)) {
    const additional = config.additional_markets.map((key) => String(key).trim().toUpperCase());
    if (additional.includes(primary.key)) {
      throw new MatrixConfigError(`${REASONS.duplicate_primary_market}: ${primary.key} is listed as additional`);
    }
    const declared = markets.filter((market) => market.role === "additional").map((market) => market.key);
    if (stableStringify(additional) !== stableStringify(declared)) {
      throw new MatrixConfigError(
        `additional_markets (${additional.join(", ")}) does not match the markets marked additional ` +
          `(${declared.join(", ")})`
      );
    }
  }

  return Object.freeze({
    schema_version: config.schema_version || "usd-l1-market-matrix-v1",
    created_at: config.created_at || null,
    status: config.status || null,
    note: config.note || null,
    primary_market: primary.key,
    additional_markets: Object.freeze(
      markets.filter((market) => market.role === "additional").map((market) => market.key)
    ),
    tests: Object.freeze(TEST_IDS.slice()),
    markets: Object.freeze(markets)
  });
}

/**
 * Load and validate the matrix.
 *
 * @param {object} [options]
 * @param {string} [options.rootDir] repository root.
 * @param {string} [options.file] another document, so an alternative asset configuration needs no code change.
 * @returns {{matrix: object, source: string|null, sha256: string|null}}
 */
function loadMatrix({ rootDir, file } = {}) {
  const root = rootDir || path.resolve(__dirname, "../../..");
  const absolute = file ? path.resolve(file) : path.join(root, MATRIX_PATH);
  if (!fs.existsSync(absolute)) {
    throw new MatrixConfigError(
      `no market matrix at ${path.relative(root, absolute).replace(/\\/g, "/")}; the engine has no markets to score`
    );
  }
  return {
    matrix: validateMatrix(JSON.parse(fs.readFileSync(absolute, "utf8"))),
    source: path.relative(root, absolute).replace(/\\/g, "/"),
    sha256: sha256(fs.readFileSync(absolute))
  };
}
function combinationId(marketKey, testId) {
  return `${marketKey}/${testId}`;
}

/** One row per market per test, in market order then test order. */
function buildCombinations(matrix) {
  const combinations = [];
  for (const market of matrix.markets) {
    for (const test of TEST_TYPES) {
      combinations.push({
        id: combinationId(market.key, test.id),
        market: market.key,
        market_label: market.label,
        role: market.role,
        test: test.id,
        test_label: test.label,
        ordinal: test.ordinal
      });
    }
  }
  return combinations;
}

/** The fingerprint experiment identity carries: the selection itself, not the file's formatting. */
function marketFingerprint(matrix) {
  return sha256(
    stableStringify({
      primary_market: matrix.primary_market,
      tests: matrix.tests,
      markets: matrix.markets.map((market) => ({
        key: market.key,
        role: market.role,
        usd_bullish_predicts: market.usd_bullish_predicts,
        series_file: market.series_file,
        ladder_symbol: market.ladder_symbol
      }))
    })
  );
}

/** The matrix as the run artefact carries it: no functions, every field explicit. */
function describeMatrix(matrix, { source = null, sha256: hash = null } = {}) {
  const combinations = buildCombinations(matrix);
  return {
    id: `usd-l1-matrix-${marketFingerprint(matrix).slice(0, 12)}`,
    schema_version: matrix.schema_version,
    source,
    sha256: hash,
    fingerprint: marketFingerprint(matrix),
    primary_market: matrix.primary_market,
    additional_markets: matrix.additional_markets.slice(),
    market_count: matrix.markets.length,
    test_count: TEST_TYPES.length,
    combination_count: combinations.length,
    combinations_per_strategy: combinations.length,
    tests: TEST_TYPES.map((test) => ({
      id: test.id,
      ordinal: test.ordinal,
      label: test.label,
      requires: test.requires.slice()
    })),
    markets: matrix.markets.map((market) => ({
      key: market.key,
      role: market.role,
      label: market.label,
      asset_code: market.asset_code || null,
      instrument_kind: market.instrument_kind,
      series_file: market.series_file,
      ladder_symbol: market.ladder_symbol,
      quote_convention: market.quote_convention,
      usd_bullish_predicts: market.usd_bullish_predicts,
      digits: market.digits,
      broker_symbol: market.broker_symbol,
      broker_symbol_confirmed: market.broker_symbol_confirmed !== false,
      official_series: market.official_series || null
    })),
    combinations
  };
}
/**
 * Evaluate every combination against the data this checkout actually holds.
 *
 * @param {object} options
 * @param {object} options.matrix a validated matrix.
 * @param {object} [options.seriesByMarket] market key -> readable series or null.
 * @param {object} [options.m5ByMarket] market key -> `{ sessions }` when a 5-minute tape exists.
 * @param {object} [options.ladderByMarket] market key -> `{ sessions }` when a pre-session ladder applies.
 * @returns {object} one row per market with a status and reason per test, plus counts.
 */
function evaluateReadiness({ matrix, seriesByMarket = {}, m5ByMarket = {}, ladderByMarket = {} }) {
  const rows = [];
  const counts = { ready: 0, blocked: 0, proxy_ready: 0 };
  const perTest = Object.fromEntries(TEST_IDS.map((id) => [id, { ready: 0, blocked: 0, proxy_ready: 0 }]));

  for (const market of matrix.markets) {
    const series = seriesByMarket[market.key] || null;
    const m5 = m5ByMarket[market.key] || null;
    const ladder = ladderByMarket[market.key] || null;
    const tests = {};

    if (series) {
      const proxy = market.role === "primary" && market.official_series && market.official_series.available === false;
      tests.direction = {
        status: proxy ? "proxy_ready" : "ready",
        reason: proxy ? REASONS.proxy_series : null,
        official_series: market.official_series || null
      };
      counts[proxy ? "proxy_ready" : "ready"] += 1;
      perTest.direction[proxy ? "proxy_ready" : "ready"] += 1;
    } else {
      tests.direction = {
        status: "blocked",
        reason: `${market.series_file}: ${REASONS.no_session_outcome_series}`,
        official_series: market.official_series || null
      };
      counts.blocked += 1;
      perTest.direction.blocked += 1;
    }

    for (const testId of ["l2l_full_5r", "l2l_half_3r"]) {
      const blockers = [];
      const tapeDates = m5 && Array.isArray(m5.dates) ? m5.dates : [];
      const ladderDates = ladder && Array.isArray(ladder.dates) ? ladder.dates : [];
      const shared = tapeDates.filter((date) => ladderDates.includes(date));
      const tapeUsable = Boolean(m5) && tapeDates.length > 0 && m5.bid_ask !== false;
      if (!tapeUsable) {
        blockers.push(m5 && (m5.mid_tape_sessions || 0) > 0 ? REASONS.no_actionable_bid_ask_tape : REASONS.no_m5_tape);
      }
      if (!ladder || ladderDates.length === 0) blockers.push(REASONS.no_level_ladder);
      else if (tapeUsable && shared.length === 0) blockers.push(REASONS.no_shared_session);
      if (blockers.length) {
        tests[testId] = {
          status: "blocked",
          reason: `${market.label}: ${blockers.join("; ")}`,
          blockers,
          m5_sessions: tapeDates.length,
          mid_tape_sessions: m5 ? m5.mid_tape_sessions || 0 : 0,
          bid_ask: m5 ? m5.bid_ask !== false : false,
          ladder_sessions: ladderDates.length,
          sessions_with_tape_and_ladder: shared.length
        };
        counts.blocked += 1;
        perTest[testId].blocked += 1;
      } else {
        tests[testId] = {
          status: "ready",
          reason: null,
          m5_sessions: tapeDates.length,
          mid_tape_sessions: m5.mid_tape_sessions || 0,
          bid_ask: true,
          ladder_sessions: ladderDates.length,
          sessions_with_tape_and_ladder: shared.length
        };
        counts.ready += 1;
        perTest[testId].ready += 1;
      }
    }

    rows.push({
      market: market.key,
      label: market.label,
      role: market.role,
      broker_symbol: market.broker_symbol,
      broker_symbol_confirmed: market.broker_symbol_confirmed !== false,
      tests
    });
  }

  return {
    rows,
    counts,
    per_test: perTest,
    combination_count: rows.length * TEST_IDS.length,
    note:
      "a blocked combination names the missing dataset; it is not a zero, and no market is dropped from the " +
      "table because it has no data"
  };
}
/**
 * Replace a readiness status with the result a run actually produced.
 *
 * @param {object} readiness the evaluateReadiness block.
 * @param {object} results `{ direction: { MARKET: scored }, l2l_full_5r: {...}, l2l_half_3r: {...} }`
 * @returns {object} the same block with scored rows and their counts.
 */
function applyRunResults(readiness, results = {}) {
  const counts = { scored: 0, ready: 0, blocked: 0, proxy_scored: 0, proxy_ready: 0 };
  const rows = readiness.rows.map((row) => {
    const tests = {};
    for (const [testId, entry] of Object.entries(row.tests)) {
      const scored = results[testId] ? results[testId][row.market] : null;
      if (Number.isFinite(scored) && scored > 0) {
        const proxy = entry.status === "proxy_ready" || entry.status === "proxy_scored";
        tests[testId] = {
          ...entry,
          status: proxy ? "proxy_scored" : "scored",
          scored,
          released_by: "this run produced scored sessions"
        };
        counts[proxy ? "proxy_scored" : "scored"] += 1;
      } else {
        tests[testId] = { ...entry };
        counts[entry.status] = (counts[entry.status] || 0) + 1;
      }
    }
    return { ...row, tests };
  });
  return { ...readiness, rows, run_counts: counts };
}

module.exports = {
  MATRIX_PATH,
  TEST_TYPES,
  TEST_IDS,
  REASONS,
  MatrixConfigError,
  stableStringify,
  validateMatrix,
  loadMatrix,
  combinationId,
  buildCombinations,
  marketFingerprint,
  describeMatrix,
  evaluateReadiness,
  applyRunResults
};
