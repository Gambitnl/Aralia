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
    loyalty: number;
    locationId?: string;
}
export interface OrgMission {
    id: string;
    description: string;
    assignedMemberIds: string[];
    daysRemaining: number;
    difficulty: number;
    rewards: Partial<OrgResources>;
}
export type OrgUpgradeEffectType = 'resource_multiplier' | 'mission_bonus' | 'max_members' | 'loyalty_bonus' | 'unlock_mission_type' | 'defense_bonus';
export interface OrgUpgradeEffect {
    type: OrgUpgradeEffectType;
    value: number;
    context?: string;
}
export interface OrgUpgrade {
    id: string;
    name: string;
    description: string;
    cost: Partial<OrgResources>;
    prerequisites?: string[];
    effects: OrgUpgradeEffect[];
    typeRequirements?: OrgType[];
}
export interface Organization {
    id: string;
    name: string;
    type: OrgType;
    description: string;
    headquartersId?: string;
    leaderId: string;
    members: OrgMember[];
    resources: OrgResources;
    missions: OrgMission[];
    upgrades: string[];
    foundedDate: number;
    rivalOrgIds: string[];
}
export interface RivalAction {
    type: 'theft' | 'sabotage' | 'assassination' | 'smear_campaign';
    severity: number;
    description: string;
    perpetratorId: string;
}
