# Cantrip Consistency Report

Generated: 2025-12-17

---

## Fields with Inconsistent Presence

### targeting.lineOfSight
**MISSING on 2 spells:** Chill Touch, Elementalism

### targeting.range
**MISSING on 6 spells:** Blade Ward, Magic Stone, Produce Flame, Shillelagh, Thaumaturgy, True Strike

### range.distance
**MISSING on 18 spells:** Blade Ward, Booming Blade, Chill Touch, Green-Flame Blade, Guidance, Light, Lightning Lure, Magic Stone, Mending, Primal Savagery, Produce Flame, Resistance, Shillelagh, Shocking Grasp, Sword Burst, Thunderclap, True Strike, Word of Radiance

### duration.value / duration.unit
**PRESENT only on 17 spells:** Blade Ward, Booming Blade, Chill Touch, Create Bonfire, Dancing Lights, Friends, Guidance, Light, Mage Hand, Magic Stone, Message, Minor Illusion, Prestidigitation, Produce Flame, Resistance, Shillelagh, Thaumaturgy

### components.materialDescription
**PRESENT only on 13 spells:** Booming Blade, Dancing Lights, Friends, Green-Flame Blade, Light, Mending, Message, Minor Illusion, Resistance, Shillelagh, Thorn Whip, True Strike, Word of Radiance

### targeting.areaOfEffect.shape / targeting.areaOfEffect.size
**PRESENT only on 9 spells:** Acid Splash, Create Bonfire, Mage Hand, Minor Illusion, Mold Earth, Shape Water, Sword Burst, Thunderclap, Word of Radiance

### attackType
**PRESENT only on 4 spells:** Eldritch Blast, Shocking Grasp, Starry Wisp, Thorn Whip

### source / legacy
**PRESENT only on 2 spells:** Booming Blade, Green-Flame Blade

### targeting.maxTargets (scalable)
**PRESENT only on 1 spell:** Eldritch Blast

### castingTime.explorationCost
**PRESENT only on 1 spell:** Mending

### arbitrationType
**PRESENT only on 1 spell:** Prestidigitation

---

## Value Variations Per Field

### school
| Value | Count |
|-------|-------|
| "Evocation" | 15 spells |
| "Transmutation" | 12 spells |
| "Necromancy" | 5 spells |
| "Conjuration" | 4 spells |
| "Enchantment" | 3 spells |
| "Abjuration" | 2 spells |
| "Divination" | 2 spells |
| "Illusion" | 1 spell |

### range.type
| Value | Count |
|-------|-------|
| "ranged" | 26 spells |
| "self" | 11 spells |
| "touch" | 7 spells |

### targeting.type
| Value | Count |
|-------|-------|
| "single" | 22 spells |
| "area" | 9 spells |
| "self" | 6 spells |
| "point" | 3 spells |
| "melee" | 2 spells |
| "multi" | 1 spell |
| "ranged" | 1 spell |

### duration.type
| Value | Count |
|-------|-------|
| "instantaneous" | 27 spells |
| "timed" | 17 spells |

### castingTime.unit
| Value | Count |
|-------|-------|
| "action" | 41 spells |
| "bonus_action" | 2 spells |
| "minute" | 1 spell |

---

## Tags Analysis

### All Unique Tags Found (42 total)
acid, aoe, area, attack, buff, cantrip, charm, cold, communication, concentration, control, creation, damage, debuff, defensive, divine, elemental, enchantment, fire, force, illusion, light, lightning, melee, nature, necrotic, piercing, poison, psychic, radiant, repair, resistance, sensory, social, stabilize, summoning, thunder, transmutation, utility, water, weapon_attack

### "cantrip" Tag Consistency

**WITH "cantrip" tag (32 spells):**
Dancing Lights, Druidcraft, Eldritch Blast, Elementalism, Fire Bolt, Friends, Frostbite, Guidance, Mage Hand, Magic Stone, Mending, Message, Minor Illusion, Poison Spray, Prestidigitation, Produce Flame, Ray of Frost, Resistance, Sacred Flame, Shape Water, Shillelagh, Shocking Grasp, Spare the Dying, Starry Wisp, Sword Burst, Thaumaturgy, Thorn Whip, Thunderclap, Toll the Dead, True Strike, Vicious Mockery, Word of Radiance

**WITHOUT "cantrip" tag (12 spells):**
Acid Splash, Blade Ward, Booming Blade, Chill Touch, Create Bonfire, Green-Flame Blade, Light, Lightning Lure, Mind Sliver, Mold Earth, Primal Savagery, Sapping Sting

---

## Recommended Fixes

1. **Add `targeting.lineOfSight`** to Chill Touch, Elementalism
2. **Add "cantrip" to tags** for 12 spells missing it
3. **Add `targeting.range`** to 6 spells missing it (using `range.distance` or defaults)
4. **Consider adding `attackType`** to all attack-roll spells for consistency
