## Suggestion Conditional-Ending Slice

The Suggestion slice closed one `conditional_ending` row:

- Reused the existing `caster_or_ally_damages_target` conditional-ending trigger.
- Added `suggested_activity_completed` as a new conditional-ending trigger value.
- Updated Suggestion structured markdown with:
  - `Conditional Ending Triggers: caster_or_ally_damages_target, suggested_activity_completed`
  - `Conditional Ending Scope: effect`
- Updated Suggestion runtime JSON with both early-ending rules on the control utility effect and the Charmed status effect.
- Closed `suggestion::conditional_ending` with a `closedReason`.
- Left the widespread legacy `trigger.sustainCost` artifact alone for a separate repeat-pattern pass; this slice only resolved the Suggestion ending row.
- Recorded two process regressions in the Codex Desktop environment-learning file:
  - a broad `sustainCost` search that flooded output.
  - a Markdown-backtick search pattern that broke PowerShell quoting.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1282 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 96 open, 141 closed.

## Blink Conditional-Ending Slice

The Blink slice closed one `conditional_ending` row:

- Added `already_on_destination_plane` as a conditional-ending trigger value.
- Updated Blink structured markdown with:
  - `Conditional Ending Triggers: already_on_destination_plane`
  - `Conditional Ending Scope: spell`
- Updated Blink runtime JSON with an `already_on_destination_plane` conditional ending on the planar shift utility effect.
- Closed `blink::conditional_ending` with a `closedReason`.
- Left `blink::choice_or_mode` open because the end-of-turn roll, planar shift success range, return timing, and return placement still need a broader planar-shift mechanic.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1281 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 95 open, 142 closed.

## Web Conditional-Ending Slice

The Web slice closed one `conditional_ending` row:

- Added `unsupported_area_collapses_next_turn` as a conditional-ending trigger value.
- Updated Web structured markdown with:
  - `Conditional Ending Triggers: unsupported_area_collapses_next_turn`
  - `Conditional Ending Scope: spell`
- Updated Web runtime JSON with an `unsupported_area_collapses_next_turn` conditional ending on the terrain effect.
- Closed `web::conditional_ending` with a `closedReason`.
- Left `web::environmental_change` open because flammable web-cube burn-away state remains a separate environmental mechanic.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1280 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 94 open, 143 closed.

## Fast Friends Conditional-Ending Slice

The Fast Friends slice closed one `conditional_ending` row:

- Added `certain_death_activity_requested` as a conditional-ending trigger value.
- Updated Fast Friends structured markdown with:
  - `Conditional Ending Triggers: certain_death_activity_requested`
  - `Conditional Ending Scope: spell`
- Updated Fast Friends runtime JSON with a `certain_death_activity_requested` conditional ending on the Charmed status effect.
- Closed `fast-friends::conditional_ending` with a `closedReason`.
- Left `fast-friends::aftermath_or_memory` open because the target knowing it was Charmed remains a separate aftermath-awareness mechanic.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1279 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 93 open, 144 closed.

## Hypnotic Pattern Break-Trigger Slice

The Hypnotic Pattern slice closed one `conditional_ending` row by reusing existing status break-trigger fields:

- Updated Hypnotic Pattern structured markdown with:
  - `Condition Break Triggers: target_takes_damage, adjacent_creature_action_shakes_awake`
- Updated Hypnotic Pattern runtime JSON so both the Charmed and Incapacitated status effects carry:
  - `target_takes_damage`
  - `adjacent_creature_action_shakes_awake`
- Closed `hypnotic-pattern::conditional_ending` with a `closedReason`.
- Left `hypnotic-pattern::status_or_state_change` open because Speed 0 remains a separate non-condition state mechanic.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript files.
- Actionable index: 1278 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 92 open, 145 closed.

## Charm Monster Conditional-Ending Slice

The Charm Monster slice closed one `conditional_ending` row by reusing the existing caster/allied damage trigger:

- Confirmed Charm Monster structured markdown already records:
  - `Conditional Ending Triggers: caster_or_ally_damages_target`
  - `Conditional Ending Scope: effect`
- Confirmed Charm Monster runtime JSON already has a matching `conditionalEndings` entry on the Charmed status effect.
- Closed `charm-monster::conditional_ending` with a `closedReason`.
- Left `charm-monster::aftermath_or_memory` open because the target's post-spell awareness remains a separate aftermath/memory mechanic.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript files.
- Actionable index: 1277 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 91 open, 146 closed.
- File-ballooning checkpoint: active handoff/history/script/schema files remain below the current review threshold; the largest schema shard is `20-effect-payloads.json` at about 933 lines, and no schema edit was made in this slice.

