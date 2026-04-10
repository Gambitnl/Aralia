# Spell Description Bucket Tracker

Last Updated: 2026-04-04

## Bucket Purpose

This tracker exists for the `Description` bucket inside the spell-truth lane.

The bucket has to cover two separate comparison phases:

- canonical -> structured
- structured -> json

That split matters because the glossary spell card renders from runtime spell JSON,
not from the structured markdown block. A spell is not fully covered just because
its structured `Description` was compared against the copied canonical snapshot.

Current execution priority:

- primary lane: `canonical -> structured`
- secondary lane: `structured -> json`

The Description bucket should be worked in that order. Once canonical prose is copied
cleanly into the structured markdown block, the runtime JSON lane becomes a simpler
follow-through sync instead of a competing interpretation problem.

## Current Status

- Gate checker support:
  - canonical -> structured `Description Review`: implemented
  - structured -> json `Description Runtime Review`: implemented
- Canonical -> structured live report:
  - `51` mismatches
  - current grouped kind: `value-mismatch`
  - practical reading: real canonical-to-structured prose drift after the canonical-side
    parser bug was fixed on `2026-04-04`
- Structured -> json live report:
  - `34` mismatches
  - current grouped kind: `value-mismatch`
  - practical reading: active runtime follow-up lane with a mix of real drift and lower-value formatting residue
