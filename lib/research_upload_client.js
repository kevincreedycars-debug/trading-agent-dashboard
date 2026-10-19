(function initResearchUpload(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ResearchUpload = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createResearchUpload() {
  "use strict";

  const BUCKET = "research-documents";
  const STAGE_NAMES = Object.freeze({ 1: "research", 2: "red_team", 3: "adjudication" });
  let settings = { url: "", key: "", fetchImpl: null, storage: null };
  let activeSession = null;

  function sentence(text) {
    const clean = String(text || "Something went wrong. Please try again.").replace(/\s+/g, " ").trim();
    return /[.!?]$/.test(clean) ? clean : `${clean}.`;
  }

  function failure(message, extra) {
    return Object.assign({ ok: false, message: sentence(message) }, extra || {});
  }

  function storageKey() {
    try {
      const project = new URL(settings.url).hostname.split(".")[0];
      return `sb-${project}-auth-token`;
    } catch (_) {
      return "research-upload-auth-token";
    }
  }

  function readStoredSession() {
    if (!settings.storage) return null;
    try {
      const parsed = JSON.parse(settings.storage.getItem(storageKey()) || "null");
      return parsed && parsed.access_token ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(value) {
    activeSession = value && value.access_token ? Object.assign({}, value) : null;
    if (activeSession && !activeSession.user_id) activeSession.user_id = jwtSubject(activeSession.access_token);
    if (!settings.storage) return;
    if (activeSession) settings.storage.setItem(storageKey(), JSON.stringify(activeSession));
    else settings.storage.removeItem(storageKey());
  }

  function jwtSubject(token) {
    try {
      const encoded = String(token || "").split(".")[1];
      if (!encoded || typeof atob !== "function") return "";
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      return String(JSON.parse(atob(normalized)).sub || "");
    } catch (_) {
      return "";
    }
  }

  function sessionFromLocation() {
    if (typeof location === "undefined" || !location.hash) return null;
    const values = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = values.get("access_token");
    if (!accessToken) return null;
    const expiresIn = Number(values.get("expires_in")) || 3600;
    const found = {
      access_token: accessToken,
      refresh_token: values.get("refresh_token") || "",
      token_type: values.get("token_type") || "bearer",
      expires_at: Math.floor(Date.now() / 1000) + expiresIn
    };
    if (typeof history !== "undefined" && typeof history.replaceState === "function") {
      history.replaceState(null, "", `${location.pathname || ""}${location.search || ""}`);
    }
    return found;
  }

  function configure(options) {
    const input = options || {};
    settings = {
      url: String(input.url || "").replace(/\/$/, ""),
      key: String(input.key || ""),
      fetchImpl: input.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null),
      storage: input.storage || (typeof localStorage !== "undefined" ? localStorage : null)
    };
    if (!settings.url || !settings.key) return failure("The upload service is not configured. Reload the page or contact the site owner");
    saveSession(sessionFromLocation() || readStoredSession());
    return { ok: true };
  }

  function session() {
    return activeSession;
  }

  async function request(path, options) {
    if (!settings.fetchImpl || !settings.url || !settings.key) {
      return failure("The upload service is not configured. Reload the page or contact the site owner");
    }
    const input = options || {};
    const headers = Object.assign({ apikey: settings.key }, input.headers || {});
    if (input.auth !== false && activeSession && activeSession.access_token) {
      headers.Authorization = `Bearer ${activeSession.access_token}`;
    }
    let response;
    try {
      response = await settings.fetchImpl(`${settings.url}${path}`, Object.assign({}, input, { headers }));
    } catch (_) {
      return failure("The upload service could not be reached. Check your connection and try again");
    }
    let body = null;
    const contentType = response.headers && response.headers.get ? response.headers.get("content-type") || "" : "";
    try { body = contentType.includes("json") ? await response.json() : await response.text(); } catch (_) { body = null; }
    return { ok: response.ok, status: response.status, body, response };
  }

  function authRequired() {
    return failure("Sign in with your email link before uploading or opening a research document");
  }

  async function signIn(email) {
    const address = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return failure("Enter a valid email address and try again");
    const payload = { email: address, create_user: true };
    if (typeof location !== "undefined" && location.href) payload.options = { email_redirect_to: location.href.split("#")[0] };
    const result = await request("/auth/v1/otp", {
      method: "POST",
      auth: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!result.ok) return failure("The sign-in email could not be sent. Check the address or ask the site owner to confirm email sign-in is enabled");
    return { ok: true, message: "Check your email and open the sign-in link in this browser." };
  }

  async function signOut() {
    if (!activeSession) return { ok: true, message: "You are already signed out." };
    const result = await request("/auth/v1/logout", { method: "POST" });
    if (!result.ok) return failure("You could not be signed out. Check your connection and try again");
    saveSession(null);
    return { ok: true, message: "You are signed out." };
  }

  async function sha256Hex(bytes) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) throw new Error("This browser cannot calculate the file fingerprint. Use a current browser and try again.");
    const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const digest = await subtle.digest("SHA-256", source);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  }

  function cleanTopicId(value) {
    const topic = String(value || "").trim();
    if (!topic || topic.includes("/") || !/^[A-Za-z0-9._-]+$/.test(topic)) return "";
    return topic;
  }

  function storagePath(topicId, stage, version, sha256) {
    return `${topicId}/${stage}/v${version}-${sha256}.md`;
  }

  async function listByTopic(topicId) {
    if (!activeSession) return authRequired();
    const topic = cleanTopicId(topicId);
    if (!topic) return failure("Choose a valid research topic and try again");
    const query = `?topic_id=eq.${encodeURIComponent(topic)}&order=stage.asc,version.asc`;
    const result = await request(`/rest/v1/research_documents${query}`, { headers: { Accept: "application/json" } });
    if (!result.ok) return failure("The research documents could not be loaded. Refresh the page or sign in again");
    return { ok: true, rows: Array.isArray(result.body) ? result.body : [] };
  }

  function insertPayload(input, topic, stage, version, sha256, bytes, path) {
    const parents = input.parents || {};
    const payload = {
      topic_id: topic,
      stage,
      version,
      title: String(input.title || "").trim(),
      kind: String(input.kind || "").trim(),
      parent_research_id: parents.researchId || parents.parentResearchId || null,
      parent_red_team_id: parents.redTeamId || parents.parentRedTeamId || null,
      parent_research_ref: String(parents.researchRef || parents.parentResearchRef || "").trim(),
      parent_red_team_ref: String(parents.redTeamRef || parents.parentRedTeamRef || "").trim(),
      sha256,
      bytes,
      storage_path: path,
      uploaded_by: activeSession.user && activeSession.user.id ? activeSession.user.id : activeSession.user_id,
      notes: String(input.notes || "").trim()
    };
    if (!payload.uploaded_by) delete payload.uploaded_by;
    return payload;
  }

  async function insertRow(payload) {
    const result = await request("/rest/v1/research_documents", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
    if (!result.ok) return result;
    return { ok: true, row: Array.isArray(result.body) ? result.body[0] : result.body };
  }

  async function upload(input) {
    if (!activeSession) return authRequired();
    const values = input || {};
    const topic = cleanTopicId(values.topicId);
    const stage = Number(values.stage);
    if (!topic || ![1, 2, 3].includes(stage)) return failure("Choose a valid topic and stage before uploading");
    if (!String(values.title || "").trim() || !String(values.kind || "").trim()) return failure("Add a title and document kind before uploading");
    if (!values.file || typeof values.file.arrayBuffer !== "function") return failure("Choose a Markdown file before uploading");
    const parents = values.parents || {};
    if (stage > 1) {
      const researchParent = parents.researchId || parents.parentResearchId || parents.researchRef || parents.parentResearchRef;
      const redTeamParent = parents.redTeamId || parents.parentRedTeamId || parents.redTeamRef || parents.parentRedTeamRef;
      if (!String(researchParent || "").trim()) return failure("Name the research report this document follows before uploading");
      if (stage === 3 && !String(redTeamParent || "").trim()) return failure("Name the red-team finding this adjudication follows before uploading");
    }

    let buffer;
    let sha256;
    try {
      buffer = await values.file.arrayBuffer();
      sha256 = await sha256Hex(buffer);
    } catch (error) {
      return failure(error && error.message ? error.message : "The selected file could not be read. Choose it again");
    }

    const existing = await listByTopic(topic);
    if (!existing.ok) return existing;
    const sameBytes = existing.rows.find(row => Number(row.stage) === stage && row.sha256 === sha256);
    if (sameBytes) return failure("These exact file contents are already stored for this topic and stage. Open the existing version instead");
    const version = existing.rows.reduce((highest, row) => Number(row.stage) === stage ? Math.max(highest, Number(row.version) || 0) : highest, 0) + 1;
    const path = storagePath(topic, stage, version, sha256);
    const objectResult = await request(`/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { "Content-Type": values.file.type || "text/markdown", "x-upsert": "false" },
      body: buffer
    });
    if (!objectResult.ok) {
      if ([401, 403].includes(objectResult.status)) return authRequired();
      return failure("The file could not be stored. Check your connection and try the upload again");
    }

    const payload = insertPayload(values, topic, stage, version, sha256, buffer.byteLength, path);
    const rowResult = await insertRow(payload);
    if (rowResult.ok) return { ok: true, row: rowResult.row, storagePath: path };

    const retry = async function retryRegistration() {
      const retried = await insertRow(payload);
      if (retried.ok) return { ok: true, row: retried.row, storagePath: path };
      return failure("The file is stored, but its library record still could not be saved. Keep this page open and retry registration", { retry, storagePath: path });
    };
    return failure("The file is stored, but its library record could not be saved. Retry registration to finish without uploading the file again", { retry, storagePath: path });
  }

  async function signedUrl(row, seconds) {
    if (!activeSession) return authRequired();
    const path = row && row.storage_path ? String(row.storage_path) : "";
    if (!path) return failure("This document has no file location. Ask the site owner to inspect its record");
    const lifetime = Math.max(1, Math.min(3600, Number(seconds) || 300));
    const result = await request(`/storage/v1/object/sign/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: lifetime })
    });
    if (!result.ok || !result.body || !result.body.signedURL) return failure("A private download link could not be created. Sign in again or ask the site owner for help");
    const value = String(result.body.signedURL);
    return { ok: true, url: /^https?:/.test(value) ? value : `${settings.url}/storage/v1${value.startsWith("/") ? "" : "/"}${value}` };
  }

  function rowsToDocuments(rows) {
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const stage = Number(row.stage);
      const key = `${row.topic_id}:${stage}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.values()).map(group => {
      const ordered = group.slice().sort((a, b) => Number(a.version) - Number(b.version));
      const latest = ordered[ordered.length - 1];
      const parentId = stageParentId(latest);
      const versions = ordered.map(row => ({
        version: Number(row.version),
        sha256: String(row.sha256 || ""),
        bytes: Number(row.bytes),
        registered_at: String(row.uploaded_at || ""),
        storage_path: String(row.storage_path || ""),
        note: String(row.notes || "")
      }));
      const notes = String(latest.notes || "");
      const modelMatch = notes.match(/(?:^|\s\|\s*)Model or session:\s*([^|]+)\s*$/);
      const model = modelMatch ? modelMatch[1].trim() : "";
      const note = modelMatch ? notes.slice(0, modelMatch.index).replace(/\s*\|\s*$/, "").trim() : notes;
      // The hosted table only has the three factor stage numbers. A final-chain return records its stage
      // name in the free-text kind column so the page can put it back on the final chain unchanged.
      const finalStage = /^final_(analysis|red_team|adjudication)$/.test(String(latest.kind || "")) ? String(latest.kind) : "";
      const documentType = finalStage === "final_analysis" ? "synthesis"
        : finalStage === "final_red_team" ? "review"
          : finalStage === "final_adjudication" ? "adjudication"
            : String(latest.kind || "");
      return {
        document_id: String(latest.id || ""),
        topic_id: String(latest.topic_id || ""),
        stage: finalStage || STAGE_NAMES[Number(latest.stage)] || "",
        document_type: documentType,
        title: String(latest.title || ""),
        model,
        note,
        origin: "external_upload",
        storage: "library_object",
        public_download: false,
        object_sha256: String(latest.sha256 || ""),
        parent_document_id: parentId,
        parent_version: parentId ? parentVersion(rows, parentId) : null,
        versions,
        asset: "",
        version_count: versions.length,
        latest_version: Number(latest.version),
        latest_sha256: String(latest.sha256 || ""),
        latest_bytes: Number(latest.bytes),
        latest_registered_at: String(latest.uploaded_at || "")
      };
    });
  }

  function stageParentId(row) {
    if (Number(row.stage) === 2) return String(row.parent_research_id || row.parent_research_ref || "");
    if (Number(row.stage) === 3) return String(row.parent_red_team_id || row.parent_red_team_ref || "");
    return "";
  }

  function parentVersion(rows, id) {
    const match = (Array.isArray(rows) ? rows : []).find(row => String(row.id) === String(id));
    return match ? Number(match.version) : null;
  }

  return { configure, signIn, signOut, session, upload, listByTopic, signedUrl, rowsToDocuments, sha256Hex, storagePath };
});
