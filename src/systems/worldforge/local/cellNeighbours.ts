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

const LAND_THRESHOLD = 20;

interface CellTopology {
  p: ReadonlyArray<readonly [number, number]>;
  c: ReadonlyArray<ReadonlyArray<number>>;
  h: ArrayLike<number>;
}

function topology(atlas: FmgWorldResult): CellTopology {
  return atlas.pack.cells as unknown as CellTopology;
}

/**
 * The atlas cell a world-space (graph) position falls in — the nearest Voronoi
 * site, which IS Voronoi cell membership by definition. Linear scan (~10k cells,
 * sub-ms; the bridge uses the same pattern). Returns -1 only for an empty atlas.
 */
export function worldPosToCell(atlas: FmgWorldResult, x: number, y: number): number {
  const { p } = topology(atlas);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < p.length; i++) {
    const site = p[i];
    if (!site) continue;
    const dx = site[0] - x;
    const dy = site[1] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * The LAND Voronoi neighbour of `cellId` best aligned with direction `(dx, dy)`
 * in world space, or `null` when no land neighbour lies that way (e.g. a coastal
 * cell whose only neighbour in that direction is sea). Picks the neighbour whose
 * site-offset has the largest positive dot product with the (normalized)
 * requested direction — the cell you'd cross into walking that way.
 */
export function cellNeighbourInDirection(
  atlas: FmgWorldResult,
  cellId: number,
  dx: number,
  dy: number,
): number | null {
  const { p, c, h } = topology(atlas);
  const origin = p[cellId];
  const neighbours = c[cellId];
  if (!origin || !neighbours) return null;

  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  let best: number | null = null;
  let bestDot = 0; // strictly-positive alignment required (must be "that way")
  for (const nb of neighbours) {
    if (h[nb] < LAND_THRESHOLD) continue; // land only — sea is the ship layer
    const site = p[nb];
    if (!site) continue;
    const ox = site[0] - origin[0];
    const oy = site[1] - origin[1];
    const olen = Math.hypot(ox, oy) || 1;
    const dot = (ox / olen) * ux + (oy / olen) * uy; // cosine of the angle
    if (dot > bestDot) { bestDot = dot; best = nb; }
  }
  return best;
}
