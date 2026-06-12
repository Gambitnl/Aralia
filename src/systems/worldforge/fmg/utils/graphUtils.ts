/**
 * @file utils/graphUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/graphUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Faithfulness: getBoundaryPoints, getJitteredGrid, placePoints,
 * generateGrid, calculateVoronoi, findGridCell, findGridAll, isLand and
 * isWater are exact ports (identical math and RNG draw order). Adaptations:
 * - `cellsDesired` is an explicit parameter (upstream reads it from the DOM:
 *   `byId("pointsInput").dataset.cells`).
 * - Quadtree helpers, poisson sampler and canvas heightmap preview were left
 *   behind (DOM/d3-quadtree rendering support, unused in generation slice 1).
 *
 * RNG: generateGrid assigns `Math.random = Alea(seed)` exactly like upstream;
 * the jitter draws in getJitteredGrid then consume that stream in identical
 * order. The caller (generateBase) is responsible for restoring Math.random.
 */
import Alea from "alea";
import Delaunator from "delaunator";
import {
  type Cells,
  type Point,
  type Vertices,
  Voronoi,
} from "../voronoi";
import { createTypedArray } from "./arrayUtils";
import { rn } from "./numberUtils";
import type { GridFeature } from "../features";

/** Grid-level cells: Voronoi topology plus the generation fields added by the heightmap (h), features (t, f) and climate (temp, prec) stages. */
export type GridCells = Cells & {
  h?: Uint8Array; // heights [0, 100], set by HeightmapGenerator
  t?: Int8Array; // distance field (1 = land coast, -1 = water coast...), set by Features.markupGrid
  f?: Uint16Array; // feature ids, set by Features.markupGrid
  temp?: Int8Array; // temperature °C, set by calculateTemperatures (slice 2)
  prec?: Uint8Array; // precipitation, set by generatePrecipitation (slice 2)
};

export interface Grid {
  spacing: number;
  cellsDesired: number;
  boundary: Point[];
  points: Point[];
  cellsX: number;
  cellsY: number;
  seed: string;
  cells: GridCells;
  vertices: Vertices;
  features?: GridFeature[]; // element 0 is the literal 0 placeholder, as upstream
}

/**
 * Get boundary points on a regular square grid
 * @param {number} width - The width of the area
 * @param {number} height - The height of the area
 * @param {number} spacing - The spacing between points
 * @returns {Array} - An array of boundary points
 */
const getBoundaryPoints = (
  width: number,
  height: number,
  spacing: number,
): Point[] => {
  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  const points: Point[] = [];

  for (let i = 0.5; i < numberX; i++) {
    const x = Math.ceil((w * i) / numberX + offset);
    points.push([x, offset], [x, h + offset]);
  }

  for (let i = 0.5; i < numberY; i++) {
    const y = Math.ceil((h * i) / numberY + offset);
    points.push([offset, y], [w + offset, y]);
  }

  return points;
};

/**
 * Get points on a jittered square grid
 * @param {number} width - The width of the area
 * @param {number} height - The height of the area
 * @param {number} spacing - The spacing between points
 * @returns {Array} - An array of jittered grid points
 */
const getJitteredGrid = (
  width: number,
  height: number,
  spacing: number,
): Point[] => {
  const radius = spacing / 2; // square radius
  const jittering = radius * 0.9; // max deviation
  const doubleJittering = jittering * 2;
  const jitter = () => Math.random() * doubleJittering - jittering;

  const points: Point[] = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }
  return points;
};

/**
 * Places points on a jittered grid and calculates spacing and cell counts
 * @param {number} graphWidth - The width of the graph
 * @param {number} graphHeight - The height of the graph
 * @param {number} cellsDesired - The desired number of cells (upstream: byId("pointsInput").dataset.cells)
 * @returns {Object} - An object containing spacing, cellsDesired, boundary points, grid points, cellsX, and cellsY
 */
const placePoints = (
  graphWidth: number,
  graphHeight: number,
  cellsDesired: number,
): {
  spacing: number;
  cellsDesired: number;
  boundary: Point[];
  points: Point[];
  cellsX: number;
  cellsY: number;
} => {
  const spacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2); // spacing between points before jittering

  const boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  const points = getJitteredGrid(graphWidth, graphHeight, spacing); // points of jittered square grid
  const cellCountX = Math.floor((graphWidth + 0.5 * spacing - 1e-10) / spacing); // number of cells in x direction
  const cellCountY = Math.floor(
    (graphHeight + 0.5 * spacing - 1e-10) / spacing,
  ); // number of cells in y direction

  return {
    spacing,
    cellsDesired,
    boundary,
    points,
    cellsX: cellCountX,
    cellsY: cellCountY,
  };
};

