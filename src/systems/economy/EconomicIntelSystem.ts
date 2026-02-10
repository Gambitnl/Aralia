/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/EconomicIntelSystem.ts
 * Medieval information delivery system.
 * Economic reports arrive via couriers with delay. Market intel is bought at taverns.
 * Investment results come as letters days after the event.
 * No instant data — information trickles through the world.
 */

import { EconomyState, PendingCourier, CourierMessageType, PlayerInvestment } from '../../types/economy';
import { SeededRandom } from '@/utils/random';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calculates courier delivery delay based on distance between regions.
 * Adjacent regions: 1 day. Far regions: up to 5 days.
 * This is a simplified distance model — could be enhanced with actual region graph.
 */
export const calculateIntelDelay = (
    sourceRegionId: string,
    playerRegionId: string
): number => {
    if (sourceRegionId === playerRegionId) return 1; // Local news, still takes a day

    // Simple hash-based "distance" — in a real system this would use a region graph
    const srcHash = hashString(sourceRegionId);
    const dstHash = hashString(playerRegionId);
    const pseudoDistance = Math.abs(srcHash - dstHash) % 5;

    return Math.max(1, pseudoDistance + 1); // 1-5 days
};

/**
 * Generates an economic rumor that a player might overhear at a tavern.
 * Rumors have varying accuracy — some are wrong or exaggerated.
 */
export const generateEconomicRumor = (
    economy: EconomyState,
    playerRegionId: string,
    targetRegionId: string,
    rng: SeededRandom
): PendingCourier | null => {
    const delay = calculateIntelDelay(targetRegionId, playerRegionId);
    const accuracy = 0.5 + rng.next() * 0.5; // 50-100% accurate

    // Pick a rumor type based on current economic conditions
    const templates = getRumorTemplates(economy, targetRegionId);
    if (templates.length === 0) return null;

    const template = templates[Math.floor(rng.next() * templates.length)];

    // Apply accuracy — inaccurate rumors may flip the message
    let messageText = template.text;
    if (accuracy < 0.7) {
        messageText = template.inaccurateText || template.text;
    }

    return {
        id: uuidv4(),
        sourceRegionId: targetRegionId,
        deliveryDay: 0, // Will be set by caller (currentDay + delay)
        messageText,
        accuracy,
        type: 'market_intel'
    };
};

interface RumorTemplate {
    text: string;
    inaccurateText?: string;
}

const getRumorTemplates = (
    economy: EconomyState,
    regionId: string
): RumorTemplate[] => {
    const templates: RumorTemplate[] = [];

    // Check market events
    if (economy.marketEvents) {
        for (const event of economy.marketEvents) {
            if (event.type === 'SHORTAGE') {
                templates.push({
                    text: `Merchants say there's a shortage of goods near ${regionId}. Prices are climbing.`,
                    inaccurateText: `Heard there might be a surplus of goods near ${regionId}. Prices could drop soon.`
                });
            } else if (event.type === 'SURPLUS') {
                templates.push({
                    text: `Word is, goods are piling up near ${regionId}. Good time to buy cheap.`,
                    inaccurateText: `Someone said goods are getting scarce near ${regionId}. Better stock up.`
                });
            }
        }
    }

    // Check trade route status
    for (const route of economy.tradeRoutes) {
        if (route.status === 'disrupted') {
            templates.push({
                text: `The ${route.name} has been disrupted. Deliveries may be delayed.`,
                inaccurateText: `The ${route.name} is running smoothly. Trade is booming.`
            });
        } else if (route.status === 'blockaded') {
            templates.push({
                text: `The ${route.name} is blockaded! No goods are getting through.`,
                inaccurateText: `I heard the ${route.name} blockade was lifted recently.`
            });
        }
    }

    // Regional wealth insights
    const regionWealth = economy.regionalWealth?.[regionId] || 50;
    if (regionWealth > 70) {
        templates.push({
            text: `The folk in ${regionId} are prosperous. Prices are high but coin flows freely.`
        });
    } else if (regionWealth < 30) {
        templates.push({
            text: `Hard times in ${regionId}. People can barely afford bread.`
        });
    }

    // Inflation
    if (economy.globalInflation > 0.2) {
        templates.push({
            text: `Everything's getting more expensive these days. The coin just doesn't stretch like it used to.`,
            inaccurateText: `I heard prices are actually going down. Merchants must be getting desperate.`
        });
    }

    // Fallback generic rumor
    if (templates.length === 0) {
        templates.push({
            text: `Trade seems steady. Nothing unusual to report from ${regionId}.`
        });
    }

    return templates;
};

