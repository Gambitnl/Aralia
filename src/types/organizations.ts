/**
 * @file src/types/organizations.ts
 * Type definitions for player-led organizations.
 */

export type OrgType = 'guild' | 'order' | 'syndicate' | 'cult' | 'company' | 'academy';

export type MemberRank = 'initiate' | 'member' | 'officer' | 'leader' | 'master';

export interface OrgResources {
    gold: number;
    influence: number;
    connections: number;
    secrets: number;
}

export interface OrgMember {
    id: string;
    name: string;
    rank: MemberRank;
    class?: string;
    level: number;
    loyalty: number; // 0-100
    locationId?: string; // Where they are currently operating
}

export interface OrgMission {
    id: string;
    description: string;
    assignedMemberIds: string[];
    daysRemaining: number;
    difficulty: number;
    rewards: Partial<OrgResources>;
}

export type OrgUpgradeEffectType =
    | 'resource_multiplier' // Multiplies resource gain (e.g., +10% gold)
    | 'mission_bonus'       // Adds bonus to mission rolls
    | 'max_members'         // Increases member cap (logic enforced in service)
    | 'loyalty_bonus'       // Increases daily loyalty
    | 'unlock_mission_type' // Unlocks specific missions
    | 'defense_bonus';      // Protects against rivals

export interface OrgUpgradeEffect {
    type: OrgUpgradeEffectType;
    value: number; // e.g., 0.1 for 10%, 2 for +2 bonus
    context?: string; // e.g., 'gold' for resource_multiplier, 'assassination' for mission_bonus
}

export interface OrgUpgrade {
    id: string;
    name: string;
    description: string;
    cost: Partial<OrgResources>;
    prerequisites?: string[];
    effects: OrgUpgradeEffect[];
    typeRequirements?: OrgType[]; // Only available to certain org types
}

export interface Organization {
    id: string;
    name: string;
    type: OrgType;
    description: string;
    headquartersId?: string; // Links to a Stronghold ID
    leaderId: string; // Usually the player, or a lieutenant
    members: OrgMember[];
    resources: OrgResources;
    missions: OrgMission[];

    // Upgrades (Departments/Facilities)
    upgrades: string[]; // IDs of purchased upgrades

    foundedDate: number; // Game timestamp

    // Rivals
    rivalOrgIds: string[]; // IDs of rival organizations
    // We could add a 'RivalryStatus' map here later for more depth (e.g. { orgId: 'war' })
}

export interface RivalAction {
    type: 'theft' | 'sabotage' | 'assassination' | 'smear_campaign';
    severity: number; // DC to resist
    description: string;
    perpetratorId: string; // Org ID
}
