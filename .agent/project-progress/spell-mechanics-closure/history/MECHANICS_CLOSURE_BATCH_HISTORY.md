# Spell Mechanics Closure Batch History

Status: archived completed-batch detail
Last updated: 2026-05-14

This file stores completed-batch detail moved out of `MECHANICS_CLOSURE_HANDOFF.md` during the between-batch modularization checkpoint. The active handoff remains the restart surface; this file preserves older evidence and rationale.

The Absorb Elements conditional-ending slice closed one `conditional_ending` row and performed a required between-batch manual-review modularization:

- Added `on_attack_hit` as a Conditional Ending Trigger in:
  - `src/systems/spells/validation/spellValidator.ts`
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts`
  - `docs/tasks/spells/templates/parts/structured/26-30-effects-damage-and-conditions.json`
- Updated Absorb Elements structured markdown and runtime JSON with:
  - `Conditional Ending Triggers: on_attack_hit`
  - `Conditional Ending Scope: spell`
  - stored rider `Damage Type: triggering_damage_type`
  - runtime `effects[1].conditionalEndings[]` ending the spell when the first melee hit spends the stored energy
- Closed `absorb-elements::conditional_ending` with a `closedReason`.
- Recorded a PowerShell process regression in `.agent/rules/environment-learnings/codex-desktop-terminal.md` after repeating the documented unsafe `rg` alternation pattern with `|`.
- Added `scripts/splitManualReviewOverrideShard.ts` and used it to split the oversized `level-1.json` manual-review shard into four smaller shard files:
  - `level-1-00.json`: about 672 lines
  - `level-1-01.json`: about 366 lines
  - `level-1-02.json`: about 372 lines
  - `level-1-03.json`: about 367 lines
- Removed the original `level-1.json` as part of the equivalent split so future agents do not have two files for the same finding ids.

Validation evidence for this slice:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 35 parts; runtime JSON aggregate matches 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed after the validator enum change and splitter script addition.
- Mechanics-discovery regeneration after the level-1 split remained equivalent and produced 1320 actionable open findings, 24 grouped families.
- `conditional_ending`: 237 total findings, 127 open, 110 closed.

Previous completed batch:

The Minor Illusion sensory/illusion slice closed three remaining level-0 rows across `vision_light_sound`, `illusion_or_disguise`, and `conditional_ending`:

- Added `src/types/spellIllusionMetadata.ts` so sensory/illusion contracts do not further balloon `src/types/spells.ts`.
- Added `src/systems/spells/validation/illusionSchemas.ts` so sensory/illusion validation does not grow `spellValidator.ts`.
- Added `effects[].sensoryManifestation` and `effects[].illusion` to the TypeScript spell contract, Zod validator, JSON Schema, structured template shards, runtime JSON template shards, and strict-template vocabulary/audit checks.
- Updated Minor Illusion structured markdown and runtime JSON with:
  - Sound mode as sound-only with `whisper_to_scream` volume and `continuous_or_discrete_before_spell_end` timing.
  - Image mode as sight-only with sound, light, smell, and other-sensory-effect exclusions.
  - Image mode maximum size as a 5-foot Cube.
  - Study action Intelligence (Investigation) reveal against spell save DC for Sound and Image.
  - Physical-interaction reveal for Image.
  - `faint_to_discerning_creature` post-reveal state.
  - `end_on_recast` conditional ending for the spell.
- Closed:
  - `minor-illusion::vision_light_sound`
  - `minor-illusion::illusion_or_disguise`
  - `minor-illusion::conditional_ending`
- Updated the old `minor-illusion::choice_or_mode` closed reason so it no longer says the option-specific rows remain open.
- Performed the mandatory file-ballooning checkpoint:
  - `src/types/spells.ts` is about 1093 lines after exporting split illusion metadata.
  - `src/types/spellIllusionMetadata.ts` is about 107 lines.
  - `src/systems/spells/validation/spellValidator.ts` is about 880 lines after importing the split illusion schemas.
  - `src/systems/spells/validation/illusionSchemas.ts` is about 90 lines.
  - `scripts/auditSpellRuntimeTemplate.ts` remains large at about 1479 lines, but this slice added only narrow enum checks and did not make it harder to edit than before.
  - The aggregate template files remain large generated artifacts; edit their part shards first.
  - No behavior-preserving split was required before another narrow reuse/data slice.

Validation evidence for this slice:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellIllusionMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\illusionSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 35 parts; runtime JSON aggregate matches 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed after the new split files and dependency sync.
- Actionable index: 1321 open findings, 24 grouped mechanics families.

Previous completed batch:

The Mage Hand controlled-entity slice closed one remaining level-0 `choice_or_mode` row and refreshed an already closed vanish-condition row:

- Added `src/types/spellControlledEntity.ts` so controllable utility helpers do not further balloon `src/types/spells.ts`.
- Added `src/systems/spells/validation/controlledEntitySchemas.ts` so controlled-entity validation does not grow `spellValidator.ts`.
- Added `effects[].controlledEntity` to the TypeScript spell contract, Zod validator, JSON Schema, structured template shards, runtime JSON template shards, and strict-template vocabulary.
- Added `beyond_max_distance` as a Conditional Ending Trigger for leash-style vanish rules.
- Updated Mage Hand structured markdown and runtime JSON with:
  - spectral hand type
  - count 1
  - chosen-point appearance
  - Magic action control on later turns
  - initial use on cast
  - 30-foot movement
  - 30-foot caster-distance leash
  - 10-pound carry limit
  - allowed object/container/vial interactions
  - cannot attack
  - cannot activate magic items
  - recast and beyond-distance vanish triggers
- Closed `mage-hand::choice_or_mode` with a `closedReason`.
- Refreshed the previously closed `mage-hand::manual_hand_vanish_conditions` row so its `closedReason` now points at the actual controlledEntity and conditionalEndings data instead of stale text.
- Performed the mandatory file-ballooning checkpoint:
  - `src/types/spells.ts` is about 1174 lines after exporting the split controlled-entity metadata.
  - `src/types/spellControlledEntity.ts` is about 54 lines.
  - `src/systems/spells/validation/spellValidator.ts` is about 955 lines after importing the split controlled-entity schema.
  - `src/systems/spells/validation/controlledEntitySchemas.ts` is about 55 lines.
  - No additional split was required before another narrow reuse/data slice.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellControlledEntity.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\controlledEntitySchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 34 parts; runtime JSON aggregate matches 17 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, still below the earlier 48-issue baseline.
- Typecheck: passed before and after dependency sync.
- Actionable index: 1324 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 129 open, 102 closed.

The Magic Stone empowered-pebble slice closed three rows across three buckets:

- Reused Target Instance fields for the one-to-three empowered pebbles:
  - `Target Instance Type: projectile`
  - `Target Instance Base Count: 3`
  - sequential per-pebble resolution notes
- Extended attack augment weapon requirements with `pebble` and `sling`.
- Updated Magic Stone structured markdown and runtime JSON with attack augment data showing that empowered pebble attacks use the caster's spellcasting ability modifier for attack and damage, even when someone else attacks.
- Added `per_instance_hit_or_miss` effect-trigger consumption and `on_attack_hit_or_miss` conditional-ending trigger.
- Updated `src/types/combat.ts` and `src/systems/combat/AttackRiderSystem.ts` so the new rider consumption value is accepted and removed on hit in the current rider flow. Miss-side removal is documented in code as needing a miss-resolution caller.
- Changed Conditional Ending Scope from `enum` to `csv-enum` in the structured template because existing valid data already used multiple scope values such as `spell, spell`; this reduced the template contract report from the prior 48-issue baseline to 46 issues.
- Closed:
  - `magic-stone::attack_or_save_modifier`
  - `magic-stone::conditional_ending`
  - `magic-stone::manual_empowered_pebbles`

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellAttackMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\attackAugmentSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\combat.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\combat\AttackRiderSystem.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 34 parts; runtime JSON aggregate matches 17 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, down from the prior 48-issue baseline.
- Typecheck: passed after the combat rider union update.
- Actionable index: 1325 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 129 open, 108 closed.
- `attack_or_save_modifier`: 303 total findings, 126 open, 177 closed.
- `created_object_or_structure`: 70 total findings, 44 open, 26 closed.

The Guidance ability-check modifier slice closed one `choice_or_mode` row:

- Added `src/types/spellCheckMetadata.ts` so chosen-skill ability-check modifiers do not further balloon `src/types/spells.ts`.
- Added `src/systems/spells/validation/abilityCheckModifierSchemas.ts` so check-modifier validation does not grow `spellValidator.ts`.
- Added `effects[].abilityCheckModifier` to the TypeScript spell contract, Zod validator, JSON Schema, structured template shards, runtime JSON template shards, and strict-template vocabulary.
- Updated Guidance structured markdown with Ability Check Modifier fields for the caster-chosen skill, 1d4 bonus, every matching ability check frequency, and while-active duration.
- Updated Guidance runtime JSON with `effects[0].abilityCheckModifier`.
- Corrected Guidance runtime description from "Once before the spell ends" to the canonical meaning: the target adds 1d4 to ability checks using the chosen skill until the spell ends.
- Closed `guidance::choice_or_mode` with a `closedReason`.
- Performed the mandatory file-ballooning checkpoint:
  - `src/types/spells.ts` is about 1171 lines after exporting the split check metadata.
  - `src/types/spellCheckMetadata.ts` is about 56 lines.
  - `src/systems/spells/validation/spellValidator.ts` is about 951 lines after importing the split check schema.
  - `src/systems/spells/validation/abilityCheckModifierSchemas.ts` is about 48 lines.
  - No additional split was required before another narrow reuse/data slice.

Validation evidence for this slice:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellCheckMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\abilityCheckModifierSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 34 parts; runtime JSON aggregate matches 17 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 48 issues, the known baseline of 46 errors and 2 warnings.
- Typecheck: passed before and after dependency sync.
- Actionable index: 1328 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 130 open, 101 closed.

The weapon attack-augment choice slice closed Shillelagh and True Strike:

- Added `src/types/spellAttackMetadata.ts` so spell-modified weapon attack metadata does not further balloon `src/types/spells.ts`.
- Added `src/systems/spells/validation/attackAugmentSchemas.ts` so attack augment validation does not grow `spellValidator.ts`.
- Expanded the public `AttackAugment` contract with:
  - weapon prerequisites
  - granted attack timing/count
  - spellcasting ability substitution
  - damage die override/scaling
  - caster damage-type choice
  - existing additional damage riders
- Updated `src/systems/spells/schema/spell.schema.json`, structured template shards, runtime JSON template shards, and strict-template vocabulary for numbered Attack Augment fields.
- Updated Shillelagh structured markdown and runtime JSON with club/quarterstaff requirement, held weapon, spellcasting ability substitution, scaling damage die, and Force-or-normal damage choice.
- Updated True Strike structured markdown and runtime JSON with proficient weapon/value requirement, one attack during casting, spellcasting ability substitution, Radiant-or-normal damage choice, and Radiant rider metadata.
- Closed `shillelagh::choice_or_mode` and `true-strike::choice_or_mode` with `closedReason` values.
- Performed the mandatory file-ballooning checkpoint:
  - `src/types/spells.ts` is about 1168 lines after exporting the split attack metadata.
  - `src/types/spellAttackMetadata.ts` is about 136 lines.
  - `src/systems/spells/validation/spellValidator.ts` is about 949 lines after importing the split attack augment schema.
  - `src/systems/spells/validation/attackAugmentSchemas.ts` is about 97 lines.
  - No additional split was required before another narrow reuse/data slice.

Validation evidence for this slice:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellAttackMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\attackAugmentSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 34 parts; runtime JSON aggregate matches 17 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 48 issues, the known baseline of 46 errors and 2 warnings.
- Typecheck: passed before and after dependency sync.
- Actionable index: 1329 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 131 open, 100 closed.

The Green-Flame Blade residual-choice closure closed one duplicate/misbucketed `choice_or_mode` row without changing spell data:

- Reviewed Green-Flame Blade structured markdown and runtime JSON.
- Confirmed the "can cause green fire to leap" wording is optional secondary-target selection, not a mode menu.
- Left existing structured Secondary Target fields and runtime `effects[1].secondaryTargeting` as the correct representation.
- Closed `green-flame-blade::choice_or_mode` with a `closedReason`.

Validation evidence for this closure:

```powershell
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Actionable index: 1331 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 133 open, 98 closed.

