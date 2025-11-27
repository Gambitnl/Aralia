# Task 03: Command Pattern Base Architecture

**Epic:** Spell System Overhaul
**Phase:** 1 - Foundation
**Complexity:** High
**Estimated Effort:** 3 days
**Priority:** P0 (Critical)
**Dependencies:** Task 01 (TypeScript Interfaces)

---

## Objective

Implement the Command Pattern foundation for spell execution, enabling discrete, undoable effect commands that integrate with the existing AbilitySystem.

---

## Context

The current spell execution directly mutates state within `useAbilitySystem`. This task creates a flexible command architecture where each spell effect becomes an independent command that can be executed, logged, and potentially undone.

**Reference:** [SPELL_SYSTEM_RESEARCH.md § 5](../../architecture/SPELL_SYSTEM_RESEARCH.md#5-integration-strategy)

---

## Requirements

### 1. Command Interface & Base Classes
- [ ] Define `SpellCommand` interface
- [ ] Create `BaseEffectCommand` abstract class
- [ ] Implement command execution pipeline
- [ ] Add command description/logging support
- [ ] Add optional undo functionality (future-proofing)

### 2. Command Factory
- [ ] Create `SpellCommandFactory` class
- [ ] Implement effect-to-command mapping
- [ ] Handle scaling logic (slot level, character level)
- [ ] Support command chaining (hybrid spells)

### 3. Command Executor
- [ ] Create `CommandExecutor` service
- [ ] Implement sequential command execution
- [ ] Add execution context tracking
- [ ] Handle command failures gracefully

### 4. Integration with AbilitySystem
- [ ] Update `useAbilitySystem` hook to use commands
- [ ] Maintain backward compatibility with legacy spells
- [ ] Add spell slot consumption logic
- [ ] Trigger animations/VFX after execution

---

## Implementation Details

### File Structure

```
src/
├── commands/
│   ├── base/
│   │   ├── SpellCommand.ts          // Interface
│   │   ├── BaseEffectCommand.ts     // Abstract class
│   │   └── CommandExecutor.ts       // Executor service
│   ├── effects/
│   │   ├── DamageCommand.ts         // Task 04
│   │   ├── HealingCommand.ts        // Task 04
│   │   ├── StatusConditionCommand.ts// Task 05
│   │   └── [... other commands]
│   ├── factory/
│   │   └── SpellCommandFactory.ts
│   └── index.ts
```

### Core Interfaces

```typescript
// src/commands/base/SpellCommand.ts

import { CombatState } from '@/types/combat'

export interface SpellCommand {
  /**
   * Execute the command, applying its effects to the combat state
   * @returns New combat state with effects applied
   */
  execute(state: CombatState): CombatState

  /**
   * Optional: Undo the command (for turn rewind feature)
   * @returns Combat state before command was executed
   */
  undo?(state: CombatState): CombatState

  /**
   * Human-readable description for combat log
   */
  readonly description: string

  /**
   * Unique identifier for this command instance
   */
  readonly id: string

  /**
   * Command metadata for debugging/logging
   */
  readonly metadata: CommandMetadata
}

export interface CommandMetadata {
  spellId: string
  spellName: string
  casterId: string
  casterName: string
  targetIds: string[]
  effectType: string
  timestamp: number
}

export interface CommandContext {
  spellId: string
  spellName: string
  castAtLevel: number
  caster: CombatCharacter
  targets: CombatCharacter[]
  gameState: GameState
}
```

### Base Command Class

```typescript
// src/commands/base/BaseEffectCommand.ts

import { SpellCommand, CommandMetadata, CommandContext } from './SpellCommand'
import { SpellEffect } from '@/types/spells'
import { CombatState, CombatCharacter } from '@/types/combat'
import { generateId } from '@/utils/idGenerator'

export abstract class BaseEffectCommand implements SpellCommand {
  public readonly id: string
  public readonly metadata: CommandMetadata

  constructor(
    protected effect: SpellEffect,
    protected context: CommandContext
  ) {
    this.id = generateId()
    this.metadata = {
      spellId: context.spellId,
      spellName: context.spellName,
      casterId: context.caster.id,
      casterName: context.caster.name,
      targetIds: context.targets.map(t => t.id),
      effectType: effect.type,
      timestamp: Date.now()
    }
  }

  /**
   * Abstract method - each command type implements its own execution logic
   */
  abstract execute(state: CombatState): CombatState

  /**
   * Abstract method - each command provides its own description
   */
  abstract get description(): string

  /**
   * Helper: Get caster from state
   */
  protected getCaster(state: CombatState): CombatCharacter {
    return state.characters.find(c => c.id === this.context.caster.id)!
  }

  /**
   * Helper: Get targets from state
   */
  protected getTargets(state: CombatState): CombatCharacter[] {
    return this.context.targets
      .map(t => state.characters.find(c => c.id === t.id))
      .filter(Boolean) as CombatCharacter[]
  }

  /**
   * Helper: Update character in state
   */
  protected updateCharacter(
    state: CombatState,
    characterId: string,
    updates: Partial<CombatCharacter>
  ): CombatState {
    return {
      ...state,
      characters: state.characters.map(c =>
        c.id === characterId ? { ...c, ...updates } : c
      )
    }
  }

  /**
   * Helper: Add combat log entry
   */
  protected addLogEntry(
    state: CombatState,
    entry: Omit<CombatLogEntry, 'id' | 'timestamp'>
  ): CombatState {
    return {
      ...state,
      combatLog: [
        ...state.combatLog,
        {
          ...entry,
          id: generateId(),
          timestamp: Date.now()
        }
      ]
    }
  }
}
```

### Command Factory

```typescript
// src/commands/factory/SpellCommandFactory.ts

import { Spell, SpellEffect } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { SpellCommand, CommandContext } from '../base/SpellCommand'
import { DamageCommand } from '../effects/DamageCommand'
import { HealingCommand } from '../effects/HealingCommand'
// ... import other command types

export class SpellCommandFactory {
  /**
   * Create all commands for a spell
   */
  static createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: CombatState
  ): SpellCommand[] {
    const commands: SpellCommand[] = []

    const context: CommandContext = {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel,
      caster,
      targets,
      gameState
    }

    for (const effect of spell.effects) {
      // Apply scaling before creating command
      const scaledEffect = this.applyScaling(effect, spell.level, castAtLevel, caster.level)

      // Create appropriate command for effect type
      const command = this.createCommand(scaledEffect, context)
      if (command) {
        commands.push(command)
      }
    }

    return commands
  }

  /**
   * Create a single command from an effect
   */
  private static createCommand(
    effect: SpellEffect,
    context: CommandContext
  ): SpellCommand | null {
    switch (effect.type) {
      case 'DAMAGE':
        return new DamageCommand(effect, context)

      case 'HEALING':
        return new HealingCommand(effect, context)

      case 'STATUS_CONDITION':
        return new StatusConditionCommand(effect, context)

      // ... other effect types (implemented in later tasks)

      default:
        console.warn(`Unknown effect type: ${(effect as any).type}`)
        return null
    }
  }

  /**
   * Apply scaling formulas to effect
   */
  private static applyScaling(
    effect: SpellEffect,
    baseSpellLevel: number,
    castAtLevel: number,
    casterLevel: number
  ): SpellEffect {
    if (!effect.scaling) return effect

    const scaled = { ...effect }

    if (effect.scaling.type === 'slot_level') {
      const levelsAbove = castAtLevel - baseSpellLevel
      if (levelsAbove > 0) {
        scaled = this.applySlotLevelScaling(scaled, levelsAbove)
      }
    }

    if (effect.scaling.type === 'character_level') {
      scaled = this.applyCharacterLevelScaling(scaled, casterLevel, effect.scaling.levels || [])
    }

    return scaled
  }

  /**
   * Apply slot level scaling (e.g., +1d6 per level)
   */
  private static applySlotLevelScaling(
    effect: SpellEffect,
    levelsAbove: number
  ): SpellEffect {
    const bonusPerLevel = effect.scaling!.bonusPerLevel

    if (!bonusPerLevel) return effect

    // Parse bonus (e.g., "+1d6", "+2", "+1 target")
    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)
    if (diceMatch && 'damage' in effect) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)
      return {
        ...effect,
        damage: { ...effect.damage, dice: newDice }
      }
    }

    // Add more scaling types as needed
    return effect
  }

  /**
   * Apply character level scaling (cantrips)
   */
  private static applyCharacterLevelScaling(
    effect: SpellEffect,
    casterLevel: number,
    scalingLevels: number[]
  ): SpellEffect {
    const tier = scalingLevels.filter(l => casterLevel >= l).length

    if (tier === 0 || !effect.scaling?.bonusPerLevel) return effect

    // Apply tier-based scaling
    const bonusPerLevel = effect.scaling.bonusPerLevel
    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

    if (diceMatch && 'damage' in effect) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, tier)
      return {
        ...effect,
        damage: { ...effect.damage, dice: newDice }
      }
    }

    return effect
  }

  /**
   * Helper: Add dice notation (e.g., "3d6" + "1d6" * 2 = "5d6")
   */
  private static addDice(base: string, bonus: string, multiplier: number): string {
    const parseMatch = (s: string) => {
      const match = s.match(/(\d+)d(\d+)/)
      return match ? { count: parseInt(match[1]), size: parseInt(match[2]) } : null
    }

    const baseDice = parseMatch(base)
    const bonusDice = parseMatch(bonus)

    if (!baseDice || !bonusDice) return base
    if (baseDice.size !== bonusDice.size) {
      console.warn('Cannot add dice with different sizes')
      return base
    }

    const newCount = baseDice.count + (bonusDice.count * multiplier)
    return `${newCount}d${baseDice.size}`
  }
}
```

### Command Executor

```typescript
// src/commands/base/CommandExecutor.ts

import { CombatState } from '@/types/combat'
import { SpellCommand } from './SpellCommand'

export interface ExecutionResult {
  success: boolean
  finalState: CombatState
  executedCommands: SpellCommand[]
  failedCommand?: SpellCommand
  error?: Error
}

export class CommandExecutor {
  /**
   * Execute a sequence of commands
   */
  static execute(
    commands: SpellCommand[],
    initialState: CombatState
  ): ExecutionResult {
    let currentState = initialState
    const executedCommands: SpellCommand[] = []

    try {
      for (const command of commands) {
        // Execute command
        currentState = command.execute(currentState)
        executedCommands.push(command)

        // Log execution
        console.debug(`[CommandExecutor] Executed: ${command.description}`, {
          commandId: command.id,
          metadata: command.metadata
        })
      }

      return {
        success: true,
        finalState: currentState,
        executedCommands
      }
    } catch (error) {
      console.error('[CommandExecutor] Command execution failed:', error)

      return {
        success: false,
        finalState: currentState, // Return state before failed command
        executedCommands,
        failedCommand: commands[executedCommands.length],
        error: error as Error
      }
    }
  }

  /**
   * Execute commands with rollback on failure
   */
  static executeWithRollback(
    commands: SpellCommand[],
    initialState: CombatState
  ): ExecutionResult {
    const result = this.execute(commands, initialState)

    if (!result.success && result.executedCommands.length > 0) {
      // Attempt rollback
      console.warn('[CommandExecutor] Rolling back executed commands...')

      try {
        let rolledBackState = result.finalState

        for (let i = result.executedCommands.length - 1; i >= 0; i--) {
          const command = result.executedCommands[i]
          if (command.undo) {
            rolledBackState = command.undo(rolledBackState)
          }
        }

        return {
          ...result,
          finalState: rolledBackState
        }
      } catch (rollbackError) {
        console.error('[CommandExecutor] Rollback failed:', rollbackError)
        return result
      }
    }

    return result
  }
}
```

---

## Integration with useAbilitySystem

```typescript
// src/hooks/useAbilitySystem.ts (updated)

import { SpellCommandFactory } from '@/commands/factory/SpellCommandFactory'
import { CommandExecutor } from '@/commands/base/CommandExecutor'

const executeSpell = useCallback((
  spell: Spell,
  caster: CombatCharacter,
  targets: CombatCharacter[],
  castAtLevel: number
) => {
  // Validate targets
  if (!validateSpellTargets(spell, caster, targets)) {
    showError("Invalid targets")
    return
  }

  // Check spell slot
  if (!hasSpellSlot(caster, castAtLevel)) {
    showError("No spell slots available")
    return
  }

  // Create commands
  const commands = SpellCommandFactory.createCommands(
    spell,
    caster,
    targets,
    castAtLevel,
    combatState
  )

  // Execute commands
  const result = CommandExecutor.execute(commands, combatState)

  if (!result.success) {
    showError(`Spell execution failed: ${result.error?.message}`)
    return
  }

  // Consume spell slot
  let newState = consumeSpellSlot(result.finalState, caster.id, castAtLevel)

  // Update state
  dispatch({ type: 'UPDATE_COMBAT_STATE', payload: newState })

  // Trigger animations/VFX
  triggerSpellEffects(spell, targets, result.executedCommands)
}, [combatState, dispatch])
```

---

## Testing Requirements

### Unit Tests

```typescript
// src/commands/__tests__/SpellCommandFactory.test.ts

describe('SpellCommandFactory', () => {
  describe('createCommands', () => {
    it('should create commands for simple damage spell', () => {
      const fireball = createMockSpell('fireball', {
        effects: [{ type: 'DAMAGE', damage: { dice: '8d6', type: 'Fire' } }]
      })

      const commands = SpellCommandFactory.createCommands(
        fireball,
        mockCaster,
        [mockTarget],
        3,
        mockState
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(DamageCommand)
    })

    it('should apply slot level scaling', () => {
      const spell = createMockSpell('cure_wounds', {
        level: 1,
        effects: [{
          type: 'HEALING',
          healing: { dice: '1d8' },
          scaling: { type: 'slot_level', bonusPerLevel: '+1d8' }
        }]
      })

      const commands = SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [mockTarget],
        3, // Cast at level 3
        mockState
      )

      const healingCmd = commands[0] as HealingCommand
      expect(healingCmd.effect.healing.dice).toBe('3d8') // 1d8 + 2d8
    })
  })
})
```

### Integration Tests

```typescript
// src/commands/__tests__/CommandExecutor.integration.test.ts

describe('CommandExecutor Integration', () => {
  it('should execute spell from start to finish', () => {
    const spell = getSpell('fireball')
    const commands = SpellCommandFactory.createCommands(
      spell,
      caster,
      [target1, target2],
      3,
      initialState
    )

    const result = CommandExecutor.execute(commands, initialState)

    expect(result.success).toBe(true)
    expect(result.finalState.combatLog).toContainEqual(
      expect.objectContaining({ type: 'damage' })
    )
    expect(result.finalState.characters[0].stats.currentHP).toBeLessThan(
      initialState.characters[0].stats.currentHP
    )
  })
})
```

---

## Acceptance Criteria

- [ ] `SpellCommand` interface defined
- [ ] `BaseEffectCommand` abstract class implemented
- [ ] `SpellCommandFactory` creates commands correctly
- [ ] `CommandExecutor` executes commands sequentially
- [ ] Scaling logic works for slot level and character level
- [ ] Integration with `useAbilitySystem` complete
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Backward compatibility maintained
- [ ] TypeScript types fully correct

---

## Files to Create

- `src/commands/base/SpellCommand.ts`
- `src/commands/base/BaseEffectCommand.ts`
- `src/commands/base/CommandExecutor.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/index.ts`
- `src/commands/__tests__/SpellCommandFactory.test.ts`
- `src/commands/__tests__/CommandExecutor.test.ts`
- `src/commands/__tests__/CommandExecutor.integration.test.ts`

---

## Files to Modify

- `src/hooks/useAbilitySystem.ts` - Add command execution flow

---

## References

- [SPELL_SYSTEM_RESEARCH.md § 5.2](../../architecture/SPELL_SYSTEM_RESEARCH.md#52-command-structure)
- [Game Programming Patterns - Command](https://gameprogrammingpatterns.com/command.html)
- [Refactoring Guru - Command Pattern](https://refactoring.guru/design-patterns/command)

---

## Estimated Breakdown

- **Day 1:** Base interfaces, BaseEffectCommand, tests (6h)
- **Day 2:** SpellCommandFactory, scaling logic, tests (6h)
- **Day 3:** CommandExecutor, integration, end-to-end tests (6h)
- **Buffer:** 2h for debugging

**Total:** 20 hours over 3 days