/**
 * Generates a courier message for a completed/failed investment.
 */
export const generateInvestmentCourier = (
    investment: PlayerInvestment,
    playerRegionId: string,
    currentDay: number,
    rng: SeededRandom
): PendingCourier => {
    const sourceRegion = investment.regionId || 'unknown_region';
    const delay = calculateIntelDelay(sourceRegion, playerRegionId);
    const accuracy = 0.8 + rng.next() * 0.2; // 80-100% accurate for official reports

    let messageText: string;
    let type: CourierMessageType;

    switch (investment.type) {
        case 'caravan':
            if (investment.status === 'completed') {
                messageText = `Your caravan has returned! The goods sold for ${Math.round(investment.currentValue)} gold pieces.`;
            } else if (investment.status === 'failed') {
                messageText = `Dire news — your caravan was lost on the road. The investment of ${investment.principalGold} gold is gone.`;
            } else {
                messageText = `Your caravan is still en route. No news yet.`;
            }
            type = 'investment_result';
            break;

        case 'loan_taken':
            if (investment.status === 'defaulted') {
                messageText = `URGENT: Your loan has gone into default. The lender demands immediate repayment of ${Math.round(investment.currentValue)} gold.`;
            } else {
                messageText = `Loan status: ${Math.round(investment.currentValue)} gold remaining. Interest continues to accrue.`;
            }
            type = 'loan_notice';
            break;

        case 'speculation':
            messageText = `Market report: Your ${investment.goodCategory || 'goods'} speculation is currently valued at ${Math.round(investment.currentValue)} gold (${investment.currentValue > investment.principalGold ? 'up' : 'down'} from ${investment.principalGold}).`;
            type = 'investment_result';
            break;

        default:
            messageText = `Report on your investment: current value ${Math.round(investment.currentValue)} gold.`;
            type = 'investment_result';
    }

    return {
        id: uuidv4(),
        sourceRegionId: sourceRegion,
        deliveryDay: currentDay + delay,
        messageText,
        accuracy,
        type
    };
};

/**
 * Filters investment information based on what the player should know.
 * The player only learns about investment results after the courier delay.
 */
export const filterVisibleInvestmentInfo = (
    investments: PlayerInvestment[],
    _playerRegionId: string,
    gameDay: number
): PlayerInvestment[] => {
    return investments.map(inv => {
        // Active investments: show last known value (potentially stale)
        if (inv.status === 'active') {
            const daysSinceUpdate = gameDay - inv.lastUpdateDay;
            if (daysSinceUpdate > 3) {
                // Information is stale — show last known value with staleness indicator
                return { ...inv };
            }
        }
        return inv;
    });
};

/**
 * Process courier delivery: find all couriers whose deliveryDay has arrived.
 * Returns messages to deliver and remaining pending couriers.
 */
export const processDeliveries = (
    couriers: PendingCourier[],
    currentDay: number
): { delivered: PendingCourier[]; remaining: PendingCourier[] } => {
    const delivered: PendingCourier[] = [];
    const remaining: PendingCourier[] = [];

    for (const courier of couriers) {
        if (currentDay >= courier.deliveryDay) {
            delivered.push(courier);
        } else {
            remaining.push(courier);
        }
    }

    return { delivered, remaining };
};

// --- Utility ---

const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit int
    }
    return Math.abs(hash);
};
