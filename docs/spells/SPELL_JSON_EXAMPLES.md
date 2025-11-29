# Spell JSON Examples - Complete Reference Guide

This document provides complete, validated examples of spell JSONs in the new format defined in `src/types/spells.ts`. Use these as templates when migrating spells.

## Critical Rules

### Rule 1: All Effects MUST Include BaseEffect Fields

**Every effect**, regardless of type, MUST include these three fields from `BaseEffect`:

```typescript
{
  "trigger": { "type": "immediate" | "after_primary" | "turn_start" | "turn_end" },
  "condition": { "type": "hit" | "save" | "always", ... },
  "scaling": { ... }  // OPTIONAL
}
```

### Rule 2: Effect Type Mapping

| Old Format | New Format | Notes |
|------------|------------|-------|
| `"Damage"` | `"DAMAGE"` | All caps |
| `"Healing"` | `"HEALING"` | All caps |
| `"Buff"` | `"DEFENSIVE"` or `"UTILITY"` | Depends on effect type |
| `"Debuff"` | `"STATUS_CONDITION"` | Use D&D 5e condition names |
| `"Control"` | `"MOVEMENT"` or `"STATUS_CONDITION"` | Depends on mechanic |

### Rule 3: String Enums Are Case-Sensitive

```json
// ✅ CORRECT
"unit": "action"
"school": "Evocation"
"type": "DAMAGE"

// ❌ WRONG
"unit": "Action"
"school": "evocation"
"type": "damage"
```

---

## Example 1: Simple Damage Cantrip (Fire Bolt)

**Spell Type**: Cantrip with ranged spell attack and damage scaling by character level

```json
{
  "id": "fire-bolt",
  "name": "Fire Bolt",
  "level": 0,
  "school": "Evocation",
  "classes": ["ARTIFICER", "SORCERER", "WIZARD"],
  "description": "You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn't being worn or carried.",
  "higherLevels": "This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
  "tags": ["damage", "fire", "cantrip"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },

  "range": {
    "type": "ranged",
    "distance": 120
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "instantaneous",
    "concentration": false
  },

  "targeting": {
    "type": "single",
    "range": 120,
    "validTargets": ["creatures", "objects"],
    "lineOfSight": true
  },

  "effects": [
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "hit"
      },
      "damage": {
        "dice": "1d10",
        "type": "Fire"
      },
      "scaling": {
        "type": "character_level",
        "bonusPerLevel": "+1d10",
        "customFormula": "1d10 at level 1, 2d10 at level 5, 3d10 at level 11, 4d10 at level 17"
      }
    }
  ]
}
```

**Key Points**:
- Cantrips have `"level": 0`
- `trigger.type: "immediate"` means it happens when cast
- `condition.type: "hit"` means it requires a spell attack roll
- Cantrip scaling uses `"character_level"`, not `"slot_level"`

---

## Example 2: Defensive Reaction Spell (Shield)

**Spell Type**: Reaction spell that grants AC bonus

```json
{
  "id": "shield",
  "name": "Shield",
  "level": 1,
  "school": "Abjuration",
  "classes": ["SORCERER", "WIZARD"],
  "description": "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.",
  "tags": ["defense", "reaction"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "reaction",
    "reactionCondition": "which you take when you are hit by an attack or targeted by the magic missile spell",
    "combatCost": {
      "type": "reaction",
      "condition": "when you are hit by an attack or targeted by magic missile"
    }
  },

  "range": {
    "type": "self"
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "timed",
    "value": 1,
    "unit": "round",
    "concentration": false
  },

  "targeting": {
    "type": "self",
    "validTargets": ["self"],
    "lineOfSight": false
  },

  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "defenseType": "ac_bonus",
      "value": 5,
      "duration": {
        "type": "rounds",
        "value": 1
      }
    }
  ]
}
```

