const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function getSupabaseEnv(repoRoot) {
  const apiKeys = JSON.parse(
    childProcess.execFileSync(
      "supabase",
      ["projects", "api-keys", "--project-ref", "eaolqbrlywczinfordvg", "-o", "json"],
      { cwd: repoRoot }
    ).toString()
  );

  const serviceRole = apiKeys.find((key) => key.name === "service_role")?.api_key;
  assert.ok(serviceRole, "Expected Supabase CLI to return a service_role key");

  return {
    SUPABASE_URL: "https://eaolqbrlywczinfordvg.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: serviceRole
  };
}

function getCliEnv(repoRoot, env) {
  const tempHome = path.join(repoRoot, ".tmp-supabase-home");
  fs.mkdirSync(tempHome, { recursive: true });
  return {
    ...env,
    HOME: tempHome,
    USERPROFILE: tempHome
  };
}

function runNodeScript(repoRoot, env, scriptPath, args = []) {
  return childProcess.execFileSync(
    process.execPath,
    [scriptPath, ...args],
    { cwd: repoRoot, env }
  ).toString();
}

function runInlineNode(repoRoot, env, source) {
  return childProcess.execFileSync(
    process.execPath,
    ["-e", source],
    { cwd: repoRoot, env }
  ).toString();
}

function runSupabaseQuery(repoRoot, env, args) {
  return childProcess.execFileSync(
    "supabase",
    ["db", "query", "--linked", ...args],
    { cwd: repoRoot, env: getCliEnv(repoRoot, env) }
  ).toString();
}

