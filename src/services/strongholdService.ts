/**
 * @file src/services/strongholdService.ts
 * Service for managing player strongholds, staff, and daily resource updates.
 */

import { v4 as uuidv4 } from 'uuid';
import { Stronghold, StrongholdType, StrongholdStaff, StaffRole, DailyUpdateSummary, StrongholdUpgrade, ConstructionQueueItem } from '../types/stronghold';

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

export const UPGRADE_CATALOG: StrongholdUpgrade[] = [
    {
        id: 'barracks',
        name: 'Barracks',
        description: 'Quarters for guards, improving defense and morale.',
        cost: 500,
        buildTimeDays: 5,
        maintenanceCost: 5,
        effects: [
            { type: 'defense_bonus', value: 10, description: '+10 Defense' },
            { type: 'morale_boost', value: 5, description: '+5 Daily Morale Recovery' }
        ],
        allowedTypes: ['castle', 'tower', 'guild_hall']
    },
    {
        id: 'market_stall',
        name: 'Market Stall',
        description: 'A dedicated area for trade.',
        cost: 300,
        buildTimeDays: 3,
        maintenanceCost: 2,
        effects: [
            { type: 'income_bonus', value: 15, description: '+15 Gold/Day' }
        ],
        allowedTypes: ['castle', 'trading_post', 'guild_hall']
    },
    {
        id: 'library',
        name: 'Library',
        description: 'A collection of books and scrolls.',
        cost: 600,
        buildTimeDays: 7,
        maintenanceCost: 5,
        effects: [
            { type: 'intel_bonus', value: 2, description: '+2 Intel/Day' }
        ],
        allowedTypes: ['castle', 'tower', 'temple']
    },
];

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
 * Returns a list of upgrades that can be built in this stronghold.
 * Filters out already owned upgrades and upgrades not allowed for this type.
 */
export const getAvailableUpgrades = (stronghold: Stronghold): StrongholdUpgrade[] => {
    return UPGRADE_CATALOG.filter(upgrade => {
        // Check if already owned or in queue
        if ((stronghold.upgrades || []).includes(upgrade.id)) return false;
        if ((stronghold.constructionQueue || []).some(item => item.upgradeId === upgrade.id)) return false;

        // Check type restrictions
        if (upgrade.allowedTypes && !upgrade.allowedTypes.includes(stronghold.type)) return false;

        // Check level requirement
        if (upgrade.requiredStrongholdLevel && stronghold.level < upgrade.requiredStrongholdLevel) return false;

        return true;
    });
};

/**
 * Starts construction of an upgrade.
 * Deducts cost and adds to construction queue.
 * Throws error if insufficient funds or invalid upgrade.
 */
export const startConstruction = (stronghold: Stronghold, upgradeId: string): Stronghold => {
    const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
    if (!upgrade) {
        throw new Error(`Upgrade with ID ${upgradeId} not found.`);
    }

    // Check availability
    const available = getAvailableUpgrades(stronghold);
    if (!available.some(u => u.id === upgradeId)) {
        throw new Error(`Upgrade ${upgrade.name} is not available for this stronghold (already owned or incompatible).`);
    }

    // Check cost
    if (stronghold.resources.gold < upgrade.cost) {
        throw new Error(`Insufficient funds. Cost: ${upgrade.cost}, Available: ${stronghold.resources.gold}`);
    }

    const newQueueItem: ConstructionQueueItem = {
        upgradeId: upgrade.id,
        daysRemaining: upgrade.buildTimeDays
    };

    return {
        ...stronghold,
        resources: {
            ...stronghold.resources,
            gold: stronghold.resources.gold - upgrade.cost
        },
        constructionQueue: [...stronghold.constructionQueue, newQueueItem]
    };
};

/**
 * Processes daily updates for a stronghold:
 * - Calculates income and expenses (including upgrade maintenance)
 * - Pays staff (or reduces morale if unable)
 * - Processes staff departures due to low morale
 * - Advances construction queue
 */
