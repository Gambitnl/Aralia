/**
 * @file src/systems/crime/HeistManager.ts
 * Core logic for managing active heists, alert levels, and turn-based resolution.
 */

import { HeistPlan, HeistPhase, HeistAction, HeistActionType } from '../../types/crime';
import { Location } from '../../types';
import { SeededRandom } from '@/utils/random';

export class HeistManager {
    
    /**
     * Initializes a new heist plan.
     */
    static startPlanning(target: Location, leaderId: string): HeistPlan {
        return {
            id: crypto.randomUUID(),
            targetLocationId: target.id,
            leaderId,
            participants: [leaderId],
            phase: 'Planning',
            alertLevel: 0,
            turnsElapsed: 0,
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
     * Advances the heist to the next phase (Planning -> Infiltration -> Execution -> Escape).
     */
    static advancePhase(plan: HeistPlan): HeistPlan {
        let nextPhase: HeistPhase = plan.phase;

        switch (plan.phase) {
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
    static calculateActionSuccessChance(plan: HeistPlan, action: HeistAction): number {
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

        return Math.max(5, Math.min(95, baseChance));
    }

    /**
     * Adds gathered intel to the plan, potentially revealing complications or lowering difficulty.
     */
    static addIntel(plan: HeistPlan, intel: any): HeistPlan {
        // Mock logic: Intel reduces starting alert or reveals hidden routes
        return {
            ...plan,
            intelGathered: [...plan.intelGathered, intel]
        };
    }
}