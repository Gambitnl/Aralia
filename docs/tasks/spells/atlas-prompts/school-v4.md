# Atlas dispatch - School bucket (V4 first-time)

> **You are the agent for the `School` bucket.** This is a fresh
> dispatch on a bucket that didn't exist during the V1-V3 rounds. Your
> first report files at `docs/tasks/spells/atlas-reports/school/v4.md`.
> The version number is V4 because that's the round-counter going
> forward; you don't have predecessor v2/v3 reports for this bucket.

## Bucket metadata

- **Bucket name**: `School`
- **Kind**: `parity`
- **Phase 1 gate**: `todo` (canonical → structured parity script not yet authored)
- **Phase 2 gate**: `todo` (structured → runtime JSON parity script not yet authored)
- **Tracker**: `docs/tasks/spells/school/SPELL_SCHOOL_BUCKET_TRACKER.md` (stub)
- **Live `lastUpdated`**: `2026-04-30T12:00Z` (orchestrator-seeded)
- **Atlas deep link**: `/Aralia/misc/spell_pipeline_atlas.html?bucket=School`

## Background - the task behind the task

If you've never touched the spell pipeline before, read this section
before the dispatch instructions. Returning agents can skim.

### What is the spell pipeline?

The spell pipeline is a **one-way migration ending in a single JSON
template**. Data flows through three layers in sequence, and two of
the three layers are scaffolding that will eventually be retired:

1. **Canonical markdown** (`docs/spells/reference/`) - the **raw
   extract** from the source reference. Free-form prose with bolded
   field labels (e.g. `**Range:** 150 feet`, or for your bucket,
   either an explicit `**School:** Evocation` line or school
   wording embedded in the level/school header). **This layer is
   the input - not modified, only read.** It will be **retired
   first**, once all data has been extracted into the structured
   layer.

2. **Structured markdown block** (same files, fenced block at the
   top) - the **in-between normalization step**. For your bucket:
   `- **School**: evocation` as a single normalized token.
   **This layer will be retired second**, once the structured
   shape is good enough to apply generally to JSON spell files.

3. **Runtime JSON** (`public/data/spells/`) - the **end state**.
   The goal is a **single JSON template** holding every possible
   field and value (description text aside). Your bucket targets
   the `school` field on that template.

Buckets aren't tracking eternal parity between three sources of
truth - they're tracking the **convergence** to a single source.
"Drift" between canonical and structured doesn't necessarily mean
canonical is wrong; it usually means the structured normalization
deliberately departs from canonical's free-form shape. Acknowledged
differences get documented as `status: 'policy'` edge cases.

### What are the bucket "kinds"?

Four kinds exist:

- **`parity`** - true parity lanes (canonical / structured /
  runtime should all agree). **Your bucket is this kind.** Both
  phase gates show real numbers once the parity scripts land.
- **`mechanics-model`** - Aralia-only mechanics with no canonical
  analogue.
- **`inventory`** - tracking a list of items.
- **`closure`** - meta-trackers that exist to close out a problem.

### What is the Atlas + dispatch loop?

The Spell Pipeline Atlas (`misc/spell_pipeline_atlas.html`, source
at `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`)
is a developer dashboard surfacing every bucket. Data is **fully
hand-authored TypeScript** - no database. The author IS the source
of truth.

The dispatch loop ran V1 → V2 → V3 from 2026-04-25 to 2026-04-29.
**V3 closed: the Atlas model has converged.** Gaps 01-08, 10-16
are all resolved. Only Gap 09 (no automated drift check) is open.

You're a fresh dispatch on a *newly-added bucket* that didn't exist
during the convergence loop, so your job is partly to establish your
bucket inside the converged model. Your `v4.md` is a first-time
report rather than a re-verification.

### What does the School bucket track?

The migration of the **School field** (one of the eight standard
schools: abjuration / conjuration / divination / enchantment /
evocation / illusion / necromancy / transmutation) from canonical
extract → structured framework token → runtime JSON `school` field.

Per `public/data/spell_audit_coverage.json`, the School field
appears in **412 structured-md files**. Both canonical-side and
structured-JSON-side audit lanes already exist. **The parity
script does not yet exist** (`parityScript: false` in the audit
coverage). That is your first task.

The current execution map carries placeholder steps:

- **Phase 1** has one `active` step:
  `land_school_canonical_parity_script`. Replace with real
  subbuckets once the parity script lands and an inventory pass
  produces a count.
- **Phase 2** has a parallel `queued` step:
  `land_school_runtime_parity_script`. Per the phase-block rule
  (Gap 15), Phase 2 is currently visually blocked behind Phase 1 -
  rendering at `opacity-60` with a rose `blocked: phase 1
  incomplete` chip. Don't flip Phase 2 steps to `active` until
  Phase 1 closes.

Both steps carry a `count: null` "pending recount" history snapshot
(Gap 12) to anchor "we know this exists" without faking a number.

## Your task

### 1. Read the model + relevant docs

