"use strict";

const REQUIRED_AGENTS = ["USD", "EUR", "GOLD", "NQ", "BTC"];

function parseMaybeJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function consistencyLabel(values) {
  if (!values.length) return "UNKNOWN";
  return values.every((value) => value === values[0]) ? "MATCHED" : "MISMATCHED";
}

function hasUsableDirection(row) {
  const output = parseMaybeJson(row?.full_output || row?.raw_agent_output, {});
  return Boolean(row?.direction_24h || row?.call_24h_direction || output?.direction_24h || output?.today_call?.direction);
}

function selectLatestLayer1RowsByAgent(rows, options = {}) {
  const requiredAgents = options.requiredAgents || REQUIRED_AGENTS;
  const selected = {};
  const missingAgents = [];

  requiredAgents.forEach((agent) => {
    const latest = rows
      .filter((row) => row?.agent_name === agent && Number(row?.layer) === 1)
      .filter(hasUsableDirection)
      .sort((left, right) => parseTimestamp(right?.created_at || right?.run_time_et) - parseTimestamp(left?.created_at || left?.run_time_et))[0] || null;

    if (!latest) {
      missingAgents.push(agent);
      return;
    }

    selected[agent] = latest;
  });

  const selectedRows = requiredAgents.map((agent) => selected[agent]).filter(Boolean);
  const sourceRunIds = selectedRows.map((row) => String(row?.source_run_id || "").trim()).filter(Boolean);
  const refreshRequestIds = selectedRows.map((row) => String(row?.refresh_request_id || row?.request_id || "").trim()).filter(Boolean);
  const sourceRunConsistency = consistencyLabel(sourceRunIds);
  const refreshRequestConsistency = consistencyLabel(refreshRequestIds);

  return {
    selected,
    selectedRows,
    missingAgents,
    sourceRunIds,
    refreshRequestIds,
    sourceRunConsistency,
    refreshRequestConsistency,
    consistencyStatus: sourceRunConsistency === "MISMATCHED" || refreshRequestConsistency === "MISMATCHED"
      ? "MISMATCHED"
      : sourceRunConsistency === "MATCHED" || refreshRequestConsistency === "MATCHED"
        ? "MATCHED"
        : "UNKNOWN"
  };
}

module.exports = {
  REQUIRED_AGENTS,
  selectLatestLayer1RowsByAgent
};
