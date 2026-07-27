import { type SeedPath } from '../seedPath';
export type Pt = [number, number];
/** Ray-casting point-in-polygon (polygon = ordered [x,y] vertices). */
export declare function pointInPolygon(p: Pt, polygon: Pt[]): boolean;
export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/** Axis-aligned bounding box of a polygon. */
export declare function polygonBounds(polygon: Pt[]): Bounds;
export interface SubmapFeature {
    kind: 'burg' | 'roadJunction' | 'riverBend';
    x: number;
    y: number;
    id?: number;
    name?: string;
}
/** Inherited connective feature (river/road), polyline in the parent coord space. */
export interface SubmapPolyline {
    kind: 'river' | 'road';
    points: Pt[];
    width?: number;
}
export interface SubmapParentContext {
    /** Parent cell polygon (ordered [x,y] vertices) — the submap boundary. */
    polygon: Pt[];
    /** Hierarchical seed path for deterministic generation (e.g. wf:42/cell:137). */
    seedPath: SeedPath;
    /** Inherited biome (carried to the submap; sub-variation is iteration #2). */
    biome?: string;
    /** Inherited set pieces, in the parent polygon's coord space (force-sited). */
    features?: SubmapFeature[];
    /** Inherited rivers/roads (polylines), projected + clipped into the submap. */
    polylines?: SubmapPolyline[];
}
export interface GenerateSubmapSitesOptions {
    /** Target scattered-point count (forced feature sites are added on top). */
    count?: number;
    /** Rejection-sampling attempt cap multiplier (default 20). */
    maxAttemptsPerPoint?: number;
}
export interface SubmapSites {
    sites: Pt[];
    /** Map from a context feature to the site index that carries it. */
    featureSites: Array<{
        feature: SubmapFeature;
        siteIndex: number;
    }>;
}
/**
 * Deterministic submap site set: inherited features are force-sited FIRST (so
 * each owns the Voronoi cell at its exact relative position — the Bomnogorvan
 * contract), then seeded jittered points are rejection-sampled inside the parent
 * polygon. Identity travels on the feature objects unchanged.
 */
export declare function generateSubmapSites(ctx: SubmapParentContext, opts?: GenerateSubmapSitesOptions): SubmapSites;
/**
 * Clip a subject polygon to a CONVEX clip polygon (Sutherland–Hodgman). Azgaar
 * Voronoi cells are convex, so this exactly trims each submap cell to the parent
 * cell boundary. Returns [] if fully outside.
 */
export declare function clipPolygon(subject: Pt[], clip: Pt[]): Pt[];
/**
 * Clip a polyline to a convex polygon, returning the inside pieces (a polyline
 * may exit and re-enter, yielding multiple pieces). Used to project inherited
 * rivers/roads into a submap / sub-cell.
 */
export declare function clipPolylineToPolygon(points: Pt[], poly: Pt[]): Pt[][];
/**
 * Deterministically pick a sub-cell biome around the inherited parent biome.
 * ~62% of cells keep the parent biome; the rest spread across its variant
 * palette. Seeded per `siteIndex` off the submap seed-path → stable per tier.
 */
export declare function subBiomeFor(parentBiome: string | undefined, seedPath: SeedPath, siteIndex: number): string | undefined;
export interface SubmapCell {
    /** Index into the site set (and into the Voronoi cells). */
    siteIndex: number;
    /** Voronoi cell polygon (graph coords, the parent cell's frame). */
    polygon: Pt[];
    /** Inherited set piece this cell carries, if any (identity preserved). */
    feature?: SubmapFeature;
    /** Local sub-biome (a variation around the inherited parent biome). */
    biome?: string;
}
export interface SubmapModel {
    /** The parent cell polygon = the submap boundary. */
    boundary: Pt[];
    /** Inherited biome (sub-variation is a later iteration). */
    biome?: string;
    /** One Voronoi cell per scattered/forced site. */
    cells: SubmapCell[];
    /** Index into `cells` of the inherited burg's cell, or null. */
    burgCellIndex: number | null;
    /** Inherited rivers/roads clipped to this submap's boundary. */
    polylines: SubmapPolyline[];
}
/**
 * Normalize a parent context to a canonical coordinate span before generating.
 * The SP1 engine + clipping degrade at sub-unit coordinate scales (sliver /
 * degenerate Voronoi cells), and a root atlas cell is only a few graph units
 * across. Scaling about the polygon centroid is loss-free for consumers that
 * render fit-to-view. MapPane keeps a local equivalent (DRILL_CANON_SPAN) for
 * its drill stack; keep the two spans equal if either changes.
 */
export declare function normalizeParentContextScale(ctx: SubmapParentContext, canonSpan?: number): SubmapParentContext;
/**
 * SP1 iteration #2: turn the deterministic site set into a Voronoi cell graph.
 * Adds a ring of bbox frame points so every real site gets a BOUNDED cell, then
 * reuses the FMG `Voronoi` traversal (`cells.v` → `vertices.p`). The inherited
 * burg/junction sites keep their cells (identity via `feature`). Clipping each
 * outer cell exactly to the parent polygon + river/road projection + recursion
 * are later iterations; here the boundary is carried on the model.
 */
export declare function generateSubmap(ctx: SubmapParentContext, opts?: GenerateSubmapSitesOptions): SubmapModel;
/**
 * Recursion wrapper (SP1): turn an output `SubmapCell` into a child
 * `SubmapParentContext`, so the world→region→local drill recurses through one
 * engine. The sub-cell polygon becomes the child boundary; biome inherits from
 * the parent; any set piece the cell carries (e.g. an inherited burg) descends
 * — it is already in the cell's coord space, so its relative position is
 * preserved. The seed-path descends `…/sub:<siteIndex>` for deterministic,
 * isolated regeneration of the deeper tier.
 */
export declare function submapCellToChildContext(cell: SubmapCell, parent: SubmapParentContext): SubmapParentContext;
