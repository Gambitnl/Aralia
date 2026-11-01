/**
 * @file src/data/economy/businessStock.test.ts
 * Tests for deterministic per-type shop stock + owned pricing (packet C).
 */

import { describe, it, expect } from 'vitest';
import {
  generateBusinessStock,
  priceStockItem,
  businessTypeHasStorefront,
} from './businessStock';
import { SeededRandom } from '../../utils/random';
import { ALL_ITEMS } from '../items';
import { BusinessType } from '../../types/business';
import type { EconomyState } from '../../types';
import type { PriceContext } from '../../utils/economy/economyUtils';

const STOREFRONT_TYPES: BusinessType[] = [
  'smithy', 'apothecary', 'general_store', 'tavern', 'trading_company', 'enchanter_shop', 'farm',
];

describe('portable ignition supplies', () => {
  it('offers a finite catalog Tinderbox at some general stores, with real scarcity', () => {
    const shelves=Array.from({length:16},(_,seed)=>generateBusinessStock('general_store',new SeededRandom(seed)));
    const offers=shelves.flatMap(stock=>stock.filter(line=>line.itemId==='tinderbox'));
    expect(offers.length).toBeGreaterThan(0);
    expect(shelves.some(stock=>!stock.some(line=>line.itemId==='tinderbox'))).toBe(true);
    expect(offers.every(line=>Number.isInteger(line.quantity)&&line.quantity>=2&&line.quantity<=6)).toBe(true);
    expect(ALL_ITEMS.tinderbox.type).toBe('tool');
    expect(priceStockItem(ALL_ITEMS.tinderbox,1,undefined)).toBe(0.5);
  });

  it('keeps all earlier opening-stock rolls exact when ignition supplies are appended', () => {
    // This is the existing seed42 test fixture captured before the repair,
    // not the player world and not a chosen merchant outcome.
    const earlier=generateBusinessStock('general_store',new SeededRandom(42)).filter(line=>line.itemId!=='tinderbox');
    expect(earlier).toEqual([
      {itemId:'rations',quantity:10},{itemId:'water-day',quantity:21},
      {itemId:'torch',quantity:18},{itemId:'oil_flask',quantity:5},
      {itemId:'hooded_lantern',quantity:2},{itemId:'thieves-tools',quantity:1},
      {itemId:'leather_belt',quantity:8},{itemId:'soft_boots',quantity:3},
    ]);
  });

  it('does not move the random stream used next for business identity and price', () => {
    const actual=new SeededRandom(42),legacy=new SeededRandom(42);
    // The captured eleven-line shelf used 17 draws: two staple quantities,
    // nine optional checks, and six optional quantities. Later business fields
    // must see that same next value when one new product becomes available.
    for(let i=0;i<17;i++)legacy.next();
    generateBusinessStock('general_store',actual);
    expect(actual.next()).toBe(legacy.next());
  });
});

describe('generateBusinessStock — determinism', () => {
  it('produces identical stock for the same seed + type', () => {
    for (const type of STOREFRONT_TYPES) {
      const a = generateBusinessStock(type, new SeededRandom(12345));
      const b = generateBusinessStock(type, new SeededRandom(12345));
      expect(a).toEqual(b);
    }
  });

  it('produces different stock for different seeds (at least one type differs)', () => {
    const a = generateBusinessStock('general_store', new SeededRandom(1));
    const b = generateBusinessStock('general_store', new SeededRandom(2));
    // Not guaranteed to differ on every field, but the full lists should not be
    // identical across two unrelated seeds for a deep pool.
    expect(a).not.toEqual(b);
  });

  it('mine has no storefront and yields empty stock', () => {
    expect(businessTypeHasStorefront('mine')).toBe(false);
    expect(generateBusinessStock('mine', new SeededRandom(7))).toEqual([]);
  });
});

