// Build an "already saved" index from pages saved before the extension started
// tracking them, so the toolbar tick reflects the whole archive rather than
// only what has been saved since the feature existed.
//
//   node build-index.js ~/Downloads/TIS [-o tis-index.json]
//
// Load the resulting file from the extension's Options page.
//
// The document id is read from the source path each saved page records
// ("/t3Portal/document/rm/RM02D0U/xhtml/RM000000UVR008X.html"), falling back to
// the "Doc ID:" line in the page header. That id is the same one the viewer
// puts in its frame URL, which is how the badge recognises a page again.
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2];
const outIdx = process.argv.indexOf("-o");
const OUT = outIdx !== -1 ? process.argv[outIdx + 1] : "tis-index.json";

if (!ROOT || !fs.existsSync(ROOT)) {
  console.error("usage: node build-index.js <archive-dir> [-o tis-index.json]");
  process.exit(2);
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".html")) out.push(p);
  }
  return out;
}

const files = walk(ROOT, []);
const index = {};
let noId = 0;

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  let docId = "";
  const src = html.match(/\/xhtml\/([A-Za-z0-9_-]+)\.x?html?/);
  if (src) docId = src[1];
  if (!docId) {
    const dm = html.match(/Doc ID:\s*<\/?[^>]*>?\s*([A-Za-z0-9_-]+)/i) ||
               html.match(/Doc ID:\s*([A-Za-z0-9_-]+)/i);
    if (dm) docId = dm[1];
  }
  if (!docId) { noId++; console.log("no doc id: " + path.relative(ROOT, file)); continue; }

  const rel = path.relative(ROOT, file);
  const at = fs.statSync(file).mtimeMs;
  // Keep the newest save when the same document exists in two places.
  if (!index[docId] || index[docId].at < at) {
    index[docId] = { path: path.basename(ROOT) + "/" + rel, at: Math.round(at) };
  }
}

fs.writeFileSync(OUT, JSON.stringify(index));
console.log("\n" + Object.keys(index).length + " document(s) indexed from " +
  files.length + " file(s)" + (noId ? ", " + noId + " skipped" : ""));
console.log("wrote " + OUT + " -- load it from the extension's Options page");
