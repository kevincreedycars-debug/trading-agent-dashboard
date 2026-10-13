"use strict";

// Research Library guards: the catalogue, the registry, the store and the local service.
//
// These tests hold the boundary the brief asks for: a manual task and never a model API call, an upload that
// is not an approval, a review that is not a backtest, immutable versions that can be re-downloaded
// byte-for-byte, and a service that refuses an unauthenticated or malformed request.

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ResearchLibrary = require("../lib/research_library.js");
const { createStore } = require("../lib/research_library_store.js");
const { createServiceServer } = require("../scripts/research-library-server.js");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "data", "research-library", "catalog.json");
const registryPath = path.join(root, "data", "research-library", "documents.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const catalog = readJson(catalogPath);
const registry = readJson(registryPath);

function tempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rl-${label}-`));
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

test("the committed catalogue validates and carries eight assets with USD first", () => {
  assert.deepEqual(ResearchLibrary.validateCatalog(catalog), []);
  const assets = ResearchLibrary.listAssets(catalog);
  assert.equal(assets.length, 8);
  assert.deepEqual(assets.map(entry => entry.asset), ResearchLibrary.ASSET_ORDER.slice());
  assert.equal(assets[0].asset, "USD");
  assert.ok(assets[0].factors.length >= 25);
});

test("every non-USD asset says it has not started and refuses to inherit a USD result", () => {
  ResearchLibrary.listAssets(catalog).slice(1).forEach(asset => {
    assert.equal(asset.status, "not_started");
    assert.equal(asset.factors.length, 0);
    assert.ok(asset.standfirst, `${asset.asset} needs a standfirst`);
    assert.ok(asset.note, `${asset.asset} needs an isolation note`);
  });
});

test("a task is self-contained: id, objective, excerpts, data, prompt and output schema", () => {
  ["USD-SESSION-A1", "USD-SESSION-A2", "USD-SESSION-A3", "USD-SESSION-A4", "USD-SESSION-A5"].forEach(taskId => {
    const task = ResearchLibrary.taskById(catalog, taskId);
    assert.ok(task, `${taskId} must exist`);
    assert.ok(task.session_objective.length > 40, `${taskId} needs the session objective`);
    assert.ok(task.implementation_excerpt.includes("F1 10"), `${taskId} needs the implementation excerpt`);
    assert.ok(task.rulebook_excerpt.includes("10, 14, 16, 14, 6, 5, 3, 18, 12, 2"), `${taskId} needs the rulebook weights`);
    assert.ok(task.data_information.length >= 5, `${taskId} needs the data availability lines`);
    assert.ok(task.prompt.includes(taskId), `${taskId} prompt must name the task`);
    assert.ok(task.prompt.includes("05:00 Europe/London"), `${taskId} prompt must state the cutoff`);
    assert.ok(task.prompt.includes("research-card.schema.json"), `${taskId} prompt must name the output schema`);
    assert.ok(task.context_version, `${taskId} needs a context version`);
    assert.ok(task.deliverable.format.length > 20, `${taskId} needs a deliverable contract`);
  });
});

test("no task asks for a model call and no prompt names a model host", () => {
  const serialized = JSON.stringify(catalog);
  ["openai.com", "anthropic.com", "api.openai", "generativelanguage", "claude.ai"].forEach(host => {
    assert.equal(serialized.toLowerCase().includes(host), false, `the catalogue must not name ${host}`);
  });
  assert.equal(ResearchLibrary.MANUAL_TASK_ONLY, true);
  assert.equal(ResearchLibrary.FRONTIER_API_CALLS, false);
  assert.equal(ResearchLibrary.UPLOAD_IS_APPROVAL, false);
  assert.deepEqual(ResearchLibrary.RESEARCH_STATUSES.slice(), ["not_started", "ready", "in_progress", "uploaded", "blocked"]);
  assert.deepEqual(ResearchLibrary.REVIEW_STATUSES.slice(), ["pending", "changes_requested", "accepted"]);
  assert.deepEqual(ResearchLibrary.BACKTEST_STATUSES.slice(), ["not_tested", "queued", "tested"]);
  // The only destinations the shared helper may use: this checkout, and loopback.
  ResearchLibrary.NETWORK_ALLOWLIST.forEach(entry => {
    assert.ok(entry.startsWith("same-origin:") || entry.startsWith("local-service:"), entry);
  });
  assert.equal(ResearchLibrary.DEFAULT_SERVICE_ENDPOINT.startsWith("http://127.0.0.1:"), true);
});

test("the context package carries the task, the factors it covers and a stable fingerprint", () => {
  const contextPackage = ResearchLibrary.buildContextPackage(catalog, "USD-SESSION-A1");
  assert.equal(contextPackage.task_id, "USD-SESSION-A1");
  assert.equal(contextPackage.covers.length, 7);
  assert.equal(contextPackage.covered_factors.length, 7);
  assert.equal(contextPackage.covered_factors[0].factor_id, "fx.usd-session-momentum");
  assert.ok(contextPackage.implementation_excerpt.length > 100);
  assert.ok(contextPackage.rulebook_excerpt.includes("cites no"));
  assert.ok(contextPackage.required_output_schema.required_fields.length >= 10);
  assert.equal(contextPackage.research_action.frontier_api_calls, false);
  assert.equal(contextPackage.research_action.manual_task_only, true);
  assert.equal(
    ResearchLibrary.buildContextPackage(catalog, "USD-SESSION-A1").context_fingerprint,
    contextPackage.context_fingerprint
  );
  assert.notEqual(
    ResearchLibrary.buildContextPackage(catalog, "USD-SESSION-A2").context_fingerprint,
    contextPackage.context_fingerprint
  );
  assert.equal(ResearchLibrary.buildContextPackage(catalog, "USD-SESSION-Z9"), null);
});

test("coverage is computed: A1 and A2 cover fifteen cards, the ten live factors are uncovered", () => {
  const coverage = ResearchLibrary.factorCoverage(catalog);
  const a1 = coverage.tasks.find(task => task.task_id === "USD-SESSION-A1");
  const a2 = coverage.tasks.find(task => task.task_id === "USD-SESSION-A2");
  assert.equal(a1.covers.length, 7);
  assert.equal(a2.covers.length, 8);
  assert.equal(coverage.covered.length, 15);
  assert.equal(coverage.uncovered.length, 10);
  assert.ok(coverage.uncovered.every(entry => entry.factor_id.startsWith("live.")));
  assert.ok(a1.gaps.length >= 1 && a2.gaps.length >= 1);
});

test("progress counts keep research, review and backtest apart", () => {
  const counts = ResearchLibrary.progressCounts(ResearchLibrary.listFactors(catalog));
  assert.equal(counts.total, 25);
  assert.equal(counts.research.blocked, 3);
  assert.equal(counts.research.ready, 22);
  assert.equal(counts.review.pending, 25);
  assert.equal(counts.review.accepted, 0);
  assert.equal(counts.backtest.tested, 0);
});

test("the validator refuses a dishonest status combination", () => {
  const broken = JSON.parse(JSON.stringify(catalog));
  const factor = broken.assets[0].factors.find(entry => entry.factor_id === "fx.usd-session-momentum");
  factor.research_status = "ready";
  factor.review_status = "accepted";
  const problems = ResearchLibrary.validateCatalog(broken);
  assert.ok(problems.some(problem => problem.includes("review-accepted without an uploaded report")), problems.join("; "));

  const second = JSON.parse(JSON.stringify(catalog));
  const secondFactor = second.assets[0].factors.find(entry => entry.factor_id === "fx.usd-session-momentum");
  secondFactor.blockers = ["something is missing"];
  secondFactor.research_status = "ready";
  assert.ok(ResearchLibrary.validateCatalog(second).some(problem => problem.includes("not in the blocked research status")));

  const third = JSON.parse(JSON.stringify(catalog));
  third.tasks[0].prompt = "";
  assert.ok(ResearchLibrary.validateCatalog(third).some(problem => problem.includes("has no prompt")));

  const fourth = JSON.parse(JSON.stringify(catalog));
  fourth.assets[0].factors = [...fourth.assets[0].factors, { factor_id: "live.f1-vix-level" }];
  assert.ok(ResearchLibrary.validateCatalog(fourth).some(problem => problem.includes("duplicate factor_id")));

  const fifth = JSON.parse(JSON.stringify(catalog));
  fifth.scope_note = "token sk-abcdefghijklmnopqrstuvwx is in here";
  assert.ok(ResearchLibrary.validateCatalog(fifth).some(problem => problem.includes("key-shaped")));
});

test("a review written before a newer report is flagged for reassessment", () => {
  const factorId = "fx.usd-session-momentum";
  const documents = { documents: [
    { document_id: "report-v2", asset: "USD", factor_id: factorId, document_type: "report", storage: "library_object", object_sha256: "a".repeat(64), versions: [{ version: 2, sha256: "a".repeat(64), registered_at: "2026-11-02" }] },
    { document_id: "review-old", asset: "USD", factor_id: factorId, document_type: "review", storage: "library_object", object_sha256: "b".repeat(64), covers: [factorId], versions: [{ version: 1, sha256: "b".repeat(64), registered_at: "2026-11-01" }] },
    { document_id: "review-new", asset: "USD", factor_id: factorId, document_type: "review", storage: "library_object", object_sha256: "c".repeat(64), covers: [factorId], versions: [{ version: 1, sha256: "c".repeat(64), registered_at: "2026-11-03" }] }
  ] };
  const freshness = ResearchLibrary.deriveReviewFreshness(catalog, documents);
  assert.equal(freshness[factorId].needs_reassessment, true);
  assert.deepEqual(freshness[factorId].dependent_document_ids, ["review-old"]);
  assert.equal(freshness["fx.usd-overnight-range-position"], undefined);
});

test("the committed registry validates and every repo-backed hash matches the file", () => {
  assert.deepEqual(ResearchLibrary.validateDocuments(registry, catalog), []);
  const repoDocuments = registry.documents.filter(entry => entry.storage === "repo_path");
  assert.equal(repoDocuments.length, 15);
  repoDocuments.forEach(document => {
    const abs = path.join(root, document.repo_path);
    assert.ok(fs.existsSync(abs), `${document.document_id} is missing on disk`);
    const latest = ResearchLibrary.latestVersion(document);
    assert.equal(latest.sha256, sha256(fs.readFileSync(abs)), `${document.document_id} hash drifted`);
    assert.ok(latest.bytes > 0);
  });
  assert.equal(registry.documents.filter(entry => entry.storage === "library_object").length, 0);
  assert.equal(registry.storage_contract.public_upload, false);
  assert.equal(registry.storage_contract.public_download, false);
});

test("the closed 24-hour study's report is referenced, not hashed, and says why", () => {
  const engineDocument = catalog.engine_documents.find(entry => entry.document_id === "usd-24h-study-results");
  assert.ok(engineDocument.hash_note.includes("uncommitted edits"));
  assert.equal(registry.documents.some(entry => entry.repo_path === engineDocument.repo_path), false);
});

test("the builder's own checks pass on the committed files", () => {
  [["catalog", "--check"], ["registry", "--check"]].forEach(args => {
    const result = spawnSync(process.execPath, ["scripts/build_research_library.js", ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, `${args.join(" ")} failed: ${result.stdout}${result.stderr}`);
  });
  const verify = spawnSync(process.execPath, ["scripts/build_research_library.js", "verify"], { cwd: root, encoding: "utf8" });
  assert.equal(verify.status, 0, `verify failed: ${verify.stdout}${verify.stderr}`);
});

test("the store keeps immutable versions, dedupes identical bytes and survives a restart", () => {
  const dir = tempDir("store");
  const libraryRoot = path.join(dir, "library");
  const registryFile = path.join(dir, "documents.json");
  const store = createStore({ root: libraryRoot, registryPath: registryFile, now: () => new Date("2026-10-13T00:00:00Z") });

  const upload = content_text => store.registerUpload({
    document_id: "usd-session-a1-return",
    asset: "USD",
    task_id: "USD-SESSION-A1",
    document_type: "report",
    title: "A1 return",
    model: "ChatGPT (test)",
    original_filename: "a1.json",
    content_text
  }, catalog);

  const first = upload("{\"cards\":[]}");
  assert.equal(first.duplicate, false);
  assert.equal(first.version, 1);
  assert.equal(upload("{\"cards\":[]}").duplicate, true);
  assert.equal(upload("{\"cards\":[]}").version, 1);
  const second = upload("{\"cards\":[{\"card_id\":\"fx.usd-session-momentum\"}]}");
  assert.equal(second.version, 2);

  const record = store.readRegistry().documents.find(entry => entry.document_id === "usd-session-a1-return");
  assert.equal(record.versions.length, 2);
  assert.equal(record.versions[0].sha256, sha256("{\"cards\":[]}"));
  assert.ok(record.versions[1].note.includes("kept immutable"));
  assert.equal(record.versions[1].prompt_sha256, sha256(ResearchLibrary.taskById(catalog, "USD-SESSION-A1").prompt));
  assert.equal(record.versions[1].context_version, "usd-session-context-20261013.1");
  assert.equal(record.storage, "library_object");
  assert.equal(record.public_download, false);

  // A fresh store over the same paths must read both versions and their bytes.
  const restarted = createStore({ root: libraryRoot, registryPath: registryFile });
  const v1 = restarted.readObject("usd-session-a1-return", 1);
  assert.equal(v1.bytes.toString("utf8"), "{\"cards\":[]}");
  assert.equal(v1.version.sha256, sha256("{\"cards\":[]}"));
  assert.equal(restarted.readObject("usd-session-a1-return").version.version, 2);
  assert.ok(fs.existsSync(restarted.objectPathFor(first.sha256)));
  const manifest = restarted.manifest();
  assert.equal(manifest.counts.uploaded_documents, 1);
  assert.equal(manifest.counts.versions, 2);
  assert.equal(manifest.documents[0].download_reference, "/documents/usd-session-a1-return/versions/2");
});

test("the store refuses a malformed upload, an oversize body and a path-shaped id", () => {
  const dir = tempDir("store-guard");
  const store = createStore({ root: path.join(dir, "library"), registryPath: path.join(dir, "documents.json") });
  const base = { document_id: "x", asset: "USD", document_type: "report", title: "t", model: "m", content_text: "y" };

  assert.throws(() => store.registerUpload({ ...base, document_type: "brief" }, catalog), /document_type/);
  assert.throws(() => store.registerUpload({ ...base, task_id: "USD-SESSION-Z9" }, catalog), /is not in the catalog/);
  assert.throws(() => store.registerUpload({ ...base, task_id: "USD-SESSION-A1", context_version: "stale-version" }, catalog), /does not match/);
  assert.throws(() => store.registerUpload({ ...base, factor_id: "not.a.factor" }, catalog), /not in the catalog/);
  assert.throws(() => store.registerUpload({ ...base, model: "" }, catalog), /model is required/);
  assert.throws(() => store.readObject("nope", 1), /is not registered/);
  assert.throws(
    () => store.registerUpload({ ...base, content_text: "a".repeat(store.MAX_UPLOAD_BYTES + 1) }, catalog),
    /larger than/
  );

  // A path-shaped id is slugged, so traversal cannot escape the object store.
  const traversal = store.registerUpload({ ...base, document_id: "../../escape" }, catalog);
  assert.equal(traversal.document_id, "escape");
  assert.equal(fs.existsSync(path.join(store.root, "..", "escape")), false);
});

async function startService(options = {}) {
  const dir = tempDir("service");
  const service = createServiceServer({
    token: "test-token-0123456789",
    libraryRoot: path.join(dir, "library"),
    registryPath: path.join(dir, "documents.json"),
    catalogPath,
    ...options
  });
  await new Promise(resolve => service.server.listen(0, "127.0.0.1", resolve));
  const { port } = service.server.address();
  return { service, base: `http://127.0.0.1:${port}`, dir };
}

