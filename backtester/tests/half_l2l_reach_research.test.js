const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRequiredDistanceInputs,
  evaluateL2lSequence
} = require("../lib/adr_reach_research");
const {
  evaluateTargetReach
} = require("../lib/half_l2l_reach_research");
const {
  buildLayer1Rows,
  buildOutput
} = require("../scripts/validate_half_l2l_reach_research");

function createDailyContext(records) {
  const sorted = records.slice().sort((a, b) => a.date.localeCompare(b.date));
  return {
    records: sorted,
    byDate: new Map(sorted.map((record) => [record.date, record])),
    coverageStart: sorted[0]?.date || null,
    coverageEnd: sorted[sorted.length - 1]?.date || null,
    weekdayCounts: {},
    weekendRowCount: sorted.filter((record) => {
      const day = new Date(`${record.date}T00:00:00Z`).getUTCDay();
      return day === 0 || day === 6;
    }).length,
    instrument: "TEST",
    source: "test"
  };
}

function createIntradayContext(sessionByDate) {
  const entries = Object.entries(sessionByDate).sort(([left], [right]) => left.localeCompare(right));
  const records = entries.flatMap(([, rows]) => rows);
  return {
    records,
    byDate: new Map(entries),
    coverageStart: entries[0]?.[0] || null,
    coverageEnd: entries[entries.length - 1]?.[0] || null,
    sessionCount: entries.length,
    candleCount: records.length,
    weekdayCounts: {},
    weekendRowCount: entries.filter(([date]) => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return day === 0 || day === 6;
    }).length,
    instrument: "TEST",
    source: "test"
  };
}

