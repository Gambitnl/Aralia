# Spell Workflow Quick Reference

**1-Page Cheat Sheet** for creating, updating, and validating spell JSON files. Treat this as a guardrail list-do not skip the required fields or nesting rules.

### Non-Negotiables (all spells, especially cantrips)
- Files live under `public/data/spells/level-{N}/{id}.json` (cantrips → `level-0`); remove any flat `public/data/spells/{id}.json` after field comparison.
- Required base fields: `ritual` present, `castingTime.combatCost.type` present, every effect has `trigger` + `condition`.
- Enums/casing: time units lower_snake, schools/damage types/classes Title Case, effect types ALL CAPS, `validTargets` plural.
- Use current schema primitives when applicable: `on_attack_hit`, `controlOptions`, `taunt`, `forcedMovement`, AoE `Square/height`, `saveModifiers`, `requiresStatus`, `escapeCheck`, `familiarContract`, `dispersedByStrongWind`.

---

## Creating a NEW Spell

### Manual Creation Process

```bash
# Copy a close example and edit
# Example: Creating a cantrip
cp public/data/spells/level-0/fire-bolt.json \
   public/data/spells/level-0/my-new-cantrip.json

# Example: Creating a leveled spell (check if level-X directory exists first)
# Note: Not all level directories may exist yet
ls public/data/spells/  # Check which directories exist
```

Then edit manually using [docs/spells/SPELL_JSON_EXAMPLES.md](../../spells/SPELL_JSON_EXAMPLES.md) as the source of truth.

---

## Updating an EXISTING Spell

1. **Find the file:**
   - Cantrips: `public/data/spells/level-0/spell-name.json`
   - Level 1-9: `public/data/spells/level-X/spell-name.json`

2. **Edit manually:**
   - Use [SPELL_JSON_EXAMPLES.md](../../spells/SPELL_JSON_EXAMPLES.md) as reference
   - Refer to [src/types/spells.ts](../../src/types/spells.ts) for field definitions

3. **Validate:**
   ```bash
   npm run validate  # Validates all game data including spells
   ```

---

## Converting LEGACY Spells

### Step 1: Start from an Example

Use the closest pattern in [docs/spells/SPELL_JSON_EXAMPLES.md](../../spells/SPELL_JSON_EXAMPLES.md) and create the JSON file in the appropriate directory (e.g., `public/data/spells/level-0/` for cantrips).

### Step 3: Map Old → New

| Old Field | New Location |
|-----------|--------------|
| `damage` | `effects[0].damage.dice` |
| `damageType` | `effects[0].damage.type` |
| `areaOfEffect` | `targeting.areaOfEffect` |
| `saveType` | `effects[0].saveType` |
| `description` | `description` |

### Step 4: Fill in Missing Fields

New format requires:
- ✅ `classes` - Which classes can learn it
- ✅ `school` - Evocation, Abjuration, etc.
- ✅ `components` - V/S/M requirements
- ✅ `duration` - Instantaneous, timed, etc.
- ✅ `targeting.validTargets` - Creatures, objects, etc.
- ✅ `effects[0].subtype` - direct, area, over_time, triggered

---

## File Locations

### Where Files Go

```
public/data/spells/
?? level-0/
?   ?? acid-splash.json
?   ?? fire-bolt.json
?   ?? ...
?? level-1/
?   ?? cure-wounds.json
?   ?? magic-missile.json
?   ?? ...
?? level-2/
?   ?? ...
?? level-3/
?   ?? fireball.json
?   ?? ...
```

### Naming Convention

- **Spell ID:** `kebab-case` (e.g., `acid-splash`, `cure-wounds`)
- **File name:** `{spell-id}.json` (e.g., `fireball.json`)
- **Display name:** In JSON as `name` field (e.g., `"Fireball"`)

---

## Validation

### Validate All Spells

```bash
npm run validate  # Validates all game data via scripts/validate-data.ts
```

**Output:**
```bash
[Data Validation] Validating 375 spells...
✅ Validation passed for all spells in level-* directories

✅ All game data validated successfully!
```

### Validation Errors

**Example error:**
```bash
❌ Validation failed for spell: fire-bolt
   Error: Invalid damage type "fire" (must be capitalized: "Fire")
   Location: effects[0].damage.type
```

**Fix:** Open the file, correct the field, validate again with `npm run validate`.

---

## Common Tasks

### Add a New Damage Spell

```bash
# 1. Copy a similar spell from SPELL_JSON_EXAMPLES.md
# 2. Edit the JSON file
# 3. Validate
npm run validate
```

### Add a New Healing Spell

