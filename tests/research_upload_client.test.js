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

// A final-chain return judges a package of factor documents. The hosted table has no column for that
// package, so it travels in the notes column behind a marker and comes back with the document, which is
// what lets a final stage be checked against the evidence it actually received.
test("a final-chain return stores its input package and reads it back with the document", async () => {
  const calls = [];
  configure(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if (String(url).includes("/rest/v1/research_documents?") && (!options.method || options.method === "GET")) return jsonResponse(200, []);
    if (String(url).includes("/storage/v1/object/research-documents/")) return jsonResponse(200, { Key: "stored" });
    if (String(url).endsWith("/rest/v1/research_documents") && options.method === "POST") {
      const payload = JSON.parse(options.body);
      return jsonResponse(201, [Object.assign({}, payload, {
        id: "22222222-2222-4222-8222-222222222222",
        parent_research_id: payload.parent_research_ref || null,
        parent_red_team_id: payload.parent_red_team_ref || null,
        uploaded_at: "2026-10-24T09:00:00Z"
      })]);
    }
    return jsonResponse(500, {});
  });

  const packageDocuments = [
    { document_id: "usd-01-adjudication", version: 2, sha256: "c".repeat(64), role: "vix-level", role_stage: "adjudication" },
    { document_id: "usd-02-adjudication", version: 1, sha256: "d".repeat(64), role: "front-end-rates", role_stage: "adjudication" }
  ];
  const result = await ResearchUpload.upload({
    topicId: "usd-chain-final",
    stage: 1,
    title: "USD final analysis",
    kind: "final_analysis",
    notes: "read against the 24 October registry",
    inputPackage: { documents: packageDocuments, recorded_at: "2026-10-24T08:59:00.000Z" },
    file: { type: "text/markdown", arrayBuffer: async () => new TextEncoder().encode("# Final analysis\n").buffer }
  });
  assert.equal(result.ok, true, result.message);

  const inserted = JSON.parse(calls.find(call => call.method === "POST" && call.url.endsWith("/rest/v1/research_documents")).body);
  assert.match(inserted.notes, /^read against the 24 October registry\nresearch-input-package:v1 \{/);
  assert.equal(inserted.kind, "final_analysis", "the final stage name is kept in the free-text kind column");

  const [document] = ResearchUpload.rowsToDocuments([result.row]);
  assert.equal(document.note, "read against the 24 October registry", "the reader's note reads back without the marker line");
  assert.equal(document.stage, "final_analysis");
  assert.deepEqual(document.input_documents, packageDocuments);
  assert.deepEqual(document.input_package.documents, packageDocuments);
  assert.equal(document.input_package.recorded_at, "2026-10-24T08:59:00.000Z");
  assert.equal(document.input_package.stage, "final_analysis");
});

test("a later version without an input package does not inherit the earlier package", () => {
  const base = {
    topic_id: "usd-chain-final",
    stage: 1,
    title: "USD final analysis",
    kind: "final_analysis",
    parent_research_id: null,
    parent_red_team_id: null,
    bytes: 12,
    original_filename: "final-analysis.md"
  };
  const rows = [
    Object.assign({}, base, {
      id: "v1",
      version: 1,
      sha256: "e".repeat(64),
      storage_path: "usd-chain-final/1/v1.md",
      uploaded_at: "2026-10-24T08:00:00Z",
      notes: `first return\nresearch-input-package:v1 ${JSON.stringify({ chain_id: "usd-chain-final", stage: "final_analysis", recorded_at: "2026-10-24T07:59:00.000Z", documents: [{ document_id: "usd-01-adjudication", version: 2, sha256: "c".repeat(64), role: "vix-level", role_stage: "adjudication" }] })}`
    }),
    Object.assign({}, base, {
      id: "v2",
      version: 2,
      sha256: "f".repeat(64),
      storage_path: "usd-chain-final/1/v2.md",
      uploaded_at: "2026-10-24T10:00:00Z",
      notes: "corrected return"
    })
  ];
  const [document] = ResearchUpload.rowsToDocuments(rows);
  assert.equal(document.note, "corrected return");
  assert.equal(document.input_documents, undefined, "the current version records no package, so the document has none");
  assert.equal(document.versions[0].input_documents.length, 1, "the package the first version recorded is still on that version");
  assert.equal(document.versions[1].input_documents, undefined);
});

