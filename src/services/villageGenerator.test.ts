import { describe, it, expect } from 'vitest';
import { findBuildingAt, VillageLayout, VillageBuildingFootprint, VillageTileType , VillagePersonality } from './villageGenerator';

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
});

describe('findBuildingAt', () => {
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

  it('should return undefined for an empty tile', () => {
    const layout = createMockLayout([buildingA]);
    const result = findBuildingAt(layout, 0, 0);
    expect(result).toBeUndefined();
  });

  it('should find a building', () => {
    const layout = createMockLayout([buildingA]);

    const result = findBuildingAt(layout, 2, 2);
    expect(result).toBe(buildingA);
  });

  it('should return the building with higher priority when buildings overlap', () => {
    const layout = createMockLayout([buildingA, buildingB_higherPriority]);
    const result = findBuildingAt(layout, 3, 3);
    expect(result).toBe(buildingB_higherPriority);
  });

  it('should return the correct building when only one building occupies a tile', () => {
    const layout = createMockLayout([buildingA, buildingB_higherPriority]);
    const result = findBuildingAt(layout, 2, 2);
    expect(result).toBe(buildingA);
  });
});
