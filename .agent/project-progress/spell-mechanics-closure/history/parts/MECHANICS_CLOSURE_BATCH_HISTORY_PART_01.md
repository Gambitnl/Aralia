# Mechanics Closure Batch History Part 01

## Earlier Completed Batches

The thirteenth `multi_instance_or_split_targeting` slice closed Lightning Arrow's linked primary/secondary damage scaling:

- Updated Lightning Arrow structured markdown with secondary damage fields:
  - primary damage remains `4d8 Lightning`
  - secondary damage is now `2d8 Lightning`
  - Scaling Rule 1 is now `slot_level_bonus`, applies to both damage legs, and records `+1d8`
- Updated Lightning Arrow runtime JSON so the primary damage effect has `+1d8` slot scaling.
- Added a second runtime `DAMAGE` effect for the 10-foot secondary burst with `2d8 Lightning`, Dexterity half-save behavior, and matching `+1d8` slot scaling.
- Closed `lightning-arrow::manual_both_damage_effects_scale` with a `closedReason` value in `manual-review-overrides/level-3-20-39.json`.
- Kept Lightning Arrow's separate pending-attack trigger finding open.

The twelfth `multi_instance_or_split_targeting` slice closed Intellect Fortress's higher-slot target scaling plus mutual-distance constraint:

- Added first-class target-cluster support to the spell contract:
  - TypeScript `TargetCluster`
  - Zod `TargetCluster`
  - JSON Schema `targeting.targetCluster`
  - structured template `Target Cluster *` fields
  - runtime template `targeting.targetCluster.*` fields
  - strict-template vocabulary checks for requirement and scope
- Updated Intellect Fortress structured markdown:
  - targeting type is now `multi`
  - `Targeting Max` is the base one-target state
  - target cluster requirement is required, max distance 30 feet, scope all targets
  - target willingness is required and self relation is `self_allowed`
  - Scaling Rule 1 now points at `targeting.maxTargets`
- Updated Intellect Fortress runtime JSON with slot-level `targeting.maxTargets` thresholds from slot 3 through slot 9 and matching `targeting.targetCluster` data.
- Closed `intellect-fortress::manual_slot_target_scaling` with a `closedReason` value in `manual-review-overrides/level-3-20-39.json`.
- Dependency sync succeeded for `src/types/spells.ts` and `src/systems/spells/validation/targetingSchemas.ts`.

The eleventh `multi_instance_or_split_targeting` slice closed Enthrall's unbounded chosen-creature target count:

- Reused the new schema-safe `unlimited` sentinel from the Animal Shapes slice.
- Updated Enthrall structured markdown with `Targeting Max: unlimited`.
- Updated Enthrall runtime JSON from `maxTargets: 1` to `maxTargets: "unlimited"`.
- Closed `enthrall::manual_creatures_of_choice_unbounded_multi_target` with a `closedReason` value in `manual-review-overrides/level-2.json`.

The tenth `multi_instance_or_split_targeting` slice closed Animal Shapes' unlimited-target runtime placeholder:

- Expanded the shared `ScalableNumber`/`targeting.maxTargets` contract to accept the explicit string sentinel `unlimited`.
- Updated the Zod targeting validator and JSON Schema so runtime spell JSON can validate `targeting.maxTargets: "unlimited"`.
- Updated both spell template registries so `Targeting Max` / `targeting.maxTargets` explain finite numbers, scalable objects, and the `unlimited` sentinel; template comments now explicitly reject fake high caps such as 999.
- Replaced Animal Shapes' runtime `maxTargets: 999` placeholder with `maxTargets: "unlimited"`.
- Updated Animal Shapes structured utility notes so they no longer describe the old runtime placeholder.
- Closed `animal-shapes::multi_instance_or_split_targeting` with a `closedReason` value in `manual-review-overrides/level-8-00-04.json`.
- Dependency sync succeeded for `src/types/spells.ts` and `src/systems/spells/validation/targetingSchemas.ts`.

