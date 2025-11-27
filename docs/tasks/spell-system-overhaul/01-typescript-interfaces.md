# Task 01: TypeScript Interfaces & Types

**Epic:** Spell System Overhaul
**Phase:** 1 - Foundation
**Complexity:** Medium
**Estimated Effort:** 2 days
**Priority:** P0 (Critical)
**Dependencies:** None

---

## Objective

Define comprehensive TypeScript interfaces and types for the new component-based spell system, including Spell structure, Effect types, Targeting system, and AI arbitration.

---

## Context

Currently, spell types are inconsistent with mixed formats (strings vs objects) and incomplete definitions. This task establishes the type foundation that all other tasks will build upon.

**Reference:** [SPELL_SYSTEM_RESEARCH.md § 3.2](../../architecture/SPELL_SYSTEM_RESEARCH.md#32-core-typescript-interfaces)

---

## Requirements

### 1. Core Spell Interface
- [ ] Define `Spell` interface with all metadata fields
- [ ] Define `SpellSchool` type (8 schools)
- [ ] Define `CastingTime` interface supporting actions, bonus actions, reactions
- [ ] Define `Range` interface for self/touch/ranged
- [ ] Define `Components` interface (V/S/M with costs)
- [ ] Define `Duration` interface (instantaneous/timed/special + concentration)

### 2. Targeting System Types
- [ ] Define `SpellTargeting` discriminated union
- [ ] Define `SingleTargeting` interface
- [ ] Define `MultiTargeting` interface (for Magic Missile)
- [ ] Define `AreaTargeting` interface
- [ ] Define `SelfTargeting` interface
- [ ] Define `HybridTargeting` interface (for Ice Knife)
- [ ] Define `TargetFilter` interface
- [ ] Define `AreaOfEffect` interface with shapes (Cone/Cube/Sphere/Line/Cylinder)

### 3. Effect System Types
- [ ] Define `SpellEffect` discriminated union (8 effect types)
- [ ] Define `BaseEffect` interface with common fields
- [ ] Define `EffectTrigger` interface (immediate/after_primary/turn-based)
- [ ] Define `EffectCondition` interface (hit/save/always)
- [ ] Define `SavingThrow` type (6 abilities)
- [ ] Define `DamageEffect` interface
- [ ] Define `DamageData` interface with dice/flat/type
- [ ] Define `DamageType` type (13 types)
- [ ] Define `HealingEffect` interface
- [ ] Define `HealingData` interface
- [ ] Define `StatusConditionEffect` interface
- [ ] Define `StatusCondition` interface
- [ ] Define `ConditionName` type (14 conditions)
- [ ] Define `StatModifier` interface
- [ ] Define `EffectDuration` interface
- [ ] Define `MovementEffect` interface (stub for now)
- [ ] Define `SummoningEffect` interface (stub for now)
- [ ] Define `TerrainEffect` interface (stub for now)
- [ ] Define `UtilityEffect` interface (stub for now)
- [ ] Define `DefensiveEffect` interface (stub for now)

### 4. Scaling System Types
- [ ] Define `ScalingFormula` interface
- [ ] Support `slot_level` scaling (for upcasting)
- [ ] Support `character_level` scaling (for cantrips)
- [ ] Support custom scaling formulas

### 5. AI Arbitration Types
- [ ] Define `ArbitrationType` type ("mechanical" | "ai_assisted" | "ai_dm")
- [ ] Define `AIContext` interface
- [ ] Define validation prompt structure
- [ ] Define player input requirements

---

## Implementation Details

### File Structure

Create new file: `src/types/spells.ts`

```typescript
// src/types/spells.ts

/**
 * Core Spell Interface
 * Represents a D&D 5e spell with complete mechanical definition
 */
export interface Spell {
  // Identity
  id: string
  name: string
  level: number  // 0 = Cantrip
  school: SpellSchool
  classes: string[]

  // Mechanics
  castingTime: CastingTime
  range: Range
  components: Components
  duration: Duration

  // Core Systems
  targeting: SpellTargeting
  effects: SpellEffect[]

  // AI Arbitration
  arbitrationType?: ArbitrationType

  // Metadata
  description: string
  higherLevels?: string
  tags?: string[]

  // Legacy support (deprecated)
  areaOfEffect?: AreaOfEffect
}

export type SpellSchool =
  | "Abjuration"
  | "Conjuration"
  | "Divination"
  | "Enchantment"
  | "Evocation"
  | "Illusion"
  | "Necromancy"
  | "Transmutation"

// ... (continue with all interfaces from research doc)
```

### Type Safety Requirements

1. **Discriminated Unions:** Use `type` field for runtime type checking
   ```typescript
   type SpellEffect =
     | { type: "DAMAGE"; damage: DamageData; ... }
     | { type: "HEALING"; healing: HealingData; ... }
     // TypeScript can narrow types based on 'type' field
   ```

2. **Optional Fields:** Mark truly optional fields with `?`
   - `material?: Material` - Can be missing
   - NOT `material: Material | undefined` - Confusing

3. **Const Enums:** Use string literal unions, not enums
   - Easier to serialize to JSON
   - Better error messages

### Validation Helpers

Create type guards for runtime validation:

```typescript
// src/types/spells.ts

export function isSpell(obj: unknown): obj is Spell {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'level' in obj &&
    'targeting' in obj &&
    'effects' in obj
  )
}

export function isDamageEffect(effect: SpellEffect): effect is DamageEffect {
  return effect.type === 'DAMAGE'
}

// ... type guards for each effect type
```

---

## Testing Requirements

### Type-Level Tests

Create `src/types/__tests__/spells.test-d.ts` using `tsd`:

```typescript
import { expectType } from 'tsd'
import { Spell, SpellEffect, DamageEffect } from '../spells'

// Test discriminated union narrowing
const effect: SpellEffect = getDamageEffect()
if (effect.type === 'DAMAGE') {
  expectType<DamageEffect>(effect)
  expectType<DamageData>(effect.damage)
}
```

### Runtime Tests

Create `src/types/__tests__/spells.test.ts`:

```typescript
import { isSpell, isDamageEffect } from '../spells'

describe('Spell Type Guards', () => {
  it('should validate spell structure', () => {
    const validSpell = {
      id: 'fireball',
      name: 'Fireball',
      level: 3,
      // ... complete spell
    }
    expect(isSpell(validSpell)).toBe(true)
  })

  it('should reject invalid spell structure', () => {
    expect(isSpell({})).toBe(false)
    expect(isSpell(null)).toBe(false)
    expect(isSpell({ id: 'test' })).toBe(false)
  })
})
```

---

## Acceptance Criteria

- [ ] All interfaces defined in `src/types/spells.ts`
- [ ] TypeScript compiles with no errors
- [ ] All discriminated unions properly typed
- [ ] Type guards implemented for all effect types
- [ ] Runtime validation tests pass
- [ ] Type-level tests pass (tsd)
- [ ] JSDoc comments for all public interfaces
- [ ] Example spell objects type-check correctly

---

## Example Output

### Example: Fireball Spell (Type-Checked)

```typescript
const fireball: Spell = {
  id: "fireball",
  name: "Fireball",
  level: 3,
  school: "Evocation",
  classes: ["Sorcerer", "Wizard"],

  castingTime: { value: 1, unit: "action" },
  range: { type: "ranged", distance: 150 },
  components: {
    verbal: true,
    somatic: true,
    material: true,
    materialDescription: "a tiny ball of bat guano and sulfur"
  },
  duration: { type: "instantaneous", concentration: false },

  targeting: {
    type: "area",
    range: 150,
    areaOfEffect: { shape: "Sphere", size: 20 },
    validTargets: { type: "creatures" },
    lineOfSight: true
  },

  effects: [{
    type: "DAMAGE",
    subtype: "direct",
    damage: { dice: "8d6", type: "Fire" },
    saveType: "Dexterity",
    saveEffect: "half",
    scaling: {
      type: "slot_level",
      bonusPerLevel: "+1d6"
    }
  }],

  description: "A bright streak flashes from your pointing finger...",
  higherLevels: "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd."
}

// TypeScript validates:
// ✅ All required fields present
// ✅ 'Evocation' is valid SpellSchool
// ✅ damage.type 'Fire' is valid DamageType
// ✅ effects[0].type narrows to DamageEffect
```

---

## Files to Create

- `src/types/spells.ts` - Main type definitions
- `src/types/__tests__/spells.test.ts` - Runtime tests
- `src/types/__tests__/spells.test-d.ts` - Type-level tests

---

## Files to Modify

- `src/types/index.ts` - Export new spell types
- `tsconfig.json` - Ensure strict type checking enabled

---

## Migration Notes

**DO NOT** modify existing spell JSON files yet. This task only creates types. Spell migration happens in Task 23.

**DO** ensure backward compatibility:
- Keep old `Spell` interface as `LegacySpell`
- New system should be able to read both formats during transition

---

## References

- [SPELL_SYSTEM_RESEARCH.md § 3.2](../../architecture/SPELL_SYSTEM_RESEARCH.md#32-core-typescript-interfaces)
- [TypeScript Handbook - Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions)
- [tsd - Type Testing](https://github.com/SamVerschueren/tsd)

---

## Estimated Breakdown

- **Day 1 Morning:** Core spell interface, targeting system (4h)
- **Day 1 Afternoon:** Effect system types (DAMAGE, HEALING, STATUS_CONDITION) (4h)
- **Day 2 Morning:** Remaining effect types, scaling, AI arbitration (3h)
- **Day 2 Afternoon:** Type guards, tests, documentation (3h)
- **Buffer:** 2h for unexpected issues

**Total:** 16 hours over 2 days
