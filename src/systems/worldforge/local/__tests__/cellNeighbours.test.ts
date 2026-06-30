import { getBridgeAtlas, getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { cellNeighbourInDirection, worldPosToCell } from '../cellNeighbours';

const SEED = 12345;
const atlas = getBridgeAtlas(SEED);
const cells = atlas.pack.cells as unknown as { c: number[][]; p: ReadonlyArray<readonly [number, number]>; h: ArrayLike<number> };
// A guaranteed land cell with neighbours: the first town's burg seat cell.
const cell = (atlas.pack.burgs as Array<{ cell?: number }>)[getTownTilesForGrid(SEED, 96, 96)[0].burgId].cell!;

describe('cellNeighbours (Stage 5 seamless edges — S5.1)', () => {
  it('worldPosToCell maps a cell\'s own site back to that cell (Voronoi membership)', () => {
    const [x, y] = cells.p[cell];
    expect(worldPosToCell(atlas, x, y)).toBe(cell);
  });

  it('cellNeighbourInDirection returns an actual land Voronoi neighbour, aimed at one', () => {
    // Aim the query at a REAL land neighbour's bearing (a given cardinal may be
    // sea for a coastal cell, which correctly returns null — so don't assume one).
    const landNbs = cells.c[cell].filter((n) => cells.h[n] >= 20);
    expect(landNbs.length).toBeGreaterThan(0);
    const [cx, cy] = cells.p[cell];
    const [tx, ty] = cells.p[landNbs[0]];
    const nb = cellNeighbourInDirection(atlas, cell, tx - cx, ty - cy);
    expect(nb).not.toBeNull();
    expect(cells.c[cell]).toContain(nb);
  });

  it('the chosen neighbour lies in the requested direction (positive alignment)', () => {
    const [cx, cy] = cells.p[cell];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nb = cellNeighbourInDirection(atlas, cell, dx, dy);
      if (nb == null) continue; // a coastal cell may have no land neighbour one way
      const [nx, ny] = cells.p[nb];
      // dot product of the neighbour offset with the requested direction is positive
      expect((nx - cx) * dx + (ny - cy) * dy).toBeGreaterThan(0);
    }
  });

  it('returns only LAND neighbours (h >= 20)', () => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nb = cellNeighbourInDirection(atlas, cell, dx, dy);
      if (nb != null) expect(cells.h[nb]).toBeGreaterThanOrEqual(20);
    }
  });
});
