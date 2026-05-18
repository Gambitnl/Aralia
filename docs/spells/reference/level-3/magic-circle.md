# Magic Circle
- **Level**: 3
- **School**: Abjuration
- **Ritual**: true
- **Classes**: Cleric, Paladin, Warlock, Wizard
- **Sub-Classes**: Folded into Classes

- **Casting Time Value**: 1
- **Casting Time Unit**: minute
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 10
- **Targeting Type**: area
- **Area Shape**: cylinder
- **Area Size**: 10
- **Area Height**: 20
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
- **Material Description**: salt and powdered silver worth 100+ GP, which the spell consumes
- **Material Cost GP**: 100
- **Consumed**: true

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: hour
- **Concentration**: false

- **Effect Type**: UTILITY
- **Utility Type**: other
- **Save Stat**: Charisma
- **Save Outcome**: negates
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

- **Description**: You create a 10-foot-radius, 20-foot-tall Cylinder of magical energy centered on a point on the ground that you can see within range. Glowing runes appear wherever the Cylinder intersects with the floor or other surface. Choose one or more of the following types of creatures: Celestials, Elementals, Fey, Fiends, or Undead. The circle affects a creature of the chosen type in the following ways: Each time you cast this spell, you can cause its magic to operate in the reverse direction, preventing a creature of the specified type from leaving the Cylinder and protecting targets outside it.
- **Higher Levels**: Using a Higher-Level Spell Slot. The duration increases by 1 hour for each spell slot level above 3.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: duration.value
- **Scaling Rule 1 Base**: 1 hour at spell slot level 3
- **Scaling Rule 1 Bonus Per Level**: +1 hour
- **Scaling Rule 1 Notes**: The duration increases by 1 hour for each spell slot level above 3.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Magic Circle
Level: 3rd
Casting Time: 1 Minute
Range/Area: 10 ft. (10 ft. *)
Components: V, S, M *
Duration: 1 Hour
School: Abjuration
Attack/Save: CHA Save

Rules Text:
You create a 10-foot-radius, 20-foot-tall Cylinder of magical energy centered on a point on the ground that you can see within range. Glowing runes appear wherever the Cylinder intersects with the floor or other surface.
Choose one or more of the following types of creatures: Celestials, Elementals, Fey, Fiends, or Undead. The circle affects a creature of the chosen type in the following ways:
Each time you cast this spell, you can cause its magic to operate in the reverse direction, preventing a creature of the specified type from leaving the Cylinder and protecting targets outside it.
Using a Higher-Level Spell Slot. The duration increases by 1 hour for each spell slot level above 3.

Material Component:
* - (salt and powdered silver worth 100+ GP, which the spell consumes)

Available For:
Cleric
Paladin
Warlock
Wizard
Cleric - Arcana Domain (SCAG)

Referenced Rules:
Cylinder -> /rules-glossary/40-tooltip
possessed -> /rules-glossary/92-tooltip

Capture Method: http
Legacy Page: false
-->
