// Deterministic Gold variable/horizon/prior-context coverage audit.
// Read-only: reads explicit local versioned inputs and writes one JSON plus one Markdown report.
// It never promotes a storage or archive timestamp to an authenticated release time, and it never
// reports an unsupported check as passed.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { parseTimestamp } = require('./gold_timestamped_evaluation');
const { GOLD_VARIABLES } = require('./gold_source_readiness');

const HOUR_MS = 3600000;
const DAY_MS = 86400000;
// Matches the conservative proxy declared by backtester/lib/gold_macro_vintage_dataset.js.
const FRED_VINTAGE_LAG_HOURS = 36;

// The milestone requires these candidate horizons to be declared; their audit status is read from
// the registry rather than invented here.
const REQUIRED_HORIZON_IDS = Object.freeze([
  'immediate_event_window',
  'h1_post_event',
  'h4_post_event',
  'h24_post_event',
  'd5_trading_days_post_event'
]);
const ELAPSED_HORIZON_MS = Object.freeze({ h1_post_event: HOUR_MS, h4_post_event: 4 * HOUR_MS, h24_post_event: DAY_MS });
const CHECK_STATUSES = Object.freeze(['passed', 'failed', 'unknown', 'not_applicable']);
const MISSING_SOURCE_TOKEN = 'none';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numericValue(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? { value: raw, state: 'present' } : { value: null, state: 'invalid' };
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '.') return { value: null, state: 'missing' };
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return { value: null, state: 'invalid' };
    return { value: Number(trimmed), state: 'present' };
  }
  return { value: null, state: 'missing' };
}

// A check may only be reported as passed when the source that would support it was actually supplied.
function checkResult(id, status, details = {}) {
  if (!CHECK_STATUSES.includes(status)) throw new Error(`Unknown check status: ${status}`);
  if (status === 'passed' && details.source_present !== true) {
    return { ...details, id, status: 'unknown', reason: 'no_supporting_evidence', downgraded_from: 'passed' };
  }
  return { ...details, id, status };
}

function tally(rows) {
  const counts = {};
  for (const row of rows) counts[row] = (counts[row] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function loadRegistry(registryPath) {
  const raw = fs.readFileSync(registryPath);
  return { registry: JSON.parse(raw), raw, sha256: sha256(raw) };
}

function validateRegistry(registry) {
  if (!isPlainObject(registry)) throw new Error('Registry object required.');
  if (typeof registry.version !== 'string' || !registry.version.trim()) throw new Error('Registry version required.');
  if (!Array.isArray(registry.variables) || !Array.isArray(registry.horizons) || !Array.isArray(registry.prior_context)) {
    throw new Error('Registry requires variables, horizons and prior_context arrays.');
  }
  const ids = registry.variables.map(row => row?.id);
  if (ids.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Every registry variable requires a string id.');
  if (new Set(ids).size !== ids.length) throw new Error('Registry variable ids must be unique.');
  const declared = [...GOLD_VARIABLES];
  if (ids.length !== declared.length) throw new Error(`Registry must declare all ${declared.length} inventory variables.`);
  const missing = declared.filter(name => !ids.includes(name));
  const extra = ids.filter(name => !declared.includes(name));
  if (missing.length || extra.length) {
    throw new Error(`Registry variables must match the declared inventory exactly. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`);
  }
  const statuses = registry.coverage_status_values;
  const horizonIds = registry.horizons.map(row => row?.id);
  if (new Set(horizonIds).size !== horizonIds.length) throw new Error('Registry horizon ids must be unique.');
  registry.variables.forEach((variable, index) => {
    if (variable.declared_inventory_index !== index + 1) throw new Error(`Registry variable ${variable.id} has an inconsistent declared_inventory_index.`);
    for (const field of ['definition', 'units', 'value_kind', 'event_type', 'research_status']) {
      if (typeof variable[field] !== 'string' || !variable[field].trim()) throw new Error(`Registry variable ${variable.id} is missing ${field}.`);
    }
    if (!isPlainObject(variable.source_mapping) || typeof variable.source_mapping.status !== 'string') {
      throw new Error(`Registry variable ${variable.id} requires a source_mapping with a status.`);
    }
    if (!Array.isArray(statuses) || !statuses.includes(variable.source_mapping.status)) {
      throw new Error(`Registry variable ${variable.id} uses an undeclared coverage status.`);
    }
    if (!isPlainObject(variable.timestamp_semantics) || typeof variable.timestamp_semantics.verified !== 'boolean') {
      throw new Error(`Registry variable ${variable.id} requires timestamp_semantics.verified.`);
    }
    if (!Array.isArray(variable.known_gaps)) throw new Error(`Registry variable ${variable.id} requires a known_gaps array.`);
    if (!Array.isArray(variable.horizons) || !variable.horizons.length) throw new Error(`Registry variable ${variable.id} requires at least one horizon.`);
    for (const horizon of variable.horizons) {
      if (!horizonIds.includes(horizon)) throw new Error(`Registry variable ${variable.id} references undeclared horizon ${horizon}.`);
    }
  });
  for (const required of REQUIRED_HORIZON_IDS) {
    if (!horizonIds.includes(required)) throw new Error(`Registry must declare the required horizon ${required}.`);
  }
  registry.horizons.forEach(horizon => {
    for (const field of ['label', 'anchor', 'required_resolution', 'applicability', 'audit_status']) {
      if (typeof horizon[field] !== 'string' || !horizon[field].trim()) throw new Error(`Horizon ${horizon.id} is missing ${field}.`);
    }
    if (!isPlainObject(horizon.end_offset)) throw new Error(`Horizon ${horizon.id} requires an end_offset object.`);
  });
  const contextIds = registry.prior_context.map(row => row?.id);
  if (new Set(contextIds).size !== contextIds.length) throw new Error('Registry prior_context ids must be unique.');
  registry.prior_context.forEach(field => {
    if (field.cutoff_rule !== 'strictly_before_observation_time') {
      throw new Error(`Prior context ${field.id} must declare a strictly-before cutoff rule.`);
    }
    if (typeof field.leakage_guard !== 'string' || !field.leakage_guard.trim()) throw new Error(`Prior context ${field.id} requires a leakage_guard.`);
    if (!Array.isArray(field.required_inputs) || !field.required_inputs.length) throw new Error(`Prior context ${field.id} requires required_inputs.`);
  });
  const aliases = registry.derived_name_aliases;
  if (!isPlainObject(aliases) || !isPlainObject(aliases.map)) throw new Error('Registry requires derived_name_aliases.map.');
  for (const key of Object.keys(aliases.map)) {
    if (!ids.includes(key)) throw new Error(`Derived name alias ${key} is not a declared variable.`);
  }
  return registry;
}

function resolveDeclaredAlias(registry, id) {
  return registry.derived_name_aliases.map[id] ?? id;
}

function listJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map(entry => entry.name)
    .sort();
}

function describeDirectory(role, directory) {
  if (directory === null || directory === undefined) {
    return { role, directory: null, present: false, reason: 'source_not_supplied', files: [], manifest: null };
  }
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return { role, directory, present: false, reason: 'directory_not_found', files: [], manifest: null };
  }
  return { role, directory, present: true, reason: null, files: [], manifest: null };
}

// Availability for a coverage question means: at which instant did this observation date first have a
// usable (non-null) published value? Using the newest revision instead would systematically understate
// availability for heavily revised series such as DTWEXBGS, so the earliest non-null vintage is used.
function fredObservationIndex(rows) {
  const byDate = new Map();
  let revisionRows = 0;
  for (const row of rows) {
    const state = byDate.get(row.date);
    if (state) {
      revisionRows++;
      state.vintages++;
      if (row.value === null) continue;
      state.first_usable_available = state.first_usable_available === null
        ? row.available : Math.min(state.first_usable_available, row.available);
      state.value = state.value === null ? row.value : state.value;
      continue;
    }
    byDate.set(row.date, {
      vintages: 1,
      first_usable_available: row.value === null ? null : row.available,
      value: row.value
    });
  }
  const dates = [...byDate.keys()].sort((a, b) => a - b);
  return {
    dates,
    available_at: dates.map(date => byDate.get(date).first_usable_available ?? Number.POSITIVE_INFINITY),
    values: dates.map(date => byDate.get(date).value),
    vintages_per_date: dates.map(date => byDate.get(date).vintages),
    revision_rows: revisionRows
  };
}

function readFredDirectory(directory) {
  const source = describeDirectory('fred', directory);
  if (!source.present) return { source, series_meta: {}, series_index: {}, errors: [] };
  const seriesMeta = {};
  const seriesIndex = {};
  const errors = [];
  for (const name of listJsonFiles(directory)) {
    const raw = fs.readFileSync(require('node:path').join(directory, name));
    source.files.push({ name, bytes: raw.length, sha256: sha256(raw) });
    if (name === 'manifest.json') {
      try { source.manifest = JSON.parse(raw); } catch { errors.push({ file: name, reason: 'invalid_json_manifest' }); }
      continue;
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { errors.push({ file: name, reason: 'invalid_json' }); continue; }
    const seriesId = typeof payload?.series_id === 'string' && payload.series_id.trim()
      ? payload.series_id : name.replace(/\.json$/i, '');
    if (!Array.isArray(payload?.observations)) { errors.push({ file: name, reason: 'observations_array_missing' }); continue; }
    const rows = [];
    let invalidRows = 0;
    let missingValues = 0;
    let invalidDates = 0;
    let invalidVintages = 0;
    for (const observation of payload.observations) {
      if (!isPlainObject(observation)) { invalidRows++; continue; }
      const date = parseTimestamp(`${observation.date}T00:00:00Z`);
      const vintage = parseTimestamp(`${observation.realtime_start}T00:00:00Z`);
      if (date === null) invalidDates++;
      if (vintage === null) invalidVintages++;
      const parsed = numericValue(observation.value);
      if (parsed.state === 'missing') missingValues++;
      if (date === null || vintage === null || parsed.state === 'invalid') { invalidRows++; continue; }
      rows.push({ date, vintage, available: vintage + FRED_VINTAGE_LAG_HOURS * HOUR_MS, value: parsed.value });
    }
    const index = fredObservationIndex(rows);
    seriesMeta[seriesId] = {
      series_id: seriesId,
      file: name,
      declared_feature: typeof payload?.['declared_feature'] === 'string' ? payload['declared_feature'] : null,
      raw_observation_rows: payload.observations.length,
      usable_rows: rows.length,
      invalid_rows: invalidRows,
      invalid_observation_dates: invalidDates,
      invalid_vintage_dates: invalidVintages,
      missing_values: missingValues,
      revision_rows: index.revision_rows,
      observation_dates: index.dates.length,
      first_observation_date: index.dates.length ? new Date(index.dates[0]).toISOString().slice(0, 10) : null,
      last_observation_date: index.dates.length ? new Date(index.dates[index.dates.length - 1]).toISOString().slice(0, 10) : null,
      availability_lag_hours: FRED_VINTAGE_LAG_HOURS,
      availability_rule: 'earliest non-null vintage plus the conservative 36-hour lag',
      timing_basis: 'vintage_date_plus_36h_conservative_proxy'
    };
    seriesIndex[seriesId] = index;
  }
  return { source, series_meta: seriesMeta, series_index: seriesIndex, errors };
}

function normalizeCandleTimestamp(value) {
  if (typeof value !== 'string') return null;
  return parseTimestamp(value.replace(/\.0{1,9}Z$/, 'Z'));
}

// A gap is classified as weekend-crossing when a UTC Saturday or Sunday date lies inside the
// closed interval between the two bar boundaries. Sessions are still not classified as closures.
function gapCrossesWeekend(previousOpen, currentOpen) {
  const firstDay = Date.UTC(new Date(previousOpen).getUTCFullYear(), new Date(previousOpen).getUTCMonth(), new Date(previousOpen).getUTCDate());
  const lastDay = Date.UTC(new Date(currentOpen).getUTCFullYear(), new Date(currentOpen).getUTCMonth(), new Date(currentOpen).getUTCDate());
  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) return true;
  }
  return false;
}

