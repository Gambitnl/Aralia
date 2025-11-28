# Agent Gamma: Command Pattern & Effect Execution

**Module:** Command System (`src/systems/spells/commands/`)
**Estimated Time:** 3 days
**Dependencies:** Agent Alpha (types), Agent Beta (targeting)
**Conflicts:** ZERO - You own the `commands/` directory exclusively

---

## Objective

Implement the Command Pattern for spell effects, creating executable commands for all 8 effect types (DAMAGE, HEALING, STATUS_CONDITION, MOVEMENT, SUMMONING, TERRAIN, UTILITY, DEFENSIVE).

---

## Files You Will Create

### Your Directory Structure

```
src/systems/spells/
└── commands/
    ├── index.ts                         # Main export file
    ├── SpellCommand.ts                  # Base interface
    ├── SpellCommandFactory.ts           # Factory for creating commands
    ├── DamageCommand.ts                 # Damage effect execution
    ├── HealingCommand.ts                # Healing effect execution
    ├── StatusConditionCommand.ts        # Status conditions (Bless, Bane, etc.)
    ├── MovementCommand.ts               # Teleport, push, pull (stub for Phase 3)
    ├── SummoningCommand.ts              # Creature summoning (stub for Phase 3)
    ├── TerrainCommand.ts                # Terrain modification (stub for Phase 3)
    ├── UtilityCommand.ts                # Utility effects (stub for Phase 3)
    ├── DefensiveCommand.ts              # AC bonuses, resistance (stub for Phase 3)
    └── __tests__/
        ├── SpellCommandFactory.test.ts
        ├── DamageCommand.test.ts
        ├── HealingCommand.test.ts
        └── StatusConditionCommand.test.ts
```

**FILES YOU MUST NOT TOUCH:**
- ❌ Anything in `types/`, `targeting/`, `mechanics/`, `ai/`, `integration/`
- ❌ Any existing combat execution files (yet - Agent Alpha will integrate later)

---

## API Contract (STRICT)

### File: `src/systems/spells/commands/index.ts`

**YOU MUST EXPORT EXACTLY THIS:**

```typescript
export type { SpellCommand } from './SpellCommand'
export { SpellCommandFactory } from './SpellCommandFactory'

// Individual command classes (for testing/advanced use)
export { DamageCommand } from './DamageCommand'
export { HealingCommand } from './HealingCommand'
export { StatusConditionCommand } from './StatusConditionCommand'
export { MovementCommand } from './MovementCommand'
export { SummoningCommand } from './SummoningCommand'
export { TerrainCommand } from './TerrainCommand'
export { UtilityCommand } from './UtilityCommand'
export { DefensiveCommand } from './DefensiveCommand'
```

---

## Implementation Details

### File: `src/systems/spells/commands/SpellCommand.ts`

```typescript
import type { CombatState } from '@/types'

/**
 * Base interface for all spell commands
 *
 * Commands represent discrete, executable actions that spells perform.
 * They follow the Command Pattern for easy testing, undo, and composition.
 */
export interface SpellCommand {
  /**
   * Execute the command, returning new state
   *
   * IMPORTANT: This must be a PURE FUNCTION.
   * Do NOT mutate the input state. Return a new state object.
   *
   * @param state - Current combat state (immutable)
   * @returns New combat state with effect applied
   */
  execute(state: CombatState): CombatState

  /**
   * Undo the command (optional)
   *
   * Used for rewinding turns or canceling concentration
   *
   * @param state - Current combat state
   * @returns State with effect removed
   */
  undo?(state: CombatState): CombatState

  /**
   * Human-readable description for combat log
   *
   * @example "Fireball deals 28 fire damage to Goblin"
   * @example "Cure Wounds heals Paladin for 12 HP"
   */
  readonly description: string

  /**
   * Effect type for logging/filtering
   *
   * @example "DAMAGE"
   * @example "HEALING"
   */
  readonly effectType: string
}
```

### File: `src/systems/spells/commands/SpellCommandFactory.ts`

