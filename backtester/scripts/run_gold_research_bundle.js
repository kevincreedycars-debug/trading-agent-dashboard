const fs = require('node:fs');
const path = require('node:path');
const { run: buildMacro } = require('./build_gold_macro_vintage_dataset');
const { run: attachEvents } = require('./attach_gold_event_vintages');
const { run: experiment } = require('./build_gold_research_experiments');

// Offline orchestration only: each source acquisition is a separate explicit read-only command.
function run(args = process.argv.slice(2)) {
  if (args.length !== 4) throw new Error('Usage: FRED_DIRECTORY HOURLY_DIRECTORY EVENT_DIRECTORY NEW_OUTPUT_DIRECTORY');
  const output = path.resolve(args[3]);
  buildMacro([args[0], args[1], output]);
  attachEvents([`${output}/dataset.json`, args[2], `${output}/event-dataset.json`]);
  const plan = path.resolve(__dirname, '../registries/gold_macro_exploration_plan.v1.json');
  const report = experiment([`${output}/event-dataset.json`, `${output}/snapshots.json`, plan, `${output}/experiments.json`]);
  const selected = report.experiments.find(row => row.id === report.selected_by_training_only);
  const audit = report.event_vintage_audit;
  const summary = [
    '# Gold research result', '',
    'Status: exploratory engine run complete; live-call reliability and greater-than-60% qualification NOT established.', '',
    `Scheduled decisions: ${report.coverage.source_calls}. Training: ${report.coverage.training}; validation: ${report.coverage.validation}; excluded: ${report.coverage.excluded}.`,
    `Candidates attempted: ${report.candidate_count}. Eligible by training reporting floor: ${report.eligible_training_candidates}.`, '',
    '## Candidate selected using training only', '',
    selected ? JSON.stringify({ id: selected.id, conditions: selected.conditions, direction: selected.expected_direction,
      training: selected.training, validation: selected.validation }, null, 2) : 'No candidate meets the training reporting floor.', '',
    '## Evidence limits', '',
    `Event archive: ${audit.source_events} records. Decisions with eligible current-archive event proxies: ${audit.calls_with_eligible_event}; recent releases with only late/unknown vintages: ${audit.calls_with_only_later_or_unknown_vintages}.`,
    'The final holdout is not untouched. All intervals span exactly 24 elapsed hours, but outcomes use endpoints across unclassified session gaps. Macro availability uses a conservative vintage-date lag. Event consensus versions are not authenticated.',
    'These reconstructed observations are not historical production Layer 1 or Layer 2 calls. No production formula is changed.', '',
    'Full candidate results, exclusions, source hashes and lineage accompany this report in experiments.json and event-dataset.json.'
  ].join('\n');
  fs.writeFileSync(`${output}/REPORT.md`, summary + '\n', { flag: 'wx' });
}
if (require.main === module) run();
module.exports = { run };
