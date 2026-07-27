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
import { EconomyState } from '../../types/economy';
/**
 * Does this business type run a browsable storefront? (mines have no shelf).
 */
export declare const businessTypeHasStorefront: (type: BusinessType) => boolean;
/**
 * Deterministic stock seed for a business: same (worldSeed, businessId) →
 * same seed, always. Used by the lazy backfill for businesses persisted in
 * saves that predate the stock field. NOTE: this cannot reproduce the exact
 * fresh-game roll for town businesses (registration consumes extra rng draws
 * for name generation before stock rolls), but it IS stable across every
 * browse, save, and reload of the same world+business — which is the invariant
 * the shop needs.
 */
export declare const stockSeedForBusiness: (worldSeed: number, businessId: string) => number;
/**
 * Lazy backfill: generate deterministic stock for a business that has none
 * (persisted before the stock field existed). Returns undefined when the type
 * has no storefront or the roll produces nothing.
 */
export declare const backfillBusinessStock: (businessType: BusinessType, worldSeed: number, businessId: string) => BusinessStockEntry[] | undefined;
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
export declare const generateBusinessStock: (businessType: BusinessType, rng: SeededRandom) => BusinessStockEntry[];
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
export declare const priceStockItem: (item: Item, priceMultiplier: number, economy: EconomyState | undefined, regionId?: string, priceOverride?: number) => number;