The Minor Illusion mode-choice reuse slice closed one additional `choice_or_mode` row without adding new schema surface:

- Reused the existing top-level `modeChoice` metadata for Minor Illusion.
- Updated `docs/spells/reference/level-0/minor-illusion.md` with Mode Choice fields for Sound and Image.
- Updated `public/data/spells/level-0/minor-illusion.json` with matching runtime `modeChoice` data.
- Closed `minor-illusion::choice_or_mode` with a `closedReason`.
- Left `minor-illusion::vision_light_sound`, `minor-illusion::illusion_or_disguise`, and `minor-illusion::conditional_ending` open because those rows cover option-specific sensory restrictions, reveal behavior, and ending/timing mechanics that were not solved by the menu metadata alone.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Actionable index: 1332 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 134 open, 97 closed.

The Dancing Lights form-choice reuse slice closed one additional `choice_or_mode` row without adding new schema surface:

- Reused the existing top-level `modeChoice` metadata for Dancing Lights.
- Updated `docs/spells/reference/level-0/dancing-lights.md` with Mode Choice fields for Separate Lights and Humanoid Form.
- Updated `public/data/spells/level-0/dancing-lights.json` with matching runtime `modeChoice` data, pointing both choices at the existing light effect because the canonical choice changes arrangement/form while sharing the dim-light mechanics.
- Closed `dancing-lights::choice_or_mode` with a `closedReason`.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Actionable index: 1333 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 135 open, 96 closed.

