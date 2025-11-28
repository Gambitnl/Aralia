# Agent Alpha: Type Definitions & Validation

**Module:** Type Definitions (`src/systems/spells/types/`)
**Estimated Time:** 2 days
**Dependencies:** None
**Conflicts:** ZERO - You own the `types/` directory exclusively

---

## Objective

Create comprehensive TypeScript interfaces and type definitions for the spell system, plus JSON Schema and Zod validators for data validation.

---

## Files You Will Create

### Your Directory Structure

```
src/systems/spells/
├── types/
│   ├── index.ts                    # Main export file
│   ├── Spell.ts                    # Core Spell interface
│   ├── SpellEffect.ts              # Effect discriminated union
│   ├── SpellTargeting.ts           # Targeting discriminated union
│   ├── AreaOfEffect.ts             # AoE shapes
│   ├── GameMechanics.ts            # Damage types, saving throws, conditions
│   ├── AIArbitration.ts            # AI tier types
│   ├── typeGuards.ts               # Runtime type guards
│   └── __tests__/
│       ├── typeGuards.test.ts      # Runtime validation tests
│       └── types.test-d.ts         # Type-level tests (tsd)
├── schema/
│   └── spell.schema.json           # JSON Schema for validation
└── validation/
    ├── spellValidator.ts           # Zod schema
    └── __tests__/
        └── spellValidator.test.ts
```

**FILES YOU MUST NOT TOUCH:**
- ❌ Anything in `targeting/`, `commands/`, `mechanics/`, `ai/`, `integration/`
- ❌ Any existing files outside `src/systems/spells/`

---

## API Contract (STRICT)

### File: `src/systems/spells/types/index.ts`

**YOU MUST EXPORT EXACTLY THIS:**

```typescript
// Core Types
export type { Spell } from './Spell'
export type {
  SpellEffect,
  DamageEffect,
  HealingEffect,
  StatusConditionEffect,
  MovementEffect,
  SummoningEffect,
  TerrainEffect,
  UtilityEffect,
  DefensiveEffect
} from './SpellEffect'
export type {
  SpellTargeting,
  SingleTargeting,
  MultiTargeting,
  AreaTargeting,
  SelfTargeting,
  HybridTargeting
} from './SpellTargeting'
export type { AreaOfEffect, AoEShape } from './AreaOfEffect'
export type {
  DamageType,
  ConditionName,
  SavingThrow,
  SpellSchool,
  CastingTime,
  Range,
  Components,
  Duration,
  ScalingFormula
} from './GameMechanics'
export type { ArbitrationType, AIContext } from './AIArbitration'

// Type Guards
export {
  isSpell,
  isDamageEffect,
  isHealingEffect,
  isStatusConditionEffect,
  isMovementEffect,
  isSummoningEffect,
  isTerrainEffect,
  isUtilityEffect,
  isDefensiveEffect
} from './typeGuards'
```

**WHY THIS MATTERS:**
- Other agents will import from `'@/systems/spells/types'`
- If you change export names, you break 4 other agents
- **NEVER** rename these exports without coordinating with ALL agents

---

## Implementation Details

### File: `src/systems/spells/types/Spell.ts`

