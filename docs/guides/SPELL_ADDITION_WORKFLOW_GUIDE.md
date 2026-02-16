# Guide: Adding or Updating Spells (Development Process)

This guide outlines the complete **development workflow** for adding new spells to the Aralia RPG application or updating existing ones. This is a **build-time process** performed by developers, not a gameplay feature.

> ⚠️ **Important Distinction**: Spell addition is a **development activity** that happens during game creation/maintenance, not during actual gameplay. Players interact with existing spells through character creation, spellbooks, and combat - they don't add new spells during play sessions.

## Current Spell System Status

**Architecture:** Component-based JSON schema with explicit effects and targeting  
**Validation:** Strict TypeScript interfaces and Zod schema validation  
**Integration:** Direct combat engine consumption, no regex parsing  

### Spell Data Structure
- **Location:** `public/data/spells/level-{N}/{spell-id}.json` (nested by level)
- **Format:** V2 JSON schema with explicit `effects[]` array
- **Validation:** Automatic via `npm run validate` and Zod validators

## Workflow Options

### Option 1: AI-Assisted Creation (Recommended for New Contributors)

**Development Context**: This workflow is for developers/maintainers adding spells to the game's spell database during the development process.

Use this simplified prompt for AI assistance:

```
Here is the spell card for [Spell Name]. Please add or update it in the game.

`[Attach screenshot(s) of the spell card here]`
```

The AI development assistant will:
1. Infer spell name and create kebab-case ID
2. Check for existing spell files
3. Create/update JSON with V2 schema
4. Normalize `classes` array using official subclass list
5. Update class spell lists in `src/data/classes/index.ts`
6. Regenerate manifests and indexes

### Option 2: Manual Creation (For Experienced Developers)

**Development Context**: Direct file manipulation for developers familiar with the spell system architecture.

#### Creating a New Spell

1. **Choose reference template:**
   ```bash
   # For cantrips
   cp public/data/spells/level-0/fire-bolt.json \
      public/data/spells/level-0/new-spell-name.json
   
   # For leveled spells (ensure directory exists)
   mkdir -p public/data/spells/level-3
   cp public/data/spells/level-3/fireball.json \
      public/data/spells/level-3/new-spell-name.json
   ```

2. **Edit using reference materials:**
   - Primary: `docs/spells/SPELL_JSON_EXAMPLES.md` (complete examples)
   - Schema: `src/types/spells.ts` (TypeScript interfaces)
   - Validation: `src/systems/spells/validation/spellValidator.ts` (Zod schema)

3. **Required fields checklist:**
   - ✅ `id` (kebab-case, matches filename)
   - ✅ `name` (proper title case)
   - ✅ `level` (0-9)
   - ✅ `school` (from SpellSchool enum)
   - ✅ `classes` (normalized array, see subclass list below)
   - ✅ `ritual` (boolean)
   - ✅ `castingTime` with `combatCost.type`
   - ✅ `range` object
   - ✅ `components` object
   - ✅ `duration` object
   - ✅ `targeting` object with `type` and `validTargets`
   - ✅ `effects` array (at least one effect with `trigger` + `condition`)
   - ✅ `description` (flavor text)

4. **Validate your work:**
   ```bash
   npm run validate        # Full data validation
   npm run typecheck       # TypeScript compilation
   npm run build           # Production build test
   ```

#### Updating Existing Spells

1. **Locate the file:**
   - Cantrips: `public/data/spells/level-0/spell-name.json`
   - Leveled spells: `public/data/spells/level-N/spell-name.json`

2. **Make targeted changes** using the same reference materials

3. **Validate and test** as above

## Official Subclass List for Class Normalization

When populating the `classes` array, only include base classes and subclasses from this approved list:

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

**Format:** 
- Base class only: `"WIZARD"`
- With subclass: `"WIZARD - EVOKER"`

## Testing Your Spell

After creation/update, verify integration:

1. **Character Creation:** Can the spell be selected by appropriate classes?
2. **Spellbook:** Does the spell appear correctly in the character sheet?
3. **Combat:** Can the spell be cast and does it produce expected effects?
4. **Glossary:** Is the spell searchable and displaying correct information?

## Common Issues and Solutions

**Validation Errors:**
- Check enum casing (lowercase for units, Title Case for schools)
- Ensure all required fields are present
- Verify effect arrays include `trigger` and `condition`

**Integration Problems:**
- Confirm spell exists in `public/data/spells_manifest.json`
- Check that class spell lists include the spell ID
- Verify no typos in spell ID between files

**Performance Issues:**
- Large AoE spells may need geometric algorithm optimization
- Complex effects might require additional command pattern implementation

## Resources

- **Primary Reference:** `docs/spells/SPELL_JSON_EXAMPLES.md`
- **Type Definitions:** `src/types/spells.ts`
- **Validation Schema:** `src/systems/spells/validation/spellValidator.ts`
- **Status Tracking:** `docs/spells/STATUS_LEVEL_{N}.md`
- **Integration Checklist:** `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
- **Overhaul Progress:** `docs/tasks/spell-system-overhaul/@SPELL-SYSTEM-OVERHAUL-TODO.md`

This workflow balances automation for ease of use with manual control for precision, supporting both rapid expansion and careful refinement of the spell system.
