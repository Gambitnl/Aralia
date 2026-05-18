# Mechanics Closure Batch History Part 02

## Sanctuary Early-Ending Trigger Slice

The Sanctuary early-ending trigger slice closed one `conditional_ending` row:

- Added three Conditional Ending Trigger values:
  - `target_makes_attack_roll`
  - `target_casts_spell`
  - `target_deals_damage`
- Updated Sanctuary structured markdown with `Conditional Ending Triggers: target_makes_attack_roll, target_casts_spell, target_deals_damage` and `Conditional Ending Scope: spell`.
- Updated Sanctuary runtime JSON with matching `conditionalEndings[]` data on the existing ending-effect packet.
- Corrected stale runtime wording from "casts a spell that affects an enemy" to the canonical broader "casts a spell".
- Left Sanctuary's ward trigger, Wisdom-save branch, failed-save choice, and area-effect bypass mechanics open in their own buckets.
- Closed `sanctuary::conditional_ending`.

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
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1310 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 118 open, 119 closed.

## Tenser's Floating Disk Ending-Trigger Slice

The Tenser's Floating Disk ending-trigger slice closed one `conditional_ending` row:

- Added `carried_weight_exceeds_limit` as a Conditional Ending Trigger.
- Reused existing `beyond_max_distance` for the 100-foot caster distance ending.
- Updated Tenser's Floating Disk structured markdown with `Conditional Ending Triggers: carried_weight_exceeds_limit, beyond_max_distance` and `Conditional Ending Scope: spell, spell`.
- Updated Tenser's Floating Disk runtime JSON with matching `conditionalEndings[]` data on the SUMMONING effect.
- Left disk object capacity, terrain traversal, and travel/follow mechanics open in their own buckets.
- Closed `tensers-floating-disk::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint and added this Part 02 archive so the active handoff did not keep accumulating older batch detail.

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
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1309 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 117 open, 120 closed.
- `object_stats_or_damageability`: 92 total findings, 56 open, 36 closed.

## Unseen Servant Ending-Trigger Slice

The Unseen Servant ending-trigger slice closed one `conditional_ending` row:

- Added `created_entity_drops_to_0_hp` as a Conditional Ending Trigger.
- Reused existing `beyond_max_distance` for the servant leaving the spell range.
- Updated Unseen Servant structured markdown with `Conditional Ending Triggers: created_entity_drops_to_0_hp, beyond_max_distance` and `Conditional Ending Scope: spell, spell`.
- Updated Unseen Servant runtime JSON with matching `conditionalEndings[]` data on the SUMMONING effect.
- Left AC/HP/Strength, command action, movement, invisibility, and task-capability mechanics open in their own buckets.
- Closed `unseen-servant::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint before selecting another bucket:
  - `MECHANICS_CLOSURE_HANDOFF.md` remained under 300 lines before this update and is still the active restart surface.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remained about 434 lines and now acts as an index plus older pre-split detail.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remained about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` was created for recent conditional-ending batches and remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` is under 900 lines after prior schema splits, so no new split was needed for this narrow trigger reuse.
  - Split the oversized manual-review shards `level-2.json`, `level-3-20-39.json`, `level-3-40-59.json`, and `level-3-residual.json` into smaller shards before selecting another mechanics bucket.
  - Updated the manual-review loader and splitter so one spell's long `manualFindings` array can be split across files and concatenated safely during audit loading.
  - Re-ran mechanics discovery, actionable-bucket regeneration, and typecheck after the split; the actionable count stayed at 1308.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
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
- Actionable index: 1308 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 116 open, 121 closed.
- Post-checkpoint mechanics-discovery regeneration stayed equivalent: 1308 actionable open findings, 24 grouped mechanics families.

## Witch Bolt Ending-Trigger Slice

The Witch Bolt ending-trigger slice closed one `conditional_ending` row:

- Added two Conditional Ending Trigger values:
  - `target_outside_spell_range`
  - `target_has_total_cover_from_caster`
