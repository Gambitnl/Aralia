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
    currentMissionId?: string; // ID of active mission
}

export type StrongholdEffectType =
    | 'income_flat'      // Adds flat gold per day
    | 'income_percent'   // Increases total income by %
    | 'defense_bonus'    // Increases stronghold defense
    | 'influence_bonus'  // Generates daily influence
    | 'intel_bonus'      // Generates daily intel
    | 'morale_bonus'     // Increases daily morale recovery
    | 'capacity_increase'; // Increases resource caps (if we had them) or staff limit

export interface StrongholdEffect {
    type: StrongholdEffectType;
    value: number;
}

export interface StrongholdUpgrade {
    id: string;
    name: string;
    description: string;
    cost: {
        gold: number;
        supplies: number;
    };
    prerequisites?: string[]; // IDs of other upgrades required
    effects: StrongholdEffect[];
}

export interface ConstructionProject {
    upgradeId: string;
    daysRemaining: number;
}

export type ThreatType = 'bandits' | 'monster' | 'disaster' | 'political' | 'rebellion';

export interface ThreatConsequence {
    goldLoss?: number;
    suppliesLoss?: number;
    moraleLoss?: number;
    staffDeath?: boolean;
    buildingDamage?: boolean;
}

export interface ActiveThreat {
    id: string;
    name: string;
    description: string;
    type: ThreatType;
    severity: number; // Difficulty class to beat (e.g., 10-100)
    daysUntilTrigger: number;
    resolved: boolean;
    consequences: ThreatConsequence;
}

// --- Mission System ---

export type MissionType = 'scout' | 'trade' | 'diplomacy' | 'raid';

export interface MissionReward {
    gold?: number;
    supplies?: number;
    influence?: number;
    intel?: number;
    items?: string[];
}

export interface StrongholdMission {
    id: string;
    type: MissionType;
    staffId: string;
    description: string;
    daysRemaining: number;
    difficulty: number; // 1-100
    potentialRewards: MissionReward;
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

    // Upgrades
    upgrades: string[]; // IDs of completed upgrades
    constructionQueue: ConstructionProject[]; // Upgrades currently being built

    // Active Threats
    threats: ActiveThreat[];

    // Active Missions
    missions: StrongholdMission[];
}

export interface DailyUpdateSummary {
    strongholdId: string;
    goldChange: number;
    influenceChange: number;
    staffEvents: string[]; // e.g., "Guard John quit due to lack of payment."
    threatEvents: string[]; // e.g., "Bandits raided! Lost 500 gold."
    missionEvents: string[]; // e.g., "Scout returned with 10 intel."
    alerts: string[]; // e.g., "Low funds warning!"
}
