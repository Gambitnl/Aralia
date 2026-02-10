/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/economy/businessTemplates.ts
 * Catalog of business types with base statistics, supply requirements,
 * and upgrade paths. Used by the BusinessSimulation system.
 */

import { BusinessType } from '../../types/business';

export interface BusinessTemplate {
    type: BusinessType;
    name: string;
    description: string;
    foundingCost: number;         // Gold to establish
    baseCustomersPerDay: number;
    baseDailyRevenue: number;     // At 1.0 price multiplier, 100% satisfaction
    baseDailyCosts: number;       // Operating costs (staff, supplies, rent)
    requiredSupplyCategories: string[];  // What goods this business needs
    staffSlotsNeeded: number;     // Minimum staff to operate
    upgrades: BusinessUpgradeTemplate[];
}

export interface BusinessUpgradeTemplate {
    id: string;
    name: string;
    description: string;
    cost: number;
    effect: {
        metric: keyof typeof METRIC_EFFECTS;
        value: number;
    };
}

const METRIC_EFFECTS = {
    customerSatisfaction: 'customerSatisfaction',
    reputation: 'reputation',
    supplyChainHealth: 'supplyChainHealth',
    staffEfficiency: 'staffEfficiency',
    dailyCustomers: 'dailyCustomers',
    revenue: 'revenue'
} as const;

