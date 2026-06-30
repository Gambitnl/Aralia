import { getBridgeAtlas, getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { wfBiomeIndexToLegacyId } from '../wfBiomeToLegacy';
import { biomeIdForCell } from '../biomeForCell';

const SEED = 12345;
const atlas = getBridgeAtlas(SEED);
// A guaranteed LAND cell: the first town's burg seat cell.
const burgCell = (atlas.pack.burgs as Array<{ cell?: number }>)[getTownTilesForGrid(SEED, 96, 96)[0].burgId].cell!;

describe('biomeIdForCell (cell-native biome reader — grid retirement Phase A2)', () => {
  it('golden: returns the cell\'s own atlas biome, translated to the legacy vocabulary', () => {
    const cellBiomeIndex = (atlas.pack.cells as unknown as { biome: ArrayLike<number> }).biome[burgCell];
    expect(biomeIdForCell(SEED, burgCell)).toBe(wfBiomeIndexToLegacyId(cellBiomeIndex));
  });

  it('resolves a real legacy biome id for a land cell (not undefined)', () => {
    const biome = biomeIdForCell(SEED, burgCell);
    expect(typeof biome).toBe('string');
    expect(biome).toBeTruthy();
  });
});
