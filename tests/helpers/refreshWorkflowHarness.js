const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..", "..");
const baseLayer1 = readJson("tests/fixtures/refresh/layer1.json");
const baseLayer2 = readJson("tests/fixtures/refresh/layer2.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function addSeconds(timestamp, seconds) {
  return new Date(new Date(timestamp).getTime() + (seconds * 1000)).toISOString();
}

function buildLayer1(generatedAt) {
  const artifact = clone(baseLayer1);
  artifact.generated_at = generatedAt;
  artifact.source_run_id = null;
  if (artifact.agents && typeof artifact.agents === "object") {
    Object.values(artifact.agents).forEach((agent) => {
      if (agent && typeof agent === "object") {
        agent.generated_at = generatedAt;
        agent.source_run_id = null;
      }
    });
  }
  return artifact;
}

function buildLayer2(generatedAt) {
  const artifact = clone(baseLayer2);
  artifact.generated_at = generatedAt;
  artifact.source_run_id = null;
  return artifact;
}

function buildWorkflowStatus({
  status = "success",
  startedAt,
  finishedAt,
  message = "Published",
  steps = [],
  refreshRequestId = null,
  failedStep = null,
  errorReason = null
}) {
  const resolvedFailedStep = failedStep || steps.find((step) => String(step?.status || "").toLowerCase() === "failed")?.name || null;
  const resolvedErrorReason = errorReason || steps.find((step) => String(step?.status || "").toLowerCase() === "failed")?.error || null;
  return {
    status,
    message,
    last_run_started_at: startedAt,
    last_run_finished_at: finishedAt,
    refresh_request_id: refreshRequestId,
    failed_step: resolvedFailedStep,
    steps,
    error: resolvedFailedStep ? {
      step: resolvedFailedStep,
      reason: resolvedErrorReason || "Step did not produce output."
    } : null
  };
}

async function createHarness(options = {}) {
  const initialRuntimeProfile = options.runtimeProfile === undefined ? {
    version: "test-runtime-profile",
    workflow_id: "X75RKU34ikiM5RMU",
    sample_count: 3,
    percentiles_seconds: {
      median: 1.2,
      p75: 1.5,
      p80: 1.6,
      p90: 2.0,
      p95: 2.2,
      max: 2.5
    }
  } : options.runtimeProfile;
  let runtimeProfile = initialRuntimeProfile;
  let statusFails = false;
  let webhookHits = 0;
  let workflowStatus = options.workflowStatus || buildWorkflowStatus({
    status: "success",
    startedAt: "2026-07-31T08:21:36.178Z",
    finishedAt: "2026-07-31T08:26:54.530Z",
    message: "Last production run finished."
  });
  let layer1 = options.layer1 || buildLayer1("2026-07-31T08:26:50.000Z");
  let layer2 = options.layer2 || buildLayer2("2026-07-31T08:26:48.000Z");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (pathname === "/mock-webhook" && req.method === "POST") {
      webhookHits += 1;
      res.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ accepted: true }));
      return;
    }

    if (pathname === "/data/workflow-control.json") {
      const body = {
        enabled: true,
        webhook_url: `${origin}/mock-webhook`,
        request_mode: "no-cors",
        status_url: `${origin}/data/workflow-status.json`,
        runtime_profile_url: `${origin}/data/refresh-runtime-profile.json`,
        poll_interval_ms: 100,
        poll_after_trigger_ms: 500
      };
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
      return;
    }

    if (pathname === "/data/workflow-status.json") {
      if (statusFails) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "status unavailable" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(workflowStatus));
      return;
    }

    if (pathname === "/data/refresh-runtime-profile.json") {
      if (!runtimeProfile) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "missing runtime profile" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(runtimeProfile));
      return;
    }

    if (pathname === "/data/layer1.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(layer1));
      return;
    }

    if (pathname === "/data/layer2.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(layer2));
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });

  return {
    origin,
    browser,
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    },
    createContext: () => browser.newContext(),
    getWebhookHits: () => webhookHits,
    setRuntimeProfile(value) {
      runtimeProfile = value;
    },
    setStatusFailure(enabled) {
      statusFails = Boolean(enabled);
    },
    setWorkflowStatus(value) {
      workflowStatus = value;
    },
    setLayer1(value) {
      layer1 = value;
    },
    setLayer2(value) {
      layer2 = value;
    }
  };
}

function buildPublishedLayer1(publishedAt) {
  const artifact = clone(baseLayer1);
  artifact.dashboard_meta = {
    ...(artifact.dashboard_meta || {}),
    last_updated_et: publishedAt
  };
  if (Array.isArray(artifact.agents)) {
    artifact.agents = artifact.agents.map((agent, index) => ({
      ...agent,
      status: agent?.status || "live",
      generated_at: addSeconds(publishedAt, -120 + index),
      sealed_at: addSeconds(publishedAt, -90 + index),
      last_run_et: addSeconds(publishedAt, -150 + index)
    }));
  }
  delete artifact.generated_at;
  return artifact;
}

function buildPublishedLayer2(publishedAt) {
  const artifact = clone(baseLayer2);
  artifact.dashboard_meta = {
    ...(artifact.dashboard_meta || {}),
    last_updated_et: publishedAt
  };
  if (Array.isArray(artifact.pairs)) {
    artifact.pairs = artifact.pairs.map((pair, index) => ({
      ...pair,
      generated_at: addSeconds(publishedAt, -30 + index),
      sealed_at: addSeconds(publishedAt, -20 + index),
      valid_from: addSeconds(publishedAt, -40 + index)
    }));
  }
  delete artifact.generated_at;
  return artifact;
}

async function openDashboard(context, origin) {
  const page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#runWorkflowButton");
  return page;
}

async function readWorkflowUi(page) {
  return page.evaluate(() => ({
    badge: document.getElementById("workflowStatusBadge")?.textContent?.trim() || "",
    summary: document.getElementById("workflowStatusSummary")?.textContent?.trim() || "",
    meta: document.getElementById("workflowProgressMeta")?.textContent?.trim() || "",
    note: document.getElementById("workflowProgressNote")?.textContent?.trim() || "",
    errorTitle: document.querySelector("#workflowErrorReport h3")?.textContent?.trim() || "",
    errorBody: document.querySelector("#workflowErrorReport p:not(.eyebrow)")?.textContent?.trim() || "",
    eta: document.getElementById("workflowEta")?.textContent?.trim() || "",
    elapsed: document.getElementById("workflowElapsed")?.textContent?.trim() || "",
    disabled: Boolean(document.getElementById("runWorkflowButton")?.disabled),
    stored: JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")
  }));
}

async function triggerRefresh(page) {
  await page.click("#runWorkflowButton");
  await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")));
}

async function seedStoredRefreshState(page, state) {
  await page.evaluate((value) => {
    localStorage.setItem("dashboard-workflow-refresh-state", JSON.stringify(value));
  }, state);
}

async function seedStoredRefreshStateAndReload(page, state) {
  await seedStoredRefreshState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#runWorkflowButton");
}

module.exports = {
  addSeconds,
  buildLayer1,
  buildLayer2,
  buildPublishedLayer1,
  buildPublishedLayer2,
  buildWorkflowStatus,
  createHarness,
  openDashboard,
  readWorkflowUi,
  seedStoredRefreshState,
  seedStoredRefreshStateAndReload,
  triggerRefresh
};
