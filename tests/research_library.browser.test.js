"use strict";

// The Research Library panel in a real browser, against the factor-chain workflow: the prompt each stage
// copies, one Markdown upload per chain and stage with the exact version it judged, the full document behind
// View and Download, sibling-chain isolation, the gated final chain, persistence across a refresh and a
// service restart, a revised research report flagging its review for reassessment, and the honest difference
// between the published page and the local service.
//
// Every upload here goes to a temporary registry and object store, never to the committed evidence records:
// the committed registry is hashed before and after the run to prove it.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const { createServiceServer } = require("../scripts/research-library-server.js");
const ResearchLibrary = require("../lib/research_library.js");

const rootDir = path.resolve(__dirname, "..");
const TOKEN = "browser-test-token-0123456789";
const VIX_TOPIC = "usd-topic-vix-level-and-risk-regime";
const VIX_RESEARCH_DOCUMENT = "usd-baseline-audit-01-vix-usd-report";
const VIX_RESEARCH_SHA = "e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d";
const catalogPath = path.join(rootDir, "data", "research-library", "catalog.json");
const committedRegistryPath = path.join(rootDir, "data", "research-library", "documents.json");

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function serveRepo(requested, overrides = {}) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    requested.push(urlPath);
    const override = overrides[urlPath];
    if (override) {
      res.writeHead(200, { "Content-Type": contentType(override), "Cache-Control": "no-store" });
      res.end(fs.readFileSync(override));
      return;
    }
    const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });
  return server;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Chromium refuses to navigate to a handful of ports (4045 among the ephemeral range is one), so a random
// port is retried until it is one the browser will actually accept.
const BLOCKED_PORTS = new Set([4045, 5060, 5061, 6000, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);

async function listenSafe(server) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    if (!BLOCKED_PORTS.has(port)) return port;
    await new Promise(resolve => server.close(resolve));
  }
  throw new Error("could not find a port the browser will accept");
}