function readHourlyDirectory(directory) {
  const source = describeDirectory('hourly', directory);
  if (!source.present) {
    return { source, meta: {}, index: { by_open: new Map(), open_times: [] }, errors: [] };
  }
  const errors = [];
  const byOpen = new Map();
  let rawRows = 0;
  let incomplete = 0;
  let invalidTime = 0;
  let duplicateOpenTimes = 0;
  let nonNumericMid = 0;
  let instrument = null;
  let granularity = null;
  for (const name of listJsonFiles(directory)) {
    const raw = fs.readFileSync(require('node:path').join(directory, name));
    source.files.push({ name, bytes: raw.length, sha256: sha256(raw) });
    if (name === 'manifest.json') {
      try { source.manifest = JSON.parse(raw); } catch { errors.push({ file: name, reason: 'invalid_json_manifest' }); }
      continue;
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { errors.push({ file: name, reason: 'invalid_json' }); continue; }
    if (!Array.isArray(payload?.candles)) continue;
    instrument = instrument ?? (typeof payload.instrument === 'string' ? payload.instrument : null);
    granularity = granularity ?? (typeof payload.granularity === 'string' ? payload.granularity : null);
    for (const candle of payload.candles) {
      rawRows++;
      const open = normalizeCandleTimestamp(candle?.time);
      if (open === null) { invalidTime++; continue; }
      const close = numericValue(candle?.mid?.c);
      if (close.state !== 'present') nonNumericMid++;
      if (candle?.complete !== true) incomplete++;
      if (byOpen.has(open)) duplicateOpenTimes++;
      byOpen.set(open, { open, close_time: open + HOUR_MS, complete: candle?.complete === true,
        close: close.value, high: numericValue(candle?.mid?.h).value, low: numericValue(candle?.mid?.l).value });
    }
  }
  const openTimes = [...byOpen.keys()].sort((a, b) => a - b);
  let gapsTotal = 0;
  let gapsCrossingWeekend = 0;
  let largestGapHours = 0;
  for (let index = 1; index < openTimes.length; index++) {
    const delta = openTimes[index] - openTimes[index - 1];
    if (delta <= HOUR_MS) continue;
    gapsTotal++;
    largestGapHours = Math.max(largestGapHours, delta / HOUR_MS);
    if (gapCrossesWeekend(openTimes[index - 1], openTimes[index])) gapsCrossingWeekend++;
  }
  return {
    source,
    meta: {
      instrument: instrument ?? 'unlabeled',
      granularity: granularity ?? 'unlabeled',
      raw_candle_rows: rawRows,
      usable_candle_rows: byOpen.size,
      incomplete_flag_rows: incomplete,
      invalid_time_rows: invalidTime,
      duplicate_open_times: duplicateOpenTimes,
      non_numeric_mid_close: nonNumericMid,
      first_open_time: openTimes.length ? new Date(openTimes[0]).toISOString() : null,
      last_open_time: openTimes.length ? new Date(openTimes[openTimes.length - 1]).toISOString() : null,
      intra_span_gaps_over_one_hour: gapsTotal,
      gaps_crossing_weekend_boundary: gapsCrossingWeekend,
      largest_gap_hours: largestGapHours,
      continuity_policy: 'Consecutive hourly open times are compared. Every gap is reported; none is classified as a session closure because no XAU/USD calendar is declared.'
    },
    index: { by_open: byOpen, open_times: openTimes },
    errors
  };
}

function candleAt(hourlyIndex, time) {
  const candle = hourlyIndex.by_open.get(time);
  return candle && candle.complete === true && Number.isFinite(candle.close) ? candle : null;
}

function continuityBetween(hourlyIndex, startTime, endTime) {
  let missing = 0;
  let expected = 0;
  for (let time = startTime; time <= endTime; time += HOUR_MS) {
    expected++;
    if (!candleAt(hourlyIndex, time)) missing++;
  }
  return { expected_bars: expected, present_bars: expected - missing, missing_bars: missing, contiguous: missing === 0 };
}

const EVENT_DEDUP_POLICY = Object.freeze({
  primary_key: 'eventId|dateUtc|name',
  primary_key_meaning: 'One row per economic indicator release.',
  overlap_key: 'dateUtc|name',
  overlap_key_meaning: 'Rows sharing a release timestamp and name are retained and flagged as overlapping rather than dropped.',
  scope: 'Rows are not filtered by country or impact for coverage reporting; the flag counts are reported separately so the denominator stays complete.'
});

function readEventDirectory(directory) {
  const source = describeDirectory('events', directory);
  if (!source.present) {
    return { source, meta: {}, anchors: [], errors: [] };
  }
  const errors = [];
  const rows = [];
  for (const name of listJsonFiles(directory)) {
    const raw = fs.readFileSync(require('node:path').join(directory, name));
    source.files.push({ name, bytes: raw.length, sha256: sha256(raw) });
    if (name === 'manifest.json') {
      try { source.manifest = JSON.parse(raw); } catch { errors.push({ file: name, reason: 'invalid_json_manifest' }); }
      continue;
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { errors.push({ file: name, reason: 'invalid_json' }); continue; }
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : null;
    if (!list) { errors.push({ file: name, reason: 'event_array_missing' }); continue; }
    rows.push(...list);
  }
  const anchors = [];
  const flags = [];
  const countries = [];
  const impacts = [];
  const families = [];
  let invalidReleaseTime = 0;
  let nullActual = 0;
  let nullConsensus = 0;
  let nullPrevious = 0;
  let revisedPresent = 0;
  let missingLastUpdated = 0;
  let invalidLastUpdated = 0;
  let allDay = 0;
  let tentative = 0;
  let preliminary = 0;
  let speech = 0;
  let unusableForEventStudy = 0;
  for (const row of rows) {
    const releaseTime = parseTimestamp(row?.dateUtc);
    if (releaseTime === null) { invalidReleaseTime++; unusableForEventStudy++; continue; }
    const actual = numericValue(row?.actual);
    if (actual.state !== 'present') nullActual++;
    if (numericValue(row?.consensus).state !== 'present') nullConsensus++;
    if (numericValue(row?.previous).state !== 'present') nullPrevious++;
    if (numericValue(row?.revised).state === 'present') revisedPresent++;
    if (row?.lastUpdated === null || row?.lastUpdated === undefined) missingLastUpdated++;
    else if (!Number.isFinite(Number(row.lastUpdated))) invalidLastUpdated++;
    if (row?.isAllDay === true) allDay++;
    if (row?.isTentative === true) tentative++;
    if (row?.isPreliminary === true) preliminary++;
    if (row?.isSpeech === true) speech++;
    if (actual.state !== 'present' || numericValue(row?.consensus).state !== 'present') unusableForEventStudy++;
    const country = typeof row?.countryCode === 'string' ? row.countryCode : 'unknown';
    const impact = typeof row?.volatility === 'string' ? row.volatility : 'unknown';
    const family = typeof row?.eventId === 'string' ? row.eventId : `name:${row?.name ?? 'unknown'}`;
    countries.push(country);
    impacts.push(impact);
    families.push(family);
    const key = `${family}|${row?.dateUtc}|${row?.name ?? ''}`;
    const overlapKey = `${row?.dateUtc}|${row?.name ?? ''}`;
    const flagsForRow = [];
    if (country !== 'US') flagsForRow.push('non_us_event');
    if (row?.isAllDay === true) flagsForRow.push('all_day_event');
    if (row?.isTentative === true) flagsForRow.push('tentative_event');
    if (row?.isPreliminary === true) flagsForRow.push('preliminary_event');
    if (row?.isSpeech === true) flagsForRow.push('speech_event');
    if (actual.state !== 'present') flagsForRow.push('missing_actual');
    if (numericValue(row?.consensus).state !== 'present') flagsForRow.push('missing_consensus');
    if (numericValue(row?.revised).state === 'present') flagsForRow.push('revision_present_in_archive');
    for (const flag of flagsForRow) flags.push(flag);
    anchors.push({ key, overlapKey, family, release_time: releaseTime, impact, country, flags: flagsForRow });
  }
  const primaryKeys = new Set();
  let duplicateRows = 0;
  const overlapKeys = new Map();
  for (const anchor of anchors) {
    if (primaryKeys.has(anchor.key)) duplicateRows++;
    primaryKeys.add(anchor.key);
    overlapKeys.set(anchor.overlapKey, (overlapKeys.get(anchor.overlapKey) || 0) + 1);
  }
  const overlappingGroups = [...overlapKeys.values()].filter(count => count > 1).length;
  return {
    source,
    meta: {
      raw_rows: rows.length,
      usable_release_rows: anchors.length,
      invalid_release_time_rows: invalidReleaseTime,
      unusable_for_event_study: unusableForEventStudy,
      missing_actual: nullActual,
      missing_consensus: nullConsensus,
      missing_previous: nullPrevious,
      revision_present_in_archive: revisedPresent,
      missing_last_updated: missingLastUpdated,
      invalid_last_updated: invalidLastUpdated,
      all_day_rows: allDay,
      tentative_rows: tentative,
      preliminary_rows: preliminary,
      speech_rows: speech,
      unique_release_rows: primaryKeys.size,
      duplicate_rows_under_primary_key: duplicateRows,
      overlapping_groups_under_overlap_key: overlappingGroups,
      overlap_flag_counts: tally(flags),
      country_counts: tally(countries),
      impact_counts: tally(impacts),
      event_family_count: new Set(families).size,
      release_time_basis: 'dateUtc parsed as an absolute timestamp; lastUpdated is archive-update evidence only and is never used as a release or consensus vintage.',
      dedup_policy: EVENT_DEDUP_POLICY
    },
    anchors,
    errors
  };
}

// Verified mirror of the series names emitted by backtester/lib/gold_macro_vintage_dataset.js.
// The test suite compares this against that module so the two cannot drift apart silently.
const IMPLEMENTED_MACRO_SERIES = Object.freeze({
  DFII10: 'us_10y_real_yield', DGS2: 'us_2y_yield', DGS10: 'us_10y_yield',
  DTWEXBGS: 'broad_usd_index', VIXCLS: 'vix_level'
});
const IMPLEMENTED_TRANSFORM_LAGS = Object.freeze([1, 5, 20]);
const YIELD_SERIES_IDS = Object.freeze(['DFII10', 'DGS2', 'DGS10']);

function implementedFeatureName(seriesId, lag) {
  const name = IMPLEMENTED_MACRO_SERIES[seriesId];
  if (!name) return null;
  if (lag === 0) return name;
  return `${name}_change_${lag}_${YIELD_SERIES_IDS.includes(seriesId) ? 'bps' : 'pct'}`;
}

// Strictly-before selection: an observation whose declared availability equals the cutoff is excluded.
// Only observations with a usable value count, because a missing value cannot support a context
// computation. The scan is exhaustive rather than early-breaking because a later observation date can
// carry an earlier vintage in some archives, so availability is not monotonic in date order.
function priorObservationCount(index, cutoff) {
  if (!index) return 0;
  let count = 0;
  for (let position = 0; position < index.dates.length; position++) {
    if (index.values[position] === null) continue;
    if (index.dates[position] < cutoff && index.available_at[position] < cutoff) count++;
  }
  return count;
}

function priorObservationCountInclusive(index, cutoff) {
  if (!index) return 0;
  let count = 0;
  for (let position = 0; position < index.dates.length; position++) {
    if (index.values[position] === null) continue;
    if (index.dates[position] <= cutoff && index.available_at[position] <= cutoff) count++;
  }
  return count;
}

// Number of observation dates strictly before the cutoff for which a lag-long lookback also exists.
function changeObservationCount(index, lag, cutoff) {
  return Math.max(0, priorObservationCount(index, cutoff) - lag);
}

function weekdayAnchors(hourlyMeta, hourUtc) {
  if (!hourlyMeta.first_open_time || !hourlyMeta.last_open_time) return [];
  const end = parseTimestamp(hourlyMeta.last_open_time);
  const anchors = [];
  const firstDay = new Date(hourlyMeta.first_open_time);
  for (let time = Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate(), hourUtc, 0, 0);
    time <= end; time += DAY_MS) {
    const day = new Date(time).getUTCDay();
    if (day === 0 || day === 6) continue;
    anchors.push(time);
  }
  return anchors;
}

function auditHorizon(horizon, anchors, hourlyIndex, hourlyMeta) {
  const start = hourlyMeta.first_open_time ? parseTimestamp(hourlyMeta.first_open_time) : null;
  const end = hourlyMeta.last_open_time ? parseTimestamp(hourlyMeta.last_open_time) : null;
  const base = {
    horizon_id: horizon.id,
    registry_audit_status: horizon.audit_status,
    required_resolution: horizon.required_resolution,
    local_source_resolution: horizon.local_source_resolution,
    session_policy: horizon.session_policy,
    source_present: Boolean(hourlyMeta.first_open_time)
  };
  if (!base.source_present) {
    return { ...base, checks: [checkResult('hourly_source_available', 'unknown', { reason: 'source_not_supplied' })] };
  }
  if (horizon.end_offset.kind === 'sub_hourly_offset') {
    return {
      ...base,
      checks: [checkResult('resolution_supports_horizon', 'not_applicable', {
        source_present: true, reason: 'sub_hourly_window_not_measurable_from_h1_bars', invented_offsets: 0 })]
    };
  }
  if (horizon.end_offset.kind === 'trading_day_offset') {
    return {
      ...base,
      checks: [checkResult('session_calendar_declared', 'unknown', {
        source_present: true, reason: 'session_calendar_policy_pending',
        note: 'Five trading days is not 120 elapsed hours; no endpoint is fabricated.' })]
    };
  }
  const elapsed = ELAPSED_HORIZON_MS[horizon.id];
  if (!Number.isFinite(elapsed)) {
    return { ...base, checks: [checkResult('horizon_supported', 'unknown', { source_present: true, reason: 'elapsed_offset_undeclared' })] };
  }
  const counts = {
    anchors_total: anchors.length, outside_coverage_window: 0, entry_candle_exact: 0, endpoint_candle_exact: 0,
    both_exact: 0, both_exact_and_contiguous: 0, both_exact_with_gaps: 0, entry_missing: 0, endpoint_missing: 0,
    matching_rule: 'exact_candle_open_time_equality'
  };
  for (const anchor of anchors) {
    if (start === null || end === null || anchor < start || anchor + elapsed > end) { counts.outside_coverage_window++; continue; }
    const entry = candleAt(hourlyIndex, anchor);
    const endpoint = candleAt(hourlyIndex, anchor + elapsed);
    if (entry) counts.entry_candle_exact++; else counts.entry_missing++;
    if (endpoint) counts.endpoint_candle_exact++; else counts.endpoint_missing++;
    if (!entry || !endpoint) continue;
    counts.both_exact++;
    if (continuityBetween(hourlyIndex, anchor, anchor + elapsed).contiguous) counts.both_exact_and_contiguous++;
    else counts.both_exact_with_gaps++;
  }
  const inWindow = counts.anchors_total - counts.outside_coverage_window;
  const checks = [checkResult('anchor_to_candle_alignment', 'unknown', {
    source_present: true, reason: 'anchor_to_candle_alignment_policy_pending',
    note: 'Only an exact open-time match is counted. No partial bar is substituted for a release that falls between hourly boundaries.',
    counts
  })];
  checks.push(checkResult('endpoint_available_for_every_in_window_anchor', inWindow > 0 && counts.both_exact === inWindow ? 'passed' : 'failed', {
    source_present: true, reason: counts.both_exact === inWindow ? null : 'endpoint_not_available_for_some_anchors',
    in_window_anchors: inWindow, both_exact: counts.both_exact
  }));
  checks.push(checkResult('continuity_between_entry_and_endpoint', inWindow > 0 && counts.both_exact_and_contiguous === inWindow ? 'passed' : 'failed', {
    source_present: true, reason: counts.both_exact_and_contiguous === inWindow ? null : 'gapped_or_missing_bars_between_endpoints',
    in_window_anchors: inWindow, contiguous: counts.both_exact_and_contiguous, with_gaps: counts.both_exact_with_gaps
  }));
  return { ...base, checks };
}

function auditPriorContext(field, anchors, seriesIndex, eventAnchors, variableIds) {
  const base = {
    field_id: field.id, class: field.class, cutoff_rule: field.cutoff_rule,
    required_inputs: field.required_inputs, registry_audit_status: field.audit_status
  };
  if (!anchors.length) {
    return { ...base, checks: [checkResult('prior_context_measurable', 'unknown', {
      source_present: true, reason: 'no_anchor_cohort_available',
      note: 'No observation anchor exists for this cohort in the supplied sources, so context coverage is unevaluable rather than failed.' })] };
  }
  if (field.availability.startsWith('unknown_pending')) {
    return { ...base, checks: [checkResult('prior_context_measurable', 'unknown', {
      source_present: true, reason: 'session_calendar_or_estimator_policy_pending', caveat: field.availability })] };
  }
  const implementedName = field.required_inputs.find(name => Object.values(IMPLEMENTED_MACRO_SERIES).includes(name));
  const declaredId = field.required_inputs.find(name => variableIds.includes(name));
  const resolvedSeriesId = implementedName
    ? Object.keys(IMPLEMENTED_MACRO_SERIES).find(key => IMPLEMENTED_MACRO_SERIES[key] === implementedName)
    : null;
  if (resolvedSeriesId) {
    const index = seriesIndex[resolvedSeriesId];
    if (!index) {
      return { ...base, checks: [checkResult('prior_context_measurable', 'unknown', { source_present: false, reason: 'source_not_supplied' })] };
    }
    const required = 6;
    let covered = 0;
    let insufficient = 0;
    let strictBoundaryExcluded = 0;
    for (const anchor of anchors) {
      if (priorObservationCount(index, anchor) >= required) covered++;
      else {
        insufficient++;
        if (priorObservationCountInclusive(index, anchor) >= required) strictBoundaryExcluded++;
      }
    }
    return { ...base, resolved_series: resolvedSeriesId, checks: [
      checkResult('prior_context_measurable', covered > 0 ? 'passed' : 'failed', {
        source_present: true, reason: covered > 0 ? null : 'no_anchor_has_enough_prior_observations',
        lookback_basis: 'observation_index_based_not_calendar_trading_days', required_prior_observations: required,
        anchors: anchors.length, covered_anchors: covered, insufficient_history_anchors: insufficient,
        anchors_that_would_change_under_an_inclusive_cutoff: strictBoundaryExcluded
      }),
      checkResult('authenticated_observation_timing', 'unknown', {
        source_present: true, reason: 'authenticated_release_times_unavailable',
        timing_basis: 'vintage_date_plus_36h_conservative_proxy'
      })
    ] };
  }
  if (field.class === 'macro_event') {
    if (!eventAnchors.length) {
      return { ...base, checks: [checkResult('prior_context_measurable', 'unknown', { source_present: false, reason: 'source_not_supplied' })] };
    }
    const releaseTimes = eventAnchors.map(anchor => anchor.release_time).sort((a, b) => a - b);
    let covered = 0;
    let noneBefore = 0;
    for (const anchor of anchors) {
      if (releaseTimes.some(time => time < anchor)) covered++; else noneBefore++;
    }
    return { ...base, checks: [
      checkResult('prior_context_measurable', covered > 0 ? 'passed' : 'failed', {
        source_present: true, reason: covered > 0 ? null : 'no_prior_release_available',
        anchors: anchors.length, covered_anchors: covered, anchors_before_first_release: noneBefore,
        strictness: 'A release exactly at the cutoff is excluded.'
      }),
      checkResult('authenticated_consensus_vintage', 'unknown', {
        source_present: true, reason: 'archived_consensus_has_no_pre_release_vintage'
      })
    ] };
  }
  return { ...base, checks: [checkResult('prior_context_measurable', 'unknown', {
    source_present: true, reason: 'no_verified_local_source_for_this_context_field',
    declared_inputs: declaredId ? [declaredId] : field.required_inputs })] };
}

// Field-level evidence for the event-anchored variables. Keys are meta fields produced by readEventDirectory.
const EVENT_FIELD_EVIDENCE = Object.freeze({
  event_type: { meta_key: 'invalid_release_time_rows', label: 'release_timestamp_quality', failing_reason: 'release_timestamp_invalid_or_missing' },
  event_actual: { meta_key: 'missing_actual', label: 'actual_value_present', failing_reason: 'actual_value_missing_on_some_rows' },
  event_consensus: { meta_key: 'missing_consensus', label: 'consensus_value_present', failing_reason: 'consensus_value_missing_on_some_rows' },
  event_previous_as_released: { meta_key: 'missing_previous', label: 'archive_previous_value_present', failing_reason: 'previous_value_missing_on_some_rows' },
  event_surprise: { meta_key: 'unusable_for_event_study', label: 'actual_and_consensus_present', failing_reason: 'actual_consensus_or_release_time_missing_on_some_rows' },
  event_age_hours: { meta_key: 'invalid_release_time_rows', label: 'release_timestamp_quality', failing_reason: 'release_timestamp_invalid_or_missing' }
});

function auditEventVariable(variable, events) {
  const checks = [];
  if (!events.source.present) {
    checks.push(checkResult('local_source_present', 'unknown', { reason: 'source_not_supplied' }));
    return { source_backing: 'event_calendar', source_present: false, values: null, checks };
  }
  const meta = events.meta;
  const evidence = EVENT_FIELD_EVIDENCE[variable.id];
  checks.push(checkResult('local_source_present', 'passed', {
    source_present: true, usable_release_rows: meta.usable_release_rows, event_family_count: meta.event_family_count }));
  if (evidence) {
    const failing = meta[evidence.meta_key] || 0;
    checks.push(checkResult(evidence.label, failing === 0 ? 'passed' : 'failed', {
      source_present: true, reason: failing === 0 ? null : evidence.failing_reason,
      failing_rows: failing, usable_release_rows: meta.usable_release_rows }));
  }
  if (variable.id === 'event_surprise') {
    checks.push(checkResult('archive_surprise_fields_documented', 'unknown', {
      source_present: true, reason: 'ratio_deviation_and_is_better_than_expected_have_no_declared_formula',
      usable_direction_rows: meta.usable_release_rows - (meta.unusable_for_event_study || 0) }));
  }
  if (variable.id === 'event_previous_as_released') {
    checks.push(checkResult('as_released_previous_history', 'unknown', {
      source_present: true, reason: 'archive_exposes_only_a_current_previous_value',
      rows_with_archive_revision: meta.revision_present_in_archive || 0 }));
  }
  if (variable.id === 'event_consensus') {
    checks.push(checkResult('pre_release_consensus_vintage', 'unknown', {
      source_present: true, reason: 'archived_consensus_has_no_pre_release_vintage' }));
  }
  if (variable.id === 'event_type') {
    checks.push(checkResult('duplicate_release_rows', (meta.duplicate_rows_under_primary_key || 0) === 0 ? 'passed' : 'failed', {
      source_present: true, reason: (meta.duplicate_rows_under_primary_key || 0) === 0 ? null : 'duplicate_release_under_declared_primary_key',
      duplicate_rows: meta.duplicate_rows_under_primary_key || 0, unique_release_rows: meta.unique_release_rows,
      overlapping_groups_under_overlap_key: meta.overlapping_groups_under_overlap_key || 0 }));
  }
  return { source_backing: 'event_calendar', source_present: true, values: meta, checks };
}

function auditDerivedVariable(variable, registry, context) {
  const checks = [];
  const unmapped = registry.derived_name_aliases.declared_without_implementation.includes(variable.id);
  const alias = resolveDeclaredAlias(registry, variable.id);
  if (unmapped || alias === variable.id) {
    checks.push(checkResult('transformation_implemented', 'unknown', {
      source_present: true, reason: 'declared_transformation_has_no_local_implementation',
      declared_id: variable.id, required_gap: (variable.known_gaps || [])[0] ?? null }));
    return { source_backing: 'unmapped_transformation', source_present: false, values: null, checks };
  }
  const match = /^(.+)_change_(\d+)_(bps|pct)$/.exec(alias);
  const seriesId = match
    ? Object.keys(IMPLEMENTED_MACRO_SERIES).find(key => IMPLEMENTED_MACRO_SERIES[key] === match[1])
    : Object.keys(IMPLEMENTED_MACRO_SERIES).find(key => IMPLEMENTED_MACRO_SERIES[key] === alias);
  const index = seriesId ? context.fred.series_index[seriesId] : null;
  if (!index) {
    checks.push(checkResult('transformation_implemented', 'unknown', {
      source_present: false, reason: 'derived_source_not_supplied', implemented_name: alias, declared_id: variable.id }));
    return { source_backing: 'derived_macro', source_present: false, values: null, checks };
  }
  const lag = match ? Number(match[2]) : 1;
  if (!context.dailyAnchors.length) {
    checks.push(checkResult('transformation_implemented', 'passed', {
      source_present: true, declared_id: variable.id, implemented_name: alias,
      implementing_module: variable.source_mapping.implemented_in, resolved_series: seriesId, lookback_lag: lag }));
    checks.push(checkResult('derived_values_available', 'unknown', {
      source_present: true, reason: 'no_anchor_grid_available_without_the_hourly_source',
      anchors: 0, anchors_with_usable_change: null,
      lookback_basis: 'observation_index_based_not_calendar_trading_days' }));
    return {
      source_backing: 'derived_macro', source_present: true,
      values: { implemented_name: alias, resolved_series: seriesId, lookback_lag: lag, anchors_with_usable_change: null },
      checks
    };
  }
  let usableAnchors = 0;
  for (const anchor of context.dailyAnchors) {
    if (changeObservationCount(index, lag, anchor) > 0) usableAnchors++;
  }
  checks.push(checkResult('transformation_implemented', 'passed', {
    source_present: true, declared_id: variable.id, implemented_name: alias,
    implementing_module: variable.source_mapping.implemented_in, resolved_series: seriesId, lookback_lag: lag }));
  checks.push(checkResult('derived_values_available', usableAnchors > 0 ? 'passed' : 'failed', {
    source_present: true, reason: usableAnchors > 0 ? null : 'insufficient_source_history_for_lookback',
    anchors: context.dailyAnchors.length, anchors_with_usable_change: usableAnchors,
    lookback_basis: 'observation_index_based_not_calendar_trading_days' }));
  return {
    source_backing: 'derived_macro', source_present: true,
    values: { implemented_name: alias, resolved_series: seriesId, lookback_lag: lag, anchors_with_usable_change: usableAnchors },
    checks
  };
}

function auditVariable(variable, registry, context) {
  const mapped = variable.source_mapping;
  let result;
  if (variable.id.startsWith('event_')) {
    result = auditEventVariable(variable, context.events);
  } else if (mapped.kind === 'fred_vintage_archive') {
    result = auditFredVariable(mapped, context.fred);
  } else if (mapped.kind === 'oanda_hourly_candle_archive') {
    result = auditHourlyVariable(context.hourly);
  } else if (mapped.kind === 'derived') {
    result = auditDerivedVariable(variable, registry, context);
  } else {
    result = {
      source_backing: 'none', source_present: false, values: null,
      checks: [checkResult('local_source_present', 'unknown', {
        reason: 'source_not_available_locally', declared_status: mapped.status })]
    };
  }
  const transformations = Array.isArray(variable.transformations) ? variable.transformations : [];
  const checks = [...result.checks];
  if (transformations.length && !variable.id.startsWith('event_')) {
    const resolved = transformations.map(id => ({ declared_id: id, implemented_name: resolveDeclaredAlias(registry, id) }))
      .filter(entry => entry.implemented_name !== entry.declared_id);
    checks.push(checkResult('declared_transformations_resolvable',
      resolved.length === transformations.length ? 'passed' : 'unknown', {
        source_present: result.source_present,
        reason: resolved.length === transformations.length ? null : 'some_declared_transformations_have_no_local_implementation',
        declared_transform_count: transformations.length, resolvable_count: resolved.length, resolved }));
  }
  checks.push(checkResult('authenticated_publication_timing',
    variable.timestamp_semantics.verified && result.source_present ? 'passed' : 'unknown', {
      source_present: result.source_present,
      reason: variable.timestamp_semantics.verified && result.source_present
        ? null : (variable.timestamp_semantics.verified ? 'source_not_available_locally' : 'authenticated_timing_unavailable'),
      timing_basis: variable.timestamp_semantics.timing_basis,
      registry_verified: variable.timestamp_semantics.verified }));
  return {
    id: variable.id, label: variable.label, factor: variable.factor ?? null,
    declared_inventory_index: variable.declared_inventory_index,
    registry_coverage_status: mapped.status, registry_research_status: variable.research_status,
    value_kind: variable.value_kind, event_type: variable.event_type, horizons: variable.horizons,
    source_backing: result.source_backing, source_present: result.source_present,
    values: result.values, checks, known_gaps: variable.known_gaps
  };
}

function auditFredVariable(mapped, fred) {
  const meta = fred.series_meta[mapped.series_id];
  if (!fred.source.present || !meta) {
    return {
      source_backing: 'fred_series', source_present: false, values: null,
      checks: [checkResult('local_source_present', 'unknown', {
        reason: fred.source.present ? 'series_not_found_in_supplied_source' : 'source_not_supplied',
        series_id: mapped.series_id })]
    };
  }
  const cleanTimestamps = meta.invalid_rows === 0 && meta.invalid_observation_dates === 0;
  return {
    source_backing: 'fred_series', source_present: true, values: meta,
    checks: [
      checkResult('local_source_present', 'passed', { source_present: true, series_id: meta.series_id, file: meta.file }),
      checkResult('value_observations', meta.usable_rows > 0 ? 'passed' : 'failed', {
        source_present: true, reason: meta.usable_rows > 0 ? null : 'no_usable_observations',
        usable_rows: meta.usable_rows, observation_dates: meta.observation_dates,
        first_observation_date: meta.first_observation_date, last_observation_date: meta.last_observation_date }),
      checkResult('missing_values_reported_separately', 'passed', {
        source_present: true, missing_values: meta.missing_values, invalid_rows: meta.invalid_rows,
        policy: 'Missing values are excluded, never coerced to zero.' }),
      checkResult('timestamp_quality', cleanTimestamps ? 'passed' : 'failed', {
        source_present: true, reason: cleanTimestamps ? null : 'invalid_observation_rows',
        invalid_rows: meta.invalid_rows, invalid_observation_dates: meta.invalid_observation_dates,
        invalid_vintage_dates: meta.invalid_vintage_dates }),
      checkResult('revision_rows_retained_separately', 'passed', {
        source_present: true, revision_rows: meta.revision_rows,
        policy: 'Later vintages are retained per observation date; only the latest vintage available before a cutoff enters an as-of lookup.' })
    ]
  };
}

function auditHourlyVariable(hourly) {
  const meta = hourly.meta;
  if (!hourly.source.present || !meta.usable_candle_rows) {
    return {
      source_backing: 'hourly_candles', source_present: false, values: null,
      checks: [checkResult('local_source_present', 'unknown', {
        reason: hourly.source.present ? 'no_usable_candles_in_supplied_source' : 'source_not_supplied' })]
    };
  }
  const gapFree = meta.intra_span_gaps_over_one_hour === 0;
  return {
    source_backing: 'hourly_candles', source_present: true, values: meta,
    checks: [
      checkResult('local_source_present', 'passed', {
        source_present: true, instrument: meta.instrument, granularity: meta.granularity,
        usable_candle_rows: meta.usable_candle_rows }),
      checkResult('value_observations', 'passed', {
        source_present: true, first_open_time: meta.first_open_time, last_open_time: meta.last_open_time,
        non_numeric_mid_close: meta.non_numeric_mid_close }),
      checkResult('timestamp_quality', meta.invalid_time_rows === 0 ? 'passed' : 'failed', {
        source_present: true, reason: meta.invalid_time_rows === 0 ? null : 'invalid_candle_times',
        invalid_time_rows: meta.invalid_time_rows, duplicate_open_times: meta.duplicate_open_times,
        incomplete_flag_rows: meta.incomplete_flag_rows }),
      checkResult('continuity', gapFree ? 'passed' : 'failed', {
        source_present: true, reason: gapFree ? null : 'gaps_present_and_unclassified',
        intra_span_gaps_over_one_hour: meta.intra_span_gaps_over_one_hour,
        gaps_crossing_weekend_boundary: meta.gaps_crossing_weekend_boundary,
        largest_gap_hours: meta.largest_gap_hours, continuity_policy: meta.continuity_policy }),
      checkResult('session_calendar_declared', 'unknown', {
        source_present: true, reason: 'session_calendar_policy_pending',
        note: 'Gaps cannot be classified as session closures until a calendar is declared.' })
    ]
  };
}

function flattenChecks(rows) {
  const checks = [];
  for (const row of rows) for (const check of row.checks) checks.push({ owner: row.id ?? row.field_id, ...check });
  return checks;
}

function contentHash(report) {
  const clone = JSON.parse(JSON.stringify(report));
  delete clone.content_sha256;
  if (clone.run) {
    // Run metadata that legitimately varies between identical runs over identical inputs.
    delete clone.run.generated_at;
    delete clone.run.output_directory;
    delete clone.run.command;
  }
  return sha256(Buffer.from(JSON.stringify(clone)));
}

function buildCoverageAudit(options) {
  const { registry, sha256: registrySha256 } = loadRegistry(options.registryPath);
  validateRegistry(registry);
  const fred = readFredDirectory(options.fredDirectory);
  const hourly = readHourlyDirectory(options.hourlyDirectory);
  const events = readEventDirectory(options.eventsDirectory);
  const dailyAnchors = weekdayAnchors(hourly.meta, 14);
  const eventAnchorTimes = events.anchors.map(anchor => anchor.release_time).sort((a, b) => a - b);
  const contexts = { daily_snapshot_anchors: dailyAnchors, event_releases: eventAnchorTimes };
  const variableIds = registry.variables.map(variable => variable.id);
  const variables = registry.variables.map(variable =>
    auditVariable(variable, registry, { fred, hourly, events, dailyAnchors }));

  const horizons = [];
  for (const horizon of registry.horizons) {
    for (const [cohort, anchors] of Object.entries(contexts)) {
      if (horizon.anchor === 'event_release_timestamp' && cohort !== 'event_releases') continue;
      horizons.push({ anchor_cohort: cohort, ...auditHorizon(horizon, anchors, hourly.index, hourly.meta) });
    }
  }

  const priorContext = [];
  for (const field of registry.prior_context) {
    for (const [cohort, anchors] of Object.entries(contexts)) {
      priorContext.push({ anchor_cohort: cohort, ...auditPriorContext(field, anchors, fred.series_index, events.anchors, variableIds) });
    }
  }

  const allChecks = [...flattenChecks(variables), ...flattenChecks(horizons), ...flattenChecks(priorContext)];
  const failedReasons = allChecks.filter(check => check.status !== 'passed' && check.reason).map(check => check.reason);
  const eventMeta = events.source.present ? events.meta : null;

  const report = {
    version: 'gold-variable-coverage-audit-v1',
    research_only: true,
    executable_trade_validated: false,
    qualified_for_live_calls: false,
    statement: 'Deterministic coverage and availability audit of declared Gold research inputs. It reports availability and provenance gaps only; it computes no relationship, no accuracy and no trading result.',
    run: {
      generated_at: options.now ?? new Date().toISOString(),
      output_directory: options.outputDirectory ?? null,
      command: options.command ?? null,
      registry_path: options.registryPath,
      registry_version: registry.version,
      registry_sha256: registrySha256
    },
    registry_summary: {
      declared_inventory_count: variableIds.length,
      horizon_count: registry.horizons.length,
      prior_context_count: registry.prior_context.length,
      forbidden_context_count: Array.isArray(registry.forbidden_context) ? registry.forbidden_context.length : 0,
      derived_alias_count: Object.keys(registry.derived_name_aliases.map).length
    },
    sources_supplied: { fred: fred.source.present, hourly: hourly.source.present, events: events.source.present },
    inputs: {
      fred: { source: fred.source, series_meta: fred.series_meta, errors: fred.errors },
      hourly: { source: hourly.source, meta: hourly.meta, errors: hourly.errors },
      events: { source: events.source, meta: events.meta, errors: events.errors }
    },
    variables,
    horizons,
    prior_context: priorContext
  };

  report.event_release_audit = eventMeta ? {
    ...eventMeta,
    anchor_count: events.anchors.length,
    first_release_time: eventAnchorTimes.length ? new Date(eventAnchorTimes[0]).toISOString() : null,
    last_release_time: eventAnchorTimes.length ? new Date(eventAnchorTimes[eventAnchorTimes.length - 1]).toISOString() : null
  } : { status: 'unknown', reason: events.source.reason ?? 'source_not_supplied' };
  report.daily_snapshot_audit = hourly.source.present ? {
    schedule: 'Weekdays at 14:00 UTC, declared before outcome inspection and used only as an audit grid.',
    anchor_count: dailyAnchors.length,
    first_anchor: dailyAnchors.length ? new Date(dailyAnchors[0]).toISOString() : null,
    last_anchor: dailyAnchors.length ? new Date(dailyAnchors[dailyAnchors.length - 1]).toISOString() : null,
    distinct_from_event_cohort: true,
    note: 'Daily snapshot anchors and event release anchors are reported separately and are never summed into one denominator.'
  } : { status: 'unknown', reason: hourly.source.reason ?? 'source_not_supplied' };
  report.reconciliation = {
    declared_inventory_total: variableIds.length,
    variables_by_coverage_status: tally(variables.map(variable => variable.registry_coverage_status)),
    variables_by_source_backing: tally(variables.map(variable => variable.source_backing)),
    variables_with_verified_local_source: variables.filter(variable => variable.source_present).length,
    checks_total: allChecks.length,
    checks_by_status: tally(allChecks.map(check => check.status)),
    event_rows_reconcile: eventMeta ? {
      raw_rows: eventMeta.raw_rows,
      usable_release_rows: eventMeta.usable_release_rows,
      invalid_release_time_rows: eventMeta.invalid_release_time_rows,
      raw_minus_usable: eventMeta.raw_rows - eventMeta.usable_release_rows,
      unique_release_rows: eventMeta.unique_release_rows,
      duplicate_rows_under_primary_key: eventMeta.duplicate_rows_under_primary_key,
      unique_plus_duplicates: eventMeta.unique_release_rows + eventMeta.duplicate_rows_under_primary_key,
      policy: eventMeta.dedup_policy
    } : null,
    daily_anchor_reconcile: { anchor_count: dailyAnchors.length, event_anchor_count: eventAnchorTimes.length }
  };
  report.exclusion_reasons = tally(failedReasons);
  report.unresolved_policies = registry.unresolved_policies;
  report.known_gaps = registry.known_gaps;
  report.next_actions = buildNextActions({ variables, eventMeta,
    hourlyMeta: hourly.source.present ? hourly.meta : { intra_span_gaps_over_one_hour: 0 } });
  report.limitations = [
    'Coverage is availability evidence only and cannot establish that a variable is related to Gold price.',
    'No unsupported check is reported as passed; policy-dependent checks stay unknown until the policy is declared.',
    'Storage and archive timestamps are never promoted to authenticated release times.',
    'Repeated releases, overlapping windows and dependent observations are retained and flagged, not removed.',
    'The strict exact-24-hour evaluator is unchanged and was not consulted for additional horizons.',
    'This milestone performs no combination search and no daily-direction qualification.'
  ];
  report.content_sha256 = contentHash(report);
  return report;
}

function buildNextActions({ variables, eventMeta, hourlyMeta }) {
  const actions = [];
  const unmapped = variables.filter(variable => variable.source_backing === 'unmapped_transformation').map(variable => variable.id);
  const unavailable = variables.filter(variable => variable.source_backing === 'none').map(variable => variable.id);
  if (unavailable.length) actions.push(`Resolve, replace or formally retire the ${unavailable.length} declared variables with no verified local source: ${unavailable.join(', ')}.`);
  if (unmapped.length) actions.push(`Implement or formally retire the ${unmapped.length} declared transformations with no local implementation: ${unmapped.join(', ')}.`);
  actions.push('Declare the XAU/USD session calendar (open, close, holidays, early closes) before measuring five-trading-day horizons or trailing five-day price context.');
  actions.push('Declare the anchor-to-candle alignment rule before measuring one-hour and four-hour reactions; do not substitute partial bars.');
  if (eventMeta) actions.push(`Authenticate pre-release consensus vintages for event surprises; the archive currently supplies ${eventMeta.usable_release_rows} release rows with ${eventMeta.missing_consensus} missing consensus values and no vintage history.`);
  if (hourlyMeta.intra_span_gaps_over_one_hour) actions.push(`Classify the ${hourlyMeta.intra_span_gaps_over_one_hour} intra-span hourly gaps before any continuity-dependent claim.`);
  actions.push('Build the individual-variable reaction report on the resolved subset only, retaining every attempted hypothesis and reporting counts against identical cohorts.');
  actions.push('Keep combination search, formula development and untouched-data qualification out of scope until the policies above are reviewed.');
  return actions;
}

function renderMarkdownHeader(report) {
  const lines = [];
  lines.push('# Gold variable, horizon and prior-context coverage audit', '');
  lines.push(`Registry: ${report.run.registry_path} (${report.run.registry_version}, sha256 ${report.run.registry_sha256})`, '');
  lines.push(`Content sha256: ${report.content_sha256}`);
  lines.push(`Command: ${report.run.command ?? 'not recorded'}`, '');
  lines.push(report.statement, '');
  lines.push('Status: coverage and provenance evidence only. No relationship, accuracy or trading result is computed. Live-call qualification is NOT established.', '');
  lines.push('## Sources supplied', '');
  for (const [role, input] of Object.entries(report.inputs)) {
    const present = report.sources_supplied[role];
    lines.push(`- ${role}: ${present ? `${input.source.directory} (${input.source.files.length} files)` : `not supplied (${input.source.reason})`}`);
    if (present && input.source.manifest?.version) lines.push(`  - manifest version: ${input.source.manifest.version}`);
  }
  lines.push('');
  lines.push('## Declared coverage', '');
  lines.push(`- Declared inventory variables: ${report.registry_summary.declared_inventory_count}`);
  lines.push(`- Variables with a present local source in this run: ${report.reconciliation.variables_with_verified_local_source}`);
  lines.push(`- Horizons declared: ${report.registry_summary.horizon_count}; prior-context fields: ${report.registry_summary.prior_context_count}`);
  lines.push(`- Checks run: ${report.reconciliation.checks_total} (${JSON.stringify(report.reconciliation.checks_by_status)})`, '');
  lines.push('| Variable | Factor | Coverage status | Backing | Source present | Non-passing checks |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const variable of report.variables) {
    const nonPassing = variable.checks.filter(check => check.status !== 'passed')
      .map(check => `${check.id}:${check.status}`).join('; ') || 'none';
    lines.push(`| ${variable.id} | ${variable.factor ?? '-'} | ${variable.registry_coverage_status} | ${variable.source_backing} | ${variable.source_present} | ${nonPassing.replace(/\|/g, '/')} |`);
  }
  lines.push('');
  return lines;
}

function renderMarkdownHorizons(report) {
  const lines = [];
  lines.push('## Horizon availability by anchor cohort', '');
  lines.push('Event releases and daily snapshot anchors are separate cohorts and are never summed.', '');
  lines.push('| Horizon | Cohort | Registry status | Check | Status | Reason / key counts |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const horizon of report.horizons) {
    for (const check of horizon.checks) {
      let detail = check.reason ?? '';
      if (check.counts) {
        detail += ` anchors=${check.counts.anchors_total} in_window=${check.counts.anchors_total - check.counts.outside_coverage_window} both_exact=${check.counts.both_exact} contiguous=${check.counts.both_exact_and_contiguous}`;
      } else if (check.in_window_anchors !== undefined) {
        detail += ` in_window=${check.in_window_anchors}`;
      }
      lines.push(`| ${horizon.horizon_id} | ${horizon.anchor_cohort} | ${horizon.registry_audit_status} | ${check.id} | ${check.status} | ${String(detail).replace(/\|/g, '/')} |`);
    }
  }
  lines.push('');
  lines.push('## Prior-context coverage', '');
  lines.push('| Field | Cohort | Check | Status | Reason / counts |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const field of report.prior_context) {
    for (const check of field.checks) {
      let detail = check.reason ?? '';
      if (check.covered_anchors !== undefined) detail += ` covered=${check.covered_anchors}/${check.anchors}`;
      if (check.anchors_that_would_change_under_an_inclusive_cutoff !== undefined) {
        detail += ` inclusive_cutoff_would_change=${check.anchors_that_would_change_under_an_inclusive_cutoff}`;
      }
      lines.push(`| ${field.field_id} | ${field.anchor_cohort} | ${check.id} | ${check.status} | ${String(detail).replace(/\|/g, '/')} |`);
    }
  }
  lines.push('');
  return lines;
}

function renderMarkdownEvidence(report) {
  const lines = [];
  lines.push('## Event release audit', '');
  const events = report.event_release_audit;
  if (events.status === 'unknown') {
    lines.push(`- Not evaluated: ${events.reason}`);
  } else {
    lines.push(`- Release rows: ${events.raw_rows}; usable: ${events.usable_release_rows}; invalid release time: ${events.invalid_release_time_rows}`);
    lines.push(`- Unique releases under the declared key: ${events.unique_release_rows}; duplicate rows: ${events.duplicate_rows_under_primary_key}; overlapping groups under the broader key: ${events.overlapping_groups_under_overlap_key}`);
    lines.push(`- Missing actual: ${events.missing_actual}; missing consensus: ${events.missing_consensus}; missing previous: ${events.missing_previous}; archive revision present: ${events.revision_present_in_archive}`);
    lines.push(`- Unusable for an event study without both actual and consensus: ${events.unusable_for_event_study}`);
    lines.push(`- Country counts: ${JSON.stringify(events.country_counts)}; impact counts: ${JSON.stringify(events.impact_counts)}`);
    lines.push(`- Release window: ${events.first_release_time} to ${events.last_release_time}`);
    lines.push(`- Deduplication policy: ${events.dedup_policy.primary_key} (${events.dedup_policy.primary_key_meaning})`);
    lines.push(`- Overlap policy: ${events.dedup_policy.overlap_key} rows are flagged, not dropped.`);
    lines.push(`- ${events.release_time_basis}`);
  }
  lines.push('');
  lines.push('## Daily snapshot anchors', '');
  const daily = report.daily_snapshot_audit;
  if (daily.status === 'unknown') lines.push(`- Not evaluated: ${daily.reason}`);
  else lines.push(`- ${daily.anchor_count} anchors, ${daily.first_anchor} to ${daily.last_anchor}. ${daily.schedule}`);
  lines.push('');
  lines.push('## Continuity', '');
  const hourlyMeta = report.inputs.hourly.meta ?? {};
  if (report.sources_supplied.hourly) {
    lines.push(`- Hourly bars: ${hourlyMeta.usable_candle_rows} usable of ${hourlyMeta.raw_candle_rows}; incomplete flags: ${hourlyMeta.incomplete_flag_rows}`);
    lines.push(`- Intra-span gaps over one hour: ${hourlyMeta.intra_span_gaps_over_one_hour}; crossing a weekend boundary: ${hourlyMeta.gaps_crossing_weekend_boundary}; largest gap: ${hourlyMeta.largest_gap_hours} hours`);
    lines.push(`- ${hourlyMeta.continuity_policy}`);
  } else {
    lines.push('- Not evaluated: hourly source not supplied.');
  }
  lines.push('');
  lines.push('## Unknown and failed reasons', '');
  for (const [reason, count] of Object.entries(report.exclusion_reasons)) lines.push(`- ${reason}: ${count}`);
  lines.push('');
  lines.push('## Unresolved policies', '');
  for (const policy of report.unresolved_policies) lines.push(`- ${policy}`);
  lines.push('');
  lines.push('## Known gaps', '');
  for (const gap of report.known_gaps) lines.push(`- ${gap}`);
  lines.push('');
  lines.push('## Proposed next actions', '');
  for (const action of report.next_actions) lines.push(`- ${action}`);
  lines.push('');
  lines.push('## Limitations', '');
  for (const limitation of report.limitations) lines.push(`- ${limitation}`);
  lines.push('');
  return lines;
}

function renderMarkdown(report) {
  return [
    ...renderMarkdownHeader(report),
    ...renderMarkdownHorizons(report),
    ...renderMarkdownEvidence(report)
  ].join('\n') + '\n';
}

module.exports = {
  CHECK_STATUSES,
  ELAPSED_HORIZON_MS,
  EVENT_DEDUP_POLICY,
  EVENT_FIELD_EVIDENCE,
  FRED_VINTAGE_LAG_HOURS,
  IMPLEMENTED_MACRO_SERIES,
  IMPLEMENTED_TRANSFORM_LAGS,
  MISSING_SOURCE_TOKEN,
  REQUIRED_HORIZON_IDS,
  YIELD_SERIES_IDS,
  auditDerivedVariable,
  auditHorizon,
  auditPriorContext,
  auditVariable,
  buildCoverageAudit,
  buildNextActions,
  changeObservationCount,
  checkResult,
  contentHash,
  continuityBetween,
  flattenChecks,
  implementedFeatureName,
  loadRegistry,
  normalizeCandleTimestamp,
  priorObservationCount,
  priorObservationCountInclusive,
  readEventDirectory,
  readFredDirectory,
  readHourlyDirectory,
  renderMarkdown,
  renderMarkdownEvidence,
  renderMarkdownHeader,
  renderMarkdownHorizons,
  resolveDeclaredAlias,
  tally,
  validateRegistry,
  weekdayAnchors
};

