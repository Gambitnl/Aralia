import { describe, it, expect } from 'vitest';
import { snapToLandCell, entry3DAnchorForCell } from '../gridAtlasBridge';

// Minimal atlas: cell 0 = water, cells 1 & 2 = land; cell 2 hosts burg 7.
const atlas = {
  graphWidth: 100,
  graphHeight: 100,
  pack: {
    cells: {
      h: [5, 50, 50],
      p: [[10, 10], [50, 50], [90, 50]],
      burg: [0, 0, 7],
    },
    burgs: [undefined, undefined, undefined, undefined, undefined, undefined, undefined, { i: 7, x: 88, y: 48 }],
  },
} as never;

describe('snapToLandCell', () => {
  it('returns a land cell unchanged', () => {
    expect(snapToLandCell(atlas, 1)).toBe(1);
  });
  it('snaps a water cell to the nearest land cell', () => {
    // cell 0 site [10,10]: nearer to cell 1 [50,50] than cell 2 [90,50].
    expect(snapToLandCell(atlas, 0)).toBe(1);
  });
});

describe('entry3DAnchorForCell', () => {
  it('a burg cell anchors on the burg position (frames the town)', () => {
    expect(entry3DAnchorForCell(atlas, 2)).toEqual({ cellId: 2, centerPx: [88, 48] });
  });
  it('a non-burg land cell anchors on the cell, no center override', () => {
    expect(entry3DAnchorForCell(atlas, 1)).toEqual({ cellId: 1 });
  });
  it('a clicked water cell land-snaps (no burg)', () => {
    expect(entry3DAnchorForCell(atlas, 0)).toEqual({ cellId: 1 });
  });
});
