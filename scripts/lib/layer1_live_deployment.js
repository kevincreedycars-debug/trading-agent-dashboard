"use strict";

/**
 * Live deployment guardrails for layer 1 workflow updates.
 *
 * An n8n public-API workflow update replaces the workflow body: the request has to carry every node and
 * the whole connection map. A payload assembled from only the nodes the change touches deletes every
 * other node - for the USD layer 1 agent, sending 4 of the 9 nodes drops the other 5: the
 * execute-workflow trigger, both Supabase nodes, the GitHub logic-document call and the model call go,
 * while the connection map keeps pointing at them.
 *
 * `assertPayloadCoversWorkflow` refuses a payload that does not carry every node of the workflow it was
 * planned from, `verifySavedWorkflow` refuses a saved workflow that lost, reordered or altered a node,
 * and `verifyExecutingVersion` refuses to call an update applied while the version the instance executes
 * has not moved. All three also run before the write, because a post-update check alone runs too late.
 *
 * The publishing model is measured, not assumed:
 *
 *   draft_published  the instance keeps a draft (`versionId`) apart from the version it executes
 *                    (`activeVersionId`) and its copy of that executing version (`activeVersion`)
 *   single_version   the workflow is one object; `versionId` is the executing version
 *
 * An update into a draft_published instance can land in the draft while the executing version stays
 * put, so an update only counts as applied when the executing version changed and its published copy
 * matches the payload node for node.
 *
 * A write is never verified from its own response. `PUT /api/v1/workflows/{id}` answers with the body it
 * stored, and on a draft_published instance that body is the draft, not the version the instance
 * executes, so the caller reads the workflow back after every write attempt and verifies both copies
 * from that read. A write that is rejected or times out leaves the state unknown - the instance may hold
 * the payload, the backup, or something in between - so the workflow is read to establish the actual
 * state before anything else is written.
 *
 * A rollback is verified the same way, and by content rather than by version id. `verifyRestoredWorkflow`
 * compares the restored draft and the copy the instance actually executes against the backup's own
 * executing copy - nodes, connections and settings - because restoring the draft alone reports success
 * while the executing version still runs the failed code, and writing the draft cannot put the executing
 * version back at all. A restore that republishes the backed-up body legitimately gives the executing
 * version a new id, so the ids are recorded for audit (`executing_version_id_backup`,
 * `executing_version_id_current`, `executing_version_reused`) instead of being required to match.
 */

const {hash} = require("./btc_rate_limit_repair");

const PUBLISHING_MODELS = ["draft_published", "single_version"];

// Keys the API is allowed to add or normalise on the way back. Anything ignored is recorded in the
// comparison report instead of silently accepted.
const VOLATILE_NODE_KEYS = ["webhookId"];

function stripVolatile(node) {
  const copy = {...node};
  for (const key of VOLATILE_NODE_KEYS) delete copy[key];
  return copy;
}

// A key that only one side carries has to hash the same way "absent" does on both sides.
function stableValue(value) {
  return value === undefined ? null : value;
}

// The workflow settings, or an empty object when the copy does not expose them: some instances return the
// executing copy without settings, and a copy that carries none compares as absent rather than as a
// failed rollback.
function settingsOf(view) {
  return view && typeof view === "object" && view.settings && typeof view.settings === "object"
    ? view.settings
    : {};
}

function asNodes(value, label) {
  if (!value || !Array.isArray(value.nodes)) throw new Error(`${label} must expose a nodes array.`);
  return value.nodes;
}

function describeNode(node) {
  return `${node?.name ?? "unnamed"} (${node?.id ?? "no id"})`;
}

/**
 * The two copies a draft_published instance keeps apart: `draftViewOf` is the body the next edit lands
 * in, `executingViewOf` is the version the instance runs. A single_version instance is one object, so
 * both views are that object.
 */
function draftViewOf(workflow, model) {
  const publishingModel = model || detectPublishingModel(workflow).model;
  if (publishingModel === "single_version") return workflow;
  return workflow?.draftVersion && Array.isArray(workflow.draftVersion.nodes) ? workflow.draftVersion : workflow;
}

