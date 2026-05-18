# Spell Mechanics Closure Batch History Part 05

Status: archived completed-batch detail
Last updated: 2026-05-14

This file continues completed-batch detail split out of `MECHANICS_CLOSURE_HANDOFF.md` and the oversized Part 04 history shard during the between-batch modularization checkpoint.

## HigherLevelScaling JSON Schema Alignment Checkpoint

This checkpoint closed a schema-alignment gap after duration-scaling batch 01 began populating runtime `higherLevelScaling` data:

- Added `higherLevelScaling` to `src/systems/spells/schema/parts/00-schema-root.json`.
- Added a `HigherLevelScaling` definition to `src/systems/spells/schema/parts/30-lifecycle-protection-and-appearance.json`.
- Regenerated the stable aggregate `src/systems/spells/schema/spell.schema.json`.
- Verified the aggregate semantically matches all 5 schema parts.

Validation evidence:

```powershell
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
```

Results:

- Schema aggregate semantically matches 5 parts.
- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.

## End-Cleanup Consequence Batch 01

This batch closed a small spell-end fall-consequence family shared by Fly and Investiture of Wind:

- Extended `EffectEndCleanup` with:
  - `removes: spell_granted_flying_speed`
  - optional `consequence: fall_if_aloft`
  - optional `preventedBy: can_prevent_fall`
- Updated the structured and runtime templates with machine-readable comments for `End Cleanup Consequence` and `End Cleanup Prevented By`.
- Updated the split JSON Schema and regenerated the aggregate schema.
- Updated Fly structured markdown and runtime JSON so the target falls if still aloft when spell-granted flight ends unless it can prevent the fall.
- Updated Investiture of Wind structured markdown and runtime JSON so the caster falls if still flying when the spell-granted flight ends unless another effect prevents the fall.
- Closed:
  - `fly::conditional_ending`
  - `fly::aftermath_or_memory`
  - `investiture-of-wind::conditional_ending`
  - `investiture-of-wind::aftermath_or_memory`
- Recorded a Codex Desktop process regression because the known nested-`foreach` PowerShell pipe issue repeated during regenerated count inspection.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectLifecycleSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1242 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 58 open, 179 closed.
- `aftermath_or_memory`: 56 total findings, 26 open, 30 closed.
- File-ballooning checkpoint: touched source and template shards remain below the current review threshold; `30-lifecycle-protection-and-appearance.json` is about 815 lines, `26-30-effects-ending-fall-cleanup.json` is about 538 lines, `08-31-effects-death-cleanup-granted-actions.json` is about 494 lines, and the active handoff/history files remain below the split threshold.

## End-Cleanup Contents Ejection Batch 01

This batch closed the simple spell-created-space dropout shape for Rope Trick:

- Extended `EffectEndCleanup` with:
  - `removes: extradimensional_space`
  - `scope: contents`
  - `consequence: contents_drop_out`
  - optional `destination: space_exit_anchor`
- Updated the structured and runtime templates with machine-readable comments for `End Cleanup Destination`.
- Updated the split JSON Schema and regenerated the aggregate schema.
- Updated Rope Trick structured markdown and runtime JSON so contents inside the extradimensional space drop out at the space exit/anchor when the spell ends.
- Closed:
  - `rope-trick::conditional_ending`
  - `rope-trick::aftermath_or_memory`
- Left Passwall, Watery Sphere, and similar ejection/placement rows open because their findings bundle additional mechanics outside this narrow cleanup shape.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectLifecycleSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1240 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 57 open, 180 closed.
- `aftermath_or_memory`: 56 total findings, 25 open, 31 closed.
- File-ballooning checkpoint: touched source and template shards remain below the current review threshold; `30-lifecycle-protection-and-appearance.json` is about 825 lines, `26-30-effects-ending-fall-cleanup.json` is about 568 lines, `08-31-effects-death-cleanup-granted-actions.json` is about 522 lines, and the active handoff/history files remain below the split threshold.

## Subfamily Classification Process Checkpoint

This checkpoint updated the closure process to choose future batches by precise shared mechanic shape before editing spell data:

- Added `scripts/classifyMechanicsClosureSubfamilies.ts`.
- Generated `MECHANICS_SUBFAMILY_CLASSIFICATION.md/json` for all 1240 open actionable findings.
- Generated `MECHANICS_SUBFAMILY_CLASSIFICATION-conditional-aftermath.md/json` for the 82 open `conditional_ending` and `aftermath_or_memory` findings.
- Updated the handoff goal text, primary report map, next-safe-action guidance, and modularization watch to point to the new planning reports.
- Kept this checkpoint read-only with respect to spell mechanics data: no spell rows were closed and no templates/schema/spell JSON mechanics were changed by the classifier.

Verification evidence:

```powershell
npx tsx scripts\classifyMechanicsClosureSubfamilies.ts
npx tsx scripts\classifyMechanicsClosureSubfamilies.ts --buckets=conditional_ending,aftermath_or_memory --output-suffix=conditional-aftermath
npm run typecheck
```

Results:

- All-open classification: 1240 open findings grouped into 15 candidate subfamilies.
- Focused conditional/aftermath classification: 82 open findings grouped into 14 candidate subfamilies.
- Typecheck: passed.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- File-ballooning checkpoint: the edited schema part files remain below the current split threshold; `spell.schema.json` is generated and should continue to be updated from parts.

## Duration-Progression Batch 01

This batch added a reusable duration-progression mechanic for duration and permanence rules that are not ordinary higher-level scaling:

- Added `durationProgression` to the runtime spell type, validator, split JSON Schema, runtime template, structured template labels, and strict runtime-template vocabulary.
- Added `src/types/spellDurationMetadata.ts` for duration-progression TypeScript contracts.
- Added `src/systems/spells/validation/durationProgressionSchemas.ts` for the matching Zod contracts.
- Updated Nystul's Magic Aura with a 30-day same-target repeated-cast permanence rule.
- Updated Mordenkainen's Private Sanctum with a 365-day same-location repeated-cast permanence rule.
- Updated Wall of Stone with a full-concentration permanent-wall rule.
- Updated Temple of the Gods with a 365-day same-location permanence rule and a Disintegrate destruction conditional ending.
- Closed:
  - `nystuls-magic-aura::manual_daily_casting_permanence`
  - `mordenkainens-private-sanctum::conditional_ending`
  - `wall-of-stone::conditional_ending`
  - `temple-of-the-gods::conditional_ending`
- Left `galders-tower::manual_recast_maintenance_and_permanent_tower` open because it needs two duration-progression rules in one spell, and the structured markdown fields currently express only one rule cleanly.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellDurationMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\durationProgressionSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1246 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 60 open, 177 closed.

## Spell Core Metadata Modularization Checkpoint

This between-batch modularization checkpoint reduced the main spell type file before another broad schema batch:

- Moved spell-school metadata out of `src/types/spells.ts` and into `src/types/spellCoreMetadata.ts`.
- Kept the public re-export surface stable from `src/types/spells.ts`.
- Reduced `src/types/spells.ts` to about 957 lines.
- Left `src/types/spellCoreMetadata.ts` at about 92 lines.

Validation evidence:

```powershell
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellCoreMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npm run typecheck
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
```

Results:

- Typecheck: passed.
- Spell JSON validation: 459 valid, 0 invalid.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.

## External Destruction Or Dispel Refinement Checkpoint

This checkpoint did not close spell rows. It narrowed a broad classifier group before another mechanics batch, because the shared words "destruction" and "dispel" covered several different runtime shapes:

- Added `docs/tasks/spells/mechanics-discovery/refinements/EXTERNAL_DESTRUCTION_OR_DISPEL_REFINEMENT.md`.
- Split the classifier group into:
  - dispel resolution model
  - glyph movement or trigger lifetime
  - spell-linked object destruction or use count
  - created object cleanup at spell end
  - complex multi-effect lifecycle
  - custom or arbitration-aware ending
- Updated the handoff to point the next batch at the narrow `glyph-of-warding::conditional_ending` and `symbol::conditional_ending` glyph-placement/trigger-lifetime shape.
- Kept the dispel, Druid Grove, Sequester, spell-linked object, and created-object cleanup rows out of that next batch so they can be modeled with the correct corpus-level shape later.

