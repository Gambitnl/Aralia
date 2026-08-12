# Hallow
- **Level**: 5
- **School**: Abjuration
- **Ritual**: false
- **Classes**: Cleric
- **Sub-Classes**: Folded into Classes

- **Casting Time Value**: 24
- **Casting Time Unit**: hour
- **Combat Cost**: long_cast
- **Range Type**: touch
- **Range Distance**: 0
- **Targeting Type**: area
- **Area Shape**: sphere
- **Area Size**: 60
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
- **Material**: true
- **Material Description**: incense worth 1,000+ GP, which the spell consumes
- **Material Cost GP**: 1000
- **Consumed**: true

- **Duration Type**: until_dispelled
- **Concentration**: false

- **Effect Type**: UTILITY
- **Utility Option 1 Name**: Courage
- **Utility Option 1 Effect**: prevent_frightened
- **Utility Option 1 Details**: Chosen creature types cannot gain the Frightened condition while in the area.
- **Utility Option 2 Name**: Darkness
- **Utility Option 2 Effect**: area_darkness
- **Utility Option 2 Details**: Darkness fills the area, and normal light or lower-level magical light cannot illuminate it.
- **Utility Option 3 Name**: Daylight
- **Utility Option 3 Effect**: area_daylight
- **Utility Option 3 Details**: Bright light fills the area, and lower-level magical Darkness cannot extinguish it.
- **Utility Option 4 Name**: Peaceful Rest
- **Utility Option 4 Effect**: block_undead_creation
- **Utility Option 4 Details**: Dead bodies interred in the area cannot be turned into Undead.
- **Utility Option 5 Name**: Extradimensional Interference
- **Utility Option 5 Effect**: block_teleport_planar_travel
- **Utility Option 5 Details**: Chosen creature types cannot enter or exit the area using teleportation or interplanar travel.
- **Utility Option 6 Name**: Fear
- **Utility Option 6 Effect**: apply_frightened
- **Utility Option 6 Details**: Chosen creature types have the Frightened condition while in the area.
- **Utility Option 7 Name**: Resistance
- **Utility Option 7 Effect**: grant_damage_resistance
- **Utility Option 7 Details**: Chosen creature types have Resistance to one chosen damage type while in the area.
- **Utility Option 8 Name**: Silence
- **Utility Option 8 Effect**: block_sound
- **Utility Option 8 Details**: No sound can emanate from within the area, and no sound can reach into it.
- **Utility Option 9 Name**: Tongues
- **Utility Option 9 Effect**: universal_communication
- **Utility Option 9 Details**: Chosen creature types can communicate with any other creature in the area even without a shared language.
- **Utility Option 10 Name**: Vulnerability
- **Utility Option 10 Effect**: grant_damage_vulnerability
- **Utility Option 10 Details**: Chosen creature types have Vulnerability to one chosen damage type while in the area.
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
- **Utility Type**: other
- **Damage Interaction Modes**: resistance, vulnerability
- **Damage Interaction Damage Types**: Acid, Bludgeoning, Cold, Fire, Force, Lightning, Necrotic, Piercing, Poison, Psychic, Radiant, Slashing, Thunder
- **Damage Interaction Damage Type Source**: chosen_damage_type
- **Damage Interaction Subject Scope**: chosen_creature_types
- **Damage Interaction Duration Scope**: while_in_area

- **Description**: You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already under the effect of Hallow. The affected area has the following effects. Hallowed Ward. Choose any of these creature types: Aberration, Celestial, Elemental, Fey, Fiend, or Undead. Creatures of the chosen types can't willingly enter the area, and any creature that is possessed by or that has the Charmed or Frightened condition from such creatures isn't possessed, Charmed, or Frightened by them while in the area. Extra Effect. You bind an extra effect to the area from the list below: Courage. Creatures of any types you choose can't gain the Frightened condition while in the area. Darkness. Darkness fills the area. Normal light, as well as magical light created by spells of a level lower than this spell, can't illuminate the area. Daylight. Bright light fills the area. Magical Darkness created by spells of a level lower than this spell can't extinguish the light. Peaceful Rest. Dead bodies interred in the area can't be turned into Undead. Extradimensional Interference. Creatures of any types you choose can't enter or exit the area using teleportation or interplanar travel. Fear. Creatures of any types you choose have the Frightened condition while in the area. Resistance. Creatures of any types you choose have Resistance to one damage type of your choice while in the area. Silence. No sound can emanate from within the area, and no sound can reach into it. Tongues. Creatures of any types you choose can communicate with any other creature in the area even if they don't share a common language. Vulnerability. Creatures of any types you choose have Vulnerability to one damage type of your choice while in the area.

## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Hallow
Level: 5th
Casting Time: 24 Hours
Range/Area: Touch
Components: V, S, M *
Duration: Until Dispelled
School: Abjuration
Attack/Save: None
Damage/Effect: Buff (...)

Rules Text:
You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already under the effect of Hallow . The affected area has the following effects.
Hallowed Ward. Choose any of these creature types: Aberration, Celestial, Elemental, Fey, Fiend, or Undead. Creatures of the chosen types can't willingly enter the area, and any creature that is possessed by or that has the Charmed or Frightened condition from such creatures isn't possessed, Charmed, or Frightened by them while in the area.
Extra Effect. You bind an extra effect to the area from the list below:
Courage. Creatures of any types you choose can't gain the Frightened condition while in the area.
Darkness. Darkness fills the area. Normal light, as well as magical light created by spells of a level lower than this spell, can't illuminate the area.
Daylight. Bright light fills the area. Magical Darkness created by spells of a level lower than this spell can't extinguish the light.
Peaceful Rest. Dead bodies interred in the area can't be turned into Undead.
Extradimensional Interference. Creatures of any types you choose can't enter or exit the area using teleportation or interplanar travel.
Fear. Creatures of any types you choose have the Frightened condition while in the area.
Resistance. Creatures of any types you choose have Resistance to one damage type of your choice while in the area.
Silence. No sound can emanate from within the area, and no sound can reach into it.
Tongues. Creatures of any types you choose can communicate with any other creature in the area even if they don't share a common language.
Vulnerability. Creatures of any types you choose have Vulnerability to one damage type of your choice while in the area.

Material Component:
* - (incense worth 1,000+ GP, which the spell consumes)

Spell Tags:
Control
Buff
Debuff
Environment

Available For:
Cleric
Cleric - Keeper Domain (BoET)

Referenced Rules:
possessed -> /rules-glossary/92-tooltip
Darkness -> /rules-glossary/46-tooltip
Bright light -> /rules-glossary/21-tooltip

Capture Method: http
Legacy Page: false
-->
