# Service Manual Offline Kit

Two tools for doing your own vehicle repairs with a factory service manual you
subscribe to, in a place with no signal.

| | |
| --- | --- |
| **[`extension/`](extension/)** | Chrome extension. Saves the Toyota/Lexus TIS manual page you are reading as one self-contained HTML file, images embedded, filed into folders that mirror the manual's own navigation tree. |
| **[`skill/`](skill/)** | A [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills) that turns those saved pages into a single offline job sheet you can follow on a phone under the car. |
| **[`examples/`](examples/)** | What the output looks like. |

**You need your own active manual subscription.** Nothing here bypasses a
paywall, bundles any manual content, or fetches anything you are not already
logged in to read. These are convenience tools for reading pages you have paid
for, offline, on your own vehicle. Manual content is copyrighted — don't
redistribute what you save, and note that this repository deliberately contains
no real manual pages for that reason.

---

## The extension

Full documentation: **[extension/README.md](extension/README.md)**

```
Downloads/TIS/
└── gs450h_2007/
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

Install: `chrome://extensions` → Developer mode → **Load unpacked** → pick the
`extension/` folder.

Two maintenance scripts live alongside it, both re-derivable from the saved
files themselves so nothing has to be downloaded twice:

```bash
node extension/reorg-existing.js ~/Downloads/TIS --dry     # re-file to current rules
node extension/fix-image-types.js ~/Downloads/TIS --dry    # repair image MIME types
```

## The skill

Full documentation: **[skill/SKILL.md](skill/SKILL.md)**

Install by copying it where Claude Code looks for skills:

```bash
cp -R skill ~/.claude/skills/service-manual-job-sheet
```

Then ask for a job sheet in plain language — *"pull everything for the rear
parking brake job into one file I can follow on my phone"* — and it reads the
relevant saved pages, extracts the illustrations that carry information words
can't, and builds a single HTML page.

The scripts work standalone too:

```bash
python3 skill/scripts/extract_manual.py text page.html
python3 skill/scripts/extract_manual.py imgs page.html --out figures/
python3 skill/scripts/build_job_sheet.py job.md -o job.html
```

## What a job sheet is

One file, one linear order, no navigating. The person reading it has dirty
hands, poor light, no signal, and a vehicle on stands. Tickable checkboxes,
big tap targets, dark-mode aware, line art inverted so it stays readable on a
dark screen, tables that scroll instead of squashing.

See [examples/job-sheet-rear-brake-pads.html](examples/job-sheet-rear-brake-pads.html)
and [examples/job-sheet-example.html](examples/job-sheet-example.html) — open
them locally; the figures and every specification in them are invented.

The rule the skill is built around: **torque values and wear limits are quoted
from the manual pages read during the task, never from recollection.** A number
that is close enough to sound right is wrong enough to strip a thread.

## Requirements

Chrome for the extension. Node.js for the two maintenance scripts. Python 3
(standard library only) for the skill's scripts.

## Licence

MIT for the code. It says nothing about manual content, which is not mine to
license and is not included here.
