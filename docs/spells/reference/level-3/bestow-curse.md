# Bestow Curse
- **Level**: 3
- **School**: Necromancy
- **Ritual**: false
- **Classes**: Bard, Cleric, Wizard
- **Sub-Classes**: Unsupported Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: touch
- **Targeting Type**: single
- **Valid Targets**: creature
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
- **Somatic**: true
- **Material**: false
- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true
- **Effect Type**: DEBUFF
- **Utility Type**: other
- **Save Stat**: Wisdom
- **Save Outcome**: negates
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
- **Description**: You touch a creature, which must succeed on a Wisdom saving throw or become cursed for the duration. Until the curse ends, the target suffers one of the following effects of your choice:
- **Higher Levels**: Using a Higher-Level Spell Slot. If you cast this spell using a level 4 spell slot, you can maintain Concentration on it for up to 10 minutes. If you use a level 5+ spell slot, the spell doesn't require Concentration, and the duration becomes 8 hours (level 5-6 slot) or 24 hours (level 7-8 slot). If you use a level 9 spell slot, the spell lasts until dispelled.
- **Scaling Rule 1 Type**: slot_level_table
- **Scaling Rule 1 Applies To**: duration.concentration
- **Scaling Rule 1 Base**: 1 minute with concentration at spell slot level 3
- **Scaling Rule 1 Levels**: 4=up to 10 minutes with concentration; 5-6=8 hours without concentration; 7-8=24 hours without concentration; 9=until dispelled without concentration
- **Scaling Rule 1 Notes**: If you cast this spell using a level 4 spell slot, you can maintain Concentration on it for up to 10 minutes. If you use a level 5+ spell slot, the spell doesn't require Concentration, and the duration becomes 8 hours (level 5-6 slot) or 24 hours (level 7-8 slot). If you use a level 9 spell slot, the spell lasts until dispelled.
## Canonical D&D Beyond Snapshot
This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.
<!--
Name: Bestow Curse
Level: 3rd
Casting Time: 1 Action
Range/Area: Touch
Components: V, S
Duration: Concentration 1 Minute
School: Necromancy
Attack/Save: WIS Save
Damage/Effect: Debuff
Rules Text:
You touch a creature, which must succeed on a Wisdom saving throw or become cursed for the duration. Until the curse ends, the target suffers one of the following effects of your choice:
Using a Higher-Level Spell Slot. If you cast this spell using a level 4 spell slot, you can maintain Concentration on it for up to 10 minutes. If you use a level 5+ spell slot, the spell doesn't require Concentration, and the duration becomes 8 hours (level 5-6 slot) or 24 hours (level 7-8 slot). If you use a level 9 spell slot, the spell lasts until dispelled.
Spell Tags:
Debuff
Available For:
Bard
Cleric
Wizard
Paladin - Oath of Conquest (XGtE)
Paladin - Oathbreaker (DMG)
Warlock - Horned King Patron
Capture Method: http
Legacy Page: false
-->
