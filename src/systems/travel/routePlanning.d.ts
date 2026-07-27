/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/06/2026, 17:00:05
 * Dependents: components/MapPane.tsx, components/Worldforge/AtlasSvgView.tsx, components/Worldforge/SubmapSvgView.tsx, systems/travel/travelEncounter.ts, systems/travel/travelReadout.ts, systems/worldforge/travel/atlasTravelGraph.ts, systems/worldforge/travel/submapTravelGraph.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file routePlanning.ts — fastest-route pathfinding + travel-cost model.
 *
 * Tier-agnostic: it plans a route over ANY cell graph (the Worldforge atlas
 * Voronoi cells, a submap's cells, or the legacy tile grid) via a small
 * `TravelGraph` adapter. Edge cost is real travel TIME, derived from distance ×
 * speed factor ÷ the chosen transport's speed — the graph's graded `speedFactor`
 * when it has one, else coarse terrain via `TERRAIN_TRAVEL_MODIFIERS`, times an
 * optional per-edge `climbFactor` (relief slows ascents; and a graph's
 * `edgeMinutes` overrides all of it). The planner returns the fastest route,
 * its total time/distance, and an aggregate danger rating — everything the map
 * UI needs to draw the path line, preview travel time, and roll for encounters.
 *
 * Pure: no React/DOM. Reuses `src/types/travel.ts` (terrain modifiers, vehicles).
 */
import { type TravelTerrain, type TransportOption } from '../../types/travel';
/** A cell graph the planner can route over (one adapter per map tier). */
export interface TravelGraph {
    /** Adjacent cell ids of `cell`. */
    neighbors(cell: number): number[];
    /** Cell centroid in the tier's coordinate space (graph units). */
    position(cell: number): [number, number];
    /** Travel terrain class of entering `cell` (road = fastest, difficult = half). */
    terrain(cell: number): TravelTerrain;
    /** Whether `cell` can be entered at all (false for ocean / impassable). */
    passable(cell: number): boolean;
    /** Per-cell danger in [0,1] (0 = safe). Optional; defaults to 0. */
    danger?(cell: number): number;
    /** Optional graded speed factor per cell (road tiers + biome grading). When
     * present the planner uses it instead of the coarse TERRAIN_TRAVEL_MODIFIERS. */
    speedFactor?: (cell: number) => number;
    /**
     * Optional per-edge climb speed multiplier for moving `from` → `to`
     * (1 = flat; < 1 slows — ascents cost more than descents). Multiplied into
     * the speed factor, so relief stacks with terrain/biome grading and steep
     * scrambles lose to pass routes. Ignored when `edgeMinutes` is present —
     * an authoritative edge time folds its own climb cost.
     */
    climbFactor?: (from: number, to: number) => number;
    /**
     * Optional authoritative travel time for moving from one cell into a neighbor.
     * Multi-modal graphs use this to mix land and sea speeds inside one route.
     */
    edgeMinutes?(from: number, to: number): number;
}
export interface RoutePlan {
    /** Cell ids from start to goal (inclusive). */
    cells: number[];
    /** Cell centroids along the route, for drawing the path line. */
    points: Array<[number, number]>;
    /** Total route distance in miles. */
    miles: number;
    /** Total travel time in minutes. */
    minutes: number;
    /**
     * Elapsed travel minutes at each matching `cells` index. The planner emits
     * this exact edge-cost ledger so supply-limited movement can stop at the last
     * cell the party genuinely paid enough time/resources to reach, instead of
     * guessing from the number of polyline vertices.
     */
    cumulativeMinutes?: number[];
    /** Aggregate danger rating in [0,1] (max of per-cell danger along the route). */
    danger: number;
}
export interface RoutePlanOptions {
    /** Graph-unit → mile scale for the tier (so time is in real units). */
    milesPerUnit: number;
    /** Effective transport speed in miles/hour (see transportSpeedMph). */
    speedMph: number;
    /**
     * Global travel-time multiplier applied to every edge (> 1 is slower).
     * This is the season contract's movement hook: callers pass
     * `getSeasonalTravelCostMultiplier(gameTime)` from
     * `systems/time/seasonContract` so winter routes honestly take 1.5x as long.
     * Applies to `edgeMinutes` graphs too (multi-modal sea legs share the
     * season's weather). Defaults to 1 (neutral).
     */
    timeCostMultiplier?: number;
}
/**
 * Effective travel speed (mph) for a transport option. Vehicle/mount `speed` is
 * D&D ft/round; ÷10 ≈ overland mph (30ft walk → 3mph; 60ft horse → 6mph). A
 * puller-limited vehicle (speed 0, e.g. cart/wagon) falls back to ~2mph.
 */
export declare function transportSpeedMph(transport?: TransportOption | null): number;
/**
 * Single-source travel field: fastest-time distances from `start` to every
 * reachable cell, plus a `to(goal)` reconstructor. Compute this ONCE per origin
 * (and transport), then resolve a route to any hovered cell instantly — the key
 * to a responsive travel-mode route preview over a large cell graph (no repeated
 * Dijkstra per mouse-move).
 */
export interface RouteField {
    start: number;
    /** Minutes from `start` to each reached cell. */
    dist: Map<number, number>;
    prev: Map<number, number>;
    /** Reconstruct the fastest route to `goal`, or null if it is unreachable/impassable. */
    to(goal: number): RoutePlan | null;
}
/** Run Dijkstra from `start` over the whole reachable (passable) graph. */
export declare function planRoutesFrom(graph: TravelGraph, start: number, opts: RoutePlanOptions): RouteField;
/**
 * Return the last route index reachable inside a time budget, optionally
 * requiring a safe halt cell (for example, land during a ferry itinerary).
 * Generated routes carry exact cumulative edge minutes. Hand-authored legacy
 * fixtures without that ledger use a proportional fallback so this additive
 * field does not invalidate older callers while they migrate.
 */
export declare function routeHaltIndex(route: RoutePlan, availableMinutes: number, canHaltAt?: (cellId: number) => boolean): number;
/**
 * Plan the fastest (least-time) route from `start` to `goal`. Convenience wrapper
 * over `planRoutesFrom` for one-off point-to-point queries; for travel-mode hover
 * previews prefer `planRoutesFrom` once + `field.to(cell)` per hover.
 */
export declare function planFastestRoute(graph: TravelGraph, start: number, goal: number, opts: RoutePlanOptions): RoutePlan | null;