function createDailySeries(startDate = "2024-01-01", count = 30, base = 100, range = 10, includeWeekends = false) {
  const rows = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  while (rows.length < count) {
    const weekday = cursor.getUTCDay();
    if (includeWeekends || (weekday !== 0 && weekday !== 6)) {
      const date = cursor.toISOString().slice(0, 10);
      rows.push({
        instrument: "TEST",
        date,
        open: base,
        high: base + range,
        low: base,
        close: base + 1,
        source: "test",
        complete: true
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
}

function createConfig(overrides = {}) {
  return {
    assetCode: "TEST",
    assetLabel: "Test",
    instrument: "TEST",
    sourceVendor: "test",
    candleSourceLabel: "test",
    fixedReferenceL2lDistance: 5,
    ...overrides
  };
}

function createCheckerRow({
  predictionId = "row-1",
  snapshotDate = "2024-02-06",
  closeDate = "2024-02-06",
  direction = "BULLISH",
  confidence = 72
} = {}) {
  return {
    prediction_id: predictionId,
    snapshot_date: snapshotDate,
    stored: {
      direction,
      displayed_headline_confidence_pct: confidence,
      headline_confidence_pct: confidence
    },
    checker: {
      direction,
      displayed_headline_confidence_pct: confidence,
      headline_confidence_pct: confidence
    },
    evaluation_inputs: {
      open_price: 100,
      close_price: 101,
      close_date: closeDate
    }
  };
}

function createRequiredInputs(sessionRowsByDate, evaluationDate = "2024-02-06", options = {}) {
  const dailyContext = createDailyContext(createDailySeries(options.dailyStartDate, 30, 100, 10, options.includeWeekends));
  const intradayContext = createIntradayContext(sessionRowsByDate);
  return buildRequiredDistanceInputs(createConfig(), dailyContext, intradayContext, evaluationDate);
}

function createSyntheticEligibleRow({
  layer = "LAYER_1",
  entityCode = "EUR",
  entityLabel = "EUR",
  predictionId = "pred-1",
  snapshotDate = "2024-02-06",
  evaluationDate = "2024-02-06",
  callDirection = "BULLISH",
  strengthBucket = "WEAK",
  confidencePct = 55,
  halfOutcome = "HIT",
  fullOutcome = "MISS",
  halfTime = 2,
  fullTime = null,
  halfMargin = 0.1,
  fullMargin = -0.1
} = {}) {
  return {
    layer,
    entityCode,
    entityLabel,
    targetAssetCode: layer === "LAYER_2" ? entityCode.split("_")[0] : null,
    predictionId,
    snapshotDate,
    evaluationDate,
    rawCallDirection: callDirection,
    callDirection,
    directionalCallType: "CLEAN_DIRECTIONAL",
    confidencePct,
    strengthBucket,
    exactConfidenceBucketKey: "50_59",
    exactConfidenceBucketLabel: "50-59",
    weekdayKey: "TUESDAY",
    evaluationYear: evaluationDate.slice(0, 4),
    evaluationMonth: evaluationDate.slice(0, 7),
    instrumentSymbol: layer === "LAYER_2" ? entityCode : `${entityCode}_USD`,
    sourceVendor: "test",
    candleSourceLabel: "test",
    fixedReferenceL2lDistance: 5,
    status: "ELIGIBLE",
    statusReasonKey: null,
    statusReason: null,
    numberOf1hCandlesLoaded: 24,
    evaluationStartTime: `${evaluationDate}T00:00:00Z`,
    evaluationEndTime: `${evaluationDate}T23:00:00Z`,
    adr20: 10,
    currentStandardL2lDistance: 5,
    halfL2lDistance: 2.5,
    adr20WindowStartDate: "2024-01-09",
    adr20WindowEndDate: "2024-02-05",
    outcomes: {
      HALF_OF_STANDARD: {
        modeKey: "HALF_OF_STANDARD",
        outcome: halfOutcome,
        reached: halfOutcome === "HIT",
        targetDistance: 2.5,
        targetPrice: halfOutcome === "HIT" ? 102.5 : null,
        triggerSwingPrice: halfOutcome === "HIT" ? 100 : null,
        triggerSwingTime: halfOutcome === "HIT" ? `${evaluationDate}T01:00:00Z` : null,
        triggerCandleTime: halfOutcome === "HIT" ? `${evaluationDate}T03:00:00Z` : null,
        timeToTargetHours: halfOutcome === "HIT" ? halfTime : null,
        maxFavourableDistance: halfOutcome === "HIT" ? 3.1 : 1.9,
        maxFavourableDistanceRatioToCurrentStandard: halfOutcome === "HIT" ? 0.62 : 0.38,
        bestMargin: halfMargin,
        evaluationStartTime: `${evaluationDate}T00:00:00Z`,
        evaluationEndTime: `${evaluationDate}T23:00:00Z`,
        initiatingPrice: 100,
        initiatingTime: `${evaluationDate}T01:00:00Z`,
        confirmingPrice: halfOutcome === "HIT" ? 103.1 : 101.9,
        confirmingTime: `${evaluationDate}T03:00:00Z`,
        adverseBoundarySupported: false,
        adverseSequence: "NOT_SUPPORTED"
      },
      FULL_STANDARD: {
        modeKey: "FULL_STANDARD",
        outcome: fullOutcome,
        reached: fullOutcome === "HIT",
        targetDistance: 5,
        targetPrice: fullOutcome === "HIT" ? 105 : null,
        triggerSwingPrice: fullOutcome === "HIT" ? 100 : null,
        triggerSwingTime: fullOutcome === "HIT" ? `${evaluationDate}T01:00:00Z` : null,
        triggerCandleTime: fullOutcome === "HIT" ? `${evaluationDate}T06:00:00Z` : null,
        timeToTargetHours: fullOutcome === "HIT" ? fullTime : null,
        maxFavourableDistance: fullOutcome === "HIT" ? 5.2 : 3.7,
        maxFavourableDistanceRatioToCurrentStandard: fullOutcome === "HIT" ? 1.04 : 0.74,
        bestMargin: fullMargin,
        evaluationStartTime: `${evaluationDate}T00:00:00Z`,
        evaluationEndTime: `${evaluationDate}T23:00:00Z`,
        initiatingPrice: 100,
        initiatingTime: `${evaluationDate}T01:00:00Z`,
        confirmingPrice: fullOutcome === "HIT" ? 105.2 : 103.7,
        confirmingTime: fullOutcome === "HIT" ? `${evaluationDate}T06:00:00Z` : `${evaluationDate}T12:00:00Z`,
        adverseBoundarySupported: false,
        adverseSequence: "NOT_SUPPORTED"
      }
    }
  };
}

test("bullish exact-threshold touch is a hit", () => {
  const inputs = createRequiredInputs({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 103, low: 100, close: 101, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 101, high: 105, low: 101, close: 104, source: "test", complete: true }
    ]
  });

  const result = evaluateTargetReach("BULLISH", inputs.sessionCandles, 5, { currentStandardDistance: 5 });
  assert.equal(result.outcome, "HIT");
  assert.equal(result.targetPrice, 105);
});

test("bearish exact-threshold touch is a hit", () => {
  const inputs = createRequiredInputs({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 105, high: 110, low: 109, close: 109.5, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 109, high: 109, low: 105, close: 106, source: "test", complete: true }
    ]
  });

  const result = evaluateTargetReach("BEARISH", inputs.sessionCandles, 5, { currentStandardDistance: 5 });
  assert.equal(result.outcome, "HIT");
  assert.equal(result.targetPrice, 105);
});

