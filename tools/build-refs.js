// Builds public/refs/ and public/refs.json from the REF/ folder.
//
// Structure: REF/<Style Name>/*.jpg — one subfolder per style category; the
// folder name is the category name shown in the app. Images are converted to
// webp (max 768px long side) into public/refs/<slug>--<name>.webp.
//
// categories.json adds the prompt text (tagline + style description) per
// folder name. Folders without an entry still work — the app then relies on
// the reference images alone — but a warning is printed so you can ask Claude
// to write the missing entry. Loose images directly in REF/ are ignored with
// a warning: sort them into a style folder.
//
// Run: npm run build:refs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "REF");
const OUT = path.join(ROOT, "public", "refs");
const SIZE = 768;

const IMG_RE = /\.(png|jpe?g|webp)$/i;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toWebpName = (dir, f) => `${slug(dir)}--${f.replace(IMG_RE, ".webp")}`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const entries = fs.readdirSync(SRC, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const loose = entries.filter((e) => e.isFile() && IMG_RE.test(e.name)).map((e) => e.name);

  if (!dirs.length) {
    console.error("No style folders found in REF/. Create one folder per style (e.g. REF/Bauhaus) and move the images into them.");
    process.exit(1);
  }

  const { styles = {} } = JSON.parse(fs.readFileSync(path.join(ROOT, "categories.json"), "utf8"));
  const manifest = { categories: [] };
  const missingStyle = [];
  let total = 0;

  for (const dir of dirs) {
    const files = fs.readdirSync(path.join(SRC, dir)).filter((f) => IMG_RE.test(f));
    if (!files.length) continue;
    for (const file of files) {
      const outPath = path.join(OUT, toWebpName(dir, file));
      if (!fs.existsSync(outPath)) {
        await sharp(path.join(SRC, dir, file))
          .resize(SIZE, SIZE, { fit: "inside" })
          .webp({ quality: 82 })
          .toFile(outPath);
      }
    }
    total += files.length;
    const styleKey = Object.keys(styles).find((k) => k.toLowerCase() === dir.toLowerCase());
    const meta = styleKey ? styles[styleKey] : {};
    if (!styleKey) missingStyle.push(dir);
    manifest.categories.push({
      id: slug(dir),
      label: styleKey || dir.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase()),
      tagline: meta.tagline || `${files.length} reference image${files.length === 1 ? "" : "s"}`,
      style: meta.style || "",
      files: files.map((f) => toWebpName(dir, f)),
    });
  }

  // Drop stale webps whose source no longer exists (renamed/moved/deleted refs).
  const wanted = new Set(manifest.categories.flatMap((c) => c.files));
  for (const f of fs.readdirSync(OUT)) if (!wanted.has(f)) fs.unlinkSync(path.join(OUT, f));

  fs.writeFileSync(path.join(ROOT, "public", "refs.json"), JSON.stringify(manifest));
  console.log(`Done: ${total} refs in ${manifest.categories.length} styles -> public/refs/`);
  if (loose.length) {
    console.warn(`WARNING: ${loose.length} image(s) sit directly in REF/ and were IGNORED — move them into a style folder:`);
    for (const f of loose) console.warn("  - " + f);
  }
  if (missingStyle.length) {
    console.warn(`WARNING: no prompt text in categories.json for: ${missingStyle.join(", ")}. The app works, but ask Claude to write style descriptions for better results.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
