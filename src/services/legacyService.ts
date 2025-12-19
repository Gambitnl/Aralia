/**
 * @file src/services/legacyService.ts
 * Service for managing player legacy, titles, and monuments.
 */

import { v4 as uuidv4 } from 'uuid';
import { PlayerLegacy, Title, Monument, Heir, LegacyReputation } from '../types/legacy';
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
        fame: legacy.reputation.fame + (cost / 100), // 1 Fame per 100 gold
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
