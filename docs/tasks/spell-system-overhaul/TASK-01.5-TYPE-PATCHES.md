# Task 01.5: Critical Type Definition Patches

**Priority**: 🔴 **BLOCKING** - Must complete before mass spell migration
**Estimated Time**: 2-3 hours
**Dependencies**: None (can start immediately)
**Blocks**: All spell data migration tasks

---

## Problem Statement

The current `src/types/spells.ts` is missing critical properties that will cause **data loss** during spell migration and force brittle text parsing instead of structured data.

**Identified by**: Gemini 3 Pro architecture review
**Reference**: [SPELL_PROPERTIES_REFERENCE.md](../../spells/SPELL_PROPERTIES_REFERENCE.md)

---

## Critical Gaps

### 1. Missing `ritual` Property ❌

**Current State**:
```typescript
export interface Spell {
  // ... no ritual field
}
```

**Problem**:
- Many D&D spells are rituals (Alarm, Detect Magic, Identify, etc.)
- Migration will **strip** ritual status
- Ritual Casting feature will have no data to work with
- Forces parsing description text for "ritual" keyword

**Required Fix**:
```typescript
export interface Spell {
  // ... existing fields
  ritual?: boolean;  // Can this spell be cast as a ritual?
}
```

**Impact if not fixed**:
- ❌ Data loss: ~30+ ritual spells lose their ritual status
- ❌ Ritual Casting feature cannot be implemented mechanically
- ❌ Must parse description text: "This spell can be cast as a ritual"

---

### 2. Missing `rarity` Property ❌

**Current State**:
```typescript
export interface Spell {
  // ... no rarity field
}
```

**Problem**:
- Spell scroll crafting needs rarity for cost calculation
- Economy system has no data source
- SRD spells don't need this (Common by default)
- Homebrew/exotic spells may have different rarities

**Required Fix**:
```typescript
export type SpellRarity =
  | "Common"      // Default for all SRD spells
  | "Uncommon"
  | "Rare"
  | "Very Rare"
  | "Legendary";

export interface Spell {
  // ... existing fields
  rarity?: SpellRarity;  // Defaults to "Common" if omitted
}
```

**Impact if not fixed**:
- ⚠️ Scroll crafting uses hardcoded level-based costs (acceptable fallback)
- ⚠️ Cannot distinguish exotic homebrew spell scrolls
- ⚠️ Economy system less flexible

---

### 3. Stubbed Effect Types Have No Properties ❌

**Current State**:
```typescript
export interface MovementEffect extends BaseEffect {
  type: "MOVEMENT";
  // NO PROPERTIES - completely empty
}

export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  // NO PROPERTIES - completely empty
}

// Same for SUMMONING, TERRAIN, UTILITY
```

**Problem**:
- **Cannot define what these effects do mechanically**
- Spells like:
  - Longstrider (Movement: +10ft speed)
  - Mage Armor (Defensive: AC = 13 + Dex)
  - Unseen Servant (Summoning: creates servant)
  - Entangle (Terrain: difficult terrain)
  - Light (Utility: creates light source)
- All must rely on **description text parsing**
- Defeats the entire purpose of structured spell data

**Required Fix (Minimum Viable)**:

```typescript
/**
 * Movement effects (speed changes, teleportation, forced movement)
 */
export interface MovementEffect extends BaseEffect {
  type: "MOVEMENT";
  movement: {
    /** What type of movement */
    movementType: "speed" | "teleport" | "push" | "pull" | "jump";
    /** Change in feet (can be negative for slow) */
    distance: number;
    /** Which movement type (if speed change) */
    speedType?: "walking" | "flying" | "swimming" | "climbing";
  };
}

/**
 * Defensive effects (AC bonuses, resistances, immunities)
 */
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defensive: {
    /** What defense is granted */
    defenseType: "ac_bonus" | "resistance" | "immunity" | "saving_throw_advantage";
    /** Numeric bonus (for AC) */
    bonus?: number;
    /** AC calculation formula (for spells like Mage Armor) */
    acFormula?: string;  // e.g., "13 + dexterity_modifier"
    /** Damage type resisted/immune to */
    damageType?: DamageType;
  };
}

/**
 * Summoning effects (creates creatures/objects)
 */
export interface SummoningEffect extends BaseEffect {
  type: "SUMMONING";
  summoning: {
    /** What is summoned */
    summonType: "creature" | "object";
    /** Identifier for what's summoned (e.g., "unseen_servant", "spectral_hand") */
    summonId: string;
    /** How many are summoned */
    quantity: number;
    /** CR limit (for summon spells that scale) */
    crLimit?: number;
  };
}

/**
 * Terrain effects (creates/modifies battlefield terrain)
 */
export interface TerrainEffect extends BaseEffect {
  type: "TERRAIN";
  terrain: {
    /** What happens to the terrain */
    terrainType: "difficult" | "obscured" | "hazardous" | "created";
    /** Size of affected area (in feet) */
    areaSize: number;
    /** Shape of terrain effect */
    shape: "sphere" | "cube" | "cylinder";
  };
}

/**
 * Utility effects (light, communication, detection, etc.)
 */
export interface UtilityEffect extends BaseEffect {
  type: "UTILITY";
  utility: {
    /** What utility is provided */
    utilityType: "light" | "communication" | "detection" | "creation" | "other";
    /** Freeform description (until we have more specific schemas) */
    description: string;
    /** Range in feet (for light radius, communication range, etc.) */
    range?: number;
  };
}
```

**Impact if not fixed**:
- ❌ **55+ spells** cannot be defined mechanically
- ❌ Combat engine cannot execute these effects
- ❌ Must parse description text for ALL non-damage/healing spells
- ❌ **Defeats the purpose of the spell system overhaul**

---

### 4. Missing `combatCost` / `explorationCost` ❌

**Current State**:
```typescript
export interface CastingTime {
  value: number;
  unit: "action" | "bonus_action" | "reaction" | "minute" | "hour" | "special";
  reactionCondition?: string;
  // NO combatCost or explorationCost
}
```

**Problem**:
- Documented in AGENT-ALPHA-TYPES.md but **not implemented**
- Combat engine must parse unit string to determine action cost
- Cannot distinguish:
  - Combat: "1 action" = one action in combat
  - Exploration: "1 action" = ~6 seconds out of combat?
- Brittle string parsing instead of structured data

**Required Fix**:
```typescript
export interface CastingTime {
  value: number;
  unit: "action" | "bonus_action" | "reaction" | "minute" | "hour" | "special";
  reactionCondition?: string;

  /**
   * Combat cost (tactical turn-based)
   * Used when spell is cast during combat rounds
   */
  combatCost?: {
    type: "action" | "bonus_action" | "reaction";
    condition?: string;  // For reactions
  };

  /**
   * Exploration cost (real-time or abstract)
   * Used when spell is cast outside combat (rituals, downtime)
   */
  explorationCost?: {
    type: "minutes" | "hours";
    duration: number;
  };
}
```

**Impact if not fixed**:
- ⚠️ Combat engine does string parsing: `castingTime.unit.includes('bonus')` (brittle)
- ⚠️ Exploration time system cannot distinguish "1 action" vs "10 minutes"
- ⚠️ Ritual spells (10 min longer) have no structured way to represent this

---

## Implementation Plan

### Step 1: Update TypeScript Types

**File**: `src/types/spells.ts`

Add the following changes:

```typescript
// Add SpellRarity type
export type SpellRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Very Rare"
  | "Legendary";

// Update Spell interface
export interface Spell {
  // ... existing fields

  // ADD THESE:
  ritual?: boolean;           // NEW: Can be cast as a ritual?
  rarity?: SpellRarity;       // NEW: For spell scrolls (defaults to Common)

  // ... rest of interface
}

// Update CastingTime interface
export interface CastingTime {
  value: number;
  unit: "action" | "bonus_action" | "reaction" | "minute" | "hour" | "special";
  reactionCondition?: string;

  // ADD THESE:
  combatCost?: {
    type: "action" | "bonus_action" | "reaction";
    condition?: string;
  };

  explorationCost?: {
    type: "minutes" | "hours";
    duration: number;
  };
}

// Update stubbed effect types (add properties as shown above)
export interface MovementEffect extends BaseEffect {
  type: "MOVEMENT";
  movement: {
    movementType: "speed" | "teleport" | "push" | "pull" | "jump";
    distance: number;
    speedType?: "walking" | "flying" | "swimming" | "climbing";
  };
}

// ... (apply fixes for DefensiveEffect, SummoningEffect, TerrainEffect, UtilityEffect)
```

