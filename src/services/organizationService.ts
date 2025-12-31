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
    OrgMission,
    OrgUpgrade,
    // TODO(lint-intent): 'OrgUpgradeEffect' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    OrgUpgradeEffect as _OrgUpgradeEffect,
    RivalAction
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

// --- Upgrade Catalog ---

export const ORG_UPGRADE_CATALOG: Record<string, OrgUpgrade> = {
    // Guild Upgrades
    'guild_hall': {
        id: 'guild_hall',
        name: 'Guild Hall',
        description: 'A central meeting place.',
        cost: { gold: 1000, influence: 10 },
        effects: [{ type: 'loyalty_bonus', value: 1 }],
        typeRequirements: ['guild', 'company', 'syndicate']
    },
    'trade_routes': {
        id: 'trade_routes',
        name: 'Established Trade Routes',
        description: 'Secure paths for commerce.',
        cost: { gold: 2000, connections: 20 },
        prerequisites: ['guild_hall'],
        effects: [{ type: 'resource_multiplier', value: 0.1, context: 'gold' }],
        typeRequirements: ['guild', 'company']
    },

    // Order Upgrades
    'training_grounds': {
        id: 'training_grounds',
        name: 'Training Grounds',
        description: 'Facilities to hone martial skills.',
        cost: { gold: 1500, influence: 20 },
        effects: [{ type: 'mission_bonus', value: 2, context: 'combat' }],
        typeRequirements: ['order']
    },
    'armory': {
        id: 'armory',
        name: 'Armory',
        description: 'Better equipment for members.',
        cost: { gold: 3000, influence: 50 },
        prerequisites: ['training_grounds'],
        effects: [{ type: 'defense_bonus', value: 5 }],
        typeRequirements: ['order', 'syndicate']
    },

    // Syndicate/Cult Upgrades
    'safehouses': {
        id: 'safehouses',
        name: 'Network of Safehouses',
        description: 'Places to hide from the law.',
        cost: { gold: 1000, connections: 10 },
        effects: [{ type: 'defense_bonus', value: 2 }],
        typeRequirements: ['syndicate', 'cult']
    },
    'blackmail_archive': {
        id: 'blackmail_archive',
        name: 'Blackmail Archive',
        description: 'Dirt on powerful figures.',
        cost: { gold: 2000, secrets: 20 },
        prerequisites: ['safehouses'],
        effects: [{ type: 'resource_multiplier', value: 0.2, context: 'influence' }],
        typeRequirements: ['syndicate', 'cult']
    },

    // Academy Upgrades
    'library_arcane': {
        id: 'library_arcane',
        name: 'Arcane Library',
        description: 'A vast collection of magical texts.',
        cost: { gold: 2000, secrets: 10 },
        effects: [{ type: 'resource_multiplier', value: 0.2, context: 'secrets' }],
        typeRequirements: ['academy', 'cult']
    }
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
        upgrades: [],
        foundedDate: Date.now(),
        rivalOrgIds: []
    };
};

/**
 * Returns available upgrades for an organization.
 */
export const getAvailableOrgUpgrades = (org: Organization): OrgUpgrade[] => {
    return Object.values(ORG_UPGRADE_CATALOG).filter(upgrade => {
        // Already owned?
        if (org.upgrades.includes(upgrade.id)) return false;

        // Type compatible?
        if (upgrade.typeRequirements && !upgrade.typeRequirements.includes(org.type)) return false;

        // Prerequisites met?
        if (upgrade.prerequisites) {
            const hasPrereqs = upgrade.prerequisites.every(prereqId => org.upgrades.includes(prereqId));
            if (!hasPrereqs) return false;
        }

        return true;
    });
};

/**
 * Purchases an organization upgrade.
 */