The ninth `multi_instance_or_split_targeting` slice closed Tiny Servant's higher-slot object target-count scaling:

- Updated Tiny Servant structured markdown so the spell is a multi-object targeting spell with base `Targeting Max: 1`.
- Updated Tiny Servant object eligibility fields from prose:
  - worn/carried objects are excluded
  - magical objects are excluded by requiring `nonmagical`
  - fixed/attached objects are excluded
  - maximum object size is `Tiny`
- Updated Scaling Rule 1 Applies To so it now names `targeting.maxTargets`.
- Updated Tiny Servant runtime JSON so `targeting.maxTargets` uses slot-level thresholds from slot 3 through slot 9: 1, 3, 5, 7, 9, 11, 13.
- Closed `tiny-servant::manual_slot_additional_objects` with a `closedReason` value in `manual-review-overrides/level-3-40-59.json`.
- Kept Tiny Servant's separate controlled-creature lifecycle and 0 HP conditional-ending findings open.
- Recorded a Codex Desktop PowerShell process-regression note after repeating the already documented native-glob `rg` path issue with `public\data\spells\level-*`.

The eighth `multi_instance_or_split_targeting` slice closed only Cordon of Arrows' planted-ammunition instance count:

- Updated Cordon of Arrows structured markdown with `Target Instance` fields for planted ammunition:
  - type `projectile`
  - base count `4`
  - scaling rule `slot_level_plus_two_per_level`
  - assignment `not_applicable`
  - resolution `sequential`
  - notes covering one-piece-per-trigger resolution and per-piece destruction
- Updated Cordon of Arrows runtime JSON with matching `targeting.instanceAllocation` data.
- Updated Scaling Rule 1 Applies To so it now names `targeting.instanceAllocation.baseCount`.
- Closed `cordon-of-arrows::multi_instance_or_split_targeting` with a `closedReason` value in `manual-review-overrides/level-2.json`.
- Kept Cordon's separate ignored-creature choice, planted-object/environment, object destruction, and no-ammunition ending rows open.
- Reviewed Storm of Vengeance as a possible target-instance reuse candidate but left it open because the override's real issue is a turn-numbered staged-effect schedule, not just the six Turn 3 bolts.

The seventh `multi_instance_or_split_targeting` slice closed the simple level-3 higher-slot target-count scaling rows:

- Updated Catnap structured markdown so Scaling Rule 1 points at `targeting.maxTargets` with `+1 target` per slot level.
- Updated Fly and Gaseous Form structured markdown so `Targeting Type` is `multi`, `Targeting Max` records the base one-target state, and Scaling Rule 1 points at `targeting.maxTargets` with `+1 target` per slot level.
- Updated Catnap runtime JSON so `targeting.maxTargets` uses slot-level thresholds from slot 3 through slot 9, starting from three targets.
- Updated Fly and Gaseous Form runtime JSON so `targeting.maxTargets` uses slot-level thresholds from slot 3 through slot 9, starting from one target.
- Closed `catnap::manual_slot_target_scaling`, `fly::manual_slot_target_scaling`, and `gaseous-form::manual_slot_target_scaling` with `closedReason` values in their level-3 manual-review override shards.
- Left `intellect-fortress::manual_slot_target_scaling` open because it also has a mutual-distance constraint: "The creatures must be within 30 feet of each other when you target them."
- Recorded another Codex Desktop PowerShell process-regression note after an escaped quoted JSON-fragment `rg` search produced a regex parse error.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed on rerun. One earlier `tsc -b` invocation reported a stale/transient `AbilityEffect.diceCount` error in `src/data/adapters/5eTools/index.ts`, but the current source has no `diceCount` references and a direct rerun passed.
- Actionable index: 1353 open findings, 25 grouped mechanics families.
- `multi_instance_or_split_targeting`: 28 total findings, 13 open, 15 closed.