test("wrong-side movement with no recovery is a miss", () => {
  const inputs = createRequiredInputs({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 104, low: 101, close: 103, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 103, high: 103.5, low: 98, close: 99, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T11:00:00Z", date: "2024-02-06", open: 99, high: 100, low: 99, close: 99.5, source: "test", complete: true }
    ]
  });

  const result = evaluateTargetReach("BULLISH", inputs.sessionCandles, 5, { currentStandardDistance: 5 });
  assert.equal(result.outcome, "MISS");
});

test("missing candle session is unresolved", () => {
  const inputs = createRequiredInputs({}, "2024-02-06");
  assert.equal(inputs.ok, false);
  assert.equal(inputs.reason, "missing_intraday_session");
});

test("incomplete session is unresolved", () => {
  const inputs = createRequiredInputs({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 103, low: 100, close: 101, source: "test", complete: false }
    ]
  });
  assert.equal(inputs.ok, false);
  assert.equal(inputs.reason, "incomplete_intraday_session");
});

test("same candle can be sequence-ambiguous when optional adverse boundary is supplied", () => {
  const result = evaluateTargetReach("BULLISH", [
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 103, high: 104, low: 100, close: 101, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 101, high: 105, low: 95, close: 100, source: "test", complete: true }
  ], 5, { currentStandardDistance: 5, adverseDistance: 5 });

  assert.equal(result.outcome, "SEQUENCE_AMBIGUOUS");
  assert.equal(result.adverseSequence, "BOTH_REACHED_SAME_CANDLE");
});

test("evaluation boundary uses prior swing so same-candle low then high does not count", () => {
  const result = evaluateTargetReach("BULLISH", [
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 103, high: 105, low: 100, close: 104, source: "test", complete: true }
  ], 5, { currentStandardDistance: 5 });

  assert.equal(result.outcome, "MISS");
});

test("weekend BTC-style session can remain eligible when weekend candles exist", () => {
  const config = createConfig({
    assetCode: "BTC",
    assetLabel: "BTC",
    weekdayKeys: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
  });
  const checker = {
    rows: [createCheckerRow({
      predictionId: "btc-weekend",
      snapshotDate: "2024-02-11",
      closeDate: "2024-02-11",
      direction: "BULLISH",
      confidence: 81
    })]
  };
  const dailyContext = createDailyContext(createDailySeries("2024-01-01", 40, 100, 10, true));
  const intradayContext = createIntradayContext({
    "2024-02-11": [
      { instrument: "TEST", timestamp: "2024-02-11T09:00:00Z", date: "2024-02-11", open: 102, high: 103, low: 100, close: 101, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-11T10:00:00Z", date: "2024-02-11", open: 101, high: 105, low: 101, close: 104, source: "test", complete: true }
    ]
  });
  const rows = buildLayer1Rows(config, checker, { daily: dailyContext, intraday: intradayContext }, null);

  assert.equal(rows[0].status, "ELIGIBLE");
  assert.equal(rows[0].weekdayKey, "SUNDAY");
});

test("row-level half target is exactly half the canonical full target", () => {
  const config = createConfig({ weekdayKeys: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] });
  const checker = {
    rows: [createCheckerRow()]
  };
  const dailyContext = createDailyContext(createDailySeries());
  const intradayContext = createIntradayContext({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 103, low: 100, close: 101, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 101, high: 105, low: 101, close: 104, source: "test", complete: true }
    ]
  });
  const rows = buildLayer1Rows(config, checker, { daily: dailyContext, intraday: intradayContext }, null);

  assert.equal(rows[0].currentStandardL2lDistance, 5);
  assert.equal(rows[0].halfL2lDistance, 2.5);
});

test("new full-target path preserves the existing standard L2L result", () => {
  const inputs = createRequiredInputs({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 103, low: 100, close: 101, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 101, high: 105, low: 101, close: 104, source: "test", complete: true }
    ]
  });

  const legacy = evaluateL2lSequence("BULLISH", { ...inputs, requiredL2lDistance: 5 });
  const current = evaluateTargetReach("BULLISH", inputs.sessionCandles, 5, { currentStandardDistance: 5 });
  assert.equal(current.outcome, legacy.reached ? "HIT" : "MISS");
});

test("wrong-order bullish movement is not counted when the low comes after the high", () => {
  const result = evaluateTargetReach("BULLISH", [
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 100, high: 110, low: 106, close: 109, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 109, high: 109, low: 100, close: 101, source: "test", complete: true }
  ], 5, { currentStandardDistance: 5 });

  assert.equal(result.outcome, "MISS");
});

