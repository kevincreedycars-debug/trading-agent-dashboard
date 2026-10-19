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

test("coverage is computed: A1 and A2 cover fifteen cards and both reviews plus the synthesis cover all twenty-five", () => {
  const coverage = ResearchLibrary.factorCoverage(catalog);
  const a1 = coverage.tasks.find(task => task.task_id === "USD-SESSION-A1");
  const a2 = coverage.tasks.find(task => task.task_id === "USD-SESSION-A2");
  assert.equal(a1.covers.length, 7);
  assert.equal(a2.covers.length, 8);
  assert.equal(coverage.covered.length, 25);
  assert.equal(coverage.uncovered.length, 0, "no USD factor may sit outside every task");
  ["USD-SESSION-A3", "USD-SESSION-A4", "USD-SESSION-A5"].forEach(taskId => {
    const task = coverage.tasks.find(entry => entry.task_id === taskId);
    assert.equal(task.covers.length, 25, `${taskId} must cover all twenty-five entries`);
  });
  assert.ok(a1.gaps.length >= 1 && a2.gaps.length >= 1);
});

test("every USD factor carries a self-contained brief in the registry, and no status moved", () => {
  // Coverage is counted from the registry rather than asserted from the catalogue's own brief text: a factor
  // counts only when a brief document is registered against its own id, the file exists, and its hash is the
  // one the registry recorded. A brief is an assignment, so this check also holds the line that publishing
  // twenty-five briefs is not twenty-five pieces of research: the statuses stay where they were.
  const factors = ResearchLibrary.listFactors(catalog).filter(factor => factor.asset === "USD");
  assert.equal(factors.length, 25);
  const briefs = registry.documents.filter(document => document.document_type === "brief" && document.factor_id);
  const byFactor = new Map(briefs.map(document => [document.factor_id, document]));
  for (const factor of factors) {
    const document = byFactor.get(factor.factor_id);
    assert.ok(document, `${factor.factor_id} has no registered brief`);
    const abs = path.join(root, document.repo_path);
    assert.ok(fs.existsSync(abs), `${factor.factor_id} names a brief that is missing: ${document.repo_path}`);
    assert.equal(ResearchLibrary.latestVersion(document).sha256, sha256(fs.readFileSync(abs)), `${factor.factor_id}: brief hash drifted`);
    const text = fs.readFileSync(abs, "utf8");
    assert.ok(text.includes("05:00 Europe/London"), `${factor.factor_id}: the brief must use the 05:00 London session`);
    assert.ok(text.includes("## 7. What to return"), `${factor.factor_id}: the brief must carry output instructions`);
    assert.ok(text.includes("## 8. What to answer"), `${factor.factor_id}: the brief must carry its research prompt`);
    assert.ok(text.includes(factor.label), `${factor.factor_id}: the brief must carry the catalogue's label`);
  }
  assert.equal(byFactor.size, 25);
  assert.equal(catalog.research_briefs.total, 25);
  assert.equal(catalog.research_briefs.live_engine_audits, 10);
  assert.equal(catalog.research_briefs.session_research, 15);
  assert.equal(catalog.repo_documents.filter(entry => entry.brief_kind).length, 25, "the catalogue lists the same twenty-five briefs");
  // Publishing the briefs changed no research state: nothing was marked completed, uploaded or accepted.
  const counts = ResearchLibrary.progressCounts(factors);
  assert.equal(counts.total, 25);
  assert.equal(counts.research.ready, 22);
  assert.equal(counts.research.blocked, 3);
  assert.equal(counts.research.uploaded, 0);
  assert.equal(counts.review.accepted, 0);
  assert.equal(counts.backtest.tested, 0);
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
  assert.equal(repoDocuments.length, 41, "sixteen repository artefacts and twenty-five per-factor briefs");
  repoDocuments.forEach(document => {
    const abs = path.join(root, document.repo_path);
    assert.ok(fs.existsSync(abs), `${document.document_id} is missing on disk`);
    const latest = ResearchLibrary.latestVersion(document);
    assert.equal(latest.sha256, sha256(fs.readFileSync(abs)), `${document.document_id} hash drifted`);
    assert.ok(latest.bytes > 0);
  });
  const uploads = registry.documents.filter(entry => entry.storage === "library_object");
  assert.equal(uploads.length, 1, "the one return registered so far is the VIX report");
  const uploaded = uploads[0];
  assert.equal(uploaded.document_id, "usd-baseline-audit-01-vix-usd-report");
  assert.equal(uploaded.asset, "USD");
  assert.equal(uploaded.factor_id, "live.f1-vix-level");
  assert.equal(uploaded.document_type, "report");
  assert.equal(uploaded.origin, "external_upload");
  assert.equal(uploaded.public_download, false);
  assert.equal(uploaded.model, "Astra deep research");
  assert.equal(uploaded.task_id, null, "USD-BASELINE-AUDIT-01 is a handoff brief id, not a catalogue task");
  assert.ok(uploaded.note.includes("USD-BASELINE-AUDIT-01"), "the audit task is named in the document note");
  assert.ok(uploaded.note.includes("Research delivered, review pending"));
  const uploadedVersion = ResearchLibrary.latestVersion(uploaded);
  assert.equal(uploadedVersion.version, 1);
  assert.equal(uploadedVersion.bytes, 84056);
  assert.equal(uploadedVersion.sha256, "e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d");
  assert.ok(uploadedVersion.note.includes("USD-BASELINE-AUDIT-01"), "and in the version note");
  assert.equal(uploaded.object_sha256, uploadedVersion.sha256);
  // Registering evidence is not progress: the factor's own three statuses are exactly what they were.
  const uploadedFactor = ResearchLibrary.listFactors(catalog).find(entry => entry.factor_id === "live.f1-vix-level");
  assert.deepEqual(ResearchLibrary.normalizeFactorStatuses(uploadedFactor),
    { research: "ready", review: "pending", backtest: "not_tested" });
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

// ---------------------------------------------------------------------------------------------
// Topic labels, factor chains and the gated final chain
// ---------------------------------------------------------------------------------------------

test("the catalogue carries six topic labels and twenty-five factor chains, three stages each, plus a gated final chain", () => {
  const topics = ResearchLibrary.listTopics(catalog);
  assert.equal(topics.length, 6, "the USD research map carries six topic labels");
  const covered = new Set();
  topics.forEach(topic => {
    assert.equal(topic.asset, "USD");
    assert.ok(topic.title && topic.summary, `${topic.topic_id} needs a title and a summary`);
    assert.deepEqual(ResearchLibrary.chainStages(topic), [], `${topic.topic_id} is a grouping label and carries no stages`);
    assert.ok(topic.factor_ids.length >= 1, `${topic.topic_id} must name the factor entries it groups`);
    topic.factor_ids.forEach(factorId => covered.add(factorId));
    topic.overlaps.forEach(overlapId => assert.ok(ResearchLibrary.topicById(catalog, overlapId), `${overlapId} must resolve`));
    assert.ok(topic.companions.length >= 1, `${topic.topic_id} should name the files it rests on`);
  });
  assert.equal(covered.size, 25, "every USD factor sits under a topic label");

  const chains = ResearchLibrary.listFactorChains(catalog, "USD");
  assert.equal(chains.length, 25, "the map carries one research chain per factor");
  const chained = new Set();
  chains.forEach(chain => {
    assert.ok(chain.title && chain.summary, `${chain.chain_id} needs a title and a summary`);
    assert.equal(ResearchLibrary.factorChainById(catalog, chain.chain_id).chain_id, chain.chain_id);
    assert.equal(ResearchLibrary.factorChainForFactor(catalog, chain.factor_id).chain_id, chain.chain_id);
    assert.ok(ResearchLibrary.getAsset(catalog, "USD").factors.some(factor => factor.factor_id === chain.factor_id), `${chain.factor_id} must exist on the asset`);
    assert.ok(ResearchLibrary.topicById(catalog, chain.topic_id), `${chain.chain_id} must sit under a topic label`);
    assert.equal(ResearchLibrary.chainStages(chain).length, 3, `${chain.chain_id} must carry three stages`);
    assert.deepEqual(ResearchLibrary.chainStages(chain).map(stage => stage.stage), ResearchLibrary.FACTOR_STAGES.slice());
    assert.deepEqual(ResearchLibrary.chainStages(chain).map(stage => stage.order), [1, 2, 3]);
    assert.deepEqual(ResearchLibrary.chainStages(chain).map(stage => stage.parent_stage), [null, "research", "red_team"]);
    assert.deepEqual(ResearchLibrary.chainStages(chain).map(stage => stage.document_type), ["report", "review", "synthesis"]);
    assert.deepEqual(ResearchLibrary.chainStages(chain).map(stage => stage.label), ["Research", "Red-team", "Adjudication"]);
    assert.equal(chained.has(chain.factor_id), false, `${chain.factor_id} carries one chain, not two`);
    chained.add(chain.factor_id);
  });
  assert.equal(chained.size, 25, "every factor carries exactly one chain");
  assert.deepEqual(
    ResearchLibrary.factorChainsForTopic(catalog, "usd-topic-vix-level-and-risk-regime").map(chain => chain.chain_id),
    ["usd-factor-live-f1-vix-level", "usd-factor-risk-vix-level-and-change-at-cutoff"]
  );
  // A factor resolves to its grouping label. Membership is not evidence: the sibling VIX chain stays 0/3 rather
  // than inheriting the F1 chain's registered report.
  assert.deepEqual(
    ResearchLibrary.topicsCoveringFactor(catalog, "risk.vix-level-and-change-at-cutoff").map(topic => topic.topic_id),
    ["usd-topic-vix-level-and-risk-regime"]
  );

  const finalSpec = ResearchLibrary.finalChain(catalog, "USD");
  assert.equal(finalSpec.chain_id, "usd-final-asset-analysis");
  assert.equal(finalSpec.factor_id, undefined, "the final chain belongs to the asset, not to a factor");
  assert.equal(ResearchLibrary.chainStages(finalSpec).length, 3);
  assert.deepEqual(ResearchLibrary.chainStages(finalSpec).map(stage => stage.stage), ResearchLibrary.FINAL_CHAIN_STAGES);
  assert.deepEqual(ResearchLibrary.chainStages(finalSpec).map(stage => stage.parent_stage), [null, "final_analysis", "final_red_team"]);
  assert.deepEqual(ResearchLibrary.chainStages(finalSpec).map(stage => stage.document_type), ["synthesis", "review", "synthesis"]);
  assert.deepEqual(ResearchLibrary.chainStages(finalSpec).map(stage => stage.input_stages), [[], ["final_analysis"], ["final_analysis", "final_red_team"]]);
  assert.equal(finalSpec.gate.requires, "all-factor-chains");
  assert.equal(finalSpec.gate.factor_count, 25);
  assert.equal(finalSpec.gate.stage_count, 3);
  assert.equal(finalSpec.gate.final_stage_count, 3);
  assert.deepEqual(finalSpec.factor_chain_ids.slice().sort(), chains.map(chain => chain.chain_id).sort());
});

test("every chain prompt exists, matches its catalogue hash and stands on its own", () => {
  const hosts = ["openai.com", "anthropic.com", "api.openai", "generativelanguage", "claude.ai"];
  const requiredSections = {
    research: "## What the report must cover",
    red_team: "## What to attack, claim by claim",
    adjudication: "## What the adjudication must contain",
    final_analysis: "## What the synthesis must contain",
    final_red_team: "## How to challenge, claim by claim",
    final_adjudication: "## What the adjudication must contain"
  };
  const entries = [];
  ResearchLibrary.listFactorChains(catalog, "USD").forEach(chain => {
    ResearchLibrary.chainStages(chain).forEach(stage => entries.push({ chain, stage }));
  });
  const finalSpec = ResearchLibrary.finalChain(catalog, "USD");
  ResearchLibrary.chainStages(finalSpec).forEach(stage => entries.push({ chain: finalSpec, stage }));
  assert.equal(entries.length, 78, "twenty-five chains of three stages plus the three final stages");
  entries.forEach(({ chain, stage }) => {
    const abs = path.join(root, stage.prompt_path);
    assert.ok(fs.existsSync(abs), `${stage.prompt_path} is missing`);
    const text = fs.readFileSync(abs, "utf8");
    assert.equal(sha256(text), stage.prompt_sha256, `${stage.prompt_path} hash drifted`);
    assert.equal(Buffer.byteLength(text, "utf8"), stage.prompt_bytes);
    assert.ok(text.startsWith("# "), `${stage.prompt_path} needs a title`);
    assert.ok(text.includes(chain.chain_id), `${stage.prompt_path} must name its chain`);
    if (chain.factor_id) {
      assert.ok(text.includes(chain.factor_id), `${stage.prompt_path} must name its factor`);
      assert.ok(text.includes(chain.topic_id), `${stage.prompt_path} must name its group label`);
    } else {
      assert.equal(text.includes("group label"), false, `${stage.prompt_path} is asset-level and carries no topic`);
    }
    assert.ok(text.includes("05:00 Europe/London"), `${stage.prompt_path} must state the cutoff`);
    assert.ok(text.includes("## Prohibitions"), `${stage.prompt_path} must carry the prohibitions`);
    assert.ok(text.includes("## What to return"), `${stage.prompt_path} must say what to return`);
    const required = requiredSections[stage.stage];
    assert.ok(required, `${stage.stage} needs a known required section`);
    assert.ok(text.includes(required), `${stage.prompt_path} must carry ${required}`);
    hosts.forEach(host => assert.equal(text.toLowerCase().includes(host), false, `${stage.prompt_path} must not name ${host}`));
  });
});

test("the final chain prompts carry the analysis, red-team and candidate-logic stages", () => {
  const finalSpec = ResearchLibrary.finalChain(catalog, "USD");
  const analysis = ResearchLibrary.chainStageById(finalSpec, "final_analysis");
  const redTeam = ResearchLibrary.chainStageById(finalSpec, "final_red_team");
  const adjudication = ResearchLibrary.chainStageById(finalSpec, "final_adjudication");
  const analysisText = fs.readFileSync(path.join(root, analysis.prompt_path), "utf8");
  const redTeamText = fs.readFileSync(path.join(root, redTeam.prompt_path), "utf8");
  const adjudicationText = fs.readFileSync(path.join(root, adjudication.prompt_path), "utf8");
  assert.equal(analysisText.includes("final red-team judges this synthesis"), true);
  assert.equal(redTeamText.includes("final analysis"), true);
  assert.equal(redTeamText.includes("supporting evidence"), true);
  assert.equal(redTeamText.includes("adjudication of every factor chain"), true);
  assert.equal(adjudicationText.includes("final red-team"), true);
  assert.equal(adjudicationText.includes("final analysis"), true);
  assert.equal(adjudicationText.includes("## Complete candidate Layer 1 logic for isolated backtesting"), true);
  assert.equal(adjudicationText.includes("isolated backtest"), true);
  assert.equal(adjudicationText.includes("does not implement, score, deploy"), true);
  [analysisText, redTeamText, adjudicationText].forEach(text => {
    assert.equal(text.includes("final review"), false, "the removed two-stage name must not survive in a final prompt");
  });
});

test("the VIX factor chain's research prompt is the dispatched assignment, not the legacy reviewer task", () => {
  const chain = ResearchLibrary.factorChainForFactor(catalog, "live.f1-vix-level");
  const research = ResearchLibrary.chainStageById(chain, "research");
  const text = fs.readFileSync(path.join(root, research.prompt_path), "utf8");
  assert.equal(research.prompt_source.kind, "dispatched_brief");
  assert.equal(research.prompt_source.repo_path, "docs/research/handoff/usd/v1/deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md");
  assert.equal(
    research.prompt_source.sha256,
    sha256(fs.readFileSync(path.join(root, research.prompt_source.repo_path), "utf8"))
  );
  assert.ok(text.includes("USD-BASELINE-AUDIT-01"), "the dispatched task is named");
  assert.ok(text.includes("A comprehensive, source-backed report investigating how VIX"), "the assignment is reproduced in full");
  assert.ok(Buffer.byteLength(text, "utf8") > 20000, "the whole assignment is in the one file");
  const a3 = ResearchLibrary.taskById(catalog, "USD-SESSION-A3");
  assert.equal(text.includes(a3.prompt.slice(0, 60)), false, "stage 1 must not copy the legacy reviewer prompt");
  // The sibling VIX factor chain did not receive the dispatched brief as a second, independent result.
  const sibling = ResearchLibrary.chainStageById(
    ResearchLibrary.factorChainForFactor(catalog, "risk.vix-level-and-change-at-cutoff"),
    "research"
  );
  assert.equal(sibling.prompt_source.kind, "generated");
  assert.equal(fs.readFileSync(path.join(root, sibling.prompt_path), "utf8").includes("USD-BASELINE-AUDIT-01"), false);
});

test("the VIX factor chain reads research delivered, red-team awaiting a file and adjudication not started", () => {
  const chain = ResearchLibrary.factorChainForFactor(catalog, "live.f1-vix-level");
  const progress = ResearchLibrary.chainProgress(chain, registry);
  const byStage = new Map(progress.stages.map(stage => [stage.stage, stage]));
  const research = byStage.get("research");
  assert.equal(research.state, "delivered");
  assert.equal(research.state_label, "Uploaded");
  assert.equal(research.document_id, "usd-baseline-audit-01-vix-usd-report");
  assert.equal(research.version, 1);
  assert.equal(research.sha256, "e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d");
  assert.equal(research.bytes, 84056);
  assert.equal(research.parent_stage, "");
  const redTeam = byStage.get("red_team");
  assert.equal(redTeam.state, "awaiting_upload");
  assert.equal(redTeam.document_id, "", "the red-team file is not registered yet");
  assert.equal(redTeam.parent_document_id, research.document_id);
  assert.equal(redTeam.parent_version, 1);
  assert.equal(redTeam.parent_sha256, research.sha256);
  const adjudication = byStage.get("adjudication");
  assert.equal(adjudication.state, "not_started");
  assert.equal(adjudication.parent_document_id, "", "stage 3 waits for the review");
  assert.equal(progress.delivered_stages, 1);
  assert.equal(progress.total_stages, 3);
  assert.equal(progress.next_stage, "red_team");
  assert.equal(progress.ready_for_synthesis, false);
  assert.deepEqual(progress.open_findings, []);

  // The sibling VIX factor chain owns its own research: the dispatched brief did not count twice.
  const sibling = ResearchLibrary.factorChainForFactor(catalog, "risk.vix-level-and-change-at-cutoff");
  const siblingProgress = ResearchLibrary.chainProgress(sibling, registry);
  assert.equal(siblingProgress.delivered_stages, 0, "one report cannot settle two factor chains");
  assert.equal(siblingProgress.next_stage, "research");

  // The topic label carries no stages of its own; its progress is the sum of the chains under it.
  const topic = ResearchLibrary.topicById(catalog, "usd-topic-vix-level-and-risk-regime");
  const topicRoll = ResearchLibrary.topicProgress(topic, registry, catalog);
  assert.deepEqual(topicRoll.stages, []);
  assert.equal(topicRoll.chains.length, 2);
  assert.equal(topicRoll.delivered_stages, 1);
  assert.equal(topicRoll.total_stages, 6);
  assert.equal(topicRoll.ready_for_synthesis, false);

  // The asset-level final chain stays locked until every factor chain completes all three stages.
  const final = ResearchLibrary.finalChainStatus(catalog, registry);
  assert.equal(final.state, "locked");
  assert.equal(final.state_label, "Locked until every factor chain is complete");
  assert.equal(final.unlocked, false);
  assert.equal(final.factors_total, 25);
  assert.equal(final.factors_complete, 0);
  assert.equal(final.pending.length, 25);
  const pendingVix = final.pending.find(entry => entry.factor_id === "live.f1-vix-level");
  assert.equal(pendingVix.next_stage, "red_team");
  assert.equal(pendingVix.delivered_stages, 1);

  // And delivery moved no factor status.
  const counts = ResearchLibrary.progressCounts(ResearchLibrary.listFactors(catalog));
  assert.equal(counts.research.uploaded, 0);
  assert.equal(counts.research.ready, 22);
  assert.equal(counts.review.accepted, 0);
});

test("a stage that judged an earlier version of its parent is flagged rather than settled", () => {
  const chain = ResearchLibrary.factorChainForFactor(catalog, "live.f1-vix-level");
  const documents = { documents: [
    { document_id: "vix-stage-1", chain_id: chain.chain_id, factor_id: chain.factor_id, topic_id: chain.topic_id, stage: "research", asset: "USD", document_type: "report", storage: "library_object", object_sha256: "a".repeat(64), versions: [{ version: 1, sha256: "a".repeat(64), registered_at: "2026-10-15" }, { version: 2, sha256: "b".repeat(64), registered_at: "2026-10-18" }] },
    { document_id: "vix-stage-2", chain_id: chain.chain_id, factor_id: chain.factor_id, topic_id: chain.topic_id, stage: "red_team", asset: "USD", document_type: "review", storage: "library_object", object_sha256: "c".repeat(64), parent_document_id: "vix-stage-1", parent_version: 1, parent_sha256: "a".repeat(64), versions: [{ version: 1, sha256: "c".repeat(64), registered_at: "2026-10-16" }] }
  ] };
  const progress = ResearchLibrary.chainProgress(chain, documents);
  const redTeam = progress.stages.find(stage => stage.stage === "red_team");
  assert.equal(redTeam.state, "reassessment_required");
  assert.equal(redTeam.stale_parent_version, true);
  assert.equal(redTeam.reviewed_version, 1);
  assert.equal(redTeam.parent_version, 2);
  assert.deepEqual(progress.flagged_for_reassessment, ["red_team"]);
  assert.equal(progress.ready_for_synthesis, false);
  const final = ResearchLibrary.finalChainStatus(catalog, documents);
  assert.equal(final.unlocked, false);
  assert.equal(final.flagged_factor_ids.includes(chain.factor_id), true);

  // The same review against the current version, with an adjudication under it, reads as ready.
  const current = JSON.parse(JSON.stringify(documents));
  current.documents[1].parent_version = 2;
  current.documents[1].parent_sha256 = "b".repeat(64);
  current.documents.push({ document_id: "vix-stage-3", chain_id: chain.chain_id, factor_id: chain.factor_id, topic_id: chain.topic_id, stage: "adjudication", asset: "USD", document_type: "synthesis", storage: "library_object", object_sha256: "d".repeat(64), parent_document_id: "vix-stage-2", parent_version: 1, parent_sha256: "c".repeat(64), open_findings: ["the label instrument is still unverified"], versions: [{ version: 1, sha256: "d".repeat(64), registered_at: "2026-10-19" }] });
  const settled = ResearchLibrary.chainProgress(chain, current);
  assert.equal(settled.delivered_stages, 3);
  assert.equal(settled.ready_for_synthesis, true);
  assert.equal(settled.complete, true);
  assert.deepEqual(settled.open_findings, ["the label instrument is still unverified"]);
  assert.equal(settled.unresolved_findings, 1);
  assert.ok(settled.note.includes("unresolved finding"));
  // One complete factor chain does not open the final gate.
  const stillLocked = ResearchLibrary.finalChainStatus(catalog, current);
  assert.equal(stillLocked.unlocked, false);
  assert.equal(stillLocked.factors_complete, 1);
  assert.equal(stillLocked.pending.length, 24);
});

test("the store records the chain, the stage and the exact version a stage judged", () => {
  const dir = tempDir("stage-store");
  const store = createStore({ root: path.join(dir, "library"), registryPath: path.join(dir, "documents.json"), now: () => new Date("2026-10-15T00:00:00Z") });
  const topicId = "usd-topic-vix-level-and-risk-regime";
  const chain = ResearchLibrary.factorChainForFactor(catalog, "live.f1-vix-level");
  const research = store.registerUpload({
    document_id: "vix-stage-1", asset: "USD", factor_id: "live.f1-vix-level", topic_id: topicId, stage: "research",
    document_type: "report", title: "Research", model: "Astra deep research", content_text: "# report\n"
  }, catalog);
  assert.equal(research.document.topic_id, topicId);
  assert.equal(research.document.factor_id, "live.f1-vix-level");
  assert.equal(research.document.chain_id, chain.chain_id);
  assert.equal(research.document.stage, "research");
  assert.equal(research.document.parent_document_id, undefined);
  assert.equal(research.document.task_id, null);

  const review = store.registerUpload({
    document_id: "vix-stage-2", asset: "USD", factor_id: "live.f1-vix-level", stage: "red_team", document_type: "review",
    title: "Red-team", model: "Astra review", parent_document_id: "vix-stage-1", parent_version: 1,
    content_text: "# review\n"
  }, catalog);
  assert.equal(review.document.chain_id, chain.chain_id, "a chain-only upload records the factor from the chain");
  assert.equal(review.document.factor_id, "live.f1-vix-level");
  assert.equal(review.document.parent_document_id, "vix-stage-1");
  assert.equal(review.document.parent_version, 1);
  assert.equal(review.document.parent_sha256, research.sha256);
  assert.equal(review.document.versions[0].parent_sha256, research.sha256);
  assert.equal(review.document.versions[0].chain_id, chain.chain_id);

  const adjudication = store.registerUpload({
    document_id: "vix-stage-3", asset: "USD", factor_id: "live.f1-vix-level", stage: "adjudication", document_type: "synthesis",
    title: "Adjudication", model: "Astra synthesis", parent_document_id: "vix-stage-2", parent_version: 1,
    open_findings: ["label instrument unverified", "no measured base rate"], content_text: "# adjudication\n"
  }, catalog);
  assert.deepEqual(adjudication.document.open_findings, ["label instrument unverified", "no measured base rate"]);

  // A second version of the research report keeps the first immutable, and the review still points at v1.
  store.registerUpload({
    document_id: "vix-stage-1", asset: "USD", factor_id: "live.f1-vix-level", stage: "research", document_type: "report",
    title: "Research", model: "Astra deep research", content_text: "# report v2\n"
  }, catalog);
  const stageOne = store.readRegistry().documents.find(entry => entry.document_id === "vix-stage-1");
  assert.equal(stageOne.versions.length, 2);
  assert.equal(stageOne.versions[0].sha256, research.sha256);
  assert.equal(stageOne.chain_id, chain.chain_id);
  const manifestEntry = store.manifest().documents.find(entry => entry.document_id === "vix-stage-2");
  assert.equal(manifestEntry.stage, "red_team");
  assert.equal(manifestEntry.chain_id, chain.chain_id);
  assert.equal(manifestEntry.parent_version, 1);
  assert.equal(store.readObject("vix-stage-1", 1).version.sha256, research.sha256);
});

test("the store refuses a stage upload that breaks the chain linkage", () => {
  const dir = tempDir("stage-guard");
  const store = createStore({ root: path.join(dir, "library"), registryPath: path.join(dir, "documents.json") });
  const topicId = "usd-topic-vix-level-and-risk-regime";
  const finalChainId = ResearchLibrary.finalChain(catalog).chain_id;
  const base = { document_id: "x", asset: "USD", title: "t", model: "m", content_text: "y" };

  assert.throws(() => store.registerUpload({ ...base, factor_id: "not-a-factor", stage: "research", document_type: "report" }, catalog), /carries no research chain/);
  assert.throws(() => store.registerUpload({ ...base, chain_id: "not-a-chain", stage: "research", document_type: "report" }, catalog), /is not in the catalog/);
  assert.throws(() => store.registerUpload({ ...base, stage: "research", document_type: "report" }, catalog), /factor_id or chain_id is required/);
  assert.throws(() => store.registerUpload({ ...base, topic_id: topicId, stage: "research", document_type: "report" }, catalog), /factor_id or chain_id is required/);
  // The final chain is asset-level: it must not claim a factor or a grouping label.
  assert.throws(() => store.registerUpload({ ...base, chain_id: finalChainId, factor_id: "live.f1-vix-level", stage: "final_analysis", document_type: "synthesis" }, catalog), /must not name a factor/);
  assert.throws(() => store.registerUpload({ ...base, chain_id: finalChainId, topic_id: topicId, stage: "final_analysis", document_type: "synthesis" }, catalog), /must not name a topic/);
  // And it cannot be written while the registry gate is shut, even if the caller names a stage directly.
  assert.throws(() => store.registerUpload({ ...base, chain_id: finalChainId, stage: "final_analysis", document_type: "synthesis" }, catalog), /final chain is locked/);
  assert.throws(() => store.registerUpload({ ...base, factor_id: "live.f1-vix-level", stage: "red_team", document_type: "review" }, catalog), /must name the research document it judged/);
  assert.throws(() => store.registerUpload({ ...base, factor_id: "live.f1-vix-level", stage: "red_team", document_type: "synthesis", parent_document_id: "nope", parent_version: 1 }, catalog), /expects a review document/);
  assert.throws(() => store.registerUpload({ ...base, factor_id: "live.f1-vix-level", stage: "red_team", document_type: "review", parent_document_id: "nope", parent_version: 1 }, catalog), /is not registered/);
  // The first stage of a chain has no parent, so an upload that names one is refused too.
  assert.throws(() => store.registerUpload({ ...base, factor_id: "live.f1-vix-level", stage: "research", document_type: "report", parent_document_id: "x", parent_version: 1 }, catalog), /has no parent document/);
  // And an upload with no chain at all is still allowed for a legacy task, exactly as before.
  const legacy = store.registerUpload({
    document_id: "usd-session-a1-return", asset: "USD", task_id: "USD-SESSION-A1", document_type: "report",
    title: "A1 return", model: "ChatGPT (test)", content_text: "{\"cards\":[]}"
  }, catalog);
  assert.equal(legacy.document.topic_id, null);
  assert.equal(legacy.document.factor_id, null);
  assert.equal(legacy.document.chain_id, null);
  assert.equal(legacy.document.stage, null);
});

test("the validator refuses a mis-linked or unlinked stage document", () => {
  const broken = JSON.parse(JSON.stringify(registry));
  broken.documents.find(entry => entry.document_id === "usd-baseline-audit-01-vix-usd-report").topic_id = "usd-topic-nope";
  assert.ok(ResearchLibrary.validateDocuments(broken, catalog).some(problem => problem.includes("unknown topic")));

  const mismatched = JSON.parse(JSON.stringify(registry));
  mismatched.documents.find(entry => entry.document_id === "usd-baseline-audit-01-vix-usd-report").document_type = "review";
  assert.ok(ResearchLibrary.validateDocuments(mismatched, catalog).some(problem => problem.includes("expects a report document")));

  const missingParent = JSON.parse(JSON.stringify(registry));
  missingParent.documents.push({
    document_id: "vix-review", asset: "USD", factor_id: "live.f1-vix-level", topic_id: "usd-topic-vix-level-and-risk-regime", stage: "red_team",
    document_type: "review", storage: "library_object", public_download: false, object_sha256: "a".repeat(64),
    versions: [{ version: 1, sha256: "a".repeat(64), registered_at: "2026-10-15" }]
  });
  assert.ok(ResearchLibrary.validateDocuments(missingParent, catalog).some(problem => problem.includes("must name the research document it judged")));

  const honest = JSON.parse(JSON.stringify(missingParent));
  Object.assign(honest.documents[honest.documents.length - 1], {
    parent_document_id: "usd-baseline-audit-01-vix-usd-report",
    parent_version: 1,
    parent_sha256: "e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d"
  });
  assert.deepEqual(ResearchLibrary.validateDocuments(honest, catalog), []);

  const wrongVersion = JSON.parse(JSON.stringify(honest));
  wrongVersion.documents[wrongVersion.documents.length - 1].parent_version = 7;
  assert.ok(ResearchLibrary.validateDocuments(wrongVersion, catalog).some(problem => problem.includes("which is not registered")));
});

test("the final chain records its input package and flags stale downstream results", () => {
  const finalSpec = ResearchLibrary.finalChain(catalog, "USD");
  const documents = { documents: [] };
  const digest = (id, version = 1) => sha256(`${id}-v${version}`);
  ResearchLibrary.listFactorChains(catalog, "USD").forEach(chain => {
    const researchId = `${chain.chain_id}-research`;
    const reviewId = `${chain.chain_id}-red-team`;
    const adjudicationId = `${chain.chain_id}-adjudication`;
    const base = { asset: "USD", factor_id: chain.factor_id, topic_id: chain.topic_id, chain_id: chain.chain_id, storage: "library_object", object_sha256: digest(researchId), public_download: false };
    documents.documents.push({ ...base, document_id: researchId, stage: "research", document_type: "report", title: "Research", versions: [{ version: 1, sha256: digest(researchId), bytes: 10, registered_at: "2026-10-20" }] });
    documents.documents.push({ ...base, document_id: reviewId, stage: "red_team", document_type: "review", title: "Red-team", parent_document_id: researchId, parent_version: 1, versions: [{ version: 1, sha256: digest(reviewId), bytes: 10, registered_at: "2026-10-20" }] });
    documents.documents.push({ ...base, document_id: adjudicationId, stage: "adjudication", document_type: "synthesis", title: "Adjudication", parent_document_id: reviewId, parent_version: 1, versions: [{ version: 1, sha256: digest(adjudicationId), bytes: 10, registered_at: "2026-10-20" }] });
  });

  const unlocked = ResearchLibrary.finalChainStatus(catalog, documents);
  assert.equal(unlocked.unlocked, true);
  assert.equal(unlocked.state, "unlocked");
  assert.equal(unlocked.total_stages, 3);
  const analysisStage = unlocked.stages.find(stage => stage.stage === "final_analysis");
  const redTeamStage = unlocked.stages.find(stage => stage.stage === "final_red_team");
  const adjudicationStage = unlocked.stages.find(stage => stage.stage === "final_adjudication");
  assert.equal(analysisStage.input_documents.length, 25, "final analysis receives every factor adjudication");
  assert.equal(redTeamStage.input_documents.length, 26, "final red-team receives the analysis and every adjudication");
  assert.equal(adjudicationStage.input_documents.length, 27, "final adjudication receives both final documents and every adjudication");

  const dir = tempDir("final-chain-store");
  const registryPath = path.join(dir, "documents.json");
  fs.writeFileSync(registryPath, `${JSON.stringify({ schema_version: "research-library-documents-v1", documents: documents.documents }, null, 2)}\n`, "utf8");
  const store = createStore({ root: path.join(dir, "library"), registryPath, now: () => new Date("2026-10-20T00:00:00Z") });
  const packageFor = stageId => ResearchLibrary.asArray(ResearchLibrary.finalChainStatus(catalog, store.readRegistry()).stages.find(stage => stage.stage === stageId).input_documents)
    .filter(entry => !entry.missing)
    .map(entry => ({ document_id: entry.document_id, version: entry.version, sha256: entry.sha256, role: entry.role, role_stage: entry.role_stage }));

  assert.throws(() => store.registerUpload({
    document_id: "usd-final-analysis", asset: "USD", chain_id: finalSpec.chain_id, stage: "final_analysis", document_type: "synthesis",
    title: "Final analysis", model: "Astra final analysis", content_text: "# final analysis\n"
  }, catalog), /must name its input package/);

  const analysis = store.registerUpload({
    document_id: "usd-final-analysis", asset: "USD", chain_id: finalSpec.chain_id, stage: "final_analysis", document_type: "synthesis",
    title: "Final analysis", model: "Astra final analysis", content_text: "# final analysis\n",
    input_documents: packageFor("final_analysis")
  }, catalog);
  assert.equal(analysis.document.input_documents.length, 25);

  const redTeam = store.registerUpload({
    document_id: "usd-final-red-team", asset: "USD", chain_id: finalSpec.chain_id, stage: "final_red_team", document_type: "review",
    title: "Final red-team", model: "Astra final red-team", content_text: "# final red-team\n",
    parent_document_id: "usd-final-analysis", parent_version: 1,
    input_documents: packageFor("final_red_team")
  }, catalog);
  assert.equal(redTeam.document.input_documents.length, 26);

  const adjudication = store.registerUpload({
    document_id: "usd-final-adjudication", asset: "USD", chain_id: finalSpec.chain_id, stage: "final_adjudication", document_type: "synthesis",
    title: "Final adjudication", model: "Astra final adjudication", content_text: "# final adjudication\n",
    parent_document_id: "usd-final-red-team", parent_version: 1,
    input_documents: packageFor("final_adjudication")
  }, catalog);
  assert.equal(adjudication.document.input_documents.length, 27);
  const complete = ResearchLibrary.finalChainStatus(catalog, store.readRegistry());
  assert.equal(complete.state, "complete");
  assert.equal(complete.delivered_stages, 3);
  assert.deepEqual(ResearchLibrary.validateDocuments(store.readRegistry(), catalog), [], "the recorded final packages validate");

  // A new version of one factor adjudication makes every final return stale, even though the chain itself was
  // not re-uploaded and the gate still has all 25 complete factor chains.
  const moved = store.readRegistry();
  const changed = moved.documents.find(entry => entry.document_id === `${ResearchLibrary.listFactorChains(catalog, "USD")[0].chain_id}-adjudication`);
  changed.versions.push({ version: 2, sha256: digest(changed.document_id, 2), bytes: 11, registered_at: "2026-10-21" });
  store.writeRegistry(moved);
  const stale = ResearchLibrary.finalChainStatus(catalog, store.readRegistry());
  assert.equal(stale.unlocked, true);
  assert.equal(stale.state, "in_progress");
  assert.equal(stale.complete, false);
  assert.deepEqual(stale.flagged_for_reassessment, ["final_analysis", "final_red_team", "final_adjudication"]);
  assert.ok(stale.stale_inputs.some(entry => entry.document_id === changed.document_id && entry.current_version === 2));
});
