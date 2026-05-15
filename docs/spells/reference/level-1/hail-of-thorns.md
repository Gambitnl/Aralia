# Hail of Thorns
- **Level**: 1
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Ranger
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action
- **Reaction Trigger**: after you hit with a ranged weapon

- **Range Type**: self
- **Targeting Type**: area
- **Area Shape**: sphere
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
- **Line of Sight**: false

- **Verbal**: true
- **Somatic**: false
- **Material**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE
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
- **Damage Dice**: 1d10
- **Damage Type**: Piercing

- **Description**: As you hit the creature, this spell creates a rain of thorns that sprouts from your Ranged weapon or ammunition. The target of the attack and each creature within 5 feet of it make a Dexterity saving throw, taking 1d10 Piercing damage on a failed save or half as much damage on a successful one.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Piercing damage | dice 1d10 | trigger on_attack_hit
- **Scaling Rule 1 Bonus Per Level**: +1d10
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Piercing damage | dice 1d10 | trigger on_attack_hit | AoE damage to creatures within 5ft of target.
- **Scaling Rule 2 Bonus Per Level**: +1d10

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Hail of Thorns
Level: 1st
Casting Time: 1 Bonus Action *
Range/Area: Self
Components: V
Duration: Instantaneous
School: Conjuration
Attack/Save: DEX Save
Damage/Effect: Piercing

Rules Text:
As you hit the creature, this spell creates a rain of thorns that sprouts from your Ranged weapon or ammunition. The target of the attack and each creature within 5 feet of it make a Dexterity saving throw, taking 1d10 Piercing damage on a failed save or half as much damage on a successful one.
Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 1.

Spell Tags:
Damage

Available For:
Ranger

Capture Method: http
Legacy Page: false
-->

