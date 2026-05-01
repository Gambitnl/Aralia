# Atlas dispatch - Damage Type bucket (V4 first-time)

> **You are the agent for the `Damage Type` bucket.** This is a fresh
> dispatch on a bucket that didn't exist during the V1-V3 rounds. Your
> first report files at
> `docs/tasks/spells/atlas-reports/damage-type/v4.md`. The version
> number is V4 because that's the round-counter going forward; you
> don't have predecessor v2/v3 reports for this bucket.

## Bucket metadata

- **Bucket name**: `Damage Type`
- **Kind**: `parity`
- **Phase 1 gate**: `todo` (canonical → structured parity script not yet authored)
- **Phase 2 gate**: `todo` (structured → runtime JSON parity script not yet authored)
- **Tracker**: `docs/tasks/spells/damage-type/SPELL_DAMAGE_TYPE_BUCKET_TRACKER.md`
- **Live `lastUpdated`**: `2026-05-01T12:00Z` (orchestrator-seeded)
- **Atlas deep link**: `/Aralia/misc/spell_pipeline_atlas.html?bucket=Damage%20Type`

## Background - the task behind the task

If you've never touched the spell pipeline before, read this section
before the dispatch instructions. Returning agents can skim.

### What is the spell pipeline?

The spell pipeline is a **one-way migration ending in a single JSON
template**. Data flows through three layers in sequence, and two of
the three layers are scaffolding that will eventually be retired:

1. **Canonical markdown** (`docs/spells/reference/`) - the **raw
   extract** from the source reference. Free-form prose with bolded
   field labels (e.g. `**Range:** 150 feet`, or for damage types:
   damage tokens embedded in the narrative or in a
   `Damage/Effect:` line in the canonical HTML-comment snapshot).
   **This layer is the input - not modified, only read.** It will
   be **retired first**, once all data has been extracted into the
   structured layer.

2. **Structured markdown block** (same files, fenced block at the
   top) - the **in-between normalization step**. For your bucket:
   `- **Damage Type**: <token>` as a single normalized field.
   Tokens are typically single words like `Fire`, `Cold`,
   `Necrotic`, `Radiant`. **This layer will be retired second**,
   once the structured shape is good enough to apply generally to
   JSON spell files.

3. **Runtime JSON** (`public/data/spells/`) - the **end state**.
   Damage types live at `effects[i].damage.type`. The goal is a
   **single JSON template** that holds every possible field and
   value (description text aside).

Buckets aren't tracking eternal parity between three sources of
truth - they're tracking the **convergence** to a single source.
Acknowledged normalization differences get documented as
`status: 'policy'` edge cases.

### What are the bucket "kinds"?

Four kinds exist:

- **`parity`** - true parity lanes (canonical / structured /
  runtime should all agree). **Your bucket is this kind.** Both
  phase gates show real numbers once the parity scripts land.
- **`mechanics-model`** - Aralia-only mechanics with no canonical
  analogue (e.g. Attack-Roll Riders).
- **`inventory`** - tracking a list of items.
- **`closure`** - meta-trackers that exist to close out a problem.

### What is the Atlas + dispatch loop?

The Spell Pipeline Atlas (`misc/spell_pipeline_atlas.html`, source
at `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`)
is a developer dashboard surfacing every bucket. Data is **fully
hand-authored TypeScript** - no database. The author IS the source
of truth.

The dispatch loop ran V1 → V2 → V3 from 2026-04-25 to 2026-04-29
across the 13 original buckets, then School joined as V4 first-time
on 2026-05-01. **Gaps 01-08, 10-16 are all resolved.** Only Gap 09
(no automated drift check) and Gap 17 (coverage scanner false-
negative on derived-map parity reads, raised by the School v4
agent) are open.

You're a fresh dispatch on a *newly-added bucket* whose first job is
partly to establish the bucket inside the converged model.

## What does the Damage Type bucket track?

