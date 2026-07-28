const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildConfidenceBandDeliveryArtifact,
  classifySampleSizeStatus
} = require("../lib/confidence_band_delivery");
const { computeHeadlineConfidenceData } = require("../lib/headline_confidence");

const repoRoot = path.resolve(__dirname, "../..");
const calibrationPath = path.join(repoRoot, "data", "confidence-calibration.json");
const layer1Path = path.join(repoRoot, "data", "layer1.json");
const layer2Path = path.join(repoRoot, "data", "layer2.json");
const scriptPath = path.join(repoRoot, "script.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findReferenceRow(rows, { scopeType, marketKey, direction, confidence, layer }) {
  return rows.find((row) =>
    String(row.scope_type || "") === String(scopeType || "")
    && String(row.layer || "").toUpperCase() === String(layer || "").toUpperCase()
    && String(row.market_key || "").toUpperCase() === String(marketKey || "").toUpperCase()
    && String(row.direction || "").toUpperCase() === String(direction || "").toUpperCase()
    && Number(confidence) >= Number(row.confidence_band_min)
    && Number(confidence) <= Number(row.confidence_band_max)
  ) || null;
}

test("confidence band delivery exposes direction-scoped rows, renamed evidence labels, and correct formulas", () => {
  const payload = buildConfidenceBandDeliveryArtifact({
    calibrationPath
  });
  const row = findReferenceRow(payload.rows, {
    scopeType: "exact_market_direction",
    layer: "Layer 1",
    marketKey: "EUR",
    direction: "BULLISH",
    confidence: 73
  });

  assert.equal(payload.sample_size_thresholds.very_limited_evidence, "directional sample 0-9");
  assert.equal(payload.sample_size_thresholds.limited_evidence, "directional sample 10-29");
  assert.equal(payload.sample_size_thresholds.reasonable_evidence, "directional sample 30-99");
  assert.equal(payload.sample_size_thresholds.substantial_evidence, "directional sample 100+");
  assert.ok(row);
  assert.equal(
    row.ex_flat_win_rate,
    Number(((row.correct / (row.correct + row.wrong)) * 100).toFixed(1))
  );
  assert.equal(
    row.all_outcome_accuracy,
    Number(((row.correct / (row.correct + row.wrong + row.flat)) * 100).toFixed(1))
  );
});

test("current active directional Layer 1 calls resolve to exact market-and-direction rows", () => {
  const payload = buildConfidenceBandDeliveryArtifact({
    calibrationPath
  });
  const layer1 = readJson(layer1Path);

  const activeDirectionalAgents = (layer1.agents || []).filter((agent) => {
    const direction = String(agent?.calls?.["24h"]?.direction || "").toUpperCase();
    return direction.startsWith("BULLISH") || direction.startsWith("BEARISH");
  });

  assert.ok(activeDirectionalAgents.length > 0);

  activeDirectionalAgents.forEach((agent) => {
    const model = agent?.calls?.["24h"]?.conviction_model || {};
    const currentConfidence = computeHeadlineConfidenceData({
      bullCase: model.bullish_argument_pct,
      bearCase: model.bearish_argument_pct,
      participation: model.directional_participation_pct ?? model.active_participation_pct ?? model.participation,
      netEdge: model.net_edge_pct,
      direction: agent?.calls?.["24h"]?.direction || "PENDING"
    }).value;
    const expectedDirection = String(agent?.calls?.["24h"]?.direction || "").toUpperCase().startsWith("BULLISH")
      ? "BULLISH"
      : "BEARISH";
    const row = findReferenceRow(payload.rows, {
      scopeType: "exact_market_direction",
      layer: "Layer 1",
      marketKey: agent.agent,
      direction: expectedDirection,
      confidence: currentConfidence
    });
    assert.ok(row, `Expected exact market-and-direction row for ${agent.agent}`);
    assert.equal(row.layer, "Layer 1");
    assert.equal(row.market_key, agent.agent);
    assert.equal(row.direction, expectedDirection);
  });
});

test("bullish and bearish rows stay separated and exact direction is preferred", () => {
  const payload = buildConfidenceBandDeliveryArtifact({
    calibrationPath
  });

  const exactRows = payload.rows.filter((row) => row.scope_type === "exact_market_direction" && row.layer === "Layer 1");
  const grouped = new Map();
  exactRows.forEach((row) => {
    const key = `${row.market_key}::${row.confidence_band}`;
    const existing = grouped.get(key) || [];
    existing.push(row);
    grouped.set(key, existing);
  });

  const comparable = Array.from(grouped.values()).find((rows) =>
    rows.some((row) => row.direction === "BULLISH") && rows.some((row) => row.direction === "BEARISH")
  );

  assert.ok(comparable, "Expected at least one market band with both bullish and bearish history");
  const bullishRow = comparable.find((row) => row.direction === "BULLISH");
  const bearishRow = comparable.find((row) => row.direction === "BEARISH");
  assert.ok(
    bullishRow.correct !== bearishRow.correct
      || bullishRow.wrong !== bearishRow.wrong
      || bullishRow.flat !== bearishRow.flat,
    "Bullish and bearish rows should not silently collapse into the same statistic"
  );
});