## Calm Emotions Conditional-Ending And Type Modularization Slice

The Calm Emotions slice closed one `conditional_ending` row and performed a between-batch type modularization checkpoint:

- Added `target_takes_damage_or_witnesses_allies_damaged` as a conditional-ending trigger value.
- Updated Calm Emotions structured markdown with:
  - `Conditional Ending Triggers: target_takes_damage_or_witnesses_allies_damaged`
  - `Conditional Ending Scope: effect`
- Updated Calm Emotions runtime JSON so the indifference utility effect carries the matching `conditionalEndings` entry.
- Closed `calm-emotions::conditional_ending` with a `closedReason`.
- Left `calm-emotions::aftermath_or_memory` open because attitude restoration remains a separate aftermath/restoration mechanic.
- Modularized `src/types/spells.ts` after the shared vocabulary edit kept it above the 1000-line watch threshold:
  - Moved conditional-ending lifecycle vocabulary to `src/types/spellLifecycleMetadata.ts`.
  - Moved higher-level scaling types to `src/types/spellScalingMetadata.ts`.
  - Moved AI arbitration metadata to `src/types/spellArbitrationMetadata.ts`.
  - Moved small core spell metadata types to `src/types/spellCoreMetadata.ts`.
  - Preserved the `src/types/spells.ts` re-export surface for callers.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellScalingMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellArbitrationMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellCoreMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync and check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed after the mechanics edit and again after the type splits.
- Dependency sync: `src/types/spellLifecycleMetadata.ts`, `src/types/spellScalingMetadata.ts`, `src/types/spellArbitrationMetadata.ts`, `src/types/spellCoreMetadata.ts`, `src/types/spells.ts`, and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1276 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 90 open, 147 closed.
- File-ballooning checkpoint: `src/types/spells.ts` is now about 997 lines; the new metadata modules are small and focused.

## Cordon Of Arrows Conditional-Ending Slice

The Cordon of Arrows slice closed one `conditional_ending` row:

- Added `all_target_instances_expended` as a conditional-ending trigger value for limited spell instances, charges, planted objects, or created attack payloads being spent.
- Updated Cordon of Arrows structured markdown with:
  - `Conditional Ending Triggers: all_target_instances_expended`
  - `Conditional Ending Scope: spell`
- Updated Cordon of Arrows runtime JSON so the damage effect carries a matching `conditionalEndings` entry for the spell ending when no planted ammunition remains.
- Closed `cordon-of-arrows::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync and check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1275 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 89 open, 148 closed.
- File-ballooning checkpoint: `spells.ts` remains about 997 lines, `spellValidator.ts` about 947 lines, the edited structured template shard about 469 lines, and no additional split was required for this slice.

## Mirror Image Conditional-Ending Slice

The Mirror Image slice closed one `conditional_ending` row by reusing the limited-instance ending trigger:

- Updated Mirror Image structured markdown with:
  - `Conditional Ending Triggers: all_target_instances_expended`
  - `Conditional Ending Scope: spell`
- Updated Mirror Image runtime JSON so the utility effect carries a matching `conditionalEndings` entry for the spell ending when all three duplicates are destroyed.
- Closed `mirror-image::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1274 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 88 open, 149 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Bigby's Hand Conditional-Ending Slice

The Bigby's Hand slice closed one `conditional_ending` row by reusing the created-entity 0-HP trigger:

- Updated Bigby's Hand structured markdown with:
  - `Conditional Ending Triggers: created_entity_drops_to_0_hp`
  - `Conditional Ending Scope: spell`
- Updated Bigby's Hand runtime JSON so the utility effect carries a matching `conditionalEndings` entry for the spell ending when the created hand object drops to 0 Hit Points.
- Closed `bigbys-hand::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1273 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 87 open, 150 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Giant Insect Conditional-Ending Slice

The Giant Insect slice closed one `conditional_ending` row by reusing the created-entity 0-HP trigger:

- Updated Giant Insect structured markdown with:
  - `Conditional Ending Triggers: created_entity_drops_to_0_hp`
  - `Conditional Ending Scope: effect`
- Updated Giant Insect runtime JSON so the utility effect carries a matching `conditionalEndings` entry for the summoned creature disappearing at 0 Hit Points.
- Closed `giant-insect::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1272 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 86 open, 151 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Tiny Servant Conditional-Ending Slice

The Tiny Servant slice closed two `conditional_ending` rows for the same underlying 0-HP ending:

- Updated Tiny Servant structured markdown with:
  - `Conditional Ending Triggers: created_entity_drops_to_0_hp`
  - `Conditional Ending Scope: effect`
