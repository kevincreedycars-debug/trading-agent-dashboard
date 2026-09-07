const EXACT_CONFIDENCE_BUCKETS = Object.freeze([
  { key: "0_9", label: "0-9", min: 0, max: 9 },
  { key: "10_19", label: "10-19", min: 10, max: 19 },
  { key: "20_29", label: "20-29", min: 20, max: 29 },
  { key: "30_39", label: "30-39", min: 30, max: 39 },
  { key: "40_49", label: "40-49", min: 40, max: 49 },
  { key: "50_59", label: "50-59", min: 50, max: 59 },
  { key: "60_69", label: "60-69", min: 60, max: 69 },
  { key: "70_79", label: "70-79", min: 70, max: 79 },
  { key: "80_89", label: "80-89", min: 80, max: 89 },
  { key: "90_100", label: "90-100", min: 90, max: 100 }
]);

const TARGET_MODES = Object.freeze([
  {
    key: "FULL_STANDARD",
    label: "100% of current standard",
    shortLabel: "100%",
    multiplier: 1
  },
  {
    key: "HALF_OF_STANDARD",
    label: "50% of current standard",
    shortLabel: "50%",
    multiplier: 0.5
  }
]);

function roundNumber(value, decimals = 8) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function confidenceBucketFromPct(confidencePct) {
  const numeric = Number(confidencePct);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  return EXACT_CONFIDENCE_BUCKETS.find((bucket) => clamped >= bucket.min && clamped <= bucket.max) || null;
}

function hoursBetween(startTimestamp, endTimestamp) {
  const start = Date.parse(String(startTimestamp || ""));
  const end = Date.parse(String(endTimestamp || ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return roundNumber((end - start) / 3600000, 4);
}

function percentile(sortedValues, percentileValue) {
  if (!Array.isArray(sortedValues) || !sortedValues.length) return null;
  if (sortedValues.length === 1) return roundNumber(sortedValues[0], 4);
  const position = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];
  if (lowerIndex === upperIndex) return roundNumber(lowerValue, 4);
  const weight = position - lowerIndex;
  return roundNumber(lowerValue + ((upperValue - lowerValue) * weight), 4);
}

function summarizeDistribution(values = []) {
  const numericValues = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!numericValues.length) {
    return {
      count: 0,
      min: null,
      p25: null,
      median: null,
      p75: null,
      max: null
    };
  }

  return {
    count: numericValues.length,
    min: roundNumber(numericValues[0], 4),
    p25: percentile(numericValues, 0.25),
    median: percentile(numericValues, 0.5),
    p75: percentile(numericValues, 0.75),
    max: roundNumber(numericValues[numericValues.length - 1], 4)
  };
}

function wilsonInterval(successes, trials, z = 1.96) {
  const n = Number(trials || 0);
  const k = Number(successes || 0);
  if (!(n > 0) || !(k >= 0) || k > n) {
    return {
      lowPct: null,
      highPct: null
    };
  }

  const phat = k / n;
  const zSquared = z * z;
  const denominator = 1 + (zSquared / n);
  const center = phat + (zSquared / (2 * n));
  const margin = z * Math.sqrt(((phat * (1 - phat)) / n) + (zSquared / (4 * n * n)));

  return {
    lowPct: roundNumber(((center - margin) / denominator) * 100, 2),
    highPct: roundNumber(((center + margin) / denominator) * 100, 2)
  };
}

