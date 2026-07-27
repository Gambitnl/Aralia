/**
 * @file history/graph.ts
 * @description Graph helpers over the room edge set — extracted VERBATIM from
 * simulateHistory.ts (packet W1-P6). Pure functions of (nRooms, edges): no
 * `SimCtx`, no rng, so they are the natural leaf of the history modules. Move-only:
 * bodies are byte-identical. These were file-internal in the monolith; they are
 * exported here so the appliers + the main loop can share them.
 */
import { type DungeonEdge } from '../types';
/** Adjacency list over an edge set (undirected). */
export declare function buildAdjacency(nRooms: number, edges: readonly DungeonEdge[]): number[][];
/** BFS graph depth (in rooms) from `start`; unreachable rooms stay Infinity. */
export declare function graphDepths(nRooms: number, start: number, adj: number[][]): number[];
/** True when the room graph over `edges` connects every room to `start`. */
export declare function graphConnected(nRooms: number, start: number, edges: readonly DungeonEdge[]): boolean;
/** Rooms directly adjacent to the entrance (degree-1 protection helpers use it). */
export declare function neighborsOf(room: number, adj: number[][]): Set<number>;
