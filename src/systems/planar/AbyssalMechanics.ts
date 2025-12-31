
import { PlayerCharacter, GameState } from '../../types/index';
import { rollSavingThrow } from '../../utils/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/idGenerator';

export interface AbyssalCorruptionResult {
  isCorrupted: boolean;
  saveRoll: number;
  dc: number;
  effect?: AbyssalCorruptionEffect;
  message: string;
}

export interface AbyssalCorruptionEffect {
  id: string;
  name: string;
  description: string;
  mechanicalEffect: string; // Description of mechanics
  flaw: string; // Roleplaying flaw
}

export const ABYSSAL_CORRUPTION_EFFECTS: AbyssalCorruptionEffect[] = [
  {
    id: 'treachery',
    name: 'Treachery',
    description: 'The character becomes paranoid and sees betrayal everywhere.',
    mechanicalEffect: 'Disadvantage on Wisdom (Insight) checks and Charisma (Persuasion) checks.',
    flaw: 'I trust no one; betrayal is inevitable.'
  },
  {
    id: 'bloodlust',
    name: 'Bloodlust',
    description: 'An overwhelming urge to cause pain and destruction.',
    mechanicalEffect: 'Must succeed on a DC 10 Wisdom save to stop attacking a subdued or surrendering enemy.',
    flaw: 'I enjoy causing pain and crushing the weak.'
  },
  {
    id: 'consumption',
    name: 'Insatiable Hunger',
    description: 'A gnawing emptiness that can only be filled by consuming.',
    mechanicalEffect: 'Character requires double rations and water.',
    flaw: 'I must consume everything—food, drink, and power.'
  },
  {
    id: 'nihilism',
    name: 'Nihilism',
    description: 'The character sees the pointlessness of existence in the face of infinite chaos.',
    mechanicalEffect: 'Disadvantage on Death Saving Throws.',
    flaw: 'Everything will inevitably return to chaos, so why build anything?'
  }
];

export class AbyssalMechanics {
  static CORRUPTION_DC = 15;

  /**
   * Checks if a character succumbs to Abyssal Corruption after a long rest.
   * Rules: DC 15 Charisma save.
   * On failure: Character gains a random form of Abyssal Corruption.
   */
  static checkCorruption(character: PlayerCharacter): AbyssalCorruptionResult {
    // Create combat character for saving throw logic (proficiencies etc)
    const combatChar = createPlayerCombatCharacter(character);

    // Roll Charisma Save
    const save = rollSavingThrow(combatChar, 'Charisma', this.CORRUPTION_DC);

    if (save.success) {
      return {
        isCorrupted: false,
        saveRoll: save.total,
        dc: this.CORRUPTION_DC,
        message: `${character.name} resists the corrupting influence of the Abyss.`
      };
    }

    // Determine effect randomly
    const roll = Math.floor(Math.random() * ABYSSAL_CORRUPTION_EFFECTS.length);
    const effect = ABYSSAL_CORRUPTION_EFFECTS[roll];

    return {
      isCorrupted: true,
      saveRoll: save.total,
      dc: this.CORRUPTION_DC,
      effect: effect,
      message: `${character.name} is corrupted by the Abyss: ${effect.name}.`
    };
  }

  /**
   * Applies the mechanical effect of Corruption.
   * Adds the condition to the character's condition list.
   */
  static applyCorruptionEffect(gameState: GameState, characterId: string, effect: AbyssalCorruptionEffect): void {
    const char = gameState.party.find(p => p.id === characterId);
    if (!char) return;

    const conditionName = `Corruption: ${effect.name}`;

    if (!char.conditions) {
        char.conditions = [];
    }

    // Check for existing corruption of this type
    if (char.conditions.includes(conditionName)) {
        logger.info(`Character ${characterId} already has ${conditionName}, skipping application.`);
        return;
    }

    char.conditions.push(conditionName);

    // Log to system logger
    logger.info(`Applied ${conditionName} to ${characterId}`);

    // Add notification
    gameState.notifications.push({
        id: generateId(),
        message: `${char.name} gains a new flaw: "${effect.flaw}" (${effect.mechanicalEffect})`,
        type: 'error', // Corruption is bad
        duration: 8000
    });
  }

  /**
   * Clears Corruption effects from a character.
   * Typically happens after a Long Rest outside the Abyss or a Greater Restoration spell.
   */
  static clearCorruption(gameState: GameState, characterId: string): void {
      const char = gameState.party.find(p => p.id === characterId);
      if (!char || !char.conditions) return;

      const hadCorruption = char.conditions.some(c => c.startsWith('Corruption:'));

      if (hadCorruption) {
          // Remove all corruption
          char.conditions = char.conditions.filter(c => !c.startsWith('Corruption:'));

          gameState.notifications.push({
              id: generateId(),
              message: `${char.name} feels the chaotic taint of the Abyss fade from their soul.`,
              type: 'info',
              duration: 5000
          });

          logger.info(`Cleared Abyssal Corruption from ${characterId}`);
      }
  }
}
