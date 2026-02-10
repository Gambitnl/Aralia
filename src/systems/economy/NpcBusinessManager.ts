/**
 * @file src/systems/economy/NpcBusinessManager.ts
 * Manages NPC-owned businesses: generation, daily simulation, valuation,
 * and bankruptcy tracking. NPC businesses exist independently of strongholds.
 */

import {
    WorldBusiness,
    BusinessType,
    BusinessMetrics,
    BusinessDailyReport,
    BusinessValuation,
} from '../../types/business';
import { EconomyState } from '../../types/economy';
import { Faction } from '../../types/factions';
import { BUSINESS_TEMPLATES } from '../../data/economy/businessTemplates';
import { calculateSupplyChainHealth } from './BusinessSimulation';
import { SeededRandom } from '@/utils/random';

// --- Business Name Generation ---

const TAVERN_ADJECTIVES = [
    'Rusty', 'Golden', 'Silver', 'Drunken', 'Jolly', 'Crooked', 'Blind',
    'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'
];
const TAVERN_NOUNS = [
    'Anvil', 'Dragon', 'Goat', 'Stag', 'Barrel', 'Tankard', 'Boar',
    'Crown', 'Shield', 'Serpent', 'Hound', 'Raven', 'Fox', 'Bear'
];
const SHOP_ADJECTIVES = [
    'Fine', 'Old', 'Grand', 'Humble', 'Arcane', 'Thorned', 'Ironbound',
    'Verdant', 'Gilded', 'Sturdy', 'Swift', 'Ancient', 'Bright', 'Shadowed'
];
const SHOP_NOUNS: Record<BusinessType, string[]> = {
    tavern: TAVERN_NOUNS,
    smithy: ['Forge', 'Anvil', 'Hammer', 'Blade', 'Crucible', 'Tongs'],
    apothecary: ['Remedy', 'Mortar', 'Brew', 'Tincture', 'Salve', 'Pestle'],
    general_store: ['Emporium', 'Provisions', 'Sundries', 'Goods', 'Market', 'Pantry'],
    trading_company: ['Ventures', 'Exchange', 'Consortium', 'Imports', 'Holdings'],
    mine: ['Shaft', 'Vein', 'Hollow', 'Pit', 'Delve', 'Quarry'],
    farm: ['Acres', 'Fields', 'Homestead', 'Pastures', 'Grove', 'Meadow'],
    enchanter_shop: ['Arcanum', 'Sanctum', 'Sigils', 'Glyphs', 'Enchantments', 'Wonders'],
};

/**
 * Generates a thematic business name.
 */
export const generateBusinessName = (businessType: BusinessType, rng: SeededRandom): string => {
    if (businessType === 'tavern') {
        const adj = TAVERN_ADJECTIVES[rng.nextInt(0, TAVERN_ADJECTIVES.length)];
        const noun = TAVERN_NOUNS[rng.nextInt(0, TAVERN_NOUNS.length)];
        return `The ${adj} ${noun}`;
    }

    const adjs = SHOP_ADJECTIVES;
    const nouns = SHOP_NOUNS[businessType] || ['Shop'];
    const adj = adjs[rng.nextInt(0, adjs.length)];
    const noun = nouns[rng.nextInt(0, nouns.length)];
    return `The ${adj} ${noun}`;
};

/**
 * Picks a random business type weighted by commonality.
 */
export const pickBusinessTypeForMerchant = (rng: SeededRandom): BusinessType => {
    // Weighted distribution: taverns/general stores most common
    const weighted: [BusinessType, number][] = [
        ['tavern', 25],
        ['general_store', 25],
        ['smithy', 15],
        ['apothecary', 12],
        ['farm', 10],
        ['trading_company', 5],
        ['mine', 5],
        ['enchanter_shop', 3],
    ];
    const total = weighted.reduce((s, [, w]) => s + w, 0);
    let roll = rng.nextInt(1, total);
    for (const [type, weight] of weighted) {
        roll -= weight;
        if (roll <= 0) return type;
    }
    return 'general_store';
};

// --- NPC Business Profile Generation ---

interface MinimalNpc {
    id: string;
    name: string;
    role: string;
    biography?: { level: number; classId?: string };
}

/**
 * Derives an NPC's business skill from their role and level.
 */
const deriveBusinessSkill = (npc: MinimalNpc, rng: SeededRandom): number => {
    const level = npc.biography?.level ?? 3;
    const baseSkill = npc.role === 'merchant' ? 55 : 25;
    const levelBonus = level * 3;
    const variation = rng.nextInt(-5, 5);
    return Math.max(10, Math.min(95, baseSkill + levelBonus + variation));
};

/**
 * Generates a WorldBusiness for an NPC merchant.
 */
