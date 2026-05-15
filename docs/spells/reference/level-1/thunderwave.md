# Thunderwave
- **Level**: 1
- **School**: Evocation
- **Ritual**: false
- **Classes**: Bard, Druid, Sorcerer, Wizard
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: self
- **Targeting Type**: area
- **Area Shape**: cube
- **Area Size**: 15
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
- **Material**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE, UTILITY
- **Save Stat**: Constitution
- **Save Outcome**: half
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: 300
- **Sound Audible Radius Unit**: feet
- **Sound Source**: spell_area
- **Sound Trigger**: on_cast
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Damage Dice**: 2d8
- **Damage Type**: Thunder

- **Description**: You unleash a wave of thunderous energy. Each creature in a 15-foot Cube originating from you makes a Constitution saving throw. On a failed save, a creature takes 2d8 Thunder damage and is pushed 10 feet away from you. On a successful save, a creature takes half as much damage only. In addition, unsecured objects that are entirely within the Cube are pushed 10 feet away from you, and a thunderous boom is audible within 300 feet.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Thunder damage | dice 2d8 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Thunderwave
Level: 1st
Casting Time: 1 Action
Range/Area: Self (15 ft. Cube)
Components: V, S
Duration: Instantaneous
School: Evocation
Attack/Save: CON Save
Damage/Effect: Thunder

Rules Text:
You unleash a wave of thunderous energy. Each creature in a 15-foot Cube originating from you makes a Constitution saving throw. On a failed save, a creature takes 2d8 Thunder damage and is pushed 10 feet away from you. On a successful save, a creature takes half as much damage only.
In addition, unsecured objects that are entirely within the Cube are pushed 10 feet away from you, and a thunderous boom is audible within 300 feet.
Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1.

Spell Tags:
Damage
Control

Available For:
Bard
Druid
Sorcerer
Wizard
Cleric - Tempest Domain (PHB)
Druid - Circle of the Sea
Warlock - The Fathomless (TCoE)
Warlock - The Genie (TCoE)

Referenced Rules:
Cube -> /rules-glossary/38-tooltip

Capture Method: http
Legacy Page: false
-->

