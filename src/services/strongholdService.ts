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
    ConstructionProject
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
    guard: 'Increases defense',
    spy: 'Generates intel',
    merchant: 'Generates gold',
    blacksmith: 'Reduces equipment costs',
    priest: 'Increases morale recovery'
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
        constructionQueue: []
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
 * Processes daily updates for a stronghold:
 * - Calculates income and expenses (including Upgrade effects)
 * - Pays staff (or reduces morale if unable)
 * - Processes staff departures due to low morale
 */
export const processDailyUpkeep = (stronghold: Stronghold): { updatedStronghold: Stronghold; summary: DailyUpdateSummary } => {
    const summary: DailyUpdateSummary = {
        strongholdId: stronghold.id,
        goldChange: 0,
        influenceChange: 0,
        staffEvents: [],
        alerts: []
    };

    // --- Calculate Bonuses from Upgrades ---
    let upgradeIncomeFlat = 0;
    let upgradeIncomePercent = 0;
    let upgradeInfluence = 0;
    let upgradeIntel = 0;
    let upgradeMoraleBonus = 0;
    // (Defense bonus is passive, not daily generated)

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

    // --- Calculate Income ---
    let dailyIncome = stronghold.dailyIncome;

    // Merchant bonus
    const merchants = stronghold.staff.filter(s => s.role === 'merchant');
    dailyIncome += merchants.length * 5;

    // Upgrade bonuses
    dailyIncome += upgradeIncomeFlat;
    // Apply percent bonus (e.g. 10% = * 1.10)
    if (upgradeIncomePercent > 0) {
        dailyIncome = Math.floor(dailyIncome * (1 + upgradeIncomePercent / 100));
    }

    currentGold += dailyIncome;
    summary.goldChange += dailyIncome;

    // --- Process Expenses (Wages) ---
    let totalWages = 0;
    const paidStaff: StrongholdStaff[] = [];

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
                // Do not add to paidStaff (effectively removing them)
            } else {
                paidStaff.push({ ...staff, morale: newMorale });
            }
        }
    }

    summary.goldChange -= totalWages;

    // Update Stronghold State
    const updatedStronghold: Stronghold = {
        ...stronghold,
        resources: {
            ...stronghold.resources,
            gold: currentGold,
            influence: (stronghold.resources.influence || 0) + upgradeInfluence,
            intel: (stronghold.resources.intel || 0) + upgradeIntel
        },
        staff: paidStaff
    };

    summary.influenceChange = upgradeInfluence;

    if (currentGold < 50) {
        summary.alerts.push("Warning: Treasury is running low!");
    }

    return { updatedStronghold, summary };
};
