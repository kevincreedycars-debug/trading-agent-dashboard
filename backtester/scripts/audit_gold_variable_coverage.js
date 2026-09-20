const fs = require('node:fs');
const path = require('node:path');
const {
  MISSING_SOURCE_TOKEN,
  buildCoverageAudit,
  renderMarkdown
} = require('../lib/gold_variable_coverage');

const OUTPUT_FILES = Object.freeze(['coverage.json', 'COVERAGE.md']);

function resolveSourceArgument(argument) {
  if (argument === undefined) return null;
  const trimmed = String(argument).trim();
  if (!trimmed || trimmed.toLowerCase() === MISSING_SOURCE_TOKEN) return null;
  return path.resolve(trimmed);
}

function assertOutputWritable(outputDirectory) {
  if (fs.existsSync(outputDirectory)) {
    const existing = OUTPUT_FILES.filter(name => fs.existsSync(path.join(outputDirectory, name)));
    if (existing.length) {
      throw new Error(`Refusing to overwrite completed report files: ${existing.join(', ')} in ${outputDirectory}. Choose a new output directory.`);
    }
    if (!fs.statSync(outputDirectory).isDirectory()) {
      throw new Error(`Output path exists and is not a directory: ${outputDirectory}`);
    }
  }
}

function run(args = process.argv.slice(2)) {
  if (args.length < 4 || args.length > 5) {
    throw new Error('Usage: node backtester/scripts/audit_gold_variable_coverage.js FRED_DIRECTORY HOURLY_DIRECTORY EVENTS_DIRECTORY NEW_OUTPUT_DIRECTORY [REGISTRY_JSON]\n' +
      `Use the literal token "${MISSING_SOURCE_TOKEN}" for a source you are intentionally not supplying; it is then reported as unknown, never as passed.`);
  }
  const registryPath = path.resolve(args[4] ?? path.resolve(__dirname, '../registries/gold_variable_horizon_context.v1.json'));
  const outputDirectory = path.resolve(args[3]);
  assertOutputWritable(outputDirectory);
  const report = buildCoverageAudit({
    registryPath,
    fredDirectory: resolveSourceArgument(args[0]),
    hourlyDirectory: resolveSourceArgument(args[1]),
    eventsDirectory: resolveSourceArgument(args[2]),
    outputDirectory,
    command: `node backtester/scripts/audit_gold_variable_coverage.js ${args.join(' ')}`,
    now: process.env.GOLD_VARIABLE_COVERAGE_NOW || undefined
  });
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'coverage.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(outputDirectory, 'COVERAGE.md'), renderMarkdown(report), { flag: 'wx' });
  console.log(JSON.stringify({
    report: path.join(outputDirectory, 'coverage.json'),
    markdown: path.join(outputDirectory, 'COVERAGE.md'),
    content_sha256: report.content_sha256,
    sources_supplied: report.sources_supplied,
    declared_inventory_total: report.reconciliation.declared_inventory_total,
    variables_with_verified_local_source: report.reconciliation.variables_with_verified_local_source,
    variables_by_source_backing: report.reconciliation.variables_by_source_backing,
    checks_by_status: report.reconciliation.checks_by_status,
    event_anchor_count: report.reconciliation.daily_anchor_reconcile.event_anchor_count,
    daily_anchor_count: report.reconciliation.daily_anchor_reconcile.anchor_count
  }));
  return report;
}

if (require.main === module) run();
module.exports = { OUTPUT_FILES, assertOutputWritable, resolveSourceArgument, run };
