/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 15:41:21
 * Dependents: hooks/combat/useActionExecutor.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/combat/reactions/OpportunityAttackSystem.ts
 * Logic for detecting and validating Opportunity Attacks (Attacks of Opportunity) in D&D 5e.
 *
 * Rules:
 * - Trigger: Hostile creature moves out of reach.
 * - Requirement: Attacker has Reaction available.
 * - Requirement: Attacker can see target.
 * - Requirement: Attacker is wielding a melee weapon.
 * - Prevention: Disengage action, Teleportation, Forced Movement.
 */
import { CombatCharacter, Position, BattleMapData } from '../../../types/combat';
export interface OpportunityAttackResult {
    canAttack: boolean;
    attackerId: string;
    targetId: string;
    triggerPosition: Position;
    triggerReach?: number;
    reason?: string;
}
type MovementMode = 'fly' | 'walk' | 'swim' | 'climb' | 'any';
export interface OpportunityAttackCheckOptions {
    movementMode?: MovementMode;
}
export declare class OpportunityAttackSystem {
    /**
     * Checks if a specific movement step triggers an Opportunity Attack.
     *
     * @param mover The character moving.
     * @param fromPos The tile the mover is leaving.
     * @param toPos The tile the mover is entering.
     * @param potentialAttackers List of all other characters in combat.
     * @param mapData Map data for Line of Sight checks.
     * @returns List of valid Opportunity Attacks triggered by this specific step.
     */
    checkOpportunityAttacks(mover: CombatCharacter, fromPos: Position, toPos: Position, potentialAttackers: CombatCharacter[], mapData?: BattleMapData | null, options?: OpportunityAttackCheckOptions): OpportunityAttackResult[];
    private isDisengaged;
    private hasSummonOpportunitySuppression;
    private getThreatenedReaches;
    private getTriggeredReach;
}
export {};
