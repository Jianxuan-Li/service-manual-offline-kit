// Repair saved pages whose illustrations were stored as
// "data:application/octet-stream". TIS serves images with that generic type,
// and a data URL carrying it is not guaranteed to render as an image -- Chrome
// sniffs the bytes anyway, mobile Safari may refuse. Restamp the real type from
// the payload's magic bytes. No re-downloading involved.
//
//   node fix-image-types.js ~/Downloads/TIS [--dry]
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2];
const DRY = process.argv.includes("--dry");

function kindOf(b64) {
  if (b64.startsWith("iVBORw0KGgo")) return "png";
  if (b64.startsWith("/9j/")) return "jpeg";
  if (b64.startsWith("R0lGOD")) return "gif";
  if (b64.startsWith("UklGR")) return "webp";
  return "";
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".html")) out.push(p);
  }
  return out;
}

let filesChanged = 0, imagesFixed = 0, unknown = 0;
for (const f of walk(ROOT, [])) {
  const html = fs.readFileSync(f, "utf8");
  let n = 0;
  const fixed = html.replace(/data:(?!image\/)[^;,]*;base64,([A-Za-z0-9+/=]+)/g, (m, b64) => {
    const kind = kindOf(b64);
    if (!kind) { unknown++; return m; }
    n++;
    return "data:image/" + kind + ";base64," + b64;
  });
  if (!n) continue;
  filesChanged++; imagesFixed += n;
  console.log(n + " image(s): " + path.relative(ROOT, f));
  if (!DRY) fs.writeFileSync(f, fixed);
}
if (unknown) console.log("\n" + unknown + " data URL(s) left alone: unrecognised format");
console.log("\n" + imagesFixed + " image(s) in " + filesChanged + " file(s) " +
  (DRY ? "would be restamped" : "restamped"));
