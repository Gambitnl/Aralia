import { Lock, LockpickResult, Trap, TrapEffect } from '../types/mechanics';
import { rollDice } from './combatUtils';

// ------------------------------------------------------------------
// LOCK MECHANICS
// ------------------------------------------------------------------

/**
 * Attempts to pick a lock.
 * @param dexMod The character's Dexterity modifier
 * @param proficiencyBonus The character's proficiency bonus (if proficient in Thieves' Tools)
 * @param hasThievesTools Whether the character has the tools (disadvantage if not, or impossible?)
 *                        D&D 5e: Usually requires tools. We'll assume tools are present for this check.
 * @param lock The lock being attempted
 * @returns Result of the attempt
 */
export function attemptLockpick(
  dexMod: number,
  proficiencyBonus: number,
  lock: Lock
): LockpickResult {
  if (!lock.isLocked) {
    return { success: true, margin: 100, triggeredTrap: false, details: "The lock is already open." };
  }

  const roll = rollDice('1d20');
  const total = roll + dexMod + proficiencyBonus;

  const success = total >= lock.dc;
  const margin = total - lock.dc;

  // Trap triggers if failed by 5 or more, AND it's trapped
  const triggeredTrap = lock.isTrapped === true && !success && (lock.dc - total >= 5);

  let details = "";
  if (success) {
    details = `Success! Rolled ${total} (DC ${lock.dc}). The mechanism clicks open.`;
  } else {
    details = `Failure. Rolled ${total} (DC ${lock.dc}). The tumbler doesn't budge.`;
    if (triggeredTrap) {
      details += " You hear a distinct 'click' that shouldn't be there...";
    }
  }

  return {
    success,
    margin,
    triggeredTrap,
    details
  };
}

/**
 * Checks if a character can force a lock open (Strength check).
 */
export function attemptForceLock(
  strMod: number,
  lock: Lock
): { success: boolean; details: string } {
  if (!lock.breakDC) {
    return { success: false, details: "This mechanism is too sturdy to force open." };
  }

  const roll = rollDice('1d20');
  const total = roll + strMod;

  if (total >= lock.breakDC) {
    return { success: true, details: `CRUNCH! You force the mechanism open with a roll of ${total}.` };
  }

  return { success: false, details: `You strain against it, but it holds. Rolled ${total} (DC ${lock.breakDC}).` };
}


// ------------------------------------------------------------------
// TRAP MECHANICS
// ------------------------------------------------------------------

/**
 * Calculates the damage or effect of a triggered trap.
 * Does NOT apply the effect, just resolves the roll.
 */
export function resolveTrapEffect(trap: Trap): { damageValue: number; description: string } {
  let damageValue = 0;
  let description = `Trap '${trap.name}' triggered!`;

  if (trap.effect.damage) {
    // Basic roll parsing - simpler version than full combat engine
    // Assuming trap.effect.damage is a string like "2d6" or "1d8+2"
    // Using existing rollDice utility which handles "1d8+2"
    // However, rollDice returns a number.

    // We need to parse the dice string if it's a DiceRoll type (which is likely string or object)
    // Looking at mechanics.ts import, DiceRoll is likely a string alias based on context.
    // If it's a string:
    if (typeof trap.effect.damage === 'string') {
        damageValue = rollDice(trap.effect.damage);
        description += ` It deals ${damageValue} ${trap.effect.damageType || 'piercing'} damage.`;
    }
  }

  if (trap.effect.saveDC) {
    description += ` DC ${trap.effect.saveDC} ${trap.effect.saveAbility} save to mitigate.`;
  }

  return { damageValue, description };
}