```bash
# Copy an existing healing spell template
# Note: Check if level-1 directory exists; if not, spells may be in flat structure
cp public/data/spells/level-0/some-healing-cantrip.json public/data/spells/level-0/new-healing-spell.json
# Edit manually using docs/spells/SPELL_JSON_EXAMPLES.md as reference
npm run validate
```

### Add Upcast Scaling

Edit the spell JSON:
```json
{
  "effects": [{
    "type": "DAMAGE",
    "damage": { "dice": "8d6", "type": "Fire" },
    "scaling": {
      "type": "slot_level",
      "bonusPerLevel": "+1d6"
    }
  }],
  "higherLevels": "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd."
}
```

### Add Saving Throw

```json
{
  "effects": [{
    "type": "DAMAGE",
    "damage": { "dice": "8d6", "type": "Fire" },
    "saveType": "Dexterity",
    "saveEffect": "half"
  }]
}
```

---

## Testing Spells In-Game

### Load and Cast

```typescript
import { loadSpell } from '@/systems/spells/data/spellLoader'
import { SpellExecutor } from '@/systems/spells/integration'

// Load spell
const fireball = await loadSpell('fireball')

// Execute in combat
const result = await SpellExecutor.executeSpell(
  fireball,
  wizard,
  [goblin1, goblin2, goblin3],
  3,  // Cast at 3rd level
  gameState
)

console.log(result.success)  // true
console.log(result.logEntries)  // ["Fireball deals 28 fire damage to Goblin"]
```

---

## Troubleshooting

### Problem: Validation Fails

**Error:** `schema validation failed`

**Solution:**
1. Run `npm run validate` to see specific errors
2. Check JSON syntax (commas, brackets, quotes)
3. Verify field names match schema exactly (see [src/types/spells.ts](../../src/types/spells.ts))
4. Check enum values are case-sensitive (e.g., `"Fire"` not `"fire"`, `"action"` not `"Action"`)

### Problem: Spell Not Loading

**Error:** `Spell 'my-spell' not found`

**Checks:**
- [ ] File exists at correct path in `public/data/spells/`?
- [ ] File name matches spell ID? (`my-spell.json` for `id: "my-spell"`)
- [ ] Spell listed in [public/data/spells_manifest.json](../../public/data/spells_manifest.json)?
- [ ] JSON is valid? (no syntax errors)
- [ ] Validation passes with `npm run validate`?

---

## Build Pipeline

### When Validation Runs

```bash
# Manual validation
npm run validate  # Runs scripts/validate-data.ts

# Build process
npm run build  # ⚠️ Check if validation runs automatically

# Pre-commit hook
git commit  # ⚠️ Check if validation hook is configured
```

**Note:** The integration of validation into the build and git workflow may not be fully implemented yet. Always run `npm run validate` manually before committing.

### Build Failure

If you encounter validation errors:

```bash
🚨 DATA VALIDATION FAILED:

❌ Validation failed for spell: my-spell
   Error details...

Build failed. Fix validation errors and try again.
```

**Fix the errors, then:**
```bash
npm run validate  # Verify fix
npm run build  # Rebuild
```

---

## Quick Command Reference

| Command | Status | Purpose |
|---------|--------|---------|
| `npm run validate` | ✅ WORKING | Validate all game data including spells via [scripts/validate-data.ts](../../scripts/validate-data.ts) |
| `npm run build` | ✅ WORKING | Build project (validation integration unclear) |
| `npm test` | ✅ WORKING | Run all tests via vitest |
| `npm run dev` | ✅ WORKING | Start development server |

---

## File Templates

Use [docs/spells/SPELL_JSON_EXAMPLES.md](../../spells/SPELL_JSON_EXAMPLES.md) as the canonical templates. Copy the closest example into the appropriate directory in `public/data/spells/` and edit.

**Directory Structure:**
- Cantrips: `public/data/spells/level-0/{spell-id}.json` ✅ Active
- Level 1-9: `public/data/spells/level-{1-9}/{spell-id}.json` ✅ Ready for migration

**Note:** Level 1-9 directories exist but are empty. Legacy spells are currently in the flat root structure and will be migrated during the spell overhaul.

---

**Last Updated:** 2025-12-05 (Document Review)


**Related Documentation:**
- [SPELL_INTEGRATION_CHECKLIST.md](../../spells/SPELL_INTEGRATION_CHECKLIST.md) - Component integration and testing procedures
- [SPELL_SYSTEM_ARCHITECTURE.md](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md) - Complete architecture overview
- [SPELL_INTEGRATION_STATUS.md](../../SPELL_INTEGRATION_STATUS.md) - Current implementation status
- [@SPELL-SYSTEM-OVERHAUL-TODO.md](./@SPELL-SYSTEM-OVERHAUL-TODO.md) - Implementation roadmap
