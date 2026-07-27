/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 19:11:10
 * Dependents: components/MapPane.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file multiModalAtlasGraph.ts - build one travel graph that can cross land
 * and sea in the same route.
 *
 * The normal atlas graph is single-mode: land movement cannot enter water, and
 * water movement cannot enter land. This file keeps the existing route planner
 * but gives it a graph with port transfer edges and per-edge travel minutes, so
 * a route can walk to a harbor, ride a ferry lane, and walk away from the next
 * harbor without running separate planners.
 *
 * Land legs are graded by the shared road-terrain core (`routeTerrain.ts`) —
 * the same route tiers and biome factors as `atlasTravelGraph.ts` — so
 * single-mode and multimodal routes agree cell-for-cell on land. Sea legs are
 * untouched by that grading (lane danger, ship sea tiers, boarding time).
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { TravelGraph } from '../../travel/routePlanning';
/** Danger for a sea cell that sits on a generated ferry lane. TUNABLE — flagged for design review. */
export declare const SEA_DANGER_LANE = 0.12;
/** Danger for a ship in coastal water (≥1 land neighbor, not a lane). TUNABLE — flagged for design review. */
export declare const SEA_DANGER_COASTAL = 0.3;
/** Danger for a ship in open ocean (no land neighbors, not a lane). TUNABLE — flagged for design review. */
export declare const SEA_DANGER_OPEN = 0.5;
/** Sea danger tiers, ordered lane < coastal < open. */
export type SeaTier = 'lane' | 'coastal' | 'open';
/** Danger weight for a sea tier. Invariant preserved: lane < coastal < open. */
export declare function seaDangerForTier(tier: SeaTier): number;
/**
 * Classify a sea cell into a danger tier from the atlas topology alone (no new
 * world-gen field): a cell on a generated ferry lane is `lane`; otherwise a cell
 * with ≥1 land neighbor is `coastal` (near shore); a cell with no land neighbor
 * is `open` ocean. This is a coarse proxy for "distance from shore" — the atlas
 * exposes cell adjacency + heights but not a continuous shore-distance field, so
 * one ring of neighbors is the available signal. Pass `laneCells` to avoid
 * rebuilding the ferry-lane set per call.
 */
export declare function classifySeaCell(atlas: FmgAtlasResult, cell: number, laneCells?: Set<number>): SeaTier;
/**
 * Aggregate sea danger for a route: the MAX sea-tier danger over the route's sea
 * cells (0 when the route never touches water). Mirrors how RoutePlan.danger is a
 * max over per-cell danger, so a route that crosses open ocean reads as more
 * dangerous than one that only hugs a ferry lane. Used by the committed-trip sea
 * encounter roll (travel G16).
 */
export declare function routeSeaDanger(atlas: FmgAtlasResult, cells: number[]): number;
export type SeaCapability = {
    kind: 'ferry';
    speedMph: number;
} | {
    kind: 'ship';
    speedMph: number;
};
export interface MultiModalAtlasGraphOptions {
    /** Land speed for land legs. Defaults to walking speed until the UI passes a selected land transport. */
    landSpeedMph?: number;
    /** Sea capability for this trip. Null means land-only routing. */
    sea: SeaCapability | null;
}
/** Cell ids on generated ferry lanes. Only `searoutes` count as maritime lanes. */
export declare function buildFerryLaneCells(atlas: FmgAtlasResult): Set<number>;
export declare function buildMultiModalAtlasGraph(atlas: FmgAtlasResult, opts: MultiModalAtlasGraphOptions): TravelGraph;
