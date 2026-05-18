# Mechanics Closure Batch History Part 03

## Prayer Of Healing Target-Participation Slice

The Prayer of Healing slice closed one `choice_or_mode` row that was actually a long-casting target-participation rule:

- Added `Target Participation Requires Full Casting Range` and `Target Participation Notes` to the structured targeting template.
- Added `targeting.targetParticipation.requiresWithinRangeForFullCasting` and notes to the runtime JSON template.
- Extended runtime targeting typing, Zod validation, JSON Schema, and strict audit vocabulary with `targetParticipation`.
- Updated Prayer of Healing structured markdown with the rule that chosen creatures must remain within 30 feet for the full 10-minute casting.
- Updated Prayer of Healing runtime JSON with `targeting.targetParticipation.requiresWithinRangeForFullCasting: true`.
- Closed `prayer-of-healing::choice_or_mode`.
- Left `prayer-of-healing::healing_or_restoration` open for Short Rest benefits and the once-per-creature-until-Long-Rest lockout.
- Recorded a repeated PowerShell `rg` alternation failure as a process regression in `.agent/rules/environment-learnings/codex-desktop-terminal.md`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 330 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 591 lines before this entry and remains reviewable.
  - `manual-review-overrides/level-2-03.json` is about 369 lines after this closure.
  - `src/types/spellTargeting.ts` is about 326 lines.
  - `src/systems/spells/validation/targetingSchemas.ts` is about 285 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 605 lines.
  - `structured/03-20-targeting-and-geometry.json` is about 563 lines.
  - `runtime-json/04-20-targeting-and-geometry.json` is about 515 lines.
  - No modularization was needed for this narrow targeting addition; the larger watch items remain before broad new field families.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellTargeting.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\targetingSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 19 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spellTargeting.ts` and `src/systems/spells/validation/targetingSchemas.ts` updated successfully.
- Actionable index: 1290 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 128 open, 103 closed, 2 deferred flavor, 1 special question.

## Phantasmal Force Study-Action Escape-Check Slice

The Phantasmal Force slice closed one `conditional_ending` row by reusing the existing Escape Check field family:

- Reused the existing Escape Check structured/runtime template fields instead of adding a new conditional-ending trigger.
- Updated Phantasmal Force structured markdown with Intelligence (Investigation), spell-save-DC, action-cost, and affected-creature eligibility fields.
- Updated Phantasmal Force runtime JSON with `statusCondition.escapeCheck` on the utility/status payload.
- Closed `phantasmal-force::conditional_ending`.
- Left the broader Phantasmal Force illusion rows open for target-only perception, mental representation, rationalization, perceived damage type, and recurring hazard-damage gating.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 329 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 635 lines before this entry and remains reviewable.
  - `manual-review-overrides/level-2-03.json` is about 370 lines after this closure.
  - No modularization was needed for this reuse-only escape-check slice.

Validation evidence:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 19 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1289 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 103 open, 134 closed.

## Phantasmal Killer Save-Success Ending Slice

The Phantasmal Killer slice closed one `conditional_ending` row by adding typed save-success spell-ending triggers:

- Added `initial_save_success` and `repeat_save_success` to Conditional Ending Trigger vocabulary.
- Extended runtime conditional-ending typing, Zod validation, strict audit vocabulary, and the structured template shard with the new trigger values.
- Updated Phantasmal Killer structured markdown with `Conditional Ending Triggers: initial_save_success, repeat_save_success` and `Conditional Ending Scope: spell`.
- Updated Phantasmal Killer runtime JSON with conditional endings on:
  - the initial Wisdom save damage branch, where save success deals half damage and ends the spell
  - the recurring end-of-turn Wisdom save damage branch, where save success ends the spell
- Closed `phantasmal-killer::conditional_ending`.
- Left `phantasmal-killer::attack_or_save_modifier`, `vision_light_sound`, and `illusion_or_disguise` open for the failed-save disadvantage rider and hostile target-only illusion payload.
- Recorded the Codex Desktop process-table warning in `.agent/rules/environment-learnings/codex-desktop-terminal.md`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 326 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 667 lines before this entry and remains reviewable but is nearing the next split threshold.
  - `manual-review-overrides/level-4-20-39.json` is about 767 lines after this closure and remains reviewable.
  - No modularization was needed for this narrow enum/value slice.

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
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 19 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1288 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 102 open, 135 closed.

## Death Ward Death-Prevention Slice

The Death Ward slice closed one `conditional_ending` row by adding first-class death-prevention data:

- Added `deathPrevention` runtime metadata for last-moment death safeguards.
- Added `drop_to_0_hp_prevented` and `instant_death_no_damage_prevented` to Conditional Ending Trigger vocabulary.
- Extended runtime typing, Zod validation, JSON Schema, strict audit vocabulary, and structured/runtime template shards.
- Updated Death Ward structured markdown with death-prevention triggers, replacement HP, instant-death negation, consumption, and scope.
- Updated Death Ward runtime JSON with `effects[].deathPrevention` and two explicit spell-ending conditional endings.
- Closed `death-ward::conditional_ending`.
- Recorded the repeated PowerShell native-glob failure as a process regression in `.agent/rules/environment-learnings/codex-desktop-terminal.md`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 325 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md` is about 117 lines before this entry.
  - `manual-review-overrides/level-4-00-19.json` is about 652 lines after this closure and remains reviewable.
  - `src/types/spells.ts` was still a large core file, so protection metadata was split into `src/types/spellProtectionMetadata.ts`.
  - After the split, `src/types/spells.ts` is about 1135 lines and `src/types/spellProtectionMetadata.ts` is about 115 lines.
  - `src/systems/spells/validation/spellValidator.ts` is about 922 lines; the new validation object lives in the already-split `effectProtectionSchemas.ts`.
  - No template shard split was needed; the edited structured effects part is about 325 lines and the runtime effects part is about 476 lines.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellProtectionMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectProtectionSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 19 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts`, `src/types/spellProtectionMetadata.ts`, `src/systems/spells/validation/spellValidator.ts`, and `src/systems/spells/validation/effectProtectionSchemas.ts` updated successfully.
- Actionable index: 1287 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 101 open, 136 closed.

## Heroism End-Cleanup Slice

The Heroism slice closed one `conditional_ending` row by separating normal end-of-spell cleanup from early-ending mechanics:

- Added `endCleanup` runtime metadata for spell/effect cleanup rules.
- Added split lifecycle metadata files:
  - `src/types/spellLifecycleMetadata.ts`
  - `src/systems/spells/validation/effectLifecycleSchemas.ts`
- Extended JSON Schema, strict audit vocabulary, and structured/runtime template shards with End Cleanup fields.
- Updated Heroism structured markdown with:
  - `End Cleanup Trigger: spell_ends`
  - `End Cleanup Removes: temporary_hit_points`
  - `End Cleanup Source: this_spell`
  - `End Cleanup Scope: target`
  - `End Cleanup Amount: all_remaining`
- Updated Heroism runtime JSON with `effects[].endCleanup[]` on the recurring Temporary Hit Point utility effect.
- Closed `heroism::conditional_ending`.
- Kept `Conditional Ending Triggers` as `not_applicable` because the cleanup does not make Heroism end early.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 336 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md` is about 160 lines before this entry.
  - `manual-review-overrides/level-1-02.json` is about 377 lines after this closure and remains reviewable.
  - `src/types/spells.ts` is about 1139 lines; lifecycle cleanup was split out instead of adding another inline object.
  - `src/types/spellLifecycleMetadata.ts` is about 48 lines.
  - `spellValidator.ts` is about 926 lines; lifecycle validation was split out into `effectLifecycleSchemas.ts`.
  - `effectLifecycleSchemas.ts` is about 42 lines.
  - `runtime-json/08-30-effects-damage-and-conditions.json` is about 596 lines after this slice and is now a watch item, but no split was needed for this narrow addition.

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
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 19 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts`, `src/types/spellLifecycleMetadata.ts`, `src/systems/spells/validation/spellValidator.ts`, and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Actionable index: 1286 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 100 open, 137 closed.

## Dragon's Breath Granted-Action Slice

The Dragon's Breath slice closed one `conditional_ending` row that was actually a granted-action actor/trigger issue:

- Extended existing `grantedActions` metadata with actor, action kind, area shape/size/unit, and linked effect indexes.
- Added `on_granted_action` as an effect trigger so target-activated spell actions do not masquerade as caster actions.
- Extended TypeScript types, Zod validation, strict audit vocabulary, and structured/runtime template shards with Granted Action fields.
- Updated Dragon's Breath structured markdown with:
  - `Granted Action Actor: target`
  - `Granted Action Name: exhale_breath_cone`
  - `Granted Action Type: magic_action`
  - `Granted Action Frequency: each_turn`
  - `Granted Action Area Shape: Cone`
  - `Granted Action Area Size: 15`
  - `Granted Action Area Size Unit: feet`
  - `Granted Action Effect Indices: 1`
- Updated Dragon's Breath runtime JSON with `effects[0].grantedActions[0]` and changed the breath damage trigger from `on_caster_action` to `on_granted_action`.
- Closed `dragons-breath::conditional_ending`.
- Kept `Conditional Ending Triggers` as `not_applicable` because this is not an early-ending rule.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 344 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md` is about 211 lines before this entry.
  - `manual-review-overrides/level-2-01.json` is about 367 lines after this closure and remains reviewable.
  - `src/types/spells.ts` is about 1152 lines and remains a watch item.
  - `spellValidator.ts` is about 935 lines and remains a watch item.
  - `vocabulary.ts` is about 627 lines.
  - The edited structured effects shard had grown to about 658 lines, and the edited runtime effects shard had grown to about 783 lines, so both were split before continuing.
  - Structured split:
    - `26-30-effects-ending-fall-cleanup.json`: about 455 lines.
    - `26-31-effects-granted-actions.json`: about 210 lines.
  - Runtime split:
    - `08-30-effects-defense-and-barriers.json`: about 366 lines.
    - `08-31-effects-death-cleanup-granted-actions.json`: about 424 lines.

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
npx tsx scripts\splitSpellTemplatePart.ts docs\tasks\spells\templates\parts\structured\26-30-effects-damage-and-conditions.json 18 26-30-effects-ending-fall-cleanup.json 26-31-effects-granted-actions.json
npx tsx scripts\splitSpellTemplatePart.ts docs\tasks\spells\templates\parts\runtime-json\08-30-effects-damage-and-conditions.json 20 08-30-effects-defense-and-barriers.json 08-31-effects-death-cleanup-granted-actions.json
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 36 parts; runtime JSON aggregate matched 20 parts after the split.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1285 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 99 open, 138 closed.