```typescript
import type { Spell, SpellEffect } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'
import type { SpellCommand } from './SpellCommand'
import { isDamageEffect, isHealingEffect, isStatusConditionEffect } from '@/systems/spells/types'
import { DamageCommand } from './DamageCommand'
import { HealingCommand } from './HealingCommand'
import { StatusConditionCommand } from './StatusConditionCommand'
import { MovementCommand } from './MovementCommand'
import { SummoningCommand } from './SummoningCommand'
import { TerrainCommand } from './TerrainCommand'
import { UtilityCommand } from './UtilityCommand'
import { DefensiveCommand } from './DefensiveCommand'

/**
 * Factory for creating spell commands from spell definitions
 *
 * This is the main entry point for converting a Spell object
 * into executable commands.
 */
export class SpellCommandFactory {
  /**
   * Create executable commands from a spell
   *
   * @param spell - Spell definition
   * @param caster - Character casting the spell
   * @param targets - Resolved targets (from TargetResolver)
   * @param castAtLevel - Spell slot level used
   * @param gameState - Current combat state (for context)
   * @returns Array of commands to execute in sequence
   *
   * @example
   * const commands = SpellCommandFactory.createCommands(
   *   fireballSpell,
   *   wizard,
   *   [goblin1, goblin2, goblin3],
   *   3,
   *   gameState
   * )
   *
   * // Execute each command
   * let newState = gameState
   * for (const cmd of commands) {
   *   newState = cmd.execute(newState)
   * }
   */
  static createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: CombatState
  ): SpellCommand[] {
    const commands: SpellCommand[] = []

    for (const effect of spell.effects) {
      const effectCommands = this.createCommandsForEffect(
        effect,
        spell,
        caster,
        targets,
        castAtLevel,
        gameState
      )
      commands.push(...effectCommands)
    }

    return commands
  }

  /**
   * Create commands for a single effect
   */
  private static createCommandsForEffect(
    effect: SpellEffect,
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: CombatState
  ): SpellCommand[] {
    if (isDamageEffect(effect)) {
      return this.createDamageCommands(effect, spell, caster, targets, castAtLevel)
    }

    if (isHealingEffect(effect)) {
      return this.createHealingCommands(effect, spell, caster, targets, castAtLevel)
    }

    if (isStatusConditionEffect(effect)) {
      return this.createStatusConditionCommands(effect, spell, caster, targets, gameState)
    }

    // Stubs for Phase 3
    if (effect.type === 'MOVEMENT') {
      return [new MovementCommand(effect, caster, targets)]
    }

    if (effect.type === 'SUMMONING') {
      return [new SummoningCommand(effect, caster, gameState)]
    }

    if (effect.type === 'TERRAIN') {
      return [new TerrainCommand(effect, caster, gameState)]
    }

    if (effect.type === 'UTILITY') {
      return [new UtilityCommand(effect, caster, targets)]
    }

    if (effect.type === 'DEFENSIVE') {
      return [new DefensiveCommand(effect, caster, targets)]
    }

    throw new Error(`Unknown effect type: ${(effect as any).type}`)
  }

  /**
   * Create damage commands for each target
   */
  private static createDamageCommands(
    effect: DamageEffect,
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number
  ): SpellCommand[] {
    return targets.map(target =>
      new DamageCommand(effect, spell, caster, target, castAtLevel)
    )
  }

  /**
   * Create healing commands for each target
   */
  private static createHealingCommands(
    effect: HealingEffect,
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number
  ): SpellCommand[] {
    return targets.map(target =>
      new HealingCommand(effect, spell, caster, target, castAtLevel)
    )
  }

  /**
   * Create status condition commands
   */
  private static createStatusConditionCommands(
    effect: StatusConditionEffect,
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    gameState: CombatState
  ): SpellCommand[] {
    return targets.map(target =>
      new StatusConditionCommand(effect, spell, caster, target, gameState)
    )
  }
}
```

### File: `src/systems/spells/commands/DamageCommand.ts`

