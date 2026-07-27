/**
 * @file householdGoods.ts — mundane owned goods for building container manifests.
 *
 * The living-overlay manifests (systems/worldforge/interior/manifests.ts) fill
 * owned chests, shelves, barrels and strongboxes with real registry items.
 * These are the everyday household goods those tables reference, shaped exactly
 * like existing `ITEMS` entries and merged into `ALL_ITEMS`.
 *
 * TYPE NOTE: the brief authored several of these as `type: 'misc'`, but 'misc'
 * is NOT a legal `Item.type` value (see the union at src/types/items.ts) and
 * the union must not be extended. Each was reassigned to the closest existing
 * legal type: iron_bar → 'crafting_material' (forge stock), wool_blanket →
 * 'clothing' (bedding/apparel), tallow_candles → 'light_source', clay_pot →
 * 'tool' (cooking implement).
 */
import type { Item } from '../../types/items';
export declare const HOUSEHOLD_GOODS: Record<string, Item>;
