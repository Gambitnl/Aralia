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
    morale: number;
    skills: Record<string, number>;
    currentMissionId?: string;
}
export type StrongholdEffectType = 'income_flat' | 'income_percent' | 'defense_bonus' | 'influence_bonus' | 'intel_bonus' | 'morale_bonus' | 'capacity_increase';
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
    prerequisites?: string[];
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
    severity: number;
    daysUntilTrigger: number;
    resolved: boolean;
    consequences: ThreatConsequence;
}
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
    difficulty: number;
    potentialRewards: MissionReward;
}
export interface Stronghold {
    id: string;
    name: string;
    type: StrongholdType;
    description: string;
    locationId: string;
    level: number;
    resources: StrongholdResources;
    staff: StrongholdStaff[];
    taxRate: number;
    dailyIncome: number;
    upgrades: string[];
    constructionQueue: ConstructionProject[];
    threats: ActiveThreat[];
    missions: StrongholdMission[];
}
export interface DailyUpdateSummary {
    strongholdId: string;
    goldChange: number;
    influenceChange: number;
    staffEvents: string[];
    threatEvents: string[];
    missionEvents: string[];
    alerts: string[];
}
