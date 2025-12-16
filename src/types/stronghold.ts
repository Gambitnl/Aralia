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
}

export interface DailyUpdateSummary {
    strongholdId: string;
    goldChange: number;
    influenceChange: number;
    staffEvents: string[]; // e.g., "Guard John quit due to lack of payment."
    alerts: string[]; // e.g., "Low funds warning!"
}
