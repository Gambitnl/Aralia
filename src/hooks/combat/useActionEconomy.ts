// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 17:10:30
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/combat/useActionEconomy.ts
 * React-facing wrapper around the shared combat action-economy helpers.
 *
 * The hook keeps the turn manager API stable while the actual "can pay" and
 * "spend the cost" rules live in actionEconomyUtils.ts for reuse by tests and
 * the ability-command bridge.
 */
import { CombatCharacter, AbilityCost } from '../../types/combat';
import { canAffordActionCost, consumeActionCost } from '../../utils/combat/actionEconomyUtils';

export const useActionEconomy = () => {
    // ========================================================================
    // Turn Resource Queries
    // ========================================================================
    // Combat UI and the executor both ask this hook whether an action is still
    // legal. Delegating to the shared helper keeps the hook and command bridge
    // from drifting into two subtly different action-economy rule sets.
    // ========================================================================
    
    /**
     * Checks if a character can afford to pay the cost of an ability.
     * @param character The character performing the action.
     * @param cost The cost of the ability.
     * @returns True if the character can afford the action, false otherwise.
     */
    const canAfford = (character: CombatCharacter | undefined, cost: AbilityCost): boolean => {
        return canAffordActionCost(character, cost);
    };

    // ========================================================================
    // Turn Resource Spending
    // ========================================================================
    // The executor persists this returned character after a legal action. The
    // helper is pure, so callers can also use it for local command simulations
    // without mutating a React state snapshot.
    // ========================================================================

    /**
     * Consumes resources from a character's action economy based on an ability's cost.
     * @param character The character whose resources are being consumed.
     * @param cost The cost of the ability.
     * @returns A new CombatCharacter object with the updated action economy. Does not mutate the original.
     */
    const consumeAction = (character: CombatCharacter, cost: AbilityCost): CombatCharacter => {
        return consumeActionCost(character, cost);
    };

    return { canAfford, consumeAction };
};
