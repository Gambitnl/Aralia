/**
 * @file src/services/strongholdService.ts
 * Service for managing player strongholds, staff, and daily resource updates.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    Stronghold,
    StrongholdType,
    StrongholdStaff,
    StaffRole,
    DailyUpdateSummary,
    StrongholdUpgrade,
    ActiveThreat,
    ThreatType,
    MissionType,
    StrongholdMission,
    MissionReward
} from '../types/stronghold';

const BASE_WAGES: Record<StaffRole, number> = {
    steward: 10,
    guard: 5,
    spy: 15,
    merchant: 8,
    blacksmith: 6,
    priest: 4
};

export const ROLE_EFFECTS: Record<StaffRole, string> = {
    steward: 'Reduces upkeep costs by 5%',
    guard: 'Increases defense by 5',
    spy: 'Generates intel',
    merchant: 'Generates gold',
    blacksmith: 'Reduces equipment costs',
    priest: 'Increases morale recovery'
};

const THREAT_TEMPLATES: Record<ThreatType, { name: string, desc: string, baseSeverity: number }> = {
    bandits: { name: 'Bandit Raid', desc: 'Local bandits are targeting your supply lines.', baseSeverity: 20 },
    monster: { name: 'Monster Attack', desc: 'A beast has been spotted near the walls.', baseSeverity: 40 },
    disaster: { name: 'Natural Disaster', desc: 'Storms threaten the structural integrity.', baseSeverity: 30 },
    political: { name: 'Political Intrigue', desc: 'Rival factions are spreading rumors.', baseSeverity: 25 },
    rebellion: { name: 'Peasant Rebellion', desc: 'Unrest is brewing among the populace.', baseSeverity: 50 }
};

// --- Upgrade Catalog ---

export const UPGRADE_CATALOG: Record<string, StrongholdUpgrade> = {
    'market_stall': {
        id: 'market_stall',
        name: 'Market Stall',
        description: 'A small stall to sell local goods.',
        cost: { gold: 500, supplies: 50 },
        effects: [{ type: 'income_flat', value: 15 }]
    },
    'marketplace': {
        id: 'marketplace',
        name: 'Marketplace',
        description: 'A bustling hub of trade. Requires Market Stall.',
        cost: { gold: 2000, supplies: 200 },
        prerequisites: ['market_stall'],
        effects: [{ type: 'income_flat', value: 50 }, { type: 'influence_bonus', value: 1 }]
    },
    'guard_tower': {
        id: 'guard_tower',
        name: 'Guard Tower',
        description: 'Watch over the surrounding lands.',
        cost: { gold: 800, supplies: 150 },
        effects: [{ type: 'defense_bonus', value: 5 }]
    },
    'barracks': {
        id: 'barracks',
        name: 'Barracks',
        description: 'House more guards and train them better. Requires Guard Tower.',
        cost: { gold: 2500, supplies: 400 },
        prerequisites: ['guard_tower'],
        effects: [{ type: 'defense_bonus', value: 15 }, { type: 'influence_bonus', value: 2 }]
    },
    'library': {
        id: 'library',
        name: 'Library',
        description: 'A collection of knowledge and history.',
        cost: { gold: 1200, supplies: 100 },
        effects: [{ type: 'intel_bonus', value: 1 }]
    },
    'spy_network': {
        id: 'spy_network',
        name: 'Spy Network',
        description: 'A hidden room for managing informants. Requires Library.',
        cost: { gold: 3000, supplies: 300 },
        prerequisites: ['library'],
        effects: [{ type: 'intel_bonus', value: 5 }, { type: 'influence_bonus', value: 1 }]
    },
    'shrine': {
        id: 'shrine',
        name: 'Small Shrine',
        description: 'A place for quiet contemplation.',
        cost: { gold: 600, supplies: 50 },
        effects: [{ type: 'morale_bonus', value: 2 }]
    }
};

/**
 * Creates a new stronghold with initial resources.
 */
