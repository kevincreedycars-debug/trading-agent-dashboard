#!/usr/bin/env node
"use strict";

/**
 * Downloads and caches every declared USD 24-hour research input.
 *
 * Usage:
 *   node backtester/scripts/acquire_usd_24h_research_inputs.js [--refresh] [--cache-dir=PATH] [--keys=a,b]
 *
 * Raw cache files stay in the ignored `backtester/tmp/usd-24h-research-cache/` directory. The
 * command prints one line per series and writes `cache-manifest.json` next to the cache.
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { acquireAll } = require("../lib/usd24h/acquire");
const { SERIES } = require("../lib/usd24h/series_catalogue");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cacheDir = args["cache-dir"] ? path.resolve(args["cache-dir"]) : undefined;
  const keys = args.keys ? String(args.keys).split(",").map((key) => key.trim()).filter(Boolean) : SERIES.map((entry) => entry.key);
  const refresh = args.refresh === "true";

  const records = await acquireAll(keys, { cacheDir, refresh });
  const manifest = {
    schema_version: "usd-24h-input-cache-manifest-v1",
    generated_at: new Date().toISOString(),
    cache_dir: records.length ? path.dirname(records[0].cache_path) : null,
    refresh_requested: refresh,
    series: records.map((record) => ({
      key: record.key,
      provider: record.provider,
      provider_series: record.provider_series,
      frequency: record.frequency,
      units: record.units,
      availability_lag_business_days: record.availability_lag_business_days,
      request_url: record.request_url,
      acquired_at: record.acquired_at,
      observations: record.observation_count,
      missing_values: record.missing_values,
      first_date: record.first_date,
      last_date: record.last_date,
      cache_sha256: record.cache_sha256,
      cache_file: path.basename(record.cache_path),
      from_cache: record.from_cache === true
    }))
  };

  const manifestPath = path.join(path.dirname(records[0].cache_path), "cache-manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  for (const series of manifest.series) {
    process.stdout.write(
      `${series.key.padEnd(24)} ${series.provider.padEnd(11)} n=${String(series.observations).padStart(5)} ` +
      `missing=${String(series.missing_values).padStart(4)} ${series.first_date || "-"}..${series.last_date || "-"} ` +
      `${series.from_cache ? "cache" : "download"}\n`
    );
  }
  process.stdout.write(`manifest: ${manifestPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
