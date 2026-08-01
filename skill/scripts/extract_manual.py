#!/usr/bin/env python3
"""Pull readable text and illustrations out of saved service-manual HTML pages.

    python3 extract_manual.py text  page.html [page.html ...]
    python3 extract_manual.py imgs  page.html --out DIR [--min-kb 3]

`text` strips markup and base64 image payloads so the procedure can actually be
read and quoted accurately - the whole point is that a job sheet repeats the
manual's real step numbers, torques and limits rather than a recollection of
them.

`imgs` writes each embedded illustration to a file so it can be looked at and
then referenced from the job-sheet Markdown. Tiny images are skipped by default
because manual pages are full of icon-sized legend glyphs and site logos; raise
or lower --min-kb when the legend symbols are the thing you need (they often
are - they define what the markers on an exploded view mean).
"""
import argparse
import base64
import html
import os
import re
import sys

SIGS = [(b"\x89PNG", "png"), (b"\xff\xd8\xff", "jpg"), (b"GIF8", "gif"), (b"RIFF", "webp")]


def read(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read()


def to_text(page):
    page = re.sub(r"data:[^\"']+", "", page)
    page = re.sub(r"<(script|style)\b.*?</\1>", "", page, flags=re.S | re.I)
    page = re.sub(r"<div class=\"tis-hdr\".*?</div>", "", page, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", page))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


def dump_images(path, out_dir, min_kb):
    page = read(path)
    os.makedirs(out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(path))[0]
    written = []
    for idx, m in enumerate(re.finditer(r"src=\"data:[^;]+;base64,([A-Za-z0-9+/=]+)\"", page)):
        try:
            blob = base64.b64decode(m.group(1))
        except Exception:
            continue
        if len(blob) < min_kb * 1024:
            continue
        ext = next((e for sig, e in SIGS if blob.startswith(sig)), "bin")
        dest = os.path.join(out_dir, "%s_%02d.%s" % (stem, idx, ext))
        with open(dest, "wb") as fh:
            fh.write(blob)
        written.append((dest, len(blob) // 1024))
    return written


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["text", "imgs"])
    ap.add_argument("pages", nargs="+")
    ap.add_argument("--out", default="figures")
    ap.add_argument("--min-kb", type=float, default=3)
    args = ap.parse_args()

    for path in args.pages:
        if not os.path.isfile(path):
            print("not found: %s" % path, file=sys.stderr)
            continue
        if args.mode == "text":
            print("\n########## %s ##########" % path)
            print(to_text(read(path)))
        else:
            for dest, kb in dump_images(path, args.out, args.min_kb):
                print("%s  %d KB" % (dest, kb))


if __name__ == "__main__":
    main()
