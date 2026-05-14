# Tasha's Caustic Brew

- **Level**: 1
- **School**: Evocation
- **Ritual**: false
- **Classes**: Artificer, Sorcerer, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: area
- **Targeting Range**: 30
- **Targeting Range Unit**: feet
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
- **Area Shape**: Line
- **Area Size**: 30
- **Area Size Unit**: feet

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a bit of rotten food

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE, STATUS_CONDITION
- **Save Stat**: Dexterity
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
- **Damage Dice**: 2d4
- **Damage Type**: Acid
- **Conditions Applied**: Covered in Acid

- **Description**: A stream of acid emanates from you in a line 30 feet long and 5 feet wide in a direction you choose. Each creature in the line must succeed on a Dexterity saving throw or be covered in acid for the spell's duration or until a creature uses its action to scrape or wash the acid off itself or another creature. A creature covered in the acid takes 2d4 acid damage at start of each of its turns.
- **Higher Levels**: When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 2d4 for each slot level above 1st.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Acid damage | dice 2d4 | trigger turn_start
- **Scaling Rule 1 Bonus Per Level**: +2d4

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Tasha's Caustic Brew
Level: 1st
Casting Time: 1 Action
Range/Area: Self (30 ft.)
Components: V, S, M *
Duration: Concentration 1 Minute
School: Evocation
Attack/Save: DEX Save
Damage/Effect: Acid

Rules Text:
A stream of acid emanates from you in a line 30 feet long and 5 feet wide in a direction you choose. Each creature in the line must succeed on a Dexterity saving throw or be covered in acid for the spell's duration or until a creature uses its action to scrape or wash the acid off itself or another creature. A creature covered in the acid takes 2d4 acid damage at start of each of its turns.
At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 2d4 for each slot level above 1st.

Material Component:
* - (a bit of rotten food)

Available For:
Sorcerer
Wizard
Artificer

Capture Method: http
Legacy Page: false
-->