export const createStronghold = (name: string, type: StrongholdType, locationId: string): Stronghold => {
    return {
        id: uuidv4(),
        name,
        type,
        description: `A generic ${type}`,
        locationId,
        level: 1,
        resources: {
            gold: 1000,
            supplies: 100,
            influence: 0,
            intel: 0
        },
        staff: [],
        taxRate: 0,
        dailyIncome: 10, // Base passive income
        upgrades: [],
        constructionQueue: [],
        threats: [],
        missions: []
    };
};

/**
 * Recruits a new staff member.
 */
export const recruitStaff = (stronghold: Stronghold, name: string, role: StaffRole): Stronghold => {
    const newStaff: StrongholdStaff = {
        id: uuidv4(),
        name,
        role,
        dailyWage: BASE_WAGES[role],
        morale: 100,
        skills: {}
    };

    return {
        ...stronghold,
        staff: [...stronghold.staff, newStaff]
    };
};

/**
 * Fires a staff member by ID.
 */
export const fireStaff = (stronghold: Stronghold, staffId: string): Stronghold => {
    const staff = stronghold.staff.find(s => s.id === staffId);
    if (staff?.currentMissionId) {
        throw new Error("Cannot fire staff currently on a mission.");
    }

    return {
        ...stronghold,
        staff: stronghold.staff.filter(s => s.id !== staffId)
    };
};

/**
 * Returns a list of upgrades available for purchase.
 * Filters out already owned upgrades and those with unmet prerequisites.
 */
export const getAvailableUpgrades = (stronghold: Stronghold): StrongholdUpgrade[] => {
    return Object.values(UPGRADE_CATALOG).filter(upgrade => {
        // Already owned?
        if (stronghold.upgrades.includes(upgrade.id)) return false;

        // Already being built?
        if (stronghold.constructionQueue.some(p => p.upgradeId === upgrade.id)) return false;

        // Prerequisites met?
        if (upgrade.prerequisites) {
            const hasPrereqs = upgrade.prerequisites.every(prereqId => stronghold.upgrades.includes(prereqId));
            if (!hasPrereqs) return false;
        }

        return true;
    });
};

/**
 * Purchases an upgrade, deducting resources and adding it to the stronghold.
 * Currently instant build for simplicity, but designed to support queues.
 */
export const purchaseUpgrade = (stronghold: Stronghold, upgradeId: string): Stronghold => {
    const upgrade = UPGRADE_CATALOG[upgradeId];
    if (!upgrade) throw new Error(`Upgrade ${upgradeId} not found.`);

    if (stronghold.resources.gold < upgrade.cost.gold) {
        throw new Error("Not enough gold.");
    }
    if (stronghold.resources.supplies < upgrade.cost.supplies) {
        throw new Error("Not enough supplies.");
    }

    // Check prerequisites again just in case
    if (upgrade.prerequisites) {
        const hasPrereqs = upgrade.prerequisites.every(pid => stronghold.upgrades.includes(pid));
        if (!hasPrereqs) throw new Error("Prerequisites not met.");
    }

    // Deduct resources
    const newResources = {
        ...stronghold.resources,
        gold: stronghold.resources.gold - upgrade.cost.gold,
        supplies: stronghold.resources.supplies - upgrade.cost.supplies
    };

    // Instant build for now
    return {
        ...stronghold,
        resources: newResources,
        upgrades: [...stronghold.upgrades, upgrade.id]
    };
};

/**
 * Calculates the total defense rating of a stronghold.
 * Base defense (10) + Upgrade bonuses + Staff bonuses (Guards).
 */
export const calculateDefense = (stronghold: Stronghold): number => {
    let defense = 10; // Base defense

    // Add upgrade bonuses
    for (const upgradeId of stronghold.upgrades) {
        const upgrade = UPGRADE_CATALOG[upgradeId];
        if (upgrade) {
            for (const effect of upgrade.effects) {
                if (effect.type === 'defense_bonus') {
                    defense += effect.value;
                }
            }
        }
    }

    // Add staff bonuses (Guards)
    const guardCount = stronghold.staff.filter(s => s.role === 'guard').length;
    defense += guardCount * 5;

    return defense;
};

/**
 * Generates a random threat based on stronghold wealth and level.
 * Chance is currently fixed at 10% per call (usually daily).
 */
