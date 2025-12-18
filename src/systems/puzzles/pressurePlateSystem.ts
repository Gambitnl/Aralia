/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/pressurePlateSystem.ts
 * Implements mechanics for pressure plates: triggering, detection, and jamming.
 */

import { PlayerCharacter } from '../../types/character';
import { rollDice } from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { PressurePlate, PressurePlateResult, PressurePlateJamResult, SizeCategory, Trap, TrapEffect } from './types';
import { hasTool, hasToolProficiency } from './lockSystem';

const SIZE_VALUES: Record<SizeCategory, number> = {
  'Tiny': 0,
  'Small': 1,
  'Medium': 2,
  'Large': 3,
  'Huge': 4,
  'Gargantuan': 5
};

/**
 * Helper to get character size.
 * Defaults to 'Medium' if not specified.
 */
function getCharacterSize(character: PlayerCharacter): SizeCategory {
  return character.ageSizeOverride || 'Medium';
}

/**
 * Checks if a character triggers a pressure plate by stepping on it.
 * @param character The character stepping on the plate.
 * @param plate The pressure plate.
 * @param linkedTrap Optional trap definition if the plate triggers a trap directly.
 */
export function checkPressurePlate(
  character: PlayerCharacter,
  plate: PressurePlate,
  linkedTrap?: Trap
): PressurePlateResult {
  if (plate.isJammed) {
    return {
      triggered: false,
      message: 'The pressure plate is jammed and does not depress.'
    };
  }

  const charSize = getCharacterSize(character);
  const charSizeVal = SIZE_VALUES[charSize];
  const minSizeVal = SIZE_VALUES[plate.minSize];

  // If character is too small/light, it doesn't trigger
  if (charSizeVal < minSizeVal) {
    return {
      triggered: false,
      message: 'You step on the plate, but you are too light to trigger it.'
    };
  }

  // Triggered!
  plate.isPressed = true;

  const result: PressurePlateResult = {
    triggered: true,
    message: 'Click. You feel the plate sink beneath your weight.'
  };

  // Handle Linked Trap
  if (plate.linkedTrapId && linkedTrap && linkedTrap.id === plate.linkedTrapId) {
    // If the trap is already disarmed, it won't fire
    if (!linkedTrap.isDisarmed) {
        result.trapEffect = linkedTrap.effect;
        result.message += ' A trap activates!';
    }
  }

  // Handle Linked Puzzle
  if (plate.linkedPuzzleId && plate.puzzleSignal) {
    result.signalSent = {
        puzzleId: plate.linkedPuzzleId,
        signal: plate.puzzleSignal
    };
  }

  // Handle Linked Lock
  if (plate.linkedLockId) {
      result.lockUpdate = {
          lockId: plate.linkedLockId,
          action: 'toggle' // Or unlock, depending on design. Defaulting to toggle for now.
      };
  }

  return result;
}

/**
 * Attempts to detect a hidden pressure plate.
 * @param character The character looking.
 * @param plate The pressure plate.
 */
export function detectPressurePlate(
  character: PlayerCharacter,
  plate: PressurePlate
): { detected: boolean; message: string } {
  if (!plate.isHidden) {
      return { detected: true, message: 'The pressure plate is plainly visible.' };
  }

  const wisMod = getAbilityModifierValue(character.stats.wisdom); // Perception
  const d20 = rollDice('1d20');
  const total = d20 + wisMod; // Add proficiency if we had skill lists accessible easily

  if (total >= plate.detectionDC) {
      return { detected: true, message: 'You notice a slightly raised stone tile.' };
  }

  return { detected: false, message: 'You see nothing out of the ordinary.' };
}

/**
 * Attempts to jam (disable) a pressure plate.
 * Requires Thieves' Tools or an Investigation check (using a shim/spike).
 */
export function jamPressurePlate(
  character: PlayerCharacter,
  plate: PressurePlate,
  inventory: any[] // Item[]
): PressurePlateJamResult {
  if (plate.isJammed) {
      return { success: true, triggered: false, message: 'It is already jammed.' };
  }
  if (plate.isPressed) {
      // Harder to jam if currently pressed? For now, assume we jam it while it's unpressed or pressed.
      // If pressed, jamming it might keep it pressed.
  }

  // Check for tools
  const hasThievesTools = hasTool(character, 'thieves-tools', inventory);

  // Roll logic
  const dexMod = getAbilityModifierValue(character.stats.dexterity);
  const intMod = getAbilityModifierValue(character.stats.intelligence);

  let roll = rollDice('1d20');
  let bonus = 0;

  if (hasThievesTools) {
      // Use Dex + PB (if proficient)
      const isProficient = hasToolProficiency(character, 'thieves-tools');
      bonus = dexMod + (isProficient ? (character.proficiencyBonus || 2) : 0);
  } else {
      // Improvising with Int (Investigation) to wedge a stone
      bonus = intMod;
  }

  const total = roll + bonus;

  if (total >= plate.jamDC) {
      plate.isJammed = true;
      return {
          success: true,
          triggered: false,
          message: 'You successfully wedge the pressure plate, preventing it from moving.'
      };
  }

  // Critical fail logic: Trigger it accidentally?
  // Margin check: Fail by 5 or more
  const margin = total - plate.jamDC;
  if (margin <= -5) {
      // Accidentally triggered!
      plate.isPressed = true;
      return {
          success: false,
          triggered: true,
          message: 'Slip! You accidentally put too much weight on the mechanism and trigger it.'
      };
  }

  return {
      success: false,
      triggered: false,
      message: 'You fail to jam the mechanism, but avoid triggering it.'
  };
}

/**
 * Handle plate reset logic.
 * Call this at the end of a turn or after interaction.
 */
export function updatePressurePlateState(plate: PressurePlate): void {
    if (plate.isJammed) return;

    if (plate.resetBehavior === 'auto_instant' && plate.isPressed) {
        // In a real game loop, we'd check if someone is STILL standing on it.
        // For this logic, we assume we check this when the person leaves.
        plate.isPressed = false;
    }
}

// TODO(Lockpick): Integrate pressure plate trigger zones into the BattleMap movement handler.
