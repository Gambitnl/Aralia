/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/mechanism.ts
 * Defines the Mechanism system for physical interactions (levers, winches, etc.)
 * that are distinct from Locks (barriers) and Puzzles (intellectual challenges).
 */

import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { rollDice } from '../../utils/combatUtils';
import { Mechanism, MechanismOperationResult, MechanismState } from './types';

// ==========================================
// ⚙️ MECHANISM SYSTEM
// ==========================================

/**
 * Checks if character has the required tool.
 */
function hasTool(character: PlayerCharacter, toolId: string, inventory: Item[]): boolean {
  return inventory.some(item => item.id === toolId);
}

/**
 * Attempts to operate a physical mechanism.
 *
 * @param character The character performing the action.
 * @param mechanism The mechanism object.
 * @param inventory The character's inventory (to check for tools).
 * @returns MechanismOperationResult
 */
export function operateMechanism(
  character: PlayerCharacter,
  mechanism: Mechanism,
  inventory: Item[]
): MechanismOperationResult {

  // 1. Check if mechanism is usable
  if (mechanism.state === 'jammed') {
    return {
      success: false,
      newState: 'jammed',
      message: "It's jammed tight and won't budge."
    };
  }

  if (mechanism.state === 'broken') {
    return {
      success: false,
      newState: 'broken',
      message: "It's broken beyond repair."
    };
  }

  if (mechanism.state === 'locked') {
    return {
      success: false,
      newState: 'locked',
      message: "It's locked in place."
    };
  }

  // 2. Check Tool Requirements
  if (mechanism.requiredToolId) {
    if (!hasTool(character, mechanism.requiredToolId, inventory)) {
      return {
        success: false,
        newState: mechanism.state,
        message: `You need a specific tool (${mechanism.requiredToolId}) to operate this.`
      };
    }
  }

  // 3. Perform Ability Check (if required)
  if (mechanism.requiresCheck && mechanism.checkAbility && mechanism.checkDC) {
    // Map AbilityScoreName to property on character.stats
    // Note: getAbilityModifierValue expects the raw score number
    const abilityName = mechanism.checkAbility.toLowerCase() as keyof typeof character.stats;
    const score = character.stats[abilityName];
    const mod = getAbilityModifierValue(score);

    // TODO: Add proficiency bonus if we implement relevant skills (e.g. Athletics)
    const d20 = rollDice('1d20');
    const total = d20 + mod;

    if (total < mechanism.checkDC) {
      return {
        success: false,
        newState: mechanism.state,
        message: `You strain against it, but it doesn't move. (Rolled ${total} vs DC ${mechanism.checkDC})`
      };
    }
  }

  // 4. Update State (Toggle logic for simple mechanisms)
  let newState: MechanismState = mechanism.state;
  let message = "You operate the mechanism.";

  if (mechanism.state === 'active') {
    newState = 'inactive';
    message = `You deactivate the ${mechanism.name}.`;
  } else if (mechanism.state === 'inactive') {
    newState = 'active';
    message = `You activate the ${mechanism.name}.`;
  }

  // TODO(Lockpick): Connect this mechanism system to the Submap tile interaction layer so players can click levers in the dungeon.

  return {
    success: true,
    newState,
    message,
    triggeredEventId: mechanism.linkedEventId,
    noiseLevel: mechanism.noiseLevel || 'loud'
  };
}
