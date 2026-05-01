# Spell Bucket Execution Map - Authoring Template

> **Bucket-working agents: before reading this, open the Atlas and expand the
> on-screen Onboarding panel on the Dashboard.** That panel plus the
> [gap registry](./ATLAS_GAPS_REGISTRY.md) is the _first_ reading; this
> template is the _second_. If your bucket doesn't fit the model, report it
> in the registry instead of authoring a map that papers over the mismatch.

This document explains how to add a new execution map to the **Spell Pipeline
Atlas** (`misc/spell_pipeline_atlas.html`). An execution map is the per-bucket
"what to actually do, in what order" view the Atlas shows when you click a
bucket row on the Dashboard (Shape C).

## Who this is for

You need this doc when:

- a bucket's tracker has enough structure to name its mismatch families, and
- the Atlas still shows `stub` in the `Map` column for that bucket.

You don't need this doc for:

- authoring a tracker from scratch - use the existing tracker docs as precedent
  (e.g. `docs/tasks/spells/sub-classes/SPELL_SUB_CLASSES_BUCKET_TRACKER.md`)
- changing the Atlas UI itself - that lives in
  `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`.

## Where the map lives

Every execution map is a plain TypeScript constant in:

```
src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx
```

There is no database, no MDX, no JSON. The hand-authored narrative IS the
source of truth. The matrix (Shape B) and dashboard (Shape C) are the dynamic
parts; the execution map (Shape A) is intentionally hand-written because the
ordering and the policy wording matter.

## Data shape (what you're filling in)

The full type is declared in `PreviewSpellDataFlow.tsx`. Shortened:

```ts
type EdgeCaseStatus = 'resolved' | 'in-progress' | 'open' | 'policy';
type StepStatus     = 'active'   | 'done'        | 'queued';
type StepKind       = 'subbuckets' | 'closure steps' | 'follow-up tasks';

interface EdgeCase {
  label: string;          // short identifier of a sub-pattern (free-form English)
  count?: string;         // display label, e.g. '12 spells' / '? spells' / 'on demand'
  countValue?: number | null; // optional numeric pull-out, parallel with ExecutionStep.countValue
  status: EdgeCaseStatus;
  note?: string;          // one sentence, plain English
  history?: ProgressSnapshot[]; // optional mini-trail per edge case (Gap 06)
  spells?: SpellRef[];    // optional per-spell viewer (tabbed, behind chevron)
}

interface SpellRef {
  id: string;             // spell file basename, no extension (e.g. 'fireball')
  level?: number;         // 0-9; useful for path resolution + display
  segments?: SpellSegment[];   // optional broken-bit slices; absent = chip-only
  edgeCaseNote?: string;  // spell-specific commentary for THIS edge case
}

interface SpellSegment {
  file: string;           // 'docs/spells/reference/level-3/fireball.md'
  startLine: number;      // 1-based inclusive
  endLine: number;        // 1-based inclusive
  label?: string;         // 'structured range block'
  flagged?: string[];     // whole-line matches; render amber
  rawLines: string[];     // pasted from the file - hand-authored, no fetch
  note?: string;          // why these lines are flagged
  comparison?: SpellSegmentComparison; // optional "compared against" pair
}

interface SpellSegmentComparison {
  kind: 'source-of-truth' | 'expected'; // see "Comparison flavors" below
  file?: string;          // optional - 'expected' patterns may have no file
  startLine?: number;
  endLine?: number;
  label?: string;
  rawLines: string[];
  highlighted?: string[]; // whole-line matches; render emerald
  note?: string;
}

interface ProgressSnapshot {
  count: number | null;   // raw spell count at this moment, OR null for a
                          // "pending recount" snapshot (Gap 12) when the
                          // family is acknowledged but not yet quantified.
                          // Null renders as a gray "?" bubble.
  date?: string;          // YYYY-MM-DD; renders under the bubble when present
  note?: string;          // short label shown on hover ("initial", "after aura pass")
  resolved?: string[];    // spell IDs removed from the edge case BETWEEN the
                          // previous snapshot and this one (Gap 16). Renders
                          // in the delta tooltip: "-3 (resolved: a, b, c)".
  added?: string[];       // spell IDs newly added BETWEEN the previous
                          // snapshot and this one (Gap 16). Less common than
                          // resolved; useful when a recount surfaces extras.
}

interface ExecutionStep {
  order: number;          // 1-based, render-order only - NOT a stable reference
  subbucket: string;      // snake_case; matches the tracker doc heading; the
                          // canonical reference name (refer to it as
                          // `<Bucket>:<subbucket>`, never "step N")
  count: string;          // display label: '12 spells' | '0 live' | 'on demand' | '-'
  countValue?: number | null; // optional numeric pull-out used for sums + work-status
  action: string;         // imperative, one sentence: "do this"
  doneWhen: string;       // one sentence: what success looks like
  status: StepStatus;     // exactly one subbucket per bucket should be 'active'
  edgeCases?: EdgeCase[]; // only when the tracker surfaces distinct patterns
  history?: ProgressSnapshot[]; // countdown trail - see "Progression" below
  dependsOn?: string[];   // ['Description:higher_level_text_still_inline_or_missing']
                          // = blocked by that Description subbucket (Gap 03).
                          // Use the slug, not 'Description:3'.
  overlapsWith?: string[];// other subbucket slugs that share spells with this one (Gap 11)
  owner?: string;         // current driver (Gap 05)
  prs?: string[];         // GitHub PR shorthand or URLs that moved this subbucket (Gap 05)
  spells?: SpellRef[];    // subbucket-level spell roster (Gap 14). Use when
                          // a subbucket has a real list of affected spells
                          // but no edge-case sub-patterns to attach them to.
                          // If a spell ALSO belongs to an edge case here,
                          // list it on the edge case (more specific).
}

interface PhaseBlock {
  phase: string;          // "Phase 1 - canonical -> structured"
  phaseNote: string;      // one sentence orientation
  color: string;          // border-emerald-500 | border-sky-500 | border-amber-500
  stepKind: StepKind;     // P1/P2 use 'subbuckets'; P3 uses closure/follow-up
  steps: ExecutionStep[];
}

// Bucket-level (in BUCKET_META, not per-step):
type BucketKind = 'parity' | 'mechanics-model' | 'inventory' | 'closure'; // Gap 02
```

