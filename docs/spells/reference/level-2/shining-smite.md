# Shining Smite
- **Level**: 2
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Paladin
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action
- **Reaction Trigger**: immediately after you hit a creature with a weapon or Unarmed Strike

- **Range Type**: self
- **Targeting Type**: single
- **Valid Targets**: creature_hit
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

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, UTILITY
- **Utility Type**: light
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
- **Damage Dice**: 2d6
- **Damage Type**: Radiant
- **Light Bright Radius**: 5

- **Description**: The target hit by the strike takes an extra 2d6 Radiant damage from the attack. Until the spell ends, the target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it can't benefit from the Invisible condition.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Radiant damage | dice 2d6 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Shining Smite
Level: 2nd
Casting Time: 1 Bonus Action *
Range/Area: Self
Components: V
Duration: Concentration 1 Minute
School: Transmutation
Attack/Save: None
Damage/Effect: Radiant

Rules Text:
The target hit by the strike takes an extra 2d6 Radiant damage from the attack. Until the spell ends, the target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it can't benefit from the Invisible condition.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.

Available For:
Paladin

Referenced Rules:
Bright Light -> /rules-glossary/21-tooltip

Capture Method: http
Legacy Page: true
-->
