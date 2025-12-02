# Spell System Overhaul - Parallel Modular Architecture

**Epic:** Component-Based Spell System Implementation
**Architecture Reference:** [@SPELL-SYSTEM-RESEARCH.md](../../architecture/@SPELL-SYSTEM-RESEARCH.md)
**Status:** Ready for Parallel Implementation
**Max Parallel Agents:** 5
**Estimated Timeline:** 3-4 weeks (with 5 agents)

---

## Core Principle: Module Isolation

Each agent works on a **self-contained module** with:
1. **Dedicated directory** - No file overlap
2. **Strict API contract** - Defined exports/imports
3. **Interface-first design** - Types defined upfront
4. **Independent testing** - Module can be tested in isolation
5. **Clear integration points** - Explicit wiring instructions

---

## Module Naming Contract (STRICT)

All agents MUST follow this exact naming convention:

```
src/
├── systems/
│   └── spells/                    # NEW: All spell system code
│       ├── types/                 # MODULE 1: Type Definitions
│       │   ├── index.ts           # EXPORT: Spell, SpellEffect, SpellTargeting, etc.
│       │   └── __tests__/
│       ├── targeting/             # MODULE 2: Targeting & AoE
│       │   ├── index.ts           # EXPORT: TargetResolver, AoECalculator
│       │   ├── AoECalculator.ts
│       │   ├── TargetResolver.ts
│       │   └── __tests__/
│       ├── commands/              # MODULE 3: Command Pattern
│       │   ├── index.ts           # EXPORT: SpellCommand, SpellCommandFactory
│       │   ├── SpellCommand.ts
│       │   ├── SpellCommandFactory.ts
│       │   ├── DamageCommand.ts
│       │   ├── HealingCommand.ts
│       │   ├── StatusConditionCommand.ts
│       │   ├── MovementCommand.ts
│       │   ├── SummoningCommand.ts
│       │   ├── TerrainCommand.ts
│       │   ├── UtilityCommand.ts
│       │   ├── DefensiveCommand.ts
│       │   └── __tests__/
│       ├── mechanics/             # MODULE 4: Game Mechanics
│       │   ├── index.ts           # EXPORT: SavingThrowResolver, ConcentrationTracker, etc.
│       │   ├── SavingThrowResolver.ts
│       │   ├── ConcentrationTracker.ts
│       │   ├── ResistanceCalculator.ts
│       │   ├── ScalingEngine.ts
│       │   └── __tests__/
│       ├── ai/                    # MODULE 5: AI Arbitration
│       │   ├── index.ts           # EXPORT: AISpellArbitrator, MaterialTagService
│       │   ├── AISpellArbitrator.ts
│       │   ├── MaterialTagService.ts
│       │   ├── ArbitrationCache.ts
│       │   └── __tests__/
│       ├── data/                  # Spell JSON definitions
│       │   ├── cantrips/
│       │   ├── level-1/
│       │   ├── level-2/
│       │   └── level-3/
│       └── integration/           # Integration layer with existing code
│           ├── index.ts           # EXPORT: SpellExecutor (main entry point)
│           ├── SpellExecutor.ts
│           └── __tests__/
```

---

## API Contracts (STRICT)

### Module 1: Type Definitions (`src/systems/spells/types/`)

**Agent:** Alpha
**Files to Create:** `index.ts`, type definitions
**Zero Dependencies**
**Estimated Time:** 1 day

**MUST EXPORT (from `index.ts`):**
```typescript
// Core Types
export type { Spell } from './Spell'
export type { SpellEffect, DamageEffect, HealingEffect, StatusConditionEffect, MovementEffect, SummoningEffect, TerrainEffect, UtilityEffect, DefensiveEffect } from './SpellEffect'
export type { SpellTargeting, SingleTargeting, MultiTargeting, AreaTargeting, SelfTargeting, HybridTargeting } from './SpellTargeting'
export type { AreaOfEffect, AoEShape } from './AreaOfEffect'
export type { DamageType, ConditionName, SavingThrow } from './GameMechanics'
export type { ArbitrationType, AIContext } from './AIArbitration'

// Type Guards
export { isSpell, isDamageEffect, isHealingEffect, isStatusConditionEffect } from './typeGuards'
```

**Integration Point:** All other modules import types from `'@/systems/spells/types'`

---

### Module 2: Targeting & AoE (`src/systems/spells/targeting/`)

**Agent:** Beta
**Files to Create:** `AoECalculator.ts`, `TargetResolver.ts`, `index.ts`
**Dependencies:** Module 1 (types only)
**Estimated Time:** 2 days

