# Phantasmal Killer
- **Level**: 4
- **School**: Illusion
- **Ritual**: false
- **Classes**: Bard, Wizard
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Targeting Type**: single
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
- **Save Stat**: Wisdom
- **Save Outcome**: half
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: initial_save_success, repeat_save_success
- **Conditional Ending Scope**: spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 4d10
- **Damage Type**: Psychic

- **Description**: You tap into the nightmares of a creature you can see within range and create an illusion of its deepest fears, visible only to that creature. The target makes a Wisdom saving throw. On a failed save, the target takes 4d10 Psychic damage and has Disadvantage on ability checks and attack rolls for the duration. On a successful save, the target takes half as much damage, and the spell ends. For the duration, the target makes a Wisdom saving throw at the end of each of its turns. On a failed save, it takes the Psychic damage again. On a successful save, the spell ends.
- **Higher Levels**: The damage increases by 1d10 for each spell slot level above 4.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Psychic damage | dice 4d10 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d10
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Psychic damage | dice 4d10 | trigger turn_end
- **Scaling Rule 2 Bonus Per Level**: +1d10

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Phantasmal Killer
Level: 4th
Casting Time: 1 Action
Range/Area: 120 ft.
Components: V, S
Duration: Concentration 1 Minute
School: Illusion
Attack/Save: WIS Save
Damage/Effect: Psychic

Rules Text:
You tap into the nightmares of a creature you can see within range and create an illusion of its deepest fears, visible only to that creature. The target makes a Wisdom saving throw. On a failed save, the target takes 4d10 Psychic damage and has Disadvantage on ability checks and attack rolls for the duration. On a successful save, the target takes half as much damage, and the spell ends.
For the duration, the target makes a Wisdom saving throw at the end of each of its turns. On a failed save, it takes the Psychic damage again. On a successful save, the spell ends.
Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 4.

Spell Tags:
Damage
Control

Available For:
Bard
Wizard
Warlock - The Genie (TCoE)
Warlock - The Hexblade (XGtE)
Warlock - Horned King Patron
Warlock - Mother of Sorrows (BoET)

Capture Method: http
Legacy Page: false
-->