test("Evaluation runner and research SQL layer work end-to-end for January 2024", { timeout: 240000 }, () => {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const env = {
    ...process.env,
    ...getSupabaseEnv(repoRoot)
  };

  const buildOutput = runNodeScript(
    repoRoot,
    env,
    path.join(repoRoot, "backtester", "builders", "usd", "build_usd_historical_snapshots.js"),
    ["--start=2024-01-01", "--end=2024-01-31"]
  );
  const buildSummary = JSON.parse(buildOutput);
  assert.ok(buildSummary.submitted_rows >= 22, "Expected snapshot rebuild to submit January rows");

  const replayOutput = runNodeScript(
    repoRoot,
    env,
    path.join(repoRoot, "backtester", "replay", "usd", "run_usd_historical_replay.js"),
    ["--start=2024-01-01", "--end=2024-01-31"]
  );
  const replaySummary = JSON.parse(replayOutput);
  assert.equal(replaySummary.observations_processed, 22);
  assert.equal(replaySummary.predictions_written, 88);
  assert.equal(replaySummary.factor_rows_written, 880);

  const evaluationScriptPath = path.join(repoRoot, "backtester", "scripts", "run_prediction_outcome_evaluations.js");
  const firstEvaluationOutput = runNodeScript(
    repoRoot,
    env,
    evaluationScriptPath,
    ["--start=2018-01-01", "--end=2024-12-31"]
  );
  const firstEvaluationSummary = JSON.parse(firstEvaluationOutput);

  assert.equal(firstEvaluationSummary.predictions_processed, 88);
  assert.equal(firstEvaluationSummary.evaluation_rows_written, 440);
  assert.equal(firstEvaluationSummary.realised_outcome_rows_written, 88);
  assert.equal(firstEvaluationSummary.result_counts.CORRECT, 72);
  assert.equal(firstEvaluationSummary.result_counts.WRONG, 79);
  assert.equal(firstEvaluationSummary.result_counts.FLAT, 74);
  assert.equal(firstEvaluationSummary.result_counts.NOT_EVALUABLE, 215);

  const secondEvaluationOutput = runNodeScript(
    repoRoot,
    env,
    evaluationScriptPath,
    ["--start=2018-01-01", "--end=2024-12-31"]
  );
  const secondEvaluationSummary = JSON.parse(secondEvaluationOutput);
  assert.equal(secondEvaluationSummary.evaluation_rows_written, 440);
  assert.equal(secondEvaluationSummary.realised_outcome_rows_written, 88);

  const countScript = `
    const { fetchAllRows } = require("./backtester/lib/historical_common");
    function round(value, decimals) {
      return Number(Number(value).toFixed(decimals));
    }
    (async () => {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const [predictions, evaluations, realised, factorObservations] = await Promise.all([
        fetchAllRows(supabaseUrl, serviceRoleKey, "research_timeframe_predictions", (url) => {
          url.searchParams.set("select", "id,observation_id,timeframe,predicted_conviction,verdict_strength");
        }),
        fetchAllRows(supabaseUrl, serviceRoleKey, "research_prediction_evaluations", (url) => {
          url.searchParams.set("select", "prediction_id,evaluation_mode,evaluated_market,timeframe,predicted_direction:agent_direction,result,move_magnitude_bucket,abs_pct_change,agent_conviction,evaluation_version");
          url.searchParams.set("evaluation_version", "eq.phase1_outcome_eval_v1");
        }),
        fetchAllRows(supabaseUrl, serviceRoleKey, "research_realised_outcomes", (url) => {
          url.searchParams.set("select", "timeframe_prediction_id");
        }),
        fetchAllRows(supabaseUrl, serviceRoleKey, "research_factor_observations", (url) => {
          url.searchParams.set("select", "timeframe_prediction_id,timeframe,factor_key,factor_name,factor_signal,factor_weight");
        })
      ]);

      const januaryObservationIds = new Set(
        (await fetchAllRows(supabaseUrl, serviceRoleKey, "research_observations", (url) => {
          url.searchParams.set("select", "id,snapshot_date,source_workflow,agent_name");
          url.searchParams.set("snapshot_date", "gte.2024-01-01");
          url.searchParams.append("snapshot_date", "lte.2024-01-31");
          url.searchParams.set("agent_name", "eq.USD");
          url.searchParams.set("source_workflow", "eq.usd_historical_replay");
        })).map((row) => row.id)
      );

      const januaryPredictionRows = predictions.filter((row) => januaryObservationIds.has(row.observation_id));
      const januaryPredictionIds = new Set(januaryPredictionRows.map((row) => row.id));
      const predictionById = new Map(januaryPredictionRows.map((row) => [row.id, row]));

      const januaryEvaluations = evaluations.filter((row) => januaryPredictionIds.has(row.prediction_id));
      const januaryRealised = realised.filter((row) => januaryPredictionIds.has(row.timeframe_prediction_id));
      const januaryFactorObservations = factorObservations.filter((row) => januaryPredictionIds.has(row.timeframe_prediction_id));

      const primaryByPrediction = new Map();
      for (const row of januaryEvaluations.filter((r) => r.evaluation_mode === "primary")) {
        const bucket = primaryByPrediction.get(row.prediction_id) || [];
        bucket.push(row.result);
        primaryByPrediction.set(row.prediction_id, bucket);
      }

      const combined = { CORRECT: 0, WRONG: 0, FLAT: 0, MIXED: 0, NO_CALL: 0, NOT_EVALUABLE: 0 };
      for (const results of primaryByPrediction.values()) {
        const unique = [...new Set(results)];
        let label = "MIXED";
        if (unique.length === 1) {
          label = unique[0];
        } else if (unique.includes("CORRECT") && unique.includes("WRONG")) {
          label = "MIXED";
        } else {
          label = "MIXED";
        }
        combined[label] += 1;
      }

      const dxyRows = januaryEvaluations.filter((row) =>
        row.evaluation_mode === "primary" &&
        row.evaluated_market === "DXY"
      );

      const dxySummary = {
        evaluated_predictions: 0,
        wins: 0,
        losses: 0,
        flats: 0,
        mixed: 0,
        not_evaluable: 0,
        no_call: 0
      };
      for (const row of dxyRows) {
        if (row.result === "CORRECT") dxySummary.wins += 1;
        if (row.result === "WRONG") dxySummary.losses += 1;
        if (row.result === "FLAT") dxySummary.flats += 1;
        if (row.result === "MIXED") dxySummary.mixed += 1;
        if (row.result === "NOT_EVALUABLE") dxySummary.not_evaluable += 1;
        if (row.result === "NO_CALL") dxySummary.no_call += 1;
      }
      dxySummary.evaluated_predictions = dxySummary.wins + dxySummary.losses + dxySummary.flats;
      dxySummary.win_rate_pct = dxySummary.evaluated_predictions
        ? round((100 * dxySummary.wins) / dxySummary.evaluated_predictions, 2)
        : null;

      const dxy24hRows = dxyRows.filter((row) => row.timeframe === "following 24hrs");
      const dxy24hEvaluated = dxy24hRows.filter((row) => ["CORRECT", "WRONG", "FLAT"].includes(row.result));
      const bullishDirectional24h = dxy24hEvaluated.filter((row) => row.predicted_direction === "BULLISH" && ["CORRECT", "WRONG"].includes(row.result));
      const bearishDirectional24h = dxy24hEvaluated.filter((row) => row.predicted_direction === "BEARISH" && ["CORRECT", "WRONG"].includes(row.result));
      const dxy24hSummary = {
        evaluated_calls: dxy24hEvaluated.length,
        wins: dxy24hEvaluated.filter((row) => row.result === "CORRECT").length,
        losses: dxy24hEvaluated.filter((row) => row.result === "WRONG").length,
        flats: dxy24hEvaluated.filter((row) => row.result === "FLAT").length,
        not_evaluable: dxy24hRows.filter((row) => row.result === "NOT_EVALUABLE").length,
        bullish_calls: dxy24hEvaluated.filter((row) => row.predicted_direction === "BULLISH").length,
        bearish_calls: dxy24hEvaluated.filter((row) => row.predicted_direction === "BEARISH").length,
        bullish_wins: dxy24hEvaluated.filter((row) => row.predicted_direction === "BULLISH" && row.result === "CORRECT").length,
        bullish_losses: dxy24hEvaluated.filter((row) => row.predicted_direction === "BULLISH" && row.result === "WRONG").length,
        bullish_flats: dxy24hEvaluated.filter((row) => row.predicted_direction === "BULLISH" && row.result === "FLAT").length,
        bearish_wins: dxy24hEvaluated.filter((row) => row.predicted_direction === "BEARISH" && row.result === "CORRECT").length,
        bearish_losses: dxy24hEvaluated.filter((row) => row.predicted_direction === "BEARISH" && row.result === "WRONG").length,
        bearish_flats: dxy24hEvaluated.filter((row) => row.predicted_direction === "BEARISH" && row.result === "FLAT").length,
        overall_accuracy_pct: dxy24hEvaluated.length ? round((100 * dxy24hEvaluated.filter((row) => row.result === "CORRECT").length) / dxy24hEvaluated.length, 2) : null,
        bullish_call_accuracy_pct: bullishDirectional24h.length ? round((100 * bullishDirectional24h.filter((row) => row.result === "CORRECT").length) / bullishDirectional24h.length, 2) : null,
        bearish_call_accuracy_pct: bearishDirectional24h.length ? round((100 * bearishDirectional24h.filter((row) => row.result === "CORRECT").length) / bearishDirectional24h.length, 2) : null,
        flat_no_move_accuracy_pct: dxy24hEvaluated.length ? round((100 * dxy24hEvaluated.filter((row) => row.result === "FLAT").length) / dxy24hEvaluated.length, 2) : null
      };

      const magnitudeBuckets = new Map();
      for (const row of dxyRows.filter((entry) => ["CORRECT", "WRONG", "FLAT"].includes(entry.result))) {
        const key = row.move_magnitude_bucket || "UNKNOWN";
        const bucket = magnitudeBuckets.get(key) || {
          move_magnitude_bucket: key,
          evaluated_predictions: 0,
          wins: 0,
          losses: 0,
          flats: 0,
          mixed: 0,
          abs_moves: []
        };
        bucket.evaluated_predictions += 1;
        if (row.result === "CORRECT") bucket.wins += 1;
        if (row.result === "WRONG") bucket.losses += 1;
        if (row.result === "FLAT") bucket.flats += 1;
        if (row.abs_pct_change !== null && row.abs_pct_change !== undefined) {
          bucket.abs_moves.push(Number(row.abs_pct_change));
        }
        magnitudeBuckets.set(key, bucket);
      }

      const magnitudeSummary = Array.from(magnitudeBuckets.values()).map((bucket) => ({
        move_magnitude_bucket: bucket.move_magnitude_bucket,
        evaluated_predictions: bucket.evaluated_predictions,
        wins: bucket.wins,
        losses: bucket.losses,
        flats: bucket.flats,
        mixed: 0,
        avg_abs_move_pct: bucket.abs_moves.length
          ? round(bucket.abs_moves.reduce((sum, value) => sum + value, 0) / bucket.abs_moves.length, 4)
          : null,
        win_rate_pct: bucket.evaluated_predictions
          ? round((100 * bucket.wins) / bucket.evaluated_predictions, 2)
          : null
      }));

      const strengthBuckets = new Map();
      for (const row of dxyRows) {
        const prediction = predictionById.get(row.prediction_id);
        const key = [row.timeframe, prediction?.verdict_strength || "UNKNOWN"].join("|");
        const bucket = strengthBuckets.get(key) || {
          timeframe: row.timeframe,
          verdict_strength: prediction?.verdict_strength || "UNKNOWN",
          evaluated_calls: 0,
          wins: 0,
          losses: 0,
          flats: 0,
          not_evaluable: 0,
          confidences: [],
          absMoves: []
        };
        if (["CORRECT", "WRONG", "FLAT"].includes(row.result)) {
          bucket.evaluated_calls += 1;
          if (row.result === "CORRECT") bucket.wins += 1;
          if (row.result === "WRONG") bucket.losses += 1;
          if (row.result === "FLAT") bucket.flats += 1;
          const confidence = row.agent_conviction ?? prediction?.predicted_conviction;
          if (confidence !== null && confidence !== undefined) bucket.confidences.push(Number(confidence));
          if (row.abs_pct_change !== null && row.abs_pct_change !== undefined) bucket.absMoves.push(Number(row.abs_pct_change));
        }
        if (row.result === "NOT_EVALUABLE") bucket.not_evaluable += 1;
        strengthBuckets.set(key, bucket);
      }

      const strengthSummary = Array.from(strengthBuckets.values()).map((bucket) => ({
        key: [bucket.timeframe, bucket.verdict_strength].join("|"),
        timeframe: bucket.timeframe,
        verdict_strength: bucket.verdict_strength,
        evaluated_calls: bucket.evaluated_calls,
        wins: bucket.wins,
        losses: bucket.losses,
        flats: bucket.flats,
        not_evaluable: bucket.not_evaluable,
        win_rate_pct: bucket.evaluated_calls ? round((100 * bucket.wins) / bucket.evaluated_calls, 2) : null,
        flat_no_move_pct: bucket.evaluated_calls ? round((100 * bucket.flats) / bucket.evaluated_calls, 2) : null,
        avg_predicted_confidence: bucket.confidences.length
          ? round(bucket.confidences.reduce((sum, value) => sum + value, 0) / bucket.confidences.length, 2)
          : null,
        avg_abs_move_pct: bucket.absMoves.length
          ? round(bucket.absMoves.reduce((sum, value) => sum + value, 0) / bucket.absMoves.length, 4)
          : null
      }));

      function confidenceBucketLabel(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return "UNKNOWN";
        const n = Number(value);
        if (n < 50) return "<50";
        if (n < 55) return "50-54";
        if (n < 60) return "55-59";
        if (n < 65) return "60-64";
        if (n < 70) return "65-69";
        if (n < 75) return "70-74";
        if (n < 80) return "75-79";
        if (n < 85) return "80-84";
        if (n < 90) return "85-89";
        if (n < 95) return "90-94";
        return "95-100";
      }

      const confidenceBuckets = new Map();
      for (const row of dxyRows) {
        const prediction = predictionById.get(row.prediction_id);
        const confidence = row.agent_conviction ?? prediction?.predicted_conviction;
        const bucketLabel = confidenceBucketLabel(confidence);
        const key = [row.timeframe, bucketLabel].join("|");
        const bucket = confidenceBuckets.get(key) || {
          timeframe: row.timeframe,
          confidence_bucket: bucketLabel,
          evaluated_calls: 0,
          wins: 0,
          losses: 0,
          flats: 0,
          not_evaluable: 0,
          confidences: [],
          absMoves: []
        };
        if (["CORRECT", "WRONG", "FLAT"].includes(row.result)) {
          bucket.evaluated_calls += 1;
          if (row.result === "CORRECT") bucket.wins += 1;
          if (row.result === "WRONG") bucket.losses += 1;
          if (row.result === "FLAT") bucket.flats += 1;
          if (confidence !== null && confidence !== undefined) bucket.confidences.push(Number(confidence));
          if (row.abs_pct_change !== null && row.abs_pct_change !== undefined) bucket.absMoves.push(Number(row.abs_pct_change));
        }
        if (row.result === "NOT_EVALUABLE") bucket.not_evaluable += 1;
        confidenceBuckets.set(key, bucket);
      }

      const confidenceSummary = Array.from(confidenceBuckets.values()).map((bucket) => {
        const rawAvgPredictedConfidence = bucket.confidences.length
          ? bucket.confidences.reduce((sum, value) => sum + value, 0) / bucket.confidences.length
          : null;
        const avgPredictedConfidence = bucket.confidences.length
          ? round(rawAvgPredictedConfidence, 2)
          : null;
        const rawActualWinRate = bucket.evaluated_calls ? (100 * bucket.wins) / bucket.evaluated_calls : null;
        const actualWinRate = bucket.evaluated_calls ? round(rawActualWinRate, 2) : null;
        return {
          key: [bucket.timeframe, bucket.confidence_bucket].join("|"),
          timeframe: bucket.timeframe,
          confidence_bucket: bucket.confidence_bucket,
          evaluated_calls: bucket.evaluated_calls,
          wins: bucket.wins,
          losses: bucket.losses,
          flats: bucket.flats,
          not_evaluable: bucket.not_evaluable,
          win_rate_pct: actualWinRate,
          flat_no_move_pct: bucket.evaluated_calls ? round((100 * bucket.flats) / bucket.evaluated_calls, 2) : null,
          avg_predicted_confidence: avgPredictedConfidence,
          avg_abs_move_pct: bucket.absMoves.length
            ? round(bucket.absMoves.reduce((sum, value) => sum + value, 0) / bucket.absMoves.length, 4)
            : null,
          actual_win_rate_pct: actualWinRate,
          calibration_gap_pct: rawAvgPredictedConfidence === null || rawActualWinRate === null
            ? null
            : round(rawActualWinRate - rawAvgPredictedConfidence, 2)
        };
      });

      function strengthBucketRank(value) {
        switch (value || "UNKNOWN") {
          case "VERY_STRONG": return 1;
          case "STRONG": return 2;
          case "MODERATE": return 3;
          case "WEAK": return 4;
          case "NO_CALL": return 5;
          case "MARKET_CLOSED": return 6;
          default: return 7;
        }
      }

      const tradeQualityThresholds = [
        { label: "All Calls", rank: 1, predicate: () => true },
        { label: "Confidence >= 60", rank: 2, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 60 },
        { label: "Confidence >= 70", rank: 3, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 70 },
        { label: "Confidence >= 75", rank: 4, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 75 },
        { label: "Confidence >= 80", rank: 5, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 80 },
        { label: "Confidence >= 85", rank: 6, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 85 },
        { label: "Confidence >= 90", rank: 7, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 90 },
        { label: "Strength >= MODERATE", rank: 8, predicate: (row, prediction) => strengthBucketRank(prediction?.verdict_strength) <= 3 },
        { label: "Strength >= STRONG", rank: 9, predicate: (row, prediction) => strengthBucketRank(prediction?.verdict_strength) <= 2 },
        { label: "Strength = VERY_STRONG", rank: 10, predicate: (row, prediction) => strengthBucketRank(prediction?.verdict_strength) === 1 },
        { label: "Confidence >= 75 AND Strength >= STRONG", rank: 11, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 75 && strengthBucketRank(prediction?.verdict_strength) <= 2 },
        { label: "Confidence >= 80 AND Strength >= STRONG", rank: 12, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 80 && strengthBucketRank(prediction?.verdict_strength) <= 2 },
        { label: "Confidence >= 85 AND Strength = VERY_STRONG", rank: 13, predicate: (row, prediction, confidence) => confidence !== null && confidence !== undefined && Number(confidence) >= 85 && strengthBucketRank(prediction?.verdict_strength) === 1 }
      ];

      const totalPredictionsByTimeframe = new Map();
      for (const row of dxyRows) {
        totalPredictionsByTimeframe.set(
          row.timeframe,
          (totalPredictionsByTimeframe.get(row.timeframe) || 0) + 1
        );
      }

      const tradeQualitySummary = [];
      for (const timeframe of Array.from(totalPredictionsByTimeframe.keys())) {
        const timeframeRows = dxyRows.filter((row) => row.timeframe === timeframe);
        const totalAvailablePredictions = totalPredictionsByTimeframe.get(timeframe) || 0;

        for (const threshold of tradeQualityThresholds) {
          const matchingRows = timeframeRows.filter((row) => {
            const prediction = predictionById.get(row.prediction_id);
            const confidence = row.agent_conviction ?? prediction?.predicted_conviction;
            return threshold.predicate(row, prediction, confidence);
          });
          const evaluatedRows = matchingRows.filter((row) => ["CORRECT", "WRONG", "FLAT"].includes(row.result));
          const wins = evaluatedRows.filter((row) => row.result === "CORRECT").length;
          const losses = evaluatedRows.filter((row) => row.result === "WRONG").length;
          const flats = evaluatedRows.filter((row) => row.result === "FLAT").length;
          const confidences = evaluatedRows
            .map((row) => {
              const prediction = predictionById.get(row.prediction_id);
              return row.agent_conviction ?? prediction?.predicted_conviction;
            })
            .filter((value) => value !== null && value !== undefined)
            .map((value) => Number(value));
          const absMoves = evaluatedRows
            .map((row) => row.abs_pct_change)
            .filter((value) => value !== null && value !== undefined)
            .map((value) => Number(value));
          const rawAvgPredictedConfidence = confidences.length
            ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
            : null;
          const rawActualWinRate = evaluatedRows.length
            ? (100 * wins) / evaluatedRows.length
            : null;

          tradeQualitySummary.push({
            key: [timeframe, threshold.label].join("|"),
            timeframe,
            threshold_label: threshold.label,
            threshold_rank: threshold.rank,
            total_available_predictions: totalAvailablePredictions,
            tradeable_predictions: matchingRows.length,
            coverage_pct: totalAvailablePredictions
              ? round((100 * matchingRows.length) / totalAvailablePredictions, 2)
              : null,
            evaluated_calls: evaluatedRows.length,
            wins,
            losses,
            flats,
            win_rate_pct: evaluatedRows.length ? round((100 * wins) / evaluatedRows.length, 2) : null,
            flat_no_move_pct: evaluatedRows.length ? round((100 * flats) / evaluatedRows.length, 2) : null,
            avg_predicted_confidence: rawAvgPredictedConfidence === null ? null : round(rawAvgPredictedConfidence, 2),
            avg_abs_move_pct: absMoves.length
              ? round(absMoves.reduce((sum, value) => sum + value, 0) / absMoves.length, 4)
              : null,
            calibration_gap_pct: rawAvgPredictedConfidence === null || rawActualWinRate === null
              ? null
              : round(rawActualWinRate - rawAvgPredictedConfidence, 2)
          });
        }
      }

      const benchmarkByPrediction = new Map(
        dxyRows.map((row) => [row.prediction_id, row.result])
      );

      const factorReliability = new Map();
      const factorContribution = new Map();
      for (const row of januaryFactorObservations.filter((entry) => entry.factor_signal === "BULLISH" || entry.factor_signal === "BEARISH")) {
        const benchmarkResult = benchmarkByPrediction.get(row.timeframe_prediction_id);
        if (!["CORRECT", "WRONG", "FLAT"].includes(benchmarkResult)) continue;

        const key = [row.factor_key, row.factor_name || "", row.timeframe, row.factor_signal].join("|");

        const reliabilityBucket = factorReliability.get(key) || {
          factor_key: row.factor_key,
          factor_name: row.factor_name || null,
          timeframe: row.timeframe,
          factor_signal: row.factor_signal,
          factor_occurrences: 0,
          wins: 0,
          losses: 0,
          flats: 0,
          mixed: 0,
          factorWeights: []
        };
        reliabilityBucket.factor_occurrences += 1;
        if (benchmarkResult === "CORRECT") reliabilityBucket.wins += 1;
        if (benchmarkResult === "WRONG") reliabilityBucket.losses += 1;
        if (benchmarkResult === "FLAT") reliabilityBucket.flats += 1;
        if (row.factor_weight !== null && row.factor_weight !== undefined) {
          reliabilityBucket.factorWeights.push(Number(row.factor_weight));
        }
        factorReliability.set(key, reliabilityBucket);

        const contributionBucket = factorContribution.get(key) || {
          factor_key: row.factor_key,
          factor_name: row.factor_name || null,
          timeframe: row.timeframe,
          factor_signal: row.factor_signal,
          factor_occurrences: 0,
          contributionScores: [],
          weightedScores: []
        };
        contributionBucket.factor_occurrences += 1;
        const weight = row.factor_weight === null || row.factor_weight === undefined ? 0 : Number(row.factor_weight);
        contributionBucket.contributionScores.push(
          benchmarkResult === "CORRECT" ? 1 : benchmarkResult === "WRONG" ? -1 : 0
        );
        contributionBucket.weightedScores.push(
          benchmarkResult === "CORRECT" ? weight : benchmarkResult === "WRONG" ? -weight : 0
        );
        factorContribution.set(key, contributionBucket);
      }

      const factorReliabilitySummary = Array.from(factorReliability.entries()).map(([key, bucket]) => ({
        key,
        factor_occurrences: bucket.factor_occurrences,
        wins: bucket.wins,
        losses: bucket.losses,
        flats: bucket.flats,
        mixed: 0,
        avg_factor_weight: bucket.factorWeights.length
          ? round(bucket.factorWeights.reduce((sum, value) => sum + value, 0) / bucket.factorWeights.length, 2)
          : null,
        win_rate_pct: bucket.factor_occurrences
          ? round((100 * bucket.wins) / bucket.factor_occurrences, 2)
          : null
      }));

      const factorContributionSummary = Array.from(factorContribution.entries()).map(([key, bucket]) => ({
        key,
        factor_occurrences: bucket.factor_occurrences,
        contribution_score: bucket.contributionScores.length
          ? round(bucket.contributionScores.reduce((sum, value) => sum + value, 0) / bucket.contributionScores.length, 4)
          : null,
        weighted_contribution_score: bucket.weightedScores.length
          ? round(bucket.weightedScores.reduce((sum, value) => sum + value, 0) / bucket.weightedScores.length, 4)
          : null
      }));

      console.log(JSON.stringify({
        predictions: januaryPredictionIds.size,
        evaluation_rows: januaryEvaluations.length,
        realised_outcomes: januaryRealised.length,
        combined,
        dxy: dxySummary,
        dxy_24h: dxy24hSummary,
        strength_summary: strengthSummary,
        confidence_summary: confidenceSummary,
        trade_quality_summary: tradeQualitySummary,
        magnitude: magnitudeSummary,
        factor_reliability: factorReliabilitySummary,
        factor_contribution: factorContributionSummary
      }));
    })().catch((error) => {
      console.error(error.stack || error.message || String(error));
      process.exit(1);
    });
  `;

  const counts = JSON.parse(runInlineNode(repoRoot, env, countScript));
  assert.equal(counts.predictions, 88);
  assert.equal(counts.evaluation_rows, 440);
  assert.equal(counts.realised_outcomes, 88);
  assert.equal(counts.combined.MIXED, 75);
  assert.equal(counts.combined.NOT_EVALUABLE, 13);
  assert.ok(counts.dxy.evaluated_predictions > 0);
  assert.ok(counts.dxy.wins + counts.dxy.losses + counts.dxy.flats === counts.dxy.evaluated_predictions);
  assert.equal(counts.dxy.mixed, 0);
  assert.equal(counts.combined.NO_CALL, 0);

  runSupabaseQuery(
    repoRoot,
    env,
    ["-f", path.join(repoRoot, "backtester", "sql", "006_research_query_layer.sql")]
  );
  runSupabaseQuery(
    repoRoot,
    env,
    ["select pg_notify('pgrst', 'reload schema');"]
  );

  const viewsScript = `
    const { fetchAllRows } = require("./backtester/lib/historical_common");
    (async () => {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const viewNames = [
        "research_overall_win_rate",
        "research_usd_24h_direction_accuracy",
        "research_accuracy_by_verdict_strength",
        "research_accuracy_by_confidence_bucket",
        "research_trade_quality_thresholds",
        "research_win_rate_by_timeframe",
        "research_win_rate_by_conviction_bucket",
        "research_win_rate_by_weekday",
        "research_win_rate_by_magnitude_bucket",
        "research_win_rate_by_market_regime",
        "research_factor_reliability",
        "research_factor_contribution",
        "research_best_factor_combinations"
      ];

      const counts = {};
      for (const viewName of viewNames) {
        const rows = await fetchAllRows(supabaseUrl, serviceRoleKey, viewName, (url) => {
          url.searchParams.set("select", "*");
        });
        counts[viewName] = rows.length;
      }

      const overall = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_overall_win_rate", (url) => {
        url.searchParams.set("select", "*");
      });
      const summary24h = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_usd_24h_direction_accuracy", (url) => {
        url.searchParams.set("select", "*");
      });
      const verdictStrength = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_accuracy_by_verdict_strength", (url) => {
        url.searchParams.set("select", "*");
      });
      const confidenceCalibration = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_accuracy_by_confidence_bucket", (url) => {
        url.searchParams.set("select", "*");
      });
      const tradeQuality = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_trade_quality_thresholds", (url) => {
        url.searchParams.set("select", "*");
      });
      const magnitude = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_win_rate_by_magnitude_bucket", (url) => {
        url.searchParams.set("select", "*");
      });
      const factorReliability = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_factor_reliability", (url) => {
        url.searchParams.set("select", "*");
      });
      const factorContribution = await fetchAllRows(supabaseUrl, serviceRoleKey, "research_factor_contribution", (url) => {
        url.searchParams.set("select", "*");
      });

      console.log(JSON.stringify({
        counts,
        overall: overall[0] || null,
        summary24h: summary24h[0] || null,
        verdictStrength,
        confidenceCalibration,
        tradeQuality,
        magnitude,
        factorReliability,
        factorContribution
      }));
    })().catch((error) => {
      console.error(error.stack || error.message || String(error));
      process.exit(1);
    });
  `;

  const views = JSON.parse(runInlineNode(repoRoot, env, viewsScript));
  assert.ok(views.counts.research_overall_win_rate > 0);
  assert.ok(views.counts.research_usd_24h_direction_accuracy > 0);
  assert.ok(views.counts.research_accuracy_by_verdict_strength > 0);
  assert.ok(views.counts.research_accuracy_by_confidence_bucket > 0);
  assert.ok(views.counts.research_trade_quality_thresholds > 0);
  assert.ok(views.counts.research_win_rate_by_timeframe > 0);
  assert.ok(views.counts.research_win_rate_by_conviction_bucket > 0);
  assert.ok(views.counts.research_win_rate_by_weekday > 0);
  assert.ok(views.counts.research_win_rate_by_magnitude_bucket > 0);
  assert.ok(views.counts.research_win_rate_by_market_regime > 0);
  assert.ok(views.counts.research_factor_reliability > 0);
  assert.ok(views.counts.research_factor_contribution > 0);
  assert.ok(views.counts.research_best_factor_combinations > 0);
  assert.equal(views.overall.evaluated_predictions, counts.dxy.evaluated_predictions);
  assert.equal(views.overall.wins, counts.dxy.wins);
  assert.equal(views.overall.losses, counts.dxy.losses);
  assert.equal(views.overall.flats, counts.dxy.flats);
  assert.equal(views.overall.mixed, 0);
  assert.equal(Number(views.overall.win_rate_pct), counts.dxy.win_rate_pct);
  assert.notEqual(views.overall.wins + views.overall.losses + views.overall.flats, 0);
  assert.equal(views.summary24h.benchmark_market, "DXY");
  assert.equal(views.summary24h.evaluated_calls, counts.dxy_24h.evaluated_calls);
  assert.equal(views.summary24h.wins, counts.dxy_24h.wins);
  assert.equal(views.summary24h.losses, counts.dxy_24h.losses);
  assert.equal(views.summary24h.flats, counts.dxy_24h.flats);
  assert.equal(views.summary24h.not_evaluable, counts.dxy_24h.not_evaluable);
  assert.equal(views.summary24h.bullish_calls, counts.dxy_24h.bullish_calls);
  assert.equal(views.summary24h.bearish_calls, counts.dxy_24h.bearish_calls);
  assert.equal(views.summary24h.bullish_wins, counts.dxy_24h.bullish_wins);
  assert.equal(views.summary24h.bearish_wins, counts.dxy_24h.bearish_wins);
  assert.equal(Number(views.summary24h.overall_accuracy_pct), counts.dxy_24h.overall_accuracy_pct);
  assert.equal(Number(views.summary24h.bullish_call_accuracy_pct), counts.dxy_24h.bullish_call_accuracy_pct);
  assert.equal(Number(views.summary24h.bearish_call_accuracy_pct), counts.dxy_24h.bearish_call_accuracy_pct);
  assert.equal(Number(views.summary24h.flat_no_move_accuracy_pct), counts.dxy_24h.flat_no_move_accuracy_pct);

  const numericOrNull = (value) => value === null ? null : Number(value);

  const strengthByKey = new Map(counts.strength_summary.map((row) => [row.key, row]));
  for (const row of views.verdictStrength) {
    const key = [row.timeframe, row.verdict_strength].join("|");
    const expected = strengthByKey.get(key);
    assert.ok(expected, `Expected verdict strength row ${key}`);
    assert.equal(row.evaluated_calls, expected.evaluated_calls);
    assert.equal(row.wins, expected.wins);
    assert.equal(row.losses, expected.losses);
    assert.equal(row.flats, expected.flats);
    assert.equal(row.not_evaluable, expected.not_evaluable);
    assert.equal(numericOrNull(row.win_rate_pct), expected.win_rate_pct);
    assert.equal(numericOrNull(row.flat_no_move_pct), expected.flat_no_move_pct);
    assert.equal(numericOrNull(row.avg_predicted_confidence), expected.avg_predicted_confidence);
    assert.equal(numericOrNull(row.avg_abs_move_pct), expected.avg_abs_move_pct);
  }

  const confidenceByKey = new Map(counts.confidence_summary.map((row) => [row.key, row]));
  for (const row of views.confidenceCalibration) {
    const key = [row.timeframe, row.confidence_bucket].join("|");
    const expected = confidenceByKey.get(key);
    assert.ok(expected, `Expected confidence bucket row ${key}`);
    assert.equal(row.evaluated_calls, expected.evaluated_calls);
    assert.equal(row.wins, expected.wins);
    assert.equal(row.losses, expected.losses);
    assert.equal(row.flats, expected.flats);
    assert.equal(row.not_evaluable, expected.not_evaluable);
    assert.equal(numericOrNull(row.win_rate_pct), expected.win_rate_pct);
    assert.equal(numericOrNull(row.flat_no_move_pct), expected.flat_no_move_pct);
    assert.equal(numericOrNull(row.avg_predicted_confidence), expected.avg_predicted_confidence);
    assert.equal(numericOrNull(row.avg_abs_move_pct), expected.avg_abs_move_pct);
    assert.equal(numericOrNull(row.actual_win_rate_pct), expected.actual_win_rate_pct);
    assert.equal(numericOrNull(row.calibration_gap_pct), expected.calibration_gap_pct);
  }

  const tradeQualityByKey = new Map(counts.trade_quality_summary.map((row) => [row.key, row]));
  for (const row of views.tradeQuality) {
    const key = [row.timeframe, row.threshold_label].join("|");
    const expected = tradeQualityByKey.get(key);
    assert.ok(expected, `Expected trade quality row ${key}`);
    assert.equal(row.total_available_predictions, expected.total_available_predictions);
    assert.equal(row.tradeable_predictions, expected.tradeable_predictions);
    assert.equal(numericOrNull(row.coverage_pct), expected.coverage_pct);
    assert.equal(row.evaluated_calls, expected.evaluated_calls);
    assert.equal(row.wins, expected.wins);
    assert.equal(row.losses, expected.losses);
    assert.equal(row.flats, expected.flats);
    assert.equal(numericOrNull(row.win_rate_pct), expected.win_rate_pct);
    assert.equal(numericOrNull(row.flat_no_move_pct), expected.flat_no_move_pct);
    assert.equal(numericOrNull(row.avg_predicted_confidence), expected.avg_predicted_confidence);
    assert.equal(numericOrNull(row.avg_abs_move_pct), expected.avg_abs_move_pct);
    assert.equal(numericOrNull(row.calibration_gap_pct), expected.calibration_gap_pct);
  }

  const magnitudeByBucket = new Map(counts.magnitude.map((row) => [row.move_magnitude_bucket, row]));
  for (const row of views.magnitude) {
    const expected = magnitudeByBucket.get(row.move_magnitude_bucket);
    assert.ok(expected, `Expected magnitude bucket ${row.move_magnitude_bucket}`);
    assert.equal(row.evaluated_predictions, expected.evaluated_predictions);
    assert.equal(row.wins, expected.wins);
    assert.equal(row.losses, expected.losses);
    assert.equal(row.flats, expected.flats);
    assert.equal(row.mixed, 0);
    assert.equal(Number(row.avg_abs_move_pct), expected.avg_abs_move_pct);
    assert.equal(Number(row.win_rate_pct), expected.win_rate_pct);
  }

  const reliabilityByKey = new Map(counts.factor_reliability.map((row) => [row.key, row]));
  for (const row of views.factorReliability.slice(0, 5)) {
    const key = [row.factor_key, row.factor_name || "", row.timeframe, row.factor_signal].join("|");
    const expected = reliabilityByKey.get(key);
    assert.ok(expected, `Expected factor reliability row ${key}`);
    assert.equal(row.factor_occurrences, expected.factor_occurrences);
    assert.equal(row.wins, expected.wins);
    assert.equal(row.losses, expected.losses);
    assert.equal(row.flats, expected.flats);
    assert.equal(row.mixed, 0);
    assert.equal(Number(row.avg_factor_weight), expected.avg_factor_weight);
    assert.equal(Number(row.win_rate_pct), expected.win_rate_pct);
  }

  const contributionByKey = new Map(counts.factor_contribution.map((row) => [row.key, row]));
  for (const row of views.factorContribution.slice(0, 5)) {
    const key = [row.factor_key, row.factor_name || "", row.timeframe, row.factor_signal].join("|");
    const expected = contributionByKey.get(key);
    assert.ok(expected, `Expected factor contribution row ${key}`);
    assert.equal(row.factor_occurrences, expected.factor_occurrences);
    assert.equal(Number(row.contribution_score), expected.contribution_score);
    assert.equal(Number(row.weighted_contribution_score), expected.weighted_contribution_score);
  }
});
