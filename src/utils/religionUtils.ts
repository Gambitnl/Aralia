
import {
    Deity,
    DivineFavor,
    DeityAction,
    Temple,
    TempleService
} from '../types';
import { DEITIES } from '../data/deities';

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
    if (playerGold < service.costGp) {
        return { allowed: false, reason: 'Insufficient gold.' };
    }
    if (service.minFavor && currentFavor < service.minFavor) {
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
    // Some services might only be visible to faithful.
    // For now, we return all, but disable ones they can't use in UI.
    return temple.services;
};

/**
 * Gets a deity by ID.
 */
export const getDeity = (id: string): Deity | undefined => {
    return DEITIES.find(d => d.id === id);
};
