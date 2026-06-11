/**
 * @file reGraph.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: `reGraph()` from .tmp/azgaar-src/public/main.js. See
 * ./ATTRIBUTION.md.
 *
 * Recalculates the Voronoi graph to "pack" cells: deep-ocean grid points are
 * dropped, coastline cells get extra midpoints, and a new Voronoi diagram is
 * computed over the kept points. The result is the pack graph all later
 * stages (markupPack, rivers, biomes, cultures, ...) operate on.
 * No RNG draws.
 *
 * Adaptations (cosmetic only):
 * - `grid` is an explicit parameter and the constructed `pack` is returned
 *   (upstream mutates the global `pack`, reset to `{}` earlier in generate()).
 * - STRIPPED: `pack.cells.q = d3.quadtree(...)` — a d3-quadtree spatial
 *   search index used by UI hit-testing and later-slice helpers (findCell);
 *   no slice-2 stage reads it. Port it together with the stage that needs it.
 */
import {
  calculateVoronoi,
  createTypedArray,
  getPackPolygon,
  rn,
  TYPED_ARRAY_MAX_VALUES,
} from "./utils";
import { polygonArea } from "./d3Shim";
import type { Grid } from "./utils/graphUtils";
import type { Point } from "./voronoi";
import type { Pack } from "./features";

const UINT16_MAX = TYPED_ARRAY_MAX_VALUES.UINT16_MAX;

/** Recalculate Voronoi Graph to pack cells. Exact port of upstream `reGraph()`. */
export function reGraph(grid: Grid): Pack {
  const { cells: gridCells, points, features } = grid;
  const newCells: { p: Point[]; g: number[]; h: number[] } = {
    p: [],
    g: [],
    h: [],
  }; // store new data
  const spacing2 = grid.spacing ** 2;

  for (const i of gridCells.i) {
    const height = gridCells.h![i];
    const type = gridCells.t![i];

    if (height < 20 && type !== -1 && type !== -2) continue; // exclude all deep ocean points
    if (type === -2 && (i % 4 === 0 || features![gridCells.f![i]].type === "lake"))
      continue; // exclude non-coastal lake points

    const [x, y] = points[i];
    addNewPoint(i, x, y, height);

    // add additional points for cells along coast
    if (type === 1 || type === -1) {
      if (gridCells.b[i]) continue; // not for near-border cells
      gridCells.c[i].forEach(function (e) {
        if (i > e) return;
        if (gridCells.t![e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(i, x1, y1, height);
        }
      });
    }
  }

  function addNewPoint(i: number, x: number, y: number, height: number) {
    newCells.p.push([x, y]);
    newCells.g.push(i);
    newCells.h.push(height);
  }

  const { cells: packCells, vertices } = calculateVoronoi(
    newCells.p,
    grid.boundary,
  );
  const pack = {} as Pack; // upstream: pack reset to {} before markupGrid
  pack.vertices = vertices;
  pack.cells = packCells as Pack["cells"];
  pack.cells.p = newCells.p;
  pack.cells.g = createTypedArray({
    maxValue: grid.points.length,
    from: newCells.g,
  });
  // STRIPPED (render/search support, see file header):
  // pack.cells.q = d3.quadtree(newCells.p.map(([x, y], i) => [x, y, i]));
  pack.cells.h = createTypedArray({ maxValue: 100, from: newCells.h });
  pack.cells.area = createTypedArray({
    maxValue: UINT16_MAX,
    length: packCells.i.length,
  }).map((_, cellId) => {
    const area = Math.abs(polygonArea(getPackPolygon(cellId, pack)));
    return Math.min(area, UINT16_MAX);
  });

  return pack;
}
