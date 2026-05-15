# Flaming Sphere
- **Level**: 2
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid, Sorcerer, Wizard
- **Sub-Classes**: Folded into Classes
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: ranged
- **Range Distance**: 60
- **Range Distance Unit**: feet
- **Targeting Type**: area
- **Targeting Range**: 60
- **Targeting Range Unit**: feet
- **Area Shape**: Sphere
- **Area Size**: 5
- **Area Size Type**: diameter
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
- **Line of Sight**: true
- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a ball of wax
- **Material Cost GP**: 0
- **Consumed**: false
- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true
- **Effect Type**: DAMAGE
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
- **Damage Dice**: 2d6
- **Damage Type**: Fire
- **Description**: You create a 5-foot-diameter sphere of fire in an unoccupied space on the ground within range. It lasts for the duration. Any creature that ends its turn within 5 feet of the sphere makes a Dexterity saving throw, taking 2d6 Fire damage on a failed save or half as much damage on a successful one. As a Bonus Action, you can move the sphere up to 30 feet, rolling it along the ground. If you move the sphere into a creature's space, that creature makes the save against the sphere, and the sphere stops moving for the turn. When you move the sphere, you can direct it over barriers up to 5 feet tall and jump it across pits up to 10 feet wide. Flammable objects that aren't being worn or carried start burning if touched by the sphere, and it sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 2d6 | trigger turn_end | Creatures ending their turn within 5 feet of the sphere take 2d6 Fire damage on 
- **Scaling Rule 1 Bonus Per Level**: +1d6
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Fire damage | dice 2d6 | trigger on_caster_action | As a Bonus Action, move the sphere up to 30 feet; if it enters a creature's spac
- **Scaling Rule 2 Bonus Per Level**: +1d6
- **Spatial Form 1 Label**: Flaming Sphere
- **Spatial Form 1 Shape**: Sphere
- **Spatial Form 1 Size Value**: 5
- **Spatial Form 1 Size Type**: diameter
- **Spatial Form 1 Size Unit**: feet
- **Spatial Form 1 Notes**: Created sphere size.
- **Spatial Detail 1 Label**: Heat Radius
- **Spatial Detail 1 Kind**: distance
- **Spatial Detail 1 Value**: 5
- **Spatial Detail 1 Unit**: feet
- **Spatial Detail 1 Notes**: Creatures ending their turn within this distance save.
- **Spatial Detail 2 Label**: Move Distance
- **Spatial Detail 2 Kind**: distance
- **Spatial Detail 2 Value**: 30
- **Spatial Detail 2 Unit**: feet
- **Spatial Detail 2 Notes**: As a Bonus Action, you can roll the sphere this far.
- **Spatial Detail 3 Label**: Barrier Height
- **Spatial Detail 3 Kind**: distance
- **Spatial Detail 3 Value**: 5
- **Spatial Detail 3 Unit**: feet
- **Spatial Detail 3 Notes**: The sphere can be directed over barriers up to this height.
- **Spatial Detail 4 Label**: Pit Width
- **Spatial Detail 4 Kind**: distance
- **Spatial Detail 4 Value**: 10
- **Spatial Detail 4 Unit**: feet
- **Spatial Detail 4 Notes**: The sphere can jump pits up to this width.
- **Spatial Detail 5 Label**: Bright Light Radius
- **Spatial Detail 5 Kind**: distance
- **Spatial Detail 5 Value**: 20
- **Spatial Detail 5 Unit**: feet
- **Spatial Detail 6 Label**: Dim Light Radius
- **Spatial Detail 6 Kind**: distance
- **Spatial Detail 6 Value**: 20
- **Spatial Detail 6 Unit**: feet
- **Spatial Detail 6 Qualifier**: additional
## Canonical D&D Beyond Snapshot
This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.
<!--
Name: Flaming Sphere
Level: 2nd
Casting Time: 1 Action
Range/Area: 60 ft. (5 ft.)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Conjuration
Attack/Save: DEX Save
Damage/Effect: Fire
Rules Text:
You create a 5-foot-diameter sphere of fire in an unoccupied space on the ground within range. It lasts for the duration. Any creature that ends its turn within 5 feet of the sphere makes a Dexterity saving throw, taking 2d6 Fire damage on a failed save or half as much damage on a successful one.
As a Bonus Action, you can move the sphere up to 30 feet, rolling it along the ground. If you move the sphere into a creature's space, that creature makes the save against the sphere, and the sphere stops moving for the turn.
When you move the sphere, you can direct it over barriers up to 5 feet tall and jump it across pits up to 10 feet wide. Flammable objects that aren't being worn or carried start burning if touched by the sphere, and it sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.
Material Component:
* - (a ball of wax)
Spell Tags:
Damage
Available For:
Druid
Sorcerer
Wizard
Druid - Circle of Wildfire (TCoE)
Referenced Rules:
burning -> /rules-glossary/22-tooltip
Bright Light -> /rules-glossary/21-tooltip
Dim Light -> /rules-glossary/52-tooltip
Capture Method: http
Legacy Page: false
-->

