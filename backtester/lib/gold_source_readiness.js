const { parseTimestamp } = require('./gold_timestamped_evaluation');

// Repository logic inputs, not a claim of an exhaustive economic literature review.
const GOLD_VARIABLES = Object.freeze([
  'us_10y_real_yield', 'us_10y_real_yield_d5_bps', 'us_10y_real_yield_d20_bps',
  'dxy_level', 'dxy_d1', 'dxy_d5', 'dxy_d20', 'fed_bias',
  'us_2y_yield', 'us_2y_d5_bps', 'us_2y_d20_bps',
  'gold_price', 'gold_d1_pct', 'gold_d5_pct', 'gold_d20_pct',
  'vix_level', 'vix_d1', 'vix_d5', 'inflation_signal', 'risk_headline_context',
  'equities_regime', 'growth_regime',
  'event_type', 'event_actual', 'event_consensus', 'event_previous_as_released',
  'event_surprise', 'event_age_hours'
]);

function auditGoldSourceReadiness(input) {
  if (!Array.isArray(input?.feature_records)) throw new Error('feature_records array required');
  const rows = GOLD_VARIABLES.map(name => {
    const records = input.feature_records.filter(row => row?.name === name);
    const reasons = {};
    const identities = new Set();
    let eligible = 0;
    for (const record of records) {
      const issues = [];
      const observed = parseTimestamp(record.observed_at);
      const available = parseTimestamp(record.available_at);
      if (observed === null || available === null || available < observed) issues.push('invalid_observation_availability');
      if (!['number', 'string', 'boolean'].includes(typeof record.value) ||
          (typeof record.value === 'number' && !Number.isFinite(record.value)) ||
          (typeof record.value === 'string' && !record.value.trim())) issues.push('invalid_value');
      for (const field of ['source', 'source_record_id', 'units', 'availability_evidence_ref', 'vintage_id']) {
        if (typeof record[field] !== 'string' || !record[field].trim()) issues.push(`missing_${field}`);
      }
      if (!/^[a-f0-9]{64}$/i.test(record.source_sha256 || '')) issues.push('missing_source_sha256');
      if (record.timing_basis !== 'source_publication') issues.push('publication_timing_unverified');
      const identity = `${record.source}|${record.source_record_id}|${record.vintage_id}`;
      if (identities.has(identity)) issues.push('duplicate_source_identity');
      identities.add(identity);
      for (const issue of issues) reasons[issue] = (reasons[issue] || 0) + 1;
      if (!issues.length) eligible++;
    }
    return { name, records: records.length, metadata_eligible_records: eligible,
      rejected_records: records.length - eligible, issue_counts: reasons,
      status: !records.length ? 'missing' : eligible === records.length ? 'metadata_complete_requires_source_audit' : 'incomplete' };
  });
  return { version: 'gold-source-readiness-v1', research_only: true,
    source_document: 'logic/agent_gold_direction.md plus explicit event decomposition',
    original_research_document_coverage_verified: false,
    trustworthy_dataset_established: false,
    note: 'Checks supplied metadata only. Evidence references and source hashes still need independent verification; no statistical or timing qualification follows.',
    unregistered_record_count: input.feature_records.filter(row => !GOLD_VARIABLES.includes(row?.name)).length,
    variable_count: rows.length, missing_variables: rows.filter(row => row.status === 'missing').length, variables: rows };
}

module.exports = { GOLD_VARIABLES, auditGoldSourceReadiness };