function executingViewOf(workflow, model) {
  const publishingModel = model || detectPublishingModel(workflow).model;
  if (publishingModel === "single_version") return workflow;
  return workflow?.activeVersion ?? null;
}

// Older exports carry nodes without ids. An id only constrains the comparison when both sides have one.
function identityProblem(expected, actual) {
  if (expected.name !== actual.name || expected.type !== actual.type) return "identity";
  if (expected.id !== undefined && actual.id !== undefined && expected.id !== actual.id) return "id";
  return null;
}

/**
 * Compares two node lists by order, identity and content, ignoring only the recorded volatile keys.
 */
function compareNodeLists(expectedNodes, actualNodes, label) {
  const problems = [];
  const ignored = [];
  if (actualNodes.length !== expectedNodes.length) {
    problems.push(`${label} carries ${actualNodes.length} nodes instead of ${expectedNodes.length}`);
  }
  const limit = Math.min(expectedNodes.length, actualNodes.length);
  for (let index = 0; index < limit; index += 1) {
    const expected = expectedNodes[index];
    const actual = actualNodes[index];
    const mismatch = identityProblem(expected, actual);
    if (mismatch) {
      problems.push(`node ${index} is ${describeNode(actual)} instead of ${describeNode(expected)}`);
      continue;
    }
    const expectedContent = stripVolatile(expected);
    const actualContent = stripVolatile(actual);
    if (hash(expectedContent) !== hash(actualContent)) {
      const differing = Object.keys({...expectedContent, ...actualContent})
        .filter((key) => hash(stableValue(expectedContent[key])) !== hash(stableValue(actualContent[key])));
      problems.push(`${describeNode(expected)} changed outside the intended edit (${differing.join(", ") || "unknown field"})`);
    }
    for (const key of VOLATILE_NODE_KEYS) {
      if (hash(stableValue(expected[key])) !== hash(stableValue(actual[key]))) {
        ignored.push(`${describeNode(expected)}.${key}`);
      }
    }
  }
  const expectedIds = expectedNodes.map((node) => node.id);
  if (expectedIds.every((id) => id !== undefined) && hash(expectedIds) !== hash(actualNodes.map((node) => node.id))) {
    problems.push(`${label} changed the node order`);
  }
  return {equal: problems.length === 0, problems, volatile_keys_ignored: ignored};
}

/**
 * Refuses any payload that does not carry the whole workflow it was planned from.
 * This is the check that a payload of the code nodes alone fails.
 */
function assertPayloadCoversWorkflow(workflow, payload, options = {}) {
  const source = asNodes(workflow, "The workflow");
  const sent = asNodes(payload, "The deployment payload");
  const label = options.label || "The deployment payload";
  const problems = [];
  if (sent.length !== source.length) {
    problems.push(`${label} carries ${sent.length} of ${source.length} nodes`);
  }
  const covered = new Set();
  for (const [index, node] of sent.entries()) {
    if (node.id !== undefined) {
      if (covered.has(node.id)) problems.push(`node id ${node.id} appears twice in ${label}`);
      covered.add(node.id);
    }
    const original = source[index];
    if (!original) {
      problems.push(`${label} adds ${describeNode(node)}, which the workflow does not have`);
      continue;
    }
    if (node.id !== undefined && original.id !== undefined && node.id !== original.id) {
      const at = source.findIndex((candidate) => candidate.id === node.id);
      problems.push(at >= 0
        ? `${describeNode(node)} moved from position ${at} to position ${index}`
        : `${label} adds ${describeNode(node)}, which the workflow does not have`);
      continue;
    }
    if (original.name !== node.name || original.type !== node.type) {
      problems.push(`position ${index} carries ${describeNode(node)} where the workflow has ${describeNode(original)}`);
      continue;
    }
    const before = stripVolatile({...original, parameters: {...(original.parameters || {})}});
    const after = stripVolatile({...node, parameters: {...(node.parameters || {})}});
    delete before.parameters.jsCode;
    delete after.parameters.jsCode;
    if (hash(before) !== hash(after)) {
      problems.push(`${describeNode(original)} is changed outside parameters.jsCode`);
    }
  }
  if (hash(payload.connections ?? {}) !== hash(workflow.connections ?? {})) {
    problems.push("the payload does not keep the workflow connections");
  }
  if (problems.length) {
    throw new Error(`The deployment payload does not cover the workflow: ${problems.join("; ")}. A workflow update replaces the whole body, so every node and the whole connection map must be sent.`);
  }
  return {
    nodes_in_workflow: source.length,
    nodes_in_payload: sent.length,
    code_nodes_in_payload: sent.filter((node) => typeof node.parameters?.jsCode === "string").length,
    non_code_nodes_in_payload: sent.filter((node) => typeof node.parameters?.jsCode !== "string").length,
    node_order_preserved: true,
    connections_preserved: true
  };
}

