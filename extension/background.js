// TIS Page Saver - background service worker (MV3)
// On toolbar click: inject the capture script into the active TIS tab.

// Settings live in chrome.storage.sync; see options.html / options.js.
const DEFAULTS = {
  folder: "TIS",
  overwrite: true,
  saveAs: false,
  groupByVehicle: false,
  notifications: true,
};

// The ten top-level nodes of the TIS navigation tree. Used two ways:
// as a sanity check on a tree path scraped from the nav frame, and as the
// target of TITLE_SECTION below when no tree path could be read.
const TOP_SECTIONS = [
  "General",
  "Audio/Visual/Telematics",
  "Brake",
  "Drivetrain",
  "Engine/Hybrid System",
  "Power Source/Network",
  "Steering",
  "Suspension",
  "Vehicle Exterior",
  "Vehicle Interior",
];

// Fallback map: first segment of the doc title -> top-level section.
// Matched as a prefix, longest first, so "BRAKE CONTROL" beats "BRAKE".
const TITLE_SECTION = [
  ["PARKING BRAKE", "Brake"],
  ["BRAKE", "Brake"],
  ["IGNITION", "Engine/Hybrid System"],
  ["INTAKE", "Engine/Hybrid System"],
  ["EXHAUST", "Engine/Hybrid System"],
  ["ENGINE", "Engine/Hybrid System"],
  ["FUEL", "Engine/Hybrid System"],
  ["COOLING", "Engine/Hybrid System"],
  ["LUBRICATION", "Engine/Hybrid System"],
  ["EMISSION", "Engine/Hybrid System"],
  ["SFI", "Engine/Hybrid System"],
  ["HYBRID", "Engine/Hybrid System"],
  ["HV", "Engine/Hybrid System"],
  ["DRIVE SHAFT", "Drivetrain"],
  ["DIFFERENTIAL", "Drivetrain"],
  ["TRANSAXLE", "Drivetrain"],
  ["TRANSMISSION", "Drivetrain"],
  ["PROPELLER", "Drivetrain"],
  ["CLUTCH", "Drivetrain"],
  // Body-on-frame 4WD (GX460 and friends) splits what a GS calls a transaxle
  // into a transmission, a transfer case and two differentials.
  ["TRANSFER", "Drivetrain"],
  ["4WD", "Drivetrain"],
  ["AWD", "Drivetrain"],
  ["DRIVE LINE", "Drivetrain"],
  ["STEERING", "Steering"],
  ["SUSPENSION", "Suspension"],
  ["TIRE", "Suspension"],
  ["WHEEL", "Suspension"],
  ["AXLE", "Suspension"],
  ["SEAT", "Vehicle Interior"],
  ["INSTRUMENT PANEL", "Vehicle Interior"],
  ["INTERIOR", "Vehicle Interior"],
  ["METER", "Vehicle Interior"],
  ["HORN", "Vehicle Interior"],
  ["DOOR", "Vehicle Exterior"],
  ["WINDOW", "Vehicle Exterior"],
  ["WINDSHIELD", "Vehicle Exterior"],
  ["ROOF", "Vehicle Exterior"],
  ["MIRROR", "Vehicle Exterior"],
  ["BUMPER", "Vehicle Exterior"],
  ["HOOD", "Vehicle Exterior"],
  ["LIGHTING", "Vehicle Exterior"],
  ["WIPER", "Vehicle Exterior"],
  ["AUDIO", "Audio/Visual/Telematics"],
  ["NAVIGATION", "Audio/Visual/Telematics"],
  ["TELEPHONE", "Audio/Visual/Telematics"],
  ["CHARGING", "Power Source/Network"],
  ["STARTING", "Power Source/Network"],
  ["BATTERY", "Power Source/Network"],
  ["POWER SOURCE", "Power Source/Network"],
  ["NETWORK", "Power Source/Network"],
  ["CAN ", "Power Source/Network"],
  ["INTRODUCTION", "General"],
  ["MAINTENANCE", "General"],
  ["PREPARATION", "General"],
  ["SERVICE SPECIFICATIONS", "General"],
  ["IDENTIFICATION", "General"],
  ["REPAIR INSTRUCTION", "General"],
  ["TERMS", "General"],
  ["FOREWORD", "General"],
  ["CAUTION", "General"],
  ["GENERAL", "General"],
];

