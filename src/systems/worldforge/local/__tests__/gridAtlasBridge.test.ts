import { describe, it, expect } from 'vitest';
import {
  gridCellToGraphPoint,
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
});
