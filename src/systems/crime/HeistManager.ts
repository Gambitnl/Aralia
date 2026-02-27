// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:29:47
 * Dependents: crimeReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/crime/HeistManager.ts
 * Core logic for managing active heists, alert levels, and turn-based resolution.
 */

import { HeistPlan, HeistPhase, HeistAction, HeistActionType, HeistRole } from '../../types/crime';
import { Location } from '../../types';
import { SeededRandom } from '@/utils/random';
import { generateId } from '../../utils/core/idGenerator';

export class HeistManager {

    /**
     * Initializes a new heist plan.
     */
    static startPlanning(target: Location, leaderId: string): HeistPlan {
        return {
            id: generateId(),
            targetLocationId: target.id,
            leaderId,
            participants: [leaderId],
            crew: [{ characterId: leaderId, role: HeistRole.Leader }],
            phase: HeistPhase.Recon,
            alertLevel: 0,
            maxAlertLevel: 100,
            turnsElapsed: 0,
            collectedIntel: [],
            intelGathered: [],
            approaches: [
                { type: 'Stealth', riskModifier: -10, timeModifier: 1.5, requiredSkills: ['Stealth', 'ThievesTools'] },
                { type: 'Force', riskModifier: 20, timeModifier: 0.5, requiredSkills: ['Athletics', 'Intimidation'] },
                { type: 'Deception', riskModifier: 0, timeModifier: 1.0, requiredSkills: ['Deception', 'Persuasion'] }
            ],
            selectedApproach: null,
            lootSecured: [],
            complications: []
        };
    }

    /**
     * Advances the heist to the next phase (Recon -> Planning -> Infiltration -> Execution -> Escape).
     */
    static advancePhase(plan: HeistPlan): HeistPlan {
        let nextPhase: HeistPhase | `${HeistPhase}` = plan.phase;

        switch (plan.phase) {
            case 'Recon':
                nextPhase = 'Planning';
                break;
            case 'Planning':
                if (!plan.selectedApproach) throw new Error("Cannot start heist without selecting an approach.");
                nextPhase = 'Infiltration';
                break;
            case 'Infiltration':
                nextPhase = 'Execution';
                break;
            case 'Execution':
                nextPhase = 'Escape';
                break;
            case 'Escape':
                nextPhase = 'Complete';
                break;
        }

        return { ...plan, phase: nextPhase };
    }

    /**
     * Calculates the success chance of a specific action based on current alert level and approach.
     */
    static calculateActionSuccessChance(plan: HeistPlan, action: HeistAction, actorRole?: HeistRole): number {
        let baseChance = 100 - action.difficulty; // DC 15 -> 85% base

        // Alert Level Penalty: -1% per point of alert
        baseChance -= plan.alertLevel;

        // Approach Modifiers
        if (plan.selectedApproach) {
            if (plan.selectedApproach.type === 'Stealth' && action.type === HeistActionType.Sneak) {
                baseChance += 10;
            } else if (plan.selectedApproach.type === 'Force' && action.type === HeistActionType.Combat) {
                baseChance += 10;
            }
        }

        // Role Bonus (Preservationist: Ensuring roles matter)
        if (actorRole && action.requiredRole === actorRole) {
            baseChance += 25; // Significant bonus for correct specialist
        }

        return Math.max(5, Math.min(95, baseChance));
    }

    /**
     * Adds gathered intel to the plan, potentially revealing complications or lowering difficulty.
     */
    static addIntel(plan: HeistPlan, intel: any): HeistPlan {
        // Mock logic: Intel reduces starting alert or reveals hidden routes
        return {
            ...plan,
            collectedIntel: [...plan.collectedIntel, intel],
            intelGathered: [...(plan.intelGathered ?? plan.collectedIntel), intel]
        };
    }

    /**
     * Assigns a role to a crew member in the heist plan.
     */
    static assignCrew(plan: HeistPlan, characterId: string, role: HeistRole): HeistPlan {
        const currentCrew = [...plan.crew];
        const index = currentCrew.findIndex(c => c.characterId === characterId);

        if (index >= 0) {
            currentCrew[index] = { ...currentCrew[index], role };
        } else {
            currentCrew.push({ characterId, role });
        }

        const participants = Array.from(new Set([...(plan.participants || []), characterId]));

        return {
            ...plan,
            crew: currentCrew,
            participants
        };
    }

    /**
     * Resolves a single action within the heist (turn-based).
     */
    static performHeistAction(
        plan: HeistPlan,
        action: HeistAction,
        actorId: string,
        roll: number
    ): {
        success: boolean;
        alertGenerated: number;
        updatedPlan: HeistPlan;
        message: string;
    } {
        const actor = plan.crew.find(c => c.characterId === actorId);
        const successChance = this.calculateActionSuccessChance(plan, action, actor?.role);

        // Simple d100 check vs percentage chance
        const isSuccess = roll <= successChance;
        let alertGenerated = 0;
        let message = '';

        if (isSuccess) {
            alertGenerated = action.noise;
            message = `Success! ${action.description} executed without raising alarm.`;
        } else {
            alertGenerated = action.risk;
            message = `Failure! ${action.description} caused a disturbance. Alert +${alertGenerated}`;

            // Lookout Mitigation (Updated to flat -5 reduction per test)
            const lookout = plan.crew.find(c => c.role === HeistRole.Lookout && c.characterId !== actorId);
            if (lookout) {
                const reduction = 5;
                alertGenerated = Math.max(0, alertGenerated - reduction);
                message += ` (Lookout reduced alert to +${alertGenerated})`;
            }
        }

        const updatedPlan: HeistPlan = {
            ...plan,
            alertLevel: Math.min(plan.maxAlertLevel, plan.alertLevel + alertGenerated),
            turnsElapsed: plan.turnsElapsed + 1
        };

        return {
            success: isSuccess,
            alertGenerated,
            updatedPlan,
            message
        };
    }
}
