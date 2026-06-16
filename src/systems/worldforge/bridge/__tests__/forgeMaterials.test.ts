import { describe, it, expect } from 'vitest';
import { getSemanticAssetKey } from '../forgeMaterials';

describe('forgeMaterials', () => {
  it('maps wall surfaces deterministically based on role and biome', () => {
    expect(getSemanticAssetKey({ surface: 'wall', role: 'market', biome: 'temperate' })).toBe('texture/wall/plaster/amber/temperate');
    expect(getSemanticAssetKey({ surface: 'wall', role: 'dungeon', biome: 'arid' })).toBe('texture/wall/stone/dark/arid');
    expect(getSemanticAssetKey({ surface: 'wall', role: 'house', biome: 'boreal' })).toBe('texture/wall/plaster/weathered/boreal');
    expect(getSemanticAssetKey({ surface: 'wall' })).toBe('texture/wall/plaster/weathered/temperate');
  });

  it('maps roof surfaces deterministically', () => {
    expect(getSemanticAssetKey({ surface: 'roof', role: 'market' })).toBe('texture/roof/tile/clay/temperate');
    expect(getSemanticAssetKey({ surface: 'roof', role: 'dungeon' })).toBe('texture/roof/stone/flat/temperate');
    expect(getSemanticAssetKey({ surface: 'roof', role: 'house' })).toBe('texture/roof/thatch/worn/temperate');
  });

  it('maps ground surfaces deterministically', () => {
    expect(getSemanticAssetKey({ surface: 'ground' })).toBe('texture/ground/grass/wild/temperate');
    expect(getSemanticAssetKey({ surface: 'ground', biome: 'desert' })).toBe('texture/ground/grass/wild/desert');
  });
});
