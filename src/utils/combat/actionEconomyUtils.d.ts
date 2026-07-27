/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 04:23:01
 * Dependents: hooks/combat/useActionEconomy.ts, hooks/combat/useTurnManager.ts, hooks/useAbilitySystem.ts, utils/combat/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/combat/actionEconomyUtils.ts
 * Shared helpers for the D&D-style action economy used by battle-map combat.
 *
 * The turn manager resets these counters at the start of each creature turn,
 * the action executor spends them when a character moves or uses an ability,
 * and the UI reads the same state to decide which buttons are still legal.
 */
import { CombatCharacter, ActionEconomyState, AbilityCost } from '../../types/combat';
/**
 * Computes the movement pool a combatant should have after live effects are
 * applied. This keeps turn-start resets and mid-combat effect updates aligned
 * so speed changes can actually flow into movement.total instead of being left
 * behind on the character sheet.
 */
export declare function calculateMovementTotal(character: CombatCharacter): number;
/**
 * Creates a default action economy state object for a character.
 * @param moveTotal - The total movement units for the character.
 * @returns A new ActionEconomyState object.
 */
export declare function createDefaultActionEconomy(moveTotal: number): ActionEconomyState;
/**
 * Resets a character's action economy for the start of their turn.
 * @param character The character whose turn is starting.
 * @returns A new CombatCharacter object with the reset action economy.
 */
export declare function resetEconomy(character: CombatCharacter): CombatCharacter;
/**
 * Checks whether a combatant still has enough per-turn resources to pay a cost.
 * Movement is checked in feet, spell slots are checked by level, and the action
 * type decides whether the action, bonus action, reaction, or free use is spent.
 */
export declare function canAffordActionCost(character: CombatCharacter | undefined, cost: AbilityCost): boolean;
/**
 * Returns a new character with the requested action cost paid.
 * The original character is not changed, which lets React state updates and
 * command simulations use the same result without mutating old snapshots.
 */
export declare function consumeActionCost(character: CombatCharacter, cost: AbilityCost): CombatCharacter;