test("every stored row is read in one request and a refusal is reported in plain words", async () => {
  const calls = [];
  configure(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    return jsonResponse(200, []);
  });
  const listed = await ResearchUpload.listAll();
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.rows, []);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/v1\/research_documents\?order=topic_id\.asc,stage\.asc,version\.asc&limit=1000$/);

  configure(async () => jsonResponse(403, { message: "forbidden" }));
  const refused = await ResearchUpload.listAll();
  assert.equal(refused.ok, false);
  assert.match(refused.message, /could not be loaded/);
  assert.doesNotMatch(refused.message, /403/);
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
test("GitHub sign-in sends the browser to the project's own OAuth endpoint", async () => {
  configure(async () => jsonResponse(500, {}), {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  });
  const visited = [];
  const result = await ResearchUpload.signInWithGitHub({
    redirectTo: "https://example.github.io/trading-agent-dashboard/",
    redirect: url => visited.push(url)
  });

  assert.equal(result.ok, true);
  assert.equal(visited.length, 1, "the browser is sent once");
  const url = new URL(visited[0]);
  assert.equal(`${url.origin}${url.pathname}`, "https://example.supabase.co/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "github");
  assert.equal(url.searchParams.get("redirect_to"), "https://example.github.io/trading-agent-dashboard/");
  assert.doesNotMatch(visited[0], /secret|service_role|sb_secret/i, "no secret travels in the sign-in URL");
  assert.match(result.message, /GitHub/);
});

test("when GitHub is not turned on the page says so and does not leave the reader on a raw error", async () => {
  const calls = [];
  configure(async url => {
    calls.push(String(url));
    if (String(url).includes("/auth/v1/settings")) {
      return jsonResponse(200, { external: { email: true, github: false }, mailer_autoconfirm: false });
    }
    return jsonResponse(500, {});
  }, {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  });
  const visited = [];
  const result = await ResearchUpload.signInWithGitHub({ redirect: url => visited.push(url) });

  assert.equal(result.ok, false);
  assert.equal(visited.length, 0, "the browser is not sent to an endpoint that would refuse it");
  assert.match(result.message, /not turned on for this library yet/);
  assert.match(result.message, /email and password/, "the working route is named");
  assert.equal(calls.filter(url => url.endsWith("/auth/v1/settings")).length, 1);
  assert.equal(ResearchUpload.authError(), result.message);
});

test("the page's own address is the default place GitHub sends the reader back to", async () => {
  configure(async () => jsonResponse(500, {}), {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  });
  const previousLocation = globalThis.location;
  globalThis.location = {
    href: "https://example.github.io/trading-agent-dashboard/#/research-library",
    hash: "",
    pathname: "/trading-agent-dashboard/",
    search: ""
  };
  try {
    const target = ResearchUpload.authorizeUrl();
    assert.equal(new URL(target).searchParams.get("redirect_to"), "https://example.github.io/trading-agent-dashboard/");
  } finally {
    globalThis.location = previousLocation;
  }
});

test("a provider sign-in that comes back refused is reported in plain words", () => {
  const previousLocation = globalThis.location;
  const previousHistory = globalThis.history;
  const replaced = [];
  globalThis.location = {
    hash: "#error=access_denied&error_description=Unsupported+provider%3A+provider+is+not+enabled",
    pathname: "/trading-agent-dashboard/",
    search: "",
    href: "https://example.github.io/trading-agent-dashboard/#error=access_denied"
  };
  globalThis.history = { replaceState: (...args) => replaced.push(args.slice(0, 2)) };
  try {
    configure(async () => jsonResponse(500, {}), {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    });
    assert.match(ResearchUpload.authError(), /not turned on for this library yet/);
    assert.equal(ResearchUpload.session(), null, "no session is invented from a refusal");
    assert.equal(replaced.length, 1, "the error fragment is taken out of the address bar");
  } finally {
    globalThis.location = previousLocation;
    globalThis.history = previousHistory;
  }
});

