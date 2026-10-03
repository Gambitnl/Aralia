import { describe, it, expect } from 'vitest';
import { findWaterRegions, waterRunsForRegion, waterLevelsByCell, waterRunsFromLevels, rasterizeChannel } from '../waterRegions';

/**
 * Build a grid from ASCII art. '~' is water, digits are land at that encoded
 * height. Rows are given top to bottom.
 */
const grid = (art: string[], waterHeight = 0) => {
  const rows = art.length;
  const cols = art[0].length;
  const biomeIds: string[] = [];
  const heights: number[] = [];
  for (const line of art) {
    for (const ch of line) {
      if (ch === '~') {
        biomeIds.push('water');
        heights.push(waterHeight);
      } else {
        biomeIds.push('grassland');
        heights.push(Number(ch));
      }
    }
  }
  return { cols, rows, biomeIds, heights, surfaceDropEnc: 0 };
};

describe('findWaterRegions', () => {
  it('finds one body and its cells', () => {
    const regions = findWaterRegions(grid([
      '333',
      '3~3',
      '333',
    ]));
    expect(regions).toHaveLength(1);
    expect(regions[0].cells).toEqual([4]);
  });

  it('gives two ponds at different elevations their own levels', () => {
    // The whole point of per-body levels: a hill pond and a valley pond cannot
    // share one surface height, which is what a single global sea level forced.
    const regions = findWaterRegions(grid([
      '9~9559',
      '99955~',
    ]));
    expect(regions).toHaveLength(2);
    const levels = regions.map((r) => r.surfaceEnc).sort((a, b) => a - b);
    expect(levels[0]).toBeLessThan(levels[1]);
    // High pond's rim is the 9s around it; the low one sits among 5s.
    expect(levels[1]).toBe(9);
    expect(levels[0]).toBe(5);
  });

  it('sets the surface at the LOWEST point of the rim, never the highest', () => {
    // Otherwise the water floods out over the low side of its own basin.
    const regions = findWaterRegions(grid([
      '999',
      '4~9',
      '999',
    ]));
    expect(regions[0].shoreEnc).toBe(4);
    expect(regions[0].surfaceEnc).toBe(4);
  });

  it('never puts the surface above the rim once a drop is applied', () => {
    const regions = findWaterRegions({ ...grid(['888', '8~8', '888']), surfaceDropEnc: 1.5 });
    expect(regions[0].surfaceEnc).toBe(6.5);
    expect(regions[0].surfaceEnc).toBeLessThan(regions[0].shoreEnc);
  });

  it('clamps the surface at zero rather than going negative', () => {
    const regions = findWaterRegions({ ...grid(['111', '1~1', '111']), surfaceDropEnc: 4 });
    expect(regions[0].surfaceEnc).toBe(0);
  });

  it('treats corner-touching water as separate bodies', () => {
    // 4-way connectivity: joining these would force one flat level across the
    // ridge that divides them.
    const regions = findWaterRegions(grid([
      '~9',
      '9~',
    ]));
    expect(regions).toHaveLength(2);
  });

  it('joins water that touches edge-on, across a long body', () => {
    const regions = findWaterRegions(grid([
      '9999',
      '~~~~',
      '9999',
    ]));
    expect(regions).toHaveLength(1);
    expect(regions[0].cells).toHaveLength(4);
  });

  it('counts ocean as water too', () => {
    const base = grid(['999', '9~9', '999']);
    base.biomeIds[4] = 'ocean';
    expect(findWaterRegions(base)).toHaveLength(1);
  });

  it('returns nothing for a dry grid', () => {
    expect(findWaterRegions(grid(['999', '999']))).toEqual([]);
  });

  it('falls back to its own height when a body has no shore at all', () => {
    // Water filling the entire grid has no rim to read.
    const all = grid(['~~', '~~'], 7);
    const regions = findWaterRegions(all);
    expect(regions).toHaveLength(1);
    expect(regions[0].shoreEnc).toBe(7);
  });

  it('is deterministic in cell order and region order', () => {
    const build = () => findWaterRegions(grid([
      '~9~9',
      '~9999',
    ].map((l) => l.padEnd(5, '9'))));
    const a = build();
    const b = build();
    expect(a.map((r) => r.cells)).toEqual(b.map((r) => r.cells));
    for (const r of a) {
      expect(r.cells).toEqual([...r.cells].sort((x, y) => x - y));
    }
  });
});

describe('waterRunsForRegion', () => {
  const region = (cells: number[], surfaceEnc = 5) => ({ cells, surfaceEnc, shoreEnc: surfaceEnc });

  it('merges a row of touching cells into one rectangle', () => {
    // 4 cols; row 0 fully wet.
    const runs = waterRunsForRegion(region([0, 1, 2, 3]), 4, 2);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ minX: 0, maxX: 8, minZ: 0, maxZ: 2 });
  });

  it('splits a row where the cells are not contiguous', () => {
    // cols 0,1 wet, col 2 dry, col 3 wet.
    const runs = waterRunsForRegion(region([0, 1, 3]), 4, 2);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ minX: 0, maxX: 4 });
    expect(runs[1]).toMatchObject({ minX: 6, maxX: 8 });
  });

  it('gives each row its own rectangle', () => {
    const runs = waterRunsForRegion(region([0, 1, 4, 5]), 4, 2);
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.minZ)).toEqual([0, 2]);
  });

  it('carries the body height onto every run', () => {
    const runs = waterRunsForRegion(region([0, 1, 4], 7.5), 4, 2);
    expect(runs.every((r) => r.surfaceEnc === 7.5)).toBe(true);
  });

  it('covers the same ground as the cells it came from', () => {
    // Area of the runs must equal cell count x cell area — no gaps, no overlap.
    const cells = [0, 1, 2, 5, 6, 9];
    const runs = waterRunsForRegion(region(cells), 4, 3);
    const area = runs.reduce((s, r) => s + (r.maxX - r.minX) * (r.maxZ - r.minZ), 0);
    expect(area).toBe(cells.length * 9);
  });

  it('is deterministic', () => {
    const build = () => waterRunsForRegion(region([9, 1, 0, 5, 4, 2]), 4, 2);
    expect(build()).toEqual(build());
  });
});

