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
export declare const BIOME_SPEED_FACTOR: Record<string, number>;
export declare const DEFAULT_BIOME_SPEED_FACTOR = 1;
/** Wilderness danger baseline per biome (0..1) — moved verbatim from the twin
 * tables in atlasTravelGraph.ts / multiModalAtlasGraph.ts so it lives once. */
export declare const BIOME_DANGER: Record<string, number>;
export declare const DEFAULT_LAND_DANGER = 0.25;
/** On-route speed factor per tier (replaces the biome factor; see softening). */
export declare const ROAD_TIER_SPEED: Record<RouteTier, number>;
/** Fraction of the biome penalty a tier REMOVES (1 = cleared road ignores biome). */
export declare const ROAD_TIER_BIOME_SOFTENING: Record<RouteTier, number>;
/** Danger multiplier per tier (patrols and traffic make busy roads safer). */
export declare const ROAD_TIER_DANGER_MULT: Record<RouteTier, number>;
/** Forest classes for visibility fade. Deep forest also counts as forest. */
export declare const FOREST_BIOMES: Set<string>;
export declare const DEEP_FOREST_BIOMES: Set<string>;
/** Navigation DC ladder for on-route travel, by tier and visibility. */
export declare const ROUTE_NAV_DC: Record<RouteTier, Record<RouteVisibility, number>>;
/** Off-road navigation DCs (unchanged from TERRAIN_NAVIGATION_DCS semantics). */
export declare const OFFROAD_NAV_DC_OPEN = 5;
export declare const OFFROAD_NAV_DC_DIFFICULT = 15;
/** A burg this populous (FMG population units), or any port/capital, is a "town":
 * town↔town links become roads; village links stay trails. */
export declare const ROAD_BURG_MIN_POPULATION = 5;
/** Forest-spur path generation: share of villages that get a hunters'/woodcutters'
 * path (deterministic hash pick), and how deep into the forest it runs (cells). */
export declare const PATH_SPUR_PERCENT = 40;
export declare const PATH_SPUR_MAX_DEPTH = 3;
/** 3D rural ribbon tiers (feet + tint), mirroring town STREET_TIERS' shape. */
export declare const ROAD_3D_TIERS: Record<RouteTier, {
    widthFt: number;
    colorHex: string;
}>;
/** Patch cycle for 3D faint paths: keep N points, skip M, repeat (broken wear-line). */
export declare const PATH_3D_KEEP_POINTS = 6;
export declare const PATH_3D_SKIP_POINTS = 3;
