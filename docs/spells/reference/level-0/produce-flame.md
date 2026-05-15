# Produce Flame

- **Level**: 0
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: bonus_action
- **Combat Cost**: bonus_action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: self
- **Targeting Range**: 5
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Valid Targets**: self
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

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Type**: UTILITY, DAMAGE
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: end_on_recast
- **Conditional Ending Scope**: spell
- **Utility Type**: light
- **Light Bright Radius**: 20
- **Light Dim Radius**: 20
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: false
- **Light Ignites Objects**: false
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable

- **Description**: A flickering flame appears in your hand and remains there for the duration. While there, the flame emits no heat and ignites nothing, and it sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. The spell ends if you cast it again. Until the spell ends, you can take a Magic action to hurl fire at a creature or an object within 60 feet of you. Make a ranged spell attack. On a hit, the target takes 1d8 Fire damage.
- **Higher Levels**: This spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: damage | Fire damage | dice 1d8 | trigger on_caster_action
- **Scaling Rule 1 Notes**: 1d8 at level 1, 2d8 at level 5, 3d8 at level 11, 4d8 at level 17; bonusPerLevel=+1d8

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Produce Flame
Level: Cantrip
Casting Time: 1 Bonus Action
Range/Area: Self
Components: V, S
Duration: 10 Minutes
School: Conjuration
Attack/Save: Ranged
Damage/Effect: Fire

Rules Text:
A flickering flame appears in your hand and remains there for the duration. While there, the flame emits no heat and ignites nothing, and it sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. The spell ends if you cast it again.
Until the spell ends, you can take a Magic action to hurl fire at a creature or an object within 60 feet of you. Make a ranged spell attack. On a hit, the target takes 1d8 Fire damage.
Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).

Spell Tags:
Creation
Damage

Available For:
Druid

Referenced Rules:
Bright Light -> /rules-glossary/21-tooltip
Dim Light -> /rules-glossary/52-tooltip

Capture Method: http
Legacy Page: false
-->