// MAIN_ANCHOR
async function main() {
  const checkoutRequests = [];
  // The panel reads the registry from the checkout. This run points that one file at a temporary copy, so the
  // service that writes an upload and the page that reads it back agree, and the committed records stay put.
  const checkoutOverrides = {};
  const repoServer = serveRepo(checkoutRequests, checkoutOverrides);
  const checkoutPort = await listenSafe(repoServer);
  const checkoutBase = `http://127.0.0.1:${checkoutPort}`;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "rl-browser-"));
  const libraryRoot = path.join(workDir, "library");
  const registryPath = path.join(workDir, "documents.json");
  fs.copyFileSync(committedRegistryPath, registryPath);
  checkoutOverrides["/data/research-library/documents.json"] = registryPath;
  // The bytes of the committed evidence records live outside Git. They are copied in so that reading the
  // registered VIX report back is a real test of the service, not a fixture: if they are absent the download
  // assertions below fail loudly, which is the honest outcome.
  const committedObjects = path.join(rootDir, ".local", "research-library", "objects");
  if (fs.existsSync(committedObjects)) {
    fs.cpSync(committedObjects, path.join(libraryRoot, "objects"), { recursive: true });
  } else {
    process.stderr.write(`warning: ${committedObjects} is absent, so the stored VIX report cannot be read back\n`);
  }
  const committedRegistryHash = sha256(fs.readFileSync(committedRegistryPath));
  const committedRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  let activeService = createServiceServer({ token: TOKEN, libraryRoot, registryPath, catalogPath });
  const servicePort = await listenSafe(activeService.server);
  let serviceBase = `http://127.0.0.1:${servicePort}`;

  const reviewContent = [
    "# VIX research report - independent red-team review",
    "",
    "Reviewed topic: usd-topic-vix-level-and-risk-regime",
    `Reviewed document: ${VIX_RESEARCH_DOCUMENT}`,
    "Reviewed version: 1",
    `Reviewed sha256: ${VIX_RESEARCH_SHA}`,
    "",
    "## Issue register",
    "",
    "1. Claim: the level is informative. Verdict: NARROWED. Severity: material.",
    "2. Claim: the 1-day change predicts the next session. Verdict: NOT_SUPPORTED. Severity: fatal.",
    "",
    "## What survives unchanged",
    "",
    "- The measurement description of the index family.",
    "",
    "## What this review could not reach",
    "",
    "- The paid intraday source.",
    ""
  ].join("\n");
  const reviewFile = path.join(workDir, "vix-red-team-review.md");
  fs.writeFileSync(reviewFile, reviewContent, "utf8");

  const researchV2Content = "# VIX report, corrected\n\nThe level claim is narrowed; the one-day change claim is withdrawn.\n";
  const researchV2File = path.join(workDir, "vix-research-v2.md");
  fs.writeFileSync(researchV2File, researchV2Content, "utf8");

  const reviewV2Content = [
    "# VIX research report - independent red-team review of v2",
    "",
    "Reviewed topic: usd-topic-vix-level-and-risk-regime",
    `Reviewed document: ${VIX_RESEARCH_DOCUMENT}`,
    "Reviewed version: 2",
    `Reviewed sha256: ${sha256(researchV2Content)}`,
    "",
    "## Issue register",
    "",
    "1. The withdrawn one-day claim stays withdrawn. Verdict: SUPPORTED. Severity: material.",
    "",
    "## What this review could not reach",
    "",
    "- The paid intraday source.",
    ""
  ].join("\n");
  const reviewV2File = path.join(workDir, "vix-red-team-review-v2.md");
  fs.writeFileSync(reviewV2File, reviewV2Content, "utf8");

  const adjudicationContent = [
    "# VIX factor adjudication",
    "",
    `Reviewed document: ${VIX_RESEARCH_DOCUMENT}`,
    "Reviewed version: 2",
    "",
    "## Decision on every material objection",
    "",
    "- The level remains informative but narrowed.",
    "- The one-day change claim is withdrawn.",
    "",
    "## Handoff to central USD synthesis",
    "",
    "Use the narrowed level claim; do not split the difference on the withdrawn claim.",
    ""
  ].join("\n");
  const adjudicationFile = path.join(workDir, "vix-adjudication.md");
  fs.writeFileSync(adjudicationFile, adjudicationContent, "utf8");

  const externalRequests = [];
  const externalAfterPanelOpened = [];
  let auditPhase = "baseline";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"]
  });
  const page = await context.newPage();
  page.on("request", request => {
    const url = request.url();
    const allowed = url.startsWith(checkoutBase) || url.startsWith(serviceBase) || url.startsWith("data:") || url.startsWith("blob:");
    if (allowed) return;
    externalRequests.push(url);
    // The dashboard already talks to Supabase research views and Google Fonts before this panel is opened;
    // what must stay true is that opening and using the panel adds no new external destination.
    if (auditPhase === "library") externalAfterPanelOpened.push(url);
  });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const audit = {};
  const setService = async (endpoint, token) => {
    await page.evaluate(([theEndpoint, theToken]) => {
      window.localStorage.setItem("research-library-service-endpoint", theEndpoint);
      window.localStorage.setItem("research-library-service-token", theToken);
    }, [endpoint, token]);
  };
  const openFactor = async (factorId) => {
    await page.click(`[data-rl-factor='${factorId}']`);
    await page.waitForSelector(`[data-rl-factor-stages='${factorId}'] [data-rl-stage='research']`, { timeout: 20000 });
  };
  const openLibrary = async () => {
    // The dashboard makes its own Supabase and font requests on every load. Those are baseline traffic, not
    // something this panel added, so the phase is reset around each navigation and only the interval between
    // the page settling and the panel being used is counted.
    auditPhase = "baseline";
    await page.goto(checkoutBase, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    auditPhase = "library";
    await page.getByRole("button", { name: "Research Library" }).click();
    await page.waitForSelector("[data-rl-shell='true']", { timeout: 20000 });
  };

  try {
    await page.goto(checkoutBase, { waitUntil: "networkidle" });
    await setService(serviceBase, TOKEN);
    await openLibrary();
// CHUNK-END-2

    // The factor table is the single factor list: twenty-five rows, no topic cards, chain cards or tasks.
    assert.deepEqual(await page.$$eval("[data-rl-topic]", nodes => nodes.length), 0, "topic cards must not be shown");
    assert.deepEqual(await page.$$eval("[data-rl-chain]", nodes => nodes.length), 0, "duplicate chain cards must not be shown");
    assert.equal(await page.$$eval("[data-rl-task]", nodes => nodes.length), 0, "legacy task cards must not be shown");
    assert.equal(await page.$$eval("[data-rl-secondary-head]", nodes => nodes.length), 0, "the secondary section must not be shown");
    const factorRows = await page.$$eval("[data-rl-factor-table] tr[data-rl-factor]", nodes => nodes.map(node => ({
      factor: node.getAttribute("data-rl-factor"),
      complete: node.getAttribute("data-rl-factor-complete"),
      expanded: node.getAttribute("aria-expanded")
    })));
    assert.equal(factorRows.length, 25, "the table is the one factor list and carries all 25 factors");
    assert.equal(factorRows.every(entry => entry.expanded === "false"), true, "every factor starts closed");
    assert.equal(await page.$$eval("[data-rl-factor-stages]", nodes => nodes.length), 0, "no stage list is open before a row is clicked");
    audit.factorRows = { count: factorRows.length, complete: factorRows.filter(entry => entry.complete === "true").length };

    // Clicking a factor opens that factor's three stages directly underneath its row.
    await openFactor("live.f1-vix-level");
    assert.equal(await page.$eval("[data-rl-factor='live.f1-vix-level']", node => node.getAttribute("aria-expanded")), "true");
    assert.equal(await page.$$eval("[data-rl-factor-expansion]", nodes => nodes.length), 1, "only the clicked factor opens");
    audit.expandedFactor = "live.f1-vix-level";

    // The final analysis is offered only behind the registry gate. With no complete factor chain it is shut,
    // and neither its prompt nor an upload is rendered.
    const finalGate = await page.$eval("[data-rl-final-chain]", node => ({
      unlocked: node.getAttribute("data-rl-final-unlocked"),
      gate: node.getAttribute("data-rl-final-gate"),
      pending: node.getAttribute("data-rl-final-pending"),
      delivered: node.getAttribute("data-rl-final-delivered"),
      next: node.getAttribute("data-rl-final-next"),
      state: node.getAttribute("data-rl-final-state")
    }));
    assert.equal(finalGate.unlocked, "false", "the final chain must be locked while factor chains are incomplete");
    assert.equal(finalGate.pending, "25", "every factor chain is pending at the start");
    assert.equal(finalGate.gate, "0/25");
    assert.equal(finalGate.delivered, "0/3", "the final chain carries three stages, not two");
    assert.equal(finalGate.next, "final_analysis");
    assert.equal(finalGate.state, "locked");
    assert.deepEqual(
      await page.evaluate(() => window.ResearchLibrary.FINAL_CHAIN_STAGES.slice()),
      ["final_analysis", "final_red_team", "final_adjudication"],
      "the page's library exposes the corrected three-stage final workflow"
    );
    assert.ok(await page.$("[data-rl-final-locked]"), "the shut chain must say why it is shut");
    assert.equal((await page.$$("[data-rl-final-chain] [data-rl-stage]")).length, 0, "a shut final chain must render no stage");
    audit.finalGate = finalGate;

    const stageStates = () => page.$$eval("[data-rl-factor-stages='live.f1-vix-level'] [data-rl-stage]", nodes => nodes.map(node => ({
      stage: node.getAttribute("data-rl-stage"),
      state: node.getAttribute("data-rl-stage-state"),
      pill: (node.querySelector("[data-rl-stage-pill]")?.textContent || "").trim(),
      input: node.getAttribute("data-rl-stage-input") || "",
      inputVersion: node.getAttribute("data-rl-stage-input-version") || "",
      inputHash: node.getAttribute("data-rl-stage-input-hash") || "",
      document: node.getAttribute("data-rl-stage-document") || "",
      version: node.getAttribute("data-rl-stage-version") || "",
      hash: node.getAttribute("data-rl-stage-hash") || "",
      text: node.textContent.replace(/\s+/g, " ").trim()
    })));
    let stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.stage), ["research", "red_team", "adjudication"]);
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "awaiting_upload", "not_started"],
      "initial stage display must be research delivered, red-team awaiting the file, adjudication not started");
    assert.equal(stages[0].pill, "Delivered");
    assert.equal(stages[1].pill, "Awaiting upload");
    assert.equal(stages[0].document, VIX_RESEARCH_DOCUMENT, "stage 1 must carry its registered document");
    assert.equal(stages[0].hash, VIX_RESEARCH_SHA, "and the hash the reader will verify");
    assert.equal(stages[1].input, VIX_RESEARCH_DOCUMENT, "stage 2 must attach the research document it judges");
    assert.equal(stages[1].inputVersion, "1", "and its exact version");
    assert.equal(stages[1].inputHash, VIX_RESEARCH_SHA, "and the hash of that version");
    assert.equal(await page.$eval("[data-rl-factor='live.f1-vix-level']", node => node.getAttribute("data-rl-ready-for-synthesis")), "false");
    assert.equal(await page.$eval("[data-rl-factor='live.f1-vix-level']", node => node.classList.contains("is-complete")), false,
      "a chain with one of three results is not green");
    audit.stageStates = stages.map(entry => `${entry.stage}=${entry.state}`);

    await page.waitForFunction(() => document.querySelector("[data-rl-service-state]")?.getAttribute("data-rl-service-state") === "connected", null, { timeout: 15000 });
    audit.serviceState = "connected";

    // Stage 1 copies the whole dispatched VIX assignment, and never the legacy reviewer task.
    await page.click("[data-rl-stage='research'] [data-rl-copy-stage-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("Research prompt for"));
    const researchPrompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(researchPrompt.startsWith("# F1 VIX level and risk regime - live.f1-vix-level - stage 1 of 3: Research"), "the copied prompt must be the VIX factor-chain assignment");
    assert.ok(researchPrompt.includes("USD-BASELINE-AUDIT-01"), "the dispatched task is named");
    assert.ok(researchPrompt.includes("A comprehensive, source-backed report investigating how VIX"), "the assignment body must be in the prompt");
    assert.ok(researchPrompt.includes(VIX_TOPIC), "the topic is named");
    assert.ok(researchPrompt.includes("05:00 Europe/London"), "the cutoff is stated");
    assert.ok(researchPrompt.length > 20000, `the full assignment must be copied, saw ${researchPrompt.length} characters`);
    const a3Prompt = ResearchLibrary.taskById(JSON.parse(fs.readFileSync(catalogPath, "utf8")), "USD-SESSION-A3").prompt;
    assert.equal(researchPrompt.includes(a3Prompt.slice(0, 60)), false, "stage 1 must not copy the legacy reviewer task");

    // Stage 2 copies the red-team assignment; stage 3 the adjudication assignment.
    await page.click("[data-rl-stage='red_team'] [data-rl-copy-stage-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("Red-team prompt for"));
    const redTeamPrompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(redTeamPrompt.startsWith("# F1 VIX level and risk regime - live.f1-vix-level - stage 2 of 3: Red-team"));
    assert.ok(redTeamPrompt.includes("## Independence rules"));
    assert.ok(redTeamPrompt.includes("SUPPORTED"));
    assert.ok(redTeamPrompt.includes("Reviewed document:"), "the return names the factor chain and the registered version it judges");
    await page.click("[data-rl-stage='adjudication'] [data-rl-copy-stage-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("Adjudication prompt for"));
    const adjudicationPrompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(adjudicationPrompt.includes("## What the adjudication must contain"));
    assert.ok(adjudicationPrompt.includes("Handoff to central USD synthesis"));
    assert.ok(adjudicationPrompt.includes("do not split the difference"));
    audit.stagePromptLengths = [researchPrompt.length, redTeamPrompt.length, adjudicationPrompt.length];

    // The exact research version to attach downloads byte for byte.
    const attachWait = page.waitForEvent("download");
    await page.click(`[data-rl-stage='red_team'] [data-rl-download='${VIX_RESEARCH_DOCUMENT}']`);
    const attachPath = path.join(workDir, "attach-v1.md");
    await (await attachWait).saveAs(attachPath);
    assert.equal(sha256(fs.readFileSync(attachPath)), VIX_RESEARCH_SHA, "the attached research version must be the registered v1");
    audit.attachHashMatches = true;
// CHUNK-END-3

    // One Markdown upload for stage 2. The page writes the topic, the stage and the version judged.
    await page.click("[data-rl-stage='red_team'] [data-rl-upload-toggle]");
    await page.waitForSelector("[data-rl-stage='red_team'] [data-rl-upload-file]");
    await page.setInputFiles("[data-rl-stage='red_team'] [data-rl-upload-file]", reviewFile);
    await page.fill("[data-rl-stage='red_team'] [data-rl-upload-model]", "Astra red-team (browser test)");
    await page.click("[data-rl-stage='red_team'] [data-rl-stage-upload]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("registered as"), null, { timeout: 20000 });
    const registrationMessage = await page.$eval("[data-rl-message]", node => node.textContent.trim());
    assert.ok(registrationMessage.includes("no factor status, weight, threshold or live call moved"), "the page must say what an upload is not");

    const registered = JSON.parse(fs.readFileSync(registryPath, "utf8"))
      .documents.find(entry => entry.topic_id === VIX_TOPIC && entry.stage === "red_team");
    assert.ok(registered, "the review must be registered against its topic and stage");
    assert.equal(registered.document_type, "review");
    assert.equal(registered.parent_document_id, VIX_RESEARCH_DOCUMENT, "and must name the research version it judged");
    assert.equal(registered.parent_version, 1);
    assert.equal(registered.parent_sha256, VIX_RESEARCH_SHA);
    assert.equal(registered.public_download, false, "an uploaded review is not published");
    assert.equal(registered.model, "Astra red-team (browser test)");
    assert.equal(registered.versions[0].sha256, sha256(reviewContent));
    assert.equal(registered.versions[0].bytes, Buffer.byteLength(reviewContent, "utf8"));
    audit.uploadLinkage = { document_id: registered.document_id, parent: registered.parent_document_id, reviewed_version: registered.parent_version };

    stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "delivered", "awaiting_upload"],
      "stage 2 must read delivered once its file is registered, and stage 3 opens behind it");
    assert.ok(stages[1].text.includes(`Inputs ${VIX_RESEARCH_DOCUMENT} v1`), "and must state which research version it judged");
    assert.equal(await page.$eval("[data-rl-ready-for-synthesis]", node => node.getAttribute("data-rl-ready-for-synthesis")), "false",
      "two of three stages is not ready for synthesis");

    // The factor entries' three statuses are exactly what they were: an upload is not progress.
    const f1Row = await page.$eval("[data-rl-factor-table] [data-rl-factor='live.f1-vix-level']", node => node.textContent.replace(/\s+/g, " ").trim());
    ["Ready", "Pending", "Not tested"].forEach(label => assert.ok(f1Row.includes(label), `the factor's ${label} status must be unchanged, saw: ${f1Row}`));
    audit.factorStatusesUnchanged = true;

    // Download delivers the whole uploaded document, read through the local service.
    const reviewWait = page.waitForEvent("download");
    await page.click(`[data-rl-stage='red_team'] [data-rl-download='${registered.document_id}']`);
    const reviewPath = path.join(workDir, "review-downloaded.md");
    await (await reviewWait).saveAs(reviewPath);
    assert.equal(sha256(fs.readFileSync(reviewPath)), sha256(reviewContent), "Download must deliver the bytes the registry hashed");
    audit.reviewRoundTrip = true;

    // Persistence across a refresh: the registry is the record, so the stages still read the same.
    await openLibrary();
    await openFactor("live.f1-vix-level");
    stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "delivered", "awaiting_upload"], "a refresh must not lose a registered stage");
    audit.persistedAfterRefresh = true;

    // Persistence across a service restart: a second process over the same library serves the same bytes.
    await new Promise(resolve => activeService.server.close(resolve));
    activeService = createServiceServer({ token: TOKEN, libraryRoot, registryPath, catalogPath });
    serviceBase = `http://127.0.0.1:${await listenSafe(activeService.server)}`;
    await setService(serviceBase, TOKEN);
    await openLibrary();
    await openFactor("live.f1-vix-level");
    await page.waitForFunction(() => document.querySelector("[data-rl-service-state]")?.getAttribute("data-rl-service-state") === "connected", null, { timeout: 15000 });
    const restartWait = page.waitForEvent("download");
    await page.click(`[data-rl-stage='red_team'] [data-rl-download='${registered.document_id}']`);
    const restartPath = path.join(workDir, "review-after-restart.md");
    await (await restartWait).saveAs(restartPath);
    assert.equal(sha256(fs.readFileSync(restartPath)), sha256(reviewContent), "a restarted service must serve the same bytes");
    stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "delivered", "awaiting_upload"], "the stages must still read the same");
    audit.persistedAfterRestart = true;

    // A revised research report keeps v1 immutable and flags the review that judged it for reassessment.
    await page.click("[data-rl-stage='research'] [data-rl-upload-toggle]");
    await page.waitForSelector("[data-rl-stage='research'] [data-rl-upload-file]");
    await page.setInputFiles("[data-rl-stage='research'] [data-rl-upload-file]", researchV2File);
    await page.fill("[data-rl-stage='research'] [data-rl-upload-model]", "Astra deep research (v2, browser test)");
    await page.click("[data-rl-stage='research'] [data-rl-stage-upload]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("registered as"), null, { timeout: 20000 });
    const researchRecord = JSON.parse(fs.readFileSync(registryPath, "utf8")).documents.find(entry => entry.document_id === VIX_RESEARCH_DOCUMENT);
    assert.equal(researchRecord.versions.length, 2, "a corrected report becomes version 2 of the same stage document");
    assert.equal(researchRecord.versions[0].sha256, VIX_RESEARCH_SHA, "and version 1 stays immutable");
    assert.equal(researchRecord.versions[1].sha256, sha256(researchV2Content));
    stages = await stageStates();
    assert.equal(stages[0].state, "delivered");
    assert.ok(stages[0].text.includes("v2"), "stage 1 must read version 2");
    assert.equal(stages[1].state, "reassessment_required", "a review of an earlier version must be flagged, not settled");
    assert.ok(stages[1].text.includes("run again"), "and the page must say why");
    assert.equal(await page.$eval("[data-rl-ready-for-synthesis]", node => node.getAttribute("data-rl-ready-for-synthesis")), "false");
    audit.revisionFlaggedReview = true;

    // The published page, with no token anywhere: it reads the same record, it distinguishes a missing
    // document from one whose bytes need the service, and it never offers an upload it cannot perform.
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const publicPage = await publicContext.newPage();
    await publicPage.goto(checkoutBase, { waitUntil: "networkidle" });
    await publicPage.getByRole("button", { name: "Research Library" }).click();
    await publicPage.waitForSelector("[data-rl-factor='live.f1-vix-level']", { timeout: 20000 });
    await publicPage.click("[data-rl-factor='live.f1-vix-level']");
    await publicPage.waitForSelector("[data-rl-factor-stages='live.f1-vix-level'] [data-rl-stage]", { timeout: 20000 });
    const publicStages = await publicPage.$$eval("[data-rl-stage]", nodes => nodes.map(node => ({
      stage: node.getAttribute("data-rl-stage"),
      state: node.getAttribute("data-rl-stage-state")
    })));
    assert.deepEqual(publicStages.map(entry => entry.state), ["delivered", "reassessment_required", "awaiting_upload"],
      "the published page reads the same registry record");
    await publicPage.click("[data-rl-stage='red_team'] [data-rl-upload-toggle]");
    await publicPage.waitForSelector("[data-rl-stage='red_team'] [data-rl-stage-upload]");
    // The published page carries the private store's sign-in block, and refuses to offer registration until a
    // session exists: the reader is told to sign in rather than being handed a button that cannot work.
    assert.ok(await publicPage.$("[data-rl-account-card]"), "the published page carries the private-store sign-in block");
    assert.match(await publicPage.$eval("[data-rl-account-card]", node => node.textContent), /Sign in/);
    assert.equal(await publicPage.$eval("[data-rl-stage='red_team'] [data-rl-stage-upload]", node => node.disabled), true,
      "a signed-out reader is asked to sign in before a register control is offered");
    const publicNote = await publicPage.$eval("[data-rl-stage='red_team'] [data-rl-upload-form]", node => node.textContent.replace(/\s+/g, " "));
    assert.ok(publicNote.includes("Sign in above"), "and the form says where to sign in");
    assert.equal(await publicPage.$$eval("[data-rl-view]", nodes => nodes.length), 0,
      "the stage controls are prompts, inputs, upload and result download; there is no separate view action");
    audit.publishedPageHonest = true;
    await publicContext.close();

    // Factor rows are isolated: opening the sibling VIX factor shows its own empty three stages, even though
    // the first factor has a registered research report under the same topic.
    await page.click("[data-rl-factor='risk.vix-level-and-change-at-cutoff']");
    await page.waitForSelector("[data-rl-factor-stages='risk.vix-level-and-change-at-cutoff'] [data-rl-stage]", { timeout: 15000 });
    const siblingStages = await page.$$eval("[data-rl-factor-stages='risk.vix-level-and-change-at-cutoff'] [data-rl-stage]", nodes => nodes.map(node => ({
      stage: node.getAttribute("data-rl-stage"),
      state: node.getAttribute("data-rl-stage-state")
    })));
    assert.deepEqual(siblingStages.map(entry => entry.stage), ["research", "red_team", "adjudication"]);
    assert.deepEqual(siblingStages.map(entry => entry.state), ["not_started", "not_started", "not_started"],
      "a sibling factor must not read another factor's documents");
    assert.equal(await page.$eval("[data-rl-factor='live.f1-vix-level']", node => node.getAttribute("aria-expanded")), "false",
      "opening one factor closes the one before it");
    audit.chainIsolation = siblingStages.map(entry => `${entry.stage}=${entry.state}`);
    await openFactor("live.f1-vix-level");

    // The legacy task cards and duplicate chain board are gone; the table is the one factor list.
    assert.equal(await page.$$eval("[data-rl-task]", nodes => nodes.length), 0, "legacy task cards are not part of the workflow");
    assert.equal(await page.$$eval("[data-rl-secondary-head]", nodes => nodes.length), 0, "there is no secondary legacy section");
    assert.equal(await page.$$eval("[data-rl-topic]", nodes => nodes.length), 0, "topic cards are gone");
    assert.equal(await page.$$eval("[data-rl-chain]", nodes => nodes.length), 0, "duplicate chain cards are gone");
    const factorRowCount = await page.$$eval("[data-rl-factor-table] tr[data-rl-factor]", nodes => nodes.length);
    assert.equal(factorRowCount, 25, "the factor table carries all 25 factors");
    for (const kind of ["research", "review", "backtest"]) {
      const count = await page.$$eval(`[data-rl-status='${kind}']`, nodes => nodes.length);
      assert.ok(count > 0, `${kind} status column must be rendered`);
      audit[`${kind}Pills`] = count;
    }
// CHUNK-END-6

    // A factor chain is green only when all three stages are delivered. Finish the revised VIX chain and
    // confirm the row turns green while the final chain still waits for the other 24 factors.
    await page.click("[data-rl-stage='red_team'] [data-rl-upload-toggle]");
    await page.waitForSelector("[data-rl-stage='red_team'] [data-rl-upload-file]");
    await page.setInputFiles("[data-rl-stage='red_team'] [data-rl-upload-file]", reviewV2File);
    await page.fill("[data-rl-stage='red_team'] [data-rl-upload-model]", "Astra red-team v2 (browser test)");
    await page.click("[data-rl-stage='red_team'] [data-rl-stage-upload]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("registered as"), null, { timeout: 20000 });
    await page.click("[data-rl-stage='adjudication'] [data-rl-upload-toggle]");
    await page.waitForSelector("[data-rl-stage='adjudication'] [data-rl-upload-file]");
    await page.setInputFiles("[data-rl-stage='adjudication'] [data-rl-upload-file]", adjudicationFile);
    await page.fill("[data-rl-stage='adjudication'] [data-rl-upload-model]", "Astra adjudication (browser test)");
    await page.click("[data-rl-stage='adjudication'] [data-rl-stage-upload]");
    await page.waitForFunction(() => {
      const row = document.querySelector("[data-rl-factor='live.f1-vix-level']");
      return row?.getAttribute("data-rl-factor-complete") === "true";
    }, null, { timeout: 20000 });
    stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "delivered", "delivered"],
      "all three registered results make the factor chain complete");
    assert.equal(await page.$eval("[data-rl-factor='live.f1-vix-level']", node => node.classList.contains("is-complete")), true,
      "the complete factor row is green");
    assert.equal(await page.$eval("[data-rl-factor='live.f1-vix-level']", node => node.getAttribute("data-rl-ready-for-synthesis")), "true");
    const finalAfterOne = await page.$eval("[data-rl-final-chain]", node => ({
      unlocked: node.getAttribute("data-rl-final-unlocked"),
      gate: node.getAttribute("data-rl-final-gate"),
      pending: node.getAttribute("data-rl-final-pending")
    }));
    assert.equal(finalAfterOne.unlocked, "false", "one complete factor does not unlock the final analysis");
    assert.equal(finalAfterOne.gate, "1/25");
    assert.equal(finalAfterOne.pending, "24");
    audit.completeFactorRow = { green: true, finalGate: finalAfterOne.gate };

    // The factor table still spans the panel, and the panel still fits a narrow viewport.
    audit.desktopTableWidth = await page.evaluate(() => {
      const widthOf = selector => {
        const element = document.querySelector(selector);
        return element ? Math.round(element.getBoundingClientRect().width) : null;
      };
      const scroll = document.querySelector("[data-rl-factor-table-wrap='true'] .rl-table-scroll");
      return {
        shell: widthOf("[data-rl-shell='true']"),
        table: widthOf("[data-rl-factor-table-wrap='true']"),
        scrollOverflowPx: scroll ? scroll.scrollWidth - scroll.clientWidth : null
      };
    });
    assert.ok(audit.desktopTableWidth.table >= audit.desktopTableWidth.shell - 1,
      `the factor table must span the panel, saw ${audit.desktopTableWidth.table} of ${audit.desktopTableWidth.shell}px`);
    assert.equal(audit.desktopTableWidth.scrollOverflowPx, 0, "the factor table must not scroll sideways");
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    audit.narrowOverflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(audit.narrowOverflowPx <= 1, `the panel must not overflow at 390px, saw ${audit.narrowOverflowPx}px`);
    audit.narrowShellColumns = await page.evaluate(() => getComputedStyle(document.querySelector("[data-rl-shell='true']")).gridTemplateColumns);
    assert.equal(audit.narrowShellColumns.trim().split(/\s+/).length, 1, "below 1181px the panel must be one column");
    await page.setViewportSize({ width: 1440, height: 1000 });

    // The panel reached nothing but this checkout and the local service, and the live feed is untouched.
    assert.deepEqual(externalAfterPanelOpened, [], `the panel must add no external destination, saw: ${externalAfterPanelOpened.join(", ")}`);
    const liveFeedRequests = checkoutRequests.filter(entry => entry.includes("layer1.json") || entry.includes("layer2.json"));
    assert.ok(liveFeedRequests.length >= 1, "the live layer1 feed the dashboard already asks for must still be requested");
    audit.liveFeedRequests = liveFeedRequests;

    // A dashboard served from somewhere other than the service (the published page, another checkout) reads a
    // registry copy the service never writes. That was the reported failure: the upload succeeded, the panel
    // closed the form and kept saying "Awaiting upload" with no error. The service's manifest is now read as
    // well, a refusal is shown in the form with the file and details kept, and the stored file is readable.
    const staleWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "rl-stale-page-"));
    const staleRegistryPath = path.join(staleWorkDir, "service-documents.json");
    const staleSnapshotPath = path.join(staleWorkDir, "page-documents.json");
    fs.copyFileSync(committedRegistryPath, staleRegistryPath);
    fs.copyFileSync(committedRegistryPath, staleSnapshotPath);
    const staleLibraryRoot = path.join(staleWorkDir, "library");
    fs.cpSync(path.join(rootDir, ".local", "research-library", "objects"), path.join(staleLibraryRoot, "objects"), { recursive: true });
    const staleService = createServiceServer({ token: TOKEN, libraryRoot: staleLibraryRoot, registryPath: staleRegistryPath, catalogPath });
    const staleServicePort = await listenSafe(staleService.server);
    const staleOverrides = { "/data/research-library/documents.json": staleSnapshotPath };
    const staleServer = serveRepo([], staleOverrides);
    const stalePort = await listenSafe(staleServer);
    const staleBase = `http://127.0.0.1:${stalePort}`;
    const staleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const stalePage = await staleContext.newPage();
    const staleErrors = [];
    stalePage.on("pageerror", error => staleErrors.push(error.message));
    try {
      await stalePage.goto(staleBase, { waitUntil: "networkidle" });
      await stalePage.evaluate(([endpoint, token]) => {
        window.localStorage.setItem("research-library-service-endpoint", endpoint);
        window.localStorage.setItem("research-library-service-token", token);
      }, [`http://127.0.0.1:${staleServicePort}`, TOKEN]);
      await stalePage.goto(staleBase, { waitUntil: "networkidle" });
      await stalePage.getByRole("button", { name: "Research Library" }).click();
      await stalePage.waitForSelector("[data-rl-shell='true']", { timeout: 20000 });
      await stalePage.click("[data-rl-factor='live.f1-vix-level']");
      await stalePage.waitForSelector("[data-rl-factor-stages='live.f1-vix-level'] [data-rl-stage='red_team']", { timeout: 15000 });
      await stalePage.waitForFunction(() => document.querySelector("[data-rl-service-state]")?.getAttribute("data-rl-service-state") === "connected", null, { timeout: 15000 });

      // A refusal names the missing field, and the chosen file stays in the form.
      await stalePage.click("[data-rl-factor-stages='live.f1-vix-level'] [data-rl-stage='research'] [data-rl-upload-toggle]");
      await stalePage.waitForSelector("[data-rl-stage='research'] [data-rl-upload-file]");
      await stalePage.setInputFiles("[data-rl-stage='research'] [data-rl-upload-file]", researchV2File);
      await stalePage.click("[data-rl-stage='research'] [data-rl-stage-upload]");
      await stalePage.waitForSelector("[data-rl-stage='research'] [data-rl-upload-error]:not([hidden])");
      const refusal = await stalePage.$eval("[data-rl-stage='research'] [data-rl-upload-error]", node => node.textContent.trim());
      assert.ok(refusal.includes("Name the model or session"), `a refusal must name the missing field, saw: ${refusal}`);
      assert.equal(await stalePage.$eval("[data-rl-stage='research'] [data-rl-upload-file]", node => node.files.length), 1,
        "the chosen file must stay selected after a refusal");
      assert.equal(await stalePage.$eval("[data-rl-stage='research']", node => node.getAttribute("data-rl-stage-state")), "delivered",
        "a refused upload must change no stage");
      assert.equal(JSON.parse(fs.readFileSync(staleRegistryPath, "utf8")).documents.filter(entry => entry.stage === "research").length, 1,
        "a refused upload must write nothing");
      audit.refusalKeepsForm = true;
      await stalePage.click("[data-rl-stage='research'] [data-rl-upload-toggle]");
      // The real upload: the page's registry copy cannot show it, so the service's own record must.
      await stalePage.click("[data-rl-stage='red_team'] [data-rl-upload-toggle]");
      await stalePage.waitForSelector("[data-rl-stage='red_team'] [data-rl-upload-file]");
      await stalePage.setInputFiles("[data-rl-stage='red_team'] [data-rl-upload-file]", reviewFile);
      await stalePage.fill("[data-rl-stage='red_team'] [data-rl-upload-model]", "Astra red-team (stale page test)");
      await stalePage.click("[data-rl-stage='red_team'] [data-rl-stage-upload]");
      await stalePage.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("registered as"), null, { timeout: 20000 });
      await stalePage.waitForFunction(() => document.querySelector("[data-rl-stage='red_team']")?.getAttribute("data-rl-stage-state") === "delivered", null, { timeout: 20000 });
      const staleMessage = await stalePage.$eval("[data-rl-message]", node => node.textContent.trim());
      assert.ok(staleMessage.includes("registry copy"), "the page must say its registry copy is not the one the service wrote");
      assert.equal(await stalePage.$eval("[data-rl-stage='red_team'] [data-rl-stage-filename]", node => node.textContent.trim()), "vix-red-team-review.md",
        "the registered filename must be shown back on the stage card");
      const staleRecord = JSON.parse(fs.readFileSync(staleRegistryPath, "utf8")).documents.find(entry => entry.stage === "red_team");
      assert.equal(staleRecord.parent_document_id, VIX_RESEARCH_DOCUMENT, "the stored review must name the VIX research document");
      assert.equal(staleRecord.parent_version, 1);
      assert.equal(staleRecord.parent_sha256, VIX_RESEARCH_SHA);
      assert.equal(staleRecord.versions[0].original_filename, "vix-red-team-review.md");
      assert.equal(staleRecord.versions[0].sha256, sha256(reviewContent));

      // Download is offered from the delivered card, under the name the reader selected, with the stored bytes.
      const staleWait = stalePage.waitForEvent("download");
      await stalePage.click(`[data-rl-stage='red_team'] [data-rl-download='${staleRecord.document_id}']`);
      const staleDownload = await staleWait;
      assert.equal(staleDownload.suggestedFilename(), "vix-red-team-review.md");
      const stalePath = path.join(staleWorkDir, "stale-download.md");
      await staleDownload.saveAs(stalePath);
      assert.equal(sha256(fs.readFileSync(stalePath)), sha256(reviewContent));

      // Stage 3 names the red-team review as the input it judges, and downloads it under its stored name.
      const stage3Input = await stalePage.$eval("[data-rl-factor-stages='live.f1-vix-level'] [data-rl-stage='adjudication']", node => ({
        input: node.getAttribute("data-rl-stage-input"),
        version: node.getAttribute("data-rl-stage-input-version"),
        hash: node.getAttribute("data-rl-stage-input-hash")
      }));
      assert.deepEqual(stage3Input, {
        input: staleRecord.document_id,
        version: "1",
        hash: sha256(reviewContent)
      }, "stage 3 must retrieve the red-team review registered in the private store");
      const stage3Wait = stalePage.waitForEvent("download");
      await stalePage.click(`[data-rl-stage='adjudication'] [data-rl-download='${staleRecord.document_id}']`);
      const stage3Download = await stage3Wait;
      assert.equal(stage3Download.suggestedFilename(), "vix-red-team-review.md", "stage 3 must download the stored review");
      // Acceptance is untouched: the factor still reads research ready, review pending, backtest not tested.
      const staleFactorRow = await stalePage.$eval("[data-rl-factor-table] [data-rl-factor='live.f1-vix-level']", node => node.textContent.replace(/\s+/g, " ").trim());
      ["Ready", "Pending", "Not tested"].forEach(label => assert.ok(staleFactorRow.includes(label), `the factor's ${label} status must be unchanged, saw: ${staleFactorRow}`));
      assert.equal(await stalePage.$eval("[data-rl-final-chain]", node => node.getAttribute("data-rl-final-unlocked")), "false", "the final chain gate stays shut");

      // A reload keeps the stage delivered, because the service manifest is read again.
      await stalePage.reload({ waitUntil: "networkidle" });
      await stalePage.getByRole("button", { name: "Research Library" }).click();
      await stalePage.waitForSelector("[data-rl-shell='true']", { timeout: 20000 });
      await stalePage.click("[data-rl-factor='live.f1-vix-level']");
      await stalePage.waitForSelector("[data-rl-factor-stages='live.f1-vix-level'] [data-rl-stage='red_team']", { timeout: 15000 });
      await stalePage.waitForFunction(() => document.querySelector("[data-rl-stage='red_team']")?.getAttribute("data-rl-stage-state") === "delivered", null, { timeout: 20000 });
      assert.equal(await stalePage.$eval("[data-rl-stage='red_team'] [data-rl-stage-filename]", node => node.textContent.trim()), "vix-red-team-review.md",
        "the filename must survive a reload");
      assert.deepEqual(staleErrors, [], `stale-page errors: ${staleErrors.join(" | ")}`);
      audit.stalePageManifest = { document_id: staleRecord.document_id, parent: staleRecord.parent_document_id, parent_version: staleRecord.parent_version };
    } finally {
      await staleContext.close();
      await new Promise(resolve => staleService.server.close(resolve));
      await new Promise(resolve => staleServer.close(resolve));
    }

    // Every upload in this run went to a temporary registry and object store: the committed evidence
    // records, and their hashes, are exactly what they were.
    assert.equal(sha256(fs.readFileSync(committedRegistryPath)), committedRegistryHash, "the committed registry must not change");
    assert.equal(JSON.parse(fs.readFileSync(committedRegistryPath, "utf8")).documents.length, committedRegistry.documents.length);

    assert.equal(JSON.parse(fs.readFileSync(committedRegistryPath, "utf8")).documents.length, committedRegistry.documents.length);
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
  } finally {
    await browser.close();
    await new Promise(resolve => activeService.server.close(resolve));
    await new Promise(resolve => repoServer.close(resolve));
    const auditPath = path.join(rootDir, "tmp", "research-library-browser-audit.json");
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.writeFileSync(auditPath, `${JSON.stringify({ ...audit, externalRequests, pageErrors }, null, 2)}\n`, "utf8");
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
