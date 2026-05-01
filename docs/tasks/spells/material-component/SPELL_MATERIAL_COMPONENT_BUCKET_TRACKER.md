# Spell Material Component Bucket Tracker

Last Updated: 2026-04-29

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
  - `0` grouped `Material Component` mismatches in `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current reading: resolved
- structured -> json:
  - `0` grouped `Material Component` mismatches in `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: resolved
- glossary gate checker:
  - `Material Component Review`: implemented
  - `Material Component Runtime Review`: implemented

## Current Interpretation

### Canonical -> Structured

This lane is now closed.

The old high-noise `220`-spell snapshot and the later `7`-spell snapshot are both
resolved. The final 2026-04-29 pass:

- corrected real material facts where the structured layer was behind canonical
- taught the canonical audit to compare material facts instead of raw footnote wrappers
- closed the grouped canonical-side `Material Component` bucket to `0`

Resolved family outcomes:

1. `raw_note_shape_residue`
- resolved
- wrapper-only differences now compare as material facts

2. `alternate_source_material_shape`
- resolved
- `arcane-sword` remains an alternate-source example, but no longer produces live
  `Material Component` residue

3. `true_content_drift_on_demand`
- resolved for the reviewed set
- real corrections landed for ingredient, cost, and consumed-state mismatches found
  during the pass

### Structured -> JSON

This lane is now closed.

Runtime spell JSON now matches the reviewed structured material facts for this bucket.

Resolved family outcomes:

1. `missing_runtime_material_component`
- resolved
- missing runtime material notes were backfilled

2. `model_display_boundary`
- resolved
- runtime wording was aligned to the reviewed structured layer where needed

3. `true_runtime_drift_on_demand`
- no live cases remain

## Key Mismatch Families

### Canonical -> Structured

1. `raw_note_shape_residue` - resolved
2. `alternate_source_material_shape` - resolved
3. `true_content_drift_on_demand` - resolved for the reviewed set

### Structured -> JSON

1. `missing_runtime_material_component` - resolved
2. `model_display_boundary` - resolved
3. `true_runtime_drift_on_demand` - no live cases

## Execution Plan

### Phase 1: Canonical -> Structured

This lane is closed.

No further canonical-side `Material Component` work is queued unless a future audit
reintroduces this bucket.

### Phase 2: Structured -> JSON

This lane is closed.

## Important Files

Primary docs:

- `F:\Repos\Aralia\docs\tasks\spells\material-component\SPELL_MATERIAL_COMPONENT_BUCKET_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

Spell gate checker surfaces:

- `F:\Repos\Aralia\src\components\Glossary\spellGateChecker\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\spellGateChecker\SpellGateBucketSections.tsx`
- `F:\Repos\Aralia\src\components\Glossary\spellGateChecker\__tests__\SpellGateChecksPanel.test.tsx`
- `F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx`
- `F:\Repos\Aralia\src\components\Glossary\__tests__\Glossary.test.tsx`

Representative spell files:

- `F:\Repos\Aralia\docs\spells\reference\level-4\divination.md`
- `F:\Repos\Aralia\docs\spells\reference\level-1\feather-fall.md`
- `F:\Repos\Aralia\docs\spells\reference\level-5\raise-dead.md`
- `F:\Repos\Aralia\docs\spells\reference\level-5\reincarnate.md`
- `F:\Repos\Aralia\docs\spells\reference\level-6\soul-cage.md`
- `F:\Repos\Aralia\docs\spells\reference\level-4\stoneskin.md`
- `F:\Repos\Aralia\docs\spells\reference\level-7\arcane-sword.md`
- `F:\Repos\Aralia\public\data\spells\level-6\true-seeing.json`
- `F:\Repos\Aralia\public\data\spells\level-6\wall-of-ice.json`

## Progress Log

- 2026-04-04
  - first material-bucket tracker created while the canonical-side report was still
    being read through an older high-noise snapshot
- 2026-04-10
  - reoriented the bucket around a canonical-first execution order
  - split the bucket into explicit canonical-side and runtime-side subbuckets
- 2026-04-25
  - refreshed the tracker against the current live reports:
    - `7` canonical -> structured
    - `7` structured -> json
  - corrected the canonical side away from invented copy-work and toward the real live
  issue:
    - raw canonical note formatting vs already-present structured ingredient facts
  - updated the runtime lane to the current `missing-json-field` set from the live report
- 2026-04-27
  - synced the Atlas v2 execution map to the live `7 / 7` material-bucket state
  - added numeric subbucket counts, edge-case baseline snapshots, and representative
    spell rosters to the Atlas map so the Dashboard and execution view no longer lag the tracker
- 2026-04-29
  - closed canonical -> structured `Material Component` residue to `0`
  - closed structured -> json `Material Component` residue to `0`
  - corrected material facts in structured markdown and runtime JSON where the reviewed
    canonical note showed real ingredient, cost, or consumed-state drift
  - updated the two material audits so they compare split material facts instead of raw
    source-wrapper strings

## Remaining Work

- no active `Material Component` bucket work remains
- future work should only reopen this bucket if a later audit produces new material-note
  mismatches

## Open Questions / Model Gaps

- `legend-lore` keeps the current validator convention for `Material Cost GP`: the field
  stores the sum of written price numbers (`250 + 50 = 300`) rather than quantity-expanding
  "four ivory strips worth 50 GP each" to `450`.
- This is now documented behavior, not an active mismatch.