The migration of the **Damage Type token** for damage-dealing spells
across the three layers. Damage Type is one of the standard tokens
(`Acid`, `Bludgeoning`, `Cold`, `Fire`, `Force`, `Lightning`,
`Necrotic`, `Piercing`, `Poison`, `Psychic`, `Radiant`, `Slashing`,
`Thunder`).

The bucket converges these tokens to a single representation in the
runtime JSON template end state.

## Headline issue: chooser semantics (read first)

A class of spells lets the caster **pick a damage type from a set
at cast time**. The canonical narrative spells this out clearly
("X, Y, Z, or W damage (your choice)"); the structured layer
currently stores this as a **slash-glued string**; the runtime JSON
**pipes that string straight through** as `damage.type`. A runtime
consumer that compares `damage.type === "fire"` or applies a
resistance lookup will silently fail or treat the spell as having
no real damage type, because the value is `"Acid/Cold/Fire/Lightning/Thunder"`.

**Seed example**: `glyph-of-warding` (level 3).

| Layer | Value |
|---|---|
| Canonical narrative | *"5d8 Acid, Cold, Fire, Lightning, or Thunder damage (your choice when you create the glyph)"* |
| Structured md (line 29) | `- **Damage Type**: Acid/Cold/Fire/Lightning/Thunder` |
| Runtime JSON | `effects[0].damage.type: "Acid/Cold/Fire/Lightning/Thunder"` |

**Likely additional chooser spells** (not yet inventoried):
`chromatic-orb` (acid / cold / fire / lightning / poison / thunder),
`dragons-breath`, `elemental-bane`, `elemental-weapon`, possibly
more. Inventorying them is part of your task.

**Open design question that you must decide before script work**:
what shape should the structured + runtime layers use for chooser
spells? Possible directions:

- `damage.typeChoice: 'one_of'` + `damage.typeOptions: [...]`
  (separate fields; preserves single-token shape for normal cases)
- `damage.type: { kind: 'one_of', options: [...] }` (object shape;
  conflicts with single-token spells unless `damage.type` is always
  an object)
- `damage.types: string[]` plus `damage.choice: 'one_of' | 'all'`
- Some other shape

**Decide this before authoring the canonical-vs-structured parity
script** - otherwise the script keeps flagging chooser cases as
drift instead of classifying them.

## Your task

### 1. Read the model + relevant docs

- The in-app Onboarding panel (expand it on the Dashboard).
- `docs/tasks/spells/SPELL_BUCKET_EXECUTION_MAP_TEMPLATE.md`
- `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` (note Gaps 09 and 17
  still open)
- `docs/tasks/spells/atlas-reports/_LOOP_CLOSED.md`
- Your bucket's stub tracker:
  `docs/tasks/spells/damage-type/SPELL_DAMAGE_TYPE_BUCKET_TRACKER.md`
- Look at School's v4 dispatch + report
  (`atlas-prompts/school-v4.md`,
  `atlas-reports/school/v4.md`) for a recent precedent of a
  first-time parity bucket.

### 2. Decide the chooser shape

Document the chosen shape in the tracker. This decision unblocks
parity script work.

### 3. Establish the bucket

- **Inventory the chooser spells** (`glyph-of-warding`,
  `chromatic-orb`, ...) by scanning structured `Damage Type` fields
  for slash-glued or comma-glued values. Record IDs in the
  tracker.
- **Author / extend the canonical-vs-structured parity script** to
  compare the structured `Damage Type` token against the canonical
  narrative's damage type, including the chooser shape decision.
  See the existing parity scripts (`auditSpellStructuredAgainstCanonical.ts`,
  `validateSpellMarkdownParity.ts`) for the conventions.
- Heads-up on **Gap 17**: the coverage scanner under-reports parity
  coverage when a field is read via a derived field map
  (`fields.set('Damage Type', spell.damageType)` then dynamic
  iteration) instead of a literal `labels.get('Damage Type')`.
  Either author the script with literal field reads where possible,
  or accept that the coverage matrix may show `parityScript: false`
  even when the script is real (and note the false-negative in §4).
