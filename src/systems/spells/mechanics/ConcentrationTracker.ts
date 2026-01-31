import type { Spell } from '@/types/spells'
import type { CombatCharacter, CombatState, ConcentrationState } from '@/types/combat'
import { rollSavingThrow } from '@/utils/savingThrowUtils'

/**
 * Tracks concentration on spells
 *
 * D&D 5e concentration rules:
 * - Only one concentration spell active per character
 * - Broken by: taking damage, casting another concentration spell, being incapacitated, dying
 * - Concentration save DC = 10 or half damage taken (whichever is higher)
 */
export class ConcentrationTracker {
  /**
   * Check if character is concentrating on a spell
   *
   * @param character - Character to check
   * @param gameState - Current game state
   * @returns True if concentrating
   */
  static isConcentrating(
    character: CombatCharacter,
    // TODO(lint-intent): 'gameState' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    _gameState: CombatState
  ): boolean {
    return !!character.concentratingOn
  }

  /**
   * Start concentrating on a spell (breaks existing concentration)
   *
   * @param character - Character concentrating
   * @param spell - Spell to concentrate on
   * @param gameState - Current game state
   * @returns New game state with concentration started
   */
  static startConcentration(
    character: CombatCharacter,
    spell: Spell,
    gameState: CombatState
  ): CombatState {
    // RALPH: Enforces the "One Concentration Spell" rule.
    // 1. Break existing concentration if any (clean up old effects).
    let currentState = gameState
    if (character.concentratingOn) {
      currentState = this.breakConcentration(character, gameState)
    }

    // 2. Create new concentration state
    // RALPH: Data object linking the caster to the spell ID.
    const concentrationState: ConcentrationState = {
      spellId: spell.id,
      spellName: spell.name,
      spellLevel: spell.level,
      startedTurn: currentState.turnState.currentTurn,
      effectIds: [], // Will be populated when effects are applied
      canDropAsFreeAction: true
    }

    // 3. Apply to character
    // RALPH: Immutable update pattern.
    // We map over the array to produce a NEW array with the modified character.
    const newCharacters = currentState.characters.map(c => {
      if (c.id === character.id) {
        return {
          ...c,
          concentratingOn: concentrationState
        }
      }
      return c
    })

    return {
      ...currentState,
      characters: newCharacters
    }
  }

  /**
   * Break concentration (e.g., took damage, failed save, chose to drop)
   *
   * @param character - Character whose concentration breaks
   * @param gameState - Current game state
   * @returns New game state with concentration broken
   */
  static breakConcentration(
    character: CombatCharacter,
    gameState: CombatState
  ): CombatState {
    if (!character.concentratingOn) {
      return gameState
    }

    const effectIdsToRemove = new Set(character.concentratingOn.effectIds)

    // Update characters:
    // 1. Remove effects linked to this concentration
    // 2. Remove concentration from the caster
    const newCharacters = gameState.characters.map(c => {
      let newC = c

      // Remove effects if any match
      if (c.statusEffects && c.statusEffects.length > 0 && effectIdsToRemove.size > 0) {
        const remainingEffects = c.statusEffects.filter(e => !effectIdsToRemove.has(e.id))
        if (remainingEffects.length !== c.statusEffects.length) {
          newC = {
            ...newC,
            statusEffects: remainingEffects
          }
        }
      }

      // Remove concentration if it's the caster
      if (c.id === character.id) {
        newC = {
          ...newC,
          concentratingOn: undefined
        }
      }

      return newC
    })

    return {
      ...gameState,
      characters: newCharacters
    }
  }

  /**
   * Roll concentration save after taking damage
   *
   * DC = 10 or half damage taken (whichever is higher)
   *
   * @param character - Character making the save
   * @param damage - Damage taken
   * @returns Save result
   */
  static rollConcentrationSave(
    character: CombatCharacter,
    damage: number
  ): { success: boolean; dc: number; roll: number } {
    const dc = Math.max(10, Math.floor(damage / 2))

    // Delegate to centralized saving throw utility to ensure proficiency and bonuses are applied correctly
    const result = rollSavingThrow(character, 'Constitution', dc)

    return {
      success: result.success,
      dc,
      roll: result.total
    }
  }
}
