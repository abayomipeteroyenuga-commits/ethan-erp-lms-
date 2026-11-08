import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import storageHandler from "./api/storage/presign.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb", strict: true }));

app.get("/healthz", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ status: "ok", service: "ethan-erp-lms" });
});

app.all("/api/storage/presign", storageHandler);

// Only browser-required files are published. SQL, repository documentation,
// package metadata, server code and node_modules remain private.
const publicRootFiles = new Set([
  "/index.html", "/styles.css", "/app.js", "/config.js", "/neon-client.js",
  "/course-narration-data.js", "/manifest.webmanifest", "/sw.js", "/ethan-logo.jpeg"
]);

app.use((req, res, next) => {
  const requestPath = req.path;
  const publicAsset = requestPath.startsWith("/assets/") &&
    !requestPath.split("/").some(segment => segment === "." || segment === "..");
  if (requestPath === "/" || publicRootFiles.has(requestPath) || publicAsset) return next();
  return res.status(404).type("text/plain").send("Not found");
});

app.use(express.static(ROOT, {
  dotfiles: "deny", index: "index.html", fallthrough: true, etag: true,
  setHeaders(res, filePath) {
    const base = path.basename(filePath).toLowerCase();
    if (base === "index.html" || base === "sw.js") res.setHeader("Cache-Control", "no-cache");
    else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=3600");
  }
}));

app.use((_req, res) => res.status(404).type("text/plain").send("Not found"));
app.use((err, _req, res, _next) => {
  console.error("[Ethan LMS server]", err?.message || "Unexpected request error");
  if (res.headersSent) return;
  const status = Number(err?.status) || 500;
  res.status(status >= 400 && status < 600 ? status : 500).type("text/plain")
    .send(status === 413 ? "Request too large" : "The Ethan LMS service could not complete this request.");
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Ethan ERP & LMS listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down gracefully.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