The between-batch modularization checkpoint after this slice was performed:

- This was another narrow data-only reuse of existing `targeting.maxTargets` scaling support; no TypeScript or template files changed.
- `src/types/spells.ts` remains about 1484 lines, `spellValidator.ts` remains about 993 lines, and `targetingSchemas.ts` remains about 278 lines.
- `spell-structured-template.json` remains about 4155 lines and `spell-json-template.json` remains about 3088 lines.
- `manual-review-overrides/level-3-00-19.json` is about 719 lines and `manual-review-overrides/level-3-20-39.json` is about 1219 lines.
- The remaining `multi_instance_or_split_targeting` rows are no longer all simple target-count scaling; review each for additional mechanics before closure.

The sixth `multi_instance_or_split_targeting` slice closed the level-2 higher-slot target-count scaling trio:

- Updated Blindness/Deafness, Invisibility, and Spider Climb structured markdown so `Targeting Type` is `multi`, `Targeting Max` records the base one-target state, and Scaling Rule 1 points at `targeting.maxTargets` with `+1 target` per slot level.
- Updated Blindness/Deafness, Invisibility, and Spider Climb runtime JSON so `targeting.maxTargets` uses the existing slot-level scalable object with thresholds from slot 2 through slot 9.
- Normalized Invisibility structured `Valid Targets` from singular `creature` to accepted `creatures` while preserving the same canonical target meaning.
- Closed `blindness-deafness::manual_slot_scaled_targets`, `invisibility::manual_slot_scaled_targets`, and `spider-climb::manual_slot_target_scaling` with `closedReason` values in `manual-review-overrides/level-2.json`.
- Left `enhance-ability::manual_slot_scaled_targets_with_per_target_choice` open because it also needs per-target ability-choice modeling, not only target-count scaling.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed.
- Actionable index: 1356 open findings, 25 grouped mechanics families.
- `multi_instance_or_split_targeting`: 28 total findings, 16 open, 12 closed.

The between-batch modularization checkpoint after this slice was performed:

- This was a narrow data-only reuse of existing `targeting.maxTargets` scaling support; no TypeScript or template files changed.
- `src/types/spells.ts` remains about 1484 lines, `spellValidator.ts` remains about 993 lines, and `targetingSchemas.ts` remains about 278 lines.
- `spell-structured-template.json` remains about 4155 lines and `spell-json-template.json` remains about 3088 lines.
- `manual-review-overrides/level-2.json` is about 2270 lines and remains a strong modularization candidate before any broad edits in level 2.

The fifth `multi_instance_or_split_targeting` slice closed the level-1 higher-slot target-count scaling trio:

- Updated Heroism, Jump, and Longstrider structured markdown so `Targeting Type` is `multi`, `Targeting Max` records the base one-target state, and Scaling Rule 1 points at `targeting.maxTargets` with `+1 target` per slot level.
- Updated Heroism, Jump, and Longstrider runtime JSON so `targeting.maxTargets` uses the existing slot-level scalable object with thresholds from slot 1 through slot 9.
- Closed `heroism::manual_slot_scaled_targets`, `jump::manual_slot_scaled_targets`, and `longstrider::manual_slot_scaled_targets` with `closedReason` values in `manual-review-overrides/level-1.json`.
- Recorded another Codex Desktop PowerShell process-regression note after a quote-plus-colon `rg` search for `"maxTargets":` lost quoting and produced an opaque Windows path error.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed.
- Actionable index: 1359 open findings, 25 grouped mechanics families.
- `multi_instance_or_split_targeting`: 28 total findings, 19 open, 9 closed.

The between-batch modularization checkpoint after this slice was performed:

