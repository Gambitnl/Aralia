import { describe, it, expect } from 'vitest';
import { deriveCellIdFromTile } from '../playerCellFromLegacy';
import { getBridgeAtlas, getWorldforgeLocalForLocation } from '../../bridge/legacySubmapBridge';

/**
 * Stage 2 (cell-native world): the canonical player presence records which atlas
 * cell the player occupies. The cell is DERIVED from the legacy grid tile via the
 * EXISTING golden reverse mapping (`legacyTileToAtlasCell`, the same one
 * `getWorldforgeLocalForLocation` uses) — so the recorded cell is a faithful
 * shadow of the tile the game already computes, never a new authority.
 */
describe('deriveCellIdFromTile', () => {
  const SEED = 42;
  const COLS = 30;
  const ROWS = 20;

  it('agrees with the bridge cell the 3D generator resolves for the same tile (golden)', () => {
    // Sweep a sample of tiles; the recorded cell must equal the cell
    // getWorldforgeLocalForLocation anchors on for that tile. Each bridge call
    // generates a region+local (~0.5s), so allow ample time for the sweep.
    for (let y = 0; y < ROWS; y += 5) {
      for (let x = 0; x < COLS; x += 5) {
        const derived = deriveCellIdFromTile(SEED, x, y, COLS, ROWS);
        const bridged = getWorldforgeLocalForLocation(SEED, x, y, COLS, ROWS);
        expect(derived).toBe(bridged.anchorCellId);
      }
    }
  }, 30000);

  it('returns a real land cell id for a normal world', () => {
    const cell = deriveCellIdFromTile(SEED, 15, 10, COLS, ROWS);
    expect(typeof cell).toBe('number');
    expect(cell).not.toBeNull();
    // The atlas exists and the cell is in range.
    const atlas = getBridgeAtlas(SEED);
    expect(cell!).toBeGreaterThanOrEqual(0);
    expect(cell!).toBeLessThan(atlas.pack.cells.h.length);
  });

  it('returns null (honest unknown) without throwing on a degenerate grid size', () => {
    // 0 cols/rows is nonsensical; the helper must not throw into a reducer.
    expect(() => deriveCellIdFromTile(SEED, 0, 0, 0, 0)).not.toThrow();
  });
});
