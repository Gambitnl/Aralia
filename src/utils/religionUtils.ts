
import {
    Deity,
    DivineFavor,
    DeityApproval,
    Temple,
    TempleService,
    FavorRank
} from '../types';
import { DEITIES } from '../data/deities';

// Helper interface for return values since DeityAction was removed/renamed to DeityApproval
interface ApprovalResult {
    description: string;
    favorChange: number;
}

/**
 * Calculates the new favor level based on an action.
 * Favor is clamped between -100 and 100.
 */
export const calculateFavorChange = (
    currentFavor: DivineFavor,
    action: { description: string; favorChange: number }
): DivineFavor => {
    let newScore = currentFavor.score + action.favorChange;
    // Clamp between -100 and 100
    newScore = Math.max(-100, Math.min(100, newScore));

    // Recalculate rank
    const newRank = getDivineStanding(newScore);

    return {
        ...currentFavor,
        score: newScore,
        rank: newRank,
        // Reset or increment consecutive days logic would go here, but for simple favor change:
        // We keep other props as is or update them.
        // Since we don't have history in the new type, we just return the new state.
    };
};

/**
 * Evaluates an action trigger against a deity's preferences.
 * Returns the approval result if the deity cares about this trigger, or null.
 */
export const evaluateAction = (
    deityId: string,
    actionTrigger: string
): ApprovalResult | null => {
    const deity = getDeity(deityId);
    if (!deity) return null;

    // Check approvals
    const approval = deity.approves.find(d => d.trigger === actionTrigger);
    if (approval) {
        return {
            description: approval.description,
            favorChange: approval.favorChange
        };
    }

    // Check forbiddances
    const forbiddance = deity.forbids.find(d => d.trigger === actionTrigger);
    if (forbiddance) {
        return {
            description: forbiddance.description,
            favorChange: forbiddance.favorChange
        };
    }

    return null;
};

/**
 * Returns the player's standing with a deity as a rank.
 */
export const getDivineStanding = (score: number): FavorRank => {
    if (score >= 90) return 'Chosen';
    if (score >= 50) return 'Champion'; // Or Devotee? Type has Champion.
    if (score >= 25) return 'Devotee';
    if (score >= 10) return 'Initiate';
    if (score > -10) return 'Neutral';
    if (score > -50) return 'Shunned';
    return 'Heretic';
};

/**
 * Checks if a player qualifies for a specific temple service.
 */
export const canAffordService = (
    service: TempleService,
    playerGold: number,
    currentFavor: number
): { allowed: boolean; reason?: string } => {
    if (service.requirement.goldCost && playerGold < service.requirement.goldCost) {
        return { allowed: false, reason: 'Insufficient gold.' };
    }
    if (service.requirement.minFavor && currentFavor < service.requirement.minFavor) {
        return { allowed: false, reason: 'Insufficient divine favor.' };
    }
    return { allowed: true };
};

/**
 * Gets a deity by ID.
 */
export const getDeity = (id: string): Deity | undefined => {
    return DEITIES.find(d => d.id === id);
};
