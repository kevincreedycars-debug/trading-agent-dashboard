const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const rootDir = __dirname;

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

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

    const overviewBriefingText = await page.locator("[data-overview-briefing='true']").innerText();
    const normalizedOverviewBriefingText = overviewBriefingText.toLowerCase();

    if (!normalizedOverviewBriefingText.includes("24h market conditions")) {
      throw new Error(`Overview briefing did not render the 24H Market Conditions section.\n${overviewBriefingText}`);
    }

    if (!normalizedOverviewBriefingText.includes("week ahead / what could change")) {
      throw new Error(`Overview briefing did not render the Week Ahead / What Could Change section.\n${overviewBriefingText}`);
    }

    const overviewAgentPanels = await page.locator("#layer1Grid .agent-card").first().locator("[data-overview-validation-panels='true'] [data-validation-panel]").allInnerTexts();
    const normalizedOverviewAgentPanels = overviewAgentPanels.map(text => text.toLowerCase());

    if (overviewAgentPanels.length !== 2) {
      throw new Error(`Overview Layer 1 card did not render both validation panels.\n${overviewAgentPanels.join("\n")}`);
    }

    if (!normalizedOverviewAgentPanels.some(text => text.includes("l2l"))) {
      throw new Error(`Overview Layer 1 card is missing the L2L validation panel.\n${overviewAgentPanels.join("\n")}`);
    }

    if (!normalizedOverviewAgentPanels.some(text => text.includes("directional"))) {
      throw new Error(`Overview Layer 1 card is missing the directional validation panel.\n${overviewAgentPanels.join("\n")}`);
    }

    const btcOverviewCard = page.locator("#layer1Grid .agent-card", { has: page.locator("h3:text('BTC')") }).first();
    const btcL2lPanel = btcOverviewCard.locator("[data-validation-panel='l2l']");
    const btcDirectionalPanel = btcOverviewCard.locator("[data-validation-panel='directional']");

    if (!await btcL2lPanel.isVisible()) {
      throw new Error("BTC Overview card did not visibly render the L2L validation panel.");
    }

    if (!await btcDirectionalPanel.isVisible()) {
      throw new Error("BTC Overview card did not visibly render the directional validation panel.");
    }

    const btcL2lText = (await btcL2lPanel.innerText()).toLowerCase();
    const btcDirectionalText = (await btcDirectionalPanel.innerText()).toLowerCase();

    if (!btcL2lText.includes("l2l tradable") && !btcL2lText.includes("l2l not tradable")) {
      throw new Error(`BTC Overview card L2L panel did not render an expected status.\n${btcL2lText}`);
    }

    if (!btcDirectionalText.includes("directional viable") && !btcDirectionalText.includes("directional not viable")) {
      throw new Error(`BTC Overview card directional panel did not render an expected status.\n${btcDirectionalText}`);
    }

    const syntheticNoCallCard = await page.evaluate(() => {
      const html = globalThis.__dashboardTestHooks.renderAgentCard({
        agent: "TEST_NO_CALL",
        status: "live",
        summary: "Synthetic no-call validation card.",
        display_metrics: {},
        calls: {}
      });

      const host = document.createElement("div");
      host.innerHTML = html;
      const card = host.querySelector(".agent-card");
      const directional = card?.querySelector("[data-validation-panel='directional']")?.innerText || "";
      const l2l = card?.querySelector("[data-validation-panel='l2l']")?.innerText || "";
      return { l2l, directional };
    });

    const syntheticDirectionalText = String(syntheticNoCallCard.directional || "").toLowerCase();
    const syntheticL2lText = String(syntheticNoCallCard.l2l || "").toLowerCase();

    if (!syntheticDirectionalText.includes("directional not viable") || !syntheticDirectionalText.includes("no 24h call")) {
      throw new Error(`Synthetic no-call Overview card did not render the required directional no-call state.\n${syntheticNoCallCard.directional}`);
    }

    if (!syntheticL2lText.includes("l2l not tradable") || !syntheticL2lText.includes("no valid call")) {
      throw new Error(`Synthetic no-call Overview card did not render the required L2L no-call state.\n${syntheticNoCallCard.l2l}`);
    }

    const fallbackBriefingContract = await page.evaluate(() => {
      return globalThis.__dashboardTestHooks.buildOverviewBriefing({
        layer1Calls: [
          { agent: "USD", direction: "BULLISH", confidence: 68, warnings: [], missingInputs: [], participation: 42, marketInputs: {} },
          { agent: "EUR", direction: "BEARISH", confidence: 61, warnings: [], missingInputs: [], participation: 39, marketInputs: {} },
          { agent: "NQ", direction: "BEARISH", confidence: 44, warnings: [], missingInputs: [], participation: 29, marketInputs: {} }
        ],
        derivedLayer2: {
          tradeOpportunities: [],
          avoidToday: [{ instrument: "EUR/USD", reason: "No trade" }]
        },
        macroContext: {
          upcomingEvents: [],
          highImpactEvents: [],
          latestUsEvent: null,
          latestEzEvent: null,
          fedBias: null,
          ecbBias: null,
          dxyFiveDayMove: null,
          vixFiveDayMove: null,
          realYieldFiveDayMove: null
        }
      });
    });

    if (
      !fallbackBriefingContract
      || typeof fallbackBriefingContract.marketConditions !== "string"
      || typeof fallbackBriefingContract.weekAhead !== "string"
      || !fallbackBriefingContract.weekAhead.toLowerCase().includes("high-impact")
    ) {
      throw new Error(`Overview briefing fallback contract failed when event data was missing.\n${JSON.stringify(fallbackBriefingContract, null, 2)}`);
    }

    const browserPairContract = await page.evaluate(() => {
      const result = globalThis.Layer2PairLogic.deriveLayer2PairSignal({
        instrument: "TEST/USD",
        targetDirection: "BEARISH",
        usdDirection: "BULLISH",
        targetConfidence: 42,
        usdConfidence: 86
      });

      return {
        tradable: result.tradable,
        direction: result.direction,
        combinedConfidence: result.combinedConfidence,
        strengthBucket: result.strengthBucket,
        strengthBucketKey: result.strengthBucketKey
      };
    });

    if (
      browserPairContract.tradable !== true
      || browserPairContract.direction !== "SELL"
      || browserPairContract.combinedConfidence !== 42
      || browserPairContract.strengthBucketKey !== "WEAK"
      || browserPairContract.strengthBucket !== "Weak"
    ) {
      throw new Error(`Browser Layer 2 pair contract failed.\n${JSON.stringify(browserPairContract, null, 2)}`);
    }

    await page.getByRole("button", { name: "Pair Analysis" }).click();
    await page.waitForSelector("text=Layer 2 Trade Selection", { timeout: 15000 });
    const layer2Text = await page.locator("#layer2View").innerText();
    const normalizedLayer2Text = layer2Text.toLowerCase();

    if (!normalizedLayer2Text.includes("combined confidence is always the lower layer 1 confidence")) {
      throw new Error(`Layer 2 live summary did not render the min-confidence invariant.\n${layer2Text}`);
    }

    if (!normalizedLayer2Text.includes("no trade") || !normalizedLayer2Text.includes("target 24h signal is non-directional")) {
      throw new Error(`Layer 2 live cards did not render expected tradable/no-trade state.\n${layer2Text}`);
    }

    const overviewLayer2Panels = await page.locator("#overviewLayer2Panel .trade-opportunity-card").first().locator("[data-overview-validation-panels='true'] [data-validation-panel]").allInnerTexts();
    const normalizedOverviewLayer2Panels = overviewLayer2Panels.map(text => text.toLowerCase());

    if (overviewLayer2Panels.length !== 2) {
      throw new Error(`Overview Layer 2 card did not render both validation panels.\n${overviewLayer2Panels.join("\n")}`);
    }

    if (!normalizedOverviewLayer2Panels.some(text => text.includes("l2l"))) {
      throw new Error(`Overview Layer 2 card is missing the L2L validation panel.\n${overviewLayer2Panels.join("\n")}`);
    }

    if (!normalizedOverviewLayer2Panels.some(text => text.includes("directional"))) {
      throw new Error(`Overview Layer 2 card is missing the directional validation panel.\n${overviewLayer2Panels.join("\n")}`);
    }

    await page.getByRole("button", { name: "Backtest / Accuracy" }).click();
    await page.getByRole("button", { name: "Accuracy Tables" }).click();

    await page.waitForSelector("text=Gold 24H direction by strength", { timeout: 15000 });
    await page.waitForSelector("text=NQ 24H direction by strength", { timeout: 15000 });
    await page.waitForSelector("text=BTC 24H direction by strength", { timeout: 15000 });
    await page.waitForTimeout(2000);
    const backtestText = await page.locator("#backtestPanel").innerText();

    if (backtestText.includes("Research view unavailable") || backtestText.includes("Research data unavailable")) {
      throw new Error(`Backtest panel fell back to full error state after ancillary 500.\n${backtestText}`);
    }

    const goldMatrixIndex = 2;
    const summaryText = await page.locator(".matrix-summary-grid").nth(goldMatrixIndex).innerText();
    const normalizedSummary = summaryText.toUpperCase();

    if (
      !normalizedSummary.includes("CORRECT") || !normalizedSummary.includes("223")
      || !normalizedSummary.includes("WRONG") || !normalizedSummary.includes("173")
      || !normalizedSummary.includes("FLAT") || !normalizedSummary.includes("141")
      || !normalizedSummary.includes("NO CALL") || !normalizedSummary.includes("26")
      || !normalizedSummary.includes("NOT EVALUABLE") || !normalizedSummary.includes("45")
    ) {
      throw new Error(`Gold matrix summary did not include expected totals.\n${summaryText}`);
    }

    if (!backtestText.includes("BTC 24H direction by strength")) {
      throw new Error(`BTC matrix section did not render.\n${backtestText}`);
    }

    await page.getByRole("button", { name: "Backtest Checker" }).click();
    await page.waitForSelector("text=BTC 24H", { timeout: 15000 });
    const checkerText = await page.locator("#backtestPanel").innerText();

    if (!checkerText.includes("BTC 24H")) {
      throw new Error(`BTC checker section did not render.\n${checkerText}`);
    }

    await page.getByRole("button", { name: "Weekday Breakdown" }).click();
    await page.waitForSelector("[data-weekday-breakdown-asset='BTC']", { timeout: 15000 });
    const weekdayText = await page.locator("#backtestPanel").innerText();
    const normalizedWeekdayText = weekdayText.toLowerCase();

    if (!weekdayText.includes("Day-of-week performance by displayed headline confidence")) {
      throw new Error(`Weekday Breakdown tab header did not render.\n${weekdayText}`);
    }

    const btcWeekdayHeaders = await page.locator("[data-weekday-breakdown-asset='BTC'] thead th").allInnerTexts();
    const usdWeekdayHeaders = await page.locator("[data-weekday-breakdown-asset='USD'] thead th").allInnerTexts();

    const normalizedBtcHeaders = btcWeekdayHeaders.map(text => text.trim().toLowerCase());
    const normalizedUsdHeaders = usdWeekdayHeaders.map(text => text.trim().toLowerCase());

    if (!normalizedBtcHeaders.includes("saturday") || !normalizedBtcHeaders.includes("sunday")) {
      throw new Error(`BTC weekday table did not include weekend columns.\n${btcWeekdayHeaders.join(" | ")}`);
    }

    if (normalizedUsdHeaders.includes("saturday") || normalizedUsdHeaders.includes("sunday")) {
      throw new Error(`USD weekday table unexpectedly included weekend columns.\n${usdWeekdayHeaders.join(" | ")}`);
    }

    if (!normalizedWeekdayText.includes("ex-flat")) {
      throw new Error(`Weekday Breakdown did not render ex-flat rate copy.\n${weekdayText}`);
    }

    if (!weekdayText.includes("W /") || !weekdayText.includes("L /") || !weekdayText.includes("F /") || !weekdayText.includes("T")) {
      throw new Error(`Weekday Breakdown did not render W/L/F/T count lines.\n${weekdayText}`);
    }

    if (!normalizedWeekdayText.includes("day totals") || !normalizedWeekdayText.includes("all confidence buckets")) {
      throw new Error(`Weekday Breakdown did not render day-level totals above the bucket table.\n${weekdayText}`);
    }

    if (!normalizedWeekdayText.includes("flat rate") || !normalizedWeekdayText.includes("ex-flat win rate")) {
      throw new Error(`Weekday Breakdown summary totals did not render flat-aware metrics.\n${weekdayText}`);
    }

    await page.getByRole("button", { name: "Pair Trade Research" }).click();
    await page.waitForSelector("[data-pair-trade-asset='EUR_USD']", { timeout: 15000 });
    const pairTradeText = await page.locator("#backtestPanel").innerText();
    const normalizedPairTradeText = pairTradeText.toLowerCase();

    if (!pairTradeText.includes("Layer 2 pair confirmation research from Layer 1 checker artifacts")) {
      throw new Error(`Pair Trade Research tab header did not render.\n${pairTradeText}`);
    }

    if (!pairTradeText.includes("EUR/USD") || !normalizedPairTradeText.includes("conflict / no-trade summary")) {
      throw new Error(`Pair Trade Research did not render expected pair sections.\n${pairTradeText}`);
    }

    if (!normalizedPairTradeText.includes("layer 2 pair summary") || !normalizedPairTradeText.includes("strong+")) {
      throw new Error(`Layer 2 Pair Summary did not render above the pair sections.\n${pairTradeText}`);
    }

    const pairSectionOrder = await page.locator("#backtestPanel .pair-trade-summary-section, #backtestPanel .pair-trade-section").evaluateAll((elements) => {
      return elements.map((element) => element.className);
    });
    if (!pairSectionOrder.length || !String(pairSectionOrder[0]).includes("pair-trade-summary-section")) {
      throw new Error(`Layer 2 Pair Summary did not appear before the detailed pair sections.\n${pairSectionOrder.join(" | ")}`);
    }

    const pairSummaryGridCount = await page.locator("[data-pair-trade-card-grid]").count();
    if (pairSummaryGridCount !== 4) {
      throw new Error(`Expected 4 pair summary-card grids, found ${pairSummaryGridCount}.`);
    }

    if (!normalizedPairTradeText.includes("trade days % = the share of matched historical days where the pair logic produced an actual tradable signal")) {
      throw new Error(`Layer 2 Pair Summary helper copy did not render.\n${pairTradeText}`);
    }

    const topSummaryRowCount = await page.locator("[data-layer2-pair-summary-row]").count();
    if (topSummaryRowCount !== 4) {
      throw new Error(`Expected 4 Layer 2 summary rows, found ${topSummaryRowCount}.`);
    }

    const topSummaryGridColumns = await page.locator("[data-layer2-pair-summary='comparison-grid']").evaluate((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean);
      return columns.length;
    });
    if (topSummaryGridColumns < 3) {
      throw new Error(`Layer 2 Pair Summary did not render as a compact comparison grid.\nColumns: ${topSummaryGridColumns}`);
    }

    const legacySummaryTableCount = await page.locator("[data-layer2-pair-summary='true'], .layer2-pair-summary-table").count();
    if (legacySummaryTableCount !== 0) {
      throw new Error(`Legacy Layer 2 summary table still rendered.\nCount: ${legacySummaryTableCount}`);
    }

    const legacySummaryCardCount = await page.locator("[data-layer2-pair-summary-card]").count();
    if (legacySummaryCardCount !== 0) {
      throw new Error(`Legacy Layer 2 summary cards still rendered.\nCount: ${legacySummaryCardCount}`);
    }

    const firstPairGridColumns = await page.locator("[data-pair-trade-card-grid='EUR_USD']").evaluate((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean);
      return columns.length;
    });
    if (firstPairGridColumns < 4) {
      throw new Error(`Pair summary cards did not render as a desktop multi-column grid.\nColumns: ${firstPairGridColumns}`);
    }

    const pairBucketOverflow = await page.locator(".pair-trade-table-scroll").first().evaluate((element) => getComputedStyle(element).overflowX);
    if (pairBucketOverflow !== "auto" && pairBucketOverflow !== "scroll") {
      throw new Error(`Pair confidence bucket table wrapper did not allow horizontal scrolling.\nOverflowX: ${pairBucketOverflow}`);
    }

    const pairBucketWhiteSpace = await page.locator(".pair-trade-bucket-table td:nth-child(3) .research-cell strong").first().evaluate((element) => getComputedStyle(element).whiteSpace);
    if (pairBucketWhiteSpace !== "nowrap") {
      throw new Error(`Pair confidence bucket percentage values were still wrapping.\nwhite-space: ${pairBucketWhiteSpace}`);
    }

    const pairTradeBtcHeaders = await page.locator("[data-pair-trade-asset='BTC_USD'] thead th").allInnerTexts();
    const normalizedPairTradeBtcHeaders = pairTradeBtcHeaders.map(text => text.trim().toLowerCase());

    if (!normalizedPairTradeBtcHeaders.includes("saturday") || !normalizedPairTradeBtcHeaders.includes("sunday")) {
      throw new Error(`BTC/USD pair trade breakdown did not include weekend columns.\n${pairTradeBtcHeaders.join(" | ")}`);
    }

    await page.getByRole("button", { name: "L2L 1H Sequence Research" }).click();
    await page.waitForSelector("[data-adr-reach-layer1-summary='true']", { timeout: 15000 });
    const adrReachText = await page.locator("#backtestPanel").innerText();
    const normalizedAdrReachText = adrReachText.toLowerCase();

    if (!adrReachText.includes("L2L 1H Sequence Research")) {
      throw new Error(`L2L 1H Sequence Research tab header did not render.\n${adrReachText}`);
    }

    if (!normalizedAdrReachText.includes("layer 1 by asset") || !normalizedAdrReachText.includes("layer 2 by pair")) {
      throw new Error(`L2L 1H Sequence Research summary tables did not render.\n${adrReachText}`);
    }

    if (!normalizedAdrReachText.includes("this measures whether 1h intraday candles show price moved at least the required l2l distance")) {
      throw new Error(`L2L 1H Sequence Research did not render the expected research note copy.\n${adrReachText}`);
    }

    if (!normalizedAdrReachText.includes("nq 1h sequence research from layer 1 checker artifacts") || !normalizedAdrReachText.includes("nq/usd 1h sequence research from existing pair trade research signal selection")) {
      throw new Error(`L2L 1H Sequence Research did not render the supported NQ detail sections.\n${adrReachText}`);
    }

    if (!normalizedAdrReachText.includes("confidence breakdown") || !normalizedAdrReachText.includes("weekday totals across all confidence buckets") || !normalizedAdrReachText.includes("by confidence bucket and weekday")) {
      throw new Error(`L2L 1H Sequence Research did not render the required detail tables.\n${adrReachText}`);
    }

    for (const expectedAvailableText of [
      "eur 1h sequence research from layer 1 checker artifacts",
      "nq 1h sequence research from layer 1 checker artifacts",
      "btc 1h sequence research from layer 1 checker artifacts",
      "eur/usd 1h sequence research from existing pair trade research signal selection",
      "nq/usd 1h sequence research from existing pair trade research signal selection",
      "btc/usd 1h sequence research from existing pair trade research signal selection"
    ]) {
      if (!normalizedAdrReachText.includes(expectedAvailableText)) {
        throw new Error(`L2L 1H Sequence Research did not render expected available section: ${expectedAvailableText}\n${adrReachText}`);
      }
    }

    for (const expectedUnavailableText of [
      "layer 1 unavailable reasons",
      "l2l unavailable source blockers"
    ]) {
      if (!normalizedAdrReachText.includes(expectedUnavailableText)) {
        throw new Error(`L2L 1H Sequence Research did not preserve expected unavailable section: ${expectedUnavailableText}\n${adrReachText}`);
      }
    }

    const adrUnavailableAuditText = (await page.locator("[data-adr-unavailable-audit='true']").textContent() || "").toLowerCase();
    if (!adrUnavailableAuditText.includes("no supportable repo-local dxy daily plus 1h source is staged")) {
      throw new Error(`L2L unavailable audit details did not preserve the USD/DXY blocker.\n${adrUnavailableAuditText}`);
    }

    const adrAuditText = (await page.locator("[data-adr-reach-layer1-summary='true']").innerText()).toLowerCase();
    for (const expectedAuditText of [
      "oanda v20 candles",
      "binance spot klines",
      "fixed ref"
    ]) {
      if (!adrAuditText.includes(expectedAuditText)) {
        throw new Error(`Warehouse Audit did not render current OHLC source text: ${expectedAuditText}\n${adrAuditText}`);
      }
    }

    const adrSummaryTableText = (await page.locator(".adr-summary-table").allInnerTexts()).join("\n").toLowerCase();
    for (const forbiddenAdrTableString of [
      "50% adr20 target",
      "stored displayed headline confidence",
      "combined confidence bucket",
      " losses",
      " total",
      "65+ confidence"
    ]) {
      if (adrSummaryTableText.includes(forbiddenAdrTableString)) {
        throw new Error(`ADR summary tables still included verbose repeated copy: ${forbiddenAdrTableString}\n${adrSummaryTableText}`);
      }
    }

    const adrConfidenceTableText = (await page.locator(".adr-confidence-table").allInnerTexts()).join("\n").toLowerCase();
    for (const forbiddenConfidenceTableString of [
      "50% adr20 target",
      "stored displayed headline confidence",
      "combined confidence bucket"
    ]) {
      if (adrConfidenceTableText.includes(forbiddenConfidenceTableString)) {
        throw new Error(`ADR confidence tables still included verbose repeated copy: ${forbiddenConfidenceTableString}\n${adrConfidenceTableText}`);
      }
    }

    const adrHeadingMatches = adrReachText.match(/L2L 1H Sequence Research/g) || [];
    if (adrHeadingMatches.length > 1) {
      throw new Error(`L2L 1H Sequence Research heading was repeated too many times.\nCount: ${adrHeadingMatches.length}\n${adrReachText}`);
    }

    const adrReachNqHeaders = await page.locator("[data-adr-reach-asset='NQ'] thead th").allInnerTexts();
    const normalizedAdrReachNqHeaders = adrReachNqHeaders.map(text => text.trim().toLowerCase());
    if (normalizedAdrReachNqHeaders.includes("saturday") || normalizedAdrReachNqHeaders.includes("sunday")) {
      throw new Error(`NQ L2L range weekday table unexpectedly included weekend columns.\n${adrReachNqHeaders.join(" | ")}`);
    }

    const adrReachPairHeaders = await page.locator("[data-adr-reach-pair='NQ_USD'] thead th").allInnerTexts();
    const normalizedAdrReachPairHeaders = adrReachPairHeaders.map(text => text.trim().toLowerCase());
    if (normalizedAdrReachPairHeaders.includes("saturday") || normalizedAdrReachPairHeaders.includes("sunday")) {
      throw new Error(`NQ/USD L2L range weekday table unexpectedly included weekend columns.\n${adrReachPairHeaders.join(" | ")}`);
    }

    const adrSummaryOverflow = await page.locator(".adr-summary-scroll").first().evaluate((element) => getComputedStyle(element).overflowX);
    if (adrSummaryOverflow !== "auto" && adrSummaryOverflow !== "scroll") {
      throw new Error(`ADR summary table wrapper did not allow horizontal scrolling.\nOverflowX: ${adrSummaryOverflow}`);
    }

    const adrSummaryPercentWhiteSpace = await page.locator(".adr-summary-table .adr-table-tight-cell strong").first().evaluate((element) => getComputedStyle(element).whiteSpace);
    if (adrSummaryPercentWhiteSpace !== "nowrap") {
      throw new Error(`ADR summary percentage values were still wrapping.\nwhite-space: ${adrSummaryPercentWhiteSpace}`);
    }

    const adrSummaryLastCellPadding = await page.locator(".adr-summary-table td:last-child").first().evaluate((element) => getComputedStyle(element).paddingRight);
    if (parseFloat(adrSummaryLastCellPadding) < 16) {
      throw new Error(`ADR summary last column padding is too small.\nPaddingRight: ${adrSummaryLastCellPadding}`);
    }

    await page.getByRole("button", { name: "L2L Threshold Sensitivity" }).click();
    await page.waitForSelector("text=Layer 1 Sensitivity", { timeout: 15000 });
    const adrThresholdText = await page.locator("#backtestPanel").innerText();
    const normalizedAdrThresholdText = adrThresholdText.toLowerCase();

    if (!normalizedAdrThresholdText.includes("production baseline is 50% adr20")) {
      throw new Error(`L2L Threshold Sensitivity did not render the expected explanatory copy.\n${adrThresholdText}`);
    }

    if (!normalizedAdrThresholdText.includes("layer 1 sensitivity") || !normalizedAdrThresholdText.includes("layer 2 sensitivity")) {
      throw new Error(`L2L Threshold Sensitivity did not render both sensitivity tables.\n${adrThresholdText}`);
    }

    for (const thresholdLabel of ["40%", "50%", "55%", "60%", "65%", "70%"]) {
      if (!adrThresholdText.includes(thresholdLabel)) {
        throw new Error(`L2L Threshold Sensitivity did not render threshold column ${thresholdLabel}.\n${adrThresholdText}`);
      }
    }

    if (!normalizedAdrThresholdText.includes("high reliability") || !normalizedAdrThresholdText.includes("below target")) {
      throw new Error(`L2L Threshold Sensitivity did not render the expected reliability labels.\n${adrThresholdText}`);
    }

    if (!normalizedAdrThresholdText.includes("55% adr20 l2l trust summary") || !normalizedAdrThresholdText.includes("can use") || !normalizedAdrThresholdText.includes("do not use")) {
      throw new Error(`L2L Threshold Sensitivity did not render the 55% trust summary.\n${adrThresholdText}`);
    }

    await page.getByRole("button", { name: "Directional Trust Summary" }).click();
    await page.waitForSelector("text=Layer 1 Directional Trust", { timeout: 15000 });
    const directionalTrustText = await page.locator("#backtestPanel").innerText();
    const normalizedDirectionalTrustText = directionalTrustText.toLowerCase();

    if (!normalizedDirectionalTrustText.includes("directional trust summary")) {
      throw new Error(`Directional Trust Summary tab did not render the expected heading.\n${directionalTrustText}`);
    }

    if (!normalizedDirectionalTrustText.includes("layer 1 directional trust") || !normalizedDirectionalTrustText.includes("layer 2 directional trust")) {
      throw new Error(`Directional Trust Summary did not render both layer tables.\n${directionalTrustText}`);
    }

    if (!normalizedDirectionalTrustText.includes("combined directional") || !normalizedDirectionalTrustText.includes("clean directional only") || !normalizedDirectionalTrustText.includes("lean directional only")) {
      throw new Error(`Directional Trust Summary did not render all call groups.\n${directionalTrustText}`);
    }

    if (!normalizedDirectionalTrustText.includes("strong+") || !normalizedDirectionalTrustText.includes("very strong")) {
      throw new Error(`Directional Trust Summary did not render all strength cohorts.\n${directionalTrustText}`);
    }

    if (!normalizedDirectionalTrustText.includes("can use") || !normalizedDirectionalTrustText.includes("do not use")) {
      throw new Error(`Directional Trust Summary did not render trust-status labels.\n${directionalTrustText}`);
    }

    await page.getByRole("button", { name: "Factor Edge Lab" }).click();
    await page.waitForSelector("text=Research-Only Factor Evidence Review", { timeout: 15000 });
    const factorEdgeText = await page.locator("#factorEdgeLabPanel").innerText();
    const normalizedFactorEdgeText = factorEdgeText.toLowerCase();

    if (!normalizedFactorEdgeText.includes("factor evidence for later weighting review")) {
      throw new Error(`Factor Edge Lab did not render the expected status heading.\n${factorEdgeText}`);
    }

    if (!normalizedFactorEdgeText.includes("this dashboard reads only from the checked-in")) {
      throw new Error(`Factor Edge Lab did not render the read-only artifact contract.\n${factorEdgeText}`);
    }

    for (const expectedEntity of ["usd", "eur", "gold", "nq", "btc", "eur/usd", "xau/usd", "nq/usd", "btc/usd"]) {
      if (!normalizedFactorEdgeText.includes(expectedEntity)) {
        throw new Error(`Factor Edge Lab did not render expected entity ${expectedEntity}.\n${factorEdgeText}`);
      }
    }

    if (!normalizedFactorEdgeText.includes("unavailable")) {
      throw new Error(`Factor Edge Lab did not preserve explicit unavailable ADR/L2L states.\n${factorEdgeText}`);
    }

    if (!normalizedFactorEdgeText.includes("factor-level adr/l2l opportunity reliability is marked unavailable")) {
      throw new Error(`Factor Edge Lab did not render the explicit ADR/L2L methodology guardrail.\n${factorEdgeText}`);
    }

    const factorEdgeUnavailablePillCount = await page.locator(".factor-edge-pill.unavailable").count();
    if (factorEdgeUnavailablePillCount < 20) {
      throw new Error(`Factor Edge Lab rendered too few unavailable ADR/L2L pills.\nCount: ${factorEdgeUnavailablePillCount}`);
    }

    for (const expectedPairSideText of [
      "base side",
      "quote/usd side",
      "eur · direct",
      "usd · inverse",
      "gold · direct",
      "btc · direct",
      "nq · direct"
    ]) {
      if (!normalizedFactorEdgeText.includes(expectedPairSideText)) {
        throw new Error(`Factor Edge Lab did not render expected pair-side mapping text: ${expectedPairSideText}\n${factorEdgeText}`);
      }
    }

    if (!normalizedFactorEdgeText.includes("using the existing checked-in qqq proxy semantics")) {
      throw new Error(`Factor Edge Lab did not preserve the explicit NQ/USD mapping note.\n${factorEdgeText}`);
    }

    for (const expectedCombinationText of [
      "factor combinations",
      "two-factor",
      "three-factor",
      "exploratory",
      "top evidence",
      "review summary",
      "candidate increase weight",
      "candidate reduce weight",
      "insufficient evidence",
      "base side combinations",
      "quote/usd side combinations"
    ]) {
      if (!normalizedFactorEdgeText.includes(expectedCombinationText)) {
        throw new Error(`Factor Edge Lab did not render expected combination analysis text: ${expectedCombinationText}\n${factorEdgeText}`);
      }
    }

    const blockingConsoleErrors = consoleErrors.filter((message) => !message.includes("Failed to load resource: the server responded with a status of 500 ()"));

    if (blockingConsoleErrors.length) {
      throw new Error(`Console errors were emitted during dashboard smoke.\n${blockingConsoleErrors.join("\n")}`);
    }

    console.log(JSON.stringify({
      status: "PASS",
      target: "Accuracy tables, checker, weekday, pair trade, and ADR reach research",
      matrix_summary_excerpt: summaryText,
      btc_weekday_headers: btcWeekdayHeaders,
      usd_weekday_headers: usdWeekdayHeaders,
      pair_trade_btc_headers: pairTradeBtcHeaders,
      adr_reach_nq_headers: adrReachNqHeaders,
      adr_reach_pair_headers: adrReachPairHeaders,
      factor_edge_unavailable_pill_count: factorEdgeUnavailablePillCount,
      pair_trade_grid_columns: firstPairGridColumns,
      pair_trade_overflow_x: pairBucketOverflow,
      top_summary_row_count: topSummaryRowCount,
      top_summary_grid_columns: topSummaryGridColumns
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error("Dashboard smoke failed.");
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
