
import { describe, it, expect } from 'vitest';
import { getTerrainMovementCost, getTerrainCover, terrainGrantsStealth, TERRAIN_RULES } from '../TerrainSystem';

describe('TerrainSystem', () => {
  it('returns standard movement cost for unknown terrain', () => {
    expect(getTerrainMovementCost('void_dimension')).toBe(1);
  });

  it('returns correct movement cost for difficult terrain', () => {
    expect(getTerrainMovementCost('dense_forest')).toBe(2);
    expect(getTerrainMovementCost('mud')).toBe(3);
  });

  it('returns correct cover type for terrain', () => {
    expect(getTerrainCover('grass')).toBe('none');
    expect(getTerrainCover('dense_forest')).toBe('half');
    expect(getTerrainCover('water')).toBe('three_quarters');
  });

  it('identifies stealth advantage correctly', () => {
    expect(terrainGrantsStealth('dense_forest')).toBe(true);
    expect(terrainGrantsStealth('road')).toBe(false);
  });

  it('verifies all registered rules have valid IDs', () => {
    Object.values(TERRAIN_RULES).forEach(rule => {
      expect(rule.movementCost).toBeGreaterThanOrEqual(1);
      expect(['none', 'half', 'three_quarters', 'total']).toContain(rule.cover);
    });
  });
});