describe('generateBusinessStock — type appropriateness', () => {
  it('a smithy stocks weapons and/or armor', () => {
    const stock = generateBusinessStock('smithy', new SeededRandom(99));
    expect(stock.length).toBeGreaterThan(0);
    const types = stock.map(s => ALL_ITEMS[s.itemId]?.type);
    expect(types.every(t => t === 'weapon' || t === 'armor')).toBe(true);
  });

  it('a general store stocks adventuring staples (rations/torch/water present)', () => {
    const stock = generateBusinessStock('general_store', new SeededRandom(42));
    const ids = stock.map(s => s.itemId);
    // The first two pool lines (rations, water-day) are always carried.
    expect(ids).toContain('rations');
    expect(ids).toContain('water-day');
  });

  it('an apothecary stocks potions/consumables/reagents', () => {
    const stock = generateBusinessStock('apothecary', new SeededRandom(303));
    const ids = stock.map(s => s.itemId);
    expect(ids).toContain('healing_potion');
  });

  it('every stock itemId resolves to a real catalog item', () => {
    for (const type of STOREFRONT_TYPES) {
      const stock = generateBusinessStock(type, new SeededRandom(555));
      for (const line of stock) {
        expect(ALL_ITEMS[line.itemId], `unknown item ${line.itemId} in ${type}`).toBeDefined();
      }
    }
  });
});

describe('generateBusinessStock — sane quantities', () => {
  it('quantities are positive and never absurd for a town shop', () => {
    for (const type of STOREFRONT_TYPES) {
      const stock = generateBusinessStock(type, new SeededRandom(2024));
      for (const line of stock) {
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.quantity).toBeLessThanOrEqual(40); // deepest staple band cap
      }
    }
  });

  it('is not 1-of-everything (some depth on staples)', () => {
    const stock = generateBusinessStock('general_store', new SeededRandom(88));
    const maxQty = Math.max(...stock.map(s => s.quantity));
    expect(maxQty).toBeGreaterThan(1);
  });
});

describe('priceStockItem — D&D-sane pricing', () => {
  it('keeps faction standing in the single market quote before shop markup', () => {
    const economy: EconomyState = { buyMultiplier: 1, sellMultiplier: 0.5, globalInflation: 0, regionalWealth: {}, marketEvents: [], tradeRoutes: [], activeEvents: [], marketFactors: { scarcity: [], surplus: [] } };
    const context = { factions: { guild: { id: 'guild', controlledRegionIds: ['region'] } }, standings: { guild: { publicStanding: 100 } } } as unknown as PriceContext;
    expect(priceStockItem(ALL_ITEMS.longsword, 1.2, economy, 'region')).toBe(18);
    expect(priceStockItem(ALL_ITEMS.longsword, 1.2, economy, 'region', undefined, context)).toBe(15.3);
    expect(priceStockItem(ALL_ITEMS.longsword, 1.2, economy, 'region', 7, context)).toBe(7);
  });

  it('a longsword at 1.0 multiplier is within tolerance of its 15 GP PHB base', () => {
    const longsword = ALL_ITEMS['longsword'];
    // No economy → default buy multiplier 1.0; no region.
    const price = priceStockItem(longsword, 1.0, undefined);
    // Base cost is "15 GP". With a 1.0 shop multiplier and no market events the
    // price should sit right on the base, within copper rounding.
    expect(price).toBeGreaterThanOrEqual(14.5);
    expect(price).toBeLessThanOrEqual(15.5);
  });

  it('a higher priceMultiplier raises the price', () => {
    const longsword = ALL_ITEMS['longsword'];
    const base = priceStockItem(longsword, 1.0, undefined);
    const marked = priceStockItem(longsword, 1.2, undefined);
    expect(marked).toBeGreaterThan(base);
    expect(marked).toBeLessThanOrEqual(base * 1.2 + 0.01);
  });

  it('a priceOverride bypasses the derived formula', () => {
    const longsword = ALL_ITEMS['longsword'];
    const price = priceStockItem(longsword, 5.0, undefined, undefined, 7);
    expect(price).toBe(7);
  });

  it('cheap sub-GP staples (rations ~0.5 GP) stay buyable, not rounded to zero', () => {
    const rations = ALL_ITEMS['rations'];
    const price = priceStockItem(rations, 1.0, undefined);
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThan(1);
  });

  it('every generated stock line prices to a positive buy price (no zero-priced, unbuyable items)', () => {
    for (const type of STOREFRONT_TYPES) {
      const stock = generateBusinessStock(type, new SeededRandom(31337));
      for (const line of stock) {
        const item = ALL_ITEMS[line.itemId];
        const price = priceStockItem(item, 1.0, undefined, undefined, line.priceOverride);
        expect(price, `${type}/${line.itemId} priced to 0`).toBeGreaterThan(0);
      }
    }
  });
});
