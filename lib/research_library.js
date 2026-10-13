(function initResearchLibrary(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.ResearchLibrary = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createResearchLibrary() {
  // Research Library: the research-management surface. It reads the checked-in catalog and
  // document registry, prepares a manual ChatGPT task, and reads or stores documents through
  // the local authenticated library service. It never calls a frontier model API, never writes
  // a live artifact, and never turns a returned report into an approved trading rule.
  const ASSET_ORDER = Object.freeze(["USD", "EUR", "GBP", "GOLD", "SILVER", "NQ", "BTC", "WTI"]);

  const RESEARCH_STATUSES = Object.freeze(["not_started", "ready", "in_progress", "uploaded", "blocked"]);
  const REVIEW_STATUSES = Object.freeze(["pending", "changes_requested", "accepted"]);
  const BACKTEST_STATUSES = Object.freeze(["not_tested", "queued", "tested"]);
  const DOCUMENT_TYPES = Object.freeze(["brief", "context_package", "report", "review", "synthesis", "experiment", "issue_register"]);
  const STORAGE_KINDS = Object.freeze(["repo_path", "library_object", "referenced"]);

  const RESEARCH_LABELS = Object.freeze({
    not_started: "Not started",
    ready: "Ready",
    in_progress: "In progress",
    uploaded: "Uploaded",
    blocked: "Blocked"
  });
  const REVIEW_LABELS = Object.freeze({
    pending: "Pending",
    changes_requested: "Changes requested",
    accepted: "Accepted"
  });
  const BACKTEST_LABELS = Object.freeze({
    not_tested: "Not tested",
    queued: "Queued",
    tested: "Tested"
  });

  // Every network destination this surface is allowed to use: its own checkout, and the local
  // library service on loopback. No model endpoint appears here by design.
  const NETWORK_ALLOWLIST = Object.freeze([
    "same-origin:./data/research-library/catalog.json",
    "same-origin:./data/research-library/documents.json",
    "local-service:http://127.0.0.1:<port>"
  ]);

  const DEFAULT_SERVICE_ENDPOINT = "http://127.0.0.1:8791";
  const MANUAL_TASK_ONLY = true;
  const FRONTIER_API_CALLS = false;
  const UPLOAD_IS_APPROVAL = false;

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asText(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function escapeHtml(value) {
    return asText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "unknown size";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  // FNV-1a 64-bit as a short hex fingerprint. It is an integrity fingerprint for prompt and
  // context versions that both a browser and Node can compute; it is not a security hash and
  // is never used to prove the contents of an uploaded file. Uploaded bytes are hashed with
  // SHA-256 by the library service.
  function fingerprint(text) {
    const input = asText(text);
    const mask64 = 0xffffffffffffffffn;
    const prime = 0x100000001b3n;
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < input.length; index += 1) {
      hash = ((hash ^ BigInt(input.charCodeAt(index))) * prime) & mask64;
    }
    return hash.toString(16).padStart(16, "0");
  }

  function normalizeAssetId(value) {
    const text = asText(value).trim().toUpperCase();
    return ASSET_ORDER.includes(text) ? text : "";
  }

  function normalizeCatalog(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const assets = asArray(source.assets).map(entry => {
      const record = entry && typeof entry === "object" ? entry : {};
      return {
        ...record,
        asset: normalizeAssetId(record.asset) || asText(record.asset),
        label: asText(record.label) || asText(record.asset),
        factors: asArray(record.factors)
      };
    });
    const ordered = ASSET_ORDER
      .map(asset => assets.find(entry => entry.asset === asset))
      .filter(Boolean)
      .concat(assets.filter(entry => !ASSET_ORDER.includes(entry.asset)));
    return {
      schema_version: asText(source.schema_version) || "research-library-catalog-v1",
      generated_at: asText(source.generated_at),
      asset_order: ASSET_ORDER.slice(),
      scope_note: asText(source.scope_note),
      storage: source.storage && typeof source.storage === "object" ? source.storage : {},
      tasks: asArray(source.tasks),
      engine_documents: asArray(source.engine_documents),
      repo_documents: asArray(source.repo_documents),
      assets: ordered
    };
  }

  function listAssets(catalog) {
    return asArray(normalizeCatalog(catalog).assets);
  }

  function getAsset(catalog, assetId) {
    const wanted = normalizeAssetId(assetId) || asText(assetId);
    return listAssets(catalog).find(entry => entry.asset === wanted) || null;
  }

  function listFactors(catalog, assetId) {
    const wanted = assetId ? (normalizeAssetId(assetId) || asText(assetId)) : "";
    const assets = wanted
      ? listAssets(catalog).filter(entry => entry.asset === wanted)
      : listAssets(catalog);
    return assets.flatMap(asset => asArray(asset.factors).map(factor => ({
      ...factor,
      asset: asset.asset,
      asset_label: asset.label
    })));
  }

  function normalizeFactorStatuses(factor) {
    const record = factor && typeof factor === "object" ? factor : {};
    const research = RESEARCH_STATUSES.includes(record.research_status) ? record.research_status : "not_started";
    const review = REVIEW_STATUSES.includes(record.review_status) ? record.review_status : "pending";
    const backtest = BACKTEST_STATUSES.includes(record.backtest_status) ? record.backtest_status : "not_tested";
    return { research, review, backtest };
  }

  function filterFactors(catalog, filters = {}) {
    const query = asText(filters.query).trim().toLowerCase();
    return listFactors(catalog, filters.asset).filter(factor => {
      const statuses = normalizeFactorStatuses(factor);
      if (filters.group && filters.group !== "all" && asText(factor.group) !== filters.group) return false;
      if (filters.research && filters.research !== "all" && statuses.research !== filters.research) return false;
      if (filters.review && filters.review !== "all" && statuses.review !== filters.review) return false;
      if (filters.backtest && filters.backtest !== "all" && statuses.backtest !== filters.backtest) return false;
      if (!query) return true;
      const haystack = [
        factor.factor_id,
        factor.label,
        factor.group,
        factor.brief,
        asArray(factor.blockers).join(" "),
        asArray(factor.dependencies).join(" ")
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  function progressCounts(factors) {
    const counts = {
      total: 0,
      research: { not_started: 0, ready: 0, in_progress: 0, uploaded: 0, blocked: 0 },
      review: { pending: 0, changes_requested: 0, accepted: 0 },
      backtest: { not_tested: 0, queued: 0, tested: 0 }
    };
    asArray(factors).forEach(factor => {
      const statuses = normalizeFactorStatuses(factor);
      counts.total += 1;
      counts.research[statuses.research] += 1;
      counts.review[statuses.review] += 1;
      counts.backtest[statuses.backtest] += 1;
    });
    return counts;
  }

  function taskById(catalog, taskId) {
    const wanted = asText(taskId);
    return asArray(normalizeCatalog(catalog).tasks).find(task => asText(task.task_id) === wanted) || null;
  }

  function tasksCoveringFactor(catalog, factorId) {
    const wanted = asText(factorId);
    return asArray(normalizeCatalog(catalog).tasks).filter(task =>
      asArray(task.covers).some(entry => asText(entry) === wanted)
    );
  }

  function factorCoverage(catalog) {
    const normalized = normalizeCatalog(catalog);
    const tasks = asArray(normalized.tasks).map(task => ({
      task_id: asText(task.task_id),
      title: asText(task.title),
      kind: asText(task.kind),
      status: asText(task.status),
      covers: asArray(task.covers).map(asText),
      gaps: asArray(task.gaps).map(asText)
    }));
    const covered = new Set(tasks.flatMap(task => task.covers));
    const uncovered = listFactors(normalized)
      .filter(factor => !covered.has(asText(factor.factor_id)))
      .map(factor => ({ asset: factor.asset, factor_id: factor.factor_id, label: factor.label }));
    return { tasks, covered: Array.from(covered).sort(), uncovered };
  }

  function requiredOutputSchema(catalog) {
    const schema = normalizeCatalog(catalog).storage?.output_schema || {};
    return {
      schema_path: asText(schema.schema_path),
      schema_version: asText(schema.schema_version),
      format: asText(schema.format) || "one JSON document per card",
      required_fields: asArray(schema.required_fields).map(asText),
      verdict: asText(schema.verdict)
    };
  }

  function buildContextPackage(catalog, taskId) {
    const normalized = normalizeCatalog(catalog);
    const task = taskById(normalized, taskId);
    if (!task) return null;
    const factors = listFactors(normalized).filter(factor =>
      asArray(task.covers).some(entry => asText(entry) === asText(factor.factor_id))
    );
    const contextVersion = asText(task.context_version);
    return {
      schema_version: "research-library-context-package-v1",
      task_id: asText(task.task_id),
      task_title: asText(task.title),
      task_kind: asText(task.kind),
      task_status: asText(task.status),
      asset: asText(task.asset),
      session_objective: asText(task.session_objective),
      context_version: contextVersion,
      context_fingerprint: fingerprint(`${asText(task.task_id)}\n${contextVersion}\n${asText(task.prompt)}`),
      dispatched_prompt: asText(task.prompt),
      implementation_excerpt: asText(task.implementation_excerpt),
      rulebook_excerpt: asText(task.rulebook_excerpt),
      data_information: asArray(task.data_information).map(asText),
      required_output_schema: requiredOutputSchema(normalized),
      deliverable: task.deliverable && typeof task.deliverable === "object" ? task.deliverable : {},
      rules: asArray(task.rules).map(asText),
      covers: asArray(task.covers).map(asText),
      gaps: asArray(task.gaps).map(asText),
      depends_on: asArray(task.depends_on).map(asText),
      covered_factors: factors.map(factor => ({
        factor_id: asText(factor.factor_id),
        label: asText(factor.label),
        group: asText(factor.group),
        role: asText(factor.role),
        live_weight_coded: factor.live_weight_coded === undefined ? null : factor.live_weight_coded,
        live_weight_rulebook: factor.live_weight_rulebook === undefined ? null : factor.live_weight_rulebook
      })),
      research_action: {
        manual_task_only: MANUAL_TASK_ONLY,
        frontier_api_calls: FRONTIER_API_CALLS,
        upload_is_approval: UPLOAD_IS_APPROVAL,
        note: "Paste this package into the user's own ChatGPT session. Nothing here calls a model API, and a returned report stays research evidence until a review accepts it and a backtest supports it."
      },
      sources_read_by_coordinator: asArray(normalized.storage?.coordinator_sources).map(asText)
    };
  }

  function latestVersion(document) {
    const versions = asArray(document?.versions).filter(entry => Number.isFinite(Number(entry?.version)));
    return versions.reduce((best, entry) => (best === null || Number(entry.version) > Number(best.version) ? entry : best), null);
  }

  function documentAsset(document) {
    return normalizeAssetId(document?.asset) || asText(document?.asset);
  }

  function listDocuments(documents, filters = {}) {
    const registry = asArray(documents?.documents || documents);
    const wantedAsset = filters.asset ? (normalizeAssetId(filters.asset) || asText(filters.asset)) : "";
    const wantedFactor = asText(filters.factor_id);
    const wantedTypes = asArray(filters.document_types).map(asText);
    return registry
      .filter(document => {
        if (wantedAsset && documentAsset(document) !== wantedAsset) return false;
        if (wantedFactor && asText(document.factor_id) !== wantedFactor) return false;
        if (wantedTypes.length && !wantedTypes.includes(asText(document.document_type))) return false;
        if (filters.task_id && asText(document.task_id) !== asText(filters.task_id)) return false;
        if (filters.asset_level === true && asText(document.factor_id)) return false;
        return true;
      })
      .map(document => {
        const latest = latestVersion(document);
        return {
          ...document,
          asset: documentAsset(document),
          version_count: asArray(document.versions).length,
          latest_version: latest ? Number(latest.version) : null,
          latest_sha256: latest ? asText(latest.sha256) : "",
          latest_bytes: latest && Number.isFinite(Number(latest.bytes)) ? Number(latest.bytes) : null,
          latest_registered_at: latest ? asText(latest.registered_at) : "",
          public_download: asText(document.storage) === "repo_path"
        };
      });
  }

  // A factor report that changed after a review or a synthesis was written leaves that
  // document stale: the register must say so rather than keep an old acceptance standing.
  function deriveReviewFreshness(catalog, documents) {
    const registry = listDocuments(documents);
    const factors = listFactors(catalog);
    return factors.reduce((accumulator, factor) => {
      const factorId = asText(factor.factor_id);
      const reports = registry.filter(document =>
        asText(document.factor_id) === factorId && asText(document.document_type) === "report"
      );
      const newestReport = reports.reduce((best, document) => {
        if (!best) return document;
        if (asText(document.latest_registered_at) > asText(best.latest_registered_at)) return document;
        if (asText(document.latest_registered_at) === asText(best.latest_registered_at) && Number(document.latest_version) > Number(best.latest_version)) return document;
        return best;
      }, null);
      const dependents = registry.filter(document =>
        ["review", "synthesis"].includes(asText(document.document_type))
        && (asArray(document.covers).includes(factorId) || asText(document.factor_id) === factorId)
      );
      if (!newestReport || !dependents.length) return accumulator;
      const staleDependents = dependents
        .filter(document => {
          const dependentTime = asText(document.latest_registered_at);
          if (!dependentTime) return true;
          return dependentTime < asText(newestReport.latest_registered_at);
        })
        .map(document => asText(document.document_id));
      if (staleDependents.length) {
        accumulator[factorId] = {
          needs_reassessment: true,
          newest_report: asText(newestReport.document_id),
          newest_report_registered_at: asText(newestReport.latest_registered_at),
          dependent_document_ids: staleDependents,
          reason: "a newer report was registered after these review or synthesis documents were written"
        };
      }
      return accumulator;
    }, {});
  }

  function validateCatalog(catalog) {
    const problems = [];
    const normalized = normalizeCatalog(catalog);
    const assets = listAssets(normalized);
    if (assets.length !== ASSET_ORDER.length) {
      problems.push(`catalog must carry exactly ${ASSET_ORDER.length} assets, found ${assets.length}`);
    }
    if (assets.length && assets[0].asset !== "USD") {
      problems.push(`USD must be the first asset, found ${assets[0].asset}`);
    }
    ASSET_ORDER.forEach((asset, index) => {
      if (assets[index] && assets[index].asset !== asset) {
        problems.push(`asset order must be ${ASSET_ORDER.join(", ")}, position ${index} is ${assets[index].asset}`);
      }
    });

    const factorIds = new Set();
    assets.forEach(asset => {
      asArray(asset.factors).forEach(factor => {
        const factorId = asText(factor.factor_id);
        if (!factorId) problems.push(`factor without factor_id on ${asset.asset}`);
        if (factorIds.has(factorId)) problems.push(`duplicate factor_id ${factorId}`);
        factorIds.add(factorId);
        const statuses = normalizeFactorStatuses(factor);
        if (factor.research_status && !RESEARCH_STATUSES.includes(factor.research_status)) {
          problems.push(`factor ${factorId} has an unknown research_status ${factor.research_status}`);
        }
        if (factor.review_status && !REVIEW_STATUSES.includes(factor.review_status)) {
          problems.push(`factor ${factorId} has an unknown review_status ${factor.review_status}`);
        }
        if (factor.backtest_status && !BACKTEST_STATUSES.includes(factor.backtest_status)) {
          problems.push(`factor ${factorId} has an unknown backtest_status ${factor.backtest_status}`);
        }
        if (statuses.research !== "blocked" && asArray(factor.blockers).length) {
          problems.push(`factor ${factorId} records a blocker but is not in the blocked research status`);
        }
        if (statuses.research === "blocked" && asArray(factor.blockers).length === 0) {
          problems.push(`factor ${factorId} is blocked without a blocker line`);
        }
        if (statuses.review === "accepted" && statuses.research !== "uploaded") {
          problems.push(`factor ${factorId} is review-accepted without an uploaded report`);
        }
        if (statuses.backtest === "tested" && statuses.review !== "accepted") {
          problems.push(`factor ${factorId} is backtest-tested without an accepted review`);
        }
      });
    });

    const taskIds = new Set();
    asArray(normalized.tasks).forEach(task => {
      const taskId = asText(task.task_id);
      if (!taskId) problems.push("task without task_id");
      if (taskIds.has(taskId)) problems.push(`duplicate task_id ${taskId}`);
      taskIds.add(taskId);
      if (!asText(task.prompt)) problems.push(`task ${taskId} has no prompt`);
      if (!asText(task.context_version)) problems.push(`task ${taskId} has no context_version`);
      if (!asText(task.session_objective)) problems.push(`task ${taskId} has no session_objective`);
      if (asArray(task.covers).length === 0) problems.push(`task ${taskId} covers no factor`);
      asArray(task.covers).forEach(factorId => {
        if (!factorIds.has(asText(factorId))) problems.push(`task ${taskId} covers unknown factor ${factorId}`);
      });
    });

    asArray(normalized.engine_documents).forEach(entry => {
      const id = asText(entry.document_id);
      if (!id) problems.push("engine document without document_id");
      if (entry.document_type && !DOCUMENT_TYPES.includes(entry.document_type)) {
        problems.push(`engine document ${id} has an unknown document_type ${entry.document_type}`);
      }
    });

    asArray(normalized.repo_documents).forEach(entry => {
      if (!asText(entry.repo_path)) problems.push(`repo document ${asText(entry.document_id)} has no repo_path`);
      if (!asText(entry.document_type)) problems.push(`repo document ${asText(entry.document_id)} has no document_type`);
    });

    const serialized = JSON.stringify(normalized);
    ["api_key", "apikey", "authorization:", "bearer ", "openai.com", "anthropic.com", "supabase.co"].forEach(token => {
      if (serialized.toLowerCase().includes(token.toLowerCase())) {
        problems.push(`catalog contains a forbidden token: ${token}`);
      }
    });
    // Key-shaped strings and JSON web tokens, without flagging ordinary words such as risk-based.
    if (/\bsk-[A-Za-z0-9_-]{16,}/.test(serialized)) problems.push("catalog contains a key-shaped string beginning sk-");
    if (/\beyJ[A-Za-z0-9_-]{10,}\./.test(serialized)) problems.push("catalog contains a token-shaped string beginning eyJ");
    return problems;
  }

  function validateDocuments(documents, catalog) {
    const problems = [];
    const registry = asArray(documents?.documents || documents);
    const factorIds = new Set(listFactors(catalog).map(factor => asText(factor.factor_id)));
    const taskIds = new Set(asArray(normalizeCatalog(catalog).tasks).map(task => asText(task.task_id)));
    const seen = new Set();
    registry.forEach(document => {
      const id = asText(document.document_id);
      if (!id) problems.push("document without document_id");
      if (seen.has(id)) problems.push(`duplicate document_id ${id}`);
      seen.add(id);
      if (document.storage && !STORAGE_KINDS.includes(document.storage)) {
        problems.push(`document ${id} has an unknown storage kind ${document.storage}`);
      }
      if (document.document_type && !DOCUMENT_TYPES.includes(document.document_type)) {
        problems.push(`document ${id} has an unknown document_type ${document.document_type}`);
      }
      if (document.factor_id && !factorIds.has(asText(document.factor_id))) {
        problems.push(`document ${id} names unknown factor ${document.factor_id}`);
      }
      if (document.task_id && !taskIds.has(asText(document.task_id))) {
        problems.push(`document ${id} names unknown task ${document.task_id}`);
      }
      if (document.asset && !normalizeAssetId(document.asset)) {
        problems.push(`document ${id} names unknown asset ${document.asset}`);
      }
      const versions = asArray(document.versions);
      if (versions.length === 0) problems.push(`document ${id} has no registered version`);
      versions.forEach(entry => {
        if (!Number.isFinite(Number(entry.version)) || Number(entry.version) < 1) {
          problems.push(`document ${id} has an invalid version number`);
        }
        if (!asText(entry.sha256) && document.storage !== "referenced") {
          problems.push(`document ${id} version ${entry.version} has no sha256`);
        }
      });
      if (document.storage === "repo_path" && !asText(document.repo_path)) {
        problems.push(`document ${id} is repo-backed without a repo_path`);
      }
      if (document.storage === "library_object" && !asText(document.object_sha256)) {
        problems.push(`document ${id} is library-backed without object_sha256`);
      }
      if (document.storage === "referenced" && !asText(document.reference_note)) {
        problems.push(`document ${id} is a reference without a reference_note`);
      }
    });
    return problems;
  }

  async function sha256Hex(bytes) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) throw new Error("SHA-256 is unavailable in this environment");
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function toBase64(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < view.length; index += chunk) {
      binary += String.fromCharCode.apply(null, view.subarray(index, index + chunk));
    }
    return btoa(binary);
  }

  function createServiceClient(options = {}) {
    const endpoint = asText(options.endpoint) || DEFAULT_SERVICE_ENDPOINT;
    const token = asText(options.token);
    const fetchImpl = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);

    async function request(pathname, requestOptions = {}) {
      if (!fetchImpl) throw new Error("No fetch implementation is available");
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (requestOptions.json !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetchImpl(`${endpoint}${pathname}`, {
        method: requestOptions.method || "GET",
        headers,
        body: requestOptions.json !== undefined ? JSON.stringify(requestOptions.json) : undefined
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`${requestOptions.method || "GET"} ${pathname} failed with ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
      }
      return requestOptions.raw ? response : response.json();
    }

    return {
      endpoint,
      hasToken: Boolean(token),
      health: () => request("/health"),
      manifest: () => request("/manifest"),
      upload: payload => request("/documents", { method: "POST", json: payload }),
      contextPackage: taskId => request(`/tasks/${encodeURIComponent(taskId)}/context-package`),
      async download(documentId, version) {
        const response = await request(`/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(version)}`, { raw: true });
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { bytes, sha256: response.headers.get("X-Content-SHA256") || "", bytes_length: bytes.length };
      }
    };
  }

  return {
    ASSET_ORDER,
    RESEARCH_STATUSES,
    REVIEW_STATUSES,
    BACKTEST_STATUSES,
    DOCUMENT_TYPES,
    STORAGE_KINDS,
    RESEARCH_LABELS,
    REVIEW_LABELS,
    BACKTEST_LABELS,
    NETWORK_ALLOWLIST,
    DEFAULT_SERVICE_ENDPOINT,
    MANUAL_TASK_ONLY,
    FRONTIER_API_CALLS,
    UPLOAD_IS_APPROVAL,
    asArray,
    asText,
    escapeHtml,
    formatBytes,
    fingerprint,
    normalizeAssetId,
    normalizeCatalog,
    normalizeFactorStatuses,
    listAssets,
    getAsset,
    listFactors,
    filterFactors,
    progressCounts,
    taskById,
    tasksCoveringFactor,
    factorCoverage,
    requiredOutputSchema,
    buildContextPackage,
    latestVersion,
    listDocuments,
    deriveReviewFreshness,
    validateCatalog,
    validateDocuments,
    sha256Hex,
    toBase64,
    createServiceClient
  };
});
