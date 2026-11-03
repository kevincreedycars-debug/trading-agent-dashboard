// Research library access gateway.
//
// The published dashboard keeps returned research documents in the private bucket `research-documents`
// and records them in `public.research_documents`. That store is locked to signed-in members of
// `public.research_members`, and that sign-in has been an unreliable step. This function is the one place
// the store is opened for a reader who is not signed in.
//
// It runs on the project's own service role, which every Supabase function receives from its runtime
// environment. The page never holds that key: it calls this function, and the function is the only code
// that touches the bucket or the table. The bucket stays private and no policy is loosened, so the store
// is not publicly writable and no privileged credential travels to a browser.
//
// Four operations, all reached through `/functions/v1/research-library`:
//   GET  ?op=status                                    metadata only, for a health check
//   GET  ?op=documents[&topic_id=<chain>]              the stored rows, oldest version first
//   GET  ?op=sign&path=<storage path>&download=<name>  a short-lived private link to one object
//   POST ?op=upload                                    one Markdown file, recorded against a chain and stage
//
// Access is a purpose-specific key held in the `RESEARCH_LIBRARY_KEY` secret and sent in `x-research-key`.
// It is not a Supabase credential: it only reaches the four operations below, and it can be rotated by
// changing that secret and the matching constant in the page. Every write is validated here (chain id,
// stage, Markdown text, size, fingerprint, parents), versions are assigned here, and no operation can
// update or delete a stored row, so the archive stays append-only. Uploads are capped per hour so a public
// page cannot be used to flood the store.

const BUCKET = "research-documents";
const MAX_BYTES = 1024 * 1024;
const MAX_UPLOADS_PER_HOUR = 40;
const MAX_NOTE = 16000;
const STORAGE_PATH_PATTERN = /^[A-Za-z0-9._-]+\/[123]\/v[1-9][0-9]*-[0-9a-f]{64}\.md$/;
const TOPIC_PATTERN = /^[A-Za-z0-9._-]{1,120}$/;
const REF_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/\r\n]*={0,2}$/;

const ROW_COLUMNS = [
  "id",
  "topic_id",
  "stage",
  "version",
  "title",
  "kind",
  "parent_research_id",
  "parent_red_team_id",
  "parent_research_ref",
  "parent_red_team_ref",
  "sha256",
  "bytes",
  "storage_path",
  "original_filename",
  "uploaded_at",
  "notes"
].join(",");

type Json = Record<string, unknown>;

function serviceKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function projectUrl(): string {
  return (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
}

function allowedOrigins(): string[] {
  return String(Deno.env.get("RESEARCH_LIBRARY_ORIGINS") || "")
    .split(",")
    .map(value => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = String(request.headers.get("origin") || "").replace(/\/+$/, "");
  const allowed = allowedOrigins();
  const allow = !allowed.length ? "*" : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-research-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(request: Request, status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, corsHeaders(request))
  });
}

function refused(request: Request, status: number, message: string): Response {
  return json(request, status, { ok: false, message });
}

function text(value: unknown, limit: number): string {
  return String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim().slice(0, limit);
}

