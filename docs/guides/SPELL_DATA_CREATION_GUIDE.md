# Spell Data Creation Guide (V2 Schema)

**Last Updated:** 2025-12-13  
**Target Audience:** Spell system contributors and maintainers  
**Schema Version:** V2 (Component-Based)

This guide provides comprehensive instructions for creating and maintaining spell JSON data files using the current V2 schema. This replaces the legacy text-parsing approach with explicit, structured data definitions.

## Overview

### Key Changes from Legacy System

| Aspect | Legacy System | V2 System |
|--------|---------------|-----------|
| **Data Structure** | Flat JSON with minimal structure | Nested by level with rich schema |
| **Effect Definition** | Regex parsing of description text | Explicit `effects[]` array with typed components |
| **Validation** | Basic JSON structure checks | Strict Zod schema validation |
| **Execution** | Text analysis during runtime | Direct component consumption |
| **Maintenance** | Fragile regex patterns | Structured data with clear contracts |

### Benefits of V2 Schema

- **Reliability:** No more regex parsing failures
- **Extensibility:** Easy to add new effect types
- **Performance:** Faster execution without runtime text analysis
- **Maintainability:** Clear data contracts and validation
- **Developer Experience:** Better tooling support and autocomplete

## File Structure and Organization

### Directory Layout

```
public/
└── data/
    └── spells/
        ├── level-0/           # Cantrips
        │   ├── fire-bolt.json
        │   └── prestidigitation.json
        ├── level-1/           # 1st level spells
        │   ├── magic-missile.json
        │   └── shield.json
        ├── level-2/           # 2nd level spells
        └── ...                # Through level-9
```

### Naming Convention

- **File names:** kebab-case matching spell ID (`fire-bolt.json`)
- **IDs:** Lowercase with hyphens (`fire-bolt`, `magic-missile`)
- **Directory names:** `level-{N}` where N is spell level (0-9)

### Manifest System

The `spells_manifest.json` file at `public/data/spells_manifest.json` serves as the index:

```json
{
  "fire-bolt": {
    "name": "Fire Bolt",
    "level": 0,
    "school": "Evocation",
    "path": "/data/spells/level-0/fire-bolt.json"
  }
}
```

## JSON Schema Reference

### Complete Spell Structure

```json
{
  "id": "string",                    // Required: kebab-case ID
  "name": "string",                  // Required: Display name
  "level": 0,                        // Required: 0-9
  "school": "Evocation",             // Required: from SpellSchool enum
  "classes": ["Wizard", "Sorcerer"], // Required: normalized class list
  "tags": ["damage", "fire"],        // Optional: categorization
  "description": "string",           // Required: flavor text
  "higherLevels": "string",          // Optional: higher level effects
  "ritual": false,                   // Required: boolean
  
  "castingTime": {                   // Required
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    }
  },
  
  "range": {                         // Required
    "type": "ranged",
    "distance": 120
  },
  
  "components": {                    // Required
    "verbal": true,
    "somatic": true,
    "material": false
  },
  
  "duration": {                      // Required
    "type": "instantaneous",
    "concentration": false
  },
  
  "targeting": {                     // Required
    "type": "single",
    "range": 120,
    "validTargets": ["creatures"]
  },
  
  "effects": [                       // Required: at least one effect
    {
      "type": "DAMAGE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "hit" },
      "damage": { "dice": "1d10", "type": "Fire" }
    }
  ],
  
  "engineHook": {                    // Optional: implementation tracking
    "isImplemented": true,
    "notes": "string"
  }
}
```

### Required Fields Checklist

Every spell must include these fields:

- ✅ `id` - Unique kebab-case identifier
- ✅ `name` - Proper display name
- ✅ `level` - Spell level (0-9)
- ✅ `school` - Valid spell school
- ✅ `classes` - Normalized array of casting classes
- ✅ `ritual` - Boolean indicating ritual casting
- ✅ `castingTime` - Complete casting time object
- ✅ `range` - Complete range specification
- ✅ `components` - Complete components object
- ✅ `duration` - Complete duration specification
- ✅ `targeting` - Complete targeting definition
- ✅ `effects` - Array with at least one valid effect
- ✅ `description` - Flavor text description

