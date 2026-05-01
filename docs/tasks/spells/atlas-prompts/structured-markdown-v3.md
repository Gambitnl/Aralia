# Atlas dispatch - Structured Markdown bucket (V3 round, first-time)

You are the agent for the **`Structured Markdown`** spell bucket.

## Your bucket at a glance

| Field | Value |
| --- | --- |
| `BUCKET_META.bucket` | `Structured Markdown` |
| `kind` | `closure` (meta / closure tracker) |
| `phase1Gate` | `implemented` |
| `phase2Gate` | `n/a` (no runtime JSON lane) |
| `note` | "meta - tracks spells missing structured block entirely" |
| `lastUpdated` | `2026-04-26T12:00Z` (seed value - **rendering rose-stale on the dashboard**) |
| Tracker doc | `docs/tasks/spells/SPELL_MISSING_STRUCTURED_MD_TRACKER.md` |
| Report destination | `docs/tasks/spells/atlas-reports/structured-markdown/v3.md` |
| Atlas deep link | `/Aralia/misc/spell_pipeline_atlas.html?bucket=Structured Markdown` |

## Background - the task behind the task

If you've never touched the spell pipeline before, read this section
before the dispatch instructions. Returning agents can skim.

### What is the spell pipeline?

The spell pipeline is a **one-way migration ending in a single JSON
template**. Data flows through three layers in sequence, and two of
the three layers are scaffolding that will eventually be retired:

1. **Canonical markdown** (`docs/spells/reference/`) - the **raw
   extract** from the source reference. Free-form prose with bolded
   field labels. **This layer is the input - not modified, only
   read.** It will be **retired first**, once all data has been
   extracted into the structured layer.

2. **Structured markdown block** (same files, fenced block at the top)
   - the **in-between normalization step**. Takes canonical's
   free-form values and fits them into a global spell framework with
   strict field shapes so they can drive runtime JSON. **This layer
   will be retired second**, once the structured shape is good enough
   to apply generally to JSON spell files.

3. **Runtime JSON** (`public/data/spells/`) - the **end state**. The
   goal is a **single JSON template** that holds every possible field
   and value for every spell (description text aside), populated from
   the structured layer.

Most buckets track the migration of one aspect of a spell through
those three layers. **Your bucket is the prerequisite gate**: a spell
without a structured block can't be migrated at all - the structured
layer can't normalize what doesn't exist, and JSON can't be generated
from missing structured data. Every other bucket's work depends on
yours having succeeded first.

### What are the bucket "kinds"?

Four kinds exist:

- **`parity`** - true parity lanes (canonical / structured / runtime
  should all agree).
- **`mechanics-model`** - Aralia-only mechanics with no canonical
  analogue.
- **`inventory`** - tracking a list of items.
- **`closure`** - meta-trackers that exist to *close out* a problem.
  **Your bucket is this kind.** Once everything is patched, the
  bucket goes dormant - work-status flips to `closed` and the
  dashboard renders the row dimmed.

### What is the Atlas + dispatch loop?

The Spell Pipeline Atlas (`misc/spell_pipeline_atlas.html`, source at
`src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`) is a
developer dashboard that surfaces every bucket, every subbucket, every
edge case. Data is **fully hand-authored TypeScript** - no database.

The Atlas model is itself iterating. Each round (V1, V2, V3, ...) the
orchestrator dispatches a prompt to every bucket agent asking them to
(a) apply the current model to their bucket, (b) verify it reads
honestly, (c) report what doesn't fit. Reports surface modeling gaps;
gaps drive the next round's revisions. The loop runs until each
bucket's agent says **"ready - the model fits, I can go back to
actually working the bucket."**

V2's reports surfaced three gaps (12, 13, 14), all resolved this
round. Your job is to verify the V3 model fits your bucket.

### What does the Structured Markdown bucket track?

The bucket exists to **make sure every spell has a structured block at
all** - the prerequisite for any migration work. A spell with only
canonical content can't proceed through the pipeline; without a
structured block, the in-between normalization step has nothing to
normalize, so runtime JSON can't be generated.

Phase 1 (canonical → structured) had **47 spells originally missing
the structured block; all 47 have been patched.** The bucket is
currently `closed`:

- `level_0_canonical_only_stubs` (43 cantrips) - done. Cantrip stubs
  patched file by file; structured block added on top of the
  preserved canonical snapshot underneath.
- `level_1_canonical_only_stubs` (4 spells: `absorb-elements`,
  `catapult`, `snare`, `tashas-caustic-brew`) - done.

Phase 2 is `n/a` because the bucket isn't tracking
structured-to-JSON migration; it's tracking
"does-the-structured-layer-exist-at-all." Phase 3 may carry small
closure tasks (verification that nothing regressed, etc.) - these
should follow the new V3 closure-slug normalization rule.

**This is a closure bucket; the goal is to stay closed.** Your
verification: is the dashboard correctly showing the bucket as
closed, are V3 fields applied where applicable, and has any new
canonical-only spell appeared since closure that would re-open a
subbucket? (Unlikely, but worth checking - new spell additions could
land without a structured block by accident.)

In the long view, **once the structured layer itself is eventually
retired** (the second of the two layer retirements - when every
spell's data is in good enough shape to drive JSON directly), this
bucket becomes historical. Until then it's the prerequisite gate that
keeps the rest of the migration possible.

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
   agents"** and the **"Kind-aware reading"** sections - both apply to
   you.
2. Read your tracker doc to understand the bucket's current state.
3. Open the Atlas (deep link above) - or fall back to source-only
   verification if the dev server isn't reachable from your session.
4. Apply the V3 fields where they fit your bucket. `kind` should
   already be `closure`; verify it's right and apply the new v3
   fields where applicable.
5. Bump `lastUpdated` to current UTC time as the very last edit before
   you save.
6. Write your report to
   `docs/tasks/spells/atlas-reports/structured-markdown/v3.md` using
   the 5-section template at the bottom of the V3 prompt.

## Notes specific to a `closure` bucket

- **The dashboard's `struct dirty` column honestly shows `-` for your
  bucket.** This is correct behavior - there is no Phase 2 lane (no
  runtime JSON tracking) for a closure tracker. Don't try to
  populate that column.
- A closure bucket's whole reason for existing is to **close out** a
  meta-pattern (here: spells missing the structured markdown block
  entirely). That means your work-status is biased toward `closed`
  once the meta-list is empty. If you're at zero, the dashboard
  renders your row dimmed - that's the system working as designed.
- **Closure-step slug rule (new in V3):** Phase 3 closure-step labels
  follow the same `snake_case` rule as P1/P2 subbuckets. If your
  current map has free-form closure labels (e.g. `Verify backfill is
  complete`), normalize them to slugs (e.g.
  `verify_backfill_is_complete`). This was a v2 friction item that
  landed in the V3 docs.
- Closure buckets often have a single Phase 3 block with a small
  number of closure tasks rather than P1/P2 subbuckets. The shape is
  intentional - don't manufacture P1/P2 entries to "look more like
  the parity buckets."
