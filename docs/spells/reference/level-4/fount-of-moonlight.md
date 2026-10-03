# Fount of Moonlight
- **Level**: 4
- **School**: Evocation
- **Ritual**: false
- **Classes**: Bard, Druid, Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action
- **Reaction Trigger**: when a creature you can see within 60 feet hits you with an attack roll

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
- **Target Self Relation**: must_be_self
- **Line of Sight**: false

- **Verbal**: true
- **Somatic**: true
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DEFENSIVE, DAMAGE, STATUS_CONDITION
- **Defense Type**: resistance
- **Save Stat**: Constitution
- **Save Outcome**: negates_condition
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **Light Bright Radius**: 20
- **Light Dim Radius**: 20
- **Light Color Choice**: fixed
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 2d10
- **Damage Type**: Radiant
- **Conditions Applied**: Blinded
- **Utility Type**: light

- **Description**: Searing moonlight radiates from you in a 20-foot-radius Emanation for the duration. Until the spell ends, the Emanation moves with you and emits Bright Light and Dim Light for an additional 20 feet. You have Resistance to Radiant damage. The first time each turn a creature you can see hits you with an attack roll, you can take a Reaction to deal 2d10 Radiant damage to that creature, which must succeed on a Constitution saving throw or have the Blinded condition until the end of its next turn.
- **Higher Levels**: not_applicable
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Radiant damage | dice 2d10 | trigger on_target_takes_damage
- **Scaling Rule 1 Bonus Per Level**: +1d10

## Canonical D&D Beyond Snapshot

This section stores the local source-summary snapshot so the structured Aralia field block remains the validator-facing markdown surface.

<!--
Name: Fount of Moonlight
Level: 4th
Casting Time: 1 Bonus Action
Range/Area: Self
Components: V, S
Duration: Concentration 10 Minutes
School: Evocation
Attack/Save: CON Save
Damage/Effect: Radiant

Rules Text:
Searing moonlight radiates from you in a 20-foot-radius Emanation for the duration. Until the spell ends, the Emanation moves with you and emits Bright Light and Dim Light for an additional 20 feet. You have Resistance to Radiant damage. The first time each turn a creature you can see hits you with an attack roll, you can take a Reaction to deal 2d10 Radiant damage to that creature, which must succeed on a Constitution saving throw or have the Blinded condition until the end of its next turn.

Spell Tags:
Damage
Buff
Warding
Light

Available For:
Bard
Druid
Sorcerer
Warlock
Wizard

Capture Method: local-json-summary
Legacy Page: false
-->
