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
    foundingCost: number;
    baseCustomersPerDay: number;
    baseDailyRevenue: number;
    baseDailyCosts: number;
    requiredSupplyCategories: string[];
    staffSlotsNeeded: number;
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
declare const METRIC_EFFECTS: {
    readonly customerSatisfaction: "customerSatisfaction";
    readonly reputation: "reputation";
    readonly supplyChainHealth: "supplyChainHealth";
    readonly staffEfficiency: "staffEfficiency";
    readonly dailyCustomers: "dailyCustomers";
    readonly revenue: "revenue";
};
export declare const BUSINESS_TEMPLATES: Record<BusinessType, BusinessTemplate>;
export {};
