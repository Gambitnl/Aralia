/**
 * @file src/services/legacyService.ts
 * Service for managing player legacy, titles, and monuments.
 */
import { PlayerLegacy, SuccessionResult } from '../types/legacy';
import { Stronghold } from '../types/stronghold';
import { Organization } from '../types/organizations';
/**
 * Initializes a new Player Legacy.
 */
export declare const initializeLegacy: (familyName: string) => PlayerLegacy;
/**
 * Grants a new title to the legacy.
 */
export declare const grantTitle: (legacy: PlayerLegacy, titleName: string, description: string, grantedBy?: string) => PlayerLegacy;
/**
 * Records the construction of a monument.
 */
export declare const recordMonument: (legacy: PlayerLegacy, name: string, description: string, locationId: string, cost: number) => PlayerLegacy;
/**
 * Registers a new heir to the dynasty.
 */
export declare const registerHeir: (legacy: PlayerLegacy, name: string, relation: string, age: number, heirClass?: string) => PlayerLegacy;
/**
 * Calculates a numerical score representing the total impact of the legacy.
 */
export declare const calculateLegacyScore: (legacy: PlayerLegacy) => number;
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
 * @param dateProvider Optional function to provide the current date (for testing).
 */
export declare const processSuccession: (legacy: PlayerLegacy, characterGold: number, heirId: string, isRetirement?: boolean, strongholds?: Stronghold[], organizations?: Organization[], dateProvider?: () => Date) => {
    updatedLegacy: PlayerLegacy;
    result: SuccessionResult;
};
/**
 * Retires the current character, triggering a peaceful succession.
 */
export declare const retireCharacter: (legacy: PlayerLegacy, characterGold: number, heirId: string, strongholds?: Stronghold[], organizations?: Organization[]) => {
    updatedLegacy: PlayerLegacy;
    result: SuccessionResult;
};