**Estimated Time**: 30 minutes

---

### Step 2: Update Zod Validator

**File**: `src/validation/spellValidator.ts` (or wherever Zod schema lives)

Update Zod schema to match new TypeScript types:

```typescript
import { z } from 'zod';

const SpellRaritySchema = z.enum([
  "Common",
  "Uncommon",
  "Rare",
  "Very Rare",
  "Legendary"
]);

const CastingTimeSchema = z.object({
  value: z.number(),
  unit: z.enum(["action", "bonus_action", "reaction", "minute", "hour", "special"]),
  reactionCondition: z.string().optional(),

  // NEW:
  combatCost: z.object({
    type: z.enum(["action", "bonus_action", "reaction"]),
    condition: z.string().optional()
  }).optional(),

  explorationCost: z.object({
    type: z.enum(["minutes", "hours"]),
    duration: z.number()
  }).optional()
});

const MovementEffectSchema = z.object({
  type: z.literal("MOVEMENT"),
  movement: z.object({
    movementType: z.enum(["speed", "teleport", "push", "pull", "jump"]),
    distance: z.number(),
    speedType: z.enum(["walking", "flying", "swimming", "climbing"]).optional()
  }),
  trigger: EffectTriggerSchema,
  condition: EffectConditionSchema,
  scaling: ScalingFormulaSchema.optional()
});

// ... (apply for other effect types)

const SpellSchema = z.object({
  // ... existing fields

  // NEW:
  ritual: z.boolean().optional(),
  rarity: SpellRaritySchema.optional(),

  // ... rest of schema
});
```

**Estimated Time**: 30 minutes

---

### Step 3: Update JSON Schema

**File**: `src/systems/spells/schema/spell.schema.json`

Add new properties to JSON Schema for VSCode autocomplete:

```json
{
  "definitions": {
    "Spell": {
      "properties": {
        "ritual": {
          "type": "boolean",
          "description": "Can this spell be cast as a ritual?"
        },
        "rarity": {
          "type": "string",
          "enum": ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"],
          "description": "Spell scroll rarity (defaults to Common)"
        }
      }
    },
    "CastingTime": {
      "properties": {
        "combatCost": {
          "type": "object",
          "description": "Tactical combat cost",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["action", "bonus_action", "reaction"]
            },
            "condition": {
              "type": "string"
            }
          }
        },
        "explorationCost": {
          "type": "object",
          "description": "Out-of-combat time cost",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["minutes", "hours"]
            },
            "duration": {
              "type": "number"
            }
          }
        }
      }
    }
  }
}
```

**Estimated Time**: 20 minutes

---

### Step 4: Update Documentation

**Files to Update**:

1. **SPELL_PROPERTIES_REFERENCE.md**
   - Change `ritual` from 🔴 Missing to ✅ Required
   - Change `rarity` from 🔴 Missing to 🔵 Optional
   - Change effect stubs from ⚠️ Stubbed to ✅ Defined
   - Change combatCost/explorationCost from ⚠️ Proposed to ✅ Implemented

2. **SPELL_INTEGRATION_CHECKLIST.md**
   - Update "Critical Variables for Combat" section with new properties
   - Add ritual to metadata section
   - Add rarity to exploration section

3. **AGENT-ALPHA-TYPES.md**
   - Mark combatCost/explorationCost as ✅ Implemented (not just proposed)

**Estimated Time**: 30 minutes

---

### Step 5: Update Spell Wizard

**File**: `scripts/createSpell.ts` (or wherever wizard lives)

Add prompts for new optional fields:

```typescript
{
  type: 'confirm',
  name: 'ritual',
  message: 'Can this spell be cast as a ritual?',
  initial: false
}

{
  type: 'select',
  name: 'rarity',
  message: 'Spell scroll rarity (for exotic spells)',
  choices: ['Common (default)', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'],
  initial: 0
}

// For Movement effects:
{
  type: 'select',
  name: 'movementType',
  message: 'Type of movement effect',
  choices: ['speed', 'teleport', 'push', 'pull', 'jump']
}

// ... (similar for other effect types)
```

