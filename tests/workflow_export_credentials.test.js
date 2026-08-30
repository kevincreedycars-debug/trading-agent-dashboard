const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const exportDirectory = path.resolve(__dirname, "..", "exports");
const rapidApiExpression = `={{ ${String.fromCharCode(36)}env.RAPIDAPI_KEY }}`;
const finnhubExpression = `token={{ ${String.fromCharCode(36)}env.FINNHUB_API_KEY }}`;

function workflowExports() {
  return fs.readdirSync(exportDirectory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({
      name,
      workflow: JSON.parse(fs.readFileSync(path.join(exportDirectory, name), "utf8"))
    }));
}

test("workflow exports use n8n-managed provider credentials", () => {
  const serializedExports = [];

  for (const { name, workflow } of workflowExports()) {
    const serialized = JSON.stringify(workflow);
    serializedExports.push(serialized);
    assert.doesNotMatch(serialized, /cec1f7f099|d808mnpr01/i, `${name} contains a retired provider credential`);

    for (const node of workflow.nodes || []) {
      if (!node.parameters?.jsonHeaders) continue;
      const headers = JSON.parse(node.parameters.jsonHeaders);
      if (Object.hasOwn(headers, "x-rapidapi-key")) {
        assert.equal(headers["x-rapidapi-key"], rapidApiExpression, `${name}: ${node.name}`);
      }
    }
  }

  const finnhubUrls = serializedExports
    .flatMap((serialized) => Array.from(serialized.matchAll(/https:\/\/finnhub\.io\/[^"\\]+/g)))
    .map((match) => match[0]);

  assert.ok(finnhubUrls.length > 0, "expected at least one Finnhub request in the exports");
  finnhubUrls.forEach((url) => assert.ok(url.includes(finnhubExpression), `Finnhub URL is not environment-backed: ${url}`));
});
