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
    relation: string;
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
    familyName: string;
    strongholdIds: string[];
    organizationIds: string[];
    titles: Title[];
    heirs: Heir[];
    monuments: Monument[];
    reputation: LegacyReputation;
    totalPlayTime: number;
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
        strongholds: string[];
        organizations: string[];
    };
    legacyScore: number;
    log: string[];
}
