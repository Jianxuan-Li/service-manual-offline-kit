#!/usr/bin/env python3
"""Turn a job-sheet Markdown file into one self-contained offline HTML page.

    python3 build_job_sheet.py job.md [-o job.html] [--title "..."]

Every referenced image is inlined as a data URI, so the result is a single file
that opens from a phone's Files app with no network. Written for reading under
a car: large tap targets, high contrast, dark-mode aware, line art inverted so
it stays legible on a dark screen, and tables that scroll instead of squashing.

Markdown subset, chosen to cover what a job sheet actually needs:

    # ## ###          headings
    - [ ] item        tappable checkbox that strikes through when ticked
    - item            bullet
    1. item           numbered step
    > text            warning callout (amber)
    !> text           danger callout (red) - for anything that can hurt you
    | a | b |         table (needs the |---|---| separator row)
    ![cap](path)      figure, image inlined, caption below
    ---               rule
    **b** ~~s~~ `c`   inline emphasis

Images are resolved relative to the Markdown file. A missing image is reported
on stderr and skipped rather than silently producing a broken page - finding
out in the garage is worse than finding out now.
"""
import argparse
import base64
import html
import mimetypes
import os
import re
import sys

SIGS = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF8", "image/gif"),
    (b"RIFF", "image/webp"),
]


def data_uri(path):
    """Inline an image, trusting its magic bytes over its file extension.

    Service-manual viewers often serve illustrations as
    application/octet-stream; a data URI carrying that type is not required to
    render as an image, and mobile Safari may refuse it outright.
    """
    with open(path, "rb") as fh:
        blob = fh.read()
    mime = next((m for sig, m in SIGS if blob.startswith(sig)), None)
    if mime is None:
        mime = mimetypes.guess_type(path)[0] or "image/png"
    if mime == "image/webp" and blob[8:12] != b"WEBP":
        mime = mimetypes.guess_type(path)[0] or "image/png"
    return "data:%s;base64,%s" % (mime, base64.b64encode(blob).decode())


def inline(text):
    out = html.escape(text, quote=False)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"~~(.+?)~~", r"<del>\1</del>", out)
    out = re.sub(r"`(.+?)`", r"<code>\1</code>", out)
    return out


def convert(md, base_dir, missing):
    lines = md.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # table: header row followed by a |---|---| separator
        if line.startswith("|") and i + 1 < len(lines) \
                and set(lines[i + 1].replace("|", "").strip()) <= set("-: ") \
                and lines[i + 1].strip():
            head = [c.strip() for c in line.strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
                i += 1
            out.append(
                "<div class=\"tw\"><table><thead><tr>"
                + "".join("<th>%s</th>" % inline(c) for c in head)
                + "</tr></thead><tbody>"
                + "".join("<tr>" + "".join("<td>%s</td>" % inline(c) for c in r) + "</tr>"
                          for r in rows)
                + "</tbody></table></div>")
            continue

        # figure
        m = re.match(r"^!\[(.*?)\]\((.+?)\)\s*$", line)
        if m:
            cap, src = m.group(1), m.group(2)
            path = src if os.path.isabs(src) else os.path.join(base_dir, src)
            if os.path.isfile(path):
                fig = "<figure><img src=\"%s\" alt=\"%s\">" % (data_uri(path), html.escape(cap, quote=True))
                if cap:
                    fig += "<figcaption>%s</figcaption>" % inline(cap)
                out.append(fig + "</figure>")
            else:
                missing.append(src)
            i += 1
            continue

        if line.startswith("- [ ] ") or line.startswith("- [x] "):
            checked = " checked" if line[3] == "x" else ""
            out.append("<label class=\"ck\"><input type=\"checkbox\"%s><span>%s</span></label>"
                       % (checked, inline(line[6:])))
            i += 1
            continue

        m = re.match(r"^(#{1,3}) (.+)", line)
        if m:
            lvl = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (lvl, inline(m.group(2)), lvl))
            i += 1
            continue

        if line.startswith("!> "):
            out.append("<div class=\"cal danger\">%s</div>" % inline(line[3:]))
            i += 1
            continue
        if line.startswith("> "):
            out.append("<div class=\"cal warn\">%s</div>" % inline(line[2:]))
            i += 1
            continue

        if line.strip() in ("---", "***"):
            out.append("<hr>")
            i += 1
            continue

        m = re.match(r"^(\d+)\. (.+)", line)
        if m:
            out.append("<div class=\"li n\" data-n=\"%s\">%s</div>" % (m.group(1), inline(m.group(2))))
            i += 1
            continue

        if line.startswith("- "):
            out.append("<div class=\"li\">%s</div>" % inline(line[2:]))
            i += 1
            continue

        if line.strip():
            out.append("<p>%s</p>" % inline(line))
        i += 1
    return "\n".join(out)