function detectPublishingModel(workflow) {
  if (!workflow || typeof workflow !== "object") throw new Error("An n8n workflow response is required.");
  const hasActiveVersionObject = Boolean(workflow.activeVersion && Array.isArray(workflow.activeVersion.nodes));
  const hasActiveVersionId = typeof workflow.activeVersionId === "string" && workflow.activeVersionId.length > 0;
  const publishHistory = workflow.activeVersion?.workflowPublishHistory;
  return {
    model: hasActiveVersionObject || hasActiveVersionId ? "draft_published" : "single_version",
    evidence: {
      has_active_version_object: hasActiveVersionObject,
      has_active_version_id: hasActiveVersionId,
      draft_version_id: workflow.versionId ?? null,
      active_version_id: workflow.activeVersionId ?? null,
      version_counter: Number.isFinite(Number(workflow.versionCounter)) ? Number(workflow.versionCounter) : null,
      publish_history_entries: Array.isArray(publishHistory) ? publishHistory.length : null,
      published_copy_nodes: hasActiveVersionObject ? workflow.activeVersion.nodes.length : null
    }
  };
}

function executingVersionOf(workflow, model) {
  const publishingModel = model || detectPublishingModel(workflow).model;
  const executingId = publishingModel === "draft_published"
    ? workflow.activeVersionId ?? null
    : workflow.versionId ?? null;
  return {
    publishing_model: publishingModel,
    executing_version_id: executingId,
    draft_version_id: workflow.versionId ?? null,
    active_version_id: workflow.activeVersionId ?? null,
    version_counter: Number.isFinite(Number(workflow.versionCounter)) ? Number(workflow.versionCounter) : null,
    active: Boolean(workflow.active),
    nodes_sha256: hash(workflow.nodes ?? []),
    connections_sha256: hash(workflow.connections ?? {})
  };
}

/**
 * The saved workflow must still be the payload: no node lost, none added, none altered outside the
 * intended jsCode change, and the connection map unchanged.
 */
function verifySavedWorkflow(payload, saved, context = {}) {
  const label = context.label || "The saved workflow";
  const comparison = compareNodeLists(payload.nodes, asNodes(saved, label), label);
  const connectionsEqual = hash(saved.connections ?? {}) === hash(payload.connections ?? {});
  if (!comparison.equal || !connectionsEqual) {
    const problems = [...comparison.problems];
    if (!connectionsEqual) problems.push("the connections changed");
    throw new Error(`${label} does not match the payload: ${problems.join("; ")}`);
  }
  return {
    verified: true,
    nodes_verified: payload.nodes.length,
    code_nodes_verified: payload.nodes.filter((node) => typeof node.parameters?.jsCode === "string").length,
    connections_preserved: true,
    volatile_keys_ignored: comparison.volatile_keys_ignored
  };
}

function assertPublishedCopyMatchesPayload(afterWorkflow, payload, model) {
  const published = executingViewOf(afterWorkflow, model);
  if (!published || !Array.isArray(published.nodes)) {
    throw new Error("The instance did not return the copy of the executing version; the update cannot be verified.");
  }
  return verifySavedWorkflow(payload, published, {label: "The executing version of the workflow"});
}

/**
 * Confirms that the version the instance executes actually carries the payload.
 * Returns `status: "draft_only_requires_publish"` when the draft moved but the executing version did
 * not: that is not an applied update, and the caller must stop rather than continue to the next engine.
 */
