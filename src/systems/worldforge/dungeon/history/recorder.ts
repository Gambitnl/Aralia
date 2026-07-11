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
import { gi, roomCx, roomCy, type Room } from '../buildIntact';
import { CellKind, OverlayKind, type DoorState, type DungeonEdge } from '../types';

// ─── Mutation recording (prefix-replay substrate) ────────────────────────────
//
// Every applier routes its concrete state changes through these helpers instead
// of touching `ctx.st`/`ctx` collections directly. Each helper does the mutation
// AND pushes an identical redo-thunk onto `ctx.rec`, so the exact same change can
// be re-applied later against a restored snapshot with no rng and no re-decision.
// The recorded values are literal (cell indices, kinds, edge objects) — replay is
// a byte-for-byte re-do of the canonical pass's prefix.

/** Write a grid/corridor/roomOf cell to concrete values, recording the write. */
export function recWriteCell(
  ctx: SimCtx,
  cell: number,
  grid: CellKind,
  corridor: number,
  roomOf: number,
): void {
  const st = ctx.st;
  const op = () => {
    st.grid[cell] = grid;
    st.corridor[cell] = corridor;
    st.roomOf[cell] = roomOf;
  };
  op();
  ctx.rec.push(op);
}

/** Stamp an overlay cell, recording it. */
export function recOverlay(ctx: SimCtx, cell: number, kind: OverlayKind): void {
  const op = () => { ctx.overlay[cell] = kind; };
  op();
  ctx.rec.push(op);
}

/** Set a door state, recording it. */
export function recDoorState(ctx: SimCtx, cell: number, state: DoorState, eventRef: number): void {
  const op = () => { ctx.doorStates.set(cell, { state, eventRef }); };
  op();
  ctx.rec.push(op);
}

/** Push an evidence prop, recording it. */
export function recProp(
  ctx: SimCtx,
  prop: { kind: string; cell: number; eventRef: number; roomId: number },
): void {
  const op = () => { ctx.evidenceProps.push(prop); };
  op();
  ctx.rec.push(op);
}

/** Push an occupation row, recording it. */
export function recOccupation(
  ctx: SimCtx,
  occ: { roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean },
): void {
  const op = () => { ctx.occupations.push(occ); };
  op();
  ctx.rec.push(op);
}

/** Mark a room plundered, recording it. */
export function recPlunder(ctx: SimCtx, roomId: number): void {
  const op = () => { ctx.plunderedRoomIds.add(roomId); };
  op();
  ctx.rec.push(op);
}

/** Add a loop edge to the graph, recording it. */
export function recAddEdge(ctx: SimCtx, edge: DungeonEdge): void {
  const st = ctx.st;
  const op = () => { st.edges.push(edge); };
  op();
  ctx.rec.push(op);
}

/** Remove a specific edge object from the graph, recording it. Replay removes the
 * SAME edge object identity (edges added in this run are re-pushed on replay, so
 * identity holds; built-in edges persist through the snapshot restore). */
export function recRemoveEdge(ctx: SimCtx, edge: DungeonEdge): void {
  const st = ctx.st;
  const op = () => {
    const ix = st.edges.indexOf(edge);
    if (ix >= 0) st.edges.splice(ix, 1);
  };
  op();
  ctx.rec.push(op);
}

/**
 * All floor cells that belong to each room's footprint, indexed by roomId, built
 * from ONE full grid scan and cached on `ctx`. Replaces the former per-call
 * O(side²) scan (once per applier room), the single biggest sim cost on the large
 * mausoleum grid. Room floor cells never change owner during the sim, so the cache
 * stays valid; corridor cells (roomOf -2) are intentionally excluded.
 */
export function roomCellsCached(ctx: SimCtx, roomId: number): number[] {
  let cache = ctx.roomCellCache;
  if (!cache) {
    cache = new Map<number, number[]>();
    const roomOf = ctx.st.roomOf;
    for (let i = 0; i < roomOf.length; i++) {
      const rid = roomOf[i];
      if (rid < 0) continue; // void (-1) or corridor (-2)
      let arr = cache.get(rid);
      if (!arr) { arr = []; cache.set(rid, arr); }
      arr.push(i);
    }
    ctx.roomCellCache = cache;
  }
  return cache.get(roomId) ?? [];
}

/** A representative interior cell (room center, walked in to a real floor cell). */
export function roomCenterCell(ctx: SimCtx, r: Room): number {
  const st = ctx.st;
  const cx = roomCx(r);
  const cy = roomCy(r);
  const k = gi(cx, cy, st.side);
  if (st.roomOf[k] === r.id) return k;
  // Center can fall on a mask hole (octagon/ellipse); scan for any floor cell.
  const cells = roomCellsCached(ctx, r.id);
  return cells.length > 0 ? cells[0] : k;
}
