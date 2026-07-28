import { describe, it, expect } from 'vitest';
import { findWaterRegions } from '../waterRegions';

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
