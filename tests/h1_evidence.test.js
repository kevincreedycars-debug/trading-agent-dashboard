"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { CONTRACTS, buildH1Coverage } = require("../lib/layer1_backtesting/h1_coverage");
const {
  MODES,
  validateBundle,
  evaluateEvidence,
  bundleFromCsv,
} = require("../lib/layer1_backtesting/h1_evidence");

const SESSION = {
  date: "2024-01-02",
  cutoff_at_utc: "2024-01-02T05:00:00Z",
  endpoint_at_utc: "2024-01-03T05:00:00Z",
};

function vixRecord(overrides = {}) {
  return {
    session_date: SESSION.date,
    value: 18.4,
    observed_at_utc: "2024-01-01T21:15:00Z",
    published_at_utc: "2024-01-01T21:20:00Z",
    received_at_utc: null,
    vintage: "2024-01-01",
    original: true,
    operands: [{ value: 18.4, observed_at_utc: "2024-01-01T21:15:00Z", vintage: "2024-01-01" }],
    ...overrides,
  };
}

function bundle(record) {
  return {
    schema_version: "h1-evidence-v1",
    input: "vix",
    source: CONTRACTS.vix.source,
    instrument: CONTRACTS.vix.instrument,
    transform: CONTRACTS.vix.transform,
    records: [record],
  };
}

test("historical reconstruction accepts a nullable receipt; sealed replay does not", () => {
  const checked = validateBundle(bundle(vixRecord()), "vix", CONTRACTS.vix);
  assert.equal(checked.valid, true, checked.errors.join("; "));
  const record = checked.records.get(SESSION.date);
  const historical = evaluateEvidence({ key: "vix", record, session: SESSION, contract: CONTRACTS.vix, mode: MODES.HISTORICAL });
  assert.equal(historical.eligible, true);
  assert.equal(historical.receipt, false);
  assert.equal(historical.reason, null);
  const sealed = evaluateEvidence({ key: "vix", record, session: SESSION, contract: CONTRACTS.vix, mode: MODES.SEALED });
  assert.equal(sealed.eligible, false);
  assert.equal(sealed.reason, "unverified_receipt");
});

test("a genuine receipt at or before the cutoff satisfies sealed replay", () => {
  const checked = validateBundle(bundle(vixRecord({ received_at_utc: "2024-01-02T04:00:00Z" })), "vix", CONTRACTS.vix);
  assert.equal(checked.valid, true, checked.errors.join("; "));
  const record = checked.records.get(SESSION.date);
  const sealed = evaluateEvidence({ key: "vix", record, session: SESSION, contract: CONTRACTS.vix, mode: MODES.SEALED });
  assert.equal(sealed.eligible, true);
  assert.equal(sealed.receipt, true);
});

test("a late receipt is refused and never described as historical evidence", () => {
  const checked = validateBundle(bundle(vixRecord({ received_at_utc: "2024-01-02T05:01:00Z" })), "vix", CONTRACTS.vix);
  assert.equal(checked.valid, true, checked.errors.join("; "));
  const record = checked.records.get(SESSION.date);
  const sealed = evaluateEvidence({ key: "vix", record, session: SESSION, contract: CONTRACTS.vix, mode: MODES.SEALED });
  assert.equal(sealed.eligible, false);
  assert.equal(sealed.receipt, false);
  assert.equal(sealed.reason, "unverified_receipt");
});

test("a publication after the cutoff is unclocked even when a receipt exists", () => {
  const checked = validateBundle(
    bundle(
      vixRecord({
        published_at_utc: "2024-01-02T05:30:00Z",
        received_at_utc: "2024-01-02T05:31:00Z",
      })
    ),
    "vix",
    CONTRACTS.vix
  );
  assert.equal(checked.valid, true, checked.errors.join("; "));
  const record = checked.records.get(SESSION.date);
  const historical = evaluateEvidence({ key: "vix", record, session: SESSION, contract: CONTRACTS.vix, mode: MODES.HISTORICAL });
  assert.equal(historical.eligible, false);
  assert.equal(historical.reason, "unclocked");
});

