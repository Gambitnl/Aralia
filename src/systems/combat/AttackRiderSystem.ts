import { ActiveRider, CombatState, CombatCharacter } from '@/types/combat';

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
        if (!context.isHit) return [];

        const attacker = state.characters.find(c => c.id === context.attackerId);
        if (!attacker || !attacker.riders) return [];

        return attacker.riders.filter(rider => {
            // 1. Caster check is implicit (riders are on the caster)

            // 2. Check target matching (if specific target required)
            if (rider.targetId && rider.targetId !== context.targetId) return false;

            // 3. Check assumption/usage limits
            if (rider.consumption === 'per_turn' && rider.usedThisTurn) return false;

            // 4. Check attack filters
            const filter = rider.attackFilter;

            // Weapon Type Filter
            if (filter.weaponType && filter.weaponType !== 'any') {
                if (!context.weaponType) return false; // Non-weapon attacks fail weapon filter
                if (filter.weaponType !== context.weaponType) return false;
            }

            // Attack Type Filter
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
