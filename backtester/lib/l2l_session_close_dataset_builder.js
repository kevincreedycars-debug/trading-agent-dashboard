"use strict";

const crypto = require("crypto");
const { CONTRACT_VERSION, filterEligibleSessionCloseRecords } = require("./l2l_session_close_dataset_contract");

const DATASET_VERSION = "l2l-session-close-dataset-v1";

function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function countByReason(assessments) {
  return assessments.reduce((counts, item) => {
    const reason = item.assessment.reason || "ELIGIBLE";
    counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});
}

function buildSessionCloseDataset(records, source = {}) {
  const assessments = filterEligibleSessionCloseRecords(records);
  const included = assessments
    .filter((item) => item.assessment.eligible)
    .map((item) => ({ ...item.record, label: item.assessment.label }));
  const excluded = assessments
    .filter((item) => !item.assessment.eligible)
    .map((item) => ({
      recordId: item.record?.recordId || null,
      assetCode: item.record?.assetCode || null,
      reason: item.assessment.reason,
      featureName: item.assessment.featureName || null
    }));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      version: DATASET_VERSION,
      contractVersion: CONTRACT_VERSION,
      researchOnly: true,
      dashboardModelUpdated: false,
      intendedUse: "Pre-session features for session-open-to-close directional research only."
    },
    lineage: {
      inputRecordCount: Array.isArray(records) ? records.length : 0,
      inputSha256: sha256Json(records || []),
      sourceDescription: source.description || null,
      sourceArtifactPaths: Array.isArray(source.artifactPaths) ? source.artifactPaths : []
    },
    coverage: {
      includedRecordCount: included.length,
      excludedRecordCount: excluded.length,
      assessmentsByReason: countByReason(assessments)
    },
    included,
    excluded
  };
}

function validateSessionCloseDataset(dataset) {
  const errors = [];
  if (dataset?.meta?.version !== DATASET_VERSION) errors.push(`Expected version ${DATASET_VERSION}`);
  if (dataset?.meta?.contractVersion !== CONTRACT_VERSION) errors.push(`Expected contract ${CONTRACT_VERSION}`);
  if (dataset?.meta?.researchOnly !== true) errors.push("Dataset must remain research-only.");
  if (dataset?.meta?.dashboardModelUpdated !== false) errors.push("Dataset must not claim to update the dashboard model.");
  if (!Array.isArray(dataset?.included) || !Array.isArray(dataset?.excluded)) errors.push("Dataset rows are missing.");
  if ((dataset?.coverage?.includedRecordCount || 0) !== (dataset?.included || []).length) errors.push("Included count mismatch.");
  if ((dataset?.coverage?.excludedRecordCount || 0) !== (dataset?.excluded || []).length) errors.push("Excluded count mismatch.");
  return errors;
}

module.exports = {
  DATASET_VERSION,
  buildSessionCloseDataset,
  validateSessionCloseDataset
};
