#!/usr/bin/env node
"use strict";

/**
 * Cut a small dataset that carries a different market x test configuration (research only).
 *
 *   node scripts/build_usd_l1_matrix_config_dataset.js --markets DXY,EURUSD,XAUUSD,GBPUSD \
 *       --dates 2024-01-10,2024-03-26 --out data/usd-layer1-backtester/n8n/datasets/run-4market-3test-v1.json
 *
 * The n8n Cloud parent fetches one https dataset per run and passes its `market_matrix` to the controller,
 * so a different market selection is a different *document*, not a different runtime. This script cuts such
 * a document from the published artefact: the chosen mornings are copied byte for byte, the selection is
 * written as the matrix the engine reads, and the subset names the artefact it came from and that file's
 * hash - so the rows can be checked against the source rather than trusted.
 *
 * It refuses to cut a subset from an artefact whose market list does not contain every requested market,
 * and it will not invent a row for a morning the source does not hold.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const matrixModule = require("../backtester/lib/usd_layer1_backtester/market_matrix");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = "data/usd-layer1-backtester/run-v1.json";

function parseArgs(argv) {
  const args = { markets: null, dates: null, out: null, source: SOURCE };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === "--markets") {
      args.markets = String(value).split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean);
      index += 1;
    } else if (token === "--dates") {
      args.dates = String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
      index += 1;
    } else if (token === "--out") {
      args.out = value;
      index += 1;
    } else if (token === "--source") {
      args.source = value;
      index += 1;
    } else {
      throw new Error(`unknown argument ${token}`);
    }
  }
  if (!args.markets || args.markets.length < 2) throw new Error("--markets needs a primary market and at least one more");
  if (!args.dates || args.dates.length === 0) throw new Error("--dates needs at least one morning");
  if (!args.out) throw new Error("--out is required");
  return args;
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8").replace(/^\uFEFF/, ""));
}

function main(argv) {
  const args = parseArgs(argv);
  const sourceBuffer = fs.readFileSync(path.join(ROOT, args.source));
  const source = JSON.parse(sourceBuffer.toString("utf8").replace(/^\uFEFF/, ""));
  const base = readJson(matrixModule.MATRIX_PATH);
  const declared = new Map(base.markets.map((market) => [String(market.key).toUpperCase(), market]));

  const markets = args.markets.map((key, index) => {
    const market = declared.get(key);
    if (!market) throw new Error(`${key} is not a market in ${matrixModule.MATRIX_PATH}`);
    return { ...market, role: index === 0 ? "primary" : "additional" };
  });
  const config = matrixModule.validateMatrix({
    schema_version: "usd-l1-market-matrix-v1",
    created_at: new Date().toISOString().slice(0, 10),
    status: "demonstration: a smaller selection cut from the published artefact",
    note:
      "this document exists to prove the configuration is data: the same workflows, engine and tests, a " +
      "different set of markets",
    primary_market: markets[0].key,
    tests: matrixModule.TEST_IDS.slice(),
    markets
  });
  const described = matrixModule.describeMatrix(config, { source: args.source, sha256: null });

  const byDate = new Map((source.sessions || []).map((session) => [session.date, session]));
  const missing = args.dates.filter((date) => !byDate.has(date));
  if (missing.length) throw new Error(`the source artefact holds no session for ${missing.join(", ")}`);
  const sessions = args.dates.map((date) => byDate.get(date));

  const dataset = {
    schema_version: source.schema_version,
    generated_at: source.generated_at,
    research_only: true,
    labels: source.labels,
    run: {
      ...source.run,
      markets: described.markets.map((market) => ({
        key: market.key,
        role: market.role,
        label: market.label,
        outcome_series: market.series_file,
        quote_convention: market.quote_convention,
        usd_bullish_predicts: market.usd_bullish_predicts,
        digits: market.digits,
        broker_symbol: market.broker_symbol,
        ladder_symbol: market.ladder_symbol
      })),
      market_matrix_id: described.id,
      market_matrix_fingerprint: described.fingerprint,
      market_matrix_source: args.source,
      subset_reason: "a different market configuration for the n8n Cloud run, cut from the published artefact"
    },
    market_matrix: described,
    input_source_legend: source.input_source_legend || [],
    sessions,
    subset: {
      source: args.source,
      source_sha256: crypto.createHash("sha256").update(sourceBuffer).digest("hex"),
      source_generated_at: source.generated_at,
      dates: args.dates.slice(),
      market_matrix_fingerprint: described.fingerprint,
      combination_count: described.combination_count,
      rule:
        "every session row is copied byte for byte from the source artefact; only run.markets and market_matrix are replaced, so the engine is unchanged and the data is the published data"
    }
  };

  const outFile = path.resolve(ROOT, args.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(dataset, null, 1)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        out: args.out,
        bytes: fs.statSync(outFile).size,
        primary_market: described.primary_market,
        additional_markets: described.additional_markets,
        combinations: described.combination_count,
        sessions: sessions.map((session) => session.date),
        source: { path: args.source, sha256: dataset.subset.source_sha256 }
      },
      null,
      1
    )
  );
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(String(error && error.message ? error.message : error));
    process.exit(1);
  }
}
