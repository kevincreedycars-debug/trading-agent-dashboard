#!/usr/bin/env node
"use strict";

// Save a copy of every hosted research document, and the metadata that describes it, to a local
// folder. Nothing is uploaded, moved or deleted: this reads the private store and writes files here.
//
//   node scripts/research_library_export.js
//   node scripts/research_library_export.js --out .local/research-library-export
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. The service key is used to read
// the private bucket; it is never printed and never written to the exported folder. Each exported file
// is re-hashed and compared with the sha256 the row recorded, so a damaged or substituted copy fails
// the run rather than sitting quietly beside a good manifest.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_OUT = path.join(".local", "research-library-export");

// A topic id, a stage number and a version become a folder path. Anything outside the characters the
// store itself allows is replaced, and a value that could climb out of the export folder is refused
// rather than sanitised, so an unexpected row cannot write somewhere else.
function safeSegment(value, label) {
  const text = String(value === null || value === undefined ? "" : value).trim();
  if (!text || text === "." || text === "..") throw new Error(`${label} is missing or unusable`);
  if (/[\\/:*?"<>|]/.test(text) || text.includes("..")) throw new Error(`${label} contains a path character: ${text}`);
  if (!/^[A-Za-z0-9._-]+$/.test(text)) return text.replace(/[^A-Za-z0-9._-]/g, "_");
  return text;
}

// documents/<topic>/<stage>/v<version>-<sha256>.md — the same shape the bucket uses, so a copy on disk
// can be matched to a storage path by eye as well as by hash.
function documentRelativePath(row) {
  const topic = safeSegment(row && row.topic_id, "topic_id");
  const stage = Number(row && row.stage);
  if (![1, 2, 3].includes(stage)) throw new Error(`stage is not 1, 2 or 3: ${row && row.stage}`);
  const version = Number(row && row.version);
  if (!Number.isInteger(version) || version < 1) throw new Error(`version is not a positive integer: ${row && row.version}`);
  const sha = safeSegment(row && row.sha256, "sha256").toLowerCase();
  const name = String((row && row.original_filename) || "").trim();
  const extension = /\.[A-Za-z0-9]{1,8}$/.test(name) ? String(name.match(/\.[A-Za-z0-9]{1,8}$/)[0]) : ".md";
  return path.posix.join("documents", topic, String(stage), `v${version}-${sha}${extension}`);
}

// The manifest entry is the row plus what this export did with it. `verified` is only true when the
// bytes on disk hash to the sha256 the row recorded.
function manifestEntry(row, relativePath, computedSha256) {
  return {
    id: String(row.id || ""),
    topic_id: String(row.topic_id || ""),
    stage: Number(row.stage),
    version: Number(row.version),
    title: String(row.title || ""),
    kind: String(row.kind || ""),
    original_filename: String(row.original_filename || ""),
    sha256: String(row.sha256 || ""),
    bytes: Number(row.bytes),
    storage_path: String(row.storage_path || ""),
    parent_research_id: row.parent_research_id || null,
    parent_research_ref: String(row.parent_research_ref || ""),
    parent_red_team_id: row.parent_red_team_id || null,
    parent_red_team_ref: String(row.parent_red_team_ref || ""),
    uploaded_by: String(row.uploaded_by || ""),
    uploaded_at: String(row.uploaded_at || ""),
    notes: String(row.notes || ""),
    file: relativePath,
    computed_sha256: computedSha256 || "",
    verified: Boolean(computedSha256) && computedSha256 === String(row.sha256 || "").toLowerCase()
  };
}

function summarise(documents) {
  const total = documents.length;
  const verified = documents.filter(entry => entry.verified).length;
  return {
    documents: total,
    verified,
    failed: total - verified,
    bytes: documents.reduce((sum, entry) => sum + (Number(entry.bytes) || 0), 0)
  };
}

async function main() {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = path.resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : DEFAULT_OUT);

  const listed = await fetch(`${base}/rest/v1/research_documents?select=*&order=topic_id.asc,stage.asc,version.asc`, { headers });
  if (!listed.ok) throw new Error(`the document table could not be read (${listed.status})`);
  const rows = await listed.json();
  if (!Array.isArray(rows)) throw new Error("the document table answered with something other than rows");

  fs.mkdirSync(outDir, { recursive: true });
  const documents = [];
  for (const row of rows) {
    const relativePath = documentRelativePath(row);
    const target = path.join(outDir, ...relativePath.split("/"));
    let computedSha256 = "";
    if (row.storage_path) {
      const object = await fetch(`${base}/storage/v1/object/authenticated/research-documents/${row.storage_path}`, { headers });
      if (object.ok) {
        const buffer = Buffer.from(await object.arrayBuffer());
        computedSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, buffer);
      }
    }
    documents.push(manifestEntry(row, relativePath, computedSha256));
  }

  const totals = summarise(documents);
  const manifest = {
    schema_version: "research-library-export-v1",
    exported_at: new Date().toISOString(),
    project: base,
    exported_by: "scripts/research_library_export.js",
    note: "Read-only copy of the private hosted store. The manifest records what the store recorded; a file whose computed_sha256 differs is marked unverified.",
    totals,
    documents
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`exported ${totals.documents} document${totals.documents === 1 ? "" : "s"} to ${outDir}`);
  console.log(`verified ${totals.verified} of ${totals.documents} against the recorded sha256, ${totals.bytes} bytes in total`);
  for (const entry of documents.filter(item => !item.verified)) {
    console.log(`UNVERIFIED ${entry.id} ${entry.topic_id} stage ${entry.stage} v${entry.version} - ${entry.file}`);
  }
  if (totals.failed) {
    console.log("a document was not exported with the bytes its row recorded, so the copy is incomplete");
    process.exitCode = 1;
  }
}

module.exports = { safeSegment, documentRelativePath, manifestEntry, summarise, main };

if (require.main === module) {
  main().catch(error => {
    console.error(`EXPORT FAILED: ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  });
}
