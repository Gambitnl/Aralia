/**
 * @file roads.ts
 * Generate a connected road graph between sites.
 *
 *  1. For each unordered pair of towns, run A* across the heightfield (water = impassable,
 *     steep slope = high cost).
 *  2. Build a minimum spanning tree over the pairwise distances → n-1 edges.
 *  3. Add up to 20% extra short edges for redundancy.
 */
import type { Road, Site, Vec2 } from './types';

const SEA_LEVEL = 20;

interface PathResult {
  cost: number;
  points: Vec2[];
}

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

  while (open.size) {
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
      const points: Vec2[] = [];
      let cur: number | undefined = current;
      while (cur !== undefined) {
        points.push({ x: (cur % cols) + 0.5, y: ((cur / cols) | 0) + 0.5 });
        cur = cameFrom.get(cur);
      }
      points.reverse();
      return { cost: gScore.get(current) ?? 0, points };
    }
    open.delete(current);
    for (const [dx, dy] of [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ] as Array<[number, number]>) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isPassable(nx, ny)) continue;
      const nid = idx(nx, ny);
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

function mst(edges: Edge[], nodes: number): Edge[] {
  edges.sort((u, v) => u.cost - v.cost);
  const parent = Array.from({ length: nodes }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number): boolean => {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) return false;
    parent[ri] = rj;
    return true;
  };
  const out: Edge[] = [];
  for (const e of edges) {
    if (union(e.a, e.b)) out.push(e);
    if (out.length === nodes - 1) break;
  }
  return out;
}

export function generateRoads(heights: number[], cols: number, rows: number, sites: Site[]): Road[] {
  const towns = sites.filter((s) => s.kind === 'town');
  if (towns.length < 2) return [];

  const edges: Edge[] = [];
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
      if (path) edges.push({ a: i, b: j, cost: path.cost, points: path.points });
    }
  }

  const tree = mst(edges, towns.length);

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
