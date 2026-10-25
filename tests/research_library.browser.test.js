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

    // The chain board: six topic labels over the twenty-five factors, the dispatched VIX label first and active.
    const topics = await page.$$eval("[data-rl-topic]", nodes => nodes.map(node => node.getAttribute("data-rl-topic")));
    assert.equal(topics.length, 6, "the research map must offer six topics");
    assert.equal(topics[0], VIX_TOPIC, "the dispatched VIX topic comes first");
    assert.equal(await page.$eval("[data-rl-topic].active", node => node.getAttribute("data-rl-topic")), VIX_TOPIC);
    audit.topics = topics;

    // The topic is a grouping label. Under it each factor is its own chain, with three stages of its own.
    const chainRows = await page.$$eval("[data-rl-chain]", nodes => nodes.map(node => ({
      chain: node.getAttribute("data-rl-chain"),
      complete: node.getAttribute("data-rl-chain-complete"),
      count: node.querySelector("[data-rl-chain-count]")?.getAttribute("data-rl-chain-count") || "",
      toggle: Boolean(node.querySelector("[data-rl-chain-toggle]"))
    })));
    assert.deepEqual(chainRows.map(entry => entry.chain),
      ["usd-factor-live-f1-vix-level", "usd-factor-risk-vix-level-and-change-at-cutoff"],
      "the VIX topic must render one row per factor chain");
    assert.equal(chainRows.every(entry => entry.toggle), true, "every chain row must be expandable");
    assert.equal(chainRows[0].complete, "false");
    assert.equal(chainRows[0].count, "1/3", "the delivered research stage is counted against the factor chain");
    assert.equal(chainRows[1].count, "0/3", "the sibling factor's chain must not inherit the first factor's document");
    audit.factorChains = chainRows;

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

    const stageStates = () => page.$$eval("[data-rl-stage]", nodes => nodes.map(node => ({
      stage: node.getAttribute("data-rl-stage"),
      state: node.getAttribute("data-rl-stage-state"),
      pill: (node.querySelector("[data-rl-stage-pill]")?.textContent || "").trim(),
      text: node.textContent.replace(/\s+/g, " ").trim()
    })));
    let stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.stage), ["research", "red_team", "adjudication"]);
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "awaiting_upload", "not_started"],
      "initial stage display must be research delivered, red-team awaiting the file, adjudication not started");
    assert.equal(stages[0].pill, "Delivered");
    assert.equal(stages[1].pill, "Awaiting upload");
    assert.ok(stages[0].text.includes(VIX_RESEARCH_DOCUMENT), "stage 1 must name its registered document");
    assert.ok(stages[0].text.includes("sha256 e4151937411e"), "and the hash the reader will see verified");
    assert.ok(stages[1].text.includes(VIX_RESEARCH_DOCUMENT) && stages[1].text.includes("v1"),
      "stage 2 must say which research version to attach");
    assert.ok(stages[1].text.includes("sha256 e4151937411e"), "and its hash");
    assert.equal(await page.$eval("[data-rl-ready-for-synthesis]", node => node.getAttribute("data-rl-ready-for-synthesis")), "false");
    audit.stageStates = stages.map(entry => `${entry.stage}=${entry.state}`);

    await page.waitForFunction(() => document.querySelector("[data-rl-service-state]")?.getAttribute("data-rl-service-state") === "connected", null, { timeout: 15000 });
    audit.serviceState = "connected";

    // Stage 1 copies the whole VIX assignment rendered by the versioned template, and never the legacy
    // reviewer task or a second, pasted brief.
    await page.click("[data-rl-stage='research'] [data-rl-copy-stage-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("copied"));
    const researchPrompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(researchPrompt.startsWith("# F1 VIX level and risk regime - live.f1-vix-level - USD stage 1 of 3: Research"), "the copied prompt must be the VIX factor-chain assignment");
    assert.ok(researchPrompt.includes("USD-BASELINE-AUDIT-01"), "the dispatched task is named");
    assert.ok(researchPrompt.includes("`research-prompt-v3.1.0`"), "the prompt names the template version it came from");
    assert.ok(researchPrompt.includes(VIX_TOPIC), "the group label is named");
    assert.ok(researchPrompt.includes("05:00 Europe/London"), "the cutoff is stated");
    assert.equal(researchPrompt.includes("stage card"), false, "no card instruction survives in the prompt");
    assert.ok(researchPrompt.length > 4000, `the full assignment must be copied, saw ${researchPrompt.length} characters`);
    const a3Prompt = ResearchLibrary.taskById(JSON.parse(fs.readFileSync(catalogPath, "utf8")), "USD-SESSION-A3").prompt;
    assert.equal(researchPrompt.includes(a3Prompt.slice(0, 60)), false, "stage 1 must not copy the legacy reviewer task");

    // Stage 2 copies the red-team assignment; stage 3 the adjudication assignment.
    await page.click("[data-rl-stage='red_team'] [data-rl-copy-stage-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("Red-team prompt"));
    const redTeamPrompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(redTeamPrompt.startsWith("# F1 VIX level and risk regime - live.f1-vix-level - USD stage 2 of 3: Red-team"));
    assert.ok(redTeamPrompt.includes("## Evidence standard"));
    assert.ok(redTeamPrompt.includes("Reviewed chain:"));
    assert.ok(redTeamPrompt.includes("issue register"), "the return names the factor chain and the document it judges");
    await page.click("[data-rl-stage='adjudication'] [data-rl-copy-stage-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("Adjudication prompt"));
    const adjudicationPrompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(adjudicationPrompt.includes("## Deliverable"));
    assert.ok(adjudicationPrompt.includes("Handoff to the asset synthesis"));
    assert.ok(adjudicationPrompt.includes("Required empirical tests and remaining blockers"));
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
    assert.ok(stages[1].text.includes(`Judged ${VIX_RESEARCH_DOCUMENT} v1`), "and must state which research version it judged");
    assert.equal(await page.$eval("[data-rl-ready-for-synthesis]", node => node.getAttribute("data-rl-ready-for-synthesis")), "false",
      "two of three stages is not ready for synthesis");

    // The factor entries' three statuses are exactly what they were: an upload is not progress.
    const f1Row = await page.$eval("[data-rl-factor-table] [data-rl-factor='live.f1-vix-level']", node => node.textContent.replace(/\s+/g, " ").trim());
    ["Ready", "Pending", "Not tested"].forEach(label => assert.ok(f1Row.includes(label), `the factor's ${label} status must be unchanged, saw: ${f1Row}`));
    audit.factorStatusesUnchanged = true;

    // View and Download deliver the whole uploaded document, read through the local service.
    const viewPagePromise = context.waitForEvent("page");
    await page.click(`[data-rl-stage='red_team'] [data-rl-view='${registered.document_id}']`);
    const viewPage = await viewPagePromise;
    await viewPage.waitForLoadState("domcontentloaded");
    const viewed = await viewPage.evaluate(() => document.body.innerText);
    assert.equal(viewed.replace(/\r\n/g, "\n").trim(), reviewContent.trim(), "View must show the full registered document");
    await viewPage.close();

    const reviewWait = page.waitForEvent("download");
    await page.click(`[data-rl-stage='red_team'] [data-rl-download='${registered.document_id}']`);
    const reviewPath = path.join(workDir, "review-downloaded.md");
    await (await reviewWait).saveAs(reviewPath);
    assert.equal(sha256(fs.readFileSync(reviewPath)), sha256(reviewContent), "Download must deliver the bytes the registry hashed");
    audit.reviewRoundTrip = true;

    // Persistence across a refresh: the registry is the record, so the stages still read the same.
    await openLibrary();
    await page.waitForSelector("[data-rl-stage]", { timeout: 20000 });
    stages = await stageStates();
    assert.deepEqual(stages.map(entry => entry.state), ["delivered", "delivered", "awaiting_upload"], "a refresh must not lose a registered stage");
    audit.persistedAfterRefresh = true;

    // Persistence across a service restart: a second process over the same library serves the same bytes.
    await new Promise(resolve => activeService.server.close(resolve));
    activeService = createServiceServer({ token: TOKEN, libraryRoot, registryPath, catalogPath });
    serviceBase = `http://127.0.0.1:${await listenSafe(activeService.server)}`;
    await setService(serviceBase, TOKEN);
    await openLibrary();
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
    assert.ok(stages[1].text.includes("superseded"), "and the page must say why");
    assert.equal(await page.$eval("[data-rl-ready-for-synthesis]", node => node.getAttribute("data-rl-ready-for-synthesis")), "false");
    audit.revisionFlaggedReview = true;

    // The published page, with no token anywhere: it reads the same record, it distinguishes a missing
    // document from one whose bytes need the service, and it never offers an upload it cannot perform.
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const publicPage = await publicContext.newPage();
    await publicPage.goto(checkoutBase, { waitUntil: "networkidle" });
    await publicPage.getByRole("button", { name: "Research Library" }).click();
    await publicPage.waitForSelector("[data-rl-stage]", { timeout: 20000 });
    const publicStages = await publicPage.$$eval("[data-rl-stage]", nodes => nodes.map(node => ({
      stage: node.getAttribute("data-rl-stage"),
      state: node.getAttribute("data-rl-stage-state")
    })));
    assert.deepEqual(publicStages.map(entry => entry.state), ["delivered", "reassessment_required", "awaiting_upload"],
      "the published page reads the same registry record");
    await publicPage.click("[data-rl-stage='red_team'] [data-rl-upload-toggle]");
    await publicPage.waitForSelector("[data-rl-stage='red_team'] [data-rl-stage-upload]");
    assert.equal(await publicPage.$eval("[data-rl-stage='red_team'] [data-rl-stage-upload]", node => node.disabled), true,
      "the published page must not offer an upload it cannot perform");
    const publicNote = await publicPage.$eval("[data-rl-stage='red_team']", node => node.textContent.replace(/\s+/g, " "));
    assert.ok(publicNote.includes("the local service must be connected"), "and must say what is missing");
    await publicPage.click(`[data-rl-stage='red_team'] [data-rl-view='${registered.document_id}']`);
    await publicPage.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("local service"), null, { timeout: 15000 });
    audit.publishedPageHonest = true;
    await publicContext.close();

    // Chains are isolated by factor: expanding the sibling VIX chain shows its own empty stages, even though
    // the first chain has a registered research report under the same topic.
    await page.click("[data-rl-chain='usd-factor-risk-vix-level-and-change-at-cutoff'] [data-rl-chain-toggle]");
    await page.waitForSelector("[data-rl-chain-body='usd-factor-risk-vix-level-and-change-at-cutoff'] [data-rl-stage]", { timeout: 15000 });
    const siblingStages = await page.$$eval("[data-rl-chain-body='usd-factor-risk-vix-level-and-change-at-cutoff'] [data-rl-stage]", nodes => nodes.map(node => ({
      stage: node.getAttribute("data-rl-stage"),
      state: node.getAttribute("data-rl-stage-state")
    })));
    assert.deepEqual(siblingStages.map(entry => entry.stage), ["research", "red_team", "adjudication"]);
    assert.deepEqual(siblingStages.map(entry => entry.state), ["not_started", "not_started", "not_started"],
      "a sibling factor chain must not read another factor's documents");
    await page.click("[data-rl-chain='usd-factor-live-f1-vix-level'] [data-rl-chain-toggle]");
    await page.waitForSelector("[data-rl-chain-body='usd-factor-live-f1-vix-level'] [data-rl-stage]", { timeout: 15000 });
    audit.chainIsolation = siblingStages.map(entry => `${entry.stage}=${entry.state}`);

    // The legacy material is still present, below the workflow and clearly marked as not the route.
    const legacyTasks = await page.$$eval("[data-rl-task]", nodes => nodes.map(node => node.getAttribute("data-rl-task")));
    assert.deepEqual(legacyTasks, ["USD-SESSION-A1", "USD-SESSION-A2", "USD-SESSION-A3", "USD-SESSION-A4", "USD-SESSION-A5"],
      "the legacy tasks are kept as history");
    assert.ok((await page.$eval("[data-rl-secondary-head]", node => node.textContent)).includes("Not the workflow"));
    const factorRows = await page.$$eval("[data-rl-factor-table] tbody tr", nodes => nodes.length);
    assert.equal(factorRows, 25, "the factor register stays complete in the secondary section");
    for (const kind of ["research", "review", "backtest"]) {
      const count = await page.$$eval(`[data-rl-status='${kind}']`, nodes => nodes.length);
      assert.ok(count > 0, `${kind} status column must be rendered`);
      audit[`${kind}Pills`] = count;
    }
// CHUNK-END-6

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

    // Every upload in this run went to the temporary registry and object store: the committed evidence
    // records, and their hashes, are exactly what they were.
    assert.equal(sha256(fs.readFileSync(committedRegistryPath)), committedRegistryHash, "the committed registry must not change");
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
