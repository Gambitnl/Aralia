/**
 * @file src/data/economy/economyConfig.ts
 * Global configuration for economic simulation, scoring, and balancing.
 */

export const ECONOMY_CONFIG = {
    // Scoring weights for Trade Route Profitability
    profitability: {
        baseScore: 50,
        originExportBonus: 20,    // Buy cheap
        originImportPenalty: -20, // Buy expensive
        destinationImportBonus: 30, // Sell high
        destinationExportPenalty: -10, // Sell to producer
        eventHighPriceWeight: 40,  // Modifier for high demand events
        eventLowPriceWeight: 20,   // Modifier for surplus events
        riskDeductionMultiplier: 20 // How much risk level subtracts from total score
    },
    
    // Risk modifiers from global events
    risk: {
        combatEventPenalty: 0.2, // War/Bandits increase risk
        festivalBonus: -0.1      // Festivals/Stability decrease risk
    },

    // Daily simulation constants
    simulation: {
        dailyEventChance: 0.2,
        heatDecayPerHour: 1.0,
        globalHeatDecayMultiplier: 0.1
    }
};
