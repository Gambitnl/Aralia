// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:19
 * Dependents: combat/index.ts, useTurnManager.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/**
 * Resets a character's action economy for the start of their turn.
 * @param character The character whose turn is starting.
 * @returns A new CombatCharacter object with the reset action economy.
 */
export function resetEconomy(character: CombatCharacter): CombatCharacter {
    const newEconomy: ActionEconomyState = {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 }, // Reaction resets at start of own turn in 5e
        movement: { used: 0, total: character.stats.speed },
        freeActions: 1, // Reset free actions
    };

    return { ...character, actionEconomy: newEconomy };
}