```typescript
import type { SpellSchool, CastingTime, Range, Components, Duration, SpellRarity } from './GameMechanics'
import type { SpellTargeting } from './SpellTargeting'
import type { SpellEffect } from './SpellEffect'
import type { ArbitrationType } from './AIArbitration'

/**
 * Core Spell Interface
 * Represents a complete D&D 5e spell with all mechanical definitions
 */
export interface Spell {
  // Identity
  /** Unique identifier (kebab-case, e.g., "acid-splash") */
  id: string
  /** Display name (e.g., "Acid Splash") */
  name: string
  /** Spell level (0 = Cantrip, 1-9 = spell levels) */
  level: number
  /** School of magic */
  school: SpellSchool
  /** Classes that can learn this spell */
  classes: string[]
  /** Indicates if the spell can be cast as a ritual. */
  ritual?: boolean
  /** Defines the rarity of a spell, for loot tables or special scrolls. */
  rarity?: SpellRarity

  // Casting Requirements
  castingTime: CastingTime
  range: Range
  components: Components
  duration: Duration

  // Core Systems
  /** Who/where this spell targets */
  targeting: SpellTargeting
  /** What this spell does (ordered array) */
  effects: SpellEffect[]

  // AI Arbitration (optional)
  arbitrationType?: ArbitrationType

  // Metadata
  /** Flavor text describing the spell */
  description: string
  /** Describes upcast behavior (optional) */
  higherLevels?: string
  /** Searchable tags (e.g., ["damage", "fire", "aoe"]) */
  tags?: string[]
}
```

### File: `src/systems/spells/types/GameMechanics.ts`

```typescript
/**
 * D&D 5e Schools of Magic
 */
export type SpellSchool =
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Illusion'
  | 'Necromancy'
  | 'Transmutation'

/**
 * Defines the rarity of a spell, for loot tables or special scrolls.
 */
export type SpellRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

/**
 * Damage types in D&D 5e
 */
export type DamageType =
  | 'Acid'
  | 'Bludgeoning'
  | 'Cold'
  | 'Fire'
  | 'Force'
  | 'Lightning'
  | 'Necrotic'
  | 'Piercing'
  | 'Poison'
  | 'Psychic'
  | 'Radiant'
  | 'Slashing'
  | 'Thunder'

/**
 * Status conditions in D&D 5e
 */
export type ConditionName =
  | 'Blinded'
  | 'Charmed'
  | 'Deafened'
  | 'Frightened'
  | 'Grappled'
  | 'Incapacitated'
  | 'Invisible'
  | 'Paralyzed'
  | 'Petrified'
  | 'Poisoned'
  | 'Prone'
  | 'Restrained'
  | 'Stunned'
  | 'Unconscious'

/**
 * Saving throw ability types
 */
export type SavingThrowAbility =
  | 'Strength'
  | 'Dexterity'
  | 'Constitution'
  | 'Intelligence'
  | 'Wisdom'
  | 'Charisma'

/**
 * How long it takes to cast a spell
 *
 * Supports both combat time (actions/rounds) and exploration time (minutes/hours)
 */
export interface CastingTime {
  value: number
  unit: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour'
  condition?: string  // For reactions (e.g., "when you are hit")
  combatCost?: "action" | "bonus_action" | "reaction";
  explorationCost?: { value: number; unit: "minute" | "hour" };
}

/**
 * Spell range types
 */
export type Range =
  | { type: 'self' }
  | { type: 'touch' }
  | { type: 'ranged'; distance: number }

/**
 * Spell components (V/S/M)
 */
export interface Components {
  verbal: boolean
  somatic: boolean
  material: boolean
  materialDescription?: string
  materialCost?: number  // GP cost
  materialConsumed?: boolean
}

/**
 * Spell duration types
 */
export interface Duration {
  type: 'instantaneous' | 'timed' | 'special'
  value?: number  // For timed durations
  unit?: 'round' | 'minute' | 'hour' | 'day'
  concentration: boolean
}

/**
 * Scaling formula for spell effects
 */
export interface ScalingFormula {
  /** How the spell scales */
  type: 'slot_level' | 'character_level'
  /** Bonus per level (e.g., "+1d6", "+5") */
  bonusPerLevel: string
}
```

### File: `src/systems/spells/types/SpellTargeting.ts`