function evaluateTargetReach(directionKey, sessionCandles, targetDistance, options = {}) {
  const candles = Array.isArray(sessionCandles) ? sessionCandles : [];
  const sessionStartTime = candles[0]?.timestamp || null;
  const sessionEndTime = candles[candles.length - 1]?.timestamp || null;
  if (!candles.length || !(targetDistance > 0)) {
    return {
      outcome: null,
      reached: null,
      targetDistance: roundNumber(targetDistance),
      targetPrice: null,
      triggerSwingPrice: null,
      triggerSwingTime: null,
      triggerCandleTime: null,
      timeToTargetHours: null,
      maxFavourableDistance: null,
      maxFavourableDistanceRatioToCurrentStandard: null,
      bestMargin: null,
      evaluationStartTime: sessionStartTime,
      evaluationEndTime: sessionEndTime,
      initiatingPrice: null,
      initiatingTime: null,
      confirmingPrice: null,
      confirmingTime: null,
      adverseBoundarySupported: Number.isFinite(options.adverseDistance),
      adverseSequence: Number.isFinite(options.adverseDistance) ? "UNRESOLVED" : "NOT_SUPPORTED"
    };
  }

  if (directionKey === "BULLISH") {
    let lowestLowSoFar = null;
    let lowestLowTime = null;
    let bestDistance = Number.NEGATIVE_INFINITY;
    let bestMargin = Number.NEGATIVE_INFINITY;
    let bestConfirmingPrice = null;
    let bestConfirmingTime = null;
    let bestInitiatingPrice = null;
    let bestInitiatingTime = null;

    for (const candle of candles) {
      if (Number.isFinite(lowestLowSoFar)) {
        const targetPrice = lowestLowSoFar + targetDistance;
        const maxDistance = candle.high - lowestLowSoFar;
        const margin = candle.high - targetPrice;
        if (maxDistance > bestDistance) {
          bestDistance = maxDistance;
          bestConfirmingPrice = candle.high;
          bestConfirmingTime = candle.timestamp;
          bestInitiatingPrice = lowestLowSoFar;
          bestInitiatingTime = lowestLowTime;
        }
        if (margin > bestMargin) bestMargin = margin;

        if (Number.isFinite(options.adverseDistance)) {
          const adversePrice = lowestLowSoFar - options.adverseDistance;
          const targetTouched = candle.high >= targetPrice;
          const adverseTouched = candle.low <= adversePrice;
          if (targetTouched && adverseTouched) {
            return {
              outcome: "SEQUENCE_AMBIGUOUS",
              reached: null,
              targetDistance: roundNumber(targetDistance),
              targetPrice: roundNumber(targetPrice),
              triggerSwingPrice: roundNumber(lowestLowSoFar),
              triggerSwingTime: lowestLowTime,
              triggerCandleTime: candle.timestamp,
              timeToTargetHours: hoursBetween(lowestLowTime, candle.timestamp),
              maxFavourableDistance: roundNumber(bestDistance),
              maxFavourableDistanceRatioToCurrentStandard: options.currentStandardDistance > 0
                ? roundNumber(bestDistance / options.currentStandardDistance, 4)
                : null,
              bestMargin: roundNumber(bestMargin),
              evaluationStartTime: sessionStartTime,
              evaluationEndTime: sessionEndTime,
              initiatingPrice: roundNumber(lowestLowSoFar),
              initiatingTime: lowestLowTime,
              confirmingPrice: roundNumber(candle.high),
              confirmingTime: candle.timestamp,
              adverseBoundarySupported: true,
              adverseSequence: "BOTH_REACHED_SAME_CANDLE"
            };
          }
          if (adverseTouched) {
            return {
              outcome: "ADVERSE_BOUNDARY_FIRST",
              reached: false,
              targetDistance: roundNumber(targetDistance),
              targetPrice: roundNumber(targetPrice),
              triggerSwingPrice: roundNumber(lowestLowSoFar),
              triggerSwingTime: lowestLowTime,
              triggerCandleTime: candle.timestamp,
              timeToTargetHours: hoursBetween(lowestLowTime, candle.timestamp),
              maxFavourableDistance: roundNumber(bestDistance),
              maxFavourableDistanceRatioToCurrentStandard: options.currentStandardDistance > 0
                ? roundNumber(bestDistance / options.currentStandardDistance, 4)
                : null,
              bestMargin: roundNumber(bestMargin),
              evaluationStartTime: sessionStartTime,
              evaluationEndTime: sessionEndTime,
              initiatingPrice: roundNumber(lowestLowSoFar),
              initiatingTime: lowestLowTime,
              confirmingPrice: roundNumber(candle.low),
              confirmingTime: candle.timestamp,
              adverseBoundarySupported: true,
              adverseSequence: "ADVERSE_BOUNDARY_FIRST"
            };
          }
        }

        if (margin >= 0) {
          return {
            outcome: "HIT",
            reached: true,
            targetDistance: roundNumber(targetDistance),
            targetPrice: roundNumber(targetPrice),
            triggerSwingPrice: roundNumber(lowestLowSoFar),
            triggerSwingTime: lowestLowTime,
            triggerCandleTime: candle.timestamp,
            timeToTargetHours: hoursBetween(lowestLowTime, candle.timestamp),
            maxFavourableDistance: roundNumber(bestDistance),
            maxFavourableDistanceRatioToCurrentStandard: options.currentStandardDistance > 0
              ? roundNumber(bestDistance / options.currentStandardDistance, 4)
              : null,
            bestMargin: roundNumber(bestMargin),
            evaluationStartTime: sessionStartTime,
            evaluationEndTime: sessionEndTime,
            initiatingPrice: roundNumber(lowestLowSoFar),
            initiatingTime: lowestLowTime,
            confirmingPrice: roundNumber(candle.high),
            confirmingTime: candle.timestamp,
            adverseBoundarySupported: Number.isFinite(options.adverseDistance),
            adverseSequence: Number.isFinite(options.adverseDistance) ? "TARGET_FIRST" : "NOT_SUPPORTED"
          };
        }
      }

      if (!Number.isFinite(lowestLowSoFar) || candle.low < lowestLowSoFar) {
        lowestLowSoFar = candle.low;
        lowestLowTime = candle.timestamp;
      }
    }

    return {
      outcome: "MISS",
      reached: false,
      targetDistance: roundNumber(targetDistance),
      targetPrice: null,
      triggerSwingPrice: null,
      triggerSwingTime: null,
      triggerCandleTime: null,
      timeToTargetHours: null,
      maxFavourableDistance: Number.isFinite(bestDistance) ? roundNumber(bestDistance) : null,
      maxFavourableDistanceRatioToCurrentStandard: Number.isFinite(bestDistance) && options.currentStandardDistance > 0
        ? roundNumber(bestDistance / options.currentStandardDistance, 4)
        : null,
      bestMargin: Number.isFinite(bestMargin) ? roundNumber(bestMargin) : null,
      evaluationStartTime: sessionStartTime,
      evaluationEndTime: sessionEndTime,
      initiatingPrice: Number.isFinite(bestInitiatingPrice) ? roundNumber(bestInitiatingPrice) : null,
      initiatingTime: bestInitiatingTime,
      confirmingPrice: Number.isFinite(bestConfirmingPrice) ? roundNumber(bestConfirmingPrice) : null,
      confirmingTime: bestConfirmingTime,
      adverseBoundarySupported: Number.isFinite(options.adverseDistance),
      adverseSequence: Number.isFinite(options.adverseDistance) ? "NEITHER_REACHED" : "NOT_SUPPORTED"
    };
  }

  let highestHighSoFar = null;
  let highestHighTime = null;
  let bestDistance = Number.NEGATIVE_INFINITY;
  let bestMargin = Number.NEGATIVE_INFINITY;
  let bestConfirmingPrice = null;
  let bestConfirmingTime = null;
  let bestInitiatingPrice = null;
  let bestInitiatingTime = null;

  for (const candle of candles) {
    if (Number.isFinite(highestHighSoFar)) {
      const targetPrice = highestHighSoFar - targetDistance;
      const maxDistance = highestHighSoFar - candle.low;
      const margin = maxDistance - targetDistance;
      if (maxDistance > bestDistance) {
        bestDistance = maxDistance;
        bestConfirmingPrice = candle.low;
        bestConfirmingTime = candle.timestamp;
        bestInitiatingPrice = highestHighSoFar;
        bestInitiatingTime = highestHighTime;
      }
      if (margin > bestMargin) bestMargin = margin;

      if (Number.isFinite(options.adverseDistance)) {
        const adversePrice = highestHighSoFar + options.adverseDistance;
        const targetTouched = candle.low <= targetPrice;
        const adverseTouched = candle.high >= adversePrice;
        if (targetTouched && adverseTouched) {
          return {
            outcome: "SEQUENCE_AMBIGUOUS",
            reached: null,
            targetDistance: roundNumber(targetDistance),
            targetPrice: roundNumber(targetPrice),
            triggerSwingPrice: roundNumber(highestHighSoFar),
            triggerSwingTime: highestHighTime,
            triggerCandleTime: candle.timestamp,
            timeToTargetHours: hoursBetween(highestHighTime, candle.timestamp),
            maxFavourableDistance: roundNumber(bestDistance),
            maxFavourableDistanceRatioToCurrentStandard: options.currentStandardDistance > 0
              ? roundNumber(bestDistance / options.currentStandardDistance, 4)
              : null,
            bestMargin: roundNumber(bestMargin),
            evaluationStartTime: sessionStartTime,
            evaluationEndTime: sessionEndTime,
            initiatingPrice: roundNumber(highestHighSoFar),
            initiatingTime: highestHighTime,
            confirmingPrice: roundNumber(candle.low),
            confirmingTime: candle.timestamp,
            adverseBoundarySupported: true,
            adverseSequence: "BOTH_REACHED_SAME_CANDLE"
          };
        }
        if (adverseTouched) {
          return {
            outcome: "ADVERSE_BOUNDARY_FIRST",
            reached: false,
            targetDistance: roundNumber(targetDistance),
            targetPrice: roundNumber(targetPrice),
            triggerSwingPrice: roundNumber(highestHighSoFar),
            triggerSwingTime: highestHighTime,
            triggerCandleTime: candle.timestamp,
            timeToTargetHours: hoursBetween(highestHighTime, candle.timestamp),
            maxFavourableDistance: roundNumber(bestDistance),
            maxFavourableDistanceRatioToCurrentStandard: options.currentStandardDistance > 0
              ? roundNumber(bestDistance / options.currentStandardDistance, 4)
              : null,
            bestMargin: roundNumber(bestMargin),
            evaluationStartTime: sessionStartTime,
            evaluationEndTime: sessionEndTime,
            initiatingPrice: roundNumber(highestHighSoFar),
            initiatingTime: highestHighTime,
            confirmingPrice: roundNumber(candle.high),
            confirmingTime: candle.timestamp,
            adverseBoundarySupported: true,
            adverseSequence: "ADVERSE_BOUNDARY_FIRST"
          };
        }
      }

      if (margin >= 0) {
        return {
          outcome: "HIT",
          reached: true,
          targetDistance: roundNumber(targetDistance),
          targetPrice: roundNumber(targetPrice),
          triggerSwingPrice: roundNumber(highestHighSoFar),
          triggerSwingTime: highestHighTime,
          triggerCandleTime: candle.timestamp,
          timeToTargetHours: hoursBetween(highestHighTime, candle.timestamp),
          maxFavourableDistance: roundNumber(bestDistance),
          maxFavourableDistanceRatioToCurrentStandard: options.currentStandardDistance > 0
            ? roundNumber(bestDistance / options.currentStandardDistance, 4)
            : null,
          bestMargin: roundNumber(bestMargin),
          evaluationStartTime: sessionStartTime,
          evaluationEndTime: sessionEndTime,
          initiatingPrice: roundNumber(highestHighSoFar),
          initiatingTime: highestHighTime,
          confirmingPrice: roundNumber(candle.low),
          confirmingTime: candle.timestamp,
          adverseBoundarySupported: Number.isFinite(options.adverseDistance),
          adverseSequence: Number.isFinite(options.adverseDistance) ? "TARGET_FIRST" : "NOT_SUPPORTED"
        };
      }
    }

    if (!Number.isFinite(highestHighSoFar) || candle.high > highestHighSoFar) {
      highestHighSoFar = candle.high;
      highestHighTime = candle.timestamp;
    }
  }

  return {
    outcome: "MISS",
    reached: false,
    targetDistance: roundNumber(targetDistance),
    targetPrice: null,
    triggerSwingPrice: null,
    triggerSwingTime: null,
    triggerCandleTime: null,
    timeToTargetHours: null,
    maxFavourableDistance: Number.isFinite(bestDistance) ? roundNumber(bestDistance) : null,
    maxFavourableDistanceRatioToCurrentStandard: Number.isFinite(bestDistance) && options.currentStandardDistance > 0
      ? roundNumber(bestDistance / options.currentStandardDistance, 4)
      : null,
    bestMargin: Number.isFinite(bestMargin) ? roundNumber(bestMargin) : null,
    evaluationStartTime: sessionStartTime,
    evaluationEndTime: sessionEndTime,
    initiatingPrice: Number.isFinite(bestInitiatingPrice) ? roundNumber(bestInitiatingPrice) : null,
    initiatingTime: bestInitiatingTime,
    confirmingPrice: Number.isFinite(bestConfirmingPrice) ? roundNumber(bestConfirmingPrice) : null,
    confirmingTime: bestConfirmingTime,
    adverseBoundarySupported: Number.isFinite(options.adverseDistance),
    adverseSequence: Number.isFinite(options.adverseDistance) ? "NEITHER_REACHED" : "NOT_SUPPORTED"
  };
}

module.exports = {
  EXACT_CONFIDENCE_BUCKETS,
  TARGET_MODES,
  confidenceBucketFromPct,
  evaluateTargetReach,
  summarizeDistribution,
  wilsonInterval,
  roundNumber
};
