# Dissonant Whispers
- **Level**: 1
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Bard
- **Sub-Classes**: Warlock - Great Old One Patron

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
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
- **Somatic**: false
- **Material**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE, MOVEMENT
- **Save Stat**: Wisdom
- **Save Outcome**: half damage; negates movement
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
- **Damage Dice**: 3d6
- **Damage Type**: Psychic
- **Movement Type**: push
- **Forced Movement**: usesReaction true, direction away_from_caster, maxDistance target_speed

- **Description**: One creature of your choice that you can see within range hears a discordant melody in its mind. The target makes a Wisdom saving throw. On a failed save, it takes 3d6 Psychic damage and must immediately use its Reaction, if available, to move as far away from you as it can, using the safest route. On a successful save, the target takes half as much damage only.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Psychic damage | dice 3d6 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d6
- **Scaling Rule 2 Type**: special_text
- **Scaling Rule 2 Applies To**: movement | trigger immediate
- **Scaling Rule 2 Notes**: On a failed save, the target uses its reaction to move away from you up to its speed by the safest route.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Dissonant Whispers
Level: 1st
Casting Time: 1 Action
Range/Area: 60 ft.
Components: V
Duration: Instantaneous
School: Enchantment
Attack/Save: WIS Save
Damage/Effect: Psychic

Rules Text:
One creature of your choice that you can see within range hears a discordant melody in its mind. The target makes a Wisdom saving throw. On a failed save, it takes 3d6 Psychic damage and must immediately use its Reaction, if available, to move as far away from you as it can, using the safest route. On a successful save, the target takes half as much damage only.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.

Spell Tags:
Damage
Control

Available For:
Bard
Sorcerer - Aberrant Sorcery
Warlock - Great Old One Patron
Warlock - Great Fool Patron

Capture Method: http
Legacy Page: false
-->