The first cantrip utility-mode `choice_or_mode` slice closed six "choose one of the following effects" utility menus:

- Added reusable top-level `modeChoice` metadata to the TypeScript spell contract, Zod validator, JSON Schema, structured template shards, runtime JSON template shards, and strict-template vocabulary.
- Added `src/systems/spells/validation/modeChoiceSchemas.ts` so mode-menu validation does not grow `spellValidator.ts` directly.
- Updated structured markdown and runtime JSON for Druidcraft, Elementalism, Mold Earth, Prestidigitation, Shape Water, and Thaumaturgy.
- Added or connected runtime `controlOptions` where the spell's actual option payload was still prose-heavy.
- Closed these rows with `closedReason` values:
  - `druidcraft::choice_or_mode`
  - `elementalism::choice_or_mode`
  - `mold-earth::choice_or_mode`
  - `prestidigitation::choice_or_mode`
  - `shape-water::choice_or_mode`
  - `thaumaturgy::choice_or_mode`
- Performed the mandatory file-ballooning checkpoint after the slice:
  - `src/types/spells.ts` remained the main ballooning surface after another broad schema family.
  - Split effect-schedule and mode-choice coordination types into `src/types/spellEffectMetadata.ts`.
  - `spells.ts` still re-exports the same public type names, preserving the external contract while reducing the file from about 1225 lines to about 1165 lines.
  - `spellEffectMetadata.ts` is about 129 lines and owns only the coordination metadata for mode menus and scheduled effects.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\modeChoiceSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellEffectMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npm run typecheck
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matches 34 parts; runtime JSON aggregate matches 17 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 48 issues, the known baseline of 46 errors and 2 warnings.
- Typecheck: passed before and after the type split.
- Actionable index: 1334 open findings, 24 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 136 open, 95 closed.

