
import { PlayerCharacter, GameState } from '../../types';
import { rollSavingThrow } from '../../utils/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/idGenerator';
// TODO(lint-intent): 'CombatCharacter' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { CombatCharacter as _CombatCharacter } from '../../types/combat';

export interface DespairCheckResult {
  hasDespair: boolean;
  saveRoll: number;
  dc: number;
  effect?: ShadowfellDespairEffect;
  message: string;
}

export interface ShadowfellDespairEffect {
  id: string; // 'apathy', 'dread', 'madness'
  name: string;
  description: string;
  mechanicalEffect: string; // Description of mechanics
}

export const DESPAIR_EFFECTS: ShadowfellDespairEffect[] = [
  {
    id: 'apathy',
    name: 'Apathy',
    description: 'The character becomes indifferent to everything, even their own survival.',
    mechanicalEffect: 'Disadvantage on initiative rolls and Wisdom (Perception) checks.'
  },
  {
    id: 'dread',
    name: 'Dread',
    description: 'A gnawing fear takes root in the character\'s heart.',
    mechanicalEffect: 'Disadvantage on all saving throws.'
  },
  {
    id: 'madness',
    name: 'Madness',
    description: 'The character\'s mind begins to fracture under the strain.',
    mechanicalEffect: 'Disadvantage on ability checks and attack rolls.'
  }
];

export class ShadowfellMechanics {
  static DESPAIR_DC = 15;

  /**
   * Checks if a character succumbs to Shadowfell Despair after a long rest.
   * Rules: DC 15 Wisdom save.
   * On failure: Roll 1d6 (simplified to 1d3 for 3 effects) to determine effect.
   * Effect lasts until the next long rest outside the Shadowfell or Calm Emotions.
   */
  static checkDespair(character: PlayerCharacter): DespairCheckResult {
    // Create combat character for saving throw logic (proficiencies etc)
    const combatChar = createPlayerCombatCharacter(character);

    // Roll Wisdom Save
    const save = rollSavingThrow(combatChar, 'Wisdom', this.DESPAIR_DC);

    if (save.success) {
      return {
        hasDespair: false,
        saveRoll: save.total,
        dc: this.DESPAIR_DC,
        message: `${character.name} resists the crushing despair of the Shadowfell.`
      };
    }

    // Determine effect
    // 1-2: Apathy, 3-4: Dread, 5-6: Madness
    const roll = Math.floor(Math.random() * 6) + 1;
    let effectIndex = 0;
    if (roll <= 2) effectIndex = 0; // Apathy
    else if (roll <= 4) effectIndex = 1; // Dread
    else effectIndex = 2; // Madness

    const effect = DESPAIR_EFFECTS[effectIndex];

    return {
      hasDespair: true,
      saveRoll: save.total,
      dc: this.DESPAIR_DC,
      effect: effect,
      message: `${character.name} succumbs to despair: ${effect.name}. ${effect.description}`
    };
  }

  /**
   * Applies the mechanical effect of Despair.
   * Adds the condition to the character's condition list if not present.
   */
  static applyDespairEffect(gameState: GameState, characterId: string, effect: ShadowfellDespairEffect): void {
    const char = gameState.party.find(p => p.id === characterId);
    if (!char) return;

    // We store the condition as a string "Despair: [Name]"
    // This allows other systems to check for it.
    const conditionName = `Despair: ${effect.name}`;

    if (!char.conditions) {
        char.conditions = [];
    }

    // Remove old despair effects first to avoid stacking different despairs?
    // 5e says "If you are already suffering a despair effect, you don't roll new one but the current one worsens" -> Simplification: Just replace or keep.
    // Let's replace for simplicity.
    char.conditions = char.conditions.filter(c => !c.startsWith('Despair:'));

    char.conditions.push(conditionName);

    // Log to system logger
    logger.info(`Applied ${conditionName} to ${characterId}`);

    // Add notification
    gameState.notifications.push({
        id: generateId(),
        message: `${char.name} is overwhelmed by ${effect.name}! (${effect.mechanicalEffect})`,
        type: 'warning',
        duration: 8000
    });
  }

  /**
   * Clears Despair effects from a character (e.g., after Long Rest outside Shadowfell).
   */
  static clearDespair(gameState: GameState, characterId: string): void {
      const char = gameState.party.find(p => p.id === characterId);
      if (!char || !char.conditions) return;

      const hasDespair = char.conditions.some(c => c.startsWith('Despair:'));
      if (hasDespair) {
          char.conditions = char.conditions.filter(c => !c.startsWith('Despair:'));
          gameState.notifications.push({
              id: generateId(),
              message: `${char.name} feels the weight of the Shadowfell lift from their heart.`,
              type: 'info',
              duration: 5000
          });
      }
  }
}
