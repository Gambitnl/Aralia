/**
 * @file atlasSvg/water.ts — ocean, river and ice layers of the SVG atlas model
 * (split out of atlasSvg.ts, MOD-3.5, 2026-09-09).
 *
 * Everything the map draws in water: the coast-distance BFS, the graduated
 * shallow-water depth bands, the discharge-tapered river ribbons, and the cold
 * (glacier/iceberg) cell fills. Bodies are the original lines verbatim.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:39:58
 * Dependents: components/Worldforge/atlasSvg.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';
import {
  LAND_THRESHOLD,
  buildMergedRegions,
  cellPolygonPoints,
  type AtlasSvgPolygon,
  type AtlasSvgRegion,
} from './cells';

/**
 * Ring distance of every cell from the coast (SP0 T3b). Land cells = 0; water
 * cells = BFS hop count over cell adjacency from the nearest land; water not
 * reachable from land stays -1 (open deep sea). Pure and unit-testable.
 */
export function oceanDepthDistance(atlas: FmgAtlasResult): number[] {
  const cells = atlas.pack.cells;
  const n = cells.h.length;
  const dist = new Array<number>(n).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cells.h[i] >= LAND_THRESHOLD) { dist[i] = 0; q.push(i); }
  }
  let head = 0;
  while (head < q.length) {
    const c = q[head++];
    const nb = cells.c?.[c];
    if (!nb) continue;
    for (const j of nb) {
      if (dist[j] === -1 && cells.h[j] < LAND_THRESHOLD) {
        dist[j] = dist[c] + 1;
        q.push(j);
      }
    }
  }
  return dist;
}