The nineteenth `multi_instance_or_split_targeting` slice closed Storm of Vengeance's turn-numbered staged-effect schedule and finished the `multi_instance_or_split_targeting` bucket:

- Added a reusable top-level `effectSchedule` shape to the TypeScript spell contract, Zod validator, JSON Schema, structured template shards, runtime JSON template shards, and strict-template vocabulary.
- Added `src/systems/spells/validation/effectScheduleSchemas.ts` so the new schedule validator does not grow `spellValidator.ts` directly.
- Updated `docs/spells/reference/level-9/storm-of-vengeance.md` with Effect Schedule fields for Turn 2 acid rain, Turn 3 six distinct lightning targets, Turn 4 hailstones, and Turns 5-10 freezing rain/control.
- Updated `public/data/spells/level-9/storm-of-vengeance.json` with `effectSchedule.entries[]` that point to existing effect indices and record per-stage target counts/eligibility.
- Closed `storm-of-vengeance::multi_instance_or_split_targeting` with a `closedReason`.
- Also closed the previous Animate Dead residual before this slice:
  - Added `controlled_undead` target-instance vocabulary.
  - Updated Animate Dead structured markdown/runtime JSON for the reassert-control count only.
  - Closed `animate-dead::multi_instance_or_split_targeting` while leaving Animate Dead's other creation/control mechanics open in their own rows.
