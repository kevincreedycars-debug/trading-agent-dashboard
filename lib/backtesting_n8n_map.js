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

  var VERSION = "backtesting-n8n-map-v2";
  // The registry is the only place a model list lives; this fallback is used only when an older evidence
  // file carries no identities block at all.
  var MODELS = ["challenger", "challenger_v1"];

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Every model a case actually returned, with its role, so a fixture can be labelled as one. */
  function caseModels(caseEntry) {
    if (!caseEntry || !caseEntry.models) return [];
    return Object.keys(caseEntry.models).map(function (key) {
      var model = caseEntry.models[key] || {};
      return {
        key: key,
        identity: model.identity || key,
        role: model.role || (String(key).indexOf("fixture") === 0 ? "fixture" : "challenger"),
        kind: model.kind || null,
        fixture: model.fixture === true || (model.kind || (String(key).indexOf("fixture") === 0 ? "fixture" : null)) === "fixture",
        status: model.status || null,
        execution_id: model.execution_id || null
      };
    });
  }

  function selectionSummary(evidence) {
    var selected = asArray(evidence && evidence.identities && evidence.identities.selected);
    var research = selected.filter(function (entry) { return entry.role !== "fixture"; });
    var fixtures = selected.filter(function (entry) { return entry.role === "fixture"; });
    return {
      models: selected.map(function (entry) {
        return { key: entry.key, identity: entry.id, label: entry.label, role: entry.role };
      }),
      research_models: research.map(function (entry) { return entry.key; }),
      fixture_models: fixtures.map(function (entry) { return entry.key; }),
      fixture_present: fixtures.length > 0,
      note: fixtures.length
        ? "A fixture is registered beside the books to prove the selection is configurable. It is labelled a fixture everywhere and is excluded from research comparisons."
        : "No fixture is part of this selection."
    };
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
      var suffix = entry.role === "fixture" ? " · FIXTURE (not a research model)" : "";
      return { key: entry.key, label: entry.label + " · " + entry.id + suffix, id: entry.id, role: entry.role };
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
    var others = Object.keys(caseEntry.models).filter(function (key) { return key !== option.key; }).map(function (key) {
      return caseEntry.models[key];
    });
    var other = others[0] || null;
    var otherSummary = others.length
      ? others.map(function (entry) { return entry.identity + " · " + entry.status + " · " + (entry.call.direction || "—"); }).join(" | ")
      : "not returned";
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
        node("comparison", "Other selected models", "comparison", others.length ? "verified" : "missing",
          otherSummary,
          others.map(function (entry) { return entry.workflow_name; }),
          others.map(function (entry) { return { label: entry.identity, href: entry.execution_url }; })),
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
    var selection = selectionSummary(evidence);
    return {
      structural: evidence.historical_validity.structural_accepted + " / " + evidence.source_dataset.sessions,
      receipted: evidence.historical_validity.receipted_complete + " / " + evidence.source_dataset.sessions,
      late: evidence.historical_validity.sessions_with_stamped_print_after_cutoff,
      parity: evidence.reproduction.parity.decision_matches + " / " + evidence.reproduction.parity.checked,
      performance: evidence.performance.status,
      selected_models: selection.research_models.length + (selection.fixture_present ? " + 1 fixture" : ""),
      fixture: selection.fixture_present ? "registered and labelled a fixture" : "none",
      h1: "not invoked"
    };
  }

  /**
   * Every recorded morning with the model that answered it, for the execution map. Each node keeps its
   * parent and child execution links so a reader can trace a date from the panel through validation to
   * the decision and its outcomes.
   */
  function dateEvidence(evidence) {
    // The ledger index is the complete list of recorded mornings. The curated cases are richer but fewer,
    // so they are only used when no index is present.
    var cases = asArray(evidence && evidence.execution_index);
    if (!cases.length) cases = asArray(evidence && evidence.execution_cases);
    var nodes = [];
    var edges = [];
    cases.forEach(function (entry) {
      var dateId = "date:" + entry.id;
      nodes.push({
        id: dateId,
        label: entry.date,
        kind: "date",
        status: entry.outcome,
        date: entry.date,
        summary: entry.date + " · " + entry.label + " · " + entry.validation_mode + " · " + entry.outcome,
        files: [entry.raw_evidence],
        links: [{ label: "Parent execution " + entry.parent_execution.id, href: entry.parent_execution.url }]
      });
      Object.keys(entry.models || {}).forEach(function (key) {
        var model = entry.models[key];
        var id = dateId + ":" + key;
        var call = model.call || model;
        nodes.push({
          id: id,
          label: model.label || model.identity || key,
          kind: model.fixture ? "fixture" : "model",
          status: model.status,
          date: entry.date,
          summary: (model.identity || key) + " · " + model.status + " · " + (call.direction || "—")
            + " · conviction " + (call.conviction === null || call.conviction === undefined ? "—" : call.conviction),
          files: model.source ? [model.source] : [],
          links: [
            { label: "Child execution " + model.execution_id, href: model.execution_url },
            { label: "Workflow " + (model.workflow_name || model.identity || key), href: model.workflow_url }
          ]
        });
        edges.push({ from: dateId, to: id, label: model.fixture ? "fixture replay" : "replay", status: model.status });
      });
    });
    return { nodes: nodes, edges: edges };
  }

  return {
    VERSION: VERSION,
    MODELS: MODELS,
    caseOptions: caseOptions,
    selectCase: selectCase,
    caseModels: caseModels,
    selectionSummary: selectionSummary,
    dateEvidence: dateEvidence,
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
