// Wallie — local static server.
// Generation happens fully in the browser (public/index.html calls the
// Gemini API directly), so this server only serves the static app and, for
// local convenience, exposes the GEMINI_API_KEY from .env so you don't have
// to paste it. The deployed (Vercel) version is the same static app without
// this endpoint.

const http = require("http");
const fs = require("fs");
const path = require("path");

const { execFileSync } = require("child_process");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const REF = path.join(ROOT, "REF");
const PORT = process.env.PORT || 3001;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function buildRefs() {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "build-refs.js")], { stdio: "inherit" });
}

// ---------- .env loading (no dotenv dependency) ----------
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

// Refresh public/refs from REF/ on every start, so newly added reference
// images are picked up automatically (needs `npm install` once for sharp).
try {
  buildRefs();
} catch {
  console.warn("build:refs failed — serving the previously built refs.");
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".css": "text/css",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 👍 on a generated wallpaper: save it into the matching REF/<style> folder
  // so it joins that style's reference pool. Local-only (deployed site has no
  // filesystem; the app falls back to downloading the file there).
  if (req.method === "POST" && url.pathname === "/api/save-ref") {
    let body = "";
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 40e6) req.destroy();
      else body += c;
    });
    req.on("end", () => {
      try {
        const { category, dataUrl } = JSON.parse(body);
        const dirs = fs.readdirSync(REF, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
        const dir = dirs.find((d) => slug(d) === category);
        if (!dir) throw new Error(`No REF folder matches category "${category}".`);
        const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
        if (!m) throw new Error("Bad image data.");
        const name = `wallie-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
        fs.writeFileSync(path.join(REF, dir, name), Buffer.from(m[2], "base64"));
        buildRefs(); // new reference joins public/refs + refs.json immediately
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, saved: `REF/${dir}/${name}` }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/key") {
    // Local-only convenience; no CORS headers, so foreign origins can't read it.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ key: process.env.GEMINI_API_KEY || "" }));
    return;
  }

  // static files from ./public
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
  if (rel.startsWith("/refs/")) headers["Cache-Control"] = "public, max-age=86400";
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Wallie running at http://localhost:${PORT}`);
  console.log(`Local API key from .env: ${process.env.GEMINI_API_KEY ? "yes" : "no"}`);
});
