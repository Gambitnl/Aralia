
import { PlayerCharacter, GameState } from '../../types/index';
import { rollSavingThrow } from '../../utils/savingThrowUtils';
import { createPlayerCombatCharacter, rollDice } from '../../utils/combatUtils'; // Using standard factory
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/idGenerator';
import { formatDuration } from '../../utils/core';

export interface MemoryLossResult {
  lostMemory: boolean;
  saveRoll: number;
  dc: number;
  message: string;
}

export interface TimeWarpResult {
  originalMinutes: number;
  warpedMinutes: number;
  roll: number;
  description: string;
  message: string;
}

export class FeywildMechanics {
  static MEMORY_LOSS_DC = 15;

  /**
   * Checks if a character loses their memory upon leaving the Feywild.
   * Rules: DC 15 Wisdom save.
   * On failure: Character remembers nothing of their time in the Feywild.
   * On success: Memories remain but might fade like a dream.
   */
  static checkMemoryLoss(character: PlayerCharacter): MemoryLossResult {
    // Use the standard factory to convert PlayerCharacter to CombatCharacter
    // This ensures robustness against schema changes
    const combatCharLike = createPlayerCombatCharacter(character);

    const save = rollSavingThrow(combatCharLike, 'Wisdom', this.MEMORY_LOSS_DC);

    // Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm.
    // However, being native to Feywild (Eladrin) usually immune?
    // Data says natives: ['Fey', 'Elf', ...].
    // Let's assume Fey/Elves have advantage on this specifically due to affinity.
    const isNative = character.race.name.toLowerCase().includes('elf') || character.race.name.toLowerCase().includes('fey');

    let passed = save.success;
    let roll = save.total;

    if (isNative && !passed) {
        // Roll again for "advantage"
        const secondSave = rollSavingThrow(combatCharLike, 'Wisdom', this.MEMORY_LOSS_DC);
        if (secondSave.total > roll) {
            roll = secondSave.total;
            passed = secondSave.success;
        }
        logger.info(`Feywild memory check for native ${character.name}: Advantage applied.`);
    }

    if (passed) {
        return {
            lostMemory: false,
            saveRoll: roll,
            dc: this.MEMORY_LOSS_DC,
            message: `${character.name} retains their memories of the Feywild, though they feel like a vivid dream.`
        };
    } else {
         return {
            lostMemory: true,
            saveRoll: roll,
            dc: this.MEMORY_LOSS_DC,
            message: `${character.name} finds their memories of the Feywild slipping away like water through fingers.`
        };
    }
  }

  /**
   * Applies the mechanical effect of memory loss.
   * Adds a notification to the game state and logs the event.
   */
  static applyMemoryLossEffect(gameState: GameState, characterId: string): void {
      const char = gameState.party.find(p => p.id === characterId);
      if (!char) return;

      const message = `${char.name} has lost their memories of the Feywild.`;

      // Log to system logger
      logger.info(`Applying Feywild Amnesia to ${characterId}: ${message}`);

      // Add to game notifications
      gameState.notifications.push({
          id: generateId(),
          message: message,
          type: 'warning',
          duration: 5000
      });

      // In a more persistent system, we would add a 'status' or 'condition' to the character here.
      // For now, the notification serves as the immediate feedback.
  }

  /**
   * Calculates the time warp effect when leaving the Feywild.
   * Based on DMG 5e Variant Rule + Creative License.
   * @param durationMinutes The actual time spent in the Feywild (in minutes).
   */
  static calculateTimeWarp(durationMinutes: number): TimeWarpResult {
      const roll = rollDice('1d20');
      let warpedMinutes = durationMinutes;
      let description = '';

      // Conversion constants
      const MINUTES_IN_DAY = 1440;
      // TODO(lint-intent): 'MINUTES_IN_WEEK' is declared but unused, suggesting an unfinished state/behavior hook in this block.
      // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
      // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
      const _MINUTES_IN_WEEK = 10080;
      // TODO(lint-intent): 'MINUTES_IN_MONTH' is declared but unused, suggesting an unfinished state/behavior hook in this block.
      // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
      // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
      const _MINUTES_IN_MONTH = 43200; // Approx 30 days
      // TODO(lint-intent): 'MINUTES_IN_YEAR' is declared but unused, suggesting an unfinished state/behavior hook in this block.
      // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
      // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
      const _MINUTES_IN_YEAR = 525600;

      if (roll <= 10) {
          // Time Compression: Days become Minutes.
          // Ratio: 1 Day (1440 mins) -> 1 Minute.
          // Factor: 1/1440.
          // Example: Spent 1440 mins (1 day) -> Returns to find only 1 minute passed.
          warpedMinutes = Math.max(1, Math.floor(durationMinutes / MINUTES_IN_DAY));
          description = 'Time flowed strangely fast while you were gone. What felt like days was mere minutes in the material world.';
      } else if (roll <= 15) {
          // Normal Time
          warpedMinutes = durationMinutes;
          description = 'Time flowed normally.';
      } else if (roll <= 17) {
          // Time Dilation (Minor): Days become Weeks.
          // Ratio: 1 Day -> 1 Week (7 days).
          // Factor: 7.
          warpedMinutes = durationMinutes * 7;
          description = 'Time slipped away. For every day you spent there, a week has passed here.';
      } else if (roll <= 19) {
          // Time Dilation (Major): Days become Months.
          // Ratio: 1 Day -> 1 Month (30 days).
          // Factor: 30.
          warpedMinutes = durationMinutes * 30;
          description = 'The seasons have turned without you. Days became months.';
      } else {
          // Roll 20: Time Jump. Days become Years.
          // Ratio: 1 Day -> 1 Year.
          // Factor: 365.
          warpedMinutes = durationMinutes * 365;
          description = 'The world has aged. Years have passed in the blink of an eye.';
      }

      // Format for message
      const originalStr = formatDuration(durationMinutes * 60);
      const warpedStr = formatDuration(warpedMinutes * 60);

      const message = `Feywild Time Warp (Roll ${roll}): You spent ${originalStr}, but ${warpedStr} have passed on the Material Plane.`;

      return {
          originalMinutes: durationMinutes,
          warpedMinutes: warpedMinutes,
          roll: roll,
          description: description,
          message: message
      };
  }
}