export const generateThreat = (stronghold: Stronghold): ActiveThreat | null => {
    const roll = Math.random();
    if (roll > 0.1) return null; // 90% chance of no threat

    const threatTypes: ThreatType[] = ['bandits', 'monster', 'disaster', 'political', 'rebellion'];
    const selectedType = threatTypes[Math.floor(Math.random() * threatTypes.length)];
    const template = THREAT_TEMPLATES[selectedType];

    // Severity scales with stronghold gold and upgrades
    const wealthFactor = Math.floor(stronghold.resources.gold / 2000);
    const upgradeFactor = stronghold.upgrades.length * 5;
    const severity = Math.min(100, template.baseSeverity + wealthFactor + upgradeFactor);

    return {
        id: uuidv4(),
        name: template.name,
        description: template.desc,
        type: selectedType,
        severity,
        daysUntilTrigger: Math.floor(Math.random() * 5) + 3, // 3-7 days warning
        resolved: false,
        consequences: {
            goldLoss: 100 + (severity * 5),
            moraleLoss: 10,
            suppliesLoss: 50
        }
    };
};

/**
 * Resolves a threat, checking defense vs severity.
 */
export const resolveThreat = (stronghold: Stronghold, threat: ActiveThreat): { success: boolean; logs: string[] } => {
    const defense = calculateDefense(stronghold);
    const logs: string[] = [];
    const roll = Math.floor(Math.random() * 20) + 1; // D20 roll for variability

    // Defense Check: Defense + D20 vs Severity
    const totalDefense = defense + roll;

    if (totalDefense >= threat.severity) {
        logs.push(`Threat Defeated: ${threat.name} (Severity: ${threat.severity})`);
        logs.push(`Defense: ${defense} + Roll: ${roll} = ${totalDefense}. SUCCESS!`);
        return { success: true, logs };
    } else {
        logs.push(`Threat Failed to Contain: ${threat.name} (Severity: ${threat.severity})`);
        logs.push(`Defense: ${defense} + Roll: ${roll} = ${totalDefense}. FAILURE!`);
        return { success: false, logs };
    }
};

// --- Mission System ---

/**
 * Starts a new mission for a staff member.
 */
export const startMission = (stronghold: Stronghold, staffId: string, type: MissionType, difficulty: number, description: string): Stronghold => {
    const staff = stronghold.staff.find(s => s.id === staffId);
    if (!staff) throw new Error("Staff not found");
    if (staff.currentMissionId) throw new Error("Staff already on mission");
    if (stronghold.resources.supplies < 10) throw new Error("Not enough supplies to start mission.");

    const mission: StrongholdMission = {
        id: uuidv4(),
        type,
        staffId,
        description,
        daysRemaining: Math.floor(Math.random() * 3) + 2, // 2-5 days duration
        difficulty,
        potentialRewards: {
            gold: type === 'trade' ? difficulty * 10 : 0,
            intel: type === 'scout' ? Math.floor(difficulty / 5) : 0,
            influence: type === 'diplomacy' ? Math.floor(difficulty / 10) : 0,
            supplies: type === 'raid' ? difficulty * 2 : 0
        }
    };

    return {
        ...stronghold,
        resources: {
            ...stronghold.resources,
            supplies: stronghold.resources.supplies - 10
        },
        missions: [...stronghold.missions, mission],
        staff: stronghold.staff.map(s => s.id === staffId ? { ...s, currentMissionId: mission.id } : s)
    };
};

/**
 * Resolves a completed mission.
 */
export const resolveMission = (mission: StrongholdMission, staff: StrongholdStaff): { success: boolean; log: string; rewards?: MissionReward } => {
    // Determine bonus based on role
    let bonus = 0;
    if (mission.type === 'scout' && staff.role === 'spy') bonus += 20;
    if (mission.type === 'trade' && staff.role === 'merchant') bonus += 20;
    if (mission.type === 'diplomacy' && (staff.role === 'steward' || staff.role === 'priest')) bonus += 20;
    if (mission.type === 'raid' && staff.role === 'guard') bonus += 20;

    // Morale bonus
    const moraleBonus = Math.floor(staff.morale / 10);
    const roll = Math.floor(Math.random() * 100) + 1;
    const totalScore = roll + bonus + moraleBonus;

    if (totalScore >= mission.difficulty) {
        return {
            success: true,
            log: `Mission Success: ${staff.name} completed '${mission.description}'.`,
            rewards: mission.potentialRewards
        };
    } else {
        return {
            success: false,
            log: `Mission Failed: ${staff.name} failed '${mission.description}'.`
        };
    }
};

