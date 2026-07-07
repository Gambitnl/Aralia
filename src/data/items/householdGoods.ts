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

export const HOUSEHOLD_GOODS: Record<string, Item> = {
  'smiths_hammer':   { id: 'smiths_hammer', name: "Smith's Hammer", icon: '🔨', description: 'A well-worn forge hammer, handle darkened by years of grip.', type: 'tool', weight: 2, cost: '2 GP' },
  'iron_bar':        { id: 'iron_bar', name: 'Iron Bar', icon: '🧱', description: 'A rough bar of smelted iron, ready for the forge.', type: 'crafting_material', weight: 5, cost: '1 GP' },
  'sack_of_flour':   { id: 'sack_of_flour', name: 'Sack of Flour', icon: '🌾', description: 'Coarse-milled flour in a cloth sack.', type: 'food_drink', weight: 10, cost: '3 SP' },
  'wheel_of_cheese': { id: 'wheel_of_cheese', name: 'Wheel of Cheese', icon: '🧀', description: 'A waxed wheel of hard cheese.', type: 'food_drink', weight: 4, cost: '5 SP' },
  'salted_pork':     { id: 'salted_pork', name: 'Salted Pork', icon: '🥩', description: 'Preserved pork packed in salt.', type: 'food_drink', weight: 3, cost: '4 SP' },
  'ale_jug':         { id: 'ale_jug', name: 'Jug of Ale', icon: '🍺', description: 'A stoneware jug of small ale.', type: 'food_drink', weight: 4, cost: '2 SP' },
  'linen_shirt':     { id: 'linen_shirt', name: 'Linen Shirt', icon: '👕', description: 'A plain, well-mended linen shirt.', type: 'clothing', weight: 0.5, cost: '5 SP' },
  'wool_blanket':    { id: 'wool_blanket', name: 'Wool Blanket', icon: '🧶', description: 'A heavy blanket of undyed wool.', type: 'clothing', weight: 3, cost: '5 SP' },
  'tallow_candles':  { id: 'tallow_candles', name: 'Tallow Candles', icon: '🕯️', description: 'A bundle of smoky tallow candles.', type: 'light_source', weight: 1, cost: '1 SP' },
  'ledger_book':     { id: 'ledger_book', name: 'Ledger Book', icon: '📒', description: "A merchant's ledger of accounts, closely written.", type: 'note', weight: 1, cost: '1 GP' },
  'sewing_kit':      { id: 'sewing_kit', name: 'Sewing Kit', icon: '🪡', description: 'Needles, thread, and a wooden darning egg.', type: 'tool', weight: 0.5, cost: '3 SP' },
  'clay_pot':        { id: 'clay_pot', name: 'Clay Pot', icon: '🏺', description: 'A glazed clay cooking pot.', type: 'tool', weight: 2, cost: '1 SP' },
};