test("wrong-order bearish movement is not counted when the high comes after the low", () => {
  const result = evaluateTargetReach("BEARISH", [
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 100, high: 94, low: 90, close: 91, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 91, high: 100, low: 95, close: 99, source: "test", complete: true }
  ], 5, { currentStandardDistance: 5 });

  assert.equal(result.outcome, "MISS");
});

test("expanded artifact includes all rows, stable record ids, and deterministic 32-row manual sample", () => {
  const sourceAudit = [
    { assetCode: "EUR", assetLabel: "EUR", instrument: "EUR_USD", candleSourceLabel: "test", dailySourceHash: { sha256: "a" }, intradaySourceHash: { sha256: "b" } },
    { assetCode: "GOLD", assetLabel: "Gold", instrument: "XAU_USD", candleSourceLabel: "test", dailySourceHash: { sha256: "c" }, intradaySourceHash: { sha256: "d" } },
    { assetCode: "NQ", assetLabel: "NQ", instrument: "NAS100_USD", candleSourceLabel: "test", dailySourceHash: { sha256: "e" }, intradaySourceHash: { sha256: "f" } },
    { assetCode: "BTC", assetLabel: "BTC", instrument: "BTCUSDT", candleSourceLabel: "test", dailySourceHash: { sha256: "g" }, intradaySourceHash: { sha256: "h" } }
  ];
  const layer1Rows = [];
  const layer2Rows = [];
  const layer1Entities = ["EUR", "GOLD", "NQ", "BTC"];
  const layer2Entities = ["EUR_USD", "XAU_USD", "NQ_USD", "BTC_USD"];

  layer1Entities.forEach((entityCode, entityIndex) => {
    const directions = ["BULLISH", "BEARISH", "BULLISH", "BEARISH", "BULLISH", "BEARISH", "BULLISH", "BEARISH"];
    const combos = [
      ["MISS", "MISS"],
      ["HIT", "MISS"],
      ["HIT", "HIT"],
      ["HIT", "HIT"],
      ["HIT", "MISS"],
      ["HIT", "HIT"],
      ["MISS", "MISS"],
      ["HIT", "HIT"]
    ];
    combos.forEach(([halfOutcome, fullOutcome], index) => {
      layer1Rows.push(createSyntheticEligibleRow({
        layer: "LAYER_1",
        entityCode,
        entityLabel: entityCode === "GOLD" ? "Gold" : entityCode,
        predictionId: `l1-${entityCode}-${index}`,
        snapshotDate: `2024-0${1 + Math.floor(index / 2)}-${String(10 + index).padStart(2, "0")}`,
        evaluationDate: `2024-0${1 + Math.floor(index / 2)}-${String(10 + index).padStart(2, "0")}`,
        callDirection: directions[index],
        strengthBucket: ["WEAK", "MODERATE", "STRONG", "VERY_STRONG"][index % 4],
        confidencePct: 40 + (index * 7),
        halfOutcome,
        fullOutcome,
        halfTime: 1 + index,
        fullTime: fullOutcome === "HIT" ? 2 + index : null,
        halfMargin: index % 2 === 0 ? 0.05 : 0.2,
        fullMargin: fullOutcome === "HIT" ? 0.1 : -0.1
      }));
    });
  });

  layer2Entities.forEach((entityCode, entityIndex) => {
    const directions = ["BULLISH", "BEARISH", "BULLISH", "BEARISH", "BULLISH", "BEARISH", "BULLISH", "BEARISH"];
    const combos = [
      ["MISS", "MISS"],
      ["HIT", "MISS"],
      ["HIT", "HIT"],
      ["HIT", "HIT"],
      ["HIT", "MISS"],
      ["HIT", "HIT"],
      ["MISS", "MISS"],
      ["HIT", "HIT"]
    ];
    combos.forEach(([halfOutcome, fullOutcome], index) => {
      layer2Rows.push(createSyntheticEligibleRow({
        layer: "LAYER_2",
        entityCode,
        entityLabel: entityCode.replace("_", "/"),
        predictionId: `l2-${entityCode}-${index}`,
        snapshotDate: `2025-0${1 + Math.floor(index / 2)}-${String(10 + index).padStart(2, "0")}`,
        evaluationDate: `2025-0${1 + Math.floor(index / 2)}-${String(10 + index).padStart(2, "0")}`,
        callDirection: directions[index],
        strengthBucket: ["WEAK", "MODERATE", "STRONG", "VERY_STRONG"][index % 4],
        confidencePct: 44 + (index * 6),
        halfOutcome,
        fullOutcome,
        halfTime: 1 + index,
        fullTime: fullOutcome === "HIT" ? 3 + index : null,
        halfMargin: index % 2 === 0 ? 0.03 : 0.15,
        fullMargin: fullOutcome === "HIT" ? 0.1 : -0.1
      }));
    });
  });

  const output = buildOutput(sourceAudit, layer1Rows, layer2Rows);

  assert.equal(output.row_level.layer1.length, 32);
  assert.equal(output.row_level.layer2.length, 32);
  assert.equal(output.row_level.all.length, 64);
  assert.equal(new Set(output.row_level.all.map((row) => row.recordId)).size, 64);
  assert.equal(output.manual_review.sample_rows.length, 32);
  assert.equal(output.manual_review.seed, "half-l2l-manual-sample-20260809-v1");
  assert.equal(output.meta.manual_review_sample_size.layer1, 16);
  assert.equal(output.meta.manual_review_sample_size.layer2, 16);
  assert.equal(output.meta.manual_review_sample_size.total, 32);
  assert.deepEqual(output.meta.manual_review_valid_outcome_combinations, ["HIT/HIT", "HIT/MISS", "MISS/MISS"]);
  assert.deepEqual(output.manual_review.valid_outcome_combinations, ["HIT/HIT", "HIT/MISS", "MISS/MISS"]);
  assert.equal(output.meta.evaluated_date_ranges.layer1.earliest, "2024-01-10");
  assert.equal(output.meta.evaluated_date_ranges.layer2.latest, "2025-04-17");

  const sampleCountsByLayer = output.manual_review.sample_rows.reduce((acc, row) => {
    acc[row.layer] = (acc[row.layer] || 0) + 1;
    return acc;
  }, {});
  assert.equal(sampleCountsByLayer.LAYER_1, 16);
  assert.equal(sampleCountsByLayer.LAYER_2, 16);

  const countsByEntity = output.manual_review.sample_rows.reduce((map, row) => {
    map.set(row.entityCode, (map.get(row.entityCode) || 0) + 1);
    return map;
  }, new Map());
  for (const entityCode of [...layer1Entities, ...layer2Entities]) {
    assert.equal(countsByEntity.get(entityCode), 4);
  }

  assert.deepEqual(
    output.manual_review.groups.map((group) => `${group.layer}:${group.entityCode}`),
    [
      "LAYER_1:EUR",
      "LAYER_1:GOLD",
      "LAYER_1:NQ",
      "LAYER_1:BTC",
      "LAYER_2:EUR_USD",
      "LAYER_2:XAU_USD",
      "LAYER_2:NQ_USD",
      "LAYER_2:BTC_USD"
    ]
  );

  const sampledHalfMisses = output.manual_review.sample_rows.filter((row) => row.outcomes.HALF_OF_STANDARD.outcome === "MISS");
  const sampledHalfHitFullMisses = output.manual_review.sample_rows.filter((row) => row.outcomes.HALF_OF_STANDARD.outcome === "HIT" && row.outcomes.FULL_STANDARD.outcome === "MISS");
  assert.ok(sampledHalfMisses.length >= 8);
  assert.ok(sampledHalfHitFullMisses.length >= 8);

  output.manual_review.sample_rows.forEach((row) => {
    assert.ok(row.recordId);
    assert.ok(row.evaluationStartTime);
    assert.ok(row.evaluationEndTime);
    assert.ok(row.outcomes.HALF_OF_STANDARD.initiatingTime || row.outcomes.HALF_OF_STANDARD.confirmingTime);
    assert.ok(row.outcomes.HALF_OF_STANDARD.confirmingTime || row.outcomes.HALF_OF_STANDARD.initiatingTime);
  });

  const output2 = buildOutput(sourceAudit, layer1Rows, layer2Rows);
  assert.deepEqual(
    output.manual_review.sample_rows.map((row) => row.recordId),
    output2.manual_review.sample_rows.map((row) => row.recordId)
  );

  const eurIds = output.manual_review.sample_rows
    .filter((row) => row.layer === "LAYER_1" && row.entityCode === "EUR")
    .map((row) => row.recordId);
  assert.deepEqual(eurIds, [
    "layer_1-eur-e1667f5ff4a3",
    "layer_1-eur-9587997c8b11",
    "layer_1-eur-1235f421de7c",
    "layer_1-eur-427c4e3b2854"
  ]);
});
