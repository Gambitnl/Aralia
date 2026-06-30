import { describe, expect, it } from 'vitest';
import { MaterialTagService } from '../MaterialTagService';
import { createMockGameState } from '@/utils/core/factories';
import type { MapData, MapTile } from '@/types';

/**
 * These tests protect the material wording sent into AI spell arbitration.
 *
 * AI-assisted spells need to know the difference between verified local tile
 * facts and broad biome guesses. If those are blurred together, a spell such as
 * Meld into Stone or a material-sensitive utility effect can be approved or
 * denied for the wrong reason.
 */

const makeWorldTile = (overrides: Partial<MapTile>): MapTile => ({
  x: 0,
  y: 0,
  biomeId: 'forest',
  discovered: true,
  isPlayerCurrent: false,
  ...overrides
});

const makeMapData = (tile: MapTile): MapData => ({
  gridSize: { rows: 1, cols: 1 },
  tiles: [[tile]]
});

describe('MaterialTagService', () => {
  it('labels generated submap material as verified local context', () => {
    const gameState = createMockGameState({
      worldSeed: 12345,
      currentLocationId: 'forest_clearing',
      mapData: makeMapData(makeWorldTile({
        biomeId: 'forest',
        isPlayerCurrent: true
      }))
    });

    const description = MaterialTagService.describeNearbyMaterials({ x: 0, y: 0 }, gameState);

    expect(description).toContain('Verified local material context');
    expect(description).toContain('Materials present here');
    expect(description).not.toContain('fallback only');
    expect(description).not.toContain('not confirmed at the target point');
  });

  it('keeps biome fallback wording explicitly uncertain when no local tile exists', () => {
    const gameState = createMockGameState({
      currentLocationId: 'forest_clearing',
      mapData: null
    });

    const description = MaterialTagService.describeNearbyMaterials({ x: 4, y: 4 }, gameState);

    expect(description).toContain('Inferred biome fallback only');
    expect(description).toContain('no verified local tile material is available');
    expect(description).toContain('Possible materials nearby, not confirmed at the target point');
    expect(description).not.toContain('Materials present here');
  });

  it('does not downgrade mixed concrete terrain to uncertain fallback language', () => {
    const gameState = createMockGameState({
      worldSeed: 98765,
      currentLocationId: 'village_square',
      mapData: makeMapData(makeWorldTile({
        biomeId: 'village',
        isPlayerCurrent: true
      }))
    });

    const description = MaterialTagService.describeNearbyMaterials({ x: 1, y: 1 }, gameState);

    expect(description).toContain('Verified local material context');
    expect(description).toContain('Materials present here');
    expect(description).not.toContain('Possible materials nearby');
    expect(description).not.toContain('not confirmed at the target point');
  });
});