```typescript
import type { SpellCommand } from './SpellCommand'
import type { DamageEffect, Spell } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'
import { ScalingEngine } from '@/systems/spells/mechanics'  // Agent Delta will provide this
import { SavingThrowResolver, ResistanceCalculator } from '@/systems/spells/mechanics'

/**
 * Executes damage effects on a target
 *
 * Handles:
 * - Dice rolling
 * - Scaling (upcasting)
 * - Saving throws (half damage, negate)
 * - Damage resistance/vulnerability/immunity
 */
export class DamageCommand implements SpellCommand {
  readonly effectType = 'DAMAGE'
  readonly description: string

  private readonly effect: DamageEffect
  private readonly spell: Spell
  private readonly caster: CombatCharacter
  private readonly target: CombatCharacter
  private readonly castAtLevel: number

  constructor(
    effect: DamageEffect,
    spell: Spell,
    caster: CombatCharacter,
    target: CombatCharacter,
    castAtLevel: number
  ) {
    this.effect = effect
    this.spell = spell
    this.caster = caster
    this.target = target
    this.castAtLevel = castAtLevel

    this.description = `${spell.name} targeting ${target.name}`
  }

  execute(state: CombatState): CombatState {
    // Calculate scaled damage
    const scaledDice = ScalingEngine.scaleEffect(
      this.effect.damage.dice,
      this.effect.scaling,
      this.castAtLevel,
      this.caster.level
    )

    // Roll damage
    const baseDamage = this.rollDamage(scaledDice, this.effect.damage.flat ?? 0)

    // Apply saving throw
    let finalDamage = baseDamage
    if (this.effect.saveType) {
      const dc = this.calculateSpellSaveDC(this.caster)
      const saveResult = SavingThrowResolver.resolveSave(
        this.target,
        this.effect.saveType,
        dc
      )

      if (saveResult.success) {
        if (this.effect.saveEffect === 'negate') {
          finalDamage = 0
        } else if (this.effect.saveEffect === 'half') {
          finalDamage = Math.floor(baseDamage / 2)
        }
      }
    }

    // Apply resistances
    finalDamage = ResistanceCalculator.applyResistances(
      finalDamage,
      this.effect.damage.type,
      this.target
    )

    // Update state immutably
    return this.applyDamageToState(state, this.target.id!, finalDamage)
  }

  /**
   * Roll damage dice
   */
  private rollDamage(dice: string, flat: number): number {
    // Parse dice string (e.g., "3d6", "1d8+2")
    const match = dice.match(/(\d+)d(\d+)(?:([+-]\d+))?/)
    if (!match) throw new Error(`Invalid dice format: ${dice}`)

    const numDice = parseInt(match[1])
    const diceSize = parseInt(match[2])
    const bonus = match[3] ? parseInt(match[3]) : 0

    let total = flat + bonus

    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1
    }

    return Math.max(0, total)
  }

  /**
   * Calculate spell save DC
   */
  private calculateSpellSaveDC(caster: CombatCharacter): number {
    // DC = 8 + proficiency + spellcasting modifier
    const proficiency = Math.floor((caster.level - 1) / 4) + 2
    const spellcastingMod = this.getSpellcastingModifier(caster)
    return 8 + proficiency + spellcastingMod
  }

  /**
   * Get spellcasting ability modifier
   */
  private getSpellcastingModifier(caster: CombatCharacter): number {
    // TODO: Get from character class (Wizard = INT, Cleric = WIS, etc.)
    // For now, use INT
    const intelligence = caster.stats.intelligence ?? 10
    return Math.floor((intelligence - 10) / 2)
  }

  /**
   * Apply damage to state immutably
   */
  private applyDamageToState(
    state: CombatState,
    targetId: string,
    damage: number
  ): CombatState {
    // Find target in state
    const playerIndex = state.playerCharacters.findIndex(c => c.id === targetId)
    if (playerIndex !== -1) {
      const newPlayers = [...state.playerCharacters]
      const target = { ...newPlayers[playerIndex] }
      target.stats = { ...target.stats }
      target.stats.currentHP = Math.max(0, (target.stats.currentHP ?? 0) - damage)
      newPlayers[playerIndex] = target

      return { ...state, playerCharacters: newPlayers }
    }

    const enemyIndex = state.enemies.findIndex(c => c.id === targetId)
    if (enemyIndex !== -1) {
      const newEnemies = [...state.enemies]
      const target = { ...newEnemies[enemyIndex] }
      target.stats = { ...target.stats }
      target.stats.currentHP = Math.max(0, (target.stats.currentHP ?? 0) - damage)
      newEnemies[enemyIndex] = target

      return { ...state, enemies: newEnemies }
    }

    return state
  }
}
```

### File: `src/systems/spells/commands/HealingCommand.ts`

