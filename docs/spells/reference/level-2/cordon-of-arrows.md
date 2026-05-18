# Cordon of Arrows
- **Level**: 2
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Ranger
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: touch
- **Targeting Type**: area
- **Area Shape**: sphere
- **Area Size**: 30
- **Target Instance Type**: projectile
- **Target Instance Base Count**: 4
- **Target Instance Scaling Rule**: slot_level_plus_two_per_level
- **Target Instance Assignment**: not_applicable
- **Target Instance Resolution**: sequential
- **Target Instance Notes**: The spell plants up to four nonmagical arrows or bolts; each triggering creature causes one planted ammunition piece to fly up, resolve its save/damage, and then be destroyed. Each slot level above 2 adds two planted ammunition pieces.
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
- **Line of Sight**: false

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: four or more arrows or bolts
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 8
- **Duration Unit**: hour
- **Concentration**: false

- **Effect Type**: DAMAGE
- **Save Stat**: Dexterity
- **Save Outcome**: none
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: all_target_instances_expended
- **Conditional Ending Scope**: spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 2d4
- **Damage Type**: Piercing

- **Description**: You touch up to four nonmagical Arrows or Bolts and plant them in the ground in your space. Until the spell ends, the ammunition can't be physically uprooted, and whenever a creature other than you enters a space within 30 feet of the ammunition for the first time on a turn or ends its turn there, one piece of ammunition flies up to strike it. The creature must succeed on a Dexterity saving throw or take 2d4 Piercing damage. The piece of ammunition is then destroyed. The spell ends when none of the ammunition remains planted in the ground. When you cast this spell, you can designate any creatures you choose, and the spell ignores them.
- **Higher Levels**: Using a Higher-Level Spell Slot. The amount of ammunition that can be affected increases by two for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: targeting.instanceAllocation.baseCount | damage | Piercing damage | dice 2d4 | trigger on_enter_area | One planted ammo piece strikes a creature that enters the area or ends its turn
- **Scaling Rule 1 Bonus Per Level**: +2 ammo pieces

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Cordon of Arrows
Level: 2nd
Casting Time: 1 Action
Range/Area: Touch
Components: V, S, M *
Duration: 8 Hours
School: Transmutation
Attack/Save: DEX Save
Damage/Effect: Piercing

Rules Text:
You touch up to four nonmagical Arrows or Bolts and plant them in the ground in your space. Until the spell ends, the ammunition can't be physically uprooted, and whenever a creature other than you enters a space within 30 feet of the ammunition for the first time on a turn or ends its turn there, one piece of ammunition flies up to strike it. The creature must succeed on a Dexterity saving throw or take 2d4 Piercing damage. The piece of ammunition is then destroyed. The spell ends when none of the ammunition remains planted in the ground.
When you cast this spell, you can designate any creatures you choose, and the spell ignores them.
Using a Higher-Level Spell Slot. The amount of ammunition that can be affected increases by two for each spell slot level above 2.

Material Component:
* - (four or more arrows or bolts)

Spell Tags:
Damage
Control

Available For:
Ranger

Capture Method: http
Legacy Page: false
-->
