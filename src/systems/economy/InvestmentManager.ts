/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/InvestmentManager.ts
 * Static utility class for processing player investments daily:
 * caravan returns, speculation value changes, and loan interest.
 */

import { PlayerInvestment, EconomyState, TradeRoute } from '../../types/economy';
import { TradeRouteSystem } from './TradeRouteSystem';
import { SeededRandom } from '@/utils/random';

export interface InvestmentProcessResult {
    investments: PlayerInvestment[];
    goldChange: number;
    completedIds: string[];
    failedIds: string[];
    logs: string[];
}

/**
 * Process all player investments for one day.
 * Caravans progress toward completion, loans accrue interest,
 * speculation values shift with market conditions.
 */
export const processAllInvestments = (
    investments: PlayerInvestment[],
    economy: EconomyState,
    gameDay: number,
    rng: SeededRandom
): InvestmentProcessResult => {
    let goldChange = 0;
    const completedIds: string[] = [];
    const failedIds: string[] = [];
    const logs: string[] = [];

    const updatedInvestments = investments.map(inv => {
        if (inv.status !== 'active') return inv;

        switch (inv.type) {
            case 'caravan': {
                const result = processCaravanDaily(inv, economy, gameDay, rng);
                if (result.status === 'completed') {
                    completedIds.push(inv.id);
                    logs.push(`A caravan investment has returned! Value: ${Math.round(result.currentValue)} gold.`);
                } else if (result.status === 'failed') {
                    failedIds.push(inv.id);
                    logs.push(`A caravan was lost on the road. Your investment of ${inv.principalGold} gold is gone.`);
                }
                return result;
            }
            case 'loan_taken': {
                return processLoanDaily(inv, gameDay);
            }
            case 'speculation': {
                return processSpeculationDaily(inv, economy, gameDay, rng);
            }
            default:
                return inv;
        }
    });

    return { investments: updatedInvestments, goldChange, completedIds, failedIds, logs };
};

/**
 * Processes a caravan investment for one day.
 * When enough days pass (durationDays), the caravan returns with profits or losses.
 */
const processCaravanDaily = (
    investment: PlayerInvestment,
    economy: EconomyState,
    gameDay: number,
    rng: SeededRandom
): PlayerInvestment => {
    const daysSinceStart = gameDay - investment.startDay;

    if (daysSinceStart < investment.durationDays) {
        // Still in transit — no change
        return { ...investment, lastUpdateDay: gameDay };
    }

    // Caravan has arrived — determine outcome
    const route = economy.tradeRoutes.find(r => r.id === investment.tradeRouteId);

    if (!route) {
        // Route no longer exists — partial loss
        return {
            ...investment,
            currentValue: investment.principalGold * 0.5,
            status: 'completed',
            lastUpdateDay: gameDay
        };
    }

    // Check for failure (ambush, disaster, etc.)
    const failChance = route.riskLevel * 0.3; // 0-30% failure chance based on risk
    if (rng.next() < failChance) {
        return {
            ...investment,
            currentValue: 0,
            status: 'failed',
            lastUpdateDay: gameDay
        };
    }

    // Calculate return based on route profitability
    const profitability = TradeRouteSystem.calculateProfitability(route, economy.marketEvents || []);

    // Profitability 0-100 maps to return multiplier 0.5x-2.5x
    const returnMultiplier = 0.5 + (profitability / 100) * 2.0;

    // Add randomness (-15% to +15%)
    const randomFactor = 0.85 + rng.next() * 0.3;

    const finalValue = investment.principalGold * returnMultiplier * randomFactor;

    return {
        ...investment,
        currentValue: Math.round(finalValue * 100) / 100,
        status: 'completed',
        lastUpdateDay: gameDay
    };
};

/**
 * Processes daily interest accrual on a loan.
 * Interest compounds daily at (interestRate / durationDays) per day.
 */
const processLoanDaily = (
    loan: PlayerInvestment,
    gameDay: number
): PlayerInvestment => {
    if (!loan.interestRate || loan.interestRate <= 0) {
        return { ...loan, lastUpdateDay: gameDay };
    }

    // Daily interest rate = total rate / duration in days
    const dailyRate = loan.interestRate / Math.max(1, loan.durationDays);
    const interest = loan.currentValue * dailyRate;

    const newValue = loan.currentValue + interest;

    // Check for default (loan duration exceeded)
    const daysSinceStart = gameDay - loan.startDay;
    if (daysSinceStart > loan.durationDays * 1.5) {
        // Defaulted — 150% of original duration exceeded
        return {
            ...loan,
            currentValue: newValue,
            status: 'defaulted',
            lastUpdateDay: gameDay
        };
    }

    return {
        ...loan,
        currentValue: Math.round(newValue * 100) / 100,
        lastUpdateDay: gameDay
    };
};

/**
 * Processes daily value change for a speculation investment.
 * Value shifts based on regional market conditions for the good category.
 */
const processSpeculationDaily = (
    spec: PlayerInvestment,
    economy: EconomyState,
    gameDay: number,
    rng: SeededRandom
): PlayerInvestment => {
    // Base daily change: small random fluctuation
    let dailyChange = (rng.next() - 0.5) * 0.06; // -3% to +3%

    // Check if any market events affect this good category
    if (spec.goodCategory && economy.marketEvents) {
        for (const event of economy.marketEvents) {
            const eventName = (event.name || '').toLowerCase();
            if (eventName.includes(spec.goodCategory.toLowerCase())) {
                if (event.type === 'SHORTAGE') {
                    dailyChange += event.intensity * 0.02; // Price going up
                } else if (event.type === 'SURPLUS') {
                    dailyChange -= event.intensity * 0.02; // Price going down
                }
            }
        }
    }

    // Apply regional wealth changes if spec is tied to a region
    if (spec.regionId && economy.regionalWealth) {
        const regionWealth = economy.regionalWealth[spec.regionId] || 50;
        // Wealthier regions: goods appreciate; poorer: depreciate
        dailyChange += (regionWealth - 50) / 5000; // Very subtle
    }

    const newValue = spec.currentValue * (1 + dailyChange);

    return {
        ...spec,
        currentValue: Math.max(0.01, Math.round(newValue * 100) / 100),
        lastUpdateDay: gameDay
    };
};
