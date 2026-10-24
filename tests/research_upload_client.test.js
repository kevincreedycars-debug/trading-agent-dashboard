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
    message: "Sign in with your email and password, or with the email link, before uploading or opening a research document."
  });
  assert.match(result.message, /^[A-Z].*[.!?]$/);
  assert.doesNotMatch(result.message, /\b(401|403)\b/);
});

test("a password sign-in stores the returned session and reports a refusal in plain words", async () => {
  const calls = [];
  const stored = new Map();
  const storage = {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key)
  };
  configure(async (url, init) => {
    calls.push({ url: String(url), body: init && init.body });
    const payload = init && init.body ? JSON.parse(init.body) : {};
    if (payload.password === "the-right-one") {
      return jsonResponse(200, {
        access_token: "header.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEifQ.signature",
        refresh_token: "refresh-value",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: "00000000-0000-4000-8000-000000000001" }
      });
    }
    return jsonResponse(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
  }, storage);

  const refused = await ResearchUpload.signInWithPassword("owner@example.com", "wrong");
  assert.equal(refused.ok, false);
  assert.match(refused.message, /not accepted/);
  assert.equal(ResearchUpload.session(), null);

  const accepted = await ResearchUpload.signInWithPassword("owner@example.com", "the-right-one");
  assert.equal(accepted.ok, true);
  assert.match(accepted.message, /Signed in/);
  const session = ResearchUpload.session();
  assert.equal(session.user_id, "00000000-0000-4000-8000-000000000001");
  assert.equal(calls[0].url, "https://example.supabase.co/auth/v1/token?grant_type=password");
  assert.equal(JSON.parse(calls[0].body).email, "owner@example.com");
  assert.ok([...stored.values()].some(value => String(value).includes("refresh-value")), "the session is kept in this browser only");

  const missing = await ResearchUpload.signInWithPassword("owner@example.com", "");
  assert.equal(missing.ok, false);
  assert.match(missing.message, /Enter the password/);
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
    model: "",
    note: "first return",
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
      original_filename: "",
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

test("an expired stored session is refreshed before the request, so a reopened page keeps working", async () => {
  const calls = [];
  const stored = new Map([["sb-example-auth-token", JSON.stringify({
    access_token: "stale-token",
    refresh_token: "refresh-value",
    expires_at: Math.floor(Date.now() / 1000) - 120,
    user_id: "00000000-0000-4000-8000-000000000001"
  })]]);
  const storage = {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key)
  };
  configure(async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers || {}, body: options.body });
    if (String(url).includes("grant_type=refresh_token")) {
      return jsonResponse(200, {
        access_token: "fresh-token",
        refresh_token: "refresh-value-2",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: "00000000-0000-4000-8000-000000000001" }
      });
    }
    return jsonResponse(200, []);
  }, storage);

  const listed = await ResearchUpload.listByTopic("usd-vix");
  assert.equal(listed.ok, true);
  assert.equal(calls[0].url, "https://example.supabase.co/auth/v1/token?grant_type=refresh_token");
  assert.equal(JSON.parse(calls[0].body).refresh_token, "refresh-value");
  assert.equal(calls[1].headers.Authorization, "Bearer fresh-token", "the stored token is swapped before the read");
  assert.match(stored.get("sb-example-auth-token"), /fresh-token/, "the refreshed session replaces the expired one");
});

test("an expired refresh token clears the session instead of pretending to be signed in", async () => {
  const stored = new Map([["sb-example-auth-token", JSON.stringify({
    access_token: "stale-token",
    refresh_token: "revoked-refresh",
    expires_at: Math.floor(Date.now() / 1000) - 120,
    user_id: "00000000-0000-4000-8000-000000000001"
  })]]);
  const storage = {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key)
  };
  configure(async url => {
    if (String(url).includes("grant_type=refresh_token")) return jsonResponse(400, { error: "invalid_grant" });
    return jsonResponse(200, []);
  }, storage);

  const listed = await ResearchUpload.listByTopic("usd-vix");
  assert.equal(listed.ok, false);
  assert.match(listed.message, /Sign in with your email/);
  assert.equal(ResearchUpload.session(), null, "a revoked refresh token signs the page out");
});

test("a file whose object already sits in the bucket is registered rather than refused", async () => {
  const calls = [];
  configure(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    if (String(url).includes("/rest/v1/research_documents?") && (!options.method || options.method === "GET")) return jsonResponse(200, []);
    if (String(url).includes("/storage/v1/object/research-documents/")) {
      return jsonResponse(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    }
    if (String(url).endsWith("/rest/v1/research_documents") && options.method === "POST") return jsonResponse(201, [{ id: "saved" }]);
    return jsonResponse(500, {});
  });

  const result = await ResearchUpload.upload({
    topicId: "usd-vix",
    stage: 1,
    title: "VIX report",
    kind: "report",
    file: { type: "text/markdown", arrayBuffer: async () => new TextEncoder().encode("already there").buffer }
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.row.id, "saved");
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