/**
 * Processes daily updates for a stronghold:
 * - Calculates income and expenses (including Upgrade effects)
 * - Pays staff (or reduces morale if unable)
 * - Processes staff departures due to low morale
 * - Handles Threats (generation and resolution)
 * - Processes Missions (progress and completion)
 */
export const processDailyUpkeep = (stronghold: Stronghold): { updatedStronghold: Stronghold; summary: DailyUpdateSummary } => {
    const summary: DailyUpdateSummary = {
        strongholdId: stronghold.id,
        goldChange: 0,
        influenceChange: 0,
        staffEvents: [],
        threatEvents: [],
        missionEvents: [],
        alerts: []
    };

    // --- Calculate Bonuses from Upgrades ---
    let upgradeIncomeFlat = 0;
    let upgradeIncomePercent = 0;
    let upgradeInfluence = 0;
    let upgradeIntel = 0;
    let upgradeMoraleBonus = 0;

    for (const upgradeId of stronghold.upgrades) {
        const upgrade = UPGRADE_CATALOG[upgradeId];
        if (upgrade) {
            for (const effect of upgrade.effects) {
                switch (effect.type) {
                    case 'income_flat': upgradeIncomeFlat += effect.value; break;
                    case 'income_percent': upgradeIncomePercent += effect.value; break;
                    case 'influence_bonus': upgradeInfluence += effect.value; break;
                    case 'intel_bonus': upgradeIntel += effect.value; break;
                    case 'morale_bonus': upgradeMoraleBonus += effect.value; break;
                }
            }
        }
    }

    let currentGold = stronghold.resources.gold;
    let currentSupplies = stronghold.resources.supplies;
    let currentInfluence = (stronghold.resources.influence || 0);
    let currentIntel = (stronghold.resources.intel || 0);

    // --- Calculate Income ---
    let dailyIncome = stronghold.dailyIncome;

    // Merchant bonus
    const merchants = stronghold.staff.filter(s => s.role === 'merchant');
    dailyIncome += merchants.length * 5;

    // Upgrade bonuses
    dailyIncome += upgradeIncomeFlat;
    // Apply percent bonus
    if (upgradeIncomePercent > 0) {
        dailyIncome = Math.floor(dailyIncome * (1 + upgradeIncomePercent / 100));
    }

    currentGold += dailyIncome;
    summary.goldChange += dailyIncome;

    // --- Process Expenses (Wages) ---
    let totalWages = 0;
    let paidStaff: StrongholdStaff[] = [];

    // Steward bonus (reduce wages)
    const stewards = stronghold.staff.filter(s => s.role === 'steward');
    const wageMultiplier = Math.max(0.5, 1 - (stewards.length * 0.05)); // Max 50% reduction

    // Pay staff
    for (const staff of stronghold.staff) {
        const wage = Math.floor(staff.dailyWage * wageMultiplier);

        if (currentGold >= wage) {
            currentGold -= wage;
            totalWages += wage;
            // Morale recovery if paid + Upgrade bonuses
            const moraleRecovery = 1 + upgradeMoraleBonus;
            const newMorale = Math.min(100, staff.morale + moraleRecovery);
            paidStaff.push({ ...staff, morale: newMorale });
        } else {
            // Unpaid!
            const newMorale = Math.max(0, staff.morale - 20);
            summary.staffEvents.push(`${staff.name} (${staff.role}) was not paid. Morale dropped.`);

            if (newMorale <= 0) {
                summary.staffEvents.push(`${staff.name} quit due to lack of payment!`);
            } else {
                paidStaff.push({ ...staff, morale: newMorale });
            }
        }
    }

    summary.goldChange -= totalWages;

    // --- Threat Management ---
    let activeThreats = [...stronghold.threats];

    // 1. Generate new threat?
    const newThreat = generateThreat(stronghold);
    if (newThreat) {
        activeThreats.push(newThreat);
        summary.threatEvents.push(`New Threat: ${newThreat.name} (Severity: ${newThreat.severity})`);
    }

    // 2. Process existing threats
    const remainingThreats: ActiveThreat[] = [];

    for (const threat of activeThreats) {
        const updatedThreat = { ...threat, daysUntilTrigger: threat.daysUntilTrigger - 1 };

        if (updatedThreat.daysUntilTrigger <= 0) {
            // Trigger!
            const resolution = resolveThreat(stronghold, updatedThreat);
            summary.threatEvents.push(...resolution.logs);

            if (!resolution.success) {
                // Apply consequences
                if (updatedThreat.consequences.goldLoss) {
                    currentGold = Math.max(0, currentGold - updatedThreat.consequences.goldLoss);
                    summary.goldChange -= updatedThreat.consequences.goldLoss;
                    summary.threatEvents.push(`Lost ${updatedThreat.consequences.goldLoss} gold.`);
                }
                if (updatedThreat.consequences.suppliesLoss) {
                    currentSupplies = Math.max(0, currentSupplies - updatedThreat.consequences.suppliesLoss);
                    summary.threatEvents.push(`Lost ${updatedThreat.consequences.suppliesLoss} supplies.`);
                }
                 if (updatedThreat.consequences.moraleLoss) {
                     // Reduce morale of remaining staff
                     paidStaff = paidStaff.map(s => ({
                         ...s,
                         morale: Math.max(0, s.morale - (updatedThreat.consequences.moraleLoss || 0))
                     }));
                     summary.threatEvents.push(`Staff morale dropped by ${updatedThreat.consequences.moraleLoss}.`);
                 }
            }
        } else {
            remainingThreats.push(updatedThreat);
        }
    }

    // --- Mission Management ---
    const remainingMissions: StrongholdMission[] = [];
    let missionGold = 0;
    let missionSupplies = 0;
    let missionIntel = 0;
    let missionInfluence = 0;

    for (const mission of stronghold.missions) {
        // Check if staff still exists (didn't quit)
        const staffIndex = paidStaff.findIndex(s => s.id === mission.staffId);
        if (staffIndex === -1) {
            // Staff quit or was fired (shouldn't be fired if check works, but could quit unpaid)
            summary.missionEvents.push(`Mission Cancelled: '${mission.description}' - Staff unavailable.`);
            continue;
        }

        const updatedMission = { ...mission, daysRemaining: mission.daysRemaining - 1 };

        if (updatedMission.daysRemaining <= 0) {
            const staff = paidStaff[staffIndex];
            const result = resolveMission(updatedMission, staff);
            summary.missionEvents.push(result.log);

            if (result.success && result.rewards) {
                if (result.rewards.gold) missionGold += result.rewards.gold;
                if (result.rewards.supplies) missionSupplies += result.rewards.supplies;
                if (result.rewards.intel) missionIntel += result.rewards.intel;
                if (result.rewards.influence) missionInfluence += result.rewards.influence;
            }

            // Free the staff from mission
            paidStaff[staffIndex] = { ...staff, currentMissionId: undefined };

        } else {
            remainingMissions.push(updatedMission);
        }
    }

    currentGold += missionGold;
    currentSupplies += missionSupplies;
    currentIntel += missionIntel;
    currentInfluence += missionInfluence;

    if (missionGold > 0) summary.goldChange += missionGold;
    if (missionInfluence > 0) summary.influenceChange += missionInfluence; // Add mission influence to summary

    // Update Stronghold State
    const updatedStronghold: Stronghold = {
        ...stronghold,
        resources: {
            ...stronghold.resources,
            gold: currentGold,
            supplies: currentSupplies,
            influence: currentInfluence + upgradeInfluence,
            intel: currentIntel + upgradeIntel
        },
        staff: paidStaff,
        threats: remainingThreats,
        missions: remainingMissions
    };

    summary.influenceChange += upgradeInfluence;

    if (currentGold < 50) {
        summary.alerts.push("Warning: Treasury is running low!");
    }

    return { updatedStronghold, summary };
};
