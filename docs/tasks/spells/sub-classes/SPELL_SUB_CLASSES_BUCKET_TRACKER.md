# Spell Sub-Classes Bucket Tracker

Last Updated: 2026-04-10

## Bucket Purpose

This tracker exists for the `Sub-Classes` bucket in the spell-truth lane.

This bucket has two comparison phases:

1. `canonical -> structured`
2. `structured -> json`

Current execution priority is:

1. square away `canonical -> structured`
2. use that cleaned structured layer to drive `structured -> json`

That order matters because the structured `.md` block is the interpreted layer.
If it stays incomplete or inconsistent, the runtime JSON follow-up lane will stay
noisy and harder to classify.

## Current Status

- canonical -> structured:
  - live report: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - live count: `156`
  - grouped kind: `missing-canonical-field`
  - current reading: mixed bucket, but this is now the primary execution surface
- structured -> json:
  - live report: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live count: `45`
  - grouped kind: mainly `missing-json-field`
  - current reading: downstream implementation lane that should be reviewed after
    the canonical-first transfer work

## Canonical-First Bucket Interpretation

### Real Drift

- canonical snapshot clearly exposes subclass/domain access
- structured `.md` is missing it or stores an incomplete normalized list

### Normalized Difference

- canonical snapshot preserves repeated-base subclass/domain entries
- structured `.md` intentionally normalizes them away because the base class is
  already present in `Classes`

### Source-Shape Residue

- canonical subclass/domain access is visible in raw `Available For`
- current comparison layer does not derive a directly comparable normalized
  `Sub-Classes` field cleanly

### Model Gap

- repeated-base subclass policy is still not finally settled for long-term runtime
  storage
- verification semantics still need a final rule for when `subClassesVerification`
  should move from `unverified` to `verified`

## Canonical -> Structured Subbuckets

These are the active subbuckets for the canonical-first pass.

### 1. `missing_structured_subclasses`

- canonical snapshot clearly shows subclass/domain access
- structured `.md` has no `Sub-Classes` field or an empty one

### 2. `incomplete_structured_subclasses`

- structured `.md` has a `Sub-Classes` field
- but it is missing one or more canonical subclass/domain entries

### 3. `repeated_base_canonical_entries`

- canonical snapshot includes subclass/domain entries whose base class is already
  present in `Classes`
- these are real canonical facts, but they may remain normalized out of the
  structured/runtime payload

### 4. `legacy_or_unsupported_canonical_entries`

- canonical snapshot includes legacy or unsupported subclass/domain lines
- these should remain visible as evidence, but may not belong in normalized
  structured data

### 5. `canonical_label_variant_residue`

- canonical snapshot carries variant source suffixes or label forms
- examples:
  - `TCoE` vs `TCOE`
  - other source-tag spelling variants

### 6. `malformed_structured_subclass_field`

- structured side contains placeholders or malformed values such as `None`
- these must be corrected before reliable transfer work can happen

### 7. `canonical_source_shape_gap`

- canonical snapshot clearly has subclass access in raw `Available For`
- current audit/parsing layer still records `missing-canonical-field`
- this is audit/parser residue, not automatically real subclass absence

## Working Order

Current recommended execution order:

1. `missing_structured_subclasses`
2. `incomplete_structured_subclasses`
3. `malformed_structured_subclass_field`
4. `legacy_or_unsupported_canonical_entries`
5. `repeated_base_canonical_entries`
6. `canonical_label_variant_residue`
7. `canonical_source_shape_gap`

Only after that:

8. work the downstream `structured -> json` residue set

## Gate Checker Coverage

Current glossary spell gate coverage:

- `Sub-Classes Review`
  - phase: `canonical -> structured`
  - status: implemented
- `Sub-Classes Runtime Review`
  - phase: `structured -> json`
  - status: implemented

The runtime block should be used after canonical-first transfer work has cleaned up
the interpreted structured layer.

## Important Files For This Bucket

Core docs and reports:
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_BUCKET_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_GEMINI_HANDOVER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

