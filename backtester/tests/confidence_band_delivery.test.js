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

function buildPayload() {
  return buildConfidenceBandDeliveryArtifact({ calibrationPath });
}

function rowsFor(payload, filters = {}) {
  return payload.rows.filter((row) => Object.entries(filters).every(([key, value]) => String(row[key]) === String(value)));
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

test("confidence band delivery exposes the full expected historical coverage", () => {
  const payload = buildPayload();

  assert.deepEqual(payload.coverage.layer1_markets, ["USD", "EUR", "GOLD", "NQ", "BTC"]);
  assert.deepEqual(payload.coverage.layer2_pairs, ["EUR_USD", "XAU_USD", "NQ_USD", "BTC_USD"]);
  assert.deepEqual(payload.coverage.layer1_directions, ["BULLISH", "BEARISH"]);
  assert.deepEqual(payload.coverage.layer2_directions, ["BUY", "SELL"]);
  assert.deepEqual(payload.coverage.confidence_bands, ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80-89", "90-100"]);
  assert.deepEqual(payload.coverage.strength_bands, ["Weak", "Moderate", "Strong", "Very Strong"]);

  for (const market of payload.coverage.layer1_markets) {
    for (const direction of ["BULLISH", "BEARISH", "BOTH"]) {
      const scopeType = direction === "BOTH" ? "market_band_both_directions" : "exact_market_direction";
      assert.equal(
        rowsFor(payload, { scope_type: scopeType, layer: "Layer 1", market_key: market, direction }).length,
        10,
        `Expected 10 Layer 1 rows for ${market} ${direction}`
      );
    }
  }

  for (const pair of payload.coverage.layer2_pairs) {
    for (const direction of ["BUY", "SELL", "BOTH"]) {
      const scopeType = direction === "BOTH" ? "market_band_both_directions" : "exact_market_direction";
      assert.equal(
        rowsFor(payload, { scope_type: scopeType, layer: "Layer 2", market_key: pair, direction }).length,
        10,
        `Expected 10 Layer 2 rows for ${pair} ${direction}`
      );
    }
  }

  assert.equal(rowsFor(payload, { scope_type: "pooled_layer_band", layer: "Layer 1", market_key: "LAYER1_POOLED", direction: "BOTH" }).length, 10);
  assert.equal(rowsFor(payload, { scope_type: "pooled_layer_band", layer: "Layer 2", market_key: "LAYER2_POOLED", direction: "BOTH" }).length, 10);
  assert.equal(rowsFor(payload, { scope_type: "pooled_layer_direction", layer: "Layer 1", market_key: "LAYER1_POOLED", direction: "BULLISH" }).length, 10);
  assert.equal(rowsFor(payload, { scope_type: "pooled_layer_direction", layer: "Layer 1", market_key: "LAYER1_POOLED", direction: "BEARISH" }).length, 10);
  assert.equal(rowsFor(payload, { scope_type: "pooled_layer_direction", layer: "Layer 2", market_key: "LAYER2_POOLED", direction: "BUY" }).length, 10);
  assert.equal(rowsFor(payload, { scope_type: "pooled_layer_direction", layer: "Layer 2", market_key: "LAYER2_POOLED", direction: "SELL" }).length, 10);
});

test("lean-direction mapping remains explicit and truthful to the locked checker contract", () => {
  const payload = buildPayload();

  assert.ok(payload.direction_mapping.layer1.some((entry) => entry.includes("BULLISH_LEAN") && entry.includes("BULLISH")));
  assert.ok(payload.direction_mapping.layer1.some((entry) => entry.includes("BEARISH_LEAN") && entry.includes("BEARISH")));
  assert.ok(payload.direction_mapping.layer1.some((entry) => entry.includes("NO_CLEAR_BIAS")));
  assert.ok(payload.direction_mapping.layer2.some((entry) => entry.includes("BUY") && entry.includes("SELL")));
  assert.ok(payload.direction_mapping.layer2.some((entry) => entry.includes("NO_TRADE")));
});

test("band rows reconcile formulas, empty bands, and combined-direction totals", () => {
  const payload = buildPayload();

  for (const row of payload.rows) {
    const evaluated = Number(row.correct || 0) + Number(row.wrong || 0);
    const totalOutcomes = Number(row.correct || 0) + Number(row.wrong || 0) + Number(row.flat || 0);

    assert.equal(row.evaluated_directional_calls, evaluated);
    assert.ok(totalOutcomes <= Number(row.total_calls || 0));

    if (evaluated === 0) {
      assert.equal(row.directional_accuracy, null);
      assert.equal(row.ex_flat_win_rate, null);
    } else {
      assert.equal(row.directional_accuracy, Number(((row.correct / evaluated) * 100).toFixed(1)));
      assert.equal(row.ex_flat_win_rate, Number(((row.correct / evaluated) * 100).toFixed(1)));
    }

    if (totalOutcomes === 0) {
      assert.equal(row.all_outcome_accuracy, null);
      assert.equal(row.flat_rate, null);
    } else {
      assert.equal(row.all_outcome_accuracy, Number(((row.correct / totalOutcomes) * 100).toFixed(1)));
      assert.equal(row.flat_rate, Number(((row.flat / totalOutcomes) * 100).toFixed(1)));
    }
  }

  for (const layer of ["Layer 1", "Layer 2"]) {
    const entities = layer === "Layer 1" ? payload.coverage.layer1_markets : payload.coverage.layer2_pairs;
    const directionalValues = layer === "Layer 1" ? ["BULLISH", "BEARISH"] : ["BUY", "SELL"];
    for (const entity of entities) {
      for (const band of payload.coverage.confidence_bands) {
        const combined = rowsFor(payload, {
          scope_type: "market_band_both_directions",
          layer,
          market_key: entity,
          direction: "BOTH",
          confidence_band: band
        })[0];
        const directional = directionalValues.map((direction) => rowsFor(payload, {
          scope_type: "exact_market_direction",
          layer,
          market_key: entity,
          direction,
          confidence_band: band
        })[0]);

        assert.ok(combined, `Missing combined row for ${layer} ${entity} ${band}`);
        assert.equal(combined.correct, directional.reduce((sum, row) => sum + Number(row.correct || 0), 0));
        assert.equal(combined.wrong, directional.reduce((sum, row) => sum + Number(row.wrong || 0), 0));
        assert.equal(combined.flat, directional.reduce((sum, row) => sum + Number(row.flat || 0), 0));
        assert.equal(combined.evaluated_directional_calls, directional.reduce((sum, row) => sum + Number(row.evaluated_directional_calls || 0), 0));
      }
    }
  }
});

test("artifact reconciliation checks all pass", () => {
  const payload = buildPayload();

  assert.deepEqual(payload.reconciliation, {
    correct_plus_wrong_equals_evaluated_directional_calls: true,
    outcome_counts_do_not_exceed_total_calls: true,
    market_direction_rows_reconcile_with_combined_direction_rows: true,
    market_rows_reconcile_with_pooled_layer_totals: true,
    directional_rows_reconcile_with_pooled_direction_totals: true,
    strength_band_totals_reconcile_with_confidence_band_totals: true
  });
});

test("strength-band rows exist for pooled and entity scopes and reconcile to combined band totals", () => {
  const payload = buildPayload();
  const strengthOrder = ["Weak", "Moderate", "Strong", "Very Strong"];
  const layer1Keys = new Set(payload.coverage.layer1_markets);
  const layer2Keys = new Set(payload.coverage.layer2_pairs);

  for (const row of payload.strength_rows) {
    assert.ok(strengthOrder.includes(row.strength_label));
    const evaluated = Number(row.correct || 0) + Number(row.wrong || 0);
    const totalOutcomes = Number(row.correct || 0) + Number(row.wrong || 0) + Number(row.flat || 0);
    assert.equal(row.evaluated_directional_calls, evaluated);
    if (evaluated === 0) {
      assert.equal(row.directional_accuracy, null);
    } else {
      assert.equal(row.directional_accuracy, Number(((row.correct / evaluated) * 100).toFixed(1)));
    }
    if (totalOutcomes === 0) {
      assert.equal(row.all_outcome_accuracy, null);
      assert.equal(row.flat_rate, null);
    } else {
      assert.equal(row.all_outcome_accuracy, Number(((row.correct / totalOutcomes) * 100).toFixed(1)));
      assert.equal(row.flat_rate, Number(((row.flat / totalOutcomes) * 100).toFixed(1)));
    }
  }

  for (const key of ["LAYER1_POOLED", "LAYER2_POOLED", ...payload.coverage.layer1_markets, ...payload.coverage.layer2_pairs]) {
    const layer = key === "LAYER2_POOLED" || layer2Keys.has(key) ? "Layer 2" : "Layer 1";
    const expectedScope = key.startsWith("LAYER") ? "pooled_strength_band" : "entity_strength_band";
    const rows = payload.strength_rows.filter((row) => row.layer === layer && row.market_key === key && row.scope_type === expectedScope);
    assert.equal(rows.length, 4, `Expected four strength rows for ${key}`);
  }
});

test("Layer 2 NO TRADE summaries exist for every pair and stay outside BUY/SELL accuracy rows", () => {
  const payload = buildPayload();

  assert.equal(payload.no_trade_rows.length, 4);

  for (const pairKey of payload.coverage.layer2_pairs) {
    const noTradeRow = payload.no_trade_rows.find((row) => row.market_key === pairKey);
    assert.ok(noTradeRow, `Missing NO TRADE summary for ${pairKey}`);
    assert.equal(noTradeRow.direction, "NO_TRADE");
    assert.ok(noTradeRow.no_trade_outcomes >= 0);
    assert.ok(noTradeRow.total_layer2_observations >= noTradeRow.no_trade_outcomes);
    assert.equal(
      rowsFor(payload, { scope_type: "exact_market_direction", layer: "Layer 2", market_key: pairKey, direction: "NO_TRADE" }).length,
      0
    );
  }
});

test("bullish/bearish and buy/sell rows stay separate and asymmetry gating uses adequate evidence only", () => {
  const payload = buildPayload();

  const eurBullish = rowsFor(payload, {
    scope_type: "exact_market_direction",
    layer: "Layer 1",
    market_key: "EUR",
    direction: "BULLISH",
    confidence_band: "70-79"
  })[0];
  const eurBearish = rowsFor(payload, {
    scope_type: "exact_market_direction",
    layer: "Layer 1",
    market_key: "EUR",
    direction: "BEARISH",
    confidence_band: "70-79"
  })[0];

  assert.ok(eurBullish);
  assert.ok(eurBearish);
  assert.notDeepEqual(
    { correct: eurBullish.correct, wrong: eurBullish.wrong, flat: eurBullish.flat },
    { correct: eurBearish.correct, wrong: eurBearish.wrong, flat: eurBearish.flat }
  );

  for (const row of payload.asymmetry_rows) {
    const bullishEvaluated = Number(row.bullish_evaluated_directional_calls || 0);
    const bearishEvaluated = Number(row.bearish_evaluated_directional_calls || 0);
    assert.equal(row.adequate_evidence, bullishEvaluated >= 30 && bearishEvaluated >= 30);
  }
});

test("current active Layer 1 and Layer 2 directional calls resolve truthfully against the delivery contract", () => {
  const payload = buildPayload();
  const layer1 = readJson(layer1Path);
  const layer2 = readJson(layer2Path);

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
  });

  const activeDirectionalPairs = (layer2.pairs || []).filter((pair) => {
    const decision = String(pair?.decision || "").toUpperCase();
    const direction = String(pair?.direction || "").toUpperCase();
    return decision === "TRADE" && (direction === "BUY" || direction === "SELL");
  });

  activeDirectionalPairs.forEach((pair) => {
    const row = findReferenceRow(payload.rows, {
      scopeType: "exact_market_direction",
      layer: "Layer 2",
      marketKey: pair.pair_code,
      direction: String(pair.direction || "").toUpperCase(),
      confidence: Number(pair.combined_confidence)
    });
    assert.ok(row, `Expected exact market-and-direction row for ${pair.pair_code}`);
  });
});

