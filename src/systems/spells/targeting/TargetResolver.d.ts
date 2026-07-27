/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 15/07/2026, 03:30:49
 * Dependents: hooks/combat/useTargetValidator.ts, hooks/useAbilitySystem.ts, systems/spells/targeting/ObjectTargetRegistry.ts, systems/spells/targeting/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { SpellTargeting, CombatCharacter, CombatState, Position } from '@/types';
import type { AllocationResult, AllocatorContext } from './TargetAllocator';
/**
 * Minimal runtime shape for object spell targets.
 *
 * Aralia does not yet have a first-class combat object registry, but spell data
 * already describes object targeting. This envelope lets callers validate an
 * object candidate without pretending it is a CombatCharacter.
 */
export interface TargetableObject {
    id: string;
    name: string;
    position: Position;
    size?: string;
    weightPounds?: number;
    isWornOrCarried?: boolean;
    isMagical?: boolean;
    isFixedToSurface?: boolean;
}
export interface TargetCandidateSet {
    creatures: CombatCharacter[];
    objects: TargetableObject[];
}
export interface TargetResolutionResult extends AllocationResult {
    /** Every creature that passed normal range, sight, plane, and filter checks before final allocation. */
    candidateTargets: CombatCharacter[];
    /** Whether an explicit targeting allocation rule changed the final target list. */
    allocationApplied: boolean;
}
export interface TargetRejectionReason {
    code: string;
    message: string;
}
/**
 * Resolves valid targets based on spell targeting rules
 */
export declare class TargetResolver {
    /**
     * Validate if a character can be targeted by this spell
     *
     * @param targeting - Spell targeting definition
     * @param caster - Character casting the spell
     * @param target - Potential target
     * @param gameState - Current combat state
     * @returns true if target is valid
     *
     * @example
     * const canTarget = TargetResolver.isValidTarget(
     *   spell.targeting,
     *   caster,
     *   enemy,
     *   gameState
     * )
     */
    static isValidTarget(targeting: SpellTargeting, caster: CombatCharacter, target: CombatCharacter, gameState: CombatState): boolean;
    /**
     * Explain why a creature target cannot be selected.
     *
     * The older API only returned true or false, which meant spell data could be
     * correct while the player, AI, and combat log had no shared language for an
     * illegal target. This method keeps the boolean API stable and adds a narrow
     * reason bridge for UI and runtime callers that need visible feedback.
     */
    static getTargetRejectionReason(targeting: SpellTargeting, caster: CombatCharacter, target: CombatCharacter, gameState: CombatState): TargetRejectionReason | null;
    /**
     * Get all valid targets in range
     *
     * @param targeting - Spell targeting definition
     * @param caster - Character casting the spell
     * @param gameState - Current combat state
     * @returns Array of valid target characters
     */
    static getValidTargets(targeting: SpellTargeting, caster: CombatCharacter, gameState: CombatState): CombatCharacter[];
    /**
     * Resolve the final creature targets for a spell.
     *
     * `getValidTargets` intentionally remains a candidate query because UI panels
     * and previews still need to show every legal target. This method is the
     * cast-time bridge: it first gathers those legal candidates, then applies
     * targeting allocation rules such as Sleep's hit-point pool.
     */
    static resolveTargets(targeting: SpellTargeting, caster: CombatCharacter, gameState: CombatState, allocationContext?: AllocatorContext): TargetResolutionResult;
    /**
     * Resolve a caller-provided list of already-valid creature candidates.
     *
     * Combat UI code often knows more than this generic resolver, such as the
     * exact clicked area footprint. This bridge lets that UI-selected candidate
     * set keep its area/shape meaning while still sharing the same pool allocation
     * logic used by resolver-driven callers.
     */
    static resolveTargetCandidates(targeting: SpellTargeting, candidateTargets: CombatCharacter[], allocationContext?: AllocatorContext): TargetResolutionResult;
    /**
     * Return valid creature and object candidates through one caller-facing API.
     *
     * Object discovery is intentionally dependency-injected for now. The spell
     * resolver should not invent battle-map objects from visual decorations, but
     * callers that already have object candidates can aggregate them with creature
     * targets through the same targeting rules.
     */
    static getValidTargetCandidates(targeting: SpellTargeting, caster: CombatCharacter, gameState: CombatState, objectCandidates?: TargetableObject[]): TargetCandidateSet;
    /**
     * Validate a non-creature object candidate against spell targeting rules.
     *
     * This intentionally stays separate from `isValidTarget` because object
     * candidates do not have creature teams, planar state, conditions, HP, or
     * creature taxonomy. It gives object-aware callers a real bridge while keeping
     * the existing character-target path stable.
     */
    static isValidObjectTarget(targeting: SpellTargeting, caster: CombatCharacter, targetObject: TargetableObject, gameState: CombatState): boolean;
    /**
     * Explain why a non-creature object candidate cannot be selected.
     *
     * Object-targeting spells often fail because of weight, size, ownership, or
     * map-sight rules. Returning a reason here gives the combat UI and AI a
     * shared rejection contract while preserving the existing boolean validator.
     */
    static getObjectTargetRejectionReason(targeting: SpellTargeting, caster: CombatCharacter, targetObject: TargetableObject, gameState: CombatState): TargetRejectionReason | null;
    /**
     * Calculate distance between two positions (Euclidean)
     */
    private static getDistance;
    /**
     * Check if there's line of sight between two positions
     */
    private static hasLineOfSight;
    private static canUseHearingAcquisition;
    /**
     * Check if target matches any of the valid filters
     */
    private static matchesTargetFilters;
    private static getTargetFilterRejectionReason;
    /**
     * Apply spell-data object gates to a runtime object envelope.
     *
     * Only concrete constraints are enforced. Missing or `not_applicable` fields
     * are treated as no restriction so partially specified legacy data remains
     * usable while structured spells can opt into stricter object gates.
     */
    private static matchesObjectEligibility;
    private static getObjectEligibilityRejectionReason;
    private static isObjectSizeAllowed;
    private static normalizeSizeLabel;
    /**
     * Check if two characters are allies
     */
    private static isAlly;
}
