# Word of Radiance

- **Level**: 0
- **School**: Evocation
- **Ritual**: false
- **Classes**: Cleric
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: area
- **Targeting Range**: 0
- **Targeting Max**: 1
- **Area Target Selection Mode**: caster_choice
- **Area Target Selection Scope**: creatures_in_area
- **Area Target Selection Count**: all_chosen
- **Area Target Selection Excludes Unchosen**: true
- **Area Target Selection Requires Line Of Sight**: true
- **Area Target Selection Notes**: The caster chooses which visible creatures in the Emanation make the Constitution save; unchosen creatures in the area are not affected.
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
- **Area Shape**: Sphere
- **Area Size**: 5
- **Area Size Unit**: feet

- **Verbal**: true
- **Somatic**: false
- **Material**: true
- **Material Description**: a sunburst token

- **Duration Type**: instantaneous
- **Duration Value**: 0
- **Duration Unit**: round
- **Concentration**: false

- **Effect Type**: DAMAGE
- **Save Stat**: Constitution
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
- **Damage Dice**: 1d6
- **Damage Type**: Radiant

- **Description**: Burning radiance erupts from you in a 5-foot Emanation. Each creature of your choice that you can see in it must succeed on a Constitution saving throw or take 1d6 Radiant damage.
- **Higher Levels**: The spell's damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), and 17th level (4d6).
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: damage | Radiant damage | dice 1d6 | trigger immediate
- **Scaling Rule 1 Notes**: bonusPerLevel=+1d6

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Word of Radiance
Level: Cantrip
Casting Time: 1 Action
Range/Area: Self (5 ft.)
Components: V, M *
Duration: Instantaneous
School: Evocation
Attack/Save: CON Save
Damage/Effect: Radiant

Rules Text:
Burning radiance erupts from you in a 5-foot Emanation . Each creature of your choice that you can see in it must succeed on a Constitution saving throw or take 1d6 Radiant damage.
Cantrip Upgrade. The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).

Material Component:
* - (a sunburst token)

Spell Tags:
Damage

Available For:
Cleric

Referenced Rules:
Emanation -> /rules-glossary/54-tooltip

Capture Method: http
Legacy Page: false
-->
