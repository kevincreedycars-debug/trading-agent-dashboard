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
    const documentId = slug(payload.document_id);
    const asset = String(payload.asset || '').trim().toUpperCase();
    const documentType = String(payload.document_type || '').trim();
    const title = String(payload.title || '').trim();
    const model = String(payload.model || '').trim();
    const taskId = payload.task_id ? String(payload.task_id).trim() : '';
    const factorId = payload.factor_id ? String(payload.factor_id).trim() : '';

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
    const task = taskId ? tasks.find(entry => String(entry.task_id) === taskId) : null;
    if (taskId && !task) problems.push(`task_id ${taskId} is not in the catalog`);
    if (factorId && !factors.some(factor => String(factor.factor_id) === factorId)) {
      problems.push(`factor_id ${factorId} is not in the catalog`);
    }
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
    const registry = readRegistry();
    let document = registry.documents.find(entry => entry.document_id === documentId);

    if (!document) {
      document = {
        document_id: documentId,
        asset,
        factor_id: factorId || null,
        task_id: taskId || null,
        document_type: documentType,
        title,
        model: model || null,
        origin: 'external_upload',
        storage: 'library_object',
        public_download: false,
        context_version: contextVersion || null,
        uploaded_at: todayStamp(now),
        updated_at: todayStamp(now),
        versions: []
      };
      registry.documents.push(document);
    }

    Object.assign(document, {
      asset,
      factor_id: factorId || null,
      task_id: taskId || null,
      document_type: documentType,
      title,
      model: model || document.model || null,
      storage: 'library_object',
      public_download: false,
      object_sha256: object.hash,
      object_relative_path: object.relative,
      context_version: contextVersion || document.context_version || null,
      updated_at: todayStamp(now)
    });

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
