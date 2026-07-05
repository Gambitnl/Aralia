/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/economy/businessStock.ts
 * Per-business-type storefront stock catalog + deterministic stock generation.
 *
 * A shop of a given type carries a curated pool of catalog item ids (keys into
 * ALL_ITEMS). At business registration we roll a deterministic subset of that
 * pool with sane town-shop quantities, seeded off the world + business so the
 * same (world, business) always yields the same base stock.
 *
 * Pricing is NOT baked in here: `BusinessStockEntry` carries only item id +
 * quantity. The sale price is derived at browse time from the item's base cost
 * through the existing `calculatePrice` engine × the business's `priceMultiplier`
 * (see priceStockItem() below and handleMerchantInteraction.ts). No new pricing
 * framework — we reuse the item-side economy math already in economyUtils.ts.
 */

import { BusinessType, BusinessStockEntry } from '../../types/business';
import { Item } from '../../types';
import { SeededRandom } from '@/utils/random';
import { calculatePrice } from '../../utils/economy/economyUtils';
import { EconomyState } from '../../types/economy';

/**
 * A stockable line before quantities are rolled: the catalog item id plus the
 * inclusive [min, max] quantity band appropriate for a town shop. Staples get
 * deeper shelves (rope, rations, torches); big-ticket gear stays shallow.
 */
interface StockPoolEntry {
  itemId: string;
  qtyMin: number;
  qtyMax: number;
  /**
   * Optional flat GP price for items the catalog gives no cost (e.g. gatherable
   * herbs/reagents). Without it, calculatePrice yields a 0 buy price and the
   * merchant UI would block the purchase. Carried onto the stock entry so the
   * derived-pricing path uses it verbatim.
   */
  priceOverride?: number;
}

const q = (itemId: string, qtyMin: number, qtyMax: number, priceOverride?: number): StockPoolEntry =>
  ({ itemId, qtyMin, qtyMax, priceOverride });

/**
 * The pool a shop of each type can carry. All ids are verified keys of
 * ALL_ITEMS (weapons from WEAPONS_DATA, gear/armor/consumables from ITEMS).
 * `mine` and `farm` run no storefront and have empty pools.
 */
const STOCK_POOLS: Record<BusinessType, StockPoolEntry[]> = {
  smithy: [
    // A smithy stocks weapons, armor, and metal tools.
    q('dagger', 2, 5),
    q('shortsword', 1, 3),
    q('longsword', 1, 2),
    q('mace', 1, 3),
    q('handaxe', 2, 4),
    q('battleaxe', 1, 2),
    q('warhammer', 1, 2),
    q('spear', 2, 5),
    q('leather_armor', 1, 3),
    q('chain_shirt', 1, 2),
    q('chain_mail', 1, 1),
    q('shield_std', 1, 4),
    q('steel_helmet', 1, 3),
  ],
  apothecary: [
    // Potions, remedies, and herbal reagents.
    q('healing_potion', 2, 6),
    q('oil_flask', 3, 8),
    // Gatherable reagents have no catalog cost, so give them apothecary-sane flat
    // prices (a few SP to a couple GP) or they price to 0 and can't be bought.
    q('rowan_berry', 4, 10, 0.5),
    q('morning_dew', 4, 10, 0.5),
    q('mandrake_root', 1, 4, 2),
    q('wolfsbane', 1, 4, 2),
    q('nightshade', 1, 3, 3),
    q('frost_lichen', 2, 6, 1),
  ],
  general_store: [
    // Adventuring staples: light, food, rope-equivalents, tools.
    q('rations', 10, 30),
    q('water-day', 10, 30),
    q('torch', 10, 40),
    q('oil_flask', 4, 12),
    q('hooded_lantern', 1, 3),
    q('thieves-tools', 1, 2),
    q('travelers_cloak', 2, 5),
    q('leather_belt', 3, 8),
    q('soft_boots', 2, 6),
    q('club', 2, 5),
    q('sling', 2, 6),
  ],
  tavern: [
    // A tavern sells food, drink, and a night's lodging. Represented with the
    // catalog food/drink staples we have; lodging is metadata handled elsewhere.
    q('rations', 8, 20),
    q('water-day', 8, 20),
  ],
  trading_company: [
    // Buys low / sells high: a spread of portable valuables and gear.
    q('silver_necklace', 1, 3),
    q('gold_ring', 1, 3),
    q('silver_ring', 2, 5),
    q('travelers_cloak', 2, 6),
    q('rations', 10, 30),
    q('healing_potion', 1, 4),
  ],
  enchanter_shop: [
    // Rare magical goods and reagents. Shallow, expensive shelves.
    q('healing_potion', 1, 3),
    q('lodestone_pair', 1, 2, 0.1),
    q('silver_ring', 1, 2),
    // These magic items are overridden cost-less by the generated glossary, so
    // pin D&D-sane uncommon-item prices via override rather than the catalog cost.
    q('cloak_of_protection', 1, 1, 3500),
    q('ring_of_protection', 1, 1, 3500),
  ],
  mine: [],
  farm: [
    // A farmstead sells its produce; we only have generic provisions to stand in.
    q('rations', 10, 40),
    q('water-day', 10, 40),
  ],
};

