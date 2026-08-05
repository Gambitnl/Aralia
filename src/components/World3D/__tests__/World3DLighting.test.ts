/**
 * This file protects the performance boundary between walking-scale and aerial
 * World3D shadows.
 *
 * The near shadow map is always available in ground mode. The much wider
 * second map should activate only when the camera rises far enough to show a
 * whole town, because running both maps near the ground needlessly replays
 * every shadow caster and can make the opening scene unplayable.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_TIME_OF_DAY_H,
  FAR_SHADOW_ENABLE_HEIGHT_M,
  shouldUseFarShadow,
  sunFromTime,
} from '../World3DLighting';

/**
 * Ground vertex colour of the savanna control window (`?dcell=1558`), sampled
 * from the live scene. Green-dominant by a clear margin, which is the whole
 * point: it is the thing the key light must not invert.
 */
const GRASSLAND_ALBEDO = [0.5, 0.66, 0.36] as const;

/** Linear-space RGB the key light multiplies surface albedo by. */
const keyLinear = (hours: number) => {
  const c = new THREE.Color(sunFromTime(hours).sunColor);
  return [c.r, c.g, c.b] as const;
};

describe('World3D far-shadow height policy', () => {
  it('keeps the wide shadow pass off at walking and opening-camera heights', () => {
    expect(shouldUseFarShadow(3, 0)).toBe(false);
    expect(shouldUseFarShadow(46, 12)).toBe(false);
  });

  it('restores the wide shadow pass for a true town overview', () => {
    expect(shouldUseFarShadow(12 + FAR_SHADOW_ENABLE_HEIGHT_M, 12)).toBe(true);
    expect(shouldUseFarShadow(260, 12)).toBe(true);
  });

  it('uses height above the local ground instead of absolute world elevation', () => {
    expect(shouldUseFarShadow(530, 500)).toBe(false);
    expect(shouldUseFarShadow(600, 500)).toBe(true);
  });
});

/**
 * Amber sunlight is a multiply, not a tint, so a key that is warm enough can
 * drive green terrain past brown and into red-dominant. That is what shipped:
 * the warmth ramp was linear in sun elevation, so at the default hour — a sun
 * still 24° up — the key sat at linear (1.00, 0.58, 0.32) and grassland
 * rendered 105,76,59 on screen. Red led green on grass. These tests pin the
 * shape of the ramp so a future warmth tweak cannot quietly re-invert it.
 */
describe('World3D sun warmth ramp', () => {
  it('leaves grassland green-dominant at the default hour', () => {
    const [kr, kg, kb] = keyLinear(DEFAULT_TIME_OF_DAY_H);
    const lit = [kr * GRASSLAND_ALBEDO[0], kg * GRASSLAND_ALBEDO[1], kb * GRASSLAND_ALBEDO[2]];
    expect(lit[1]).toBeGreaterThan(lit[0]);
  });

  it('keeps the afternoon key close to neutral instead of amber', () => {
    // The broken ramp was already down to 0.82 by 15h and 0.58 by the 18.2h
    // default. Under ~0.7 the key starts pulling green terrain toward brown.
    expect(keyLinear(15)[1]).toBeGreaterThan(0.85);
    expect(keyLinear(DEFAULT_TIME_OF_DAY_H)[1]).toBeGreaterThan(0.7);
  });

  it('still burns amber at true dusk — golden hour is wanted, not a bug', () => {
    const [, dg, db] = keyLinear(20);
    expect(dg).toBeLessThan(0.45);
    expect(db).toBeLessThan(0.2);
  });

  it('warms monotonically as the sun drops', () => {
    // Never strictly, because SunState carries the colour as a hex int: around
    // noon the cubed ramp is small enough that neighbouring hours quantize to
    // the same 8-bit value. Non-increasing is the real invariant.
    const greens = [12, 15, 17, 18.2, 19, 20].map((h) => keyLinear(h)[1]);
    for (let i = 1; i < greens.length; i += 1) {
      expect(greens[i]).toBeLessThanOrEqual(greens[i - 1]);
    }
    expect(greens[greens.length - 1]).toBeLessThan(greens[0]);
  });
});
