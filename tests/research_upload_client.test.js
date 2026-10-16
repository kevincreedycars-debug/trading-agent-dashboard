"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const ResearchUpload = require("../lib/research_upload_client.js");

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === "content-type" ? "application/json" : null },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function signedInStorage() {
  const values = new Map([["sb-example-auth-token", JSON.stringify({
    access_token: "test-session-token",
    user: { id: "00000000-0000-4000-8000-000000000001" }
  })]]);
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

function configure(fetchImpl, storage = signedInStorage()) {
  const result = ResearchUpload.configure({
    url: "https://example.supabase.co",
    key: "publishable-test-value",
    fetch: fetchImpl,
    storage
  });
  assert.equal(result.ok, true);
}

test("sha256 of a known buffer is stable", async () => {
  const digest = await ResearchUpload.sha256Hex(new TextEncoder().encode("abc"));
  assert.equal(digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("storage path naming is exact", () => {
  assert.equal(
    ResearchUpload.storagePath("usd-vix", 2, 7, "a".repeat(64)),
    `usd-vix/2/v7-${"a".repeat(64)}.md`
  );
});

test("a refused anonymous write surfaces a plain message", async () => {
  configure(async () => jsonResponse(500, {}), {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  });
  const result = await ResearchUpload.upload({
    topicId: "usd-vix",
    stage: 1,
    title: "VIX report",
    kind: "report",
    file: { arrayBuffer: async () => new TextEncoder().encode("body").buffer }
  });
  assert.deepEqual(result, {
    ok: false,
    message: "Sign in with your email link before uploading or opening a research document."
  });
  assert.match(result.message, /^[A-Z].*[.!?]$/);
  assert.doesNotMatch(result.message, /\b(401|403)\b/);
});

test("row-to-document mapping matches the research library shape", () => {
  const rows = [{
    id: "11111111-1111-4111-8111-111111111111",
    topic_id: "usd-vix",
    stage: 1,
    version: 1,
    title: "VIX report",
    kind: "report",
    parent_research_id: null,
    parent_red_team_id: null,
    sha256: "b".repeat(64),
    bytes: 12,
    storage_path: `usd-vix/1/v1-${"b".repeat(64)}.md`,
    uploaded_at: "2026-10-16T12:00:00Z",
    notes: "first return"
  }];
  assert.deepEqual(ResearchUpload.rowsToDocuments(rows), [{
    document_id: "11111111-1111-4111-8111-111111111111",
    topic_id: "usd-vix",
    stage: "research",
    document_type: "report",
    title: "VIX report",
    origin: "external_upload",
    storage: "library_object",
    public_download: false,
    object_sha256: "b".repeat(64),
    parent_document_id: "",
    parent_version: null,
    versions: [{
      version: 1,
      sha256: "b".repeat(64),
      bytes: 12,
      registered_at: "2026-10-16T12:00:00Z",
      storage_path: `usd-vix/1/v1-${"b".repeat(64)}.md`,
      note: "first return"
    }],
    asset: "",
    version_count: 1,
    latest_version: 1,
    latest_sha256: "b".repeat(64),
    latest_bytes: 12,
    latest_registered_at: "2026-10-16T12:00:00Z"
  }]);
});

test("retry reuses the same storage path without uploading twice", async () => {
  const calls = [];
  let inserts = 0;
  configure(async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET", body: options.body });
    if (url.includes("/rest/v1/research_documents?") && (!options.method || options.method === "GET")) return jsonResponse(200, []);
    if (url.includes("/storage/v1/object/research-documents/")) return jsonResponse(200, { Key: "stored" });
    if (url.endsWith("/rest/v1/research_documents") && options.method === "POST") {
      inserts += 1;
      return inserts === 1 ? jsonResponse(409, { message: "temporary conflict" }) : jsonResponse(201, [{ id: "saved" }]);
    }
    return jsonResponse(500, {});
  });

  const result = await ResearchUpload.upload({
    topicId: "usd-vix",
    stage: 1,
    title: "VIX report",
    kind: "report",
    file: { type: "text/markdown", arrayBuffer: async () => new TextEncoder().encode("same bytes").buffer }
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /file is stored/i);
  assert.equal(typeof result.retry, "function");
  const retried = await result.retry();
  assert.equal(retried.ok, true);
  assert.equal(retried.storagePath, result.storagePath);
  assert.equal(calls.filter(call => call.url.includes("/storage/v1/object/research-documents/")).length, 1);
  const insertedPaths = calls
    .filter(call => call.url.endsWith("/rest/v1/research_documents") && call.method === "POST")
    .map(call => JSON.parse(call.body).storage_path);
  assert.deepEqual(insertedPaths, [result.storagePath, result.storagePath]);
});
