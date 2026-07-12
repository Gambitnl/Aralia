/**
 * @file routeTerrain.ts — ONE classification core for land travel over routes.
 *
 * Single source of truth for: off-road biome speed, on-route tier speed,
 * danger, navigation DCs, and route visibility (fading forest paths). Both
 * travel graph builders (atlasTravelGraph, multiModalAtlasGraph) and the 2D/3D
 * renderers consume THIS module, so mechanics and looks cannot drift apart.
 * Pure: no React/DOM, no atlas types — callers pass biome names + tiers.
 */
import {
  BIOME_SPEED_FACTOR, DEFAULT_BIOME_SPEED_FACTOR,
  BIOME_DANGER, DEFAULT_LAND_DANGER,
  ROAD_TIER_SPEED, ROAD_TIER_BIOME_SOFTENING, ROAD_TIER_DANGER_MULT,
  FOREST_BIOMES, DEEP_FOREST_BIOMES,
  ROUTE_NAV_DC, OFFROAD_NAV_DC_OPEN, OFFROAD_NAV_DC_DIFFICULT,
} from './roadTunables';
// Climb tunables live with the rest of the mountain feel numbers (the same
// cross-module flow roadTunables uses: constants module → this core).
import {
  CLIMB_ASCENT_PER_H, CLIMB_DESCENT_PER_H, CLIMB_TIER_SOFTEN,
} from '../mountains/mountainTunables';

/** Land route tiers, best to faintest. Sea routes are not terrain. */
export type RouteTier = 'highway' | 'road' | 'trail' | 'path';
/** How readable a route segment is on the ground (and on the map). */
export type RouteVisibility = 'visible' | 'faint' | 'overgrown';

const TIER_RANK: Record<RouteTier, number> = { highway: 3, road: 2, trail: 1, path: 0 };
/** The better (faster, safer) of two tiers — cells where routes overlap keep the best. */
export function bestTier(a: RouteTier | undefined, b: RouteTier): RouteTier {
  return a && TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/** Off-road biomes that were "difficult" before grading — kept for nav DCs. */
const DIFFICULT_BIOMES = new Set<string>([
  'Hot desert', 'Cold desert', 'Tropical rainforest', 'Temperate rainforest',
  'Taiga', 'Tundra', 'Glacier', 'Wetland',
]);

function biomeFactor(biomeName: string): number {
  return BIOME_SPEED_FACTOR[biomeName] ?? DEFAULT_BIOME_SPEED_FACTOR;
}

/** Speed factor for a land cell: tier boost with biome-penalty softening on a
 * route, or the graded biome factor off-road. Multiplies the party's mph. */
export function landSpeedFactor(biomeName: string, tier: RouteTier | null): number {
  const biome = biomeFactor(biomeName);
  if (!tier) return biome;
  const soften = ROAD_TIER_BIOME_SOFTENING[tier];
  const softened = biome + (1 - biome) * soften; // lerp(biome, 1, soften)
  return ROAD_TIER_SPEED[tier] * softened;
}

/** Danger for a land cell: biome baseline, scaled down on routes by tier. */
export function landDanger(biomeName: string, tier: RouteTier | null): number {
  const base = BIOME_DANGER[biomeName] ?? DEFAULT_LAND_DANGER;
  return tier ? base * ROAD_TIER_DANGER_MULT[tier] : base;
}

/**
 * Speed multiplier for crossing an edge that ascends `dh` encoded-height
 * points (negative = descent; 1 = flat, < 1 slows). Ascents cost ~3× descents
 * (CLIMB_ASCENT_PER_H vs CLIMB_DESCENT_PER_H), and an engineered tier softens
 * the grade BEFORE the rate applies (Δh × CLIMB_TIER_SOFTEN) — a highway
 * switchbacks up a ridge that a bare path takes face-on. Both land graphs
 * multiply this into every edge, so the low saddle beats the straight
 * scramble: passes become the fast way through.
 */
export function climbFactorFor(dh: number, tier: RouteTier | null): number {
  const dhEff = dh * (tier ? CLIMB_TIER_SOFTEN[tier] : 1);
  return 1 / (1 + CLIMB_ASCENT_PER_H * Math.max(0, dhEff) + CLIMB_DESCENT_PER_H * Math.max(0, -dhEff));
}

/** How visible a route segment is in this biome. Maintained tiers never fade. */
export function routeVisibility(biomeName: string, tier: RouteTier): RouteVisibility {
  if (tier === 'highway' || tier === 'road') return 'visible';
  if (tier === 'trail') return DEEP_FOREST_BIOMES.has(biomeName) ? 'faint' : 'visible';
  // path
  if (DEEP_FOREST_BIOMES.has(biomeName)) return 'overgrown';
  if (FOREST_BIOMES.has(biomeName)) return 'faint';
  return 'visible';
}

/** Getting-lost DC for a land cell (DMG p.111 ladder, extended for faint paths). */
export function navDC(biomeName: string, tier: RouteTier | null): number {
  if (tier) return ROUTE_NAV_DC[tier][routeVisibility(biomeName, tier)];
  return DIFFICULT_BIOMES.has(biomeName) ? OFFROAD_NAV_DC_DIFFICULT : OFFROAD_NAV_DC_OPEN;
}

/** Why a cell can lose the party — drives the arrival message wording. */
export function navCause(biomeName: string, tier: RouteTier | null): 'road' | 'wilds' | 'faint-path' {
  if (!tier) return 'wilds';
  return routeVisibility(biomeName, tier) === 'visible' ? 'road' : 'faint-path';
}

/** Route group vocab (FMG plural) → land tier. Searoutes are not land terrain. */
const GROUP_TO_TIER: Record<string, RouteTier> = {
  highways: 'highway', roads: 'road', trails: 'trail', paths: 'path',
};

/**
 * Cell → best land route tier across all generated routes. Defensive read:
 * FMG-generated routes expose their path as `points` ([x, y, cellId] triples);
 * some tests and legacy producers carry `cells`. Reading only `cells` is the
 * bug that left the whole road network mechanically inert — read both.
 */
export function buildRouteCellTiers(
  pack: { routes?: Array<{ group?: string; cells?: number[]; points?: number[][] }> },
): Map<number, RouteTier> {
  const tiers = new Map<number, RouteTier>();
  for (const route of pack.routes ?? []) {
    const tier = GROUP_TO_TIER[route.group ?? ''];
    if (!tier) continue;
    const add = (cell: number): void => {
      if (Number.isFinite(cell)) tiers.set(cell, bestTier(tiers.get(cell), tier));
    };
    for (const cell of route.cells ?? []) add(cell);
    for (const point of route.points ?? []) add(point[2]);
  }
  return tiers;
}
