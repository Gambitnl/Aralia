/**
 * @file src/services/organizationService.ts
 * Service for managing player-led organizations, members, and missions.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    Organization,
    OrgType,
    OrgMember,
    MemberRank,
    OrgResources,
    OrgMission
} from '../types/organizations';

// Base costs for recruiting members
const RECRUITMENT_COSTS: Record<MemberRank, number> = {
    initiate: 50,
    member: 200,
    officer: 500,
    leader: 2000,
    master: 5000
};

// Daily wage/upkeep per rank
const RANK_WAGES: Record<MemberRank, number> = {
    initiate: 2,
    member: 10,
    officer: 25,
    leader: 100,
    master: 250
};

/**
 * Creates a new organization.
 */
export const createOrganization = (name: string, type: OrgType, leaderId: string, headquartersId?: string): Organization => {
    return {
        id: uuidv4(),
        name,
        type,
        description: `A newly founded ${type}.`,
        headquartersId,
        leaderId,
        members: [],
        resources: {
            gold: 500,
            influence: 10,
            connections: 5,
            secrets: 0
        },
        missions: [],
        foundedDate: Date.now(),
        rivalOrgIds: []
    };
};

/**
 * Recruits a new member to the organization.
 */
export const recruitMember = (org: Organization, name: string, memberClass: string, level: number = 1): Organization => {
    // Basic check for funds (recruit as initiate)
    const cost = RECRUITMENT_COSTS.initiate;
    if (org.resources.gold < cost) {
        throw new Error(`Not enough gold to recruit. Need ${cost}, have ${org.resources.gold}.`);
    }

    const newMember: OrgMember = {
        id: uuidv4(),
        name,
        rank: 'initiate',
        class: memberClass,
        level,
        loyalty: 50, // Starts neutral/loyal
        locationId: org.headquartersId
    };

    return {
        ...org,
        resources: {
            ...org.resources,
            gold: org.resources.gold - cost
        },
        members: [...org.members, newMember]
    };
};

/**
 * Promotes a member to the next rank.
 */
export const promoteMember = (org: Organization, memberId: string): Organization => {
    const memberIndex = org.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) throw new Error("Member not found.");

    const member = org.members[memberIndex];
    const ranks: MemberRank[] = ['initiate', 'member', 'officer', 'leader', 'master'];
    const currentRankIdx = ranks.indexOf(member.rank);

    if (currentRankIdx === -1 || currentRankIdx === ranks.length - 1) {
        throw new Error("Cannot promote further.");
    }

    const nextRank = ranks[currentRankIdx + 1];
    // Promotion cost could be implemented here

    const updatedMember = { ...member, rank: nextRank, loyalty: Math.min(100, member.loyalty + 10) };
    const updatedMembers = [...org.members];
    updatedMembers[memberIndex] = updatedMember;

    return {
        ...org,
        members: updatedMembers
    };
};

/**
 * Starts a mission with assigned members.
 */
export const startMission = (
    org: Organization,
    description: string,
    difficulty: number,
    assignedMemberIds: string[],
    rewards: Partial<OrgResources>
): Organization => {
    if (assignedMemberIds.length === 0) throw new Error("Must assign at least one member.");

    // Verify members exist and aren't busy
    const busyMembers = org.missions.flatMap(m => m.assignedMemberIds);
    for (const id of assignedMemberIds) {
        if (!org.members.find(m => m.id === id)) throw new Error(`Member ${id} not found.`);
        if (busyMembers.includes(id)) throw new Error(`Member ${id} is already on a mission.`);
    }

    const mission: OrgMission = {
        id: uuidv4(),
        description,
        difficulty,
        assignedMemberIds,
        daysRemaining: Math.floor(Math.random() * 3) + 3, // 3-6 days
        rewards
    };

    return {
        ...org,
        missions: [...org.missions, mission]
    };
};

/**
 * Resolves a mission logic (internal helper).
 */
