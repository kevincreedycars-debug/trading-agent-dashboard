'use strict';

// Local, authenticated research-library service.
//
//   node scripts/research-library-server.js --serve-repo
//
// It binds loopback only, requires a bearer token that lives outside Git, and it is the only path
// by which an uploaded report is stored or read back. The published dashboard page can browse the
// committed registry, but it cannot upload, and it cannot read an uploaded report: those two actions
// need this service, which is the honest boundary the brief asks for.
//
// Nothing here touches n8n, the dispatcher, Supabase, the live feed or production scoring.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const ResearchLibrary = require('../lib/research_library.js');
const { createStore } = require('../lib/research_library_store.js');

const SERVICE_NAME = 'research-library-service';
const SERVICE_VERSION = '1.0.0';
const root = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(root, 'data', 'research-library', 'catalog.json');
const REGISTRY_PATH = path.join(root, 'data', 'research-library', 'documents.json');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
};

const MAX_BODY_BYTES = 12 * 1024 * 1024;

function readCatalog(catalogPath) {
  if (!fs.existsSync(catalogPath)) return { tasks: [], assets: [] };
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
}

function loadOrCreateToken(tokenFile) {
  if (fs.existsSync(tokenFile)) {
    const value = fs.readFileSync(tokenFile, 'utf8').trim();
    if (value) return { token: value, created: false };
  }
  const token = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
  return { token, created: true };
}

function tokensMatch(expected, presented) {
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(presented));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sendJson(res, statusCode, payload) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

/**
 * Loopback-only CORS. The reader may serve this checkout from one loopback port while the service runs on
 * another, and the browser treats those as different origins. Only a loopback origin is echoed, the token is
 * still required for every protected route, and the hash header is exposed so the panel can verify a
 * download. A public origin is never allowed.
 */
function applyCors(req, res) {
  const origin = String(req.headers.origin || '');
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return false;
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = (statusCode, headers = {}) => originalWriteHead(statusCode, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Content-SHA256, X-Document-Id, X-Document-Version',
    Vary: 'Origin',
    ...headers
  });
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(Object.assign(new Error(`request body is larger than ${MAX_BODY_BYTES} bytes`), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// SERVER_ANCHOR
function serveStatic(res, urlPath, repoRoot) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(repoRoot, decodeURIComponent(relative));
  if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Content-Length': body.length
  });
  res.end(body);
  return true;
}

