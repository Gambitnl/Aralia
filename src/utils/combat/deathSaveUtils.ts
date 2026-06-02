/**
 * @file utils/combat/deathSaveUtils.ts
 * Centralized utility functions for managing Downing states, Death Saving Throws,
 * unconsciousness conditions, and HP transition mutations for players at 0 HP.
 *
 * This system is built to strictly implement standard D&D 5e Rules:
 * - When a player drops to 0 HP, they gain the Unconscious condition and death save tracking initializes.
 * - Taking damage while at 0 HP inflicts death save failures (1 failure standard, 2 if critical).
 * - Receiving healing while downed immediately restores consciousness, clears saves, and removes Unconscious.
 * - Unconscious or incapacitated creatures are restricted from executing actions, reactions, or moving.
 *
 * DESIGN DECISIONS:
 * We decouple these helper calculations from the React hook state updates so that tests, commands, 
 * and turn coordinators can execute pure HP transitions predictably and isolate state leaks.
 */

import { CombatCharacter } from '../../types/combat';

/**
 * Checks if a combat character possesses any incapacitating status conditions.
 * Standard D&D 5e rules state that incapacitated creatures cannot take actions or reactions.
 *
 * @param character The character to evaluate.
 * @returns True if the character is incapacitated, false otherwise.
 */
export function isIncapacitated(character: CombatCharacter | undefined): boolean {
  if (!character) return false;
  const incapacitatedConditions = ['unconscious', 'incapacitated', 'stunned', 'paralyzed', 'petrified'];
  
  return (
    character.statusEffects?.some(se => incapacitatedConditions.includes(se.name.toLowerCase())) ||
    character.conditions?.some(c => incapacitatedConditions.includes(c.name.toLowerCase())) ||
    false
  );
}

/**
 * Checks if a character's movement is completely blocked by status conditions.
 * Unconscious, paralyzed, petrified, and restrained characters have their speed reduced to 0.
 *
 * @param character The character to evaluate.
 * @returns True if the character cannot move, false otherwise.
 */
export function isMovementBlocked(character: CombatCharacter | undefined): boolean {
  if (!character) return false;
  const blockingConditions = ['unconscious', 'paralyzed', 'petrified', 'restrained'];
  
  return (
    character.statusEffects?.some(se => blockingConditions.includes(se.name.toLowerCase())) ||
    character.conditions?.some(c => blockingConditions.includes(c.name.toLowerCase())) ||
    false
  );
}

/**
 * Safely adds the "Unconscious" condition to a character's statusEffects and conditions arrays.
 * Preserves existing status effects and prevents duplicate entries.
 *
 * @param character The character falling unconscious.
 * @returns An updated CombatCharacter with the Unconscious status applied.
 */
export function addUnconsciousCondition(character: CombatCharacter): CombatCharacter {
  const hasUnconsciousStatus = character.statusEffects?.some(se => se.name.toLowerCase() === 'unconscious');
  const hasUnconsciousCondition = character.conditions?.some(c => c.name.toLowerCase() === 'unconscious');

  let statusEffects = character.statusEffects ? [...character.statusEffects] : [];
  let conditions = character.conditions ? [...character.conditions] : [];

  if (!hasUnconsciousStatus) {
    statusEffects.push({
      id: 'unconscious_' + Math.random().toString(36).substring(2, 9),
      name: 'Unconscious',
      type: 'debuff',
      description: 'Unconscious due to being downed at 0 HP.',
      duration: 999, // Indefinite until healed or stabilized/revived
      icon: 'unconscious'
    });
  }

  if (!hasUnconsciousCondition) {
    conditions.push({
      name: 'Unconscious',
      duration: { type: 'permanent' },
      appliedTurn: 1
    });
  }

  return {
    ...character,
    statusEffects,
    conditions
  };
}