## Heat Metal Granted-Action Prerequisite Slice

The Heat Metal slice closed one `conditional_ending` row that was actually a repeat-action prerequisite issue:

- Extended existing `grantedActions` metadata with repeat-action prerequisites.
- Added the `target_object_within_spell_range` prerequisite value.
- Filled the runtime JSON Schema gap for `grantedActions` so actor/action/area/effect-index/prerequisite data is represented outside Zod and templates.
- Updated Heat Metal structured markdown with:
  - `Granted Action Actor: caster`
  - `Granted Action Name: repeat_heat_damage`
  - `Granted Action Type: bonus_action`
  - `Granted Action Frequency: each_turn`
  - `Granted Action Effect Indices: 1`
  - `Granted Action Prerequisites: target_object_within_spell_range`
- Updated Heat Metal runtime JSON with `effects[2].grantedActions[0]` and changed the repeat damage trigger from `on_caster_action` to `on_granted_action`.
- Closed `heat-metal::conditional_ending`.
- Left `heat-metal::environmental_change` open because physical-contact targeting remains a separate contact-condition issue.
- Kept `Conditional Ending Triggers` as `not_applicable` because this row was not an early-ending rule.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 360 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md` is about 274 lines before this entry.
  - `manual-review-overrides/level-2-02.json` is about 371 lines after this closure and remains reviewable.
  - `src/types/spells.ts` is about 1154 lines and remains a watch item.
  - `spellValidator.ts` is about 936 lines and remains a watch item.
  - `spell.schema.json` is about 2942 lines and remains a watch item if more JSON Schema definitions are added.
  - `vocabulary.ts` is about 628 lines.
  - `26-31-effects-granted-actions.json` is about 236 lines.
  - `08-31-effects-death-cleanup-granted-actions.json` is about 448 lines.
  - No further modularization was needed for this narrow prerequisite addition after the previous template split.

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
- Template aggregate sync: structured aggregate matched 36 parts; runtime JSON aggregate matched 20 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1284 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 98 open, 139 closed.

## Crown Of Madness Sustain-Requirement Slice

The Crown of Madness slice closed one `conditional_ending` row:

- Added a lifecycle-level `SustainRequirement` metadata shape for later-turn upkeep actions.
- Added `sustain_action_not_taken` as a conditional-ending trigger value.
- Added focused sustain-requirement template shards:
  - `docs/tasks/spells/templates/parts/structured/26-32-effects-sustain-requirements.json`
  - `docs/tasks/spells/templates/parts/runtime-json/08-32-effects-sustain-requirements.json`
- Updated Crown of Madness structured markdown with:
  - `Conditional Ending Triggers: repeat_save_success, sustain_action_not_taken`
  - `Conditional Ending Scope: spell`
  - `Sustain Requirement Timing: later_turns`
  - `Sustain Requirement Actor: caster`
  - `Sustain Requirement Action Type: magic_action`
  - `Sustain Requirement Action Cost: action`
  - `Sustain Requirement Failure Outcome: spell_ends`
- Updated Crown of Madness runtime JSON with `effects[0].sustainRequirement`, a `sustain_action_not_taken` conditional ending, and repeat-save success ending metadata.
- Closed `crown-of-madness::conditional_ending` with a `closedReason`.
- Kept `crown-of-madness::status_or_state_change` and `crown-of-madness::social_or_knowledge_effect` open because compelled attack/control behavior is a separate mechanic.
- Recorded the repeated Codex Desktop unified-exec process-limit warning as a process regression in `.agent/rules/environment-learnings/codex-desktop-terminal.md`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 357 lines before this update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md` is about 325 lines before this entry.
  - `manual-review-overrides/level-2-00.json` is about 878 lines and remains the largest manual-review shard.
  - `src/types/spells.ts` is about 1157 lines and remains a watch item.
  - `spellValidator.ts` is about 941 lines and remains a watch item.
  - `spell.schema.json` is about 3003 lines after this slice and should be treated as the next schema modularization priority before adding more JSON Schema definitions.
  - The new sustain template shards are small, about 143 and 133 lines.

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
- Dependency sync: `src/types/spellLifecycleMetadata.ts`, `src/systems/spells/validation/effectLifecycleSchemas.ts`, `src/types/spells.ts`, and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1283 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 97 open, 140 closed.

