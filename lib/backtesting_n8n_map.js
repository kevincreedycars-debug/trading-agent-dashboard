// USD Layer 1 n8n map: the view model behind the Backtesting page's Layer 1 map tab.
// Pure functions over one committed evidence summary. Research only: this is an inspection surface
// over recorded n8n executions and the stored panel, not a second score and not a live control.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.BacktestingN8nMap = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "backtesting-n8n-map-v1";
  var MODELS = ["challenger", "challenger_v1"];

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function caseOptions(evidence) {
    return asArray(evidence && evidence.execution_cases).map(function (entry) {
      return {
        id: entry.id,
        label: entry.date + " · " + entry.label,
        date: entry.date,
        validation: entry.validation_mode,
        outcome: entry.outcome
      };
    });
  }

  function selectCase(evidence, caseId) {
    var cases = asArray(evidence && evidence.execution_cases);
    if (!cases.length) return null;
    return cases.find(function (entry) { return entry.id === caseId; }) || cases[0];
  }

  function modelOptions(evidence) {
    return asArray(evidence && evidence.identities && evidence.identities.selected).map(function (entry) {
      return { key: entry.key, label: entry.label + " · " + entry.id, id: entry.id };
    });
  }

  function selectModel(evidence, modelKey) {
    var options = modelOptions(evidence);
    if (!options.length) return null;
    return options.find(function (entry) { return entry.key === modelKey; }) || options[0];
  }

  function selectedCaseModel(caseEntry, modelKey) {
    return caseEntry && caseEntry.models ? caseEntry.models[modelKey] || null : null;
  }

  function statusForDecision(model) {
    if (!model) return "missing";
    if (model.status === "blocked" || model.status === "abstained" || model.status === "allowed") return model.status;
    return model.status || "missing";
  }

  function validationStatus(model) {
    return model && model.validation && model.validation.accepted ? "accepted" : "blocked";
  }

  function statusLabel(value) {
    return String(value || "missing").replace(/_/g, " ");
  }

  function node(id, label, kind, status, summary, files, links) {
    return { id: id, label: label, kind: kind, status: status, summary: summary, files: files || [], links: links || [] };
  }

  function graph(evidence, caseId, modelKey) {
    var caseEntry = selectCase(evidence, caseId);
    var option = selectModel(evidence, modelKey);
    var model = selectedCaseModel(caseEntry, option ? option.key : "challenger");
    if (!caseEntry || !model) return { nodes: [], edges: [] };
    var selected = asArray(evidence.identities.selected).find(function (entry) { return entry.key === option.key; }) || {};
    var otherKey = option.key === "challenger" ? "challenger_v1" : "challenger";
    var other = caseEntry.models[otherKey];
    var input = model.validation || {};
    var tests = asArray(evidence.four_backtests);
    var failureCodes = asArray(input.reasons).join(", ") || "none";
    var outcomes = model.outcomes || {};
    var results = model.results || {};
    var marketSummary = ["EURUSD", "XAUUSD", "BTCUSD", "NAS100"].map(function (key) {
      var outcome = outcomes[key] || {};
      return key + " " + (outcome.direction || "—") + " → " + (results[key] || "not scored");
    }).join(" · ");
    var testSummary = tests.map(function (test) { return test.ordinal + " " + test.status; }).join(" · ");
    var decisionStatus = statusForDecision(model);
    var validationOk = validationStatus(model) === "accepted";

    return {
      nodes: [
        node("dataset", "Committed morning panel", "source", "verified",
          evidence.source_dataset.sessions + " sessions · " + evidence.source_dataset.first + " → " + evidence.source_dataset.last,
          [evidence.source_dataset.path]),
        node("parent", "Paired controller", "workflow", caseEntry.parent_execution.status === "success" ? "verified" : "blocked",
          "n8n " + caseEntry.parent_execution.id + " · " + caseEntry.parent_execution.status,
          ["automation/n8n/usd-l1-paired-controller.cloud.workflow.json"],
          [{ label: "Workflow", href: evidence.workflows.parent.url }, { label: "Execution " + caseEntry.parent_execution.id, href: caseEntry.parent_execution.url }]),
        node("child", selected.label || model.identity, "model", decisionStatus,
          model.identity + " · " + statusLabel(model.status) + (model.call.direction && model.call.direction !== "NO_CALL" ? " · " + model.call.direction : ""),
          [selected.source],
          [{ label: "Child workflow", href: selected.workflow_url }, { label: "Execution " + model.execution_id, href: model.execution_url }]),
        node("validation", "Independent validation", "check", validationOk ? "accepted" : "blocked",
          validationOk ? "accepted · " + input.present_inputs + "/" + input.declared_inputs + " inputs present" : "blocked · " + failureCodes,
          ["backtester/lib/usd_layer1_backtester/backtest_controller.js"]),
        node("decision", "Decision", "decision", decisionStatus,
          statusLabel(model.status) + " · " + (model.call.direction || "—") + " · conviction " + (model.call.conviction === null ? "—" : model.call.conviction)),
        node("outcomes", "Outcome datasets", "outcome", model.results ? "scored" : decisionStatus,
          marketSummary, ["data/usd-layer1-backtester/run-v1.json"]),
        node("tests", "Four backtests", "tests", tests.some(function (test) { return test.status === "blocked"; }) ? "partial" : "verified",
          testSummary, ["data/usd-layer1-backtester/backtesting-screen-v1.json"]),
        node("execution", "Execution transcript", "evidence", caseEntry.parent_execution.status === "success" ? "verified" : "blocked",
          "Parent " + caseEntry.parent_execution.id + " · child " + model.execution_id,
          [caseEntry.raw_evidence, "data/usd-layer1-backtester/n8n/executions-index-20261119.json"],
          [{ label: "Parent execution", href: caseEntry.parent_execution.url }, { label: "Child execution", href: model.execution_url }]),
        node("comparison", "Other frozen version", "comparison", other ? statusForDecision(other) : "missing",
          other ? other.identity + " · " + other.status + " · " + (other.call.direction || "—") : "not returned",
          other ? [other.workflow_name] : [],
          other ? [{ label: "Other execution", href: other.execution_url }] : []),
        node("h1", "H1 candidate — not invoked", "excluded", "not_invoked",
          "Separate unscored identity · never substituted for a challenger",
          ["docs/research/usd-session/h1/v0.1.1/PROPOSAL.md"])
      ],
      edges: [
        { from: "dataset", to: "validation", label: "saved morning", status: "verified" },
        { from: "parent", to: "child", label: "calls", status: "verified" },
        { from: "validation", to: "child", label: "gate", status: validationOk ? "verified" : "blocked" },
        { from: "child", to: "decision", label: "evaluates", status: decisionStatus },
        { from: "decision", to: "outcomes", label: "scores", status: model.results ? "verified" : "blocked" },
        { from: "decision", to: "comparison", label: "compare", status: "verified" },
        { from: "outcomes", to: "tests", label: "feeds", status: "verified" },
        { from: "parent", to: "execution", label: "records", status: "verified" },
        { from: "child", to: "execution", label: "records", status: "verified" },
        { from: "h1", to: "decision", label: "not used", status: "not_invoked" }
      ]
    };
  }

  function validationRows(model) {
    if (!model) return [];
    var input = model.validation || {};
    return [
      { label: "Cutoff (UTC)", value: input.cutoff_at_utc || "—", status: input.accepted ? "accepted" : "blocked" },
      { label: "Contract cutoff", value: input.contract_cutoff_at_utc || "—", status: input.accepted ? "accepted" : "blocked" },
      { label: "Structural", value: String(input.structural_accepted), status: input.structural_accepted ? "accepted" : "blocked" },
      { label: "Receipted", value: input.receipted_complete ? "complete" : "incomplete", status: input.receipted_complete ? "accepted" : "blocked" },
      { label: "Inputs present", value: String(input.present_inputs) + " / " + String(input.declared_inputs), status: input.present_inputs === input.declared_inputs ? "accepted" : "blocked" },
      { label: "Stamped before cutoff", value: String(input.stamped_before_cutoff) + " / " + String(input.present_inputs), status: input.stamped_before_cutoff === input.present_inputs ? "accepted" : "blocked" },
      { label: "Failure codes", value: asArray(input.reasons).join(", ") || "none", status: asArray(input.reasons).length ? "blocked" : "accepted" },
      { label: "Unclocked keys", value: asArray(input.unclocked_keys).join(", ") || "none", status: asArray(input.unclocked_keys).length ? "blocked" : "accepted" }
    ];
  }

  function resultRows(model) {
    if (!model) return [];
    var outcomes = model.outcomes || {};
    var results = model.results || {};
    return ["EURUSD", "XAUUSD", "BTCUSD", "NAS100"].map(function (key) {
      var outcome = outcomes[key] || {};
      return {
        market: key,
        direction: outcome.direction || "—",
        move: outcome.move_pct === null || outcome.move_pct === undefined ? "—" : outcome.move_pct + "%",
        result: results[key] || "not scored",
        status: results[key] || "blocked"
      };
    });
  }

  function ruleRows(evidence, modelKey) {
    return asArray(evidence && evidence.model_rules && evidence.model_rules[modelKey]).map(function (rule) {
      return { id: rule.id, label: rule.label, input: rule.input, threshold: rule.threshold, rule: rule.rule, weight: rule.weight };
    });
  }

  function testRows(evidence) {
    return asArray(evidence && evidence.four_backtests).map(function (test) {
      return {
        ordinal: test.ordinal,
        label: test.label,
        status: test.status,
        usable_sessions: test.usable_sessions,
        outcome_source: test.outcome_source,
        question: test.question
      };
    });
  }

  function headline(evidence) {
    if (!evidence) return null;
    return {
      structural: evidence.historical_validity.structural_accepted + " / " + evidence.source_dataset.sessions,
      receipted: evidence.historical_validity.receipted_complete + " / " + evidence.source_dataset.sessions,
      late: evidence.historical_validity.sessions_with_stamped_print_after_cutoff,
      parity: evidence.reproduction.parity.decision_matches + " / " + evidence.reproduction.parity.checked,
      performance: evidence.performance.status,
      h1: "not invoked"
    };
  }

  return {
    VERSION: VERSION,
    MODELS: MODELS,
    caseOptions: caseOptions,
    selectCase: selectCase,
    modelOptions: modelOptions,
    selectModel: selectModel,
    selectedCaseModel: selectedCaseModel,
    statusForDecision: statusForDecision,
    statusLabel: statusLabel,
    graph: graph,
    validationRows: validationRows,
    resultRows: resultRows,
    ruleRows: ruleRows,
    testRows: testRows,
    headline: headline
  };
});
