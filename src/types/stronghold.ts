/**
 * @file src/types/stronghold.ts
 * Type definitions for the Stronghold management system.
 *
 * Defines structures for player-owned properties, staff, and resource management.
 */

export type StrongholdType = 'castle' | 'tower' | 'temple' | 'guild_hall' | 'trading_post';

export type StaffRole = 'steward' | 'guard' | 'spy' | 'merchant' | 'blacksmith' | 'priest';

export interface StrongholdResources {
    gold: number;
    supplies: number;
    influence: number;
    intel: number;
}

export interface StrongholdStaff {
    id: string;
    name: string;
    role: StaffRole;
    dailyWage: number;
    morale: number; // 0-100
    skills: Record<string, number>; // e.g., { combat: 5, negotiation: 10 }
}

export type UpgradeEffectType = 'income_bonus' | 'defense_bonus' | 'intel_bonus' | 'wage_reduction' | 'morale_boost' | 'supply_cap_bonus';

export interface UpgradeEffect {
    type: UpgradeEffectType;
    value: number;
    description: string;
}

export interface StrongholdUpgrade {
    id: string;
    name: string;
    description: string;
    cost: number;
    buildTimeDays: number;
    maintenanceCost: number;
    effects: UpgradeEffect[];
    requiredStrongholdLevel?: number;
    allowedTypes?: StrongholdType[]; // If undefined, allowed for all
}

export interface ConstructionQueueItem {
    upgradeId: string;
    daysRemaining: number;
}

export interface Stronghold {
    id: string;
    name: string;
    type: StrongholdType;
    description: string;
    locationId: string; // ID of the town or region
    level: number;
    resources: StrongholdResources;
    staff: StrongholdStaff[];
    taxRate: number; // 0-100 percentage if applicable
    dailyIncome: number; // Base passive income
    upgrades: string[]; // IDs of completed upgrades
    constructionQueue: ConstructionQueueItem[];
}

export interface DailyUpdateSummary {
    strongholdId: string;
    goldChange: number;
    influenceChange: number;
    staffEvents: string[]; // e.g., "Guard John quit due to lack of payment."
    constructionEvents: string[]; // e.g., "Barracks construction completed!"
    alerts: string[]; // e.g., "Low funds warning!"
}
