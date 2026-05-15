# Flame Blade
- **Level**: 2
- **School**: Evocation
- **Ritual**: false
- **Classes**: Druid, Sorcerer
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action

- **Range Type**: self
- **Targeting Type**: self
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
- **Material**: true
- **Material Description**: a sumac leaf
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, UTILITY
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **Utility Type**: light
- **Attack Roll**: melee
- **Damage Dice**: 3d6
- **Damage Type**: Fire
- **Light Bright Radius**: 10
- **Light Dim Radius**: 10
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable

- **Description**: You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts for the duration. If you let go of the blade, it disappears, but you can evoke it again as a Bonus Action. As a Magic action, you can make a melee spell attack with the fiery blade. On a hit, the target takes Fire damage equal to 3d6 plus your spellcasting ability modifier. The flaming blade sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 3d6 | trigger on_caster_action | Melee spell attack with the summoned blade deals Fire damage equal to 3d6 plus y
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Flame Blade
Level: 2nd
Casting Time: 1 Bonus Action
Range/Area: Self
Components: V, S, M *
Duration: Concentration 10 Minutes
School: Evocation
Attack/Save: Melee
Damage/Effect: Fire

Rules Text:
You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts for the duration. If you let go of the blade, it disappears, but you can evoke it again as a Bonus Action.
As a Magic action, you can make a melee spell attack with the fiery blade. On a hit, the target takes Fire damage equal to 3d6 plus your spellcasting ability modifier.
The flaming blade sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.

Material Component:
* - (a sumac leaf)

Spell Tags:
Damage

Available For:
Druid
Sorcerer

Referenced Rules:
Bright Light -> /rules-glossary/21-tooltip
Dim Light -> /rules-glossary/52-tooltip

Capture Method: http
Legacy Page: false
-->
