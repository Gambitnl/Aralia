# Investiture of Wind
- **Level**: 6
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Druid, Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: self
- **Area Shape**: Cube
- **Area Size**: 15
- **Area Size Type**: edge
- **Area Size Unit**: feet
- **Valid Targets**: self
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
- **Material**: false
- **Material Description**: not_applicable
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, DEFENSIVE, MOVEMENT, UTILITY
- **Utility Type**: other
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
- **Damage Dice**: 2d10
- **Damage Type**: Bludgeoning
- **Defense Type**: disadvantage_on_attacks
- **Utility Options**: Flying Speed; Swirling Wind Action; Fall If Flying When Spell Ends
- **Utility Option 1 Name**: Flying Speed
- **Utility Option 1 Effect**: The caster gains a flying speed of 60 feet.
- **Utility Option 2 Name**: Swirling Wind Action
- **Utility Option 2 Effect**: The caster can use an action to create the 15-foot Cube of swirling wind.
- **Utility Option 3 Name**: Fall If Flying When Spell Ends
- **Utility Option 3 Effect**: If the caster is still flying when the spell ends, the caster falls unless another effect prevents it.
- **End Cleanup Trigger**: spell_ends
- **End Cleanup Removes**: spell_granted_flying_speed
- **End Cleanup Source**: this_effect
- **End Cleanup Scope**: caster
- **End Cleanup Amount**: all_remaining
- **End Cleanup Consequence**: fall_if_aloft
- **End Cleanup Prevented By**: can_prevent_fall
- **Spatial Form 1 Label**: Swirling Wind Cube
- **Spatial Form 1 Shape**: Cube
- **Spatial Form 1 Size Value**: 15
- **Spatial Form 1 Size Type**: edge
- **Spatial Form 1 Size Unit**: feet
- **Spatial Form 1 Notes**: Centered on a point you can see within 60 feet of you when you use the spell-granted action.

- **Description**: Until the spell ends, wind whirls around you, and you gain the following benefits: Ranged weapon attacks made against you have disadvantage on the attack roll. You gain a flying speed of 60 feet. If you are still flying when the spell ends, you fall, unless you can somehow prevent it. You can use your action to create a 15-foot cube of swirling wind centered on a point you can see within 60 feet of you. Each creature in that area must make a Constitution saving throw. A creature takes 2d10 bludgeoning damage on a failed save, or half as much damage on a successful one. If a Large or smaller creature fails the save, that creature is also pushed up to 10 feet away from the center of the cube.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Investiture of Wind
Level: 6th
Casting Time: 1 Action
Range/Area: Self (15 ft. Cube *)
Components: V, S
Duration: Concentration 10 Minutes
School: Transmutation
Attack/Save: CON Save
Damage/Effect: Bludgeoning

Rules Text:
Until the spell ends, wind whirls around you, and you gain the following benefits:
Ranged weapon attacks made against you have disadvantage on the attack roll.
You gain a flying speed of 60 feet. If you are still flying when the spell ends, you fall, unless you can somehow prevent it.
You can use your action to create a 15-foot cube of swirling wind centered on a point you can see within 60 feet of you. Each creature in that area must make a Constitution saving throw. A creature takes 2d10 bludgeoning damage on a failed save, or half as much damage on a successful one. If a Large or smaller creature fails the save, that creature is also pushed up to 10 feet away from the center of the cube.

Spell Tags:
Damage
Control
Movement
Warding

Available For:
Druid
Sorcerer
Warlock
Wizard

Capture Method: http
Legacy Page: false
-->
