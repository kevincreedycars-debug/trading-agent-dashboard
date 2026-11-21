"use strict";

/**
 * Historical input retrieval through a model's declared input contract (research only).
 *
 * The committed panel is a reconstruction: its values are the latest published prints aligned to the 05:00
 * cutoff after the fact. That is enough to replay a decision and not enough to claim the value was knowable
 * at the cutoff. This module keeps the two apart.
 *
 * For every key a model declares it returns:
 *   - the source the declared catalogue names, with its provider, series and publication lag;
 *   - the saved value, its observation date and the clock the panel carries (timestamp, date only, none);
 *   - a reconstruction digest that identifies exactly the value that was replayed;
 *   - a receipt only when a contemporaneous capture exists, was taken at or before the cutoff, and matches
 *     the saved value. No capture means no receipt - never a placeholder, never a hash presented as one.
 *
 * A capture that disagrees with the panel is reported as a conflict and neither value is chosen silently.
 * A capture taken after the cutoff is reported as unusable rather than back-dated.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const sources = require("./input_sources");

const RETRIEVAL_VERSION = "usd-l1-input-retrieval-v1";
const CAPTURE_SCHEMA = "usd-l1-input-capture-v1";
const CAPTURE_DIR = path.join(__dirname, "..", "..", "data", "usd-layer1-backtester", "captures");

const MODES = Object.freeze({
  contemporaneous: "contemporaneous_capture",
  reconstructed: "reconstructed_panel",
  unavailable: "unavailable"
});

const CAPTURE_STATES = Object.freeze({
  none: "no_capture",
  usable: "usable",
  conflict: "value_conflict",
  afterCutoff: "captured_after_cutoff",
  noReceipt: "capture_without_receipt",
  fixture: "fixture_capture_ignored",
  malformed: "malformed_capture"
});

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** Read the capture corpus. A missing directory is an empty corpus, not an error. */
function loadCaptures({ dir = CAPTURE_DIR, allowFixtures = false } = {}) {
  const corpus = { files: [], captures: new Map(), rejected: [], fixtures: 0, usable: 0 };
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".json")).sort();
  } catch (error) {
    return corpus;
  }
  for (const name of names) {
    const file = path.join(dir, name);
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    } catch (error) {
      corpus.rejected.push({ file: name, reason: `not readable JSON: ${error.message}` });
      continue;
    }
    corpus.files.push(name);
    if (doc.schema_version !== CAPTURE_SCHEMA) {
      corpus.rejected.push({ file: name, reason: `unexpected schema ${doc.schema_version}` });
      continue;
    }
    if (doc.fixture === true) {
      corpus.fixtures += 1;
      if (!allowFixtures) continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(doc.date || ""))) {
      corpus.rejected.push({ file: name, reason: "capture has no real YYYY-MM-DD date" });
      continue;
    }
    const entries = Array.isArray(doc.entries) ? doc.entries : [];
    for (const entry of entries) {
      if (!entry || typeof entry.key !== "string") {
        corpus.rejected.push({ file: name, reason: "an entry carries no key" });
        continue;
      }
      const byKey = corpus.captures.get(doc.date) || new Map();
      byKey.set(entry.key, Object.assign({ capture_file: name, fixture: doc.fixture === true }, entry, {
        captured_at: entry.captured_at || doc.captured_at || null,
        cutoff_at_utc: doc.cutoff_at_utc || null
      }));
      corpus.captures.set(doc.date, byKey);
      corpus.usable += 1;
    }
  }
  return corpus;
}

function keysOf(contract) {
  const rows = (contract && Array.isArray(contract.keys)) ? contract.keys : [];
  return rows.map((row) => (typeof row === "string" ? row : row && row.key)).filter(Boolean);
}

/**
 * Decide what one key's evidence is, without ever inventing one.
 *
 * The saved value must agree exactly with the capture. A capture naming the same key with a different value
 * is a conflict: the panel and the capture disagree about history, and choosing one would hide that.
 */
