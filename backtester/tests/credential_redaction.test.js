const test = require("node:test");
const assert = require("node:assert/strict");

const fredImporter = require("../importers/fred/import_fred_macro");
const alphaVantageImporter = require("../importers/eurusd/download_eurusd_daily_ohlc_alpha_vantage");

test("FRED importer redacts API key query values in logged URLs", () => {
  const secretValue = "super-secret-key";
  const url = fredImporter.buildFredUrl("DGS2", secretValue, "2024-01-01", "2024-01-31");
  const redacted = fredImporter.sanitizeUrlForLogging(url);
  const sanitizedUrl = new URL(redacted);

  assert.equal(sanitizedUrl.searchParams.get("api_key"), "[REDACTED]");
  assert.doesNotMatch(redacted, new RegExp(secretValue));
});

test("Alpha Vantage importer redacts API key query values in logged URLs", () => {
  const secretValue = "super-secret-key";
  const url = alphaVantageImporter.buildUrl(secretValue);
  const redacted = alphaVantageImporter.sanitizeUrlForLogging(url);
  const sanitizedUrl = new URL(redacted);

  assert.equal(sanitizedUrl.searchParams.get("apikey"), "[REDACTED]");
  assert.doesNotMatch(redacted, new RegExp(secretValue));
});
