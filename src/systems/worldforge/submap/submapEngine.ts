/**
 * @file submapEngine.ts — SP1 Voronoi submap engine, iteration #1 (headless).
 *
 * The deterministic CORE: given a parent cell polygon + its inherited set-piece
 * anchors + a seed-path, produce the submap's site set — seeded points scattered
 * INSIDE the parent polygon plus the inherited features force-placed at their
 * exact relative positions (the "Bomnogorvan" contract). Identity travels on the
 * feature objects unchanged.
 *
 * Pure: no React/DOM. Voronoi cell-polygon construction, clipping to the parent
 * shape, biome sub-variation, river/road projection, and the recursion wrapper
 * are iteration #2+ (consume `SubmapSites.sites` via Delaunator).
 *
 * Plan: docs/superpowers/plans/2026-06-23-sp1-voronoi-submap-engine-iter1.md
 * Spec: docs/projects/worldforge/SPEC.md §11 (2026-06-22) item 2 — Azgaar L0 → WF
 * L1+; the engine consumes a parent context, never generates a competing world.
 */
import Delaunator from 'delaunator';
import { childSeedPath, rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { Voronoi } from '../fmg/voronoi';

export type Pt = [number, number];

/** Ray-casting point-in-polygon (polygon = ordered [x,y] vertices). */
export function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = (yi > p[1]) !== (yj > p[1])
      && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

/** Axis-aligned bounding box of a polygon. */
export function polygonBounds(polygon: Pt[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

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
  featureSites: Array<{ feature: SubmapFeature; siteIndex: number }>;
}

/**
 * Deterministic submap site set: inherited features are force-sited FIRST (so
 * each owns the Voronoi cell at its exact relative position — the Bomnogorvan
 * contract), then seeded jittered points are rejection-sampled inside the parent
 * polygon. Identity travels on the feature objects unchanged.
 */
export function generateSubmapSites(
  ctx: SubmapParentContext,
  opts: GenerateSubmapSitesOptions = {},
): SubmapSites {
  const count = opts.count ?? 60;
  const sites: Pt[] = [];
  const featureSites: SubmapSites['featureSites'] = [];

  // 1. Forced feature sites (exact relative positions, identity preserved).
  for (const f of ctx.features ?? []) {
    featureSites.push({ feature: f, siteIndex: sites.length });
    sites.push([f.x, f.y]);
  }

  // 2. Seeded scatter inside the polygon (rejection sampling within bbox).
  const target = count + featureSites.length;
  const maxAttempts = (opts.maxAttemptsPerPoint ?? 20) * count;
  const rng = rngFromPath(streamPath(ctx.seedPath, 'submap-sites'));
  const b = polygonBounds(ctx.polygon);
  let attempts = 0;
  while (sites.length < target && attempts < maxAttempts) {
    attempts++;
    const x = b.minX + rng.next() * (b.maxX - b.minX);
    const y = b.minY + rng.next() * (b.maxY - b.minY);
    if (pointInPolygon([x, y], ctx.polygon)) sites.push([+x.toFixed(3), +y.toFixed(3)]);
  }

  return { sites, featureSites };
}

/** Signed area (>0 ⇒ CCW winding under the cross-product convention used below). */
function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return a / 2;
}

/**
 * Clip a subject polygon to a CONVEX clip polygon (Sutherland–Hodgman). Azgaar
 * Voronoi cells are convex, so this exactly trims each submap cell to the parent
 * cell boundary. Returns [] if fully outside.
 */
export function clipPolygon(subject: Pt[], clip: Pt[]): Pt[] {
  if (subject.length < 3 || clip.length < 3) return [];
  // Normalize the clip polygon to positive signed area so "inside = left of edge".
  const c = signedArea(clip) < 0 ? [...clip].reverse() : clip;
  const inside = (p: Pt, a: Pt, b: Pt): boolean =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
  const intersect = (p1: Pt, p2: Pt, a: Pt, b: Pt): Pt => {
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    const x3 = a[0], y3 = a[1], x4 = b[0], y4 = b[1];
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-9) return p2;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };
  let output = subject;
  for (let i = 0; i < c.length; i++) {
    const a = c[i];
    const b = c[(i + 1) % c.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const curIn = inside(cur, a, b);
      const prevIn = inside(prev, a, b);
      if (curIn) {
        if (!prevIn) output.push(intersect(prev, cur, a, b));
        output.push(cur);
      } else if (prevIn) {
        output.push(intersect(prev, cur, a, b));
      }
    }
    if (output.length === 0) break;
  }
  return output;
}