/**
 * Safely removes the "Unconscious" condition from a character's statusEffects and conditions arrays.
 * Used when a downed character is healed or revived.
 *
 * @param character The character regaining consciousness.
 * @returns An updated CombatCharacter with the Unconscious status removed.
 */
export function removeUnconsciousCondition(character: CombatCharacter): CombatCharacter {
  const statusEffects = (character.statusEffects || []).filter(se => se.name.toLowerCase() !== 'unconscious');
  const conditions = (character.conditions || []).filter(c => c.name.toLowerCase() !== 'unconscious');
  
  return {
    ...character,
    statusEffects,
    conditions
  };
}

/**
 * Deducts HP (applying Temporary HP first) and applies Downing / Death Save Failure transitions.
 * - Players reaching 0 HP are downed, starting death save tracking and falling unconscious.
 * - Players already at 0 HP suffer 1 death save failure (2 if a critical hit).
 *
 * @param character The character taking damage.
 * @param amount The raw amount of damage to deduct from HP.
 * @param isCritical Whether the source damage is a critical hit (inflicts 2 failures while downed).
 * @returns The mutated CombatCharacter state.
 */
export function applyDamageAndCheckDowned(character: CombatCharacter, amount: number, isCritical: boolean = false): CombatCharacter {
  let updatedCharacter = { ...character };
  const originalHP = updatedCharacter.currentHP;

  // 1. Resolve damage against Temporary HP first
  let damageToApply = amount;
  if (updatedCharacter.tempHP && updatedCharacter.tempHP > 0) {
    if (updatedCharacter.tempHP >= damageToApply) {
      updatedCharacter.tempHP -= damageToApply;
      damageToApply = 0;
    } else {
      damageToApply -= updatedCharacter.tempHP;
      updatedCharacter.tempHP = 0;
    }
  }

  // 2. Apply remaining damage to standard HP pool
  updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - damageToApply);
  updatedCharacter.damagedThisTurn = true;

  // 3. Downed & Death Saving Throw Transitions
  if (updatedCharacter.currentHP === 0 && originalHP > 0) {
    if (updatedCharacter.team === 'player') {
      // Transition player character to downed / dying state
      updatedCharacter.deathSaves = {
        successes: 0,
        failures: 0,
        isStable: false
      };
      updatedCharacter = addUnconsciousCondition(updatedCharacter);
    }
  } else if (updatedCharacter.currentHP === 0 && originalHP === 0 && updatedCharacter.team === 'player' && amount > 0) {
    // A player character already at 0 HP takes damage. This counts as an automatic death save failure.
    // (If the damage is critical, it counts as two failures).
    const failuresToAdd = isCritical ? 2 : 1;
    const currentFailures = updatedCharacter.deathSaves?.failures || 0;
    const newFailures = Math.min(3, currentFailures + failuresToAdd);
    
    updatedCharacter.deathSaves = {
      successes: updatedCharacter.deathSaves?.successes || 0,
      failures: newFailures,
      isStable: false // Taking damage breaks stabilization
    };
  }

  return updatedCharacter;
}

/**
 * Standard healing helper that restores HP and manages downed recovery.
 * - Receives standard healing (HP > 0) restores consciousness, clears saves, and clears Unconscious status.
 *
 * @param character The character receiving healing.
 * @param amount The HP to restore.
 * @returns The mutated CombatCharacter state.
 */
export function applyHealingAndRestore(character: CombatCharacter, amount: number): CombatCharacter {
  let updatedCharacter = { ...character };
  const originalHP = updatedCharacter.currentHP;

  // Apply standard healing capped at max HP
  updatedCharacter.currentHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + amount);

  // Revive transition: if healed from 0 HP to >0 HP, remove downed status and unconsciousness
  if (originalHP === 0 && updatedCharacter.currentHP > 0 && updatedCharacter.team === 'player') {
    updatedCharacter.deathSaves = undefined;
    updatedCharacter = removeUnconsciousCondition(updatedCharacter);
  }

  return updatedCharacter;
}
