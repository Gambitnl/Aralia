# Booming Blade

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
- **Targeting Type**: single
- **Targeting Range**: 5
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
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
- **Line of Sight**: true

- **Verbal**: false
- **Somatic**: true
- **Material**: true
- **Material Description**: a melee weapon worth at least 1 sp
- **Material Cost GP**: 0.1

- **Duration Type**: timed
- **Duration Value**: 1
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
- **Damage Dice**: 0
- **Damage Type**: Thunder

- **Description**: You brandish the weapon used in the spell's casting and make a melee attack with it against one creature within 5 feet of you. On a hit, the target suffers the weapon attack's normal effects and then becomes sheathed in booming energy until the start of your next turn. If the target willingly moves 5 feet or more before then, the target takes 1d8 thunder damage, and the spell ends.
- **Higher Levels**: This spell's damage increases when you reach certain levels. At 5th level, the melee attack deals an extra 1d8 thunder damage to the target on a hit, and the damage the target takes for moving increases to 2d8. Both damage rolls increase by 1d8 at 11th level (2d8 and 3d8) and again at 17th level (3d8 and 4d8).
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: damage | Thunder damage | dice 0 | trigger immediate | As part of the action used to cast this spell, you must make a melee attack with
- **Scaling Rule 1 Levels**: 5=1d8, 11=2d8, 17=3d8
- **Scaling Rule 2 Type**: character_level_tiers
- **Scaling Rule 2 Applies To**: damage | Thunder damage | dice 1d8 | trigger on_target_move | If the target willingly moves before the start of your next turn, it immediately
- **Scaling Rule 2 Levels**: 5=2d8, 11=3d8, 17=4d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Booming Blade
Level: Cantrip
Casting Time: 1 Action
Range/Area: Self (5 ft.)
Components: S, M *
Duration: 1 Round
School: Evocation
Attack/Save: Melee
Damage/Effect: Thunder (...)

Rules Text:
You brandish the weapon used in the spell's casting and make a melee attack with it against one creature within 5 feet of you. On a hit, the target suffers the weapon attack's normal effects and then becomes sheathed in booming energy until the start of your next turn. If the target willingly moves 5 feet or more before then, the target takes 1d8 thunder damage, and the spell ends.
This spell's damage increases when you reach certain levels. At 5th level, the melee attack deals an extra 1d8 thunder damage to the target on a hit, and the damage the target takes for moving increases to 2d8. Both damage rolls increase by 1d8 at 11th level (2d8 and 3d8) and again at 17th level (3d8 and 4d8).

Material Component:
* - (a melee weapon worth at least 1 sp)

Spell Tags:
Damage
Control
Combat

Available For:
Sorcerer
Warlock
Wizard
Artificer
-->

