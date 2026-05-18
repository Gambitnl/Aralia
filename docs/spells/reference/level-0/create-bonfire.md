# Create Bonfire

- **Level**: 0
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Artificer, Druid, Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Range Distance Unit**: feet
- **Targeting Type**: area
- **Targeting Range**: 60
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Valid Targets**: ground
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
- **Area Shape**: Cube
- **Area Size**: 5
- **Area Size Unit**: feet

- **Verbal**: true
- **Somatic**: true
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE
- **Save Stat**: Dexterity
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
- **Damage Dice**: 1d8
- **Damage Type**: Fire

- **Description**: You create a bonfire on ground that you can see within range. Until the spell ends, the magic bonfire fills a 5-foot cube. Any creature in the bonfire's space when you cast the spell must succeed on a Dexterity saving throw or take 1d8 fire damage. A creature must also make the saving throw when it moves into the bonfire's space for the first time on a turn or ends its turn there. The bonfire ignites flammable objects in its area that aren't being worn or carried.
- **Higher Levels**: The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 1d8 | trigger immediate | Any creature in the bonfire's space when you cast the spell must succeed on a De
- **Scaling Rule 1 Levels**: 5=2d8, 11=3d8, 17=4d8
- **Scaling Rule 2 Type**: character_level_tiers
- **Scaling Rule 2 Applies To**: damage | Fire damage | dice 1d8 | trigger on_end_turn_in_area | A creature that ends its turn in the bonfire's space must make this saving throw
- **Scaling Rule 2 Levels**: 5=2d8, 11=3d8, 17=4d8
- **Scaling Rule 3 Type**: character_level_tiers
- **Scaling Rule 3 Applies To**: damage | Fire damage | dice 1d8 | trigger on_enter_area | A creature that moves into the bonfire's space for the first time on a turn must
- **Scaling Rule 3 Levels**: 5=2d8, 11=3d8, 17=4d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Create Bonfire
Level: Cantrip
Casting Time: 1 Action
Range/Area: 60 ft. (5 ft.)
Components: V, S
Duration: Concentration 1 Minute
School: Conjuration
Attack/Save: DEX Save
Damage/Effect: Fire

Rules Text:
You create a bonfire on ground that you can see within range. Until the spell ends, the magic bonfire fills a 5-foot cube. Any creature in the bonfire's space when you cast the spell must succeed on a Dexterity saving throw or take 1d8 fire damage. A creature must also make the saving throw when it moves into the bonfire's space for the first time on a turn or ends its turn there.
The bonfire ignites flammable objects in its area that aren't being worn or carried.
The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).

Spell Tags:
Damage
Control

Available For:
Druid
Sorcerer
Warlock
Wizard
Artificer
-->

