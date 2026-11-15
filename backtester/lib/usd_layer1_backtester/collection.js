"use strict";

/**
 * Sealed 05:00 collection for the USD Layer 1 research model (research only).
 *
 * The rule this module enforces is the one the audit exposed: a value is only usable for a morning if it was
 * *received* before the 05:00 London cutoff. A request started at 05:00 that returns at 05:01 belongs to the
 * next morning, so it is refused rather than quietly stamped with the date it was requested.
 *
 * Sealing is append-only. A retry never replaces the first response: the original payload and its hash are
 * kept, and the retry is logged beside it with its own receipt time.
 */

const crypto = require("node:crypto");

const VERSION = "usd-l1-collection-v1";

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function payloadHash(payload) {
  return sha256(typeof payload === "string" ? payload : JSON.stringify(payload));
}

function receiptHash(items) {
  return sha256(items.map((item) => `${item.source_id}:${payloadHash(item.payload)}`).join("|"));
}

/**
 * Seal one morning. Every item must carry a receipt time at or before the cutoff; anything later fails the
 * whole seal, because a snapshot with one late value is not a 05:00 snapshot.
 */
function seal({ session_date, cutoff_at_utc, items = [], sealed_at_utc = null } = {}) {
  const cutoff = Date.parse(cutoff_at_utc);
  if (!session_date || !Number.isFinite(cutoff)) {
    throw new Error("seal needs session_date and a parseable cutoff_at_utc");
  }
  const refused = [];
  for (const item of items) {
    const received = Date.parse(item.received_at_utc);
    if (!Number.isFinite(received) || received > cutoff) {
      refused.push({ source_id: item.source_id, received_at_utc: item.received_at_utc || null, reason: "received after the 05:00 cutoff" });
    }
  }
  const records = items.map((item) => ({
    source_id: item.source_id,
    series_id: item.series_id || null,
    request_url: item.request_url || null,
    fetched_at_utc: item.fetched_at_utc || null,
    received_at_utc: item.received_at_utc,
    provider_updated_at: item.provider_updated_at || null,
    release_id: item.release_id || null,
    payload_sha256: payloadHash(item.payload),
    payload: item.payload
  }));
  const status = refused.length ? "refused_late" : "sealed";
  return {
    version: VERSION,
    session_date,
    cutoff_at_utc: new Date(cutoff).toISOString(),
    sealed_at_utc: sealed_at_utc || new Date().toISOString(),
    status,
    usable_for_decision: status === "sealed",
    sealed_sha256: receiptHash(records),
    refused,
    retries: [],
    items: records
  };
}

/**
 * A retry adds a receipt, never a replacement. The sealed hash and the original payloads stay exactly as they
 * were, so a later reader can prove which bytes the decision saw.
 */
function retry(sealed, item) {
  if (!sealed || !sealed.sealed_sha256) throw new Error("retry needs a sealed snapshot");
  const receipt = {
    source_id: item.source_id,
    fetched_at_utc: item.fetched_at_utc || null,
    received_at_utc: item.received_at_utc,
    payload_sha256: payloadHash(item.payload),
    changed: item.payload !== undefined
  };
  const original = sealed.items.find((entry) => entry.source_id === item.source_id);
  receipt.matches_original = Boolean(original) && original.payload_sha256 === receipt.payload_sha256;
  return { ...sealed, retries: [...sealed.retries, receipt] };
}

/** Re-derive the seal to prove nothing in the stored snapshot moved after the cutoff. */
function verify(sealed) {
  const recomputed = receiptHash(sealed.items);
  const late = sealed.items.filter((item) => Date.parse(item.received_at_utc) > Date.parse(sealed.cutoff_at_utc));
  return {
    ok: recomputed === sealed.sealed_sha256 && late.length === 0 && sealed.status === "sealed",
    recomputed,
    matches: recomputed === sealed.sealed_sha256,
    late_items: late.map((item) => item.source_id),
    status: sealed.status
  };
}

/** The six required sources a morning needs before the intended model can decide. */
const REQUIRED_SOURCES = Object.freeze([
  { source_id: "fred_vixcls", series_id: "VIXCLS", request_url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS", factor_ids: ["live.f1-vix-level"] },
  { source_id: "fred_dgs2", series_id: "DGS2", request_url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2", factor_ids: ["live.f2-us-2y-delta", "live.f3-us-de-2y-spread-delta"] },
  { source_id: "bundesbank_2y", series_id: "BBSIS:D.I.ZST.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A", request_url: "https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZST.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A?format=csv&lang=en", factor_ids: ["live.f3-us-de-2y-spread-delta", "rates.relative-front-end-delta"] },
  { source_id: "fred_dfr", series_id: "DFII10", request_url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10", factor_ids: ["live.f4-real-yield-delta"] },
  { source_id: "provider_h1_eurusd", series_id: "EURUSD_H1", request_url: "", factor_ids: ["fx.usd-overnight-range-position", "fx.usd-session-volatility-regime"] },
  { source_id: "fomc_archive", series_id: "FOMC", request_url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", factor_ids: ["live.f8-fed-bias"] }
]);

function coverage(sealed) {
  const present = new Set(sealed ? sealed.items.map((item) => item.source_id) : []);
  const missing = REQUIRED_SOURCES.filter((source) => !present.has(source.source_id)).map((source) => source.source_id);
  return { required: REQUIRED_SOURCES.length, present: present.size, missing, complete: missing.length === 0 };
}

module.exports = { VERSION, REQUIRED_SOURCES, seal, retry, verify, coverage, payloadHash };
