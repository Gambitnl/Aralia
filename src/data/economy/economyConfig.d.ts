/**
 * @file src/data/economy/economyConfig.ts
 * Global configuration for economic simulation, scoring, and balancing.
 */
export declare const ECONOMY_CONFIG: {
    profitability: {
        baseScore: number;
        originExportBonus: number;
        originImportPenalty: number;
        destinationImportBonus: number;
        destinationExportPenalty: number;
        eventHighPriceWeight: number;
        eventLowPriceWeight: number;
        riskDeductionMultiplier: number;
    };
    risk: {
        combatEventPenalty: number;
        festivalBonus: number;
    };
    simulation: {
        dailyEventChance: number;
        heatDecayPerHour: number;
        globalHeatDecayMultiplier: number;
    };
};
