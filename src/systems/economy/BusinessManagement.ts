/**
 * @file src/systems/economy/BusinessManagement.ts
 * Management simulation: decay mechanics, random business events,
 * NPC manager system, and ramp-up period for new businesses.
 */

import { WorldBusiness, BusinessEvent, BusinessType } from '../../types/business';
import { EconomyState } from '../../types/economy';
import { SeededRandom } from '@/utils/random';

// --- Management Decay ---

/**
 * Processes management decay for a player-owned business.
 * Without a manager or player visits, metrics deteriorate over time.
 */
export const processManagementDecay = (
    business: WorldBusiness,
    _gameDay: number
): WorldBusiness => {
    if (business.ownerType !== 'player') return business;

    const hasManager = !!business.managerId;
    const days = business.daysSinceManaged + 1;

    // Grace period: no penalty for first 3 days
    if (days <= 3) {
        return { ...business, daysSinceManaged: days };
    }

    // Calculate raw decay rate based on neglect duration
    let reputationDecay = 0;
    let satisfactionDecay = 0;

    if (days <= 7) {
        reputationDecay = -1;
    } else if (days <= 14) {
        reputationDecay = -2;
        satisfactionDecay = -1;
    } else {
        reputationDecay = -3;
        satisfactionDecay = -2;
    }

    // Manager mitigates decay
    if (hasManager) {
        const mitigation = business.managerEfficiency / 100; // 0-1
        reputationDecay = Math.round(reputationDecay * (1 - mitigation));
        satisfactionDecay = Math.round(satisfactionDecay * (1 - mitigation));
    }

    return {
        ...business,
        daysSinceManaged: days,
        metrics: {
            ...business.metrics,
            reputation: Math.max(0, business.metrics.reputation + reputationDecay),
            customerSatisfaction: Math.max(0, business.metrics.customerSatisfaction + satisfactionDecay),
        },
    };
};

// --- Manager Efficiency ---

interface MinimalNpcForManager {
    role: string;
    biography?: { level: number; classId?: string };
}

/**
 * Calculates manager efficiency from an NPC's attributes.
 * Merchant NPCs are better managers than others.
 */
export const calculateManagerEfficiency = (npc: MinimalNpcForManager): number => {
    const level = npc.biography?.level ?? 1;
    if (npc.role === 'merchant') {
        return Math.min(90, 50 + level * 3);
    }
    return Math.min(60, 20 + level * 2);
};

/**
 * Calculates the daily wage cost for a manager based on their efficiency.
 */
export const calculateManagerWage = (efficiency: number): number => {
    return Math.round(efficiency * 0.5 * 100) / 100; // 0-45 gold/day
};

// --- Business Events ---

const EVENT_CHANCE_BY_TYPE: Partial<Record<BusinessType, number>> = {
    tavern: 0.10,
    mine: 0.03,
};
const DEFAULT_EVENT_CHANCE = 0.05;

interface PositiveEvent { name: string; description: string; reputationChange: number; goldChange: number; customerSatisfactionChange: number; }
interface NegativeEvent { name: string; description: string; reputationChange: number; goldChange: number; customerSatisfactionChange: number; supplyChainHealthChange: number; staffEfficiencyChange: number; }
interface NeutralEvent { name: string; description: string; competitorPressureChange: number; }

const POSITIVE_EVENTS: PositiveEvent[] = [
    { name: 'Celebrity Visitor', description: 'A famous adventurer stopped by, drawing crowds and attention.', reputationChange: 8, goldChange: 50, customerSatisfactionChange: 5 },
    { name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },
    { name: 'Festival Boost', description: 'A local festival brought an influx of customers through your doors.', reputationChange: 3, goldChange: 80, customerSatisfactionChange: 8 },
    { name: 'Favorable Review', description: 'A travelling bard spread word of your fine establishment across the region.', reputationChange: 10, goldChange: 0, customerSatisfactionChange: 3 },
];

const NEGATIVE_EVENTS: NegativeEvent[] = [
    { name: 'Theft', description: 'Thieves broke in overnight and made off with gold from the strongbox.', reputationChange: -2, goldChange: -100, customerSatisfactionChange: -3, supplyChainHealthChange: 0, staffEfficiencyChange: -5 },
    { name: 'Fire', description: 'A small fire broke out in the stockroom, damaging supplies.', reputationChange: -3, goldChange: -50, customerSatisfactionChange: -5, supplyChainHealthChange: -15, staffEfficiencyChange: -5 },
    { name: 'Tax Audit', description: 'The local tax collector paid an unexpected visit and demanded back taxes.', reputationChange: 0, goldChange: -150, customerSatisfactionChange: 0, supplyChainHealthChange: 0, staffEfficiencyChange: 0 },
    { name: 'Staff Dispute', description: 'Workers are quarrelling among themselves, dragging down morale.', reputationChange: -1, goldChange: 0, customerSatisfactionChange: -3, supplyChainHealthChange: 0, staffEfficiencyChange: -12 },
    { name: 'Rat Infestation', description: 'Rats have overrun the storage area, spoiling goods and alarming customers.', reputationChange: -5, goldChange: -30, customerSatisfactionChange: -10, supplyChainHealthChange: -10, staffEfficiencyChange: 0 },
];

const NEUTRAL_EVENTS: NeutralEvent[] = [
    { name: 'Competitor Closes', description: 'A rival establishment has shuttered its doors. Less competition for now.', competitorPressureChange: -15 },
    { name: 'New Competitor', description: 'A new business opened nearby, competing for the same customers.', competitorPressureChange: 15 },
    { name: 'Supplier Changes Terms', description: 'Your main supplier has adjusted their rates. You may want to renegotiate.', competitorPressureChange: 5 },
];

