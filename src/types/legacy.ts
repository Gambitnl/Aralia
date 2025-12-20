/**
 * @file src/types/legacy.ts
 * Type definitions for the Legacy system (succession, titles, reputation).
 */

export interface Title {
    id: string;
    name: string;
    description: string;
    dateAcquired: number;
    grantedBy?: string;
}

export interface Monument {
    id: string;
    name: string;
    description: string;
    locationId: string;
    dateConstructed: number;
    cost: number;
}

export interface Heir {
    id: string;
    name: string;
    relation: string; // e.g. "Child", "Apprentice", "Rival"
    age: number;
    class?: string;
    isDesignatedHeir: boolean;
}

export interface LegacyReputation {
    fame: number;
    honor: number;
    infamy: number;
    history: string[];
}

export interface PlayerLegacy {
    familyName: string; // or Dynasty Name
    strongholdIds: string[];
    organizationIds: string[];
    titles: Title[];
    heirs: Heir[];
    monuments: Monument[];
    reputation: LegacyReputation;
    totalPlayTime: number; // minutes
    legacyScore: number;
}

/**
 * Result of a succession process.
 */
export interface SuccessionResult {
    success: boolean;
    heirId: string;
    inheritanceTaxPaid: number;
    assetsTransferred: {
        gold: number;
        strongholds: string[];
        organizations: string[];
    };
    assetsLost: {
        gold: number;
        strongholds: string[]; // Strongholds lost due to tax/instability
    };
    legacyScore: number;
    log: string[];
}
