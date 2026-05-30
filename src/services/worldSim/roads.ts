/**
 * @file roads.ts
 * @description Generates a connected road network between towns using pathfinding and spanning trees.
 *
 * Why this is built this way:
 * - A* is used for routing between towns, with a cost function penalizing water (making it impassable)
 *   and steep height differences (slopes).
 * - Minimum Spanning Tree (Kruskal's algorithm) connects all towns into a single network with the
 *   minimum total path length/cost, preventing disconnected towns.
 * - An extra 20% of short, non-MST road segments are added to create redundant loops and routes,
 *   making the road network feel more realistic and organic rather than a strict tree.
 *
 * Known limitations/deferred issues:
 * - Towns are connected directly to other towns. Bridges and tunnels could be modeled in detail
 *   but are currently represented by the A* path's height cost traversal.
 */

import type { Road, Site, Vec2 } from './types';

const SEA_LEVEL = 20;

interface PathResult {
  cost: number;
  points: Vec2[];
}

/**
 * Standard A* pathfinding algorithm on a grid.
 * Impassable: Sea (height < 20).
 * Cost factors: Distance + change in elevation.
 */
function aStar(
  heights: number[],
  cols: number,
  rows: number,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): PathResult | null {
  const idx = (x: number, y: number) => y * cols + x;
  const isPassable = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < cols && y < rows && heights[idx(x, y)] >= SEA_LEVEL;

  if (!isPassable(sx, sy) || !isPassable(gx, gy)) return null;

  const open = new Set<number>();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const fScore = new Map<number, number>();
  const heuristic = (x: number, y: number) => Math.hypot(gx - x, gy - y);

  const start = idx(sx, sy);
  open.add(start);
  gScore.set(start, 0);
  fScore.set(start, heuristic(sx, sy));

  while (open.size > 0) {
    let current = -1;
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }

    if (current === -1) break;

    const cx = current % cols;
    const cy = (current / cols) | 0;

    if (cx === gx && cy === gy) {
      // Reconstruct the path backwards from destination to source
      const points: Vec2[] = [];
      let cur: number | undefined = current;
      while (cur !== undefined) {
        points.push({ x: (cur % cols) + 0.5, y: ((cur / cols) | 0) + 0.5 });
        const prev = cameFrom.get(cur);
        if (prev === undefined) break;
        cur = prev;
      }
      points.reverse();
      return { cost: gScore.get(current) ?? 0, points };
    }

    open.delete(current);

    // 8-way directional movement
    for (const [dx, dy] of [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isPassable(nx, ny)) continue;

      const nid = idx(nx, ny);
      // Slope penalty: steep climbs increase path cost
      const stepCost =
        Math.hypot(dx, dy) * (1 + Math.abs(heights[idx(nx, ny)] - heights[current]) * 0.05);

      const tentative = (gScore.get(current) ?? Infinity) + stepCost;
      if (tentative < (gScore.get(nid) ?? Infinity)) {
        cameFrom.set(nid, current);
        gScore.set(nid, tentative);
        fScore.set(nid, tentative + heuristic(nx, ny));
        open.add(nid);
      }
    }
  }

  return null;
}

interface Edge {
  a: number;
  b: number;
  cost: number;
  points: Vec2[];
}

/**
 * Kruskal's algorithm to compute the Minimum Spanning Tree of our graph.
 */
function mst(edges: Edge[], nodes: number): Edge[] {
  edges.sort((u, v) => u.cost - v.cost);
  const parent = Array.from({ length: nodes }, (_, i) => i);

  const find = (i: number): number => {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (i: number, j: number): boolean => {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) return false;
    parent[ri] = rj;
    return true;
  };

  const out: Edge[] = [];
  for (const e of edges) {
    if (union(e.a, e.b)) {
      out.push(e);
    }
    if (out.length === nodes - 1) break;
  }
  return out;
}

/**
 * Computes roads connecting all town sites together.
 */
export function generateRoads(heights: number[], cols: number, rows: number, sites: Site[]): Road[] {
  const towns = sites.filter((s) => s.kind === 'town');
  if (towns.length < 2) return [];

  const edges: Edge[] = [];

  // Compute A* paths between all unique pairs of towns
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i];
      const b = towns[j];
      const path = aStar(
        heights,
        cols,
        rows,
        Math.floor(a.position.x),
        Math.floor(a.position.y),
        Math.floor(b.position.x),
        Math.floor(b.position.y),
      );
      if (path) {
        edges.push({ a: i, b: j, cost: path.cost, points: path.points });
      }
    }
  }

  // Generate the spanning tree to ensure full connectivity
  const tree = mst(edges, towns.length);

  // Add 20% extra short paths for more organic loops/cycles
  const extras = Math.floor(tree.length * 0.2);
  const treeSet = new Set(tree);
  const candidates = edges.filter((e) => !treeSet.has(e)).slice(0, extras);

  let id = 0;
  const out: Road[] = [];
  for (const e of [...tree, ...candidates]) {
    out.push({
      id: `road${id++}`,
      points: e.points,
      type: 'major',
      fromSiteId: towns[e.a].id,
      toSiteId: towns[e.b].id,
    });
  }

  return out;
}
