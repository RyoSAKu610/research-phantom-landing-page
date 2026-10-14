import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createResearchApi } from "./research.mjs";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const api = createResearchApi();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
};

const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
const host = process.env.HOST || "127.0.0.1";

async function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").includes("..")) {
    res.writeHead(403).end();
    return;
  }
  const candidate = resolve(dist, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (candidate !== dist && !candidate.startsWith(dist + sep)) {
    res.writeHead(403).end();
    return;
  }
  let info;
  try { info = await stat(candidate); }
  catch { res.writeHead(404).end(); return; }
  if (!info.isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, {
    "Content-Type": mime[extname(candidate).toLowerCase()] || "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": candidate.endsWith("index.html") ? "no-store" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(candidate).on("error", () => res.destroy()).pipe(res);
}

createServer((req, res) => api(req, res, () => { void serveStatic(req, res); }))
  .listen(port, host, () => {
    console.log(`Research app ready at http://${host}:${port}/`);
  });