function verifyExecutingVersion({before, afterWorkflow, payload, expectedPublishingModel}) {
  const detected = detectPublishingModel(afterWorkflow);
  const after = executingVersionOf(afterWorkflow, detected.model);
  if (expectedPublishingModel && !PUBLISHING_MODELS.includes(expectedPublishingModel)) {
    throw new Error(`Unknown expected publishing model ${JSON.stringify(expectedPublishingModel)}.`);
  }
  if (expectedPublishingModel && detected.model !== expectedPublishingModel) {
    throw new Error(`The workflow is ${detected.model} but the run expected ${expectedPublishingModel}; the update cannot be verified.`);
  }
  const report = {
    publishing_model: detected.model,
    publishing_evidence: detected.evidence,
    executing_version_before: before.executing_version_id,
    executing_version_after: after.executing_version_id,
    draft_version_before: before.draft_version_id,
    draft_version_after: after.draft_version_id,
    version_counter_before: before.version_counter,
    version_counter_after: after.version_counter,
    executing_version_changed: after.executing_version_id !== before.executing_version_id,
    draft_version_changed: after.draft_version_id !== before.draft_version_id,
    requires_publish: false,
    draft_copy_verified: false,
    published_copy_verified: false
  };
  if (report.executing_version_changed) {
    report.published_copy_verified = assertPublishedCopyMatchesPayload(afterWorkflow, payload, detected.model).verified;
    report.status = "applied_and_published";
    return report;
  }
  if (detected.model === "single_version") {
    // One object: an unchanged versionId means the instance did not store the payload at all.
    throw new Error("The workflow version did not change; the instance may have rejected the update.");
  }
  // The draft moved but the executing version did not. The published copy legitimately still holds the
  // previous nodes, so it is not compared; the draft must carry the payload, and a publish is required.
  if (!report.draft_version_changed) {
    report.status = "unchanged";
    report.requires_publish = true;
    return report;
  }
  const draft = draftViewOf(afterWorkflow, detected.model);
  report.draft_copy_verified = verifySavedWorkflow(payload, draft, {label: "The draft of the workflow"}).verified;
  report.requires_publish = true;
  report.status = "draft_only_requires_publish";
  return report;
}

/**
 * Verifies a rollback on both copies the instance keeps, against the backup taken before the update.
 *
 * The backup is the whole workflow as it was read, so it carries the copy the instance was executing as
 * well as the draft. A restore writes the draft, and on a draft_published instance that leaves the
 * executing version running whatever it ran before - the failed code, if the update had been published -
 * so a rollback that is only checked against the draft reports success while the wrong code still
 * executes.
 *
 * The verdict is about restored content, not about version ids. A restore that republishes the backed-up
 * body legitimately creates a new executing version id, so `rollback_verified` requires the draft and the
 * executing copy to carry the backed-up nodes, connections and settings, and the ids are recorded for
 * audit instead: `executing_version_id_backup`, `executing_version_id_current` and
 * `executing_version_reused` say which version the instance was able to execute again. When the draft is
 * back and the executing copy is not, the rollback needs a publish and is reported as unverified rather
 * than verified.
 */
