/**
 * @file history/graph.ts
 * @description Graph helpers over the room edge set — extracted VERBATIM from
 * simulateHistory.ts (packet W1-P6). Pure functions of (nRooms, edges): no
 * `SimCtx`, no rng, so they are the natural leaf of the history modules. Move-only:
 * bodies are byte-identical. These were file-internal in the monolith; they are
 * exported here so the appliers + the main loop can share them.
 */

import { type DungeonEdge } from '../types';

// ─── Graph helpers ───────────────────────────────────────────────────────────

/** Adjacency list over an edge set (undirected). */
export function buildAdjacency(nRooms: number, edges: readonly DungeonEdge[]): number[][] {
  const adj: number[][] = Array.from({ length: nRooms }, () => []);
  for (const e of edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  return adj;
}

/** BFS graph depth (in rooms) from `start`; unreachable rooms stay Infinity. */
export function graphDepths(nRooms: number, start: number, adj: number[][]): number[] {
  const depth = new Array<number>(nRooms).fill(Infinity);
  depth[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const n of adj[c]) {
      if (depth[n] === Infinity) {
        depth[n] = depth[c] + 1;
        q.push(n);
      }
    }
  }
  return depth;
}

/** True when the room graph over `edges` connects every room to `start`. */
export function graphConnected(nRooms: number, start: number, edges: readonly DungeonEdge[]): boolean {
  const depth = graphDepths(nRooms, start, buildAdjacency(nRooms, edges));
  for (let i = 0; i < nRooms; i++) if (depth[i] === Infinity) return false;
  return true;
}

/** Rooms directly adjacent to the entrance (degree-1 protection helpers use it). */
export function neighborsOf(room: number, adj: number[][]): Set<number> {
  return new Set(adj[room]);
}
