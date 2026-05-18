# Fly
- **Level**: 3
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Artificer, Sorcerer, Warlock, Wizard
- **Sub-Classes**: Unsupported Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action
- **Range Type**: touch
- **Targeting Type**: multi
- **Targeting Max**: 1
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
- **Material Description**: a feather
- **Material Cost GP**: 0
- **Consumed**: false
- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true
- **Effect Type**: BUFF
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
- **End Cleanup Trigger**: spell_ends
- **End Cleanup Removes**: spell_granted_flying_speed
- **End Cleanup Source**: this_spell
- **End Cleanup Scope**: target
- **End Cleanup Amount**: all_remaining
- **End Cleanup Consequence**: fall_if_aloft
- **End Cleanup Prevented By**: can_prevent_fall
- **Description**: You touch a willing creature. For the duration, the target gains a Fly Speed of 60 feet and can hover. When the spell ends, the target falls if it is still aloft unless it can stop the fall.
- **Higher Levels**: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 3.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: targeting.maxTargets
- **Scaling Rule 1 Bonus Per Level**: +1 target
- **Scaling Rule 1 Notes**: You can target one additional creature for each spell slot level above 3.
## Canonical D&D Beyond Snapshot
This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.
<!--
Name: Fly
Level: 3rd
Casting Time: 1 Action
Range/Area: Touch
Components: V, S, M *
Duration: Concentration 10 Minutes
School: Transmutation
Attack/Save: None
Damage/Effect: Movement
Rules Text:
You touch a willing creature. For the duration, the target gains a Fly Speed of 60 feet and can hover. When the spell ends, the target falls if it is still aloft unless it can stop the fall.
Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 3.
Material Component:
* - (a feather)
Spell Tags:
Movement
Available For:
Sorcerer
Warlock
Wizard
Artificer
Druid - Circle of the Hive (HGtMH1)
Sorcerer - Draconic Sorcery
Warlock - Horned King Patron
Capture Method: http
Legacy Page: false
-->
