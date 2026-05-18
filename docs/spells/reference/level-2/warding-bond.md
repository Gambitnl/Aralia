# Warding Bond
- **Level**: 2
- **School**: Abjuration
- **Ritual**: false
- **Classes**: Cleric, Paladin
- **Sub-Classes**: Folded into Classes

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: touch
- **Targeting Type**: single
- **Valid Targets**: creatures
- **Target Willingness**: required
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
- **Target Self Relation**: must_be_other
- **Line of Sight**: true

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a pair of platinum rings worth 50+ GP each, which you and the target must wear for the duration
- **Material Cost GP**: 100
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: hour
- **Concentration**: false

- **Effect Type**: DEFENSIVE, UTILITY
- **Save Stat**: not_applicable
- **Save Outcome**: not_applicable
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: caster_drops_to_0_hp, linked_creatures_separated_beyond_distance, spell_cast_again_on_connected_creature
- **Conditional Ending Scope**: spell, spell, spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Defense Type**: ac_bonus, resistance
- **Defense Value**: 1
- **Damage Type**: All
- **Linked Damage Trigger**: target_takes_damage
- **Linked Damage Recipient**: caster
- **Linked Damage Amount**: same_amount
- **Linked Damage Amount Basis**: post_target_mitigation
- **Linked Damage Type Source**: triggering_damage_type
- **Linked Damage Recipient Mitigation**: not_reapplied
- **Description**: You touch another creature that is willing and create a mystic connection between you and the target until the spell ends. While the target is within 60 feet of you, it gains a +1 bonus to AC and saving throws, and it has Resistance to all damage. Also, each time it takes damage, you take the same amount of damage. The spell ends if you drop to 0 Hit Points or if you and the target become separated by more than 60 feet. It also ends if the spell is cast again on either of the connected creatures.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Warding Bond
Level: 2nd
Casting Time: 1 Action
Range/Area: Touch
Components: V, S, M *
Duration: 1 Hour
School: Abjuration
Attack/Save: None
Damage/Effect: Buff (...)

Rules Text:
You touch another creature that is willing and create a mystic connection between you and the target until the spell ends. While the target is within 60 feet of you, it gains a +1 bonus to AC and saving throws, and it has Resistance to all damage. Also, each time it takes damage, you take the same amount of damage.
The spell ends if you drop to 0 Hit Points or if you and the target become separated by more than 60 feet. It also ends if the spell is cast again on either of the connected creatures.

Material Component:
* - (a pair of platinum rings worth 50+ GP each, which you and the target must wear for the duration)

Spell Tags:
Buff
Warding

Available For:
Cleric
Paladin
Cleric - Peace Domain (TCoE)
Paladin - Oath of the Crown (SCAG)
Paladin - Oath of the Harvest (HGtMH1)
Cleric - Keeper Domain (BoET)

Capture Method: http
Legacy Page: false
-->
