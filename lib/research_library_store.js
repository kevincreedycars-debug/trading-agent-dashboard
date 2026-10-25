'use strict';

// Node-side durable store for the Research Library.
//
// Two things are kept apart on purpose:
//   - the registry (data/research-library/documents.json): metadata only, versioned, hashes, no content,
//     so it can be committed and read by the panel on the published page;
//   - the objects (root/objects/<aa>/<sha256>): the uploaded bytes, ignored by Git, treated as research
//     evidence, never rewritten and never served without the service token.
//
// Every write is atomic, every version is immutable, and a repeated upload of identical bytes is a
// no-op that returns the version that already exists.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ResearchLibrary = require('../lib/research_library.js');

const SCHEMA_VERSION = 'research-library-documents-v1';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_DOCUMENT_TYPES = ['report', 'review', 'synthesis', 'experiment', 'issue_register', 'context_package'];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function todayStamp(now) {
  const value = typeof now === 'function' ? now() : new Date();
  return new Date(value).toISOString().slice(0, 10);
}

function slug(value) {
  // The id is a label, never a path: separators are folded, dot runs are removed, and the object path is
  // always derived from the content hash instead.
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^[.\-_]+/, '')
    .replace(/[.\-_]+$/, '');
}

function inputVersionRecord(document, version) {
  if (!document) return null;
  return (Array.isArray(document.versions) ? document.versions : [])
    .find(entry => Number(entry.version) === Number(version)) || null;
}

