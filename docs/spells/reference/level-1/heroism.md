# Heroism
- **Level**: 1
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Bard, Paladin
- **Sub-Classes**: Unsupported Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: touch
- **Targeting Type**: multi
- **Targeting Max**: 1
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
- **Target Self Relation**: not_applicable
- **Line of Sight**: true
- **Verbal**: true
- **Somatic**: true
- **Material**: false
- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true
- **Effect Type**: DEFENSIVE, UTILITY
- **Defense Type**: immunity
- **Condition Immunities**: Frightened
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Repeat Save Timing**: not_applicable
- **Repeat Save Additional Timings**: not_applicable
- **Repeat Save Type**: not_applicable
- **Repeat Save Success Ends**: not_applicable
- **Repeat Save Progression**: not_applicable
- **Recurring Mechanics**: The target gains Temporary Hit Points equal to the caster's spellcasting ability modifier at the start of each of the target's turns.
- **Recurring Mechanic Timing**: turn_start
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **End Cleanup Trigger**: spell_ends
- **End Cleanup Removes**: temporary_hit_points
- **End Cleanup Source**: this_spell
- **End Cleanup Scope**: target
- **End Cleanup Amount**: all_remaining
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Utility Type**: other
- **Description**: A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to the Frightened condition and gains Temporary Hit Points equal to your spellcasting ability modifier at the start of each of its turns.
- **Higher Levels**: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: targeting.maxTargets
- **Scaling Rule 1 Bonus Per Level**: +1 target
- **Scaling Rule 1 Notes**: You can target one additional creature for each spell slot level above 1.
## Canonical D&D Beyond Snapshot
This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.
<!--
Name: Heroism
Level: 1st
Casting Time: 1 Action
Range/Area: Touch
Components: V, S
Duration: Concentration 1 Minute
School: Enchantment
Attack/Save: None
Damage/Effect: Frightened
Rules Text:
A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to the Frightened condition and gains Temporary Hit Points equal to your spellcasting ability modifier at the start of each of its turns.
Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.
Spell Tags:
Buff
Available For:
Bard
Paladin
Cleric - Order Domain (TCoE)
Cleric - Peace Domain (TCoE)
Paladin - Oath of Glory
Paladin - Oath of the Harvest (HGtMH1)
Cleric - Community Domain (HCS)
Referenced Rules:
Temporary Hit Points -> /rules-glossary/119-tooltip
Capture Method: http
Legacy Page: false
-->
