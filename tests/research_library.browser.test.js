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

    // The factor table must have the whole width of its container, not the left half of a stray
    // two-column grid. .wide-panel's grid-column: span 2 used to open a second implicit column
    // inside .rl-shell, and every card that does not span it - this table among them - was laid out
    // at half width with its nine columns crushed to about 39px. Text rects, not cell heights, tell
    // a wrapped heading or pill apart from a single line one.
    const tableLayout = await page.evaluate(() => {
      const table = document.querySelector("[data-rl-factor-table]");
      const wrap = table.closest("[data-rl-factor-table-wrap]");
      const shell = document.querySelector("[data-rl-shell='true']");
      const card = table.closest(".rl-table-card");
      const columns = Array.from(table.querySelectorAll("thead th"));
      const wraps = node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getClientRects().length > 1;
      };
      return {
        shellTracks: getComputedStyle(shell).gridTemplateColumns.split(" ").length,
        shellWidth: Math.round(shell.getBoundingClientRect().width),
        wrapWidth: Math.round(wrap.getBoundingClientRect().width),
        cardGridColumn: getComputedStyle(card).gridColumn,
        narrowestColumn: Math.min(...columns.map(node => Math.round(node.getBoundingClientRect().width))),
        wrappedHeadings: columns.filter(wraps).map(node => node.textContent.trim()),
        wrappedPills: Array.from(table.querySelectorAll(".rl-pill")).filter(wraps).length
      };
    });
    audit.factorTableLayout = tableLayout;
    assert.equal(tableLayout.shellTracks, 1, "the library shell must be a single full-width column");
    assert.ok(
      Math.abs(tableLayout.wrapWidth - tableLayout.shellWidth) <= 1,
      `the factor table card must fill the shell, saw ${tableLayout.wrapWidth} of ${tableLayout.shellWidth}px`
    );
    assert.ok(tableLayout.narrowestColumn >= 50, `no factor column may be crushed to a sliver, narrowest was ${tableLayout.narrowestColumn}px`);
    assert.deepEqual(tableLayout.wrappedHeadings, [], `every factor table heading must stay on one line, wrapped: ${tableLayout.wrappedHeadings.join(", ")}`);
    assert.equal(tableLayout.wrappedPills, 0, "a status pill inside the factor table must not break across lines");

    // The factor detail page carries the brief, the current rules, the sources and the history.
    await page.click("[data-rl-factor='fx.usd-session-momentum']");
    await page.waitForSelector("[data-rl-factor-detail='fx.usd-session-momentum']");
    const detailText = await page.$eval("[data-rl-factor-detail]", node => node.textContent);
    ["Brief", "Current rules", "Sources", "History", "Reports"].forEach(heading => {
      assert.ok(detailText.includes(heading), `the factor detail page must show ${heading}`);
    });
    await page.click("[data-rl-back]");
    await page.waitForSelector("[data-rl-factor-table]");

    // Copy prompt puts the exact dispatched prompt on the clipboard.
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

    // A repo-backed document downloads with its registered hash intact, from a factor page, where the
    // asset-level documents are listed.
    await page.click("[data-rl-factor='live.f1-vix-level']");
    await page.waitForSelector("[data-rl-factor-detail='live.f1-vix-level']");
    const repoWait = page.waitForEvent("download");
    await page.click("[data-rl-document='usd-session-inventory'] [data-rl-download]");
    const repoFile = await repoWait;
    const repoPath = path.join(workDir, "inventory.md");
    await repoFile.saveAs(repoPath);
    const committedRegistry = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "research-library", "documents.json"), "utf8"));
    const inventory = committedRegistry.documents.find(document => document.document_id === "usd-session-inventory");
    assert.equal(sha256(fs.readFileSync(repoPath)), inventory.versions[0].sha256);
    audit.repoDownloadHashMatches = true;
    await page.click("[data-rl-back]");
    await page.waitForSelector("[data-rl-factor-table]");

    // Narrow width: nothing may escape sideways.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    audit.narrowOverflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(audit.narrowOverflowPx <= 1, `the panel must not overflow at 390px, saw ${audit.narrowOverflowPx}px`);
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
