/**
 * @file src/utils/combat/actionEconomyUtils.ts
 * Placeholder for utility functions related to the D&D 5e action economy.
 */

import { CombatCharacter, ActionEconomyState } from '../../types/combat';

/**
 * Creates a default action economy state object for a character.
 * @param moveTotal - The total movement units for the character.
 * @returns A new ActionEconomyState object.
 */
export function createDefaultActionEconomy(moveTotal: number): ActionEconomyState {
    return {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        movement: { used: 0, total: moveTotal },
        freeActions: 1,
    };
}