/**
 * Generates a Voronoi grid based on jittered grid points
 * @returns {Object} - The generated grid object containing spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices, and seed
 */
export const generateGrid = (
  seed: string,
  graphWidth: number,
  graphHeight: number,
  cellsDesired: number,
): Grid => {
  Math.random = Alea(seed); // reset PRNG
  const { spacing, boundary, points, cellsX, cellsY } = placePoints(
    graphWidth,
    graphHeight,
    cellsDesired,
  );
  const { cells, vertices } = calculateVoronoi(points, boundary);
  return {
    spacing,
    cellsDesired,
    boundary,
    points,
    cellsX,
    cellsY,
    cells,
    vertices,
    seed,
  };
};

/**
 * Calculates the Voronoi diagram from given points and boundary
 * @param {Array} points - The array of points for Voronoi calculation
 * @param {Array} boundary - The boundary points to clip the Voronoi cells
 * @returns {Object} - An object containing Voronoi cells and vertices
 */
export const calculateVoronoi = (
  points: Point[],
  boundary: Point[],
): { cells: Cells; vertices: Vertices } => {
  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);

  const voronoi = new Voronoi(delaunay, allPoints, points.length);

  const cells = voronoi.cells;
  cells.i = createTypedArray({
    maxValue: points.length,
    length: points.length,
  }).map((_, i) => i) as Uint32Array; // array of indexes
  const vertices = voronoi.vertices;

  return { cells, vertices };
};

/**
 * Returns a cell index on a regular square grid based on x and y coordinates
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {Object} grid - The grid object containing spacing, cellsX, and cellsY
 * @returns {number} - The index of the cell in the grid
 */
export const findGridCell = (x: number, y: number, grid: Grid): number => {
  return (
    Math.floor(Math.min(y / grid.spacing, grid.cellsY - 1)) * grid.cellsX +
    Math.floor(Math.min(x / grid.spacing, grid.cellsX - 1))
  );
};

/**
 * return array of cell indexes in radius on a regular square grid
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} radius - The search radius
 * @param {Object} grid - The grid object containing spacing, cellsX, and cellsY
 * @returns {Array} - An array of cell indexes within the specified radius
 */
export const findGridAll = (
  x: number,
  y: number,
  radius: number,
  grid: Grid,
): number[] => {
  const c = grid.cells.c;
  let r = Math.floor(radius / grid.spacing);
  let found = [findGridCell(x, y, grid)];
  if (!r || radius === 1) return found;
  if (r > 0) found = found.concat(c[found[0]]);
  if (r > 1) {
    let frontier = c[found[0]];
    while (r > 1) {
      const cycle = frontier.slice();
      frontier = [];
      cycle.forEach((s: number) => {
        c[s].forEach((e: number) => {
          if (found.indexOf(e) !== -1) return;
          found.push(e);
          frontier.push(e);
        });
      });
      r--;
    }
  }

  return found;
};

/**
 * Returns the polygon points for a packed cell given its index
 * @param {number} i - The index of the packed cell
 * @returns {Array} - An array of polygon points for the specified cell
 */
export const getPackPolygon = (
  cellIndex: number,
  packedGraph: { cells: { v: number[][] }; vertices: { p: Point[] } },
): Point[] => {
  return packedGraph.cells.v[cellIndex].map(
    (v: number) => packedGraph.vertices.p[v],
  );
};

/**
 * Returns the polygon points for a grid cell given its index (upstream
 * getGridPolygon — verbatim; slice 3, needed by Ice.generate)
 * @param {number} i - The index of the grid cell
 * @returns {Array} - An array of polygon points for the specified grid cell
 */
export const getGridPolygon = (
  i: number,
  grid: { cells: { v: number[][] }; vertices: { p: Point[] } },
): Point[] => {
  return grid.cells.v[i].map((v: number) => grid.vertices.p[v]);
};

/**
 * Returns the index of the packed cell containing the given x and y
 * coordinates (upstream findClosestCell — verbatim; slice 3, needed by
 * Routes.getPoints). Requires the `pack.cells.q` quadtree of [x, y, cellId]
 * triples that upstream reGraph builds (in this port it is built by
 * generateWorld.ts, see the strip note in reGraph.ts).
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} radius - The search radius (default is Infinity)
 * @returns {number|undefined} - The index of the found cell or undefined
 */
