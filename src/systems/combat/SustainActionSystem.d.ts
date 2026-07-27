/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 01:15:11
 * Dependents: commands/effects/ReactiveEffectCommand.ts, test/combatEmitters.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file tracks and manages spells and abilities that require ongoing action
 * resources to sustain across turns (e.g., Witch Bolt, Telekinesis).
 *
 * It registers sustained spells, generates action-cost prompts for the turn manager,
 * handles resource cost processing (sustaining a spell consumes actions), and performs
 * cleanup at the end of a character's turn (e.g., terminating effects if the caster
 * fails to sustain).
 *
 * Called by: useTurnManager, useCombatEngine, and ReactiveEffectCommand.
 * Depends on: Combat types from @/types/combat.
 */
import { CombatState } from '../../types/combat';
export interface SustainedSpell {
    spellId: string;
    casterId: string;
    targetIds: string[];
    sustainCost: {
        actionType: 'action' | 'bonus_action' | 'reaction';
        optional: boolean;
    };
    effectIds: string[];
    sustainedThisTurn: boolean;
}
export interface SustainPrompt {
    casterId: string;
    sustainedSpells: SustainedSpell[];
    availableActions: ('action' | 'bonus_action' | 'reaction')[];
}
export declare class SustainActionSystem {
    private sustainedSpells;
    /**
     * Register a spell that requires sustaining
     */
    registerSustainedSpell(spell: SustainedSpell): void;
    /**
     * Remove a sustained spell (when it ends or concentration breaks)
     */
    removeSustainedSpell(casterId: string, spellId: string): void;
    /**
     * Get all sustained spells for a caster
     */
    getSustainedSpellsForCaster(casterId: string): SustainedSpell[];
    /**
     * Check if a caster has any spells that need sustaining on their turn
     */
    getSustainPrompt(state: CombatState, casterId: string): SustainPrompt | null;
    /**
     * Mark a spell as sustained this turn
     */
    sustainSpell(casterId: string, spellId: string, actionType: 'action' | 'bonus_action' | 'reaction'): boolean;
    /**
     * Process end of turn - any spells not sustained this turn should end
     * Returns effect IDs that need to be removed
     */
    processTurnEnd(casterId: string): string[];
    /**
     * Reset all sustain tracking at the start of a new round
     */
    resetForNewRound(): void;
    /**
     * Get all sustained spells (for debugging/serialization)
     */
    getAllSustainedSpells(): SustainedSpell[];
    private static instance;
    /**
     * Get the active singleton instance.
     */
    static getInstance(): SustainActionSystem;
    /**
     * Set the current singleton instance. Useful for mocking/isolating tests.
     */
    static setInstance(instance: SustainActionSystem | null): void;
    /**
     * Create a completely fresh instance of SustainActionSystem.
     * Useful for isolating tracking state in unit tests.
     */
    static createFresh(): SustainActionSystem;
}
export declare const sustainActionSystem: SustainActionSystem;
