# Blindness/Deafness
- **Level**: 2
- **School**: Transmutation
- **Ritual**: false
- **Classes**: Bard, Cleric, Sorcerer, Wizard
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Targeting Type**: multi
- **Targeting Max**: 1
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
- **Somatic**: false
- **Material**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Type**: DEBUFF
- **Save Stat**: Constitution
- **Save Outcome**: negates_condition
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
- **Conditions Applied**: Blinded, Deafened

- **Description**: One creature that you can see within range must succeed on a Constitution saving throw, or it has the Blinded or Deafened condition (your choice) for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success.
- **Higher Levels**: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: targeting.maxTargets | status_condition | trigger immediate | On a failed save, target is either Blinded (default) or Deafened (player choice)
- **Scaling Rule 1 Bonus Per Level**: +1 target

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Blindness/Deafness
Level: 2nd
Casting Time: 1 Action
Range/Area: 120 ft.
Components: V
Duration: 1 Minute
School: Transmutation
Attack/Save: CON Save
Damage/Effect: Blinded (...)

Rules Text:
One creature that you can see within range must succeed on a Constitution saving throw, or it has the Blinded or Deafened condition (your choice) for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success.
Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2.

Spell Tags:
Debuff

Available For:
Bard
Cleric
Sorcerer
Wizard
Cleric - Death Domain (DMG)
Druid - Circle of Spores (TCoE)
Warlock - The Undead (VRGtR)
Warlock - The Undying (SCAG)
Cleric - Shadow Domain (BoET)

Capture Method: http
Legacy Page: false
-->
