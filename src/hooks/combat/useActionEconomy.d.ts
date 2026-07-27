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
/**
 * @file src/hooks/combat/useActionEconomy.ts
 * React-facing wrapper around the shared combat action-economy helpers.
 *
 * The hook keeps the turn manager API stable while the actual "can pay" and
 * "spend the cost" rules live in actionEconomyUtils.ts for reuse by tests and
 * the ability-command bridge.
 */
import { CombatCharacter, AbilityCost } from '../../types/combat';
export declare const useActionEconomy: () => {
    canAfford: (character: CombatCharacter | undefined, cost: AbilityCost) => boolean;
    consumeAction: (character: CombatCharacter, cost: AbilityCost) => CombatCharacter;
};