function slug(s) {
  return String(s)
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

// Downloads only accepts a path relative to the Downloads directory:
// no leading slash, no "..", no absolute paths.
function cleanFolder(raw) {
  return String(raw || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim().replace(/^\.+$/, ""))
    .filter(Boolean)
    .join("/");
}

// Engine titles carry an engine-code prefix -- "2GR-FSE IGNITION: SPARK PLUG:
// REMOVAL" -- so the keyword is matched anywhere in the first title segment,
// not just at its start. Longest match wins, which keeps "PARKING BRAKE" from
// being decided by "BRAKE".
function sectionForTitle(title) {
  const head = String(title || "").split(";")[0].split(":")[0].trim().toUpperCase();
  let best = null;
  for (const [keyword, section] of TITLE_SECTION) {
    if (head.indexOf(keyword) !== -1 && (!best || keyword.length > best[0].length)) {
      best = [keyword, section];
    }
  }
  return best ? best[1] : null;
}

// Title -> the trailing folder/file part, e.g.
// "PARKING BRAKE: PARKING BRAKE SYSTEM: ADJUSTMENT; 2007 MY GS450H [02/2006 - ]"
//   -> ["parking_brake", "parking_brake_system", "adjustment"]
function titleSegments(title) {
  return String(title || "").split(";")[0].split(":").map(slug).filter(Boolean);
}

// Drop repeated neighbours so a "Brake" section holding a "BRAKE" group
// yields brake/front_brake/... rather than brake/brake/front_brake/...
function dedupe(parts) {
  const out = [];
  for (const p of parts) if (p !== out[out.length - 1]) out.push(p);
  return out;
}

// Raw tree labels -> the folder slugs to use, or null if they look unreliable.
//
// Verified against the live nav tree: the DOM walk reliably finds the real
// ancestors, but because tree rows are flat sibling <table>s it also drags in
// neighbouring *document* rows. Those always carry the model-year qualifier
// ("...; 2007 MY GS450H [02/2006 - ]") while group nodes never do, so dropping
// every label containing ";" is what actually makes the path correct.
//
// Everything above the manual's root node ("Lexus 2007 GS450H Repair Manual
// (RM02D0U)", plus loader noise above it) is discarded. The root is found by
// the publication id from the document URL, which works for any model, year
// and language -- TOP_SECTIONS is only a fallback for when that fails.
function normalizeTreePath(labels, pubId) {
  if (!Array.isArray(labels) || labels.length < 2) return null;
  const folders = labels.slice(0, -1).filter((l) => String(l).indexOf(";") === -1);

  if (pubId) {
    const rootAt = folders.findIndex((l) => String(l).indexOf(pubId) !== -1);
    if (rootAt !== -1) {
      const slugs = folders.slice(rootAt + 1).map(slug).filter(Boolean);
      return slugs.length ? slugs.slice(0, 12) : null;
    }
  }

  const tops = TOP_SECTIONS.map(slug);
  const slugs = folders.map(slug).filter(Boolean);
  const start = slugs.findIndex((s) => tops.indexOf(s) !== -1);
  if (start === -1) return null;
  return slugs.slice(start, start + 12);
}

// Full relative path for one captured page.
// Preference: real nav-tree path > title section map > title alone.
function buildPath(payload, cfg) {
  const segs = payload.titleOk ? titleSegments(payload.title) : [];
  // Without a parsed "Title:" line every page would share the viewer's own
  // <title>, so they would all collapse onto one filename. Fall back to the
  // document id, which is unique per page.
  const file = (segs.pop() || slug(payload.docId) || "tis_page") + ".html";

  const tree = payload.titleOk ? normalizeTreePath(payload.treeLabels, payload.pubId) : null;
  let parts;
  if (tree) {
    // The tree already spells out every folder level. Appending the title
    // segments on top would repeat the deepest ones: general/introduction/
    // how_to_use_this_manual/introduction/how_to_use_this_manual/...
    parts = tree;
  } else {
    const section = sectionForTitle(payload.title);
    parts = (section ? [slug(section)] : ["_unsorted"]).concat(segs);
  }
  return dedupe(parts).concat(file).join("/");
}

// ---- "already saved" index ----
// Keyed by the document id, which is the one identifier that appears in the
// viewer's own frame URL. That means the badge can be answered from the URL
// alone, with no need to inject anything into the page just to look.
const INDEX_KEY = "savedDocs";

function docIdFromUrl(url) {
  const m = String(url || "").match(/\/xhtml\/([A-Za-z0-9_-]+)\.x?html?(?:[?#]|$)/);
  return m ? m[1] : "";
}

async function markSaved(docId, relPath) {
  if (!docId) return;
  const store = await chrome.storage.local.get({ [INDEX_KEY]: {} });
  const index = store[INDEX_KEY];
  index[docId] = { path: relPath, at: Date.now() };
  await chrome.storage.local.set({ [INDEX_KEY]: index });
}

// Per-tab memory of which document is on screen, so the badge can be restored
// after a transient "..."/"OK" status without re-reading the page.
const tabDoc = {};

async function refreshBadge(tabId, docId) {
  if (docId) tabDoc[tabId] = docId;
  const id = docId || tabDoc[tabId];
  if (!id) return;
  const store = await chrome.storage.local.get({ [INDEX_KEY]: {} });
  const hit = store[INDEX_KEY][id];
  try {
    if (hit) {
      chrome.action.setBadgeText({ tabId: tabId, text: "✓" });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#0a0" });
      chrome.action.setTitle({
        tabId: tabId,
        title: "Already saved " + new Date(hit.at).toLocaleDateString() +
          "\n" + hit.path + "\nClick to save again (replaces it).",
      });
    } else {
      chrome.action.setBadgeText({ tabId: tabId, text: "" });
      chrome.action.setTitle({ tabId: tabId, title: "Save this TIS page for offline use" });
    }
  } catch (e) { /* tab closed mid-check */ }
}

// The manual body is a sub-frame that navigates on its own, so a plain
// tabs.onUpdated never fires for it -- watch frame commits instead.
chrome.webNavigation.onCommitted.addListener(
  (d) => {
    const docId = docIdFromUrl(d.url);
    if (docId) refreshBadge(d.tabId, docId);
  },
  { url: [{ hostSuffix: "techinfo.toyota.com", pathContains: "/xhtml/" }] }
);

chrome.tabs.onActivated.addListener((info) => refreshBadge(info.tabId, null));
chrome.tabs.onRemoved.addListener((tabId) => { delete tabDoc[tabId]; });

// A one-line explanation the user can actually act on, instead of "ERR".
function notify(cfg, title, message) {
  if (cfg && cfg.notifications === false) return;
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title: title,
      message: message,
    });
  } catch (e) { /* notifications are a nicety, never fail the save over them */ }
}

chrome.action.onClicked.addListener(async (tab) => {
  const cfg = await chrome.storage.sync.get(DEFAULTS);

  if (!tab.url || !tab.url.includes("techinfo.toyota.com")) {
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#c00" });
    notify(cfg, "Not a TIS page",
      "Open a manual page on techinfo.toyota.com first, then click the icon.");
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
    return;
  }

  chrome.action.setBadgeText({ tabId: tab.id, text: "..." });
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#08c" });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      func: capturePage,
    });
    const payload = results && results[0] && results[0].result;
    if (!payload || !payload.html) throw new Error(payload && payload.error ? payload.error : "no content");

    const usedTree = !!(payload.titleOk && normalizeTreePath(payload.treeLabels, payload.pubId));
    let relPath = buildPath(payload, cfg);
    if (cfg.groupByVehicle && payload.vehicle) relPath = slug(payload.vehicle) + "/" + relPath;
    console.log("TIS save:", relPath, usedTree ? "(tree)" : "(title map)",
      "raw tree labels:", payload.treeLabels);

    // Record what we detected inside the file so a later re-sort can redo the
    // whole layout from the files themselves -- including switching vehicle
    // grouping on or off after the fact.
    const attr = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const meta =
      '<meta name="tis-path" content="' + attr(relPath) + '">' +
      '<meta name="tis-tree" content="' + attr((payload.treeLabels || []).join(" > ")) + '">' +
      '<meta name="tis-vehicle" content="' + attr(payload.vehicle) + '">' +
      '<meta name="tis-pub" content="' + attr(payload.pubId) + '">';
    const html = payload.html.replace("<meta charset=\"utf-8\">", "<meta charset=\"utf-8\">" + meta);

    // Download via data URL (service workers can't use URL.createObjectURL)
    const dataUrl = "data:text/html;charset=utf-8;base64," +
      btoa(unescape(encodeURIComponent(html)));

    const folder = cleanFolder(cfg.folder);
    const fullPath = (folder ? folder + "/" : "") + relPath;
    await chrome.downloads.download({
      url: dataUrl,
      filename: fullPath,
      // "overwrite" replaces an earlier save of the same page instead of piling
      // up "adjustment (1).html". Never overwrite on a guessed filename though:
      // a wrong guess would silently destroy a good save.
      conflictAction: cfg.overwrite && payload.titleOk ? "overwrite" : "uniquify",
      saveAs: !!cfg.saveAs,
    });

    chrome.storage.local.set({ lastSaved: fullPath, lastSavedAt: Date.now() });
    await markSaved(payload.docId, fullPath);

    // "OK" = folders came from the real nav tree, "OK*" = from the title map.
    chrome.action.setBadgeText({ tabId: tab.id, text: usedTree ? "OK" : "OK*" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: usedTree ? "#0a0" : "#e6a700" });
    if (!payload.titleOk) {
      notify(cfg, "Saved, but the page title was unreadable",
        "Filed under a document id instead of a name: " + fullPath +
        ". Reloading the manual page and saving again usually fixes it.");
    } else if (relPath.indexOf("_unsorted/") === 0) {
      // Worth surfacing: it means this section of this vehicle is not covered
      // yet, and every page in it will pile up in the same place.
      notify(cfg, "Saved to _unsorted",
        "This page's section could not be identified, so it went to " + fullPath +
        ". The file is fine; only its folder is a guess.");
    }
  } catch (e) {
    console.error("TIS save failed:", e);
    chrome.action.setBadgeText({ tabId: tab.id, text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#c00" });
    notify(cfg, "Could not save this page", String((e && e.message) || e));
  }
  // Let the transient status show, then fall back to the persistent "✓".
  setTimeout(() => refreshBadge(tab.id, null).catch(() => {}), 3000);
});

