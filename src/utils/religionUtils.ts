
import {
    Deity,
    DivineFavor,
    DeityAction,
    Temple,
    TempleService,
    Blessing
} from '../types';
import { DEITIES } from '../data/deities';
import { BLESSING_EFFECTS, getBlessingEffect, getBlessingDefinition, BlessingDefinition } from '../data/religion/blessings';
import { StatusEffect } from '../types/combat';

/**
 * Calculates the new favor level based on an action.
 * Favor is clamped between -100 and 100.
 */
export const calculateFavorChange = (
    currentFavor: DivineFavor,
    action: DeityAction
): DivineFavor => {
    let newFavorValue = currentFavor.favor + action.favorChange;
    // Clamp between -100 and 100
    newFavorValue = Math.max(-100, Math.min(100, newFavorValue));

    return {
        ...currentFavor,
        favor: newFavorValue,
        history: [
            ...currentFavor.history,
            {
                timestamp: Date.now(),
                reason: action.description,
                change: action.favorChange
            }
        ]
    };
};

/**
 * Resolves the full definition for a given blessing ID.
 */
export const resolveBlessingDefinition = (blessingId: string): BlessingDefinition | null => {
    return getBlessingDefinition(blessingId);
};

/**
 * Grants a blessing to the favor record.
 */
export const grantBlessing = (
    currentFavor: DivineFavor,
    blessing: Blessing
): DivineFavor => {
    return {
        ...currentFavor,
        blessings: [...currentFavor.blessings, blessing]
    };
};

/**
 * Resolves the status effect for a given blessing ID.
 */
export const resolveBlessingEffect = (blessingId: string): StatusEffect | null => {
    return getBlessingEffect(blessingId);
};

/**
 * Evaluates an action trigger against a deity's preferences.
 * Returns the DeityAction object if the deity cares about this trigger, or null.
 */
export const evaluateAction = (
    deityId: string,
    actionTrigger: string
): DeityAction | null => {
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
 * Returns the player's standing with a deity as a descriptive string.
 */
export const getDivineStanding = (favor: number): string => {
    if (favor >= 90) return 'Chosen';
    if (favor >= 50) return 'Devout';
    if (favor >= 10) return 'Follower';
    if (favor > -10) return 'Neutral';
    if (favor > -50) return 'Unfavored';
    if (favor > -90) return 'Shunned';
    return 'Enemy of the Faith';
};


/**
 * Checks if a player qualifies for a specific temple service.
 */
export const canAffordService = (
    service: TempleService,
    playerGold: number,
    currentFavor: number
): { allowed: boolean; reason?: string } => {
    const cost = service.costGp || 0;
    if (playerGold < cost) {
        return { allowed: false, reason: 'Insufficient gold.' };
    }
    const minFavor = service.minFavor || 0;
    if (currentFavor < minFavor) {
        return { allowed: false, reason: 'Insufficient divine favor.' };
    }
    return { allowed: true };
};

/**
 * Returns available services for a given deity/temple based on favor.
 */
export const getAvailableServices = (
    temple: Temple,
    currentFavor: number
): TempleService[] => {
    // Filter services that are objects (not IDs)
    // In a real app we might need to look up IDs.
    // For now assuming the temple has the full objects populated or we trust the caller.
    return temple.services.filter(s => typeof s !== 'string') as TempleService[];
};

/**
 * Gets a deity by ID.
 */
export const getDeity = (id: string): Deity | undefined => {
    return DEITIES.find(d => d.id === id);
};
