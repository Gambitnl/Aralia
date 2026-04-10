# Spell Classes Bucket Tracker

Last Updated: 2026-04-06

## Bucket Purpose

This tracker exists for the `Classes` bucket inside the spell-truth lane.

The bucket asks two different questions that should not be collapsed together:

1. `canonical -> structured`
   - does the structured spell markdown still reflect the spell's base-class access
     as preserved in the copied canonical snapshot?
2. `structured -> json`
   - does the runtime spell JSON that the glossary renders still match the
     structured spell markdown for base-class access?

This tracker exists because the canonical-side audit and the runtime-side audit do
not tell the same story for `Classes`, and the older canonical count was recently
proven to be stale.

## Current Status

- canonical -> structured:
  - `17` mismatches in
    `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - grouped kind: `missing-canonical-field`
  - current reading: small active residue set with a mix of:
    - source-shape residue
    - canonical parse contamination
- structured -> json:
  - no grouped `Classes` bucket currently appears in
    `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: no active corpus-scale runtime `Classes` backlog is exposed
    right now

Bucket state:
- canonical side: active, but mostly residue
- runtime side: mostly resolved at the grouped-report level

## Key Mismatch Families

### 1. Missing derived base classes from `Available For`

The copied canonical snapshot usually preserves class access under raw
`Available For` lines rather than under a directly comparable `Classes` field.

That means the canonical-side audit still reports some spells as:
- structured `Classes` exists
- canonical comparable `Classes` missing

Current count in the live `17`-spell bucket:
- `12` spells

Representative examples:
- `aura-of-life`
- `circle-of-power`
- `conjure-volley`
- `mislead`
- `raise-dead`

This is no longer a corpus-wide crisis. After the `2026-04-05` report refresh, it
is the dominant explanation for only a small named residue set.

### 2. Canonical metadata leaking into the comparable class value

A smaller subset is not just "missing comparable classes." In these files, the
canonical-side comparable class value is polluted by capture metadata:
- `Capture Method: http`

Current count in the live `17`-spell bucket:
- `5` spells

Representative examples:
- `aura-of-purity`
- `bigbys-hand`
- `mass-cure-wounds`
- `planar-binding`
- `scrying`

This is a parser-quality problem on the canonical-side comparison path, not a
real base-class disagreement.

### 3. Legacy labels inside canonical access

Some canonical captures preserve labels like:
- `Bard (Legacy)`
- `Wizard (Legacy)`

These should usually be treated as canonical evidence surface rather than as proof
that the structured or runtime class list is wrong.

### 4. True historical base-class drift

This bucket has produced real corrections before.

Representative example:
- `disguise-self`
  - prior runtime JSON carried non-caster base classes
  - canonical review showed the base-class surface was narrower
  - that required a true data correction, not only a display interpretation

So this bucket should not be written off entirely as "just residue," even though
the current grouped report is dominated by source-shape cases.

## Current Interpretation

The current best reading is:

- canonical -> structured:
  - no longer a broad residue bucket
  - now a small active review set where:
    - `12` cases are best read as missing derived classes from `Available For`
    - `5` cases are parser contamination where capture metadata leaked into the
      comparable class value
- structured -> json:
  - no grouped runtime backlog currently exposed
  - runtime JSON does not appear to be lagging behind structured `Classes` data at
    corpus scale right now

That means the `Classes` bucket is currently more about:
- audit clarity
- source-shape interpretation
- preserving a place for future true class corrections

than about an active broad implementation backlog.

## Per-Phase Plan

### Phase 1: Keep the canonical-side status legible

- document clearly that the canonical-side bucket is now `17`, not `408`
- do not let the older stale count continue to frame the bucket as a broad
  class-data failure lane
- keep the bucket split visible:
  - `12` missing-derived-classes cases
  - `5` metadata-leak parser cases

### Phase 2: Preserve runtime confidence

- document that there is currently no grouped `Classes` runtime bucket in the
  structured-vs-json report
- treat that as evidence that runtime JSON is not currently lagging behind the
  structured class list at broad corpus scale

### Phase 3: Preserve room for true class corrections

- keep examples like `disguise-self` visible as proof that this bucket can still
  surface real base-class drift
- do not over-normalize the bucket into "always residue"

### Phase 4: Future audit improvement

- later improve the canonical-side audit so it derives comparable base classes more
  directly from raw `Available For`
- this should help explain the remaining `missing-canonical-field` cases without
  weakening the bucket's ability to catch real base-class drift
- fix the canonical-side parser so non-class metadata like `Capture Method: http`
  cannot leak into the comparable `Classes` value

## Progress Log

### 2026-04-04

- confirmed there was no dedicated `Classes` bucket tracker doc yet
- reviewed the live shared docs and both current report files
- confirmed:
  - `408` canonical-side `Classes` mismatches in the then-stale report state
  - `0` grouped runtime `Classes` mismatches in the current structured-vs-json report
- updated the shared spell-truth docs so `Classes` now has:
  - a bucket section in the validation plan
  - a bucket progress note in the canonical sync tracker
  - a bucket-specific residue section in the canonical sync flags

### 2026-04-06

- reran the live canonical-side report and refreshed the gate artifact
- confirmed the old `408` `Classes` count was stale
- current live `Classes` bucket is now:
  - `17` canonical -> structured mismatches
  - `0` grouped structured -> json mismatches
- split the canonical-side residue into two real subbuckets:
  - `12` missing-derived-classes cases
  - `5` metadata-leak parser cases
- updated the tracker and shared docs so the bucket is now described as a small
  active residue set rather than a corpus-scale class-data problem

## Remaining Work

- audit work:
  - improve the canonical-side comparison so base classes are derived more directly
    from canonical `Available For`
  - fix the canonical-side parser so metadata lines do not contaminate comparable
    `Classes` values
  - review the remaining `17` canonical-side spells directly if the bucket needs to
    be reduced from "small active residue" to "boundary-only"
- policy review:
  - decide whether any legacy-class labels need explicit treatment beyond current
    normalization
- implementation work:
  - none currently indicated at grouped runtime scale for `Classes`
  - revisit only if a selected spell gate review surfaces a real runtime class drift

## Open Questions / Model Gaps

1. Should the canonical-side audit keep reporting `Classes` as
   `missing-canonical-field` when the data is really present under `Available For`,
   or should that be downgraded after better derivation?

2. Should legacy-labeled canonical base classes be preserved anywhere as explicit
   evidence, or remain only inside the raw copied canonical snapshot?

3. Should the canonical-side parser ignore capture metadata lines before class
   derivation, or should the canonical snapshot extraction be tightened earlier so
   those lines never enter the comparison path?

4. Should the gate checker eventually expose a dedicated `Classes Runtime Review`
   subsection even though there is currently no grouped runtime `Classes` backlog,
   or is the current `Classes Review` plus the general structured-to-json status
   sufficient until a real runtime case appears?
