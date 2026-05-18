# Earthquake
- **Level**: 8
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Cleric, Druid, Sorcerer
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 500
- **Targeting Type**: area
- **Area Shape**: circle
- **Area Size**: 100
- **Area Size Unit**: feet
- **Area Size Type**: radius
- **Valid Targets**: not_applicable
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
- **Material Description**: a fractured rock
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: CONTROL
- **Utility Type**: environmental_control
- **Conditions Applied**: Prone, Buried
- **Terrain Type**: difficult
- **Triggered Applications**: on_cast, caster_turn_end
- **Damage Trigger**: structures in contact with the ground on cast and at the end of each caster turn; collapsing structures affect nearby creatures.
- **Utility Options**: Tremor, Fissures, Structures, Collapse rubble
- **Utility Option 1 Name**: Tremor
- **Utility Option 1 Effect**: The spell area is Difficult Terrain and grounded creatures save on cast and at the end of each caster turn.
- **Utility Option 2 Name**: Fissures
- **Utility Option 2 Effect**: 1d6 fissures open at the end of the casting turn; each is 1d10 x 10 feet deep, 10 feet wide, and crosses the area.
- **Utility Option 2 Details**: Fissures cannot be under structures; creatures in the same space save or fall in, and successful saves move with the opening edge.
- **Utility Option 3 Name**: Structures
- **Utility Option 3 Effect**: Structures touching the ground in the area take 50 Bludgeoning damage on cast and at the end of each caster turn.
- **Utility Option 4 Name**: Collapse rubble
- **Utility Option 4 Effect**: A nearby creature hit by a collapsing structure takes 12d6 Bludgeoning damage, falls Prone, and is buried in rubble; DC 20 Strength (Athletics) action escapes.
- **Save Stat**: Dexterity
- **Save Outcome**: negates_condition
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

- **Description**: Choose a point on the ground that you can see within range. For the duration, an intense tremor rips through the ground in a 100-foot-radius circle centered on that point. The ground there is Difficult Terrain . When you cast this spell and at the end of each of your turns for the duration, each creature on the ground in the area makes a Dexterity saving throw. On a failed save, a creature has the Prone condition, and its Concentration is broken. You can also cause the effects below. Fissures. A total of 1d6 fissures open in the spell's area at the end of the turn you cast it. You choose the fissures' locations, which can't be under structures. Each fissure is 1d10 x 10 feet deep and 10 feet wide, and it extends from one edge of the spell's area to another edge. A creature in the same space as a fissure must succeed on a Dexterity saving throw or fall in. A creature that successfully saves moves with the fissure's edge as it opens. Structures. The tremor deals 50 Bludgeoning damage to any structure in contact with the ground in the area when you cast the spell and at the end of each of your turns until the spell ends. If a structure drops to 0 Hit Points, it collapses. A creature within a distance from a collapsing structure equal to half the structure's height makes a Dexterity saving throw. On a failed save, the creature takes 12d6 Bludgeoning damage, has the Prone condition, and is buried in the rubble, requiring a DC 20 Strength (Athletics) check as an action to escape. On a successful save, the creature takes half as much damage only.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Earthquake
Level: 8th
Casting Time: 1 Action
Range/Area: 500 ft.
Components: V, S, M *
Duration: Concentration 1 Minute
School: Transmutation
Attack/Save: DEX Save
Damage/Effect: Bludgeoning

Rules Text:
Choose a point on the ground that you can see within range. For the duration, an intense tremor rips through the ground in a 100-foot-radius circle centered on that point. The ground there is Difficult Terrain .
When you cast this spell and at the end of each of your turns for the duration, each creature on the ground in the area makes a Dexterity saving throw. On a failed save, a creature has the Prone condition, and its Concentration is broken.
You can also cause the effects below.
Fissures. A total of 1d6 fissures open in the spell's area at the end of the turn you cast it. You choose the fissures' locations, which can't be under structures. Each fissure is 1d10 x 10 feet deep and 10 feet wide, and it extends from one edge of the spell's area to another edge. A creature in the same space as a fissure must succeed on a Dexterity saving throw or fall in. A creature that successfully saves moves with the fissure's edge as it opens.
Structures. The tremor deals 50 Bludgeoning damage to any structure in contact with the ground in the area when you cast the spell and at the end of each of your turns until the spell ends. If a structure drops to 0 Hit Points, it collapses.
A creature within a distance from a collapsing structure equal to half the structure's height makes a Dexterity saving throw. On a failed save, the creature takes 12d6 Bludgeoning damage, has the Prone condition, and is buried in the rubble, requiring a DC 20 Strength (Athletics) check as an action to escape. On a successful save, the creature takes half as much damage only.

Material Component:
* - (a fractured rock)

Spell Tags:
Damage
Control

Available For:
Cleric
Druid
Sorcerer

Referenced Rules:
Difficult Terrain -> /rules-glossary/50-tooltip
Concentration -> /rules-glossary/31-tooltip

Capture Method: http
Legacy Page: false
-->
