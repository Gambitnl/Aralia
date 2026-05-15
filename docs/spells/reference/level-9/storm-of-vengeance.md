# Storm of Vengeance
- **Level**: 9
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 1
- **Range Distance Unit**: miles
- **Targeting Type**: point
- **Targeting Range**: 1
- **Targeting Range Unit**: miles
- **Area Shape**: Sphere
- **Area Size**: 300
- **Area Size Type**: radius
- **Area Size Unit**: feet
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
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE
- **Conditions Applied**: Deafened
- **Save Stat**: Constitution
- **Save Outcome**: none
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
- **Damage Type**: Thunder
- **Secondary Damage Dice**: 4d6
- **Secondary Damage Type**: Acid
- **Utility Options**: Initial thunder and deafening, Turn 2 acid rain, Turn 3 lightning bolts, Turn 4 hailstones, Turns 5 through 10 freezing rain, Area control
- **Utility Option 1 Name**: Initial thunder and deafening
- **Utility Option 1 Effect**: When the storm appears, creatures under it save against 2d6 Thunder damage and Deafened for the duration.
- **Utility Option 2 Name**: Turn 2 acid rain
- **Utility Option 2 Effect**: At the start of the caster second later turn, creatures and objects under the cloud take 4d6 Acid damage.
- **Utility Option 3 Name**: Turn 3 lightning bolts
- **Utility Option 3 Effect**: At the start of the caster third later turn, six bolts strike six different creatures or objects under the cloud for 10d6 Lightning damage with a Dexterity save for half.
- **Utility Option 4 Name**: Turn 4 hailstones
- **Utility Option 4 Effect**: At the start of the caster fourth later turn, creatures under the cloud take 2d6 Bludgeoning damage.
- **Utility Option 5 Name**: Turns 5 through 10 freezing rain
- **Utility Option 5 Effect**: On later turns 5 through 10, creatures under the cloud take 1d6 Cold damage.
- **Utility Option 6 Name**: Area control
- **Utility Option 6 Effect**: Until the spell ends, the area is Difficult Terrain and Heavily Obscured, ranged weapon attacks are impossible there, and strong wind blows through it.
- **Effect Schedule Timing**: caster_later_turn_start
- **Effect Schedule Entry Count**: 4
- **Effect Schedule Entry 1 Label**: Turn 2 acid rain
- **Effect Schedule Entry 1 Timing**: caster_turn_start
- **Effect Schedule Entry 1 Turn Start**: 2
- **Effect Schedule Entry 1 Turn End**: 2
- **Effect Schedule Entry 1 Effect Indices**: 2
- **Effect Schedule Entry 1 Effect Types**: DAMAGE
- **Effect Schedule Entry 1 Target Count**: all
- **Effect Schedule Entry 1 Target Valid Targets**: creature_or_object
- **Effect Schedule Entry 1 Target Selection**: all_valid_targets
- **Effect Schedule Entry 1 Target Must Be Different**: not_applicable
- **Effect Schedule Entry 1 Summary**: Creatures and objects under the cloud take 4d6 Acid damage.
- **Effect Schedule Entry 2 Label**: Turn 3 lightning bolts
- **Effect Schedule Entry 2 Timing**: caster_turn_start
- **Effect Schedule Entry 2 Turn Start**: 3
- **Effect Schedule Entry 2 Turn End**: 3
- **Effect Schedule Entry 2 Effect Indices**: 3
- **Effect Schedule Entry 2 Effect Types**: DAMAGE
- **Effect Schedule Entry 2 Target Count**: 6
- **Effect Schedule Entry 2 Target Valid Targets**: creature_or_object
- **Effect Schedule Entry 2 Target Selection**: caster_choice
- **Effect Schedule Entry 2 Target Must Be Different**: true
- **Effect Schedule Entry 2 Summary**: Six bolts strike six different creatures or objects under the cloud for 10d6 Lightning damage with a Dexterity save for half.
- **Effect Schedule Entry 3 Label**: Turn 4 hailstones
- **Effect Schedule Entry 3 Timing**: caster_turn_start
- **Effect Schedule Entry 3 Turn Start**: 4
- **Effect Schedule Entry 3 Turn End**: 4
- **Effect Schedule Entry 3 Effect Indices**: 4
- **Effect Schedule Entry 3 Effect Types**: DAMAGE
- **Effect Schedule Entry 3 Target Count**: all
- **Effect Schedule Entry 3 Target Valid Targets**: creatures
- **Effect Schedule Entry 3 Target Selection**: all_valid_targets
- **Effect Schedule Entry 3 Target Must Be Different**: not_applicable
- **Effect Schedule Entry 3 Summary**: Creatures under the cloud take 2d6 Bludgeoning damage.
- **Effect Schedule Entry 4 Label**: Turns 5 through 10 freezing rain
- **Effect Schedule Entry 4 Timing**: caster_turn_start
- **Effect Schedule Entry 4 Turn Start**: 5
- **Effect Schedule Entry 4 Turn End**: 10
- **Effect Schedule Entry 4 Effect Indices**: 5, 6, 7
- **Effect Schedule Entry 4 Effect Types**: DAMAGE, TERRAIN
- **Effect Schedule Entry 4 Target Count**: all
- **Effect Schedule Entry 4 Target Valid Targets**: creatures
- **Effect Schedule Entry 4 Target Selection**: all_valid_targets
- **Effect Schedule Entry 4 Target Must Be Different**: not_applicable
- **Effect Schedule Entry 4 Summary**: Creatures under the cloud take 1d6 Cold damage, and the area becomes Difficult Terrain and Heavily Obscured with ranged weapon attacks impossible and strong wind.
- **Effect Schedule Notes**: The initial thunder damage and Deafened condition resolve when the storm appears; this schedule covers the later caster-turn stages only.

