// Re-sort already-downloaded TIS pages into TIS-tree-shaped folders.
//
//   node reorg-existing.js ~/Downloads/TIS [--dry] [--vehicle[=NAME]] [--no-vehicle]
//
//   --dry              print the plan, move nothing
//   --vehicle          put each page under its vehicle, read from the file
//   --vehicle=gx460_2010   ...and assume this one for files saved before the
//                      extension started recording it
//   --no-vehicle       strip the vehicle level back off
//
// Path preference, matching background.js: the captured nav tree first, then
// the top-level section guessed from the title plus the title's own segments.
// Anything whose section cannot be determined lands in _unsorted/ rather than
// being filed somewhere wrong.
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2];
const DRY = process.argv.includes("--dry");
const NO_VEHICLE = process.argv.includes("--no-vehicle");
const vehicleArg = process.argv.find((a) => a === "--vehicle" || a.startsWith("--vehicle="));
const USE_VEHICLE = !!vehicleArg && !NO_VEHICLE;
const VEHICLE_FALLBACK = vehicleArg && vehicleArg.indexOf("=") !== -1
  ? vehicleArg.slice(vehicleArg.indexOf("=") + 1) : "";

const TITLE_SECTION = [
  ["PARKING BRAKE", "Brake"], ["BRAKE", "Brake"],
  ["IGNITION", "Engine/Hybrid System"], ["INTAKE", "Engine/Hybrid System"],
  ["EXHAUST", "Engine/Hybrid System"], ["ENGINE", "Engine/Hybrid System"],
  ["FUEL", "Engine/Hybrid System"], ["COOLING", "Engine/Hybrid System"],
  ["LUBRICATION", "Engine/Hybrid System"], ["EMISSION", "Engine/Hybrid System"],
  ["SFI", "Engine/Hybrid System"], ["HYBRID", "Engine/Hybrid System"],
  ["HV", "Engine/Hybrid System"],
  ["DRIVE SHAFT", "Drivetrain"], ["DIFFERENTIAL", "Drivetrain"],
  ["TRANSAXLE", "Drivetrain"], ["TRANSMISSION", "Drivetrain"],
  ["PROPELLER", "Drivetrain"], ["CLUTCH", "Drivetrain"],
  ["STEERING", "Steering"],
  ["SUSPENSION", "Suspension"], ["TIRE", "Suspension"],
  ["WHEEL", "Suspension"], ["AXLE", "Suspension"],
  ["SEAT", "Vehicle Interior"], ["INSTRUMENT PANEL", "Vehicle Interior"],
  ["INTERIOR", "Vehicle Interior"], ["METER", "Vehicle Interior"],
  ["HORN", "Vehicle Interior"],
  ["DOOR", "Vehicle Exterior"], ["WINDOW", "Vehicle Exterior"],
  ["WINDSHIELD", "Vehicle Exterior"], ["ROOF", "Vehicle Exterior"],
  ["MIRROR", "Vehicle Exterior"], ["BUMPER", "Vehicle Exterior"],
  ["HOOD", "Vehicle Exterior"], ["LIGHTING", "Vehicle Exterior"],
  ["WIPER", "Vehicle Exterior"],
  ["AUDIO", "Audio/Visual/Telematics"], ["NAVIGATION", "Audio/Visual/Telematics"],
  ["TELEPHONE", "Audio/Visual/Telematics"],
  ["CHARGING", "Power Source/Network"], ["STARTING", "Power Source/Network"],
  ["BATTERY", "Power Source/Network"], ["POWER SOURCE", "Power Source/Network"],
  ["NETWORK", "Power Source/Network"], ["CAN ", "Power Source/Network"],
  ["INTRODUCTION", "General"], ["MAINTENANCE", "General"],
  ["PREPARATION", "General"], ["SERVICE SPECIFICATIONS", "General"],
  ["IDENTIFICATION", "General"], ["REPAIR INSTRUCTION", "General"],
  ["TERMS", "General"], ["FOREWORD", "General"], ["CAUTION", "General"],
  ["GENERAL", "General"],
];

const slug = (s) =>
  String(s).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase().slice(0, 60);

// Keyword may sit anywhere in the first title segment: engine titles read
// "2GR-FSE IGNITION: ...". Longest match wins.
function sectionForTitle(title) {
  const head = String(title || "").split(";")[0].split(":")[0].trim().toUpperCase();
  let best = null;
  for (const [keyword, section] of TITLE_SECTION) {
    if (head.indexOf(keyword) !== -1 && (!best || keyword.length > best[0].length)) best = [keyword, section];
  }
  return best ? best[1] : null;
}

