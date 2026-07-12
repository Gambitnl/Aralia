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
import {
  FAR_SHADOW_ENABLE_HEIGHT_M,
  shouldUseFarShadow,
} from '../World3DLighting';

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
