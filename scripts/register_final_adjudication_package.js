#!/usr/bin/env node
'use strict';

/**
 * Register the 2026-11-04 USD final adjudication package in the committed Research Library.
 *
 * The package is 27 registered inputs: twenty-five factor adjudications, the final analysis and the final
 * red-team. The final adjudication is their output and is verified separately, so it is never counted among
 * them. On 2026-11-08 every registry-driven reader still reported "0 of 25" because these ids had never been
 * written to `data/research-library/documents.json`, even though the adjudication's own header names them.
 *
 * Two facts shape how they are registered here:
 *
 *  - The bytes are not in this checkout. They live in the hosted research store and, for the two final stages,
 *    on `research/usd-f2-stage1-20261103`. A record therefore stores the declared id, version and SHA-256 as
 *    `storage: "referenced"`: a citation, not a copy, and never a claimed download.
 *  - A record is not a delivered stage. Each factor adjudication judged a red-team document this checkout does
 *    not hold, so no `stage` is claimed and no chain progress moves. Registration answers "does the library
 *    know this document exists"; only a stage record with its parent answers "was it judged".
 *
 * Every hash is checked before anything is written: the manifest is compared against the three stage headers
 * in the same package, and the two final-stage documents whose bytes are reachable are re-hashed from their
 * git blobs. A second import is a no-op, and every record stays private (`public_download: false`).
 *
 * usage:
 *   node scripts/register_final_adjudication_package.js --check   # verify, register nothing
 *   node scripts/register_final_adjudication_package.js --write   # verify, then write the registry
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ResearchLibrary = require('../lib/research_library.js');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = 'data/research/usd-session/final-adjudication-manifest.json';
const REGISTRY_PATH = 'data/research-library/documents.json';
const CATALOG_PATH = 'data/research-library/catalog.json';
const PACKAGE_ID = 'usd-final-adjudication-20261104';
const REGISTERED_AT = '2026-11-10';
const FINAL_CHAIN_ID = 'usd-final-asset-analysis';
const STAGE3_PATH =
  'docs/research/final/usd/final-asset-analysis/USD_Asset_Level_Final_Adjudication_Stage3_2026-11-04.md';

/** The documents in the package whose bytes this checkout can reach, keyed by the role the manifest gives them. */
const FINAL_STAGES = Object.freeze([
  Object.freeze({
    role: 'final_analysis',
    commit: '1db5db6f',
    repo_path: 'docs/research/final/usd/final-asset-analysis/USD_Asset_Level_Final_Analysis_Stage1_2026-11-04.md',
    document_type: 'report',
    title: 'USD asset-level final analysis, stage 1 of 3, 2026-11-04'
  }),
  Object.freeze({
    role: 'final_red_team',
    commit: '0918f206',
    repo_path: 'docs/research/final/usd/final-asset-analysis/USD_Asset_Level_Final_Red_Team_Stage2_2026-11-04.md',
    document_type: 'review',
    title: 'USD asset-level final red-team, stage 2 of 3, 2026-11-04'
  }),
  Object.freeze({
    role: 'final_adjudication',
    commit: 'ce300a2c',
    repo_path: STAGE3_PATH,
    document_type: 'synthesis',
    title: 'USD asset-level final adjudication, stage 3 of 3, 2026-11-04'
  })
]);

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** The exact bytes of a document on another branch, read through git so no newline is rewritten. */
function gitBlob(commit, repoPath) {
  return execFileSync('git', ['cat-file', 'blob', `${commit}:${repoPath}`], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024
  });
}


const FACTOR_LINE =
  /^(?:Supporting adjudication read|Adjudication read): (.+?) - ([0-9a-f-]{36}) - version ([0-9]+) - sha256 ([0-9a-f]{64})$/;
