/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 01:21:23
 * Dependents: state/reducers/crimeReducer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Crime, CrimeType, Bounty, HeatLevel } from '../../types/crime';
import { NotorietyState } from '../../types';
/**
 * CrimeSystem owns the shared calculations behind crimes, heat, and bounties.
 *
 * Reducers call this class when they need consistent crime tuning. Keeping the
 * bounty timing rules here means bounty creation and bounty cleanup use the
 * same game-clock contract instead of duplicating the numbers in UI or state
 * reducers.
 */
export declare class CrimeSystem {
    /**
     * Calculates the risk of a crime based on location and current heat.
     * @param locationId The ID of the location where the crime is occurring.
     * @param crimeType The type of crime.
     * @param currentNotoriety The player's current notoriety state.
     * @returns A risk score from 0-100 (percentage chance of being witnessed/caught).
     */
    static calculateRisk(locationId: string, crimeType: CrimeType, currentNotoriety: NotorietyState): number;
    /**
     * Determines the heat level enum based on a numeric heat value.
     */
    static getHeatLevel(heatValue: number): HeatLevel;
    /**
     * Converts incoming crime severity into the canonical 0-100 scale.
     */
    static normalizeSeverity(severity: number): number;
    /**
     * Calculates how much heat a crime adds from its normalized severity.
     */
    static calculateCrimeHeat(normalizedSeverity: number, witnessed: boolean): number;
    /**
     * Generates a bounty for a committed crime.
     */
    static generateBounty(crime: Crime, victimId?: string): Bounty | null;
    /**
     * Removes bounties whose in-game expiration time has passed.
     */
    static pruneExpiredBounties(state: NotorietyState, currentTimeMs: number): NotorietyState;
    /**
     * Decays heat over time. Should be called periodically (e.g., on rest).
     */
    static decayHeat(state: NotorietyState, hoursPassed: number): NotorietyState;
    private static getBaseRisk;
}