/** Clip a segment to a convex polygon (Cyrus–Beck). Returns the inside sub-segment or null. */
function clipSegmentToConvex(p1: Pt, p2: Pt, poly: Pt[]): [Pt, Pt] | null {
  const c = signedArea(poly) < 0 ? [...poly].reverse() : poly;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  let tE = 0;
  let tL = 1;
  for (let i = 0; i < c.length; i++) {
    const a = c[i];
    const b = c[(i + 1) % c.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    // f(t) = cross(edge, (p1 + t*d) - a) ≥ 0 means inside (CCW).
    const f0 = ex * (p1[1] - a[1]) - ey * (p1[0] - a[0]);
    const fd = ex * dy - ey * dx;
    if (Math.abs(fd) < 1e-12) {
      if (f0 < 0) return null; // parallel & outside this edge
      continue;
    }
    const t = -f0 / fd;
    if (fd > 0) { if (t > tE) tE = t; } else if (t < tL) tL = t;
    if (tE > tL) return null;
  }
  return [[p1[0] + tE * dx, p1[1] + tE * dy], [p1[0] + tL * dx, p1[1] + tL * dy]];
}

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Clip a polyline to a convex polygon, returning the inside pieces (a polyline
 * may exit and re-enter, yielding multiple pieces). Used to project inherited
 * rivers/roads into a submap / sub-cell.
 */
export function clipPolylineToPolygon(points: Pt[], poly: Pt[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = clipSegmentToConvex(points[i], points[i + 1], poly);
    if (!seg) { if (cur.length >= 2) out.push(cur); cur = []; continue; }
    if (cur.length === 0) cur = [seg[0], seg[1]];
    else if (dist2(cur[cur.length - 1], seg[0]) < 1e-6) cur.push(seg[1]);
    else { if (cur.length >= 2) out.push(cur); cur = [seg[0], seg[1]]; }
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}

/** Project a context's inherited polylines into a target polygon (clipped pieces). */
function projectPolylines(polylines: SubmapPolyline[] | undefined, poly: Pt[]): SubmapPolyline[] {
  const out: SubmapPolyline[] = [];
  for (const pl of polylines ?? []) {
    for (const piece of clipPolylineToPolygon(pl.points, poly)) {
      out.push({ kind: pl.kind, points: piece, width: pl.width });
    }
  }
  return out;
}

/**
 * Local sub-biome palettes around a parent biome (parent first = dominant). A
 * submap cell is mostly the inherited biome but a minority vary to ecologically
 * adjacent types, giving each tier local terrain texture without contradicting
 * the L0 region. Unknown biomes fall back to "stay the parent" (single-entry).
 */
const BIOME_VARIANTS: Record<string, string[]> = {
  'Temperate deciduous forest': ['Temperate deciduous forest', 'Grassland', 'Wetland', 'Temperate rainforest'],
  'Temperate rainforest': ['Temperate rainforest', 'Temperate deciduous forest', 'Wetland'],
  'Tropical rainforest': ['Tropical rainforest', 'Tropical seasonal forest', 'Wetland'],
  'Tropical seasonal forest': ['Tropical seasonal forest', 'Savanna', 'Grassland', 'Tropical rainforest'],
  Savanna: ['Savanna', 'Grassland', 'Hot desert'],
  Grassland: ['Grassland', 'Savanna', 'Wetland', 'Temperate deciduous forest'],
  Taiga: ['Taiga', 'Tundra', 'Grassland'],
  Tundra: ['Tundra', 'Taiga', 'Glacier'],
  Glacier: ['Glacier', 'Tundra'],
  Wetland: ['Wetland', 'Grassland', 'Temperate deciduous forest'],
  'Hot desert': ['Hot desert', 'Savanna', 'Grassland'],
  'Cold desert': ['Cold desert', 'Grassland', 'Tundra'],
  Marine: ['Marine'],
};

/**
 * Deterministically pick a sub-cell biome around the inherited parent biome.
 * ~62% of cells keep the parent biome; the rest spread across its variant
 * palette. Seeded per `siteIndex` off the submap seed-path → stable per tier.
 */
export function subBiomeFor(
  parentBiome: string | undefined,
  seedPath: SeedPath,
  siteIndex: number,
): string | undefined {
  if (!parentBiome) return undefined;
  const variants = BIOME_VARIANTS[parentBiome] ?? [parentBiome];
  if (variants.length === 1) return variants[0];
  const r = rngFromPath(streamPath(seedPath, `subbiome:${siteIndex}`)).next();
  if (r < 0.62) return variants[0];
  const rest = variants.slice(1);
  const idx = Math.min(rest.length - 1, Math.floor(((r - 0.62) / 0.38) * rest.length));
  return rest[idx];
}

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
 * SP1 iteration #2: turn the deterministic site set into a Voronoi cell graph.
 * Adds a ring of bbox frame points so every real site gets a BOUNDED cell, then
 * reuses the FMG `Voronoi` traversal (`cells.v` → `vertices.p`). The inherited
 * burg/junction sites keep their cells (identity via `feature`). Clipping each
 * outer cell exactly to the parent polygon + river/road projection + recursion
 * are later iterations; here the boundary is carried on the model.
 */
export function generateSubmap(
  ctx: SubmapParentContext,
  opts: GenerateSubmapSitesOptions = {},
): SubmapModel {
  const { sites, featureSites } = generateSubmapSites(ctx, opts);
  const b = polygonBounds(ctx.polygon);
  const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  const midX = (b.minX + b.maxX) / 2;
  const midY = (b.minY + b.maxY) / 2;
  // 8 frame points well outside the bbox → all real sites are interior/bounded.
  const frame: Pt[] = [
    [b.minX - pad, b.minY - pad], [midX, b.minY - pad], [b.maxX + pad, b.minY - pad],
    [b.maxX + pad, midY], [b.maxX + pad, b.maxY + pad], [midX, b.maxY + pad],
    [b.minX - pad, b.maxY + pad], [b.minX - pad, midY],
  ];
  const all: Pt[] = [...sites, ...frame];
  const delaunay = Delaunator.from(all);
  // Only the real sites (indices < sites.length) get cells; frame points bound them.
  const voronoi = new Voronoi(delaunay, all, sites.length);

  const featureBySite = new Map(featureSites.map((fs) => [fs.siteIndex, fs.feature]));
  const cells: SubmapCell[] = [];
  for (let i = 0; i < sites.length; i++) {
    const vIds = voronoi.cells.v[i];
    if (!vIds || vIds.length < 3) continue;
    const raw: Pt[] = [];
    for (const v of vIds) {
      const p = voronoi.vertices.p[v];
      if (p) raw.push([p[0], p[1]]);
    }
    if (raw.length < 3) continue;
    // Clip the cell exactly to the parent polygon (SP1 T2b) — outer cells stop
    // at the boundary so the submap is precisely the parent cell's shape.
    const polygon = clipPolygon(raw, ctx.polygon);
    if (polygon.length < 3) continue;
    cells.push({
      siteIndex: i,
      polygon,
      feature: featureBySite.get(i),
      biome: subBiomeFor(ctx.biome, ctx.seedPath, i),
    });
  }

  const burgFs = featureSites.find((fs) => fs.feature.kind === 'burg');
  const burgCellIndex = burgFs ? cells.findIndex((c) => c.siteIndex === burgFs.siteIndex) : null;
  return {
    boundary: ctx.polygon,
    biome: ctx.biome,
    cells,
    burgCellIndex: burgCellIndex ?? null,
    polylines: projectPolylines(ctx.polylines, ctx.polygon),
  };
}

/**
 * Recursion wrapper (SP1): turn an output `SubmapCell` into a child
 * `SubmapParentContext`, so the world→region→local drill recurses through one
 * engine. The sub-cell polygon becomes the child boundary; biome inherits from
 * the parent; any set piece the cell carries (e.g. an inherited burg) descends
 * — it is already in the cell's coord space, so its relative position is
 * preserved. The seed-path descends `…/sub:<siteIndex>` for deterministic,
 * isolated regeneration of the deeper tier.
 */
export function submapCellToChildContext(
  cell: SubmapCell,
  parent: SubmapParentContext,
): SubmapParentContext {
  return {
    polygon: cell.polygon,
    seedPath: childSeedPath(parent.seedPath, `sub:${cell.siteIndex}`),
    biome: parent.biome,
    features: cell.feature ? [cell.feature] : [],
    // Inherited rivers/roads that pass through this sub-cell descend (clipped).
    polylines: projectPolylines(parent.polylines, cell.polygon),
  };
}