test("a derived-only record with fewer than six operands is refused", () => {
  const checked = validateBundle(
    {
      input: "front",
      source: CONTRACTS.front.source,
      instrument: CONTRACTS.front.instrument,
      transform: CONTRACTS.front.transform,
      records: [
        {
          session_date: SESSION.date,
          value: -4,
          observed_at_utc: "2024-01-01T16:15:00Z",
          published_at_utc: "2024-01-01T16:15:00Z",
          received_at_utc: null,
          vintage: "2024-01-01",
          original: true,
          operands: [{ value: 4.2, observed_at_utc: "2024-01-01T16:15:00Z", vintage: "2024-01-01" }],
        },
      ],
    },
    "front",
    CONTRACTS.front
  );
  assert.equal(checked.valid, false);
  assert.match(checked.errors.join(" "), /operands, 6 required/);
});

test("the CSV importer keeps the operands and leaves the receipt nullable", () => {
  const operands = Array.from({ length: 6 }, (_, index) => ({
    value: 4.2 + index,
    observed_at_utc: `2023-12-${20 + index}T16:15:00Z`,
    vintage: `2023-12-${20 + index}`,
  }));
  const csv = [
    "session_date,value,observed_at_utc,published_at_utc,received_at_utc,vintage,original,operands",
    `2024-01-02,-4,2024-01-01T16:15:00Z,2024-01-01T16:15:00Z,,2024-01-01,true,"${JSON.stringify(operands).replace(/"/g, '""')}"`,
  ].join("\n");
  const parsed = bundleFromCsv(csv, { key: "front", contract: CONTRACTS.front });
  const checked = validateBundle(parsed, "front", CONTRACTS.front);
  assert.equal(checked.valid, true, checked.errors.join("; "));
  const record = checked.records.get(SESSION.date);
  assert.equal(record.operands.length, 6);
  assert.equal(record.received_at_utc, null);
});

test("an imported record's value, not the legacy alias, is what the coverage row carries into a decision", () => {
  const packageInputs = require("../backtester/packages/USD-L1-25F-H1-v0.1.0/inputs.json");
  const checked = validateBundle(bundle(vixRecord({ value: 21.7 })), "vix", CONTRACTS.vix);
  assert.equal(checked.valid, true, checked.errors.join("; "));
  const coverage = buildH1Coverage({
    run: {
      sessions: [{ ...SESSION, inputs: { vix_level: 18.4 } }],
      run: { run_version: "test" },
      generated_at: "2024-01-02T05:00:00Z",
    },
    packageInputs,
    calendar: { events: [] },
    packageInfo: { requested: "USD-L1-25F-H1-v0.1.0" },
    rows: { rows: [] },
    evidence: {
      vix: { present: true, valid: true, records: checked.records, errors: [], path: "test" },
    },
  });
  assert.equal(coverage.mornings[0].values.vix, 21.7);
  assert.equal(coverage.inputs.find((input) => input.key === "vix").eligible, 1);
  assert.equal(coverage.ready, 0, "the other eight inputs are still blocked");
});

test("a mismatch between the declared instrument and the package contract is refused", () => {
  const checked = validateBundle(
    {
      ...bundle(vixRecord()),
      instrument: "OANDA XAU/USD",
    },
    "vix",
    CONTRACTS.vix
  );
  assert.equal(checked.valid, false);
  assert.match(checked.errors.join(" "), /instrument/);
});

