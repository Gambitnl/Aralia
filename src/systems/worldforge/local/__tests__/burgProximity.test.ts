import { getBridgeAtlas, getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { nearBurgIdsForCell } from '../burgProximity';

const SEED = 12345;
const atlas = getBridgeAtlas(SEED);
const firstBurgId = getTownTilesForGrid(SEED, 96, 96)[0].burgId;
const burgCell = (atlas.pack.burgs as Array<{ cell?: number }>)[firstBurgId].cell!;

describe('nearBurgIdsForCell (cell-native town distance-LOD — grid retirement)', () => {
  it('includes the burg the player is standing on', () => {
    const near = nearBurgIdsForCell(SEED, burgCell, 800);
    expect(near).toContain(firstBurgId);
  });

  it('a tiny radius returns only the local burg(s); a huge radius returns more', () => {
    const tight = nearBurgIdsForCell(SEED, burgCell, 1);
    const wide = nearBurgIdsForCell(SEED, burgCell, 100000);
    expect(wide.length).toBeGreaterThan(tight.length);
    expect(tight).toContain(firstBurgId); // the player's own burg is always within radius 1 of itself
  });

  it('returns burg ids (positive, real burgs only)', () => {
    const near = nearBurgIdsForCell(SEED, burgCell, 800);
    for (const id of near) expect(id).toBeGreaterThan(0);
    expect(new Set(near).size).toBe(near.length); // no duplicates
  });
});
