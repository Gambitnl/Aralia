# Call Lightning
- **Level**: 3
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Druid
- **Sub-Classes**: Unsupported Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Targeting Type**: area
- **Area Shape**: cylinder
- **Area Size**: 60
- **Area Size Unit**: feet
- **Valid Targets**: point
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

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: DAMAGE
- **Save Stat**: Dexterity
- **Save Outcome**: half
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
- **Damage Dice**: 3d10
- **Damage Type**: Lightning

- **Description**: A storm cloud appears at a point within range that you can see above yourself. It takes the shape of a Cylinder that is 10 feet tall with a 60-foot radius. When you cast the spell, choose a point you can see under the cloud. A lightning bolt shoots from the cloud to that point. Each creature within 5 feet of that point makes a Dexterity saving throw, taking 3d10 Lightning damage on a failed save or half as much damage on a successful one. Until the spell ends, you can take a Magic action to call down lightning in that way again, targeting the same point or a different one. If you're outdoors in a storm when you cast this spell, the spell gives you control over that storm instead of creating a new one. Under such conditions, the spell's damage increases by 1d10.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 3.
- **Scaling Rule 1 Type**: slot_level_bonus
- **Scaling Rule 1 Applies To**: damage | Lightning damage | dice 3d10 | trigger immediate
- **Scaling Rule 1 Bonus Per Level**: +1d10

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Call Lightning
Level: 3rd
Casting Time: 1 Action
Range/Area: 120 ft. (60 ft. *)
Components: V, S
Duration: Concentration 10 Minutes
School: Conjuration
Attack/Save: DEX Save
Damage/Effect: Lightning (...)

Rules Text:
A storm cloud appears at a point within range that you can see above yourself. It takes the shape of a Cylinder that is 10 feet tall with a 60-foot radius.
When you cast the spell, choose a point you can see under the cloud. A lightning bolt shoots from the cloud to that point. Each creature within 5 feet of that point makes a Dexterity saving throw, taking 3d10 Lightning damage on a failed save or half as much damage on a successful one.
Until the spell ends, you can take a Magic action to call down lightning in that way again, targeting the same point or a different one.
If you're outdoors in a storm when you cast this spell, the spell gives you control over that storm instead of creating a new one. Under such conditions, the spell's damage increases by 1d10.
Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 3.

Spell Tags:
Damage

Available For:
Druid
Cleric - Tempest Domain (PHB)
Paladin - Oath of the Open Sea (TCSR)

Referenced Rules:
Cylinder -> /rules-glossary/40-tooltip

Capture Method: http
Legacy Page: false
-->

