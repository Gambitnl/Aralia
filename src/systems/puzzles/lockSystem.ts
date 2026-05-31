/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/lockSystem.ts
 * Implements mechanics for locking, picking, breaking, and trapping.
 */

import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { rollAbilityCheck } from '../../utils/character/checkUtils';
import { Lock, Trap, LockpickResult, BreakResult, TrapDetectionResult, TrapDisarmResult } from './types';

const getClasses = (character: PlayerCharacter) => character.classes ?? (character.class ? [character.class] : []);

/**
 * Checks if a character has proficiency with a specific tool.
 */
export function hasToolProficiency(character: PlayerCharacter, _toolId: string): boolean {
  // Logic simplified for MVP: Rogue class implies proficiency with Thieves' Tools.
  // Future iteration should check the character's explicit proficiency list.
  const isRogue = getClasses(character).some(c => c.name === 'Rogue');
  return isRogue;
}

/**
 * Checks if character has the required tool in their inventory.
 */
export function hasTool(character: PlayerCharacter, toolId: string, inventory: Array<Pick<Item, 'id'>>): boolean {
  return inventory.some(item => item.id === toolId);
}

/**
 * Attempts to pick a lock.
 * Requires Thieves' Tools.
 */
export function attemptLockpick(
  character: PlayerCharacter,
  lock: Lock,
  inventory: Item[]
): LockpickResult {
  if (!lock.isLocked) {
    return { success: true, margin: 0, triggeredTrap: false };
  }

  const hasThievesTools = hasTool(character, 'thieves-tools', inventory);
  if (!hasThievesTools) {
    // Cannot pick without tools
    return { success: false, margin: -10, triggeredTrap: false };
  }

  // Use rollAbilityCheck for Sleight of Hand (Dexterity)
  const result = rollAbilityCheck(character, 'Dexterity', 'Sleight of Hand');
  const total = result.total;

  const success = total >= lock.dc;
  const margin = total - lock.dc;

  // Trap triggers on failure by MORE than 5 (margin < -5).
  // E.g., DC 15. Roll 10 -> margin -5 -> Safe. Roll 9 -> margin -6 -> Trap.
  const isTrapped = Boolean(lock.isTrapped && !lock.trap?.isDisarmed);
  const triggeredTrap = isTrapped && !success && margin < -5;

  return {
    success,
    margin,
    triggeredTrap,
    trapEffect: triggeredTrap ? lock.trap?.effect : undefined
  };
}

/**
 * Attempts to break a lock or door using Strength.
 */
export function attemptBreak(
  character: PlayerCharacter,
  lock: Lock
): BreakResult {
  if (!lock.isLocked && !lock.isBroken) {
     // Even if unlocked, you can break it.
  }

  if (!lock.breakDC && !lock.breakHP) {
    // Unbreakable via simple strength
    return { success: false, margin: 0, isBroken: false };
  }

  // If breakDC is defined, it's a single check
  if (lock.breakDC) {
    const result = rollAbilityCheck(character, 'Strength', 'Athletics');
    const total = result.total;
    const success = total >= lock.breakDC;
    return {
      success,
      margin: total - lock.breakDC,
      isBroken: success
    };
  }

  return { success: false, margin: 0, isBroken: false };
}

/**
 * Attempts to detect a trap on an object.
 */
export function detectTrap(
  character: PlayerCharacter,
  trap: Trap
): TrapDetectionResult {
  if (trap.isDisarmed || trap.isTriggered) {
    return { success: true, margin: 0, trapDetected: true };
  }

  // Use the higher of Perception (Wisdom) or Investigation (Intelligence) logic
  const perceptionResult = rollAbilityCheck(character, 'Wisdom', 'Perception');
  const investigationResult = rollAbilityCheck(character, 'Intelligence', 'Investigation');

  const result = perceptionResult.total >= investigationResult.total ? perceptionResult : investigationResult;
  const total = result.total;

  const success = total >= trap.detectionDC;

  return {
    success,
    margin: total - trap.detectionDC,
    trapDetected: success
  };
}

/**
 * Attempts to disarm a known trap.
 */
export function disarmTrap(
  character: PlayerCharacter,
  trap: Trap,
  inventory: Item[]
): TrapDisarmResult {
   if (trap.isDisarmed) {
     return { success: true, margin: 0, triggeredTrap: false };
   }

   const hasThievesTools = hasTool(character, 'thieves-tools', inventory);
   if (!hasThievesTools) {
     return { success: false, margin: -10, triggeredTrap: false };
   }

   // Use rollAbilityCheck for Thieves' Tools check (usually Dexterity)
   const result = rollAbilityCheck(character, 'Dexterity', 'Sleight of Hand');
   const total = result.total;

   const success = total >= trap.disarmDC;
   const margin = total - trap.disarmDC;

   // Fail by more than 5 triggers it
   const triggeredTrap = !success && margin < -5;

   return {
     success,
     margin,
     triggeredTrap,
     trapEffect: triggeredTrap ? trap.effect : undefined
   };
}

// TODO(Lockpick): Integrate this system with the Dungeon Map generation (Submap) to place locked doors and trapped chests.
