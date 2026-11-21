"use strict";

/**
 * Planning helpers for a bounded, resumable USD Layer 1 n8n sweep (research only).
 *
 * A sweep is a sequence of controlled webhook requests, each carrying a bounded list of mornings. The
 * runner that uses this module never decides what is already durable: it asks the ledger, so a resumed
 * run asks only for the mornings that are still missing or unverified, and an interrupted request can be
 * retried without risking a second result for a morning.
 *
 * Nothing here reads the network. These are pure functions so the chunking, the request body and the
 * response classification can be tested without an n8n instance.
 */

const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

const SWEEP_VERSION = "usd-l1-n8n-sweep-v1";
const MAX_CHUNK = 40;
const DEFAULT_CHUNK = 20;
const TECHNICAL_FAILURE_SCHEMA = "usd-l1-n8n-technical-failure-v1";

/** Split an ordered list of mornings into bounded requests. */
function chunkDates(dates, size = DEFAULT_CHUNK) {
  if (!Array.isArray(dates)) throw new Error("dates must be an array");
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer");
  if (size > MAX_CHUNK) throw new Error(`chunk size must not exceed ${MAX_CHUNK}; the controller refuses a larger batch`);
  const unique = Array.from(new Set(dates)).sort();
  const chunks = [];
  for (let index = 0; index < unique.length; index += size) chunks.push(unique.slice(index, index + size));
  return chunks;
}

/** The webhook body: mornings, the selected models, the validation label and any test selection. */
function requestBody({ dates, models, validation = "structural", tests = null, datasetUrl = null } = {}) {
  const cleaned = (Array.isArray(dates) ? dates : []).map((date) => String(date).trim()).filter(Boolean);
  if (cleaned.length === 0) throw new Error("a sweep request needs at least one morning");
  if (cleaned.length > MAX_CHUNK) throw new Error(`a sweep request carries at most ${MAX_CHUNK} mornings`);
  const selection = registry.resolveSelection(models ? models : registry.DEFAULT_SELECTION);
  if (selection.some((entry) => !entry.cloud)) {
    throw new Error("every selected model must be available in the n8n Cloud runtime");
  }
  if (validation !== "structural" && validation !== "receipted") throw new Error("validation must be structural or receipted");
  const body = {
    dates: cleaned,
    models: selection.map((entry) => entry.key),
    validation
  };
  if (tests) body.tests = Array.isArray(tests) ? tests.slice() : String(tests).split(",").map((entry) => entry.trim()).filter(Boolean);
  if (datasetUrl) body.dataset_url = datasetUrl;
  return body;
}

/**
 * Classify a webhook response.
 *
 * A record that the controller marked as a technical failure is not a result: it is returned separately so
 * the runner can retain it as an attempt and re-request the morning later. Anything that is not JSON, or
 * is JSON but not a record list, is an error rather than an empty success.
 */
function parseResponse(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (error) {
    throw new Error(`the webhook did not return JSON: ${error.message}`);
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const records = [];
  const failures = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      failures.push({ reason: "response item is not an object" });
      continue;
    }
    if (item.schema_version === TECHNICAL_FAILURE_SCHEMA) {
      failures.push({
        date: item.date || null,
        missing: Array.isArray(item.missing) ? item.missing.slice() : [],
        execution_id: item.n8n && item.n8n.execution_id ? String(item.n8n.execution_id) : null,
        reason: "the controller reported a missing child answer"
      });
      continue;
    }
    records.push(item);
  }
  return { records, failures };
}

/** The ledger keys a batch of records would occupy, so a plan can be compared with what came back. */
function coveredDates(records) {
  return Array.from(new Set((records || []).map((record) => record && record.date).filter(Boolean))).sort();
}

module.exports = {
  SWEEP_VERSION,
  MAX_CHUNK,
  DEFAULT_CHUNK,
  TECHNICAL_FAILURE_SCHEMA,
  chunkDates,
  requestBody,
  parseResponse,
  coveredDates
};
