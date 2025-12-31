
import {
    HeistPlan,
    HeistPhase,
    HeistIntel,
    HeistRole,
    HeistAction,
    HeistCrewMember,
    // TODO(lint-intent): 'StolenItem' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    StolenItem as _StolenItem
} from '../../types/crime';
import { Location } from '../../types';

export interface HeistActionResult {
    success: boolean;
    alertGenerated: number;
    message: string;
    updatedPlan: HeistPlan;
}

export class HeistManager {

    /**
     * Initializes a new heist plan for a target location.
     */
    static startPlanning(
        targetLocation: Location,
        leaderId: string
    ): HeistPlan {
        const leader: HeistCrewMember = {
            characterId: leaderId,
            role: HeistRole.Leader
        };

        return {
            id: crypto.randomUUID(),
            targetLocationId: targetLocation.id,
            phase: HeistPhase.Recon,
            leaderId,
            crew: [leader],
            collectedIntel: [],
            lootSecured: [],
            alertLevel: 0,
            turnsElapsed: 0,
            maxAlertLevel: 100 // Default threshold
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
     * Assigns a crew member to a role. Adds them if not present, updates role if they are.
     */
    static assignCrew(plan: HeistPlan, characterId: string, role: HeistRole): HeistPlan {
        const existingMemberIndex = plan.crew.findIndex(c => c.characterId === characterId);
        // TODO(lint-intent): This binding never reassigns, so the intended mutability is unclear.
        // TODO(lint-intent): If it should stay stable, switch to const and treat it as immutable.
        // TODO(lint-intent): If mutation was intended, add the missing update logic to reflect that intent.
        const newCrew = [...plan.crew];
        if (existingMemberIndex >= 0) {
            newCrew[existingMemberIndex] = { characterId, role };
        } else {
            newCrew.push({ characterId, role });
        }

        return {
            ...plan,
            crew: newCrew
        };
    }

    /**
     * Removes a crew member from the plan.
     */
    static removeCrew(plan: HeistPlan, characterId: string): HeistPlan {
        // Cannot remove leader
        if (characterId === plan.leaderId) return plan;

        return {
            ...plan,
            crew: plan.crew.filter(c => c.characterId !== characterId)
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
     * Performs a specific heist action.
     * @param plan Current heist plan
     * @param action The action being attempted
     * @param actorId The character performing the action
     * @param rollResult Optional manual roll result (0-100) for deterministic testing
     */
    static performHeistAction(
        plan: HeistPlan,
        action: HeistAction,
        actorId: string,
        rollResult?: number
    ): HeistActionResult {
        const actor = plan.crew.find(c => c.characterId === actorId);
        if (!actor) {
            throw new Error(`Actor ${actorId} is not part of the crew.`);
        }

        const successChance = this.calculateActionSuccessChance(plan, action, actor.role);
        const roll = rollResult !== undefined ? rollResult : Math.random() * 100;
        const success = roll <= successChance;

        let alertGenerated = 0;
        let message = '';

        if (success) {
            alertGenerated = action.noise; // Even success can be loud
            message = `Success! ${actorId} performed ${action.type}: ${action.description}`;
        } else {
            alertGenerated = action.risk;
            message = `Failure! ${actorId} botched ${action.type}. Alert increased by ${action.risk}.`;
        }

        // Apply alert modifiers based on role (Lookouts reduce alert gain)
        const lookouts = plan.crew.filter(c => c.role === HeistRole.Lookout);
        if (lookouts.length > 0 && alertGenerated > 0) {
            const reduction = lookouts.length * 5; // -5 alert per lookout
            alertGenerated = Math.max(0, alertGenerated - reduction);
            if (alertGenerated < action.risk && !success) {
                message += ` (Lookout mitigated alert)`;
            }
        }

        const newAlertLevel = Math.min(100, plan.alertLevel + alertGenerated);

        const updatedPlan: HeistPlan = {
            ...plan,
            alertLevel: newAlertLevel,
            turnsElapsed: plan.turnsElapsed + 1
        };

        return {
            success,
            alertGenerated,
            message,
            updatedPlan
        };
    }

    /**
     * Calculates the success chance of a specific heist action based on plan quality and role.
     */
    static calculateActionSuccessChance(
        plan: HeistPlan,
        action: HeistAction,
        actorRole?: HeistRole
    ): number {
        // Base chance starts at 50%
        let chance = 50;

        // Intel bonuses
        const relevantIntelCount = plan.collectedIntel.length;
        chance += (relevantIntelCount * 10); // +10% per piece of intel

        // Role Bonus
        if (action.requiredRole && actorRole === action.requiredRole) {
            chance += 25; // Significant bonus for correct specialist
        } else if (actorRole === HeistRole.Leader) {
             chance += 10; // Leader is generally competent
        }

        // Alert level penalty
        chance -= (plan.alertLevel * 0.5); // -0.5% per alert level (reduced form 2% to make it less punishing)

        // Difficulty penalty
        chance -= action.difficulty;

        return Math.min(95, Math.max(5, chance));
    }

    /**
     * Calculates the final results of a completed heist.
     */
    static resolveHeist(plan: HeistPlan): { totalValue: number, heatGenerated: number, xp: number } {
        const totalValue = plan.lootSecured.reduce((sum, item) => sum + item.value, 0);

        // Heat calculation
        // Base heat based on alert level
        let heatGenerated = Math.floor(plan.alertLevel / 10);

        // Bonus heat for value stolen
        if (totalValue > 1000) heatGenerated += 1;
        if (totalValue > 5000) heatGenerated += 2;

        // XP Calculation
        const xp = (totalValue / 10) + (100 - plan.alertLevel);

        return {
            totalValue,
            heatGenerated,
            xp: Math.floor(xp)
        };
    }
}
