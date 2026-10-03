/**
 * @file commerceDeskSelectors.test.ts
 * Unit tests for the Commerce Desk pure selectors (E-G1 dedicated economy home).
 */
import { describe, it, expect } from 'vitest';
import {
    selectPlayerHoldings,
    selectTradeOutlook,
    selectVenturesSummary,
    selectCourierIntel,
} from '../commerceDeskSelectors';
import { BusinessState, WorldBusiness } from '../../../types/business';
import {
    EconomyState,
    MarketEvent,
    MarketEventType,
    PendingCourier,
    PlayerInvestment,
    TradeRoute,
} from '../../../types/economy';

const baseMetrics = {
    customerSatisfaction: 70,
    reputation: 55,
    competitorPressure: 30,
    supplyChainHealth: 80,
    staffEfficiency: 60,
};

const dailyReport = (profit: number, supplyIssues: string[] = []) => ({
    day: 10,
    revenue: profit + 20,
    costs: 20,
    profit,
    customersSatisfied: 12,
    customersLost: 1,
    supplyIssues,
    competitorActions: [],
    staffIssues: [],
});

const worldBiz = (overrides: Partial<WorldBusiness> = {}): WorldBusiness => ({
    id: 'wb1',
    name: 'The Gilded Tankard',
    locationId: 'loc1',
    ownerId: 'player',
    ownerType: 'player',
    businessType: 'tavern',
    metrics: { ...baseMetrics },
    supplyContracts: [],
    dailyCustomers: 20,
    priceMultiplier: 1.0,
    competitorIds: [],
    lastDailyReport: dailyReport(14),
    daysSinceManaged: 1,
    managerEfficiency: 0,
    ...overrides,
});

const strongholdBiz = (overrides: Partial<BusinessState> = {}): BusinessState => ({
    strongholdId: 'sh1',
    businessType: 'smithy',
    metrics: { ...baseMetrics },
    supplyContracts: [],
    dailyCustomers: 8,
    priceMultiplier: 1.0,
    competitorIds: [],
    lastDailyReport: dailyReport(-3, ['Iron shipment delayed']),
    ...overrides,
});

describe('selectPlayerHoldings', () => {
    it('merges player world businesses and stronghold businesses into one list', () => {
        const holdings = selectPlayerHoldings(
            { wb1: worldBiz() },
            { sh1: strongholdBiz() },
        );
        expect(holdings).toHaveLength(2);
        expect(holdings[0]).toMatchObject({
            id: 'wb1',
            name: 'The Gilded Tankard',
            kind: 'world',
            profitPerDay: 14,
        });
        expect(holdings[1]).toMatchObject({
            id: 'sh1',
            name: 'Smithy',
            kind: 'stronghold',
            profitPerDay: -3,
        });
    });

    it('excludes NPC-owned world businesses', () => {
        const holdings = selectPlayerHoldings(
            { npc: worldBiz({ id: 'npc', ownerId: 'npc_1', ownerType: 'npc' }) },
            undefined,
        );
        expect(holdings).toHaveLength(0);
    });

    it('flags neglected world businesses (past 3-day grace, no manager)', () => {
        const holdings = selectPlayerHoldings(
            {
                fresh: worldBiz({ id: 'fresh', daysSinceManaged: 2 }),
                stale: worldBiz({ id: 'stale', daysSinceManaged: 6 }),
                covered: worldBiz({ id: 'covered', daysSinceManaged: 9, managerId: 'npc_m' }),
            },
            undefined,
        );
        const byId = Object.fromEntries(holdings.map(h => [h.id, h]));
        expect(byId.fresh.needsAttention).toBe(false);
        expect(byId.stale.needsAttention).toBe(true);
        expect(byId.covered.needsAttention).toBe(false);
    });

    it('handles missing records gracefully', () => {
        expect(selectPlayerHoldings(undefined, undefined)).toEqual([]);
    });
});

