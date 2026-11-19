// The FX-volume close regression, run through the relay's own adapter rather than a copy of its arithmetic.
//
// The copier's close path is the adapter's `closePosition`, which reads the symbol's spec and asks the transport
// to build the close payload in that contract's protocol units. This script injects a scripted session - no
// socket, no order - and reads the payload the adapter actually asks the transport to send, so the numbers below
// are the wire numbers, not a re-derivation:
//
//   EURUSD 0.01 lot -> 100,000 protocol units      XAUUSD 0.01 lot -> 100
//   BTCUSD 0.01 lot -> 1                           the index at its own contract
//
// It is deliberately not a unit test of a formula: the assertion is on what the deployed adapter hands the
// transport, and it runs on the trading host against the same files the copier loads.
//
//   node fx-close-regression.js [--snapshot <snapshot.json>]
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const RELAY_DIR = process.env.CTRADER_RELAY_DIR || "C:/ctrader-relay";
const adapterModule = require(path.join(RELAY_DIR, "CTRADER_ADAPTER_20261114.js"));
const transport = require(path.join(RELAY_DIR, "CTRADER_TRANSPORT_20261114.js"));

// The contracts the demo account returned on 2026-11-19, used when no snapshot is passed. lotSize is the
// protocol's own per-lot count (10,000,000 for 100,000 units of EURUSD), which is the number under test.
const FALLBACK = [
  { symbol: "EURUSD", symbolId: 1, digits: 5, lotSize: 10000000, minVolume: 1000, stepVolume: 1000, maxVolume: 1000000000, slDistance: 0, tradingMode: 0, expectedLots: 0.01, expectedUnits: 100000 },
  { symbol: "XAUUSD", symbolId: 2, digits: 2, lotSize: 10000, minVolume: 100, stepVolume: 100, maxVolume: 1000000, slDistance: 0, tradingMode: 0, expectedLots: 0.01, expectedUnits: 100 },
  { symbol: "BTCUSD", symbolId: 3, digits: 2, lotSize: 100, minVolume: 1, stepVolume: 1, maxVolume: 10000, slDistance: 0, tradingMode: 0, expectedLots: 0.01, expectedUnits: 1 }
];

function fromSnapshot(file) {
  const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
  return Object.values(snapshot.symbols || {}).map((row) => ({
    symbol: row.symbol,
    symbolId: row.symbol_id,
    digits: row.digits,
    lotSize: row.protocol_units_per_lot,
    minVolume: Math.round(row.min_volume * row.protocol_units_per_lot),
    stepVolume: Math.round(row.volume_step * row.protocol_units_per_lot),
    maxVolume: Math.round(row.max_volume * row.protocol_units_per_lot),
    slDistance: 0,
    tradingMode: 0,
    expectedLots: row.volume_step <= 0.01 ? 0.01 : row.volume_step,
    expectedUnits: Math.round((row.volume_step <= 0.01 ? 0.01 : row.volume_step) * row.protocol_units_per_lot)
  })).filter((row) => row.symbol && row.symbolId);
}

function scriptedSession(specs) {
  const calls = { closes: [] };
  return {
    calls,
    async call(payloadType, payload) {
      if (payloadType === transport.PAYLOAD.symbolsListReq) {
        return { symbol: specs.map((row) => ({ symbolId: row.symbolId, symbolName: row.symbol })) };
      }
      if (payloadType === transport.PAYLOAD.symbolByIdReq) {
        const wanted = new Set((payload.symbolId || []).map(Number));
        return {
          symbol: specs.filter((row) => wanted.has(Number(row.symbolId))).map((row) => ({
            symbolId: row.symbolId,
            symbolName: row.symbol,
            digits: row.digits,
            lotSize: row.lotSize,
            minVolume: row.minVolume,
            stepVolume: row.stepVolume,
            maxVolume: row.maxVolume,
            slDistance: row.slDistance,
            distanceSetIn: 1,
            tradingMode: row.tradingMode
          }))
        };
      }
      if (payloadType === transport.PAYLOAD.closePositionReq) {
        calls.closes.push({ payloadType, payload });
        return {
          executionType: 2,
          position: { positionId: payload.positionId, positionStatus: 2 },
          deal: { executionPrice: 1, executionTimestamp: Date.now() }
        };
      }
      if (payloadType === transport.PAYLOAD.reconcileReq) return { position: [], order: [] };
      throw new Error(`scripted session was asked for payload ${payloadType}`);
    }
  };
}

async function run(specs) {
  const session = scriptedSession(specs);
  const client = adapterModule.createAdapter({
    session,
    events: {},
    account: { accountId: 42585819, isLive: false, broker: "scripted" },
    config: { pollMs: 10, spotMaxAgeMs: 1000, spotTimeoutMs: 1000 }
  });
  const results = [];
  for (const spec of specs) {
    const expectedLots = spec.expectedLots;
    const positionId = String(900000 + Number(spec.symbolId));
    const outcome = await client.closePosition({ positionId, symbol: spec.symbol, volume: expectedLots, reason: "regression" });
    const sent = session.calls.closes[session.calls.closes.length - 1];
    const units = sent ? Number(sent.payload.volume) : null;
    results.push({
      symbol: spec.symbol,
      lots: expectedLots,
      protocol_units: units,
      expected_units: spec.expectedUnits,
      outcome: outcome.outcome || null,
      ok: units === spec.expectedUnits && outcome.outcome === "accepted"
    });
  }
  return results;
}

(async () => {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--snapshot");
  const specs = at >= 0 ? fromSnapshot(argv[at + 1]) : FALLBACK;
  const results = await run(specs);
  const ok = results.every((row) => row.ok);
  process.stdout.write(`${JSON.stringify({ ok, ran_at_utc: new Date().toISOString(), results }, null, 2)}\n`);
  process.exitCode = ok ? 0 : 1;
})().catch((error) => {
  process.stderr.write(`failed: ${(error && error.code) || "error"}: ${(error && error.message) || error}\n`);
  process.exitCode = 1;
});