/**
 * Does this business type run a browsable storefront? (mines have no shelf).
 */
export const businessTypeHasStorefront = (type: BusinessType): boolean =>
  (STOCK_POOLS[type]?.length ?? 0) > 0;

/**
 * Stable 32-bit string hash (FNV-1a) for seed derivation.
 */
const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * Deterministic stock seed for a business: same (worldSeed, businessId) →
 * same seed, always. Used by the lazy backfill for businesses persisted in
 * saves that predate the stock field. NOTE: this cannot reproduce the exact
 * fresh-game roll for town businesses (registration consumes extra rng draws
 * for name generation before stock rolls), but it IS stable across every
 * browse, save, and reload of the same world+business — which is the invariant
 * the shop needs.
 */
export const stockSeedForBusiness = (worldSeed: number, businessId: string): number =>
  ((worldSeed >>> 0) + hashString(businessId)) >>> 0;

/**
 * Lazy backfill: generate deterministic stock for a business that has none
 * (persisted before the stock field existed). Returns undefined when the type
 * has no storefront or the roll produces nothing.
 */
export const backfillBusinessStock = (
  businessType: BusinessType,
  worldSeed: number,
  businessId: string,
): BusinessStockEntry[] | undefined => {
  const stock = generateBusinessStock(
    businessType,
    new SeededRandom(stockSeedForBusiness(worldSeed, businessId)),
  );
  return stock.length > 0 ? stock : undefined;
};

/**
 * Deterministically generate a shop's opening stock from its type.
 *
 * We keep a curated subset of the type's pool (never 1-of-everything, never
 * infinite): staples are always carried; the rest are rolled in. Quantities are
 * drawn from each line's [qtyMin, qtyMax] band. Seeded entirely by the passed
 * `rng`, so the same (world, business) reproduces the same base stock.
 *
 * @param businessType which pool to draw from
 * @param rng seeded RNG (caller derives it from world + business id)
 * @returns a stable list of stock entries (may be empty for storefront-less types)
 */
export const generateBusinessStock = (
  businessType: BusinessType,
  rng: SeededRandom,
): BusinessStockEntry[] => {
  const pool = STOCK_POOLS[businessType] ?? [];
  if (pool.length === 0) return [];

  const entries: BusinessStockEntry[] = [];
  for (const line of pool) {
    // Carry roughly 75% of the pool lines; a shop rarely stocks its entire range
    // at once, but staples (the first two lines) are always present.
    const alwaysCarry = entries.length < 2;
    if (!alwaysCarry && rng.next() < 0.25) continue;

    const quantity = rng.nextInt(line.qtyMin, line.qtyMax + 1); // nextInt max-exclusive
    if (quantity <= 0) continue;
    entries.push(
      line.priceOverride !== undefined
        ? { itemId: line.itemId, quantity, priceOverride: line.priceOverride }
        : { itemId: line.itemId, quantity },
    );
  }
  return entries;
};

/**
 * Resolve the buy price (in GP) a shop charges for a stock item.
 *
 * Formula (documented, reused — no new framework):
 *   price = calculatePrice(item, economy, 'buy', regionId).finalPrice
 *           × business.priceMultiplier
 * rounded up to the nearest copper (0.01 GP). A `priceOverride` on the stock
 * entry short-circuits the formula. `calculatePrice` already folds in market
 * events, regional import/export, wealth, inflation, and faction standing.
 */
export const priceStockItem = (
  item: Item,
  priceMultiplier: number,
  economy: EconomyState | undefined,
  regionId?: string,
  priceOverride?: number,
): number => {
  if (typeof priceOverride === 'number' && priceOverride >= 0) {
    return Math.ceil(priceOverride * 100) / 100;
  }
  const base = calculatePrice(item, economy, 'buy', regionId).finalPrice;
  const scaled = base * (priceMultiplier > 0 ? priceMultiplier : 1);
  return Math.ceil(scaled * 100) / 100;
};