export const generateNpcBusiness = (
    npc: MinimalNpc,
    locationId: string,
    businessType: BusinessType,
    gameDay: number,
    rng: SeededRandom
): WorldBusiness => {
    const template = BUSINESS_TEMPLATES[businessType];
    const businessSkill = deriveBusinessSkill(npc, rng);
    const level = npc.biography?.level ?? 3;

    // Established businesses have higher starting metrics
    const establishmentFactor = Math.min(1, (level * 5 + businessSkill) / 100);
    const startingReputation = Math.round(20 + establishmentFactor * 60); // 20-80
    const startingSatisfaction = Math.round(40 + establishmentFactor * 40); // 40-80

    const name = generateBusinessName(businessType, rng);

    return {
        // WorldBusiness fields
        id: `biz_${npc.id}_${rng.nextInt(1000, 10000)}`,
        name,
        locationId,
        ownerId: npc.id,
        ownerType: 'npc',
        daysSinceManaged: 0,
        managerEfficiency: businessSkill,
        foundedDay: gameDay,

        npcOwnerProfile: {
            businessSkill,
            willingnessToSell: Math.max(5, 30 - businessSkill / 3 + rng.nextInt(-10, 10)),
            financialPressure: rng.nextInt(5, 20),
            attachmentToShop: Math.round(40 + rng.next() * 40), // 40-80
            askingPriceMultiplier: 1.5 + rng.next() * 0.8, // 1.5-2.3
            daysUnprofitable: 0,
        },

        // BusinessState fields
        strongholdId: '', // Not linked to a stronghold
        businessType,
        metrics: {
            customerSatisfaction: startingSatisfaction,
            reputation: startingReputation,
            competitorPressure: rng.nextInt(15, 45),
            supplyChainHealth: rng.nextInt(50, 80),
            staffEfficiency: Math.round(businessSkill * 0.8),
        },
        supplyContracts: [],
        dailyCustomers: Math.round(template.baseCustomersPerDay * establishmentFactor),
        priceMultiplier: 0.9 + rng.next() * 0.3, // 0.9-1.2
        competitorIds: [],
        lastDailyReport: {
            day: gameDay,
            revenue: 0,
            costs: 0,
            profit: 0,
            customersSatisfied: 0,
            customersLost: 0,
            supplyIssues: [],
            competitorActions: [],
            staffIssues: [],
        },
    };
};

// --- Daily Simulation ---

const clampMetric = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Processes daily simulation for a single NPC-owned business.
 * Simplified variant — no stronghold dependency, uses businessSkill as staff efficiency.
 */
export const processNpcBusinessDaily = (
    business: WorldBusiness,
    economy: EconomyState,
    factions: Record<string, Faction>,
    gameDay: number,
    rng: SeededRandom
): WorldBusiness => {
    const template = BUSINESS_TEMPLATES[business.businessType];
    if (!template || !business.npcOwnerProfile) return business;

    const profile = business.npcOwnerProfile;

    // 1. Supply chain health
    // calculateSupplyChainHealth only reads supplyContracts; cast to satisfy the BusinessState param
    const supplyHealth = calculateSupplyChainHealth(
        { ...business, strongholdId: business.strongholdId ?? '' } as import('../../types/business').BusinessState,
        economy.tradeRoutes
    );

    // 2. Staff efficiency = NPC's business skill (they run it themselves)
    const staffEfficiency = profile.businessSkill;

    // 3. Competition pressure (gradual drift)
    const basePressure = Math.min(80, business.competitorIds.length * 15);
    const pressureDrift = (rng.next() - 0.5) * 10;
    const competitorPressure = clampMetric(
        business.metrics.competitorPressure + (basePressure + pressureDrift > business.metrics.competitorPressure ? 1 : -1)
    );

    // 4. Customer satisfaction
    const priceSatisfaction = Math.max(0, 100 - (business.priceMultiplier - 0.5) * 66);
    const competitionSatisfaction = 100 - competitorPressure;
    const rawSatisfaction =
        supplyHealth * 0.3 +
        staffEfficiency * 0.3 +
        priceSatisfaction * 0.2 +
        competitionSatisfaction * 0.2;
    const customerSatisfaction = clampMetric(
        business.metrics.customerSatisfaction + (rawSatisfaction > business.metrics.customerSatisfaction ? 2 : -1)
    );

    // 5. Daily customers
    const satisfactionMod = customerSatisfaction / 100;
    const reputationMod = 0.5 + business.metrics.reputation / 200;
    const randomVariation = 0.85 + rng.next() * 0.3;
    const actualCustomers = Math.max(1, Math.round(
        business.dailyCustomers * satisfactionMod * reputationMod * randomVariation
    ));

    // 6. Revenue & costs
    const revenuePerCustomer = (template.baseDailyRevenue / template.baseCustomersPerDay) * business.priceMultiplier;
    const inflationMod = 1 + (economy.globalInflation || 0);
    const revenue = actualCustomers * revenuePerCustomer * inflationMod;
    const costs = template.baseDailyCosts;
    const profit = revenue - costs;

    // 7. NPC management: adjust prices if struggling (simple AI)
    let newPriceMultiplier = business.priceMultiplier;
    if (profit < 0 && business.priceMultiplier > 0.8) {
        newPriceMultiplier = Math.max(0.7, business.priceMultiplier - 0.05);
    } else if (profit > template.baseDailyRevenue * 0.5 && business.priceMultiplier < 1.5) {
        newPriceMultiplier = Math.min(1.8, business.priceMultiplier + 0.02);
    }

    // 8. Update financial pressure
    let newFinancialPressure = profile.financialPressure;
    let newDaysUnprofitable = profile.daysUnprofitable;
    if (profit < 0) {
        newDaysUnprofitable++;
        newFinancialPressure = clampMetric(newFinancialPressure + 2 + Math.abs(profit) / 20);
    } else {
        newDaysUnprofitable = 0;
        newFinancialPressure = clampMetric(newFinancialPressure - 3);
    }

    // 9. Update willingness to sell
    const newWillingnessToSell = clampMetric(
        Math.max(5,
            15 +
            newFinancialPressure * 0.5 +
            newDaysUnprofitable * 2 -
            profile.attachmentToShop * 0.3
        )
    );

    // 10. Reputation drift
    const reputationDirection = customerSatisfaction > 55 ? 1 : customerSatisfaction < 40 ? -2 : 0;

    // 11. Build updated metrics
    const updatedMetrics: BusinessMetrics = {
        customerSatisfaction,
        reputation: clampMetric(business.metrics.reputation + reputationDirection),
        competitorPressure,
        supplyChainHealth: clampMetric(supplyHealth),
        staffEfficiency: clampMetric(staffEfficiency),
    };

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
        supplyIssues: supplyHealth < 40 ? ['Supply deliveries unreliable.'] : [],
        competitorActions: competitorPressure > 70 ? ['Competitors undercutting prices.'] : [],
        staffIssues: [],
    };

    return {
        ...business,
        metrics: updatedMetrics,
        priceMultiplier: Math.round(newPriceMultiplier * 100) / 100,
        lastDailyReport: report,
        npcOwnerProfile: {
            ...profile,
            financialPressure: newFinancialPressure,
            daysUnprofitable: newDaysUnprofitable,
            willingnessToSell: newWillingnessToSell,
        },
    };
};

