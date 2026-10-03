/**
 * @file voronoi.test.ts — structural invariants for the ported FMG Voronoi
 * builder and the grid helpers around it. The pipeline goldens pin exact
 * values; these tests pin the graph contracts every downstream stage
 * assumes: symmetric cell adjacency, valid vertex references, correct
 * border flags, and the point-i-lives-in-cell-i jittered-grid invariant.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  calculateVoronoi,
  generateGrid,
  findGridCell,
} from '../utils/graphUtils';
import type { Point } from '../voronoi';

const realRandom = Math.random;

afterEach(() => {
  Math.random = realRandom;
});

/** A deterministic pseudo-jittered 6x6 point grid inside a 60x60 box. */
function makePoints(): { points: Point[]; boundary: Point[] } {
  const points: Point[] = [];
  for (let gy = 0; gy < 6; gy++) {
    for (let gx = 0; gx < 6; gx++) {
      // fixed sub-cell offsets stand in for jitter; no RNG involved
      const jx = ((gx * 7 + gy * 3) % 5) - 2;
      const jy = ((gx * 3 + gy * 7) % 5) - 2;
      points.push([gx * 10 + 5 + jx, gy * 10 + 5 + jy]);
    }
  }
  const boundary: Point[] = [];
  for (let i = 0; i <= 6; i++) {
    boundary.push([i * 10, -15], [i * 10, 75], [-15, i * 10], [75, i * 10]);
  }
  return { points, boundary };
}

describe('calculateVoronoi', () => {
  const { points, boundary } = makePoints();
  const { cells, vertices } = calculateVoronoi(points, boundary);

  it('indexes exactly the real (non-boundary) points', () => {
    expect(cells.i.length).toBe(points.length);
    expect(Array.from(cells.i)).toEqual(points.map((_, i) => i));
  });

  it('gives every cell at least three vertices and one neighbor', () => {
    for (const i of cells.i) {
      expect(cells.v[i].length, `cell ${i} vertices`).toBeGreaterThanOrEqual(3);
      expect(cells.c[i].length, `cell ${i} neighbors`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has symmetric cell adjacency', () => {
    for (const i of cells.i) {
      for (const n of cells.c[i]) {
        expect(cells.c[n], `cell ${n} must list ${i}`).toContain(i);
      }
    }
  });

  it('never lists a boundary point as a neighbor', () => {
    for (const i of cells.i) {
      for (const n of cells.c[i]) {
        expect(n).toBeLessThan(points.length);
      }
    }
  });

  it('references only defined vertices, and those vertices point back', () => {
    for (const i of cells.i) {
      for (const v of cells.v[i]) {
        expect(vertices.p[v], `vertex ${v} of cell ${i}`).toBeDefined();
        expect(vertices.c[v], `vertex ${v} adjacency`).toContain(i);
      }
    }
  });

  it('flags outer cells as border and keeps inner cells clear', () => {
    // 6x6 grid: the 20 rim cells touch the boundary ring, the 16 inner do not.
    const borderCount = cells.b.filter((b) => b === 1).length;
    expect(borderCount).toBe(20);
    // inner cell (2,2) = index 14 is surrounded by real cells only
    expect(cells.b[14]).toBe(0);
  });

  it('gives every vertex exactly three adjacent vertices and cells', () => {
    for (const i of cells.i) {
      for (const v of cells.v[i]) {
        expect(vertices.v[v].length).toBe(3);
        expect(vertices.c[v].length).toBe(3);
      }
    }
  });

  it('is deterministic: the same input rebuilds the same graph', () => {
    const again = calculateVoronoi(points, boundary);
    expect(again.cells.v).toEqual(cells.v);
    expect(again.cells.c).toEqual(cells.c);
    expect(again.cells.b).toEqual(cells.b);
    expect(again.vertices.p).toEqual(vertices.p);
  });
});

describe('generateGrid + findGridCell', () => {
  it('is deterministic for the same seed', () => {
    const a = generateGrid('grid-seed-1', 320, 180, 1000);
    const b = generateGrid('grid-seed-1', 320, 180, 1000);
    expect(a.points).toEqual(b.points);
    expect(a.spacing).toBe(b.spacing);
    expect(a.cellsX).toBe(b.cellsX);
    expect(a.cellsY).toBe(b.cellsY);
  });

  it('changes with the seed', () => {
    const a = generateGrid('grid-seed-1', 320, 180, 1000);
    const b = generateGrid('grid-seed-2', 320, 180, 1000);
    expect(a.points).not.toEqual(b.points);
  });

  it('places cellsX * cellsY jittered points', () => {
    const grid = generateGrid('grid-seed-1', 320, 180, 1000);
    expect(grid.points.length).toBe(grid.cellsX * grid.cellsY);
  });

  it('maps every jittered point back to its own square cell', () => {
    // The jitter never moves a point out of its square: findGridCell(point i)
    // must return i. Spawn-on-land and town placement rely on this.
    const grid = generateGrid('grid-seed-1', 320, 180, 1000);
    grid.points.forEach(([x, y], i) => {
      expect(findGridCell(x, y, grid)).toBe(i);
    });
  });
});
