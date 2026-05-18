# Tsunami
- **Level**: 8
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: minute
- **Combat Cost**: not_applicable
- **Range Type**: ranged
- **Range Distance**: 1
- **Range Distance Unit**: miles
- **Targeting Type**: area
- **Area Shape**: Wall
- **Area Size**: 300
- **Area Size Type**: length
- **Area Size Unit**: feet
- **Area Height**: 300
- **Area Height Unit**: feet
- **Area Thickness**: 50
- **Area Thickness Unit**: feet
- **Valid Targets**: creatures, objects, point, ground
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
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 6
- **Duration Unit**: round
- **Concentration**: true

- **Effect Type**: DAMAGE
- **Utility Type**: other
- **Save Stat**: Strength
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
- **Damage Dice**: 6d10 initial, 5d10 ongoing
- **Damage Type**: Bludgeoning
- **Target Filter Sizes**: Huge or smaller for ongoing wall-movement damage
- **Triggered Applications**: on_cast, caster_turn_start, wall_enters_space
- **Damage Trigger**: Initial wall appearance deals 6d10; later wall movement or inside-wall contact deals 5d10, once per round, reduced by 1d10 each later round.
- **Movement Type**: push
- **Forced Movement**: At the start of each caster turn after the wall appears, the wall and any creatures in it move 50 feet away from the caster.
- **Utility Options**: Water wall dimensions, Initial impact, Moving wall damage, Round decay, Swim restriction, Fall out, Height ending
- **Utility Option 1 Name**: Water wall dimensions
- **Utility Option 1 Effect**: The caster can make the water wall up to 300 feet long, 300 feet high, and 50 feet thick.
- **Utility Option 2 Name**: Initial impact
- **Utility Option 2 Effect**: When the wall appears, each creature in the area makes a Strength save against 6d10 Bludgeoning damage.
- **Utility Option 3 Name**: Moving wall damage
- **Utility Option 3 Effect**: A Huge or smaller creature inside the wall or whose space the wall enters saves against 5d10 Bludgeoning damage, only once per round.
- **Utility Option 4 Name**: Round decay
- **Utility Option 4 Effect**: At the end of each turn, wall height is reduced by 50 feet and later-round damage is reduced by 1d10.
- **Utility Option 5 Name**: Swim restriction
- **Utility Option 5 Effect**: A creature caught in the wall can move by swimming only if it succeeds on a Strength (Athletics) check against the spell save DC.
- **Utility Option 6 Name**: Fall out
- **Utility Option 6 Effect**: A creature that moves out of the wall falls to the ground.
- **Utility Option 7 Name**: Height ending
- **Utility Option 7 Effect**: When the wall reaches 0 feet in height, the spell ends.

- **Description**: A wall of water springs into existence at a point you choose within range. You can make the wall up to 300 feet long, 300 feet high, and 50 feet thick. The wall lasts for the duration. When the wall appears, each creature in its area makes a Strength saving throw, taking 6d10 Bludgeoning damage on a failed save or half as much damage on a successful one. At the start of each of your turns after the wall appears, the wall, along with any creatures in it, moves 50 feet away from you. Any Huge or smaller creature inside the wall or whose space the wall enters when it moves must succeed on a Strength saving throw or take 5d10 Bludgeoning damage. A creature can take this damage only once per round. At the end of the turn, the wall's height is reduced by 50 feet, and the damage the wall deals on later rounds is reduced by 1d10. When the wall reaches 0 feet in height, the spell ends. A creature caught in the wall can move by swimming. Because of the wave's force, though, the creature must succeed on a Strength (Athletics) check against your spell save DC to move at all. If it fails the check, it can't move. A creature that moves out of the wall falls to the ground.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Tsunami
Level: 8th
Casting Time: 1 Minute
Range/Area: 1 mile
Components: V, S
Duration: Concentration 6 Rounds
School: Conjuration
Attack/Save: STR Save
Damage/Effect: Bludgeoning

Rules Text:
A wall of water springs into existence at a point you choose within range. You can make the wall up to 300 feet long, 300 feet high, and 50 feet thick. The wall lasts for the duration.
When the wall appears, each creature in its area makes a Strength saving throw, taking 6d10 Bludgeoning damage on a failed save or half as much damage on a successful one.
At the start of each of your turns after the wall appears, the wall, along with any creatures in it, moves 50 feet away from you. Any Huge or smaller creature inside the wall or whose space the wall enters when it moves must succeed on a Strength saving throw or take 5d10 Bludgeoning damage. A creature can take this damage only once per round. At the end of the turn, the wall's height is reduced by 50 feet, and the damage the wall deals on later rounds is reduced by 1d10. When the wall reaches 0 feet in height, the spell ends.
A creature caught in the wall can move by swimming. Because of the wave's force, though, the creature must succeed on a Strength (Athletics) check against your spell save DC to move at all. If it fails the check, it can't move. A creature that moves out of the wall falls to the ground.

Spell Tags:
Damage
Control

Available For:
Druid

Capture Method: http
Legacy Page: false
-->
