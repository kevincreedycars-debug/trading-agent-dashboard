#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "script.js"), "utf8");
const urlMatch = source.match(/const researchSupabaseUrl = "([^"]+)\/rest\/v1";/);
const keyMatch = source.match(/const researchSupabaseKey = "([^"]+)";/);
if (!urlMatch || !keyMatch) {
  console.error("configuration: FAIL - the dashboard publishable configuration could not be read");
  process.exit(1);
}

const url = urlMatch[1];
const key = keyMatch[1];
const headers = { apikey: key };
let failed = false;

function report(label, passed, detail) {
  console.log(`${label}: ${passed ? "PASS" : "FAIL"}${detail ? ` - ${detail}` : ""}`);
  if (!passed) failed = true;
}

async function responseJson(response) {
  try { return await response.json(); } catch (_) { return null; }
}

async function main() {
  let status;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/research_upload_backend_status`, { method: "POST", headers });
    status = response.ok ? await responseJson(response) : null;
  } catch (_) {
    status = null;
  }
  const row = Array.isArray(status) ? status[0] : status;
  report("bucket exists", Boolean(row && row.bucket_exists), row ? "" : "backend status is unavailable");
  report("bucket is private", Boolean(row && row.bucket_private), row ? "" : "backend status is unavailable");
  report("table exists", Boolean(row && row.table_exists), row ? "" : "backend status is unavailable");

  let insertRefused = false;
  try {
    const response = await fetch(`${url}/rest/v1/research_documents`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({})
    });
    insertRefused = [401, 403].includes(response.status);
  } catch (_) {}
  report("anonymous insert is refused", insertRefused, insertRefused ? "" : "anonymous request was not explicitly refused");

  let readRefused = false;
  try {
    const response = await fetch(`${url}/storage/v1/object/research-documents/verification/no-object.md`, { headers });
    readRefused = !response.ok;
  } catch (_) {}
  report("anonymous read is refused", readRefused, readRefused ? "" : "anonymous request unexpectedly succeeded");

  if (failed) process.exitCode = 1;
}

main().catch(() => {
  console.error("verification: FAIL - Supabase could not be reached");
  process.exitCode = 1;
});
