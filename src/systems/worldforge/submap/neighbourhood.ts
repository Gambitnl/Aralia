/**
 * @file neighbourhood.ts — region-tier "neighbourhood" model (fog-of-war).
 *
 * When the player drills an atlas/world cell, the region view shows that focus
 * cell PLUS its atlas neighbours in true relative position. Neighbours the party
 * has physically explored render their own submap; the rest are grey with basic
 * top-level info. This builder produces that view-model: the focus + neighbour
 * cells, cluster-scaled to a healthy canonical span (so each cell's submap
 * geometry stays clean, like the per-tier drill normalization), with a generated
 * submap for the focus + explored cells only.
 *
 * Pure: no React/DOM. Deterministic from the seed-path. Design:
 * docs/superpowers/specs/2026-06-24-submap-neighbourhood-view-design.md
 */
import { atlasCellToSubmapContext } from './l0Adapter';
import { generateSubmap, polygonBounds, type Pt, type SubmapModel, type SubmapParentContext } from './submapEngine';
import { childSeedPath, type SeedPath } from '../seedPath';
import type { FmgAtlasResult } from '../fmg/generateAtlas';

export interface NeighbourhoodCell {
  /** Atlas pack cell id. */
  cellId: number;
  /** The drilled cell at the centre of the neighbourhood. */
  isFocus: boolean;
  /** Explored ⇒ render its submap; otherwise grey + basic info. Focus is always explored. */
  explored: boolean;
  /** Cell polygon in the shared, cluster-scaled frame. */
  polygon: Pt[];
  /** Basic top-level info shown for grey (and any) cells. */
  biome?: string;
  burgName?: string;
  /** Generated submap — present only for the focus + explored neighbours. */
  model?: SubmapModel;
}

export interface AtlasNeighbourhood {
  focusCellId: number;
  /** The focus cell's scaled context — parent for drilling deeper into the focus. */
  focusCtx: SubmapParentContext;
  cells: NeighbourhoodCell[];
}

export interface NeighbourhoodOptions {
  /** Sites per generated submap. */
  submapCount?: number;
  /** Canonical cluster span the focus+neighbours are scaled to. */
  canonSpan?: number;
}

/** Scale a context's geometry around (cx,cy) by k (shared cluster transform). */
function scaleCtx(ctx: SubmapParentContext, cx: number, cy: number, k: number): SubmapParentContext {
  const sc = (p: Pt): Pt => [(p[0] - cx) * k + cx, (p[1] - cy) * k + cy];
  return {
    ...ctx,
    polygon: ctx.polygon.map(sc),
    features: ctx.features?.map((f) => ({ ...f, x: (f.x - cx) * k + cx, y: (f.y - cy) * k + cy })),
    polylines: ctx.polylines?.map((pl) => ({ ...pl, points: pl.points.map(sc) })),
  };
}

/**
 * Build the neighbourhood view-model for a focus atlas cell.
 * @param isExplored predicate: has the party physically explored this atlas cell?
 */
export function buildAtlasNeighbourhood(
  atlas: FmgAtlasResult,
  focusCellId: number,
  isExplored: (cellId: number) => boolean,
  seedPath: SeedPath,
  opts: NeighbourhoodOptions = {},
): AtlasNeighbourhood {
  const count = opts.submapCount ?? 160;
  const canon = opts.canonSpan ?? 1000;

  const neighbourIds = (atlas.pack.cells.c?.[focusCellId] ?? []) as number[];
  const ids = [focusCellId, ...neighbourIds];

  // Raw contexts in atlas-graph frame; drop any with a degenerate polygon.
  const raw = ids
    .map((id) => ({ id, ctx: atlasCellToSubmapContext(atlas, id, childSeedPath(seedPath, `cell:${id}`)) }))
    .filter((r) => r.ctx.polygon.length >= 3);

  if (raw.length === 0) {
    return { focusCellId, focusCtx: atlasCellToSubmapContext(atlas, focusCellId, childSeedPath(seedPath, `cell:${focusCellId}`)), cells: [] };
  }

  // Cluster bounds over all polygons → uniform scale; centre on the focus centroid.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of raw) {
    for (const [x, y] of r.ctx.polygon) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const k = canon / (Math.max(maxX - minX, maxY - minY) || 1);
  const focus = raw.find((r) => r.id === focusCellId) ?? raw[0];
  const fb = polygonBounds(focus.ctx.polygon);
  const cx = (fb.minX + fb.maxX) / 2;
  const cy = (fb.minY + fb.maxY) / 2;

  let focusCtx: SubmapParentContext = scaleCtx(focus.ctx, cx, cy, k);
  const cells: NeighbourhoodCell[] = raw.map((r) => {
    const scaled = scaleCtx(r.ctx, cx, cy, k);
    const isFocus = r.id === focusCellId;
    if (isFocus) focusCtx = scaled;
    const explored = isFocus || isExplored(r.id);
    const burg = r.ctx.features?.find((f) => f.kind === 'burg');
    return {
      cellId: r.id,
      isFocus,
      explored,
      polygon: scaled.polygon,
      biome: r.ctx.biome,
      burgName: burg?.name,
      model: explored ? generateSubmap(scaled, { count }) : undefined,
    };
  });

  return { focusCellId, focusCtx, cells };
}