function assessKey({ key, saved, observedAt, staleness, legend, cutoff, capture, allowFixtures }) {
  const source = sources.sourceFor(key);
  const present = typeof saved === "number" && Number.isFinite(saved);
  const base = {
    key,
    present,
    value: present ? saved : null,
    observed_at: observedAt || null,
    staleness_business_days: Number.isFinite(staleness) ? staleness : null,
    clock: observedAt && String(observedAt).includes("T") ? "timestamp" : (observedAt ? "date_only" : "none"),
    source: {
      known: source.known,
      provider: source.provider,
      series: source.series,
      frequency: source.frequency,
      units: source.units,
      transform: source.transform,
      parents: source.parents,
      publication: source.publication,
      revision_note: source.revision_note
    },
    panel_source_legend: legend || null,
    receipt: null,
    capture_state: CAPTURE_STATES.none,
    capture_detail: null
  };
  if (!present) {
    return Object.assign(base, {
      mode: MODES.unavailable,
      reconstruction_digest: null,
      statement: "no saved value exists for this key on this morning; nothing is filled and nothing is estimated"
    });
  }
  const reconstruction = sha256(canonical({
    date: base.observed_at,
    key,
    value: saved,
    observed_at: observedAt || null,
    source: { provider: source.provider, series: source.series }
  }));
  let captureState = CAPTURE_STATES.none;
  let detail = null;
  let usable = false;
  if (capture) {
    if (capture.fixture === true && !allowFixtures) {
      captureState = CAPTURE_STATES.fixture;
      detail = "a labelled fixture capture is present and is ignored by a research artefact";
    } else if (!capture.captured_at || !Number.isFinite(Date.parse(capture.captured_at))) {
      captureState = CAPTURE_STATES.malformed;
      detail = "the capture carries no parseable captured_at";
    } else if (cutoff && Number.isFinite(Date.parse(cutoff)) && Date.parse(capture.captured_at) > Date.parse(cutoff)) {
      captureState = CAPTURE_STATES.afterCutoff;
      detail = `captured ${capture.captured_at}, after the ${cutoff} cutoff`;
    } else if (typeof capture.value !== "number" || !Number.isFinite(capture.value) || capture.value !== saved) {
      captureState = CAPTURE_STATES.conflict;
      detail = "the capture and the committed panel disagree on this value; neither is chosen silently";
    } else if (!capture.receipt_id) {
      captureState = CAPTURE_STATES.noReceipt;
      detail = "the capture carries no receipt id, so it cannot evidence a retrieval";
    } else {
      captureState = CAPTURE_STATES.usable;
      usable = true;
    }
  }
  if (usable) {
    return Object.assign(base, {
      mode: MODES.contemporaneous,
      capture_state: captureState,
      capture_detail: null,
      reconstruction_digest: reconstruction,
      receipt: {
        receipt_id: capture.receipt_id,
        captured_at: capture.captured_at,
        publication_at: capture.publication_at || null,
        provider: capture.provider || source.provider,
        series: capture.series || source.series,
        capture_file: capture.capture_file,
        digest: sha256(canonical({ key, value: saved, captured_at: capture.captured_at, receipt_id: capture.receipt_id }))
      },
      statement: "a contemporaneous capture exists for this key, taken at or before the cutoff, and it matches the saved value"
    });
  }
  return Object.assign(base, {
    mode: MODES.reconstructed,
    capture_state: captureState,
    capture_detail: detail,
    reconstruction_digest: reconstruction,
    statement:
      "reconstructed from the committed panel and not a contemporaneous capture: the value was aligned to this cutoff after the fact, so this digest identifies what was replayed and is not a retrieval receipt"
  });
}