describe('waterLevelsByCell', () => {
  it('lets a river descend instead of pinning it to one flat level', () => {
    // A channel running left to right down a slope: banks 9, 7, 5, 3.
    // One flat level would put the whole river at the downstream height and
    // bury it under the upstream hillside — measured in-game as 13 m of rock.
    const levels = waterLevelsByCell(grid([
      '9753',
      '~~~~',
      '9753',
    ]));
    const at = (col: number) => levels.get(4 + col)!; // row 1
    expect(at(0)).toBeGreaterThan(at(1));
    expect(at(1)).toBeGreaterThan(at(2));
    expect(at(2)).toBeGreaterThan(at(3));
  });

  it('keeps a lake flat when its banks stand at one height', () => {
    const levels = waterLevelsByCell(grid([
      '8888',
      '8~~8',
      '8~~8',
      '8888',
    ]));
    const values = [...levels.values()];
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBe(8);
  });

  it('never puts water above the lowest bank of its own shore', () => {
    // A basin walled at 9 but open at 4 on one side: the water cannot stand
    // higher than the low side or it would pour out.
    const levels = waterLevelsByCell(grid([
      '999',
      '4~9',
      '999',
    ]));
    expect(levels.get(4)).toBe(4);
  });

  it('gives interior cells a level from their own shore', () => {
    const levels = waterLevelsByCell(grid([
      '66666',
      '6~~~6',
      '6~~~6',
      '66666',
    ]));
    // Every wet cell resolved, including the ones touching no land directly.
    expect(levels.size).toBe(6);
    for (const v of levels.values()) expect(v).toBe(6);
  });

  it('applies the drop below the bank', () => {
    const levels = waterLevelsByCell({ ...grid(['888', '8~8', '888']), surfaceDropEnc: 1.5 });
    expect(levels.get(4)).toBe(6.5);
  });

  it('returns nothing for a dry grid', () => {
    expect(waterLevelsByCell(grid(['999', '999'])).size).toBe(0);
  });
});

describe('waterRunsFromLevels', () => {
  it('merges neighbours that share a height', () => {
    const runs = waterRunsFromLevels(new Map([[0, 5], [1, 5], [2, 5]]), 4, 2);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ minX: 0, maxX: 6, surfaceEnc: 5 });
  });

  it('breaks a run where the height changes', () => {
    // A descending river must step down, not flatten — flattening is what
    // buried it under the hillside.
    const runs = waterRunsFromLevels(new Map([[0, 5], [1, 4], [2, 3]]), 4, 2);
    expect(runs).toHaveLength(3);
    expect(runs.map((r) => r.surfaceEnc)).toEqual([5, 4, 3]);
  });

  it('breaks a run where cells are not adjacent', () => {
    const runs = waterRunsFromLevels(new Map([[0, 5], [1, 5], [3, 5]]), 4, 2);
    expect(runs).toHaveLength(2);
  });

  it('keeps rows apart', () => {
    const runs = waterRunsFromLevels(new Map([[0, 5], [4, 5]]), 4, 2);
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.minZ)).toEqual([0, 2]);
  });

  it('is deterministic', () => {
    const m = new Map([[5, 3], [4, 3], [0, 9], [1, 9]]);
    expect(waterRunsFromLevels(m, 4, 2)).toEqual(waterRunsFromLevels(m, 4, 2));
  });
});

describe('rasterizeChannel', () => {
  const line = (pts: Array<[number, number]>) => pts.map(([x, z]) => ({ x, z }));

  it('covers the cells a straight course runs through', () => {
    // 10x10 grid, 1 m cells, a course along row 5 from x=1 to x=8.
    const cells = rasterizeChannel(line([[1, 5], [8, 5]]), 0, 10, 10, 1);
    for (let col = 1; col <= 8; col++) expect(cells.has(5 * 10 + col)).toBe(true);
  });

  it('skips no cell on a diagonal', () => {
    // Stepping a whole cell at a time would leave gaps a river cannot have.
    const cells = rasterizeChannel(line([[0, 0], [9, 9]]), 0, 10, 10, 1);
    for (let i = 0; i <= 9; i++) expect(cells.has(i * 10 + i)).toBe(true);
  });

  it('widens with the half-width', () => {
    const thin = rasterizeChannel(line([[5, 1], [5, 8]]), 0, 10, 10, 1);
    const wide = rasterizeChannel(line([[5, 1], [5, 8]]), 2, 10, 10, 1);
    expect(wide.size).toBeGreaterThan(thin.size);
  });

  it('stays inside the grid', () => {
    const cells = rasterizeChannel(line([[0, 0], [0, 9]]), 3, 10, 10, 1);
    for (const idx of cells) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(100);
    }
  });

  it('handles a single point and an empty course', () => {
    expect(rasterizeChannel(line([[4, 4]]), 0, 10, 10, 1).has(44)).toBe(true);
    expect(rasterizeChannel([], 1, 10, 10, 1).size).toBe(0);
  });

  it('is deterministic', () => {
    const l = line([[1, 1], [7, 4], [8, 9]]);
    const a = [...rasterizeChannel(l, 1, 10, 10, 1)].sort((x, y) => x - y);
    const b = [...rasterizeChannel(l, 1, 10, 10, 1)].sort((x, y) => x - y);
    expect(a).toEqual(b);
  });
});
