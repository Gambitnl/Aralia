# Armor of Agathys
- **Level**: 1
- **School**: Abjuration
- **Ritual**: false
- **Classes**: Warlock
- **Sub-Classes**: Unsupported Entries

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
- **Material Description**: a shard of blue glass
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: hour
- **Concentration**: false

- **Effect Type**: DEFENSIVE, DAMAGE
- **Defense Type**: temporary_hp
- **Defense Value**: 5
- **Damage Trigger**: on_target_attack
- **Save Stat**: not_applicable
- **Save Outcome**: not_applicable
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: temporary_hit_points_depleted
- **Conditional Ending Scope**: spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 5
- **Damage Type**: Cold

- **Description**: Protective magical frost surrounds you. You gain 5 Temporary Hit Points . If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage. The spell ends early if you have no Temporary Hit Points.
- **Higher Levels**: Using a Higher-Level Spell Slot. The Temporary Hit Points and the Cold damage both increase by 5 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: defensive | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +5 temp HP
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Cold damage | dice 5 | trigger on_target_attack
- **Scaling Rule 2 Bonus Per Level**: +5

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Armor of Agathys
Level: 1st
Casting Time: 1 Bonus Action
Range/Area: Self
Components: V, S, M *
Duration: 1 Hour
School: Abjuration
Attack/Save: None
Damage/Effect: Cold

Rules Text:
Protective magical frost surrounds you. You gain 5 Temporary Hit Points . If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage. The spell ends early if you have no Temporary Hit Points.
Using a Higher-Level Spell Slot. The Temporary Hit Points and the Cold damage both increase by 5 for each spell slot level above 1.

Material Component:
* - (a shard of blue glass)

Spell Tags:
Damage
Buff
Warding

Available For:
Warlock
Paladin - Oath of Conquest (XGtE)

Referenced Rules:
Temporary Hit Points -> /rules-glossary/119-tooltip

Capture Method: http
Legacy Page: false
-->
