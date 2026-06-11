/**
 * @file utils/pathUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/pathUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Slice 1 ported connectVertices; slice 3 adds getIsolines (polygons mode
 * only), getPolesOfInaccessibility and the A* findPath — needed by
 * Ice.generate, States/Provinces.getPoles and Routes.generate.
 *
 * Stripped (render-only, no RNG): getFillPath / getBorderPath SVG string
 * builders and getIsolines' fill/halo/waterGap output modes (they only build
 * SVG path strings from the same vertex chains; cell-visit order — which is
 * the part later stages observe via addToChecked — is identical with the
 * polygons-only port). getVertexPath is also left behind.
 */
import { FlatQueue } from "./flatqueue";
import { polylabel } from "./polylabel";
import { rn } from "./numberUtils";
import type { Vertices } from "../voronoi";

/**
 * Walks the vertex graph from a starting vertex, keeping to the boundary
 * between cells of the given type, and returns the vertex chain.
 */
export const connectVertices = ({
  vertices,
  startingVertex,
  ofSameType,
  addToChecked,
  closeRing,
}: {
  vertices: Vertices;
  startingVertex: number;
  ofSameType: (cellId: number) => boolean;
  addToChecked?: (cellId: number) => void;
  closeRing?: boolean;
}) => {
  const MAX_ITERATIONS = vertices.c.length;
  const chain = []; // vertices chain to form a path

  let next = startingVertex;
  for (let i = 0; i === 0 || next !== startingVertex; i++) {
    const previous = chain.at(-1);
    const current = next;
    chain.push(current);

    const neibCells = vertices.c[current];
    if (addToChecked) neibCells.filter(ofSameType).forEach(addToChecked);

    const [c1, c2, c3] = neibCells.map(ofSameType);
    const [v1, v2, v3] = vertices.v[current];

    if (v1 !== previous && c1 !== c2) next = v1;
    else if (v2 !== previous && c2 !== c3) next = v2;
    else if (v3 !== previous && c1 !== c3) next = v3;

    if (next >= vertices.c.length) {
      // upstream: window.ERROR && console.error("ConnectVertices: next vertex is out of bounds")
      break;
    }

    if (next === current) {
      // upstream: window.ERROR && console.error("ConnectVertices: next vertex is not found")
      break;
    }

    if (i === MAX_ITERATIONS) {
      // upstream: window.ERROR && console.error("ConnectVertices: max iterations reached")
      break;
    }
  }

  if (closeRing) chain.push(startingVertex);
  return chain;
};

/**
 * Restores the path from exit to start using the 'from' mapping.
 * (upstream pathUtils restorePath — verbatim)
 */
const restorePath = (exit: number, start: number, from: number[]) => {
  const pathCells = [];

  let current = exit;
  let prev = exit;

  while (current !== start) {
    pathCells.push(current);
    prev = from[current];
    current = prev;
  }

  pathCells.push(current);

  return pathCells.reverse();
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Returns isolines (borders) for different types of cells in the graph.
 * Port of upstream getIsolines restricted to the `polygons` output mode (the
 * only mode the generation path uses — Ice.generate and getPoles*); the
 * fill/halo/waterGap SVG-string modes are stripped (see file header). The
 * cell scan order, the inner-lake skip and the vertex-chain walk are
 * verbatim.
 */
export const getIsolines = (
  graph: any,
  getType: (cellId: number) => any,
  options: { polygons?: boolean } = { polygons: false },
): any => {
  const { cells, vertices } = graph;
  const isolines: any = {};

  const checkedCells = new Uint8Array(cells.i.length);
  const addToChecked = (cellId: number) => {
    checkedCells[cellId] = 1;
  };
  const isChecked = (cellId: number) => checkedCells[cellId] === 1;

  for (const cellId of cells.i) {
    if (isChecked(cellId) || !getType(cellId)) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    const ofSameType = (cellId: number) => getType(cellId) === type;
    const ofDifferentType = (cellId: number) => getType(cellId) !== type;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    // check if inner lake. Note there is no shoreline for grid features
    const feature = graph.features[cells.f[onborderCell]];
    if (feature.type === "lake" && feature.shoreline?.every(ofSameType))
      continue;

    const startingVertex = cells.v[cellId].find((v: number) =>
      vertices.c[v].some(ofDifferentType),
    );
    if (startingVertex === undefined)
      throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({
      vertices,
      startingVertex,
      ofSameType,
      addToChecked,
      closeRing: true,
    });
    if (vertexChain.length < 3) continue;

    addIsolineTo(type, vertices, vertexChain, isolines, options);
  }

  return isolines;

  function addIsolineTo(
    type: any,
    vertices: any,
    vertexChain: number[],
    isolines: any,
    options: any,
  ) {
    if (!isolines[type]) isolines[type] = {};

    if (options.polygons) {
      if (!isolines[type].polygons) isolines[type].polygons = [];
      isolines[type].polygons.push(
        vertexChain.map((vertexId) => vertices.p[vertexId]),
      );
    }
  }
};

/**
 * Returns poles of inaccessibility for each cell type (upstream
 * getPolesOfInaccessibility — verbatim; polylabel precision 20).
 */
export const getPolesOfInaccessibility = (
  graph: any,
  getType: (cellId: number) => any,
) => {
  const isolines = getIsolines(graph, getType, { polygons: true });

  const poles = Object.entries(isolines).map(([id, isoline]) => {
    const multiPolygon = (isoline as any).polygons.sort(
      (a: any, b: any) => b.length - a.length,
    );
    const [x, y] = polylabel(multiPolygon, 20);
    return [id, [rn(x), rn(y)]];
  });

  return Object.fromEntries(poles);
};

/**
 * Finds the shortest path between two cells using a cost-based pathfinding
 * algorithm (upstream findPath — verbatim, including the
 * `totalCost >= cost[next]` comparison against an undefined entry being
 * false on first visit).
 * @param start - The ID of the starting cell.
 * @param isExit - Returns true if the cell is the exit cell.
 * @param getCost - Path cost from current to next; Infinity = impassable.
 * @param packedGraph - The packed graph containing cells and connections.
 * @returns Cell ids of the path from start to exit, or null.
 */
export const findPath = (
  start: number,
  isExit: (id: number) => boolean,
  getCost: (current: number, next: number) => number,
  packedGraph: any = {},
): number[] | null => {
  if (isExit(start)) return null;

  const from: number[] = [];
  const cost: number[] = [];
  const queue = new FlatQueue<number>();
  queue.push(start, 0);

  while (queue.length) {
    const currentCost = queue.peekValue() as number;
    const current = queue.pop() as number;

    for (const next of packedGraph.cells.c[current]) {
      if (isExit(next)) {
        from[next] = current;
        return restorePath(next, start, from);
      }

      const nextCost = getCost(current, next);
      if (nextCost === Infinity) continue; // impassable cell
      const totalCost = currentCost + nextCost;

      if (totalCost >= cost[next]) continue; // has cheaper path
      from[next] = current;
      cost[next] = totalCost;
      queue.push(next, totalCost);
    }
  }

  return null;
};

/* eslint-enable @typescript-eslint/no-explicit-any */
