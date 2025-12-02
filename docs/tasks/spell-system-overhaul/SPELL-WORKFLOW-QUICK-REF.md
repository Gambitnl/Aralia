# Spell Workflow Quick Reference

**1-Page Cheat Sheet** for creating, updating, and validating spell JSON files.

---

## Creating a NEW Spell

### Option 1: Interactive Wizard (Recommended)

```bash
npm run spell:new
```

The wizard will:
- ✅ Ask ~30 questions about your spell
- ✅ Generate correctly-formatted JSON
- ✅ Place file in correct directory (`cantrips/` or `level-X/`)
- ✅ Auto-validate before saving

**Example workflow:**
```bash
$ npm run spell:new
🧙 Spell Creation Wizard

? Spell ID (kebab-case): fireball
? Spell Name: Fireball
? Spell Level (0-9): 3
? School of Magic: Evocation
? Which classes can learn this spell? Sorcerer, Wizard
? Casting time: 1 action
? Range in feet: 150
? Requires verbal component? Yes
? Requires somatic component? Yes
? Requires material component? Yes
? Material component description: a tiny ball of bat guano and sulfur
... (continues)

✅ Spell created: src/systems/spells/data/level-3/fireball.json
⚠️  Remember to fill in TODO fields!
```

### Option 2: Copy Template

```bash
# For damage spells
cp src/systems/spells/data/templates/TEMPLATE-damage-spell.json \
   src/systems/spells/data/level-3/fireball.json

# For healing spells
cp src/systems/spells/data/templates/TEMPLATE-healing-spell.json \
   src/systems/spells/data/level-1/cure-wounds.json

# For area save spells
cp src/systems/spells/data/templates/TEMPLATE-area-save-spell.json \
   src/systems/spells/data/level-3/fireball.json
```

Then edit manually with VSCode autocomplete (JSON Schema enabled).

---

## Updating an EXISTING Spell

1. **Find the file:**
   - Cantrips: `src/systems/spells/data/cantrips/spell-name.json`
   - Level 1-9: `src/systems/spells/data/level-X/spell-name.json`

2. **Edit manually:**
   - VSCode will provide autocomplete from JSON Schema
   - Red squiggles show validation errors

3. **Validate:**
   ```bash
   npm run validate:spells
   ```

---

## Converting LEGACY Spells

### Step 1: Use Template

```bash
cp src/systems/spells/data/templates/TEMPLATE-damage-spell.json \
   src/systems/spells/data/level-3/fireball.json
```

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
src/systems/spells/data/
├── cantrips/
│   ├── acid-splash.json
│   ├── fire-bolt.json
│   └── ...
├── level-1/
│   ├── cure-wounds.json
│   ├── magic-missile.json
│   └── ...
├── level-2/
│   └── ...
├── level-3/
│   ├── fireball.json
│   └── ...
└── templates/
    ├── TEMPLATE-damage-spell.json
    ├── TEMPLATE-healing-spell.json
    ├── TEMPLATE-area-save-spell.json
    └── ...
```

### Naming Convention

- **Spell ID:** `kebab-case` (e.g., `acid-splash`, `cure-wounds`)
- **File name:** `{spell-id}.json` (e.g., `fireball.json`)
- **Display name:** In JSON as `name` field (e.g., `"Fireball"`)

---

## Validation

### Validate All Spells

```bash
npm run validate:spells
```

**Output:**
```bash
✅ src/systems/spells/data/cantrips/acid-splash.json
✅ src/systems/spells/data/level-1/cure-wounds.json
✅ src/systems/spells/data/level-3/fireball.json

✅ All spells validated successfully!
```

### Validation Errors

**Example error:**
```bash
❌ src/systems/spells/data/level-3/fireball.json:
   /effects/0/damage/type must be one of: Acid, Cold, Fire, ...
   /targeting/areaOfEffect/shape must be one of: Cone, Cube, Sphere, Line, Cylinder
```

**Fix:** Open the file, correct the field, validate again.

---

## VSCode Autocomplete

### Enable JSON Schema

Add to `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["src/systems/spells/data/**/*.json"],
      "url": "./src/systems/spells/schema/spell.schema.json"
    }
  ]
}
```

### How to Use

1. Open any spell JSON file
2. Start typing a field name → autocomplete shows valid options
3. Hover over a field → see documentation
4. Red squiggles → validation error (hover for details)

**Example:**
```json
{
  "effects": [
    {
      "type": "DA  <-- Autocomplete suggests: DAMAGE, DEFENSIVE
```

---

## Common Tasks

### Add a New Damage Spell

```bash
npm run spell:new
# Answer prompts, select "Damage" as effect type
npm run validate:spells
```

### Add a New Healing Spell

```bash
cp templates/TEMPLATE-healing-spell.json level-1/cure-wounds.json
# Edit manually
npm run validate:spells
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
1. Run `npm run validate:spells` to see specific errors
2. Check JSON syntax (commas, brackets, quotes)
3. Verify field names match schema exactly
4. Check enum values (e.g., `"Fire"` not `"fire"`)

### Problem: Spell Not Loading

**Error:** `Spell 'fireball' not found`

**Checks:**
- [ ] File exists at correct path?
- [ ] File name matches spell ID? (`fireball.json` for `id: "fireball"`)
- [ ] JSON is valid? (no syntax errors)
- [ ] Validation passes?

### Problem: Autocomplete Not Working

**Solution:**
1. Check `.vscode/settings.json` has JSON schema mapping
2. Reload VSCode window (`Ctrl+Shift+P` → "Reload Window")
3. Ensure file path matches pattern (`src/systems/spells/data/**/*.json`)

---

## Build Pipeline

### When Validation Runs

```bash
# Manual validation
npm run validate:spells

# Automatic during build
npm run build  # Runs validation first

# Pre-commit hook
git commit  # Runs validation automatically
```

### Build Failure

If build fails due to invalid spells:

```bash
🚨 SPELL VALIDATION FAILED:

❌ src/systems/spells/data/level-3/fireball.json:
   /effects/0/damage/type must be one of: ...

Build failed. Fix validation errors and try again.
```

**Fix the errors, then:**
```bash
npm run validate:spells  # Verify fix
npm run build  # Rebuild
```

---

## Quick Command Reference

| Command | Purpose |
|---------|---------|
| `npm run spell:new` | Create new spell (wizard) |
| `npm run validate:spells` | Validate all spell files |
| `npm run build` | Build project (includes validation) |
| `npm test` | Run all tests |

---

## File Templates

### Available Templates

- `TEMPLATE-damage-spell.json` - Direct damage (Magic Missile)
- `TEMPLATE-area-save-spell.json` - AoE with save (Fireball)
- `TEMPLATE-healing-spell.json` - Healing (Cure Wounds)
- `TEMPLATE-status-condition-spell.json` - Buffs/debuffs (Bless, Bane)

### Template Locations

All templates: `src/systems/spells/data/templates/`

---

**Last Updated:** November 28, 2025
