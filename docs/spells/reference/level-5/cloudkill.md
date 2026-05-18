# Cloudkill
- **Level**: 5
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Sorcerer, Wizard
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Targeting Type**: area
- **Area Shape**: sphere
- **Area Size**: 20
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
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, UTILITY
- **Utility Type**: sensory
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
- **Damage Dice**: 5d8
- **Damage Type**: Poison

- **Description**: You create a 20-foot-radius Sphere of yellow-green fog centered on a point within range. The fog lasts for the duration or until strong wind (such as the one created by Gust of Wind) disperses it, ending the spell. Its area is Heavily Obscured . Each creature in the Sphere makes a Constitution saving throw, taking 5d8 Poison damage on a failed save or half as much damage on a successful one. A creature must also make this save when the Sphere moves into its space and when it enters the Sphere or ends its turn there. A creature makes this save only once per turn. The Sphere moves 10 feet away from you at the start of each of your turns.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 5.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Poison damage | dice 5d8 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Cloudkill
Level: 5th
Casting Time: 1 Action
Range/Area: 120 ft. (20 ft.)
Components: V, S
Duration: Concentration 10 Minutes
School: Conjuration
Attack/Save: CON Save
Damage/Effect: Poison

Rules Text:
You create a 20-foot-radius Sphere of yellow-green fog centered on a point within range. The fog lasts for the duration or until strong wind (such as the one created by Gust of Wind) disperses it, ending the spell. Its area is Heavily Obscured .
Each creature in the Sphere makes a Constitution saving throw, taking 5d8 Poison damage on a failed save or half as much damage on a successful one. A creature must also make this save when the Sphere moves into its space and when it enters the Sphere or ends its turn there. A creature makes this save only once per turn.
The Sphere moves 10 feet away from you at the start of each of your turns.
Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 5.

Spell Tags:
Damage

Available For:
Sorcerer
Wizard
Cleric - Death Domain (DMG)
Druid - Circle of Spores (TCoE)
Paladin - Oath of Conquest (XGtE)
Warlock - The Undead (VRGtR)
Cleric - Festus Domain
Warlock - Mother of Sorrows (BoET)

Referenced Rules:
Sphere -> /rules-glossary/109-tooltip
Heavily Obscured -> /rules-glossary/65-tooltip

Capture Method: http
Legacy Page: false
-->