```typescript
import type { AreaOfEffect } from './AreaOfEffect'

/**
 * Discriminated union for spell targeting
 */
export type SpellTargeting =
  | SelfTargeting
  | SingleTargeting
  | MultiTargeting
  | AreaTargeting
  | HybridTargeting

/**
 * Self-only spells (e.g., Shield)
 */
export interface SelfTargeting {
  type: 'self'
}

/**
 * Single-target spells (e.g., Cure Wounds)
 */
export interface SingleTargeting {
  type: 'single'
  range: number
  validTargets: TargetFilter
  lineOfSight?: boolean
}

/**
 * Multi-target spells (e.g., Magic Missile)
 */
export interface MultiTargeting {
  type: 'multi'
  range: number
  maxTargets: number
  validTargets: TargetFilter
  lineOfSight?: boolean
}

/**
 * Area-of-effect spells (e.g., Fireball)
 */
export interface AreaTargeting {
  type: 'area'
  range: number  // Distance to center point
  areaOfEffect: AreaOfEffect
  validTargets: TargetFilter
  lineOfSight?: boolean
}

/**
 * Hybrid spells (e.g., Ice Knife: attack roll → area save)
 */
export interface HybridTargeting {
  type: 'hybrid'
  phases: Array<{
    targeting: SingleTargeting | AreaTargeting
    triggerCondition: 'always' | 'on_hit' | 'on_miss'
  }>
}

/**
 * Filter for valid targets
 */
export interface TargetFilter {
  type: 'creatures' | 'objects' | 'any' | 'allies' | 'enemies'
  excludeSelf?: boolean
}
```

### File: `src/systems/spells/types/AreaOfEffect.ts`

```typescript
/**
 * Area of Effect shapes
 */
export type AoEShape = 'Cone' | 'Cube' | 'Sphere' | 'Line' | 'Cylinder'

/**
 * Area of Effect definition
 */
export interface AreaOfEffect {
  shape: AoEShape
  /** Size in feet (radius for Sphere/Cylinder, length for Cone/Line, edge for Cube) */
  size: number
  /** Width for Line (default 5ft) */
  width?: number
  /** Height for Cylinder (default infinite) */
  height?: number
}
```

### File: `src/systems/spells/types/SpellEffect.ts`