export const processDailyUpkeep = (stronghold: Stronghold): { updatedStronghold: Stronghold; summary: DailyUpdateSummary } => {
    const summary: DailyUpdateSummary = {
        strongholdId: stronghold.id,
        goldChange: 0,
        influenceChange: 0,
        staffEvents: [],
        constructionEvents: [],
        alerts: []
    };

    let currentGold = stronghold.resources.gold;
    // Default intel to 0 if undefined to avoid NaN issues during upgrade
    let currentIntel = stronghold.resources.intel || 0;
    const completedUpgrades: string[] = [...(stronghold.upgrades || [])];
    const newQueue: ConstructionQueueItem[] = [];

    // --- Process Construction Queue ---
    for (const item of (stronghold.constructionQueue || [])) {
        const remaining = item.daysRemaining - 1;
        if (remaining <= 0) {
            completedUpgrades.push(item.upgradeId);
            const upgradeName = UPGRADE_CATALOG.find(u => u.id === item.upgradeId)?.name || item.upgradeId;
            summary.constructionEvents.push(`${upgradeName} construction completed!`);
        } else {
            newQueue.push({ ...item, daysRemaining: remaining });
        }
    }

    // --- Calculate Effects from Upgrades ---
    let incomeBonus = 0;
    let intelBonus = 0;
    let maintenanceCosts = 0;
    let wageReductionPercent = 0;
    let moraleRecoveryBonus = 0;

    for (const upgradeId of completedUpgrades) {
        const upgrade = UPGRADE_CATALOG.find(u => u.id === upgradeId);
        if (upgrade) {
            maintenanceCosts += upgrade.maintenanceCost;
            for (const effect of upgrade.effects) {
                switch (effect.type) {
                    case 'income_bonus':
                        incomeBonus += effect.value;
                        break;
                    case 'intel_bonus':
                        intelBonus += effect.value;
                        break;
                    case 'wage_reduction':
                        wageReductionPercent += effect.value;
                        break;
                    case 'morale_boost':
                        moraleRecoveryBonus += effect.value;
                        break;
                }
            }
        }
    }

    // --- Calculate Income ---
    let dailyIncome = stronghold.dailyIncome + incomeBonus;

    // Merchant bonus
    const merchants = stronghold.staff.filter(s => s.role === 'merchant');
    dailyIncome += merchants.length * 5;

    currentGold += dailyIncome;
    currentIntel += intelBonus;

    summary.goldChange += dailyIncome;

    // --- Process Expenses (Wages & Maintenance) ---
    let totalExpenses = maintenanceCosts;
    const paidStaff: StrongholdStaff[] = [];

    // Steward bonus (reduce wages)
    const stewards = stronghold.staff.filter(s => s.role === 'steward');
    const stewardReduction = (stewards.length * 0.05); // 5% per steward
    const totalWageReduction = Math.min(0.5, stewardReduction + (wageReductionPercent / 100)); // Cap at 50%

    // Pay staff
    for (const staff of stronghold.staff) {
        const wage = Math.floor(staff.dailyWage * (1 - totalWageReduction));
        totalExpenses += wage;

        // Check if we can pay this specific staff + accumulated maintenance so far?
        // Simpler model: Pay expenses from pool. If pool runs out, staff stop getting paid.
        // We will prioritize maintenance first (building decay not implemented yet), then staff.

        // Actually, let's deduct maintenance first.
    }

    // Deduct maintenance
    if (currentGold >= maintenanceCosts) {
        currentGold -= maintenanceCosts;
        summary.goldChange -= maintenanceCosts;
    } else {
        // Can't pay maintenance!
        const remainingGold = currentGold;
        currentGold = 0;
        summary.alerts.push("Could not pay building maintenance!");
        summary.goldChange -= remainingGold;
        // (Future: degrade buildings)
    }

    // Pay Staff
    for (const staff of stronghold.staff) {
        const wage = Math.floor(staff.dailyWage * (1 - totalWageReduction));

        if (currentGold >= wage) {
            currentGold -= wage;
            summary.goldChange -= wage;

            // Morale recovery
            const newMorale = Math.min(100, staff.morale + 1 + moraleRecoveryBonus);
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

    if (currentGold < 50) {
        summary.alerts.push("Warning: Treasury is running low!");
    }

    // Update Stronghold State
    const updatedStronghold: Stronghold = {
        ...stronghold,
        resources: {
            ...stronghold.resources,
            gold: currentGold,
            intel: currentIntel
        },
        staff: paidStaff,
        upgrades: completedUpgrades,
        constructionQueue: newQueue
    };

    return { updatedStronghold, summary };
};