/** Graduated blue for a depth band: light at the coast (band 1) → deeper blue. */
function depthBandFill(band: number, maxBands: number): string {
  const t = (band - 1) / Math.max(1, maxBands - 1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  // Return translucent rgba color to let the radial gradient ocean backdrop shine through.
  return `rgba(${lerp(0x8a, 0x33)},${lerp(0xbe, 0x6e)},${lerp(0xe2, 0xa4)},0.45)`;
}

/**
 * Merged shallow-water depth bands near the coast (SP0 T3b): water cells within
 * `maxBands` rings of land are grouped by ring distance and merged into filled
 * regions (graduated blue, lightest at the coast). Deeper open sea is left to
 * the view's base ocean rect.
 */
export function buildOceanDepthBands(atlas: FmgAtlasResult, maxBands = 4): AtlasSvgRegion[] {
  const cells = atlas.pack.cells;
  const dist = oceanDepthDistance(atlas);
  const keyOf = (i: number): number | null =>
    cells.h[i] < LAND_THRESHOLD && dist[i] >= 1 && dist[i] <= maxBands ? dist[i] : null;
  return buildMergedRegions(atlas, keyOf, (k) => depthBandFill(k as number, maxBands));
}

/**
 * Offset a centerline polyline by per-point half-width into a closed filled
 * ribbon path (SP0 T4). Perpendicular is the central-difference tangent rotated
 * 90°; the path runs up the left offset and back down the right.
 */
export function buildRiverRibbon(points: Array<[number, number]>, halfWidths: number[]): string {
  const n = points.length;
  if (n < 2) return '';
  const left: string[] = [];
  const right: string[] = [];
  for (let k = 0; k < n; k++) {
    const prev = points[Math.max(0, k - 1)];
    const nxt = points[Math.min(n - 1, k + 1)];
    let tx = nxt[0] - prev[0];
    let ty = nxt[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const px = -ty;
    const py = tx;
    const h = halfWidths[k];
    left.push(`${+(points[k][0] + px * h).toFixed(1)},${+(points[k][1] + py * h).toFixed(1)}`);
    right.push(`${+(points[k][0] - px * h).toFixed(1)},${+(points[k][1] - py * h).toFixed(1)}`);
  }
  right.reverse();
  return `M${left.join('L')}L${right.join('L')}Z`;
}

/**
 * Rivers as discharge-tapered filled ribbons (SP0 T4) — Azgaar's `#rivers`
 * (filled, no stroke, `#5d97bb`). Width is derived from `sqrt(discharge)` (the
 * flux magnitude; FMG's `width` km field is sub-pixel here), tapering from a
 * thin source to the mouth. `widthScale` tunes the render weight in graph units.
 */
export function buildRivers(atlas: FmgAtlasResult, widthScale = 1): AtlasSvgRegion[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rivers: any[] = (atlas.pack as any).rivers ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heights: ArrayLike<number> | undefined = (atlas.pack as any).cells?.h;
  const isWater = (cellId: number): boolean => (heights?.[cellId] ?? 100) < LAND_THRESHOLD;
  const out: AtlasSvgRegion[] = [];
  for (const r of rivers) {
    const cellIds: number[] = (r.cells ?? []).filter((c: number) => c >= 0);
    const points = cellIds.map((c) => atlas.pack.cells.p[c]).filter(Boolean) as Array<[number, number]>;
    if (points.length < 2) continue;
    const n = points.length;
    // Match Azgaar's river weight: the flux term is min(flux^0.7 / FLUX_FACTOR,
    // MAX_FLUX_WIDTH) — i.e. CAPPED, not an unbounded sqrt(discharge), so big
    // rivers stay delicate threads instead of fat slashes. Half-widths here, so
    // the rendered ribbon diameter is ~2× these values.
    const FLUX_FACTOR = 500;
    const MAX_FLUX_HALF = 0.9; // cap on the flux contribution to half-width (graph units)
    const flux = r.discharge ?? 0;
    const mouthHalf = (0.18 + Math.min(Math.pow(flux, 0.7) / FLUX_FACTOR, MAX_FLUX_HALF)) * widthScale;
    const sourceHalf = Math.max(0.1, mouthHalf * 0.25);
    const halfWidths = points.map((_, k) => {
      const t = n > 1 ? k / (n - 1) : 1;
      return sourceHalf + (mouthHalf - sourceHalf) * t;
    });

    // Break the ribbon at open water. FMG routes a river THROUGH lake cells to
    // carry it downstream, so the cell sequence is right — but drawing it as one
    // unbroken ribbon paints a river line straight across the lake it flows
    // into, which reads as a river running over open water (Remy, 2026-07-29).
    // Each stretch of land becomes its own ribbon, extended ONE cell into the
    // water at each end so the river still meets the bank instead of stopping
    // short of the shore. Taper indices stay tied to the position in the WHOLE
    // river, so width still grows downstream across the break.
    const midpoint = (a: number, b: number): [number, number] => [
      (points[a][0] + points[b][0]) / 2,
      (points[a][1] + points[b][1]) / 2,
    ];
    let runStart = -1;
    const flush = (endExclusive: number): void => {
      if (runStart < 0) return;
      const runPts = points.slice(runStart, endExclusive);
      const runW = halfWidths.slice(runStart, endExclusive);
      // End the ribbon ON THE BANK, not at the water cell's center. Reaching a
      // whole cell in leaves a visible stub of river lying across open water at
      // map zoom; the midpoint between the last land cell and the first water
      // cell is the shoreline between them, so the river meets the water and
      // stops there.
      if (runStart > 0) {
        runPts.unshift(midpoint(runStart - 1, runStart));
        runW.unshift(halfWidths[runStart]);
      }
      if (endExclusive < points.length) {
        runPts.push(midpoint(endExclusive - 1, endExclusive));
        runW.push(halfWidths[endExclusive - 1]);
      }
      if (runPts.length >= 2) {
        const d = buildRiverRibbon(runPts, runW);
        if (d) out.push({ d, fill: '#5d97bb' });
      }
      runStart = -1;
    };
    for (let k = 0; k < points.length; k++) {
      if (isWater(cellIds[k])) flush(k);
      else if (runStart < 0) runStart = k;
    }
    flush(points.length);
  }
  return out;
}

/**
 * Cold (glacier/iceberg) cells (Azgaar "ice" layer): any cell whose grid
 * temperature is below `thresholdC`, filled pale ice-blue. Includes water cells
 * (icebergs) as well as frozen land (glaciers).
 */
export function buildIceCells(atlas: FmgAtlasResult, thresholdC = -5): AtlasSvgPolygon[] {
  const cells = atlas.pack.cells;
  const gArr = (cells as { g?: ArrayLike<number> }).g;
  const tempArr = (atlas as { grid?: { cells?: { temp?: ArrayLike<number> } } }).grid?.cells?.temp;
  if (!gArr || !tempArr) return [];
  const out: AtlasSvgPolygon[] = [];
  for (let i = 0; i < cells.h.length; i++) {
    if ((tempArr[gArr[i]] ?? 0) >= thresholdC) continue;
    const points = cellPolygonPoints(atlas, i);
    if (points) out.push({ points, fill: '#dfeefa' });
  }
  return out;
}
