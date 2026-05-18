# Ensnaring Strike
- **Level**: 1
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Ranger
- **Sub-Classes**: Paladin - Oath of the Ancients

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action

- **Range Type**: self
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
- **Somatic**: false
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: STATUS_CONDITION, DAMAGE
- **Save Stat**: Strength
- **Save Outcome**: negates_condition
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
- **Conditions Applied**: Restrained
- **Damage Dice**: 1d6
- **Damage Type**: Piercing
- **Damage Trigger**: turn_start while Restrained

- **Description**: As you hit the target, grasping vines appear on it, and it makes a Strength saving throw. A Large or larger creature has Advantage on this save. On a failed save, the target has the Restrained condition until the spell ends. On a successful save, the vines shrivel away, and the spell ends. While Restrained, the target takes 1d6 Piercing damage at the start of each of its turns. The target or a creature within reach of it can take an action to make a Strength (Athletics) check against your spell save DC. On a success, the spell ends.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Piercing damage | dice 1d6 | trigger turn_start
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Ensnaring Strike
Level: 1st
Casting Time: 1 Bonus Action *
Range/Area: Self
Components: V
Duration: Concentration 1 Minute
School: Conjuration
Attack/Save: STR Save
Damage/Effect: Piercing

Rules Text:
As you hit the target, grasping vines appear on it, and it makes a Strength saving throw. A Large or larger creature has Advantage on this save. On a failed save, the target has the Restrained condition until the spell ends. On a successful save, the vines shrivel away, and the spell ends.
While Restrained, the target takes 1d6 Piercing damage at the start of each of its turns. The target or a creature within reach of it can take an action to make a Strength (Athletics) check against your spell save DC. On a success, the spell ends.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.

Spell Tags:
Damage
Control

Available For:
Ranger
Paladin - Oath of the Ancients

Capture Method: http
Legacy Page: false
-->

