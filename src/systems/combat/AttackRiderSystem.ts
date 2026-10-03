// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 26/08/2026, 16:37:48
 * Dependents: commands/effects/ConcentrationCommands.ts, commands/effects/RegisterRiderCommand.ts, commands/factory/AbilityCommandFactory.ts, utils/combat/multiattackUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file manages "Riders" — conditional combat effects that wait on a caster
 * and trigger when a future attack meets their criteria.
 *
 * Common rider examples: Divine Smite (waits for a melee weapon hit), Hex (adds
 * necrotic damage to hits against a marked target), Lightning Arrow (spent on the
 * next ranged weapon attack whether it hits or misses).
 *
 * The file does four things:
 * 1. Registers new riders onto a character's rider list.
 * 2. Matches active riders against an incoming attack context using composable
 *    predicate functions (hit eligibility, target, turn usage, attack filter).
 * 3. Consumes matched riders after they fire (removing one-shot riders, marking
 *    per-turn riders as used).
 * 4. Provides lifecycle helpers: removing riders when concentration breaks,
 *    resetting per-turn usage at the start of a new turn.
 *
 * G32 refactor (2026-08-26): The matching predicates were extracted from an inline
 * filter callback into named, individually-testable pure functions. This makes the
 * matching contract explicit and lets downstream code reuse individual checks (e.g.
 * "does this rider match this weapon type?") without importing the whole class.
 * No matching semantics were changed — the composed result is identical.
 *
 * Called by: RegisterRiderCommand, AbilityCommandFactory, ConcentrationCommands.
 * Depends on: ActiveRider and CombatState from @/types/combat.
 */

import { ActiveRider, CombatState } from '@/types/combat';

// ============================================================================
// Attack Context
// ============================================================================
// Describes the current attack being resolved. Every rider predicate receives
// either the full context or the specific fields it needs to decide whether a
// pending rider should wake up for this attack.
// ============================================================================

export interface AttackContext {
    attackerId: string;
    targetId: string;
    attackType: "weapon" | "spell" | "unarmed";
    weaponType?: "melee" | "ranged" | "unarmed";
    isHit: boolean;
}

// ============================================================================
// Rider Match Result
// ============================================================================
// A narrowed return type for consumers that only need the matched riders and
// don't want to depend on the full ActiveRider[] semantics. Currently a simple
// alias, but provides a named seam for future metadata (e.g. match reason).
// ============================================================================

/** Narrowed type for riders that passed all matching predicates. */
export type RiderMatchResult = ActiveRider;

// ============================================================================
// Weapon Type Normalization
// ============================================================================
// Spell JSON and older rider fixtures have used both compact labels ("ranged")
// and explicit legacy labels ("ranged_weapon"). This normalizer bridges the two
// so shared next-attack riders don't silently miss because the data came from
// a different adapter generation.
// ============================================================================

const normalizeRiderWeaponType = (weaponType?: string): AttackContext['weaponType'] | 'any' | undefined => {
    // Legacy labels from older spell data files get mapped to compact form.
    if (weaponType === 'melee_weapon') return 'melee';
    if (weaponType === 'ranged_weapon') return 'ranged';
    // Already-canonical labels pass through unchanged.
    if (weaponType === 'melee' || weaponType === 'ranged' || weaponType === 'unarmed' || weaponType === 'any') {
        return weaponType;
    }
    // Unknown or missing weapon type — treated as "no weapon type filter".
    return undefined;
};

// ============================================================================
// Extracted Matching Predicates
// ============================================================================
// These four pure functions encode the complete matching contract for deciding
// whether a pending rider should wake up for a given attack. Each one tests a
// single, independent dimension of the match:
//
//   1. isRiderHitEligible   — Does the attack's hit/miss status satisfy the rider?
//   2. isRiderTargetMatch   — Is this the right target for a target-locked rider?
//   3. isRiderTurnAvailable — Has the rider already been used this turn?
//   4. isRiderAttackFilterMatch — Do the weapon type and attack type align?
//
// They were extracted from the inline .filter() callback in getMatchingRiders()
// so each one can be tested and reused independently. The composed result in
// getMatchingRiders() is identical to the pre-extraction behavior.
// ============================================================================

/**
 * Checks whether the attack's hit/miss outcome satisfies this rider's trigger.
 *
 * Most riders only fire on hits. Lightning Arrow-style riders are the exception:
 * they fire on the next matching attack whether it hits or misses, delivering a
 * different payload for each case. This predicate gates that distinction.
 */
export function isRiderHitEligible(rider: ActiveRider, context: AttackContext): boolean {
    // Hit-or-miss riders (like Lightning Arrow) fire on any matching attack
    // regardless of whether it landed. All other riders require a hit.
    if (!context.isHit && rider.consumption !== 'per_instance_hit_or_miss') return false;
    return true;
}

/**
 * Checks whether the attack target matches a target-specific rider.
 *
 * Spells like Hex and Hunter's Mark lock their rider to a specific enemy.
 * If the rider has a targetId set, it only matches attacks against that target.
 * Riders without a targetId (like Divine Favor) match attacks against anyone.
 */
export function isRiderTargetMatch(rider: ActiveRider, context: AttackContext): boolean {
    // If the rider is locked to a specific target, only that target triggers it.
    if (rider.targetId && rider.targetId !== context.targetId) return false;
    return true;
}

/**
 * Checks whether a per-turn rider has already been used this turn.
 *
 * Sneak Attack-style riders can only fire once per turn. Once used, they stay
 * registered but are marked as spent until the next turn starts and resets them.
 * First-hit and unlimited riders are always available from a turn-usage perspective.
 */
