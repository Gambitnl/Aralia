# Summon Fiend
- **Level**: 6
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
- **Material Description**: a bloodstone wrapped in a vellum scroll inscribed with infernal sigils worth 600+ GP
- **Material Cost GP**: 600
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
- **Mode Choice Option 1 Label**: Demon
- **Mode Choice Option 1 Summary**: Summon a Demon Fiendish Spirit whose Bite deals Slashing damage and frenzies on a kill.
- **Mode Choice Option 1 Effect Indices**: 0
- **Mode Choice Option 1 Control Option Indices**: not_applicable
- **Mode Choice Option 1 Effect Types**: SUMMONING
- **Mode Choice Option 1 Duration**: 1 hour with concentration
- **Mode Choice Option 1 Notes**: Uses the Fiendish Spirit stat block and slot-level scaling.
- **Mode Choice Option 2 Label**: Devil
- **Mode Choice Option 2 Summary**: Summon a Devil Fiendish Spirit whose ranged attack deals Fire damage.
- **Mode Choice Option 2 Effect Indices**: 0
- **Mode Choice Option 2 Control Option Indices**: not_applicable
- **Mode Choice Option 2 Effect Types**: SUMMONING
- **Mode Choice Option 2 Duration**: 1 hour with concentration
- **Mode Choice Option 2 Notes**: Uses the Fiendish Spirit stat block and slot-level scaling.
- **Mode Choice Option 3 Label**: Yugoloth
- **Mode Choice Option 3 Summary**: Summon a Yugoloth Fiendish Spirit whose attack deals Poison damage and that has damage resistances.
- **Mode Choice Option 3 Effect Indices**: 0
- **Mode Choice Option 3 Control Option Indices**: not_applicable
- **Mode Choice Option 3 Effect Types**: SUMMONING
- **Mode Choice Option 3 Duration**: 1 hour with concentration
- **Mode Choice Option 3 Notes**: Uses the Fiendish Spirit stat block and slot-level scaling.
- **Scaling Rule 1 Type**: special_text
- **Scaling Rule 1 Applies To**: canonical higher-level prose
- **Scaling Rule 1 Notes**: Use the slot level as the spell's level in the Fiendish Spirit stat block: AC is 12 + spell level, HP is 50 + 15 for each spell level above 6, and the form attack adds the spell's level to its damage.

- **Description**: You call forth a Fiendish Spirit in a visible unoccupied space within 90 feet. Choose Demon, Devil, or Yugoloth; the spirit is an ally that acts immediately after you, obeys verbal commands, vanishes at 0 Hit Points or when the spell ends, and scales its defenses and attack with the slot level.
- **Higher Levels**: Use the spell slot's level for the spell's level in the stat block. The Fiendish Spirit's Hit Points and attack damage increase as the spell's level increases.

## Canonical D&D Beyond Snapshot

This section stores the local source-summary snapshot so the structured Aralia field block remains the validator-facing markdown surface.

<!--
Name: Summon Fiend
Level: 6th
Casting Time: 1 Action
Range/Area: 90 ft.
Components: V, S, M *
Duration: Concentration 1 Hour
School: Conjuration
Attack/Save: None
Damage/Effect: Summoning

Rules Text:
You call forth a fiendish spirit. It manifests in an unoccupied space that you can see within range and uses the Fiendish Spirit stat block. When you cast the spell, choose Demon, Devil, or Yugoloth. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your allies. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger.
Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block. The Fiendish Spirit's Hit Points and attack damage increase as the spell's level increases.

Material Component:
* - (a bloodstone wrapped in a vellum scroll inscribed with infernal sigils worth 600+ GP)

Spell Tags:
Summoning

Available For:
Warlock
Wizard

Capture Method: local-json-summary
Legacy Page: false
-->
