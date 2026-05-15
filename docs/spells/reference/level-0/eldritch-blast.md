# Eldritch Blast

- **Level**: 0
- **School**: Evocation
- **Ritual**: false
- **Classes**: Warlock
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Range Distance Unit**: feet
- **Targeting Type**: multi
- **Targeting Range**: 120
- **Targeting Range Unit**: feet
- **Targeting Max**: not_applicable
- **Target Instance Type**: beam
- **Target Instance Base Count**: 1
- **Target Instance Scaling Rule**: character_level_tiers
- **Target Instance Assignment**: same_or_different_targets
- **Target Instance Resolution**: sequential
- **Target Instance Notes**: The caster makes a separate attack roll for each beam; higher-level beams can be directed at the same target or at different targets.
- **Valid Targets**: creatures, objects
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

- **Duration Type**: instantaneous
- **Duration Value**: 0
- **Duration Unit**: round
- **Concentration**: false

- **Effect Type**: DAMAGE
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
- **Attack Roll**: ranged
- **Damage Dice**: 1d10
- **Damage Type**: Force

- **Description**: You hurl a beam of crackling energy. Make a ranged spell attack against one creature or object in range. On a hit, the target takes 1d10 Force damage.
- **Higher Levels**: The spell creates two beams at level 5, three beams at level 11, and four beams at level 17. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.
- **Scaling Rule 1 Type**: character_level_tiers
- **Scaling Rule 1 Applies To**: damage | Force damage | dice 1d10 | trigger immediate
- **Scaling Rule 1 Notes**: 1 beam at level 1, 2 beams at level 5, 3 beams at level 11, 4 beams at level 17; bonusPerLevel=+1 beam

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Eldritch Blast
Level: Cantrip
Casting Time: 1 Action
Range/Area: 120 ft.
Components: V, S
Duration: Instantaneous
School: Evocation
Attack/Save: Ranged
Damage/Effect: Force

Rules Text:
You hurl a beam of crackling energy. Make a ranged spell attack against one creature or object in range. On a hit, the target takes 1d10 Force damage.
Cantrip Upgrade. The spell creates two beams at level 5, three beams at level 11, and four beams at level 17. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.

Spell Tags:
Damage

Available For:
Warlock
-->
