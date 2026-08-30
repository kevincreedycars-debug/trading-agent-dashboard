const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyDashboardWriterMarketCalendar } = require("../scripts/apply_dashboard_writer_market_calendar");

const exportPath = path.resolve(__dirname, "..", "exports", "dashboard_writer.json");

function readWorkflow() {
  return JSON.parse(fs.readFileSync(exportPath, "utf8"));
}

test("dashboard writer uses the shared baseline market-session policy", () => {
  const matchingNodes = readWorkflow().nodes.filter((node) => node.parameters?.jsCode?.includes("CONTINUOUS_ASSETS"));
  assert.ok(matchingNodes.length > 0, "expected a dashboard writer calendar block");
  matchingNodes.forEach((node) => {
    const code = node.parameters.jsCode;
    assert.match(code, /WEEKDAY_ASSETS = new Set\(\["USD", "EUR", "GBP", "GOLD", "SILVER", "WTI", "NQ"\]\)/);
    assert.match(code, /CONTINUOUS_ASSETS = new Set\(\["BTC"\]\)/);
    assert.match(code, /if \(!WEEKDAY_ASSETS\.has\(asset\)\) return false/);
    assert.match(code, /if \(!isMarketOpen\(agent\)\)/);
    assert.doesNotMatch(code, /weekendBlockedAssets|applyWeekend24hCall/);
  });
});

test("dashboard writer calendar patcher is idempotent", () => {
  const once = applyDashboardWriterMarketCalendar(readWorkflow());
  const twice = applyDashboardWriterMarketCalendar(once);
  assert.deepEqual(twice, once);
});
