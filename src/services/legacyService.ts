/**
 * @file src/services/legacyService.ts
 * Service for managing player legacy, titles, and monuments.
 */

import { v4 as uuidv4 } from 'uuid';
import { PlayerLegacy, Title, Monument, Heir, LegacyReputation, SuccessionResult } from '../types/legacy';
import { Stronghold } from '../types/stronghold';
import { Organization } from '../types/organizations';

const INITIAL_REPUTATION: LegacyReputation = {
    fame: 0,
    honor: 0,
    infamy: 0,
    history: []
};

/**
 * Initializes a new Player Legacy.
 */
export const initializeLegacy = (familyName: string): PlayerLegacy => {
    return {
        familyName,
        strongholdIds: [],
        organizationIds: [],
        titles: [],
        heirs: [],
        monuments: [],
        reputation: { ...INITIAL_REPUTATION },
        totalPlayTime: 0,
        legacyScore: 0
    };
};

/**
 * Grants a new title to the legacy.
 */
export const grantTitle = (legacy: PlayerLegacy, titleName: string, description: string, grantedBy?: string): PlayerLegacy => {
    const newTitle: Title = {
        id: uuidv4(),
        name: titleName,
        description,
        dateAcquired: Date.now(),
        grantedBy
    };

    const updatedReputation = {
        ...legacy.reputation,
        fame: legacy.reputation.fame + 10,
        history: [...legacy.reputation.history, `Granted title '${titleName}' by ${grantedBy || 'unknown'}.`]
    };

    const updatedLegacy = {
        ...legacy,
        titles: [...legacy.titles, newTitle],
        reputation: updatedReputation
    };

    return {
        ...updatedLegacy,
        legacyScore: calculateLegacyScore(updatedLegacy)
    };
};

/**
 * Records the construction of a monument.
 */
export const recordMonument = (legacy: PlayerLegacy, name: string, description: string, locationId: string, cost: number): PlayerLegacy => {
    const newMonument: Monument = {
        id: uuidv4(),
        name,
        description,
        locationId,
        dateConstructed: Date.now(),
        cost
    };

    const updatedReputation = {
        ...legacy.reputation,
        fame: legacy.reputation.fame + Math.floor(cost / 100), // 1 Fame per 100 gold
        history: [...legacy.reputation.history, `Constructed '${name}' in ${locationId}.`]
    };

    const updatedLegacy = {
        ...legacy,
        monuments: [...legacy.monuments, newMonument],
        reputation: updatedReputation
    };

    return {
        ...updatedLegacy,
        legacyScore: calculateLegacyScore(updatedLegacy)
    };
};

/**
 * Registers a new heir to the dynasty.
 */
export const registerHeir = (legacy: PlayerLegacy, name: string, relation: string, age: number, heirClass?: string): PlayerLegacy => {
    const newHeir: Heir = {
        id: uuidv4(),
        name,
        relation,
        age,
        class: heirClass,
        isDesignatedHeir: legacy.heirs.length === 0 // First heir is designated by default
    };

    const updatedLegacy = {
        ...legacy,
        heirs: [...legacy.heirs, newHeir]
    };

    return {
        ...updatedLegacy,
        legacyScore: calculateLegacyScore(updatedLegacy)
    };
};

/**
 * Calculates a numerical score representing the total impact of the legacy.
 */
export const calculateLegacyScore = (legacy: PlayerLegacy): number => {
    let score = 0;

    // Titles
    score += legacy.titles.length * 50;

    // Strongholds (assuming ids are valid)
    score += legacy.strongholdIds.length * 100;

    // Organizations
    score += legacy.organizationIds.length * 75;

    // Monuments (based on cost)
    score += legacy.monuments.reduce((acc, m) => acc + Math.floor(m.cost / 100), 0);

    // Reputation
    score += legacy.reputation.fame;
    score += Math.abs(legacy.reputation.infamy); // Infamy counts towards impact!

    // Heirs
    score += legacy.heirs.length * 25;

    return Math.floor(score);
};

// --- Succession System ---

/**
 * Processes the succession from a deceased/retired character to an heir.
 * Calculates tax, asset transfer, and updates the legacy.
 *
 * @param legacy The current player legacy state.
 * @param characterGold The gold held by the deceased/retired character.
 * @param heirId The ID of the heir taking over.
 * @param isRetirement Whether this is a voluntary retirement (lower tax) or death.
 * @param strongholds Optional list of strongholds to check for loyalty/stability.
 * @param organizations Optional list of organizations to check for loyalty.
 */
