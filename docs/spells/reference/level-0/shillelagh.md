# Shillelagh

- **Level**: 0
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Druid
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: self
- **Targeting Range**: 5
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
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
- **Target Self Relation**: not_applicable
- **Line of Sight**: false

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: mistletoe

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Type**: UTILITY
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: end_on_recast, holder_releases_item
- **Conditional Ending Scope**: spell, spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Attack Augment 1 Attack Type**: melee_weapon
- **Attack Augment 1 Weapon Types**: club, quarterstaff
- **Attack Augment 1 Weapon Proficiency Required**: not_applicable
- **Attack Augment 1 Weapon Minimum Value CP**: not_applicable
- **Attack Augment 1 Weapon Held By Caster**: true
- **Attack Augment 1 Granted Attack Timing**: while_active
- **Attack Augment 1 Granted Attack Count**: not_applicable
- **Attack Augment 1 Uses Casting Weapon**: true
- **Attack Augment 1 Ability Attack Roll**: spellcasting_ability
- **Attack Augment 1 Ability Damage Roll**: spellcasting_ability
- **Attack Augment 1 Ability Replaces**: Strength
- **Attack Augment 1 Damage Die Override**: d8
- **Attack Augment 1 Damage Die Scaling**: d8 at levels 1-4; d10 at levels 5-10; d12 at levels 11-16; 2d6 at level 17+
- **Attack Augment 1 Damage Type Choice Timing**: on_damage
- **Attack Augment 1 Damage Type Choice Options**: Force, weapon_normal
- **Attack Augment 1 Additional Damage Dice**: not_applicable
- **Attack Augment 1 Additional Damage Type**: not_applicable
- **Attack Augment 1 Applies On**: hit
- **Attack Augment 1 Notes**: While the spell is active, melee attacks with the imbued club or quarterstaff use the caster's spellcasting ability, use the replacement damage die, and may deal Force or the weapon's normal damage type.
- **Utility Type**: other

- **Description**: A club or quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon's damage die becomes a d8. If the attack deals damage, it can be Force damage or the weapon's normal damage type (your choice). The spell ends early if you cast it again or if you let go of the weapon.
- **Higher Levels**: The damage die changes when you reach levels 5 (d10), 11 (d12), and 17 (2d6).
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: utility | trigger immediate | utility other | Imbues club/quarterstaff: use spellcasting ability for attack/damage, damage die
- **Scaling Rule 1 Notes**: d8 (1-4), d10 (5-10), d12 (11-16), 2d6 (17+)

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Shillelagh
Level: Cantrip
Casting Time: 1 Bonus Action
Range/Area: Self
Components: V, S, M *
Duration: 1 Minute
School: Transmutation
Attack/Save: Melee
Damage/Effect: Bludgeoning (...)

Rules Text:
A Club or Quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon's damage die becomes a d8. If the attack deals damage, it can be Force damage or the weapon's normal damage type (your choice).
The spell ends early if you cast it again or if you let go of the weapon.
Cantrip Upgrade. The damage die changes when you reach levels 5 (d10), 11 (d12), and 17 (2d6).

Material Component:
* - (mistletoe)

Spell Tags:
Damage
Buff

Available For:
Druid

Capture Method: http
Legacy Page: false
-->
