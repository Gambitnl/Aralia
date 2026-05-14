# Catnap
- **Level**: 3
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Bard, Sorcerer, Wizard, Artificer
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 30
- **Targeting Type**: multi
- **Targeting Max**: 3
- **Valid Targets**: creatures
- **Target Willingness**: required
- **Target Object Worn Or Carried**: not_applicable
- **Target Object Magical Status**: not_applicable
- **Target Object Fixed To Surface**: not_applicable
- **Target Object Max Size**: not_applicable
- **Target Object Max Weight Pounds**: not_applicable
- **Target Object Max Weight Scaling**: not_applicable
- **Target Can Hear Caster**: not_applicable
- **Target Can Understand Caster**: not_applicable
- **Target Can See Caster**: not_applicable
- **Target Ability Threshold Ability**: not_applicable
- **Target Ability Threshold Operator**: not_applicable
- **Target Ability Threshold Value**: not_applicable
- **Target Self Relation**: not_applicable
- **Line of Sight**: true

- **Verbal**: false
- **Somatic**: true
- **Material**: true
- **Material Description**: a pinch of sand
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Type**: STATUS_CONDITION, UTILITY
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Utility Type**: other
- **Conditions Applied**: Unconscious
- **Condition Break Triggers**: target_takes_damage, adjacent_creature_action_shakes_awake

- **Description**: You make a calming gesture, and up to three willing creatures of your choice that you can see within range fall unconscious for the spell's duration. The spell ends on a target early if it takes damage or someone uses an action to shake or slap it awake. If a target remains unconscious for the full duration, that target gains the benefit of a short rest, and it can't be affected by this spell again until it finishes a long rest.
- **Higher Levels**: When you cast this spell using a spell slot of 4th level or higher, you can target one additional willing creature for each slot level above 3rd.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: targeting.maxTargets
- **Scaling Rule 1 Bonus Per Level**: +1 target
- **Scaling Rule 1 Notes**: When you cast this spell using a spell slot of 4th level or higher, you can target one additional willing creature for each slot level above 3rd.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Catnap
Level: 3rd
Casting Time: 1 Action
Range/Area: 30 ft.
Components: S, M *
Duration: 10 Minutes
School: Enchantment
Attack/Save: None
Damage/Effect: Buff (...)

Rules Text:
You make a calming gesture, and up to three willing creatures of your choice that you can see within range fall unconscious for the spell's duration. The spell ends on a target early if it takes damage or someone uses an action to shake or slap it awake. If a target remains unconscious for the full duration, that target gains the benefit of a short rest, and it can't be affected by this spell again until it finishes a long rest.
At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, you can target one additional willing creature for each slot level above 3rd.

Material Component:
* - (a pinch of sand)

Spell Tags:
Buff
Utility

Available For:
Bard
Sorcerer
Wizard
Artificer

Capture Method: http
Legacy Page: false
-->