```typescript
import type { DamageType, ConditionName, SavingThrowAbility, ScalingFormula, AreaOfEffect } from './GameMechanics'

/**
 * Discriminated union of all spell effect types
 */
export type SpellEffect =
  | DamageEffect
  | HealingEffect
  | StatusConditionEffect
  | MovementEffect
  | SummoningEffect
  | TerrainEffect
  | UtilityEffect
  | DefensiveEffect

/**
 * Base fields common to all effects
 */
interface BaseEffect {
  /** Unique discriminator for type narrowing */
  type: string
  /** When this effect triggers */
  trigger?: 'immediate' | 'after_primary' | 'start_of_turn' | 'end_of_turn'
  /** Condition for effect to apply */
  condition?: 'always' | 'on_hit' | 'on_save' | 'on_fail'
}

/**
 * Damage effect
 */
export interface DamageEffect extends BaseEffect {
  type: 'DAMAGE'
  subtype: 'direct' | 'area' | 'over_time' | 'triggered'
  damage: DamageData
  saveType?: SavingThrowAbility
  saveEffect?: 'none' | 'half' | 'negate'
  scaling?: ScalingFormula
}

export interface DamageData {
  /** Dice formula (e.g., "3d6", "1d8+2") */
  dice: string
  /** Flat damage to add */
  flat?: number
  /** Type of damage */
  type: DamageType
}

/**
 * Healing effect
 */
export interface HealingEffect extends BaseEffect {
  type: 'HEALING'
  healing: HealingData
  scaling?: ScalingFormula
}

export interface HealingData {
  /** Dice formula (e.g., "2d8") */
  dice: string
  /** Flat healing to add */
  flat?: number
  /** Add caster's spellcasting modifier */
  addModifier?: boolean
  /** Which stat to use for modifier */
  modifierStat?: 'spellcastingAbility'
}

/**
 * Status condition effect (e.g., Bless, Bane, Hold Person)
 */
export interface StatusConditionEffect extends BaseEffect {
  type: 'STATUS_CONDITION'
  condition: StatusCondition
  saveType?: SavingThrowAbility
  saveEffect?: 'negate' | 'end_early'
  saveTiming?: 'initial' | 'end_of_turn' | 'on_damage'
}

export interface StatusCondition {
  name: ConditionName | 'custom'
  customName?: string  // For custom conditions like "Blessed"
  duration: EffectDuration
  statModifiers?: StatModifier[]
}

export interface EffectDuration {
  type: 'rounds' | 'minutes' | 'hours' | 'until_save' | 'permanent'
  value?: number
}

export interface StatModifier {
  stat: 'AC' | 'attackRoll' | 'savingThrow' | 'abilityCheck' | 'damageRoll'
  value: string  // e.g., "+1d4", "-2", "+proficiency"
  specific?: string  // e.g., for specific saving throws
}

/**
 * An effect that alters movement (e.g., reduces speed, forces movement).
 */
export interface MovementEffect extends BaseEffect {
  type: "MOVEMENT";
  movementType: "push" | "pull" | "teleport" | "speed_change" | "stop";
  distance?: number; // for push, pull, teleport in feet
  speedChange?: {
    stat: "speed";
    value: number; // can be negative for reduction
    unit: "feet";
  };
  duration: EffectDuration;
}

/**
 * An effect that summons creatures or objects.
 */
export interface SummoningEffect extends BaseEffect {
  type: "SUMMONING";
  summonType: "creature" | "object";
  creatureId?: string; // ID from a creature database
  objectDescription?: string; // Description for summoned objects
  count: number; // How many creatures/objects are summoned
  duration: EffectDuration;
}

/**
 * An effect that creates or alters terrain.
 */
export interface TerrainEffect extends BaseEffect {
  type: "TERRAIN";
  terrainType: "difficult" | "obscuring" | "damaging" | "blocking" | "wall";
  areaOfEffect: AreaOfEffect;
  duration: EffectDuration;
  damage?: DamageData; // For damaging terrain
  wallProperties?: {
    hp: number;
    ac: number;
  };
}

/**
 * A non-combat or miscellaneous effect (e.g., creating light, communicating).
 */
export interface UtilityEffect extends BaseEffect {
  type: "UTILITY";
  utilityType:
    | "light"
    | "communication"
    | "creation"
    | "information"
    | "control"
    | "sensory"
    | "other";
  description: string;
}

/**
 * An effect that provides defensive bonuses (e.g., AC boost, resistance).
 */
export interface DefensiveEffect extends BaseEffect {
  type: "DEFENSIVE";
  defenseType: "ac_bonus" | "resistance" | "immunity" | "temporary_hp" | "advantage_on_saves";
  value?: number; // e.g., AC bonus or amount of temporary HP
  damageType?: DamageType[]; // For resistance/immunity
  savingThrow?: SavingThrowAbility[]; // For advantage on saves
  duration: EffectDuration;
}
```

### File: `src/systems/spells/types/AIArbitration.ts`

```typescript
import type { Spell } from './Spell'
import type { CombatCharacter, CombatState } from '@/types'

/**
 * Three-tier arbitration system
 */
export type ArbitrationType = 'mechanical' | 'ai_assisted' | 'ai_dm'

/**
 * Context provided to AI for arbitration
 */
export interface AIContext {
  spell: Spell
  caster: CombatCharacter
  targets: CombatCharacter[]
  gameState: CombatState
  playerInput?: string  // For Tier 3 spells
  nearbyMaterials?: Material[]
}

/**
 * Material tagging for terrain/objects
 */
export type Material = 'stone' | 'wood' | 'metal' | 'earth' | 'water' | 'ice' | 'fire'
```

### File: `src/systems/spells/types/typeGuards.ts`