- **Run inventory**: produce a first count of mismatches.
- **Classify subbuckets**. Replace the placeholder
  `land_damage_type_canonical_parity_script` step with real ones -
  likely candidates listed in the tracker.
- **Update the Atlas execution map** (replace placeholders, mark
  Phase 1 step 1 as `done` once the script lands and inventory is
  recorded).
- **Update the tracker** as the inventory takes shape.
- **Bump `lastUpdated`** every edit.

### 4. Phase 2 stays blocked until Phase 1 closes

Per the phase-block rule (Gap 15), Phase 2 renders dimmed with a
rose `blocked: phase 1 incomplete` chip until every Phase 1 step is
`status: 'done'`. Don't flip Phase 2 steps to `active` until Phase
1 closes. Authoring queued Phase 2 steps is fine.

### 5. Verify

Walk the Atlas:

- Dashboard row reads honestly (`Damage Type | parity | -- | -- |
  todo | todo | active | authored | today`).
- Matrix click-through lands on your map.
- Phase 2 stays blocked while Phase 1 is incomplete.
- Edge cases carry counts and history snapshots. Use `count: null`
  for pending, `resolved` / `added` arrays on subsequent snapshots
  to capture per-step membership delta.

### 6. Call out what doesn't fit

Append new gaps to `ATLAS_GAPS_REGISTRY.md` if the model can't
express something the bucket needs. The chooser-shape decision
itself may surface a gap (e.g. if `damage.type` needs to become a
union type that the existing parity-script convention can't
express, that's a Gap 18 candidate).

## How to report back

Write to `docs/tasks/spells/atlas-reports/damage-type/v4.md`. The
folder doesn't exist yet - create it.

```markdown
## Bucket: Damage Type

### 1. Fields implemented (v4 first-time)
- `kind`: confirmed `parity`
- `lastUpdated`: bumped to <YYYY-MM-DDTHH:MMZ>
- Chooser shape decided: <which option | undecided - blockers>
- Chooser spell inventory: <N spells found - list IDs | partial>
- Phase 1 gate flipped from `todo` to: <implemented | still todo - reason>
- Phase 2 gate: still `todo` - blocked behind Phase 1
- Parity script(s) landed: <yes - paths | no - blockers>
- Subbuckets enumerated: <N | placeholders still in place - reason>
- Edge cases authored: <N | uses chooser_damage_type as primary>
- `count: null` / `resolved` / `added` snapshots: <usage | N/A>

### 2. Verification
- Dashboard row reads honestly: yes | no - <what's wrong>
- Matrix click-through: yes | no | source-only
- Phase 2 correctly blocked behind Phase 1: yes | no
- Execution-map counts match tracker doc: yes | drift - <numbers>

### 3. Gaps reported
- New entries appended to `ATLAS_GAPS_REGISTRY.md`: <Gap NN | none>
- Existing entries I added notes to: <Gap NN | none>

### 4. Doc / UI friction
- <bullet>
- (or "none")

### 5. Confidence
One sentence: ready / not ready, plus what's blocking if not ready.
```

**Don't post the report contents back as a chat message.** The file
IS the deliverable. A one-line acknowledgment ("wrote
`atlas-reports/damage-type/v4.md`") confirms delivery.

## What happens next

The orchestrator reads your report. If the bucket converges
cleanly, it joins the passive work-tracking dashboard. If you
surface modeling needs (e.g. the chooser shape requires a new
schema decision the runtime doesn't yet support), you may get a
follow-up V5 round.

## TL;DR

1. Read Onboarding + template + gap registry + `_LOOP_CLOSED.md` +
   stub tracker + School v4 precedent.
2. **Decide the chooser shape** (block on this before scripts).
3. Inventory chooser spells. Land canonical-vs-structured parity
   script. Run inventory. Classify subbuckets. Update Atlas +
   tracker.
4. Phase 2 stays blocked behind Phase 1 (Gap 15).
5. Verify Dashboard / Matrix / Map. Bump `lastUpdated`.
6. Write report to
   `docs/tasks/spells/atlas-reports/damage-type/v4.md`.
