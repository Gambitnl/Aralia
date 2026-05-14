# Chromatic Orb
- **Level**: 1
- **School**: Evocation
- **Ritual**: false
- **Classes**: Sorcerer, Wizard
- **Sub-Classes**: Folded into Classes

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 90
- **Targeting Type**: single
- **Valid Targets**: creatures
- **Target Willingness**: not_applicable
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

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a diamond worth 50+ GP
- **Material Cost GP**: 50
- **Consumed**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE
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
- **Attack Roll**: ranged
- **Damage Dice**: 3d8
- **Damage Type**: Acid/Cold/Fire/Lightning/Poison/Thunder
- **Secondary Target Trigger**: duplicate_damage_die
- **Secondary Target Origin**: previous_target
- **Secondary Target Range**: 30
- **Secondary Target Range Unit**: feet
- **Secondary Target Valid Targets**: creature
- **Secondary Target Selection**: caster_choice
- **Secondary Target Must Be Different**: true
- **Secondary Target Requires Line Of Sight**: false
- **Secondary Target Requires Attack Roll**: true
- **Secondary Target Requires Damage Roll**: true
- **Secondary Target Repeat Rule**: slot_level_max_leaps
- **Secondary Target Max Leaps**: slot_level
- **Secondary Target Unique Per Casting**: true
- **Secondary Target Notes**: When two or more damage dice show the same number, the orb can leap to a different target within 30 feet of the current target; each chain step makes a new attack and damage roll, can only repeat when cast with a 2nd-level or higher slot, and cannot target a creature more than once per casting.

- **Description**: You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb you create, and then make a ranged spell attack against the target. On a hit, the target takes 3d8 damage of the chosen type. If you roll the same number on two or more of the d8s, the orb leaps to a different target of your choice within 30 feet of the target. Make an attack roll against the new target, and make a new damage roll. The orb can't leap again unless you cast the spell with a level 2+ spell slot.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1. The orb can leap a maximum number of times equal to the level of the slot expended, and a creature can be targeted only once by each casting of this spell.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Acid/Cold/Fire/Lightning/Poison/Thunder damage | dice 3d8 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Chromatic Orb
Level: 1st
Casting Time: 1 Action
Range/Area: 90 ft.
Components: V, S, M *
Duration: Instantaneous
School: Evocation
Attack/Save: Ranged
Damage/Effect: Acid (...)

Rules Text:
You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb you create, and then make a ranged spell attack against the target. On a hit, the target takes 3d8 damage of the chosen type.
If you roll the same number on two or more of the d8s, the orb leaps to a different target of your choice within 30 feet of the target. Make an attack roll against the new target, and make a new damage roll. The orb can't leap again unless you cast the spell with a level 2+ spell slot.
Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1. The orb can leap a maximum number of times equal to the level of the slot expended, and a creature can be targeted only once by each casting of this spell.

Material Component:
* - (a diamond worth 50+ GP)

Spell Tags:
Damage

Available For:
Sorcerer
Wizard
Sorcerer - Draconic Sorcery

Capture Method: http
Legacy Page: false
-->
