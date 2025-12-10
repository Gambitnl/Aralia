import type { Spell } from '@/types/spells'
import type { CombatCharacter, CombatState, CombatLogEntry } from '@/types'
import { DiceRoller } from './DiceRoller'

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
    gameState: CombatState
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
    // TODO: Implement in Phase 2
    console.warn('ConcentrationTracker.startConcentration not yet implemented')
    return gameState
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
    // Return early if not concentrating
    if (!character.concentratingOn) {
      return gameState
    }

    const concentration = character.concentratingOn

    // Create new characters array with updated character
    const newCharacters = gameState.characters.map(c => {
      if (c.id === character.id) {
        // Deep copy character and remove concentration
        const updatedChar = { ...c }
        delete updatedChar.concentratingOn
        return updatedChar
      }
      return c
    })

    // Filter out status effects tied to this concentration (from all characters)
    // Concentration effects could be buffs on allies or debuffs on enemies
    const effectIdsToRemove = new Set(concentration.effectIds)
    const charactersWithEffectsRemoved = newCharacters.map(c => {
        if (!c.statusEffects) return c;

        const hasEffectsToRemove = c.statusEffects.some(effect => effectIdsToRemove.has(effect.id));
        if (!hasEffectsToRemove) return c;

        return {
            ...c,
            statusEffects: c.statusEffects.filter(effect => !effectIdsToRemove.has(effect.id))
        }
    })

    // Remove active light sources tied to this spell
    const newActiveLightSources = gameState.activeLightSources.filter(
        ls => !(ls.casterId === character.id && ls.sourceSpellId === concentration.spellId)
    )

    // Add log entry
    const logEntry: CombatLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'status',
      message: `${character.name} lost concentration on ${concentration.spellName}`,
      characterId: character.id
    }

    return {
      ...gameState,
      characters: charactersWithEffectsRemoved,
      activeLightSources: newActiveLightSources,
      combatLog: [...gameState.combatLog, logEntry]
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
    const roll = DiceRoller.rollD20()

    // Constitution save
    const constitutionMod = Math.floor(((character.stats.constitution ?? 10) - 10) / 2)
    const total = roll + constitutionMod

    return {
      success: total >= dc,
      dc,
      roll
    }
  }
}
