// @dependencies-start
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
// @dependencies-end

import {
    Crime,
    CrimeType,
    Bounty,
    HeatLevel,
    // TODO(lint-intent): 'StolenItem' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    StolenItem as _StolenItem
} from '../../types/crime';
// TODO(lint-intent): 'GameState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState as _GameState, NotorietyState } from '../../types';
import { generateId } from '../../utils/core/idGenerator';

const BOUNTY_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * CrimeSystem owns the shared calculations behind crimes, heat, and bounties.
 *
 * Reducers call this class when they need consistent crime tuning. Keeping the
 * bounty timing rules here means bounty creation and bounty cleanup use the
 * same game-clock contract instead of duplicating the numbers in UI or state
 * reducers.
 */
export class CrimeSystem {

    /**
     * Calculates the risk of a crime based on location and current heat.
     * @param locationId The ID of the location where the crime is occurring.
     * @param crimeType The type of crime.
     * @param currentNotoriety The player's current notoriety state.
     * @returns A risk score from 0-100 (percentage chance of being witnessed/caught).
     */
    static calculateRisk(
        locationId: string,
        crimeType: CrimeType,
        currentNotoriety: NotorietyState
    ): number {
        const baseRisk = this.getBaseRisk(crimeType);
        const locationHeat = currentNotoriety.localHeat[locationId] || 0;
        const globalHeatFactor = currentNotoriety.globalHeat * 0.2;

        // Higher heat means guards are more alert
        const totalRisk = baseRisk + (locationHeat * 0.5) + globalHeatFactor;

        // Cap risk at 95% (always a small chance of luck)
        return Math.min(95, Math.max(5, totalRisk));
    }

    /**
     * Determines the heat level enum based on a numeric heat value.
     */
    static getHeatLevel(heatValue: number): HeatLevel {
        if (heatValue < 10) return HeatLevel.Unknown;
        if (heatValue < 40) return HeatLevel.Suspected;
        if (heatValue < 80) return HeatLevel.Wanted;
        return HeatLevel.Hunted;
    }

    /**
     * Converts incoming crime severity into the canonical 0-100 scale.
     */
    static normalizeSeverity(severity: number): number {
        // Older callers use a 1-10 tabletop-style value, while newer crime
        // state stores a 1-100 value. Keep both accepted, then clamp the result
        // so downstream heat and bounty math share one bounded unit.
        const scaledSeverity = severity <= 10 ? severity * 10 : severity;
        return Math.max(0, Math.min(100, scaledSeverity));
    }

    /**
     * Calculates how much heat a crime adds from its normalized severity.
     */
    static calculateCrimeHeat(normalizedSeverity: number, witnessed: boolean): number {
        // Witnessed crimes should still cap at about +20 local heat for a max
        // severity event. Unwitnessed crimes leave a quieter rumor footprint.
        const multiplier = witnessed ? 0.2 : 0.1;
        return normalizedSeverity * multiplier;
    }

    /**
     * Generates a bounty for a committed crime.
     */
    static generateBounty(crime: Crime, victimId?: string): Bounty | null {
        // Only serious crimes generate bounties automatically
        if (crime.severity < 30) return null;

        let amount = crime.severity * 10;

        // Murder increases bounty significantly
        if (crime.type === CrimeType.Murder) {
            amount += 500;
        }

        return {
            id: generateId(),
            targetId: 'player', // Default to player for now
            issuerId: victimId || 'local_guard',
            amount: Math.floor(amount),
            conditions: crime.severity > 80 ? 'DeadOrAlive' : 'Alive',
            isActive: true,
            // Bounties expire on the in-game clock. Using the crime timestamp
            // keeps saves, reloads, and tests deterministic instead of tying
            // campaign law enforcement to the real machine clock.
            expiration: crime.timestamp + BOUNTY_DURATION_MS
        };
    }

    /**
     * Removes bounties whose in-game expiration time has passed.
     */
    static pruneExpiredBounties(state: NotorietyState, currentTimeMs: number): NotorietyState {
        const activeBounties = state.bounties.filter(bounty => {
            // Bounties without an expiration are durable story consequences.
            if (!bounty.expiration) return true;

            // Once the in-game clock reaches the expiration, the warrant is no
            // longer active enough to drive bounty hunters or UI risk.
            return bounty.expiration > currentTimeMs;
        });

        if (activeBounties.length === state.bounties.length) {
            return state;
        }

        return {
            ...state,
            bounties: activeBounties
        };
    }

    /**
     * Decays heat over time. Should be called periodically (e.g., on rest).
     */
    static decayHeat(state: NotorietyState, hoursPassed: number): NotorietyState {
        const decayRatePerHour = 1; // 1 point per hour
        const decayAmount = decayRatePerHour * hoursPassed;

        const newGlobalHeat = Math.max(0, state.globalHeat - (decayAmount * 0.1));
        const newLocalHeat: Record<string, number> = {};

        for (const [locId, heat] of Object.entries(state.localHeat)) {
            newLocalHeat[locId] = Math.max(0, heat - decayAmount);
        }

        return {
            ...state,
            globalHeat: newGlobalHeat,
            localHeat: newLocalHeat
        };
    }

    private static getBaseRisk(type: CrimeType): number {
        switch (type) {
            case CrimeType.Theft: return 20;
            case CrimeType.Vandalism: return 10;
            case CrimeType.Trespassing: return 30;
            case CrimeType.Assault: return 40;
            case CrimeType.Murder: return 60;
            case CrimeType.Smuggling: return 25;
            case CrimeType.Forgery: return 15;
            default: return 10;
        }
    }
}