- Read the in-app Onboarding panel (expand it on the Dashboard;
  it's the on-screen authoring guide).
- Read `docs/tasks/spells/SPELL_BUCKET_EXECUTION_MAP_TEMPLATE.md`
  (template doc).
- Read `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` (gap registry;
  understand what's resolved and what's still open).
- Read `docs/tasks/spells/atlas-reports/_LOOP_CLOSED.md` (the
  V3 close-out doc; explains the converged state and the
  post-close additions).
- Read your bucket's stub tracker:
  `docs/tasks/spells/school/SPELL_SCHOOL_BUCKET_TRACKER.md`.

### 2. Establish the bucket

- **Land the canonical → structured parity script** for the School
  field. Look at the existing scripts in the gate-checker pipeline
  (search the codebase for examples of other bucket parity scripts
  - Components, Sub-Classes, Casting Time all have authored
  scripts). The script should walk every spell in
  `docs/spells/reference/`, extract the canonical-side school
  reference (free-form), compare to the structured-md
  `- **School**:` field, and emit a mismatch entry in
  `spell_gate_report.json` when they disagree.
- **Run the inventory**: produce a first count of mismatches.
- **Classify the inventory**: enumerate the actual subbuckets
  that emerge (likely candidates: missing structured value,
  normalized spelling, alternate-source spelling, etc.).
- **Update the Atlas execution map**: replace the placeholder
  `land_school_canonical_parity_script` step with real subbuckets.
  Mark Phase 1 step 1 as `done` and create the next set of
  subbuckets reflecting the actual inventory.
- **Update the tracker doc**: replace the stub with real bucket
  content as the inventory takes shape.
- **Bump `lastUpdated`** on your `BUCKET_META` row each time you
  edit your bucket.

### 3. Verify your bucket reads honestly

Walk through the Atlas:

- **Dashboard row**: `School -> parity ... -- todo todo`. Once
  the parity script lands, the `todo` gates should flip to
  `implemented` and the count columns should populate. Note: the
  count columns are derived from the gate-report; updating them
  requires landing the script, not just updating the Atlas.
- **Matrix**: clicking the School row should jump to your
  execution map.
- **Execution map**: subbuckets, counts, history match your
  tracker doc. Phase 2 stays blocked until Phase 1 is `done`.
- **Edge cases**: each has a count + at least one history
  snapshot. Use `count: null` snapshots for pending counts
  (Gap 12). Use `resolved: [...]` / `added: [...]` arrays on
  subsequent snapshots to capture per-step membership delta
  (Gap 16) when work passes land.

### 4. Call out what doesn't fit

If something the bucket needs to express isn't in the Atlas
model, append a new gap to `ATLAS_GAPS_REGISTRY.md`. The loop
can re-open if you surface real modeling needs - "ready, no
new gaps" is the goal but isn't required on a first dispatch.

## How to report back

Write your report to:

```
docs/tasks/spells/atlas-reports/school/v4.md
```

The folder doesn't exist yet - create it. Slug is `school`
(already in the `atlas-reports/README.md` slug table).

Use the same 5-section template as V3 reports, with one
adjustment: §1 should reflect that you're establishing the
bucket from scratch rather than re-verifying:

```markdown
## Bucket: School

### 1. Fields implemented (v4 first-time)
- `kind`: confirmed `parity`
- `lastUpdated`: bumped to <YYYY-MM-DDTHH:MMZ>
- Phase 1 gate flipped from `todo` to: <implemented | still todo - reason>
- Phase 2 gate flipped from `todo` to: <implemented | still todo - reason>
- Parity script(s) landed: <yes - paths | no - blockers>
- Subbuckets enumerated: <N | none yet - reason>
- Edge cases authored: <N | none yet>
- `ExecutionStep.spells` (Gap 14) added: <on which subbuckets | N/A>
- `count: null` / `resolved` / `added` snapshots: <usage | N/A>
- Closure-slug normalization: <N/A - no closure steps yet>

### 2. Verification
- Dashboard row reads honestly: yes | no - <what's wrong>
- Matrix click-through lands on my map: yes | no | source-only
- Execution-map counts match tracker doc: yes | drift - <numbers>
- Phase 2 correctly blocked behind Phase 1: yes | no - <state>

### 3. Gaps reported
- New entries appended to `ATLAS_GAPS_REGISTRY.md`: <Gap NN | none>
- Existing entries I added notes to: <Gap NN | none>

### 4. Doc / UI friction
- <bullet>
- (or "none" if the docs were sufficient)

### 5. Confidence
One sentence: ready / not ready, plus what's blocking if not ready.
```

**Don't post the report contents back as a chat message.** The
file IS the deliverable. A one-line acknowledgment ("wrote
`atlas-reports/school/v4.md`") confirms delivery.

## What happens next

The orchestrator reads your report and decides whether the model
absorbed the new bucket cleanly. If you flagged new gaps, those go
into the registry. If your bucket needs more authoring rounds, you
get a follow-up prompt; otherwise the bucket exits the iteration
loop and joins the passive work-tracking dashboard.

## TL;DR

1. Read the Onboarding panel + template + gap registry +
   `_LOOP_CLOSED.md` + your stub tracker.
2. Land the canonical → structured parity script for the School
   field. Run the inventory. Classify. Replace placeholder steps
   in the Atlas with real subbuckets. Update the tracker.
3. Verify Dashboard / Matrix / Map read honestly. Confirm Phase 2
   is correctly blocked.
4. Report what doesn't fit (or "ready, no new gaps") - don't paper
   over.
5. Write the report to
   `docs/tasks/spells/atlas-reports/school/v4.md` using the
   5-section template. Don't post contents in chat.
