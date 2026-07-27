/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 20:02:51
 * Dependents: systems/world3d/buildingModels.ts, systems/worldforge/bridge/buildingMotifParts.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/interior/generateBuilding.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file walls.ts — emit wall segments with thickness plus outward-facing windows.
 *
 * Task 6 of the Building Blueprint Pipeline. For every 5 ft cell edge where the
 * two sides differ (room vs room, or room vs outside) a WallEdge is emitted,
 * UNLESS a door already sits on that exact edge. Outer walls (one side outside)
 * are 1.5 ft thick; inner walls 0.5 ft. Wall x/y use the same edge-midpoint
 * convention as doors.ts, so a door and its wall edge compare equal on
 * (axis, x, y).
 *
 * Windows go only on outer edges that face TRUE open air: from each outer edge
 * we ray-cast outward to the footprint's bounding box — if the ray re-enters
 * the footprint (a re-entrant notch/courtyard), the edge gets no window.
 * Windows are spaced along each outer wall run with gaps drawn from the
 * 'walls' RNG stream, and never sit within one cell (5 ft) of any door or the
 * street entry.
 *
 * Purpose-aware windows (A12): when the caller passes the floor's rooms,
 * cellars never get windows, habitable rooms (bedroom/guest-room/private-room/
 * solar/kitchen and the main room) are guaranteed one window whenever they own
 * an eligible outer edge, and shopfronts guarantee wide glazing on the STREET
 * facade (the plan's min-y frontage — Task 9), falling back to the entry
 * facade then any eligible edge. Rooms with zero eligible edges honestly get
 * no window.
 *
 * Deterministic: all randomness derives from the 'walls' stream of the seed
 * path. Pure data — no three.js, no rendering concerns.
 */
import type { BlueprintDoor, BlueprintRoom, BlueprintWindow, WallEdge, WallRun } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
/** Outer/inner wall thickness, feet. Exported so the 3D mesh builder can
 *  derive a door frame's thickness from the door's own kind (the wall edges
 *  at a door position are removed, so it can't read them off a WallEdge). */
export declare const OUTER_THICKNESS_FT = 1.5;
export declare const INNER_THICKNESS_FT = 0.5;
/** Lot-edge constraints supplied by the town block composer. Party walls stay
 * structural outer walls, but they cannot receive openings into a neighbour. */
export interface BuildWallsOptions {
    partyWallLeft?: boolean;
    partyWallRight?: boolean;
}
/**
 * Build the wall segments and windows of one floor.
 *
 * @param rg room-id grid from partition(): rg[y][x], -1 outside.
 * @param doors doors from wireDoors(); a wall edge occupied by a door is
 *   omitted, and windows keep one cell of clearance from every door.
 * @param rooms optional room list for purpose-aware windows. When given:
 *   cellar rooms NEVER get windows; bedroom/guest-room/private-room/solar/
 *   kitchen and the main room are GUARANTEED >= 1 window whenever they own at
 *   least one eligible (open-air, door-clear) outer edge — a room with zero
 *   eligible edges honestly gets none; shopfronts guarantee glazing on the
 *   entry-facing facade when eligible there, else on any eligible edge.
 *   When omitted, purpose-blind spacing (the pre-A12 behavior) applies.
 */
export declare function buildWalls(path: SeedPath, rg: number[][], doors: BlueprintDoor[], rooms?: BlueprintRoom[], options?: BuildWallsOptions): {
    walls: WallEdge[];
    windows: BlueprintWindow[];
    wallRuns: WallRun[];
};
/**
 * Merge collinear, same-kind, same-normal wall edges into maximal straight
 * runs. Edges 5 ft apart along the same grid line are contiguous; any gap
 * (a door edge emits no WallEdge) breaks the run. RNG-free and pure —
 * output order is deterministic (sorted group key, then position).
 */
export declare function mergeWallRuns(walls: WallEdge[]): WallRun[];
