/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 01:15:23
 * Dependents: commands/effects/ConcentrationCommands.ts, commands/effects/RegisterRiderCommand.ts, commands/factory/AbilityCommandFactory.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file manages "Riders" — conditional combat effects like Smite or Sneak Attack.
 *
 * It registers new riders on casters, filters and matches active riders against the
 * current attack context (e.g., weapon type, spell vs weapon, specific target), and
 * consumes those riders when they are triggered (e.g. removing first-hit riders or
 * marking per-turn riders as used).
 *
 * Called by: ActionExecutor, CombatEngine, and other combat resolution systems.
 * Depends on: Combat types from @/types/combat.
 */
import { ActiveRider, CombatState } from '@/types/combat';
export interface AttackContext {
    attackerId: string;
    targetId: string;
    attackType: "weapon" | "spell" | "unarmed";
    weaponType?: "melee" | "ranged" | "unarmed";
    isHit: boolean;
}
export declare class AttackRiderSystem {
    /**
     * Register a new rider effect on a caster
     * Returns updated CombatState
     */
    registerRider(state: CombatState, rider: ActiveRider): CombatState;
    /**
     * Get all riders on the ATTACKER that match the current attack context
     */
    getMatchingRiders(state: CombatState, context: AttackContext): ActiveRider[];
    /**
     * Consume riders that triggered on this attack
     * Returns updated CombatState
     */
    consumeRiders(state: CombatState, casterId: string, activeRiders: ActiveRider[]): CombatState;
    /**
     * Remove all riders associated with a specific spell (e.g. when concentration breaks)
     */
    removeRidersBySpell(state: CombatState, spellId: string, casterId: string): CombatState;
    /**
     * Reset per-turn usage trackers at start of turn
     */
    onTurnStart(state: CombatState, characterId: string): CombatState;
}
