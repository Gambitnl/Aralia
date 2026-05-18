# Ice Storm
- **Level**: 4
- **School**: Evocation
- **Ritual**: false
- **Classes**: Druid, Sorcerer, Wizard
- **Sub-Classes**: Paladin - Oath of the Ancients

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 300
- **Targeting Type**: area
- **Area Shape**: Cylinder
- **Area Size**: 20
- **Area Size Type**: radius
- **Area Size Unit**: feet
- **Area Height**: 40
- **Area Height Unit**: feet
- **Valid Targets**: point
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
- **Material Description**: a mitten
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE, TERRAIN
- **Save Stat**: Dexterity
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
- **Damage Dice**: 2d10
- **Damage Type**: Bludgeoning
- **Secondary Damage Dice**: 4d6
- **Secondary Damage Type**: Cold

- **Description**: Hail falls in a 20-foot-radius, 40-foot-high Cylinder centered on a point within range. Each creature in the Cylinder makes a Dexterity saving throw. A creature takes 2d10 Bludgeoning damage and 4d6 Cold damage on a failed save or half as much damage on a successful one. Hailstones turn ground in the Cylinder into Difficult Terrain until the end of your next turn.
- **Higher Levels**: The Bludgeoning damage increases by 1d10 for each spell slot level above 4.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Bludgeoning damage | dice 2d10 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d10

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Ice Storm
Level: 4th
Casting Time: 1 Action
Range/Area: 300 ft. (20 ft. *)
Components: V, S, M *
Duration: Instantaneous
School: Evocation
Attack/Save: DEX Save
Damage/Effect: Bludgeoning (...)

Rules Text:
Hail falls in a 20-foot-radius, 40-foot-high Cylinder centered on a point within range. Each creature in the Cylinder makes a Dexterity saving throw. A creature takes 2d10 Bludgeoning damage and 4d6 Cold damage on a failed save or half as much damage on a successful one.
Hailstones turn ground in the Cylinder into Difficult Terrain until the end of your next turn.
Using a Higher-Level Spell Slot. The Bludgeoning damage increases by 1d10 for each spell slot level above 4.

Material Component:
* - (a mitten)

Spell Tags:
Damage
Control

Available For:
Druid
Sorcerer
Wizard
Cleric - Tempest Domain (PHB)
Druid - Circle of the Sea
Paladin - Oath of the Ancients

Referenced Rules:
Cylinder -> /rules-glossary/40-tooltip
Difficult Terrain -> /rules-glossary/50-tooltip

Capture Method: http
Legacy Page: false
-->