- Updated Tiny Servant runtime JSON so the utility effect carries a matching `conditionalEndings` entry for the servant form ending at 0 Hit Points and reverting to the original object form.
- Closed the detailed `tiny-servant::conditional_ending` row in `level-3-40-59-00-11.json` with a `closedReason`.
- Closed the duplicate residual `tiny-servant::conditional_ending` row in `level-3-residual-08.json` with a `closedReason` that points back to the detailed closure.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1270 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 84 open, 153 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Motivational Speech Conditional-Ending Slice

The Motivational Speech slice closed two `conditional_ending` rows for the same underlying per-target Temporary Hit Points depletion ending:

- Updated Motivational Speech structured markdown with:
  - `Conditional Ending Triggers: temporary_hit_points_depleted`
  - `Conditional Ending Scope: effect`
- Updated Motivational Speech runtime JSON so the utility effect carries a matching `conditionalEndings` entry for the effect ending for a creature when that creature loses the Temporary Hit Points granted by the spell.
- Closed the detailed `motivational-speech::conditional_ending` row in `level-3-40-59-00-01.json` with a `closedReason`.
- Closed the duplicate residual `motivational-speech::conditional_ending` row in `level-3-residual-04.json` with a `closedReason` that points back to the detailed closure.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1268 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 82 open, 155 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Animate Objects Conditional-Ending Slice

The Animate Objects slice closed one `conditional_ending` row by reusing the created-entity 0-HP trigger:

- Updated Animate Objects structured markdown with:
  - `Conditional Ending Triggers: created_entity_drops_to_0_hp`
  - `Conditional Ending Scope: effect`
- Updated Animate Objects runtime JSON so the utility effect carries a matching `conditionalEndings` entry for control ending when an animated object is reduced to 0 Hit Points, including object reversion and damage carryover in the ending description.
- Closed `animate-objects::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1267 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 81 open, 156 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Crown Of Stars Conditional-Ending Slice

The Crown of Stars slice closed one `conditional_ending` row by reusing the finite-instance depletion trigger:

- Updated Crown of Stars structured markdown with:
  - `Conditional Ending Triggers: all_target_instances_expended`
  - `Conditional Ending Scope: spell`
- Updated Crown of Stars runtime JSON so both the damage mote effect and the orbiting-light utility effect carry matching spell-scoped `conditionalEndings`.
- Closed `crown-of-stars::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1266 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 80 open, 157 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required for this data-only slice.

## Mass Suggestion Conditional-Ending Slice

The Mass Suggestion slice closed one `conditional_ending` row by reusing the existing damage-break and activity-completion triggers:

- Updated Mass Suggestion structured markdown with:
  - `Conditional Ending Triggers: caster_or_ally_damages_target, suggested_activity_completed`
  - `Conditional Ending Scope: effect`
- Updated Mass Suggestion runtime JSON so both the Charmed status effect and the suggestion utility effect carry matching per-target `conditionalEndings`.
- Closed `mass-suggestion::conditional_ending` with a `closedReason`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1265 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 79 open, 158 closed.
- File-ballooning checkpoint: `MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md` crossed the review-size threshold after this entry, so the Suggestion-through-Mass-Suggestion run was split into this new `MECHANICS_CLOSURE_BATCH_HISTORY_PART_04.md`; handoff, override, spell data, and core TypeScript files remain reviewable for this data-only slice.

## Hypnotic Pattern Conditional-Ending Report-Only Closure

The Hypnotic Pattern closure resolved one stale detailed `conditional_ending` row without changing spell data:

- Verified the structured markdown already has `Condition Break Triggers: target_takes_damage, adjacent_creature_action_shakes_awake`.
- Verified the runtime JSON already stores `target_takes_damage` and `adjacent_creature_action_shakes_awake` in `statusCondition.breakTriggers` on the status effects.
- Closed the detailed `hypnotic-pattern::conditional_ending` row in `level-3-20-39-00-00-04.json` with a `closedReason`.
- Left the residual duplicate row in `level-3-residual-01.json` closed.
- No schema, template, spell JSON, spell markdown, or TypeScript source change was needed because the mechanic was already represented by the condition-break fields.

Validation evidence:

