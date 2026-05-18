# Dragon's Breath
- **Level**: 2
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Artificer, Sorcerer, Wizard
- **Sub-Classes**: Folded into Classes

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action

- **Range Type**: touch
- **Targeting Type**: single
- **Area Shape**: Cone
- **Area Size**: 15
- **Area Size Unit**: feet
- **Valid Targets**: willing_creature
- **Target Willingness**: required
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
- **Material Description**: a hot pepper
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: BUFF
- **Utility Type**: other
- **Save Stat**: Dexterity
- **Save Outcome**: half
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
- **Damage Dice**: 3d6
- **Damage Type**: Acid/Cold/Fire/Lightning/Poison
- **Granted Action Actor**: target
- **Granted Action Name**: exhale_breath_cone
- **Granted Action Type**: magic_action
- **Granted Action Frequency**: each_turn
- **Granted Action Area Shape**: Cone
- **Granted Action Area Size**: 15
- **Granted Action Area Size Unit**: feet
- **Granted Action Effect Indices**: 1

- **Description**: You touch one willing creature, and choose Acid, Cold, Fire, Lightning, or Poison. Until the spell ends, the target can take a Magic action to exhale a 15-foot Cone . Each creature in that area makes a Dexterity saving throw, taking 3d6 damage of the chosen type on a failed save or half as much damage on a successful one.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Acid/Cold/Fire/Lightning/Poison damage | dice 3d6 | trigger on_caster_action | Represents the breath weapon damage when the target uses the granted action.
- **Scaling Rule 1 Bonus Per Level**: +1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Dragon's Breath
Level: 2nd
Casting Time: 1 Bonus Action
Range/Area: Touch (15 ft.)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Transmutation
Attack/Save: DEX Save
Damage/Effect: Acid (...)

Rules Text:
You touch one willing creature, and choose Acid, Cold, Fire, Lightning, or Poison. Until the spell ends, the target can take a Magic action to exhale a 15-foot Cone . Each creature in that area makes a Dexterity saving throw, taking 3d6 damage of the chosen type on a failed save or half as much damage on a successful one.
Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.

Material Component:
* - (a hot pepper)

Spell Tags:
Damage
Buff

Available For:
Sorcerer
Wizard
Artificer
Sorcerer - Draconic Sorcery

Referenced Rules:
Cone -> /rules-glossary/17-tooltip

Capture Method: http
Legacy Page: false
-->
