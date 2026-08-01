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
