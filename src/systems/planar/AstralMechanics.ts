
import { GameState } from '../../types/index';
import { rollDice } from '../../utils/combatUtils';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/idGenerator';

// [Planeshifter] Implements Astral Plane mechanics including Intelligence-based movement and Psychic Wind hazards.

export type PsychicWindEffectType = 'none' | 'damage' | 'location_displacement' | 'mental_disorientation';

export interface PsychicWindResult {
  encountered: boolean;
  roll: number;
  effectType: PsychicWindEffectType;
  description: string;
  damage?: string; // e.g., "3d6"
  displacementLocation?: string; // e.g., "The Abyss"
  saveDC?: number; // DC 15 Intelligence save
}

export class AstralMechanics {
  static PSYCHIC_WIND_CHANCE_DC = 18; // Roll 1d20, on 18+ wind blows
  static INT_SAVE_DC = 15;

  /**
   * Calculates a creature's movement speed in the Astral Plane.
   * On the Astral Plane, you move by thought.
   * Speed = 3 * Intelligence Score.
   */
  static calculateAstralSpeed(intelligenceScore: number): number {
    return 3 * intelligenceScore;
  }

  /**
   * Checks for a Psychic Wind encounter.
   * Usually checked once per "travel interval" or "rest".
   */
  static checkForPsychicWind(): PsychicWindResult {
    const roll = rollDice('1d20');

    // Default result: No wind
    const result: PsychicWindResult = {
      encountered: false,
      roll: roll,
      effectType: 'none',
      description: 'The silver void is calm. No psychic winds disturb your journey.',
    };

    if (roll >= this.PSYCHIC_WIND_CHANCE_DC) {
      result.encountered = true;
      result.description = 'A howling gale of psychic energy tears through the void!';

      // Determine effect of the wind
      const effectRoll = rollDice('1d20');

      if (effectRoll <= 8) {
        // Location Displacement
        result.effectType = 'location_displacement';
        // In a full system, this would pick from known planes.
        // For now, we return a generic displacement that the UI/Game Loop must handle.
        result.displacementLocation = 'Random Color Pool';
        result.description += ' The storm throws you off course, towards a shimmering color pool of unknown origin.';
      } else if (effectRoll <= 12) {
        // Mental Disorientation (Stunned/Unconscious)
        result.effectType = 'mental_disorientation';
        result.saveDC = this.INT_SAVE_DC;
        result.description += ' The cacophony threatens to overwhelm your mind, sending you into a catatonic state.';
      } else {
        // Psychic Damage
        result.effectType = 'damage';
        result.damage = '4d6'; // 4d6 Psychic damage
        result.saveDC = this.INT_SAVE_DC;
        result.description += ' The wind batters your mind with the force of a physical blow.';
      }
    }

    return result;
  }

  /**
   * Applies the mechanical results of a Psychic Wind encounter to the GameState.
   * Note: This function logs and notifies, but damage application/teleportation
   * would typically happen in the game loop. This helper facilitates that integration.
   */
  static processPsychicWind(gameState: GameState, result: PsychicWindResult): void {
    if (!result.encountered) return;

    // Log the event
    logger.info(`Psychic Wind Encountered: ${result.description}`);

    // Notify player
    gameState.notifications.push({
      id: generateId(),
      message: `Astral Phenomenon: ${result.description}`,
      type: 'warning',
      duration: 8000
    });

    // If there was a specific effect, we might want to flag the state
    // But without a robust "TravelState" object, we rely on the caller to act on 'result'.
  }
}
