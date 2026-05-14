# Absorb Elements

- **Level**: 1
- **School**: Abjuration
- **Ritual**: false
- **Classes**: Artificer, Druid, Ranger, Sorcerer, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: reaction
- **Combat Cost**: reaction
- **Reaction Trigger**: when you take acid, cold, fire, lightning, or thunder damage

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: self
- **Targeting Range**: 0
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
- **Line of Sight**: true

- **Verbal**: false
- **Somatic**: true
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: round
- **Concentration**: false

- **Effect Type**: DEFENSIVE, DAMAGE
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: on_attack_hit
- **Conditional Ending Scope**: spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Defense Type**: resistance
- **Damage Type**: triggering_damage_type
- **Defense Damage Type Source**: triggering_damage_type

- **Description**: The spell captures some of the incoming energy, lessening its effect on you and storing it for your next melee attack. You have resistance to the triggering damage type until the start of your next turn. Also, the first time you hit with a melee attack on your next turn, the target takes an extra 1d6 damage of the triggering type, and the spell ends.
- **Higher Levels**: When you cast this spell using a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each slot level above 1st.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Acid/Cold/Fire/Lightning/Thunder damage | dice 1d6 | trigger on_attack_hit
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Absorb Elements
Level: 1st
Casting Time: 1 Reaction *
Range/Area: Self
Components: S
Duration: 1 Round
School: Abjuration
Attack/Save: None
Damage/Effect: Acid (...)

Rules Text:
The spell captures some of the incoming energy, lessening its effect on you and storing it for your next melee attack. You have resistance to the triggering damage type until the start of your next turn. Also, the first time you hit with a melee attack on your next turn, the target takes an extra 1d6 damage of the triggering type, and the spell ends.
At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each slot level above 1st.

Spell Tags:
Damage
Warding

Available For:
Druid
Ranger
Sorcerer
Wizard
Artificer

Capture Method: http
Legacy Page: false
-->
