(function initEconomicEventHealth(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.EconomicEventHealth = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createEconomicEventHealth() {
  const AFFECTED_AGENTS = Object.freeze(["USD", "EUR", "GOLD", "NQ", "BTC"]);
  const FAILURE_PATTERN = /error|failed|invalid|unauthori[sz]ed|forbidden|timed?\s*out|rate.?limit|unavailable/i;

  function serialise(value) {
    try {
      if (value === undefined || value === null) return "";
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function extractError(items = []) {
    for (const item of items) {
      const value = item && typeof item === "object" ? item : {};
      const candidates = [
        value.error,
        value.message,
        value.reason,
        value.cause,
        value.json?.error,
        value.json?.message,
        value.json?.reason,
        value.json?.cause
      ];
      const statusCode = Number(value.statusCode ?? value.status ?? value.json?.statusCode ?? value.json?.status);
      if (Number.isFinite(statusCode) && statusCode >= 400) return `HTTP ${statusCode}`;

      for (const candidate of candidates) {
        const text = serialise(candidate);
        if (text && FAILURE_PATTERN.test(text)) return text;
      }
    }
    return "";
  }

  function deriveEconomicEventGate(items = []) {
    const error = extractError(items);
    return {
      gate: error ? "BLOCKED" : "PASS",
      error: error || null
    };
  }

  function buildEconomicEventFailureHealth({ generatedAt = new Date().toISOString(), error = "Economic event collector failed." } = {}) {
    const issue = {
      agent: "SYSTEM",
      input_id: "economic_events",
      label: "Economic events",
      category: "economic_events",
      importance: "critical",
      status: "SOURCE_UNAVAILABLE",
      reason: error,
      recovery_action: "Restore the economic-event collector, then run a controlled refresh."
    };
    const agents = Object.fromEntries(AFFECTED_AGENTS.map((agent) => [agent, {
      overall_status: "CRITICAL",
      issues: [{ ...issue, agent }]
    }]));

    return {
      schema_version: 1,
      generated_at: generatedAt,
      source_run_id: null,
      consistency_status: "FAILED",
      consistency_warnings: ["economic_event_collector_failed"],
      overall_status: "CRITICAL",
      affected_agent_count: AFFECTED_AGENTS.length,
      critical_issue_count: AFFECTED_AGENTS.length,
      missing_input_count: 0,
      stale_input_count: 0,
      placeholder_input_count: 0,
      source_failure_count: 1,
      last_full_health_at: null,
      sources: {
        economic_events: {
          source_id: "economic_events",
          label: "Economic events",
          execution_status: "failed",
          data_status: "SOURCE_UNAVAILABLE",
          source_collected_at: generatedAt,
          warning: error
        }
      },
      source_groups: [{
        source_id: "economic_events",
        label: "Economic events",
        status: "SOURCE_UNAVAILABLE",
        warning: error,
        execution_status: "failed",
        source_collected_at: generatedAt,
        affected_agents: AFFECTED_AGENTS,
        affected_inputs: [],
        recovery_state: "unrecovered"
      }],
      agents,
      issues: AFFECTED_AGENTS.map((agent) => ({ ...issue, agent }))
    };
  }

  return {
    AFFECTED_AGENTS,
    buildEconomicEventFailureHealth,
    deriveEconomicEventGate,
    extractError
  };
});
