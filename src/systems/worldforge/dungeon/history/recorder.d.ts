/**
 * @file history/recorder.ts
 * @description Mutation recording (prefix-replay substrate) + the room-cell cache
 * helpers — extracted VERBATIM from simulateHistory.ts (packet W1-P6). Every
 * applier routes its concrete state changes through these, so each change is both
 * applied AND pushed as a replayable redo-thunk onto `ctx.rec`. Move-only: bodies
 * are byte-identical, and none of these draw rng, so the recording order is
 * unchanged. Exported for the appliers.
 */
import type { SimCtx } from './context';
import { type Room } from '../buildIntact';
import { CellKind, OverlayKind, type DoorState, type DungeonEdge } from '../types';
/** Write a grid/corridor/roomOf cell to concrete values, recording the write. */
export declare function recWriteCell(ctx: SimCtx, cell: number, grid: CellKind, corridor: number, roomOf: number): void;
/** Stamp an overlay cell, recording it. */
export declare function recOverlay(ctx: SimCtx, cell: number, kind: OverlayKind): void;
/** Set a door state, recording it. */
export declare function recDoorState(ctx: SimCtx, cell: number, state: DoorState, eventRef: number): void;
/** Push an evidence prop, recording it. */
export declare function recProp(ctx: SimCtx, prop: {
    kind: string;
    cell: number;
    eventRef: number;
    roomId: number;
}): void;
/** Push an occupation row, recording it. */
export declare function recOccupation(ctx: SimCtx, occ: {
    roomIds: number[];
    actorKey: string;
    eventRef: number;
    isApex: boolean;
}): void;
/** Mark a room plundered, recording it. */
export declare function recPlunder(ctx: SimCtx, roomId: number): void;
/** Add a loop edge to the graph, recording it. */
export declare function recAddEdge(ctx: SimCtx, edge: DungeonEdge): void;
/** Remove a specific edge object from the graph, recording it. Replay removes the
 * SAME edge object identity (edges added in this run are re-pushed on replay, so
 * identity holds; built-in edges persist through the snapshot restore). */
export declare function recRemoveEdge(ctx: SimCtx, edge: DungeonEdge): void;
/**
 * All floor cells that belong to each room's footprint, indexed by roomId, built
 * from ONE full grid scan and cached on `ctx`. Replaces the former per-call
 * O(side²) scan (once per applier room), the single biggest sim cost on the large
 * mausoleum grid. Room floor cells never change owner during the sim, so the cache
 * stays valid; corridor cells (roomOf -2) are intentionally excluded.
 */
export declare function roomCellsCached(ctx: SimCtx, roomId: number): number[];
/** A representative interior cell (room center, walked in to a real floor cell). */
export declare function roomCenterCell(ctx: SimCtx, r: Room): number;
