---
name: service-manual-job-sheet
description: Build a single self-contained offline HTML job sheet from saved factory service manual (FSM/TIS/RM) pages, so a repair procedure can be followed on a phone in a garage with no signal. Use this whenever the user is preparing to do their own vehicle repair or maintenance and wants the steps, torque values, specs and diagrams pulled together into one place they can follow top-to-bottom - phrases like "extract this job into a note", "make me a checklist for this repair", "I can't use a laptop in the garage", "put everything for this job in one file", or any request to consolidate manual pages into a procedure. Also use it when the user asks to turn a service procedure into something readable offline or on a phone, even if they don't say "job sheet".
---

# Service manual job sheet

A job sheet is what someone actually holds while working on a car: one file,
one linear order, no navigating. The person reading it has dirty hands, poor
light, no signal, and a vehicle on jack stands. Everything they need is in it
and nothing else is.

The output is a single HTML file. Not a PDF (can't tick boxes, reflows badly),
not a folder of pages (navigation costs time under a car), not chat text (gone
when the phone locks).

## Ground rule: quote the manual, never your memory

Torque values, clearances, wear limits and step order must come from the
user's own manual pages, read during this task. A number you recall for "a
2007 Lexus" is close enough to sound right and wrong enough to strip a thread
or leave a wheel loose. If a needed figure isn't in the pages you were given,
say so plainly and leave a blank for the user to fill - an obvious gap is
safe, a confident guess is not.

Read the source pages with:

```bash
python3 scripts/extract_manual.py text page1.html page2.html
```

## Workflow

**1. Find the real procedure.** Manuals often hold several routes to the same
end, and the shortest safe one is rarely the first one found. Read the
candidates before choosing. A concrete example of why this matters: replacing
parking brake shoes has a `PARKING BRAKE ASSEMBLY: DISASSEMBLY` procedure that
just unbolts the caliper and hangs it aside, and a `REAR BRAKE: REMOVAL`
procedure that drains the brake fluid and opens the hydraulic system. Both
reach the shoes. Only one leaves the user needing a scan tool to finish. Pick
deliberately, then say in the sheet what is *not* being touched and why - that
reassurance is worth as much as the steps.

**2. Collect the illustrations that carry information words can't.** Spring
hook orientation, lift points, exploded views, torque callouts, and the legend
symbols that decode them. Skip decorative logos.

```bash
python3 scripts/extract_manual.py imgs page.html --out figures/
```

Look at each one before referencing it. An exploded view usually encodes
non-reusable parts, grease points and torques as symbols; decode them in the
caption so the reader doesn't have to cross-reference a legend in a garage.

**3. Write the sheet as Markdown**, in the order the work happens. Structure
below.

**4. Build it.**

```bash
python3 scripts/build_job_sheet.py job.md -o job.html
```

Images are inlined as data URIs and resolved relative to the Markdown file.
The script reports how many images and checkboxes ended up in the page, and
exits non-zero if a referenced image was missing - check that count against
what you intended rather than assuming.

**5. Hand over the HTML and the Markdown both.** The HTML is for the garage;
the Markdown is for pasting into a notes app and editing later.

## Structure

Order the sheet the way the job unfolds, because that is how it will be read:

1. **Title + source + scope.** Which manual, and explicitly what this job does
   *not* touch.
2. **Pre-flight checklist** - `- [ ]` items. Tools, consumables, one-time
   parts, anything to verify while still indoors. Catching a missing socket at
   home costs nothing; catching it on stands costs the afternoon.
3. **Safety setup** - securing the vehicle, lifting, supporting. Quote the
   manual's own wording for the parts that can kill someone.
4. **Vehicle-specific cautions** - hybrid/HV, SRS, electronic brake systems,
   fuel pressure. Give these their own section rather than burying them.
5. **Disassembly** - manual step numbers preserved, with the practical
   additions the manual assumes you know (photograph spring positions before
   removing them; left and right are mirrored and easy to reverse).
6. **Inspection** - the specs table. This is usually the actual reason for
   the job, so make it prominent rather than a footnote.
7. **Reassembly** - including any ordering trap. Adjustments frequently must
   happen before something else goes back on.
8. **Final checks and road test.**
9. **Torque table** - every figure for this job in one place, with unrelated
   ones struck through so their absence is deliberate rather than an
   oversight.
10. **If you get stuck** - the two or three failures that actually happen,
    with what to do.

## Markdown the builder understands

```
# ## ###        headings
- [ ] item      tappable checkbox, strikes through when ticked
- item          bullet
1. item         numbered step
> text          warning callout, amber
!> text         danger callout, red - use only for injury or damage
| a | b |       table (requires the |---|---| separator row)
![caption](figures/x.png)   figure, inlined, caption below
---             rule
**bold** ~~strike~~ `code`
```

Reserve `!>` for things that hurt people or destroy parts. A sheet where
everything is red is a sheet where nothing is.

## Details that decide whether it works in a garage

**Units, spelled out.** Torque in the manual's own notation with the
conversion beside it. Watch for values given in in-lbf rather than ft-lbf -
mistaking one for the other is a factor of twelve and snaps fasteners. Call
that out at the value itself, not in a general note.

**One-time parts, flagged where they're removed**, not only in a parts list.
Learning that a gasket is non-reusable while holding the old one is useful;
learning it afterwards is not.

**Ordering traps, stated as traps.** "Adjust the shoe clearance before
refitting the caliper" prevents a repeat teardown.

**The specs table near the decision it informs.** Wear limits belong beside
the inspection step.

**Part numbers for what might turn out to be dead** - seized adjusters,
perished boots. Ordering the same evening beats waiting a week.

**Write in the user's language.** Match whatever they've been using in the
conversation; keep manual terms in their original language alongside, since
that's what is cast into the parts and printed in the manual.

## Anti-patterns

- Restating the whole manual. A job sheet is the path through it, not a copy.
- Vague safety language. "Be careful with the hybrid system" is noise; "power
  switch OFF, confirm READY lamp is out, do not press the brake pedal while
  the caliper is off" is usable.
- Hiding the torque table at the end only. Put values inline at the step *and*
  collect them in a table.
- Silent scope reduction. If part of the job can't be covered from the
  available pages, say which part and why.