/**
 * Processes a potential random business event for the day.
 */
export const processBusinessEvent = (
    business: WorldBusiness,
    _economy: EconomyState,
    gameDay: number,
    rng: SeededRandom
): { business: WorldBusiness; event?: BusinessEvent } => {
    const eventChance = EVENT_CHANCE_BY_TYPE[business.businessType] ?? DEFAULT_EVENT_CHANCE;

    if (rng.next() > eventChance) {
        return { business }; // No event today
    }

    // Determine event category: 30% positive, 45% negative, 25% neutral
    const categoryRoll = rng.next();
    let event: BusinessEvent;

    if (categoryRoll < 0.30) {
        const e = POSITIVE_EVENTS[rng.nextInt(0, POSITIVE_EVENTS.length)];
        event = {
            id: `evt_${gameDay}_${rng.nextInt(1000, 10000)}`,
            businessId: business.id,
            type: 'positive',
            name: e.name,
            description: e.description,
            effects: {
                reputationChange: e.reputationChange,
                goldChange: e.goldChange,
                customerSatisfactionChange: e.customerSatisfactionChange,
            },
            day: gameDay,
        };
    } else if (categoryRoll < 0.75) {
        const e = NEGATIVE_EVENTS[rng.nextInt(0, NEGATIVE_EVENTS.length)];
        // Scale severity by reputation (higher rep businesses are bigger targets)
        const scale = 0.5 + (business.metrics.reputation / 200);
        event = {
            id: `evt_${gameDay}_${rng.nextInt(1000, 10000)}`,
            businessId: business.id,
            type: 'negative',
            name: e.name,
            description: e.description,
            effects: {
                reputationChange: Math.round(e.reputationChange * scale),
                goldChange: Math.round(e.goldChange * scale),
                customerSatisfactionChange: Math.round(e.customerSatisfactionChange * scale),
                supplyChainHealthChange: Math.round(e.supplyChainHealthChange * scale),
                staffEfficiencyChange: Math.round(e.staffEfficiencyChange * scale),
            },
            day: gameDay,
        };
    } else {
        const e = NEUTRAL_EVENTS[rng.nextInt(0, NEUTRAL_EVENTS.length)];
        event = {
            id: `evt_${gameDay}_${rng.nextInt(1000, 10000)}`,
            businessId: business.id,
            type: 'neutral',
            name: e.name,
            description: e.description,
            effects: {},
            day: gameDay,
        };
        // Apply competitor pressure change directly
        return {
            business: {
                ...business,
                metrics: {
                    ...business.metrics,
                    competitorPressure: Math.max(0, Math.min(100,
                        business.metrics.competitorPressure + e.competitorPressureChange
                    )),
                }
            },
            event,
        };
    }

    // Apply effects
    const fx = event.effects;
    return {
        business: {
            ...business,
            metrics: {
                ...business.metrics,
                reputation: Math.max(0, Math.min(100, business.metrics.reputation + (fx.reputationChange ?? 0))),
                customerSatisfaction: Math.max(0, Math.min(100, business.metrics.customerSatisfaction + (fx.customerSatisfactionChange ?? 0))),
                supplyChainHealth: Math.max(0, Math.min(100, business.metrics.supplyChainHealth + (fx.supplyChainHealthChange ?? 0))),
                staffEfficiency: Math.max(0, Math.min(100, business.metrics.staffEfficiency + (fx.staffEfficiencyChange ?? 0))),
            },
        },
        event,
    };
};

// --- New Business Ramp-Up ---

/**
 * Applies customer caps for newly founded/acquired businesses.
 * First 30 days have progressively increasing customer caps.
 */
export const processNewBusinessRampUp = (
    business: WorldBusiness,
    gameDay: number
): WorldBusiness => {
    if (!business.foundedDay) return business;

    const daysSinceFounded = gameDay - business.foundedDay;
    if (daysSinceFounded > 30) return business; // Past ramp-up period

    // Customer cap as percentage of template base
    let capPercent: number;
    if (daysSinceFounded <= 7) {
        capPercent = 0.30;
    } else if (daysSinceFounded <= 14) {
        capPercent = 0.50;
    } else {
        capPercent = 0.75;
    }

    // Reputation grows 2x faster during ramp-up (reward good management)
    const reputationBoost = business.metrics.customerSatisfaction > 60 ? 1 : 0;

    return {
        ...business,
        dailyCustomers: Math.max(1, Math.round(business.dailyCustomers * capPercent)),
        metrics: {
            ...business.metrics,
            reputation: Math.min(100, business.metrics.reputation + reputationBoost),
        },
    };
};

// --- Batch Processor ---

export interface ManagementDailyResult {
    worldBusinesses: Record<string, WorldBusiness>;
    events: BusinessEvent[];
}

/**
 * Processes management decay, events, and ramp-up for all player-owned worldBusinesses.
 */
export const processPlayerBusinessManagement = (
    worldBusinesses: Record<string, WorldBusiness>,
    economy: EconomyState,
    gameDay: number,
    rng: SeededRandom
): ManagementDailyResult => {
    const updated: Record<string, WorldBusiness> = { ...worldBusinesses };
    const events: BusinessEvent[] = [];

    for (const [id, business] of Object.entries(worldBusinesses)) {
        if (business.ownerType !== 'player') continue;

        // 1. Management decay
        let processed = processManagementDecay(business, gameDay);

        // 2. Random events
        const { business: afterEvent, event } = processBusinessEvent(processed, economy, gameDay, rng);
        processed = afterEvent;
        if (event) events.push(event);

        // 3. Ramp-up for new businesses
        processed = processNewBusinessRampUp(processed, gameDay);

        updated[id] = processed;
    }

    return { worldBusinesses: updated, events };
};
