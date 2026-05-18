# Animate Dead
- **Level**: 3
- **School**: Necromancy
- **Ritual**: false
- **Classes**: Cleric, Wizard
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: minute
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 10
- **Targeting Type**: single
- **Target Instance Type**: controlled_undead
- **Target Instance Base Count**: 4
- **Target Instance Scaling Rule**: slot_level_plus_two_per_level
- **Target Instance Assignment**: unique_targets
- **Target Instance Resolution**: persistent
- **Target Instance Notes**: Reassert-control mode can affect up to four existing undead animated with this spell, plus two more undead per slot level above 3; the separate animate-versus-reassert mode, source corpse/bones, and command/control details remain tracked by other open Animate Dead buckets.
- **Valid Targets**: corpse
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
- **Material Description**: a drop of blood, a piece of flesh, and a pinch of bone dust
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: SUMMON
- **Utility Type**: other
- **Save Stat**: not_applicable
- **Save Outcome**: not_applicable
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
- **Description**: Choose a pile of bones or a corpse of a Medium or Small Humanoid within range. The target becomes an Undead creature: a Skeleton if you chose bones or a Zombie if you chose a corpse. On each of your turns, you can take a Bonus Action to mentally command any creature you made with this spell if the creature is within 60 feet of you (if you control multiple creatures, you can command any of them at the same time, issuing the same command to each one). You decide what action the creature will take and where it will move on its next turn, or you can issue a general command, such as to guard a chamber or corridor. If you issue no commands, the creature takes the Dodge action and moves only to avoid harm. Once given an order, the creature continues to follow it until its task is complete. The creature is under your control for 24 hours, after which it stops obeying any command you've given it. To maintain control of the creature for another 24 hours, you must cast this spell on the creature again before the current 24-hour period ends. This use of the spell reasserts your control over up to four creatures you have animated with this spell rather than animating a new creature.
- **Higher Levels**: Using a Higher-Level Spell Slot. You animate or reassert control over two additional Undead creatures for each spell slot level above 3. Each of the creatures must come from a different corpse or pile of bones.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: targeting.instanceAllocation.baseCount
- **Scaling Rule 1 Bonus Per Level**: +2 undead
- **Scaling Rule 1 Notes**: You animate or reassert control over two additional Undead creatures for each spell slot level above 3. Each of the creatures must come from a different corpse or pile of bones.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Animate Dead
Level: 3rd
Casting Time: 1 Minute
Range/Area: 10 ft.
Components: V, S, M *
Duration: Instantaneous
School: Necromancy
Attack/Save: None
Damage/Effect: Creation

Rules Text:
Choose a pile of bones or a corpse of a Medium or Small Humanoid within range. The target becomes an Undead creature: a Skeleton if you chose bones or a Zombie if you chose a corpse.
On each of your turns, you can take a Bonus Action to mentally command any creature you made with this spell if the creature is within 60 feet of you (if you control multiple creatures, you can command any of them at the same time, issuing the same command to each one). You decide what action the creature will take and where it will move on its next turn, or you can issue a general command, such as to guard a chamber or corridor. If you issue no commands, the creature takes the Dodge action and moves only to avoid harm. Once given an order, the creature continues to follow it until its task is complete.
The creature is under your control for 24 hours, after which it stops obeying any command you've given it. To maintain control of the creature for another 24 hours, you must cast this spell on the creature again before the current 24-hour period ends. This use of the spell reasserts your control over up to four creatures you have animated with this spell rather than animating a new creature.
Using a Higher-Level Spell Slot. You animate or reassert control over two additional Undead creatures for each spell slot level above 3. Each of the creatures must come from a different corpse or pile of bones.

Material Component:
* - (a drop of blood, a piece of flesh, and a pinch of bone dust)

Spell Tags:
Creation

Available For:
Cleric
Wizard
Cleric - Death Domain (DMG)
Druid - Circle of Spores (TCoE)
Paladin - Oathbreaker (DMG)

Capture Method: http
Legacy Page: false
-->