export const processSuccession = (
    legacy: PlayerLegacy,
    characterGold: number,
    heirId: string,
    isRetirement: boolean = false,
    strongholds: Stronghold[] = [],
    organizations: Organization[] = []
): { updatedLegacy: PlayerLegacy; result: SuccessionResult } => {
    const heir = legacy.heirs.find(h => h.id === heirId);
    if (!heir) {
        throw new Error(`Heir with ID ${heirId} not found.`);
    }

    const log: string[] = [];
    log.push(`Beginning succession to ${heir.name} (${heir.relation}).`);

    // 1. Calculate Inheritance Tax
    // Base Tax: 10% (Retirement) or 20% (Death)
    let taxRate = isRetirement ? 0.10 : 0.20;

    // Reputation Modifiers
    if (legacy.reputation.infamy > legacy.reputation.fame) {
        taxRate += 0.05; // Infamy penalty
        log.push("High infamy increased inheritance tax by 5%.");
    }
    if (legacy.reputation.honor > 50) {
        taxRate -= 0.05; // Honor bonus
        log.push("High honor reduced inheritance tax by 5%.");
    }

    // Cap tax between 0% and 50%
    taxRate = Math.max(0, Math.min(0.5, taxRate));

    const taxAmount = Math.floor(characterGold * taxRate);
    const goldTransferred = characterGold - taxAmount;

    log.push(`Inheritance Tax Rate: ${(taxRate * 100).toFixed(0)}%. Tax Paid: ${taxAmount}. Transferred: ${goldTransferred}.`);

    // 2. Asset Stability Check (Strongholds)
    const transferredStrongholds: string[] = [];
    const lostStrongholds: string[] = [];

    // Only process strongholds that are part of this legacy
    const relevantStrongholds = strongholds.filter(s => legacy.strongholdIds.includes(s.id));

    // If no strongholds provided but IDs exist, we assume they transfer blindly (or caller should have provided them)
    // Here we iterate through the IDs we have. If we have the object, we check loyalty. If not, we assume safe transfer (fallback).
    for (const sId of legacy.strongholdIds) {
        const stronghold = relevantStrongholds.find(s => s.id === sId);
        if (!stronghold) {
            // Data not provided, assume safe transfer
            transferredStrongholds.push(sId);
            continue;
        }

        // Calculate stability chance
        // Base 70% + Avg Loyalty * 0.3
        const avgLoyalty = stronghold.staff.length > 0
            ? stronghold.staff.reduce((sum, s) => sum + s.morale, 0) / stronghold.staff.length
            : 100; // No staff = stable (nobody to revolt)

        const stabilityChance = 70 + (avgLoyalty * 0.3);
        const roll = Math.floor(Math.random() * 100) + 1;

        if (roll <= stabilityChance || isRetirement) {
            transferredStrongholds.push(sId);
        } else {
            lostStrongholds.push(sId);
            log.push(`Lost stronghold '${stronghold.name}' due to instability/revolt during transition.`);
        }
    }

    // 3. Asset Stability Check (Organizations)
    const transferredOrgs: string[] = [];
    // Organization logic similar to strongholds could be added here.
    // For now, Organizations transfer 100% if retirement, 80% chance if death.
    for (const oId of legacy.organizationIds) {
        const org = organizations.find(o => o.id === oId);
        const roll = Math.floor(Math.random() * 100) + 1;

        // If we have org data, use loyalty, else flat check
        const chance = isRetirement ? 100 : 80;

        if (roll <= chance) {
            transferredOrgs.push(oId);
        } else {
            log.push(`Lost control of organization ${org ? "'" + org.name + "'" : oId} during transition.`);
        }
    }

    // 4. Update Legacy
    // The heir becomes the new "head", but the Legacy object tracks the history.
    // We add an entry to history about the succession.

    const newHistory = [
        ...legacy.reputation.history,
        `Succession: ${heir.name} took over from the previous generation on ${new Date().toLocaleDateString()}.`
    ];

    if (isRetirement) {
        newHistory.push("The transition was peaceful (Retirement).");
    } else {
        newHistory.push("The transition followed the death of the patriarch/matriarch.");
    }

    const updatedLegacy: PlayerLegacy = {
        ...legacy,
        strongholdIds: transferredStrongholds,
        organizationIds: transferredOrgs,
        reputation: {
            ...legacy.reputation,
            history: newHistory
        },
        // Remove the heir from the list? Or keep them as "current"?
        // Usually, the "heirs" list represents potential successors. The active character is not in the list.
        heirs: legacy.heirs.filter(h => h.id !== heirId)
    };

    // Recalculate score
    updatedLegacy.legacyScore = calculateLegacyScore(updatedLegacy);

    const result: SuccessionResult = {
        success: true,
        heirId,
        inheritanceTaxPaid: taxAmount,
        assetsTransferred: {
            gold: goldTransferred,
            strongholds: transferredStrongholds,
            organizations: transferredOrgs
        },
        assetsLost: {
            gold: taxAmount,
            strongholds: lostStrongholds
        },
        legacyScore: updatedLegacy.legacyScore,
        log
    };

    return { updatedLegacy, result };
};

/**
 * Retires the current character, triggering a peaceful succession.
 */
export const retireCharacter = (
    legacy: PlayerLegacy,
    characterGold: number,
    heirId: string,
    strongholds: Stronghold[] = [],
    organizations: Organization[] = []
): { updatedLegacy: PlayerLegacy; result: SuccessionResult } => {
    return processSuccession(legacy, characterGold, heirId, true, strongholds, organizations);
};
