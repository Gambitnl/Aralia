
import { PlayerCharacter, GameState } from '../../types/index';
import { rollSavingThrow } from '../../utils/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../utils/combatUtils'; // Using standard factory
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/idGenerator';

export interface MemoryLossResult {
  lostMemory: boolean;
  saveRoll: number;
  dc: number;
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
}