export const BUSINESS_TEMPLATES: Record<BusinessType, BusinessTemplate> = {
    tavern: {
        type: 'tavern',
        name: 'Tavern',
        description: 'A drinking and gathering establishment. Low margins but high customer volume. Great for rumors and information.',
        foundingCost: 2000,
        baseCustomersPerDay: 20,
        baseDailyRevenue: 30,
        baseDailyCosts: 15,
        requiredSupplyCategories: ['food', 'drink'],
        staffSlotsNeeded: 2,
        upgrades: [
            {
                id: 'private_rooms',
                name: 'Private Rooms',
                description: 'Secluded booths for secret meetings. Attracts wealthier clientele.',
                cost: 1500,
                effect: { metric: 'revenue', value: 15 }
            },
            {
                id: 'quality_kitchen',
                name: 'Quality Kitchen',
                description: 'A proper kitchen for hot meals. Increases customer satisfaction.',
                cost: 1000,
                effect: { metric: 'customerSatisfaction', value: 15 }
            },
            {
                id: 'bard_stage',
                name: 'Bard Stage',
                description: 'Live entertainment draws larger crowds.',
                cost: 800,
                effect: { metric: 'dailyCustomers', value: 8 }
            }
        ]
    },
    smithy: {
        type: 'smithy',
        name: 'Smithy',
        description: 'A forge for weapons and armor. High margins on quality goods, dependent on iron supply.',
        foundingCost: 3000,
        baseCustomersPerDay: 8,
        baseDailyRevenue: 50,
        baseDailyCosts: 25,
        requiredSupplyCategories: ['iron', 'coal'],
        staffSlotsNeeded: 2,
        upgrades: [
            {
                id: 'quality_workshop',
                name: 'Quality Workshop',
                description: 'Better tools and anvils produce finer work.',
                cost: 2000,
                effect: { metric: 'reputation', value: 20 }
            },
            {
                id: 'display_cases',
                name: 'Display Cases',
                description: 'Showcase your finest weapons to attract buyers.',
                cost: 800,
                effect: { metric: 'dailyCustomers', value: 4 }
            }
        ]
    },
    apothecary: {
        type: 'apothecary',
        name: 'Apothecary',
        description: 'Potions, salves, and remedies. Niche but consistent clientele. Dependent on herb supply.',
        foundingCost: 2500,
        baseCustomersPerDay: 10,
        baseDailyRevenue: 40,
        baseDailyCosts: 20,
        requiredSupplyCategories: ['herbs', 'magic_reagents'],
        staffSlotsNeeded: 1,
        upgrades: [
            {
                id: 'herb_garden',
                name: 'Herb Garden',
                description: 'Grow your own ingredients to reduce supply dependency.',
                cost: 1200,
                effect: { metric: 'supplyChainHealth', value: 25 }
            },
            {
                id: 'advertising_crier',
                name: 'Town Crier Advertisement',
                description: 'Hire a crier to announce your wares through the streets.',
                cost: 500,
                effect: { metric: 'dailyCustomers', value: 5 }
            }
        ]
    },
    general_store: {
        type: 'general_store',
        name: 'General Store',
        description: 'A bit of everything. Reliable income, less affected by market swings.',
        foundingCost: 1500,
        baseCustomersPerDay: 15,
        baseDailyRevenue: 25,
        baseDailyCosts: 12,
        requiredSupplyCategories: ['food', 'tools'],
        staffSlotsNeeded: 1,
        upgrades: [
            {
                id: 'warehouse',
                name: 'Warehouse',
                description: 'Store extra inventory to weather supply disruptions.',
                cost: 2000,
                effect: { metric: 'supplyChainHealth', value: 30 }
            },
            {
                id: 'loyalty_ledger',
                name: 'Customer Loyalty Ledger',
                description: 'Track repeat customers and offer them discounts.',
                cost: 600,
                effect: { metric: 'customerSatisfaction', value: 10 }
            }
        ]
    },
    trading_company: {
        type: 'trading_company',
        name: 'Trading Company',
        description: 'Buy low, sell high across regions. High risk, high reward. Requires trade route access.',
        foundingCost: 5000,
        baseCustomersPerDay: 5,
        baseDailyRevenue: 80,
        baseDailyCosts: 40,
        requiredSupplyCategories: ['luxury', 'gem'],
        staffSlotsNeeded: 3,
        upgrades: [
            {
                id: 'caravan_depot',
                name: 'Caravan Depot',
                description: 'Manage multiple caravans simultaneously.',
                cost: 3000,
                effect: { metric: 'revenue', value: 30 }
            },
            {
                id: 'trade_contacts',
                name: 'Trade Contacts Network',
                description: 'Better intelligence on market conditions.',
                cost: 1500,
                effect: { metric: 'supplyChainHealth', value: 20 }
            }
        ]
    },
    mine: {
        type: 'mine',
        name: 'Mine',
        description: 'Extract ore and gems from the earth. Slow to profit but steady once established.',
        foundingCost: 4000,
        baseCustomersPerDay: 3,
        baseDailyRevenue: 60,
        baseDailyCosts: 35,
        requiredSupplyCategories: ['tools', 'food'],
        staffSlotsNeeded: 4,
        upgrades: [
            {
                id: 'deep_shaft',
                name: 'Deep Shaft',
                description: 'Dig deeper for rarer ores and gems.',
                cost: 3500,
                effect: { metric: 'revenue', value: 25 }
            },
            {
                id: 'ventilation',
                name: 'Ventilation System',
                description: 'Better air means happier workers.',
                cost: 1000,
                effect: { metric: 'staffEfficiency', value: 15 }
            }
        ]
    },
    farm: {
        type: 'farm',
        name: 'Farm',
        description: 'Grow crops and raise livestock. Steady but weather-dependent income.',
        foundingCost: 1000,
        baseCustomersPerDay: 12,
        baseDailyRevenue: 20,
        baseDailyCosts: 8,
        requiredSupplyCategories: ['seeds', 'tools'],
        staffSlotsNeeded: 2,
        upgrades: [
            {
                id: 'irrigation',
                name: 'Irrigation System',
                description: 'Consistent water supply reduces weather dependency.',
                cost: 1500,
                effect: { metric: 'supplyChainHealth', value: 20 }
            },
            {
                id: 'livestock_pen',
                name: 'Livestock Pen',
                description: 'Diversify with animal products.',
                cost: 1200,
                effect: { metric: 'revenue', value: 10 }
            }
        ]
    },
    enchanter_shop: {
        type: 'enchanter_shop',
        name: 'Enchanter\'s Shop',
        description: 'Magical goods and enchanting services. Very high margins but rare clientele.',
        foundingCost: 6000,
        baseCustomersPerDay: 3,
        baseDailyRevenue: 100,
        baseDailyCosts: 50,
        requiredSupplyCategories: ['magic_reagents', 'gem'],
        staffSlotsNeeded: 1,
        upgrades: [
            {
                id: 'arcane_workshop',
                name: 'Arcane Workshop',
                description: 'A proper workspace for complex enchantments.',
                cost: 4000,
                effect: { metric: 'reputation', value: 25 }
            },
            {
                id: 'ward_display',
                name: 'Protective Ward Display',
                description: 'Enchanted displays that demonstrate your craft to passersby.',
                cost: 2000,
                effect: { metric: 'dailyCustomers', value: 3 }
            }
        ]
    }
};
