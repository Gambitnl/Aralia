/**
 * @file src/systems/environment/hazards.ts
 * Defines natural hazards (Lava, Ice, etc.) and the logic to resolve their interactions.
 * This system allows adding mechanical danger to terrain.
 */

import { EnvironmentalHazard } from '../../types/environment';
import { CombatCharacter } from '../../types/combat';
import { DamageType } from '../../types/spells';

/**
 * Result of a hazard interaction.
 */
export interface HazardResult {
  triggered: boolean;
  damage?: {
    amount: number; // For fixed damage, or use dice roll logic elsewhere
    dice: string;
    type: DamageType;
  };
  statusEffect?: {
    name: string;
    duration: number; // rounds
    saveDC?: number;
    saveType?: 'str' | 'dex' | 'con' | 'wis' | 'int' | 'cha';
  };
  message?: string;
}

/**
 * Standard registry of Natural Hazards.
 */
export const NATURAL_HAZARDS: Record<string, EnvironmentalHazard> = {
  slippery_ice: {
    id: 'slippery_ice',
    name: 'Slippery Ice',
    description: 'Ground covered in slick ice. Creatures may fall prone.',
    trigger: 'enter',
    effectType: 'status',
    saveDC: 12, // Dex save
  },
  razorvine: {
    id: 'razorvine',
    name: 'Razorvine',
    description: 'Thorny vines that cut when moved through.',
    trigger: 'enter',
    effectType: 'damage',
    damage: {
      dice: '1d10',
      type: DamageType.Slashing
    }
  },
  lava: {
    id: 'lava',
    name: 'Lava',
    description: 'Molten rock causing extreme heat damage.',
    trigger: 'enter', // And start_turn usually, simplified here
    effectType: 'damage',
    damage: {
      dice: '6d10',
      type: DamageType.Fire
    }
  },
  quicksand: {
    id: 'quicksand',
    name: 'Quicksand',
    description: 'Deep sand that traps creatures.',
    trigger: 'enter',
    effectType: 'status',
    saveDC: 13 // Str save usually
  },
  strong_current: {
    id: 'strong_current',
    name: 'Strong Current',
    description: 'Fast moving water that drags creatures.',
    trigger: 'start_turn',
    effectType: 'movement',
    saveDC: 15
  }
};

/**
 * Evaluates a hazard trigger against a character.
 * Note: This function returns the *potential* effect.
 * The consumer (Combat Engine) is responsible for rolling saves and applying damage.
 *
 * @param hazard The hazard definition.
 * @param character The character interacting with the hazard.
 * @param triggerType The event type (e.g. 'enter', 'start_turn').
 */
export function evaluateHazard(
  hazard: EnvironmentalHazard,
  character: CombatCharacter,
  triggerType: 'enter' | 'start_turn' | 'end_turn'
): HazardResult {
  if (hazard.trigger !== triggerType) {
    return { triggered: false };
  }

  // Future: Check if character flies over non-tall hazards, etc.
  // For now, assume interaction if trigger matches.

  const result: HazardResult = {
    triggered: true,
    message: `${character.name} encounters ${hazard.name}!`
  };

  if (hazard.effectType === 'damage' && hazard.damage) {
    result.damage = {
      amount: 0, // Dice to be rolled by engine
      dice: hazard.damage.dice,
      type: hazard.damage.type
    };
  }

  if (hazard.effectType === 'status' || hazard.effectType === 'movement') {
    // Map hazard to status effect
    // Simplified mapping for the framework
    result.statusEffect = {
      name: hazard.id === 'slippery_ice' ? 'Prone' :
            hazard.id === 'quicksand' ? 'Restrained' : 'Affected',
      duration: 1,
      saveDC: hazard.saveDC,
      saveType: hazard.id === 'slippery_ice' ? 'dex' :
                hazard.id === 'quicksand' ? 'str' : 'str'
    };
  }

  return result;
}
