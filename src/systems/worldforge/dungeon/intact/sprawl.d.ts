/**
 * @file intact/sprawl.ts
 * @description Sprawl interpolation + Gozzys blend — extracted VERBATIM from
 * buildIntact.ts (packet W1-P6). `sprawlCorLen`/`sprawlElbow` map the plan's
 * sprawl dial onto corridor length + elbow decisions; `gozzysBlend` occasionally
 * overrides a repeat spec into an oversized hall / tiny closet / focal shape.
 * Move-only: bodies are byte-identical to the originals, so each draw fires in the
 * same order. These were file-internal in the monolith; they are exported here so
 * the attach + repeat modules can import them (the public `buildIntact` surface is
 * unchanged — none of these are re-exported).
 */
import type { IntactState } from './primitives';
import type { Rng } from './rng';
import { type RoomSpec } from '../archetypes';
/**
 * Effective corridor length for an attach at the plan's sprawl level.
 * Interpolates from the spec's own tight range (sprawl 0) toward a long run
 * 4-12 cells (sprawl 1). A shared-wall spec (corridor [0,0]) stays a door at
 * low sprawl but is lifted OFF the wall as sprawl rises so suites break apart.
 */
export declare function sprawlCorLen(st: IntactState, rng: Rng, range: readonly [number, number]): number;
/**
 * Whether an attach corridor of this length should bend a seeded elbow at the
 * given sprawl. Only long runs (≥ 4 cells) elbow, and only as sprawl climbs, so
 * the corridor network reads as bending galleries rather than straight spokes.
 */
export declare function sprawlElbow(st: IntactState, rng: Rng, corLen: number): boolean;
/**
 * Occasionally override a repeat spec into a Gozzys focal room — an oversized
 * hall, a tiny closet, or an octagon/diamond focal chamber. Driven by a plain
 * ordinal (deterministic, no extra draws) so the cadence is spread across the
 * plan rather than clustered, and weighted SMALL so most rooms keep their spec.
 *
 * The 3-wide waterworks maintenance-walk (a channel-side corridor-room, h==3)
 * is left alone — turning it into a hall/closet would break the wet-channel read.
 */
export declare function gozzysBlend(spec: RoomSpec, ordinal: number): RoomSpec;
