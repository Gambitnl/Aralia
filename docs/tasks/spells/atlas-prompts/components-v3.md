# Atlas dispatch - Components bucket (V3 round, first-time)

You are the agent for the **`Components`** spell bucket.

## Your bucket at a glance

| Field | Value |
| --- | --- |
| `BUCKET_META.bucket` | `Components` |
| `kind` | `parity` (canonical / structured / runtime parity lane) |
| `phase1Gate` | `implemented` |
| `phase2Gate` | `implemented` |
| `lastUpdated` | `2026-04-26T12:00Z` (seed value - **rendering rose-stale on the dashboard**) |
| Tracker doc | `docs/tasks/spells/components/SPELL_COMPONENTS_BUCKET_TRACKER.md` |
| Report destination | `docs/tasks/spells/atlas-reports/components/v3.md` |
| Atlas deep link | `/Aralia/misc/spell_pipeline_atlas.html?bucket=Components` |

## Background - the task behind the task

If you've never touched the spell pipeline before, read this section
before the dispatch instructions. Returning agents can skim.

### What is the spell pipeline?

The spell pipeline is a **one-way migration ending in a single JSON
template**. Data flows through three layers in sequence, and two of
the three layers are scaffolding that will eventually be retired:

1. **Canonical markdown** (`docs/spells/reference/`) - the **raw
   extract** from the source reference. Free-form prose with bolded
   field labels (e.g. `**Components:** V, S, M (a tiny ball of bat
   guano and sulfur)`). **This layer is the input - not modified, only
   read.** It will be **retired first**, once all data has been
   extracted into the structured layer.

2. **Structured markdown block** (same files, fenced block at the top)
   - the **in-between normalization step** (e.g.
   `- **Range Type**: ranged`, `- **Range Distance**: 150`). This is
   where most actual work happens: take canonical's free-form values
   and fit them into a global spell framework with strict field shapes
   so they can drive runtime JSON. **This layer will be retired
   second**, once the structured shape is good enough to apply
   generally to JSON spell files.

3. **Runtime JSON** (`public/data/spells/`) - the **end state**. The
   goal is a **single JSON template** that holds every possible field
   and value for every spell (description text aside), populated from
   the structured layer.

Buckets aren't tracking eternal parity between three sources of
truth - they're tracking the **convergence** to a single source.
"Drift" between canonical and structured doesn't necessarily mean
canonical is wrong; it usually means the structured normalization
deliberately departs from canonical's shape because the framework
needs a normalized shape. Acknowledged differences get documented as
**policy** edge cases (`status: 'policy'`) rather than defects.

When canonical is fully extracted, the canonical layer can be retired.
When structured is in good enough shape, the structured layer can be
retired and JSON becomes the single source. The Atlas tracks where
each spell is in that migration; **bucket work IS the migration.**

### What are the bucket "kinds"?

Not every bucket is a parity lane. Four kinds exist:

- **`parity`** - true parity lanes (canonical / structured / runtime
  should all agree). Both phase gates show real numbers. Most buckets.
- **`mechanics-model`** - Aralia-only mechanics with no canonical
  analogue. Phase 1 gate is `n/a`.
- **`inventory`** - tracking a list of items rather than parity drift.
- **`closure`** - meta-trackers that exist to *close out* a problem;
  go dormant once cleared.

### What is the Atlas + dispatch loop?

The Spell Pipeline Atlas (`misc/spell_pipeline_atlas.html`, source at
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`) is a
developer dashboard that surfaces every bucket, every subbucket, every
edge case. Data is **fully hand-authored TypeScript** - no database.
The author IS the source of truth.

The Atlas model is itself iterating. Each round (V1, V2, V3, ...) the
orchestrator dispatches a prompt to every bucket agent asking them to
(a) apply the current model to their bucket, (b) verify it reads
honestly, (c) report what doesn't fit. Reports surface modeling gaps;
gaps drive the next round's revisions. The loop runs until each
bucket's agent says **"ready - the model fits, I can go back to
actually working the bucket."**

V2's reports surfaced three gaps (12, 13, 14), all resolved this
round. Your job is to verify the V3 model fits your bucket.

### What does the Components bucket track?

The migration of V/S/M (verbal, somatic, material) component
declarations from canonical extract → structured framework shape →
runtime JSON. **The migration is mostly done** - only 3 spells are
flagged as residue, and they're all documented as accepted
source-shape boundaries (canonical uses `**` footnote markers,
structured normalizes them differently) rather than real drift.
Subbuckets:

- `footnote_marker_residue` (2 spells) - marker-shape boundary
  (`feather-fall`, `soul-cage`)
- `alternate_source_shape` (1 spell, `arcane-sword`) - approved
  alternate-source compact header (canonical has inline material
  text; structured has the compact V/S/M header form)
- `true_components_drift` (0 spells) - reserved subbucket; if any
  spell ever lands here, the structured side is genuinely wrong and
  needs fixing

This is a quiet bucket near closure. Once the structured layer
itself is eventually retired (long-term goal across the whole
pipeline), this bucket becomes historical. Your immediate job is to
verify the V3 fields apply cleanly to a near-closed migration lane
and bump `lastUpdated`.

## Context for this dispatch

You did not file a `v2.md` report in the V2 round. Either no agent was
assigned, or the previous agent's session was lost. Either way, **you
are a first-time engagement on this bucket** for the dispatch loop.

This means:

- Your `BUCKET_META.lastUpdated` is still the seed value
  (`2026-04-26T12:00Z`), so on the dashboard's "Last updated" column
  your row is rendering stale-rose. Bumping that field is one of the
  simplest signals that you've started.
- There is no `v2.md` for your bucket - you'll skip directly to writing
  `v3.md` next to nothing (no audit-trail predecessor).
- The V3 prompt has a "Special note for first-time agents" section
  near the top - read it before the "What's new since v2" framing.

## Your task

1. Read the V3 prompt: `docs/tasks/spells/ATLAS_AGENT_PROMPT_V3.md`.
   Pay particular attention to the **"Special note for first-time
   agents"** section - it tells you to read the whole prompt as your
   introduction rather than as a delta.
2. Read your tracker doc to understand the bucket's current state.
3. Open the Atlas (deep link above) - or fall back to source-only
   verification if the dev server isn't reachable from your session.
4. Apply the V3 fields where they fit your bucket (`kind` is already
   `parity`; you mostly need to verify the v2 fields landed and apply
   the new v3 fields: `count: null` history, `ExecutionStep.spells`,
   policy edge-case sweeps if any apply).
5. Bump `lastUpdated` to current UTC time as the very last edit before
   you save.
6. Write your report to `docs/tasks/spells/atlas-reports/components/v3.md`
   using the 5-section template at the bottom of the V3 prompt.

## Notes specific to a `parity` bucket

- The dashboard's `canon dirty` and `struct dirty` columns will show
  real numbers (not `-`) because both phases are on the gate-report
  pipeline. If they drift from your tracker, that's a Gap 09 example
  worth flagging in §4.
- Both `phase1Gate` and `phase2Gate` are `implemented`, so the
  Atlas knows about your bucket end-to-end. Your job is to make sure
  the execution map matches what the gate report says.