```typescript
import type { SpellCommand } from './SpellCommand'
import type { HealingEffect, Spell } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'
import { ScalingEngine } from '@/systems/spells/mechanics'

/**
 * Executes healing effects on a target
 */
export class HealingCommand implements SpellCommand {
  readonly effectType = 'HEALING'
  readonly description: string

  private readonly effect: HealingEffect
  private readonly spell: Spell
  private readonly caster: CombatCharacter
  private readonly target: CombatCharacter
  private readonly castAtLevel: number

  constructor(
    effect: HealingEffect,
    spell: Spell,
    caster: CombatCharacter,
    target: CombatCharacter,
    castAtLevel: number
  ) {
    this.effect = effect
    this.spell = spell
    this.caster = caster
    this.target = target
    this.castAtLevel = castAtLevel

    this.description = `${spell.name} heals ${target.name}`
  }

  execute(state: CombatState): CombatState {
    // Calculate scaled healing
    const scaledDice = ScalingEngine.scaleEffect(
      this.effect.healing.dice,
      this.effect.scaling,
      this.castAtLevel,
      this.caster.level
    )

    // Roll healing
    let totalHealing = this.rollHealing(scaledDice, this.effect.healing.flat ?? 0)

    // Add spellcasting modifier if specified
    if (this.effect.healing.addModifier) {
      const modifier = this.getSpellcastingModifier(this.caster)
      totalHealing += modifier
    }

    // Apply healing to state
    return this.applyHealingToState(state, this.target.id!, totalHealing)
  }

  /**
   * Roll healing dice
   */
  private rollHealing(dice: string, flat: number): number {
    const match = dice.match(/(\d+)d(\d+)(?:([+-]\d+))?/)
    if (!match) throw new Error(`Invalid dice format: ${dice}`)

    const numDice = parseInt(match[1])
    const diceSize = parseInt(match[2])
    const bonus = match[3] ? parseInt(match[3]) : 0

    let total = flat + bonus

    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1
    }

    return Math.max(0, total)
  }

  private getSpellcastingModifier(caster: CombatCharacter): number {
    const intelligence = caster.stats.intelligence ?? 10
    return Math.floor((intelligence - 10) / 2)
  }

  /**
   * Apply healing to state immutably
   */
  private applyHealingToState(
    state: CombatState,
    targetId: string,
    healing: number
  ): CombatState {
    const playerIndex = state.playerCharacters.findIndex(c => c.id === targetId)
    if (playerIndex !== -1) {
      const newPlayers = [...state.playerCharacters]
      const target = { ...newPlayers[playerIndex] }
      target.stats = { ...target.stats }

      const maxHP = target.stats.maxHP ?? 0
      target.stats.currentHP = Math.min(maxHP, (target.stats.currentHP ?? 0) + healing)

      newPlayers[playerIndex] = target
      return { ...state, playerCharacters: newPlayers }
    }

    const enemyIndex = state.enemies.findIndex(c => c.id === targetId)
    if (enemyIndex !== -1) {
      const newEnemies = [...state.enemies]
      const target = { ...newEnemies[enemyIndex] }
      target.stats = { ...target.stats }

      const maxHP = target.stats.maxHP ?? 0
      target.stats.currentHP = Math.min(maxHP, (target.stats.currentHP ?? 0) + healing)

      newEnemies[enemyIndex] = target
      return { ...state, enemies: newEnemies }
    }

    return state
  }
}
```

### File: `src/systems/spells/commands/StatusConditionCommand.ts`

```typescript
import type { SpellCommand } from './SpellCommand'
import type { StatusConditionEffect, Spell } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'

/**
 * Applies status conditions to targets (e.g., Bless, Bane, Hold Person)
 *
 * NOTE: This is a STUB for Phase 1. Full implementation in Phase 2.
 */
export class StatusConditionCommand implements SpellCommand {
  readonly effectType = 'STATUS_CONDITION'
  readonly description: string

  constructor(
    private effect: StatusConditionEffect,
    private spell: Spell,
    private caster: CombatCharacter,
    private target: CombatCharacter,
    private gameState: CombatState
  ) {
    this.description = `${spell.name} applies ${effect.condition.name} to ${target.name}`
  }

  execute(state: CombatState): CombatState {
    // TODO: Implement in Phase 2 (Task 05)
    console.warn('StatusConditionCommand not yet implemented')
    return state
  }
}
```

### Stub Files (Phase 3)

Create stubs for remaining command types:

```typescript
// MovementCommand.ts, SummoningCommand.ts, etc.
import type { SpellCommand } from './SpellCommand'
import type { CombatState } from '@/types'

export class MovementCommand implements SpellCommand {
  readonly effectType = 'MOVEMENT'
  readonly description = 'Movement effect (not yet implemented)'

  constructor(private effect: any, private caster: any, private targets: any) {}

  execute(state: CombatState): CombatState {
    console.warn('MovementCommand not yet implemented (Phase 3)')
    return state
  }
}
```

---

## Spell JSON Workflow (NOT Your Responsibility)

You **don't need to create spell JSON files** - Agent Beta will handle that in Week 2.

