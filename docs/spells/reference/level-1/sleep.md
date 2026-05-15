# Sleep
- **Level**: 1
- **School**: Enchantment
- **Ritual**: false
- **Classes**: Bard, Sorcerer, Wizard
- **Sub-Classes**: Warlock - Archfey Patron

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: area
- **Area Shape**: sphere
- **Area Size**: 5
- **Area Target Selection Mode**: caster_choice
- **Area Target Selection Scope**: creatures_in_area
- **Area Target Selection Count**: all_chosen
- **Area Target Selection Excludes Unchosen**: true
- **Area Target Selection Requires Line Of Sight**: false
- **Area Target Selection Notes**: The caster chooses which creatures in the 5-foot-radius Sphere are affected; unchosen creatures in the area are not affected.
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
- **Material Description**: a pinch of sand or rose petals
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: STATUS_CONDITION
- **Save Stat**: Wisdom
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
- **Condition Break Triggers**: target_takes_damage, adjacent_creature_action_shakes_awake
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Conditions Applied**: Incapacitated, Unconscious

- **Description**: Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisdom saving throw or have the Incapacitated condition until the end of its next turn, at which point it must repeat the save. If the target fails the second save, the target has the Unconscious condition for the duration. The spell ends on a target if it takes damage or someone within 5 feet of it takes an action to shake it out of the spell's effect. Creatures that don't sleep, such as elves, or that have Immunity to the Exhaustion condition automatically succeed on saves against this spell.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Sleep
Level: 1st
Casting Time: 1 Action
Range/Area: 60 ft. (5 ft. Sphere)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Enchantment
Attack/Save: WIS Save
Damage/Effect: Incapacitated (...)

Rules Text:
Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisdom saving throw or have the Incapacitated condition until the end of its next turn, at which point it must repeat the save. If the target fails the second save, the target has the Unconscious condition for the duration. The spell ends on a target if it takes damage or someone within 5 feet of it takes an action to shake it out of the spell's effect.
Creatures that don't sleep, such as elves, or that have Immunity to the Exhaustion condition automatically succeed on saves against this spell.

Material Component:
* - (a pinch of sand or rose petals)

Spell Tags:
Control

Available For:
Bard
Sorcerer
Wizard
Cleric - Twilight Domain (TCoE)
Paladin - Oath of Redemption (XGtE)
Warlock - Archfey Patron
Cleric - Night Domain (HCS)
Cleric - Blood Domain (TCSR)

Referenced Rules:
Sphere -> /rules-glossary/109-tooltip

Capture Method: http
Legacy Page: false
-->
