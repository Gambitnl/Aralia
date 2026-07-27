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
export declare function biomeToForageCategory(biomeId?: string): ForageCategory;
export type ForageCategory = 'forest' | 'wetland' | 'desert' | 'rocky' | 'grassland' | 'tundra' | 'default';
/**
 * Deterministically forage a wilderness tile.
 *
 * Outcome distribution (independent of biome): ~45% nothing, ~40% one item,
 * ~15% two items. The two picks are drawn without replacement of the same id so
 * a result never duplicates a single item id.
 */
export declare function forageWilderness(query: ForageQuery): ForageResult;
