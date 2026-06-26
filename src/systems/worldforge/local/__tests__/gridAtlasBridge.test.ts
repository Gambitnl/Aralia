import { describe, it, expect } from 'vitest';
import {
  gridCellToGraphPoint,
  gridCellToAtlasSite,
  spreadColocatedPoints,
  legacyGridToAtlasCell,
  atlasCellToLegacyGrid,
} from '../gridAtlasBridge';

// A 2x2 atlas: 4 cells whose sites sit at the centers of a 100x100 graph,
// matching a 2x2 legacy grid (cell centers at 25/75 in each axis).
const atlas = {
  graphWidth: 100,
  graphHeight: 100,
  pack: { cells: { p: [[25, 25], [75, 25], [25, 75], [75, 75]] } },
} as any;
const gridSize = { cols: 2, rows: 2 };

describe('gridAtlasBridge', () => {
  it('gridCellToGraphPoint projects a grid cell to its proportional graph center', () => {
    expect(gridCellToGraphPoint({ x: 0, y: 0 }, gridSize, atlas)).toEqual([25, 25]);
    expect(gridCellToGraphPoint({ x: 1, y: 1 }, gridSize, atlas)).toEqual([75, 75]);
  });

  it('legacyGridToAtlasCell resolves each grid cell to the matching atlas cell', () => {
    expect(legacyGridToAtlasCell(atlas, { x: 0, y: 0 }, gridSize)).toBe(0);
    expect(legacyGridToAtlasCell(atlas, { x: 1, y: 0 }, gridSize)).toBe(1);
    expect(legacyGridToAtlasCell(atlas, { x: 0, y: 1 }, gridSize)).toBe(2);
    expect(legacyGridToAtlasCell(atlas, { x: 1, y: 1 }, gridSize)).toBe(3);
  });

  it('atlasCellToLegacyGrid round-trips back to the originating grid cell', () => {
    for (const cell of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]) {
      const id = legacyGridToAtlasCell(atlas, cell, gridSize);
      expect(atlasCellToLegacyGrid(atlas, id, gridSize)).toEqual(cell);
    }
  });

  it('atlasCellToLegacyGrid returns null for a missing site', () => {
    expect(atlasCellToLegacyGrid(atlas, 99, gridSize)).toBeNull();
  });

  it('gridCellToAtlasSite returns the Voronoi site of the mapped cell (not the grid center)', () => {
    // A non-uniform atlas: the cell covering grid {1,0} has its SITE offset from
    // the grid-center (60,20 vs the 75,25 proportional center). The pin must snap
    // to the site so it sits inside the actual cell, not adrift at the center.
    const skewed = {
      graphWidth: 100, graphHeight: 100,
      pack: { cells: { p: [[20, 20], [60, 20], [20, 80], [80, 80]] } },
    } as any;
    expect(gridCellToAtlasSite(skewed, { x: 1, y: 0 }, gridSize)).toEqual([60, 20]);
    expect(gridCellToAtlasSite(skewed, { x: 0, y: 0 }, gridSize)).toEqual([20, 20]);
  });

  it('gridCellToAtlasSite falls back to the proportional grid center when no site exists', () => {
    const empty = { graphWidth: 100, graphHeight: 100, pack: { cells: { p: [] } } } as any;
    expect(gridCellToAtlasSite(empty, { x: 1, y: 1 }, gridSize)).toEqual([75, 75]);
  });

  it('gridCellToAtlasSite applies a sub-tile offset in graph units (tile-size scaled)', () => {
    // Cell {0,0} site is [25,25]; graph 100x100, 2x2 grid → tile = 50 graph units.
    // offset {0.5, -0.5} nudges by +25 x / -25 y → [50, 0].
    expect(gridCellToAtlasSite(atlas, { x: 0, y: 0 }, gridSize, { x: 0.5, y: -0.5 })).toEqual([50, 0]);
    // Zero offset matches the un-offset site.
    expect(gridCellToAtlasSite(atlas, { x: 1, y: 1 }, gridSize, { x: 0, y: 0 })).toEqual([75, 75]);
    // No offset arg → bare site (back-compat).
    expect(gridCellToAtlasSite(atlas, { x: 1, y: 0 }, gridSize)).toEqual([75, 25]);
  });

  it('spreadColocatedPoints leaves unique points untouched', () => {
    const pts = [{ x: 10, y: 10, label: 'a' }, { x: 50, y: 50, label: 'b' }];
    expect(spreadColocatedPoints(pts)).toEqual(pts);
  });

  it('spreadColocatedPoints fans out points sharing a location, preserving labels and count', () => {
    const pts = [
      { x: 30, y: 30, label: 'a' },
      { x: 30, y: 30, label: 'b' },
      { x: 30, y: 30, label: 'c' },
    ];
    const out = spreadColocatedPoints(pts, 6);
    expect(out).toHaveLength(3);
    // Labels preserved, in order.
    expect(out.map((p) => p.label)).toEqual(['a', 'b', 'c']);
    // No two pins remain at the same coordinate.
    const coords = new Set(out.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(coords.size).toBe(3);
    // Each fanned pin sits on the ring (radius 6) around the shared origin.
    for (const p of out) {
      expect(Math.hypot(p.x - 30, p.y - 30)).toBeCloseTo(6, 5);
    }
  });

  it('spreadColocatedPoints is deterministic (frame-safe)', () => {
    const pts = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    expect(spreadColocatedPoints(pts)).toEqual(spreadColocatedPoints(pts));
  });
});