test("sample-size labels use the renamed evidence wording and documented thresholds", () => {
  const payload = buildPayload();

  assert.equal(payload.sample_size_thresholds.very_limited_evidence, "evaluated directional calls 0-9");
  assert.equal(payload.sample_size_thresholds.limited_evidence, "evaluated directional calls 10-29");
  assert.equal(payload.sample_size_thresholds.reasonable_evidence, "evaluated directional calls 30-99");
  assert.equal(payload.sample_size_thresholds.substantial_evidence, "evaluated directional calls 100+");
  assert.equal(classifySampleSizeStatus(0), "Very limited evidence");
  assert.equal(classifySampleSizeStatus(9), "Very limited evidence");
  assert.equal(classifySampleSizeStatus(10), "Limited evidence");
  assert.equal(classifySampleSizeStatus(29), "Limited evidence");
  assert.equal(classifySampleSizeStatus(30), "Reasonable evidence");
  assert.equal(classifySampleSizeStatus(99), "Reasonable evidence");
  assert.equal(classifySampleSizeStatus(100), "Substantial evidence");
});

test("dashboard wording prefers Historical calls and does not feed historical results back into live call generation", () => {
  const scriptSource = fs.readFileSync(scriptPath, "utf8");

  assert.ok(scriptSource.includes("Historical calls"));
  assert.ok(scriptSource.includes("Evaluated directional calls"));
  assert.ok(scriptSource.includes("Evidence quality"));
  assert.ok(scriptSource.includes("renderOverviewConfidenceBandPanel"));
  assert.ok(scriptSource.includes("resolveOverviewConfidenceBandReferences"));
  assert.ok(!scriptSource.includes("Historical confidence-band delivery is used to score live calls"));
  assert.ok(!scriptSource.includes("function deriveLiveLayer2Dashboard() {\n  const confidenceBandDeliveryData"));
  assert.ok(!scriptSource.includes("function confidenceValue(call, agent, timeframe = \"24h\") {\n  return confidenceBandDeliveryData"));
});
