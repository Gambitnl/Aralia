# Otiluke's Freezing Sphere
- **Level**: 6
- **School**: Evocation
- **Ritual**: false
- **Classes**: Sorcerer, Wizard
- **Sub-Classes**: No Subclass Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: ranged
- **Range Distance**: 300
- **Range Distance Unit**: feet
- **Targeting Type**: area
- **Targeting Range**: 300
- **Targeting Range Unit**: feet
- **Area Shape**: Sphere
- **Area Size**: 60
- **Area Size Type**: radius
- **Area Size Unit**: feet
- **Area Height**: 0
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
- **Material Description**: a miniature crystal sphere
- **Material Cost GP**: 0
- **Consumed**: false
- **Duration Type**: instantaneous
- **Concentration**: false
- **Effect Type**: DAMAGE, TERRAIN, STATUS_CONDITION, UTILITY
- **Utility Type**: creation
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
- **Damage Dice**: 10d6
- **Damage Type**: Cold
- **Conditions Applied**: Restrained
- **Utility Options**: Freeze Water; Break Free Check; Stored Globe; Throw Globe; Sling Globe; Set Down Globe; Delayed Explosion
- **Utility Option 1 Name**: Freeze Water
- **Utility Option 1 Effect**: If the globe strikes water, it freezes water 6 inches deep over a 30-foot square area for 1 minute.
- **Utility Option 2 Name**: Break Free Check
- **Utility Option 2 Effect**: A trapped creature can take an action to make a Strength (Athletics) check against the caster's spell save DC to break free.
- **Utility Option 3 Name**: Stored Globe
- **Utility Option 3 Effect**: The caster can refrain from firing the globe, creating a sling-bullet-sized globe in hand.
- **Utility Option 4 Name**: Throw Globe
- **Utility Option 4 Effect**: The stored globe can be thrown to a range of 40 feet.
- **Utility Option 5 Name**: Sling Globe
- **Utility Option 5 Effect**: The stored globe can be hurled with a sling to the sling's normal range.
- **Utility Option 6 Name**: Set Down Globe
- **Utility Option 6 Effect**: The stored globe can be set down without shattering.
- **Utility Option 7 Name**: Delayed Explosion
- **Utility Option 7 Effect**: After 1 minute, if the stored globe has not shattered, it explodes.
- **Description**: A frigid globe streaks from you to a point of your choice within range, where it explodes in a 60-foot-radius Sphere . Each creature in that area makes a Constitution saving throw, taking 10d6 Cold damage on a failed save or half as much damage on a successful one. If the globe strikes a body of water, it freezes the water to a depth of 6 inches over an area 30 feet square. This ice lasts for 1 minute. Creatures that were swimming on the surface of frozen water are trapped in the ice and have the Restrained condition. A trapped creature can take an action to make a Strength (Athletics) check against your spell save DC to break free. You can refrain from firing the globe after completing the spell's casting. If you do so, a globe about the size of a sling bullet, cool to the touch, appears in your hand. At any time, you or a creature you give the globe to can throw the globe (to a range of 40 feet) or hurl it with a sling (to the sling's normal range). It shatters on impact, with the same effect as a normal casting of the spell. You can also set the globe down without shattering it. After 1 minute, if the globe hasn't already shattered, it explodes.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 6.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Cold damage | dice 10d6 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d6
- **Spatial Form 1 Label**: Explosion
- **Spatial Form 1 Shape**: Sphere
- **Spatial Form 1 Size Value**: 60
- **Spatial Form 1 Size Type**: radius
- **Spatial Form 1 Size Unit**: feet
- **Spatial Form 2 Label**: Stored Globe
- **Spatial Form 2 Shape**: Sphere
- **Spatial Form 2 Notes**: About the size of a sling bullet until it shatters or expires.
- **Spatial Detail 1 Label**: Water Freeze Depth
- **Spatial Detail 1 Kind**: depth
- **Spatial Detail 1 Value**: 6
- **Spatial Detail 1 Unit**: inches
- **Spatial Detail 2 Label**: Water Freeze Area
- **Spatial Detail 2 Kind**: special
- **Spatial Detail 2 Value**: 30
- **Spatial Detail 2 Unit**: feet
- **Spatial Detail 2 Qualifier**: square
- **Spatial Detail 2 Notes**: Applies when the globe strikes a body of water.
- **Spatial Detail 3 Label**: Thrown Range
- **Spatial Detail 3 Kind**: distance
- **Spatial Detail 3 Value**: 40
- **Spatial Detail 3 Unit**: feet
- **Spatial Detail 4 Label**: Stored Globe Duration
- **Spatial Detail 4 Kind**: time
- **Spatial Detail 4 Value**: 1
- **Spatial Detail 4 Unit**: minutes
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Otiluke's Freezing Sphere
Level: 6th
Casting Time: 1 Action
Range/Area: 300 ft. (60 ft.)
Components: V, S, M *
Duration: Instantaneous
School: Evocation
Attack/Save: CON Save
Damage/Effect: Cold

Rules Text:
A frigid globe streaks from you to a point of your choice within range, where it explodes in a 60-foot-radius Sphere . Each creature in that area makes a Constitution saving throw, taking 10d6 Cold damage on a failed save or half as much damage on a successful one.
If the globe strikes a body of water, it freezes the water to a depth of 6 inches over an area 30 feet square. This ice lasts for 1 minute. Creatures that were swimming on the surface of frozen water are trapped in the ice and have the Restrained condition. A trapped creature can take an action to make a Strength (Athletics) check against your spell save DC to break free.
You can refrain from firing the globe after completing the spell's casting. If you do so, a globe about the size of a sling bullet, cool to the touch, appears in your hand. At any time, you or a creature you give the globe to can throw the globe (to a range of 40 feet) or hurl it with a sling (to the sling's normal range). It shatters on impact, with the same effect as a normal casting of the spell. You can also set the globe down without shattering it. After 1 minute, if the globe hasn't already shattered, it explodes.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 6.

Material Component:
* - (a miniature crystal sphere)

Spell Tags:
Damage
Control

Available For:
Sorcerer
Wizard

Referenced Rules:
Sphere -> /rules-glossary/109-tooltip

Capture Method: http
Legacy Page: false
-->
