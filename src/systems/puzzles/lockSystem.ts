// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 02:03:16
 * Dependents: components/puzzles/LockpickingModal.tsx, systems/puzzles/pressurePlateSystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/lockSystem.ts
 * Implements mechanics for locking, picking, breaking, and trapping.
 */

import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { rollDice } from '../dice/rollers';
import { getAbilityModifierValue } from '../../utils/character';
import { getPuzzleCharacterStats } from './characterAbilityBridge';
import { Lock, Trap, LockpickResult, KeyUnlockResult, BreakResult, TrapDetectionResult, TrapDisarmResult } from './types';

const getClasses = (character: PlayerCharacter) => character.classes ?? (character.class ? [character.class] : []);

/**
 * Checks if a character has proficiency with a specific tool.
 */
/**
 * Uses the d20 the caller already rolled, or rolls one.
 *
 * WHY (agora-f821.1): the lockpicking modal used to show the player an animated
 * d20 and then let this system roll a SECOND, unrelated d20 to decide the
 * outcome. Callers that show a die now pass its face in, so the die the player
 * watched is the die that resolves. Callers with no presentation pass nothing
 * and keep rolling here.
 */
function resolveD20(suppliedD20?: number): number {
  return suppliedD20 ?? rollDice('1d20');
}

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
  inventory: Item[],
  suppliedD20?: number
): LockpickResult {
  if (!lock.isLocked) {
    return { success: true, margin: 0, triggeredTrap: false };
  }

  const hasThievesTools = hasTool(character, 'thieves-tools', inventory);
  if (!hasThievesTools) {
    // Cannot pick without tools
    return { success: false, margin: -10, triggeredTrap: false };
  }

  // Resolve ability data through the shared bridge so modern character sheets
  // drive lockpicking while older puzzle fixtures still work.
  const stats = getPuzzleCharacterStats(character);
  const dexMod = getAbilityModifierValue(stats.dexterity);
  const isProficient = hasToolProficiency(character, 'thieves-tools');
  const bonus = isProficient ? (character.proficiencyBonus ?? 0) : 0;
  const total = resolveD20(suppliedD20) + dexMod + bonus;

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
 * Attempts to open a lock with keys the caller already knows are available.
 *
 * Inventory, economy, and item registry ownership stays outside this puzzle
 * runtime. Callers pass only key ids, and this function owns the deterministic
 * lock/key comparison against `Lock.keyId`.
 */
export function attemptKeyUnlock(
  lock: Lock,
  availableKeyIds: Iterable<string>
): KeyUnlockResult {
  if (!lock.isLocked) {
    return { success: true, reason: 'already_unlocked' };
  }

  if (!lock.keyId) {
    return { success: false, reason: 'no_key_required' };
  }

  // Accept any iterable so UI, inventory, or future world systems can pass an array or Set
  // without forcing the puzzle package to depend on their storage model.
  const availableKeys = new Set(availableKeyIds);
  if (!availableKeys.has(lock.keyId)) {
    return { success: false, reason: 'missing_key' };
  }

  return { success: true, matchedKeyId: lock.keyId, reason: 'matching_key' };
}

/**
 * Attempts to break a lock or door using Strength.
 */
export function attemptBreak(
  character: PlayerCharacter,
  lock: Lock,
  suppliedD20?: number
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
    // Keep break checks on raw strength modifier only; no skill bonus unless called elsewhere.
    const stats = getPuzzleCharacterStats(character);
    const strMod = getAbilityModifierValue(stats.strength);
    const total = resolveD20(suppliedD20) + strMod;
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
  trap: Trap,
  suppliedD20?: number
): TrapDetectionResult {
  if (trap.isDisarmed || trap.isTriggered) {
    return { success: true, margin: 0, trapDetected: true };
  }

  // Use the higher of Perception (Wisdom) or Investigation (Intelligence) logic.
  const stats = getPuzzleCharacterStats(character);
  const wisMod = getAbilityModifierValue(stats.wisdom);
  const intMod = getAbilityModifierValue(stats.intelligence);
  // One face, two skills: the player watched a single d20, so Perception and
  // Investigation compare against the same face when one is supplied.
  const perceptionRoll = resolveD20(suppliedD20);
  const investigationRoll = suppliedD20 ?? rollDice('1d20');
  const perceptionTotal = perceptionRoll + wisMod;
  const investigationTotal = investigationRoll + intMod;
  const total = Math.max(perceptionTotal, investigationTotal);

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
  inventory: Item[],
  suppliedD20?: number
): TrapDisarmResult {
   if (trap.isDisarmed) {
     return { success: true, margin: 0, triggeredTrap: false };
   }

   const hasThievesTools = hasTool(character, 'thieves-tools', inventory);
   if (!hasThievesTools) {
     return { success: false, margin: -10, triggeredTrap: false };
   }

  // Resolve ability data through the shared bridge, but keep the existing
  // thieves'-tools roll formula so older trap DCs stay calibrated.
  const stats = getPuzzleCharacterStats(character);
  const dexMod = getAbilityModifierValue(stats.dexterity);
  const isProficient = hasToolProficiency(character, 'thieves-tools');
  const bonus = isProficient ? (character.proficiencyBonus ?? 0) : 0;
  const total = resolveD20(suppliedD20) + dexMod + bonus;

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

// #895 (2026-09-09): not wired, and deliberately so. The "Submap" generation
// this marker pointed at no longer exists as code - src/features/SubmapGeneration
// is a README describing deleted files, and the surviving Voronoi submap engine
// has no prop or interactable list to place a Lock into. The live dungeon
// generator does have a furnishing pass, but it emits no Lock records and its
// seeded call order is frozen by golden tests, so the work is a generator change
// rather than a lock-system change. Tracked as GG-196 in
// docs/projects/GLOBAL_GAPS.md; nothing in this file blocks it.
