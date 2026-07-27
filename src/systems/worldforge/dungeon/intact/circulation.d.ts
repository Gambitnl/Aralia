/**
 * @file intact/circulation.ts
 * @description Built circulation (DEFECT A) + dead-end trim — extracted VERBATIM
 * from buildIntact.ts (packet W1-P6). `addBuiltLoops` opens the BUILT cross-cut
 * doors that keep the intact structure from ever being a pure tree; the private
 * `loopWallStrands`/`carveFallbackCrossCuts` back it; `trimDanglingCorridors`
 * peels corridor runs that terminate in the void. Move-only: bodies are
 * byte-identical, so the single `rng.int` jitter draw in `addBuiltLoops` fires in
 * the same place. `addBuiltLoops`/`trimDanglingCorridors` were already public
 * (re-exported by `../buildIntact`).
 */
import { type IntactState } from './primitives';
import type { Rng } from './rng';
import { type BuilderArchetype } from '../types';
/**
 * Open BUILT loop doors between DIFFERENT rooms sitting 1-2 wall cells apart in a
 * straight line — reusing the old growth generator's adjacency-scan idea. One
 * candidate per room pair (the middle one in scan order); carve the gap cells as
 * corridor floor (roomOf -2) and add a cycle edge (`isLoop:true`, `dug` UNSET —
 * these are clean built doors, not hand-cut robber tunnels).
 *
 * Density: the archetype's LOOP_BAND scaled by `loopChance / 0.25`, so a caller
 * dialing loopChance up/down moves the count proportionally. At loopChance 0 we
 * still open ≥ 1 cross-cut — the intact structure is NEVER a pure tree (the old
 * anti-goal). Candidates are selected evenly-strided across the (deterministic)
 * scan-ordered list so the loops spread spatially rather than clumping.
 *
 * The entrance is NEVER an endpoint (same rule as event tunnels) — keeping the
 * entrance at graph degree 1. The gap-carve is exempt from the 8-neighborhood
 * no-touch guard exactly as the old addLoops was: it opens a 1-2 cell hole
 * between two ALREADY-placed rooms, adding a doorway, not fusing rooms.
 */
export declare function addBuiltLoops(st: IntactState, rng: Rng, archetype: BuilderArchetype, loopChance: number): void;
/**
 * Remove dead-end corridor cells — the honest formulation of "no corridor may
 * terminate without a room" (DEFECT 2, and it also clips any over-long channel
 * stub, DEFECT 3). A corridor cell (roomOf === -2) is a DEAD END when it is a
 * leaf on the floor graph: it has at most one 4-neighbor that is itself another
 * corridor cell, and NONE of its 4-neighbors is a room-floor cell (roomOf >= 0).
 * A cell 4-adjacent to a room floor is a DOORWAY and is always kept — that is the
 * "serves a doorway" anchor. Pruning iterates to a fixed point, so a whole
 * dangling run peels back cell-by-cell to the last cell that reaches a room, and
 * junction cells (≥ 2 corridor neighbors) are never removed.
 *
 * Only carved cells are touched (grid Floor→Void, corridor→0, roomOf→-1); room
 * floors and the 8-neighborhood no-touch guarantee are left completely intact.
 */
export declare function trimDanglingCorridors(st: IntactState): void;