## Spell JSON Schema Registry Modularization Checkpoint

This checkpoint addressed the `spell.schema.json` ballooning risk before starting another mechanics bucket:

- Added `scripts/syncSpellJsonSchemaRegistry.ts`.
- Created 5 reviewable schema source parts under `src/systems/spells/schema/parts/`.
- Kept `src/systems/spells/schema/spell.schema.json` as the stable aggregate file for existing tools.
- Split the current aggregate into parts, verified semantic equivalence, regenerated the aggregate from the parts, and verified semantic equivalence again.
- Updated the handoff file so future JSON Schema edits use the part files first.

Current schema part sizes:

- `00-schema-root.json`: about 867 lines.
- `10-schedules-modes-and-relationships.json`: about 398 lines.
- `20-effect-payloads.json`: about 933 lines.
- `30-lifecycle-protection-and-appearance.json`: about 487 lines.
- `40-modifiers-and-controlled-entities.json`: about 348 lines.

Validation evidence:

```powershell
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --split-from-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellMechanicsContract.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
```

Results:

- Schema aggregate semantically matches 5 parts before and after regeneration.
- Spell JSON validation: 459 valid, 0 invalid.
- Mechanics contract audit completed: 459 spells scanned, 793 live JSON fields, 345 JSON-only fields, 154 type gaps, 36 schema-only fields.
- Template aggregate sync: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed.

