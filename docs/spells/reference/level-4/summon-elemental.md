# Summon Elemental
- **Level**: 4
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid, Ranger, Wizard
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
- **Material Description**: air, a pebble, ash, and water inside a gilded cube worth 400+ GP
- **Material Cost GP**: 400
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
- **Mode Choice Option Count**: 4
- **Mode Choice Options Source**: summon.formOptions
- **Mode Choice Max Active Noninstantaneous**: not_applicable
- **Mode Choice Can Dismiss Active**: false
- **Mode Choice Option 1 Label**: Air
- **Mode Choice Option 1 Summary**: Summon an Air Elemental Spirit with a flying speed and a Bludgeoning Slam.
- **Mode Choice Option 1 Effect Indices**: 0
- **Mode Choice Option 1 Control Option Indices**: not_applicable
- **Mode Choice Option 1 Effect Types**: SUMMONING
- **Mode Choice Option 1 Duration**: 1 hour with concentration
- **Mode Choice Option 1 Notes**: Uses the Elemental Spirit stat block and slot-level scaling.
- **Mode Choice Option 2 Label**: Earth
- **Mode Choice Option 2 Summary**: Summon an Earth Elemental Spirit with a burrow speed and a Bludgeoning Slam.
- **Mode Choice Option 2 Effect Indices**: 0
- **Mode Choice Option 2 Control Option Indices**: not_applicable
- **Mode Choice Option 2 Effect Types**: SUMMONING
- **Mode Choice Option 2 Duration**: 1 hour with concentration
- **Mode Choice Option 2 Notes**: Uses the Elemental Spirit stat block and slot-level scaling.
- **Mode Choice Option 3 Label**: Fire
- **Mode Choice Option 3 Summary**: Summon a Fire Elemental Spirit whose Slam deals Fire damage.
- **Mode Choice Option 3 Effect Indices**: 0
- **Mode Choice Option 3 Control Option Indices**: not_applicable
- **Mode Choice Option 3 Effect Types**: SUMMONING
- **Mode Choice Option 3 Duration**: 1 hour with concentration
- **Mode Choice Option 3 Notes**: Uses the Elemental Spirit stat block and slot-level scaling.
- **Mode Choice Option 4 Label**: Water
- **Mode Choice Option 4 Summary**: Summon a Water Elemental Spirit with a swim speed and a Bludgeoning Slam.
- **Mode Choice Option 4 Effect Indices**: 0
- **Mode Choice Option 4 Control Option Indices**: not_applicable
- **Mode Choice Option 4 Effect Types**: SUMMONING
- **Mode Choice Option 4 Duration**: 1 hour with concentration
- **Mode Choice Option 4 Notes**: Uses the Elemental Spirit stat block and slot-level scaling.
- **Scaling Rule 1 Type**: special_text
- **Scaling Rule 1 Applies To**: canonical higher-level prose
- **Scaling Rule 1 Notes**: Use the slot level as the spell's level in the Elemental Spirit stat block: AC is 11 + spell level, HP is 50 + 10 for each spell level above 4, and Slam damage is 1d10 + 4 + spell level of the element's damage type.

- **Description**: You call forth an elemental spirit. It manifests in an unoccupied space that you can see within range and uses the Elemental Spirit stat block. When you cast the spell, choose an element: Air, Earth, Fire, or Water. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your allies. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger.
- **Higher Levels**: Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block. The Elemental Spirit's Hit Points and Slam damage increase as the spell's level increases.
## Canonical D&D Beyond Snapshot

This section stores the local source-summary snapshot so the structured Aralia field block remains the validator-facing markdown surface.

<!--
Name: Summon Elemental
Level: 4th
Casting Time: 1 Action
Range/Area: 90 ft.
Components: V, S, M *
Duration: Concentration 1 Hour
School: Conjuration
Attack/Save: None
Damage/Effect: Summoning

Rules Text:
You call forth an elemental spirit. It manifests in an unoccupied space that you can see within range and uses the Elemental Spirit stat block. When you cast the spell, choose an element: Air, Earth, Fire, or Water. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your allies. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger.
Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block. The Elemental Spirit's Hit Points and Slam damage increase as the spell's level increases.

Material Component:
* - (air, a pebble, ash, and water inside a gilded cube worth 400+ GP)

Spell Tags:
Summoning

Available For:
Druid
Ranger
Wizard

Capture Method: local-json-summary
Legacy Page: false
-->