CSS = """*{box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Segoe UI",system-ui,sans-serif;
max-width:820px;margin:0 auto;padding:16px 14px 64px;line-height:1.6;
color:#1a1a1a;background:#fff;-webkit-text-size-adjust:100%}
h1{font-size:22px;border-bottom:3px solid #c00;padding-bottom:8px;margin:0 0 14px}
h2{font-size:18px;margin:30px 0 10px;padding:7px 10px;background:#f0f0f0;
border-left:4px solid #c00;border-radius:3px}
h3{font-size:15.5px;margin:20px 0 8px;color:#c00}
p{margin:8px 0}
.li{margin:6px 0 6px 20px;position:relative}
.li:before{content:"\\2022";position:absolute;left:-14px;color:#c00}
.li.n:before{content:attr(data-n) ".";left:-20px;font-weight:700;font-size:13px}
.cal{margin:12px 0;padding:10px 13px;border-radius:3px;font-size:14.5px;border-left:4px solid}
.warn{background:#fff8e1;border-color:#e6a700}
.danger{background:#ffebee;border-color:#c00;font-weight:600}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{border:1px solid #ccc;padding:7px 9px;text-align:left;white-space:nowrap}
th{background:#f4f4f4}
code{background:#eee;padding:1px 5px;border-radius:3px;font-size:13px;word-break:break-all}
del{color:#999}
hr{border:0;border-top:1px solid #ddd;margin:26px 0}
figure{margin:16px 0;padding:12px;background:#fafafa;border:1px solid #e0e0e0;border-radius:6px}
figure img{width:100%;height:auto;display:block;border-radius:3px}
figcaption{font-size:13px;color:#555;margin-top:8px;line-height:1.45}
.ck{display:flex;align-items:flex-start;gap:10px;margin:7px 0;padding:9px 11px;
background:#f7f7f7;border-radius:5px;cursor:pointer}
.ck input{margin:3px 0 0;width:20px;height:20px;flex:none;accent-color:#c00}
.ck input:checked+span{text-decoration:line-through;color:#999}
@media(prefers-color-scheme:dark){
body{background:#181818;color:#e8e8e8}
h2{background:#262626}h3{color:#ff6b6b}
.warn{background:#3a3225;border-color:#c9a227}
.danger{background:#3d2222;border-color:#e05252}
th{background:#262626}th,td{border-color:#444}
code{background:#2c2c2c}
figure{background:#202020;border-color:#333}figcaption{color:#aaa}
.ck{background:#222}
hr{border-top-color:#333}
figure img{filter:invert(1) hue-rotate(180deg)}}
@media print{.ck,h2{background:none}body{padding:0}}"""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("markdown")
    ap.add_argument("-o", "--output")
    ap.add_argument("--title")
    args = ap.parse_args()

    with open(args.markdown, encoding="utf-8") as fh:
        md = fh.read()
    base_dir = os.path.dirname(os.path.abspath(args.markdown))

    missing = []
    body = convert(md, base_dir, missing)
    for src in missing:
        print("WARNING: image not found, skipped: %s" % src, file=sys.stderr)

    m = re.search(r"^# (.+)", md, re.M)
    title = args.title or (m.group(1).strip() if m else "Job Sheet")

    out_path = args.output or os.path.splitext(args.markdown)[0] + ".html"
    page = ("<!DOCTYPE html>\n<html lang=\"zh\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
            "<title>%s</title>\n<style>\n%s\n</style>\n</head>\n<body>\n%s\n</body>\n</html>\n"
            % (html.escape(title, quote=False), CSS, body))
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(page)

    imgs = page.count("<img src=\"data:")
    print("%s  (%d KB, %d image(s) inlined, %d checkbox(es))"
          % (out_path, len(page.encode()) // 1024, imgs, page.count("type=\"checkbox\"")))
    if missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