**Estimated Time**: 45 minutes

---

### Step 6: Regression Testing

**Test Cases**:

1. **Type Checking**
   ```bash
   npm run type-check
   # Should pass with no errors
   ```

2. **Validation**
   ```bash
   npm run validate:spells
   # Should pass for all existing spells (new fields optional)
   ```

3. **Create Test Spell**
   ```bash
   npm run spell:new
   # Create a ritual spell with Movement effect
   # Verify all new fields prompt correctly
   ```

4. **VSCode Autocomplete**
   - Open a spell JSON file
   - Type `"ritual": ` → should suggest `true` | `false`
   - Type `"rarity": ` → should suggest enum values

**Estimated Time**: 30 minutes

---

## Total Estimated Time

| Step | Time |
|------|------|
| 1. Update TypeScript Types | 30 min |
| 2. Update Zod Validator | 30 min |
| 3. Update JSON Schema | 20 min |
| 4. Update Documentation | 30 min |
| 5. Update Spell Wizard | 45 min |
| 6. Regression Testing | 30 min |
| **Total** | **2h 45min** |

---

## Acceptance Criteria

### ✅ Definition of Done

- [ ] `ritual?: boolean` added to Spell interface
- [ ] `rarity?: SpellRarity` added to Spell interface
- [ ] `combatCost` and `explorationCost` added to CastingTime interface
- [ ] MovementEffect, DefensiveEffect, SummoningEffect, TerrainEffect, UtilityEffect have defined properties
- [ ] Zod validator updated and passing
- [ ] JSON Schema updated (VSCode autocomplete works)
- [ ] Spell wizard prompts for new optional fields
- [ ] All documentation updated
- [ ] `npm run type-check` passes
- [ ] `npm run validate:spells` passes for existing spells
- [ ] Test spell created with new fields validates successfully

---

## Migration Impact

### Before This Task

**Ritual Spell Example** (Detect Magic):
```json
{
  "id": "detect-magic",
  "name": "Detect Magic",
  "level": 1,
  "description": "For the duration, you sense magic... This spell can be cast as a ritual.",
  "castingTime": {
    "value": 1,
    "unit": "action"
  }
}
```

**Problems**:
- ❌ Ritual status in description text only
- ❌ No way to represent 10-minute ritual casting time
- ❌ Ritual Casting feature must parse description

### After This Task

```json
{
  "id": "detect-magic",
  "name": "Detect Magic",
  "level": 1,
  "description": "For the duration, you sense magic within 30 feet.",
  "ritual": true,
  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
      "type": "action"
    },
    "explorationCost": {
      "type": "minutes",
      "duration": 11
    }
  }
}
```

**Benefits**:
- ✅ Ritual status machine-readable
- ✅ Both combat and exploration casting times defined
- ✅ Ritual Casting feature can filter spells by `ritual: true`
- ✅ No description text parsing needed

---

## Breaking Changes

### None - All Changes Are Additive

All new properties are **optional**:
- Existing spell JSONs continue to validate
- No migration needed for existing spells
- New spells can use new properties
- Old spells can be updated incrementally

**Migration Strategy**: Opportunistic
- Update spells as you touch them
- No need for mass migration
- Fallback behaviors handle missing fields

---

## Priority Justification

**Why This Blocks Migration**:

1. **Data Loss Prevention**
   - Without `ritual`, ~30 ritual spells lose critical data
   - Cannot add it back later without re-reading SRD

2. **Architectural Soundness**
   - Stubbed effects defeat the purpose of structured data
   - Forces text parsing fallback (the problem we're solving)

3. **One-Way Door**
   - Once we migrate 500+ spells without these fields, retrofitting is painful
   - Better to fix the schema now

4. **Low Cost, High Value**
   - Only 2-3 hours work
   - Prevents weeks of technical debt

**Recommendation**: Complete this task before ANY spell migration begins.

---

## Related Tasks

- **Blocked By**: None (can start immediately)
- **Blocks**:
  - All spell data conversion tasks
  - AGENT-BETA targeting implementation (needs Movement effects)
  - AGENT-DELTA mechanics (needs ritual field)

---

**Created**: Current session
**Author**: Claude (based on Gemini 3 Pro architecture review)
**Status**: 🔴 Ready to implement