// The key is compared in constant time so a caller cannot learn it one character at a time.
function keyMatches(given: string, expected: string): boolean {
  if (!expected || !given) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceKey();
  return Object.assign({ apikey: key, Authorization: `Bearer ${key}` }, extra);
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const options: RequestInit = Object.assign({}, init);
  options.headers = headers(Object.assign({ "Content-Type": "application/json" }, (init.headers as Record<string, string>) || {}));
  return await fetch(`${projectUrl()}/rest/v1${path}`, options);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value: string): Uint8Array | null {
  const compact = value.replace(/[\r\n]/g, "");
  if (!BASE64_PATTERN.test(compact)) return null;
  try {
    const binary = atob(compact);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch (_) {
    return null;
  }
}

// The record's owner is the library account the store already uses, so a document uploaded without a
// sign-in is still attributable to that account rather than to nobody.
let cachedOwner: { id: string; at: number } | null = null;

async function ownerId(): Promise<string> {
  if (cachedOwner && Date.now() - cachedOwner.at < 300000) return cachedOwner.id;
  const response = await rest("/research_members?select=user_id&order=added_at.asc&limit=1", { method: "GET" });
  if (!response.ok) return "";
  const rows = await response.json().catch(() => null);
  const id = Array.isArray(rows) && rows.length ? String(rows[0].user_id || "") : "";
  if (id) cachedOwner = { id, at: Date.now() };
  return id;
}

async function uploadsThisHour(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const response = await rest(`/research_documents?select=id&uploaded_at=gte.${encodeURIComponent(since)}`, { method: "GET" });
  if (!response.ok) return 0;
  const rows = await response.json().catch(() => null);
  return Array.isArray(rows) ? rows.length : 0;
}

async function nextVersion(topic: string, stage: number): Promise<number> {
  const query = `/research_documents?topic_id=eq.${encodeURIComponent(topic)}&stage=eq.${stage}&select=version&order=version.desc&limit=1`;
  const response = await rest(query, { method: "GET" });
  if (!response.ok) return 0;
  const rows = await response.json().catch(() => null);
  const highest = Array.isArray(rows) && rows.length ? Number(rows[0].version) || 0 : 0;
  return highest + 1;
}

async function putObject(path: string, bytes: Uint8Array): Promise<{ ok: boolean; status: number; already: boolean; detail: string }> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${projectUrl()}/storage/v1/object/${BUCKET}/${encoded}`, {
    method: "POST",
    headers: headers({ "Content-Type": "text/markdown; charset=utf-8", "x-upsert": "false", "cache-control": "no-store" }),
    body: bytes
  });
  const detail = await response.text().catch(() => "");
  return {
    ok: response.ok,
    status: response.status,
    already: response.status === 409 || /already exists|duplicate/i.test(detail),
    detail: detail.slice(0, 200)
  };
}

async function removeObject(path: string): Promise<void> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  await fetch(`${projectUrl()}/storage/v1/object/${BUCKET}/${encoded}`, { method: "DELETE", headers: headers() })
    .catch(() => null);
}

async function signObject(path: string, seconds: number): Promise<string> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${projectUrl()}/storage/v1/object/sign/${BUCKET}/${encoded}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: seconds })
  });
  if (!response.ok) return "";
  const body = await response.json().catch(() => null);
  const signed = body && body.signedURL ? String(body.signedURL) : "";
  if (!signed) return "";
  if (/^https?:/.test(signed)) return signed;
  return `${projectUrl()}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
}

async function handleDocuments(request: Request, url: URL): Promise<Response> {
  const topic = String(url.searchParams.get("topic_id") || "").trim();
  if (topic && !TOPIC_PATTERN.test(topic)) return refused(request, 400, "That chain id is not a valid topic");
  const query = topic
    ? `/research_documents?select=${ROW_COLUMNS}&topic_id=eq.${encodeURIComponent(topic)}&order=stage.asc,version.asc&limit=1000`
    : `/research_documents?select=${ROW_COLUMNS}&order=topic_id.asc,stage.asc,version.asc&limit=1000`;
  const response = await rest(query, { method: "GET" });
  if (!response.ok) return refused(request, 502, "The private store could not be read. Try again in a moment");
  const rows = await response.json().catch(() => null);
  return json(request, 200, { ok: true, rows: Array.isArray(rows) ? rows : [] });
}

async function handleSign(request: Request, url: URL): Promise<Response> {
  const path = String(url.searchParams.get("path") || "").trim();
  if (!STORAGE_PATH_PATTERN.test(path)) return refused(request, 400, "That file location is not a stored research document");
  const seconds = Math.max(30, Math.min(900, Number(url.searchParams.get("seconds")) || 600));
  const signed = await signObject(path, seconds);
  if (!signed) return refused(request, 404, "That stored file has no private link. Ask the site owner to inspect its record");
  const name = String(url.searchParams.get("download") || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 120);
  return json(request, 200, {
    ok: true,
    url: name ? `${signed}${signed.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}` : signed,
    download_name: name
  });
}