Your job is to make sure **commands execute correctly** when given a valid spell object.

### If You Need Test Data

Use inline spell objects in your tests:

```typescript
const testSpell: Spell = {
  id: 'test-fireball',
  name: 'Test Fireball',
  level: 3,
  school: 'Evocation',
  classes: ['Wizard'],
  targeting: { type: 'area', range: 150, /* ... */ },
  effects: [{
    type: 'DAMAGE',
    subtype: 'area',
    damage: { dice: '8d6', type: 'Fire' },
    saveType: 'Dexterity',
    saveEffect: 'half'
  }],
  // ... other required fields
}
```

**See:** [SPELL-WORKFLOW-QUICK-REF.md](SPELL-WORKFLOW-QUICK-REF.md) if you're curious about the workflow

---

## Testing Requirements

### Unit Test: `src/systems/spells/commands/__tests__/DamageCommand.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { DamageCommand } from '../DamageCommand'
import type { DamageEffect, Spell } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'

describe('DamageCommand', () => {
  const mockSpell: Spell = {
    id: 'test-spell',
    name: 'Test Spell',
    level: 1,
    // ... minimal valid spell
  } as Spell

  const mockEffect: DamageEffect = {
    type: 'DAMAGE',
    subtype: 'direct',
    damage: {
      dice: '1d6',
      type: 'Fire'
    }
  }

  const mockCaster: CombatCharacter = {
    id: 'caster',
    name: 'Wizard',
    level: 5,
    stats: { intelligence: 16 }
  } as CombatCharacter

  const mockTarget: CombatCharacter = {
    id: 'target',
    name: 'Goblin',
    level: 1,
    stats: { currentHP: 20, maxHP: 20 }
  } as CombatCharacter

  it('should reduce target HP', () => {
    const command = new DamageCommand(mockEffect, mockSpell, mockCaster, mockTarget, 1)

    const initialState: CombatState = {
      playerCharacters: [],
      enemies: [mockTarget],
      // ... minimal valid state
    } as CombatState

    const newState = command.execute(initialState)

    const damagedTarget = newState.enemies[0]
    expect(damagedTarget.stats.currentHP).toBeLessThan(20)
    expect(damagedTarget.stats.currentHP).toBeGreaterThanOrEqual(0)
  })

  it('should not mutate original state', () => {
    const command = new DamageCommand(mockEffect, mockSpell, mockCaster, mockTarget, 1)

    const initialState: CombatState = {
      enemies: [{ ...mockTarget }]
    } as CombatState

    const originalHP = initialState.enemies[0].stats.currentHP

    command.execute(initialState)

    expect(initialState.enemies[0].stats.currentHP).toBe(originalHP)
  })
})
```

---

## Acceptance Criteria

- [ ] SpellCommandFactory creates commands from spell definitions
- [ ] DamageCommand executes damage with dice rolling
- [ ] HealingCommand executes healing
- [ ] All commands are PURE FUNCTIONS (no mutation)
- [ ] Saving throws integrated (uses Agent Delta's SavingThrowResolver)
- [ ] Scaling integrated (uses Agent Delta's ScalingEngine)
- [ ] Resistances integrated (uses Agent Delta's ResistanceCalculator)
- [ ] Unit tests pass (>80% coverage)
- [ ] TypeScript compiles with zero errors
- [ ] No modifications to files outside `commands/`

---

## Integration Points

**You will import from Agent Delta (Mechanics):**

```typescript
import { ScalingEngine, SavingThrowResolver, ResistanceCalculator } from '@/systems/spells/mechanics'
```

**Agent Alpha (Integration) will use your code:**

```typescript
import { SpellCommandFactory } from '@/systems/spells/commands'

const commands = SpellCommandFactory.createCommands(spell, caster, targets, level, state)
```

---

## Definition of "Done"

1. ✅ All command files created
2. ✅ Factory creates correct command types
3. ✅ Damage and Healing commands fully functional
4. ✅ Stubs for Phase 3 effects created
5. ✅ Tests pass
6. ✅ PR merged to `task/spell-system-commands` branch

---

## Estimated Timeline

- **Day 1 (8h):** SpellCommand interface, Factory, DamageCommand
- **Day 2 (8h):** HealingCommand, StatusConditionCommand, integration with Agent Delta
- **Day 3 (6h):** Stubs for Phase 3, tests, documentation, polish
- **Buffer:** 2h

**Total:** 24 hours over 3 days

---

**Last Updated:** November 28, 2025
