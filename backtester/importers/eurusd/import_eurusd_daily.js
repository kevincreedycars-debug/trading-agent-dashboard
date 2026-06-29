#!/usr/bin/env node

const {
  assertDateRange,
  ensureManifest,
  maxDate,
  minDate,
  parseArgs,
  readOptionalEnv,
  requireEnv,
  toNullableNumber,
  upsertRows
} = require("../../lib/historical_common");

const DEFAULT_START = "2000-01-01";
const DEFAULT_END = new Date().toISOString().slice(0, 10);
const DEFAULT_MANIFEST_NAME = "EURUSD daily history";
const DEFAULT_SCHEMA_VERSION = "v1";
const DEFAULT_NORMALIZATION_VERSION = "eurusd_daily_importer_v1";
const DEFAULT_FRED_SERIES_ID = "DEXUSEU";

function buildFredUrl(seriesId, apiKey, startDate, endDate) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "asc");
  url.searchParams.set("observation_start", startDate);
  url.searchParams.set("observation_end", endDate);
  return url.toString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} for ${url}\n${body}`);
  }
  return response.json();
}

function parseFredEurusdObservations(payload, seriesId) {
  const observations = Array.isArray(payload?.observations) ? payload.observations : [];

  return observations
    .filter((row) => row && row.value !== "." && row.value !== "" && row.value !== null)
    .map((row) => {
      const close = toNullableNumber(row.value);
      if (close === null || close <= 0) {
        return null;
      }

      return {
        date: row.date,
        close,
        source_symbol: seriesId
      };
    })
    .filter(Boolean);
}

function buildRows(records, manifestId, options) {
  const prepared = [];
  let skippedMissing = 0;

  for (const record of records) {
    const observationDate = String(record.date || "").trim();
    const close = toNullableNumber(record.close);

    if (!observationDate || observationDate < options.startDate || observationDate > options.endDate) {
      continue;
    }

    if (close === null || close <= 0) {
      skippedMissing += 1;
      continue;
    }

    prepared.push({
      source_manifest_id: manifestId,
      instrument_key: "eurusd",
      instrument_family: "fx_spot",
      asset_scope: "EUR",
      quote_currency: "USD",
      observed_at: `${observationDate}T00:00:00Z`,
      observation_date: observationDate,
      observation_timezone: "UTC",
      interval: "daily",
      open: null,
      high: null,
      low: null,
      close,
      volume: null,
      open_interest: null,
      vendor_symbol: record.source_symbol || options.vendorSymbol,
      is_adjusted: false,
      adjustment_type: null,
      metadata: {
        importer: "backtester/importers/eurusd/import_eurusd_daily.js",
        source_preset: "fred_dexuseu",
        source_orientation: "EURUSD direct",
        source_note: "FRED DEXUSEU daily direct EUR/USD close"
      }
    });
  }

  return { prepared, skippedMissing };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.start || readOptionalEnv("EURUSD_IMPORT_START", DEFAULT_START);
  const endDate = args.end || readOptionalEnv("EURUSD_IMPORT_END", DEFAULT_END);
  const manifestName = args.manifest || readOptionalEnv("EURUSD_MANIFEST_NAME", DEFAULT_MANIFEST_NAME);
  const fredSeriesId = args["fred-series-id"] || readOptionalEnv("EURUSD_FRED_SERIES_ID", DEFAULT_FRED_SERIES_ID);
  const vendorName = args["vendor-name"] || readOptionalEnv("EURUSD_VENDOR_NAME", "FRED");
  const vendorSymbol = args["vendor-symbol"] || readOptionalEnv("EURUSD_VENDOR_SYMBOL", fredSeriesId);

  assertDateRange(startDate, endDate);

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const fredApiKey = requireEnv("FRED_API_KEY");

  const records = parseFredEurusdObservations(
    await fetchJson(buildFredUrl(fredSeriesId, fredApiKey, startDate, endDate)),
    fredSeriesId
  );

  const manifestPayload = {
    manifest_name: manifestName,
    source_type: "api_export",
    vendor_name: vendorName,
    dataset_name: "EURUSD daily close history",
    asset_scope: "EUR",
    coverage_start: startDate,
    coverage_end: endDate,
    frequency: "daily",
    import_mode: "historical_backfill",
    schema_version: DEFAULT_SCHEMA_VERSION,
    normalization_version: DEFAULT_NORMALIZATION_VERSION,
    source_uri: "https://api.stlouisfed.org/fred/series/observations",
    metadata: {
      importer: "backtester/importers/eurusd/import_eurusd_daily.js",
      instrument_key: "eurusd",
      vendor_symbol: vendorSymbol,
      fred_series_id: fredSeriesId,
      source_orientation: "EURUSD direct",
      last_imported_at: new Date().toISOString()
    }
  };

  const manifest = await ensureManifest(
    supabaseUrl,
    serviceRoleKey,
    {
      manifestName,
      vendorName,
      assetScope: "EUR"
    },
    manifestPayload
  );

  const { prepared, skippedMissing } = buildRows(records, manifest.id, {
    endDate,
    startDate,
    vendorSymbol
  });

  const submitted = await upsertRows(
    supabaseUrl,
    serviceRoleKey,
    "historical_price_series",
    prepared,
    ["instrument_key", "interval", "observed_at", "source_manifest_id"]
  );

  await ensureManifest(
    supabaseUrl,
    serviceRoleKey,
    {
      manifestName,
      vendorName,
      assetScope: "EUR"
    },
    {
      ...manifestPayload,
      row_count: prepared.length,
      coverage_start: minDate(prepared.map((row) => row.observation_date)) || startDate,
      coverage_end: maxDate(prepared.map((row) => row.observation_date)) || endDate,
      metadata: {
        ...manifestPayload.metadata,
        prepared_rows: prepared.length,
        submitted_rows: submitted,
        skipped_missing: skippedMissing
      }
    }
  );

  console.log(`[EURUSD] prepared=${prepared.length} submitted=${submitted} skipped_missing=${skippedMissing}`);
  console.log(`Manifest: ${manifestName}`);
  console.log(`Instrument key: eurusd`);
  console.log(`Source: FRED ${fredSeriesId}`);
  console.log(`Date range: ${startDate} -> ${endDate}`);
}

run().catch((error) => {
  console.error("EURUSD daily import failed.");
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
