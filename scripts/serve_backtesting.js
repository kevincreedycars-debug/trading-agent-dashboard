#!/usr/bin/env node
/**
 * A tiny read-only static server for previewing the dashboard pages locally.
 *
 * Usage: node scripts/serve_backtesting.js [port]
 *
 * It serves the repository root so backtesting.html can fetch its payload from the same relative path the deployed
 * site uses. No write route, no directory listing. Research only.
 */
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  let relative = decodeURIComponent(url.pathname);
  if (relative === "/") relative = "/backtesting.html";
  const target = path.resolve(ROOT, `.${relative}`);
  if (!target.startsWith(ROOT + path.sep)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(target).pipe(response);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Backtesting screen: http://127.0.0.1:${PORT}/backtesting.html\n`);
});
