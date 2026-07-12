/**
 * @file roadTunables.ts — every gameplay-feel constant for the road system.
 *
 * ALL numbers here are TUNABLE starting values (spec 2026-07-11-road-systems).
 * One module on purpose: Remy tunes travel feel here without hunting through
 * the graph builders, renderers, and navigation code that consume these.
 */
import type { RouteTier, RouteVisibility } from './routeTerrain';

/** Off-road speed factor per FMG biome name (multiplies mph; 1 = full speed).
 * Graded from the FMG biome movement `cost[]` ordering: plains fastest, forest
 * slower, swamp/glacier slowest. Unlisted biomes (Marine) never carry land travel. */
export const BIOME_SPEED_FACTOR: Record<string, number> = {
  Grassland: 1.0,
  Savanna: 0.9,
  'Tropical seasonal forest': 0.75,
  'Temperate deciduous forest': 0.75,
  'Tropical rainforest': 0.5,
  'Temperate rainforest': 0.55,
  Taiga: 0.6,
  'Hot desert': 0.7,
  'Cold desert': 0.65,
  Tundra: 0.6,
  Wetland: 0.45,
  Glacier: 0.3,
};
export const DEFAULT_BIOME_SPEED_FACTOR = 1.0;

/** Wilderness danger baseline per biome (0..1) — moved verbatim from the twin
 * tables in atlasTravelGraph.ts / multiModalAtlasGraph.ts so it lives once. */
export const BIOME_DANGER: Record<string, number> = {
  'Hot desert': 0.5, 'Cold desert': 0.45, 'Tropical rainforest': 0.55, 'Temperate rainforest': 0.4,
  Taiga: 0.4, Tundra: 0.45, Glacier: 0.6, Wetland: 0.5,
  Savanna: 0.3, Grassland: 0.2, 'Tropical seasonal forest': 0.35, 'Temperate deciduous forest': 0.3,
};
export const DEFAULT_LAND_DANGER = 0.25;

/** On-route speed factor per tier (replaces the biome factor; see softening). */
export const ROAD_TIER_SPEED: Record<RouteTier, number> = {
  highway: 1.5, road: 1.25, trail: 1.1, path: 1.0,
};
/** Fraction of the biome penalty a tier REMOVES (1 = cleared road ignores biome). */
export const ROAD_TIER_BIOME_SOFTENING: Record<RouteTier, number> = {
  highway: 1.0, road: 1.0, trail: 0.5, path: 0.25,
};
/** Danger multiplier per tier (patrols and traffic make busy roads safer). */
export const ROAD_TIER_DANGER_MULT: Record<RouteTier, number> = {
  highway: 0.4, road: 0.5, trail: 0.7, path: 0.9,
};

/** Forest classes for visibility fade. Deep forest also counts as forest. */
export const FOREST_BIOMES = new Set(['Tropical seasonal forest', 'Temperate deciduous forest']);
export const DEEP_FOREST_BIOMES = new Set(['Tropical rainforest', 'Temperate rainforest', 'Taiga']);

/** Navigation DC ladder for on-route travel, by tier and visibility. */
export const ROUTE_NAV_DC: Record<RouteTier, Record<RouteVisibility, number>> = {
  highway: { visible: 0, faint: 0, overgrown: 0 },
  road: { visible: 0, faint: 0, overgrown: 0 },
  trail: { visible: 0, faint: 5, overgrown: 5 },
  path: { visible: 5, faint: 8, overgrown: 12 },
};
/** Off-road navigation DCs (unchanged from TERRAIN_NAVIGATION_DCS semantics). */
export const OFFROAD_NAV_DC_OPEN = 5;
export const OFFROAD_NAV_DC_DIFFICULT = 15;

/** A burg this populous (FMG population units), or any port/capital, is a "town":
 * town↔town links become roads; village links stay trails. */
export const ROAD_BURG_MIN_POPULATION = 5;

/** Forest-spur path generation: share of villages that get a hunters'/woodcutters'
 * path (deterministic hash pick), and how deep into the forest it runs (cells). */
export const PATH_SPUR_PERCENT = 40;
export const PATH_SPUR_MAX_DEPTH = 3;

/** 3D rural ribbon tiers (feet + tint), mirroring town STREET_TIERS' shape. */
export const ROAD_3D_TIERS: Record<RouteTier, { widthFt: number; colorHex: string }> = {
  highway: { widthFt: 44, colorHex: '#c9b79a' }, // pale flagstone (matches town avenue)
  road: { widthFt: 40, colorHex: '#a08b62' },    // packed earth (today's default)
  trail: { widthFt: 20, colorHex: '#b5a077' },   // lighter worn track
  path: { widthFt: 8, colorHex: '#9aa07a' },     // faint green-brown wear line
};
/** Patch cycle for 3D faint paths: keep N points, skip M, repeat (broken wear-line). */
export const PATH_3D_KEEP_POINTS = 6;
export const PATH_3D_SKIP_POINTS = 3;