**MUST EXPORT (from `index.ts`):**
```typescript
import { Position, CombatCharacter } from '@/types'
import { SpellTargeting, AreaOfEffect } from '@/systems/spells/types'

/**
 * Calculates affected tiles for AoE spells
 */
export class AoECalculator {
  /**
   * Get all tiles affected by an AoE shape
   * @param center - Center point of AoE
   * @param aoe - AoE definition (shape + size)
   * @returns Array of affected tile positions
   */
  static getAffectedTiles(center: Position, aoe: AreaOfEffect): Position[]

  /**
   * Get tiles affected by a Cone
   */
  static getCone(origin: Position, direction: Position, size: number): Position[]

  /**
   * Get tiles affected by a Sphere
   */
  static getSphere(center: Position, radius: number): Position[]

  /**
   * Get tiles affected by a Cube
   */
  static getCube(corner: Position, size: number): Position[]

  /**
   * Get tiles affected by a Line
   */
  static getLine(start: Position, end: Position, width: number): Position[]

  /**
   * Get tiles affected by a Cylinder
   */
  static getCylinder(center: Position, radius: number, height: number): Position[]
}

/**
 * Resolves valid targets based on spell targeting rules
 */
export class TargetResolver {
  /**
   * Validate if a character can be targeted by this spell
   * @param targeting - Spell targeting definition
   * @param caster - Character casting the spell
   * @param target - Potential target
   * @param gameState - Current combat state
   * @returns true if target is valid
   */
  static isValidTarget(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    target: CombatCharacter,
    gameState: CombatState
  ): boolean

  /**
   * Get all valid targets in range
   */
  static getValidTargets(
    targeting: SpellTargeting,
    caster: CombatCharacter,
    gameState: CombatState
  ): CombatCharacter[]
}
```

**Integration Point:** Module 3 (Commands) will call `AoECalculator.getAffectedTiles()` and `TargetResolver.isValidTarget()`

**NO OTHER FILES MAY BE MODIFIED**

---

### Module 3: Command Pattern (`src/systems/spells/commands/`)

**Agent:** Gamma
**Files to Create:** `SpellCommand.ts`, `SpellCommandFactory.ts`, `DamageCommand.ts`, `HealingCommand.ts`, etc., `index.ts`
**Dependencies:** Module 1 (types), Module 2 (targeting)
**Estimated Time:** 3 days

**MUST EXPORT (from `index.ts`):**
```typescript
import { Spell, SpellEffect } from '@/systems/spells/types'
import { CombatCharacter, CombatState } from '@/types'

/**
 * Base interface for all spell commands
 */
export interface SpellCommand {
  /**
   * Execute the command, returning new state
   */
  execute(state: CombatState): CombatState

  /**
   * Undo the command (optional)
   */
  undo?(state: CombatState): CombatState

  /**
   * Human-readable description for combat log
   */
  readonly description: string

  /**
   * Effect type for logging/filtering
   */
  readonly effectType: string
}

/**
 * Factory for creating spell commands from spell definitions
 */
export class SpellCommandFactory {
  /**
   * Create executable commands from a spell
   * @param spell - Spell definition
   * @param caster - Character casting the spell
   * @param targets - Resolved targets
   * @param castAtLevel - Spell slot level used
   * @param gameState - Current combat state (for context)
   * @returns Array of commands to execute in sequence
   */
  static createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: CombatState
  ): SpellCommand[]
}

// Individual command classes (exported for testing)
export class DamageCommand implements SpellCommand { /* ... */ }
export class HealingCommand implements SpellCommand { /* ... */ }
export class StatusConditionCommand implements SpellCommand { /* ... */ }
export class MovementCommand implements SpellCommand { /* ... */ }
export class SummoningCommand implements SpellCommand { /* ... */ }
export class TerrainCommand implements SpellCommand { /* ... */ }
export class UtilityCommand implements SpellCommand { /* ... */ }
export class DefensiveCommand implements SpellCommand { /* ... */ }
```

**Integration Point:** Module 6 (SpellExecutor) will call `SpellCommandFactory.createCommands()` then execute each command

**NO OTHER FILES MAY BE MODIFIED**

---

### Module 4: Game Mechanics (`src/systems/spells/mechanics/`)

**Agent:** Delta
**Files to Create:** `SavingThrowResolver.ts`, `ConcentrationTracker.ts`, `ResistanceCalculator.ts`, `ScalingEngine.ts`, `index.ts`
**Dependencies:** Module 1 (types only)
**Estimated Time:** 2 days

