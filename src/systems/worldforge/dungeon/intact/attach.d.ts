/**
 * @file intact/attach.ts
 * @description Spine / corridor growth — direction resolution, the directed
 * `attachRoom`/`attachRoomAtSpineCell` placers (with the VERBATIM 8-neighborhood
 * no-touch validation), spine/channel runs, spine growth, and anchor resolution.
 * Extracted VERBATIM from buildIntact.ts (packet W1-P6). Move-only: every body is
 * byte-identical to the original, so the seeded draw order inside each placement
 * attempt is unchanged. `attachRoom`/`attachSpine` were already public (re-exported
 * by `../buildIntact`); `resolveDir`/`attachRoomAtSpineCell`/`findByPurpose`/
 * `growSpine`/`findSpineOrigin` were file-internal and are exported here so the
 * builder + repeat modules can import them.
 */
import { type IntactState, type Room, type SpineCell } from './primitives';
import type { Rng } from './rng';
import { type RoomPurpose } from '../types';
import { type RoomSpec } from '../archetypes';
/** Resolve a spec's `dir` token against the plan's flow axis. */
export declare function resolveDir(st: IntactState, rng: Rng, token: RoomSpec['dir']): readonly [number, number];
/**
 * Directed attach: the old `tryAttach` with (a) direction, size and shape from
 * `spec` instead of centroid-biased random; (b) corridor length from
 * `spec.corridor`; (c) the SAME 8-neighborhood no-touch validation VERBATIM
 * (this is what preserves the approved walls-between-rooms look); (d) on success
 * sets `purpose` and records the tree edge src→new. Retries up to 8 times with a
 * re-rolled room size and door position before giving up on the spec.
 *
 * Returns the placed Room, or null if no valid placement was found.
 */
export declare function attachRoom(st: IntactState, rng: Rng, src: Room, spec: RoomSpec, dir: readonly [number, number], 
/** When given, the corridor cell indices carved on the SUCCESSFUL placement are
 * pushed here — the waterworks path uses this to mark cistern-connector cells
 * (the channels) as built-wet. */
corridorOut?: number[]): Room | null;
/**
 * Hang a room off a spine/channel corridor cell `(sx, sy)` in direction (dx, dy).
 * The corridor's first cell may hug the spine (roomOf -2); the recorded edge
 * points at `spineOriginId` so the spine belongs graph-wise to its origin room.
 */
export declare function attachRoomAtSpineCell(st: IntactState, rng: Rng, sx: number, sy: number, dx: number, dy: number, spec: RoomSpec, purpose: RoomPurpose, spineOriginId: number): Room | null;
/**
 * A spine (mausoleum) or channel-centerline (waterworks) is a straight corridor
 * run stamped like ordinary corridor cells (roomOf = -2). It anchors to `src`
 * and returns the list of stamped cells so galleries can hang off evenly spaced
 * points. Graph-wise the spine belongs to its origin room, mirroring how the old
 * code treats corridors as edges — so a gallery hung on the spine records its
 * edge against `src`, not against a phantom spine node.
 *
 * Returns the stamped cells (empty if it could not be placed without touching).
 */
export declare function attachSpine(st: IntactState, src: Room, len: number, dir: readonly [number, number]): SpineCell[];
/** First placed room of a given purpose (core anchors resolve against this). */
export declare function findByPurpose(st: IntactState, purpose: RoomPurpose): Room | undefined;
/**
 * Grow the mausoleum spine when a trunk's gallery anchors run out. Unlike the old
 * "continue the flow axis" growth (which produced the one-dimensional worm Remy
 * rejected), this BRANCHES a fresh perpendicular wing off the far end first,
 * ALTERNATING left/right so the skeleton fans out two-dimensionally like real
 * catacomb wings (DEFECT 1). Continuing the trunk axis is kept only as a last
 * resort when both perpendicular turns are boxed against the grid.
 *
 * The turn side alternates deterministically off the number of bends already in
 * the spine (no extra mutable state, so determinism holds). Each new run is
 * capped at SPINE_SEGMENT_CELLS so no single straight run dominates the plan.
 *
 * Appends the new cells (tagged with the new segment's local dir) to `spineCells`
 * in place and returns true if it grew.
 */
export declare function growSpine(st: IntactState, spineCells: SpineCell[]): boolean;
/**
 * The spine belongs to its origin room. We recover that origin as the room
 * whose exit face the spine started from — in practice the room carrying the
 * `carveSpineAfter` purpose (chapel / junction). Falls back to the entrance.
 */
export declare function findSpineOrigin(st: IntactState): number;
