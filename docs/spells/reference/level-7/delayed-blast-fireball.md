# Delayed Blast Fireball
- **Level**: 7
- **School**: Evocation
- **Ritual**: false
- **Classes**: Sorcerer, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 150
- **Targeting Type**: area
- **Area Shape**: Sphere
- **Area Size**: 20
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
- **Material**: true
- **Material Description**: a ball of bat guano and sulfur
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, UTILITY
- **Utility Type**: creation
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
- **Damage Dice**: 12d6
- **Damage Type**: Fire
- **Utility Options**: Glowing Bead; Damage Accumulates; Touch Bead Save; Throw Bead; Collision Explodes; Ignites Flammable Objects
- **Utility Option 1 Name**: Glowing Bead
- **Utility Option 1 Effect**: The spell condenses as a glowing bead at a chosen point until it explodes.
- **Utility Option 2 Name**: Damage Accumulates
- **Utility Option 2 Effect**: The base damage is 12d6 and increases by 1d6 whenever the caster's turn ends and the spell has not ended.
- **Utility Option 3 Name**: Touch Bead Save
- **Utility Option 3 Effect**: A creature that touches the bead before the spell ends makes a Dexterity save; on a failed save, the spell ends and the bead explodes.
- **Utility Option 4 Name**: Throw Bead
- **Utility Option 4 Effect**: On a successful save after touching the bead, the creature can throw the bead up to 40 feet.
- **Utility Option 5 Name**: Collision Explodes
- **Utility Option 5 Effect**: If the thrown bead enters a creature's space or collides with a solid object, the spell ends and the bead explodes.
- **Utility Option 6 Name**: Ignites Flammable Objects
- **Utility Option 6 Effect**: When the bead explodes, flammable objects in the explosion that are not being worn or carried start burning.

- **Description**: A beam of yellow light flashes from you, then condenses at a chosen point within range as a glowing bead for the duration. When the spell ends, the bead explodes, and each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw. A creature takes Fire damage equal to the total accumulated damage on a failed save or half as much damage on a successful one. The spell's base damage is 12d6, and the damage increases by 1d6 whenever your turn ends and the spell hasn't ended. If a creature touches the glowing bead before the spell ends, that creature makes a Dexterity saving throw. On a failed save, the spell ends, causing the bead to explode. On a successful save, the creature can throw the bead up to 40 feet. If the thrown bead enters a creature's space or collides with a solid object, the spell ends, and the bead explodes. When the bead explodes, flammable objects in the explosion that aren't being worn or carried start burning .
- **Higher Levels**: Using a Higher-Level Spell Slot. The base damage increases by 1d6 for each spell slot level above 7.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 12d6 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Delayed Blast Fireball
Level: 7th
Casting Time: 1 Action
Range/Area: 150 ft. (20 ft.)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Evocation
Attack/Save: DEX Save
Damage/Effect: Fire (...)

Rules Text:
A beam of yellow light flashes from you, then condenses at a chosen point within range as a glowing bead for the duration. When the spell ends, the bead explodes, and each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw. A creature takes Fire damage equal to the total accumulated damage on a failed save or half as much damage on a successful one.
The spell's base damage is 12d6, and the damage increases by 1d6 whenever your turn ends and the spell hasn't ended.
If a creature touches the glowing bead before the spell ends, that creature makes a Dexterity saving throw. On a failed save, the spell ends, causing the bead to explode. On a successful save, the creature can throw the bead up to 40 feet. If the thrown bead enters a creature's space or collides with a solid object, the spell ends, and the bead explodes.
When the bead explodes, flammable objects in the explosion that aren't being worn or carried start burning .
Using a Higher-Level Spell Slot. The base damage increases by 1d6 for each spell slot level above 7.

Material Component:
* - (a ball of bat guano and sulfur)

Spell Tags:
Damage

Available For:
Sorcerer
Wizard

Referenced Rules:
Sphere -> /rules-glossary/109-tooltip
burning -> /rules-glossary/22-tooltip

Capture Method: http
Legacy Page: false
-->
