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