Relevant implementation surfaces:
- `F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx`
- `F:\Repos\Aralia\public\data\spell_gate_report.json`

Representative spell surfaces for review:
- `F:\Repos\Aralia\docs\spells\reference\level-5\hold-monster.md`
- `F:\Repos\Aralia\public\data\spells\level-5\hold-monster.json`

## Progress Log

### 2026-04-04

- created the first dedicated tracker for this bucket
- documented the two-phase nature of `Sub-Classes`
- confirmed the glossary had:
  - `Sub-Classes Review`
  - `Sub-Classes Runtime Review`

### 2026-04-10 (handoff prep)

- shifted this bucket to a canonical-first execution model
- replaced the earlier runtime-first framing with explicit canonical-side subbuckets
- prepared the bucket for Gemini handoff
- aligned the shared spell-truth docs so they now point at the same canonical-first
  execution order:
  - `SPELL_DATA_VALIDATION_PLAN.md`
  - `SPELL_CANONICAL_SYNC_TRACKER.md`
  - `SPELL_CANONICAL_SYNC_FLAGS.md`

### 2026-04-10 (Gemini takeover — session 1)

- completed initial triage of the `71` canonical → structured Sub-Classes mismatches
- sorted into subbuckets:
  - `missing_structured_subclasses`: `38` spells
  - `incomplete_structured_subclasses`: `27` spells
  - `malformed_structured_subclass_field`: `3` spells (overlap with missing)
  - `missing_canonical_field` (reverse): `6` spells
- resolved policy decision: **Illrigger is not a canonical class** — it is leftover
  homebrew data that should be cleaned out
- removed Illrigger entries from `6` structured spell markdown files:
  - `level-1/detect-magic`
  - `level-4/banishment`
  - `level-4/blight`
  - `level-4/death-ward`
  - `level-4/dimension-door`
  - `level-4/locate-creature`
- confirmed Illrigger had not propagated to runtime spell JSON — no JSON cleanup needed
- resolved policy decision: **Remove redundancy** — redundant subclass entries (e.g.,
  `Cleric - Life Domain` when `Cleric` is already in base access) should remain
  normalized away and NOT be added to the structured `Sub-Classes` block
- resolved policy decision: **Remove Legacy entries** — subclass entries suffixed
  with `(Legacy)` should be cleaned out of structured markdown
- removed Legacy subclass entries from `2` structured spell markdown files:
  - `level-1/detect-magic`
  - `level-4/locate-creature`

## Remaining Work

- turn the `156` canonical-side cases into the subbuckets listed above
  - initial triage complete for the `71` Sub-Classes subset
  - `38` missing structured transfers are unblocked and ready to execute
- identify which spells are true:
  - missing structured subclass data
  - incomplete structured subclass data
  - repeated-base normalization only
  - legacy/unsupported evidence only
  - parser/source-shape residue only
- then use the cleaned structured layer to reduce the `45` structured-vs-json cases

## Resolved Policy Decisions

1. **Illrigger is not canonical** — any `Illrigger - Architect of Ruin` entries in
   structured spell data are leftover homebrew and should be removed on sight.
   Confirmed by project owner on `2026-04-10`.
2. **Remove redundancy for repeated-base subclasses** — if a spell can be cast by
   all members of a class (e.g., `Cleric`), and a subclass is also listed
   (e.g., `Cleric - Life Domain`), the redundant subclass entry should **not** be
   included in the structured `.md` `Sub-Classes` field. Keep it normalized away.
   Confirmed by project owner on `2026-04-10`.
3. **Remove legacy suffixes** — any subclass entries suffixed with `(Legacy)`
   should be treated as historical cruft and scrubbed from the `Sub-Classes` field.
   Confirmed by project owner on `2026-04-10`.

## Open Questions / Model Gaps

1. When does `subClassesVerification: "verified"` become appropriate?
   - after canonical retrieval
   - after structured transfer
   - or only after structured + runtime JSON both match


