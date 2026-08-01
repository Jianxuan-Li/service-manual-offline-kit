// TIS Page Saver - options page

const DEFAULTS = {
  folder: "TIS",
  overwrite: true,
  saveAs: false,
  groupByVehicle: false,
  notifications: true,
};

const $folder = document.getElementById("folder");
const $overwrite = document.getElementById("overwrite");
const $saveAs = document.getElementById("saveAs");
const $groupByVehicle = document.getElementById("groupByVehicle");
const $notifications = document.getElementById("notifications");
const $preview = document.getElementById("preview");
const $status = document.getElementById("status");
const $lastSaved = document.getElementById("lastSaved");

// Downloads only accepts a relative path: no leading slash, no "..", no drive letters.
function cleanFolder(raw) {
  return String(raw || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim().replace(/^\.+$/, ""))
    .filter(Boolean)
    .join("/");
}

function renderPreview() {
  const folder = cleanFolder($folder.value);
  const vehicle = $groupByVehicle.checked ? "gs450h_2007/" : "";
  const example = "brake/parking_brake/parking_brake_system/adjustment.html";
  $preview.textContent = "Downloads/" + (folder ? folder + "/" : "") + vehicle + example;
}

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  $folder.value = cfg.folder;
  $overwrite.checked = cfg.overwrite;
  $saveAs.checked = cfg.saveAs;
  $groupByVehicle.checked = cfg.groupByVehicle;
  $notifications.checked = cfg.notifications;
  renderPreview();
});

chrome.storage.local.get({ lastSaved: "", lastSavedAt: 0 }, (s) => {
  if (!s.lastSaved) return;
  $lastSaved.textContent =
    "Last saved: Downloads/" + s.lastSaved +
    (s.lastSavedAt ? "  (" + new Date(s.lastSavedAt).toLocaleString() + ")" : "");
});

const $indexCount = document.getElementById("indexCount");
const $indexFile = document.getElementById("indexFile");
const $importStatus = document.getElementById("importStatus");

function renderIndexCount() {
  chrome.storage.local.get({ savedDocs: {} }, (s) => {
    const n = Object.keys(s.savedDocs).length;
    $indexCount.textContent = n
      ? n + " document(s) known to be saved."
      : "No documents indexed yet.";
  });
}
renderIndexCount();

$indexFile.addEventListener("change", () => {
  const file = $indexFile.files && $indexFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try {
      incoming = JSON.parse(reader.result);
    } catch (e) {
      $importStatus.textContent = "Not valid JSON.";
      return;
    }
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      $importStatus.textContent = "Unexpected file format.";
      return;
    }
    // Merge rather than replace: anything saved since the file was built
    // should survive the import.
    chrome.storage.local.get({ savedDocs: {} }, (s) => {
      const merged = s.savedDocs;
      let added = 0;
      for (const [docId, rec] of Object.entries(incoming)) {
        if (!rec || typeof rec !== "object") continue;
        if (!merged[docId] || (merged[docId].at || 0) < (rec.at || 0)) {
          merged[docId] = { path: String(rec.path || ""), at: Number(rec.at) || Date.now() };
          added++;
        }
      }
      chrome.storage.local.set({ savedDocs: merged }, () => {
        $importStatus.textContent = "Imported " + added + " entries.";
        renderIndexCount();
      });
    });
  };
  reader.readAsText(file);
});

document.getElementById("clearIndex").addEventListener("click", () => {
  chrome.storage.local.set({ savedDocs: {} }, () => {
    $importStatus.textContent = "Index cleared.";
    renderIndexCount();
  });
});

$folder.addEventListener("input", renderPreview);
$groupByVehicle.addEventListener("change", renderPreview);

document.getElementById("save").addEventListener("click", () => {
  const folder = cleanFolder($folder.value);
  $folder.value = folder;
  renderPreview();
  chrome.storage.sync.set(
    {
      folder: folder,
      overwrite: $overwrite.checked,
      saveAs: $saveAs.checked,
      groupByVehicle: $groupByVehicle.checked,
      notifications: $notifications.checked,
    },
    () => {
      $status.classList.add("show");
      setTimeout(() => $status.classList.remove("show"), 1500);
    }
  );
});