test("fallback scopes remain explicit and insufficient exact evidence is identifiable", () => {
  const payload = buildConfidenceBandDeliveryArtifact({
    calibrationPath
  });
  const nqExact = findReferenceRow(payload.rows, {
    scopeType: "exact_market_direction",
    layer: "Layer 1",
    marketKey: "NQ",
    direction: "BEARISH",
    confidence: 54
  });
  const nqMarketBand = findReferenceRow(payload.rows, {
    scopeType: "market_band_both_directions",
    layer: "Layer 1",
    marketKey: "NQ",
    direction: "BOTH",
    confidence: 54
  });
  const nqLayerDirection = findReferenceRow(payload.rows, {
    scopeType: "pooled_layer_direction",
    layer: "Layer 1",
    marketKey: "LAYER1_POOLED",
    direction: "BEARISH",
    confidence: 54
  });

  assert.ok(nqExact);
  assert.equal(nqExact.reference_label, "Exact market and direction");
  assert.equal(nqExact.insufficient_historical_sample, true);
  assert.ok(nqMarketBand);
  assert.equal(nqMarketBand.reference_label, "Market band, both directions");
  assert.ok(nqLayerDirection);
  assert.equal(nqLayerDirection.reference_label, "Pooled Layer 1 directional reference");
});

test("pooled layer tables expose all ten bands and reconcile counts", () => {
  const payload = buildConfidenceBandDeliveryArtifact({
    calibrationPath
  });
  const layer1Rows = payload.rows.filter((row) =>
    row.scope_type === "pooled_layer_band"
    && row.layer === "Layer 1"
    && row.market_key === "LAYER1_POOLED"
    && row.direction === "BOTH"
  );
  const layer2Rows = payload.rows.filter((row) =>
    row.scope_type === "pooled_layer_band"
    && row.layer === "Layer 2"
    && row.market_key === "LAYER2_POOLED"
    && row.direction === "BOTH"
  );

  assert.equal(layer1Rows.length, 10);
  assert.equal(layer2Rows.length, 10);

  for (const row of [...layer1Rows, ...layer2Rows]) {
    assert.equal(row.directional_sample, row.correct + row.wrong);
    if (row.directional_sample === 0) {
      assert.equal(row.ex_flat_win_rate, null);
    } else {
      assert.equal(row.ex_flat_win_rate, Number(((row.correct / row.directional_sample) * 100).toFixed(1)));
    }
    const outcomeSample = row.correct + row.wrong + row.flat;
    if (outcomeSample === 0) {
      assert.equal(row.all_outcome_accuracy, null);
      assert.equal(row.flat_rate, null);
    } else {
      assert.equal(row.all_outcome_accuracy, Number(((row.correct / outcomeSample) * 100).toFixed(1)));
      assert.equal(row.flat_rate, Number(((row.flat / outcomeSample) * 100).toFixed(1)));
    }
  }
});

test("layer 2 no-trade live states remain non-directional", () => {
  const layer2 = readJson(layer2Path);
  const noTradePairs = (layer2.pairs || []).filter((pair) => String(pair.decision || "").toUpperCase() === "NO_TRADE");

  assert.ok(noTradePairs.length > 0, "Expected at least one NO TRADE pair in the checked-in live artifact");
  noTradePairs.forEach((pair) => {
    assert.equal(String(pair.direction || "").toUpperCase(), "NO TRADE");
    assert.equal(pair.combined_confidence, null);
    assert.equal(pair.strength, null);
  });
});

test("sample-size label helper matches documented thresholds", () => {
  assert.equal(classifySampleSizeStatus(0), "Very limited evidence");
  assert.equal(classifySampleSizeStatus(9), "Very limited evidence");
  assert.equal(classifySampleSizeStatus(10), "Limited evidence");
  assert.equal(classifySampleSizeStatus(29), "Limited evidence");
  assert.equal(classifySampleSizeStatus(30), "Reasonable evidence");
  assert.equal(classifySampleSizeStatus(99), "Reasonable evidence");
  assert.equal(classifySampleSizeStatus(100), "Substantial evidence");
});

test("historical delivery data stays read-only and out of call generation paths", () => {
  const scriptSource = fs.readFileSync(scriptPath, "utf8");
  const confidenceBandReferences = (scriptSource.match(/confidenceBandDeliveryData/g) || []).length;

  assert.ok(confidenceBandReferences >= 4);
  assert.ok(scriptSource.includes("renderOverviewConfidenceBandPanel"));
  assert.ok(scriptSource.includes("resolveOverviewConfidenceBandReferences"));
  assert.ok(scriptSource.includes("renderOverviewConfidenceBandSummaryTable"));
  assert.ok(scriptSource.includes("data-overview-confidence-band-row"));
  assert.ok(scriptSource.includes("if (decision === \"TRADE\")"));
  assert.ok(scriptSource.includes("const direction = String(pair?.direction || \"\").trim().toUpperCase();"));
  assert.ok(!scriptSource.includes("function confidenceValue(call, agent, timeframe = \"24h\") {\n  return confidenceBandDeliveryData"));
  assert.ok(!scriptSource.includes("function deriveLiveLayer2Dashboard() {\n  const confidenceBandDeliveryData"));
});
