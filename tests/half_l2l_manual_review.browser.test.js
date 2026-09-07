const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const tmpDir = path.join(rootDir, "tmp");
const importInputId = "halfL2lReviewImportInput";
const authoritativeImportPath = "C:\\Users\\A17\\Downloads\\half-l2l-manual-review.json";
const authoritativeEurIds = [
  "layer_1-eur-9a04ae804ce5",
  "layer_1-eur-a74dd137f489",
  "layer_1-eur-34861f8fdac4",
  "layer_1-eur-5fad539bb898"
];

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function createServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
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
}

async function loadHalfL2lPage(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Backtest / Accuracy" }).click();
  await page.getByRole("button", { name: "L2L Directional Accuracy" }).click();
  await page.waitForSelector("[data-half-l2l-summary='true']", { timeout: 15000 });
}

async function collectManualReviewAudit(page) {
  return page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll("[data-half-l2l-manual-group]")).map((node) => ({
      entityCode: node.getAttribute("data-half-l2l-manual-group") || "",
      heading: node.querySelector("[data-half-l2l-manual-group-heading]")?.textContent?.trim() || "",
      rowIds: Array.from(node.querySelectorAll("[data-half-l2l-sample-row]")).map((row) => row.getAttribute("data-half-l2l-sample-row") || "")
    }));
    return {
      groups,
      sampleRowCount: document.querySelectorAll("[data-half-l2l-sample-row]").length,
      reviewedCount: document.getElementById("halfL2lReviewedCount")?.textContent?.trim() || "",
      remainingCount: document.getElementById("halfL2lRemainingCount")?.textContent?.trim() || "",
      matchesCount: document.getElementById("halfL2lMatchesCount")?.textContent?.trim() || "",
      mismatchesCount: document.getElementById("halfL2lMismatchesCount")?.textContent?.trim() || "",
      selectionRuleText: document.querySelector("[data-half-l2l-selection-rule='true']")?.textContent?.trim() || "",
      staleWarningVisible: Boolean(Array.from(document.querySelectorAll("[data-half-l2l-manual='true'] .diagnostic-item")).find((node) => node.textContent?.includes("different artifact signature")))
    };
  });
}

