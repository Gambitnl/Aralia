/**
 * @file src/systems/combat/SavePenaltySystem.ts
 * 
 * System for managing save penalty riders on combat characters.
 * Similar to AttackRiderSystem but for penalties that affect saving throws.
 * 
 * Used by spells like Mind Sliver that impose "subtract 1d4 from next saving throw".
 */

import { CombatState, CombatCharacter, SavePenaltyRider } from '@/types/combat';
import { rollDice } from '@/utils/combatUtils';
import { SavingThrowModifier } from '@/utils/savingThrowUtils';

/**
 * System for registering, consuming, and expiring save penalty riders.
 */
export class SavePenaltySystem {

    /**
     * Register a save penalty rider on a target character.
     * @param state Current combat state
     * @param targetId ID of the target character receiving the penalty
     * @param casterId ID of the character who cast the spell
     * @param sourceName Name of the spell or source
     * @param data Raw penalty data from the spell effect
     * @param spellId Optional spell ID for tracking
     * @returns Updated combat state
     */
    registerPenalty(
        state: CombatState,
        targetId: string,
        casterId: string,
        sourceName: string,
        data: any,
        spellId?: string
    ): CombatState {
        const target = state.characters.find(c => c.id === targetId);
        if (!target) return state;

        const rider: SavePenaltyRider = {
            id: crypto.randomUUID(), // Required for rider tracking/cleanup.
            spellId: spellId || sourceName,
            casterId: casterId,
            sourceName: sourceName,
            dice: data.dice,
            flat: data.flat,
            applies: data.applies,
            duration: data.duration,
            appliedTurn: state.turnState.currentTurn
        };

        const updatedTarget: CombatCharacter = {
            ...target,
            savePenaltyRiders: [...(target.savePenaltyRiders || []), rider]
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === targetId ? updatedTarget : c)
        };
    }

    /**
     * Get all active save penalty modifiers for a target.
     * Converts SavePenaltyRider[] to SavingThrowModifier[] for easy use in rollSavingThrow.
     * Ensures penalties are formatted as negative strings (e.g. "-1d4") if not already.
     * @param target The target character
     * @returns Array of modifiers to apply
     */
    getActivePenalties(target: CombatCharacter): SavingThrowModifier[] {
        if (!target.savePenaltyRiders || target.savePenaltyRiders.length === 0) {
            return [];
        }

        return target.savePenaltyRiders.map(rider => {
            let dice = rider.dice;
            // Ensure dice string implies subtraction for penalties
            if (dice && !dice.startsWith('-')) {
                dice = `-${dice}`;
            }

            // Note: We leave flat modifiers as-is, assuming the caller provides signed values (e.g., -2)
            // or that positive values might be valid in future contexts (though this is a 'Penalty' system).
            return {
                dice: dice,
                flat: rider.flat,
                source: rider.sourceName
            };
        });
    }

    /**
     * Consume "next_save" penalties after a saving throw is rolled.
     * Called after each saving throw for the target.
     * @param state Current combat state
     * @param targetId ID of the target who just made a save
     * @returns Updated combat state with next_save riders removed
     */
    consumeNextSavePenalties(state: CombatState, targetId: string): CombatState {
        const target = state.characters.find(c => c.id === targetId);
        if (!target || !target.savePenaltyRiders) return state;

        // Remove all "next_save" riders (they are consumed on use)
        const remainingRiders = target.savePenaltyRiders.filter(
            r => r.applies !== 'next_save'
        );

        // No change needed if nothing was removed
        if (remainingRiders.length === target.savePenaltyRiders.length) {
            return state;
        }

        const updatedTarget: CombatCharacter = {
            ...target,
            savePenaltyRiders: remainingRiders
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === targetId ? updatedTarget : c)
        };
    }

    /**
     * Remove all save penalty riders from a specific spell (e.g., when concentration breaks).
     * @param state Current combat state
     * @param spellId The spell whose penalties should be removed
     * @param targetId The target character to clean up
     * @returns Updated combat state
     */
    removePenaltiesBySpell(state: CombatState, spellId: string, targetId: string): CombatState {
        const target = state.characters.find(c => c.id === targetId);
        if (!target || !target.savePenaltyRiders) return state;

        const remainingRiders = target.savePenaltyRiders.filter(r => r.spellId !== spellId);

        // No change if nothing removed
        if (remainingRiders.length === target.savePenaltyRiders.length) {
            return state;
        }

        const updatedTarget: CombatCharacter = {
            ...target,
            savePenaltyRiders: remainingRiders
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === targetId ? updatedTarget : c)
        };
    }

    /**
     * Expire duration-based save penalties when a character's turn ends.
     * Supports caster-turn-relative durations (e.g. "until the end of your next turn").
     * @param state Current combat state
     * @param endingCharacterId The ID of the character whose turn is ending
     * @returns Updated combat state with expired riders removed
     */
    expirePenalties(state: CombatState, endingCharacterId: string): CombatState {
        let updatedState = state;

        for (const character of state.characters) {
            if (!character.savePenaltyRiders || character.savePenaltyRiders.length === 0) {
                continue;
            }

            const remainingRiders = character.savePenaltyRiders.filter(rider => {
                // next_save riders are consumed, not expired by duration (though they might have a fallback)
                if (rider.applies === 'next_save') return true;

                // If this rider depends on the caster's turn cycle
                if (rider.casterId === endingCharacterId && rider.duration.type === 'rounds') {
                    const currentTurn = state.turnState.currentTurn;
                    const turnsElapsed = Math.floor((currentTurn - rider.appliedTurn) / state.characters.length);
                    // For "next turn" (value 1), it expires when turnsElapsed reaches 1 (cycle completed)
                    return turnsElapsed < (rider.duration.value || 0);
                }

                // special duration or other caster - keep for now
                return true;
            });

            if (remainingRiders.length !== character.savePenaltyRiders.length) {
                updatedState = {
                    ...updatedState,
                    characters: updatedState.characters.map(c =>
                        c.id === character.id
                            ? { ...c, savePenaltyRiders: remainingRiders }
                            : c
                    )
                };
            }
        }

        return updatedState;
    }

    /**
     * Calculate the total modifier value from all active penalties.
     * Rolls any dice penalties and sums with flat penalties.
     * @param modifiers The modifiers to calculate
     * @returns Total negative modifier value and details for logging
     */
    calculateTotalPenalty(modifiers: SavingThrowModifier[]): { total: number; details: string[] } {
        let total = 0;
        const details: string[] = [];

        for (const mod of modifiers) {
            if (mod.dice) {
                // Roll the dice (which should now be negative string, e.g., -1d4)
                const diceRoll = rollDice(mod.dice);
                // ADD the value (which is negative)
                total += diceRoll;
                details.push(`${diceRoll} (${mod.dice} from ${mod.source})`);
            }
            if (mod.flat) {
                total += mod.flat;
                details.push(`${mod.flat} from ${mod.source}`);
            }
        }

        return { total, details };
    }
}
