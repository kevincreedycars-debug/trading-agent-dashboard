(function initHeadlineConfidence(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.HeadlineConfidence = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createHeadlineConfidence() {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
  }

  function parseObject(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    if (typeof value !== "string") return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function deriveConfidenceStrength(confidence, netEdge, participation, direction) {
    if (direction === "NO_CALL" || direction === "NO 24H CALL") return "NO_CALL";
    if (confidence === null || confidence === undefined) return "PENDING";

    const edge = Math.abs(Number(netEdge) || 0);
    const active = Number(participation) || 0;

    if (confidence >= 80 && edge >= 25 && active >= 50) return "VERY_STRONG";
    if (confidence >= 65 && edge >= 18 && active >= 35) return "STRONG";
    if (confidence >= 50 && edge >= 10 && active >= 25) return "MODERATE";
    if (confidence > 0) return "WEAK";
    return "NO_CALL";
  }

  function extractWarningText(warnings) {
    return asArray(warnings)
      .map((warning) => {
        if (warning === null || warning === undefined) return "";
        if (typeof warning === "string") return warning;
        if (typeof warning === "object") {
          return [
            warning.label,
            warning.code,
            warning.message,
            warning.reason,
            warning.text
          ].filter(Boolean).join(" ");
        }
        return String(warning);
      })
      .join(" ")
      .toLowerCase();
  }

  function computeHeadlineConfidenceData(input = {}) {
    const bullCase = numberOrNull(input.bullCase);
    const bearCase = numberOrNull(input.bearCase);
    const participation = numberOrNull(input.participation);
    const netEdge = numberOrNull(input.netEdge);
    const direction = input.direction || "PENDING";
    const fallbackConfidence = numberOrNull(input.fallbackConfidence);
    const explicitStrength = input.strengthOverride || null;

    const missingCount = Number.isFinite(Number(input.missingInputsCount))
      ? Number(input.missingInputsCount)
      : asArray(input.missingInputs).filter(Boolean).length;

    if ([bullCase, bearCase, participation, netEdge].some((value) => value === null)) {
      const fallbackValue = Number.isFinite(fallbackConfidence) ? fallbackConfidence : null;
      return {
        value: fallbackValue,
        strength: explicitStrength || deriveConfidenceStrength(fallbackValue, netEdge, participation, direction),
        evidenceDominance: null,
        participation,
        netEdge,
        missingInputsCount: missingCount
      };
    }

    let confidence =
      ((Math.max(bullCase, bearCase) / 100) * 0.45) +
      ((participation / 100) * 0.35) +
      ((Math.abs(netEdge) / 100) * 0.20);

    if (participation < 40) confidence -= 0.10;
    if (participation < 25) confidence -= 0.20;
    if (Math.abs(netEdge) < 20) confidence -= 0.10;

    if (missingCount >= 3) confidence -= 0.05;
    if (missingCount >= 6) confidence -= 0.10;

    const warningText = extractWarningText(input.warnings);
    const weeklyStatus = String(input.weeklyCandleStatus || "").toLowerCase();

    if (
      warningText.includes("event risk") ||
      warningText.includes("high impact event") ||
      warningText.includes("tier 1 event")
    ) {
      confidence -= 0.10;
    }

    if (weeklyStatus === "consolidating" || warningText.includes("weekly consolidation")) {
      confidence -= 0.05;
    }

    if (
      warningText.includes("conviction audit") ||
      warningText.includes("audit flag") ||
      warningText.includes("audit warning")
    ) {
      confidence -= 0.05;
    }

    if (warningText.includes("o layer")) confidence -= 0.05;
    if (warningText.includes("adr warning") || warningText.includes("session warning")) confidence -= 0.05;

    const finalConfidence = Math.round(clamp(confidence, 0, 1) * 100);

    return {
      value: finalConfidence,
      strength: explicitStrength || deriveConfidenceStrength(finalConfidence, netEdge, participation, direction),
      evidenceDominance: Math.max(bullCase, bearCase),
      participation,
      netEdge,
      missingInputsCount: missingCount
    };
  }

  function computeHeadlineConfidenceFromRow(row = {}) {
    const source = row || {};
    const convictionModel = parseObject(source.conviction_model);
    const direction = source.predicted_direction || source.agent_direction || source.direction || convictionModel.winning_side || "PENDING";
    const fallbackConfidence =
      source.displayed_headline_confidence_pct ??
      convictionModel.headline_confidence_pct ??
      convictionModel.final_confidence ??
      source.headline_confidence_pct ??
      source.confidence ??
      source.conviction ??
      source.predicted_conviction ??
      source.agent_conviction ??
      convictionModel.final_conviction ??
      null;
    const warnings =
      source.warnings_affecting_confidence ??
      source.warnings ??
      source.risk_flags ??
      convictionModel.warnings ??
      convictionModel.risk_flags ??
      [];
    const missingInputs =
      source.missing_inputs ??
      convictionModel.missing_inputs ??
      [];
    const missingInputsCount =
      source.missing_inputs_count ??
      convictionModel.missing_inputs_count ??
      null;
    const weeklyCandleStatus =
      source.weekly_candle_status ??
      convictionModel.weekly_candle_status ??
      "";
    const strengthOverride =
      source.confidence_strength ??
      convictionModel.confidence_strength ??
      null;

    return computeHeadlineConfidenceData({
      bullCase: source.bull_case_pct ?? source.bullCase ?? convictionModel.bullish_argument_pct ?? convictionModel.bull_case,
      bearCase: source.bear_case_pct ?? source.bearCase ?? convictionModel.bearish_argument_pct ?? convictionModel.bear_case,
      participation:
        source.participation_pct ??
        source.participation ??
        convictionModel.directional_participation_pct ??
        convictionModel.active_participation_pct ??
        convictionModel.participation,
      netEdge: source.net_edge_pct ?? source.netEdge ?? convictionModel.net_edge_pct ?? convictionModel.net_edge,
      direction,
      warnings,
      missingInputs,
      missingInputsCount,
      weeklyCandleStatus,
      fallbackConfidence,
      strengthOverride
    });
  }

  return {
    deriveConfidenceStrength,
    computeHeadlineConfidenceData,
    computeHeadlineConfidenceFromRow
  };
});
