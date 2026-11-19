/**
 * Versioned source amendments for the supplied H1 input contract.
 *
 * `USD-L1-25F-H1-v0.1.0` stays frozen and byte for byte as delivered. An amendment is a separate,
 * dated record that names exactly which declaration it replaces and what it puts in its place, so the
 * supplied package can be read unchanged beside the contract the audit actually evaluates. Nothing here
 * relaxes a threshold, a clock or a lookback: an amendment changes the source of an input.
 *
 * Amendment `H1-A01` (contract v0.1.1, decided 2026-11-18) replaces the licensed ICE US Dollar Index
 * spot 05:00 fixing with the `DXY.cash` hourly tape this project already holds. The instrument is a
 * broker spot CFD on the dollar index basket, not the official ICE index; it is named as such on every
 * record, every input row and every document. No ICE licence is required or requested.
 *
 * Research only. Nothing here reads the network.
 */
"use strict";

const VERSION = "v0.1.1";
const PRESERVES = "USD-L1-25F-H1-v0.1.0";

/**
 * The acquired dataset, pinned. These fields are copied from
 * `backtester/tmp/ftmo_dxy_cash_h1.provenance.json`; the evidence builder refuses to run if the tape no
 * longer hashes to `sha256`.
 */
const ICE_INSTRUMENT = Object.freeze({
  id: "dxy_cash_broker_cfd",
  symbol: "DXY.cash",
  label: "DXY.cash (FTMO spot CFD)",
  provider: "FTMO Global Markets Ltd",
  provider_server: "FTMO-Server",
  description: "Dollar Index, Spot CFD",
  kind: "broker_cfd",
  is_official_cash_dxy: false,
  digits: 3,
  quote_convention: "index points",
  series_file: "backtester/tmp/ftmo_dxy_cash_h1.csv",
  provenance_file: "backtester/tmp/ftmo_dxy_cash_h1.provenance.json",
  exporter: "backtester/scripts/export_ftmo_dxy_cash.py",
  exported_at: "2026-11-11T20:50:59.567035+00:00",
  bars: 10052,
  first_bar_utc: "2024-12-10T13:00:00Z",
  last_bar_utc: "2026-11-11T20:00:00Z",
  sha256: "c68757cbbfb202c35cc477e71a22cb7649b54758321cd9aa138e4231bde40d5f",
  clock_rule:
    "the terminal stamps bars in server time; the exporter converts to UTC with the US daylight-saving dates " +
    "(UTC+2 outside, UTC+3 inside) and reproduces that shift against the UTC EUR/USD tape before writing",
  what_it_is_not:
    "not the ICE cash index (no official settlement print, broker hours, broker spread) and not FRED DTWEXBGS",
});

/**
 * `H1-A01`. The `replaces` block is a verbatim copy of the v0.1.0 `inputs.json` row for `ice`. The
 * coverage audit compares the supplied package against `replaces`, so if the frozen package ever changes
 * underneath the amendment the audit throws instead of silently accepting the drift.
 */
const ICE_AMENDMENT = Object.freeze({
  id: "H1-A01",
  version: VERSION,
  input: "ice",
  title: "Replace the licensed ICE fixing with the archived DXY.cash hourly tape",
  decided_on: "2026-11-18",
  status: "accepted_by_owner",
  preserves: PRESERVES,
  decision:
    "The owner decided that no ICE licence is required: reuse the DXY dataset the project already acquired, " +
    "amend the H1 `ice` input to that verified source, and record every difference in calculation and sampling.",
  replaces: Object.freeze({
    source: "ICE",
    instrument: "US Dollar Index spot",
    transform: "previous eligible London 05:00 fixing to current 05:00, simple return in percent",
    hours: 0,
  }),
  with: Object.freeze({
    source: "FTMO Global Markets Ltd",
    instrument: "DXY.cash (spot CFD on the dollar index basket)",
    transform: "previous eligible London 05:00 price to current 05:00, simple return in percent",
    hours: 0,
  }),
  instrument: ICE_INSTRUMENT,
  max_lookback_days: 4,
  eligibility:
    "The current observation is the close of the one-hour bar that ends at the 05:00 London cutoff, so the " +
    "value is complete at the decision instant and no lookahead is possible. The previous observation is the " +
    "same construct on the most recent preceding London date inside a four-calendar-day cap, which covers the " +
    "weekend and a single holiday. Elapsed hours are recorded on every record; a wider gap is refused, not bridged.",
  differences: Object.freeze([
    "Source identity: a broker spot CFD quote stream (FTMO Global Markets Ltd, symbol DXY.cash) instead of the official ICE US Dollar Index spot print. Only the declared fields change; the arithmetic does not.",
    "Sampling: the observation is the close of a completed one-hour bar, not a single official fixing print. The bar's last tick is the 05:00:00 London price.",
    "Bar convention: this input reads the bar that ENDS at the cutoff (04:00-05:00 London). Test 1's DXY lane reads the bar that OPENS at the cutoff (05:00-06:00 London) at both endpoints, because an outcome may be measured after the fact. The two lanes are therefore shifted by one hour and must never be quoted as one series.",
    "Previous-eligible interval: 24 hours on a normal weekday, 72 hours across a weekend, up to 96 hours across a holiday. The elapsed interval is published per record, so a three-day return is never presented as a one-day return.",
    "Missing bars: the tape carries no bar on a weekend or holiday 05:00 boundary and none in the broker's closed hours. Such a morning is blocked and absent from the evidence file; no neighbouring hour is borrowed and nothing is interpolated.",
    "Clock: the record's observed and published clocks are the bar-completion instant, which equals the cutoff by construction. The export is retrospective, so this is a completion clock, not a recipient receipt: `received_at_utc` stays null and sealed live replay remains blocked for this input.",
    "Quote quality: broker spreads, broker hours and three-decimal quoting replace an official settlement print. Levels are not comparable across the two instruments; only the simple return is used.",
  ]),
  limitations: Object.freeze([
    "A morning without its own 05:00 bar is blocked, so the input cannot reach every session in the run window.",
    "No receipt exists for any historical morning, so the ice input can reach the historical reconstruction lane only.",
    "The amendment does not touch test 1: the official lane stays blocked and labelled, and the broker lane stays the labelled control it already was.",
  ]),
});
const AMENDMENTS = Object.freeze({
  [VERSION]: Object.freeze({ ice: ICE_AMENDMENT }),
});

