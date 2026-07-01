import { describe, it, expect } from 'vitest';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { snapToLandCell, entry3DAnchorForCell } from '../../local/gridAtlasBridge';

/**
 * Stage 4 (cell-native world): atlas fast-travel as the world loop. A Travel-mode
 * pick must carry the EXACT destination cell + its 3D-entry anchor through the trip
 * commit so arrival lands that cell. Grid retirement closed the old lossy tile
 * round-trip entirely — there is no grid frame to reverse-derive a cell from now,
 * so the destination cell is simply carried intact.
 *
 * The reducer behaviour (resetting Locale feet + stamping the anchor) is covered in
 * `src/state/__tests__/stage4AtlasTravelArrival.test.ts`. This suite proves the
 * MapPane-side `destinationCell` construction against a REAL atlas: the same
 * `snapToLandCell` + `entry3DAnchorForCell` helpers `handleWorldforgePick` calls.
 */
describe('Stage 4 — atlas-travel destinationCell construction', () => {
  const SEED = 42;

  it('a burg cell pick yields a destinationCell carrying that EXACT cell + a town-framing anchor', () => {
    const atlas = getBridgeAtlas(SEED);
    // Find a settled (burg) cell — that is the interesting "arrive in the town" case.
    const burgCellId = (() => {
      const burgArr = (atlas.pack.cells as { burg?: ArrayLike<number> }).burg;
      if (!burgArr) return -1;
      for (let i = 0; i < burgArr.length; i++) if ((burgArr[i] ?? 0) > 0) return i;
      return -1;
    })();
    expect(burgCellId).toBeGreaterThanOrEqual(0);

    // This is exactly what MapPane.handleWorldforgePick now builds for the trip.
    const destinationCell = {
      cellId: snapToLandCell(atlas, burgCellId),
      anchor: entry3DAnchorForCell(atlas, burgCellId),
    };

    // A burg cell is land, so the destination cell IS the picked cell — carried intact.
    expect(destinationCell.cellId).toBe(burgCellId);
    // The anchor frames the town (burg-centered ⇒ a centerPx override).
    expect(destinationCell.anchor.centerPx).toBeDefined();
  });

  it('land-snapping a land cell is a fixed point — the destination cell is carried intact', () => {
    const atlas = getBridgeAtlas(SEED);
    // Cell-native arrival always recovers the destination cell exactly: a land
    // cell land-snaps to itself, so no lossy grid round-trip can displace it.
    const h = atlas.pack.cells.h;
    for (let i = 0; i < h.length; i += 37) {
      if ((h[i] ?? 0) < 20) continue; // land only
      const dest = snapToLandCell(atlas, i);
      expect(dest).toBe(i);
    }
  }, 30000);
});
