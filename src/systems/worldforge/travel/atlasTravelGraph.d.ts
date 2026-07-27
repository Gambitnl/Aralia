/**
 * @file atlasTravelGraph.ts — adapt a Worldforge FMG atlas to a `TravelGraph`.
 *
 * Lets the generic route planner (`systems/travel/routePlanning.ts`) pathfind
 * over the atlas Voronoi cells: neighbors from `pack.cells.c`, centroids from
 * `pack.cells.p`, passability from land height, and speed/danger/navigation from
 * the shared road-terrain core (`routeTerrain.ts`) — route tiers graded by FMG
 * group (highway/road/trail/path) with biome-graded off-road travel.
 *
 * Pure: no React/DOM. All gameplay-feel numbers live in `roadTunables.ts`.
 * milesPerUnit converts graph units → miles so travel time is realistic.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { TravelGraph } from '../../travel/routePlanning';
import type { TransportOption } from '../../../types/travel';
/** Where a transport can go: land mounts/carts, water boats, or flying (both). */
export type TravelMobility = 'land' | 'water' | 'air';
/** Derive mobility from a transport option (vehicle.type drives water/air; else land). */
export declare function transportMobility(transport?: TransportOption | null): TravelMobility;
/**
 * Nearest land cell to `start` (BFS over neighbors), so a route can begin from
 * land even when the player's mapped atlas cell is sea/coastal — the integration
 * mismatch where the grid says "on land" but the FMG height says water. Returns
 * `start` if it is already land or no land is found within the search budget.
 */
export declare function nearestLandCell(atlas: FmgAtlasResult, start: number, maxVisited?: number): number;
/** All cell ids that lie on a LAND route (any tier). Kept for callers that only
 * need membership; graded consumers use buildRouteCellTiers directly. */
export declare function buildRoadCells(atlas: FmgAtlasResult): Set<number>;
/** Graph-unit → mile scale: from Azgaar `distanceScale` (km/unit) if present, else a continent-sized default. */
export declare function atlasMilesPerUnit(atlas: FmgAtlasResult): number;
export interface AtlasTravelGraphOptions {
    /** Where the chosen transport can travel: land (default) / water / air. */
    mobility?: TravelMobility;
}
/**
 * Build a `TravelGraph` over the atlas Voronoi cells, scoped to the transport's
 * mobility: land travel uses land cells (route-tier/biome grading), water travel
 * uses sea/lake cells, and flying (air) can cross both, ignoring terrain. This is
 * what stops a land mount from crossing the sea — or lets a flying mount cross it.
 */
export declare function buildAtlasTravelGraph(atlas: FmgAtlasResult, opts?: AtlasTravelGraphOptions): TravelGraph;
/**
 * Per-cell getting-lost info for navDrift: DC + player-facing cause. Bump
 * order is fixed: base tier/biome ladder → elevation (2026-07-11 mountains:
 * OFF-ROUTE cells only — trackless crag country h >= PEAK_MIN_H is at least
 * difficult wilderness regardless of biome, bump-then-floor
 * max(dc + HIGHLAND_NAV_DC_BUMP, 15); the highland band below adds
 * HIGHLAND_NAV_DC_BUMP; a graded route keeps its ladder, that is what passes
 * are FOR) → haunted/fey named forests LAST (2026-07-11 forests campaign:
 * +FOREST_NAV_DC_BUMP on any losable cell — but a maintained road, dc 0,
 * never starts losing travelers). The cause is never changed by the bumps.
 */
export declare function buildNavInfoFn(atlas: FmgAtlasResult): (cell: number) => {
    dc: number;
    cause: 'road' | 'wilds' | 'faint-path';
};