function verifyRestoredWorkflow({backup, current}) {
  const detected = detectPublishingModel(current);
  const model = detected.model;
  const problems = [];
  const contentMatches = (expected, actual, label) => {
    try {
      return verifySavedWorkflow(expected, actual, {label}).verified;
    } catch (error) {
      problems.push(error.message);
      return false;
    }
  };
  const settingsMatch = (expected, actual, label) => {
    if (hash(settingsOf(expected)) === hash(settingsOf(actual))) return true;
    problems.push(`${label} does not carry the backed-up settings.`);
    return false;
  };
  const backupDraft = draftViewOf(backup, model);
  const currentDraft = draftViewOf(current, model);
  const draftContentVerified = contentMatches(backupDraft, currentDraft, "The restored draft of the workflow");
  const draftSettingsVerified = settingsMatch(backupDraft, currentDraft, "The restored draft of the workflow");
  const backupExecuting = executingViewOf(backup, model);
  const currentExecuting = executingViewOf(current, model);
  let executingContentVerified = false;
  let executingSettingsVerified = false;
  if (!backupExecuting || !Array.isArray(backupExecuting.nodes)) {
    problems.push("The backup does not carry the copy of the executing version, so a rollback cannot be verified against it.");
  } else if (!currentExecuting || !Array.isArray(currentExecuting.nodes)) {
    problems.push("The instance did not return the copy of the executing version, so a rollback cannot be verified.");
  } else {
    executingContentVerified = contentMatches(backupExecuting, currentExecuting,
      "The restored executing version of the workflow");
    executingSettingsVerified = settingsMatch(backupExecuting, currentExecuting,
      "The restored executing version of the workflow");
  }
  const draftVerified = draftContentVerified && draftSettingsVerified;
  const executingCopyVerified = executingContentVerified && executingSettingsVerified;
  const backupVersions = executingVersionOf(backup, model);
  const currentVersions = executingVersionOf(current, model);
  return {
    publishing_model: model,
    rollback_verified: draftVerified && executingCopyVerified,
    draft_verified: draftVerified,
    draft_settings_verified: draftSettingsVerified,
    executing_copy_verified: executingCopyVerified,
    executing_settings_verified: executingSettingsVerified,
    // Recorded, not required: republishing the backed-up content under a new version id is a verified
    // rollback as long as the content of both copies is the backup's.
    executing_version_id_backup: backupVersions.executing_version_id,
    executing_version_id_current: currentVersions.executing_version_id,
    executing_version_reused: backupVersions.executing_version_id === currentVersions.executing_version_id,
    draft_version_id_backup: backupVersions.draft_version_id,
    draft_version_id_current: currentVersions.draft_version_id,
    version_counter_backup: backupVersions.version_counter,
    version_counter_current: currentVersions.version_counter,
    nodes_sha256_backup: backupVersions.nodes_sha256,
    nodes_sha256_current: currentVersions.nodes_sha256,
    rollback_requires_publish: model === "draft_published" && draftVerified && !executingCopyVerified,
    rollback_problems: problems
  };
}

/**
 * Everything that can be established before any write. Any refusal here leaves the instance untouched:
 * the payload covers the whole workflow, it changes only the jsCode the plan intends, and the measured
 * publishing model matches what the run expects.
 */
function deploymentPreflight({engine, workflow, plan, expectedPublishing}) {
  if (!plan || !plan.payload) throw new Error(`Engine ${engine} has no deployment payload.`);
  const coverage = assertPayloadCoversWorkflow(workflow, plan.payload);
  const detected = detectPublishingModel(workflow);
  const intendedCodeChanges = plan.summary.repaired.slice().sort();
  const actualCodeChanges = (plan.payload_code_changes || []).slice().sort();
  if (hash(intendedCodeChanges) !== hash(actualCodeChanges)) {
    throw new Error(`Deployment preflight refused for ${engine}: the payload changes the jsCode of ` +
      `${actualCodeChanges.join(", ") || "no node"} but the plan intends ${intendedCodeChanges.join(", ") || "no node"}.`);
  }
  if (expectedPublishing && !PUBLISHING_MODELS.includes(expectedPublishing)) {
    throw new Error(`Unknown expected publishing model ${JSON.stringify(expectedPublishing)}; use one of ${PUBLISHING_MODELS.join(", ")}.`);
  }
  if (expectedPublishing && detected.model !== expectedPublishing) {
    throw new Error(`Deployment preflight refused for ${engine}: the instance is ${detected.model} but the run ` +
      `expected ${expectedPublishing}. Record the measured publishing behaviour before applying.`);
  }
  return {
    engine,
    workflow_id: workflow.id ?? null,
    workflow_name: workflow.name ?? null,
    workflow_active: Boolean(workflow.active),
    ...coverage,
    publishing_model: detected.model,
    publishing_evidence: detected.evidence,
    executing_version: executingVersionOf(workflow, detected.model),
    code_nodes_scanned: plan.summary.codeNodes,
    intended_code_changes: intendedCodeChanges,
    already_applied: plan.summary.alreadyApplied
  };
}

module.exports = {
  PUBLISHING_MODELS,
  VOLATILE_NODE_KEYS,
  assertPayloadCoversWorkflow,
  assertPublishedCopyMatchesPayload,
  compareNodeLists,
  deploymentPreflight,
  detectPublishingModel,
  draftViewOf,
  executingVersionOf,
  executingViewOf,
  verifyExecutingVersion,
  verifyRestoredWorkflow,
  verifySavedWorkflow
};
