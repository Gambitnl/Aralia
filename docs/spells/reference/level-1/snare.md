# Snare

- **Level**: 1
- **School**: Abjuration
- **Ritual**: false
- **Classes**: Druid, Ranger, Wizard, Artificer
- **Sub-Classes**: No Subclass Entries
- **Casting Time Value**: 1
- **Casting Time Unit**: minute
- **Combat Cost**: action
- **Exploration Time Value**: 1
- **Exploration Time Unit**: minute
- **Range Type**: touch
- **Range Distance**: 0
- **Targeting Type**: area
- **Area Shape**: Circle
- **Area Size**: 5
- **Area Size Unit**: feet
- **Area Size Type**: radius
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
- **Material Description**: 25 feet of rope, which the spell consumes
- **Consumed**: true
- **Duration Type**: timed
- **Duration Value**: 8
- **Duration Unit**: hour
- **Concentration**: false
- **Effect Type**: STATUS_CONDITION, UTILITY
- **Conditions Applied**: Restrained
- **Save Stat**: Dexterity
- **Save Outcome**: negates_condition
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Repeat Save Timing**: turn_end
- **Repeat Save Additional Timings**: not_applicable
- **Repeat Save Type**: Dexterity
- **Repeat Save Success Ends**: true
- **Repeat Save Progression**: not_applicable
- **Escape Check Ability**: Intelligence
- **Escape Check Skill**: Arcana
- **Escape Check DC**: spell_save_dc
- **Escape Check Action Cost**: action
- **Escape Check Eligible Actors**: affected_creature, creature_that_can_reach_affected_creature
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: no_creature_restrained_by_spell_after_trigger
- **Conditional Ending Scope**: spell
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Triggered Applications**: on_enter_area
- **Utility Type**: control
- **Description**: As you cast this spell, you use the rope to create a circle with a 5-foot radius on the ground or the floor. When you finish casting, the rope disappears and the circle becomes a magic trap. This trap is nearly invisible, requiring a successful Intelligence (Investigation) check against your spell save DC to be discerned. The trap triggers when a Small, Medium, or Large creature moves onto the ground or the floor in the spell's radius. That creature must succeed on a Dexterity saving throw or be magically hoisted into the air, leaving it hanging upside down 3 feet above the ground or the floor. The creature is restrained there until the spell ends. A restrained creature can make a Dexterity saving throw at the end of each of its turns, ending the effect on itself on a success. Alternatively, the creature or someone else who can reach it can use an action to make an Intelligence (Arcana) check against your spell save DC. On a success, the restrained effect ends. After the trap is triggered, the spell ends when no creature is restrained by it.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Snare
Level: 1st
Casting Time: 1 Minute
Range/Area: Touch
Components: S, M *
Duration: 8 Hours
School: Abjuration
Attack/Save: DEX Save
Damage/Effect: Restrained

Rules Text:
As you cast this spell, you use the rope to create a circle with a 5-foot radius on the ground or the floor. When you finish casting, the rope disappears and the circle becomes a magic trap.
This trap is nearly invisible, requiring a successful Intelligence (Investigation) check against your spell save DC to be discerned.
The trap triggers when a Small, Medium, or Large creature moves onto the ground or the floor in the spell's radius. That creature must succeed on a Dexterity saving throw or be magically hoisted into the air, leaving it hanging upside down 3 feet above the ground or the floor. The creature is restrained there until the spell ends.
A restrained creature can make a Dexterity saving throw at the end of each of its turns, ending the effect on itself on a success. Alternatively, the creature or someone else who can reach it can use an action to make an Intelligence (Arcana) check against your spell save DC. On a success, the restrained effect ends.
After the trap is triggered, the spell ends when no creature is restrained by it.

Material Component:
* - (25 feet of rope, which the spell consumes)

Spell Tags:
Control

Available For:
Druid
Ranger
Wizard
Artificer

Capture Method: http
Legacy Page: false
-->
