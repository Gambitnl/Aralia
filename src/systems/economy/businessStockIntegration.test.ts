/**
 * @file src/systems/economy/businessStockIntegration.test.ts
 * Integration: generateNpcBusiness fills owned stock deterministically, and the
 * DEBIT_BUSINESS_STOCK reducer decrements it on purchase.
 */

import { describe, it, expect } from 'vitest';
import { generateNpcBusiness } from './NpcBusinessManager';
import { economyReducer } from '../../state/reducers/economyReducer';
import { SeededRandom } from '../../utils/random';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { WorldBusiness } from '../../types/business';

const npc = { id: 'npc_test_1', name: 'Test Smith', role: 'merchant', biography: { level: 3 } };

describe('generateNpcBusiness — owned stock', () => {
  it('fills a deterministic, non-empty stock for a storefront type', () => {
    const a = generateNpcBusiness(npc, 'loc_1', 'smithy', 1, new SeededRandom(4242));
    const b = generateNpcBusiness(npc, 'loc_1', 'smithy', 1, new SeededRandom(4242));
    expect(a.stock).toBeDefined();
    expect(a.stock!.length).toBeGreaterThan(0);
    expect(a.stock).toEqual(b.stock);
  });

  it('yields empty stock for a storefront-less type (mine)', () => {
    const biz = generateNpcBusiness(npc, 'loc_1', 'mine', 1, new SeededRandom(11));
    expect(biz.stock).toEqual([]);
  });
});

describe('DEBIT_BUSINESS_STOCK reducer', () => {
  const makeState = (business: WorldBusiness): GameState =>
    ({ worldBusinesses: { [business.id]: business } } as unknown as GameState);

  const business: WorldBusiness = {
    id: 'biz_x', name: 'Shop', locationId: 'loc', ownerId: 'npc_test_1', ownerType: 'npc',
    stock: [{ itemId: 'longsword', quantity: 2 }, { itemId: 'dagger', quantity: 1 }],
    daysSinceManaged: 0, managerEfficiency: 50, businessType: 'smithy',
    metrics: { customerSatisfaction: 50, reputation: 50, competitorPressure: 20, supplyChainHealth: 60, staffEfficiency: 40 },
    supplyContracts: [], dailyCustomers: 5, priceMultiplier: 1, competitorIds: [],
    lastDailyReport: { day: 0, revenue: 0, costs: 0, profit: 0, customersSatisfied: 0, customersLost: 0, supplyIssues: [], competitorActions: [], staffIssues: [] },
  };

  it('decrements a stocked line by 1', () => {
    const state = makeState(business);
    const action: AppAction = { type: 'DEBIT_BUSINESS_STOCK', payload: { businessId: 'biz_x', itemId: 'longsword' } };
    const patch = economyReducer(state, action);
    const line = patch.worldBusinesses!['biz_x'].stock!.find(s => s.itemId === 'longsword');
    expect(line!.quantity).toBe(1);
  });

  it('removes the line when it hits zero', () => {
    const state = makeState(business);
    const action: AppAction = { type: 'DEBIT_BUSINESS_STOCK', payload: { businessId: 'biz_x', itemId: 'dagger' } };
    const patch = economyReducer(state, action);
    const ids = patch.worldBusinesses!['biz_x'].stock!.map(s => s.itemId);
    expect(ids).not.toContain('dagger');
    expect(ids).toContain('longsword');
  });

  it('is a no-op for an unknown business or item', () => {
    const state = makeState(business);
    expect(economyReducer(state, { type: 'DEBIT_BUSINESS_STOCK', payload: { businessId: 'nope', itemId: 'longsword' } })).toEqual({});
    expect(economyReducer(state, { type: 'DEBIT_BUSINESS_STOCK', payload: { businessId: 'biz_x', itemId: 'nope' } })).toEqual({});
  });
});