/** Retrieve every key one model declares for one morning. */
function retrieveMorning({ date, session, contract, captures = null, allowFixtures = false } = {}) {
  if (!session) {
    return {
      version: RETRIEVAL_VERSION,
      date: date || null,
      present: false,
      keys: [],
      summary: { keys: 0, present: 0, missing: 0, contemporaneous: 0, reconstructed: 0, conflicts: 0, claim: "unavailable" },
      statement: "the morning is not in the committed panel; a missing morning is a refusal, not a value"
    };
  }
  const cutoff = session.cutoff_at_utc || null;
  const legend = Array.isArray(session.source_legend) ? session.source_legend : [];
  const meta = new Map();
  for (const entry of Array.isArray(session.input_meta) ? session.input_meta : []) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    const [key, observedAt, staleness, sourceIndex] = entry;
    meta.set(key, {
      observed_at: observedAt || null,
      staleness_business_days: Number.isFinite(staleness) ? staleness : null,
      legend: Array.isArray(legend) && Number.isInteger(sourceIndex) ? legend[sourceIndex] || null : null
    });
  }
  const values = session.saved_inputs || session.values || {};
  const dayCaptures = captures && captures.captures ? captures.captures.get(date) : null;
  const keys = keysOf(contract).map((key) => {
    const metaEntry = meta.get(key) || {};
    return assessKey({
      key,
      saved: values[key],
      observedAt: metaEntry.observed_at || null,
      staleness: metaEntry.staleness_business_days,
      legend: metaEntry.legend || null,
      cutoff,
      capture: dayCaptures ? dayCaptures.get(key) || null : null,
      allowFixtures
    });
  });
  const summary = {
    keys: keys.length,
    present: keys.filter((entry) => entry.present).length,
    missing: keys.filter((entry) => !entry.present).length,
    contemporaneous: keys.filter((entry) => entry.mode === MODES.contemporaneous).length,
    reconstructed: keys.filter((entry) => entry.mode === MODES.reconstructed).length,
    conflicts: keys.filter((entry) => entry.capture_state === CAPTURE_STATES.conflict).length,
    after_cutoff_captures: keys.filter((entry) => entry.capture_state === CAPTURE_STATES.afterCutoff).length,
    timestamped: keys.filter((entry) => entry.clock === "timestamp").length,
    date_only: keys.filter((entry) => entry.clock === "date_only").length
  };
  summary.claim = summary.keys > 0 && summary.contemporaneous === summary.keys
    ? "contemporaneous_availability_established"
    : "availability_not_established";
  return {
    version: RETRIEVAL_VERSION,
    date,
    cutoff_at_utc: cutoff,
    present: true,
    keys,
    summary,
    statement: summary.claim === "contemporaneous_availability_established"
      ? "every declared key carries a contemporaneous capture before the cutoff that matches the replayed value"
      : "at least one declared key is a reconstruction rather than a contemporaneous capture, so historical availability is not established for this morning"
  };
}

/**
 * Aggregate retrieval evidence per model over the committed panel.
 *
 * The artefact stores counts, one source declaration per key and a digest of each replayed series. It never
 * stores a receipt it did not receive: with an empty capture corpus every key is `reconstructed_panel` and
 * the availability claim is `not_established`, which is the truthful state of this checkout.
 */
