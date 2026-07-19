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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const topbarClockContract = await page.evaluate(() => {
      const clock = document.getElementById("topbarClock");
      const date = document.getElementById("currentDate");
      const text = clock?.textContent?.trim() || "";
      const title = clock?.getAttribute("title") || "";
      const ariaLabel = clock?.getAttribute("aria-label") || "";
      const clockPattern = /^UK \d{2}:\d{2} \| ET \d{2}:\d{2}$/;
      return {
        text,
        title,
        ariaLabel,
        currentDate: date?.textContent?.trim() || "",
        matchesPattern: clockPattern.test(text)
      };
    });

    if (!topbarClockContract.matchesPattern) {
      throw new Error(`Topbar dual clock did not render the expected UK/ET format.\n${JSON.stringify(topbarClockContract, null, 2)}`);
    }

    if (!topbarClockContract.title.includes("GMT and BST") || !topbarClockContract.title.includes("EST and EDT")) {
      throw new Error(`Topbar dual clock did not preserve the DST tooltip guidance.\n${JSON.stringify(topbarClockContract, null, 2)}`);
    }

    if (!topbarClockContract.ariaLabel.includes("UK time") || !topbarClockContract.ariaLabel.includes("Eastern Time")) {
      throw new Error(`Topbar dual clock did not expose the expected accessible live label.\n${JSON.stringify(topbarClockContract, null, 2)}`);
    }

    if (!topbarClockContract.currentDate) {
      throw new Error(`Topbar date label did not render alongside the dual clock.\n${JSON.stringify(topbarClockContract, null, 2)}`);
    }

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

    const overviewExpiryContract = await page.evaluate(async () => {
      const response = await fetch("./data/layer1.json", { cache: "no-store" });
      const payload = await response.json();
      const agents = Array.isArray(payload?.agents)
        ? payload.agents.filter((agent) => String(agent?.status || "").toLowerCase() === "live")
        : [];
      const formatExpiry = (value, timeZone = "America/New_York") => {
        if (!value) return null;
        return `${new Intl.DateTimeFormat("en-GB", {
          timeZone,
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }).format(new Date(value))} ET`;
      };

      return agents.map((agent) => ({
        asset: agent.agent,
        forecastWindowEnd: agent.forecast_window_end || null,
        expiresAt: agent.expires_at || null,
        expectedExpiry: formatExpiry(agent.forecast_window_end || agent.expires_at, agent.timezone || "America/New_York"),
        expectedStatus: String(agent.effective_status || agent.status_at_build || "UNAVAILABLE").toUpperCase()
      }));
    });

    const overviewExpiryCards = await page.locator("#layer1Grid .agent-card").evaluateAll((cards) => cards.map((card) => ({
      asset: card.querySelector("h3")?.textContent?.trim() || "",
      expiryLabel: card.querySelector("[data-overview-expiry-card='true'] .validity-label")?.textContent?.trim() || "",
      expiryValue: card.querySelector(".overview-expiry-value")?.textContent?.trim() || "",
      expiryStatus: card.querySelector(".overview-expiry-badge")?.textContent?.trim() || "",
      directionalPanelGap: (() => {
        const directional = card.querySelector("[data-validation-panel='directional']");
        const metrics = card.querySelector(".agent-metrics");
        if (!directional || !metrics) return null;
        const directionalRect = directional.getBoundingClientRect();
        const metricsRect = metrics.getBoundingClientRect();
        return Number((metricsRect.top - directionalRect.bottom).toFixed(2));
      })(),
      text: card.innerText || "",
      hasHorizontalOverflow: card.scrollWidth > card.clientWidth + 1
    })));

    if (overviewExpiryCards.length !== overviewExpiryContract.length) {
      throw new Error(`Overview Layer 1 card count did not match the available artifact rows.\nRendered: ${overviewExpiryCards.length}\nArtifact: ${overviewExpiryContract.length}`);
    }

    for (const expected of overviewExpiryContract) {
      if (!expected.forecastWindowEnd) {
        throw new Error(`Artifact row ${expected.asset} did not expose forecast_window_end for the Overview expiry contract.`);
      }

      if (expected.forecastWindowEnd !== expected.expiresAt) {
        throw new Error(`Artifact row ${expected.asset} did not preserve expires_at as the alias of forecast_window_end.\n${JSON.stringify(expected, null, 2)}`);
      }

      const rendered = overviewExpiryCards.find((card) => card.asset === expected.asset);
      if (!rendered) {
        throw new Error(`Overview Layer 1 card for ${expected.asset} did not render.`);
      }

      if (rendered.expiryLabel !== "24H call valid until") {
        throw new Error(`Overview Layer 1 card ${expected.asset} did not render the required expiry label.\n${JSON.stringify(rendered, null, 2)}`);
      }

      if (rendered.expiryValue !== expected.expectedExpiry) {
        throw new Error(`Overview Layer 1 card ${expected.asset} did not render the artifact-backed expiry value.\nExpected: ${expected.expectedExpiry}\nRendered: ${rendered.expiryValue}`);
      }

      if (rendered.expiryStatus !== expected.expectedStatus) {
        throw new Error(`Overview Layer 1 card ${expected.asset} did not render the expected validity status.\nExpected: ${expected.expectedStatus}\nRendered: ${rendered.expiryStatus}`);
      }

      const normalizedRenderedText = rendered.text.toLowerCase();
      if (normalizedRenderedText.includes("weighted verdicts calculated deterministically")) {
        throw new Error(`Overview Layer 1 card ${expected.asset} still rendered the weighted-verdict summary prose.\n${rendered.text}`);
      }

      if (rendered.hasHorizontalOverflow) {
        throw new Error(`Overview Layer 1 card ${expected.asset} overflowed horizontally after the expiry block was added.\n${JSON.stringify(rendered, null, 2)}`);
      }

      if (rendered.directionalPanelGap === null || rendered.directionalPanelGap < 10) {
        throw new Error(`Overview Layer 1 card ${expected.asset} did not preserve visible spacing beneath the Directional Viability panel.\n${JSON.stringify(rendered, null, 2)}`);
      }
    }

    const overviewLayout = await page.evaluate(() => {
      const doc = document.documentElement;
      const grid = document.getElementById("layer1Grid");
      const topbar = document.querySelector(".topbar");
      const cards = Array.from(document.querySelectorAll("#layer1Grid .agent-card"));
      return {
        pageHasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        topbarHasHorizontalOverflow: topbar ? topbar.scrollWidth > topbar.clientWidth + 1 : false,
        gridHasHorizontalOverflow: grid ? grid.scrollWidth > grid.clientWidth + 1 : false,
        overflowingCards: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length
      };
    });

    if (overviewLayout.pageHasHorizontalOverflow || overviewLayout.topbarHasHorizontalOverflow || overviewLayout.gridHasHorizontalOverflow || overviewLayout.overflowingCards > 0) {
      throw new Error(`Overview Layer 1 expiry presentation introduced horizontal overflow.\n${JSON.stringify(overviewLayout, null, 2)}`);
    }

    const syntheticNoCallCard = await page.evaluate(() => {
      const html = globalThis.__dashboardTestHooks.renderAgentCard({
        agent: "TEST_NO_CALL",
        status: "live",
        summary: "Synthetic no-call validation card.",
        sealed_at: "2026-07-11T05:56:00.000Z",
        valid_from: "2026-07-11T05:56:00.000Z",
        refresh_due_at: "2026-07-11T11:00:00.000Z",
        expires_at: null,
        status_at_build: "NO_CALL",
        effective_status: "NO_CALL",
        status_resolved_at: "2026-07-11T05:56:00.000Z",
        display_metrics: {},
        calls: {
          "24h": {
            direction: "NO 24H CALL",
            conviction: null,
            status_at_build: "NO_CALL",
            effective_status: "NO_CALL",
            valid_from: "2026-07-11T05:56:00.000Z",
            refresh_due_at: "2026-07-11T11:00:00.000Z",
            expires_at: null
          }
        },
        priority_call: {
          direction: "NO 24H CALL",
          conviction: null,
          status_at_build: "NO_CALL",
          effective_status: "NO_CALL",
          valid_from: "2026-07-11T05:56:00.000Z",
          refresh_due_at: "2026-07-11T11:00:00.000Z",
          expires_at: null
        }
      });

      const host = document.createElement("div");
      host.innerHTML = html;
      const card = host.querySelector(".agent-card");
      const directional = card?.querySelector("[data-validation-panel='directional']")?.innerText || "";
      const l2l = card?.querySelector("[data-validation-panel='l2l']")?.innerText || "";
      const expiryLabel = card?.querySelector("[data-overview-expiry-card='true'] .validity-label")?.textContent || "";
      const expiryValue = card?.querySelector(".overview-expiry-value")?.textContent || "";
      const expiryStatus = card?.querySelector(".overview-expiry-badge")?.textContent || "";
      return { l2l, directional, expiryLabel, expiryValue, expiryStatus, text: card?.innerText || "" };
    });

    const syntheticDirectionalText = String(syntheticNoCallCard.directional || "").toLowerCase();
    const syntheticL2lText = String(syntheticNoCallCard.l2l || "").toLowerCase();
    const syntheticCardText = String(syntheticNoCallCard.text || "").toLowerCase();

    if (!syntheticDirectionalText.includes("directional not viable") || !syntheticDirectionalText.includes("no 24h call")) {
      throw new Error(`Synthetic no-call Overview card did not render the required directional no-call state.\n${syntheticNoCallCard.directional}`);
    }

    if (!syntheticL2lText.includes("l2l not tradable") || !syntheticL2lText.includes("no valid call")) {
      throw new Error(`Synthetic no-call Overview card did not render the required L2L no-call state.\n${syntheticNoCallCard.l2l}`);
    }

    if (String(syntheticNoCallCard.expiryLabel || "").trim() !== "24H call valid until" || String(syntheticNoCallCard.expiryValue || "").trim() !== "No active 24H expiry" || String(syntheticNoCallCard.expiryStatus || "").trim() !== "NO CALL") {
      throw new Error(`Synthetic no-call Overview card did not render the expected no-call expiry presentation.\n${JSON.stringify(syntheticNoCallCard, null, 2)}`);
    }

    if (syntheticCardText.includes("synthetic no-call validation card")) {
      throw new Error(`Synthetic no-call Overview card still rendered the summary paragraph.\n${syntheticNoCallCard.text}`);
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

    const usdDetailReasoning = await page.evaluate(async () => {
      const response = await fetch("./data/layer1.json", { cache: "no-store" });
      const payload = await response.json();
      const agent = payload?.agents?.find((entry) => entry.agent === "USD") || null;
      return {
        callReason: agent?.calls?.["24h"]?.reason || ""
      };
    });

    await page.getByRole("button", { name: "Overview" }).click();
    await page.waitForSelector("#layer1Grid .agent-card", { timeout: 15000 });
    await page.locator("#layer1Grid .agent-card", { has: page.locator("h3:text('USD')") }).locator("[data-agent='USD']").click();
    await page.waitForFunction(() => {
      const activeView = document.querySelector(".active-view");
      const heading = document.querySelector("#agentView h2");
      return activeView?.id === "agentView" && heading && heading.textContent.includes("USD");
    }, { timeout: 15000 });

    const usdDetailReasoningText = await page.locator("#agentView").innerText();
    const expectedUsdDetailReason = String(usdDetailReasoning?.callReason || "").replace(/^24h\s+/i, "");
    if (!expectedUsdDetailReason || !usdDetailReasoningText.includes(expectedUsdDetailReason)) {
      throw new Error(`USD detail view did not preserve the detailed 24H reasoning text.\nExpected call reason: ${expectedUsdDetailReason}\nRendered: ${usdDetailReasoningText}`);
    }

    if (!usdDetailReasoningText.toLowerCase().includes("why today's call was made")) {
      throw new Error(`USD detail view did not retain the detailed reasoning section.\n${usdDetailReasoningText}`);
    }

    await page.getByRole("button", { name: "Overview" }).click();
    await page.waitForSelector("#layer1Grid .agent-card", { timeout: 15000 });
    await page.setViewportSize({ width: 390, height: 1280 });
    await page.waitForTimeout(250);

    const narrowClockLayout = await page.evaluate(() => {
      const doc = document.documentElement;
      const topbar = document.querySelector(".topbar");
      const clock = document.getElementById("topbarClock");
      return {
        clockText: clock?.textContent?.trim() || "",
        pageHasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        topbarHasHorizontalOverflow: topbar ? topbar.scrollWidth > topbar.clientWidth + 1 : false,
        gridHasHorizontalOverflow: document.getElementById("layer1Grid")?.scrollWidth > document.getElementById("layer1Grid")?.clientWidth + 1,
        overviewCardOverflowCount: Array.from(document.querySelectorAll("#layer1Grid .agent-card")).filter((card) => card.scrollWidth > card.clientWidth + 1).length
      };
    });

    if (!/^UK \d{2}:\d{2} \| ET \d{2}:\d{2}$/.test(narrowClockLayout.clockText)) {
      throw new Error(`Topbar dual clock did not survive the narrow viewport layout.\n${JSON.stringify(narrowClockLayout, null, 2)}`);
    }

    if (narrowClockLayout.pageHasHorizontalOverflow || narrowClockLayout.topbarHasHorizontalOverflow || narrowClockLayout.gridHasHorizontalOverflow || narrowClockLayout.overviewCardOverflowCount > 0) {
      throw new Error(`Dual clock or Layer 1 cards caused overflow at the narrow viewport.\n${JSON.stringify(narrowClockLayout, null, 2)}`);
    }

    await page.setViewportSize({ width: 1280, height: 2200 });
    await page.waitForTimeout(250);

    await page.getByRole("button", { name: "Pair Analysis" }).click();
    await page.waitForSelector("text=Layer 2 Trade Selection", { timeout: 15000 });

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

    const factorEdgeLayout = await page.evaluate(() => {
      const doc = document.documentElement;
      const panel = document.getElementById("factorEdgeLabPanel");
      const tableScrolls = Array.from(document.querySelectorAll(".factor-edge-table-scroll")).map((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflows: node.scrollWidth > node.clientWidth + 1
      }));

      return {
        pageHasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        panelHasHorizontalOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
        overflowingTableScrollCount: tableScrolls.filter((entry) => entry.overflows).length,
        tableScrollCount: tableScrolls.length
      };
    });

    if (factorEdgeLayout.pageHasHorizontalOverflow) {
      throw new Error(`Factor Edge Lab caused page-level horizontal overflow.\n${JSON.stringify(factorEdgeLayout, null, 2)}`);
    }

    if (factorEdgeLayout.panelHasHorizontalOverflow) {
      throw new Error(`Factor Edge Lab panel overflowed horizontally instead of containing overflow inside its local table scrollers.\n${JSON.stringify(factorEdgeLayout, null, 2)}`);
    }

    if (factorEdgeLayout.tableScrollCount === 0) {
      throw new Error(`Factor Edge Lab did not render any local table scroll shells.\n${JSON.stringify(factorEdgeLayout, null, 2)}`);
    }

    await page.getByRole("button", { name: "Shadow Logic Backtest" }).click();
    await page.waitForSelector("text=Research-Only Shadow Logic Comparison", { timeout: 15000 });
    const shadowBacktestText = await page.locator("#shadowLogicBacktestPanel").innerText();
    const normalizedShadowBacktestText = shadowBacktestText.toLowerCase();

    for (const expectedShadowText of [
      "original logic vs evidence-reweighted shadow logic",
      "data/phase-2-shadow-backtest.json",
      "original logic",
      "shadow logic",
      "shadow factor weight changes",
      "increase candidate",
      "reduce candidate",
      "confirmation only",
      "insufficient evidence",
      "asset comparison"
    ]) {
      if (!normalizedShadowBacktestText.includes(expectedShadowText)) {
        throw new Error(`Shadow Logic Backtest did not render expected text: ${expectedShadowText}\n${shadowBacktestText}`);
      }
    }

    for (const expectedAsset of ["usd", "eur", "gold", "nq", "btc"]) {
      if (!normalizedShadowBacktestText.includes(expectedAsset)) {
        throw new Error(`Shadow Logic Backtest did not render expected asset ${expectedAsset}.\n${shadowBacktestText}`);
      }
    }

    const shadowLayout = await page.evaluate(() => {
      const doc = document.documentElement;
      const panel = document.getElementById("shadowLogicBacktestPanel");
      const tableScrolls = Array.from(document.querySelectorAll(".shadow-backtest-table-scroll")).map((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflows: node.scrollWidth > node.clientWidth + 1
      }));

      return {
        pageHasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        panelHasHorizontalOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
        overflowingTableScrollCount: tableScrolls.filter((entry) => entry.overflows).length,
        tableScrollCount: tableScrolls.length
      };
    });

    if (shadowLayout.pageHasHorizontalOverflow) {
      throw new Error(`Shadow Logic Backtest caused page-level horizontal overflow.\n${JSON.stringify(shadowLayout, null, 2)}`);
    }

    if (shadowLayout.panelHasHorizontalOverflow) {
      throw new Error(`Shadow Logic Backtest panel overflowed horizontally instead of containing overflow inside local table scrollers.\n${JSON.stringify(shadowLayout, null, 2)}`);
    }

    if (shadowLayout.tableScrollCount === 0) {
      throw new Error(`Shadow Logic Backtest did not render any local table scroll shells.\n${JSON.stringify(shadowLayout, null, 2)}`);
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
      factor_edge_layout: factorEdgeLayout,
      shadow_backtest_layout: shadowLayout,
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
