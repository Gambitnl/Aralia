import { describe, expect, it } from 'vitest';
import { MaterialTagService } from '../MaterialTagService';
import { createMockGameState } from '@/utils/core/factories';
import { getBridgeAtlas } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { BATTLE_MAP_DIMENSIONS } from '@/config/mapConfig';

/**
 * These tests protect the material wording sent into AI spell arbitration.
 *
 * AI-assisted spells need to know the difference between verified local tile
 * facts and broad biome guesses. If those are blurred together, a spell such as
 * Meld into Stone or a material-sensitive utility effect can be approved or
 * denied for the wrong reason.
 *
 * Grid retirement (slice 4b): the verified path samples the cell-native
 * LocalTerrain from (worldSeed, playerCell.cellId) — so the verified-path test
 * anchors on a real land cell from the real atlas, not a mock grid tile.
 */

const WORLD_SEED = 12345;

/** First land cell (FMG h >= 20) of the real atlas for WORLD_SEED. */
function findLandCell(): number {
  const atlas = getBridgeAtlas(WORLD_SEED);
  const cells = atlas.pack.cells as unknown as { h: ArrayLike<number>; i: ArrayLike<number> };
  for (let id = 0; id < cells.i.length; id++) {
    if (cells.h[id] >= 20) return id;
  }
  throw new Error('atlas has no land cell');
}

const mapCenter = {
  x: Math.floor(BATTLE_MAP_DIMENSIONS.width / 2),
  y: Math.floor(BATTLE_MAP_DIMENSIONS.height / 2),
};

describe('MaterialTagService', () => {
  it('labels cell-native local material as verified local context', () => {
    const gameState = createMockGameState({
      worldSeed: WORLD_SEED,
      playerCell: { cellId: findLandCell(), localeCoords: null },
    });

    const description = MaterialTagService.describeNearbyMaterials(mapCenter, gameState);

    expect(description).toContain('Verified local material context');
    expect(description).toContain('Materials present here');
    expect(description).not.toContain('fallback only');
    expect(description).not.toContain('not confirmed at the target point');
  });

  it('keeps biome fallback wording explicitly uncertain when no player cell exists', () => {
    const gameState = createMockGameState({
      playerCell: null,
      currentLocationId: 'forest_clearing',
    });

    const description = MaterialTagService.describeNearbyMaterials(mapCenter, gameState);

    expect(description).toContain('Inferred biome fallback only');
    expect(description).toContain('no verified local tile material is available');
    expect(description).toContain('Possible materials nearby, not confirmed at the target point');
    expect(description).not.toContain('Materials present here');
  });

  it('reads cold and jungle biomes with fitting materials, not the grassy default', () => {
    const tundra = MaterialTagService.describeNearbyMaterials(mapCenter, createMockGameState({
      playerCell: null,
      currentLocationId: 'tundra_flats',
    }));
    expect(tundra).toContain('Frozen Earth');
    expect(tundra).not.toContain('Wood');

    const jungle = MaterialTagService.describeNearbyMaterials(mapCenter, createMockGameState({
      playerCell: null,
      currentLocationId: 'jungle_deep',
    }));
    expect(jungle).toContain('Vines');
    expect(jungle).not.toContain('Grass');
  });
});
