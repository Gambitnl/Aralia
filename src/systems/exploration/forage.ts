/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/exploration/forage.ts
 *
 * Wilderness foraging: the loot affordance for procedural `coord_*` tiles, which
 * (unlike named locations) carry no authored `itemIds`. A "Search the Area" action
 * runs {@link forageWilderness} to deterministically decide what — if anything — the
 * player turns up on a given tile, biased by the tile's biome.
 *
 * DETERMINISTIC, NO MODEL: the result is a pure function of (worldSeed, tile, biome),
 * so it needs no Ollama/Gemini call (the older `HARVEST_RESOURCE` path depends on a
 * possibly-unconfigured Gemini service). The caller places the returned items on the
 * tile and marks it searched, so a single tile cannot be farmed for repeat loot.
 */

import { SeededRandom } from '../../utils/random/seededRandom';

export interface ForageQuery {
  /** World generation seed (stable per game). */
  worldSeed: number;
  /** Tile world coordinates (from a `coord_x_y` location id). */
  x: number;
  y: number;
  /** Raw biome id of the tile (e.g. 'forest', 'temperate_forest', 'mountains'). */
  biomeId?: string;
}

export interface ForageResult {
  /** Item ids found (0–2). Empty means a thorough but fruitless search. */
  itemIds: string[];
}

/**
 * Normalise the many raw biome ids the world emits into a few forage categories.
 * Unknown/settlement/water biomes collapse to 'default'.
 */
export function biomeToForageCategory(biomeId?: string): ForageCategory {
  switch ((biomeId ?? '').toLowerCase()) {
    case 'forest':
    case 'temperate_forest':
    case 'taiga':
    case 'jungle':
      return 'forest';
    case 'swamp':
    case 'marsh':
    case 'wetland':
      return 'wetland';
    case 'desert':
      return 'desert';
    case 'mountain':
    case 'mountains':
    case 'hills':
      return 'rocky';
    case 'grassland':
    case 'plains':
    case 'savanna':
      return 'grassland';
    case 'tundra':
    case 'arctic':
    case 'snow':
      return 'tundra';
    default:
      return 'default';
  }
}

export type ForageCategory =
  | 'forest'
  | 'wetland'
  | 'desert'
  | 'rocky'
  | 'grassland'
  | 'tundra'
  | 'default';

/**
 * Weighted forage tables per biome category. Item ids must exist in the ITEMS
 * registry (`src/data/items`). Repetition is the weighting mechanism: a uniform
 * pick over an array with duplicates favours the repeated ids, so common finds
 * (food, deadwood for a torch, a few lost coins) dominate and rarer finds
 * (a healing potion, silver) sit in the tail.
 */
const FORAGE_TABLES: Record<ForageCategory, string[]> = {
  forest: [
    'rations', 'rations', 'torch', 'torch', 'water-day',
    'copper_piece', 'copper_piece', 'healing_potion', 'travelers_cloak', 'old_map_fragment',
  ],
  wetland: [
    'rations', 'torch', 'torch', 'water-day', 'oil_flask',
    'copper_piece', 'copper_piece', 'soft_boots', 'shiny_coin', 'healing_potion',
  ],
  desert: [
    'water-day', 'water-day', 'copper_piece', 'copper_piece', 'silver_piece',
    'oil_flask', 'torch', 'shiny_coin', 'lodestone_pair', 'diamond_300gp',
  ],
  rocky: [
    'copper_piece', 'copper_piece', 'silver_piece', 'torch', 'shiny_coin',
    'lodestone_pair', 'leather_bracers', 'diamond_300gp',
  ],
  grassland: [
    'rations', 'rations', 'water-day', 'copper_piece', 'copper_piece',
    'travelers_cloak', 'leather_belt', 'torch', 'shiny_coin',
  ],
  tundra: [
    'rations', 'torch', 'torch', 'water-day', 'oil_flask',
    'soft_boots', 'leather_gloves', 'travelers_cloak', 'hooded_lantern',
  ],
  default: [
    'rations', 'torch', 'water-day', 'copper_piece', 'copper_piece', 'shiny_coin',
  ],
};

/**
 * Deterministically forage a wilderness tile.
 *
 * Outcome distribution (independent of biome): ~45% nothing, ~40% one item,
 * ~15% two items. The two picks are drawn without replacement of the same id so
 * a result never duplicates a single item id.
 */
export function forageWilderness(query: ForageQuery): ForageResult {
  const { worldSeed, x, y, biomeId } = query;
  // Mix coordinates into the seed so adjacent tiles forage differently while the
  // same tile is stable. |0 keeps it a 32-bit int for SeededRandom.
  const seed = ((worldSeed * 73856093) ^ (x * 19349663) ^ (y * 83492791)) | 0;
  const rng = new SeededRandom(Math.abs(seed) + 1);

  const roll = rng.next();
  let count: number;
  if (roll < 0.45) count = 0;
  else if (roll < 0.85) count = 1;
  else count = 2;
  if (count === 0) return { itemIds: [] };

  const table = FORAGE_TABLES[biomeToForageCategory(biomeId)];
  const found: string[] = [];
  let guard = 0;
  while (found.length < count && guard < 20) {
    guard += 1;
    const pick = table[rng.nextInt(0, table.length)];
    if (!found.includes(pick)) found.push(pick);
  }
  return { itemIds: found };
}
