/** Land route tiers, best to faintest. Sea routes are not terrain. */
export type RouteTier = 'highway' | 'road' | 'trail' | 'path';
/** How readable a route segment is on the ground (and on the map). */
export type RouteVisibility = 'visible' | 'faint' | 'overgrown';
/** The better (faster, safer) of two tiers — cells where routes overlap keep the best. */
export declare function bestTier(a: RouteTier | undefined, b: RouteTier): RouteTier;
/** Speed factor for a land cell: tier boost with biome-penalty softening on a
 * route, or the graded biome factor off-road. Multiplies the party's mph. */
export declare function landSpeedFactor(biomeName: string, tier: RouteTier | null): number;
/** Danger for a land cell: biome baseline, scaled down on routes by tier. */
export declare function landDanger(biomeName: string, tier: RouteTier | null): number;
/**
 * Speed multiplier for crossing an edge that ascends `dh` encoded-height
 * points (negative = descent; 1 = flat, < 1 slows). Ascents cost ~3× descents
 * (CLIMB_ASCENT_PER_H vs CLIMB_DESCENT_PER_H), and an engineered tier softens
 * the grade BEFORE the rate applies (Δh × CLIMB_TIER_SOFTEN) — a highway
 * switchbacks up a ridge that a bare path takes face-on. Both land graphs
 * multiply this into every edge, so the low saddle beats the straight
 * scramble: passes become the fast way through.
 */
export declare function climbFactorFor(dh: number, tier: RouteTier | null): number;
/** How visible a route segment is in this biome. Maintained tiers never fade. */
export declare function routeVisibility(biomeName: string, tier: RouteTier): RouteVisibility;
/** Getting-lost DC for a land cell (DMG p.111 ladder, extended for faint paths). */
export declare function navDC(biomeName: string, tier: RouteTier | null): number;
/** Why a cell can lose the party — drives the arrival message wording. */
export declare function navCause(biomeName: string, tier: RouteTier | null): 'road' | 'wilds' | 'faint-path';
/**
 * Cell → best land route tier across all generated routes. Defensive read:
 * FMG-generated routes expose their path as `points` ([x, y, cellId] triples);
 * some tests and legacy producers carry `cells`. Reading only `cells` is the
 * bug that left the whole road network mechanically inert — read both.
 */
export declare function buildRouteCellTiers(pack: {
    routes?: Array<{
        group?: string;
        cells?: number[];
        points?: number[][];
    }>;
}): Map<number, RouteTier>;
