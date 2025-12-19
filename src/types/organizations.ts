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
    foundedDate: number; // Game timestamp
    rivalOrgIds: string[];
}