const resolveMissionLogic = (mission: OrgMission, members: OrgMember[]): { success: boolean; log: string } => {
    // Calculate total power
    let totalPower = 0;
    for (const member of members) {
        // Base power: Level + Rank bonus
        let rankBonus = 0;
        switch (member.rank) {
            case 'initiate': rankBonus = 0; break;
            case 'member': rankBonus = 2; break;
            case 'officer': rankBonus = 5; break;
            case 'leader': rankBonus = 10; break;
            case 'master': rankBonus = 20; break;
        }
        totalPower += member.level + rankBonus;
    }

    // Roll d20
    const roll = Math.floor(Math.random() * 20) + 1;
    const totalScore = totalPower + roll;

    if (totalScore >= mission.difficulty) {
        return { success: true, log: `Mission '${mission.description}' successful! (Score: ${totalScore} vs DC ${mission.difficulty})` };
    } else {
        return { success: false, log: `Mission '${mission.description}' failed. (Score: ${totalScore} vs DC ${mission.difficulty})` };
    }
};

/**
 * Processes daily updates for an organization.
 */
export const processDailyOrgUpdate = (org: Organization): { updatedOrg: Organization; summary: string[] } => {
    const summary: string[] = [];
    let currentGold = org.resources.gold;
    let currentInfluence = org.resources.influence;
    let currentConnections = org.resources.connections;
    let currentSecrets = org.resources.secrets;

    // 1. Pay Wages
    let totalWages = 0;
    const unpaidMembers: string[] = [];

    for (const member of org.members) {
        const wage = RANK_WAGES[member.rank];
        if (currentGold >= wage) {
            currentGold -= wage;
            totalWages += wage;
        } else {
            unpaidMembers.push(member.name);
            // Could decrease loyalty here
        }
    }
    if (totalWages > 0) summary.push(`Paid ${totalWages}gp in wages.`);
    if (unpaidMembers.length > 0) summary.push(`Could not pay: ${unpaidMembers.join(', ')}.`);

    // 2. Process Missions
    const remainingMissions: OrgMission[] = [];

    for (const mission of org.missions) {
        const updatedMission = { ...mission, daysRemaining: mission.daysRemaining - 1 };

        if (updatedMission.daysRemaining <= 0) {
            // Resolve
            const assignedMembers = org.members.filter(m => mission.assignedMemberIds.includes(m.id));
            const result = resolveMissionLogic(updatedMission, assignedMembers);
            summary.push(result.log);

            if (result.success && mission.rewards) {
                if (mission.rewards.gold) {
                    currentGold += mission.rewards.gold;
                    summary.push(`Gained ${mission.rewards.gold} gold.`);
                }
                if (mission.rewards.influence) {
                    currentInfluence += mission.rewards.influence;
                    summary.push(`Gained ${mission.rewards.influence} influence.`);
                }
                if (mission.rewards.connections) {
                    currentConnections += mission.rewards.connections;
                    summary.push(`Gained ${mission.rewards.connections} connections.`);
                }
                if (mission.rewards.secrets) {
                    currentSecrets += mission.rewards.secrets;
                    summary.push(`Gained ${mission.rewards.secrets} secrets.`);
                }
            }
        } else {
            remainingMissions.push(updatedMission);
        }
    }

    // 3. Passive Income/Influence based on type (simple implementation)
    // Guilds make money, Cults make secrets, etc.
    if (org.type === 'guild') {
        const income = 10 * org.members.length;
        currentGold += income;
        summary.push(`Guild business generated ${income}gp.`);
    } else if (org.type === 'cult') {
        const secrets = Math.floor(org.members.length / 5);
        if (secrets > 0) {
            currentSecrets += secrets;
            summary.push(`Cult activities uncovered ${secrets} secrets.`);
        }
    }

    return {
        updatedOrg: {
            ...org,
            resources: {
                gold: currentGold,
                influence: currentInfluence,
                connections: currentConnections,
                secrets: currentSecrets
            },
            missions: remainingMissions
        },
        summary
    };
};