- Performed the mandatory file-ballooning checkpoint after the slice:
  - `spellValidator.ts` crossed the 1000-line watch threshold after adding schedule support.
  - Split barrier/spell-prevention/linked-damage/resistance-suppression/damage-interaction schemas into `src/systems/spells/validation/effectProtectionSchemas.ts`.
  - Re-ran dependency sync and typecheck after the split.
  - `spellValidator.ts` is now about 950 lines; `effectScheduleSchemas.ts` is about 75 lines and `effectProtectionSchemas.ts` is about 104 lines.

Validation evidence for this slice:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectScheduleSchemas.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectProtectionSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template shard check: aggregate fields match 34 structured parts and 17 runtime JSON parts.
- Template contract validation: still reports the existing 48 issues (46 errors, 2 warnings).
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts`, `src/systems/spells/validation/spellValidator.ts`, `src/systems/spells/validation/effectScheduleSchemas.ts`, and `src/systems/spells/validation/effectProtectionSchemas.ts` updated successfully.
- Actionable index: 1340 open findings, 24 grouped mechanics families.
- `multi_instance_or_split_targeting`: 28 total findings, 0 open, 28 closed.

The between-batch modularization checkpoint after this slice was performed:

- This slice used the template shards first and regenerated the aggregate template files afterward.
- `src/types/spellTargeting.ts` and `targetingSchemas.ts` remain focused targeting modules.
- `src/types/spells.ts` remains a watch item because it still carries broad spell/effect types, but targeting has already been split out and this slice did not add targeting back into it.
- `spellValidator.ts` was modularized from about 1002 lines down to about 950 lines by extracting `effectProtectionSchemas.ts`.
- `scripts/auditSpellRuntimeTemplate.ts` is about 1650 lines and `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 414 lines; if another broad audit-vocabulary family is added, split audit check families before continuing.
- `spell-structured-template.json` and `spell-json-template.json` remain generated aggregate files; edit the shard files first and regenerate.
- `manual-review-overrides/level-9-10-14.json` remains manageable after this closure.
- During verification, the first actionable-bucket regeneration was run in parallel with mechanics discovery and preserved the previous count. Rerunning `regenerateActionableSchemaBuckets.ts` serially after discovery produced the correct 1346 count. Keep these two commands sequential.
- Keep `auditSpellMechanicsDiscovery.ts` and then `regenerateActionableSchemaBuckets.ts` sequential. Do not run the regeneration before discovery has finished.
- `multi_instance_or_split_targeting` has no remaining open rows. Pick the next bucket from `ACTIONABLE_SCHEMA_BUCKETS.md`; do not resurrect multi-instance rows unless a new canonical/mechanical gap is discovered.

This file is an index for completed mechanics-closure batch history. Detailed batch notes were split into numbered part files once the archive crossed the review-size threshold.

## Batch History Parts

- [MECHANICS_CLOSURE_BATCH_HISTORY_PART_01](batch-history/MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md)
  - Covers: Earlier Completed Batches through Jump Duration-Scope Misbucket Slice
- [MECHANICS_CLOSURE_BATCH_HISTORY_PART_02](batch-history/MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md)
  - Covers: Sanctuary Early-Ending Trigger Slice through Fear Line-Of-Sight Repeat-Save Prerequisite Slice
- [MECHANICS_CLOSURE_BATCH_HISTORY_PART_03](batch-history/MECHANICS_CLOSURE_BATCH_HISTORY_PART_03.md)
  - Covers: Prayer Of Healing Target-Participation Slice through Spell JSON Schema Registry Modularization Checkpoint
- [MECHANICS_CLOSURE_BATCH_HISTORY_PART_04](batch-history/MECHANICS_CLOSURE_BATCH_HISTORY_PART_04.md)
  - Covers: Suggestion Conditional-Ending Slice through Duration-Scaling Batch 01
- [MECHANICS_CLOSURE_BATCH_HISTORY_PART_05](batch-history/MECHANICS_CLOSURE_BATCH_HISTORY_PART_05.md)
  - Covers: HigherLevelScaling JSON Schema Alignment Checkpoint through Created-Object Cleanup Batch 01
