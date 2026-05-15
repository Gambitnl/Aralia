# Witch Bolt
- **Level**: 1
- **School**: Evocation
- **Ritual**: false
- **Classes**: Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
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
- **Material Description**: a twig struck by lightning
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: target_outside_spell_range, target_has_total_cover_from_caster
- **Conditional Ending Scope**: spell, spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Attack Roll**: ranged
- **Damage Dice**: 2d12
- **Damage Type**: Lightning

- **Description**: A beam of crackling energy lances toward a creature within range, forming a sustained arc of lightning between you and the target. Make a ranged spell attack against it. On a hit, the target takes 2d12 Lightning damage. On each of your subsequent turns, you can take a Bonus Action to deal 1d12 Lightning damage to the target automatically, even if the first attack missed. The spell ends if the target is ever outside the spell's range or if it has Total Cover from you.
- **Higher Levels**: Using a Higher-Level Spell Slot. The initial damage increases by 1d12 for each spell slot level above 1.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Lightning damage | dice 2d12 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d12

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Witch Bolt
Level: 1st
Casting Time: 1 Action
Range/Area: 60 ft.
Components: V, S, M *
Duration: Concentration 1 Minute
School: Evocation
Attack/Save: Ranged
Damage/Effect: Lightning (...)

Rules Text:
A beam of crackling energy lances toward a creature within range, forming a sustained arc of lightning between you and the target. Make a ranged spell attack against it. On a hit, the target takes 2d12 Lightning damage.
On each of your subsequent turns, you can take a Bonus Action to deal 1d12 Lightning damage to the target automatically, even if the first attack missed.
The spell ends if the target is ever outside the spell's range or if it has Total Cover from you.
Using a Higher-Level Spell Slot. The initial damage increases by 1d12 for each spell slot level above 1.

Material Component:
* - (a twig struck by lightning)

Spell Tags:
Damage

Available For:
Sorcerer
Warlock
Wizard

Referenced Rules:
Total Cover -> /rules-glossary/33-tooltip

Capture Method: http
Legacy Page: false
-->