describe('selectTradeOutlook', () => {
    const route = (id: string, status: TradeRoute['status']): TradeRoute => ({
        id,
        name: `Route ${id}`,
        originId: 'a',
        destinationId: 'b',
        goods: ['iron'],
        status,
        riskLevel: 0.3,
        profitability: 40,
    });
    const event = (id: string, type: MarketEventType): MarketEvent => ({
        id,
        type,
        startTime: 0,
        duration: 5,
        intensity: 0.5,
    });

    it('counts route statuses and buckets market events', () => {
        const economy = {
            tradeRoutes: [
                route('r1', 'active'),
                route('r2', 'booming'),
                route('r3', 'disrupted'),
                route('r4', 'blockaded'),
            ],
            marketEvents: [
                event('e1', MarketEventType.SHORTAGE),
                event('e2', MarketEventType.SURPLUS),
                event('e3', MarketEventType.FESTIVAL),
            ],
        } as unknown as EconomyState;

        const outlook = selectTradeOutlook(economy);
        expect(outlook.activeCount).toBe(1);
        expect(outlook.boomingCount).toBe(1);
        expect(outlook.troubledCount).toBe(2);
        expect(outlook.shortages.map(e => e.id)).toEqual(['e1']);
        expect(outlook.surpluses.map(e => e.id)).toEqual(['e2']);
        expect(outlook.otherEvents.map(e => e.id)).toEqual(['e3']);
    });

    it('handles missing economy state', () => {
        const outlook = selectTradeOutlook(undefined);
        expect(outlook.routes).toEqual([]);
        expect(outlook.activeCount).toBe(0);
    });
});

describe('selectVenturesSummary', () => {
    const inv = (overrides: Partial<PlayerInvestment>): PlayerInvestment => ({
        id: 'i1',
        type: 'caravan',
        principalGold: 100,
        currentValue: 100,
        startDay: 1,
        durationDays: 7,
        riskLevel: 0.3,
        status: 'active',
        lastUpdateDay: 1,
        ...overrides,
    });

    it('splits active ventures, collectible payouts, and loans', () => {
        const summary = selectVenturesSummary([
            inv({ id: 'a', status: 'active', currentValue: 120 }),
            inv({ id: 'b', status: 'completed', currentValue: 150 }),
            inv({ id: 'c', type: 'loan_taken', status: 'active', currentValue: 500 }),
            inv({ id: 'd', status: 'failed', currentValue: 0 }),
        ]);
        expect(summary.active.map(i => i.id)).toEqual(['a']);
        expect(summary.collectible.map(i => i.id)).toEqual(['b']);
        expect(summary.loans.map(i => i.id)).toEqual(['c']);
        expect(summary.totalInvested).toBe(120);
        expect(summary.collectibleValue).toBe(150);
        expect(summary.totalDebt).toBe(500);
    });

    it('handles undefined investments', () => {
        const summary = selectVenturesSummary(undefined);
        expect(summary.active).toEqual([]);
        expect(summary.totalDebt).toBe(0);
    });
});

describe('selectCourierIntel', () => {
    const courier = (id: string, deliveryDay: number): PendingCourier => ({
        id,
        sourceRegionId: 'east_reach',
        deliveryDay,
        messageText: 'msg',
        accuracy: 0.9,
        type: 'market_intel',
    });

    it('splits delivered from en-route by current day and sorts both', () => {
        const intel = selectCourierIntel(
            [courier('old', 2), courier('new', 9), courier('soon', 12), courier('later', 20)],
            10,
        );
        expect(intel.delivered.map(c => c.id)).toEqual(['new', 'old']);
        expect(intel.enRoute.map(c => c.id)).toEqual(['soon', 'later']);
    });

    it('handles undefined couriers', () => {
        expect(selectCourierIntel(undefined, 5)).toEqual({ delivered: [], enRoute: [] });
    });
});