/**
 * Processes all NPC-owned world businesses for a daily tick.
 * NPC businesses with financialPressure > 90 for 30+ unprofitable days close (removed from record).
 */
export const processAllNpcBusinesses = (
    worldBusinesses: Record<string, WorldBusiness>,
    economy: EconomyState,
    factions: Record<string, Faction>,
    gameDay: number,
    rng: SeededRandom
): { worldBusinesses: Record<string, WorldBusiness>; closedBusinessIds: string[] } => {
    const updated: Record<string, WorldBusiness> = {};
    const closedBusinessIds: string[] = [];

    for (const [id, business] of Object.entries(worldBusinesses)) {
        if (business.ownerType !== 'npc') {
            // Pass through player businesses unchanged
            updated[id] = business;
            continue;
        }

        const processed = processNpcBusinessDaily(business, economy, factions, gameDay, rng);

        // Bankruptcy check: pressure > 90 AND unprofitable for 30+ days
        const profile = processed.npcOwnerProfile;
        if (profile && profile.financialPressure > 90 && profile.daysUnprofitable >= 30) {
            closedBusinessIds.push(id);
            continue; // Business closes — removed from record
        }

        updated[id] = processed;
    }

    return { worldBusinesses: updated, closedBusinessIds };
};

// --- Valuation ---

/**
 * Calculates the market value of a business.
 */
export const calculateBusinessValuation = (
    business: WorldBusiness,
    economy: EconomyState,
    regionId: string
): BusinessValuation => {
    const template = BUSINESS_TEMPLATES[business.businessType];
    if (!template) {
        return { baseValue: 0, reputationModifier: 0, locationModifier: 0, contractValue: 0, goodwillValue: 0, totalValue: 0 };
    }

    const baseValue = template.foundingCost;
    const reputationModifier = (business.metrics.reputation / 100) * baseValue * 0.5;
    const regionalWealth = economy.regionalWealth[regionId] ?? 50;
    const locationModifier = (regionalWealth / 50 - 1) * baseValue * 0.2;
    const contractValue = business.supplyContracts.reduce(
        (sum, c) => sum + c.costPerUnit * c.unitsPerDay * 30, 0
    );
    const goodwillValue = (business.metrics.customerSatisfaction / 100) * baseValue * 0.3;

    const totalValue = Math.round(
        Math.max(baseValue * 0.3, baseValue + reputationModifier + locationModifier + contractValue + goodwillValue)
    );

    return {
        baseValue,
        reputationModifier: Math.round(reputationModifier),
        locationModifier: Math.round(locationModifier),
        contractValue: Math.round(contractValue),
        goodwillValue: Math.round(goodwillValue),
        totalValue,
    };
};