- Shared docs:
  - this bucket now has explicit status notes in:
    - `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
    - `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
    - `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- Split subbucket artifacts:
  - `F:\Repos\Aralia\.agent\roadmap-local\spell-validation\spell-description-canonical-subbucket-report.json`
  - `F:\Repos\Aralia\.agent\roadmap-local\spell-validation\spell-description-runtime-subbucket-report.json`
  - `F:\Repos\Aralia\docs\tasks\spells\description\SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`

## Bucket Interpretation

### Canonical -> Structured

This is now the controlling lane for the Description bucket.

Current dominant category:
- real prose drift

The prior `406` count turned out to be heavily inflated by the canonical audit script
failing to extract multiline `Rules Text` blocks correctly from the copied snapshot.
That parser bug is now fixed, so the live `51` count is a much better measure of true
canonical-to-structured Description disagreement.

### Structured -> JSON

This is the real implementation lane for the `Description` bucket.

The structured markdown block is the interpreted layer.
The spell JSON is the runtime/app layer.
The glossary renders the runtime JSON.

So when structured `Description` and JSON `description` disagree, that is runtime
implementation drift unless proven otherwise.

Current dominant category:
- real implementation drift

Secondary category:
- formatting / encoding residue

Current execution rule:
- do not lead with the runtime lane
- first finish canonical -> structured Description syncing
- then use the structured -> json report as the downstream surface for whatever
  runtime JSON still lags behind the newly corrected structured layer

## Key Mismatch Families

### Canonical -> Structured

- `value-mismatch`
  - Meaning: the structured markdown `Description` is now directly comparable to the
    canonical prose derived from `Rules Text`, and the values still differ.
  - Current status: real canonical copying work remains.

### Structured -> JSON

- `value-mismatch`
  - Meaning: the structured markdown `Description` and runtime JSON `description`
    are not identical.
  - Current status: mixed bucket that still needs subbucketing into:
    - real runtime drift
    - formatting / encoding residue

## Current Subbucket Counts

### Canonical -> Structured

- `real-prose-drift`: `30`
- `canonical-extra-rules-detail`: `13`
- `higher-level-text-still-inline-or-missing`: `8`

### Structured -> JSON

- `wording-shift-still-needs-review`: `18`
- `real-runtime-drift`: `16`

## Representative Spell Examples

### Canonical -> Structured source-shape residue

- This is no longer the dominant Description problem after the parser fix on
  `2026-04-04`.
- The report now derives canonical Description content from raw `Rules Text`
  correctly enough that the remaining bucket is mostly actual prose drift.

### Canonical -> Structured real prose drift

- `aura-of-life`
- `aura-of-purity`
- `banishment`
- `blight`
- `control-water`
- `sickening-radiance`

### Structured -> JSON real runtime drift

- `cure-wounds`
  - structured says `A creature you touch regains a number of Hit Points...`
  - runtime JSON drops `a number of`
- `disguise-self`
  - runtime JSON includes the dismissal clause that the structured block lacks
- `sleep`
- `darkness`
- `greater-restoration`

### Structured -> JSON likely formatting residue

- `command`
  - the current mismatch is driven by encoding / apostrophe differences rather than
    clear meaning drift

## Per-Phase Plan

### Phase 1: Canonical -> Structured interpretation

Goal:
- treat the remaining canonical-side bucket as real prose sync work rather than
  inflated parser residue

Actions:
- work the canonical-side subbuckets in this order:
  1. `real-prose-drift`
  2. `canonical-extra-rules-detail`
  3. `higher-level-text-still-inline-or-missing`
- copy canonical Description prose into the structured markdown block where the
  current report still shows real `value-mismatch`
- keep `Higher Levels` separate when the canonical rules text clearly breaks out
  scaling text into that second field

### Phase 2: Structured -> JSON review

Goal:
- treat runtime Description drift as the follow-through lane after canonical -> structured

Actions:
- after each canonical-side sync pass, update runtime JSON from the corrected
  structured Description where the JSON layer still lags behind
- keep the dedicated `Description Runtime Review` block visible in the glossary gate checker
- use the runtime report and live JSON to identify real runtime prose drift
- separate real drift from formatting residue

### Phase 3: Runtime subbucketing follow-up

Goal:
- stop treating all `34` runtime Description mismatches as the same kind of problem

Actions:
- split runtime mismatches into:
  - real runtime drift
  - formatting / encoding residue
  - blocked cases, if structured Description is missing

## Progress Log

- 2026-04-02
  - canonical-side `Description Review` block strengthened in the glossary gate checker
  - severity/problem/review-step guidance added

- 2026-04-03
  - separate `Description Runtime Review` block added to the glossary gate checker
  - runtime lane now explicitly compares structured `Description` against live JSON `description`
  - shared spell-truth docs updated to treat Description as a two-phase bucket rather than only a canonical-review concern
  - bucket docs updated to record the current split clearly:
    - canonical -> structured: mostly source-shape residue
    - structured -> json: still active runtime implementation follow-up

- 2026-04-04
  - fixed the canonical-side Description parser in `scripts/auditSpellStructuredAgainstCanonical.ts`
  - the canonical bucket dropped from `406` parser-inflated findings to `51` real
    `value-mismatch` cases
  - this bucket is now primarily a canonical copying lane plus a smaller runtime
    JSON follow-up lane

- 2026-04-06
  - created `scripts/generateSpellDescriptionSubbucketReports.ts`
  - generated split post-fix Description subbucket artifacts for:
    - canonical -> structured
    - structured -> json
  - confirmed the current live split:
    - canonical side: `30` real prose drift, `13` extra-rules-detail cases, `8`
      description-vs-higher-level split cases
    - runtime side: `18` wording-shift cases and `16` real runtime drift cases

## Remaining Work

- finish the canonical -> structured subbuckets first:
  - `30` `real-prose-drift`
  - `13` `canonical-extra-rules-detail`
  - `8` `higher-level-text-still-inline-or-missing`
- copy the remaining `51` canonical Description mismatches into the structured
  markdown block file-by-file
- only then copy the corrected structured Description values into runtime JSON for the
  remaining `34` structured -> json mismatches
- split the `34` runtime Description mismatches into:
  - real runtime drift
  - wording-shift cases that still need direct review
- review the highest-signal runtime drift spells first:
  - `cure-wounds`
  - `disguise-self`
  - `sleep`
  - `darkness`
  - `greater-restoration`
- decide whether any runtime Description differences are accepted normalization
  or whether Description should remain literal by default at the runtime layer

## Open Questions / Model Gaps

- Should runtime `description` be expected to match structured `Description`
  semantically, or textually where possible?
- Should the shared structured-vs-json Description report gain explicit subbuckets
  for:
  - real runtime drift
  - formatting residue
  - blocked comparison
- The selected-spell live refresh currently overlays fresh gate data and live JSON,
  but the runtime Description lane still depends on the generated structured-vs-json
  artifact for its mismatch row rather than a dedicated fresh per-field server recompute.
  That is an implementation follow-up, not a spell-data truth finding.

## Current Bucket Verdict

- canonical -> structured: primary active lane
- structured -> json: secondary follow-through lane
- policy review only: no
- implementation work still needed: yes
- audit work still needed: yes
- runtime gate-checker coverage: partial
  - the dedicated runtime block exists, but its field-level row still depends on the
    generated structured-vs-json artifact rather than a fresh per-field server recompute
