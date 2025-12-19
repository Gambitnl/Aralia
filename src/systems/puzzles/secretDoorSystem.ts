/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/secretDoorSystem.ts
 * Implements mechanics for detecting and operating secret doors.
 */

import { PlayerCharacter } from '../../types/character';
import { rollDice } from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { SecretDoor, SecretDoorResult } from './types';

/**
 * Attempts to detect a secret door in the vicinity.
 * Typically called when a character actively searches (Action: Search)
 * or passively via Passive Perception (handled by DM/Engine usually, but here for active check).
 */
export function searchForSecretDoor(
  character: PlayerCharacter,
  door: SecretDoor
): SecretDoorResult {
  if (door.state !== 'hidden') {
    return {
      success: true,
      state: door.state,
      message: 'You clearly see the outline of a secret door.'
    };
  }

  const wisMod = getAbilityModifierValue(character.stats.wisdom); // Perception

  // Proficiency Check (Simplified)
  // In a full system, we'd check 'perception' skill proficiency explicitly.
  const isProficient = character.classes.some(c =>
    c.name === 'Rogue' || c.name === 'Ranger' || c.name === 'Bard' || c.name === 'Druid'
  );
  const profBonus = isProficient ? character.proficiencyBonus : 0;

  const d20 = rollDice('1d20');
  const total = d20 + wisMod + profBonus;

  if (total >= door.detectionDC) {
    // Success!
    door.state = 'detected';
    return {
      success: true,
      state: 'detected',
      message: 'You notice a faint breeze and a hairline crack in the mortar. A secret door!',
      xpAward: 50 // Standard discovery award
    };
  }

  return {
    success: false,
    state: 'hidden',
    message: 'You search the wall but find nothing of interest.'
  };
}

/**
 * Attempts to figure out how to open a detected secret door.
 * Requires an Intelligence (Investigation) check.
 */
export function investigateMechanism(
  character: PlayerCharacter,
  door: SecretDoor
): SecretDoorResult {
  if (door.state === 'hidden') {
    return {
      success: false,
      state: 'hidden',
      message: 'You cannot investigate what you have not found.'
    };
  }

  if (door.state === 'open') {
    return {
      success: true,
      state: 'open',
      message: 'The door is already open.'
    };
  }

  // If the mechanism is "obvious" (DC 0 or very low), auto-succeed?
  // Or maybe this function is only called if the player tries to *use* it.

  const intMod = getAbilityModifierValue(character.stats.intelligence); // Investigation

  // Proficiency Check (Simplified)
  const isProficient = character.classes.some(c =>
    c.name === 'Rogue' || c.name === 'Wizard' || c.name === 'Artificer' || c.name === 'Bard'
  );
  const profBonus = isProficient ? character.proficiencyBonus : 0;

  const d20 = rollDice('1d20');
  const total = d20 + intMod + profBonus;

  if (total >= door.mechanismDC) {
    // Note: This function doesn't OPEN the door, it just reveals HOW.
    // But usually in gameplay, "I investigate" -> "You find a loose brick".
    // Then "I push the brick" -> Open.
    // For simplicity, we'll return a success message describing the mechanism.

    return {
      success: true,
      state: door.state, // State doesn't change, but knowledge does
      message: `You deduce the mechanism: ${door.mechanismDescription}`
    };
  }

  return {
    success: false,
    state: door.state,
    message: 'You see the outline of the door, but the opening mechanism eludes you.'
  };
}

/**
 * Attempts to open the secret door.
 * If the door is locked, this might fail unless unlocked.
 */
export function operateSecretDoor(
  character: PlayerCharacter,
  door: SecretDoor
): SecretDoorResult {
  if (door.state === 'hidden') {
    return {
      success: false,
      state: 'hidden',
      message: 'There is no door here that you can see.'
    };
  }

  if (door.isLocked) {
     return {
       success: false,
       state: door.state,
       message: 'The mechanism is stuck or locked. It won\'t budge.'
     };
  }

  if (door.state === 'open') {
    // Close it
    door.state = 'closed'; // or 'detected' but closed
    return {
      success: true,
      state: 'closed',
      message: 'You slide the secret panel back into place, concealing the passage.'
    };
  }

  // Open it
  door.state = 'open';
  return {
    success: true,
    state: 'open',
    message: `You activate the ${door.mechanismDescription} and the wall slides away silently.`
  };
}

// TODO(Lockpick): Integrate Secret Doors into BattleMap rendering to visually reveal them when state changes to 'detected' or 'open'.
