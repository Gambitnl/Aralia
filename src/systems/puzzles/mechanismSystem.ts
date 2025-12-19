/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/mechanismSystem.ts
 * Implements mechanics for interactive mechanisms like levers, buttons, and pull chains.
 */

import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { rollDice } from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { Mechanism, MechanismResult, Trap } from './types';
import { hasTool } from './lockSystem';

/**
 * Attempts to interact with a mechanism (pull lever, push button).
 * @param character The character interacting.
 * @param mechanism The mechanism to interact with.
 * @param inventory Character's inventory (for keys/tools).
 * @param linkedTrap Optional trap on the mechanism itself.
 */
export function interactWithMechanism(
  character: PlayerCharacter,
  mechanism: Mechanism,
  inventory: Item[],
  linkedTrap?: Trap
): MechanismResult {
  // 1. Check if Hidden
  if (mechanism.isHidden) {
    return {
      success: false,
      message: 'You see nothing to interact with here.'
    };
  }

  // 2. Check if Locked
  if (mechanism.isLocked) {
    // A mechanism lock is usually small (casing lock).
    // Solutions: Key (if defined), Pick (Thieves Tools), or Break (Strength).

    // A. Key Check
    const hasKey = mechanism.lockId ? inventory.some(item => item.id === mechanism.lockId) : false;

    if (hasKey) {
        mechanism.isLocked = false;
        // Proceed...
    } else {
        // B. Pick Check (Automatic attempt if user has tools)
        const hasThievesTools = hasTool(character, 'thieves-tools', inventory);

        if (hasThievesTools) {
             const dexMod = getAbilityModifierValue(character.stats.dexterity);
             const dc = 15; // Default DC for mechanisms
             const roll = rollDice('1d20') + dexMod;

             if (roll >= dc) {
                 mechanism.isLocked = false;
                 // Proceed...
             } else {
                 return { success: false, message: 'The mechanism is locked. You fail to pick it.' };
             }
        }
        // C. Break Check (Strength)
        else {
            const strMod = getAbilityModifierValue(character.stats.strength);
            const roll = rollDice('1d20') + strMod;
            if (roll >= 20) { // Hard DC to break a mechanism without destroying it
                 mechanism.isLocked = false;
                 mechanism.isStuck = true; // Breaking it jams it
            } else {
                const needsKeyMsg = mechanism.lockId ? 'a key or ' : '';
                return {
                  success: false,
                  message: `The mechanism is locked. You need ${needsKeyMsg}tools.`
                };
            }
        }
    }
  }

  // 3. Check if Stuck
  if (mechanism.isStuck) {
    // Check for oil/grease
    const hasOil = inventory.some(item => item.id === 'oil_flask');

    const strMod = getAbilityModifierValue(character.stats.strength);
    const d20 = rollDice('1d20');
    let total = d20 + strMod;

    if (hasOil) {
        total += 5; // Advantage/Bonus
    }

    if (mechanism.stuckDC && total < mechanism.stuckDC) {
      return {
        success: false,
        message: 'The mechanism is rusted shut or stuck. You grunt but it doesn\'t budge.'
      };
    } else {
        // Unstuck!
        mechanism.isStuck = false;
    }
  }

  // 4. Toggle State
  const currentIndex = mechanism.states.indexOf(mechanism.currentState);
  const nextIndex = (currentIndex + 1) % mechanism.states.length;
  const newState = mechanism.states[nextIndex];

  mechanism.currentState = newState;

  const result: MechanismResult = {
    success: true,
    newState: newState,
    message: `You ${getInteractionVerb(mechanism.type)} the ${mechanism.name}. It shifts to '${newState}'.`
  };

  // 5. Handle Links
  if (mechanism.linkedTrapId && linkedTrap) {
     if (mechanism.currentState === 'on') {
         if (!linkedTrap.isDisarmed) {
             result.triggeredTrap = true;
             result.trapEffect = linkedTrap.effect;
             result.message += ' A trap is triggered!';
         }
     }
  }

  if (mechanism.linkedLockId) {
      result.lockUpdate = {
          lockId: mechanism.linkedLockId,
          action: mechanism.currentState === 'on' ? 'unlock' : 'lock'
      };
  }

  if (mechanism.linkedPuzzleId && mechanism.puzzleSignal) {
      result.puzzleUpdate = {
          puzzleId: mechanism.linkedPuzzleId,
          signal: `${mechanism.puzzleSignal}:${mechanism.currentState}` // e.g. "lever1:on"
      };
  }

  return result;
}

/**
 * Attempts to spot a hidden mechanism.
 */
export function detectMechanism(
  character: PlayerCharacter,
  mechanism: Mechanism
): { detected: boolean; message: string } {
    if (!mechanism.isHidden) {
        return { detected: true, message: 'It is plainly visible.' };
    }

    const wisMod = getAbilityModifierValue(character.stats.wisdom); // Perception
    const intMod = getAbilityModifierValue(character.stats.intelligence); // Investigation
    const bestMod = Math.max(wisMod, intMod);
    const d20 = rollDice('1d20');

    if (d20 + bestMod >= mechanism.detectionDC) {
        mechanism.isHidden = false;
        return { detected: true, message: `You spot a hidden ${mechanism.type}.` };
    }

    return { detected: false, message: 'You see nothing.' };
}

function getInteractionVerb(type: string): string {
    switch (type) {
        case 'lever': return 'pull';
        case 'button': return 'press';
        case 'wheel': return 'turn';
        case 'pull_chain': return 'yank';
        case 'rune': return 'touch';
        default: return 'activate';
    }
}

// TODO(Lockpick): Integrate mechanisms into the Dungeon generation (Submap) to place levers for puzzle rooms.