// ---- Injected into the TIS page ----
// Finds the deepest content frame (the actual manual xhtml), clones it,
// inlines all <img> as base64, and returns a standalone HTML string plus the
// navigation-tree labels leading to this document.
async function capturePage() {
  try {
    // 1. Locate the content document: walk all frames, pick the one whose URL
    //    contains /xhtml/ (TIS manual body), else the largest body.
    function collectFrames(win, out) {
      try {
        out.push(win);
        for (let i = 0; i < win.frames.length; i++) collectFrames(win.frames[i], out);
      } catch (e) {}
      return out;
    }
    // The TIS viewer intermittently leaves the content frame empty. Give it a
    // few moments to fill in rather than failing and asking the user to retry.
    function findContentWin(wins) {
      for (const w of wins) {
        try {
          if (!/\/xhtml\//.test(w.location.href)) continue;
          const b = w.document && w.document.body;
          if (b && b.innerHTML.length > 200) return w;
        } catch (e) {}
      }
      return null;
    }
    let wins = collectFrames(window, []);
    let contentWin = findContentWin(wins);
    for (let attempt = 0; !contentWin && attempt < 4; attempt++) {
      await new Promise((r) => setTimeout(r, 700));
      wins = collectFrames(window, []);
      contentWin = findContentWin(wins);
    }
    if (!contentWin) {
      // Last resort: whichever frame holds the most markup.
      let best = 200;
      for (const w of wins) {
        try {
          const len = (w.document.body && w.document.body.innerHTML.length) || 0;
          if (len > best) { best = len; contentWin = w; }
        } catch (e) {}
      }
    }
    if (!contentWin || !contentWin.document || !contentWin.document.body) {
      return { error: "The manual text has not loaded in this tab. Reload the page (Cmd-R), wait until the illustrations appear, then click the icon again." };
    }
    const doc = contentWin.document;

    // 2. Clone body and inline every image as base64 so it works offline.
    const clone = doc.body.cloneNode(true);
    const imgs = clone.querySelectorAll("img");
    for (const img of imgs) {
      try {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) continue;
        const abs = new URL(src, contentWin.location.href).href;
        const resp = await fetch(abs, { credentials: "include" });
        const blob = await resp.blob();
        let dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
        // TIS serves illustrations as application/octet-stream, and a data URL
        // with that type is not required to render as an image -- Chrome sniffs
        // it, mobile Safari may not. Restamp the real type from the payload's
        // magic bytes so the saved file works on a phone.
        if (!/^data:image\//.test(dataUrl)) {
          const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
          const kind = b64.startsWith("iVBORw0KGgo") ? "png"
            : b64.startsWith("/9j/") ? "jpeg"
            : b64.startsWith("R0lGOD") ? "gif"
            : b64.startsWith("UklGR") ? "webp"
            : "";
          if (kind) dataUrl = "data:image/" + kind + ";base64," + b64;
        }
        img.setAttribute("src", dataUrl);
      } catch (e) { /* keep original src if fetch fails */ }
    }

    // 3. Grab the doc title, the document id and the publication id. The URL is
    //    authoritative for the two ids; the header text is only a fallback.
    const bodyText = doc.body.innerText || "";
    const m = bodyText.match(/Title:\s*(.+)/);
    const titleOk = !!(m && m[1].trim());
    // document.title here is the viewer's, identical on every page, so it can
    // never be used to name a file - only to label one.
    const title = titleOk ? m[1].trim() : (document.title || "TIS page");

    const path = contentWin.location.pathname;
    let docId = "";
    const pm = path.match(/([A-Za-z0-9_-]+)\.x?html?$/);
    if (pm) docId = pm[1];
    if (!docId) {
      const dm = bodyText.match(/Doc ID:\s*([A-Za-z0-9_-]+)/);
      if (dm) docId = dm[1].trim();
    }
    // "/t3Portal/document/rm/RM02D0U/xhtml/..." -> "RM02D0U", which is also
    // printed in the nav tree's root label and marks where the real path starts.
    let pubId = "";
    const rm = path.match(/\/rm\/([A-Za-z0-9_-]+)\//);
    if (rm) pubId = rm[1];

    // Model and year for the optional per-vehicle folder.
    let vehicle = "";
    try {
      const q = new URLSearchParams(top.location.search);
      const model = q.get("model") || "";
      const my = q.get("MY") || "";
      vehicle = [model, my].filter(Boolean).join(" ");
    } catch (e) {}

    // 4. Find this document in the left-hand navigation tree and read the
    //    labels of its ancestors. The tree lives in a sibling frame and its
    //    node references the doc id somewhere in its attributes, so key off
    //    that rather than off styling, which varies.
    function textOf(el) {
      if (!el) return "";
      const t = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (!t || t.length > 90 || !/[A-Za-z]/.test(t)) return "";
      return t;
    }

    function deepestMatch(d, needle) {
      const hits = [];
      const all = d.querySelectorAll("*");
      for (const el of all) {
        let hay = "";
        for (const at of el.attributes) hay += " " + at.value;
        if (hay.indexOf(needle) !== -1) hits.push(el);
      }
      if (!hits.length) return null;
      for (const h of hits) {
        if (!hits.some((o) => o !== h && h.contains(o))) return h;
      }
      return hits[hits.length - 1];
    }

    // The label of a tree group sits immediately before the container holding
    // its children, so only ever look backwards from the container. Looking
    // backwards from the child instead returns the previous *sibling document*,
    // which reads as a parent for every node except the first in a list.
    function labelBefore(el) {
      let p = el && el.previousElementSibling;
      while (p) {
        const t = textOf(p);
        if (t) return t;
        p = p.previousElementSibling;
      }
      return "";
    }

    function treeLabelsFor(needle) {
      if (!needle) return null;
      for (const w of wins) {
        let d;
        try { d = w.document; } catch (e) { continue; }
        if (!d || !d.body) continue;
        try { if (/\/xhtml\//.test(w.location.href)) continue; } catch (e) {}
        const node = deepestMatch(d, needle);
        if (!node) continue;

        const labels = [];
        const self = textOf(node);
        if (self) labels.push(self);
        let cur = node.parentElement;
        let guard = 0;
        while (cur && cur !== d.body && cur !== d.documentElement && guard++ < 40) {
          const lbl = labelBefore(cur);
          if (lbl && lbl !== labels[0]) labels.unshift(lbl);
          cur = cur.parentElement;
        }
        if (labels.length) return labels;
      }
      return null;
    }

    let treeLabels = null;
    try { treeLabels = treeLabelsFor(docId); } catch (e) {}

    // 5. Build standalone HTML with print-friendly styling.
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html =
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
      "<title>" + esc(title) + "</title>" +
      "<style>" +
      "body{font-family:-apple-system,Segoe UI,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;line-height:1.45}" +
      "img{max-width:100%;height:auto;border:1px solid #ddd;margin:8px 0}" +
      "table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}" +
      ".tis-hdr{background:#f4f4f4;border-left:4px solid #c00;padding:10px 14px;margin-bottom:18px;font-size:13px}" +
      "@media print{body{margin:0;max-width:none}}" +
      "</style></head><body>" +
      "<div class=\"tis-hdr\"><b>" + esc(title) + "</b><br>" +
      (treeLabels ? esc(treeLabels.join(" > ")) + "<br>" : "") +
      "Saved from Toyota TIS on " + new Date().toLocaleString() +
      " &middot; Source: " + esc(path) + "</div>" +
      clone.innerHTML +
      "</body></html>";

    return {
      html: html, title: title, titleOk: titleOk, docId: docId,
      pubId: pubId, vehicle: vehicle, treeLabels: treeLabels,
    };
  } catch (e) {
    return { error: String(e) };
  }
}
