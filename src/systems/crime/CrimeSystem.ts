
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
            id: crypto.randomUUID(),
            targetId: 'player', // Default to player for now
            issuerId: victimId || 'local_guard',
            amount: Math.floor(amount),
            conditions: crime.severity > 80 ? 'DeadOrAlive' : 'Alive',
            isActive: true,
            expiration: Date.now() + (1000 * 60 * 60 * 24 * 7) // 7 days
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