const ANALYSIS_LINE = /^Final analysis: ([0-9a-f-]{36}) - version ([0-9]+) - sha256 ([0-9a-f]{64})$/;
const RED_TEAM_LINE = /^Final red-team: ([0-9a-f-]{36}) - version ([0-9]+) - sha256 ([0-9a-f]{64})$/;

/**
 * Read the machine-readable header each stage document opens with.
 *
 * The three stages were written to different prompts, so they name the same evidence under three labels. All
 * three carry " - version n - sha256 ...", which is what makes them comparable rather than merely similar.
 */
function parseHeader(text) {
  const lines = String(text).split(/\r?\n/);
  const factors = [];
  let finalAnalysis = null;
  let finalRedTeam = null;
  let chain = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) break;
    const factorMatch = trimmed.match(FACTOR_LINE);
    if (factorMatch) {
      factors.push({
        factor_id: factorMatch[1].trim(),
        document_id: factorMatch[2],
        version: Number(factorMatch[3]),
        sha256: factorMatch[4],
        role: "factor_adjudication"
      });
      continue;
    }
    const analysisMatch = trimmed.match(ANALYSIS_LINE);
    if (analysisMatch) {
      finalAnalysis = {
        document_id: analysisMatch[1],
        version: Number(analysisMatch[2]),
        sha256: analysisMatch[3]
      };
      continue;
    }
    const redTeamMatch = trimmed.match(RED_TEAM_LINE);
    if (redTeamMatch) {
      finalRedTeam = {
        document_id: redTeamMatch[1],
        version: Number(redTeamMatch[2]),
        sha256: redTeamMatch[3]
      };
      continue;
    }
    const reviewed = trimmed.match(/^Reviewed final analysis: ([0-9a-f-]{36})$/);
    if (reviewed) {
      finalAnalysis = { document_id: reviewed[1], version: null, sha256: null };
      continue;
    }
    const reviewedVersion = trimmed.match(/^Reviewed final analysis version: ([0-9]+)$/);
    if (reviewedVersion && finalAnalysis) {
      finalAnalysis.version = Number(reviewedVersion[1]);
      continue;
    }
    const reviewedHash = trimmed.match(/^Reviewed final analysis sha256: ([0-9a-f]{64})$/);
    if (reviewedHash && finalAnalysis) {
      finalAnalysis.sha256 = reviewedHash[1];
      continue;
    }
    const chainMatch = trimmed.match(/^(?:Adjudicated|Reviewed|Synthesis) chain: (\S+)$/);
    if (chainMatch) chain = chainMatch[1];
  }
  return { chain, factors, final_analysis: finalAnalysis, final_red_team: finalRedTeam };
}

function keyOf(entry) {
  return entry.document_id + "|" + entry.version + "|" + entry.sha256;
}

function compareSets(label, expected, actual, problems) {
  const wanted = new Set(expected.map(keyOf));
  const found = new Set(actual.map(keyOf));
  const missing = [...wanted].filter((key) => !found.has(key));
  const extra = [...found].filter((key) => !wanted.has(key));
  if (missing.length) {
    problems.push(label + " does not carry " + missing.length + " input(s) the manifest names: " + missing.slice(0, 3).join(", "));
  }
  if (extra.length) {
    problems.push(label + " names " + extra.length + " input(s) the manifest does not carry: " + extra.slice(0, 3).join(", "));
  }
  return { missing, extra };
}


/**
 * Verify the manifest against the package itself.
 *
 * Nothing is trusted from the manifest alone: the twenty-five ids and hashes are required to appear identically
 * in all three stage headers, the two final stages have to name each other the way the chain says, and the
 * documents whose bytes are reachable are re-hashed. The adjudication's own content hash is computed the same
 * way and recorded as the output identity, never as an input.
 */
