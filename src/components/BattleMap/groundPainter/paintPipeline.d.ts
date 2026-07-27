/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 11:55:22
 * Dependents: components/BattleMap/groundPainter.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file groundPainter/paintPipeline.ts
 * The paint pipeline: composes the cached textures and the prop drawers into
 * the complete painted battle-map ground (base coat, flagstones, patches,
 * roads, the sub-tile waterline pipeline, landmark set-pieces, foliage, and
 * the vignette / dapple / time-of-day washes).
 *
 * Extracted verbatim from groundPainter.ts — the seeded draw ORDER is
 * unchanged so the art is byte-for-byte identical across the DOM canvas and
 * the PixiJS prototype.
 */
import type { BattleMapData, BattleMapTile } from "../../../types/combat";
import { type GroundTextures } from "./textures";
export interface PaintGroundOptions {
    /** Whether to draw decorative asset props such as trees, rocks, bushes, logs, and loose scatter. */
    showDecorations?: boolean;
}
/**
 * Decides whether the painter may add visual-only leaves, flowers, saplings,
 * and loose rocks to otherwise empty tiles.
 *
 * Legacy sandbox arenas still need that illustrative filler. A WorldForge map
 * does not: its placed features and props are authoritative, so extra per-tile
 * scatter would recreate the "assets sneezed onto the map" problem and make the
 * picture disagree with the game world.
 */
export declare function shouldPaintAmbientScatter(mapData: BattleMapData): boolean;
export interface CrossingPaintGroup {
    id: string;
    kind: NonNullable<BattleMapTile["crossing"]>["kind"];
    cells: BattleMapTile[];
}
export interface ElevationContourSegment {
    /** Segment coordinates are in tactical-cell space and scale with tileSize. */
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    reliefFeet: number;
}
/**
 * Build interpolated five-foot contour segments through tile-center samples.
 * This uses marching-square edge intersections instead of tracing cell borders,
 * because blocky stair steps would merely replace raw numbers with a different
 * debug-grid artifact.
 */
export declare function collectElevationContourSegments(mapData: BattleMapData): ElevationContourSegment[];
/**
 * Group only source-authored crossing cells for the over-water paint pass.
 * Keeping this selection pure gives tests and debug tools a way to prove that
 * ordinary water cannot acquire plausible bridge art from painter heuristics.
 */
export declare function collectCrossingPaintGroups(mapData: BattleMapData): CrossingPaintGroup[];
/**
 * March a tile's eye-line toward the sun and accumulate how far terrain rises
 * above it. Returns 0 (fully lit) .. 1 (saturated, terrain rises 6+ ft over the
 * ray). Kept pure and parameterized on `elevationAt` so callers control the
 * (clamped) sampling — this keeps the land relief output byte-for-byte stable.
 */
export declare function castShadowAmount(elevationAt: (x: number, y: number) => number, width: number, height: number, x: number, y: number): number;
/** A corner-lattice point on the tile grid (tile-space, integer at cell corners). */
export type LatticePoint = readonly [number, number];
/**
 * Trace a boolean tile mask into closed lattice loops using marching-squares
 * boundary edges. Every filled cell contributes its open sides as oriented
 * segments (road/mask interior on the LEFT of travel), and the segments are
 * chained into loops.
 *
 * The only ambiguity is a checkerboard corner — a corner-lattice point where two
 * mask cells meet only diagonally, so two continuations leave the same point. We
 * take the continuation that turns most sharply toward the interior (the largest
 * signed turn in the winding direction). That keeps the interior on the left and
 * splits the diagonal touch into two simple, non-self-intersecting loops instead
 * of one pinched figure-eight.
 *
 * With correctly oriented edges every boundary closes, including masks that
 * touch the map edge (off-map cells read as unfilled, so the outer side is still
 * a boundary). An open chain therefore means a malformed mask; we close it
 * explicitly and warn once rather than dropping geometry.
 */
export declare function traceMaskContourLoops(filled: (x: number, y: number) => boolean, cells: Iterable<{
    x: number;
    y: number;
}>): LatticePoint[][];
/**
 * Taubin λ|μ smoothing: a low-pass over a closed loop that removes the
 * marching-squares stair ripple WITHOUT the inward shrink of repeated Laplacian
 * passes. Each iteration is a shrinking step (λ>0) followed by an inflating step
 * (μ<0, |μ|>λ); collinear points on straight runs stay put (zero net movement),
 * so painted road edges hug the true cell boundary.
 */
export declare function taubinSmoothLoop(loop: LatticePoint[], iterations?: number, lambda?: number, mu?: number): LatticePoint[];
/**
 * Paint the complete painted ground onto a 2D context. The caller must have
 * sized the canvas to (W*tileSize*res, H*tileSize*res) and set
 * ctx.setTransform(res,0,0,res,0,0) before calling.
 */
export declare function paintGround(ctx: CanvasRenderingContext2D, mapData: BattleMapData, tileSize: number, textures: GroundTextures, res: number, options?: PaintGroundOptions): void;
