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

/**
 * Modifier to apply to a saving throw, computed from active save penalty riders.
 */
export interface SavingThrowModifier {
    dice?: string;    // e.g. "1d4" - will be rolled
    flat?: number;    // e.g. -2 - static penalty
    source: string;   // Name of the effect that caused this penalty
}

/**
 * System for registering, consuming, and expiring save penalty riders.
 */
export class SavePenaltySystem {

    /**
     * Register a save penalty rider on a target character.
     * @param state Current combat state
     * @param targetId ID of the target character receiving the penalty
     * @param penalty The save penalty rider to register
     * @returns Updated combat state
     */
    registerPenalty(state: CombatState, targetId: string, penalty: SavePenaltyRider): CombatState {
        const target = state.characters.find(c => c.id === targetId);
        if (!target) return state;

        const updatedTarget: CombatCharacter = {
            ...target,
            savePenaltyRiders: [...(target.savePenaltyRiders || []), penalty]
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === targetId ? updatedTarget : c)
        };
    }

    /**
     * Get all active save penalty modifiers for a target.
     * Converts SavePenaltyRider[] to SavingThrowModifier[] for easy use in rollSavingThrow.
     * @param target The target character
     * @returns Array of modifiers to apply
     */
    getActivePenalties(target: CombatCharacter): SavingThrowModifier[] {
        if (!target.savePenaltyRiders || target.savePenaltyRiders.length === 0) {
            return [];
        }

        return target.savePenaltyRiders.map(rider => ({
            dice: rider.dice,
            flat: rider.flat,
            source: rider.sourceName
        }));
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
     * Expire duration-based save penalties at end of round.
     * @param state Current combat state
     * @param currentTurn Current turn number for expiration check
     * @returns Updated combat state with expired riders removed
     */
    expirePenalties(state: CombatState, currentTurn: number): CombatState {
        let updatedState = state;

        for (const character of state.characters) {
            if (!character.savePenaltyRiders || character.savePenaltyRiders.length === 0) {
                continue;
            }

            const remainingRiders = character.savePenaltyRiders.filter(rider => {
                // next_save riders are consumed, not expired by duration
                if (rider.applies === 'next_save') return true;

                // Check duration expiration for all_saves riders
                if (rider.duration.type === 'rounds' && rider.duration.value !== undefined) {
                    const turnsElapsed = currentTurn - rider.appliedTurn;
                    return turnsElapsed < rider.duration.value;
                }

                // special duration - keep forever (manual cleanup)
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
                const diceRoll = rollDice(mod.dice);
                total -= diceRoll; // Subtract the rolled value
                details.push(`-${diceRoll} (${mod.dice} from ${mod.source})`);
            }
            if (mod.flat) {
                total += mod.flat; // flat is already negative
                details.push(`${mod.flat} from ${mod.source}`);
            }
        }

        return { total, details };
    }
}