**MUST EXPORT (from `index.ts`):**
```typescript
import { SavingThrow, DamageType, Spell } from '@/systems/spells/types'
import { CombatCharacter } from '@/types'

/**
 * Resolves saving throw outcomes
 */
export class SavingThrowResolver {
  /**
   * Roll saving throw for a character
   * @param character - Target making the save
   * @param saveType - Ability to save with (e.g., "Dexterity")
   * @param dc - Difficulty class
   * @returns { success: boolean, roll: number, total: number }
   */
  static resolveSave(
    character: CombatCharacter,
    saveType: SavingThrow,
    dc: number
  ): { success: boolean; roll: number; total: number }
}

/**
 * Tracks concentration on spells
 */
export class ConcentrationTracker {
  /**
   * Check if character is concentrating on a spell
   */
  static isConcentrating(character: CombatCharacter, gameState: CombatState): boolean

  /**
   * Start concentrating on a spell (breaks existing concentration)
   */
  static startConcentration(
    character: CombatCharacter,
    spell: Spell,
    gameState: CombatState
  ): CombatState

  /**
   * Break concentration (e.g., took damage, failed save, chose to drop)
   */
  static breakConcentration(character: CombatCharacter, gameState: CombatState): CombatState

  /**
   * Roll concentration save after taking damage
   */
  static rollConcentrationSave(
    character: CombatCharacter,
    damage: number
  ): { success: boolean; dc: number; roll: number }
}

/**
 * Applies damage resistance/vulnerability/immunity
 */
export class ResistanceCalculator {
  /**
   * Calculate final damage after resistances
   * @param baseDamage - Damage before resistances
   * @param damageType - Type of damage
   * @param target - Character taking damage
   * @returns Final damage amount
   */
  static applyResistances(
    baseDamage: number,
    damageType: DamageType,
    target: CombatCharacter
  ): number
}

/**
 * Handles spell upscaling calculations
 */
export class ScalingEngine {
  /**
   * Calculate scaled value for a spell effect
   * @param baseValue - Base dice/value (e.g., "3d6")
   * @param scaling - Scaling formula from spell definition
   * @param castAtLevel - Spell slot level used
   * @param casterLevel - Character level (for cantrips)
   * @returns Scaled value (e.g., "5d6")
   */
  static scaleEffect(
    baseValue: string,
    scaling: ScalingFormula | undefined,
    castAtLevel: number,
    casterLevel: number
  ): string
}
```

**Integration Point:** Commands (Module 3) will call these utilities during execution

**NO OTHER FILES MAY BE MODIFIED**

---

### Module 5: AI Arbitration (`src/systems/spells/ai/`)

**Agent:** Epsilon
**Files to Create:** `AISpellArbitrator.ts`, `MaterialTagService.ts`, `ArbitrationCache.ts`, `index.ts`
**Dependencies:** Module 1 (types only)
**Estimated Time:** 3 days

**MUST EXPORT (from `index.ts`):**
```typescript
import { Spell, AIContext, ArbitrationType } from '@/systems/spells/types'
import { CombatCharacter, CombatState } from '@/types'

/**
 * Result of AI arbitration
 */
export interface ArbitrationResult {
  /** Whether the spell can proceed */
  allowed: boolean
  /** AI's reasoning */
  reasoning: string
  /** Modified targets (if AI adjusted them) */
  targets?: CombatCharacter[]
  /** Modified spell parameters */
  modifiedParameters?: Record<string, any>
}

/**
 * AI service for adjudicating context-dependent spells
 */
export class AISpellArbitrator {
  /**
   * Arbitrate a spell cast
   * @param spell - Spell being cast
   * @param caster - Character casting
   * @param targets - Intended targets
   * @param gameState - Current game state
   * @returns Arbitration result
   */
  static async arbitrate(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    gameState: CombatState
  ): Promise<ArbitrationResult>

  /**
   * Route to appropriate arbitration tier
   */
  private static async routeByTier(
    arbitrationType: ArbitrationType,
    context: AIContext
  ): Promise<ArbitrationResult>
}

/**
 * Service for tagging tiles/objects with materials
 */
export class MaterialTagService {
  /**
   * Get material at a position
   */
  static getMaterialAtPosition(position: Position, gameState: GameState): Material | null

  /**
   * Tag a tile with a material
   */
  static tagTile(position: Position, material: Material, gameState: GameState): GameState
}

/**
 * Caching layer for AI validation results
 */
export class ArbitrationCache {
  /**
   * Check if a spell+context combo was recently validated
   */
  static getCached(cacheKey: string): ArbitrationResult | null

  /**
   * Cache a validation result
   */
  static setCached(cacheKey: string, result: ArbitrationResult): void
}
```

**Integration Point:** Module 6 (SpellExecutor) will call `AISpellArbitrator.arbitrate()` before executing Tier 2/3 spells

**NO OTHER FILES MAY BE MODIFIED**

---

### Module 6: Integration Layer (`src/systems/spells/integration/`)

**Agent:** Alpha (after Module 1 complete)
**Files to Create:** `SpellExecutor.ts`, `index.ts`
**Dependencies:** Modules 1-5
**Estimated Time:** 2 days

