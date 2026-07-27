(function initEconomicEventRefresh(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.EconomicEventRefresh = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createEconomicEventRefresh() {
  const VALID_AGENTS = new Set(["USD", "EUR", "GOLD", "NQ", "BTC"]);
  const VALID_RELEVANCE = new Set(["direct", "secondary", "none"]);
  const VALID_STATES = new Set([
    "SOURCE_UNAVAILABLE",
    "STALE_SOURCE",
    "INVALID_SOURCE",
    "NO_MAJOR_EVENTS",
    "UPCOMING",
    "EVENT_IMMINENT",
    "REFRESH_REQUIRED",
    "PARTIALLY_REFRESHED",
    "CLEARED",
    "REFRESH_EVIDENCE_UNAVAILABLE",
    "INVALID_EVENT_TIME"
  ]);
  const DEFAULT_IMMINENT_THRESHOLD_MINUTES = 60;
  const DEFAULT_SOURCE = Object.freeze({
    source_name: "economic_event_source_unverified"
  });
  const SUMMARY_PRIORITY = {
    SOURCE_UNAVAILABLE: 0,
    STALE_SOURCE: 1,
    INVALID_SOURCE: 2,
    INVALID_EVENT_TIME: 3,
    REFRESH_EVIDENCE_UNAVAILABLE: 4,
    REFRESH_REQUIRED: 5,
    PARTIALLY_REFRESHED: 6,
    EVENT_IMMINENT: 7,
    UPCOMING: 8,
    CLEARED: 9,
    NO_MAJOR_EVENTS: 10
  };

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
  }

  function asObject(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === "object" && !Array.isArray(value)) return value;
    return fallback;
  }

  function parseJsonObject(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string") return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function stringOrNull(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function toIsoString(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function dateKeyInZone(value, timeZone) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function addDays(dateKey, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
    if (!match) return null;
    const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days, 0, 0, 0));
    return utc.toISOString().slice(0, 10);
  }

  function formatZoneTimestamp(value, timeZone) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short"
    });
    const parts = formatter.formatToParts(date);
    const zoneName = parts.find((part) => part.type === "timeZoneName")?.value || "";
    const base = parts
      .filter((part) => part.type !== "timeZoneName")
      .map((part) => part.value)
      .join("")
      .trim()
      .replace(/\s+,/g, ",");
    return `${base} ${zoneName}`.trim();
  }

  function parseSourceTimeText(text) {
    const normalized = stringOrNull(text);
    if (!normalized) {
      return { ok: false, reason: "missing_time_text" };
    }

    const upper = normalized.toUpperCase();
    if (upper === "ALL DAY" || upper === "TENTATIVE" || upper === "DAY 1" || upper === "DAY 2") {
      return { ok: false, reason: "ambiguous_time_text" };
    }

    let match = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(normalized);
    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const meridiem = match[3].toUpperCase();
      if (hours === 12) hours = 0;
      if (meridiem === "PM") hours += 12;
      return { ok: true, hours, minutes };
    }

    match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours > 23 || minutes > 59) {
        return { ok: false, reason: "invalid_24h_time" };
      }
      return { ok: true, hours, minutes };
    }

    return { ok: false, reason: "unsupported_time_format" };
  }

  function buildEventId(parts) {
    return parts
      .map((part) => String(part || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
      .filter(Boolean)
      .join("--");
  }

  function deriveCanonicalEventTime(row, sourceConfig = DEFAULT_SOURCE) {
    const explicitUtc = stringOrNull(row.scheduled_at_utc || row.event_time_utc);
    if (explicitUtc) {
      const parsedExplicitUtc = new Date(explicitUtc);
      if (Number.isFinite(parsedExplicitUtc.getTime())) {
        return {
          scheduled_at_utc: parsedExplicitUtc.toISOString(),
          source_date: stringOrNull(row.source_date || row.event_date || row.date),
          source_time_text: stringOrNull(row.source_time_text || row.event_time_text || row.time),
          source_timezone: stringOrNull(row.source_timezone || sourceConfig.source_timezone_label),
          source_timezone_offset_minutes: numberOrNull(row.source_timezone_offset_minutes),
          invalid_reason: null
        };
      }
    }

    const sourceDate = stringOrNull(row.source_date || row.event_date || row.date);
    const sourceTimeText = stringOrNull(row.source_time_text || row.event_time_text || row.time);
    const sourceTimezoneLabel = stringOrNull(row.source_timezone || sourceConfig.source_timezone_label);

    if (!sourceDate || !sourceTimeText) {
      return {
        scheduled_at_utc: null,
        source_date: sourceDate,
        source_time_text: sourceTimeText,
        source_timezone: sourceTimezoneLabel,
        source_timezone_offset_minutes: numberOrNull(row.source_timezone_offset_minutes),
        invalid_reason: "missing_canonical_timestamp"
      };
    }

    return {
      scheduled_at_utc: null,
      source_date: sourceDate,
      source_time_text: sourceTimeText,
      source_timezone: sourceTimezoneLabel,
      source_timezone_offset_minutes: numberOrNull(row.source_timezone_offset_minutes),
      invalid_reason: "missing_canonical_timestamp"
    };
  }

  function validatePolicy(policy) {
    const errors = [];
    const source = asObject(policy);
    if (!Number.isInteger(source.version) || source.version < 1) {
      errors.push("Policy version must be an integer >= 1.");
    }

    if (!Array.isArray(source.rules) || source.rules.length === 0) {
      errors.push("Policy rules must be a non-empty array.");
      return errors;
    }

    const seenRuleIds = new Set();
    source.rules.forEach((rule, index) => {
      const label = `rules[${index}]`;
      const ruleId = stringOrNull(rule.rule_id);
      if (!ruleId) {
        errors.push(`${label} is missing rule_id.`);
      } else if (seenRuleIds.has(ruleId)) {
        errors.push(`Duplicate rule_id: ${ruleId}`);
      } else {
        seenRuleIds.add(ruleId);
      }

      const match = asObject(rule.match);
      const patterns = asArray(match.event_name_patterns);
      const currencies = asArray(match.currency);
      if (!patterns.length || patterns.some((pattern) => !stringOrNull(pattern))) {
        errors.push(`${label} must define non-empty event_name_patterns.`);
      }
      if (!currencies.length || currencies.some((currency) => !stringOrNull(currency))) {
        errors.push(`${label} must define at least one currency.`);
      }
      const minimumImpactRank = numberOrNull(match.minimum_impact_rank);
      if (minimumImpactRank === null || minimumImpactRank < 1 || minimumImpactRank > 3) {
        errors.push(`${label} minimum_impact_rank must be between 1 and 3.`);
      }

      const affectedAgents = asArray(rule.affected_agents);
      if (!affectedAgents.length) {
        errors.push(`${label} must define affected_agents.`);
      }

      affectedAgents.forEach((agentRule, agentIndex) => {
        const agentLabel = `${label}.affected_agents[${agentIndex}]`;
        const agent = stringOrNull(agentRule.agent);
        if (!VALID_AGENTS.has(agent)) {
          errors.push(`${agentLabel} has unsupported agent ${agentRule.agent}.`);
        }

        const relevance = stringOrNull(agentRule.relevance);
        if (!VALID_RELEVANCE.has(relevance)) {
          errors.push(`${agentLabel} has unsupported relevance ${agentRule.relevance}.`);
        }

        if (typeof agentRule.refresh_required !== "boolean") {
          errors.push(`${agentLabel} refresh_required must be boolean.`);
        }

        const offset = agentRule.refresh_not_before_offset_minutes;
        if (offset !== undefined && offset !== null) {
          const offsetNumber = numberOrNull(offset);
          if (offsetNumber === null || offsetNumber < 0) {
            errors.push(`${agentLabel} refresh_not_before_offset_minutes must be >= 0 when provided.`);
          }
        }
      });
    });

    return errors;
  }

  function matchesEventName(eventName, patterns) {
    const name = String(eventName || "").trim();
    if (!name) return false;
    return asArray(patterns).some((pattern) => {
      const normalized = String(pattern || "").trim();
      if (!normalized) return false;
      const regex = new RegExp(escapeRegExp(normalized), "i");
      return regex.test(name);
    });
  }

  function findMatchingRule(eventRow, policy) {
    const rules = asArray(policy.rules);
    for (const rule of rules) {
      const match = asObject(rule.match);
      const currencies = asArray(match.currency).map((value) => String(value || "").toUpperCase());
      const eventCurrency = String(eventRow.currency || "").toUpperCase();
      if (currencies.length && !currencies.includes(eventCurrency)) continue;
      if (!matchesEventName(eventRow.event_name, match.event_name_patterns)) continue;

      const minimumImpactRank = numberOrNull(match.minimum_impact_rank) ?? 0;
      const eventImpactRank = numberOrNull(eventRow.impact_rank) ?? 0;
      if (eventImpactRank < minimumImpactRank) continue;

      return rule;
    }

    return null;
  }

  function normalizeEventRow(row, sourceConfig = DEFAULT_SOURCE) {
    const rawRow = asObject(row);
    const canonicalTime = deriveCanonicalEventTime(rawRow, sourceConfig);
    const eventName = stringOrNull(rawRow.event_name || rawRow.event || rawRow.name);
    const currency = stringOrNull(rawRow.currency);
    const region = stringOrNull(rawRow.region || rawRow.country);
    const impact = stringOrNull(rawRow.impact);
    const impactRank = numberOrNull(rawRow.impact_rank);
    const source = stringOrNull(rawRow.source) || sourceConfig.source_name;
    const rawJson = rawRow.raw_json !== undefined ? rawRow.raw_json : rawRow.rawJson;
    const eventId = stringOrNull(rawRow.event_id)
      || buildEventId([
        source,
        currency,
        eventName,
        canonicalTime.source_date,
        canonicalTime.source_time_text
      ]);

    return {
      event_id: eventId,
      event_name: eventName,
      currency,
      region,
      impact,
      impact_rank: impactRank,
      scheduled_at_utc: canonicalTime.scheduled_at_utc,
      source_timezone: canonicalTime.source_timezone,
      source_timezone_offset_minutes: canonicalTime.source_timezone_offset_minutes,
      source_date: canonicalTime.source_date,
      source_time_text: canonicalTime.source_time_text,
      source,
      forecast: rawRow.forecast ?? null,
      previous: rawRow.previous ?? null,
      actual: rawRow.actual ?? null,
      raw_json: rawJson !== undefined ? rawJson : rawRow,
      invalid_reason: canonicalTime.invalid_reason
    };
  }

  function normalizeAgentEvidence(layer1Payload) {
    const agents = Array.isArray(layer1Payload?.agents) ? layer1Payload.agents : [];
    return agents.reduce((acc, agent) => {
      const agentCode = String(agent?.agent || "").toUpperCase();
      if (!VALID_AGENTS.has(agentCode)) return acc;

      const topLevelSealed = stringOrNull(agent.sealed_at);
      const topLevelGenerated = stringOrNull(agent.generated_at);
      const call24 = asObject(agent.calls?.["24h"]);
      const sealedAt = topLevelSealed || stringOrNull(call24.sealed_at) || null;
      const generatedAt = topLevelGenerated || stringOrNull(call24.generated_at) || null;
      const successfulOutputTimestamp = sealedAt || generatedAt || null;

      acc[agentCode] = {
        agent: agentCode,
        sealed_at: sealedAt,
        generated_at: generatedAt,
        successful_output_timestamp: successfulOutputTimestamp,
        successful_output_timestamp_source: sealedAt ? "sealed_at" : (generatedAt ? "generated_at_fallback" : null),
        forecast_window_end: stringOrNull(agent.forecast_window_end || call24.forecast_window_end),
        expires_at: stringOrNull(agent.expires_at || call24.expires_at),
        effective_status: stringOrNull(agent.effective_status || call24.effective_status),
        status_at_build: stringOrNull(agent.status_at_build || call24.status_at_build)
      };
      return acc;
    }, {});
  }

  function deriveAgentRefreshState(agentPolicy, agentEvidence, boundaryIso) {
    const boundaryTime = new Date(boundaryIso).getTime();
    const timestamp = stringOrNull(agentEvidence?.successful_output_timestamp);
    const evidenceTime = timestamp ? new Date(timestamp).getTime() : NaN;

    if (!agentPolicy.refresh_required) {
      return {
        state: "CLEARED",
        comparison_timestamp: timestamp,
        comparison_timestamp_source: agentEvidence?.successful_output_timestamp_source || null,
        cleared: true,
        refresh_required: false
      };
    }

    if (!Number.isFinite(evidenceTime)) {
      return {
        state: "REFRESH_EVIDENCE_UNAVAILABLE",
        comparison_timestamp: null,
        comparison_timestamp_source: null,
        cleared: false,
        refresh_required: true
      };
    }

    const cleared = evidenceTime >= boundaryTime;
    return {
      state: cleared ? "CLEARED" : "REFRESH_REQUIRED",
      comparison_timestamp: timestamp,
      comparison_timestamp_source: agentEvidence?.successful_output_timestamp_source || null,
      cleared,
      refresh_required: true
    };
  }

  function getBoundaryIso(scheduledAtUtc, offsetMinutes) {
    const scheduledTime = new Date(scheduledAtUtc).getTime();
    if (!Number.isFinite(scheduledTime)) return null;
    const offset = Number.isFinite(Number(offsetMinutes)) ? Number(offsetMinutes) : 0;
    return new Date(scheduledTime + offset * 60 * 1000).toISOString();
  }

  function deriveEventState(event, nowIso, imminentThresholdMinutes = DEFAULT_IMMINENT_THRESHOLD_MINUTES) {
    if (!event.scheduled_at_utc) return "INVALID_EVENT_TIME";

    const nowTime = new Date(nowIso).getTime();
    const boundaryTime = new Date(event.refresh_boundary_utc).getTime();
    if (!Number.isFinite(nowTime) || !Number.isFinite(boundaryTime)) return "INVALID_EVENT_TIME";

    if (boundaryTime > nowTime) {
      const deltaMinutes = (boundaryTime - nowTime) / (1000 * 60);
      return deltaMinutes <= imminentThresholdMinutes ? "EVENT_IMMINENT" : "UPCOMING";
    }

    const requiredAgents = event.affected_agents.filter((agent) => agent.refresh_required);
    if (!requiredAgents.length) return "CLEARED";

    const states = requiredAgents.map((agent) => agent.refresh_state);
    if (states.includes("REFRESH_EVIDENCE_UNAVAILABLE")) return "REFRESH_EVIDENCE_UNAVAILABLE";
    if (states.every((state) => state === "CLEARED")) return "CLEARED";
    if (states.some((state) => state === "CLEARED")) return "PARTIALLY_REFRESHED";
    return "REFRESH_REQUIRED";
  }

  function inForecastWindow(agentEvidence, scheduledAtUtc) {
    const eventTime = new Date(scheduledAtUtc).getTime();
    const forecastEnd = stringOrNull(agentEvidence?.forecast_window_end || agentEvidence?.expires_at);
    const forecastEndTime = forecastEnd ? new Date(forecastEnd).getTime() : NaN;
    return Number.isFinite(eventTime) && Number.isFinite(forecastEndTime) && eventTime <= forecastEndTime;
  }

  function eventIsInScope(event, nowIso, timeZone = "Europe/London") {
    const today = dateKeyInZone(nowIso, timeZone);
    const previousDay = addDays(today, -1);

    if (event.state === "INVALID_EVENT_TIME" || !event.scheduled_at_utc) {
      return event.source_date === today || event.source_date === previousDay;
    }

    const eventDay = dateKeyInZone(event.scheduled_at_utc, timeZone);

    if (eventDay === today) return true;

    const unresolved = !["CLEARED", "UPCOMING", "EVENT_IMMINENT", "NO_MAJOR_EVENTS"].includes(event.state);
    if (eventDay === previousDay && unresolved) return true;

    if (new Date(event.scheduled_at_utc).getTime() > new Date(nowIso).getTime()) {
      return event.affected_agents.some((agent) => agent.refresh_required && agent.within_active_forecast_window);
    }

    return false;
  }

  function buildGroupedEvents(rawEvents, layer1Payload, policy, options = {}) {
    const policyErrors = validatePolicy(policy);
    if (policyErrors.length) {
      throw new Error(`Economic event policy validation failed: ${policyErrors.join(" | ")}`);
    }

    const nowIso = toIsoString(options.now || new Date()) || new Date().toISOString();
    const sourceConfig = { ...DEFAULT_SOURCE, ...asObject(options.sourceConfig) };
    const imminentThresholdMinutes = Number.isFinite(Number(options.imminentThresholdMinutes))
      ? Number(options.imminentThresholdMinutes)
      : DEFAULT_IMMINENT_THRESHOLD_MINUTES;
    const agentEvidenceMap = normalizeAgentEvidence(layer1Payload || {});

    const normalizedEvents = asArray(rawEvents)
      .map((row) => normalizeEventRow(row, sourceConfig))
      .map((event) => {
        const matchingRule = event.invalid_reason ? null : findMatchingRule(event, policy);
        return {
          ...event,
          policy_rule_id: matchingRule?.rule_id || null,
          policy_group_id: matchingRule?.group_id || matchingRule?.rule_id || null,
          policy_group_label: matchingRule?.group_label || null,
          matched_rule: matchingRule || null
        };
      })
      .filter((event) => event.invalid_reason || event.matched_rule);

    const grouped = new Map();
    normalizedEvents.forEach((event) => {
      const groupId = event.policy_group_id || event.event_id;
      const groupKey = `${groupId}::${event.scheduled_at_utc || event.event_id}`;
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          group_id: groupId,
          group_label: event.policy_group_label || event.event_name,
          scheduled_at_utc: event.scheduled_at_utc,
          source_timezone: event.source_timezone,
          source_timezone_offset_minutes: event.source_timezone_offset_minutes,
          source: event.source,
          currency: event.currency,
          region: event.region,
          impact: event.impact,
          impact_rank: event.impact_rank,
          policy_rule_id: event.policy_rule_id,
          component_events: [event]
        });
        return;
      }

      existing.component_events.push(event);
      existing.impact_rank = Math.max(numberOrNull(existing.impact_rank) || 0, numberOrNull(event.impact_rank) || 0);
    });

    return Array.from(grouped.values())
      .map((group) => {
        const first = group.component_events[0];
        const matchedRule = first.matched_rule;
        const affectedAgents = asArray(matchedRule?.affected_agents).map((agentRule) => {
          const agentCode = String(agentRule.agent || "").toUpperCase();
          const refreshOffsetMinutes = numberOrNull(agentRule.refresh_not_before_offset_minutes) ?? 0;
          const refreshBoundaryUtc = getBoundaryIso(group.scheduled_at_utc, refreshOffsetMinutes);
          const evidence = agentEvidenceMap[agentCode] || null;
          const refreshEvidence = deriveAgentRefreshState(agentRule, evidence, refreshBoundaryUtc || group.scheduled_at_utc);
          return {
            agent: agentCode,
            relevance: agentRule.relevance,
            refresh_required: agentRule.refresh_required,
            refresh_not_before_offset_minutes: refreshOffsetMinutes,
            refresh_boundary_utc: refreshBoundaryUtc,
            refresh_state: refreshEvidence.state,
            latest_successful_output_timestamp: refreshEvidence.comparison_timestamp,
            latest_successful_output_timestamp_source: refreshEvidence.comparison_timestamp_source,
            latest_sealed_at: evidence?.sealed_at || null,
            latest_generated_at: evidence?.generated_at || null,
            within_active_forecast_window: inForecastWindow(evidence, group.scheduled_at_utc)
          };
        });

        const refreshBoundaryUtc = affectedAgents
          .filter((agent) => agent.refresh_required)
          .map((agent) => agent.refresh_boundary_utc)
          .filter(Boolean)
          .sort()[0] || group.scheduled_at_utc;

        const componentEvents = group.component_events
          .slice()
          .sort((left, right) => String(left.event_name || "").localeCompare(String(right.event_name || "")));

        const displayLabel = group.group_label || first.event_name;
        const dataQualityWarnings = unique(componentEvents.map((event) => event.invalid_reason).filter(Boolean));

        const eventRecord = {
          event_id: buildEventId([group.group_id, group.scheduled_at_utc || first.event_id]),
          event_group_id: group.group_id,
          event_group_label: displayLabel,
          event_name: displayLabel,
          component_event_names: componentEvents.map((event) => event.event_name).filter(Boolean),
          currency: group.currency,
          region: group.region,
          impact: group.impact,
          impact_rank: group.impact_rank,
          scheduled_at_utc: group.scheduled_at_utc,
          refresh_boundary_utc: refreshBoundaryUtc,
          source_timezone: group.source_timezone,
          source_timezone_offset_minutes: group.source_timezone_offset_minutes,
          source: group.source,
          source_date: first.source_date,
          source_time_text: first.source_time_text,
          policy_rule_id: group.policy_rule_id,
          policy_version: policy.version,
          data_quality_warnings: dataQualityWarnings,
          source_components: componentEvents.map((event) => ({
            event_id: event.event_id,
            event_name: event.event_name,
            source_date: event.source_date,
            source_time_text: event.source_time_text,
            scheduled_at_utc: event.scheduled_at_utc,
            impact: event.impact,
            impact_rank: event.impact_rank
          })),
          affected_agents: affectedAgents
        };

        eventRecord.state = eventRecord.data_quality_warnings.includes("ambiguous_source_timezone")
          || eventRecord.data_quality_warnings.includes("missing_source_date")
          || eventRecord.data_quality_warnings.includes("invalid_source_date")
          || eventRecord.data_quality_warnings.includes("ambiguous_time_text")
          || eventRecord.data_quality_warnings.includes("missing_time_text")
          || !eventRecord.scheduled_at_utc
          ? "INVALID_EVENT_TIME"
          : deriveEventState(eventRecord, nowIso, imminentThresholdMinutes);

        eventRecord.display_times = eventRecord.scheduled_at_utc ? {
          uk: formatZoneTimestamp(eventRecord.scheduled_at_utc, "Europe/London"),
          et: formatZoneTimestamp(eventRecord.scheduled_at_utc, "America/New_York")
        } : {
          uk: null,
          et: null
        };

        eventRecord.in_scope = eventIsInScope(eventRecord, nowIso, options.panelTimeZone || "Europe/London");
        return eventRecord;
      })
      .sort((left, right) => {
        const leftPriority = SUMMARY_PRIORITY[left.state] ?? 99;
        const rightPriority = SUMMARY_PRIORITY[right.state] ?? 99;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return String(left.scheduled_at_utc || "").localeCompare(String(right.scheduled_at_utc || ""));
      });
  }

  function summarizeEvents(events, sourceState = "UNKNOWN") {
    if (sourceState === "SOURCE_UNAVAILABLE" || sourceState === "FAILED" || sourceState === "UNKNOWN") {
      return {
        panel_state: "SOURCE_UNAVAILABLE",
        total_events_in_scope: 0,
        unresolved_event_count: 0,
        highest_priority_event_id: null
      };
    }

    if (sourceState === "STALE") {
      return {
        panel_state: "STALE_SOURCE",
        total_events_in_scope: 0,
        unresolved_event_count: 0,
        highest_priority_event_id: null
      };
    }

    if (sourceState === "DEGRADED" && !events.length) {
      return {
        panel_state: "INVALID_SOURCE",
        total_events_in_scope: 0,
        unresolved_event_count: 0,
        highest_priority_event_id: null
      };
    }

    const inScope = events.filter((event) => event.in_scope);
    if (!inScope.length) {
      return {
        panel_state: "NO_MAJOR_EVENTS",
        total_events_in_scope: 0,
        unresolved_event_count: 0,
        highest_priority_event_id: null
      };
    }

    const highestPriority = inScope[0];
    const unresolvedCount = inScope.filter((event) => !["CLEARED", "UPCOMING", "EVENT_IMMINENT"].includes(event.state)).length;
    return {
      panel_state: highestPriority.state,
      total_events_in_scope: inScope.length,
      unresolved_event_count: unresolvedCount,
      highest_priority_event_id: highestPriority.event_id
    };
  }

  function buildRefreshArtifact(input = {}) {
    const layer1Payload = asObject(input.layer1);
    const rawEvents = asArray(input.events);
    const policy = asObject(input.policy);
    const options = asObject(input.options);
    const sourceConfig = { ...DEFAULT_SOURCE, ...asObject(input.sourceConfig) };
    const generatedAt = toIsoString(input.generatedAt || new Date()) || new Date().toISOString();
    const sourceRunId = stringOrNull(input.sourceRunId || layer1Payload.source_run_id || layer1Payload.dashboard_meta?.source_run_id);
    const layer1GeneratedAt = stringOrNull(input.layer1GeneratedAt || layer1Payload.generated_at || layer1Payload.dashboard_meta?.generated_at || layer1Payload.dashboard_meta?.last_updated_et);
    const consistencyStatus = stringOrNull(input.consistencyStatus)
      || (sourceRunId && stringOrNull(layer1Payload.source_run_id) && sourceRunId !== stringOrNull(layer1Payload.source_run_id) ? "MISMATCHED" : "MATCHED");
    const consistencyWarnings = unique(asArray(input.consistencyWarnings));

    const sourceStatus = stringOrNull(sourceConfig.source_status) || (rawEvents.length ? "HEALTHY" : "UNKNOWN");
    const groupedEvents = buildGroupedEvents(rawEvents, layer1Payload, policy, {
      ...options,
      now: generatedAt,
      sourceConfig
    });
    const inScopeEvents = groupedEvents.filter((event) => event.in_scope);
    const agents = normalizeAgentEvidence(layer1Payload);
    const summaryWarnings = unique([
      ...groupedEvents.flatMap((event) => event.data_quality_warnings || []),
      ...(rawEvents.length ? [] : ["no_source_rows_available"])
    ]);
    const summary = summarizeEvents(groupedEvents, sourceStatus);

    return {
      schema_version: 1,
      generated_at: generatedAt,
      source_run_id: sourceRunId,
      layer1_generated_at: layer1GeneratedAt,
      consistency_status: consistencyStatus,
      consistency_warnings: consistencyWarnings,
      event_source: {
        name: sourceConfig.source_name,
        source_status: sourceStatus,
        source_timezone: sourceConfig.source_timezone_label,
        source_timezone_kind: sourceConfig.source_timezone_kind,
        source_timezone_offset_minutes: sourceConfig.source_timezone_offset_minutes,
        policy_version: policy.version,
        rows_seen: rawEvents.length
      },
      summary: {
        ...summary,
        imminent_threshold_minutes: Number.isFinite(Number(options.imminentThresholdMinutes))
          ? Number(options.imminentThresholdMinutes)
          : DEFAULT_IMMINENT_THRESHOLD_MINUTES,
        selection_rule: "Include today's in-scope major events, unresolved earlier-today or previous-day events, and future events that fall within at least one affected agent's active forecast window.",
        data_quality_warnings: summaryWarnings
      },
      agents,
      events: inScopeEvents
    };
  }

  return {
    DEFAULT_SOURCE,
    DEFAULT_IMMINENT_THRESHOLD_MINUTES,
    VALID_STATES: Array.from(VALID_STATES),
    validatePolicy,
    deriveCanonicalEventTime,
    normalizeEventRow,
    normalizeAgentEvidence,
    buildGroupedEvents,
    buildRefreshArtifact,
    formatZoneTimestamp
  };
});