Verification evidence:

```powershell
Select-String -Path 'docs\tasks\spells\mechanics-discovery\MECHANICS_CLOSURE_HANDOFF.md' -Pattern 'EXTERNAL_DESTRUCTION_OR_DISPEL_REFINEMENT|Glyph Movement Or Trigger Lifetime'
Get-Content -Path 'docs\tasks\spells\mechanics-discovery\refinements\EXTERNAL_DESTRUCTION_OR_DISPEL_REFINEMENT.md' -TotalCount 40
```

Results:

- Refinement file exists and names the ten source rows from the classifier output.
- Handoff now points the next safe action at the glyph movement/trigger lifetime batch instead of the full external-destruction group.
- No spell `.md`, spell `.json`, template, schema, or validator mechanics data changed in this checkpoint.

## Glyph Placement/Trigger Lifetime Batch 01

This batch closed the focused glyph-placement subfamily from the external-destruction refinement:

- Added conditional-ending trigger values:
  - `inscribed_ward_moved_beyond_distance`
  - `ward_triggered`
  - `triggered_duration_expires`
- Added optional post-trigger duration fields on `effects[].conditionalEndings[]`:
  - `durationValue`
  - `durationUnit`
- Updated Glyph of Warding structured markdown and runtime JSON with its 10-foot inscribed surface/object movement break and immediate one-shot trigger consumption.
- Updated Symbol structured markdown and runtime JSON with its 10-foot inscribed object movement break and 10-minute triggered active duration before spell end.
- Closed:
  - `glyph-of-warding::conditional_ending`
  - `symbol::conditional_ending`
  - residual duplicate `glyph-of-warding::conditional_ending`
- Kept the other external-destruction refinement rows open because dispel resolution, spell-linked objects, created-object cleanup, Druid Grove, and Sequester require different runtime shapes.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectLifecycleSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1237 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 54 open, 183 closed.

## Damage Metadata Modularization Checkpoint

This between-batch checkpoint reduced the main spell type file before another mechanics batch:

- Moved damage type names, damage type descriptions, and damage type traits out of `src/types/spells.ts` and into `src/types/spellDamageMetadata.ts`.
- Kept the public `spells.ts` re-export surface stable for existing imports of `DamageType`, `DamageTypeDefinitions`, and `DamageTypeTraits`.
- Reduced `src/types/spells.ts` from about 1032 lines to 993 lines.
- Left `src/types/spellDamageMetadata.ts` at 85 lines.

Validation evidence:

```powershell
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellDamageMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npm run typecheck
```

Results:

- Typecheck passed before and after dependency header sync.
- Dependency sync completed for `src/types/spellDamageMetadata.ts` and `src/types/spells.ts`.
- File-ballooning checkpoint: `src/types/spells.ts` is back under 1000 lines; `spellValidator.ts` remains a watch item at about 993 lines.

## Created-Object Cleanup Batch 01

This batch closed the narrow spell-end object cleanup shape for Swift Quiver and Magic Jar:

- Added end-cleanup vocabulary:
  - `created_ammunition`
  - `spell_material_container`
  - `created_objects`
  - `spell_component`
  - `disintegrate`
  - `destroy`
- Updated Swift Quiver structured markdown and runtime JSON so all ammunition created by the spell disintegrates when the spell ends.
- Updated Magic Jar structured markdown and runtime JSON so the spell's material container is destroyed when the spell ends.
- Closed:
  - `swift-quiver::aftermath_or_memory`
  - `magic-jar::aftermath_or_memory`
- Left `swift-quiver::conditional_ending` open but narrowed it to the remaining possession-based ending when the quiver leaves the caster's possession.
- Left Magic Jar's broader soul-return/death/container-destruction ending row open because this batch only closed the on-spell-end container destruction aftermath.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectLifecycleSchemas.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1235 open findings, 24 grouped mechanics families.
- `aftermath_or_memory`: 56 total findings, 23 open, 33 closed.
- File-ballooning checkpoint: `src/types/spells.ts` remains 993 lines after the prior split; `spellValidator.ts` remains a watch item at 993 lines; touched lifecycle type/validator/schema/template shards remain below the split threshold.
