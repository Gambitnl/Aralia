# Animal Friendship
- **Level**: 1
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Bard, Druid, Ranger
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 30
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
- **Target Filter Creature Types**: Beast
- **Line of Sight**: true

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a morsel of food
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 24
- **Duration Unit**: hour
- **Concentration**: false

- **Effect Type**: STATUS_CONDITION
- **Save Stat**: Wisdom
- **Save Outcome**: negates_condition
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: caster_or_ally_damages_target
- **Conditional Ending Scope**: spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Conditions Applied**: Charmed

- **Description**: Target a Beast that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. If you or one of your allies deals damage to the target, the spell ends.
- **Higher Levels**: Using a Higher-Level Spell Slot. You can target one additional Beast for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: status_condition | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1 target

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Animal Friendship
Level: 1st
Casting Time: 1 Action
Range/Area: 30 ft.
Components: V, S, M *
Duration: 24 Hours
School: Enchantment
Attack/Save: WIS Save
Damage/Effect: Charmed

Rules Text:
Target a Beast that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. If you or one of your allies deals damage to the target, the spell ends.
Using a Higher-Level Spell Slot. You can target one additional Beast for each spell slot level above 1.

Material Component:
* - (a morsel of food)

Spell Tags:
Control
Social

Available For:
Bard
Druid
Ranger
Cleric - Nature Domain (PHB)
Warlock - Horned King Patron

Capture Method: http
Legacy Page: false
-->
