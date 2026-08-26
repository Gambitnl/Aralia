/**
 * @file scarCauses.ts — the per-cause table the terrain sim heals against.
 *
 * CONTEXT.md: "The cause decides how the scar heals and what its mark looks
 * like afterward. Two scars of the same shape and different causes grow back
 * differently." This file IS that sentence, in numbers. Every heal rate and
 * every mark tint lives here so a designer changes one table instead of
 * hunting constants across the sim and the renderer.
 *
 * Numbers are first-pass and deliberately coarse. They are chosen so that a
 * player who returns after a season sees a difference, not so that they model
 * real soil mechanics:
 *   - a blast pit slumps quickly at first and is gone in a couple of months
 *   - a dug channel is a deliberate cut and stays for the better part of a year
 *   - a flood scour refills as soon as the water drops silt back into it
 *   - fire never digs, so it has no heal rate that matters (see types.ts)
 */
import type { ScarCause } from './types';

export interface ScarCauseProfile {
  /** Metres of depth lost per in-game day. */
  healMetersPerDay: number;
  /** Weathering (0..1) gained per in-game day once the mark exists. */
  weatheringPerDay: number;
  /**
   * Linear RGB tint the ground takes inside a fresh mark, 0..1 per channel.
   * A renderer multiplies the ground color by this, lerped toward white by
   * `weathering`, so an old mark is a hint and a new one is obvious.
   */
  markTint: readonly [number, number, number];
  /** Human-facing label for logs and tooltips. */
  label: string;
}

/**
 * A blast pit loses ~2.5 cm/day, so a 1 m crater is level ground in ~40 days.
 * A dug channel loses ~0.4 cm/day, so a 1 m trench is still readable a year on.
 */
export const SCAR_CAUSES: Record<ScarCause, ScarCauseProfile> = {
  fire: {
    // Fire digs nothing; this rate only applies if a caller insists on giving a
    // fire scar depth (a burned-out root ball, say). Kept non-zero so such a
    // scar can never become an immortal hole.
    healMetersPerDay: 0.05,
    weatheringPerDay: 1 / 120, // a burn reads as a burn for about four months
    markTint: [0.22, 0.19, 0.17], // char
    label: 'Scorched',
  },
  blast: {
    healMetersPerDay: 0.025,
    weatheringPerDay: 1 / 240,
    markTint: [0.55, 0.48, 0.4], // turned, dry soil
    label: 'Blasted',
  },
  excavation: {
    healMetersPerDay: 0.004,
    weatheringPerDay: 1 / 400,
    markTint: [0.6, 0.55, 0.45], // spoil and packed dirt
    label: 'Excavated',
  },
  flood: {
    healMetersPerDay: 0.06,
    weatheringPerDay: 1 / 90,
    markTint: [0.45, 0.47, 0.42], // silt
    label: 'Scoured',
  },
};

/** Default heal rate for a cause, in metres of depth per in-game day. */
export function healRateFor(cause: ScarCause): number {
  return SCAR_CAUSES[cause].healMetersPerDay;
}

/** Default weathering rate for a cause, in units of `weathering` per in-game day. */
export function weatheringRateFor(cause: ScarCause): number {
  return SCAR_CAUSES[cause].weatheringPerDay;
}