function createServiceServer(options = {}) {
  const catalogPath = options.catalogPath || CATALOG_PATH;
  const registryPath = options.registryPath || REGISTRY_PATH;
  const libraryRoot = options.libraryRoot || path.join(root, '.local', 'research-library');
  const tokenFile = options.tokenFile || path.join(libraryRoot, 'service-token');
  const serveRepo = Boolean(options.serveRepo);
  const repoRoot = path.resolve(options.repoRoot || root);
  const resolved = options.token ? { token: options.token, created: false } : loadOrCreateToken(tokenFile);
  const token = resolved.token;

  const storageContract = {
    registry_path: path.relative(root, registryPath).replace(/\\/g, '/'),
    library_root: path.relative(root, libraryRoot).replace(/\\/g, '/'),
    service_endpoint: `http://127.0.0.1:${options.port || 8791}`,
    token_file: path.relative(root, tokenFile).replace(/\\/g, '/'),
    public_upload: false,
    public_download: false,
    immutable_versions: true,
    note: 'Uploaded bytes are research evidence: stored once under their own SHA-256 outside Git, never rewritten, and readable only with the service token.'
  };
  const store = createStore({ root: libraryRoot, registryPath, storageContract, now: options.now });

  function authorized(req) {
    const header = req.headers.authorization || '';
    const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    return Boolean(presented) && tokensMatch(token, presented);
  }
  // HANDLE_ANCHOR
  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const method = (req.method || 'GET').toUpperCase();
    applyCors(req, res);

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/health' && method === 'GET') {
      const manifest = store.manifest();
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        bind: '127.0.0.1',
        library_root: storageContract.library_root,
        registry_path: storageContract.registry_path,
        token_file: storageContract.token_file,
        counts: manifest.counts,
        catalog_tasks: (readCatalog(catalogPath).tasks || []).map(task => task.task_id),
        note: 'Uploads and downloads require the bearer token. This service publishes no report.'
      });
      return;
    }

    const protectedRoute = pathname === '/manifest'
      || pathname === '/export'
      || pathname === '/documents'
      || pathname.startsWith('/documents/')
      || pathname.startsWith('/tasks/');
    if (protectedRoute && !authorized(req)) {
      sendJson(res, 401, { ok: false, error: 'a valid service token is required' });
      return;
    }

    if (pathname === '/manifest' && method === 'GET') {
      sendJson(res, 200, store.manifest());
      return;
    }

    if (pathname === '/export' && method === 'GET') {
      const manifest = store.manifest();
      const catalog = readCatalog(catalogPath);
      sendJson(res, 200, {
        schema_version: 'research-library-export-v1',
        generated_at: manifest.generated_at,
        manifest,
        download_references: manifest.documents
          .filter(entry => entry.download_reference)
          .map(entry => ({
            document_id: entry.document_id,
            version: entry.latest_version,
            url: entry.download_reference,
            sha256: entry.latest_sha256,
            bytes: entry.latest_bytes,
            content_type: 'application/octet-stream',
            token_required: true
          })),
        tasks: (catalog.tasks || []).map(task => ({
          task_id: task.task_id,
          status: task.status,
          context_version: task.context_version,
          prompt_sha256: crypto.createHash('sha256').update(String(task.prompt), 'utf8').digest('hex'),
          prompt_fingerprint: ResearchLibrary.fingerprint(task.prompt),
          covers: task.covers || []
        }))
      });
      return;
    }

    if (pathname === '/documents' && method === 'POST') {
      const body = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch (error) {
        sendJson(res, 400, { ok: false, error: 'request body is not valid JSON' });
        return;
      }
      const registration = store.registerUpload(payload, readCatalog(catalogPath));
      sendJson(res, registration.duplicate ? 200 : 201, {
        ok: true,
        duplicate: registration.duplicate,
        document_id: registration.document_id,
        version: registration.version,
        sha256: registration.sha256,
        bytes: registration.bytes,
        document_type: registration.document.document_type,
        task_id: registration.document.task_id,
        download_reference: `/documents/${registration.document_id}/versions/${registration.version}`,
        note: 'Registered as research evidence. This is not an approval and it changes no live rule.'
      });
      return;
    }

    const downloadMatch = pathname.match(/^\/documents\/([^/]+)\/versions\/([^/]+)$/);
    if (downloadMatch && method === 'GET') {
      const documentId = decodeURIComponent(downloadMatch[1]);
      const version = decodeURIComponent(downloadMatch[2]);
      const { document, version: record, bytes } = store.readObject(documentId, version);
      const extension = path.extname(record.original_filename || '') || '.txt';
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': bytes.length,
        'X-Content-SHA256': record.sha256,
        'X-Document-Id': document.document_id,
        'X-Document-Version': String(record.version),
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${document.document_id}-v${record.version}${extension}"`
      });
      res.end(bytes);
      return;
    }

    const contextMatch = pathname.match(/^\/tasks\/([^/]+)\/context-package$/);
    if (contextMatch && method === 'GET') {
      const taskId = decodeURIComponent(contextMatch[1]);
      const contextPackage = ResearchLibrary.buildContextPackage(readCatalog(catalogPath), taskId);
      if (!contextPackage) {
        sendJson(res, 404, { ok: false, error: `task ${taskId} is not in the catalog` });
        return;
      }
      sendJson(res, 200, contextPackage);
      return;
    }

    if (serveRepo && (method === 'GET' || method === 'HEAD') && serveStatic(res, pathname, repoRoot)) {
      return;
    }

    sendJson(res, 404, { ok: false, error: `no route for ${method} ${pathname}` });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(error => {
      const statusCode = Number(error?.statusCode) || 500;
      sendJson(res, statusCode, { ok: false, error: String(error?.message || error), problems: error?.problems });
    });
  });

  return { server, store, token, tokenCreated: resolved.created, tokenFile, libraryRoot, registryPath, storageContract };
}

function parseArgs(argv) {
  const args = { port: 8791, serveRepo: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--port') args.port = Number(argv[++index]);
    else if (token === '--root') args.root = argv[++index];
    else if (token === '--registry') args.registry = argv[++index];
    else if (token === '--serve-repo') args.serveRepo = true;
    else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

function printUsage() {
  console.log([
    'Research Library service',
    '',
    '  node scripts/research-library-server.js [--port 8791] [--serve-repo] [--root <dir>] [--registry <file>]',
    '',
    'Binds loopback only. Every upload and download needs the service token, which is written to',
    '.local/research-library/service-token on first run. Read it with:',
    "  Get-Content .local\\research-library\\service-token",
    'and paste it into the Research Library panel once; the panel keeps it in this browser only.',
    'The token is never printed by this program and never committed.'
  ].join('\n'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  const service = createServiceServer({
    port: args.port,
    libraryRoot: args.root ? path.resolve(args.root) : undefined,
    registryPath: args.registry ? path.resolve(args.registry) : undefined,
    serveRepo: args.serveRepo
  });

  service.server.listen(args.port, '127.0.0.1', () => {
    const manifest = service.store.manifest();
    console.log([
      `${SERVICE_NAME} ${SERVICE_VERSION} listening on http://127.0.0.1:${args.port}`,
      `  library   ${service.storageContract.library_root}`,
      `  registry  ${service.storageContract.registry_path}`,
      `  token     ${service.storageContract.token_file}${service.tokenCreated ? ' (created now)' : ''}`,
      `  documents ${manifest.counts.documents} (${manifest.counts.uploaded_documents} uploaded, ${manifest.counts.repo_documents} repo-backed)`,
      service.storageContract.public_upload === false ? '  uploads   token required; nothing here is published' : '',
      args.serveRepo ? `  local page http://127.0.0.1:${args.port}/index.html` : '  local page not served; add --serve-repo to serve this checkout'
    ].filter(Boolean).join('\n'));
  });

  const shutdown = () => service.server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) main();

module.exports = { createServiceServer, readCatalog, loadOrCreateToken, tokensMatch, CONTENT_TYPES, SERVICE_NAME, SERVICE_VERSION };
