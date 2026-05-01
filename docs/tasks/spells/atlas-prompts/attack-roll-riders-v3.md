# Atlas dispatch - Attack-Roll Riders bucket (V3 round, first-time)

You are the agent for the **`Attack-Roll Riders`** spell bucket.

## Your bucket at a glance

| Field | Value |
| --- | --- |
| `BUCKET_META.bucket` | `Attack-Roll Riders` |
| `kind` | `mechanics-model` (Aralia-only mechanics carve-out, not parity) |
| `phase1Gate` | `n/a` (no canonical lane) |
| `phase2Gate` | `todo` |
| `note` | "Aralia-only mechanics carve-out; not on gate report pipeline" |
| `lastUpdated` | `2026-04-26T12:00Z` (seed value - **rendering rose-stale on the dashboard**) |
| Tracker doc | `docs/tasks/spells/attack-roll-riders/SPELL_ATTACK_ROLL_RIDERS_BUCKET_TRACKER.md` |
| Report destination | `docs/tasks/spells/atlas-reports/attack-roll-riders/v3.md` |
| Atlas deep link | `/Aralia/misc/spell_pipeline_atlas.html?bucket=Attack-Roll Riders` |

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

Buckets aren't tracking eternal parity between three sources of
truth - they're tracking the **convergence** to a single source.
Acknowledged normalization differences get documented as **policy**
edge cases (`status: 'policy'`) rather than defects.

When canonical is fully extracted, the canonical layer can be retired.
When structured is in good enough shape, the structured layer can be
retired and JSON becomes the single source. The Atlas tracks where
each spell is in that migration; **bucket work IS the migration.**

### What are the bucket "kinds"?

Four kinds exist:

- **`parity`** - true parity lanes (canonical / structured / runtime
  should all agree). Both phase gates show real numbers.
- **`mechanics-model`** - Aralia-only mechanics with no canonical
  analogue. **Your bucket is this kind.** Phase 1 gate is `n/a`
  because the canonical reference doesn't talk about Aralia's specific
  mechanics model. The work is structured-vs-runtime alignment of new
  mechanics, not three-layer parity.
- **`inventory`** - tracking a list of items rather than parity drift.
- **`closure`** - meta-trackers that exist to close out a problem.

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

### What does the Attack-Roll Riders bucket track?

**Aralia's own attack-roll modifier mechanic** - spells that grant
advantage/disadvantage on attack rolls or modify hit-resolution beyond
the canonical D&D condition system.

Because Aralia's mechanics carve-out is **not in the canonical source
extract**, this bucket has no canonical lane at all (`phase1Gate:
'n/a'`). The migration starts at the structured layer: define the
attack-roll-rider field shape there, populate it for the relevant
spells, and target a runtime JSON expression via
`ATTACK_ROLL_MODIFIER`. The end-state JSON template will carry
attack-rider fields directly; structured is just the in-between
shaping ground.

Phase 1 is intentionally empty. Phase 2 has:

- `outgoing_rider_on_target_attacks` (1 spell, `frostbite`) - the seed
  case, already done. Structured exposes the rider fields and runtime
  uses `ATTACK_ROLL_MODIFIER`.
- `incoming_rider_on_attacks_vs_target` (`?` count, **active**) - the
  open inventory work: spells/features that make a creature harder to
  hit, currently miscategorized as fake conditions. The migration
  target is a proper rider classification rather than forcing them
  into the conditions bucket.

The bucket's job is to inventory and migrate spells out of conditions
(where they're forced into a square hole) and into the proper rider
shape that survives all the way to JSON. **`status: 'policy'` edge
cases are common here** because mechanics-model carve-outs document
"Aralia chooses to model X this way" rather than fixing a defect.
Gap 13 (resolved this round) means policy edge cases now read with
neutral diagnostics instead of rose flags - take advantage of that.

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
   already be `mechanics-model`; verify it's right and apply the new
   v3 fields where applicable.
5. Bump `lastUpdated` to current UTC time as the very last edit before
   you save.
6. Write your report to
   `docs/tasks/spells/atlas-reports/attack-roll-riders/v3.md` using
   the 5-section template at the bottom of the V3 prompt.

## Notes specific to a `mechanics-model` bucket

- **The dashboard's `canon dirty` and `struct dirty` columns honestly
  show `-` for your bucket.** This is correct behavior, not drift -
  your bucket isn't on the gate-report pipeline. Don't try to populate
  those columns; the real work-tracking lives in your execution map.
- `phase1Gate` is `n/a` because there is no canonical layer for
  Aralia-only mechanics. `phase2Gate` is `todo`. This shape is
  intentional and shouldn't be "fixed."
- Edge cases in mechanics-model buckets often have `status: 'policy'`
  more frequently than parity buckets. Gap 13 (resolved this round)
  means policy edge cases now read with neutral diagnostics instead
  of rose flags - take advantage of that when modeling carve-outs.
