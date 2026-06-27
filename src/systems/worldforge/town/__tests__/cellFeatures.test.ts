import { describe, it, expect } from 'vitest';
import {
  burgCellPolygon,
  cellWaterPolylines,
  cellWaterFeatures,
  cellRoadPolylines,
} from '../cellFeatures';

/**
 * Synthetic atlas fixtures — a single burg (id 1) seated in a square cell 10
 * whose corners are vertices 0..3 at (0,0),(100,0),(100,100),(0,100). The four
 * boundary edges' neighbour cells are 20 (bottom), 21 (right), 22 (top), 23
 * (left); heights decide which are water. This lets us assert the cell-feature
 * extraction in atlas-pixel space without generating a full FMG world.
 */
const SQUARE_V = { p: [[0, 0], [100, 0], [100, 100], [0, 100]] };
const SQUARE_VC = {
  // cells meeting at each corner vertex (this cell + the two edge neighbours).
  c: [
    [10, 20, 23], // v0 — bottom/left corner
    [10, 20, 21], // v1 — bottom/right corner
    [10, 21, 22], // v2 — top/right corner
    [10, 22, 23], // v3 — top/left corner
  ],
};

/** height[cellId]; land ≥ 20, water < 20. Indexed sparsely by cell id. */
function heights(water: number[] = []): number[] {
  const h: number[] = [];
  for (let i = 0; i <= 23; i++) h[i] = 30; // default land
  for (const c of water) h[c] = 5;
  return h;
}

function baseAtlas(over: {
  harbor?: number;
  waterNeighbours?: number[];
  rivers?: any[];
  routes?: any[];
} = {}): any {
  return {
    pack: {
      burgs: [undefined, { i: 1, cell: 10, population: 2 }],
      cells: {
        v: { 10: [0, 1, 2, 3] },
        p: { 10: [50, 50], 30: [50, -40], 40: [50, 140] },
        h: heights(over.waterNeighbours ?? []),
        harbor: { 10: over.harbor ?? 0 },
      },
      vertices: { p: SQUARE_V.p, c: SQUARE_VC.c },
      rivers: over.rivers ?? [],
      routes: over.routes ?? [],
    },
  };
}

describe('burgCellPolygon', () => {
  it('returns the burg cell ring in atlas-pixel coords', () => {
    expect(burgCellPolygon(baseAtlas(), 1)).toEqual([
      [0, 0], [100, 0], [100, 100], [0, 100],
    ]);
  });
});

describe('cellWaterPolylines — coast', () => {
  it('returns the water-facing boundary edge for a coastal cell', () => {
    // bottom edge neighbour (cell 20) is water; harbor>0 marks the cell coastal.
    const water = cellWaterPolylines(baseAtlas({ harbor: 2, waterNeighbours: [20] }), 1);
    expect(water).toEqual([[[0, 0], [100, 0]]]);
  });

  it('returns nothing when the cell is inland (no harbor, no rivers)', () => {
    expect(cellWaterPolylines(baseAtlas(), 1)).toEqual([]);
  });

  it('does not emit coast edges when harbor is 0 even if a neighbour is water', () => {
    expect(cellWaterPolylines(baseAtlas({ harbor: 0, waterNeighbours: [20] }), 1)).toEqual([]);
  });
});

describe('cellWaterPolylines — rivers', () => {
  it('synthesises a crossing segment from the river cell sequence', () => {
    // river flows 30 → 10 → 40 (vertical through the cell centre).
    const water = cellWaterPolylines(baseAtlas({ rivers: [{ cells: [30, 10, 40] }] }), 1);
    expect(water).toEqual([[[50, -40 / 2 + 25], [50, 50], [50, 95]]]);
  });

  it('half-segment when the cell is the river source or mouth (only one neighbour)', () => {
    const water = cellWaterPolylines(baseAtlas({ rivers: [{ cells: [10, 40] }] }), 1);
    expect(water).toEqual([[[50, 50], [50, 95]]]);
  });

  it('ignores rivers that do not pass through the cell', () => {
    expect(cellWaterPolylines(baseAtlas({ rivers: [{ cells: [30, 40] }] }), 1)).toEqual([]);
  });
});

describe('cellWaterFeatures — typed river/coast split', () => {
  it('routes the river crossing to .rivers and the coast edge to .coast', () => {
    const feats = cellWaterFeatures(
      baseAtlas({ harbor: 2, waterNeighbours: [20], rivers: [{ cells: [30, 10, 40] }] }),
      1,
    );
    expect(feats.rivers).toEqual([[[50, 5], [50, 50], [50, 95]]]);
    expect(feats.coast).toEqual([[[0, 0], [100, 0]]]);
  });

  it('cellWaterPolylines is the concatenation of rivers then coast', () => {
    const atlas = baseAtlas({ harbor: 2, waterNeighbours: [20], rivers: [{ cells: [30, 10, 40] }] });
    const feats = cellWaterFeatures(atlas, 1);
    expect(cellWaterPolylines(atlas, 1)).toEqual([...feats.rivers, ...feats.coast]);
  });
});

describe('cellRoadPolylines', () => {
  it('clips a road route to the cell polygon', () => {
    const roads = cellRoadPolylines(
      baseAtlas({ routes: [{ group: 'roads', points: [[-20, 50], [120, 50]] }] }),
      1,
    );
    expect(roads.length).toBe(1);
    expect(roads[0][0][0]).toBeCloseTo(0, 6);
    expect(roads[0][0][1]).toBeCloseTo(50, 6);
    expect(roads[0][roads[0].length - 1][0]).toBeCloseTo(100, 6);
    expect(roads[0][roads[0].length - 1][1]).toBeCloseTo(50, 6);
  });

  it('includes trails but excludes searoutes', () => {
    const roads = cellRoadPolylines(
      baseAtlas({ routes: [{ group: 'searoutes', points: [[-20, 30], [120, 30]] }] }),
      1,
    );
    expect(roads).toEqual([]);
    const trails = cellRoadPolylines(
      baseAtlas({ routes: [{ group: 'trails', points: [[-20, 70], [120, 70]] }] }),
      1,
    );
    expect(trails.length).toBe(1);
  });

  it('returns nothing for a route that misses the cell', () => {
    const roads = cellRoadPolylines(
      baseAtlas({ routes: [{ group: 'roads', points: [[-20, 200], [120, 200]] }] }),
      1,
    );
    expect(roads).toEqual([]);
  });
});
