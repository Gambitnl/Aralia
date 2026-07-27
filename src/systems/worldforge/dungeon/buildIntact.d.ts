/**
 * @file buildIntact.ts
 * @description Purpose-driven INTACT layout generator — the heart of the
 * history-first dungeon rewrite. Pure data, zero THREE imports, deterministic.
 *
 * Where the old `grow()` grew rooms by random attachment (the "blob" look Remy
 * rejected), `buildIntact()` runs a BUILDER PROGRAM: it places the archetype's
 * `core` rooms once, each at the direction its RoomSpec asks for relative to the
 * plan's flow axis, then repeats `repeat` units until the room count. The result
 * reads as something a mason built for a purpose, not something that accreted.
 *
 * The four programs each produce one of the approved circulation shapes
 * (mocks .agent/scratch/dungeon-layout-mocks.html):
 *   - mausoleum : processional symmetry — stair→antechamber→chapel on one axis,
 *                 a SPINE corridor behind, burial galleries alternating off it.
 *   - mine      : diagonal vein descent — flowDir alternates [1,0]/[0,1] so the
 *                 gallery chain steps down-and-right; the sump lands deepest.
 *   - fortress  : gatehouse funnel → great-hall hub → service wings; repeat
 *                 passage-rooms hang off already-placed CORE rooms (spread).
 *   - waterworks: channel skeleton — 3-wide channel runs, cisterns at the ends,
 *                 everything meeting at the junction; channels/cisterns start wet.
 *
 * SUBSTRATE OWNERSHIP: the shared grid/room/mask primitives (`Rng`, `makeRng`,
 * `Room`, `gi`, `DIRS`, mask helpers, `stampRoom`, `roomCx`/`roomCy`) live HERE
 * and `generateDungeon.ts` imports them back, so nothing is duplicated.
 *
 * MODULE LAYOUT (packet W1-P6): this file is now a thin composition root. The
 * substrate and growth machinery were split, move-only (byte-identical bodies, so
 * the seeded call order is unchanged), into ./intact/*:
 *   - ./intact/rng          : the `Rng` wrapper + `makeRng`.
 *   - ./intact/primitives   : room/mask/grid substrate, spine tuning, stamp helpers.
 *   - ./intact/sprawl       : sprawl interpolation + Gozzys blend.
 *   - ./intact/attach       : direction resolution, directed attach, spine growth.
 *   - ./intact/circulation  : built loops (DEFECT A) + dead-end trim.
 *   - ./intact/repeats      : the repeat-unit placement loop.
 * All of those substrate names are RE-EXPORTED below so `./buildIntact` keeps its
 * original public surface (generateDungeon.ts / simulateHistory.ts / lore.ts / the
 * tests all import them from here).
 *
 * Determinism: every draw comes from the `Rng` wrapper over a seed path; the
 * wrapper's `int()` is INCLUSIVE (guarding SeededRandom.nextInt being max-
 * exclusive). Same path ⇒ byte-identical grid.
 */
import { type BuilderArchetype } from './types';
import { type Rng } from './intact/rng';
import { type IntactState } from './intact/primitives';
export { makeRng } from './intact/rng';
export type { Rng } from './intact/rng';
export { inMask, compoundMask, bakeMask, roomCx, roomCy, DIRS, SPINE_STRIDE, SPINE_PAIRS_PER_SEGMENT, SPINE_SEGMENT_CELLS, SPINE_LANE_GAP, gi, stampRoom, addRoomWater, } from './intact/primitives';
export type { Room, GridSurface, IntactState, SpineCell } from './intact/primitives';
export { attachRoom, attachSpine } from './intact/attach';
export { addBuiltLoops, trimDanglingCorridors } from './intact/circulation';
/**
 * Deterministic purpose-driven layout. Places the archetype's `core` rooms
 * once (deduplicated by purpose — the verbatim Task-3 test asserts exactly one
 * room per distinct core purpose), builds the archetype's spine/channels, then
 * cycles `repeat` specs until the room count. Returns null if < 70% of the
 * target rooms placed.
 */
export declare function buildIntact(rng: Rng, archetype: BuilderArchetype, roomCount: number, 
/** Loop-door density control (0..1). At 0 the builder still opens ≥1 cross-cut
 * (the "never a pure tree" anti-goal). Default keeps legacy 2-arg callers a
 * pure tree — the generator always passes the real value + `circRng`. */
loopChance?: number, 
/** Dedicated sub-stream for the circulation pass, so adding built-loop draws
 * never perturbs the build stream's determinism. */
circRng?: Rng, 
/** Layout dial (0 tight .. 1 sprawl). Legacy 2/3-arg callers default to 0
 * (fully tight — identical to the pre-sprawl builder). */
sprawl?: number): IntactState | null;
