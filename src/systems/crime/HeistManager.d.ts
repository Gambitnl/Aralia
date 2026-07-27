/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 07:55:30
 * Dependents: state/reducers/crimeReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/crime/HeistManager.ts
 * Core logic for managing active heists, alert levels, and turn-based resolution.
 */
import { HeistPlan, HeistAction, HeistRole, HeistIntel } from '../../types/crime';
import { Location } from '../../types';
export declare class HeistManager {
    /**
     * Initializes a new heist plan.
     */
    static startPlanning(target: Pick<Location, 'id'>, leaderId: string): HeistPlan;
    /**
     * Advances the heist to the next phase (Recon -> Planning -> Infiltration -> Execution -> Escape).
     */
    static advancePhase(plan: HeistPlan): HeistPlan;
    /**
     * Calculates the success chance of a specific action based on current alert level and approach.
     */
    static calculateActionSuccessChance(plan: HeistPlan, action: HeistAction, actorRole?: HeistRole): number;
    /**
     * Adds gathered intel to the plan, potentially revealing complications or lowering difficulty.
     */
    static addIntel(plan: HeistPlan, intel: HeistIntel): HeistPlan;
    /**
     * Assigns a role to a crew member in the heist plan.
     */
    static assignCrew(plan: HeistPlan, characterId: string, role: HeistRole): HeistPlan;
    /**
     * Resolves a single action within the heist (turn-based).
     */
    static performHeistAction(plan: HeistPlan, action: HeistAction, actorId: string, roll: number): {
        success: boolean;
        alertGenerated: number;
        updatedPlan: HeistPlan;
        message: string;
    };
}