test("the v0.1.1 amendment replaces the ICE fixing and leaves the supplied package text intact", () => {
  const { amendContracts, assertReplacementsHold, ICE_AMENDMENT } = require("../lib/layer1_backtesting/h1_source_amendments");
  const { SUPPLIED_CONTRACTS, SOURCE_AMENDMENTS } = require("../lib/layer1_backtesting/h1_coverage");

  // v0.1.0 still says what it always said; the audit evaluates the amendment instead.
  assert.equal(SUPPLIED_CONTRACTS.ice.source, "ICE");
  assert.equal(SUPPLIED_CONTRACTS.ice.instrument, "US Dollar Index spot");
  assert.equal(CONTRACTS.ice.source, "FTMO Global Markets Ltd");
  assert.match(CONTRACTS.ice.instrument, /DXY\.cash/);
  assert.equal(CONTRACTS.ice.is_official_cash_dxy, false);
  assert.equal(CONTRACTS.ice.instrument_kind, "broker_cfd");

  // No threshold was relaxed to fit the new source: the observation is stamped at the cutoff, so the
  // supplied zero-hour freshness window still applies unchanged.
  assert.equal(CONTRACTS.ice.hours, 0);
  assert.equal(SUPPLIED_CONTRACTS.ice.hours, 0);
  assert.equal(CONTRACTS.ice.max_lookback_days, 4);

  assert.equal(SOURCE_AMENDMENTS.length, 1);
  assert.equal(SOURCE_AMENDMENTS[0].id, "H1-A01");
  assert.equal(SOURCE_AMENDMENTS[0].preserves, "USD-L1-25F-H1-v0.1.0");
  assert.equal(SOURCE_AMENDMENTS[0].instrument.sha256.length, 64);

  // Every other input is carried over untouched.
  for (const key of ["vix", "front", "spread", "real", "broad", "gold", "qqq", "calendar"]) {
    assert.deepEqual(CONTRACTS[key], { ...SUPPLIED_CONTRACTS[key] });
  }

  // The amendment is a delta against the supplied text: if that text moves, the audit must refuse.
  const drifted = { ...SUPPLIED_CONTRACTS, ice: { ...SUPPLIED_CONTRACTS.ice, source: "another vendor" } };
  assert.throws(() => amendContracts(drifted), /the amendment replaces "ICE"/);
  assert.throws(
    () => assertReplacementsHold({ ...SUPPLIED_CONTRACTS, ice: { ...SUPPLIED_CONTRACTS.ice, hours: 24 } }),
    /the amendment replaces 0/
  );
  assert.equal(ICE_AMENDMENT.differences.length >= 5, true);
});

test("the imported ice evidence is a completion clock on 455 mornings, never a receipt", () => {
  const path = require("node:path");
  const { loadEvidence } = require("../lib/layer1_backtesting/h1_evidence");
  const contracts = require("../lib/layer1_backtesting/h1_coverage").CONTRACTS;
  const root = path.resolve(__dirname, "..");
  const evidence = loadEvidence({ root, keys: ["ice"], contracts }).ice;

  assert.equal(evidence.present, true, evidence.errors.join("; "));
  assert.equal(evidence.valid, true, evidence.errors.join("; "));
  assert.equal(evidence.records.size, 455);

  let blocked = 0;
  for (const [date, record] of evidence.records) {
    const cutoff = record.observed_at_utc;
    assert.equal(record.published_at_utc, cutoff, `${date}: the bar completes at the cutoff`);
    assert.equal(record.received_at_utc, null, `${date}: a retrospective export is not a receipt`);
    assert.equal(record.operands.length, 2, `${date}: previous and current observation`);
    assert.equal(record.sampling.gap_hours <= 96, true, `${date}: ${record.sampling.gap_hours}h exceeds the cap`);
    assert.equal(record.sampling.official_index, false);
    const session = { date, cutoff_at_utc: cutoff, endpoint_at_utc: cutoff };
    const historical = evaluateEvidence({ key: "ice", record, session, contract: contracts.ice, mode: MODES.HISTORICAL });
    assert.equal(historical.eligible, true, `${date}: ${historical.reason}`);
    assert.equal(historical.reason, null);
    const sealed = evaluateEvidence({ key: "ice", record, session, contract: contracts.ice, mode: MODES.SEALED });
    assert.equal(sealed.eligible, false, `${date}: sealed replay needs a receipt`);
    assert.equal(sealed.reason, "unverified_receipt");
    if (!historical.eligible) blocked += 1;
  }
  assert.equal(blocked, 0);
});

