// @dependencies-start
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
// @dependencies-end

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

// ============================================================================
// Types and Interfaces
// ============================================================================

import { CombatState } from '../../types/combat';

export interface SustainedSpell {
    spellId: string;
    casterId: string;
    targetIds: string[];
    sustainCost: {
        actionType: 'action' | 'bonus_action' | 'reaction';
        optional: boolean;
    };
    effectIds: string[]; // IDs of the effects that need sustaining
    sustainedThisTurn: boolean;
}

export interface SustainPrompt {
    casterId: string;
    sustainedSpells: SustainedSpell[];
    availableActions: ('action' | 'bonus_action' | 'reaction')[];
}

export class SustainActionSystem {
    private sustainedSpells: Map<string, SustainedSpell> = new Map();

    /**
     * Register a spell that requires sustaining
     */
    registerSustainedSpell(spell: SustainedSpell): void {
        this.sustainedSpells.set(`${spell.casterId}-${spell.spellId}`, spell);
    }

    /**
     * Remove a sustained spell (when it ends or concentration breaks)
     */
    removeSustainedSpell(casterId: string, spellId: string): void {
        this.sustainedSpells.delete(`${casterId}-${spellId}`);
    }

    /**
     * Get all sustained spells for a caster
     */
    getSustainedSpellsForCaster(casterId: string): SustainedSpell[] {
        return Array.from(this.sustainedSpells.values())
            .filter(spell => spell.casterId === casterId);
    }

    /**
     * Check if a caster has any spells that need sustaining on their turn
     */
    getSustainPrompt(state: CombatState, casterId: string): SustainPrompt | null {
        const sustainedSpells = this.getSustainedSpellsForCaster(casterId)
            .filter(spell => !spell.sustainedThisTurn);

        if (sustainedSpells.length === 0) return null;

        // Get available actions (this would need to be integrated with the action economy system)
        const availableActions: ('action' | 'bonus_action' | 'reaction')[] = ['action', 'bonus_action', 'reaction'];

        return {
            casterId,
            sustainedSpells,
            availableActions
        };
    }

    /**
     * Mark a spell as sustained this turn
     */
    sustainSpell(casterId: string, spellId: string, actionType: 'action' | 'bonus_action' | 'reaction'): boolean {
        const key = `${casterId}-${spellId}`;
        const spell = this.sustainedSpells.get(key);

        if (!spell) return false;

        // Check if the action type matches the required sustain cost
        if (spell.sustainCost.actionType !== actionType) return false;

        spell.sustainedThisTurn = true;
        this.sustainedSpells.set(key, spell);

        return true;
    }

    /**
     * Process end of turn - any spells not sustained this turn should end
     * Returns effect IDs that need to be removed
     */
    processTurnEnd(casterId: string): string[] {
        const effectsToRemove: string[] = [];

        for (const [key, spell] of this.sustainedSpells) {
            if (spell.casterId === casterId) {
                if (!spell.sustainedThisTurn) {
                    // Spell was not sustained - remove it
                    effectsToRemove.push(...spell.effectIds);
                    this.sustainedSpells.delete(key);
                } else {
                    // Reset for next turn
                    spell.sustainedThisTurn = false;
                }
            }
        }

        return effectsToRemove;
    }

    /**
     * Reset all sustain tracking at the start of a new round
     */
    resetForNewRound(): void {
        for (const spell of this.sustainedSpells.values()) {
            spell.sustainedThisTurn = false;
        }
    }

    /**
     * Get all sustained spells (for debugging/serialization)
     */
    getAllSustainedSpells(): SustainedSpell[] {
        return Array.from(this.sustainedSpells.values());
    }

    // ============================================================================
    // Singleton Instance and Test Isolation Controls
    // ============================================================================

    // The shared single instance of the system.
    private static instance: SustainActionSystem;

    /**
     * Get the active singleton instance.
     */
    static getInstance(): SustainActionSystem {
        if (!SustainActionSystem.instance) {
            SustainActionSystem.instance = new SustainActionSystem();
        }
        return SustainActionSystem.instance;
    }

    /**
     * Set the current singleton instance. Useful for mocking/isolating tests.
     */
    static setInstance(instance: SustainActionSystem | null): void {
        SustainActionSystem.instance = instance as SustainActionSystem;
    }

    /**
     * Create a completely fresh instance of SustainActionSystem.
     * Useful for isolating tracking state in unit tests.
     */
    static createFresh(): SustainActionSystem {
        return new SustainActionSystem();
    }
}

export const sustainActionSystem = SustainActionSystem.getInstance();














