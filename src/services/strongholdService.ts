/**
 * @file src/services/strongholdService.ts
 * Service for managing player strongholds, staff, and daily resource updates.
 */

import { v4 as uuidv4 } from 'uuid';
import { Stronghold, StrongholdType, StrongholdStaff, StaffRole, DailyUpdateSummary } from '../types/stronghold';

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
        dailyIncome: 10 // Base passive income
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
 * Processes daily updates for a stronghold:
 * - Calculates income and expenses
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

    let currentGold = stronghold.resources.gold;

    // Calculate Income
    let dailyIncome = stronghold.dailyIncome;

    // Merchant bonus
    const merchants = stronghold.staff.filter(s => s.role === 'merchant');
    dailyIncome += merchants.length * 5;

    currentGold += dailyIncome;
    summary.goldChange += dailyIncome;

    // Process Expenses (Wages)
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
            // Morale recovery if paid
            const newMorale = Math.min(100, staff.morale + 1);
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
            gold: currentGold
        },
        staff: paidStaff
    };

    if (currentGold < 50) {
        summary.alerts.push("Warning: Treasury is running low!");
    }

    return { updatedStronghold, summary };
};