```typescript
import type { Spell, SpellEffect, DamageEffect, HealingEffect, StatusConditionEffect, MovementEffect, SummoningEffect, TerrainEffect, UtilityEffect, DefensiveEffect } from './index'

/**
 * Type guard for Spell objects
 */
export function isSpell(obj: unknown): obj is Spell {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'level' in obj &&
    'school' in obj &&
    'targeting' in obj &&
    'effects' in obj &&
    Array.isArray((obj as any).effects)
  )
}

/**
 * Type guard for DamageEffect
 */
export function isDamageEffect(effect: SpellEffect): effect is DamageEffect {
  return effect.type === 'DAMAGE'
}

/**
 * Type guard for HealingEffect
 */
export function isHealingEffect(effect: SpellEffect): effect is HealingEffect {
  return effect.type === 'HEALING'
}

/**
 * Type guard for StatusConditionEffect
 */
export function isStatusConditionEffect(effect: SpellEffect): effect is StatusConditionEffect {
  return effect.type === 'STATUS_CONDITION'
}

/**
 * Type guard for MovementEffect
 */
export function isMovementEffect(effect: SpellEffect): effect is MovementEffect {
  return effect.type === 'MOVEMENT'
}

/**
 * Type guard for SummoningEffect
 */
export function isSummoningEffect(effect: SpellEffect): effect is SummoningEffect {
  return effect.type === 'SUMMONING'
}

/**
 * Type guard for TerrainEffect
 */
export function isTerrainEffect(effect: SpellEffect): effect is TerrainEffect {
  return effect.type === 'TERRAIN'
}

/**
 * Type guard for UtilityEffect
 */
export function isUtilityEffect(effect: SpellEffect): effect is UtilityEffect {
  return effect.type === 'UTILITY'
}

/**
 * Type guard for DefensiveEffect
 */
export function isDefensiveEffect(effect: SpellEffect): effect is DefensiveEffect {
  return effect.type === 'DEFENSIVE'
}
```

---

## JSON Schema & Zod Validation

See [00-DATA-VALIDATION-STRATEGY.md](00-DATA-VALIDATION-STRATEGY.md) for complete implementation.

**Your responsibilities:**
1. Create `src/systems/spells/schema/spell.schema.json` (JSON Schema)
2. Create `src/systems/spells/validation/spellValidator.ts` (Zod schema)
3. Create `scripts/validate-spells.ts` (validation script)
4. Add to `package.json`: `"validate:spells": "tsx scripts/validate-spells.ts"`

---

## Spell JSON Workflow (For Your Reference)

Other agents will create spell JSON files. They'll use:

### Creating NEW Spells

```bash
# Interactive wizard (recommended)
npm run spell:new

# Or copy template
cp src/systems/spells/data/templates/TEMPLATE-damage-spell.json \
   src/systems/spells/data/level-3/fireball.json
```

### Updating EXISTING Spells

```bash
# Edit manually (VSCode autocomplete from your JSON Schema)
code src/systems/spells/data/level-3/fireball.json

# Validate
npm run validate:spells
```

### Your Role

You provide the **validation infrastructure** that makes this workflow work:
- JSON Schema enables VSCode autocomplete
- Zod validator catches runtime errors
- Validation script prevents broken spells from being committed

**See:** [SPELL-WORKFLOW-QUICK-REF.md](SPELL-WORKFLOW-QUICK-REF.md) for complete workflow guide

---

## Testing Requirements

### Unit Tests: `src/systems/spells/types/__tests__/typeGuards.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { isSpell, isDamageEffect, isHealingEffect } from '../typeGuards'
import type { Spell, DamageEffect } from '../index'