function dedupe(parts) {
  const out = [];
  for (const p of parts) if (p !== out[out.length - 1]) out.push(p);
  return out;
}

const TOP_SECTIONS = [
  "General", "Audio/Visual/Telematics", "Brake", "Drivetrain",
  "Engine/Hybrid System", "Power Source/Network", "Steering", "Suspension",
  "Vehicle Exterior", "Vehicle Interior",
];

// Same rule as background.js: drop the leaf (that node is the document
// itself), drop any label carrying the model-year qualifier (only documents
// are titled that way, so it is a sibling page mistaken for a parent), and
// keep from the first known top-level section on.
function normalizeTreePath(labels) {
  if (!labels || labels.length < 2) return null;
  const folders = labels.slice(0, -1).filter((l) => String(l).indexOf(";") === -1);
  const tops = TOP_SECTIONS.map(slug);
  const slugs = folders.map(slug).filter(Boolean);
  const start = slugs.findIndex((s) => tops.indexOf(s) !== -1);
  if (start === -1) return null;
  return slugs.slice(start, start + 12);
}

function targetFor(html) {
  const tm = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!tm) return null;
  const title = tm[1].trim();
  const segs = title.split(";")[0].split(":").map(slug).filter(Boolean);
  const file = (segs.pop() || "tis_page") + ".html";

  // Recompute from the captured tree rather than trusting a stored tis-path:
  // files written by an older build may carry a wrong one.
  const treeMeta = html.match(/<meta name="tis-tree" content="([^"]*)"/i);
  const tree = treeMeta ? normalizeTreePath(treeMeta[1].split(">").map((s) => s.trim())) : null;
  if (tree) return { rel: dedupe(tree).concat(file).join("/"), via: "tree", title };

  const section = sectionForTitle(title);
  const parts = (section ? [slug(section)] : ["_unsorted"]).concat(segs);
  return { rel: dedupe(parts).concat(file).join("/"), via: section ? "title" : "unsorted", title };
}

// Prefix the vehicle level when asked. Files saved before the extension
// recorded it fall back to --vehicle=NAME, and are reported if neither exists
// so they are never silently lumped in with another car.
function withVehicle(rel, html, report) {
  if (!USE_VEHICLE) return rel;
  const m = html.match(/<meta name="tis-vehicle" content="([^"]*)"/i);
  const v = slug((m && m[1]) || VEHICLE_FALLBACK);
  if (!v) { report.noVehicle++; return rel; }
  return v + "/" + rel;
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".html")) out.push(p);
  }
  return out;
}

function pruneEmpty(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) pruneEmpty(path.join(dir, e.name));
  }
  const left = fs.readdirSync(dir).filter((n) => n !== ".DS_Store");
  if (!left.length && path.resolve(dir) !== path.resolve(ROOT)) {
    for (const n of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, n));
    fs.rmdirSync(dir);
  }
}

const files = walk(ROOT, []);
const plan = [];
const taken = new Map();
const report = { noVehicle: 0 };
let unchanged = 0;

for (const src of files) {
  const html = fs.readFileSync(src, "utf8");
  const t = targetFor(html);
  const from = path.relative(ROOT, src);
  if (!t) { console.log("SKIP (no <title>): " + from); continue; }
  if (t.via === "unsorted") console.log("UNSORTED (section unknown): " + t.title);
  t.rel = withVehicle(t.rel, html, report);
  if (t.rel === from) { unchanged++; continue; }
  if (taken.has(t.rel)) { console.log("SKIP (collides with " + taken.get(t.rel) + "): " + from); continue; }
  taken.set(t.rel, from);
  plan.push([src, path.join(ROOT, t.rel), from, t.rel]);
}

for (const [src, dst, from, rel] of plan) {
  const clobbers = fs.existsSync(dst);
  console.log(from + "\n   -> " + rel + (clobbers ? "   [replaces an existing save of the same page]" : ""));
  if (!DRY) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
  }
}
if (!DRY && plan.length) pruneEmpty(ROOT);
if (report.noVehicle) {
  console.log("\n" + report.noVehicle + " file(s) carry no vehicle and were left where they are." +
    "\nRe-run with --vehicle=NAME (e.g. --vehicle=gs450h_2007) to place them.");
}
console.log("\n" + plan.length + " moved, " + unchanged + " already correct, " + files.length + " total");