- Updated Witch Bolt structured markdown with `Conditional Ending Triggers: target_outside_spell_range, target_has_total_cover_from_caster` and `Conditional Ending Scope: spell, spell`.
- Updated Witch Bolt runtime JSON with matching `conditionalEndings[]` data on the sustained later-turn damage effect.
- Left the sustained-link damage relationship open in the separate `attack_or_save_modifier` and `ward_alarm_or_trigger` rows.
- Closed `witch-bolt::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 299 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains small enough to keep receiving recent conditional-ending slices.
  - `src/systems/spells/validation/spellValidator.ts` is about 899 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 549 lines.
  - No additional split was needed before another narrow trigger-vocabulary slice.

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
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1307 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 115 open, 122 closed.

## Invisibility Early-Ending Trigger Slice

The Invisibility early-ending trigger slice closed two rows by typing one canonical mechanic:

- Reused existing Conditional Ending Trigger values:
  - `target_makes_attack_roll`
  - `target_deals_damage`
  - `target_casts_spell`
- Updated Invisibility structured markdown with `Conditional Ending Triggers: target_makes_attack_roll, target_deals_damage, target_casts_spell` and `Conditional Ending Scope: spell, spell, spell`.
- Updated Invisibility runtime JSON with matching `conditionalEndings[]` data on the STATUS_CONDITION effect.
- Closed `invisibility::conditional_ending`.
- Closed `invisibility::attack_or_save_modifier` as a duplicate extraction artifact because the attack-roll wording belongs to the early-ending rule, not to a separate attack/save modifier.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 296 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` remains about 899 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` remains about 549 lines.
  - No additional split was needed because this slice reused existing trigger values and did not grow schema/type surfaces.

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
- Template aggregate check: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1305 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 114 open, 123 closed.
- `attack_or_save_modifier`: 303 total findings, 125 open, 178 closed.

## Levitate Conditional-Ending Misbucket Closure

The Levitate conditional-ending closure closed one duplicate/misbucketed `conditional_ending` row without changing spell data:

- Reviewed Levitate canonical prose, structured markdown, runtime JSON, and related bucket rows.
- Confirmed "When the spell ends, the target floats gently to the ground if it is still aloft" is an end-of-spell aftermath behavior, not a trigger that ends the spell early.
- Left the actual gentle-descent mechanic open under `levitate::aftermath_or_memory`.
- Left Levitate's other movement, forced movement, terrain/surface, target weight, and save-applicability rows open.
- Closed `levitate::conditional_ending` with a `closedReason`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 302 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` remains about 899 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` remains about 549 lines.
  - No modularization was needed for this report-only closure.

Validation evidence:

```powershell
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Actionable index: 1304 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 113 open, 124 closed.

## Skywrite Strong-Wind Ending Slice

The Skywrite strong-wind ending slice closed one `conditional_ending` row:

- Added `strong_wind_disperses_effect` as a Conditional Ending Trigger.
- Updated Skywrite structured markdown with `Conditional Ending Triggers: strong_wind_disperses_effect` and `Conditional Ending Scope: spell`.
- Updated Skywrite runtime JSON with matching `conditionalEndings[]` data on the UTILITY effect.
- Narrowed the still-open `skywrite::environmental_change` row so it covers only the cloud-message/environment object creation, not the wind ending.
- Left Skywrite's visible sky-writing and public-message mechanics open under their own buckets.
- Closed `skywrite::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 284 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` is about 900 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 550 lines.
  - No additional split was needed before another narrow trigger-vocabulary slice.

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
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1303 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 112 open, 125 closed.

## Summon Beast 0-HP Disappearance Slice

The Summon Beast 0-HP disappearance slice closed one `conditional_ending` row:

- Reused `created_entity_drops_to_0_hp` as the Conditional Ending Trigger.
- Tightened the template note for `created_entity_drops_to_0_hp` so it covers spell endings, effect endings, and summoned-entity disappearance.
- Updated Summon Beast structured markdown with `Conditional Ending Triggers: created_entity_drops_to_0_hp` and `Conditional Ending Scope: effect`.
- Updated Summon Beast runtime JSON with matching `conditionalEndings[]` data on the SUMMON/UTILITY effect.
- Used `effect` scope because the canonical prose says the creature disappears when it reaches 0 Hit Points; it does not explicitly say the whole spell ends.
- Left Summon Beast's mode choice, stat block, command behavior, placement, traits, and summon-control mechanics open in their own buckets.
- Closed `summon-beast::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 302 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` remains about 900 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` remains about 550 lines.
  - No additional split was needed before another narrow trigger reuse slice.

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
- Actionable index: 1302 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 111 open, 126 closed.

## Warding Bond Link-Ending Slice

The Warding Bond link-ending slice closed one `conditional_ending` row:

- Added three Conditional Ending Trigger values:
  - `caster_drops_to_0_hp`
  - `linked_creatures_separated_beyond_distance`
  - `spell_cast_again_on_connected_creature`
- Updated Warding Bond structured markdown with all three triggers and `Conditional Ending Scope: spell, spell, spell`.
- Updated Warding Bond runtime JSON with matching `conditionalEndings[]` data on the linked-damage UTILITY effect.
- Updated the previously closed linked-damage review note so it no longer says the 0-HP, distance, and recast endings remain open.
- Left Warding Bond's saving throw bonus, ring-wearing duration requirement, and benefit-range gating open in their own rows.
- Closed `warding-bond::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 303 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` is about 903 lines after dependency sync.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 553 lines.
  - No additional split was needed before another narrow trigger-vocabulary slice.

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
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\spellValidator.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 98 warnings, 0 errors, 7 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Actionable index: 1301 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 110 open, 127 closed.

## Catnap Condition-Break Slice

The Catnap condition-break slice closed one `conditional_ending` row by reusing the existing Sleep condition-break model:

- Reused `target_takes_damage` and `adjacent_creature_action_shakes_awake` as Condition Break Trigger values.
- Broadened the structured-template note for `adjacent_creature_action_shakes_awake` so it explicitly covers wake, shake, slap, or otherwise rouse wording.
- Updated Catnap structured markdown with `Condition Break Triggers: target_takes_damage, adjacent_creature_action_shakes_awake`.
- Updated Catnap runtime JSON with matching `statusCondition.breakTriggers[]` data on the Unconscious STATUS_CONDITION effect.
- Left Catnap's full-duration short-rest benefit and long-rest lockout open under `catnap::status_or_state_change`.
- Closed `catnap::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 305 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` remains about 903 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` remains about 553 lines.
  - No additional split was needed because this slice reused the split status-condition break-trigger module.

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
- Actionable index: 1300 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 109 open, 128 closed.

## Tasha's Hideous Laughter Repeat-Save Residual Closure

The Tasha's Hideous Laughter residual closure closed three stale rows without changing spell data:

- Confirmed runtime `statusCondition.repeatSave` already records:
  - `timing: turn_end`
  - `additionalTimings: [on_damage]`
  - `saveType: Wisdom`
  - `successEnds: true`
  - `modifiers.advantageOnDamage: true`
- Closed `tashas-hideous-laughter::attack_or_save_modifier` because the initial save, repeat save, damage-triggered repeat timing, and damage-triggered Advantage are represented.
- Closed `tashas-hideous-laughter::ward_alarm_or_trigger` because the damage trigger is represented as repeat-save timing, not an untyped ward/trigger.
- Closed `tashas-hideous-laughter::conditional_ending` because both repeat-save paths use `successEnds: true`.
- Left the real Prone self-ending lock issue open under `tashas-hideous-laughter::status_or_state_change`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 302 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` remains about 434 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` remains about 509 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` remains reviewable after adding this entry.
  - `src/systems/spells/validation/spellValidator.ts` remains about 903 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` remains about 553 lines.
  - No modularization was needed for this report-only closure.

Validation evidence:

```powershell
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Actionable index: 1297 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 108 open, 129 closed.
- `attack_or_save_modifier`: 303 total findings, 124 open, 179 closed.
- `ward_alarm_or_trigger`: 60 total findings, 30 open, 29 closed, 1 deferred flavor.

## Searing Smite Repeat-Save Residual Closure

The Searing Smite residual closure closed one stale `conditional_ending` row without changing spell data:

- Confirmed structured markdown already records:
  - `Repeat Save Timing: turn_start`
  - `Repeat Save Type: Constitution`
  - `Repeat Save Success Ends: true`
- Confirmed runtime JSON already records:
  - `statusCondition.repeatSave.timing: turn_start`
  - `statusCondition.repeatSave.saveType: Constitution`
  - `statusCondition.repeatSave.successEnds: true`
- Confirmed runtime `recurringMechanics` already records the damage-then-save order: start-turn Fire damage happens before the Constitution save that can end the spell.
- Closed `searing-smite::conditional_ending`.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 371 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` is about 509 lines and remains usable as the index.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` is about 632 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 471 lines before this entry and remains reviewable.
  - `manual-review-overrides/level-1-02.json` is about 376 lines after this closure.
  - `src/systems/spells/validation/spellValidator.ts` is about 987 lines.
  - `src/types/spells.ts` is about 1195 lines.
  - `scripts/auditSpellRuntimeTemplate.ts` is about 1690 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 558 lines.
  - No modularization was needed for this report-only closure.

Validation evidence:

```powershell
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

Results:

- Actionable index: 1296 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 107 open, 130 closed.

## Compulsion After-Forced-Movement Repeat-Save Slice

The Compulsion slice closed two rows across `status_or_state_change` and `conditional_ending`:

- Added `after_forced_movement` as a repeat-save timing value in:
  - `docs/tasks/spells/templates/parts/structured/11-90-descriptions-and-misc.json`
  - `docs/tasks/spells/templates/parts/runtime-json/07-30-effects-damage-and-conditions.json`
  - `docs/tasks/spells/templates/spell-structured-template.json`
  - `docs/tasks/spells/templates/spell-json-template.json`
  - `src/types/spells.ts`
  - `src/systems/spells/validation/spellValidator.ts`
  - `src/systems/spells/schema/spell.schema.json`
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts`
  - `scripts/auditSpellRuntimeTemplate.ts`
- Updated Compulsion structured markdown with:
  - `Repeat Save Timing: after_forced_movement`
  - `Repeat Save Type: Wisdom`
  - `Repeat Save Success Ends: true`
- Updated Compulsion runtime JSON so `statusCondition.repeatSave.timing` is `after_forced_movement` instead of the previous generic `turn_end` approximation.
- Closed:
  - `compulsion::status_or_state_change`
  - `compulsion::conditional_ending`
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 369 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` is about 509 lines and remains usable as the index.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` is about 632 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 509 lines before this entry and remains reviewable.
  - `manual-review-overrides/level-4-00-19.json` is about 651 lines after this closure.
  - `src/systems/spells/validation/spellValidator.ts` is about 988 lines.
  - `src/types/spells.ts` is about 1200 lines.
  - `scripts/auditSpellRuntimeTemplate.ts` is about 1696 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 582 lines.
  - No modularization was needed before another narrow slice, but `src/types/spells.ts` and `scripts/auditSpellRuntimeTemplate.ts` remain watch items before adding broad new field families.

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
- Template aggregate sync: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1294 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 106 open, 131 closed.
- `status_or_state_change`: 171 total findings, 88 open, 83 closed.

## Snare Escape-Check And Cleanup-Ending Slice

The Snare slice closed one `conditional_ending` row:

- Added first-class Escape Check structured/runtime template fields for:
  - ability
  - skill
  - DC
  - action cost
  - eligible actors
- Extended runtime escapeCheck typing, Zod validation, and JSON Schema with `eligibleActors`.
- Added `no_creature_restrained_by_spell_after_trigger` as a Conditional Ending Trigger.
- Updated Snare structured markdown with the end-turn Dexterity repeat save, Intelligence (Arcana) action escape check, eligible actors, and cleanup ending.
- Updated Snare runtime JSON with:
  - `escapeCheck.skill: Arcana`
  - `escapeCheck.eligibleActors: affected_creature, creature_that_can_reach_affected_creature`
  - a conditional ending for the post-trigger no-creature-restrained cleanup.
- Closed `snare::conditional_ending`.
- Updated `snare::ward_alarm_or_trigger` so the still-open issue now focuses on the ground/floor trap movement trigger, not the cleanup ending that this slice closed.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 392 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` is about 509 lines and remains usable as the index.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` is about 632 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 572 lines before this entry and remains reviewable.
  - `manual-review-overrides/level-1-03.json` is about 375 lines after this closure.
  - `src/systems/spells/validation/spellValidator.ts` is about 993 lines.
  - `src/types/spells.ts` is about 1234 lines.
  - `scripts/auditSpellRuntimeTemplate.ts` is about 1702 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 603 lines.
  - The oversized runtime template part was split from `07-30-effects-damage-and-conditions.json` into:
    - `07-30-effects-damage-core.json`: about 499 lines
    - `07-31-effects-status-repeat-escape.json`: about 538 lines
  - Added `scripts/splitSpellTemplatePart.ts` as a focused behavior-preserving splitter for future one-shard template modularization.

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
npx tsx scripts\splitSpellTemplatePart.ts docs\tasks\spells\templates\parts\runtime-json\07-30-effects-damage-and-conditions.json 28 07-30-effects-damage-core.json 07-31-effects-status-repeat-escape.json
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template aggregate sync before the split: structured aggregate matched 35 parts; runtime JSON aggregate matched 18 parts.
- Template aggregate sync after the split: structured aggregate matched 35 parts; runtime JSON aggregate matched 19 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Typecheck: passed before and after adding the splitter.
- Dependency sync: `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` updated successfully.
- Actionable index: 1293 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 105 open, 132 closed.

## Fear Line-Of-Sight Repeat-Save Prerequisite Slice

The Fear slice closed two rows across `attack_or_save_modifier` and `conditional_ending`:

- Added `Repeat Save Prerequisites` to the structured and runtime template registries.
- Added `no_line_of_sight_to_caster` as the first repeat-save prerequisite value.
- Extended runtime repeatSave typing, Zod validation, JSON Schema, and strict audit vocabulary with repeat-save prerequisites.
- Updated Fear structured markdown with:
  - `Repeat Save Timing: turn_end`
  - `Repeat Save Type: Wisdom`
  - `Repeat Save Success Ends: true`
  - `Repeat Save Prerequisites: no_line_of_sight_to_caster`
- Updated Fear runtime JSON with `statusCondition.repeatSave.prerequisites: [no_line_of_sight_to_caster]`.
- Closed:
  - `fear::attack_or_save_modifier`
  - `fear::conditional_ending`
- Left `fear::status_or_state_change` open for held-item dropping and forced Dash-away behavior.
- Performed the mandatory file-ballooning checkpoint:
  - `MECHANICS_CLOSURE_HANDOFF.md` is about 399 lines before this archive update.
  - `MECHANICS_CLOSURE_BATCH_HISTORY.md` is about 509 lines and remains usable as the index.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_01.md` is about 632 lines.
  - `MECHANICS_CLOSURE_BATCH_HISTORY_PART_02.md` is about 637 lines before this entry and remains reviewable.
  - `manual-review-overrides/level-3-20-39-00-00-00.json` is about 194 lines after this closure.
  - `src/systems/spells/validation/spellValidator.ts` is about 998 lines.
  - `src/types/spells.ts` is about 1239 lines.
  - `scripts/auditSpellRuntimeTemplate.ts` is about 1704 lines.
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts` is about 608 lines.
  - `runtime-json/07-31-effects-status-repeat-escape.json` is about 556 lines.
  - No modularization was needed for this narrow prerequisite slice.

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
- Actionable index: 1291 open findings, 24 grouped mechanics families.
- `conditional_ending`: 237 total findings, 104 open, 133 closed.
- `attack_or_save_modifier`: 303 total findings, 123 open, 180 closed.