function createStore(options = {}) {
  const root = path.resolve(options.root || path.join(process.cwd(), '.local', 'research-library'));
  const registryPath = path.resolve(options.registryPath || path.join(process.cwd(), 'data', 'research-library', 'documents.json'));
  const storageContract = options.storageContract || {};
  const now = options.now;

  function ensureRoot() {
    fs.mkdirSync(path.join(root, 'objects'), { recursive: true });
  }

  function readRegistry() {
    if (!fs.existsSync(registryPath)) {
      return { schema_version: SCHEMA_VERSION, storage_contract: storageContract, documents: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (!Array.isArray(parsed.documents)) parsed.documents = [];
    parsed.storage_contract = { ...storageContract, ...(parsed.storage_contract || {}) };
    return parsed;
  }

  function writeRegistry(registry) {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    const temp = `${registryPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temp, `${JSON.stringify(registry, null, 2)}\n`);
    fs.renameSync(temp, registryPath);
  }

  function objectPathFor(hash) {
    return path.join(root, 'objects', hash.slice(0, 2), hash);
  }

  function writeObject(bytes) {
    const hash = sha256(bytes);
    const target = objectPathFor(hash);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) {
      const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(temp, bytes);
      fs.renameSync(temp, target);
    }
    return { hash, bytes: bytes.length, path: target, relative: path.relative(root, target).replace(/\\/g, '/') };
  }

  function decodeContent(payload) {
    if (typeof payload.content_base64 === 'string' && payload.content_base64.length) {
      return Buffer.from(payload.content_base64, 'base64');
    }
    if (typeof payload.content_text === 'string') {
      return Buffer.from(payload.content_text, 'utf8');
    }
    return null;
  }

  function taskPromptSha256(catalog, taskId) {
    const task = (catalog?.tasks || []).find(entry => String(entry.task_id) === String(taskId));
    if (!task) return null;
    return sha256(Buffer.from(String(task.prompt), 'utf8'));
  }
  // STORE_ANCHOR
  function registerUpload(payload, catalog) {
    const problems = [];
    const registry = readRegistry();
    const documentId = slug(payload.document_id);
    const asset = String(payload.asset || '').trim().toUpperCase();
    const documentType = String(payload.document_type || '').trim();
    const title = String(payload.title || '').trim();
    const model = String(payload.model || '').trim();
    const taskId = payload.task_id ? String(payload.task_id).trim() : '';
    const factorId = payload.factor_id ? String(payload.factor_id).trim() : '';
    const topicId = payload.topic_id ? String(payload.topic_id).trim() : '';
    const stageId = payload.stage ? String(payload.stage).trim() : '';
    const parentDocumentId = payload.parent_document_id ? String(payload.parent_document_id).trim() : '';
    const parentVersion = Number.isFinite(Number(payload.parent_version)) && Number(payload.parent_version) >= 1
      ? Number(payload.parent_version)
      : null;
    const openFindings = Array.isArray(payload.open_findings)
      ? payload.open_findings.map(entry => String(entry).trim()).filter(Boolean)
      : [];
    const inputDocumentsPayload = Array.isArray(payload.input_documents)
      ? payload.input_documents.map(entry => ({
        document_id: entry && entry.document_id ? String(entry.document_id).trim() : '',
        version: Number(entry && entry.version),
        sha256: entry && entry.sha256 ? String(entry.sha256).trim() : '',
        role: entry && entry.role ? String(entry.role).trim() : '',
        role_stage: entry && entry.role_stage ? String(entry.role_stage).trim() : ''
      })).filter(entry => entry.document_id)
      : [];

    if (!documentId) problems.push('document_id is required');
    if (!asset) problems.push('asset is required');
    if (!UPLOAD_DOCUMENT_TYPES.includes(documentType)) {
      problems.push(`document_type must be one of ${UPLOAD_DOCUMENT_TYPES.join(', ')}`);
    }
    if (!title) problems.push('title is required');
    if (['report', 'review', 'synthesis'].includes(documentType) && !model) {
      problems.push('model is required for a returned research document');
    }

    const tasks = Array.isArray(catalog?.tasks) ? catalog.tasks : [];
    const factors = (catalog?.assets || []).flatMap(entry => entry.factors || []);
    const topics = Array.isArray(catalog?.topics) ? catalog.topics : [];
    const task = taskId ? tasks.find(entry => String(entry.task_id) === taskId) : null;
    if (taskId && !task) problems.push(`task_id ${taskId} is not in the catalog`);
    if (factorId && !factors.some(factor => String(factor.factor_id) === factorId)) {
      problems.push(`factor_id ${factorId} is not in the catalog`);
    }

    // A stage document names its chain: a factor chain through factor_id (or its chain_id), the asset-level
    // final chain through chain_id alone. Every stage after the first names the exact version of the parent
    // it judged, because that pairing is the link the page shows as "which version this review read".
    const chainId = payload.chain_id ? String(payload.chain_id).trim() : '';
    const topic = topicId ? topics.find(entry => String(entry.topic_id) === topicId) : null;
    const finalSpec = ResearchLibrary.finalChain(catalog);
    let chain = null;
    if (topicId && !topic) problems.push(`topic_id ${topicId} is not in the catalog`);
    if (topicId && !stageId) problems.push('stage is required when a topic is given');
    if (stageId && !factorId && !chainId) problems.push('factor_id or chain_id is required when a stage is given');
    if (chainId && !stageId) problems.push('stage is required when a chain is given');
    if (chainId) {
      chain = finalSpec && String(finalSpec.chain_id) === chainId
        ? finalSpec
        : ResearchLibrary.factorChainById(catalog, chainId);
      if (!chain) problems.push(`chain_id ${chainId} is not in the catalog`);
      const onFinalChain = Boolean(chain && !chain.factor_id);
      if (onFinalChain && factorId) problems.push('the asset-level final chain must not name a factor');
      if (onFinalChain && topicId) problems.push('the asset-level final chain must not name a topic');
    } else if (factorId) {
      chain = ResearchLibrary.factorChainForFactor(catalog, factorId);
      if (!chain) problems.push(`factor ${factorId} carries no research chain`);
    }
    if (chain && topicId && chain.factor_id && String(chain.topic_id || '') !== topicId) {
      problems.push(`factor ${chain.factor_id} is not grouped under topic ${topicId}`);
    }
    if (chain && stageId) {
      const chainLabel = chain.factor_id ? `factor ${chain.factor_id}` : `final chain ${chainId}`;
      const stage = ResearchLibrary.chainStageById(chain, stageId);
      if (!stage) {
        problems.push(`${chainLabel} has no ${stageId} stage`);
      } else {
        if (String(stage.document_type) !== documentType) {
          problems.push(`the ${stageId} stage of ${chainLabel} expects a ${stage.document_type} document, not ${documentType}`);
        }
        const parentStageId = String(stage.parent_stage || '');
        if (!parentStageId && parentDocumentId) problems.push(`the ${stageId} stage of ${chainLabel} has no parent document`);
        if (parentStageId) {
          if (!parentDocumentId) problems.push(`the ${stageId} stage of ${chainLabel} must name the ${parentStageId} document it judged`);
          if (parentVersion === null) problems.push(`the ${stageId} stage of ${chainLabel} must name the version of ${parentStageId} it judged`);
          const parent = parentDocumentId
            ? registry.documents.find(entry => entry.document_id === slug(parentDocumentId))
            : null;
          if (parentDocumentId && !parent) {
            problems.push(`parent document ${parentDocumentId} is not registered`);
          } else if (parent) {
            const sameChain = chain.factor_id
              ? String(parent.factor_id || '') === String(chain.factor_id)
              : String(parent.chain_id || '') === String(chain.chain_id);
            if (!sameChain) problems.push(`parent document ${parentDocumentId} belongs to another chain`);
            if (String(parent.stage || '') !== parentStageId) problems.push(`parent document ${parentDocumentId} is not the ${parentStageId} stage`);
            const versions = Array.isArray(parent.versions) ? parent.versions : [];
            if (parentVersion !== null && !versions.some(entry => Number(entry.version) === parentVersion)) {
              problems.push(`parent document ${parentDocumentId} has no version ${parentVersion}`);
            }
          }
        }
        // The final chain is gated by the whole factor register, and each final stage records the exact
        // input package it judged: the earlier final stages plus every factor-chain adjudication.
        if (!chain.factor_id) {
          const gate = ResearchLibrary.finalChainStatus(catalog, registry);
          if (!gate || !gate.unlocked) {
            problems.push('the final chain is locked until every factor chain is complete against current versions');
          }
          const requiredInputs = ResearchLibrary.stageInputDocuments(chain, stageId, registry, catalog).filter(entry => !entry.missing);
          const requiredById = new Map(requiredInputs.map(entry => [entry.document_id, entry]));
          if (!inputDocumentsPayload.length) {
            problems.push(`the ${stageId} stage of ${chainLabel} must name its input package`);
          }
          inputDocumentsPayload.forEach(entry => {
            const expected = requiredById.get(slug(entry.document_id));
            if (!expected) {
              problems.push(`input document ${entry.document_id} is not part of the ${stageId} input package`);
              return;
            }
            if (!Number.isFinite(entry.version) || entry.version < 1) {
              problems.push(`input document ${entry.document_id} must name the version judged`);
            } else if (entry.version !== expected.version) {
              problems.push(`input document ${entry.document_id} has changed: the package names v${entry.version}, the registry has v${expected.version}`);
            }
            if (entry.sha256 && expected.sha256 && entry.sha256 !== expected.sha256) {
              problems.push(`input document ${entry.document_id} has changed: the package sha256 does not match the registry`);
            }
          });
          const missingInputs = requiredInputs.filter(expected => !inputDocumentsPayload.some(entry => slug(entry.document_id) === expected.document_id));
          if (missingInputs.length) {
            problems.push(`the ${stageId} input package is missing ${missingInputs.map(entry => entry.document_id).join(', ')}`);
          }
        }
      }
    }
    // The chain is the authority on which factor it belongs to: an upload that names only the chain still
    // records the factor, so the registry can always place the document on exactly one chain.
    const resolvedFactorId = factorId || (chain && chain.factor_id ? String(chain.factor_id) : '');
    const resolvedChainId = chain && chain.chain_id ? String(chain.chain_id) : '';
    let contextVersion = '';
    let promptSha256 = null;
    if (task) {
      contextVersion = String(task.context_version || '');
      if (payload.context_version && String(payload.context_version) !== contextVersion) {
        problems.push(`context_version ${payload.context_version} does not match the catalog task version ${contextVersion}`);
      }
      promptSha256 = taskPromptSha256(catalog, task.task_id);
    }

    const bytes = decodeContent(payload);
    if (!bytes) problems.push('content_base64 or content_text is required');
    if (bytes && bytes.length > MAX_UPLOAD_BYTES) problems.push(`upload is larger than ${MAX_UPLOAD_BYTES} bytes`);
    if (bytes && bytes.length === 0) problems.push('upload is empty');
    if (problems.length) {
      const error = new Error(problems.join('; '));
      error.problems = problems;
      error.statusCode = 400;
      throw error;
    }

    ensureRoot();
    const object = writeObject(bytes);
    const parentDocument = parentDocumentId
      ? registry.documents.find(entry => entry.document_id === slug(parentDocumentId))
      : null;
    const parentRecord = parentDocument && parentVersion !== null
      ? (Array.isArray(parentDocument.versions) ? parentDocument.versions : []).find(entry => Number(entry.version) === parentVersion)
      : null;
    const parentSha256 = parentRecord ? String(parentRecord.sha256 || '') : '';
    // The browser sends the exact package it showed on the stage card. The package is resolved against the
    // registry again so the stored evidence names the bytes that were actually current, not a copied claim.
    let storedInputDocuments = [];
    if (chain && stageId && !chain.factor_id) {
      const requiredInputs = ResearchLibrary.stageInputDocuments(chain, stageId, registry, catalog).filter(entry => !entry.missing);
      const requiredById = new Map(requiredInputs.map(entry => [entry.document_id, entry]));
      storedInputDocuments = inputDocumentsPayload.map(entry => {
        const inputDocument = registry.documents.find(candidate => candidate.document_id === slug(entry.document_id));
        const expected = requiredById.get(slug(entry.document_id));
        const versionRecord = inputDocument && inputVersionRecord(inputDocument, entry.version);
        return {
          document_id: slug(entry.document_id),
          version: Number(entry.version),
          sha256: versionRecord ? String(versionRecord.sha256 || '') : '',
          stage: inputDocument ? String(inputDocument.stage || '') || null : null,
          factor_id: inputDocument ? String(inputDocument.factor_id || '') || null : null,
          chain_id: inputDocument ? String(inputDocument.chain_id || '') || null : null,
          role: expected ? expected.role : entry.role,
          role_stage: expected ? expected.role_stage : entry.role_stage
        };
      });
    }
    let document = registry.documents.find(entry => entry.document_id === documentId);

    if (!document) {
      document = {
        document_id: documentId,
        asset,
        factor_id: resolvedFactorId || null,
        task_id: taskId || null,
        topic_id: topicId || null,
        chain_id: resolvedChainId || null,
        stage: stageId || null,
        document_type: documentType,
        title,
        model: model || null,
        origin: 'external_upload',
        storage: 'library_object',
        public_download: false,
        context_version: contextVersion || null,
        open_findings: openFindings,
        uploaded_at: todayStamp(now),
        updated_at: todayStamp(now),
        versions: []
      };
      registry.documents.push(document);
    }

    Object.assign(document, {
      asset,
      factor_id: resolvedFactorId || null,
      task_id: taskId || null,
      topic_id: topicId || null,
      chain_id: resolvedChainId || document.chain_id || null,
      stage: stageId || null,
      document_type: documentType,
      title,
      model: model || document.model || null,
      storage: 'library_object',
      public_download: false,
      object_sha256: object.hash,
      object_relative_path: object.relative,
      context_version: contextVersion || document.context_version || null,
      open_findings: openFindings.length ? openFindings : (Array.isArray(document.open_findings) ? document.open_findings : []),
      input_documents: storedInputDocuments.length
        ? storedInputDocuments
        : (Array.isArray(document.input_documents) ? document.input_documents : []),
      updated_at: todayStamp(now)
    });
    if (parentDocumentId && parentVersion !== null) {
      document.parent_document_id = slug(parentDocumentId);
      document.parent_version = parentVersion;
      document.parent_sha256 = parentSha256;
    }

    const versions = Array.isArray(document.versions) ? document.versions : [];
    document.versions = versions;
    const existing = versions.find(entry => entry.sha256 === object.hash);
    if (existing) {
      writeRegistry(registry);
      return { duplicate: true, document_id: documentId, version: Number(existing.version), sha256: object.hash, document };
    }

    const latestVersion = versions.reduce((best, entry) => Math.max(best, Number(entry.version) || 0), 0);
    versions.push({
      version: latestVersion + 1,
      sha256: object.hash,
      bytes: object.bytes,
      registered_at: todayStamp(now),
      original_filename: String(payload.original_filename || ''),
      model: model || null,
      context_version: contextVersion || null,
      prompt_sha256: promptSha256,
      chain_id: resolvedChainId || null,
      parent_document_id: parentDocumentId ? slug(parentDocumentId) : null,
      parent_version: parentVersion,
      parent_sha256: parentSha256 || null,
      input_documents: storedInputDocuments,
      open_findings: openFindings,
      note: String(payload.note || '').trim() || (latestVersion ? `version ${latestVersion} kept immutable` : 'first upload')
    });
    writeRegistry(registry);
    return {
      duplicate: false,
      document_id: documentId,
      version: latestVersion + 1,
      sha256: object.hash,
      bytes: object.bytes,
      document
    };
  }

  function readObject(documentId, version) {
    const registry = readRegistry();
    const document = registry.documents.find(entry => entry.document_id === String(documentId));
    if (!document) {
      const error = new Error(`document ${documentId} is not registered`);
      error.statusCode = 404;
      throw error;
    }
    const versions = Array.isArray(document.versions) ? document.versions : [];
    const wanted = version === undefined || version === null || version === ''
      ? versions.reduce((best, entry) => (best === null || Number(entry.version) > Number(best.version) ? entry : best), null)
      : versions.find(entry => Number(entry.version) === Number(version));
    if (!wanted) {
      const error = new Error(`version ${version} of ${documentId} is not registered`);
      error.statusCode = 404;
      throw error;
    }
    if (!wanted.sha256) {
      const error = new Error(`${documentId} version ${wanted.version} is not stored in this library`);
      error.statusCode = 409;
      throw error;
    }
    const absPath = objectPathFor(wanted.sha256);
    if (!fs.existsSync(absPath)) {
      const error = new Error(`${documentId} version ${wanted.version} is registered but its object is absent`);
      error.statusCode = 410;
      throw error;
    }
    const bytes = fs.readFileSync(absPath);
    const actual = sha256(bytes);
    if (actual !== wanted.sha256) {
      const error = new Error(`${documentId} version ${wanted.version} failed its integrity check: ${actual} does not equal ${wanted.sha256}`);
      error.statusCode = 500;
      throw error;
    }
    return { document, version: wanted, bytes };
  }

  function manifest() {
    const registry = readRegistry();
    const documents = registry.documents.map(document => {
      const versions = Array.isArray(document.versions) ? document.versions : [];
      const latest = versions.reduce((best, entry) => (best === null || Number(entry.version) > Number(best.version) ? entry : best), null);
      const stored = versions.filter(entry => entry.sha256 && fs.existsSync(objectPathFor(entry.sha256)));
      return {
        document_id: document.document_id,
        asset: document.asset,
        factor_id: document.factor_id,
        task_id: document.task_id,
        topic_id: document.topic_id || null,
        chain_id: document.chain_id || null,
        stage: document.stage || null,
        parent_document_id: document.parent_document_id || null,
        parent_version: document.parent_version === undefined ? null : document.parent_version,
        input_documents: latest ? (Array.isArray(latest.input_documents) ? latest.input_documents : []) : [],
        open_findings: Array.isArray(document.open_findings) ? document.open_findings : [],
        document_type: document.document_type,
        title: document.title,
        model: document.model,
        origin: document.origin,
        storage: document.storage,
        public_download: Boolean(document.public_download),
        context_version: document.context_version || null,
        latest_version: latest ? Number(latest.version) : null,
        latest_sha256: latest ? latest.sha256 : null,
        latest_bytes: latest ? latest.bytes : null,
        registered_at: latest ? latest.registered_at : null,
        prompt_sha256: latest ? latest.prompt_sha256 || null : null,
        versions_total: versions.length,
        versions_with_object: stored.length,
        repo_path: document.repo_path || null,
        download_reference: stored.length && latest ? `/documents/${document.document_id}/versions/${latest.version}` : null
      };
    });
    return {
      schema_version: `${SCHEMA_VERSION}-manifest`,
      generated_at: new Date().toISOString(),
      registry_path: path.relative(process.cwd(), registryPath).replace(/\\/g, '/'),
      library_root: path.relative(process.cwd(), root).replace(/\\/g, '/'),
      storage_contract: { ...storageContract, ...(registry.storage_contract || {}) },
      counts: {
        documents: documents.length,
        uploaded_documents: documents.filter(entry => entry.storage === 'library_object').length,
        repo_documents: documents.filter(entry => entry.storage === 'repo_path').length,
        versions: documents.reduce((total, entry) => total + entry.versions_total, 0)
      },
      documents
    };
  }

  return {
    root,
    registryPath,
    MAX_UPLOAD_BYTES,
    UPLOAD_DOCUMENT_TYPES,
    sha256,
    readRegistry,
    writeRegistry,
    registerUpload,
    readObject,
    manifest,
    taskPromptSha256,
    objectPathFor
  };
}

module.exports = { createStore, sha256, SCHEMA_VERSION, MAX_UPLOAD_BYTES, UPLOAD_DOCUMENT_TYPES };
