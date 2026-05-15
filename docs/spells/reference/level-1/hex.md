# Hex
- **Level**: 1
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Warlock
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action

- **Range Type**: ranged
- **Range Distance**: 90
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
- **Line of Sight**: true

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: the petrified eye of a newt
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: hour
- **Concentration**: true

- **Effect Type**: DAMAGE, UTILITY
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
- **Damage Dice**: 1d6
- **Damage Type**: Necrotic
- **Utility Options**: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma
- **Utility Option 1 Name**: Strength
- **Utility Option 1 Effect**: disadvantage
- **Utility Option 1 Details**: Target has Disadvantage on ability checks made with Strength.
- **Utility Option 2 Name**: Dexterity
- **Utility Option 2 Effect**: disadvantage
- **Utility Option 2 Details**: Target has Disadvantage on ability checks made with Dexterity.
- **Utility Option 3 Name**: Constitution
- **Utility Option 3 Effect**: disadvantage
- **Utility Option 3 Details**: Target has Disadvantage on ability checks made with Constitution.
- **Utility Option 4 Name**: Intelligence
- **Utility Option 4 Effect**: disadvantage
- **Utility Option 4 Details**: Target has Disadvantage on ability checks made with Intelligence.
- **Utility Option 5 Name**: Wisdom
- **Utility Option 5 Effect**: disadvantage
- **Utility Option 5 Details**: Target has Disadvantage on ability checks made with Wisdom.
- **Utility Option 6 Name**: Charisma
- **Utility Option 6 Effect**: disadvantage
- **Utility Option 6 Details**: Target has Disadvantage on ability checks made with Charisma.

- **Description**: You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 Necrotic damage to the target whenever you hit it with an attack roll. Also, choose one ability when you cast the spell. The target has Disadvantage on ability checks made with the chosen ability. If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action on a later turn to curse a new creature.
- **Higher Levels**: Using a Higher-Level Spell Slot. Your Concentration can last longer with a spell slot of level 2 (up to 4 hours), 3-4 (up to 8 hours), or 5+ (24 hours).
- **Scaling Rule 1 Type**: slot_level_table
- **Scaling Rule 1 Applies To**: duration.concentration_maximum
- **Scaling Rule 1 Base**: 1 hour at spell slot level 1
- **Scaling Rule 1 Levels**: 2=up to 4 hours; 3-4=up to 8 hours; 5+=up to 24 hours
- **Scaling Rule 1 Notes**: Your Concentration can last longer with a spell slot of level 2 (up to 4 hours), 3-4 (up to 8 hours), or 5+ (24 hours).

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Hex
Level: 1st
Casting Time: 1 Bonus Action
Range/Area: 90 ft.
Components: V, S, M *
Duration: Concentration 1 Hour
School: Enchantment
Attack/Save: None
Damage/Effect: Necrotic

Rules Text:
You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 Necrotic damage to the target whenever you hit it with an attack roll. Also, choose one ability when you cast the spell. The target has Disadvantage on ability checks made with the chosen ability.
If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action on a later turn to curse a new creature.
Using a Higher-Level Spell Slot. Your Concentration can last longer with a spell slot of level 2 (up to 4 hours), 3-4 (up to 8 hours), or 5+ (24 hours).

Material Component:
* - (the petrified eye of a newt)

Spell Tags:
Damage
Debuff

Available For:
Warlock

Referenced Rules:
curse -> /rules-glossary/39-tooltip
Concentration -> /rules-glossary/31-tooltip

Capture Method: http
Legacy Page: false
-->
