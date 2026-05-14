# Cloud of Daggers
- **Level**: 2
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Bard, Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: area
- **Area Shape**: cube
- **Area Size**: 5
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
- **Material Description**: a sliver of glass
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE
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
- **Damage Dice**: 4d4
- **Damage Type**: Slashing

- **Description**: You conjure spinning daggers in a 5-foot Cube centered on a point within range. Each creature in that area takes 4d4 Slashing damage. A creature also takes this damage if it enters the Cube or ends its turn there or if the Cube moves into its space. A creature takes this damage only once per turn. On your later turns, you can take a Magic action to teleport the Cube up to 30 feet.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 2d4 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Slashing damage | dice 4d4 | trigger on_enter_area | A creature takes 4d4 Slashing damage when it enters the Cube, ends its turn ther
- **Scaling Rule 1 Bonus Per Level**: +2d4
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Slashing damage | dice 4d4 | trigger on_end_turn_in_area | A creature takes 4d4 Slashing damage when it enters the Cube, ends its turn ther
- **Scaling Rule 2 Bonus Per Level**: +2d4

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Cloud of Daggers
Level: 2nd
Casting Time: 1 Action
Range/Area: 60 ft. (5 ft.)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Conjuration
Attack/Save: None
Damage/Effect: Slashing

Rules Text:
You conjure spinning daggers in a 5-foot Cube centered on a point within range. Each creature in that area takes 4d4 Slashing damage. A creature also takes this damage if it enters the Cube or ends its turn there or if the Cube moves into its space. A creature takes this damage only once per turn.
On your later turns, you can take a Magic action to teleport the Cube up to 30 feet.
Using a Higher-Level Spell Slot. The damage increases by 2d4 for each spell slot level above 2.

Material Component:
* - (a sliver of glass)

Spell Tags:
Damage

Available For:
Bard
Sorcerer
Warlock
Wizard

Referenced Rules:
Cube -> /rules-glossary/38-tooltip

Capture Method: http
Legacy Page: false
-->

