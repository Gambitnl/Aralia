# Shatter
- **Level**: 2
- **School**: Evocation
- **Ritual**: false
- **Classes**: Bard, Sorcerer, Wizard
- **Sub-Classes**: Druid - Circle of the Sea

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: area
- **Area Shape**: sphere
- **Area Size**: 10
- **Valid Targets**: creatures, objects
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
- **Material Description**: a chip of mica
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE
- **Save Stat**: Constitution
- **Save Outcome**: half
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
- **Damage Dice**: 3d8
- **Damage Type**: Thunder

- **Description**: A loud noise erupts from a point of your choice within range. Each creature in a 10-foot-radius Sphere centered there makes a Constitution saving throw, taking 3d8 Thunder damage on a failed save or half as much damage on a successful one. A Construct has Disadvantage on the save. A nonmagical object that isn't being worn or carried also takes the damage if it's in the spell's area.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Thunder damage | dice 3d8 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Shatter
Level: 2nd
Casting Time: 1 Action
Range/Area: 60 ft. (10 ft.)
Components: V, S, M *
Duration: Instantaneous
School: Evocation
Attack/Save: CON Save
Damage/Effect: Thunder

Rules Text:
A loud noise erupts from a point of your choice within range. Each creature in a 10-foot-radius Sphere centered there makes a Constitution saving throw, taking 3d8 Thunder damage on a failed save or half as much damage on a successful one. A Construct has Disadvantage on the save.
A nonmagical object that isn't being worn or carried also takes the damage if it's in the spell's area.
Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.

Material Component:
* - (a chip of mica)

Spell Tags:
Damage

Available For:
Bard
Sorcerer
Wizard
Cleric - Tempest Domain (PHB)
Druid - Circle of the Sea

Referenced Rules:
Sphere -> /rules-glossary/109-tooltip

Capture Method: http
Legacy Page: false
-->