function verifyPackage({ manifest = readJson(MANIFEST_PATH), catalog = readJson(CATALOG_PATH) } = {}) {
  const problems = [];
  const inputs = Array.isArray(manifest.registered_inputs) ? manifest.registered_inputs : [];
  const factorInputs = inputs.filter((entry) => entry.role === "factor_adjudication");
  const finalInputs = inputs.filter((entry) => entry.role !== "factor_adjudication");

  if (inputs.length !== 27) problems.push("the manifest must carry 27 registered inputs, found " + inputs.length);
  if (factorInputs.length !== 25) problems.push("the manifest must carry 25 factor adjudications, found " + factorInputs.length);
  if (finalInputs.length !== 2) problems.push("the manifest must carry 2 final stages, found " + finalInputs.length);
  const ids = new Set(inputs.map((entry) => entry.document_id));
  if (ids.size !== inputs.length) problems.push("two registered inputs share a document id");
  for (const entry of inputs) {
    if (!/^[0-9a-f]{64}$/.test(String(entry.sha256 || ""))) problems.push(entry.document_id + " has no sha256");
    if (Number(entry.version) !== 1) problems.push(entry.document_id + " must be version 1, found " + entry.version);
  }
  const counts = manifest.counts || {};
  if (Number(counts.total) !== inputs.length || Number(counts.factor_adjudications) !== factorInputs.length) {
    problems.push("the manifest counts block disagrees with its own list");
  }

  const catalogFactorIds = new Set((catalog.factor_chains || []).map((chain) => chain.factor_id));
  const manifestFactorIds = new Set(factorInputs.map((entry) => entry.factor_id));
  const unknownFactors = [...manifestFactorIds].filter((id) => !catalogFactorIds.has(id));
  const uncovered = [...catalogFactorIds].filter((id) => !manifestFactorIds.has(id));
  if (unknownFactors.length) problems.push("the manifest names factors the catalogue does not carry: " + unknownFactors.join(", "));
  if (uncovered.length) problems.push("the catalogue has factors the manifest does not adjudicate: " + uncovered.join(", "));

  const stages = {};
  for (const stage of FINAL_STAGES) {
    let bytes = null;
    try {
      bytes = gitBlob(stage.commit, stage.repo_path);
    } catch (error) {
      problems.push(stage.role + ": " + stage.repo_path + " is not reachable at " + stage.commit);
      continue;
    }
    const header = parseHeader(bytes.toString("utf8"));
    stages[stage.role] = { ...stage, header, bytes: bytes.length, sha256: sha256(bytes) };
    if (!header.chain) problems.push(stage.role + ": the header does not name the chain it belongs to");
    else if (header.chain !== FINAL_CHAIN_ID) {
      problems.push(stage.role + ": the header names " + header.chain + ", expected " + FINAL_CHAIN_ID);
    }
  }


  const analysisStage = stages.final_analysis;
  const redTeamStage = stages.final_red_team;
  const adjudicationStage = stages.final_adjudication;
  const finalAnalysisEntry = finalInputs.find((entry) => entry.role === "final_analysis");
  const finalRedTeamEntry = finalInputs.find((entry) => entry.role === "final_red_team");

  // The two final stages whose bytes are held have to hash to what the manifest claims, or the manifest is not
  // describing the package the reader is looking at.
  for (const [entry, stage] of [
    [finalAnalysisEntry, analysisStage],
    [finalRedTeamEntry, redTeamStage]
  ]) {
    if (!entry || !stage) continue;
    if (stage.sha256 !== entry.sha256) {
      problems.push(entry.role + ": the blob hashes to " + stage.sha256 + ", the manifest says " + entry.sha256);
    }
  }

  if (analysisStage) compareSets("the stage 1 header", factorInputs, analysisStage.header.factors, problems);
  if (redTeamStage) {
    compareSets("the stage 2 header", factorInputs, redTeamStage.header.factors, problems);
    const reviewed = redTeamStage.header.final_analysis || {};
    if (
      !finalAnalysisEntry ||
      reviewed.document_id !== finalAnalysisEntry.document_id ||
      Number(reviewed.version) !== Number(finalAnalysisEntry.version) ||
      reviewed.sha256 !== finalAnalysisEntry.sha256
    ) {
      problems.push("the stage 2 header does not name the final analysis the manifest carries");
    }
  }
  if (adjudicationStage) {
    compareSets("the stage 3 header", factorInputs, adjudicationStage.header.factors, problems);
    const named = adjudicationStage.header.final_analysis || {};
    if (
      !finalAnalysisEntry ||
      named.document_id !== finalAnalysisEntry.document_id ||
      Number(named.version) !== Number(finalAnalysisEntry.version) ||
      named.sha256 !== finalAnalysisEntry.sha256
    ) {
      problems.push("the stage 3 header does not name the final analysis the manifest carries");
    }
    const redTeam = adjudicationStage.header.final_red_team || {};
    if (
      !finalRedTeamEntry ||
      redTeam.document_id !== finalRedTeamEntry.document_id ||
      Number(redTeam.version) !== Number(finalRedTeamEntry.version) ||
      redTeam.sha256 !== finalRedTeamEntry.sha256
    ) {
      problems.push("the stage 3 header does not name the final red-team the manifest carries");
    }
  }

  // The adjudication is the package's output, so it can never appear among its own inputs.
  for (const entry of inputs) {
    if (entry.repo_path === STAGE3_PATH || (adjudicationStage && entry.document_id === adjudicationStage.document_id)) {
      problems.push(entry.document_id + " is the adjudication itself and cannot be one of its inputs");
    }
  }
  const output = manifest.output || null;
  if (!output) problems.push("the manifest carries no output block, so the adjudication is not recorded as its output");
  else if (adjudicationStage && output.sha256 !== adjudicationStage.sha256) {
    problems.push("the manifest records the adjudication as " + output.sha256 + ", the blob hashes to " + adjudicationStage.sha256);
  }

  return {
    problems,
    manifest,
    catalog,
    stages,
    inputs,
    factor_inputs: factorInputs,
    final_inputs: finalInputs,
    output: {
      repo_path: STAGE3_PATH,
      commit: adjudicationStage ? adjudicationStage.commit : FINAL_STAGES[2].commit,
      sha256: adjudicationStage ? adjudicationStage.sha256 : null,
      bytes: adjudicationStage ? adjudicationStage.bytes : null,
      declared_inputs: adjudicationStage ? adjudicationStage.header.factors.length : 0,
      registered_as_input: false
    },
    content_verified: [analysisStage, redTeamStage].filter(Boolean).length
  };
}