```powershell
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this closure touched no shared TypeScript source.
- Actionable index: 1264 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 78 open, 159 closed.
- File-ballooning checkpoint: active handoff/history/manual-review and core TypeScript files remain below the current review threshold; no split was required after this report-only closure.

## Incite Greed Conditional-Ending Slice

The Incite Greed slice closed two `conditional_ending` rows by adding a more precise harmful-action ending trigger:

- Added `caster_or_companion_harms_target` to the conditional-ending trigger vocabulary instead of flattening the canonical "do anything harmful" wording into damage-only behavior.
- Updated the structured template shard and regenerated the aggregate templates.
- Updated Incite Greed structured markdown with:
  - `Conditional Ending Triggers: caster_or_companion_harms_target, repeat_save_success`
  - `Conditional Ending Scope: effect`
- Updated Incite Greed runtime JSON with effect-scoped `conditionalEndings` for harmful action by the caster/companions and for a successful repeat Wisdom save.
- Closed the detailed `incite-greed::conditional_ending` row and the residual duplicate with `closedReason` entries.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1262 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 76 open, 161 closed.
- File-ballooning checkpoint: active handoff/history/manual-review, template shard, vocabulary, and core TypeScript files remain below the current review threshold; no split was required after this narrow vocabulary slice.

## Gaseous Form Conditional-Ending Slice

The Gaseous Form slice closed two `conditional_ending` rows by adding target-specific ending triggers:

- Added `target_drops_to_0_hp` and `target_uses_magic_action_to_end_effect` to the conditional-ending trigger vocabulary.
- Updated the structured template shard and regenerated the aggregate templates.
- Updated Gaseous Form structured markdown with:
  - `Conditional Ending Triggers: target_drops_to_0_hp, target_uses_magic_action_to_end_effect`
  - `Conditional Ending Scope: effect`
- Updated Gaseous Form runtime JSON so the physical-resistance, Prone-immunity, and mist-form utility effects all carry matching effect-scoped `conditionalEndings`.
- Closed the detailed `gaseous-form::conditional_ending` row and the residual duplicate with `closedReason` entries.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1260 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 74 open, 163 closed.
- File-ballooning checkpoint: active handoff/history/manual-review, template shard, vocabulary, and core TypeScript files remain below the current review threshold; no split was required after this narrow vocabulary slice.

## Phantom Steed Conditional-Ending Slice

The Phantom Steed slice closed two `conditional_ending` rows by isolating the early-ending trigger from the separate post-end aftermath mechanic:

- Added `created_entity_takes_damage` to the conditional-ending trigger vocabulary.
- Updated the structured template shard and regenerated the aggregate templates.
- Updated Phantom Steed structured markdown with:
  - `Conditional Ending Triggers: created_entity_takes_damage`
  - `Conditional Ending Scope: spell`
- Updated Phantom Steed runtime JSON with a spell-scoped `conditionalEndings` entry on the steed utility effect.
- Preserved the canonical one-minute fade/dismount grace in the runtime description, but left that mechanic open under `phantom-steed::aftermath_or_memory`.
- Closed the detailed `phantom-steed::conditional_ending` row and the residual duplicate with `closedReason` entries.
- Recorded a PowerShell alternation process regression in `codex-desktop-terminal.md` because a pipe-separated `rg` pattern was repeated during this slice.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1258 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 72 open, 165 closed.
- File-ballooning checkpoint: active handoff/history/manual-review, template shard, vocabulary, environment-learning file, and core TypeScript files remain below the current review threshold; no split was required after this narrow vocabulary slice.

## Polymorph Conditional-Ending Slice

The Polymorph slice closed one `conditional_ending` row by reusing the existing Temporary Hit Point depletion trigger:

- Updated Polymorph structured markdown with:
  - `Conditional Ending Triggers: temporary_hit_points_depleted`
  - `Conditional Ending Scope: effect`
- Updated Polymorph runtime JSON with an effect-scoped `conditionalEndings` entry on the transformation utility effect.
- Closed `polymorph::conditional_ending` with a `closedReason`.
- Left the Temporary Hit Point formula, Beast stat replacement, and transformation restrictions open in their existing dedicated buckets.
- Recorded a PowerShell native-glob process regression in `codex-desktop-terminal.md` because a direct `rg` path argument used `level-4*`.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1257 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 71 open, 166 closed.
- File-ballooning checkpoint: active handoff/history/environment-learning files remain below the current review threshold; `level-4-20-39.json` is now a watch item at about 769 lines.

## Awaken Conditional-Ending Slice

The Awaken slice closed one `conditional_ending` row by reusing the existing caster/allied damage break trigger:

- Updated Awaken structured markdown with:
  - `Conditional Ending Triggers: caster_or_ally_damages_target`
  - `Conditional Ending Scope: effect`
- Updated Awaken runtime JSON with an effect-scoped `conditionalEndings` entry on the Charmed status effect.
- Closed `awaken::conditional_ending` with a `closedReason`.
- Left the Intelligence gain, language gain, plant transformation, and post-Charmed attitude choice open in their existing dedicated buckets.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency-header sync was needed because this slice touched no shared TypeScript source.
- Actionable index: 1256 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 70 open, 167 closed.
- File-ballooning checkpoint: active handoff/history and the level-5 manual-review shard remain below the current review threshold; no split was required after this data-only slice.

## Mordenkainen's Faithful Hound Conditional-Ending Slice

The Mordenkainen's Faithful Hound slice closed one `conditional_ending` row by making leash-style ending distances first-class:

- Reused `beyond_max_distance` as the conditional-ending trigger.
- Added `Conditional Ending Distance Feet` to the structured template and runtime template mapping.
- Updated Mordenkainen's Faithful Hound structured markdown with:
  - `Conditional Ending Triggers: beyond_max_distance`
  - `Conditional Ending Scope: spell`
  - `Conditional Ending Distance Feet: 300`
- Updated Mordenkainen's Faithful Hound runtime JSON with a spell-scoped `conditionalEndings` entry carrying `distanceFeet: 300`.
- Closed `mordenkainens-faithful-hound::conditional_ending` with a `closedReason`.
- Left the hound's Magic action movement, invisibility/sound/truesight alarm behavior, and intangible/invulnerable created-entity semantics open in their existing buckets.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1255 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 69 open, 168 closed.
- File-ballooning checkpoint: active handoff/history and template shards remain below the current split threshold; `level-4-20-39.json` remains a watch item at about 770 lines, and `spellValidator.ts` remains a watch item at about 952 lines.

## Validator Lifecycle-Schema Modularization Checkpoint

This checkpoint reduced future lifecycle-edit pressure before continuing to additional conditional-ending rows:

- Moved the `ConditionalEnding` Zod validator from `spellValidator.ts` into `effectLifecycleSchemas.ts`.
- Kept the same trigger vocabulary, scope vocabulary, optional `distanceFeet`, and optional description validation.
- Left `spellValidator.ts` importing `ConditionalEnding` from the lifecycle schema module, matching the existing `EffectEndCleanup` and `SustainRequirement` pattern.
- Reduced `spellValidator.ts` from about 952 lines to about 907 lines.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectLifecycleSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Dependency sync: `src/systems/spells/validation/effectLifecycleSchemas.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Typecheck: passed.

