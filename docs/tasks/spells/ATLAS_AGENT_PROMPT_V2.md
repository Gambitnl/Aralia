# Atlas v2 - Bucket Agent Prompt

> **Send this to every bucket-working agent.** It explains what changed since
> the last round, asks them to re-evaluate their bucket against the refined
> model, and tells them how to feed back gaps that still don't fit.

You worked on this earlier and reported what didn't fit. Most of what you
flagged has landed. Open the Atlas, expand the Onboarding panel on the
Dashboard, and re-read the gap registry first - most entries (gaps 01-08,
10, 11) have moved to "Accepted / resolved". Only **Gap 09** (no automated
tracker -> Atlas drift check) is still open.

Then come back here.

## What's new since your last visit

### Bucket-level (Dashboard, the landing page)

- **`BUCKET_META.kind`** is now a required field: `parity | mechanics-model |
  inventory | closure`. Each renders as a tooltip-equipped badge in the new
  "Kind" column. Pick the one that matches what your bucket is actually
  doing - if none of them fit, that's a gap to report.
- **"Work" column** shows derived status: `stub | idle | active | closed`.
  Closed buckets render dimmed so the eye skips them.
- **Aggregate spell-count** at the top of the Dashboard sums `countValue`
  across all buckets - your bucket disappears from that total if you don't
  set `countValue` on numeric subbuckets.
- **Cross-bucket search** box matches bucket name / subbucket slug /
  edge-case label / prose.
- **`BUCKET_META.lastUpdated`** is now a required field: ISO 8601
  timestamp `'YYYY-MM-DDTHH:MMZ'` (UTC, minute precision). Renders in a
  new "Last updated" column with staleness coloring - gray under 7
  days, amber 7-30 days, rose over 30 days. **Bump this any time you
  edit your bucket's row, its execution map, or its tracker doc.**
  Hand-authored on purpose: the field is the durable signal, so a wrong
  timestamp is a real signal that the workflow wasn't followed.
- **Matrix -> Map navigation**: clicking a row in the coverage matrix
  jumps to that bucket's execution map.
- **"All" tab** now stacks every authored bucket's map, not just Sub-Classes.
- **Tooltips on every column header** explain what the column means; the
  Vocabulary panel groups its entries into three sections (Pipeline /
  Bucket kinds / Dashboard columns).

### Subbucket-level (formerly "mismatch family")

- **Refer to subbuckets by their snake_case slug**, never "step N". Use
  `Sub-Classes:missing_structured_subclasses`, not "Sub-Classes step 1".
  The `order` field is render-only and shifts when subbuckets get split or
  reordered. The Atlas now displays the slug as the eye-anchor (large amber
  mono) with the order number reduced to a small gray prefix.
- **New optional fields on `ExecutionStep`**:
  - `countValue?: number | null` - numeric pull-out so the dashboard can
    sum across buckets and the "closed" detection can tell when you're at
    zero. Skip when count isn't numeric (`'on demand'`, `'-'`).
  - `dependsOn?: string[]` - cross-bucket prerequisites in
    `'Bucket:subbucket_slug'` format, e.g.
    `['Description:higher_level_text_still_inline_or_missing']`. Renders
    as a rose "blocked by N" chip.
  - `overlapsWith?: string[]` - other subbucket slugs that share spells
    with this one. Renders as a violet "overlaps N" chip with tooltip.
  - `owner?: string` and `prs?: string[]` - driver/PR paper trail.

### Edge-case-level

- **Each edge case is now its own bordered card** inside the parent
  subbucket. Status pill + label on the left, amber mono count on the
  right. No more bullet-list of edge cases - each is a discrete unit.
- **Per-subbucket alpha handle** - each edge case now renders with a
  small `a / b / c / ...` mono pill that resets per subbucket. Refer to
  edge cases in prose and gap reports as
  `<Bucket>:<subbucket_slug>:<handle>` -
  e.g. `Sub-Classes:missing_structured_subclasses:a`. The handle is
  render-order only (shifts if you reorder), but for a single
  conversation it's a stable enough shortcut to say "edge case `b`
  still needs a starting snapshot."
- **`EdgeCase.spells?: SpellRef[]`** - new optional per-spell viewer
  behind the chevron, alongside `note` and `progression`. Renders as a
  tab strip; each tab shows the spell's "broken bit" plus an optional
  "compared against" half plus a colored diagnostics panel.
  - Three authoring tiers:
    1. **chip only** (`{ id, level }`) - in scope, lines not located.
    2. **segment without comparison** - flagged half but no truth yet.
    3. **full segment + comparison** - flagged half + emerald
       source-of-truth (real file) OR expected pattern (schema).
  - `rawLines` is hand-pasted from the file. Atlas does NOT fetch at
    runtime - same data-IS-source-of-truth philosophy as the rest.
  - Diagnostics panel auto-derives from the data shape: rose
    flag/needs-action, amber notable, emerald present, gray neutral.
    Action prompts on rose rows tell the next reader what to do.
  - `SpellRef.edgeCaseNote` lets you call out a spell's special role
    ("canonical example, read first" / "sub-case, no source-of-truth").