export const purchaseOrgUpgrade = (org: Organization, upgradeId: string): Organization => {
    const upgrade = ORG_UPGRADE_CATALOG[upgradeId];
    if (!upgrade) throw new Error(`Upgrade ${upgradeId} not found.`);

    // Check type requirements
    if (upgrade.typeRequirements && !upgrade.typeRequirements.includes(org.type)) {
        throw new Error(`Organization type '${org.type}' cannot purchase this upgrade.`);
    }

    // Check costs
    if ((upgrade.cost.gold || 0) > org.resources.gold) throw new Error("Not enough gold.");
    if ((upgrade.cost.influence || 0) > org.resources.influence) throw new Error("Not enough influence.");
    if ((upgrade.cost.connections || 0) > org.resources.connections) throw new Error("Not enough connections.");
    if ((upgrade.cost.secrets || 0) > org.resources.secrets) throw new Error("Not enough secrets.");

    // Check prerequisites again
    if (upgrade.prerequisites) {
        const hasPrereqs = upgrade.prerequisites.every(pid => org.upgrades.includes(pid));
        if (!hasPrereqs) throw new Error("Prerequisites not met.");
    }

    const newResources = {
        gold: org.resources.gold - (upgrade.cost.gold || 0),
        influence: org.resources.influence - (upgrade.cost.influence || 0),
        connections: org.resources.connections - (upgrade.cost.connections || 0),
        secrets: org.resources.secrets - (upgrade.cost.secrets || 0)
    };

    return {
        ...org,
        resources: newResources,
        upgrades: [...org.upgrades, upgrade.id]
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
 * Helper to get accumulated bonuses from upgrades.
 */
const getUpgradeBonuses = (org: Organization) => {
    // TODO(lint-intent): This binding never reassigns, so the intended mutability is unclear.
    // TODO(lint-intent): If it should stay stable, switch to const and treat it as immutable.
    // TODO(lint-intent): If mutation was intended, add the missing update logic to reflect that intent.
    const resourceMultipliers: Record<string, number> = { gold: 0, influence: 0, connections: 0, secrets: 0 };
    let loyaltyBonus = 0;
    let missionBonus = 0;
    let defenseBonus = 0;

    for (const upgradeId of org.upgrades) {
        const upgrade = ORG_UPGRADE_CATALOG[upgradeId];
        if (upgrade) {
            for (const effect of upgrade.effects) {
                switch (effect.type) {
                    case 'resource_multiplier':
                        if (effect.context) resourceMultipliers[effect.context] += effect.value;
                        break;
                    case 'loyalty_bonus':
                        loyaltyBonus += effect.value;
                        break;
                    case 'mission_bonus':
                        missionBonus += effect.value; // Simplification: applies to all missions for now
                        break;
                    case 'defense_bonus':
                        defenseBonus += effect.value;
                        break;
                }
            }
        }
    }
    return { resourceMultipliers, loyaltyBonus, missionBonus, defenseBonus };
};

/**
 * Resolves a mission logic (internal helper).
 */
const resolveMissionLogic = (mission: OrgMission, members: OrgMember[], bonus: number): { success: boolean; log: string } => {
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

    // Add Upgrade Bonus
    totalPower += bonus;

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
 * Generates a potential rival action against the organization.
 */
const generateRivalAction = (org: Organization): RivalAction | null => {
    if (org.rivalOrgIds.length === 0) return null;

    // 10% chance per day per rival? Or just 10% total?
    // Let's go with 10% chance if there are rivals.
    if (Math.random() > 0.1) return null;

    const rivalId = org.rivalOrgIds[Math.floor(Math.random() * org.rivalOrgIds.length)];
    const types: RivalAction['type'][] = ['theft', 'sabotage', 'assassination', 'smear_campaign'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Severity scales with org size (success breeds contempt)
    const severity = 10 + Math.floor(org.members.length * 2);

    return {
        type,
        severity,
        perpetratorId: rivalId,
        description: `Rival action detected: ${type}`
    };
};

/**
 * Resolves a rival action.
 */
const resolveRivalAction = (org: Organization, action: RivalAction, defenseBonus: number): { success: boolean; log: string } => {
    // Defense: Base 10 + Defense Bonus + Random
    const defense = 10 + defenseBonus;
    const roll = Math.floor(Math.random() * 20) + 1;
    const totalDefense = defense + roll;

    if (totalDefense >= action.severity) {
        return { success: true, log: `Thwarted rival ${action.type}! (Defense: ${totalDefense} vs DC ${action.severity})` };
    } else {
        return { success: false, log: `Failed to stop rival ${action.type}. (Defense: ${totalDefense} vs DC ${action.severity})` };
    }
};

/**
 * Processes daily updates for an organization.
 */
export const processDailyOrgUpdate = (org: Organization): { updatedOrg: Organization; summary: string[] } => {
    const summary: string[] = [];
    const bonuses = getUpgradeBonuses(org);

    let currentGold = org.resources.gold;
    let currentInfluence = org.resources.influence;
    let currentConnections = org.resources.connections;
    let currentSecrets = org.resources.secrets;

    // 1. Pay Wages
    let totalWages = 0;
    const unpaidMembers: string[] = [];

    // Loyalty updates
    let updatedMembers = org.members.map(m => {
        // Apply daily loyalty bonus from upgrades
        return { ...m, loyalty: Math.min(100, m.loyalty + bonuses.loyaltyBonus) };
    });

    for (const member of updatedMembers) {
        const wage = RANK_WAGES[member.rank];
        if (currentGold >= wage) {
            currentGold -= wage;
            totalWages += wage;
        } else {
            unpaidMembers.push(member.name);
            // Decrease loyalty if unpaid
            member.loyalty = Math.max(0, member.loyalty - 5);
        }
    }
    if (totalWages > 0) summary.push(`Paid ${totalWages}gp in wages.`);
    if (unpaidMembers.length > 0) summary.push(`Could not pay: ${unpaidMembers.join(', ')}.`);

    // 2. Rival Actions (New!)
    const rivalAction = generateRivalAction(org);
    if (rivalAction) {
        const result = resolveRivalAction(org, rivalAction, bonuses.defenseBonus);
        summary.push(result.log);

        if (!result.success) {
            // Consequences
            switch (rivalAction.type) {
                case 'theft': {
                    // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
                    // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
                    // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
                    const stolen = Math.floor(currentGold * 0.1);
                    currentGold -= stolen;
                    summary.push(`Rivals stole ${stolen} gold.`);
                    break;
                }
                case 'sabotage': {
                    // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
                    // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
                    // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
                    const influenceLost = Math.floor(currentInfluence * 0.1);
                    currentInfluence -= influenceLost;
                    summary.push(`Rivals damaged your reputation. Lost ${influenceLost} influence.`);
                    break;
                }
                case 'smear_campaign': {
                    // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
                    // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
                    // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
                    const connectionsLost = Math.floor(currentConnections * 0.1);
                    currentConnections -= connectionsLost;
                    summary.push(`Rivals turned allies against you. Lost ${connectionsLost} connections.`);
                    break;
                }
                 case 'assassination':
                    // Worst case: a member is injured or killed. For now, just loyalty hit.
                    updatedMembers = updatedMembers.map(m => ({ ...m, loyalty: Math.max(0, m.loyalty - 20) }));
                    summary.push("Rivals attempted assassination. Member loyalty shaken.");
                    break;
            }
        }
    }

    // 3. Process Missions
    const remainingMissions: OrgMission[] = [];

    for (const mission of org.missions) {
        const updatedMission = { ...mission, daysRemaining: mission.daysRemaining - 1 };

        if (updatedMission.daysRemaining <= 0) {
            // Resolve
            const assignedMembers = updatedMembers.filter(m => mission.assignedMemberIds.includes(m.id));
            const result = resolveMissionLogic(updatedMission, assignedMembers, bonuses.missionBonus);
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

    // 4. Passive Income/Influence based on type
    const memberCount = org.members.length;
    let baseGoldIncome = 0;
    let baseInfluenceIncome = 0;
    let baseConnectionsIncome = 0;
    let baseSecretsIncome = 0;

    switch (org.type) {
        case 'guild': {
            baseGoldIncome = 10 * memberCount;
            summary.push(`Guild business generated ${baseGoldIncome}gp.`);
            break;
        }
        case 'company': {
            baseGoldIncome = 12 * memberCount;
            summary.push(`Company ventures generated ${baseGoldIncome}gp.`);
            break;
        }
        case 'order': {
            baseInfluenceIncome = 1 * memberCount;
            summary.push(`Order deeds generated ${baseInfluenceIncome} influence.`);
            break;
        }
        case 'syndicate': {
            baseConnectionsIncome = 1 * memberCount;
            summary.push(`Syndicate network generated ${baseConnectionsIncome} connections.`);
            break;
        }
        case 'academy': {
            baseSecretsIncome = Math.floor(memberCount / 3);
            if (baseSecretsIncome > 0) summary.push(`Academy research uncovered ${baseSecretsIncome} secrets.`);
            break;
        }
        case 'cult': {
            baseSecretsIncome = Math.floor(memberCount / 5);
            if (baseSecretsIncome > 0) summary.push(`Cult activities uncovered ${baseSecretsIncome} secrets.`);
            break;
        }
    }

    // Apply Resource Multipliers
    currentGold += Math.floor(baseGoldIncome * (1 + bonuses.resourceMultipliers.gold));
    currentInfluence += Math.floor(baseInfluenceIncome * (1 + bonuses.resourceMultipliers.influence));
    currentConnections += Math.floor(baseConnectionsIncome * (1 + bonuses.resourceMultipliers.connections));
    currentSecrets += Math.floor(baseSecretsIncome * (1 + bonuses.resourceMultipliers.secrets));

    // Log bonuses if significant
    if (bonuses.resourceMultipliers.gold > 0 && baseGoldIncome > 0) summary.push(`Upgrades increased gold income by ${(bonuses.resourceMultipliers.gold * 100).toFixed(0)}%.`);

    return {
        updatedOrg: {
            ...org,
            resources: {
                gold: currentGold,
                influence: currentInfluence,
                connections: currentConnections,
                secrets: currentSecrets
            },
            missions: remainingMissions,
            members: updatedMembers
        },
        summary
    };
};
