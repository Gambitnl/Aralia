# Ice Knife
- **Level**: 1
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid, Sorcerer, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: multi
- **Area Shape**: sphere
- **Area Size**: 5
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
- **Material Description**: a drop of water or a piece of ice
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: instantaneous
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
- **Attack Roll**: ranged
- **Primary Damage Dice**: 1d10
- **Primary Damage Type**: Piercing
- **Secondary Save Stat**: Dexterity
- **Secondary Save Outcome**: none
- **Secondary Damage Dice**: 2d6
- **Secondary Damage Type**: Cold

- **Description**: You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Piercing damage. Hit or miss, the shard then explodes. The target and each creature within 5 feet of it must succeed on a Dexterity saving throw or take 2d6 Cold damage.
- **Higher Levels**: Using a Higher-Level Spell Slot. The Cold damage increases by 1d6 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Cold damage | dice 2d6 | trigger after_primary
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Ice Knife
Level: 1st
Casting Time: 1 Action
Range/Area: 60 ft. (5 ft. *)
Components: S, M *
Duration: Instantaneous
School: Conjuration
Attack/Save: DEX Save
Damage/Effect: Piercing (...)

Rules Text:
You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Piercing damage. Hit or miss, the shard then explodes. The target and each creature within 5 feet of it must succeed on a Dexterity saving throw or take 2d6 Cold damage.
Using a Higher-Level Spell Slot. The Cold damage increases by 1d6 for each spell slot level above 1.

Material Component:
* - (a drop of water or a piece of ice)

Spell Tags:
Damage

Available For:
Druid
Sorcerer
Wizard

Capture Method: http
Legacy Page: false
-->
