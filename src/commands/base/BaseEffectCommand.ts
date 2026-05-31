import { SpellCommand, CommandMetadata, CommandContext } from './SpellCommand'
import { SpellEffect } from '@/types/spells'
import { CombatState, CombatCharacter, CombatLogEntry } from '@/types/combat'
import { generateId } from '../../utils/idGenerator'

/**
 * Abstract base class for all spell effect commands.
 *
 * Implements the Command Pattern to encapsulate spell effects as objects that modify CombatState.
 * This class provides standardized helper methods for common operations like retrieving
 * fresh character data, updating state immutably, and writing to the combat log.
 *
 * Subclasses must implement `execute(state)` to define specific effect logic (damage, healing, etc.).
 *
 * @see SpellCommand for the interface definition.
 */
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
   * Executes the command logic against the current combat state.
   * Must be implemented by concrete subclasses to apply specific effects.
   *
   * @param state - The current immutable CombatState.
   * @returns A new CombatState with the effects applied.
   */
  abstract execute(state: CombatState): CombatState

  /**
   * Returns a human-readable description of what this command does.
   * Used for debugging and potential UI previews.
   */
  abstract get description(): string

  /**
   * Retrieves the up-to-date Caster object from the current state.
   *
   * @remarks
   * Always use this instead of `this.context.caster` inside `execute()`.
   * The context object contains the caster state *at the time of command creation*,
   * which may be stale if previous commands in the chain have modified the caster
   * (e.g. costs paid, damage taken).
   *
   * @param state - The current combat state.
   * @returns The fresh CombatCharacter object for the caster.
   */
  protected getCaster(state: CombatState): CombatCharacter {
    // We must find the caster in the current state because state is immutable
    // and the context.caster might be stale.
    return state.characters.find(c => c.id === this.context.caster.id)!
  }

  /**
   * Retrieves the list of up-to-date Target objects from the current state.
   *
   * @remarks
   * Always use this instead of `this.context.targets` inside `execute()`.
   * Ensures that effects are calculated against the target's current values (HP, position, etc.),
   * which may have changed due to previous effects in the same chain.
   *
   * @param state - The current combat state.
   * @returns Array of fresh CombatCharacter objects for all valid targets.
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
   * Helper to immutably update a character in the combat state.
   *
   * @param state - The current combat state.
   * @param characterId - The ID of the character to update.
   * @param updates - Partial object containing the properties to change.
   * @returns A new CombatState with the character updated.
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
   * Helper to append an entry to the combat log.
   * Automatically generates an ID and timestamp for the entry.
   *
   * @param state - The current combat state.
   * @param entry - The log entry data (excluding id and timestamp).
   * @returns A new CombatState with the log entry added.
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
