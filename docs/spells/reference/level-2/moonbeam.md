# Moonbeam
- **Level**: 2
- **School**: Evocation
- **Ritual**: false
- **Classes**: Druid
- **Sub-Classes**: Paladin - Oath of the Ancients

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Targeting Type**: area
- **Area Shape**: cylinder
- **Area Size**: 5
- **Area Height**: 40
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
- **Material Description**: a moonseed leaf
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, UTILITY
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
- **Light Bright Radius**: 0
- **Light Dim Radius**: 5
- **Light Color Choice**: fixed
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 2d10
- **Damage Type**: Radiant
- **Utility Type**: light

- **Description**: A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high Cylinder centered on a point within range. Until the spell ends, Dim Light fills the Cylinder, and you can take a Magic action on later turns to move the Cylinder up to 60 feet. When the Cylinder appears, each creature in it makes a Constitution saving throw. On a failed save, a creature takes 2d10 Radiant damage, and if the creature is shape-shifted (as a result of the Polymorph spell, for example), it reverts to its true form and can't shape-shift until it leaves the Cylinder. On a successful save, a creature takes half as much damage only. A creature also makes this save when the spell's area moves into its space and when it enters the spell's area or ends its turn there. A creature makes this save only once per turn.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Radiant damage | dice 2d10 | trigger on_enter_area | Creatures in the Cylinder make a Constitution save; shape-shifters save with dis
- **Scaling Rule 1 Bonus Per Level**: +1d10
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Radiant damage | dice 2d10 | trigger turn_start | A creature also makes this save when the Cylinder moves into its space, when it 
- **Scaling Rule 2 Bonus Per Level**: +1d10

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Moonbeam
Level: 2nd
Casting Time: 1 Action
Range/Area: 120 ft. (5 ft. *)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Evocation
Attack/Save: CON Save
Damage/Effect: Radiant

Rules Text:
A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high Cylinder centered on a point within range. Until the spell ends, Dim Light fills the Cylinder, and you can take a Magic action on later turns to move the Cylinder up to 60 feet.
When the Cylinder appears, each creature in it makes a Constitution saving throw. On a failed save, a creature takes 2d10 Radiant damage, and if the creature is shape-shifted (as a result of the Polymorph spell, for example), it reverts to its true form and can't shape-shift until it leaves the Cylinder. On a successful save, a creature takes half as much damage only. A creature also makes this save when the spell's area moves into its space and when it enters the spell's area or ends its turn there. A creature makes this save only once per turn.
Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 2.

Material Component:
* - (a moonseed leaf)

Spell Tags:
Damage
Control

Available For:
Druid
Cleric - Twilight Domain (TCoE)
Paladin - Oath of the Watchers (TCoE)
Paladin - Oath of the Ancients
Cleric - Night Domain (HCS)
Cleric - Moon Domain (TCSR)

Referenced Rules:
Cylinder -> /rules-glossary/40-tooltip
Dim Light -> /rules-glossary/52-tooltip
shape-shifted -> /rules-glossary/100-tooltip

Capture Method: http
Legacy Page: false
-->