- **Edge cases are expandable** via chevron, just like subbuckets:
  - Always visible: status + label + count + a small emerald `N snaps`
    indicator if progression history exists.
  - Behind the chevron: the `note` and the progression bubble chain.
  - Empty slots show placeholders ("no note authored yet" / "no
    progression snapshots yet") prompting authors to fill them in.
- **`EdgeCase.history?: ProgressSnapshot[]`** - per-edge-case progression
  counter (Gap 06). Bubble-chain UI parallel to subbucket's, behind the
  chevron.
- **`EdgeCase.countValue?: number | null`** - numeric pull-out parallel
  to `ExecutionStep.countValue`.

## Your task

### 1. Open your bucket's deep link

```
/Aralia/misc/spell_pipeline_atlas.html?bucket=<YourBucket>
```

### 2. Implement the new fields where they fit your bucket

Edit `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`:

- **Set `kind` on your `BUCKET_META` row** if it's currently `'parity'`
  but the bucket isn't actually a parity lane. Most are parity (Sub-Classes,
  Components, Range/Area, Duration, Higher Levels, Description); but
  Conditions and Attack-Roll Riders are `mechanics-model`, Summoned
  Entities is `inventory`, Structured Markdown is `closure`.
- **Bump `lastUpdated` on your `BUCKET_META` row** to the current UTC
  time as the very last edit before you save. Format:
  `'YYYY-MM-DDTHH:MMZ'`. Every row was seeded at `'2026-04-26T12:00Z'`,
  so until you bump it your row will read as `Xd ago` whenever the
  orchestrator looks - and stale-color amber/rose if you don't come back.
- **Add `countValue` to every subbucket where `count` is a real number.**
  Without it your bucket's spells don't show up in the dashboard aggregate
  and "closed" can't be detected. Do this even if the count is already
  expressed as `'12 spells'` - just add `countValue: 12` next to it.
- **Add `dependsOn`** if your bucket has a real upstream prerequisite in
  another bucket. Use the slug, not the order number.
- **Add `overlapsWith`** if any of your spells live in more than one of
  your subbuckets at once.
- **Add edge-case `count` and `history`** on subbuckets where you've
  enumerated sub-patterns. Even a single starting-count snapshot is a
  useful baseline; missing counts make the card read as "this edge case
  has no volume" which is rarely what you mean.
- **Add edge-case `spells`** on edge cases where you can enumerate
  affected spells. Start with chip-only entries (`{ id, level }`) for
  spells you know are in scope but haven't pinpointed yet - the
  diagnostics panel will surface a rose "no segment authored" indicator
  prompting follow-up. Upgrade to full segments + comparisons as you
  locate the broken lines and identify the source of truth. See the
  template doc's "Affected spells" section for the three tiers.
- **Add `owner` and `prs`** if a single agent is driving and you want a
  paper trail.

### 3. Verify your bucket is honest

Walk through the Atlas and check:

- **Dashboard row** - does it reflect reality? Work-status badge, gate
  status, kind badge, count columns, note?
- **Last updated** - does the timestamp match the moment you finished
  editing? If you forgot to bump it, the column will show `Xd ago` (or
  worse) and your row reads as neglected even when it isn't.
- **Matrix** - find every field that belongs to your bucket; does
  clicking the row navigate to your bucket's map?
- **Execution map** - does each subbucket's `count` match what your
  tracker doc says today? (Gap 09 means there's no automated drift check;
  manual sync is on you.)
- **Edge cases** - does each have a count? Does each have at least a
  starting-count `history` snapshot? Are notes filled in? Are statuses
  honest (`open` / `in-progress` / `resolved` / `policy`)?
- **Cross-step relations** - have you set `dependsOn` / `overlapsWith`
  where they're real? They were invisible before, but now they render
  as chips - missing ones are conspicuous.

### 4. Call out what still doesn't fit

This is the important part. **Do NOT paper over modeling limitations
inside `action` / `doneWhen` prose.** That buries the signal and locks us
into a worse model. Instead:

- Append a new entry to `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` using
  the format the doc specifies. Even "I'm not sure what the fix shape
  should be" is a valid report.
- If a piece of guidance is missing from the in-app Onboarding panel or
  the template doc - something you needed and couldn't find - flag it.
- If a field name, a tooltip, or a column header is confusing or wrong,
  say so. The vocabulary changes are recent and need real-user testing.
- If the rendering looks wrong on your bucket specifically, attach a note.

## How to report back

When you're done, **write your report to a file** at:

```
docs/tasks/spells/atlas-reports/<bucket-slug>/v2.md
```