export function isRiderTurnAvailable(rider: ActiveRider): boolean {
    // Per-turn riders that have already fired this turn are not available.
    if (rider.consumption === 'per_turn' && rider.usedThisTurn) return false;
    return true;
}

/**
 * Checks whether the attack's weapon type and attack type match the rider's filter.
 *
 * This is the most complex predicate. It handles:
 * - Weapon type filtering with legacy label normalization (ranged_weapon → ranged)
 * - Attack type filtering (weapon vs spell vs unarmed)
 * - The "any" wildcard that matches all weapon/attack types
 * - The unarmed boundary: an unarmed attack does not match a melee weapon rider
 *   (smite reaction prompts handle unarmed opt-ins separately)
 */
export function isRiderAttackFilterMatch(rider: ActiveRider, context: AttackContext): boolean {
    const filter = rider.attackFilter;

    // --- Weapon type check ---
    // If the rider requires a specific weapon type (not "any"), the attack must
    // provide a matching weapon type. Legacy labels are normalized before comparing.
    if (filter.weaponType && filter.weaponType !== 'any') {
        const expectedWeaponType = normalizeRiderWeaponType(filter.weaponType);
        // Attacks without weapon type data (e.g. pure spell attacks) fail the filter.
        if (!context.weaponType) return false;
        if (!expectedWeaponType || expectedWeaponType !== context.weaponType) return false;
    }

    // --- Attack type check ---
    // If the rider requires a specific attack type (not "any"), the attack must match.
    // This prevents spell attacks from consuming weapon-only riders and vice versa.
    if (filter.attackType && filter.attackType !== 'any') {
        if (filter.attackType !== context.attackType) return false;
    }

    return true;
}

// ============================================================================
// AttackRiderSystem Class
// ============================================================================
// The class provides the stateful operations: registering riders onto combat
// characters, matching them using the extracted predicates, consuming them after
// they fire, and lifecycle management (spell removal, turn reset).
//
// Consumers instantiate this class directly (new AttackRiderSystem()). The
// singleton isolation work already landed separately — see Combat_Ralph.md.
// ============================================================================

export class AttackRiderSystem {
    /**
     * Register a new rider effect on a caster.
     * Returns updated CombatState with the rider appended to the caster's list.
     */
    registerRider(state: CombatState, rider: ActiveRider): CombatState {
        // Find the caster who will carry this rider.
        const caster = state.characters.find(c => c.id === rider.casterId);
        if (!caster) return state;

        // Append the new rider to the caster's existing rider list (immutable update).
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
     * Get all riders on the ATTACKER that match the current attack context.
     *
     * Composes the four extracted predicates: hit eligibility, target match,
     * turn availability, and attack filter match. A rider must pass all four
     * to be included in the result.
     */
    getMatchingRiders(state: CombatState, context: AttackContext): RiderMatchResult[] {
        const attacker = state.characters.find(c => c.id === context.attackerId);
        if (!attacker || !attacker.riders) return [];

        // Each rider must pass all four predicate gates to match.
        // The predicates are composed here but can be tested individually.
        return attacker.riders.filter(rider =>
            isRiderHitEligible(rider, context) &&
            isRiderTargetMatch(rider, context) &&
            isRiderTurnAvailable(rider) &&
            isRiderAttackFilterMatch(rider, context)
        );
    }

    /**
     * Consume riders that triggered on this attack.
     * Returns updated CombatState with spent riders removed or marked used.
     */
    consumeRiders(state: CombatState, casterId: string, activeRiders: ActiveRider[]): CombatState {
        const caster = state.characters.find(c => c.id === casterId);
        if (!caster || !caster.riders) return state;

        // One-shot riders (first_hit, per_instance_hit_or_miss) are removed entirely.
        // Lightning Arrow is the canonical per_instance_hit_or_miss example: the rider
        // is removed after the matching hit or miss so the next attack can't reuse it.
        const toRemoveIds = new Set(
            activeRiders
                .filter(r => r.consumption === 'first_hit' || r.consumption === 'per_instance_hit_or_miss')
                .map(r => r.id)
        );

        // Per-turn riders (like Sneak Attack) stay registered but are marked as
        // used until the start of the character's next turn resets them.
        const toMarkUsedIds = new Set(
            activeRiders.filter(r => r.consumption === 'per_turn').map(r => r.id)
        );

        // If nothing needs changing, return the original state to avoid unnecessary copies.
        if (toRemoveIds.size === 0 && toMarkUsedIds.size === 0) return state;

        // Remove spent one-shot riders and mark per-turn riders as used.
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
     * Remove all riders associated with a specific spell (e.g. when concentration breaks).
     * Called by ConcentrationCommands when the caster loses focus on a rider-producing spell.
     */
    removeRidersBySpell(state: CombatState, spellId: string, casterId: string): CombatState {
        const caster = state.characters.find(c => c.id === casterId);
        if (!caster || !caster.riders) return state;

        const updatedRiders = caster.riders.filter(r => r.spellId !== spellId);

        // No change needed if nothing was filtered out.
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
     * Reset per-turn usage trackers at start of turn.
     * Called at the beginning of each character's turn so per-turn riders
     * (like Sneak Attack) become available again.
     */
    onTurnStart(state: CombatState, characterId: string): CombatState {
        const character = state.characters.find(c => c.id === characterId);
        if (!character || !character.riders) return state;

        // Reset all riders' usedThisTurn flag to false for the new turn.
        const updatedRiders = character.riders.map(r => ({ ...r, usedThisTurn: false }));

        return {
            ...state,
            characters: state.characters.map(c => c.id === characterId ? { ...character, riders: updatedRiders } : c)
        };
    }
}
