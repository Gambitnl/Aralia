# Spell Material Component Bucket Tracker

Last Updated: 2026-04-10

## Bucket Purpose

Track the `Material Component` spell-truth lane across both comparison phases:

- `canonical -> structured`
- `structured -> json`

This bucket exists because the canonical snapshot preserves raw material-note lines,
while Aralia splits material data across structured markdown fields and runtime JSON
fields such as:

- material required
- material description
- material cost
- consumed state

The glossary spell card renders from runtime spell JSON, so the runtime lane matters
separately from the source-facing canonical lane.

## Current Status

- canonical -> structured:
  - `11` mismatches in `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current reading: now a small active copying/review lane
- structured -> json:
  - `5` mismatches in `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: follow-through implementation lane after structured fixes
- glossary gate checker:
  - `Material Component Review`: implemented
  - `Material Component Runtime Review`: implemented

## Current Interpretation

### Canonical -> Structured

This is now the primary lane.

The old high-noise `220`-spell canonical-side snapshot is no longer the live state.
After the canonical-side audit/report improvements, the real residue set is now:

- `arcane-sword`
- `conjure-volley`
- `divination`
- `feather-fall`
- `raise-dead`
- `reincarnate`
- `soul-cage`
- `stoneskin`
- `summon-greater-demon`
- `swift-quiver`
- one additional live report member in the grouped count, to be verified directly from
  the report row set during execution if needed

Current reading by family:

1. `canonical_consumed_state_drift`
- canonical note adds a consumed-state clause the structured note still omits
- representative examples:
  - `stoneskin`
  - `raise-dead`
  - `reincarnate`

2. `missing_structured_material_component`
- canonical snapshot has a usable material note, but the structured block still has no
  comparable `Material Component` line
- representative examples:
  - `summon-greater-demon`
  - `conjure-volley`
  - `swift-quiver`

3. `canonical_description_drift`
- the structured note and canonical note describe different actual material content
- representative example:
  - `divination`

4. `canonical_wording_boundary`
- wording differs, but the underlying material facts may still be equivalent
- representative example:
  - `feather-fall`

5. `alternate_source_material_shape`
- the spell uses a non-standard canonical source shape and should stay separate from
  normal D&D Beyond-style note handling
- representative example:
  - `arcane-sword`

### Structured -> JSON

This is the follow-through lane after canonical -> structured is squared away.

Current `5`-spell residue:

- `magic-mouth`
- `melfs-acid-arrow`
- `true-seeing`
- `vitriolic-sphere`
- `wall-of-ice`

Current reading by family:

1. `missing_runtime_material_component`
- strongest real drift
- representative example:
  - `vitriolic-sphere`

2. `consumed_state_runtime_drift`
- real gameplay-relevant drift
- representative example:
  - `magic-mouth`

3. `description_runtime_drift`
- material note content differs enough to need spell-by-spell review
- representative example:
  - `melfs-acid-arrow`

4. `model_display_boundary`
- wording differs, but cost/consumed/material facts may already align
- representative examples:
  - `true-seeing`
  - `wall-of-ice`

## Key Mismatch Families

### Canonical -> Structured

1. `canonical_consumed_state_drift`
2. `missing_structured_material_component`
3. `canonical_cost_drift`
4. `canonical_description_drift`
5. `canonical_wording_boundary`
6. `alternate_source_material_shape`

### Structured -> JSON

1. `missing_runtime_material_component`
2. `consumed_state_runtime_drift`
3. `cost_runtime_drift`
4. `description_runtime_drift`
5. `model_display_boundary`

## Execution Plan

### Phase 1: Canonical -> Structured

Work this lane first.

Order:

1. `canonical_consumed_state_drift`
2. `missing_structured_material_component`
3. `canonical_cost_drift`
4. `canonical_description_drift`
5. `alternate_source_material_shape`
6. `canonical_wording_boundary`

Rule:
- after each structured fix, immediately check whether the matching runtime JSON is now
  behind, but do not let the runtime lane drive the bucket before the structured layer
  is corrected

### Phase 2: Structured -> JSON

Work this lane only after the structured side is squared away for the same spell.

Order:

1. `missing_runtime_material_component`
2. `consumed_state_runtime_drift`
3. `cost_runtime_drift`
4. `description_runtime_drift`
5. `model_display_boundary`

## Important Files

Primary docs:

- `F:\Repos\Aralia\docs\tasks\spells\material-component\SPELL_MATERIAL_COMPONENT_BUCKET_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\material-component\SPELL_MATERIAL_COMPONENT_GEMINI_HANDOVER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

Spell gate checker surfaces:

- `F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx`
- `F:\Repos\Aralia\src\components\Glossary\__tests__\Glossary.test.tsx`

Representative spell files:

- `F:\Repos\Aralia\docs\spells\reference\level-4\stoneskin.md`
- `F:\Repos\Aralia\docs\spells\reference\level-5\swift-quiver.md`
- `F:\Repos\Aralia\docs\spells\reference\level-5\raise-dead.md`
- `F:\Repos\Aralia\docs\spells\reference\level-5\reincarnate.md`
- `F:\Repos\Aralia\docs\spells\reference\level-2\magic-mouth.md`
- `F:\Repos\Aralia\docs\spells\reference\level-4\vitriolic-sphere.md`

## Progress Log

- 2026-04-04
  - first material-bucket tracker created while the canonical-side report was still
    being read through an older high-noise snapshot
- 2026-04-10
  - corrected the tracker to the live report state:
    - `11` canonical -> structured
    - `5` structured -> json
  - reoriented the bucket around a canonical-first execution order
  - split the bucket into explicit canonical-side and runtime-side subbuckets
  - prepared a Gemini handoff surface for continued execution

## Remaining Work

- canonical-side file-by-file review and correction on the `11`-spell residue set
- runtime follow-through review on the `5` named JSON lag spells
- possible later parser improvement if the last canonical-side wording/boundary cases
  remain noisy after direct review

## Open Questions / Model Gaps

- Should wording-only canonical note differences be accepted when:
  - material required matches
  - cost matches
  - consumed state matches
- Should alternate-source material-note shapes stay permanently separate from the
  normal canonical-side material lane?
- Does the canonical-side report need one more report-generation pass to expose the
  exact `11`th spell row more directly in the grouped summary, or is the current report
  enough once the direct row set is consulted during execution?
