import { describe, it, expect } from 'vitest';
import { sceneHitToTileMeters } from '../groundClickMove';

/**
 * The coordinate conversion is the one spot where a sign error would silently
 * teleport the player, so it is pinned here (the R3F pick plane that feeds it
 * isn't jsdom-testable). Convention: add the scene origin (sceneToWorld), then
 * clamp to the loaded tile.
 */
describe('sceneHitToTileMeters', () => {
  it('adds the scene origin (matches the camera-walk / combat-pick convention)', () => {
    const { xM, zM } = sceneHitToTileMeters(10, -5, { x: 100, z: 200 }, 0, 0);
    expect(xM).toBe(110);
    expect(zM).toBe(195);
  });

  it('is identity when the scene origin is zero (ground mode)', () => {
    const { xM, zM } = sceneHitToTileMeters(42, 17, { x: 0, z: 0 }, 0, 0);
    expect(xM).toBe(42);
    expect(zM).toBe(17);
  });

  it('clamps a hit past the tile edge back onto the loaded surface', () => {
    // extent 300x300, origin 0: a click at 999 clamps to 300, a click at -50 to 0.
    expect(sceneHitToTileMeters(999, -50, { x: 0, z: 0 }, 300, 300)).toEqual({ xM: 300, zM: 0 });
  });

  it('keeps an in-bounds hit unchanged under clamping', () => {
    expect(sceneHitToTileMeters(120, 80, { x: 0, z: 0 }, 300, 300)).toEqual({ xM: 120, zM: 80 });
  });

  it('leaves coordinates unclamped when extents are non-positive (unknown tile size)', () => {
    expect(sceneHitToTileMeters(-40, 500, { x: 0, z: 0 }, 0, -1)).toEqual({ xM: -40, zM: 500 });
  });
});
