# Charm Person
- **Level**: 1
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Bard, Druid, Sorcerer, Warlock, Wizard
- **Sub-Classes**: Cleric - Trickery Domain, Ranger - Fey Wanderer
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
- **Target Filter Creature Types**: Humanoid
- **Line of Sight**: true
- **Verbal**: true
- **Somatic**: true
- **Material**: false
- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: hour
- **Concentration**: false
- **Effect Type**: STATUS_CONDITION, UTILITY
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
- **Description**: One Humanoid you can see within range makes a Wisdom saving throw. It does so with Advantage if you or your allies are fighting it. On a failed save, the target has the Charmed condition until the spell ends or until you or your allies damage it. The Charmed creature is Friendly to you. When the spell ends, the target knows it was Charmed by you.
- **Higher Levels**: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: status_condition | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1 target
## Canonical D&D Beyond Snapshot
This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.
<!--
Name: Charm Person
Level: 1st
Casting Time: 1 Action
Range/Area: 30 ft.
Components: V, S
Duration: 1 Hour
School: Enchantment
Attack/Save: WIS Save
Damage/Effect: Charmed
Rules Text:
One Humanoid you can see within range makes a Wisdom saving throw. It does so with Advantage if you or your allies are fighting it. On a failed save, the target has the Charmed condition until the spell ends or until you or your allies damage it. The Charmed creature is Friendly to you. When the spell ends, the target knows it was Charmed by you.
Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.
Spell Tags:
Control
Social
Available For:
Bard
Druid
Sorcerer
Warlock
Wizard
Cleric - Trickery Domain
Paladin - Oath of Revelry
Ranger - Fey Wanderer
Referenced Rules:
Friendly -> /rules-glossary/62-tooltip
Capture Method: http
Legacy Page: true
-->
