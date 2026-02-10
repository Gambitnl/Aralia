/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/BusinessSimulation.ts
 * Static utility class for daily business simulation.
 * Processes revenue, supply chains, competition, staff efficiency,
 * and customer satisfaction for player-owned businesses.
 */

import { BusinessState, BusinessMetrics, BusinessDailyReport } from '../../types/business';
import { EconomyState, TradeRoute } from '../../types/economy';
import { Faction } from '../../types/factions';
import { Stronghold } from '../../types/stronghold';
import { BUSINESS_TEMPLATES } from '../../data/economy/businessTemplates';
import { SeededRandom } from '@/utils/random';

export interface BusinessDailyResult {
    business: BusinessState;
    stronghold: Stronghold;
    report: BusinessDailyReport;
}

export interface AllBusinessesResult {
    businesses: Record<string, BusinessState>;
    strongholds: Record<string, Stronghold>;
    reports: BusinessDailyReport[];
}

/**
 * Processes daily simulation for a single business.
 */
export const processBusinessDaily = (
    business: BusinessState,
    stronghold: Stronghold,
    economy: EconomyState,
    factions: Record<string, Faction>,
    gameDay: number,
    rng: SeededRandom
): BusinessDailyResult => {
    const template = BUSINESS_TEMPLATES[business.businessType];
    if (!template) {
        // Unknown business type — return unchanged
        return { business, stronghold, report: business.lastDailyReport };
    }

    // 1. Calculate supply chain health
    const supplyHealth = calculateSupplyChainHealth(business, economy.tradeRoutes);

    // 2. Calculate staff efficiency (from stronghold staff morale)
    const staffEfficiency = calculateStaffEfficiency(stronghold, template.staffSlotsNeeded);

    // 3. Simulate competition pressure
    const competitorPressure = simulateCompetition(business, factions, rng);

    // 4. Calculate customer satisfaction (derived metric)
    const customerSatisfaction = calculateCustomerSatisfaction(
        business,
        supplyHealth,
        staffEfficiency,
        competitorPressure
    );

    // 5. Calculate daily customers
    const baseCustomers = business.dailyCustomers;
    const satisfactionMod = customerSatisfaction / 100; // 0-1
    const reputationMod = 0.5 + (business.metrics.reputation / 200); // 0.5-1.0
    const randomVariation = 0.85 + rng.next() * 0.3; // 0.85-1.15
    const actualCustomers = Math.round(baseCustomers * satisfactionMod * reputationMod * randomVariation);

    // 6. Calculate revenue
    const revenue = calculateDailyRevenue(business, actualCustomers, economy);

    // 7. Calculate costs
    const costs = calculateDailyCosts(business, stronghold, template);

    // 8. Profit and treasury impact
    const profit = revenue - costs;

    // 9. Update stronghold resources
    const updatedResources = {
        ...stronghold.resources,
        gold: stronghold.resources.gold + profit
    };

    // 10. Update metrics (gradual drift)
    const updatedMetrics: BusinessMetrics = {
        customerSatisfaction: clampMetric(customerSatisfaction),
        reputation: clampMetric(driftMetric(business.metrics.reputation, customerSatisfaction > 60 ? 1 : -1)),
        competitorPressure: clampMetric(competitorPressure),
        supplyChainHealth: clampMetric(supplyHealth),
        staffEfficiency: clampMetric(staffEfficiency)
    };

    // 11. Generate report issues
    const supplyIssues: string[] = [];
    const staffIssues: string[] = [];
    const competitorActions: string[] = [];

    if (supplyHealth < 40) {
        supplyIssues.push('Supply deliveries are unreliable. Consider securing new contracts.');
    }
    if (staffEfficiency < 30) {
        staffIssues.push('Staff morale is dangerously low. Business quality is suffering.');
    }
    if (competitorPressure > 70) {
        competitorActions.push('Competitors are aggressively undercutting your prices.');
    }

    // 12. Customers lost to poor satisfaction
    const customersLost = customerSatisfaction < 50
        ? Math.round(actualCustomers * (1 - customerSatisfaction / 100) * 0.3)
        : 0;

    const report: BusinessDailyReport = {
        day: gameDay,
        revenue: Math.round(revenue * 100) / 100,
        costs: Math.round(costs * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        customersSatisfied: actualCustomers - customersLost,
        customersLost,
        supplyIssues,
        competitorActions,
        staffIssues
    };

    return {
        business: {
            ...business,
            metrics: updatedMetrics,
            lastDailyReport: report
        },
        stronghold: {
            ...stronghold,
            resources: updatedResources
        },
        report
    };
};

/**
 * Process all player businesses for a daily tick.
 */
export const processAllBusinesses = (
    businesses: Record<string, BusinessState>,
    strongholds: Record<string, Stronghold>,
    economy: EconomyState,
    factions: Record<string, Faction>,
    gameDay: number,
    rng: SeededRandom
): AllBusinessesResult => {
    const updatedBusinesses = { ...businesses };
    const updatedStrongholds = { ...strongholds };
    const reports: BusinessDailyReport[] = [];

    for (const [strongholdId, business] of Object.entries(businesses)) {
        const stronghold = updatedStrongholds[strongholdId];
        if (!stronghold) continue;

        const result = processBusinessDaily(business, stronghold, economy, factions, gameDay, rng);
        updatedBusinesses[strongholdId] = result.business;
        updatedStrongholds[strongholdId] = result.stronghold;
        reports.push(result.report);
    }

    return { businesses: updatedBusinesses, strongholds: updatedStrongholds, reports };
};

/**
 * Calculates supply chain health based on supply contracts and trade route status.
 * A business with disrupted supply routes suffers.
 */
export const calculateSupplyChainHealth = (
    business: BusinessState,
    tradeRoutes: TradeRoute[]
): number => {
    if (business.supplyContracts.length === 0) {
        // No contracts — mediocre supply health (local sourcing assumed)
        return 50;
    }

    let totalReliability = 0;

    for (const contract of business.supplyContracts) {
        let contractHealth = contract.reliabilityScore;

        // Check if this contract depends on a trade route
        if (contract.tradeRouteId) {
            const route = tradeRoutes.find(r => r.id === contract.tradeRouteId);
            if (route) {
                if (route.status === 'disrupted') {
                    contractHealth *= 0.5; // 50% reliability hit
                } else if (route.status === 'blockaded') {
                    contractHealth *= 0.1; // 90% reliability hit
                }
            } else {
                contractHealth *= 0.3; // Route doesn't exist anymore
            }
        }

        totalReliability += contractHealth;
    }

    return Math.round(totalReliability / business.supplyContracts.length);
};

/**
 * Calculates staff efficiency from stronghold staff morale and count.
 */
const calculateStaffEfficiency = (
    stronghold: Stronghold,
    requiredStaff: number
): number => {
    if (stronghold.staff.length === 0) return 20; // Bare minimum — owner runs it alone

    // Average staff morale
    const avgMorale = stronghold.staff.reduce((sum, s) => sum + s.morale, 0) / stronghold.staff.length;

    // Staffing ratio (having enough staff matters)
    const staffingRatio = Math.min(1, stronghold.staff.length / requiredStaff);

    return Math.round(avgMorale * staffingRatio);
};

/**
 * Simulates competition from NPC businesses.
 * Returns pressure as 0-100 (higher = more competitor pressure on your business).
 */
const simulateCompetition = (
    business: BusinessState,
    _factions: Record<string, Faction>,
    rng: SeededRandom
): number => {
    // Base pressure from number of competitors
    const basePressure = Math.min(80, business.competitorIds.length * 15);

    // Random daily fluctuation (competitors run promotions, close shop, etc.)
    const dailyVariation = (rng.next() - 0.5) * 20; // -10 to +10

    // Low prices attract fewer competitors
    const priceMod = business.priceMultiplier < 1.0 ? -10 : business.priceMultiplier > 1.5 ? 10 : 0;

    return Math.round(
        driftMetric(business.metrics.competitorPressure, basePressure + dailyVariation + priceMod - business.metrics.competitorPressure > 0 ? 1 : -1)
    );
};

/**
 * Derives customer satisfaction from multiple factors.
 */
const calculateCustomerSatisfaction = (
    business: BusinessState,
    supplyHealth: number,
    staffEfficiency: number,
    competitorPressure: number
): number => {
    // Weighted average of factors
    const supplyWeight = 0.3;
    const staffWeight = 0.3;
    const priceWeight = 0.2;
    const competitionWeight = 0.2;

    // Price satisfaction: lower prices = happier customers
    const priceSatisfaction = Math.max(0, 100 - (business.priceMultiplier - 0.5) * 66);

    // Competition: less pressure = more satisfied
    const competitionSatisfaction = 100 - competitorPressure;

    const raw =
        supplyHealth * supplyWeight +
        staffEfficiency * staffWeight +
        priceSatisfaction * priceWeight +
        competitionSatisfaction * competitionWeight;

    // Smooth towards current value to avoid wild swings
    return driftMetric(business.metrics.customerSatisfaction, raw - business.metrics.customerSatisfaction > 0 ? 2 : -2);
};

/**
 * Calculates daily revenue from customers and pricing.
 */
const calculateDailyRevenue = (
    business: BusinessState,
    actualCustomers: number,
    economy: EconomyState
): number => {
    const template = BUSINESS_TEMPLATES[business.businessType];
    if (!template) return 0;

    const revenuePerCustomer = (template.baseDailyRevenue / template.baseCustomersPerDay) * business.priceMultiplier;

    // Apply inflation modifier
    const inflationMod = 1 + (economy.globalInflation || 0);

    return actualCustomers * revenuePerCustomer * inflationMod;
};

/**
 * Calculates daily operating costs.
 */
const calculateDailyCosts = (
    _business: BusinessState,
    stronghold: Stronghold,
    template: ReturnType<(typeof BUSINESS_TEMPLATES)[keyof typeof BUSINESS_TEMPLATES] extends infer T ? () => T : never>
): number => {
    // Base operating cost
    let costs = template.baseDailyCosts;

    // Staff wages
    for (const staff of stronghold.staff) {
        costs += staff.dailyWage;
    }

    return costs;
};

// --- Utility Helpers ---

const clampMetric = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Gradually moves a metric towards a target direction.
 * Prevents wild metric swings — business health changes slowly.
 */
const driftMetric = (current: number, direction: number): number => {
    return current + direction;
};