test("the service refuses every protected route without a token and serves the health check openly", async () => {
  const { service, base } = await startService();
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.bind, "127.0.0.1");
    assert.ok(healthBody.catalog_tasks.includes("USD-SESSION-A1"));

    for (const route of ["/manifest", "/export", "/documents", "/documents/x/versions/1", "/tasks/USD-SESSION-A1/context-package"]) {
      const response = await fetch(`${base}${route}`);
      assert.equal(response.status, 401, `${route} must require the token`);
    }
    const wrongToken = await fetch(`${base}/manifest`, { headers: { Authorization: "Bearer not-the-token" } });
    assert.equal(wrongToken.status, 401);
  } finally {
    await new Promise(resolve => service.server.close(resolve));
  }
});

test("an authenticated upload round-trips byte for byte and appears in the manifest and export", async () => {
  const { service, base } = await startService();
  const client = ResearchLibrary.createServiceClient({ endpoint: base, token: "test-token-0123456789" });
  try {
    const content = JSON.stringify({ cards: [{ card_id: "fx.usd-session-momentum" }] }, null, 2);
    const registration = await client.upload({
      document_id: "usd-session-a1-return",
      asset: "USD",
      task_id: "USD-SESSION-A1",
      document_type: "report",
      title: "A1 return",
      model: "ChatGPT (test)",
      context_version: "usd-session-context-20261013.1",
      original_filename: "a1.json",
      content_base64: Buffer.from(content, "utf8").toString("base64")
    });
    assert.equal(registration.version, 1);
    assert.equal(registration.sha256, sha256(content));
    assert.equal(registration.note.includes("not an approval"), true);

    const downloaded = await client.download("usd-session-a1-return", 1);
    assert.equal(Buffer.from(downloaded.bytes).toString("utf8"), content);
    assert.equal(downloaded.sha256, sha256(content));
    assert.equal(await ResearchLibrary.sha256Hex(downloaded.bytes), sha256(content));

    const manifest = await client.manifest();
    const entry = manifest.documents.find(document => document.document_id === "usd-session-a1-return");
    assert.equal(entry.latest_sha256, sha256(content));
    assert.equal(entry.public_download, false);
    assert.equal(entry.task_id, "USD-SESSION-A1");

    const exportPayload = await (await fetch(`${base}/export`, { headers: { Authorization: "Bearer test-token-0123456789" } })).json();
    assert.equal(exportPayload.download_references.some(reference => reference.document_id === "usd-session-a1-return"), true);
    const task = exportPayload.tasks.find(item => item.task_id === "USD-SESSION-A1");
    assert.equal(task.prompt_sha256, sha256(ResearchLibrary.taskById(catalog, "USD-SESSION-A1").prompt));
    assert.equal(task.covers.length, 7);

    const contextPackage = await client.contextPackage("USD-SESSION-A1");
    assert.equal(contextPackage.task_id, "USD-SESSION-A1");
    assert.equal(contextPackage.covered_factors.length, 7);
    assert.equal(service.store.manifest().counts.uploaded_documents, 1);
  } finally {
    await new Promise(resolve => service.server.close(resolve));
  }
});

test("the service answers an unknown route and a bad body rather than guessing", async () => {
  const { service, base } = await startService();
  const headers = { Authorization: "Bearer test-token-0123456789", "Content-Type": "application/json" };
  try {
    assert.equal((await fetch(`${base}/nope`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/tasks/NOPE/context-package`, { headers })).status, 404);
    const badBody = await fetch(`${base}/documents`, { method: "POST", headers, body: "{not json" });
    assert.equal(badBody.status, 400);
    const badPayload = await fetch(`${base}/documents`, { method: "POST", headers, body: JSON.stringify({ document_id: "x" }) });
    assert.equal(badPayload.status, 400);
    assert.ok((await badPayload.json()).problems.length >= 3);
  } finally {
    await new Promise(resolve => service.server.close(resolve));
  }
});