function amendmentFor(key, version = VERSION) {
  const set = AMENDMENTS[version];
  if (!set || !set[key]) return null;
  return set[key];
}

/**
 * Fail loudly if the frozen package no longer says what the amendment claims to replace: the amendment
 * is only meaningful as a delta against the supplied text.
 */
function assertReplacementsHold(contracts, version = VERSION) {
  for (const amendment of Object.values(AMENDMENTS[version] || {})) {
    const supplied = contracts[amendment.input];
    if (!supplied) throw new Error(`h1 amendment ${amendment.id}: the supplied contract has no ${amendment.input} input`);
    for (const field of ["source", "instrument", "transform", "hours"]) {
      if (supplied[field] !== amendment.replaces[field]) {
        throw new Error(
          `h1 amendment ${amendment.id}: supplied ${amendment.input}.${field} is ${JSON.stringify(
            supplied[field]
          )}, the amendment replaces ${JSON.stringify(amendment.replaces[field])}`
        );
      }
    }
  }
}

/** One amended contract. Every supplied field is carried over; the amendment supplies the rest. */
function amendContract(key, contract, version = VERSION) {
  const amendment = amendmentFor(key, version);
  if (!amendment) return { ...contract };
  return {
    ...contract,
    ...amendment.with,
    identity: "amended_source",
    identity_state: "amended_source",
    code: "evidence_blocked",
    amended: { version, id: amendment.id, decided_on: amendment.decided_on },
    instrument_id: amendment.instrument.id,
    instrument_kind: amendment.instrument.kind,
    is_official_cash_dxy: amendment.instrument.is_official_cash_dxy,
    max_lookback_days: amendment.max_lookback_days,
    eligibility: amendment.eligibility,
    availability:
      `The archive holds the completed-hour ${amendment.instrument.symbol} tape from ` +
      `${amendment.instrument.first_bar_utc.slice(0, 10)} (${amendment.instrument.bars} bars). The 05:00 London value ` +
      "is the bar that closes at the cutoff, so it needs no lookahead; but the broker prints no bar on a weekend or " +
      "holiday boundary, and the export carries no publication receipt. A morning without its own 05:00 bar is " +
      "blocked, never filled from a neighbouring hour.",
    publication:
      "The bar completes at the cutoff instant. The export is retrospective, so the bar-completion clock is " +
      "recorded as the publication clock and no recipient receipt exists.",
    reconstructable:
      "Publication at the cutoff is proven by the completed bar itself. A recipient receipt cannot be reconstructed " +
      "from a retrospective export, so sealed live replay stays blocked for this input.",
    acquisition:
      `Collect the ${amendment.instrument.symbol} 05:00 bar close live at the cutoff and record a genuine receipt, ` +
      "so this input can also enter the sealed lane. No ICE licence is required and none is requested.",
  };
}

/** All nine contracts with the amendments applied. The supplied text is never mutated. */
function amendContracts(contracts, version = VERSION) {
  assertReplacementsHold(contracts, version);
  const out = {};
  for (const [key, contract] of Object.entries(contracts)) out[key] = amendContract(key, contract, version);
  return out;
}

/** A machine-readable record of what the audit applied, for the published payload. */
function describe(version = VERSION) {
  const set = AMENDMENTS[version] || {};
  return Object.values(set).map((amendment) => ({
    id: amendment.id,
    version: amendment.version,
    input: amendment.input,
    title: amendment.title,
    decided_on: amendment.decided_on,
    status: amendment.status,
    preserves: amendment.preserves,
    decision: amendment.decision,
    replaces: { ...amendment.replaces },
    amended_to: { ...amendment.with },
    instrument: { ...amendment.instrument },
    max_lookback_days: amendment.max_lookback_days,
    eligibility: amendment.eligibility,
    differences: amendment.differences.slice(),
    limitations: amendment.limitations.slice(),
  }));
}

module.exports = {
  VERSION,
  PRESERVES,
  AMENDMENTS,
  ICE_AMENDMENT,
  ICE_INSTRUMENT,
  amendmentFor,
  assertReplacementsHold,
  amendContract,
  amendContracts,
  describe,
};

