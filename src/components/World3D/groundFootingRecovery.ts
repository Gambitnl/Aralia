/** GG-537 load step: seat saved feet that lost their support.
 *
 * A save stores the exact feet. When a later generator or water rule moves the
 * ground, a deck or the water under them, the stored height can hang in the
 * air or sit under deep water, and the walking solver refuses every step
 * ("Your footing is unavailable"). Remy's ruling (2026-10-31): move the body
 * on load to a place it can stand, and say so.
 *
 * What is preserved: this runs only for feet the solver already refuses, and
 * only on load. Walking, supported saves and the per-frame refusal are not
 * changed, and a body is never moved here because a seat is merely nearby.
 * The seat must pass the same standing check as the legacy save inspection
 * (`standingSeatReasons`): full footprint, no deck or rail through the body,
 * no unverified building interior, and water the body can wade.
 *
 * Search order: first the supports at or below the stored point, then
 * rings outward to SEAT_SEARCH_RADIUS_M. The first ring with an admissible
 * seat wins, and inside a ring the seat nearest the stored feet wins. Points
 * whose full-detail chunk has not mounted are skipped, never guessed. If no
 * seat exists, the result is null and the honest refusal stays. */

import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { groundSurfaceYM } from './terrain/groundSurfaceYM';
import type { GroundWalkSurfaces } from './groundBuildingMotion';
import { standingSeatReasons, type PlacementBodyProfile } from './groundPlacementInspection';

type Feet = { xM: number; zM: number; yM: number };
export interface FootingSeat extends Feet {
  kind: 'terrain' | 'deck';
  /** Straight-line distance from the stored feet to the seat. */
  movedM: number;
}

/** Far enough to leave a river channel or step off a lost bridge span; near
 * enough that the seat is still the place the save describes. */
export const SEAT_SEARCH_RADIUS_M = 24;
const RING_STEP_M = 0.5;

export function findSeatForUnsupportedFeet(
  ground: GroundWorld, feet: Feet, body: PlacementBodyProfile, surfaces: GroundWalkSurfaces,
): FootingSeat | null {
  if (![feet.xM, feet.zM, feet.yM].every(Number.isFinite) || !surfaces.supportReadyAt) return null;
  for (let ring = 0; ring * RING_STEP_M <= SEAT_SEARCH_RADIUS_M + 1e-9; ring++) {
    const r = ring * RING_STEP_M;
    const count = ring === 0 ? 1 : Math.ceil((2 * Math.PI * r) / RING_STEP_M);
    let best: FootingSeat | null = null;
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * 2 * Math.PI;
      const xM = feet.xM + r * Math.cos(angle), zM = feet.zM + r * Math.sin(angle);
      if (!surfaces.supportReadyAt(xM, zM)) continue;
      const proposed = [
        { kind: 'terrain' as const, yM: groundSurfaceYM(ground, xM, zM) },
        ...surfaces.surfaceHeightsAt(xM, zM).map((yM) => ({ kind: 'deck' as const, yM })),
      ];
      for (const { kind, yM } of proposed) {
        if (!Number.isFinite(yM)) continue;
        // Directly under the stored point, the body settles DOWN onto a support
        // (with the walking solver's 0.22 m step). It is never lifted onto a
        // deck overhead just because the deck shares the stored X and Z.
        if (ring === 0 && yM > feet.yM + 0.22) continue;
        const point = { xM, zM, yM };
        if (standingSeatReasons(ground, kind, point, body, surfaces).length > 0) continue;
        const movedM = Math.hypot(xM - feet.xM, yM - feet.yM, zM - feet.zM);
        if (!best || movedM < best.movedM) best = { ...point, kind, movedM };
      }
    }
    if (best) return best;
  }
  return null;
}

/** The notice the player reads after the load step. It names who moved, how
 * far and onto what, so the move is a stated event and not a silent fix. */
export function footingSeatNotice(seat: FootingSeat, name: string | null): string {
  const onto = seat.kind === 'deck' ? 'the nearest deck' : 'the nearest ground';
  const who = name ? `${name} was` : 'You were';
  return `The ground or water here changed since this save. ${who} moved ${seat.movedM.toFixed(1)} m to ${onto} to stand.`;
}
