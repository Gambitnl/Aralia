# Wall of Light
- **Level**: 5
- **School**: Evocation
- **Ritual**: false
- **Classes**: Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: ranged
- **Range Distance**: 120
- **Range Distance Unit**: feet
- **Targeting Type**: area
- **Targeting Range**: 120
- **Targeting Range Unit**: feet
- **Area Shape**: Wall
- **Area Size**: 60
- **Area Size Type**: length
- **Area Size Unit**: feet
- **Area Height**: 10
- **Area Height Unit**: feet
- **Area Thickness**: 5
- **Area Thickness Unit**: feet
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
- **Material Description**: a hand mirror
- **Material Cost GP**: 0
- **Consumed**: false
- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true
- **Effect Type**: DAMAGE, STATUS_CONDITION, UTILITY
- **Save Stat**: Constitution
- **Save Outcome**: half
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Repeat Save Timing**: turn_end
- **Repeat Save Additional Timings**: not_applicable
- **Repeat Save Type**: Constitution
- **Repeat Save Success Ends**: true
- **Repeat Save Progression**: not_applicable
- **Recurring Mechanics**: A creature that ends its turn in the wall's area takes 4d8 Radiant damage; this recurring damage is separate from the initial save when the wall appears.
- **Recurring Mechanic Timing**: turn_end
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
- **Damage Dice**: 4d8
- **Damage Type**: Radiant
- **Description**: A shimmering wall of bright light appears at a point you choose within range. The wall appears in any orientation you choose: horizontally, vertically, or diagonally. It can be free floating, or it can rest on a solid surface. The wall can be up to 60 feet long, 10 feet high, and 5 feet thick. The wall blocks line of sight, but creatures and objects can pass through it. It emits bright light out to 120 feet and dim light for an additional 120 feet. When the wall appears, each creature in its area must make a Constitution saving throw. On a failed save, a creature takes 4d8 radiant damage, and it is blinded for 1 minute. On a successful save, it takes half as much damage and isn't blinded. A blinded creature can make a Constitution saving throw at the end of each of its turns, ending the effect on itself on a success. A creature that ends its turn in the wall's area takes 4d8 radiant damage. Until the spell ends, you can use an action to launch a beam of radiance from the wall at one creature you can see within 60 feet of it. Make a ranged spell attack. On a hit, the target takes 4d8 radiant damage. Whether you hit or miss, reduce the length of the wall by 10 feet. If the wall's length drops to 0 feet, the spell ends.
- **Higher Levels**: When you cast this spell using a spell slot of 6th level or higher, the damage increases by 1d8 for each slot level above 5th.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Radiant damage | dice 4d8 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d8
- **Spatial Form 1 Label**: Wall of Light
- **Spatial Form 1 Shape**: Wall
- **Spatial Form 1 Size Value**: 60
- **Spatial Form 1 Size Type**: length
- **Spatial Form 1 Size Unit**: feet
- **Spatial Form 1 Height Value**: 10
- **Spatial Form 1 Height Unit**: feet
- **Spatial Form 1 Thickness Value**: 5
- **Spatial Form 1 Thickness Unit**: feet
- **Spatial Form 1 Notes**: The wall can be horizontal, vertical, or diagonal.
- **Spatial Detail 1 Label**: Bright Light Radius
- **Spatial Detail 1 Kind**: distance
- **Spatial Detail 1 Value**: 120
- **Spatial Detail 1 Unit**: feet
- **Spatial Detail 2 Label**: Dim Light Radius
- **Spatial Detail 2 Kind**: distance
- **Spatial Detail 2 Value**: 120
- **Spatial Detail 2 Unit**: feet
- **Spatial Detail 2 Qualifier**: additional
- **Spatial Detail 3 Label**: Beam Range From Wall
- **Spatial Detail 3 Kind**: distance
- **Spatial Detail 3 Value**: 60
- **Spatial Detail 3 Unit**: feet
- **Spatial Detail 4 Label**: Length Reduction Per Beam
- **Spatial Detail 4 Kind**: distance
- **Spatial Detail 4 Value**: 10
- **Spatial Detail 4 Unit**: feet
- **Conditions Applied**: Blinded
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Wall of Light
Level: 5th
Casting Time: 1 Action
Range/Area: 120 ft.
Components: V, S, M *
Duration: Concentration 10 Minutes
School: Evocation
Attack/Save: CON Save
Damage/Effect: Radiant

Rules Text:
A shimmering wall of bright light appears at a point you choose within range. The wall appears in any orientation you choose: horizontally, vertically, or diagonally. It can be free floating, or it can rest on a solid surface. The wall can be up to 60 feet long, 10 feet high, and 5 feet thick. The wall blocks line of sight, but creatures and objects can pass through it. It emits bright light out to 120 feet and dim light for an additional 120 feet.
When the wall appears, each creature in its area must make a Constitution saving throw. On a failed save, a creature takes 4d8 radiant damage, and it is blinded for 1 minute. On a successful save, it takes half as much damage and isn't blinded . A blinded creature can make a Constitution saving throw at the end of each of its turns, ending the effect on itself on a success.
A creature that ends its turn in the wall's area takes 4d8 radiant damage.
Until the spell ends, you can use an action to launch a beam of radiance from the wall at one creature you can see within 60 feet of it. Make a ranged spell attack. On a hit, the target takes 4d8 radiant damage. Whether you hit or miss, reduce the length of the wall by 10 feet. If the wall's length drops to 0 feet, the spell ends.
At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the damage increases by 1d8 for each slot level above 5th.

Material Component:
* - (a hand mirror)

Spell Tags:
Damage
Control

Available For:
Sorcerer
Warlock
Wizard

Capture Method: http
Legacy Page: false
-->