## Otiluke's Resilient Sphere Conditional-Ending Slice

The Otiluke's Resilient Sphere slice closed one `conditional_ending` row by adding a narrow Disintegrate destruction trigger:

- Added `disintegrate_targets_effect` to the conditional-ending trigger vocabulary.
- Updated Otiluke's Resilient Sphere structured markdown with:
  - `Conditional Ending Triggers: disintegrate_targets_effect`
  - `Conditional Ending Scope: spell`
- Updated Otiluke's Resilient Sphere runtime JSON with spell-scoped `conditionalEndings` data on both the utility barrier effect and the defensive sphere-immunity effect.
- Closed `otilukes-resilient-sphere::conditional_ending` with a `closedReason`.
- Preserved the already closed barrier damage-prevention row as the owner of inside/outside damage blocking semantics.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
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
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1254 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 68 open, 169 closed.
- File-ballooning checkpoint: active handoff/history and template shards remain below the current split threshold; `level-4-20-39.json` remains a watch item at about 771 lines.

## Duration-Scaling Batch 01

This batch closed four `conditional_ending` rows by reusing the existing structured scaling-rule and runtime `higherLevelScaling` surfaces instead of adding a new one-off duration schema:

- Hex now uses a structured `slot_level_table` for maximum concentration duration and runtime `higherLevelScaling` entries for slots 2, 3-4, and 5+.
- Magic Circle now uses a structured `slot_level_bonus` for duration and runtime `higherLevelScaling` for +1 hour per slot above 3.
- Bestow Curse now uses a structured `slot_level_table` for duration/concentration overrides and runtime `higherLevelScaling` entries for slots 4, 5-6, 7-8, and 9.
- Major Image now uses a structured `slot_level_table` for its level 4+ no-concentration, until-dispelled duration override.
- Closed:
  - `hex::manual_slot_scaled_concentration_duration`
  - `magic-circle::manual_slot_duration_scaling`
  - `bestow-curse::manual_slot_duration_concentration_scaling`
  - `major-image::manual_slot_duration_concentration_override`
- Left Hunter's Mark open because its row also includes unresolved target-transfer mechanics.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\validateSpellTemplateContracts.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- No dependency sync was needed because this batch touched no shared TypeScript source.
- Actionable index: 1250 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 64 open, 173 closed.
- File-ballooning checkpoint: active handoff/history, the conditional-ending batch plan, and touched manual-review shards remain below the current split threshold.