The slug is lowercase with spaces/slashes replaced by hyphens. Full
table is in `docs/tasks/spells/atlas-reports/README.md` - examples:
`Range/Area` -> `range-area`, `Sub-Classes` -> `sub-classes`,
`Material Component` -> `material-component`. If the folder for your
bucket doesn't exist yet, create it.

If you re-submit before the round closes (e.g. you found something
after your first write), append `-2`, `-3`, etc.: `v2-2.md`, `v2-3.md`.
Don't overwrite earlier files - the diffs between them are useful.

The file follows this exact shape. Keep each bullet to one line. The
whole report should fit comfortably on one screen - prose belongs in
the gap registry, not here.

```markdown
## Bucket: <name>

### 1. Fields implemented
- `kind`: <set to X | unchanged from 'parity'>
- `lastUpdated`: <bumped to YYYY-MM-DDTHH:MMZ>
- `countValue`: <added on N subbuckets | N/A - no numeric counts>
- `dependsOn`: <added on <subbucket_slug> -> <Bucket:slug> | none real>
- `overlapsWith`: <added on <subbucket_slug> -> [<slug>, ...] | none real>
- Edge-case `count` / `history`: <N edge cases now have count, M have at
  least a starting snapshot | N/A - bucket has no edge cases>
- Edge-case `spells`: <N edge cases have rosters, M with full segments,
  K chip-only awaiting pinpoint | N/A - rosters not enumerable yet>
- `owner` / `prs`: <set on <subbucket_slug> | skipped>

### 2. Verification
- Dashboard row reads honestly: yes | no - <what's wrong>
- Matrix click-through lands on my map: yes | no
- Execution-map counts match tracker doc: yes | drift - <numbers>
- Edge cases all have count + at least one history snapshot: yes | no -
  <which ones still need it>

### 3. Gaps reported
- New entries appended to `ATLAS_GAPS_REGISTRY.md`: <Gap NN, Gap NN | none>
- Existing entries I added notes to: <Gap NN | none>

### 4. Doc / UI friction
Anything in the Onboarding panel, template doc, tooltip text, or column
header that was confusing or missing. One bullet per item, or "none" if
the docs were sufficient.
- <bullet>
- <bullet>

### 5. Confidence
One sentence: does the bucket now genuinely match the model (ready to go
back to working the bucket), or are you flagging modeling work that
should land before authoring more?
```

**Why this shape:**

- §1 and §2 are concrete and falsifiable - the orchestrator can spot-check
  by re-opening the Atlas. Don't paper over §2; if a count is drifting,
  say so.
- §3 is the actual deliverable - the registry is the durable output;
  this section just tells the orchestrator which IDs to read.
- §4 catches the meta-feedback - friction you felt while *using* the
  docs. That signal drives the next onboarding revision.
- §5 prevents "no gaps, but here are four changes" ambiguity. Commit to
  a ready / not-ready call.

If a section genuinely doesn't apply to your bucket (e.g. no edge cases
exist), write "N/A - <one-clause reason>" rather than deleting the row.
The orchestrator reads reports side-by-side across buckets and missing
rows look like skipped checks.

**Don't post the report contents back as a chat message.** The file IS
the deliverable. A one-line acknowledgment ("wrote
`atlas-reports/range-area/v2.md`") is fine if you want to confirm
delivery, but the orchestrator reads the file, not the chat.

## What happens next

The orchestrator reads the report files in
`docs/tasks/spells/atlas-reports/<bucket-slug>/v2.md`, revises the
in-app Onboarding panel, the template doc, and the gap registry as
needed, then sends you a follow-up prompt that:

1. Lists the changes made in response to your feedback.
2. Asks you to re-verify your bucket against the refined model.
3. Asks you to surface any *new* shapes that still don't fit.

Your next report goes to `v3.md` next to the existing `v2.md` - the
old reports stay as the audit trail of how your bucket converged.

This loop runs until your bucket genuinely matches the model. At that
point you go back to actually working the bucket - which is the whole
point of the Atlas.

## TL;DR

1. Re-read the Onboarding panel + gap registry (most gaps are now closed).
2. Implement the new fields on your bucket: `kind`, `lastUpdated`,
   `countValue`, `dependsOn`, `overlapsWith`, edge-case `count` /
   `history` / `spells`. Always bump `lastUpdated` last.
3. Verify your bucket reads honestly across Dashboard, Matrix, and
   Execution map.
4. **Report anything that still doesn't fit** in the gap registry. Don't
   paper over it. We iterate the model based on your reports.
5. **Write your report to a file** at
   `docs/tasks/spells/atlas-reports/<bucket-slug>/v2.md` using the
   5-section template in "How to report back". §1 fields implemented,
   §2 verification, §3 gaps reported, §4 doc / UI friction, §5 ready /
   not-ready confidence call. Don't post the report contents in chat.
