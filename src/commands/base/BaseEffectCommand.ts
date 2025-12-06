import { SpellCommand, CommandMetadata, CommandContext } from './SpellCommand'
import { SpellEffect } from '@/types/spells'
import { CombatState, CombatCharacter, CombatLogEntry } from '@/types/combat'
import { generateId } from '../../utils/idGenerator'

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
    // We must find the caster in the current state because state is immutable
    // and the context.caster might be stale.
    return state.characters.find(c => c.id === this.context.caster.id)!
  }

  /**
   * Helper: Get targets from state
   * Looks up targets from context in the current combat state to ensure we have up-to-date character data.
   * Returns an empty array if no targets are found or if context.targets is undefined.
   */
  protected getTargets(state: CombatState): CombatCharacter[] {
    if (!this.context?.targets || this.context.targets.length === 0) {
      return []
    }
    
    return this.context.targets
      .map(t => state.characters.find(c => c.id === t.id))
      .filter((c): c is CombatCharacter => c !== undefined)
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
