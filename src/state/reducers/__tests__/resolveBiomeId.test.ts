import { resolveBiomeId } from '../worldReducer';
import { createMockGameState } from '../../../utils/core/factories';
import { LOCATIONS, STARTING_LOCATION_ID } from '../../../data/world/locations';
import { getBridgeAtlas, getTownTilesForGrid } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { biomeIdForCell } from '../../../systems/worldforge/local/biomeForCell';

const SEED = 12345;
const burgCell = (getBridgeAtlas(SEED).pack.burgs as Array<{ cell?: number }>)[
  getTownTilesForGrid(SEED, 96, 96)[0].burgId
].cell!;

describe('resolveBiomeId — cell-native biome (grid retirement Phase A2)', () => {
  it('prefers the canonical cell\'s biome over the coord_X_Y grid tile', () => {
    const state = createMockGameState({
      worldSeed: SEED,
      currentLocationId: 'coord_5_5', // a coord tile (non-static) → would hit the grid path
      playerCell: { cellId: burgCell, localeCoords: null },
      mapData: null, // prove the cell path doesn't depend on mapData/tiles at all
    });
    expect(resolveBiomeId(state)).toBe(biomeIdForCell(SEED, burgCell));
  });

  it('still honours a hand-authored static location biome over the cell', () => {
    const staticBiome = LOCATIONS[STARTING_LOCATION_ID].biomeId;
    const state = createMockGameState({
      worldSeed: SEED,
      currentLocationId: STARTING_LOCATION_ID,
      playerCell: { cellId: burgCell, localeCoords: null },
    });
    expect(resolveBiomeId(state)).toBe(staticBiome);
  });

  it('returns the neutral default when no cell is recorded (Stage 6: no grid fallback)', () => {
    // With the grid retired there is no coord_X_Y → mapData.tiles lookup; a state
    // with no canonical cell and no static location resolves to the plains default.
    const state = createMockGameState({
      worldSeed: SEED,
      currentLocationId: 'coord_1_1',
      playerCell: null,
      mapData: null,
    });
    expect(resolveBiomeId(state)).toBe('plains');
  });
});