export const findClosestCell = (
  x: number,
  y: number,
  radius: number | undefined,
  packedGraph: { cells: { q?: { find: (x: number, y: number, r?: number) => number[] | undefined } } },
): number | undefined => {
  if (!packedGraph.cells?.q) return;
  const found = packedGraph.cells.q.find(x, y, radius ?? Infinity);
  return found ? found[2] : undefined;
};

/** Minimal structural type for height-bearing graphs (grid or pack). */
export type HeightGraph = { cells: { h: ArrayLike<number> } };

/**
 * Checks if a cell is land based on its height
 * @param {number} i - The index of the cell
 * @returns {boolean} - True if the cell is land, false otherwise
 */
export const isLand = (i: number, packedGraph: HeightGraph) => {
  return packedGraph.cells.h[i] >= 20;
};

/**
 * Checks if a cell is water based on its height
 * @param {number} i - The index of the cell
 * @returns {boolean} - True if the cell is water, false otherwise
 */
export const isWater = (i: number, packedGraph: HeightGraph) => {
  return packedGraph.cells.h[i] < 20;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Returns all data points within a radius of (x, y) in a d3-style quadtree —
 * verbatim port of upstream src/utils/graphUtils.ts findAllInQuadtree
 * (added for Military.generate regiment merging). Accesses quadtree
 * internals (_x0/_root/_x) exactly like upstream; works against our
 * utils/quadtree.ts d3 port. Side effects on node data (`scanned`,
 * `selected`) are upstream behavior and preserved.
 */
export const findAllInQuadtree = (
  x: number,
  y: number,
  radius: number,
  quadtree: any,
) => {
  let dx: number, dy: number, d2: number;

  const radiusSearchInit = (t: any, radius: number) => {
    t.result = [];
    t.x0 = t.x - radius;
    t.y0 = t.y - radius;
    t.x3 = t.x + radius;
    t.y3 = t.y + radius;
    t.radius = radius * radius;
  };

  const radiusSearchVisit = (t: any, d2: number) => {
    t.node.data.scanned = true;
    if (d2 < t.radius) {
      while (t.node) {
        t.result.push(t.node.data);
        t.node.data.selected = true;
        t.node = t.node.next;
      }
    }
  };

  class Quad {
    node: any;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    constructor(node: any, x0: number, y0: number, x1: number, y1: number) {
      this.node = node;
      this.x0 = x0;
      this.y0 = y0;
      this.x1 = x1;
      this.y1 = y1;
    }
  }

  const t: any = {
    x,
    y,
    x0: quadtree._x0,
    y0: quadtree._y0,
    x3: quadtree._x1,
    y3: quadtree._y1,
    quads: [],
    node: quadtree._root,
  };
  if (t.node) t.quads.push(new Quad(t.node, t.x0, t.y0, t.x3, t.y3));
  radiusSearchInit(t, radius);

  t.q = t.quads.pop();
  while (t.q) {
    t.node = t.q.node;
    t.x1 = t.q.x0;
    t.y1 = t.q.y0;
    t.x2 = t.q.x1;
    t.y2 = t.q.y1;

    // Stop searching if this quadrant cannot contain a closer node.
    if (!t.node || t.x1 > t.x3 || t.y1 > t.y3 || t.x2 < t.x0 || t.y2 < t.y0) {
      t.q = t.quads.pop();
      continue;
    }

    // Bisect the current quadrant.
    if (t.node.length) {
      t.node.explored = true;
      const xm: number = (t.x1 + t.x2) / 2,
        ym: number = (t.y1 + t.y2) / 2;

      t.quads.push(
        new Quad(t.node[3], xm, ym, t.x2, t.y2),
        new Quad(t.node[2], t.x1, ym, xm, t.y2),
        new Quad(t.node[1], xm, t.y1, t.x2, ym),
        new Quad(t.node[0], t.x1, t.y1, xm, ym),
      );

      // Visit the closest quadrant first.
      t.i = (+(y >= ym) << 1) | +(x >= xm);
      if (t.i) {
        t.q = t.quads[t.quads.length - 1];
        t.quads[t.quads.length - 1] = t.quads[t.quads.length - 1 - t.i];
        t.quads[t.quads.length - 1 - t.i] = t.q;
      }
    }

    // Visit this point. (Visiting coincident points is not necessary!)
    else {
      dx = x - +quadtree._x.call(null, t.node.data);
      dy = y - +quadtree._y.call(null, t.node.data);
      d2 = dx * dx + dy * dy;
      radiusSearchVisit(t, d2);
    }
    t.q = t.quads.pop();
  }
  return t.result;
};
/* eslint-enable @typescript-eslint/no-explicit-any */
