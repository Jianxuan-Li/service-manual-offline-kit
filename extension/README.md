# TIS Page Saver

A small Chrome extension that saves the Toyota/Lexus TIS repair-manual page you
are reading as a **single self-contained HTML file**, with every illustration
embedded, so it still works with no signal — in a parking garage, under a car,
or on a phone in airplane mode.

Files are filed into folders that mirror the manual's own navigation tree, so a
few dozen saved pages stay navigable instead of becoming a pile of long
filenames.

```
Downloads/TIS/
└── brake/
    └── parking_brake/
        ├── parking_brake_assembly/
        │   ├── components.html
        │   ├── disassembly.html
        │   ├── inspection.html
        │   └── reassembly.html
        └── parking_brake_system/
            └── adjustment.html
```

**You need your own active TIS subscription.** This extension does not bypass
the paywall, does not bundle any manual content, and cannot fetch anything you
are not already logged in to read. It is a convenience tool for reading pages
you have paid for, offline, on your own vehicle. Don't redistribute what it
saves — that content is copyrighted.

---

## Install

Chrome does not need to be in developer mode for anything except loading an
unpacked extension, which is how this one is distributed.

1. Clone or download this repository somewhere permanent — **not** a temp
   folder. If you delete it later, the extension stops working.
2. Go to `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and pick the `extension/` folder
5. Optional: click the puzzle-piece icon in the toolbar and pin *TIS Page Saver*

## Use

1. Log in to TIS and open any manual document, so you can see the body text and
   the illustrations.
2. Click the toolbar icon.

The badge on the icon tells you what happened:

| Badge | Meaning |
| --- | --- |
| `...` | Working. Embedding images takes a few seconds on picture-heavy pages. |
| `OK` (green) | Saved. Folders came from the manual's navigation tree. |
| `OK*` (amber) | Saved, but the navigation tree could not be read, so the folders were derived from the page title instead. The file is fine. |
| `ERR` (red) | Failed — see the notification for the reason. |
| `!` (red) | This tab isn't a TIS page. |

Saved files land in `Downloads/TIS/` by default.

To turn a page into a PDF, open the saved file in a browser and print to PDF.
To read on a phone, AirDrop or copy the whole folder across — everything is
self-contained, no network needed.

## How the folders are chosen

Each document's path is decided in this order:

1. **The navigation tree.** The extension finds the current document in the
   left-hand tree and walks up its ancestors. This is the accurate route and
   produces a layout identical to the manual's own structure.
2. **The page title.** If the tree can't be read, the first part of the title
   (`PARKING BRAKE: ...`, `2GR-FSE IGNITION: ...`) is mapped to a top-level
   section, and the rest of the title supplies the deeper levels.
3. **`_unsorted/`.** If the section genuinely can't be identified, the file goes
   here rather than somewhere plausible but wrong. You'll get a notification when
   this happens.

Re-saving a page **replaces** the previous save rather than creating
`adjustment (1).html`. If a page saved with missing illustrations, just save it
again online and it repairs itself.

## Options

Right-click the toolbar icon and choose **Options**.

| Option | Default | What it does |
| --- | --- | --- |
| **Save folder** | `TIS` | Where files go, relative to your Downloads directory. Multiple levels are allowed, e.g. `cars/gs450h`. Blank means the Downloads root. |
| **Overwrite existing files** | on | Re-saving a page replaces it. Turn off to keep every copy. |
| **Put each vehicle in its own folder** | off | Adds a `gs450h_2007/` level at the top. Turn this on if you look up manuals for more than one car — the model and year are read from the page, not typed in. |
| **Show a message when something goes wrong** | on | Desktop notification explaining the failure, instead of just a red badge. |
| **Ask where to save each time** | off | Opens the system save dialog so you can write anywhere on disk. Tedious for more than a couple of pages. |

The options page also shows the full path of the last file saved, which is the
quickest answer to "where did it go?".

### Why can't I just pick any folder?

Chrome extensions can only write inside the browser's Downloads directory —
absolute paths are rejected by the browser itself. Your options are: set a
memorable sub-folder above, tick *Ask where to save each time*, or change
Chrome's own download location in `chrome://settings/downloads`.

On macOS the easiest fix is a symlink so the files are reachable from wherever
you like, without changing anything in Chrome:

```bash
ln -s ~/Downloads/TIS ~/Documents/ServiceManuals
```

## Re-sorting files you already saved

`reorg-existing.js` re-files everything on disk using the current rules. Every
saved file records what the extension detected, so the whole layout can be
rebuilt from the files themselves — no need to download anything again.

Requires Node.js. **Always dry-run first**, which prints the plan and moves
nothing:

```bash
node reorg-existing.js ~/Downloads/TIS --dry
```

```bash
node reorg-existing.js ~/Downloads/TIS
```

Switching vehicle grouping on afterwards, including for files saved before the
extension started recording the vehicle:

```bash
node reorg-existing.js ~/Downloads/TIS --vehicle=gs450h_2007
```

Files saved after that carry their own vehicle, so plain `--vehicle` is enough.
`--no-vehicle` strips the level back off. Empty folders are cleaned up, and a
file whose section can't be determined is reported rather than moved somewhere
arbitrary.

## Troubleshooting

**`ERR` right after opening a page.** The manual body loads asynchronously in a
frame, and the TIS viewer occasionally leaves it empty. The extension already
waits and retries a few times; if it still fails, reload the page, wait for the
illustrations, and click again.

**A saved file opens with missing images.** A few image fetches failed, usually a
network hiccup. Open the page online and save it again — it overwrites the bad
copy.

**Everything landed in `_unsorted/`.** The section keyword for that vehicle isn't
recognised yet. The files are complete and correct; only the folder is a guess.
Add the keyword to `TITLE_SECTION` in `background.js`, then re-run
`reorg-existing.js` to move them into place.

**A folder name looks wrong.** Each saved file records the navigation tree the
extension actually saw. That's the fastest way to diagnose a misfiling:

```bash
grep -o 'tis-tree" content="[^"]*"' ~/Downloads/TIS/path/to/file.html
```

## Permissions

| Permission | Why |
| --- | --- |
| `techinfo.toyota.com` | The only site the extension can touch. |
| `activeTab`, `scripting` | Read the page you clicked on, to capture its content. |
| `downloads` | Write the saved file. |
| `storage` | Remember your settings. |
| `notifications` | Explain failures in words. |

Nothing is sent anywhere. Everything happens in your browser and lands on your
disk.