- This was a narrow data-only reuse of existing `targeting.maxTargets` scaling support; no TypeScript or template files changed.
- `src/types/spells.ts` remains about 1484 lines, `spellValidator.ts` remains about 993 lines, and `targetingSchemas.ts` remains about 278 lines.
- `spell-structured-template.json` remains about 4155 lines and `spell-json-template.json` remains about 3088 lines.
- `manual-review-overrides/level-1.json` is about 1757 lines after this batch; keep the manual-review shard split on the watch list before broad edits in this file.

The fourth target-instance reuse slice closed Scorching Ray and the stale Magic Missile multi-instance residual:

- Updated Scorching Ray structured markdown with `Target Instance` fields for three base rays, per-slot extra rays, same-or-different target assignment, and separate per-ray attack resolution.
- Updated Scorching Ray runtime JSON with `targeting.instanceAllocation` for the same ray mechanics.
- Closed `scorching-ray::manual_ray_allocation_and_scaling` with a `closedReason` value in `manual-review-overrides/level-2.json`.
- Closed the residual `magic-missile::manual_dart_allocation_and_scaling` row with a `closedReason` value in `manual-review-overrides/level-1.json`; the actual Magic Missile data was already updated in the earlier target-instance slice.
- Recorded a process-regression note in the Codex Desktop environment file after repeating the documented `rg` alternation failure with two finding ids joined by `|`.

Validation evidence for this slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed.
- Actionable index: 1362 open findings, 25 grouped mechanics families.
- `multi_instance_or_split_targeting`: 28 total findings, 22 open, 6 closed.

The between-batch modularization checkpoint after this slice was performed:

- This was another narrow data-only reuse slice, with no TypeScript or template changes.
- `src/types/spells.ts` remains about 1484 lines, `spellValidator.ts` remains about 993 lines, and `targetingSchemas.ts` remains about 278 lines.
- `spell-structured-template.json` remains about 4155 lines and `spell-json-template.json` remains about 3088 lines.
- `manual-review-overrides/level-1.json` is about 1754 lines and `manual-review-overrides/level-2.json` is about 2267 lines; the override shards remain a modularization candidate before large manual-review edits.

The third `choice_or_mode` sub-batch reused target-instance allocation for Eldritch Blast:

- Updated Eldritch Blast structured markdown with `Target Instance` fields for beams.
- Updated Eldritch Blast runtime JSON with `targeting.instanceAllocation` for one base beam, character-level tier scaling, same-or-different assignment, and sequential per-beam attack resolution.
- Corrected an adjacent target-eligibility drift found during canonical review: Eldritch Blast can target a creature or object, so structured `Valid Targets` and runtime `targeting.validTargets` now include both `creatures` and `objects`.
- Closed `eldritch-blast::choice_or_mode` and `eldritch-blast::multi_instance_or_split_targeting` with `closedReason` values in `manual-review-overrides/level-0-2-residual.json`.
- Recorded a Codex Desktop PowerShell learning after one mixed-path `rg` command returned an opaque Windows path syntax error; separate exact searches worked and are the safer pattern.

Validation evidence for this Eldritch Blast slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed.
- Actionable index: 1364 open findings, 25 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 142 open, 89 closed, 2 deferred flavor, 1 special question.
- `multi_instance_or_split_targeting`: 28 total findings, 24 open, 4 closed.

The between-batch modularization checkpoint after this slice was performed:

- This was a narrow data-only reuse of an already added field family; no TypeScript or template files changed in this slice.
- `src/types/spells.ts` and the two template JSON files remain the next broad-change modularization pressure points.
- Continue with another narrow reuse slice if possible; before adding a new schema family, revisit type/template splitting.

The second `choice_or_mode` sub-batch was completed for Magic Missile target-instance allocation:

- Added `TargetInstanceAllocation` to `src/types/spells.ts`.
- Added `targeting.instanceAllocation` validation to `src/systems/spells/validation/targetingSchemas.ts`.
- Added `targeting.instanceAllocation` JSON-schema coverage in `src/systems/spells/schema/spell.schema.json`.
- Added structured markdown template fields for:
  - `Target Instance Type`
  - `Target Instance Base Count`
  - `Target Instance Scaling Rule`
  - `Target Instance Assignment`
  - `Target Instance Resolution`
  - `Target Instance Notes`
