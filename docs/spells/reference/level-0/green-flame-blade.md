# Green-Flame Blade

- **Level**: 0
- **School**: Evocation
- **Ritual**: false
- **Classes**: Artificer, Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: melee
- **Targeting Range**: 5
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Valid Targets**: creatures, enemies
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

- **Verbal**: false
- **Somatic**: true
- **Material**: true
- **Material Description**: a melee weapon worth at least 1 sp
- **Material Cost GP**: 0.1

- **Duration Type**: instantaneous
- **Duration Value**: 0
- **Duration Unit**: round
- **Concentration**: false

- **Effect Type**: DAMAGE
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
- **Damage Dice**: 1d8
- **Damage Type**: Fire
- **Secondary Target Trigger**: primary_hit
- **Secondary Target Origin**: primary_target
- **Secondary Target Range**: 5
- **Secondary Target Range Unit**: feet
- **Secondary Target Valid Targets**: creature
- **Secondary Target Selection**: caster_choice
- **Secondary Target Must Be Different**: true
- **Secondary Target Requires Line Of Sight**: true
- **Secondary Target Requires Attack Roll**: false
- **Secondary Target Requires Damage Roll**: false
- **Secondary Target Repeat Rule**: not_applicable
- **Secondary Target Max Leaps**: not_applicable
- **Secondary Target Unique Per Casting**: not_applicable
- **Secondary Target Notes**: On a hit, the caster may choose a different visible creature within 5 feet of the hit target for the secondary fire damage; this is not a second initial spell target.

- **Description**: You brandish the weapon used in the spell's casting and make a melee attack with it against one creature within 5 feet of you. On a hit, the target suffers the weapon attack's normal effects, and you can cause green fire to leap from the target to a different creature of your choice that you can see within 5 feet of it. The second creature takes fire damage equal to your spellcasting ability modifier.
- **Higher Levels**: This spell's damage increases when you reach certain levels. At 5th level, the melee attack deals an extra 1d8 fire damage to the target on a hit, and the fire damage to the second creature increases to 1d8 + your spellcasting ability modifier. Both damage rolls increase by 1d8 at 11th level (2d8 and 2d8) and 17th level (3d8 and 3d8).
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 1d8 | trigger immediate | Extra fire damage to the primary target scales with level.
- **Scaling Rule 1 Notes**: At 5th level +1d8 fire; 11th level +2d8; 17th level +3d8.
- **Scaling Rule 2 Type**: character_level_tiers
- **Scaling Rule 2 Applies To**: damage | Fire damage | dice spellcasting_mod | trigger immediate | On a hit, a second creature within 5 feet of the target takes fire damage equal 
- **Scaling Rule 2 Notes**: Secondary target gains +1d8 fire at 5th, +2d8 at 11th, +3d8 at 17th.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Green-Flame Blade
Level: Cantrip
Casting Time: 1 Action
Range/Area: Self (5 ft.)
Components: S, M *
Duration: Instantaneous
School: Evocation
Attack/Save: Melee
Damage/Effect: Fire (...)

Rules Text:
You brandish the weapon used in the spell's casting and make a melee attack with it against one creature within 5 feet of you. On a hit, the target suffers the weapon attack's normal effects, and you can cause green fire to leap from the target to a different creature of your choice that you can see within 5 feet of it. The second creature takes fire damage equal to your spellcasting ability modifier.
This spell's damage increases when you reach certain levels. At 5th level, the melee attack deals an extra 1d8 fire damage to the target on a hit, and the fire damage to the second creature increases to 1d8 + your spellcasting ability modifier. Both damage rolls increase by 1d8 at 11th level (2d8 and 2d8) and 17th level (3d8 and 3d8).

Material Component:
* - (a melee weapon worth at least 1 sp)

Spell Tags:
Damage
Combat

Available For:
Sorcerer
Warlock
Wizard
Artificer

Capture Method: http
Legacy Page: false
-->
