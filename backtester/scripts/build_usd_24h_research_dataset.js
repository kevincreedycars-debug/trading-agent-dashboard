#!/usr/bin/env node
"use strict";

/**
 * Builds the committed USD 24-hour research dataset and its manifest from the cached inputs.
 *
 * Usage:
 *   node backtester/scripts/build_usd_24h_research_dataset.js [--out=PATH] [--manifest=PATH] [--cache-dir=PATH]
 *
 * The dataset holds one row per prediction cutoff. Features only ever read observations that were
 * usable under each series' declared availability lag; outcomes are stored separately and use the
 * final published values of the same series the production snapshot stores.
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { sha256 } = require("../lib/usd24h/acquire");
const { buildDataset } = require("../lib/usd24h/dataset");
const { SERIES } = require("../lib/usd24h/series_catalogue");

const DEFAULT_OUT = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const DEFAULT_MANIFEST = path.resolve(__dirname, "../../data/usd-24h-dataset-manifest.json");
const DEFAULT_CACHE_MANIFEST = path.resolve(__dirname, "../tmp/usd-24h-research-cache/cache-manifest.json");

function readCacheManifest(explicitPath) {
  const target = explicitPath ? path.resolve(explicitPath) : DEFAULT_CACHE_MANIFEST;
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = args.out ? path.resolve(args.out) : DEFAULT_OUT;
  const manifestPath = args.manifest ? path.resolve(args.manifest) : DEFAULT_MANIFEST;
  const cacheDir = args["cache-dir"] ? path.resolve(args["cache-dir"]) : undefined;

  const dataset = buildDataset({ cacheDir });
  const body = `${JSON.stringify(dataset, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, "utf8");

  const cacheManifest = readCacheManifest();
  const manifest = {
    schema_version: "usd-24h-dataset-manifest-v1",
    generated_at: new Date().toISOString(),
    dataset_path: path.relative(path.resolve(__dirname, "../.."), outPath).replace(/\\/g, "/"),
    dataset_sha256: sha256(body),
    dataset_bytes: Buffer.byteLength(body, "utf8"),
    dataset_note: "The dataset file carries no generation timestamp, so its sha256 is stable across rebuilds that produce the same rows; this manifest records when it was last built.",
    window: dataset.window,
    call_time_et: dataset.call_time_et,
    outcome: {
      instrument: dataset.outcome_instrument,
      series_key: dataset.outcome_series,
      provider_series: "DTWEXBGS",
      entry: "09:30 ET on the snapshot date, priced from the final value of the outcome series for that date",
      endpoint: "16:00 ET close of the next valid trading session (the repository's own following-24hrs contract), with a declared delayed-endpoint fallback of up to 3 calendar days when the scheduled date has no observation",
      flat_band_percentage_points: 0.1
    },
    inputs: SERIES.map((entry) => {
      const cached = cacheManifest?.series?.find((series) => series.key === entry.key) || null;
      return {
        key: entry.key,
        role: entry.role,
        provider: entry.provider,
        provider_series: entry.provider_series,
        frequency: entry.frequency,
        units: entry.units,
        availability_lag_business_days: entry.availability_lag_business_days,
        observation_count: cached?.observations ?? null,
        missing_values_in_cache: cached?.missing_values ?? null,
        cached_first_date: cached?.first_date ?? null,
        cached_last_date: cached?.last_date ?? null,
        cache_sha256: cached?.cache_sha256 ?? null,
        note: entry.note
      };
    }),
    coverage: dataset.coverage,
    unavailable_inputs: [
      {
        key: "latest_us_event_surprise",
        reason: "Requires original-release vintages plus pre-release consensus. The live collector reads a paid Finnhub calendar and the warehouse importer reads a paid RapidAPI ForexFactory calendar; neither is available to this dataset, and ALFRED vintage CSV is not served without a key.",
        status: "UNAVAILABLE"
      },
      {
        key: "fed_bias",
        reason: "The production field is derived from the same event feed, so it cannot be reconstructed faithfully here. Only realised-policy proxies (EFFR, SOFR, 3M and 2Y changes) are present.",
        status: "UNAVAILABLE_PROXY_ONLY"
      },
      {
        key: "fed_funds_futures_path",
        reason: "Free sources do not publish a historical meeting-by-meeting implied path; front-end yield changes are used as a labelled proxy.",
        status: "PROXY_ONLY"
      }
    ],
    limitations: [
      "Values are the latest published revision, not the vintage visible at the cutoff; the declared business-day availability lag only approximates the real publication delay.",
      "The outcome instrument is DTWEXBGS, a trade-weighted broad dollar index, not the ICE DXY futures contract.",
      "The following-24hrs endpoint is the next session close, so measured elapsed time is about 24 hours on a Monday-to-Tuesday call and longer across weekends and holidays.",
      "The local gold cache is a previously acquired OANDA hourly file, not a fresh download; its sha256 is recorded in the input cache manifest."
    ]
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  process.stdout.write(
    `rows=${dataset.coverage.rows} evaluable=${dataset.coverage.evaluable_rows} ` +
    `up=${dataset.coverage.market_outcome_direction_counts.BULLISH || 0} ` +
    `down=${dataset.coverage.market_outcome_direction_counts.BEARISH || 0} ` +
    `flat=${dataset.coverage.market_outcome_direction_counts.FLAT || 0}\n` +
    `dataset: ${outPath} (${manifest.dataset_bytes} bytes, sha256 ${manifest.dataset_sha256.slice(0, 16)})\n` +
    `manifest: ${manifestPath}\n`
  );
}

main();