async function main() {
  fs.mkdirSync(tmpDir, { recursive: true });
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await loadHalfL2lPage(page, baseUrl);

    const initialAudit = await collectManualReviewAudit(page);
    const expectedGroupOrder = ["EUR", "GOLD", "NQ", "BTC", "EUR_USD", "XAU_USD", "NQ_USD", "BTC_USD"];
    if (initialAudit.sampleRowCount !== 32) {
      throw new Error(`Expected 32 retained manual-review rows, found ${initialAudit.sampleRowCount}`);
    }
    if (JSON.stringify(initialAudit.groups.map((group) => group.entityCode)) !== JSON.stringify(expectedGroupOrder)) {
      throw new Error(`Unexpected manual-review group order.\n${JSON.stringify(initialAudit, null, 2)}`);
    }
    initialAudit.groups.forEach((group) => {
      if (group.rowIds.length !== 4) {
        throw new Error(`Group ${group.entityCode} did not render 4 rows.\n${JSON.stringify(group, null, 2)}`);
      }
    });
    if (!initialAudit.selectionRuleText.includes("MISS/HIT is impossible")) {
      throw new Error(`Visible selection-rule text did not explain the valid outcome classes.\n${JSON.stringify(initialAudit, null, 2)}`);
    }

    const eurGroup = initialAudit.groups.find((group) => group.entityCode === "EUR");
    if (!eurGroup || eurGroup.rowIds.length !== 4) {
      throw new Error(`EUR group was not available as a 4-row retained sample.\n${JSON.stringify(initialAudit, null, 2)}`);
    }
    if (JSON.stringify(eurGroup.rowIds) !== JSON.stringify(authoritativeEurIds)) {
      throw new Error(`EUR group did not retain the authoritative reviewed stable IDs.\n${JSON.stringify(eurGroup, null, 2)}`);
    }

    const firstEurRecordId = eurGroup.rowIds[0];
    await page.locator(`[data-half-l2l-verdict="${firstEurRecordId}"][value="MATCHES"]`).check();
    await page.locator(`[data-half-l2l-notes="${firstEurRecordId}"]`).fill("persistent note");

    const mutualExclusionAudit = await page.evaluate((recordId) => {
      const states = ["MATCHES", "DOES_NOT_MATCH", "NOT_CHECKED"].map((value) => ({
        value,
        checked: Boolean(document.querySelector(`[data-half-l2l-verdict="${recordId}"][value="${value}"]`)?.checked)
      }));
      return {
        states,
        notes: document.querySelector(`[data-half-l2l-notes="${recordId}"]`)?.value || ""
      };
    }, firstEurRecordId);
    if (mutualExclusionAudit.states.filter((state) => state.checked).length !== 1 || !mutualExclusionAudit.states.find((state) => state.value === "MATCHES")?.checked) {
      throw new Error(`Verdict radios were not mutually exclusive.\n${JSON.stringify(mutualExclusionAudit, null, 2)}`);
    }

    await page.getByRole("button", { name: "L2L Threshold Sensitivity" }).click();
    await page.getByRole("button", { name: "L2L Directional Accuracy" }).click();
    await page.waitForSelector("[data-half-l2l-summary='true']", { timeout: 15000 });

    const rerenderAudit = await page.evaluate((recordId) => ({
      matchesChecked: Boolean(document.querySelector(`[data-half-l2l-verdict="${recordId}"][value="MATCHES"]`)?.checked),
      notes: document.querySelector(`[data-half-l2l-notes="${recordId}"]`)?.value || ""
    }), firstEurRecordId);
    if (!rerenderAudit.matchesChecked || rerenderAudit.notes !== "persistent note") {
      throw new Error(`Review state did not survive rerender.\n${JSON.stringify(rerenderAudit, null, 2)}`);
    }

    await page.reload({ waitUntil: "networkidle" });
    await loadHalfL2lPage(page, baseUrl);
    const reloadAudit = await page.evaluate((recordId) => ({
      matchesChecked: Boolean(document.querySelector(`[data-half-l2l-verdict="${recordId}"][value="MATCHES"]`)?.checked),
      notes: document.querySelector(`[data-half-l2l-notes="${recordId}"]`)?.value || ""
    }), firstEurRecordId);
    if (!reloadAudit.matchesChecked || reloadAudit.notes !== "persistent note") {
      throw new Error(`Review state did not survive reload.\n${JSON.stringify(reloadAudit, null, 2)}`);
    }

    await page.locator(`[data-half-l2l-verdict="${firstEurRecordId}"][value="NOT_CHECKED"]`).check();
    await page.locator(`[data-half-l2l-notes="${firstEurRecordId}"]`).fill("");
    await page.locator(`#${importInputId}`).setInputFiles(authoritativeImportPath);
    await page.waitForTimeout(100);

    const authoritativeImport = JSON.parse(fs.readFileSync(authoritativeImportPath, "utf8"));
    const authoritativeReviewMap = Object.fromEntries((authoritativeImport.reviews || []).map((review) => [review.recordId, review]));
    const importedAudit = await page.evaluate((rowIds) => ({
      rows: Array.from(document.querySelectorAll("[data-half-l2l-sample-row]")).map((row) => {
        const recordId = row.getAttribute("data-half-l2l-sample-row") || "";
        const verdict = ["MATCHES", "DOES_NOT_MATCH", "NOT_CHECKED"].find((value) => document.querySelector(`[data-half-l2l-verdict="${recordId}"][value="${value}"]`)?.checked) || "UNKNOWN";
        return {
          recordId,
          verdict,
          notes: document.querySelector(`[data-half-l2l-notes="${recordId}"]`)?.value || "",
          reviewTimestamp: row.querySelector("small")?.textContent?.replace(/^Last checked:\s*/, "") || ""
        };
      }),
      eurHeading: document.querySelector('[data-half-l2l-manual-group-heading="EUR"]')?.textContent?.trim() || "",
      staleWarningVisible: Boolean(Array.from(document.querySelectorAll("[data-half-l2l-manual='true'] .diagnostic-item")).find((node) => node.textContent?.includes("different artifact signature")))
    }), eurGroup.rowIds);
    const reviewedRows = importedAudit.rows.filter((row) => row.verdict !== "NOT_CHECKED");
    const notCheckedRows = importedAudit.rows.filter((row) => row.verdict === "NOT_CHECKED");
    if (reviewedRows.length !== 4 || !reviewedRows.every((row) => row.verdict === "MATCHES")) {
      throw new Error(`Legacy JSON import did not restore exactly four reviewed EUR rows as MATCHES.\n${JSON.stringify(importedAudit, null, 2)}`);
    }
    if (JSON.stringify(reviewedRows.map((row) => row.recordId)) !== JSON.stringify(authoritativeEurIds)) {
      throw new Error(`Legacy JSON import transferred verdicts to the wrong stable IDs.\n${JSON.stringify(importedAudit, null, 2)}`);
    }
    if (notCheckedRows.length !== 28) {
      throw new Error(`Legacy JSON import did not leave the remaining 28 rows NOT_CHECKED.\n${JSON.stringify(importedAudit, null, 2)}`);
    }
    for (const row of reviewedRows) {
      const expected = authoritativeReviewMap[row.recordId];
      if (!expected) {
        throw new Error(`Unexpected reviewed row after import: ${row.recordId}`);
      }
      if (row.notes !== (expected.notes || "") || row.reviewTimestamp !== (expected.reviewTimestamp || "Not yet checked")) {
        throw new Error(`Imported review metadata did not preserve notes/timestamp for ${row.recordId}.\n${JSON.stringify({ expected, actual: row }, null, 2)}`);
      }
    }
    if (!importedAudit.eurHeading.toLowerCase().includes("4 of 4 reviewed")) {
      throw new Error(`EUR heading did not show 4 of 4 reviewed after import.\n${JSON.stringify(importedAudit, null, 2)}`);
    }
    if (!importedAudit.staleWarningVisible) {
      throw new Error(`Legacy JSON import did not surface the stale-signature warning.\n${JSON.stringify(importedAudit, null, 2)}`);
    }

    const selectedGoldRecordId = "layer_1-gold-c8accaf11388";
    const goldAudit = await page.evaluate((recordId) => {
      const row = document.querySelector(`[data-half-l2l-sample-row="${recordId}"]`);
      if (!row) return { selected: false };
      return {
        selected: true,
        notChecked: Boolean(document.querySelector(`[data-half-l2l-verdict="${recordId}"][value="NOT_CHECKED"]`)?.checked)
      };
    }, selectedGoldRecordId);
    if (goldAudit.selected && !goldAudit.notChecked) {
      throw new Error(`Selected Gold review row ${selectedGoldRecordId} was not preserved as NOT_CHECKED.\n${JSON.stringify(goldAudit, null, 2)}`);
    }

    const jsonDownloadPromise = page.waitForEvent("download");
    await page.locator("[data-half-l2l-export-json='true']").click();
    const jsonDownload = await jsonDownloadPromise;
    const jsonExportPath = path.join(tmpDir, "half-l2l-manual-review-export.json");
    await jsonDownload.saveAs(jsonExportPath);
    const exportedJson = JSON.parse(fs.readFileSync(jsonExportPath, "utf8"));
    if ((exportedJson.sample_size || 0) !== 32 || (exportedJson.sample_layer_counts?.LAYER_1 || 0) !== 16 || (exportedJson.sample_layer_counts?.LAYER_2 || 0) !== 16) {
      throw new Error(`JSON export did not report the retained 32-row sample.\n${JSON.stringify(exportedJson, null, 2)}`);
    }
    if ((exportedJson.reviews || []).length !== 32 || new Set(exportedJson.sample_record_ids || []).size !== 32) {
      throw new Error(`JSON export did not include exactly 32 unique retained sample rows.\n${JSON.stringify(exportedJson, null, 2)}`);
    }
    const exportedReviewedRows = (exportedJson.reviews || []).filter((row) => row.manualVerdict !== "NOT_CHECKED");
    if (JSON.stringify(exportedJson.sample_groups.map((group) => group.entityCode)) !== JSON.stringify(expectedGroupOrder)) {
      throw new Error(`JSON export did not preserve manual-review group order.\n${JSON.stringify(exportedJson.sample_groups, null, 2)}`);
    }
    if (JSON.stringify(exportedJson.sample_groups.find((group) => group.entityCode === "EUR")?.recordIds || []) !== JSON.stringify(authoritativeEurIds)) {
      throw new Error(`JSON export did not preserve the authoritative EUR retained IDs.\n${JSON.stringify(exportedJson.sample_groups, null, 2)}`);
    }
    if (exportedReviewedRows.length !== 4 || !exportedReviewedRows.every((row) => row.manualVerdict === "MATCHES")) {
      throw new Error(`JSON export did not preserve exactly four MATCHES verdicts.\n${JSON.stringify(exportedReviewedRows, null, 2)}`);
    }
    if (JSON.stringify(exportedReviewedRows.map((row) => row.recordId)) !== JSON.stringify(authoritativeEurIds)) {
      throw new Error(`JSON export transferred verdicts to different stable IDs.\n${JSON.stringify(exportedReviewedRows, null, 2)}`);
    }

    const csvDownloadPromise = page.waitForEvent("download");
    await page.locator("[data-half-l2l-export-csv='true']").click();
    const csvDownload = await csvDownloadPromise;
    const csvExportPath = path.join(tmpDir, "half-l2l-manual-review-export.csv");
    await csvDownload.saveAs(csvExportPath);
    const csvLines = fs.readFileSync(csvExportPath, "utf8").trim().split(/\r?\n/);
    if (csvLines.length !== 33) {
      throw new Error(`CSV export did not include 1 header plus 32 retained sample rows.\n${csvLines.length}`);
    }
    if (!csvLines[0].includes("entity_code") || !csvLines[0].includes("evaluation_date")) {
      throw new Error(`CSV export did not include the retained-sample metadata columns.\n${csvLines[0]}`);
    }

    console.log(JSON.stringify({
      status: "PASS",
      url: `${baseUrl}#backtest`,
      sampleRowCount: initialAudit.sampleRowCount,
      groupOrder: initialAudit.groups.map((group) => group.entityCode),
      eurRetainedRecordIds: eurGroup.rowIds,
      reviewedRecordIds: reviewedRows.map((row) => row.recordId),
      notCheckedCount: notCheckedRows.length,
      goldSelectedState: goldAudit,
      exportedJsonPath: jsonExportPath,
      exportedCsvPath: csvExportPath
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error("Half-L2L manual review browser test failed.");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