function topicForFactor(catalog, factorId) {
  const topic = (catalog.topics || []).find((entry) => (entry.factor_ids || []).includes(factorId));
  return topic ? topic.topic_id : null;
}

function chainForFactor(catalog, factorId) {
  const chain = (catalog.factor_chains || []).find((entry) => entry.factor_id === factorId);
  return chain || null;
}

function titleFor(catalog, entry, finalStage) {
  if (finalStage) return finalStage.title;
  const chain = chainForFactor(catalog, entry.factor_id);
  return chain && chain.title ? "Adjudication: " + chain.title : "Adjudication: " + entry.factor_id;
}

/**
 * Build one registry record per input.
 *
 * "referenced" is the library's own word for "this id is real, its bytes are elsewhere". No stage is claimed:
 * the parent each factor adjudication judged is a red-team document this checkout does not hold, so claiming
 * the stage would assert a review nobody here can open.
 */
function recordFor(entry, verification) {
  const { catalog } = verification;
  const finalStage = FINAL_STAGES.find((stage) => stage.role === entry.role);
  const isFactor = entry.role === "factor_adjudication";
  const chain = isFactor ? chainForFactor(catalog, entry.factor_id) : null;
  const stageIntent = finalStage && finalStage.role !== "final_adjudication" ? finalStage.role : "adjudication";
  const versionNote = finalStage
    ? "declared by the 2026-11-04 package; the bytes are reachable at " + finalStage.commit + " and were re-hashed"
    : "declared by the 2026-11-04 stage-3 header; the bytes stay in the hosted store";
  return {
    document_id: entry.document_id,
    asset: "USD",
    factor_id: isFactor ? entry.factor_id : null,
    topic_id: isFactor ? topicForFactor(catalog, entry.factor_id) : null,
    chain_id: isFactor ? (chain ? chain.chain_id : null) : FINAL_CHAIN_ID,
    stage: null,
    document_type: finalStage ? finalStage.document_type : "synthesis",
    title: titleFor(catalog, entry, finalStage),
    note:
      "Registered from the 2026-11-04 USD final adjudication package. The record is a citation: the bytes are " +
      "not held here, no delivered stage is claimed, and nothing is public. Registration is not validation.",
    origin: "hosted_research_store",
    storage: "referenced",
    reference_note:
      "Cited from the 2026-11-04 USD final adjudication package: the stage-3 header names this document id, " +
      "version and SHA-256. The bytes stay in the hosted research store at research/usd-f2-stage1-20261103. " +
      "The record cites a document that exists; it claims no delivered stage here, so no chain progress moves.",
    public_download: false,
    registered_at: REGISTERED_AT,
    updated_at: REGISTERED_AT,
    provenance: {
      package_id: PACKAGE_ID,
      role: entry.role,
      stage_intent: stageIntent,
      parent_stage: isFactor ? "red_team" : entry.role === "final_red_team" ? "final_analysis" : null,
      parent_held: false,
      bytes_held: false,
      stage_document: STAGE3_PATH,
      source_branch: "research/usd-f2-stage1-20261103",
      source_commit: FINAL_STAGES[2].commit,
      manifest: MANIFEST_PATH,
      verified_at: REGISTERED_AT
    },
    versions: [
      {
        version: Number(entry.version),
        sha256: entry.sha256,
        bytes: null,
        registered_at: REGISTERED_AT,
        note: versionNote
      }
    ]
  };
}

