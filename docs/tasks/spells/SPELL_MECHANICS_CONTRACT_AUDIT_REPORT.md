# Spell Mechanics Contract Audit

This report maps live spell JSON fields against the checked-in JSON schema, TypeScript spell field names, and obvious runtime reads.

Generated: 2026-05-14T05:23:35.215Z
Spells scanned: 459
Live JSON fields: 793
Schema fields: 484
Type field tokens: 275
Runtime read tokens: 1558

## Status Counts

- Aligned: 149
- JSON-only: 345
- Type gaps: 154
- Review: 145
- Schema-only: 36

## Highest Priority JSON-Only Fields

- `effects[].condition.type` (459 spells, 860 occurrences) samples: always | save | hit
- `effects[].trigger.type` (459 spells, 860 occurrences) samples: immediate | on_caster_action | on_enter_area | on_attack_hit | turn_start
- `effects[].trigger.attackFilter.attackType` (459 spells, 853 occurrences) samples: any | weapon | spell
- `effects[].trigger.attackFilter.weaponType` (459 spells, 853 occurrences) samples: any | melee | ranged
- `effects[].trigger.consumption` (459 spells, 853 occurrences) samples: unlimited | first_hit | per_turn | per_instance_hit_or_miss
- `effects[].trigger.frequency` (459 spells, 853 occurrences) samples: every_time | first_per_turn | once | once_per_creature
- `effects[].trigger.movementType` (459 spells, 853 occurrences) samples: any | willing | forced
- `effects[].trigger.sustainCost.actionType` (459 spells, 853 occurrences) samples: action | bonus_action | reaction
- `effects[].trigger.sustainCost.optional` (459 spells, 853 occurrences) samples: false | true
- `effects[].condition.targetFilter.abilityThreshold.ability` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.abilityThreshold.operator` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.abilityThreshold.value` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.communicationPrerequisites.canHearCaster` (459 spells, 785 occurrences) samples: not_applicable | required
- `effects[].condition.targetFilter.communicationPrerequisites.canSeeCaster` (459 spells, 785 occurrences) samples: not_applicable | required
- `effects[].condition.targetFilter.communicationPrerequisites.canUnderstandCaster` (459 spells, 785 occurrences) samples: not_applicable | required
- `effects[].condition.targetFilter.isNativeToPlane` (459 spells, 785 occurrences) samples: false
- `effects[].condition.targetFilter.objectEligibility.fixedToSurface` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.objectEligibility.magicalStatus` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.objectEligibility.maxSize` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.objectEligibility.maxWeightPounds` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.objectEligibility.maxWeightScaling` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.objectEligibility.wornOrCarried` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.selfRelation` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].condition.targetFilter.willing` (459 spells, 785 occurrences) samples: not_applicable
- `effects[].scaling.bonusPerLevel` (459 spells, 744 occurrences) samples:  | +1d8 | +1d6 | +1d10 | +1 target

## Type Gaps With Runtime Reads

- `targeting.filter.isNativeToPlane` (459 spells, 459 occurrences)
- `targeting.lineOfSight` (459 spells, 459 occurrences)
- `targeting.maxTargets` (459 spells, 446 occurrences)
- `targeting.areaOfEffect.height` (133 spells, 133 occurrences)
- `modeChoice.options[].label` (8 spells, 32 occurrences)
- `modeChoice.options[].summary` (8 spells, 32 occurrences)
- `effects[].attackAugments[].damageTypeChoice.options[].label` (2 spells, 4 occurrences)
- `effectSchedule.entries[].label` (1 spells, 4 occurrences)
- `effectSchedule.entries[].summary` (1 spells, 4 occurrences)
- `effects[].damageInteraction.modes[]` (1 spells, 2 occurrences)
- `effects[].sensoryManifestation.variants[].label` (1 spells, 2 occurrences)
- `effects[].endCleanup[].amount` (1 spells, 1 occurrences)
- `effects[].linkedDamage.amount` (1 spells, 1 occurrences)
- `targeting.areaOfEffect.shapeVariant.default` (1 spells, 1 occurrences)
- `targeting.areaOfEffect.width` (1 spells, 1 occurrences)
- `effects[].damageInteraction.modes` (1 spells, 0 occurrences)
- `effects[].sensoryManifestation.variants` (1 spells, 0 occurrences)
- `effects[].sensoryManifestation.variants[]` (1 spells, 0 occurrences)
- `targeting.filter` (459 spells, 0 occurrences)
- `targeting.maxTargets.scaling.thresholds` (13 spells, 0 occurrences)

## Schema-Only Fields

- `effects[].abilityCheckModifier.flatModifier`
- `effects[].attackAugments[].damageDieOverride.notes`
- `effects[].count`
- `effects[].creatureId`
- `effects[].damageReduction.flat`
- `effects[].objectDescription`
- `effects[].savingThrow[]`
- `effects[].statusCondition.recurringMechanics`
- `effects[].statusCondition.recurringMechanics[]`
- `effects[].statusCondition.recurringMechanics[].damage`
- `effects[].statusCondition.recurringMechanics[].damage.dice`
- `effects[].statusCondition.recurringMechanics[].damage.type`
- `effects[].statusCondition.recurringMechanics[].failureOutcome`
- `effects[].statusCondition.recurringMechanics[].frequency`
- `effects[].statusCondition.recurringMechanics[].healing`
- `effects[].statusCondition.recurringMechanics[].healing.dice`
- `effects[].statusCondition.recurringMechanics[].healing.isTemporaryHp`
- `effects[].statusCondition.recurringMechanics[].notes`
- `effects[].statusCondition.recurringMechanics[].restriction`
- `effects[].statusCondition.recurringMechanics[].saveEffect`
- `effects[].statusCondition.recurringMechanics[].saveType`
- `effects[].statusCondition.recurringMechanics[].successOutcome`
- `effects[].statusCondition.recurringMechanics[].timing`
- `effects[].statusCondition.repeatSave.modifiers.sizeDisadvantage`
- `effects[].statusCondition.repeatSave.modifiers.sizeDisadvantage[]`
- `effects[].summonType`
- `effectSchedule.entries[].notes`
- `source`
- `targeting.areaOfEffect.wallStats`
- `targeting.areaOfEffect.wallStats.ac`
- `targeting.areaOfEffect.wallStats.hpPerSection`
- `targeting.areaOfEffect.wallStats.sectionSize`
- `targeting.filter.alignments[]`
- `targeting.filter.hasCondition[]`
- `targeting.radius`
- `targeting.shape`

## Notes

- Runtime-read detection is token based. It is useful for triage, not proof of complete behavior.
- Type detection is based on field-name tokens in `src/types/spells.ts`, so nested fields with common names may need manual review.
- Use this report to decide where spell-related `any` casts are hiding real contract drift before replacing them.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/SPELL_MECHANICS_CONTRACT_AUDIT_REPORT.md","sha256WithoutMarker":"466eed68789ed541091422a664bbabaa01930556d237edd47704045532a54654","markedAtUtc":"2026-06-25T22:29:38.553Z"} -->
