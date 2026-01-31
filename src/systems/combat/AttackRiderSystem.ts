// TODO(lint-intent): 'CombatCharacter' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { ActiveRider, CombatState, CombatCharacter as _CombatCharacter } from '@/types/combat';

export interface AttackContext {
    attackerId: string;
    targetId: string;
    attackType: "weapon" | "spell";
    weaponType?: "melee" | "ranged";
    isHit: boolean;
}

export class AttackRiderSystem {
    /**
     * Register a new rider effect on a caster
     * Returns updated CombatState
     */
    registerRider(state: CombatState, rider: ActiveRider): CombatState {
        // RALPH: Locates the caster in state and appends the new rider to their list.
        // Uses immutable state pattern (creates new character/state objects).
        const caster = state.characters.find(c => c.id === rider.casterId);
        if (!caster) return state;

        const updatedCaster = {
            ...caster,
            riders: [...(caster.riders || []), rider]
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === caster.id ? updatedCaster : c)
        };
    }

    /**
     * Get all riders on the ATTACKER that match the current attack context
     */
    getMatchingRiders(state: CombatState, context: AttackContext): ActiveRider[] {
        // RALPH: Fast-fail if the attack missed; riders generally trigger on hits.
        if (!context.isHit) return [];

        const attacker = state.characters.find(c => c.id === context.attackerId);
        if (!attacker || !attacker.riders) return [];

        return attacker.riders.filter(rider => {
            // 1. Caster check is implicit (riders are on the caster)

            // 2. Check target matching (if specific target required)
            // RALPH: Enforces target-specificity (e.g., Hunter's Mark on a specific enemy).
            if (rider.targetId && rider.targetId !== context.targetId) return false;

            // 3. Check assumption/usage limits
            // RALPH: Enforces frequency limits (e.g., "Once per turn").
            if (rider.consumption === 'per_turn' && rider.usedThisTurn) return false;

            // 4. Check attack filters
            const filter = rider.attackFilter;

            // Weapon Type Filter
            // RALPH: Validates weapon requirements (e.g., Melee-only riders).
            if (filter.weaponType && filter.weaponType !== 'any') {
                if (!context.weaponType) return false; // Non-weapon attacks fail weapon filter
                if (filter.weaponType !== context.weaponType) return false;
            }

            // Attack Type Filter
            // RALPH: Validates source requirements (e.g., Spell vs Weapon attack).
            if (filter.attackType && filter.attackType !== 'any') {
                if (filter.attackType !== context.attackType) return false;
            }

            return true;
        });
    }

    /**
     * Consume riders that triggered on this attack
     * Returns updated CombatState
     */
    consumeRiders(state: CombatState, casterId: string, activeRiders: ActiveRider[]): CombatState {
        // RALPH: Processes the "cost" of triggering riders.
        // - 'first_hit': Removed completely (e.g., Smite).
        // - 'per_turn': Marked as used until start of next turn (e.g., Sneak Attack).
        const caster = state.characters.find(c => c.id === casterId);
        if (!caster || !caster.riders) return state;

        // IDs of riders to remove (first_hit)
        const toRemoveIds = new Set(
            activeRiders.filter(r => r.consumption === 'first_hit').map(r => r.id)
        );

        // IDs of riders to mark used (per_turn)
        const toMarkUsedIds = new Set(
            activeRiders.filter(r => r.consumption === 'per_turn').map(r => r.id)
        );

        // RALPH: Optimization - return original state if no changes needed.
        if (toRemoveIds.size === 0 && toMarkUsedIds.size === 0) return state;

        const updatedRiders = caster.riders.filter(r => !toRemoveIds.has(r.id)).map(r => {
            if (toMarkUsedIds.has(r.id)) {
                return { ...r, usedThisTurn: true };
            }
            return r;
        });

        const updatedCaster = {
            ...caster,
            riders: updatedRiders
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === caster.id ? updatedCaster : c)
        };
    }

    /**
     * Remove all riders associated with a specific spell (e.g. when concentration breaks)
     */
    removeRidersBySpell(state: CombatState, spellId: string, casterId: string): CombatState {
        const caster = state.characters.find(c => c.id === casterId);
        if (!caster || !caster.riders) return state;

        const updatedRiders = caster.riders.filter(r => r.spellId !== spellId);

        // optimization: no change if length same
        if (updatedRiders.length === caster.riders.length) return state;

        const updatedCaster = {
            ...caster,
            riders: updatedRiders
        };

        return {
            ...state,
            characters: state.characters.map(c => c.id === caster.id ? updatedCaster : c)
        };
    }

    /**
     * Reset per-turn usage trackers at start of turn
     */
    onTurnStart(state: CombatState, characterId: string): CombatState {
        const character = state.characters.find(c => c.id === characterId);
        if (!character || !character.riders) return state;

        const updatedRiders = character.riders.map(r => ({ ...r, usedThisTurn: false }));

        return {
            ...state,
            characters: state.characters.map(c => c.id === characterId ? { ...character, riders: updatedRiders } : c)
        };
    }
}
