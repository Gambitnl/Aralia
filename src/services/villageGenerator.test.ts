import { describe, it, expect, vi } from 'vitest';
import { findBuildingAtWithCache, VillageLayout, VillageBuildingFootprint, VillageTileType } from './villageGenerator';
import { VillagePersonality } from '../services/villageGenerator';
import { VillageIntegrationProfile } from '../data/villagePersonalityProfiles';

const mockPersonality: VillagePersonality = {
  wealth: 'comfortable',
  culture: 'stoic',
  biomeStyle: 'temperate',
  population: 'medium',
};

const mockIntegrationProfile: VillageIntegrationProfile = {
  id: 'stoic_comfortable_temperate',
  tagline: 'A mock village.',
  aiPrompt: 'A mock prompt.',
  culturalSignature: 'Mock signature.',
  encounterHooks: [],
};

const createMockLayout = (buildings: VillageBuildingFootprint[]): VillageLayout => ({
  width: 10,
  height: 10,
  tiles: [],
  buildings,
  personality: mockPersonality,
  integrationProfile: mockIntegrationProfile,
  buildingCache: new Map<string, VillageBuildingFootprint | undefined>(),
});

describe('findBuildingAtWithCache', () => {
  const buildingA: VillageBuildingFootprint = {
    id: 'house',
    type: 'house_small',
    footprint: { x: 2, y: 2, width: 3, height: 3 },
    color: 'red',
    accent: 'darkred',
  };

  const buildingB_higherPriority: VillageBuildingFootprint = {
    id: 'market',
    type: 'market', // Higher priority than house_small
    footprint: { x: 3, y: 3, width: 3, height: 3 },
    color: 'blue',
    accent: 'darkblue',
  };

  it('should return undefined and cache the result for an empty tile', () => {
    const layout = createMockLayout([buildingA]);
    const result = findBuildingAtWithCache(layout, 0, 0);
    expect(result).toBeUndefined();
    expect(layout.buildingCache.has('0,0')).toBe(true);
    expect(layout.buildingCache.get('0,0')).toBeUndefined();
  });

  it('should find a building, cache it on miss, and return it on hit', () => {
    const layout = createMockLayout([buildingA]);

    // Spy on the reduce method to check if it's called
    const reduceSpy = vi.spyOn(layout.buildings, 'reduce');

    // First call (cache miss)
    const result1 = findBuildingAtWithCache(layout, 2, 2);
    expect(result1).toBe(buildingA);
    expect(layout.buildingCache.has('2,2')).toBe(true);
    expect(layout.buildingCache.get('2,2')).toBe(buildingA);
    expect(reduceSpy).toHaveBeenCalledTimes(1);

    // Second call (cache hit)
    const result2 = findBuildingAtWithCache(layout, 2, 2);
    expect(result2).toBe(buildingA);
    // Reduce should not be called again for a cache hit
    expect(reduceSpy).toHaveBeenCalledTimes(1);
    reduceSpy.mockRestore();
  });

  it('should return the building with higher priority when buildings overlap', () => {
    const layout = createMockLayout([buildingA, buildingB_higherPriority]);
    const result = findBuildingAtWithCache(layout, 3, 3);
    expect(result).toBe(buildingB_higherPriority);
    expect(layout.buildingCache.get('3,3')).toBe(buildingB_higherPriority);
  });

  it('should return the correct building when only one building occupies a tile', () => {
    const layout = createMockLayout([buildingA, buildingB_higherPriority]);
    const result = findBuildingAtWithCache(layout, 2, 2);
    expect(result).toBe(buildingA);
    expect(layout.buildingCache.get('2,2')).toBe(buildingA);
  });
});
