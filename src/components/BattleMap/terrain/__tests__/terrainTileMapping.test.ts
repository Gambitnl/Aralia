import { describe, expect, it } from 'vitest';
import { resolveTerrainTileCoordinates } from '../terrainTileMapping';

/**
 * These tests lock the raycast-to-tile conversion down without rendering the
 * full battle map. That keeps the interaction fix narrow and makes the edge
 * behavior easy to reason about when the terrain mesh changes later.
 */

describe('resolveTerrainTileCoordinates', () => {
  it('clamps a boundary hit back into the last valid tile', () => {
    const result = resolveTerrainTileCoordinates(
      { x: 4.00001, z: 2.99999 },
      { width: 4, height: 3 },
    );

    expect(result).toEqual({ x: 3, y: 2 });
  });

  it('uses terrain height when choosing between neighboring steep-slope tiles', () => {
    const result = resolveTerrainTileCoordinates(
      { x: 0.49, y: 3.0, z: 0.5 },
      { width: 3, height: 1 },
      {
        sampleHeight: (tileX) => (tileX > 1 ? 3.0 : 0.0),
      },
    );

    expect(result).toEqual({ x: 1, y: 0 });
  });

  it('falls back to projected tile flooring when no hit height is available', () => {
    const result = resolveTerrainTileCoordinates(
      { x: 0.49, z: 0.5 },
      { width: 3, height: 1 },
      {
        sampleHeight: (tileX) => (tileX > 1 ? 3.0 : 0.0),
      },
    );

    expect(result).toEqual({ x: 0, y: 0 });
  });
});
