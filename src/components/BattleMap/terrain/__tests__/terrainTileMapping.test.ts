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
});
