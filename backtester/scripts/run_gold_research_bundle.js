const fs = require('node:fs');
const path = require('node:path');
const { run: buildMacro } = require('./build_gold_macro_vintage_dataset');
const { run: attachEvents } = require('./attach_gold_event_vintages');
const { run: experiment } = require('./build_gold_research_experiments');

// Offline orchestration only: each source acquisition is a separate explicit read-only command.
function run(args = process.argv.slice(2)) {
  if (args.length < 4 || args.length > 5) throw new Error('Usage: FRED_DIRECTORY HOURLY_DIRECTORY EVENT_DIRECTORY NEW_OUTPUT_DIRECTORY [as_of_proxy|retrospective]');
  const mode = args[4] ?? 'as_of_proxy';
  if (!['as_of_proxy', 'retrospective'].includes(mode)) throw new Error('Unknown event evidence mode');
  const output = path.resolve(args[3]);
  buildMacro([args[0], args[1], output]);
  attachEvents([`${output}/dataset.json`, args[2], `${output}/event-dataset.json`, mode]);
  const plan = path.resolve(__dirname, '../registries/gold_macro_exploration_plan.v1.json');
  const report = experiment([`${output}/event-dataset.json`, `${output}/snapshots.json`, plan, `${output}/experiments.json`]);
  const selected = report.experiments.find(row => row.id === report.selected_by_training_only);
  const audit = report.event_vintage_audit;
  const eventNames = new Map(JSON.parse(fs.readFileSync(`${output}/event-dataset.json`)).calls
    .flatMap(call => [...(call.features || []), ...(call.retrospective_event_features || [])])
    .map(feature => [feature.name, feature.event_name]));
  const summary = [
    '# Gold research result', '',
    'Status: exploratory engine run complete; live-call reliability and greater-than-60% qualification NOT established.', '',
    `Event evidence mode: ${mode}. Retrospective mode uses current archived values for historical association, not verified historical model inputs.`, '',
    `Scheduled decisions: ${report.coverage.source_calls}. Training: ${report.coverage.training}; validation: ${report.coverage.validation}; excluded: ${report.coverage.excluded}.`,
    `Candidates attempted: ${report.candidate_count}. Eligible by training reporting floor: ${report.eligible_training_candidates}.`, '',
    '## Candidate selected using training only', '',
    selected ? JSON.stringify({ id: selected.id, conditions: selected.conditions, direction: selected.expected_direction,
      training: selected.training, validation: selected.validation }, null, 2) : 'No candidate meets the training reporting floor.', '',
    '## Evidence limits', '',
    `Event archive: ${audit.source_events} records. Decisions with usable events in this mode: ${audit.calls_with_eligible_event}; numeric events with late/unknown vintages: ${audit.calls_with_only_later_or_unknown_vintages}; recent releases missing actual/consensus/family: ${audit.calls_with_recent_release_but_missing_values}; no recent release: ${audit.calls_without_recent_release}.`,
    'The final holdout is not untouched. All intervals span exactly 24 elapsed hours, but outcomes use endpoints across unclassified session gaps. Macro availability uses a conservative vintage-date lag. Event consensus versions are not authenticated.',
    'These reconstructed observations are not historical production Layer 1 or Layer 2 calls. No production formula is changed.', '',
    'Full candidate results, exclusions, source hashes and lineage accompany this report in experiments.json and event-dataset.json.', '',
    '## Event-family coverage', '',
    'Counts are daily decisions with a recent family release, not independent release counts. Simultaneous families overlap. Friday releases can lack a tradable exact 24-hour endpoint; exclusions are retained.', '',
    '| Event family | Source decisions | Training | Validation | Exclusions |',
    '| --- | --- | --- | --- | --- |',
    ...report.event_family_coverage.map(row => `| ${row.event_name.replace(/\|/g, '/')} | ${row.source_decisions} | ${row.training} | ${row.validation} | ${JSON.stringify(row.exclusions)} |`), '',
    '## Single event-variable associations', '',
    'Directions are learned from training only. All rows are exploratory; the reporting floor is not a reliability certificate. Flat outcomes are excluded from the displayed directional denominator.', '',
    '| Event condition | Direction | Training correct/decisive | Validation correct/decisive | Training floor met |',
    '| --- | --- | --- | --- | --- |',
    ...report.experiments.filter(row => row.event_conditioned && row.conditions.length === 1 && row.conditions[0].operator === 'eq').map(row => {
      const condition = row.conditions[0];
      const label = `${eventNames.get(condition.feature) ?? condition.feature}: ${condition.value}`.replace(/\|/g, '/');
      return `| ${label} | ${row.expected_direction} | ${row.training.correct}/${row.training.directional_observations} | ${row.validation.correct}/${row.validation.directional_observations} | ${row.training_eligible} |`;
    })
  ].join('\n');
  fs.writeFileSync(`${output}/REPORT.md`, summary + '\n', { flag: 'wx' });
}
if (require.main === module) run();
module.exports = { run };
