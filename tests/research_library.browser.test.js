"use strict";

// The Research Library panel in a real browser: the menu entry, the eight assets with USD first, the factor
// table and its three separate statuses, the filters, the factor detail page, copy prompt, download context
// package, a hash-verified repo download, and the upload path against the real local service on a temporary
// registry so no committed file is touched. The last checks are that the research addition reached nothing
// outside this checkout and the local service, and that the live feed the page already fetched is unchanged.

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

function serveRepo(requested) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    requested.push(urlPath);
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
  const repoServer = serveRepo(checkoutRequests);
  const checkoutPort = await listenSafe(repoServer);
  const checkoutBase = `http://127.0.0.1:${checkoutPort}`;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "rl-browser-"));
  const libraryRoot = path.join(workDir, "library");
  const registryPath = path.join(workDir, "documents.json");
  fs.copyFileSync(path.join(rootDir, "data", "research-library", "documents.json"), registryPath);
  // The committed registry is read once: it names every brief's file and the hash the page's download has to
  // match, and the temporary copy above is what the local service writes to.
  const committedRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const service = createServiceServer({
    token: TOKEN,
    libraryRoot,
    registryPath,
    catalogPath: path.join(rootDir, "data", "research-library", "catalog.json")
  });
  const servicePort = await listenSafe(service.server);
  const serviceBase = `http://127.0.0.1:${servicePort}`;

  const uploadFile = path.join(workDir, "a1-return.json");
  const uploadContent = `${JSON.stringify({ cards: [{ card_id: "fx.usd-session-momentum", verdict: "keep" }] }, null, 2)}\n`;
  fs.writeFileSync(uploadFile, uploadContent, "utf8");

  const externalRequests = [];
  const externalAfterPanelOpened = [];
  let auditPhase = "baseline";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"]
  });
  await context.addInitScript(([endpoint, token]) => {
    window.localStorage.setItem("research-library-service-endpoint", endpoint);
    window.localStorage.setItem("research-library-service-token", token);
  }, [serviceBase, TOKEN]);
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
  try {
    await page.goto(checkoutBase, { waitUntil: "networkidle" });
    auditPhase = "library";
    await page.getByRole("button", { name: "Research Library" }).click();
    await page.waitForSelector("[data-rl-shell='true']", { timeout: 20000 });

    const assets = await page.$$eval("[data-rl-asset]", nodes => nodes.map(node => node.getAttribute("data-rl-asset")));
    assert.equal(assets.length, 8, "the library must offer eight assets");
    assert.equal(assets[0], "USD", "USD must come first");
    assert.equal(await page.$eval("[data-rl-asset].active", node => node.getAttribute("data-rl-asset")), "USD");
    audit.assets = assets;

    const factorRows = await page.$$eval("[data-rl-factor-table] tbody tr", nodes => nodes.length);
    assert.ok(factorRows >= 25, `expected the USD factor table, saw ${factorRows} rows`);
    audit.factorRows = factorRows;
    for (const kind of ["research", "review", "backtest"]) {
      const count = await page.$$eval(`[data-rl-status='${kind}']`, nodes => nodes.length);
      assert.ok(count > 0, `${kind} status column must be rendered`);
      audit[`${kind}Pills`] = count;
    }
    const blockerLines = await page.$$eval(".rl-blocker-panel li", nodes => nodes.map(node => node.textContent.trim()));
    assert.ok(blockerLines.length >= 4, "the open blockers must be visible on the asset head");
    audit.blockers = blockerLines.length;

    const tasks = await page.$$eval("[data-rl-task]", nodes => nodes.map(node => node.getAttribute("data-rl-task")));
    assert.deepEqual(tasks, ["USD-SESSION-A1", "USD-SESSION-A2", "USD-SESSION-A3", "USD-SESSION-A4", "USD-SESSION-A5"]);
    audit.tasks = tasks;
    const engineDocuments = await page.$$eval("[data-rl-engine-document]", nodes => nodes.map(node => node.getAttribute("data-rl-engine-document")));
    assert.ok(engineDocuments.includes("usd-session-synthesis-v1"), "the whole-engine section must list the synthesis");
    assert.ok(engineDocuments.includes("usd-session-reviewer-b-report"), "the two reviews must be registered separately");
    audit.engineDocuments = engineDocuments;

    await page.waitForFunction(() => document.querySelector("[data-rl-service-state]")?.getAttribute("data-rl-service-state") === "connected", null, { timeout: 15000 });
    audit.serviceState = "connected";

    // Filters narrow the table, and the count says so.
    await page.selectOption("select[data-rl-filter='research']", "blocked");
    await page.waitForFunction(() => document.querySelectorAll("[data-rl-factor-table] tbody tr").length === 3);
    audit.filterCountText = await page.$eval("[data-rl-filter-count]", node => node.textContent.trim());
    await page.selectOption("select[data-rl-filter='research']", "all");
    await page.waitForFunction(() => document.querySelectorAll("[data-rl-factor-table] tbody tr").length > 10);
    await page.selectOption("select[data-rl-filter='group']", "live_engine");
    await page.waitForFunction(() => document.querySelectorAll("[data-rl-factor-table] tbody tr").length === 10);
    await page.selectOption("select[data-rl-filter='group']", "all");
    await page.waitForFunction(() => document.querySelectorAll("[data-rl-factor-table] tbody tr").length > 10);
    await page.fill("input[data-rl-query]", "safe-haven");
    await page.waitForFunction(() => document.querySelectorAll("[data-rl-factor-table] tbody tr").length === 1);
    audit.searchRows = await page.$$eval("[data-rl-factor-table] tbody tr", nodes => nodes.map(node => node.getAttribute("data-rl-factor")));
    await page.fill("input[data-rl-query]", "");
    await page.waitForFunction(() => document.querySelectorAll("[data-rl-factor-table] tbody tr").length > 10);

    // The factor detail page carries the brief, the current rules, the sources and the history.
    await page.click("[data-rl-factor='fx.usd-session-momentum']");
    await page.waitForSelector("[data-rl-factor-detail='fx.usd-session-momentum']");
    const detailText = await page.$eval("[data-rl-factor-detail]", node => node.textContent);
    ["Brief", "Current rules", "Sources", "History", "Reports"].forEach(heading => {
      assert.ok(detailText.includes(heading), `the factor detail page must show ${heading}`);
    });
    await page.click("[data-rl-back]");
    await page.waitForSelector("[data-rl-factor-table]");

    // Every one of the twenty-five factors offers its own published brief, and the count says so. The check
    // walks the table rather than trusting the registry count: a factor with no Copy prompt or no Download is
    // a factor without a brief, whatever the catalogue's total claims.
    const factorIds = await page.$$eval("[data-rl-factor-table] tbody tr", nodes => nodes.map(node => node.getAttribute("data-rl-factor")));
    assert.equal(factorIds.length, 25, `expected twenty-five USD factors, saw ${factorIds.length}`);
    const briefCoverage = await page.$eval("[data-rl-brief-coverage]", node => node.getAttribute("data-rl-brief-coverage"));
    assert.equal(briefCoverage, "25 of 25", `every factor must carry a brief, saw ${briefCoverage}`);
    audit.briefCoverage = briefCoverage;
    const missingBrief = [];
    for (const factorId of factorIds) {
      const expectedId = `usd-brief-${factorId.replace(/^live\./, "").replace(/\./g, "-")}`;
      await page.click(`[data-rl-factor='${factorId}']`);
      await page.waitForSelector(`[data-rl-factor-detail='${factorId}']`);
      const actions = await page.$eval(`[data-rl-factor-detail='${factorId}']`, node => {
        const row = node.querySelector("[data-rl-document]");
        return {
          copy: Boolean(node.querySelector("[data-rl-copy-brief]")),
          download: Boolean(node.querySelector("[data-rl-download]")),
          documentId: row ? row.getAttribute("data-rl-document") : ""
        };
      });
      if (!actions.copy || !actions.download || actions.documentId !== expectedId) missingBrief.push(factorId);
      await page.click("[data-rl-back]");
      await page.waitForSelector("[data-rl-factor-table]");
    }
    assert.deepEqual(missingBrief, [], "each factor must offer Copy prompt and Download for its own registered brief");
    audit.briefFactors = factorIds.length;

    // Copy prompt on a session brief writes that brief's own bytes, and Download writes the same file the
    // registry hashed: the two actions deliver the handoff bundle's pack, not a second copy of it.
    await page.click("[data-rl-factor='rates.real-yield-delta']");
    await page.waitForSelector("[data-rl-factor-detail='rates.real-yield-delta']");
    await page.click("[data-rl-document='usd-brief-rates-real-yield-delta'] [data-rl-copy-brief]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("copied"));
    const briefClipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(briefClipboard.startsWith("# Real yield delta - research brief pack (rates.real-yield-delta)"), "the copied text must be the factor's own brief");
    assert.ok(briefClipboard.includes("05:00 Europe/London"), "the copied brief states the session");
    assert.ok(briefClipboard.includes("## 7. What to return") && briefClipboard.includes("## 8. What to answer"), "the copied brief carries the prompt and the output instructions");
    audit.briefClipboardLength = briefClipboard.length;

    const briefWait = page.waitForEvent("download");
    await page.click("[data-rl-document='usd-brief-rates-real-yield-delta'] [data-rl-download]");
    const briefFile = await briefWait;
    const briefPath = path.join(workDir, "brief.md");
    await briefFile.saveAs(briefPath);
    const briefDocument = committedRegistry.documents.find(document => document.factor_id === "rates.real-yield-delta" && document.document_type === "brief");
    assert.ok(briefDocument, "the registry must carry the brief for the factor");
    assert.equal(sha256(fs.readFileSync(briefPath)), ResearchLibrary.latestVersion(briefDocument).sha256, "the downloaded brief must be the file the registry hashed");
    // Windows normalises line endings on the clipboard, so the comparison is made on the text itself.
    const normalize = text => text.replace(/\r\n/g, "\n");
    assert.equal(normalize(fs.readFileSync(briefPath, "utf8")), normalize(briefClipboard), "Copy prompt and Download must deliver the same brief");
    audit.briefDownloadHashMatches = true;
    await page.click("[data-rl-back]");
    await page.waitForSelector("[data-rl-factor-table]");
    await page.click("[data-rl-task='USD-SESSION-A1'] [data-rl-copy-prompt]");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("copied"));
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(clipboard.startsWith("TASK USD-SESSION-A1"), "the copied text must be the dispatched prompt");
    assert.ok(clipboard.includes("05:00 Europe/London"));
    assert.ok(clipboard.includes("research-card.schema.json"));
    audit.clipboardPrefix = clipboard.slice(0, 24);
    audit.clipboardLength = clipboard.length;

    // The context package downloads as one JSON document with the schema and the covered factors.
    const packageWait = page.waitForEvent("download");
    await page.click("[data-rl-task='USD-SESSION-A1'] [data-rl-context-package]");
    const packageFile = await packageWait;
    assert.equal(packageFile.suggestedFilename(), "USD-SESSION-A1.context-package.json");
    const packagePath = path.join(workDir, "package.json");
    await packageFile.saveAs(packagePath);
    const packagePayload = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert.equal(packagePayload.task_id, "USD-SESSION-A1");
    assert.equal(packagePayload.covers.length, 7);
    assert.ok(packagePayload.required_output_schema.required_fields.length >= 10);
    assert.equal(packagePayload.research_action.frontier_api_calls, false);
    audit.packageTaskId = packagePayload.task_id;

    // Upload the returned report against the task, through the real service on a temporary registry.
    await page.click("[data-rl-task='USD-SESSION-A1'] [data-rl-upload-toggle]");
    await page.waitForSelector("[data-rl-upload-form='USD-SESSION-A1']");
    await page.fill("#researchLibraryUploadModel", "ChatGPT (browser test)");
    await page.setInputFiles("#researchLibraryUploadFile", uploadFile);
    await page.click("[data-rl-upload-submit='USD-SESSION-A1']");
    await page.waitForFunction(() => (document.querySelector("[data-rl-message]")?.textContent || "").includes("registered as"), null, { timeout: 20000 });
    audit.uploadMessage = await page.$eval("[data-rl-message]", node => node.textContent.trim());
    const uploadedRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    const uploadedDocument = uploadedRegistry.documents.find(document => document.document_id === "usd-session-a1-return");
    assert.ok(uploadedDocument, "the service must register the upload in the registry file");
    assert.equal(uploadedDocument.versions[0].sha256, sha256(uploadContent));
    assert.equal(uploadedDocument.versions[0].prompt_sha256.length, 64);
    assert.equal(uploadedDocument.public_download, false);
    const pendingCount = await page.$$eval("[data-rl-status='review']", nodes => nodes.filter(node => node.textContent.trim() === "Pending").length);
    assert.ok(pendingCount >= 25, "an upload must not move a review status");
    audit.uploadPersisted = true;

    // The uploaded version downloads back byte for byte.
    const documentWait = page.waitForEvent("download");
    await page.click("[data-rl-document='usd-session-a1-return'] [data-rl-download]");
    const documentFile = await documentWait;
    const downloadedPath = path.join(workDir, "downloaded.json");
    await documentFile.saveAs(downloadedPath);
    assert.equal(sha256(fs.readFileSync(downloadedPath, "utf8")), sha256(uploadContent));
    audit.uploadedDownloadMatches = true;

    // A repo-backed document downloads with its **current** hash intact, from a factor page, where the
    // asset-level documents are listed. The check is against the latest registered version, not version 1:
    // a later version is kept alongside the immutable first one, so a document that has been corrected on
    // disk since its first registration still has to match what the registry says about it now.
    await page.click("[data-rl-factor='live.f1-vix-level']");
    await page.waitForSelector("[data-rl-factor-detail='live.f1-vix-level']");
    // The registered VIX return is on this page and it is the worked example of the boundary: its note names
    // the audit brief it answers and says delivery is not review, its bytes are not published so there is no
    // View link and Download needs the local service, and its presence moved none of the factor's statuses.
    const registeredReturn = await page.$eval("[data-rl-document='usd-baseline-audit-01-vix-usd-report']", node => ({
      text: node.textContent.replace(/\s+/g, " ").trim(),
      viewLink: Boolean(node.querySelector("a[href]")),
      serviceNote: (node.querySelector(".rl-inline-note")?.textContent || "").trim(),
      download: Boolean(node.querySelector("[data-rl-download]"))
    }));
    assert.ok(registeredReturn.text.includes("USD-BASELINE-AUDIT-01"), "the registered return must name the audit brief it answers");
    assert.ok(registeredReturn.text.includes("Research delivered, review pending"), "and must not read as an approval");
    assert.ok(registeredReturn.text.includes("Astra deep research"), "the model label is part of the record");
    assert.ok(registeredReturn.text.includes("sha256 e4151937411e"), "the page shows the hash it will be checked against");
    assert.equal(registeredReturn.viewLink, false, "an uploaded report has no published bytes to view");
    assert.ok(registeredReturn.download, "it is still downloadable through the local service");
    assert.ok(/local service/.test(registeredReturn.serviceNote), "and the page says the service is what reads it");
    audit.registeredReturn = true;
    const f1Statuses = await page.$$eval("[data-rl-factor-detail='live.f1-vix-level'] .rl-detail-status [data-rl-status]",
      nodes => nodes.map(node => `${node.getAttribute("data-rl-status")}=${node.textContent.trim()}`));
    assert.deepEqual(f1Statuses, ["research=Ready", "review=Pending", "backtest=Not tested"],
      "registering evidence must leave the factor's three statuses exactly as they were");
    audit.registeredReturnStatuses = f1Statuses;
    const repoWait = page.waitForEvent("download");
    await page.click("[data-rl-document='usd-session-inventory'] [data-rl-download]");
    const repoFile = await repoWait;
    const repoPath = path.join(workDir, "inventory.md");
    await repoFile.saveAs(repoPath);
    const inventory = committedRegistry.documents.find(document => document.document_id === "usd-session-inventory");
    assert.equal(sha256(fs.readFileSync(repoPath)), ResearchLibrary.latestVersion(inventory).sha256);
    audit.repoDownloadHashMatches = true;
    await page.click("[data-rl-back]");
    await page.waitForSelector("[data-rl-factor-table]");

    // The factor table takes the full width of the panel: sharing a grid row with a narrower card renders
    // it at half width, which buries its own columns behind a sideways scroll. A regression here is silent,
    // so the two widths are measured rather than assumed.
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
    assert.ok(
      audit.desktopTableWidth.table >= audit.desktopTableWidth.shell - 1,
      `the factor table must span the panel, saw ${audit.desktopTableWidth.table} of ${audit.desktopTableWidth.shell}px`
    );
    assert.equal(audit.desktopTableWidth.scrollOverflowPx, 0, "the factor table must not scroll sideways when it has the full width");

    // Narrow width: nothing may escape sideways.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    audit.narrowOverflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(audit.narrowOverflowPx <= 1, `the panel must not overflow at 390px, saw ${audit.narrowOverflowPx}px`);
    audit.narrowShellColumns = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-rl-shell='true']")).gridTemplateColumns
    );
    assert.equal(
      audit.narrowShellColumns.trim().split(/\s+/).length,
      1,
      `below 1181px the panel must be one column, saw ${audit.narrowShellColumns}`
    );
    await page.setViewportSize({ width: 1440, height: 1000 });

    // The research addition reached nothing but this checkout and the local service.
    assert.deepEqual(externalAfterPanelOpened, [], `the panel must add no external destination, saw: ${externalAfterPanelOpened.join(", ")}`);
    const liveFeedRequests = checkoutRequests.filter(entry => entry.includes("layer1.json") || entry.includes("layer2.json"));
    assert.ok(liveFeedRequests.length >= 1, "the live layer1 feed the dashboard already asks for must still be requested");
    audit.liveFeedRequests = liveFeedRequests;
    audit.externalRequestsBeforePanel = externalRequests.length - externalAfterPanelOpened.length;
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
  } finally {
    await browser.close();
    await new Promise(resolve => service.server.close(resolve));
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