describe('Type Guards', () => {
  describe('isSpell', () => {
    it('should validate valid spell object', () => {
      const validSpell: Spell = {
        id: 'test-spell',
        name: 'Test Spell',
        level: 1,
        school: 'Evocation',
        classes: ['Wizard'],
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'ranged', distance: 60 },
        components: { verbal: true, somatic: true, material: false },
        duration: { type: 'instantaneous', concentration: false },
        targeting: { type: 'self' },
        effects: [],
        description: 'Test'
      }

      expect(isSpell(validSpell)).toBe(true)
    })

    it('should reject invalid objects', () => {
      expect(isSpell({})).toBe(false)
      expect(isSpell(null)).toBe(false)
      expect(isSpell(undefined)).toBe(false)
      expect(isSpell({ id: 'test' })).toBe(false)
    })
  })

  describe('isDamageEffect', () => {
    it('should narrow type to DamageEffect', () => {
      const effect: DamageEffect = {
        type: 'DAMAGE',
        subtype: 'direct',
        damage: { dice: '3d6', type: 'Fire' }
      }

      if (isDamageEffect(effect)) {
        // TypeScript should know this is DamageEffect
        expect(effect.damage.type).toBe('Fire')
      }
    })
  })
})
```

### Type-Level Tests: `src/systems/spells/types/__tests__/types.test-d.ts`

```typescript
import { expectType } from 'tsd'
import type { SpellEffect, DamageEffect, HealingEffect } from '../index'
import { isDamageEffect } from '../typeGuards'

// Test discriminated union narrowing
const effect: SpellEffect = {} as SpellEffect

if (effect.type === 'DAMAGE') {
  expectType<DamageEffect>(effect)
  expectType<{ dice: string; type: string }>(effect.damage)
}

// Test type guard narrowing
if (isDamageEffect(effect)) {
  expectType<DamageEffect>(effect)
}
```

---

## Acceptance Criteria

- [ ] All type files created in `src/systems/spells/types/`
- [ ] `index.ts` exports match the API contract exactly
- [ ] TypeScript compiles with zero errors (`npm run build`)
- [ ] All type guards implemented and tested
- [ ] JSON Schema created and validates example spells
- [ ] Zod schema created and validates at runtime
- [ ] Unit tests pass (>80% coverage)
- [ ] Type-level tests pass (tsd)
- [ ] JSDoc comments on all public interfaces
- [ ] No dependencies on other modules (only `@/types` from existing codebase)

---

## Integration Points

**Other agents will use your types like this:**

```typescript
// Agent Beta (Targeting)
import type { SpellTargeting, AreaOfEffect } from '@/systems/spells/types'

// Agent Gamma (Commands)
import type { Spell, SpellEffect, DamageEffect } from '@/systems/spells/types'
import { isDamageEffect } from '@/systems/spells/types'

// Agent Delta (Mechanics)
import type { SavingThrow, DamageType } from '@/systems/spells/types'

// Agent Epsilon (AI)
import type { AIContext, ArbitrationType } from '@/systems/spells/types'
```

**DO NOT CHANGE EXPORT NAMES** without coordination!

---

## Communication Protocol

Before making breaking changes:
1. Announce in daily standup: "Considering renaming X to Y"
2. Wait for confirmation from all agents
3. Make change + update this document
4. Notify all agents when pushed

---

## Definition of "Done"

1. ✅ All files created and committed
2. ✅ Build passes (`npm run build`)
3. ✅ Tests pass (`npm test`)
4. ✅ Validation script works (`npm run validate:spells`)
5. ✅ Other agents can import types without errors
6. ✅ PR approved and merged to `task/spell-system-types` branch

---

## Estimated Timeline

- **Day 1 Morning (4h):** Core types (Spell, SpellTargeting, GameMechanics)
- **Day 1 Afternoon (4h):** Effect types (all 8 effect interfaces)
- **Day 2 Morning (3h):** Type guards, JSON Schema, Zod validation
- **Day 2 Afternoon (3h):** Tests, documentation, polish
- **Buffer:** 2h for unexpected issues

**Total:** 16 hours over 2 days

---

**Questions?** Ask in daily standup or tag @orchestrator in Discord.

**Last Updated:** November 28, 2025
