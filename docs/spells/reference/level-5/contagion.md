# Contagion
- **Level**: 5
- **School**: Necromancy
- **Ritual**: false
- **Classes**: Cleric, Druid
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: touch
- **Range Distance**: 0
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
- **Material**: false
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 7
- **Duration Unit**: day
- **Concentration**: false

- **Effect Type**: DAMAGE, STATUS_CONDITION, UTILITY
- **Save Stat**: Constitution
- **Save Outcome**: negates_condition
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Repeat Save Timing**: turn_end
- **Repeat Save Additional Timings**: not_applicable
- **Repeat Save Type**: Constitution
- **Repeat Save Success Ends**: false
- **Repeat Save Progression**: successThreshold 3; failureThreshold 3; consecutiveRequired false; successOutcome spell_ends_on_target; failureOutcome poisoned_duration_lasts_7_days
- **Recurring Mechanics**: not_applicable
- **Recurring Mechanic Timing**: not_applicable
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
- **Damage Dice**: 11d8
- **Damage Type**: Necrotic
- **Conditions Applied**: Poisoned

- **Description**: Your touch inflicts a magical contagion. The target must succeed on a Constitution saving throw or take 11d8 Necrotic damage and have the Poisoned condition. Also, choose one ability when you cast the spell. While Poisoned, the target has Disadvantage on saving throws made with the chosen ability. The target must repeat the saving throw at the end of each of its turns until it gets three successes or failures. If the target succeeds on three of these saves, the spell ends on the target. If the target fails three of the saves, the spell lasts for 7 days on it. Whenever the Poisoned target receives an effect that would end the Poisoned condition, the target must succeed on a Constitution saving throw, or the Poisoned condition doesn't end on it.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Contagion
Level: 5th
Casting Time: 1 Action
Range/Area: Touch
Components: V, S
Duration: 7 Days
School: Necromancy
Attack/Save: CON Save
Damage/Effect: Necrotic

Rules Text:
Your touch inflicts a magical contagion. The target must succeed on a Constitution saving throw or take 11d8 Necrotic damage and have the Poisoned condition. Also, choose one ability when you cast the spell. While Poisoned, the target has Disadvantage on saving throws made with the chosen ability.
The target must repeat the saving throw at the end of each of its turns until it gets three successes or failures. If the target succeeds on three of these saves, the spell ends on the target. If the target fails three of the saves, the spell lasts for 7 days on it.
Whenever the Poisoned target receives an effect that would end the Poisoned condition, the target must succeed on a Constitution saving throw, or the Poisoned condition doesn't end on it.

Spell Tags:
Debuff

Available For:
Cleric
Druid
Druid - Circle of Spores (TCoE)
Paladin - Oathbreaker (DMG)
Warlock - The Undying (SCAG)
Warlock - The Predator (HWT)
Cleric - Festus Domain
Warlock - Mother of Sorrows (BoET)

Capture Method: http
Legacy Page: false
-->
