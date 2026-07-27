/**
 * @file cellNeighbours.ts — cell-native spatial helpers for seamless walking.
 *
 * Stage 5 (seamless edge-crossing) replaces 30×20 grid stepping with continuous
 * walking across Voronoi cells. When the player walks off a Locale's edge we need
 * two pure, grid-free queries on the atlas:
 *   - which cell does a world position fall in? (`worldPosToCell`)
 *   - which LAND cell is the neighbour in the crossing direction? (`cellNeighbourInDirection`)
 *
 * Both read only the FMG topology already on the atlas (`cells.p` sites, `cells.c`
 * neighbours, `cells.h` heights) — no grid round-trip, no protected bridge fn.
 * Pure. Grid-retirement Stage 5 / S5.1.
 */
import type { FmgWorldResult } from '../fmg/generateWorld';
/**
 * The atlas cell a world-space (graph) position falls in — the nearest Voronoi
 * site, which IS Voronoi cell membership by definition. Linear scan (~10k cells,
 * sub-ms; the bridge uses the same pattern). Returns -1 only for an empty atlas.
 */
export declare function worldPosToCell(atlas: FmgWorldResult, x: number, y: number): number;
/**
 * The LAND Voronoi neighbour of `cellId` best aligned with direction `(dx, dy)`
 * in world space, or `null` when no land neighbour lies that way (e.g. a coastal
 * cell whose only neighbour in that direction is sea). Picks the neighbour whose
 * site-offset has the largest positive dot product with the (normalized)
 * requested direction — the cell you'd cross into walking that way.
 */
export declare function cellNeighbourInDirection(atlas: FmgWorldResult, cellId: number, dx: number, dy: number): number | null;