/** Insert the missing records, leave identical ones alone, and refuse to overwrite a different hash. */
function registerPackage(verification, registry) {
  const problems = [];
  const documentList = Array.isArray(registry.documents) ? registry.documents : [];
  const byId = new Map(documentList.map((document) => [document.document_id, document]));
  const added = [];
  const unchanged = [];
  const conflicts = [];

  for (const entry of verification.inputs) {
    const wanted = recordFor(entry, verification);
    const current = byId.get(wanted.document_id);
    if (!current) {
      documentList.push(wanted);
      byId.set(wanted.document_id, wanted);
      added.push(wanted.document_id);
      continue;
    }
    const currentVersion = (Array.isArray(current.versions) ? current.versions : [])
      .find((version) => Number(version.version) === Number(entry.version));
    if (!currentVersion) {
      conflicts.push(wanted.document_id + " is already registered without version " + entry.version);
      continue;
    }
    if (currentVersion.sha256 !== entry.sha256) {
      conflicts.push(
        wanted.document_id + " is already registered with " + currentVersion.sha256 + ", the package says " + entry.sha256
      );
      continue;
    }
    if (current.public_download === true) {
      conflicts.push(wanted.document_id + " is marked public and this package registers private evidence");
      continue;
    }
    unchanged.push(wanted.document_id);
  }

  // The committed registry is written in the same order the library's own seed uses: repo-backed documents
  // first, then everything else by id. Keeping that order is what lets "registry --check" stay green.
  documentList.sort((left, right) => {
    const leftRank = left.storage === "repo_path" ? 0 : 1;
    const rightRank = right.storage === "repo_path" ? 0 : 1;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return String(left.document_id).localeCompare(String(right.document_id));
  });

  problems.push(...conflicts);
  return {
    registry: { ...registry, documents: documentList },
    added,
    unchanged,
    conflicts,
    problems
  };
}