- Added runtime JSON template entries for `targeting.instanceAllocation.*`.
- Added strict-template vocabulary and enum checks for the new structured fields.
- Updated Magic Missile structured markdown plus runtime JSON with dart count, slot-scaling, same-or-different target assignment, and simultaneous resolution data.
- Closed `magic-missile::choice_or_mode` with a `closedReason` value in `manual-review-overrides/level-1.json`.

Validation evidence for this Magic Missile slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\targetingSchemas.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed before and after dependency sync.
- Dependency sync succeeded for both `src/types/spells.ts` and `src/systems/spells/validation/targetingSchemas.ts`.
- Actionable index: 1366 open findings, 25 grouped mechanics families.
- `choice_or_mode`: 234 total findings, 143 open, 88 closed, 2 deferred flavor, 1 special question.

The between-batch modularization checkpoint after this slice was performed:

- `src/systems/spells/validation/spellValidator.ts` remains under 1000 lines after the prior targeting-schema extraction.
- `src/systems/spells/validation/targetingSchemas.ts` is still a small focused module at about 278 lines.
- `src/types/spells.ts` is now about 1484 lines and remains the main modularization pressure point before more broad type families are added.
- The two template JSON files remain large and should not be split until a loader/merge point exists.
- No behavior-preserving split was required before the next narrow `choice_or_mode` slice, but another broad schema family should trigger a focused type/template modularization decision first.

The first `choice_or_mode` sub-batch was completed for selected creatures inside an area:

- Added `AreaTargetSelection` to `src/types/spells.ts`.
- Added `targeting.areaTargetSelection` validation to `src/systems/spells/validation/spellValidator.ts`.
- Added `targeting.areaTargetSelection` JSON-schema coverage in `src/systems/spells/schema/spell.schema.json`.
- Added structured markdown template fields for:
  - `Area Target Selection Mode`
  - `Area Target Selection Scope`
  - `Area Target Selection Count`
  - `Area Target Selection Excludes Unchosen`
  - `Area Target Selection Requires Line Of Sight`
  - `Area Target Selection Notes`
- Added runtime JSON template entries for `targeting.areaTargetSelection.*`.
- Added strict-template vocabulary and enum checks for the new structured fields.
- Updated Word of Radiance and Sleep structured markdown plus runtime JSON with selected-area targeting data.
- Closed `word-of-radiance::choice_or_mode` and `sleep::choice_or_mode` with `closedReason` values.

Validation evidence for this selected-area slice:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Typecheck: passed before and after dependency sync.
- Actionable index: 1367 open findings, 25 grouped mechanics families.

The selected-area slice also completed its between-batch modularization checkpoint:

- Extracted targeting-related Zod schemas from `src/systems/spells/validation/spellValidator.ts` into `src/systems/spells/validation/targetingSchemas.ts`.
- `spellValidator.ts` decreased from about 1192 lines to about 993 lines.
- `targetingSchemas.ts` is about 248 lines and owns runtime targeting, target filters, spatial details, and selected-area targeting validation.
- Re-ran `npx tsx scripts\validateSpellJsons.ts`; output stayed 459 valid, 0 invalid.
- Re-ran `npx tsx scripts\auditSpellRuntimeTemplate.ts`; output stayed 98 warnings, 0 errors, 7 grouped warning families.
- Re-ran `npm run typecheck`; it passed.
- Dependency sync succeeded for both `spellValidator.ts` and `targetingSchemas.ts`.

The `repeat_save_or_recurring_check` bucket is now closed:

