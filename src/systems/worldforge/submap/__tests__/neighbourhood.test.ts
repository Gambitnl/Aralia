import { describe, it, expect } from 'vitest';
import { buildAtlasNeighbourhood } from '../neighbourhood';
import { polygonBounds, polygonCentroid, EDGE_BLEND_START } from '../submapEngine';
import { rootSeedPath } from '../../seedPath';

// Minimal atlas stub: 3 cells. Focus = 0 (square 0..10), neighbours 1 (10..20 x)
// and 2 (10..20 y), each a unit square so the cluster spans a clear area.
const atlas = {
  biomesData: { name: ['Marine', 'Forest', 'Hills', 'Plains'] },
  pack: {
    vertices: {
      p: [
        [0, 0], [10, 0], [10, 10], [0, 10],
        [10, 0], [20, 0], [20, 10], [10, 10],
        [0, 10], [10, 10], [10, 20], [0, 20],
      ],
    },
    cells: {
      v: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
      c: [[1, 2], [0], [0]],
      biome: [1, 2, 3],
      burg: [0, 0, 0],
      p: [[5, 5], [15, 5], [5, 15]],
      h: [50, 50, 50],
    },
    burgs: [],
    rivers: [],
    routes: [],
  },
} as any;

describe('buildAtlasNeighbourhood', () => {
  it('returns the focus + its atlas neighbours', () => {
    const n = buildAtlasNeighbourhood(atlas, 0, () => false, rootSeedPath(7), { submapCount: 30 });
    expect(n.focusCellId).toBe(0);
    expect(n.cells.map((c) => c.cellId).sort()).toEqual([0, 1, 2]);
    const focus = n.cells.find((c) => c.isFocus)!;
    expect(focus.cellId).toBe(0);
    expect(focus.biome).toBe('Forest'); // biome index 1
  });

  it('focus is always explored with a submap; unexplored neighbours are grey (no model)', () => {
    const n = buildAtlasNeighbourhood(atlas, 0, (id) => id === 1, rootSeedPath(7), { submapCount: 30 });
    const focus = n.cells.find((c) => c.cellId === 0)!;
    const explored = n.cells.find((c) => c.cellId === 1)!;
    const grey = n.cells.find((c) => c.cellId === 2)!;
    expect(focus.explored).toBe(true);
    expect(focus.model).toBeTruthy();
    expect(explored.explored).toBe(true);
    expect(explored.model).toBeTruthy();
    expect(grey.explored).toBe(false);
    expect(grey.model).toBeUndefined();
    expect(grey.biome).toBe('Plains'); // grey still carries basic info
  });

  it('scales the cluster to roughly the canonical span', () => {
    const n = buildAtlasNeighbourhood(atlas, 0, () => true, rootSeedPath(7), { submapCount: 20, canonSpan: 1000 });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of n.cells) {
      const b = polygonBounds(c.polygon);
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    expect(Math.max(maxX - minX, maxY - minY)).toBeCloseTo(1000, 0);
  });

  /**
   * W16-D. The stub's biome names ('Forest', 'Hills', 'Plains') have no variant
   * palette, so WITHOUT the edge blend every focus sub-cell would be 'Forest'.
   * Any other name therefore proves the neighbour biomes reached the generator.
   * Cell 1 ('Hills') sits due EAST of the focus; cell 2 ('Plains') due NORTH.
   */
  describe('gradual biome transitions toward the atlas neighbours', () => {
    const build = () => buildAtlasNeighbourhood(atlas, 0, () => true, rootSeedPath(11), { submapCount: 400 });

    it('the focus submap grows a band of each neighbour biome on the side facing it', () => {
      const focus = build().cells.find((c) => c.isFocus)!;
      const b = polygonBounds(focus.polygon);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const cells = focus.model!.cells;

      const hills = cells.filter((c) => c.biome === 'Hills');
      const plains = cells.filter((c) => c.biome === 'Plains');
      expect(hills.length).toBeGreaterThan(5);
      expect(plains.length).toBeGreaterThan(5);
      // Nothing but Forest and its two neighbours can appear.
      expect(new Set(cells.map((c) => c.biome))).toEqual(new Set(['Forest', 'Hills', 'Plains']));
      // Forest still dominates — this is a band, not a repaint.
      expect(cells.filter((c) => c.biome === 'Forest').length).toBeGreaterThan(cells.length * 0.5);

      // Each band sits on its own side, past the halfway threshold.
      for (const c of hills) expect(polygonCentroid(c.polygon)[0] - cx).toBeGreaterThan((b.maxX - cx) * EDGE_BLEND_START);
      for (const c of plains) expect(polygonCentroid(c.polygon)[1] - cy).toBeGreaterThan((b.maxY - cy) * EDGE_BLEND_START);
    });

    it('the blend is stable across rebuilds', () => {
      const a = build().cells.find((c) => c.isFocus)!.model!.cells.map((c) => c.biome);
      const b = build().cells.find((c) => c.isFocus)!.model!.cells.map((c) => c.biome);
      expect(a).toEqual(b);
    });
  });

  it('is deterministic for a given seed-path', () => {
    const a = buildAtlasNeighbourhood(atlas, 0, () => true, rootSeedPath(9), { submapCount: 25 });
    const b = buildAtlasNeighbourhood(atlas, 0, () => true, rootSeedPath(9), { submapCount: 25 });
    expect(a.cells.map((c) => c.polygon)).toEqual(b.cells.map((c) => c.polygon));
    expect(a.cells.map((c) => c.model?.cells.length)).toEqual(b.cells.map((c) => c.model?.cells.length));
  });
});