## Conventions

**Phase colors are fixed:**

| Phase | Color class |
| --- | --- |
| Phase 1 - canonical -> structured | `border-emerald-500` |
| Phase 2 - structured -> json      | `border-sky-500`     |
| Phase 3 - closure / follow-up    | `border-amber-500`   |

**Exactly one subbucket should be `active` per bucket** - the one you'd pick
up right now. Everything else is `queued` or `done`. If the bucket is
genuinely idle, leave no subbucket active.

**Phase 2 and Phase 3 are blocked until Phase 1 is complete (Gap 15).**
This is an orchestrator policy, enforced visually rather than mechanically:
the execution-map view dims and badges Phase 2/3 with a rose
`blocked: phase 1 incomplete` chip while any Phase 1 step is still
`queued` or `active`. The rule is sequential by design - the
canonical → structured → JSON migration can't meaningfully run a
structured → JSON parity check while structured itself is still being
shaped from canonical. **Don't set Phase 2/3 steps to `status: 'active'`
while their Phase 1 is incomplete.** Authoring queued Phase 2/3 steps
is fine (you can plan ahead); flipping one to active before Phase 1
closes is the violation. Vacuously unblocked when `phase1Gate === 'n/a'`
(mechanics-model buckets) or when Phase 1 has no steps authored.

**Refer to subbuckets by slug, never by row number.** The `subbucket` field
(snake_case) is the canonical identifier. "Sub-Classes step 1" is unstable
(it shifts if subbuckets get reordered or split) and uninformative; use
`Sub-Classes:missing_structured_subclasses` in cross-references and prose.
The `order` field is for render order only.

**`subbucket` names match the tracker.** If the tracker doc has a section
heading `missing_structured_subclasses`, use that exact slug here. Keep it
`snake_case`. **The same rule applies to closure-step slugs in Phase 3** -
labels like `Fixture and type test alignment` should be authored as
`fixture_and_type_test_alignment`. The Atlas treats closure steps as
subbuckets at the schema level, so the `subbucket` field is just as much
the canonical reference name there as in P1/P2.

**`count` is a human string, not a number.** Prefer `"12 spells"` over `"12"`.
For non-spell-count phases use `"-"`, `"on demand"`, `"0 live"`, `"schema move"`.

**`action` is imperative, `doneWhen` is declarative.** Read them as a pair:

> do: _Insert a `- **Sub-Classes**: ...` line with roster entries._
> done when: _Every listed spell has a Sub-Classes line whose entries are all
> in SPELL_SUPPORTED_SUBCLASS_ROSTERS.md._

**Use edge cases sparingly.** Only add `edgeCases` when the tracker actually
enumerates discovered sub-patterns within a subbucket, not just to add visual
depth. Policy decisions (e.g. "canonical uses `**`, structured uses a
normalized footnote") go in edge cases with `status: 'policy'`.

**Each edge case renders as a card** with a per-subbucket alpha handle
(`a`, `b`, `c`, ...) and the status pill + label on the left, and the
`count` (large mono amber) on the right. Below: the optional `note`
(italic), then the optional `history` strip under a "progression"
sub-header. Aim to fill `count` with at least `'? spells'` when the count
is known to exist but not yet quantified - the amber number is the eye's
anchor, and a missing count makes the card read as "edge case has no
volume" which is rarely what you mean.

**Refer to an edge case as `<Bucket>:<subbucket_slug>:<handle>`** in
prose - e.g. `Sub-Classes:missing_structured_subclasses:a`. The handle
is render-order only (resets per subbucket; shifts when edge cases get
reordered), but for a single conversation it's a stable enough handle to
say "edge case `b` needs a starting snapshot." The `label` is the
durable identity; the handle is the conversational shortcut.

**Optional cross-subbucket relations.** Set them only when they're real, and
always reference the target by `<Bucket>:<subbucket_slug>` (never by row
number):

- `overlapsWith: ['other_subbucket_slug']` when the same spells live in more
  than one subbucket at once. Renders as a violet "overlaps N" chip; viewers
  understand the counts aren't disjoint.
- `dependsOn: ['Description:higher_level_text_still_inline_or_missing']` when
  this subbucket can't usefully start until that Description subbucket is
  `done`. Renders as a rose "blocked by N" chip.
- `owner: 'agent-name'` and `prs: ['#412']` when a single agent is driving
  the subbucket and you want a paper trail. Both are optional; leave them
  off rather than putting `'unknown'` placeholders.

**`countValue` when `count` carries a real number.** The display label stays
the source of truth (`'12 spells'`), but adding `countValue: 12` lets the
dashboard sum across buckets and lets the bucket-closed visual state work.
Skip `countValue` when `count` isn't numeric (`'on demand'`, `'-'`).

**Glossary-term pills are automatic.** Writing _residue_, _drift_, _boundary_,
or _runtime_ anywhere in an `action`, `doneWhen`, `phaseNote`, or edge-case
`note` automatically wraps the word in the Aralia glossary pill with a
definition tooltip. Don't add HTML - just write the word.

**Bucket `kind` lives in `BUCKET_META`.** Set it once per bucket: `'parity'`
for canonical/structured/runtime parity lanes (Sub-Classes, Components,
Range/Area, etc.); `'mechanics-model'` for Aralia mechanics carve-outs
(Conditions, Attack-Roll Riders); `'inventory'` for inventory + model-design
lanes (Summoned Entities); `'closure'` for meta trackers (Structured
Markdown). Renders as a small badge on the dashboard so the three phases
don't get read as if they mean the same thing in every bucket.

## Progression (the countdown trail)

A step can carry an optional `history: ProgressSnapshot[]` that renders as a
left-to-right bubble chain under the action/doneWhen lines. Edge cases can
also carry their own (smaller) trail when the sub-pattern's progress is
worth tracking separately. The point is to visualize reduction passes as
work lands:

```ts
history: [
  { count: 55, date: '2026-03-12', note: 'initial' },
  { count: 42, date: '2026-04-02', note: 'after aura-of-* pass' },
  { count: 20, date: '2026-04-18' },
]
```

Rules:

- **First bubble = starting count** (the earliest number you have for the
  family). This is the leftmost bubble in the rendered chain.
- **Append, never edit.** When a cleanup pass lands, push a new snapshot with
  the new count. Don't rewrite earlier entries - the chain is the history.
- **Length 1 is fine.** A single snapshot just renders as one bubble labelled
  "starting count" - use this when you've just wired up history on an
  existing family.
- **Dates are optional but nice.** Shown in small mono text under each bubble.
  Notes are shown on hover.
- The final bubble is highlighted **amber** while the count is > 0 (work in
  flight) and **emerald** when it reaches 0 (family closed).
- Deltas between bubbles render automatically (`-13` in green for reductions,
  `+2` in red if the number goes the wrong way).
- **`resolved` and `added` capture per-step membership delta (Gap 16).**
  When you append a snapshot recording a count change, list the spell
  IDs that were removed from the edge case in `resolved` and any newly
  surfaced ones in `added`. The bubble-chain renderer makes the delta
  number tooltip-equipped: hovering shows "reduced by N · resolved: a,
  b, c". The first snapshot in a chain has no previous, so its arrays
  are typically empty. The arrays are diffs only - the full current
  roster lives on `EdgeCase.spells`. Append-only authoring applies
  here: don't edit a prior snapshot's `resolved`/`added` even if you
  later realize the diff was different. Just record reality going
  forward.

- **`count: null` is a "pending recount" snapshot (Gap 12).** Use it when
  the family is acknowledged but not yet quantified - e.g. an edge case
  with `count: '? spells'` whose real number is blocked on an upstream
  recount. The bubble renders gray and italicized with a `?` glyph;
  deltas are skipped when either neighbor is null. This lets you anchor
  "we know this exists" in the trail without faking certainty. Once the
  recount lands, append a real numeric snapshot - don't edit the null
  one (append-never-edit applies here too). **`count: null` works at
  both subbucket level (`ExecutionStep.history`) and edge-case level
  (`EdgeCase.history`)** - the same `ProgressSnapshot` type backs both,
  so a subbucket whose own count is pending can carry a null snapshot
  identically to a pending edge case.

`count: string` (the display label) stays independent of `history` - the
free-form string handles values like `"0 live"` and `"on demand"` that don't
fit a numeric trail. When both are present, keep them consistent: the final
history bubble should match the spell-count portion of `count`.

## Affected spells (per-edge-case spell viewer)

When an edge case has a small enough roster to enumerate (anywhere from 1
to ~50 spells), set `spells: SpellRef[]` on the edge case. The Atlas
renders a tabbed viewer behind the chevron alongside `note` and
`progression`. Each tab shows one spell's "broken bit" plus a
"compared against" half plus a colored diagnostics panel.

**Three authoring tiers**, pick whichever fits the spell's current state:

1. **Chip-only** - just `{ id: 'fireball', level: 3 }`. Spell is in
   scope but the file lines aren't located yet. Diagnostics panel
   surfaces a rose "no segment authored" indicator.
2. **Segment without comparison** - chip + `segments[0]` with file +
   line range + `flagged` lines + `rawLines` paste. The flagged half
   renders, but no "vs" emerald block. Diagnostics shows a rose "no
   comparison block" indicator nudging the author to commit to a truth.
3. **Full segment + comparison** - everything authored: flagged half +
   either a `'source-of-truth'` (real file, real lines) or `'expected'`
   (schema-derived "what right looks like") comparison block.

**Hand-paste the `rawLines`.** Authoring `segments` means copying the
relevant lines from the source file into the segment definition. We
deliberately don't fetch files at runtime - the Atlas's data-IS-the-
source-of-truth philosophy applies here too. If the underlying file
shifts, the segment goes stale the same way Gap 09 tracker drift does;
manual sync is on the author.

### Comparison flavors

- **`'source-of-truth'`** - the layer/section that IS correct; the
  flagged lines should be made to match it. Eg. `**Range:** Self
  (60-foot cone)` from the canonical body of the same `.md` file
  proving the structured `Range Type: ranged` is wrong. Set `file`,
  `startLine`, `endLine`, `rawLines`, `highlighted`, `note`.
- **`'expected'`** - what the flagged segment SHOULD become. A
  schema-derived "what right looks like" with no source file. Use when
  no other layer is canonical and the truth lives in a convention. Set
  `rawLines`, `highlighted`, `note`. Skip `file`/`startLine`/`endLine`.

### Per-spell diagnostics

The diagnostics panel below the segment view colors per-spell state
automatically from the data shape:

- **rose `flag`** - missing/needs-action (no segment, no comparison)
- **amber `note`** - notable variation worth flagging (multi-flag
  spell, missing author note, `edgeCaseNote` callout)
- **emerald `ok`** - feature is present (segment authored, comparison
  authored)
- **gray `neutral`** - informational fact (1 flagged line, author note
  present)

Detail strings on rose rows tell the next reader what to do
("Action: add a `source-of-truth` or `expected` comparison").

### `edgeCaseNote` for spell-specific commentary

Set `edgeCaseNote` on a `SpellRef` when this spell has a special role
in this edge case - e.g. *"canonical example, read this first"* or
*"sub-case where the truth is schema-derived rather than from another
file."* It surfaces as the top amber bullet in the diagnostics panel.
Distinct from `SpellSegment.note` (about the broken lines) and
`SpellSegmentComparison.note` (about why the truth lines are correct):
this is about the spell's role in the edge case overall.

### When NOT to use `spells`

- Edge case is too fluid (count fluctuates daily, list isn't stable)
- Roster is huge (>~100) and a tabbed viewer would be unwieldy - in
  that case, `count` + `note` + a link to a roster doc is honest
- You don't actually know which spells are in scope yet - leave it off
  rather than authoring placeholder chips with wrong IDs

### Subbucket-level rosters (Gap 14)

`ExecutionStep.spells?: SpellRef[]` is the same shape as
`EdgeCase.spells` but attaches at the subbucket level, for cases where
a subbucket has a real roster but no edge-case sub-patterns to host it.
Example: `Sub-Classes:incomplete_structured_subclasses` knows its 24
spells but doesn't yet split them into families - the orphan list goes
on `ExecutionStep.spells`.

The header renders an emerald `spells N` chip when set, and the
chevron-expanded body renders the same `AffectedSpellsView` component
above the edge-cases list. The chevron fires whenever the subbucket has
either edge cases or a spell roster (or both).

**Per-edge-case attribution wins.** If a spell ALSO belongs to one of
this subbucket's edge cases, list it on the edge case rather than on
the subbucket - the more specific attribution is honest. The
subbucket-level field is for orphan rosters only. Don't list the same
spell in both places.

### Policy edge cases (Gap 13)

When an edge case has `status: 'policy'`, the diagnostics panel adapts:

- The "no segment authored" rose flag becomes a neutral row labelled
  *"Policy edge case - no segment expected"* with a detail explaining
  that the marker IS the answer.
- The "no comparison block" rose flag becomes neutral *"Policy edge
  case - no comparison expected."*

Other diagnostics (`edgeCaseNote`, segment presence, comparison
presence) still fire normally. This means a policy edge case CAN carry
chip-only spells without reading as broken - the rose action prompts
are reserved for edge cases that genuinely need follow-up authoring.

## How to add a map (step-by-step)

1. Open `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`.
2. Copy the `EMPTY_BUCKET_EXECUTION` constant (it's right above
   `EXECUTION_BY_BUCKET`). Paste it, rename to e.g. `DURATION_EXECUTION`.
3. Fill in `phaseNote`, `steps[]`, and `edgeCases[]` from the tracker.
   - Remove any Phase 3 block if the tracker has no closure tasks.
   - Keep Phase 2 even if it has `steps: []` - it signals "pipeline exists,
     nothing live right now".
4. Register the map:
   ```ts
   const EXECUTION_BY_BUCKET: Record<string, PhaseBlock[]> = {
     'Sub-Classes': SUB_CLASSES_EXECUTION,
     'Components':  COMPONENTS_EXECUTION,
     'Duration':    DURATION_EXECUTION,   // <- new
   };
   ```
5. Dev-run the atlas (`npm run dev`, open `/Aralia/misc/spell_pipeline_atlas.html`)
   and click the bucket row. The `Map` column should flip from `stub` to
   `authored`.

## Deep-linking

The atlas reads `?tab=` and `?bucket=` from the URL on load. When authoring,
you can jump straight to a specific bucket's map with:

```
/Aralia/misc/spell_pipeline_atlas.html?bucket=Duration
```

Dropping the link into a tracker doc is a nice way to point collaborators at
the current shape of a bucket.

Valid `tab` values: `dashboard`, `matrix`, `all`. Valid `bucket` values are
whatever appears in `BUCKET_META` in `PreviewSpellDataFlow.tsx`.

## Keeping maps honest

- If a tracker's count drops to 0 for a subbucket, mark that subbucket's
  status `done`. Don't delete it - the history is useful.
- If the tracker splits a subbucket in two, split it here too. Renumber
  `order` to keep render order tidy. The `subbucket` slug stays as the
  stable reference; `dependsOn` / `overlapsWith` strings point at slugs, so
  reordering doesn't break cross-references.
- Closure tasks (Phase 3) only belong on buckets where Phase 1 and Phase 2 are
  empty. Otherwise they're forward-looking notes, which belong in a
  `follow-up tasks` phase instead.
