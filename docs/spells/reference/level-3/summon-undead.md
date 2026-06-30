# Summon Undead
- **Level**: 3
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 90
- **Targeting Type**: point
- **Targeting Range**: 90
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Valid Targets**: point
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
- **Material Description**: a gilded skull worth 300+ GP
- **Material Cost GP**: 300
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: hour
- **Concentration**: true

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
- **Conditional Ending Triggers**: created_entity_drops_to_0_hp
- **Conditional Ending Scope**: effect
- **Mode Choice Type**: choose_one
- **Mode Choice Timing**: on_cast
- **Mode Choice Option Count**: 3
- **Mode Choice Options Source**: summon.formOptions
- **Mode Choice Max Active Noninstantaneous**: not_applicable
- **Mode Choice Can Dismiss Active**: false
- **Mode Choice Option 1 Label**: Ghostly
- **Mode Choice Option 1 Summary**: Summon a Ghostly Undead Spirit with a 40-foot fly speed and a frighten rider on Deathly Touch.
- **Mode Choice Option 1 Effect Indices**: 0
- **Mode Choice Option 1 Control Option Indices**: not_applicable
- **Mode Choice Option 1 Effect Types**: SUMMONING
- **Mode Choice Option 1 Duration**: 1 hour with concentration
- **Mode Choice Option 1 Notes**: Uses the Undead Spirit stat block and slot-level scaling.
- **Mode Choice Option 2 Label**: Putrid
- **Mode Choice Option 2 Summary**: Summon a Putrid Undead Spirit whose Festering Aura can poison creatures that hit it or are hit by it.
- **Mode Choice Option 2 Effect Indices**: 0
- **Mode Choice Option 2 Control Option Indices**: not_applicable
- **Mode Choice Option 2 Effect Types**: SUMMONING
- **Mode Choice Option 2 Duration**: 1 hour with concentration
- **Mode Choice Option 2 Notes**: Uses the Undead Spirit stat block and slot-level scaling.
- **Mode Choice Option 3 Label**: Skeletal
- **Mode Choice Option 3 Summary**: Summon a Skeletal Undead Spirit that can use a ranged Withering Bolt attack at 150 feet.
- **Mode Choice Option 3 Effect Indices**: 0
- **Mode Choice Option 3 Control Option Indices**: not_applicable
- **Mode Choice Option 3 Effect Types**: SUMMONING
- **Mode Choice Option 3 Duration**: 1 hour with concentration
- **Mode Choice Option 3 Notes**: Uses the Undead Spirit stat block and slot-level scaling.
- **Scaling Rule 1 Type**: special_text
- **Scaling Rule 1 Applies To**: canonical higher-level prose
- **Scaling Rule 1 Notes**: Use the slot level as the spell's level in the Undead Spirit stat block: AC is 11 + spell level, HP is 30 + 10 for each spell level above 3, and the form attack adds the spell's level to its damage.

- **Description**: You summon an Undead Spirit in a visible unoccupied space within 90 feet. Choose Ghostly, Putrid, or Skeletal; the spirit is an ally that acts immediately after you, obeys verbal commands, vanishes at 0 Hit Points or when the spell ends, and scales its defenses and attack damage with the slot level.
- **Higher Levels**: Use the spell slot's level for the spell's level in the stat block. The Undead Spirit's Hit Points and attack damage increase as the spell's level increases.
## Canonical D&D Beyond Snapshot

This section stores the local source-summary snapshot so the structured Aralia field block remains the validator-facing markdown surface.

<!--
Name: Summon Undead
Level: 3rd
Casting Time: 1 Action
Range/Area: 90 ft.
Components: V, S, M *
Duration: Concentration 1 Hour
School: Conjuration
Attack/Save: None
Damage/Effect: Summoning

Rules Text:
Summon an Undead Spirit in a visible unoccupied space within range. Choose Ghostly, Putrid, or Skeletal. The spirit is an ally, acts right after you, obeys verbal commands, vanishes at 0 HP or when the spell ends, and its form changes the rider on Deathly Touch.
Using a Higher-Level Spell Slot. The spirit's AC, HP, and attack damage scale with the slot level.

Material Component:
* - (a gilded skull worth 300+ GP)

Spell Tags:
Summoning

Available For:
Warlock
Wizard

Capture Method: local-json-summary
Legacy Page: false
-->
