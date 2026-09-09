const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

// Offline execution of the checked-in consumer, never a workflow import or API call.
function validateGoldHistoryPatch(workflow, patch) {
  const node = workflow.nodes?.find(node => node.name === 'Normalise Market Snapshot');
  if (typeof node?.parameters?.jsCode !== 'string') throw new Error('Gold normalization code required.');
  const code = node.parameters.jsCode;
  const queryAt = instant => {
    const date = timestamp => ({ toUTC() { return this; },
      toISODate() { return new Date(timestamp).toISOString().slice(0, 10); },
      minus({ days }) { return date(timestamp - days * 86400000); } });
    return new URLSearchParams(vm.runInNewContext(patch.replacement_parameters.filterString.slice(3, -2).trim(),
      { $now: date(Date.parse(instant)) }, { timeout: 1000 }));
  };
  const normalize = (rows, instant = '2024-03-11T12:00:00Z') => {
    class Clock extends Date {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return Date.parse(instant); }
    }
    const values = { 'Supabase | Get Previous Market Snapshots': rows,
      'HTTP Request | Gold - Coinbase': [{ data: { amount: '200' } }] };
    return JSON.parse(JSON.stringify(vm.runInNewContext(`(function() { ${code}\n})()`, {
      Date: Clock, $: name => ({ first: () => ({ json: values[name]?.[0] ?? {} }),
        all: () => (values[name] || []).map(json => ({ json })) })
    }, { timeout: 1000 })));
  };
  const checks = [];
  const check = (name, run) => { run(); checks.push({ name, passed: true }); };
  check('query_parameters_and_utc_calendar_bounds', () => {
    assert.equal(patch.replacement_parameters.returnAll, true);
    assert.equal(patch.replacement_parameters.limit, undefined);
    for (const [instant, lower, upper] of [
      ['2024-03-11T00:30:00Z', '2024-01-11', '2024-03-11'],
      ['2024-11-04T00:30:00Z', '2024-09-05', '2024-11-04'],
      ['2024-01-01T00:00:00Z', '2023-11-02', '2024-01-01']
    ]) {
      const query = queryAt(instant);
      assert.equal(query.get('and'), `(snapshot_date.lt.${upper},snapshot_date.gte.${lower})`);
      assert.equal(query.get('order'), 'snapshot_date.desc,run_time_et.desc,id.desc');
      assert.equal(query.has('limit'), false);
      for (const field of ['id', 'snapshot_date', 'run_time_et', 'gold_price']) assert.ok(query.get('select').split(',').includes(field));
    }
  });
  const rows = Array.from({ length: 30 }, (_, day) => {
    const date = new Date(Date.parse('2024-03-10T00:00:00Z') - day * 86400000).toISOString().slice(0, 10);
    return Array.from({ length: 20 }, (_, revision) => ({ id: `${day}-${revision}`,
      snapshot_date: date, run_time_et: `${date}T12:${String(59 - revision).padStart(2, '0')}:00Z`,
      gold_price: revision === 0 ? 100 + day : 50 }));
  }).flat();
  const result = normalize(rows);
  check('full_history_shape_and_independent_lookback_values', () => {
    assert.equal(result.length, 1);
    assert.equal(result[0].json.data_quality.history_rows_used, 30);
    assert.equal(result[0].json.gold_d1_pct, 100);
    assert.equal(result[0].json.gold_d5_pct, 100 * (200 - 104) / 104);
    assert.equal(result[0].json.gold_d20_pct, 100 * (200 - 119) / 119);
    assert.equal(result[0].json.raw_payload.previous_snapshot_dates_used.length, 30);
  });
  check('unordered_25_row_truncation_cannot_recover_20_observations', () => {
    const truncated = normalize(rows.slice(-25))[0].json;
    assert.equal(truncated.data_quality.history_rows_used, 2);
    assert.notEqual(truncated.gold_d1_pct, result[0].json.gold_d1_pct);
    assert.equal(truncated.gold_d20_pct, truncated.gold_d1_pct);
  });
  check('same_day_and_future_rows_do_not_enter_normalized_history', () => {
    const extra = ['2024-03-11', '2024-03-12'].map(date => ({ id: date, snapshot_date: date,
      run_time_et: `${date}T10:00:00Z`, gold_price: 999999 }));
    assert.deepEqual(normalize([...extra, ...rows]), result);
  });
  check('duplicate_dates_use_latest_run_and_equal_time_input_order', () => {
    assert.deepEqual(normalize([...rows].reverse()), result);
    const tie = { ...rows[0], id: 'zz-tie', gold_price: 125 };
    assert.equal(normalize([tie, ...rows])[0].json.gold_d1_pct, 60);
    assert.equal(normalize([...rows, tie])[0].json.gold_d1_pct, 100);
  });
  check('empty_history_retains_documented_zero_fallback', () => {
    const empty = normalize([])[0].json;
    assert.equal(empty.data_quality.history_rows_used, 0);
    for (const field of ['gold_d1_pct', 'gold_d5_pct', 'gold_d20_pct']) assert.equal(empty[field], 0);
    assert.deepEqual(Object.keys(empty).sort(), Object.keys(result[0].json).sort());
  });
  return { version: 'gold-history-patch-offline-validation-v1', research_only: true,
    normalization_code_sha256: crypto.createHash('sha256').update(code).digest('hex'),
    synthetic_rows: rows.length, checks, installed_n8n_validated: false, production_applied: false,
    limitations: ['The $now and node-item APIs are mocked; installed n8n filter serialization and pagination are not exercised.',
      'Equal run timestamps preserve incoming row order; descending ID server order must survive pagination.',
      'Zero/short-history fallback is preserved, not qualified as sufficient input history.',
      'Prior snapshot dates do not authenticate created_at availability or source vintages.',
      'Query and normalization clocks must use the same UTC date; midnight-crossing execution needs separate validation.'] };
}

module.exports = { validateGoldHistoryPatch };