**MUST EXPORT (from `index.ts`):**
```typescript
import { Spell } from '@/systems/spells/types'
import { CombatCharacter, CombatState, Action } from '@/types'

/**
 * Result of spell execution
 */
export interface SpellExecutionResult {
  success: boolean
  newState: CombatState
  logEntries: string[]
  errors?: string[]
}

/**
 * Main entry point for spell execution
 * Orchestrates: targeting → AI arbitration → command creation → execution
 */
export class SpellExecutor {
  /**
   * Execute a spell from start to finish
   * @param spell - Spell to cast
   * @param caster - Character casting
   * @param targetPositions - User-selected target positions
   * @param castAtLevel - Spell slot level
   * @param gameState - Current state
   * @returns Execution result with new state
   */
  static async executeSpell(
    spell: Spell,
    caster: CombatCharacter,
    targetPositions: Position[],
    castAtLevel: number,
    gameState: CombatState
  ): Promise<SpellExecutionResult>
}
```

**Integration Point:** `src/hooks/useAbilitySystem.ts` will import `SpellExecutor` and call `executeSpell()`

**MUST MODIFY:** `src/hooks/useAbilitySystem.ts` (add integration code)

---

## Parallel Execution Plan (5 Agents)

### Week 1: Module Setup (No Dependencies)

| Agent   | Task                     | Files                                      | Conflicts |
|---------|--------------------------|---------------------------------------------|-----------|
| Alpha   | Module 1: Types          | `src/systems/spells/types/**`               | None      |
| Beta    | Module 2: Targeting      | `src/systems/spells/targeting/**`           | None      |
| Gamma   | Module 3: Commands Scaffold | `src/systems/spells/commands/SpellCommand.ts` | None  |
| Delta   | Module 4: Mechanics      | `src/systems/spells/mechanics/**`           | None      |
| Epsilon | Module 5: AI Scaffold    | `src/systems/spells/ai/AISpellArbitrator.ts` | None     |

**Daily Standup:** Verify exported APIs match contracts

### Week 2: Implementation

| Agent   | Task                              | Dependencies          |
|---------|-----------------------------------|-----------------------|
| Alpha   | Module 6: Integration Layer       | Modules 1-5 complete  |
| Beta    | Module 2: Complete AoE algorithms | Module 1              |
| Gamma   | Module 3: All 8 command types     | Modules 1, 2          |
| Delta   | Module 4: All mechanics systems   | Module 1              |
| Epsilon | Module 5: AI arbitration complete | Module 1              |

### Week 3: Testing & Integration

| Agent   | Task                              |
|---------|-----------------------------------|
| All     | Unit tests for their modules      |
| Alpha   | Integration tests (SpellExecutor) |
| Beta    | Convert 20 spell JSONs            |
| Gamma   | E2E spell execution tests         |
| Delta   | Performance testing               |
| Epsilon | AI spell examples (5 spells)      |

---

## Communication Protocol

### Daily Standup Format (15 min)

Each agent reports:
1. **Yesterday:** Files created/modified
2. **Today:** Files I will touch
3. **Blockers:** Waiting on exports from another module?
4. **API Changes:** Did I change any exported signatures?

### File Reservation System

Before starting work, agents MUST announce:
```
🔒 RESERVING: src/systems/spells/commands/DamageCommand.ts
📅 ETA: 4 hours
```

### Integration Checkpoints

- **End of Week 1:** All `index.ts` exports defined (may be stubs)
- **Mid Week 2:** Alpha runs integration test calling all modules
- **End of Week 2:** All unit tests passing
- **End of Week 3:** E2E tests passing, ready to merge

---

## Conflict Resolution

**If two agents need the same file:**
1. **Check if it's truly necessary** - Can you export a utility instead?
2. **Designate owner** - One agent owns the file, other submits a PR to them
3. **Split the file** - Extract overlapping code into a shared utility

**Example Conflict:**
- Gamma (Commands) needs to call dice rolling
- Delta (Mechanics) also needs dice rolling
- **Solution:** Delta creates `src/systems/spells/mechanics/DiceRoller.ts` and exports it. Gamma imports from `@/systems/spells/mechanics`

---

## Success Criteria

- [ ] Zero file conflicts between agents
- [ ] All modules export exact APIs specified above
- [ ] SpellExecutor successfully orchestrates all 5 modules
- [ ] 20 spells working end-to-end
- [ ] 80%+ unit test coverage per module
- [ ] Integration tests pass

---

**Next Steps:**
1. Agents review API contracts and confirm understanding
2. Set up daily standup schedule
3. Begin Week 1 parallel work
4. Use GitHub PRs for each module (separate branches)

**Last Updated:** November 28, 2025