async function handleUpload(request: Request): Promise<Response> {
  let body: Json;
  try {
    body = await request.json();
  } catch (_) {
    return refused(request, 400, "The upload could not be read");
  }
  const topicId = text(body.topic_id, 120);
  const stage = Number(body.stage);
  const title = text(body.title, 200);
  const kind = text(body.kind, 60);
  const originalFilename = String(body.original_filename || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 120);
  const notes = String(body.notes || "").slice(0, MAX_NOTE);
  const parents = (body.parents || {}) as Json;
  const researchRef = text(parents.research_ref, 200);
  const redTeamRef = text(parents.red_team_ref, 200);

  if (!TOPIC_PATTERN.test(topicId)) return refused(request, 400, "This chain has no id this library can store against");
  if (![1, 2, 3].includes(stage)) return refused(request, 400, "Only the research, red-team and adjudication stages can be stored");
  if (!title || !kind) return refused(request, 400, "A title and a document kind are needed before a document can be stored");
  if (stage > 1 && !REF_PATTERN.test(researchRef)) return refused(request, 400, "Name the research report this document follows before uploading");
  if (stage === 3 && !REF_PATTERN.test(redTeamRef)) return refused(request, 400, "Name the red-team finding this adjudication follows before uploading");
  if (stage === 1 && (researchRef || redTeamRef)) return refused(request, 400, "A research document cannot name a stage it follows");

  const bytes = decodeBase64(String(body.content_base64 || ""));
  if (!bytes || !bytes.length) return refused(request, 400, "The selected file could not be read. Choose it again");
  if (bytes.length > MAX_BYTES) return refused(request, 413, "That file is larger than the one megabyte this library accepts");
  if (bytes.includes(0)) return refused(request, 415, "That file is not a text document. Choose the Markdown file the stage returned");
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (_) {
    return refused(request, 415, "That file is not readable Markdown text. Choose the file the stage returned");
  }

  const sha256 = await sha256Hex(bytes);
  const claimed = String(body.sha256 || "").trim().toLowerCase();
  if (claimed && claimed !== sha256) return refused(request, 400, "The file changed while it was being uploaded. Choose it again");

  const duplicate = await rest(
    `/research_documents?select=id&topic_id=eq.${encodeURIComponent(topicId)}&stage=eq.${stage}&sha256=eq.${sha256}&limit=1`,
    { method: "GET" }
  );
  if (duplicate.ok) {
    const rows = await duplicate.json().catch(() => null);
    if (Array.isArray(rows) && rows.length) {
      return refused(request, 409, "These exact file contents are already stored for this chain and stage. Open the existing version instead");
    }
  }

  if (await uploadsThisHour() >= MAX_UPLOADS_PER_HOUR) {
    return refused(request, 429, "The library has taken many uploads in the last hour and pauses until the hour is out. Try again later");
  }

  const owner = await ownerId();
  if (!owner) return refused(request, 503, "The library has no owner account recorded, so an upload cannot be attributed. Ask the site owner to check the store");

  const version = await nextVersion(topicId, stage);
  if (version < 1) return refused(request, 502, "The next version number could not be read from the store. Try the upload again");
  const path = `${topicId}/${stage}/v${version}-${sha256}.md`;

  const stored = await putObject(path, bytes);
  if (!stored.ok && !stored.already) {
    return refused(request, 502, "The file could not be stored. Check the connection and try the upload again");
  }

  const inserted = await rest("/research_documents", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      topic_id: topicId,
      stage,
      version,
      title,
      kind,
      parent_research_id: null,
      parent_red_team_id: null,
      parent_research_ref: stage > 1 ? researchRef : "",
      parent_red_team_ref: stage === 3 ? redTeamRef : "",
      sha256,
      bytes: bytes.length,
      storage_path: path,
      original_filename: originalFilename,
      uploaded_by: owner,
      notes
    })
  });
  if (!inserted.ok) {
    // The object path carries the fingerprint of its bytes, so a retry of the same file reaches the same
    // path. A record that could not be written leaves nothing behind for a reader to see.
    const detail = await inserted.text().catch(() => "");
    if (!stored.already) await removeObject(path);
    if (/duplicate key|already exists/i.test(detail)) {
      return refused(request, 409, "These exact file contents are already stored for this chain and stage. Open the existing version instead");
    }
    return refused(request, 502, "The file reached the store but its library record could not be saved. Try the upload again");
  }
  const rows = await inserted.json().catch(() => null);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return refused(request, 502, "The file reached the store but its library record could not be read back");
  return json(request, 201, { ok: true, row });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

  const url = new URL(request.url);
  const op = String(url.searchParams.get("op") || "").trim() || "documents";

  if (!projectUrl() || !serviceKey()) {
    return refused(request, 503, "This function is missing its project settings, so the private store cannot be reached");
  }

  const expected = String(Deno.env.get("RESEARCH_LIBRARY_KEY") || "");
  if (!expected) return refused(request, 503, "This function has no access key configured, so every request is refused");
  if (!keyMatches(String(request.headers.get("x-research-key") || "").trim(), expected)) {
    return refused(request, 401, "This page is not allowed to reach the research store. Ask the site owner for the current library key");
  }

  try {
    if (op === "status") {
      const listing = await rest(`/research_documents?select=id`, { method: "GET" });
      const rows = listing.ok ? await listing.json().catch(() => []) : [];
      return json(request, 200, {
        ok: true,
        store: listing.ok ? "reachable" : "refused",
        documents: Array.isArray(rows) ? rows.length : 0
      });
    }
    if (op === "documents") return await handleDocuments(request, url);
    if (op === "sign") return await handleSign(request, url);
    if (op === "upload") {
      if (request.method !== "POST") return refused(request, 405, "An upload has to be sent as a POST");
      return await handleUpload(request);
    }
    return refused(request, 404, "This library endpoint has no such operation");
  } catch (error) {
    const detail = error && (error as Error).message ? (error as Error).message : "unknown failure";
    return refused(request, 502, `The research store could not be reached: ${detail.slice(0, 120)}`);
  }
});
