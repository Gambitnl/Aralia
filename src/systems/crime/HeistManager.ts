
import {
    HeistPlan,
    HeistPhase,
    HeistIntel,
    StolenItem,
    CrimeType
} from '../../types/crime';
import { Location } from '../../types';

export class HeistManager {

    /**
     * Initializes a new heist plan for a target location.
     */
    static startPlanning(
        targetLocation: Location,
        leaderId: string
    ): HeistPlan {
        return {
            id: crypto.randomUUID(),
            targetLocationId: targetLocation.id,
            phase: HeistPhase.Recon,
            leaderId,
            crew: [leaderId], // Leader starts alone
            collectedIntel: [],
            lootSecured: [],
            alertLevel: 0,
            turnsElapsed: 0
        };
    }

    /**
     * Adds gathered intel to the plan.
     */
    static addIntel(plan: HeistPlan, intel: HeistIntel): HeistPlan {
        // Prevent duplicate intel
        if (plan.collectedIntel.some(i => i.id === intel.id)) {
            return plan;
        }

        return {
            ...plan,
            collectedIntel: [...plan.collectedIntel, intel]
        };
    }

    /**
     * Advances the heist phase (e.g., Recon -> Planning).
     */
    static advancePhase(plan: HeistPlan): HeistPlan {
        let nextPhase = plan.phase;

        switch (plan.phase) {
            case HeistPhase.Recon:
                nextPhase = HeistPhase.Planning;
                break;
            case HeistPhase.Planning:
                nextPhase = HeistPhase.Execution;
                break;
            case HeistPhase.Execution:
                nextPhase = HeistPhase.Getaway;
                break;
            case HeistPhase.Getaway:
                nextPhase = HeistPhase.Cooldown;
                break;
        }

        return {
            ...plan,
            phase: nextPhase
        };
    }

    /**
     * Calculates the success chance of a specific heist action based on plan quality.
     */
    static calculateActionSuccessChance(
        plan: HeistPlan,
        actionDifficulty: number
    ): number {
        // Base chance starts at 50%
        let chance = 50;

        // Intel bonuses
        const relevantIntelCount = plan.collectedIntel.length;
        chance += (relevantIntelCount * 10); // +10% per piece of intel

        // Alert level penalty
        chance -= (plan.alertLevel * 2); // -2% per alert level

        // Difficulty penalty
        chance -= actionDifficulty;

        return Math.min(95, Math.max(5, chance));
    }
}
