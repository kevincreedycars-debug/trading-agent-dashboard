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

  // One topic carries three numbered stages, and each stage produces at most one returned Markdown
  // document. The later stages name the exact version they judged, so an adjudication can never rest on a
  // research version that has since been replaced without the register saying so.
  const TOPIC_STAGES = Object.freeze(["research", "red_team", "adjudication"]);
  const STAGE_LABELS = Object.freeze({ research: "Research", red_team: "Red-team", adjudication: "Adjudication" });
  const STAGE_DOCUMENT_TYPES = Object.freeze({ research: "report", red_team: "review", adjudication: "synthesis" });
  const STAGE_PARENT_STAGE = Object.freeze({ research: null, red_team: "research", adjudication: "red_team" });
  const STAGE_STATES = Object.freeze(["not_started", "awaiting_upload", "delivered", "reassessment_required"]);
  const STAGE_STATE_LABELS = Object.freeze({
    not_started: "Not started",
    awaiting_upload: "Awaiting upload",
    delivered: "Delivered",
    reassessment_required: "Reviewed an earlier version"
  });
  // Every stage of every topic carries a prompt a reader can paste into their own session, and one of these
  // three sources says where that prompt comes from. A dispatched brief is what this programme actually sent,
  // a factor brief is a published assignment, and a generated brief is written from the catalogue itself.
  const PROMPT_SOURCE_KINDS = Object.freeze(["dispatched_brief", "factor_brief", "generated"]);

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
      topics: asArray(source.topics),
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

  // ---------------------------------------------------------------------------------------------
  // Topics and the three numbered stages
  //
  // A topic is the unit of work: one research question, the factor entries it is evidence for, and three
  // stages in order. A stage is delivered only when its own returned document is registered; the dashboard
  // writes the metadata (topic, stage, the version it judged) and the reader supplies one Markdown file.
  // Nothing here scores anything, and registering a document moves no factor status.
  // ---------------------------------------------------------------------------------------------

  function listTopics(catalog, assetId) {
    const wanted = assetId ? (normalizeAssetId(assetId) || asText(assetId)) : "";
    return asArray(normalizeCatalog(catalog).topics).filter(topic =>
      !wanted || (normalizeAssetId(topic.asset) || asText(topic.asset)) === wanted
    );
  }

  function topicById(catalog, topicId) {
    const wanted = asText(topicId);
    if (!wanted) return null;
    return listTopics(catalog).find(topic => asText(topic.topic_id) === wanted) || null;
  }

  // A topic may cover several factors and a factor may sit in more than one topic, so this returns every
  // topic that names the factor rather than one owner. That is how one returned report maps to the factor
  // entries it is evidence for without being counted as independent evidence a second time.
  function topicsCoveringFactor(catalog, factorId) {
    const wanted = asText(factorId);
    if (!wanted) return [];
    return listTopics(catalog).filter(topic => asArray(topic.factor_ids).map(asText).includes(wanted));
  }

  function topicStages(topic) {
    const stages = asArray(topic?.stages);
    return TOPIC_STAGES
      .map(stageId => stages.find(stage => asText(stage.stage) === stageId))
      .filter(Boolean);
  }

  function stageById(topic, stageId) {
    const wanted = asText(stageId);
    return topicStages(topic).find(stage => asText(stage.stage) === wanted) || null;
  }

  function topicDocuments(documents, topicId) {
    const wanted = asText(topicId);
    if (!wanted) return [];
    return listDocuments(documents).filter(document => asText(document.topic_id) === wanted);
  }

  function stageDocument(documents, topicId, stageId) {
    const wanted = asText(stageId);
    return topicDocuments(documents, topicId)
      .filter(document => asText(document.stage) === wanted)
      .reduce((best, document) => {
        if (!best) return document;
        if (asText(document.latest_registered_at) > asText(best.latest_registered_at)) return document;
        if (asText(document.latest_registered_at) === asText(best.latest_registered_at) && Number(document.latest_version) > Number(best.latest_version)) return document;
        return best;
      }, null);
  }

  // The state of one stage, read from the registry rather than asserted. A stage whose return judged an
  // older version of its parent is flagged for reassessment instead of reading as settled.
  function stageState(topic, stageId, documents) {
    const stage = stageById(topic, stageId);
    if (!stage) return null;
    const topicId = asText(topic.topic_id);
    const document = stageDocument(documents, topicId, stage.stage);
    const parentStageId = asText(stage.parent_stage) || "";
    const parentStage = parentStageId ? stageById(topic, parentStageId) : null;
    const parentDocument = parentStage ? stageDocument(documents, topicId, parentStage.stage) : null;
    const parentVersion = document && Number.isFinite(Number(document.parent_version)) ? Number(document.parent_version) : null;
    const parentLatest = parentDocument ? Number(parentDocument.latest_version) : null;
    const stale = Boolean(document) && parentLatest !== null && parentVersion !== null && parentVersion < parentLatest;
    let state = "not_started";
    if (document) state = stale ? "reassessment_required" : "delivered";
    else if (parentDocument) state = "awaiting_upload";
    return {
      stage: asText(stage.stage),
      order: Number(stage.order) || TOPIC_STAGES.indexOf(asText(stage.stage)) + 1,
      label: asText(stage.label) || STAGE_LABELS[asText(stage.stage)] || asText(stage.stage),
      document_type: asText(stage.document_type) || STAGE_DOCUMENT_TYPES[asText(stage.stage)] || "",
      prompt_path: asText(stage.prompt_path),
      prompt_sha256: asText(stage.prompt_sha256),
      prompt_bytes: Number.isFinite(Number(stage.prompt_bytes)) ? Number(stage.prompt_bytes) : null,
      prompt_source: stage.prompt_source && typeof stage.prompt_source === "object" ? stage.prompt_source : {},
      deliverable: asText(stage.deliverable),
      returns: asText(stage.returns),
      parent_stage: parentStageId,
      state,
      state_label: STAGE_STATE_LABELS[state] || state,
      stale_parent_version: stale,
      document_id: document ? asText(document.document_id) : "",
      version: document ? Number(document.latest_version) : null,
      versions_total: document ? Number(document.version_count) : 0,
      sha256: document ? asText(document.latest_sha256) : "",
      bytes: document ? document.latest_bytes : null,
      registered_at: document ? asText(document.latest_registered_at) : "",
      title: document ? asText(document.title) : "",
      model: document ? asText(document.model) : "",
      storage: document ? asText(document.storage) : "",
      public_download: document ? Boolean(document.public_download) : false,
      note: document ? asText(document.note) : "",
      open_findings: document ? asArray(document.open_findings).map(asText) : [],
      reviewed_document_id: document ? asText(document.parent_document_id) : "",
      reviewed_version: parentVersion,
      reviewed_sha256: document ? asText(document.parent_sha256) : "",
      parent_document_id: parentDocument ? asText(parentDocument.document_id) : "",
      parent_version: parentLatest,
      parent_sha256: parentDocument ? asText(parentDocument.latest_sha256) : ""
    };
  }

  // What the topic page shows and what central synthesis may rely on. Ready for synthesis means the three
  // stages are delivered and the chain judged the versions that are current: accepted research is not a
  // validated trading rule, so this flag says nothing about an edge.
  function topicProgress(topic, documents) {
    const stages = TOPIC_STAGES.map(stageId => stageState(topic, stageId, documents)).filter(Boolean);
    const delivered = stages.filter(stage => stage.state === "delivered");
    const flagged = stages.filter(stage => stage.state === "reassessment_required").map(stage => stage.stage);
    const nextStage = stages.find(stage => ["not_started", "awaiting_upload"].includes(stage.state));
    const adjudication = stages.find(stage => stage.stage === "adjudication") || null;
    const openFindings = adjudication ? adjudication.open_findings : [];
    return {
      topic_id: asText(topic.topic_id),
      title: asText(topic.title),
      stages,
      delivered_stages: delivered.length,
      total_stages: stages.length,
      flagged_for_reassessment: flagged,
      next_stage: nextStage ? nextStage.stage : "",
      ready_for_synthesis: Boolean(adjudication && adjudication.state === "delivered" && flagged.length === 0),
      open_findings: openFindings,
      unresolved_findings: openFindings.length,
      note: openFindings.length
        ? `${openFindings.length} unresolved finding(s) are recorded against this topic; central synthesis has to treat them as open.`
        : "No unresolved finding is recorded against this topic."
    };
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

    const topicIds = new Set();
    const coveredByTopics = new Set();
    asArray(normalized.topics).forEach(topic => {
      const topicId = asText(topic.topic_id);
      if (!topicId) problems.push("topic without topic_id");
      if (topicIds.has(topicId)) problems.push(`duplicate topic_id ${topicId}`);
      topicIds.add(topicId);
      if (!normalizeAssetId(topic.asset)) problems.push(`topic ${topicId} names unknown asset ${topic.asset}`);
      const topicFactorIds = asArray(topic.factor_ids).map(asText);
      if (!topicFactorIds.length) problems.push(`topic ${topicId} covers no factor`);
      topicFactorIds.forEach(factorId => {
        if (!factorIds.has(factorId)) problems.push(`topic ${topicId} covers unknown factor ${factorId}`);
        coveredByTopics.add(factorId);
      });
      const stages = asArray(topic.stages);
      if (stages.length !== TOPIC_STAGES.length) {
        problems.push(`topic ${topicId} must carry exactly ${TOPIC_STAGES.length} stages, found ${stages.length}`);
      }
      TOPIC_STAGES.forEach((stageId, index) => {
        const stage = stages.find(entry => asText(entry?.stage) === stageId);
        if (!stage) {
          problems.push(`topic ${topicId} has no ${stageId} stage`);
          return;
        }
        if (Number(stage.order) !== index + 1) problems.push(`topic ${topicId} ${stageId} stage must be number ${index + 1}`);
        if (!asText(stage.prompt_path)) problems.push(`topic ${topicId} ${stageId} stage has no prompt`);
        if (!/^[0-9a-f]{64}$/.test(asText(stage.prompt_sha256))) problems.push(`topic ${topicId} ${stageId} stage has no prompt sha256`);
        if (asText(stage.document_type) !== STAGE_DOCUMENT_TYPES[stageId]) {
          problems.push(`topic ${topicId} ${stageId} stage must expect a ${STAGE_DOCUMENT_TYPES[stageId]} document`);
        }
        if (asText(stage.parent_stage || "") !== (STAGE_PARENT_STAGE[stageId] || "")) {
          problems.push(`topic ${topicId} ${stageId} stage must name ${STAGE_PARENT_STAGE[stageId] || "nothing"} as its parent`);
        }
        const source = stage.prompt_source && typeof stage.prompt_source === "object" ? stage.prompt_source : {};
        if (!PROMPT_SOURCE_KINDS.includes(asText(source.kind))) {
          problems.push(`topic ${topicId} ${stageId} stage has no prompt source kind`);
        }
      });
    });
    // Every factor has to sit in at least one topic, or the topic page would silently omit it.
    if (topicIds.size) {
      factorIds.forEach(factorId => {
        if (!coveredByTopics.has(factorId)) problems.push(`factor ${factorId} sits in no topic`);
      });
    }

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
    const topicsById = new Map(asArray(normalizeCatalog(catalog).topics).map(topic => [asText(topic.topic_id), topic]));
    const documentsById = new Map(registry.map(document => [asText(document.document_id), document]));
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
      // A topic document has to declare its stage, and every stage after the first has to name the exact
      // parent version it judged. That pairing is what lets the page say which research version a review
      // attacked, and what makes a stale review visible instead of settled.
      const topicId = asText(document.topic_id);
      const stageId = asText(document.stage);
      if (topicId || stageId) {
        const topic = topicsById.get(topicId);
        if (!topic) {
          problems.push(`document ${id} names unknown topic ${topicId || "(none)"}`);
        } else if (!TOPIC_STAGES.includes(stageId)) {
          problems.push(`document ${id} has an unknown stage ${stageId || "(none)"}`);
        } else {
          const stage = stageById(topic, stageId);
          if (stage && asText(document.document_type) !== asText(stage.document_type)) {
            problems.push(`document ${id} is the ${stageId} stage of ${topicId}, which expects a ${stage.document_type} document`);
          }
          const parentStageId = asText(stage?.parent_stage) || "";
          const parentId = asText(document.parent_document_id);
          const parentVersion = Number(document.parent_version);
          if (!parentStageId && parentId) {
            problems.push(`document ${id} is the first stage of ${topicId} and must not name a parent`);
          }
          if (parentStageId) {
            if (!parentId) problems.push(`document ${id} must name the ${parentStageId} document it judged`);
            if (!Number.isFinite(parentVersion) || parentVersion < 1) problems.push(`document ${id} must name the version of ${parentStageId} it judged`);
            const parent = parentId ? documentsById.get(parentId) : null;
            if (parentId && !parent) {
              problems.push(`document ${id} names a parent document ${parentId} that is not registered`);
            } else if (parent) {
              if (asText(parent.topic_id) !== topicId) problems.push(`document ${id} names a parent from another topic`);
              if (asText(parent.stage) !== parentStageId) problems.push(`document ${id} must judge the ${parentStageId} stage, and ${parentId} is the ${asText(parent.stage) || "unknown"} stage`);
              const parentVersions = asArray(parent.versions).map(entry => Number(entry.version));
              if (Number.isFinite(parentVersion) && !parentVersions.includes(parentVersion)) {
                problems.push(`document ${id} names parent version ${parentVersion}, which is not registered for ${parentId}`);
              }
            }
          }
        }
      }
      if (document.open_findings !== undefined && !Array.isArray(document.open_findings)) {
        problems.push(`document ${id} must record open findings as a list`);
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
    TOPIC_STAGES,
    STAGE_LABELS,
    STAGE_DOCUMENT_TYPES,
    STAGE_PARENT_STAGE,
    STAGE_STATES,
    STAGE_STATE_LABELS,
    PROMPT_SOURCE_KINDS,
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
    listTopics,
    topicById,
    topicsCoveringFactor,
    topicStages,
    stageById,
    topicDocuments,
    stageDocument,
    stageState,
    topicProgress,
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
