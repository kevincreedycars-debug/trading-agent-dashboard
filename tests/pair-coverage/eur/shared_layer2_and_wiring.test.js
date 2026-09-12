const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { deriveLayer2PairSignal } = require("../../../backtester/lib/layer2_pair_logic");

const repoRoot = path.join(__dirname, "..", "..", "..");
const scriptSource = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");

function configBlock(pairCode) {
  const idx = scriptSource.indexOf(`pairCode: "${pairCode}"`);
  assert.ok(idx >= 0, `config not found: ${pairCode}`);
  return scriptSource.slice(idx, idx + 320);
}

function configField(pairCode, field) {
  const match = configBlock(pairCode).match(new RegExp(`${field}: "([A-Z_]+)"`));
  return match ? match[1] : null;
}

test("shared Layer 2 signal keeps exact USD behaviour for existing callers", () => {
  const legacy = deriveLayer2PairSignal({
    instrument: "EUR/USD",
    targetDirection: "BEARISH",
    usdDirection: "BULLISH",
    targetConfidence: 42,
    usdConfidence: 86
  });
  assert.equal(legacy.tradable, true);
  assert.equal(legacy.direction, "SELL");
  assert.equal(legacy.combinedConfidence, 42);
  assert.equal(legacy.strengthBucketKey, "WEAK");
  assert.match(legacy.reason, /target and USD 24H signals/);

  const conflict = deriveLayer2PairSignal({
    instrument: "BTC/USD",
    targetDirection: "BULLISH",
    usdDirection: "BULLISH",
    targetConfidence: 63,
    usdConfidence: 86
  });
  assert.equal(conflict.reasonKey, "same_direction_conflict");
  assert.equal(conflict.tradable, false);
});

test("shared Layer 2 signal supports a non-USD quote", () => {
  const signal = deriveLayer2PairSignal({
    instrument: "XAU/EUR",
    targetDirection: "BULLISH",
    quoteDirection: "BEARISH",
    quoteLabel: "EUR",
    targetConfidence: 80,
    quoteConfidence: 70
  });
  assert.equal(signal.tradable, true);
  assert.equal(signal.direction, "BUY");
  assert.equal(signal.combinedConfidence, 70);
  assert.equal(signal.strengthBucketKey, "STRONG");
  assert.match(signal.reason, /target and EUR 24H signals/);

  const nonDirectional = deriveLayer2PairSignal({
    instrument: "NQ/EUR",
    targetDirection: "BULLISH",
    quoteDirection: "NO_CLEAR_BIAS",
    quoteLabel: "EUR",
    targetConfidence: 80,
    quoteConfidence: 70
  });
  assert.equal(nonDirectional.tradable, false);
  assert.equal(nonDirectional.reasonKey, "unsupported_usd_direction");
  assert.match(nonDirectional.reason, /EUR 24H signal is non-directional/);
});

test("quoteDirection and quoteConfidence win over the USD aliases", () => {
  const signal = deriveLayer2PairSignal({
    instrument: "BTC/EUR",
    targetDirection: "BULLISH",
    usdDirection: "BULLISH",
    quoteDirection: "BEARISH",
    targetConfidence: 70,
    usdConfidence: 70,
    quoteConfidence: 60,
    quoteLabel: "EUR"
  });
  assert.equal(signal.tradable, true);
  assert.equal(signal.direction, "BUY");
  assert.equal(signal.combinedConfidence, 60);
});

test("the dashboard pair loop is quote-agnostic", () => {
  assert.equal(scriptSource.includes('agent?.agent === "USD"'), false);
  assert.ok(scriptSource.includes('const quoteAssetCode = config.quoteAssetCode || "USD";'));
  assert.ok(scriptSource.includes("quoteLabel: quoteAssetCode"));
  assert.ok(scriptSource.includes("quoteConfidence"));
});

test("the six EUR crosses carry an explicit quote asset", () => {
  assert.deepEqual(
    ["EUR_GBP", "XAU_EUR", "XAG_EUR", "WTI_EUR", "NQ_EUR", "BTC_EUR"].map((code) => [
      code,
      configField(code, "quoteAssetCode")
    ]),
    [
      ["EUR_GBP", "GBP"],
      ["XAU_EUR", "EUR"],
      ["XAG_EUR", "EUR"],
      ["WTI_EUR", "EUR"],
      ["NQ_EUR", "EUR"],
      ["BTC_EUR", "EUR"]
    ]
  );
});

test("every EUR cross is READY once both of its Layer 1 legs are live", () => {
  for (const code of [
    "EUR_USD", "XAU_USD", "NQ_USD", "BTC_USD",
    "EUR_GBP", "XAU_EUR", "XAG_EUR", "WTI_EUR", "NQ_EUR", "BTC_EUR"
  ]) {
    assert.equal(configField(code, "liveEligibility"), "READY", `${code} should be READY`);
  }
});
