# Create or Destroy Water
- **Level**: 1
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Cleric, Druid
- **Sub-Classes**: Unsupported Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: ranged
- **Range Distance**: 30
- **Range Distance Unit**: feet
- **Targeting Type**: area
- **Targeting Range**: 30
- **Targeting Range Unit**: feet
- **Area Shape**: Cube
- **Area Size**: 30
- **Area Size Type**: edge
- **Area Size Unit**: feet
- **Area Height**: 0
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
- **Line of Sight**: false
- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a mix of water and sand
- **Material Cost GP**: 0
- **Consumed**: false
- **Duration Type**: instantaneous
- **Concentration**: false
- **Effect Type**: UTILITY
- **Utility Type**: creation
- **Save Stat**: not_applicable
- **Save Outcome**: not_applicable
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
- **Description**: You do one of the following: Create Water. You create up to 10 gallons of clean water within range in an open container. Alternatively, the water falls as rain in a 30-foot Cube within range, extinguishing exposed flames there. Destroy Water. You destroy up to 10 gallons of water in an open container within range. Alternatively, you destroy fog in a 30-foot Cube within range.
- **Higher Levels**: Using a Higher-Level Spell Slot. You create or destroy 10 additional gallons of water, or the size of the Cube increases by 5 feet, for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: utility | trigger immediate | utility creation | Choose to create clean water (in containers or as rain that can extinguish expos
- **Scaling Rule 1 Notes**: +10 gallons created or destroyed, or +5-foot Cube size per slot level above 1 (choose when casting).
- **Spatial Form 1 Label**: Rain Cube
- **Spatial Form 1 Shape**: Cube
- **Spatial Form 1 Size Value**: 30
- **Spatial Form 1 Size Type**: edge
- **Spatial Form 1 Size Unit**: feet
- **Spatial Form 1 Notes**: Create Water alternate mode.
- **Spatial Form 2 Label**: Fog Clearance Cube
- **Spatial Form 2 Shape**: Cube
- **Spatial Form 2 Size Value**: 30
- **Spatial Form 2 Size Type**: edge
- **Spatial Form 2 Size Unit**: feet
- **Spatial Form 2 Notes**: Destroy Water alternate mode.
- **Spatial Detail 1 Label**: Container Water Volume
- **Spatial Detail 1 Kind**: volume
- **Spatial Detail 1 Value**: 10
- **Spatial Detail 1 Unit**: gallons
- **Spatial Detail 2 Label**: Higher-Level Volume Increase
- **Spatial Detail 2 Kind**: volume
- **Spatial Detail 2 Value**: 10
- **Spatial Detail 2 Unit**: gallons
- **Spatial Detail 2 Qualifier**: per slot level above 1
- **Spatial Detail 3 Label**: Higher-Level Cube Increase
- **Spatial Detail 3 Kind**: distance
- **Spatial Detail 3 Value**: 5
- **Spatial Detail 3 Unit**: feet
- **Spatial Detail 3 Qualifier**: per slot level above 1
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Create or Destroy Water
Level: 1st
Casting Time: 1 Action
Range/Area: 30 ft. (30 ft. Cube)
Components: V, S, M *
Duration: Instantaneous
School: Transmutation
Attack/Save: None
Damage/Effect: Creation

Rules Text:
You do one of the following:
Create Water. You create up to 10 gallons of clean water within range in an open container. Alternatively, the water falls as rain in a 30-foot Cube within range, extinguishing exposed flames there.
Destroy Water. You destroy up to 10 gallons of water in an open container within range. Alternatively, you destroy fog in a 30-foot Cube within range.
Using a Higher-Level Spell Slot. You create or destroy 10 additional gallons of water, or the size of the Cube increases by 5 feet, for each spell slot level above 1.

Material Component:
* - (a mix of water and sand)

Spell Tags:
Creation

Available For:
Cleric
Druid
Warlock - The Fathomless (TCoE)
Paladin - Oath of the Open Sea (TCSR)

Referenced Rules:
Cube -> /rules-glossary/38-tooltip

Capture Method: http
Legacy Page: false
-->

