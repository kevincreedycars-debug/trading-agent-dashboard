const fs = require("node:fs");
const path = require("node:path");

const workflowPath = path.resolve(__dirname, "..", "exports", "dashboard_writer.json");

const oldCalendarBlock = `const weekendBlockedAssets = ["USD", "EUR", "GOLD", "NQ"];

const nowLondon = new Date();
const londonWeekday = nowLondon.toLocaleDateString("en-US", {
  weekday: "long",
  timeZone: "Europe/London"
});

const isWeekend = ["Saturday", "Sunday"].includes(londonWeekday);

function isMarketOpen(agent) {
  if (agent === "BTC") return true;
  return !isWeekend;
}`;

const newCalendarBlock = `const WEEKDAY_ASSETS = new Set(["USD", "EUR", "GBP", "GOLD", "SILVER", "WTI", "NQ"]);
const CONTINUOUS_ASSETS = new Set(["BTC"]);
const ASSET_ALIASES = { XAU: "GOLD", XAG: "SILVER" };

const nowLondon = new Date();
const londonWeekday = nowLondon.toLocaleDateString("en-US", {
  weekday: "long",
  timeZone: "Europe/London"
});

const isWeekend = ["Saturday", "Sunday"].includes(londonWeekday);

function normalizeAssetCode(agent) {
  const normalized = String(agent || "").trim().toUpperCase();
  return ASSET_ALIASES[normalized] || normalized;
}

function isMarketOpen(agent) {
  const asset = normalizeAssetCode(agent);
  if (CONTINUOUS_ASSETS.has(asset)) return true;
  if (!WEEKDAY_ASSETS.has(asset)) return false;
  return !isWeekend;
}`;

function applyDashboardWriterMarketCalendar(workflow) {
  let patchedNodes = 0;
  for (const node of workflow.nodes || []) {
    const code = node.parameters?.jsCode;
    if (typeof code !== "string" || !code.includes("const weekendBlockedAssets")) continue;
    if (!code.includes(oldCalendarBlock)) {
      throw new Error(`Unexpected dashboard writer calendar block in ${node.name}.`);
    }
    const nextCode = code
      .replace(oldCalendarBlock, newCalendarBlock)
      .replaceAll("applyWeekend24hCall", "applyMarketClosure")
      .replace("if (isWeekend && weekendBlockedAssets.includes(agent)) {", "if (!isMarketOpen(agent)) {")
      .replace("Weekend rule active: this market is closed, so no 24h bias is issued.", "Market-closure rule active: no 24h bias is issued.");
    node.parameters.jsCode = nextCode;
    patchedNodes += 1;
  }
  if (!patchedNodes && !workflow.nodes?.some((node) => node.parameters?.jsCode?.includes("const CONTINUOUS_ASSETS"))) {
    throw new Error("No dashboard writer calendar blocks were found.");
  }
  return workflow;
}

function writeWorkflow() {
  const raw = fs.readFileSync(workflowPath, "utf8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const workflow = applyDashboardWriterMarketCalendar(JSON.parse(raw));
  fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2).replace(/\n/g, newline)}${newline}`, "utf8");
}

if (require.main === module) writeWorkflow();

module.exports = { applyDashboardWriterMarketCalendar };
