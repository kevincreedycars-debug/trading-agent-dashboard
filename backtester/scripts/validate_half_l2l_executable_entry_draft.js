#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  buildDryRunCoverageReport,
  buildDraftContract,
  DRAFT_CONTRACT_PATH,
  loadSourceArtifact,
  validateDraftContract
} = require("../lib/half_l2l_executable_entry_draft");
const { parseArgs } = require("../lib/historical_common");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DRY_RUN_OUTPUT_PATH = path.join(REPO_ROOT, "tmp", "half-l2l-executable-entry-v1-draft-dry-run-coverage-20260815.json");

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceArtifact = loadSourceArtifact();
  const contract = buildDraftContract(sourceArtifact);
  const errors = validateDraftContract(contract, sourceArtifact);
  const dryRunCoverage = buildDryRunCoverageReport(sourceArtifact, contract);

  if (args.write === "true") {
    fs.writeFileSync(DRAFT_CONTRACT_PATH, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  } else if (fs.existsSync(DRAFT_CONTRACT_PATH)) {
    const existing = JSON.parse(fs.readFileSync(DRAFT_CONTRACT_PATH, "utf8"));
    const comparableExisting = JSON.stringify({ ...existing, meta: { ...existing.meta, generated_at: null } });
    const comparableCurrent = JSON.stringify({ ...contract, meta: { ...contract.meta, generated_at: null } });
    if (comparableExisting !== comparableCurrent) {
      errors.push("Draft contract artifact is stale relative to the current isolated builder output.");
    }
  } else {
    errors.push(`Draft contract artifact is missing at ${path.relative(REPO_ROOT, DRAFT_CONTRACT_PATH).replace(/\\/g, "/")}`);
  }

  fs.writeFileSync(DRY_RUN_OUTPUT_PATH, `${JSON.stringify(dryRunCoverage, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    contract_path: path.relative(REPO_ROOT, DRAFT_CONTRACT_PATH).replace(/\\/g, "/"),
    dry_run_output_path: path.relative(REPO_ROOT, DRY_RUN_OUTPUT_PATH).replace(/\\/g, "/"),
    source_population: contract.source_population,
    scenario_coverage: dryRunCoverage.scenarios.map((scenario) => ({
      scenario_key: scenario.scenario_key,
      included_row_count: scenario.included_row_count,
      excluded_row_count: scenario.excluded_row_count,
      included_pct: scenario.included_pct,
      exclusion_reasons: scenario.exclusion_reasons
    })),
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
