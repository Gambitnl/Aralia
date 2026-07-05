/**
 * @file src/hooks/actions/merchantStockInventory.test.ts
 * End-to-end proof for packet C: a town-registered smithy's persisted stock
 * builds a weapon/armor-led, PHB-sane, deduplicated browse inventory — the exact
 * problems observed live at "The Gilded Blade" (groceries at a blacksmith,
 * rations mispriced at 5cp, duplicate Rations identities).
 */

import { describe, it, expect, vi } from 'vitest';
import { buildInventoryFromStock, ensureBusinessStock } from './handleMerchantInteraction';
import { generateNpcBusiness } from '../../systems/economy/NpcBusinessManager';
import { SeededRandom } from '../../utils/random';
import { WorldBusiness } from '../../types/business';

const npc = { id: 'npc_burg_1_plot_2', name: 'Soland', role: 'merchant', biography: { level: 3 } };

describe('buildInventoryFromStock — town smithy browse inventory', () => {
  const smithy = generateNpcBusiness(npc, 'cell_1', 'smithy', 1, new SeededRandom(1001));
  const inventory = buildInventoryFromStock(smithy, undefined);

  it('leads with weapons/armor, not groceries (type-appropriate)', () => {
    expect(inventory.length).toBeGreaterThan(0);
    const types = inventory.map(i => i.type);
    // Every line at a smithy is a weapon or armor piece.
    expect(types.every(t => t === 'weapon' || t === 'armor')).toBe(true);
    // No food/drink groceries.
    expect(types).not.toContain('food_drink');
  });

  it('has no duplicate item identities (deduped to canonical catalog ids)', () => {
    const ids = inventory.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prices a longsword within PHB tolerance (15 GP × shop multiplier)', () => {
    const longsword = inventory.find(i => i.id === 'longsword');
    if (longsword) {
      // priceMultiplier is 0.9-1.2, so 15 GP base lands in ~13.5-18 GP.
      expect(longsword.costInGp!).toBeGreaterThanOrEqual(13);
      expect(longsword.costInGp!).toBeLessThanOrEqual(18.5);
    }
  });

  it('every line carries a positive buy price and an on-shelf quantity', () => {
    for (const item of inventory) {
      expect(item.costInGp!).toBeGreaterThan(0);
      expect(item.quantity!).toBeGreaterThan(0);
    }
  });
});

describe('buildInventoryFromStock — general store keeps groceries priced sanely', () => {
  const store = generateNpcBusiness(npc, 'cell_1', 'general_store', 1, new SeededRandom(2002));
  const inventory = buildInventoryFromStock(store, undefined);

  it('rations price above 5cp (PHB rations are 5sp = 0.5 GP), not collapsed', () => {
    const rations = inventory.find(i => i.id === 'rations');
    expect(rations).toBeDefined();
    // 0.5 GP base × 0.9-1.2 multiplier → ~0.45-0.6 GP, well above 0.05 GP (5cp).
    expect(rations!.costInGp!).toBeGreaterThan(0.05);
  });

  it('single canonical rations line (no duplicate Rations identity)', () => {
    const rationsLines = inventory.filter(i => i.id === 'rations');
    expect(rationsLines.length).toBe(1);
  });
});

describe('ensureBusinessStock — lazy backfill for pre-stock saves', () => {
  const makeLegacyBusiness = (): WorldBusiness => ({
    // A business shape as persisted BEFORE the stock field existed (no `stock`).
    id: 'biz_burg_10_plot_4', name: 'The Gilded Blade', locationId: 'cell_9',
    ownerId: 'npc_burg_10_plot_4', ownerType: 'npc',
    daysSinceManaged: 0, managerEfficiency: 50, businessType: 'smithy',
    metrics: { customerSatisfaction: 50, reputation: 50, competitorPressure: 20, supplyChainHealth: 60, staffEfficiency: 40 },
    supplyContracts: [], dailyCustomers: 5, priceMultiplier: 1.05, competitorIds: [],
    lastDailyReport: { day: 0, revenue: 0, costs: 0, profit: 0, customersSatisfied: 0, customersLost: 0, supplyIssues: [], competitorActions: [], staffIssues: [] },
  });

  it('generates stock, persists it via dispatch, and returns the patched business', () => {
    const dispatch = vi.fn();
    const patched = ensureBusinessStock(makeLegacyBusiness(), 12345, dispatch);
    expect(patched.stock).toBeDefined();
    expect(patched.stock!.length).toBeGreaterThan(0);
    // Persisted through the existing full-record upsert.
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REGISTER_WORLD_BUSINESS',
      payload: { business: patched },
    });
    // A smithy backfill is type-appropriate.
    const inv = buildInventoryFromStock(patched, undefined);
    expect(inv.every(i => i.type === 'weapon' || i.type === 'armor')).toBe(true);
  });

  it('is deterministic: two backfills of the same (worldSeed, business) match exactly', () => {
    const a = ensureBusinessStock(makeLegacyBusiness(), 12345, vi.fn());
    const b = ensureBusinessStock(makeLegacyBusiness(), 12345, vi.fn());
    expect(a.stock).toEqual(b.stock);
  });

  it('different worlds produce different backfilled stock', () => {
    const a = ensureBusinessStock(makeLegacyBusiness(), 111, vi.fn());
    const b = ensureBusinessStock(makeLegacyBusiness(), 999, vi.fn());
    expect(a.stock).not.toEqual(b.stock);
  });

  it('no-ops when stock already exists (no re-roll, no dispatch)', () => {
    const dispatch = vi.fn();
    const withStock: WorldBusiness = { ...makeLegacyBusiness(), stock: [{ itemId: 'longsword', quantity: 1 }] };
    const result = ensureBusinessStock(withStock, 12345, dispatch);
    expect(result).toBe(withStock);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('no-ops for storefront-less types (mine)', () => {
    const dispatch = vi.fn();
    const mine: WorldBusiness = { ...makeLegacyBusiness(), businessType: 'mine' };
    const result = ensureBusinessStock(mine, 12345, dispatch);
    expect(result.stock).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
