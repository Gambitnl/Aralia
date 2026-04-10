# Gemini Handover: Material Component Bucket

Last Updated: 2026-04-10

## Mission

Own the `Material Component` bucket in the Aralia spell-truth lane.

Primary goal:
- square away `canonical -> structured` first

Secondary goal:
- after each structured fix, check whether the matching runtime spell JSON is now
  behind and needs the same change carried into `structured -> json`

Do not treat the runtime lane as the primary driver for this bucket.

## Current Live State

Canonical -> structured:
- `11` mismatches
- source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`

Structured -> json:
- `5` mismatches
- source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

## Required Files

Read and keep updated:

- `F:\Repos\Aralia\AGENTS.md`
- `F:\Repos\Aralia\.agent\workflows\USER.local.md`
- `F:\Repos\Aralia\docs\tasks\spells\material-component\SPELL_MATERIAL_COMPONENT_BUCKET_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

If you touch the spell gate checker, also use:

- `F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx`
- `F:\Repos\Aralia\src\components\Glossary\__tests__\Glossary.test.tsx`

## Canonical-First Subbuckets

Work these first:

1. `canonical_consumed_state_drift`
2. `missing_structured_material_component`
3. `canonical_cost_drift`
4. `canonical_description_drift`
5. `alternate_source_material_shape`
6. `canonical_wording_boundary`

## Runtime Follow-Through Subbuckets

Only after the same spell is squared away in the structured layer:

1. `missing_runtime_material_component`
2. `consumed_state_runtime_drift`
3. `cost_runtime_drift`
4. `description_runtime_drift`
5. `model_display_boundary`

## Known Live Spell Sets

### Canonical -> Structured representative set

Current report examples:

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

Use the report row set, not only the sample list, when executing the full bucket.

### Structured -> JSON full set

- `magic-mouth`
- `melfs-acid-arrow`
- `true-seeing`
- `vitriolic-sphere`
- `wall-of-ice`

## Recommended Execution Order

1. Read the tracker doc first.
2. Pull the live canonical-side row set from the report.
3. Work the canonical-side spells file-by-file.
4. After each structured fix:
   - check the matching spell JSON
   - if runtime JSON is now behind, update the runtime side too
5. Keep the shared spell-truth docs updated as the bucket changes.

## Current Bucket Reading

What is likely real drift:

- canonical consumed-state differences
- canonical cost differences
- missing structured material note when canonical has one
- runtime JSON missing a material note entirely
- runtime JSON disagreeing on consumed state

What is often boundary/residue:

- wording-only material note differences
- richer runtime explanatory notes that preserve the same facts
- alternate-source raw note shape

## Representative Pilot Spells

Good canonical-side pilots:

- `stoneskin`
  - canonical note adds consumed-state meaning
- `summon-greater-demon`
  - canonical note exists but structured note is missing
- `divination`
  - note-content wording drift

Good runtime-side pilots:

- `magic-mouth`
  - likely consumed-state runtime drift
- `vitriolic-sphere`
  - missing runtime material note
- `true-seeing`
  - likely wording/model-boundary case

## Documentation Rule

Do not create a parallel planning system outside the spell task docs.

When you learn something:

1. update `SPELL_MATERIAL_COMPONENT_BUCKET_TRACKER.md`
2. update `SPELL_DATA_VALIDATION_PLAN.md` if the bucket status changes
3. update `SPELL_CANONICAL_SYNC_TRACKER.md` if counts/state change
4. update `SPELL_CANONICAL_SYNC_FLAGS.md` only for true residue / boundary / model-gap findings

## If You Edit Code

Follow the repo code-commentary standard.

If you modify exported signatures, hooks, utils, or state files, run:

`npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync <path>`

## Success Condition

This bucket is in a good state when:

- the canonical-side `11`-spell residue is worked down file-by-file
- the runtime `5`-spell residue is either fixed or explicitly classified
- the shared docs say clearly what remains:
  - real drift
  - normalized difference
  - source-shape residue
  - model gap