- **Description**: A churning storm cloud forms for the duration, centered on a point within range and spreading to a radius of 300 feet. Each creature under the cloud when it appears must succeed on a Constitution saving throw or take 2d6 Thunder damage and have the Deafened condition for the duration. At the start of each of your later turns, the storm produces different effects, as detailed below. Turn 2. Acidic rain falls. Each creature and object under the cloud takes 4d6 Acid damage. Turn 3. You call six bolts of lightning from the cloud to strike six different creatures or objects beneath it. Each target makes a Dexterity saving throw, taking 10d6 Lightning damage on a failed save or half as much damage on a successful one. Turn 4. Hailstones rain down. Each creature under the cloud takes 2d6 Bludgeoning damage. Turns 5-10. Gusts and freezing rain assail the area under the cloud. Each creature there takes 1d6 Cold damage. Until the spell ends, the area is Difficult Terrain and Heavily Obscured , ranged attacks with weapons are impossible there, and strong wind blows through the area.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Storm of Vengeance
Level: 9th
Casting Time: 1 Action
Range/Area: 1 mile
Components: V, S
Duration: Concentration 1 Minute
School: Conjuration
Attack/Save: CON Save
Damage/Effect: Thunder (...)

Rules Text:
A churning storm cloud forms for the duration, centered on a point within range and spreading to a radius of 300 feet. Each creature under the cloud when it appears must succeed on a Constitution saving throw or take 2d6 Thunder damage and have the Deafened condition for the duration.
At the start of each of your later turns, the storm produces different effects, as detailed below.
Turn 2. Acidic rain falls. Each creature and object under the cloud takes 4d6 Acid damage.
Turn 3. You call six bolts of lightning from the cloud to strike six different creatures or objects beneath it. Each target makes a Dexterity saving throw, taking 10d6 Lightning damage on a failed save or half as much damage on a successful one.
Turn 4. Hailstones rain down. Each creature under the cloud takes 2d6 Bludgeoning damage.
Turns 5-10. Gusts and freezing rain assail the area under the cloud. Each creature there takes 1d6 Cold damage. Until the spell ends, the area is Difficult Terrain and Heavily Obscured , ranged attacks with weapons are impossible there, and strong wind blows through the area.

Spell Tags:
Damage
Control
Debuff

Available For:
Druid

Referenced Rules:
Difficult Terrain -> /rules-glossary/50-tooltip
Heavily Obscured -> /rules-glossary/65-tooltip

Capture Method: http
Legacy Page: false
-->