### Enum Values Reference

#### Spell Schools
```
Abjuration, Conjuration, Divination, Enchantment, 
Evocation, Illusion, Necromancy, Transmutation
```

#### Casting Time Units
```
action, bonus_action, reaction, minute, hour
```

#### Range Types
```
self, touch, ranged, special
```

#### Duration Types
```
instantaneous, round, minute, hour, day, until_dispelled
```

#### Target Types
```
single, multi, area, self, point
```

#### Valid Targets
```
creatures, objects, allies, enemies, self, point
```

#### Effect Types
```
DAMAGE, HEALING, STATUS_CONDITION, MOVEMENT, 
SUMMONING, TERRAIN, UTILITY, DEFENSIVE
```

## Effect Component Definitions

### DamageEffect

Handles damage dealing mechanics:

```json
{
  "type": "DAMAGE",
  "trigger": { "type": "immediate" },
  "condition": { 
    "type": "save",
    "saveType": "Dexterity"
  },
  "damage": {
    "dice": "8d6",
    "type": "Fire"
  },
  "scaling": {
    "dicePerLevel": "1d6",
    "startingLevel": 5
  }
}
```

### HealingEffect

Handles healing and temporary hit points:

```json
{
  "type": "HEALING",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "healing": {
    "dice": "2d8+4",
    "type": "hit_points"  // or "temp_hp"
  }
}
```

### StatusConditionEffect

Applies conditions like Invisible, Poisoned, etc.:

```json
{
  "type": "STATUS_CONDITION",
  "trigger": { "type": "immediate" },
  "condition": { 
    "type": "save",
    "saveType": "Wisdom"
  },
  "statusCondition": {
    "name": "Invisible",
    "duration": {
      "type": "minutes",
      "value": 1
    }
  }
}
```

### MovementEffect

Handles teleportation and forced movement:

```json
{
  "type": "MOVEMENT",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "movementType": "teleport",
  "distance": 30
}
```

### UtilityEffect

Handles miscellaneous mechanics:

```json
{
  "type": "UTILITY",
  "trigger": { "type": "immediate" },
  "condition": { "type": "always" },
  "utilityType": "light",
  "description": "Creates bright light in a 20-foot radius"
}
```

## Validation and Quality Assurance

### Automated Validation

#### Zod Schema Validation
```bash
npm run validate:spells
```

This runs the Zod validator defined in `src/systems/spells/validation/spellValidator.ts` which provides detailed error messages for schema violations.

#### TypeScript Compilation
```bash
npm run typecheck
```

Ensures all spell data conforms to TypeScript interfaces.

#### Full Build Test
```bash
npm run build
```

Verifies the entire application can build with the new spell data.

### Manual Validation Checklist

Before submitting spell changes:

1. **File Location:** Correct `level-{N}` directory
2. **Filename:** Matches `id` field exactly
3. **Required Fields:** All mandatory fields present
4. **Enum Values:** All enum values from approved lists
5. **Class Normalization:** Uses official subclass list
6. **Effect Structure:** Each effect has `trigger` and `condition`
7. **JSON Validity:** Properly formatted JSON
8. **Manifest Entry:** Spell appears in `spells_manifest.json`
9. **Integration Test:** Works in character creation and combat
10. **Documentation:** Updates status tracking files

## Class Normalization Rules

### Approved Base Classes
```
Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, 
Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard
```

### Approved Subclasses
Only include subclasses that exist in the game's glossary:

**Artificer:** Alchemist, Armorer, Artillerist, Battle Smith  
**Barbarian:** Path of the Berserker, Path of the Wild Heart, Path of the World Tree, Path of the Zealot  
**Bard:** College of Dance, College of Glamour, College of Lore, College of Valor  
**Cleric:** Life Domain, Light Domain, Trickery Domain, War Domain  
**Druid:** Circle of the Land, Circle of the Moon, Circle of the Sea, Circle of the Stars  
**Fighter:** Battle Master, Champion, Eldritch Knight, Psi Warrior  
**Monk:** Warrior of Mercy, Warrior of the Open Hand, Warrior of Shadow, Warrior of the Elements  
**Paladin:** Oath of Devotion, Oath of Glory, Oath of the Ancients, Oath of Vengeance  
**Ranger:** Beast Master, Fey Wanderer, Gloom Stalker, Hunter  
**Rogue:** Arcane Trickster, Assassin, Soulknife, Thief  
**Sorcerer:** Aberrant Mind, Clockwork Soul, Draconic Sorcery, Wild Magic  
**Warlock:** Archfey Patron, Celestial Patron, Fiend Patron, Great Old One Patron  
**Wizard:** Abjurer, Diviner, Evoker, Illusionist

### Formatting Examples
```json
// Base class only
"classes": ["WIZARD"]

// With subclass
"classes": ["WIZARD", "WIZARD - EVOKER"]

// Multiple classes
"classes": ["SORCERER", "WIZARD"]
```

## Migration from Legacy Format

### Identifying Legacy Spells

Legacy spells can be identified by:
- Missing `effects` array
- Minimal structured data
- Presence in older status tracking files marked as "Bronze" or "Silver"

### Migration Process

1. **Audit:** Check `docs/spells/STATUS_LEVEL_{N}.md` for spell status
2. **Template:** Use existing V2 spells as templates
3. **Convert:** Transform legacy fields to V2 structure
4. **Validate:** Run `npm run validate:spells`
5. **Test:** Verify in game functionality
6. **Update:** Modify status tracking files

### Common Conversion Patterns

#### Simple Damage Spell
**Legacy:**
```json
{
  "name": "Fire Bolt",
  "description": "Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage."
}
```

**V2:**
```json
{
  "name": "Fire Bolt",
  "description": "Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.",
  "effects": [
    {
      "type": "DAMAGE",
      "trigger": { "type": "immediate" },
      "condition": { "type": "hit" },
      "damage": { "dice": "1d10", "type": "Fire" }
    }
  ]
}
```

## Best Practices

### Data Modeling
- Use the most specific effect type possible
- Include scaling information for level-appropriate growth
- Define clear trigger and condition logic
- Provide descriptive but concise descriptions

### Performance Considerations
- Minimize complex nested objects
- Use arrays for multiple similar effects
- Cache computed values where appropriate
- Consider effect execution order

### Maintainability
- Keep consistent field ordering
- Use meaningful variable names in descriptions
- Document unusual mechanics in `engineHook.notes`
- Regular validation runs during development

## Troubleshooting

### Common Validation Errors

**"Missing required field"**
- Solution: Add the missing field from the required fields checklist

**"Invalid enum value"**
- Solution: Check enum reference section for valid values

**"Effect missing trigger/condition"**
- Solution: Add required `trigger` and `condition` objects to each effect

**"Invalid class name"**
- Solution: Use only approved base classes and subclasses from the normalization list

### Integration Issues

**Spell doesn't appear in character creation:**
- Verify spell is in correct level directory
- Check that class lists include the appropriate classes
- Confirm manifest includes the spell entry

**Spell casts but has no effect:**
- Check effect type implementation in `useAbilitySystem.ts`
- Verify trigger/condition logic matches intended behavior
- Look for console errors during spell execution

## Resources

### Primary References
- **Schema Definition:** `src/types/spells.ts`
- **Validation Schema:** `src/systems/spells/validation/spellValidator.ts`
- **Examples:** `docs/spells/SPELL_JSON_EXAMPLES.md`
- **Workflow:** `docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md`

### Status Tracking
- **Overall Progress:** `docs/SPELL_INTEGRATION_STATUS.md`
- **Per-Level Status:** `docs/spells/STATUS_LEVEL_{N}.md`
- **Integration Checklist:** `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

### Implementation Roadmap
- **Overhaul Progress:** `docs/tasks/spell-system-overhaul/@SPELL-SYSTEM-OVERHAUL-TODO.md`

This guide ensures consistent, high-quality spell data that integrates seamlessly with the V2 spell system architecture.