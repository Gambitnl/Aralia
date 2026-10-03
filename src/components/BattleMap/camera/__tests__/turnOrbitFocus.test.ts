/**
 * @file turnOrbitFocus.test.ts — pins the per-turn orbit refocus math (9A).
 *
 * Together with `useTurnManager.cameraFocus.test.ts` (which proves the turn
 * boundary publishes the request), these tests cover the acceptance claim:
 * the camera orbits to the active combatant over a 0.5s lerp, keeping the
 * framing the player set up.
 */
import { describe, expect, it } from 'vitest';
import {
  TURN_FOCUS_LERP_SECONDS,
  easeTurnOrbit,
  focusPointForTile,
  lerpOrbitPoint,
  orbitDestinationForFocus,
  turnOrbitProgress,
} from '../turnOrbitFocus';

describe('turn orbit timing', () => {
  it('completes in 0.5 seconds', () => {
    expect(TURN_FOCUS_LERP_SECONDS).toBe(0.5);
    expect(turnOrbitProgress(0)).toBe(0);
    expect(turnOrbitProgress(0.25)).toBeCloseTo(0.5, 6);
    expect(turnOrbitProgress(0.5)).toBe(1);
  });

  it('clamps a late frame to the destination rather than overshooting', () => {
    expect(turnOrbitProgress(5)).toBe(1);
    expect(easeTurnOrbit(5)).toBe(1);
    expect(easeTurnOrbit(-2)).toBe(0);
  });

  it('eases in and out, so the move never starts or ends with a jerk', () => {
    expect(easeTurnOrbit(0)).toBe(0);
    expect(easeTurnOrbit(1)).toBe(1);
    expect(easeTurnOrbit(0.5)).toBeCloseTo(0.5, 6);
    // First quarter covers less ground than the middle quarter: that is the ease-in.
    const firstQuarter = easeTurnOrbit(0.25) - easeTurnOrbit(0);
    const middleQuarter = easeTurnOrbit(0.5) - easeTurnOrbit(0.25);
    expect(firstQuarter).toBeLessThan(middleQuarter);
  });
});

describe('orbitDestinationForFocus', () => {
  it('carries the camera so distance and angles survive the refocus', () => {
    const cameraPosition = { x: 10, y: 12, z: 10 };
    const currentTarget = { x: 10, y: 0, z: 20 };
    const focus = { x: 30, y: 2, z: 5 };

    const destination = orbitDestinationForFocus(cameraPosition, currentTarget, focus);

    // The target→camera offset is identical before and after.
    expect(destination.x - focus.x).toBe(cameraPosition.x - currentTarget.x);
    expect(destination.y - focus.y).toBe(cameraPosition.y - currentTarget.y);
    expect(destination.z - focus.z).toBe(cameraPosition.z - currentTarget.z);

    const before = Math.hypot(
      cameraPosition.x - currentTarget.x,
      cameraPosition.y - currentTarget.y,
      cameraPosition.z - currentTarget.z,
    );
    const after = Math.hypot(
      destination.x - focus.x,
      destination.y - focus.y,
      destination.z - focus.z,
    );
    expect(after).toBeCloseTo(before, 10);
  });

  it('is a no-op when the focus is already the current target', () => {
    const cameraPosition = { x: 4, y: 9, z: 4 };
    const target = { x: 4, y: 0, z: 8 };
    expect(orbitDestinationForFocus(cameraPosition, target, target)).toEqual(cameraPosition);
  });
});

describe('orbit interpolation', () => {
  it('lands exactly on the destination at full progress', () => {
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 10, y: 4, z: -6 };
    expect(lerpOrbitPoint(start, end, easeTurnOrbit(turnOrbitProgress(TURN_FOCUS_LERP_SECONDS))))
      .toEqual(end);
  });

  it('is partway there at half the duration', () => {
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 10, y: 0, z: 0 };
    const mid = lerpOrbitPoint(start, end, easeTurnOrbit(turnOrbitProgress(0.25)));
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(10);
  });
});

describe('focusPointForTile', () => {
  it('centers on the tile, matching the actor tile math', () => {
    expect(focusPointForTile({ x: 4, y: 7 }, 1.5)).toEqual({ x: 4.5, y: 1.5, z: 7.5 });
  });
});
