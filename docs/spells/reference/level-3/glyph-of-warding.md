# Glyph of Warding
- **Level**: 3
- **School**: Abjuration
- **Ritual**: false
- **Classes**: Bard, Cleric, Wizard, Artificer
- **Casting Time Value**: 1
- **Casting Time Unit**: hour
- **Combat Cost**: action
- **Range Type**: touch
- **Range Distance**: 0
- **Range Distance Unit**: feet
- **Targeting Type**: single
- **Targeting Range**: 0
- **Targeting Range Unit**: feet
- **Valid Targets**: object_or_surface
- **Line of Sight**: true
- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: powdered diamond worth 200+ GP, which the spell consumes
- **Material Cost GP**: 200
- **Consumed**: true
- **Duration Type**: until_dispelled
- **Concentration**: false
- **Effect Type**: UTILITY
- **Save Stat**: Dexterity
- **Save Outcome**: half
- **Damage Dice**: 5d8
- **Damage Type**: Acid/Cold/Fire/Lightning/Thunder
- **Description**: You inscribe a glyph that later unleashes a magical effect. You inscribe it either on a surface (such as a table or a section of floor) or within an object that can be closed (such as a book or chest) to conceal the glyph. The glyph can cover an area no larger than 10 feet in diameter. If the surface or object is moved more than 10 feet from where you cast this spell, the glyph is broken, and the spell ends without being triggered. The glyph is nearly imperceptible and requires a successful Wisdom (Perception) check against your spell save DC to notice. When you inscribe the glyph, you set its trigger and choose whether it's an explosive rune or a spell glyph, as explained below. Set the Trigger. You decide what triggers the glyph when you cast the spell. For glyphs inscribed on a surface, common triggers include touching or stepping on the glyph, removing another object covering it, or approaching within a certain distance of it. For glyphs inscribed within an object, common triggers include opening that object or seeing the glyph. Once a glyph is triggered, this spell ends. You can refine the trigger so that only creatures of certain types activate it (for example, the glyph could be set to affect Aberrations). You can also set conditions for creatures that don't trigger the glyph, such as those who say a certain password. Explosive Rune. When triggered, the glyph erupts with magical energy in a 20-foot-radius Sphere centered on the glyph. Each creature in the area makes a Dexterity saving throw. A creature takes 5d8 Acid, Cold, Fire, Lightning, or Thunder damage (your choice when you create the glyph) on a failed save or half as much damage on a successful one. Spell Glyph. You can store a prepared spell of level 3 or lower in the glyph by casting it as part of creating the glyph. The spell must target a single creature or an area. The spell being stored has no immediate effect when cast in this way. When the glyph is triggered, the stored spell takes effect. If the spell has a target, it targets the creature that triggered the glyph. If the spell affects an area, the area is centered on that creature. If the spell summons Hostile creatures or creates harmful objects or traps, they appear as close as possible to the intruder and attack it. If the spell requires Concentration , it lasts until the end of its full duration.
- **Higher Levels**: Using a Higher-Level Spell Slot. The damage of an explosive rune increases by 1d8 for each spell slot level above 3. If you create a spell glyph, you can store any spell of up to the same level as the spell slot you use for the Glyph of Warding .
- **Spatial Form 1 Label**: Glyph Coverage
- **Spatial Form 1 Shape**: Circle
- **Spatial Form 1 Size Value**: 10
- **Spatial Form 1 Size Type**: diameter
- **Spatial Form 1 Size Unit**: feet
- **Spatial Form 1 Notes**: Maximum glyph coverage.
- **Spatial Form 2 Label**: Explosive Rune Burst
- **Spatial Form 2 Shape**: Sphere
- **Spatial Form 2 Size Value**: 20
- **Spatial Form 2 Size Type**: radius
- **Spatial Form 2 Size Unit**: feet
- **Spatial Form 2 Notes**: Triggered explosive-rune effect area.
- **Spatial Detail 1 Label**: Break Distance
- **Spatial Detail 1 Kind**: distance
- **Spatial Detail 1 Value**: 10
- **Spatial Detail 1 Unit**: feet
- **Spatial Detail 1 Notes**: Moving the surface or object farther breaks the glyph.
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Glyph of Warding
Level: 3rd
Casting Time: 1 Hour
Range/Area: Touch
Components: V, S, M *
Duration: Until Dispelled or Triggered
School: Abjuration
Attack/Save: DEX Save
Damage/Effect: Acid (...)

Rules Text:
You inscribe a glyph that later unleashes a magical effect. You inscribe it either on a surface (such as a table or a section of floor) or within an object that can be closed (such as a book or chest) to conceal the glyph. The glyph can cover an area no larger than 10 feet in diameter. If the surface or object is moved more than 10 feet from where you cast this spell, the glyph is broken, and the spell ends without being triggered.
The glyph is nearly imperceptible and requires a successful Wisdom (Perception) check against your spell save DC to notice.
When you inscribe the glyph, you set its trigger and choose whether it’s an explosive rune or a spell glyph, as explained below.
Set the Trigger. You decide what triggers the glyph when you cast the spell. For glyphs inscribed on a surface, common triggers include touching or stepping on the glyph, removing another object covering it, or approaching within a certain distance of it. For glyphs inscribed within an object, common triggers include opening that object or seeing the glyph. Once a glyph is triggered, this spell ends.
You can refine the trigger so that only creatures of certain types activate it (for example, the glyph could be set to affect Aberrations). You can also set conditions for creatures that don’t trigger the glyph, such as those who say a certain password.
Explosive Rune. When triggered, the glyph erupts with magical energy in a 20-foot-radius Sphere centered on the glyph. Each creature in the area makes a Dexterity saving throw. A creature takes 5d8 Acid, Cold, Fire, Lightning, or Thunder damage (your choice when you create the glyph) on a failed save or half as much damage on a successful one.
Spell Glyph. You can store a prepared spell of level 3 or lower in the glyph by casting it as part of creating the glyph. The spell must target a single creature or an area. The spell being stored has no immediate effect when cast in this way.
When the glyph is triggered, the stored spell takes effect. If the spell has a target, it targets the creature that triggered the glyph. If the spell affects an area, the area is centered on that creature. If the spell summons Hostile creatures or creates harmful objects or traps, they appear as close as possible to the intruder and attack it. If the spell requires Concentration , it lasts until the end of its full duration.
Using a Higher-Level Spell Slot. The damage of an explosive rune increases by 1d8 for each spell slot level above 3. If you create a spell glyph, you can store any spell of up to the same level as the spell slot you use for the Glyph of Warding .

Material Component:
* - (powdered diamond worth 200+ GP, which the spell consumes)

Spell Tags:
Damage
Control
Warding

Available For:
Bard
Cleric
Wizard
Artificer

Referenced Rules:
Sphere -> /rules-glossary/109-tooltip
Hostile -> /rules-glossary/70-tooltip
Concentration -> /rules-glossary/31-tooltip

Capture Method: http
Legacy Page: false
-->
