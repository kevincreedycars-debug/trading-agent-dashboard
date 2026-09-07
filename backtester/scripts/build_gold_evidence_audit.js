#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildGoldEvidenceAudit } = require('../lib/gold_evidence_audit');

function run(args = process.argv.slice(2)) {
  if (args.length > 5 || args.length === 4) throw new Error('Usage: node backtester/scripts/build_gold_evidence_audit.js [INPUT.json] [OUTPUT.json] [OUTPUT.html] [PILOT.json LINEAGE.json]');
  const source = path.resolve(args[0] || path.join(__dirname, '../../data/backtester-checker-gold-24h-2024-2026.json'));
  const output = path.resolve(args[1] || path.join(__dirname, '../../data/gold-evidence-audit.json'));
  if (source.toLowerCase() === output.toLowerCase()) throw new Error('Output must not overwrite source evidence.');
  const page = args[2] ? path.resolve(args[2]) : null;
  if (page && [source, output].some(value => value.toLowerCase() === page.toLowerCase())) throw new Error('HTML output must be separate from JSON evidence.');
  const extras = args.slice(3).map(value => path.resolve(value));
  if (extras.some(value => [output, page].filter(Boolean).some(target => target.toLowerCase() === value.toLowerCase()))) throw new Error('Outputs must not overwrite pilot or lineage evidence.');
  const pilot = extras[0] ? JSON.parse(fs.readFileSync(extras[0], 'utf8')) : null;
  const lineage = extras[1] ? JSON.parse(fs.readFileSync(extras[1], 'utf8')) : null;
  if (pilot && (pilot.version !== 'gold-stored-call-pilot-v1' || lineage?.version !== 'gold-snapshot-lineage-audit-v1')) throw new Error('Expected stored-call pilot and snapshot lineage reports.');
  const raw = fs.readFileSync(source);
  const report = buildGoldEvidenceAudit(JSON.parse(raw.toString('utf8')));
  report.source_sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  // The optional third path emits a self-contained page, also usable via file://.
  if (page) {
    const template = fs.readFileSync(path.join(__dirname, '../templates/gold-research.html'), 'utf8');
    const safe = value => JSON.stringify(value).replace(/</g, '\\u003c');
    fs.writeFileSync(page, template.replace('__GOLD_AUDIT_JSON__', () => safe(report))
      .replace('__GOLD_PILOT_JSON__', () => safe(pilot)).replace('__GOLD_LINEAGE_JSON__', () => safe(lineage)));
  }
  console.log(JSON.stringify({ output, coverage: report.coverage, issue_counts: report.issue_counts,
    timing_gate: report.timing_gate }, null, 2));
  return report;
}
if (require.main === module) run();
module.exports = { run };
