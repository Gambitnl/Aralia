# Spell Pipeline Atlas - Gaps Registry

**Read this before authoring or editing an execution map.**

The Atlas (`misc/spell_pipeline_atlas.html`, component
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`) has a specific
data model: buckets -> phases -> steps -> edge cases, with optional countdown
history per step. That model doesn't cover every shape of work we do on
spells. When the model doesn't fit your bucket, **don't improvise**. Add a
gap entry here instead.

Gaps drive Atlas design improvements. Workarounds in `action` / `doneWhen`
strings bury the signal and lock us into a worse model.

## How to report a gap

1. Confirm the gap isn't already listed below. If similar, append a note to
   the existing entry rather than duplicating.
2. Append a new entry at the bottom of the **Open gaps** section using the
   format below.
3. If you can only describe the symptom, say so. "Don't know what the fix
   shape is" is a valid state - the discussion happens later.

### Entry format

```
### Gap NN - short name
- **Reported by**: <your agent name or the bucket you're working on>
- **Status**: open | accepted | rejected | resolved
- **Model impact**: <which part of the model is affected - BUCKET_META,
  ExecutionStep, edge cases, history, rendering, cross-linking, etc.>
- **Example**: <one concrete case from a real bucket>
- **Suggested fix** (optional): <your best guess at the fix shape>
- **Notes** (optional): <anything else>
```

Keep entries under ~15 lines. Long exploratory write-ups belong in their own
doc in `docs/tasks/spells/<bucket>/`.

## What the model CAN express today

This is the current surface. Confirm your bucket fits here before reporting
a gap:

- **Buckets** - top-level lanes (`BUCKET_META` array). Each row has
  `bucket`, `tracker`, `phase1Gate`, `phase2Gate`, `kind`, optional `note`.
- **Bucket kind** - `parity | mechanics-model | inventory | closure`.
  Renders as a small badge so the three phases aren't read identically in
  every bucket.
- **Work status** - derived from `EXECUTION_BY_BUCKET` (all-done / has-active /
  queued-only / stub). Closed buckets render dimmed on the Dashboard with a
  "closed" badge alongside the gate status.
- **Phases** - canonical->structured (P1), structured->runtime JSON (P2), and
  closure / follow-up (P3). Phase color is fixed per phase.
- **Subbuckets** - one row per subbucket inside a phase. Refer to a
  subbucket by `<Bucket>:<subbucket_slug>` (the snake_case `subbucket`
  field), never by row number - the `order` field is render-only and
  shifts when subbuckets get split or reordered. Fields:
  `order`, `subbucket`, `count` (free-form string), optional `countValue`
  (numeric, used for cross-bucket sums), `action`, `doneWhen`, `status`,
  `edgeCases`, `history`, plus optional cross-subbucket relations:
  `dependsOn` (rose "blocked by" chip, `<Bucket>:<slug>` refs),
  `overlapsWith` (violet "overlaps N" chip, slug list), `owner`, `prs`.
- **Edge cases** - sub-patterns discovered inside a subbucket. Label +
  status + optional count/note + optional `history` mini-trail.
- **Countdown history** - time-ordered snapshots rendered as a bubble chain.
  Available on both steps and individual edge cases.
- **Cross-bucket search** - the Dashboard has a search box that fuzzy-matches
  bucket names, subbucket names, and edge-case labels.
- **Matrix -> map navigation** - rows in the coverage matrix are clickable
  when they map to a known bucket; clicking jumps to that bucket's map.
- **Side-by-side view** - the "All" tab stacks every authored bucket's map
  plus a stub summary at the bottom.
- **Glossary pills** - `residue`, `drift`, `boundary`, `runtime` anywhere
  in narrative strings render as tooltip pills automatically.

Anything beyond that is a gap. Report it here.

## Open gaps

### Gap 17 - Coverage scanner false-negative on derived-map parity reads
- **Reported by**: School bucket (v4 first-time dispatch, 2026-05-01)
- **Status**: open
- **Model impact**: `spell_audit_coverage.json` (the artifact backing the
  Atlas's per-script "fields read" matrix) under-reports parity-script
  coverage when a field is read via a derived field map instead of a
  literal `'FieldName'` string.
- **Example**: The School field is fully covered by
  `validateSpellMarkdownParity.ts` (line ~219:
  `fields.set('School', spell.school)` then
  `for (const [fieldName, jsonValue] of structuredJsonFields.entries())`
  doing `spell.labels.get(fieldName)`). The coverage scanner uses
  regexes that match `labels.get('X')`, `` labels.get(`X`) ``, and
  `field: 'X'` literals; it misses the indirection through
  `fields.set` + dynamic loop. As a result `parityScript: false` on
  the School row even though the script does run a real comparison and
  reports zero mismatches. The same false-negative would fire for any
  field added via the same derived-map pattern (e.g. Ritual today, and
  any new field a future agent wires through `buildStructuredFieldMap`).
- **Suggested fix**: extend `extractLabelsFromScript` in
  `scripts/generateSpellAuditCoverage.ts` to also detect the `fields.set('X', ...)`
  pattern (or, more generally, `<map>.set('X', ...)` paired with a
  later dynamic `<map>.entries()` / `<map>.get(varname)` read). A
  conservative fix is fine: just adding a literal `fields.set(['"]X['"]`
  matcher gets parity reads of School, Ritual, etc. picked up without
  much risk of false positives.
- **Notes**: This caused the v4 dispatch prompt and the Atlas execution
  map to be authored against the false premise that no parity script
  existed for School. The v4 agent corrected the model rather than
  authoring a redundant script.

### Gap 09 - No runtime feedback loop vs tracker docs
- **Reported by**: atlas shell
- **Status**: open
- **Model impact**: Atlas data is fully hand-authored
- **Example**: A tracker doc may say "42 spells" while the execution map
  says "55 spells" because the map wasn't updated. Or the tracker may
  have added a new subbucket the Atlas doesn't know about. No drift check.
- **Suggested fix**: optional CI/build step that parses tracker docs for
  known count markers and diffs against `EXECUTION_BY_BUCKET`. Flag
  drift on the Dashboard row.
- **Range/Area note**: On 2026-04-25, the tracker had moved to `144`
  canonical -> structured and `7` structured -> JSON, while the Atlas map still
  showed the older `172` / `61` split. This is the same hand-authored-map drift,
  not a new bucket-model problem.
- **Status update (2026-04-25)**: Stays open. The hand-authored map remains
  the source of truth; no automated drift check landed. Authors are
  responsible for keeping the map in sync with their tracker until a CI
  parser exists.
- **Description note (2026-04-27)**: The Description execution map was updated
  to the generated `89` canonical -> structured and `38` structured -> JSON
  subbucket artifacts, but the Dashboard count columns still render `51` /
  `34` from an older source. This is the same unresolved tracker / artifact /
  Atlas drift problem.

## Accepted / resolved

### Gap 16 - Progression bubble chain loses membership delta between snapshots (resolved 2026-04-30)
- **Original report (orchestrator observation, 2026-04-30)**: The
  `ProgressSnapshot` chain shows count deltas (e.g. 18 -> 12 -> 9 with
  `-6` and `-3` arrows) but doesn't capture *which spells* were resolved
  or added between snapshots. The `note` field is free-form ("after
  aura-of-* pass") and tends to summarize rather than enumerate.
  Membership history is lost: you can see the count went down by 3
  but you can't tell which 3.
- **Resolution**: Added optional `resolved?: string[]` and
  `added?: string[]` to `ProgressSnapshot`, both lists of spell IDs.
  Each snapshot's arrays describe what changed *between* the previous
  snapshot and this one (so the first snapshot's arrays are typically
  empty). The bubble-chain renderer makes the delta number
  tooltip-equipped: hovering shows "resolved: a, b, c" / "added: x"
  with the spell IDs. Authoring convention: when you append a snapshot
  with a real count, list the spells you removed from the edge case
  in `resolved` and any newly-discovered ones in `added`. The full
  current roster still lives on `EdgeCase.spells`; the snapshot arrays
  are diffs, not membership.
- **Original report (orchestrator policy)**: Buckets could carry
  `status: 'active'` Phase 2 or Phase 3 steps while Phase 1 still had
  open `queued` or `active` steps. Conceptually wrong - the
  canonical → structured → JSON migration is sequential; you can't
  meaningfully run structured → JSON parity while structured itself
  is still being shaped from canonical. Multiple V3 buckets had Phase
  2 work flagged active despite incomplete Phase 1 work.
- **Resolution**: Added `isPhase1Complete(bucket)` helper that returns
  `true` when (a) `phase1Gate === 'n/a'`, (b) the bucket is a stub,
  (c) the Phase 1 block has no steps, or (d) every Phase 1 step is
  `status: 'done'`. Otherwise returns `false`, which causes Phase 2
  and Phase 3 phase blocks in the execution-map view to render at
  `opacity-60` with a rose `blocked: phase 1 incomplete` chip on the
  phase header. The chip's tooltip explains the rule. Steps inside a
  blocked phase still render and remain editable - the rule is a
  visual policy reminder, not a hard render-block - so authors can
  plan ahead. Workflow convention: don't set Phase 2/3 steps to
  `status: 'active'` while their Phase 1 is incomplete.

### Gap 12 - No unknown-count progression snapshot (resolved 2026-04-28)
- **Original report (Range/Area bucket)**: `Range/Area:canonical_likely_real_drift_review`
  has known edge-case families, but their current counts are pending the
  144-spell recount. `EdgeCase.count` can honestly say `? spells`, while
  `history` required a numeric `count`, so adding a starting snapshot would
  fake certainty.
- **Resolution**: Widened `ProgressSnapshot.count` to `number | null`. A
  `null` snapshot renders as a gray italicized "?" bubble with a `pending
  recount` tooltip; deltas are skipped when either neighbor is null.
  `count: 0` still flips the final bubble emerald (family closed) and
  positive counts stay amber. Seed data on the three
  `canonical_likely_real_drift_review` edge cases now anchors "we know this
  exists" without faking quantification. Documented in the template's
  "Progression" section and in the `ProgressSnapshot` JSDoc.

### Gap 13 - Policy edge cases trigger inappropriate rose-flag diagnostic (resolved 2026-04-28)
- **Original report (Sub-Classes bucket)**: An edge case with
  `status: 'policy'` (e.g. "Folded into Classes", "`None` placeholder",
  "Custom-condition labels") represents a *resolution* rather than a
  defect. The "Edge-case notes for X" diagnostics panel still fired a rose
  `flag` ("No segment authored") for any bare chip, which read as "this is
  broken" when the marker IS the answer.
- **Resolution**: `computeSpellDiagnostics` now takes a `DiagContext`
  carrying the parent edge case's `status`. When the parent is `'policy'`,
  the no-segment row becomes a neutral "Policy edge case - no segment
  expected" indicator with a detail string explaining "the marker IS the
  answer." Same treatment for the no-comparison row ("Policy edge case -
  no comparison expected"). Other diagnostics (`edgeCaseNote`, segment
  presence, comparison presence) fire normally. `AffectedSpellsView`
  forwards `parentStatus` to `SpellDiagnostics`.

### Gap 14 - No subbucket-level spell roster (resolved 2026-04-28)
- **Original report (Sub-Classes bucket)**:
  `Sub-Classes:incomplete_structured_subclasses` has a real roster of 24
  spells but no enumerated edge-case families. `EdgeCase.spells` attaches a
  chip list to an edge case; there was no equivalent on the subbucket
  itself. Manufacturing a placeholder edge case to host the chips would
  paper over the model gap.
- **Resolution**: Added `ExecutionStep.spells?: SpellRef[]` parallel to
  `EdgeCase.spells`. The subbucket header now renders an emerald
  `spells N` chip when set, and the chevron-expanded body renders the
  shared `AffectedSpellsView` component above the edge-cases list. The
  chevron itself fires whenever the subbucket has either edge cases or a
  spell roster (or both). Seeded the field on
  `Sub-Classes:incomplete_structured_subclasses` with 10 representative
  chip-only entries so the wiring is visible. Authoring guidance: if a
  spell ALSO belongs to an edge case, list it on the edge case (more
  specific attribution); the subbucket-level field is for orphan rosters.

### Gap 01 - No "bucket-closed" visual state (resolved 2026-04-25)
- **Original report**: Dashboard row for fully-done bucket (Structured
  Markdown) looked identical to an active bucket like Sub-Classes.
- **Resolution**: Added `computeWorkStatus(bucket)` helper that derives
  `stub | closed | active | idle` from `EXECUTION_BY_BUCKET` step states.
  Dashboard renders a dedicated "Work" column with a status badge, and
  closed buckets render at `opacity-70` so the eye skips them.

### Gap 02 - No bucket-type axis (resolved 2026-04-25)
- **Original report**: Atlas treated parity, mechanics-model, inventory,
  and closure buckets as if their three phases meant the same thing.
- **Resolution**: Added `BucketKind = 'parity' | 'mechanics-model' | 'inventory' | 'closure'`
  on `BUCKET_META`, plus a `BUCKET_KIND_LABEL` table with tones + blurbs
  rendered as a "Kind" column on the Dashboard. Template doc explains how
  to pick the right kind for a new bucket.

### Gap 03 - No cross-step dependencies (resolved 2026-04-25)
- **Original report**: Description P1 step 3 feeds Higher Levels P2 step 2;
  invisible in the Atlas.
- **Resolution**: Added optional `dependsOn?: string[]` on `ExecutionStep`.
  Each entry is `'<Bucket>:<subbucket_slug>'` (e.g.
  `'Description:higher_level_text_still_inline_or_missing'`). We use the
  slug rather than the row number because slugs are stable across
  reorderings and self-documenting. Renders as a rose "blocked by N" chip.

### Gap 04 - `count` is an unstructured string (resolved 2026-04-25)
- **Original report**: `count` field couldn't be summed across buckets.
- **Resolution**: Added optional `countValue?: number | null` alongside the
  free-form `count` label. Dashboard sums `countValue` across all buckets
  to show an aggregate open spell-count. Display label stays the source of
  truth; `countValue` is the numeric pull-out.

### Gap 05 - No per-step owner / PR link (resolved 2026-04-25)
- **Original report**: No paper trail for who's driving a step or which
  PR moved it.
- **Resolution**: Added optional `owner?: string` and `prs?: string[]` on
  `ExecutionStep`. Rendered as small chips next to the status badge.

### Gap 06 - History is step-level only (resolved 2026-04-25)
- **Original report**: Couldn't record per-edge-case progress.
- **Resolution**: Added optional `history?: ProgressSnapshot[]` on
  `EdgeCase`. Edge-case rows render a compact `EdgeCaseTrail` bubble chain
  when history is present.

### Gap 07 - Matrix (B) and Dashboard (C) don't cross-link (resolved 2026-04-25)
- **Original report**: Coverage-matrix rows weren't navigable.
- **Resolution**: `CoverageMatrix` now accepts an `onSelectBucket?` prop;
  rows mapped to known buckets are clickable and switch to the dashboard
  tab with that bucket selected.

### Gap 08 - "All (side-by-side)" only shows Sub-Classes (resolved 2026-04-25)
- **Original report**: The "All" tab was hardcoded to Sub-Classes.
- **Resolution**: The "All" tab now stacks every authored bucket's
  execution map, plus a small summary listing buckets still on `stub`.

### Gap 10 - No search / cross-bucket filter (resolved 2026-04-25)
- **Original report**: No way to find which buckets mentioned a given
  spell name or pattern without grep.
- **Resolution**: Added a search box at the top of the Dashboard. Matches
  bucket names, subbucket names, and edge-case labels (case-insensitive,
  substring). Non-matching rows are hidden while a query is active.

### Gap 11 - No overlapping step membership (resolved 2026-04-25)
- **Original report**: Higher Levels P2 had spells belonging to both
  `structured_missing_json_present` and `description_duplicate_residue`;
  counts looked like bad math.
- **Resolution**: Added optional `overlapsWith?: string[]` on
  `ExecutionStep`. Rendered as a violet "overlaps N" chip with tooltip
  listing the overlapping subbuckets, signalling that counts are not
  disjoint. Wired up the Higher Levels case as the first user.

## Rejected

(empty - include rationale when moving something here)
