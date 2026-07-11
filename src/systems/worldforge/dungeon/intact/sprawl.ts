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
import type { RoomShape } from '../types';
import { type RoomSpec } from '../archetypes';

// ─── Sprawl interpolation ────────────────────────────────────────────────────

/** Long-corridor band at full sprawl (cells) — the Gozzys "rooms float apart". */
const SPRAWL_CORRIDOR = { lo: 4, hi: 12 } as const;

/**
 * Effective corridor length for an attach at the plan's sprawl level.
 * Interpolates from the spec's own tight range (sprawl 0) toward a long run
 * 4-12 cells (sprawl 1). A shared-wall spec (corridor [0,0]) stays a door at
 * low sprawl but is lifted OFF the wall as sprawl rises so suites break apart.
 */
export function sprawlCorLen(st: IntactState, rng: Rng, range: readonly [number, number]): number {
  const s = st.sprawl;
  const tight = rng.int(range[0], range[1]);
  if (s <= 0) return tight;
  const longRun = rng.int(SPRAWL_CORRIDOR.lo, SPRAWL_CORRIDOR.hi);
  // A shared-wall door (tight 0) still gets pulled out at high sprawl.
  return Math.round(tight * (1 - s) + longRun * s);
}

/**
 * Whether an attach corridor of this length should bend a seeded elbow at the
 * given sprawl. Only long runs (≥ 4 cells) elbow, and only as sprawl climbs, so
 * the corridor network reads as bending galleries rather than straight spokes.
 */
export function sprawlElbow(st: IntactState, rng: Rng, corLen: number): boolean {
  if (st.sprawl < 0.4 || corLen < 4) return false;
  return rng.chance(st.sprawl * 0.7);
}

// ─── Gozzys blend (size contrast + focal shapes, at all sprawl levels) ────────

// ROOM-SIZE ×2 (Remy 2026-07-07): the Gozzys focal footprints scale with the
// rest so the size CONTRAST (huge hall vs closet) stays proportionally the same
// against the now-bigger baseline rooms.
/** An oversized hall — the "huge hall next to a closet" contrast. */
const GOZZYS_HALL = { w: [18, 24], h: [18, 24] } as const;
/** A tiny closet (still small, ~×1.4 the old closet — a real closet beside a hall). */
const GOZZYS_CLOSET = { w: [4, 6], h: [4, 6] } as const;

/**
 * Occasionally override a repeat spec into a Gozzys focal room — an oversized
 * hall, a tiny closet, or an octagon/diamond focal chamber. Driven by a plain
 * ordinal (deterministic, no extra draws) so the cadence is spread across the
 * plan rather than clustered, and weighted SMALL so most rooms keep their spec.
 *
 * The 3-wide waterworks maintenance-walk (a channel-side corridor-room, h==3)
 * is left alone — turning it into a hall/closet would break the wet-channel read.
 */
export function gozzysBlend(spec: RoomSpec, ordinal: number): RoomSpec {
  // Skip corridor-like walks (fixed 3-cell height): those are channel spines.
  if (spec.h[0] === 3 && spec.h[1] === 3) return spec;
  // Cadence: hall every 11th, closet every 7th (offset), focal shape every 9th.
  // Halls are rarest (biggest footprint); order matters — hall wins ties.
  const isHall = ordinal % 11 === 5;
  const isCloset = !isHall && ordinal % 7 === 3;
  const isFocal = !isHall && !isCloset && ordinal % 9 === 4;
  if (isHall) return { ...spec, w: GOZZYS_HALL.w, h: GOZZYS_HALL.h, shape: 'octagon' };
  if (isCloset) return { ...spec, w: GOZZYS_CLOSET.w, h: GOZZYS_CLOSET.h, shape: 'rect' };
  if (isFocal) {
    const shape: RoomShape = ordinal % 18 === 4 ? 'diamond' : 'octagon';
    // Focal rooms want a squarish mid-large footprint so the shape reads (×2 size).
    return { ...spec, w: [11, 15], h: [11, 15], shape };
  }
  return spec;
}