/** What the registry now says about the package, counted rather than asserted. */
function summarise(verification, registry) {
  const documentList = Array.isArray(registry.documents) ? registry.documents : [];
  const byId = new Map(documentList.map((document) => [document.document_id, document]));
  let factorRegistered = 0;
  let inputsRegistered = 0;
  let privateCount = 0;
  const missing = [];
  for (const entry of verification.inputs) {
    const document = byId.get(entry.document_id);
    const version =
      document &&
      (Array.isArray(document.versions) ? document.versions : []).find(
        (candidate) => Number(candidate.version) === Number(entry.version)
      );
    if (!document || !version || version.sha256 !== entry.sha256) {
      missing.push(entry.document_id);
      continue;
    }
    inputsRegistered += 1;
    if (entry.role === "factor_adjudication") factorRegistered += 1;
    if (document.public_download !== true) privateCount += 1;
  }
  const ids = documentList.map((document) => document.document_id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  return {
    package_id: PACKAGE_ID,
    registered_inputs: inputsRegistered,
    inputs_total: verification.inputs.length,
    factor_adjudications_registered: factorRegistered,
    factor_adjudications_total: verification.factor_inputs.length,
    missing,
    duplicates: [...new Set(duplicates)],
    private_documents: privateCount,
    public_documents: inputsRegistered - privateCount,
    content_verified: verification.content_verified,
    output: verification.output
  };
}

function main(flag) {
  const registry = readJson(REGISTRY_PATH);
  const verification = verifyPackage();
  if (verification.problems.length) {
    console.log("package verification: " + verification.problems.length + " problem(s)");
    verification.problems.forEach((problem) => console.log("  - " + problem));
    return 1;
  }
  console.log(
    "package verification: ok - " + verification.inputs.length + " inputs (" + verification.factor_inputs.length +
      " factor adjudications + " + verification.final_inputs.length + " final stages), " + verification.content_verified +
      " documents re-hashed from git, output " + String(verification.output.sha256).slice(0, 12) + " not counted among the inputs"
  );

  const result = registerPackage(verification, registry);
  if (result.problems.length) {
    result.problems.forEach((problem) => console.log("  - " + problem));
    return 1;
  }
  const validation = ResearchLibrary.validateDocuments(result.registry, verification.catalog);
  if (validation.length) {
    console.log("registry validation: " + validation.length + " problem(s)");
    validation.forEach((problem) => console.log("  - " + problem));
    return 1;
  }
  console.log("registry validation: ok");

  if (flag === "--write") {
    fs.writeFileSync(absolute(REGISTRY_PATH), JSON.stringify(result.registry, null, 2) + "\n");
    console.log(
      "registry written: " + REGISTRY_PATH + " (" + result.added.length + " added, " + result.unchanged.length + " already registered)"
    );
  } else {
    console.log("registry check: " + result.added.length + " to add, " + result.unchanged.length + " already registered");
  }

  const summary = summarise(verification, result.registry);
  console.log(
    summary.factor_adjudications_registered + "/" + summary.factor_adjudications_total + " factor adjudications registered, " +
      summary.registered_inputs + "/" + summary.inputs_total + " inputs registered, " +
      summary.public_documents + " public, " + summary.duplicates.length + " duplicate id(s)"
  );
  return summary.registered_inputs === summary.inputs_total && summary.duplicates.length === 0 ? 0 : 1;
}

module.exports = {
  PACKAGE_ID,
  REGISTERED_AT,
  MANIFEST_PATH,
  REGISTRY_PATH,
  CATALOG_PATH,
  FINAL_STAGES,
  STAGE3_PATH,
  parseHeader,
  verifyPackage,
  registerPackage,
  summarise
};

if (require.main === module) {
  const flag = process.argv[2];
  if (flag !== "--write" && flag !== "--check") {
    console.log("usage: node scripts/register_final_adjudication_package.js <--check|--write>");
    process.exit(1);
  }
  process.exit(main(flag));
}