- Added repeat-save progression support for counted success/failure tracks such as Contagion and Flesh to Stone.
- Added recurring mechanics support for turn-start, turn-end, on-damage, proximity, and pre-cast gate mechanics.
- Updated structured markdown and runtime JSON for Heroism, Searing Smite, Tasha's Hideous Laughter, Conjure Animals, Enemies Abound, Slow, Confusion, Elemental Bane, Conjure Elemental, Contagion, Tree Stride, Wall of Light, Flesh to Stone, and Power Word Pain.
- Closed all 15 previously open repeat/recurring rows with `closedReason` values in their manual-review override entries.
- Fixed `scripts/auditSpellMechanicsDiscovery.ts` so generated bucket reports use `closedReason` separately from the original issue text.
- Verified `docs/tasks/spells/mechanics-discovery/buckets/repeat_save_or_recurring_check.md` reports 39 total findings, 0 open, 39 closed.

Validation evidence for this batch:

```powershell
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1369 open findings, 25 grouped mechanics families.

The between-batch modularization checkpoint was also performed:

- Extracted the strict-template vocabulary out of `scripts/auditSpellRuntimeTemplate.ts` into `scripts/spellRuntimeTemplateAudit/vocabulary.ts`.
- `scripts/auditSpellRuntimeTemplate.ts` decreased from about 1920 lines to 1606 lines.
- The new vocabulary module is about 360 lines and contains the static field/value registry.
- Re-ran `npx tsx scripts\auditSpellRuntimeTemplate.ts`; output remained 98 warnings, 0 errors, 7 grouped warning families.
- Re-ran `npm run typecheck`; it passed.

The `damage_reduction_or_prevention` bucket was closed before this handoff:

- Elemental Bane now records resistance suppression.
- Warding Bond linked damage records post-target-mitigation semantics and does not reapply caster mitigation.
- Wish, Life Transference, and Create Homunculus now record mitigation bypass where damage cannot be reduced or prevented.
- Hallow now records resistance/vulnerability via neutral `damageInteraction`.
- `damage_reduction_or_prevention.md` reported 29 total findings, 0 open.

The deferred flavor report drift was also corrected:

- `leomunds-secret-chest::deferred_descriptive_flavor` was closed as a misbucket only. Its real mechanics remain open under planar storage, placement, linked object, and conditional ending buckets.
- `otilukes-resilient-sphere::deferred_descriptive_flavor` was closed as a misbucket only. Its real mechanics remain open under barrier/enclosure, save, forced movement, targeting, and conditional ending buckets.
- After regeneration, `deferred_descriptive_flavor` disappeared from `ACTIONABLE_SCHEMA_BUCKETS.md`.

## Armor of Agathys Temp-HP Depletion Slice

The Armor of Agathys temp-HP depletion slice closed two rows across `conditional_ending` and `object_stats_or_damageability`:

- Added `temporary_hit_points_depleted` as a Conditional Ending Trigger in the structured trigger registry, runtime validator vocabulary, and runtime-template audit vocabulary.
- Updated Armor of Agathys structured markdown and runtime JSON with `Conditional Ending Triggers: temporary_hit_points_depleted`, `Conditional Ending Scope: spell`, and matching runtime `conditionalEndings[]` data on both the temporary-hit-point defensive effect and the retaliatory cold-damage effect.
- Closed:
  - `armor-of-agathys::conditional_ending`
  - `armor-of-agathys::object_stats_or_damageability`
- Preserved the existing `Defense Type: temporary_hp`, `Defense Value: 5`, damage trigger, damage amount, and slot scaling fields; this slice only made the temp-HP depletion relationship explicit.
- Performed the mandatory file-ballooning checkpoint by moving older handoff detail into this batch history file and adding `scripts/modularizeMechanicsClosureHandoff.ts`.

Validation evidence:

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
npx tsx scripts\modularizeMechanicsClosureHandoff.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed after dependency sync.
- Actionable index after the slice and handoff split: 1316 open findings, 24 grouped mechanics families.

## Mage Armor Armor-Donning Early-Ending Slice

The Mage Armor armor-donning early-ending slice closed one `conditional_ending` row:

- Confirmed `target_dons_armor` was already present in the structured trigger registry, runtime validator vocabulary, and runtime-template audit vocabulary.
- Mage Armor structured markdown already recorded `Conditional Ending Triggers: target_dons_armor` and `Conditional Ending Scope: spell`.
- Updated Mage Armor runtime JSON with matching `effects[].conditionalEndings[]` data.
- Closed `mage-armor::conditional_ending`.
- Preserved the existing `set_base_ac` defensive effect, `baseACFormula`, and `restrictions.noArmor` data; this slice only separated the early-ending rule from the ongoing eligibility restriction.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
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
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1315 open findings, 24 grouped mechanics families.

## Goodberry Normal-Duration Cleanup Misbucket Slice

The Goodberry normal-duration cleanup misbucket slice closed one `conditional_ending` row:

- Reviewed the canonical phrase "Uneaten berries disappear when the spell ends" as ordinary 24-hour duration cleanup rather than an early-ending trigger.
- Left Goodberry's real created-berry, healing, nourishment, and cleanup mechanics open in the created-consumable/resource/healing buckets.
- No structured markdown or runtime JSON shape changed in this slice.
- Closed `goodberry::conditional_ending`.

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
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1314 open findings, 24 grouped mechanics families.

## Feather Fall Fall-Control Slice

The Feather Fall fall-control slice closed one `conditional_ending` row and added a reusable fall-control field family:

- Added `target_lands` as a Conditional Ending Trigger.
- Added structured fields for fall descent rate, fall descent unit, landing damage handling, and landing ending.
- Added runtime `effects[].fallControl`.
- Updated Feather Fall structured markdown and runtime JSON with 60 feet per round descent, fall-damage prevention, and per-target `target_lands` ending.
- Closed `feather-fall::conditional_ending`.
- Performed a modularization checkpoint by splitting fall-control ownership into:
  - `src/types/spellFallMetadata.ts`
  - `src/systems/spells/validation/fallControlSchemas.ts`

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellFallMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\fallControlSchemas.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1313 open findings, 24 grouped mechanics families.

## Sleep Condition-Break Slice

The Sleep condition-break slice closed one `conditional_ending` row and completed the existing status-condition break trigger path:

- Added `adjacent_creature_action_shakes_awake` as a `Condition Break Triggers` value.
- Wired `effects[].statusCondition.breakTriggers[]` into TypeScript, Zod validation, JSON schema, structured/runtime template shards, and strict runtime-template vocabulary.
- Updated Sleep structured markdown with `Condition Break Triggers: target_takes_damage, adjacent_creature_action_shakes_awake`.
- Updated both Sleep runtime status stages with matching `statusCondition.breakTriggers[]` data.
- Closed `sleep::conditional_ending`.
- Performed a modularization checkpoint by splitting condition-break ownership into:
  - `src/types/spellStatusMetadata.ts`
  - `src/systems/spells/validation/statusConditionSchemas.ts`

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellStatusMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\statusConditionSchemas.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1312 open findings, 24 grouped mechanics families.

## Jump Duration-Scope Misbucket Slice

The Jump duration-scope misbucket slice closed one `conditional_ending` row:

- Reviewed the canonical phrase "until the spell ends" as ordinary duration scoping for the granted jump option.
- Left the actual once-per-turn 30-foot jump option with 10-foot movement spend open under `jump::manual_fixed_jump_option` in `movement_or_repositioning`.
- No structured markdown or runtime JSON shape changed in this slice.
- Closed `jump::conditional_ending`.
- Performed a modularization checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` remained reviewable.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` crossed the review threshold, so `scripts/modularizeMechanicsClosureBatchHistory.ts` split archived detail into indexed part files.

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
npx tsx scripts\modularizeMechanicsClosureBatchHistory.ts
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1312 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 119 open, 118 closed.