function buildRetrievalArtefact({ dataset, registry, captures = null, allowFixtures = false, generatedAt = null } = {}) {
  if (!dataset || !Array.isArray(dataset.sessions)) throw new Error("retrieval needs the committed panel");
  if (!registry || !Array.isArray(registry.ENTRIES)) throw new Error("retrieval needs the model registry");
  const corpus = captures || loadCaptures({ allowFixtures });
  const sessions = dataset.sessions;
  const models = {};
  for (const entry of registry.ENTRIES) {
    const contract = entry.input_contract || {};
    const catalogue = sources.catalogueFor(entry.input_keys);
    const rows = new Map(catalogue.map((source) => [source.key, {
      key: source.key,
      source: {
        provider: source.provider,
        series: source.series,
        frequency: source.frequency,
        units: source.units,
        transform: source.transform,
        parents: source.parents,
        publication: source.publication,
        known: source.known
      },
      mornings_with_value: 0,
      mornings_missing: 0,
      clocks: { timestamp: 0, date_only: 0, none: 0 },
      retrieval: { contemporaneous: 0, reconstructed: 0, conflicts: 0, after_cutoff: 0 },
      series: []
    }]));
    let morningsWithAllKeys = 0;
    let morningsFullyContemporaneous = 0;
    for (const session of sessions) {
      const retrieval = retrieveMorning({ date: session.date, session, contract, captures: corpus, allowFixtures });
      let allPresent = true;
      for (const key of retrieval.keys) {
        const row = rows.get(key.key);
        if (!row) continue;
        if (key.present) {
          row.mornings_with_value += 1;
          row.series.push([session.date, key.value]);
        } else {
          row.mornings_missing += 1;
          allPresent = false;
        }
        row.clocks[key.clock] = (row.clocks[key.clock] || 0) + 1;
        if (key.mode === MODES.contemporaneous) row.retrieval.contemporaneous += 1;
        else if (key.mode === MODES.reconstructed) row.retrieval.reconstructed += 1;
        if (key.capture_state === CAPTURE_STATES.conflict) row.retrieval.conflicts += 1;
        if (key.capture_state === CAPTURE_STATES.afterCutoff) row.retrieval.after_cutoff += 1;
      }
      if (allPresent) morningsWithAllKeys += 1;
      if (retrieval.summary.claim === "contemporaneous_availability_established") morningsFullyContemporaneous += 1;
    }
    const keys = [...rows.values()].map((row) => ({
      key: row.key,
      source: row.source,
      mornings_with_value: row.mornings_with_value,
      mornings_missing: row.mornings_missing,
      clocks: row.clocks,
      retrieval: row.retrieval,
      series_digest: sha256(canonical(row.series)),
      series_scope: `${row.series.length} morning values, ${sessions.length} panel mornings`
    }));
    const totals = keys.reduce((acc, key) => ({
      key_values_present: acc.key_values_present + key.mornings_with_value,
      key_values_missing: acc.key_values_missing + key.mornings_missing,
      contemporaneous: acc.contemporaneous + key.retrieval.contemporaneous,
      reconstructed: acc.reconstructed + key.retrieval.reconstructed,
      conflicts: acc.conflicts + key.retrieval.conflicts
    }), { key_values_present: 0, key_values_missing: 0, contemporaneous: 0, reconstructed: 0, conflicts: 0 });
    models[entry.key] = {
      identity: entry.identity,
      label: entry.label,
      role: entry.role,
      kind: entry.kind,
      fixture: entry.kind === "fixture",
      contract_version: contract.contract_version || null,
      keys,
      totals,
      mornings: {
        panel: sessions.length,
        with_every_key_present: morningsWithAllKeys,
        fully_contemporaneous: morningsFullyContemporaneous
      },
      availability_claim: totals.conflicts > 0
        ? "conflicted"
        : (sessions.length > 0 && morningsFullyContemporaneous > 0 ? "partially_established" : "not_established"),
      statement:
        "Reconstruction is not retrieval. A key counts as contemporaneous only when a capture taken at or before the cutoff matches the replayed value and carries a receipt id."
    };
  }
  return {
    schema_version: RETRIEVAL_VERSION,
    generated_at: generatedAt || dataset.generated_at || null,
    dataset: {
      path: "data/usd-layer1-backtester/run-v1.json",
      run_version: dataset.run && dataset.run.run_version ? dataset.run.run_version : null,
      generated_at: dataset.generated_at || null,
      sessions: sessions.length
    },
    inventory: {
      path: sources.INVENTORY_PATH,
      provenance_path: sources.PROVENANCE_PATH,
      outcome_series: sources.outcomeSeries()
    },
    capture_corpus: {
      directory: "data/usd-layer1-backtester/captures",
      files: corpus.files,
      entries: corpus.usable,
      fixtures_ignored: corpus.fixtures,
      rejected: corpus.rejected,
      schema: CAPTURE_SCHEMA,
      note:
        "a capture is only evidence when it was taken at or before the cutoff and carries a receipt id; fixture captures are ignored by this artefact"
    },
    models,
    statement:
      "Every value in this artefact is a reconstruction from the committed panel unless its receipt is non-null. No receipt is generated here, and an empty capture corpus is reported as an empty corpus."
  };
}

module.exports = {
  RETRIEVAL_VERSION,
  CAPTURE_SCHEMA,
  CAPTURE_DIR,
  MODES,
  CAPTURE_STATES,
  loadCaptures,
  retrieveMorning,
  buildRetrievalArtefact,
  assessKey,
  keysOf
};