**Key Points**:
- Reaction spells need `reactionCondition` string
- `condition.type: "always"` means no save/attack roll needed
- `duration` appears in TWO places: spell duration and effect duration
- No scaling (upcast doesn't improve it)

---

## Example 3: Multi-Effect Spell (Absorb Elements)

**Spell Type**: Reaction with immediate defense + delayed damage

```json
{
  "id": "absorb-elements",
  "name": "Absorb Elements",
  "level": 1,
  "school": "Abjuration",
  "classes": ["ARTIFICER", "DRUID", "RANGER", "SORCERER", "WIZARD"],
  "description": "The spell captures some of the incoming energy, lessening its effect on you and storing it for your next melee attack. You have resistance to the triggering damage type until the start of your next turn. Also, the first time you hit with a melee attack on your next turn, the target takes an extra 1d6 damage of the triggering type, and the spell ends.",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each slot level above 1st.",
  "tags": ["defense", "reaction", "damage"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "reaction",
    "reactionCondition": "which you take when you take acid, cold, fire, lightning, or thunder damage",
    "combatCost": {
      "type": "reaction",
      "condition": "when you take elemental damage"
    }
  },

  "range": {
    "type": "self"
  },

  "components": {
    "verbal": false,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "timed",
    "value": 1,
    "unit": "round",
    "concentration": false
  },

  "targeting": {
    "type": "self",
    "validTargets": ["self"],
    "lineOfSight": false
  },

  "effects": [
    {
      "type": "DEFENSIVE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "defenseType": "resistance",
      "damageType": ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
      "duration": {
        "type": "rounds",
        "value": 1
      }
    },
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "turn_start"
      },
      "condition": {
        "type": "hit"
      },
      "damage": {
        "dice": "1d6",
        "type": "Acid"
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d6"
      }
    }
  ]
}
```

**Key Points**:
- Multiple effects in one spell
- First effect is immediate (`trigger.type: "immediate"`)
- Second effect triggers next turn (`trigger.type: "turn_start"`)
- Damage type in second effect should match absorbed type (system determines this)
- Scaling only applies to second effect

---

## Example 4: Area Effect with Save (Burning Hands)

**Spell Type**: AoE spell with Dexterity save for half damage

```json
{
  "id": "burning-hands",
  "name": "Burning Hands",
  "level": 1,
  "school": "Evocation",
  "classes": ["SORCERER", "WIZARD"],
  "description": "As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make a Dexterity saving throw. A creature takes 3d6 fire damage on a failed save, or half as much damage on a successful one. The fire ignites any flammable objects in the area that aren't being worn or carried.",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.",
  "tags": ["damage", "fire", "aoe"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },

  "range": {
    "type": "self"
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "instantaneous",
    "concentration": false
  },

  "targeting": {
    "type": "area",
    "range": 0,
    "validTargets": ["creatures"],
    "lineOfSight": true,
    "areaOfEffect": {
      "shape": "Cone",
      "size": 15
    }
  },

  "effects": [
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "save",
        "saveType": "Dexterity",
        "saveEffect": "half"
      },
      "damage": {
        "dice": "3d6",
        "type": "Fire"
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d6"
      }
    }
  ]
}
```

**Key Points**:
- AoE targeting includes `areaOfEffect` with `shape` and `size`
- `condition.type: "save"` requires `saveType` and `saveEffect`
- `saveEffect: "half"` means half damage on successful save
- Spell level scaling uses `slot_level`, not `character_level`

---

## Example 5: Ritual Spell with Utility Effect (Detect Magic)

**Spell Type**: Concentration spell with detection/sensory effect, can be cast as ritual

```json
{
  "id": "detect-magic",
  "name": "Detect Magic",
  "level": 1,
  "school": "Divination",
  "classes": ["BARD", "CLERIC", "DRUID", "PALADIN", "RANGER", "SORCERER", "WIZARD"],
  "description": "For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic, and you learn its school of magic, if any. The spell can penetrate most barriers, but it is blocked by 1 foot of stone, 1 inch of common metal, a thin sheet of lead, or 3 feet of wood or dirt.",
  "tags": ["detection", "ritual", "utility"],
  "ritual": true,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    },
    "explorationCost": {
      "value": 11,
      "unit": "minute"
    }
  },

  "range": {
    "type": "self"
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "timed",
    "value": 10,
    "unit": "minute",
    "concentration": true
  },

  "targeting": {
    "type": "self",
    "validTargets": ["self"],
    "lineOfSight": false
  },

  "effects": [
    {
      "type": "UTILITY",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "utilityType": "sensory",
      "description": "Sense magic within 30 feet, identify school of magic with an action"
    }
  ]
}
```

**Key Points**:
- `ritual: true` allows casting as ritual
- Ritual casting adds 10 minutes, so `explorationCost` is 11 minutes total
- `concentration: true` in duration
- UTILITY effects need `utilityType` and text `description`

---

## Example 6: Healing Spell (Cure Wounds)

**Spell Type**: Touch-range healing with slot-level scaling

```json
{
  "id": "cure-wounds",
  "name": "Cure Wounds",
  "level": 1,
  "school": "Evocation",
  "classes": ["BARD", "CLERIC", "DRUID", "PALADIN", "RANGER"],
  "description": "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.",
  "tags": ["healing"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },

  "range": {
    "type": "touch"
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "instantaneous",
    "concentration": false
  },

  "targeting": {
    "type": "single",
    "range": 5,
    "validTargets": ["creatures", "allies"],
    "lineOfSight": true
  },

  "effects": [
    {
      "type": "HEALING",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "healing": {
        "dice": "1d8",
        "isTemporaryHp": false
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d8"
      }
    }
  ]
}
```

**Key Points**:
- Touch spells use `range.type: "touch"` and `targeting.range: 5`
- Healing dice includes modifier (e.g., "1d8+3") if fixed
- `isTemporaryHp: false` for regular healing
- The text mentions "spellcasting ability modifier" but combat system adds that

---

## Example 7: Status Condition Effect (Hold Person)

**Spell Type**: Concentration spell that applies Paralyzed condition with save

```json
{
  "id": "hold-person",
  "name": "Hold Person",
  "level": 2,
  "school": "Enchantment",
  "classes": ["BARD", "CLERIC", "DRUID", "SORCERER", "WARLOCK", "WIZARD"],
  "description": "Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration. At the end of each of its turns, the target can make another Wisdom saving throw. On a success, the spell ends on the target.",
  "higherLevels": "When you cast this spell using a spell slot of 3rd level or higher, you can target one additional humanoid for each slot level above 2nd. The humanoids must be within 30 feet of each other when you target them.",
  "tags": ["control", "paralysis", "humanoid"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },

  "range": {
    "type": "ranged",
    "distance": 60
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": true,
    "materialDescription": "a small, straight piece of iron"
  },

  "duration": {
    "type": "timed",
    "value": 1,
    "unit": "minute",
    "concentration": true
  },

  "targeting": {
    "type": "single",
    "range": 60,
    "validTargets": ["creatures", "enemies"],
    "lineOfSight": true
  },

  "effects": [
    {
      "type": "STATUS_CONDITION",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "save",
        "saveType": "Wisdom",
        "saveEffect": "negates_condition"
      },
      "statusCondition": {
        "name": "Paralyzed",
        "duration": {
          "type": "minutes",
          "value": 1
        }
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1 target"
      }
    }
  ]
}
```

**Key Points**:
- Use exact D&D 5e condition names: "Paralyzed", not "paralyzed"
- `saveEffect: "negates_condition"` means save prevents condition entirely
- Condition has its own duration separate from spell duration
- Scaling can be "+1 target" instead of dice

---

## Example 8: Hybrid Targeting (Ice Knife)

**Spell Type**: Spell with primary single target + secondary AoE explosion

```json
{
  "id": "ice-knife",
  "name": "Ice Knife",
  "level": 1,
  "school": "Conjuration",
  "classes": ["DRUID", "SORCERER", "WIZARD"],
  "description": "You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 piercing damage. Hit or miss, the shard then explodes. The target and each creature within 5 feet of it must succeed on a Dexterity saving throw or take 2d6 cold damage.",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the cold damage increases by 1d6 for each slot level above 1st.",
  "tags": ["damage", "cold", "piercing", "aoe"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },

  "range": {
    "type": "ranged",
    "distance": 60
  },

  "components": {
    "verbal": false,
    "somatic": true,
    "material": true,
    "materialDescription": "a drop of water or piece of ice"
  },

  "duration": {
    "type": "instantaneous",
    "concentration": false
  },

  "targeting": {
    "type": "hybrid",
    "validTargets": ["creatures"],
    "lineOfSight": true,
    "primary": {
      "type": "single",
      "range": 60,
      "validTargets": ["creatures"],
      "lineOfSight": true
    },
    "secondary": {
      "type": "area",
      "range": 0,
      "validTargets": ["creatures"],
      "lineOfSight": false,
      "areaOfEffect": {
        "shape": "Sphere",
        "size": 5
      }
    }
  },

  "effects": [
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "hit"
      },
      "damage": {
        "dice": "1d10",
        "type": "Piercing"
      }
    },
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "after_primary"
      },
      "condition": {
        "type": "save",
        "saveType": "Dexterity",
        "saveEffect": "half"
      },
      "damage": {
        "dice": "2d6",
        "type": "Cold"
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d6"
      }
    }
  ]
}
```

**Key Points**:
- Hybrid targeting needs both `primary` and `secondary` targeting objects
- First effect uses `trigger.type: "immediate"`
- Second effect uses `trigger.type: "after_primary"` for explosion
- Secondary AoE is centered on primary target's location

---

## Example 9: Multi-Target Spell (Magic Missile)

**Spell Type**: Spell that targets multiple specific creatures

```json
{
  "id": "magic-missile",
  "name": "Magic Missile",
  "level": 1,
  "school": "Evocation",
  "classes": ["SORCERER", "WIZARD"],
  "description": "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several.",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.",
  "tags": ["damage", "force", "autohit"],
  "ritual": false,

  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },

  "range": {
    "type": "ranged",
    "distance": 120
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },

  "duration": {
    "type": "instantaneous",
    "concentration": false
  },

  "targeting": {
    "type": "multi",
    "range": 120,
    "maxTargets": 3,
    "validTargets": ["creatures"],
    "lineOfSight": true
  },

  "effects": [
    {
      "type": "DAMAGE",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "damage": {
        "dice": "1d4+1",
        "type": "Force"
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1 dart (1d4+1 damage)"
      }
    }
  ]
}
```

**Key Points**:
- Multi-targeting uses `type: "multi"` with `maxTargets`
- No attack roll or save (`condition.type: "always"`)
- Damage dice can include flat bonuses: "1d4+1"
- Scaling adds more projectiles, not more damage per projectile

---

## Example 10: Summoning Spell (Find Familiar)

**Spell Type**: Long-duration summoning with material cost

```json
{
  "id": "find-familiar",
  "name": "Find Familiar",
  "level": 1,
  "school": "Conjuration",
  "classes": ["WIZARD"],
  "description": "You gain the service of a familiar, a spirit that takes an animal form you choose: bat, cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, raven, sea horse, spider, or weasel. Appearing in an unoccupied space within range, the familiar has the statistics of the chosen form, though it is a celestial, fey, or fiend (your choice) instead of a beast.",
  "tags": ["summoning", "ritual", "familiar"],
  "ritual": true,
  "rarity": "common",

  "castingTime": {
    "value": 1,
    "unit": "hour",
    "explorationCost": {
      "value": 1,
      "unit": "hour"
    }
  },

  "range": {
    "type": "ranged",
    "distance": 10
  },

  "components": {
    "verbal": true,
    "somatic": true,
    "material": true,
    "materialDescription": "10 gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier",
    "materialCost": 10,
    "isConsumed": true
  },

  "duration": {
    "type": "instantaneous",
    "concentration": false
  },

  "targeting": {
    "type": "area",
    "range": 10,
    "validTargets": ["point"],
    "lineOfSight": true,
    "areaOfEffect": {
      "shape": "Sphere",
      "size": 5
    }
  },

  "effects": [
    {
      "type": "SUMMONING",
      "trigger": {
        "type": "immediate"
      },
      "condition": {
        "type": "always"
      },
      "summonType": "creature",
      "creatureId": "familiar",
      "count": 1,
      "duration": {
        "type": "special"
      }
    }
  ]
}
```

**Key Points**:
- Long casting time uses `unit: "hour"`
- Material components can have cost: `materialCost: 10` (in GP)
- `isConsumed: true` means materials are consumed
- `rarity` property for scroll generation
- Summoning duration can be `type: "special"` for permanent

---

## Common Patterns Reference

### Trigger Types
```json
"trigger": { "type": "immediate" }        // Happens when spell is cast
"trigger": { "type": "after_primary" }    // After primary effect (Ice Knife explosion)
"trigger": { "type": "turn_start" }       // Start of caster's next turn
"trigger": { "type": "turn_end" }         // End of target's turn
```

### Condition Types
```json
// No roll needed
"condition": { "type": "always" }

// Requires spell attack roll
"condition": { "type": "hit" }

// Requires saving throw
"condition": {
  "type": "save",
  "saveType": "Dexterity",
  "saveEffect": "half"          // or "none" or "negates_condition"
}
```

### Scaling Types
```json
// Cantrips scale with character level
"scaling": {
  "type": "character_level",
  "bonusPerLevel": "+1d10"
}

// Leveled spells scale with spell slot
"scaling": {
  "type": "slot_level",
  "bonusPerLevel": "+1d6"
}

// Custom scaling
"scaling": {
  "type": "custom",
  "customFormula": "Special description here"
}
```

### Damage Types (Exact spelling required)
```
"Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning",
"Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"
```

### Status Conditions (Exact spelling required)
```
"Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
"Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned",
"Prone", "Restrained", "Stunned", "Unconscious"
```

### Schools (Exact capitalization required)
```
"Abjuration", "Conjuration", "Divination", "Enchantment",
"Evocation", "Illusion", "Necromancy", "Transmutation"
```

---

## Validation Checklist

Before creating a PR, verify:

1. ✅ All effects include `trigger` and `condition` fields
2. ✅ Effect types are all caps: `"DAMAGE"`, not `"damage"`
3. ✅ String enums match exactly: `"action"`, `"Evocation"`, `"Fire"`
4. ✅ Damage types use proper capitalization: `"Fire"`, not `"fire"`
5. ✅ Condition names use proper capitalization: `"Paralyzed"`, not `"paralyzed"`
6. ✅ Ritual spells have `ritual: true` and `explorationCost` in `castingTime`
7. ✅ Touch spells use `range.type: "touch"` AND `targeting.range: 5`
8. ✅ AoE spells have `areaOfEffect` in `targeting`
9. ✅ Material components with GP cost have `materialCost` number
10. ✅ Concentration spells have `concentration: true` in `duration`

---

**Last Updated**: Current session
**Source**: Based on [src/types/spells.ts](../../src/types/spells.ts)
