# Heat Metal
- **Level**: 2
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Artificer, Bard, Druid
- **Sub-Classes**: Unsupported Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: single
- **Valid Targets**: manufactured_metal_object
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
- **Material**: true
- **Material Description**: a piece of iron and a flame
- **Material Cost GP**: 0
- **Consumed**: false
- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true
- **Effect Type**: DAMAGE
- **Save Stat**: Constitution
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
- **Granted Action Actor**: caster
- **Granted Action Name**: repeat_heat_damage
- **Granted Action Type**: bonus_action
- **Granted Action Frequency**: each_turn
- **Granted Action Area Shape**: not_applicable
- **Granted Action Area Size**: not_applicable
- **Granted Action Area Size Unit**: not_applicable
- **Granted Action Effect Indices**: 1
- **Granted Action Prerequisites**: target_object_within_spell_range
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 2d8
- **Damage Type**: Fire
- **Description**: Choose a manufactured metal object, such as a metal weapon or a suit of Heavy or Medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 Fire damage when you cast the spell. Until the spell ends, you can take a Bonus Action on each of your later turns to deal this damage again if the object is within range. If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn't drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 2d8 | trigger immediate | Initial heating deals 2d8 Fire to the holder or wearer, if any.
- **Scaling Rule 1 Bonus Per Level**: +1d8
- **Scaling Rule 2 Type**: slot_level_bonus
- **Scaling Rule 2 Applies To**: damage | Fire damage | dice 2d8 | trigger on_granted_action | Bonus Action on later turns to repeat the damage if the object is within range.
- **Scaling Rule 2 Bonus Per Level**: +1d8
## Canonical D&D Beyond Snapshot
This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.
<!--
Name: Heat Metal
Level: 2nd
Casting Time: 1 Action
Range/Area: 60 ft.
Components: V, S, M *
Duration: Concentration 1 Minute
School: Transmutation
Attack/Save: CON Save
Damage/Effect: Fire
Rules Text:
Choose a manufactured metal object, such as a metal weapon or a suit of Heavy or Medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 Fire damage when you cast the spell. Until the spell ends, you can take a Bonus Action on each of your later turns to deal this damage again if the object is within range.
If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn't drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn.
Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.
Material Component:
* - (a piece of iron and a flame)
Spell Tags:
Damage
Debuff
Available For:
Bard
Druid
Artificer
Cleric - Forge Domain (XGtE)
Cleric - Festus Domain
Paladin - Oath of the Spelldrinker
Capture Method: http
Legacy Page: false
-->
