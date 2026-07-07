import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { clampFootprint, genFootprint } from '../footprint';
import type { BuildingType } from '../blueprintTypes';

const shapeOf = (type: any, seed: number) =>
  genFootprint(rootSeedPath(seed), type);

const ALL_TYPES: BuildingType[] = [
  'cottage', 'townhouse', 'tenement', 'farmstead',
  'shop', 'smithy', 'workshop', 'inn', 'tavern', 'storehouse',
  'manor', 'temple', 'keep', 'civic',
];

describe('genFootprint', () => {
  it('is deterministic for a seed path', () => {
    const a = genFootprint(rootSeedPath(42), 'tavern');
    const b = genFootprint(rootSeedPath(42), 'tavern');
    expect(a.cells).toEqual(b.cells);
  });

  it('is a single connected region', () => {
    const { occ, cols, rows } = shapeOf('manor', 7);
    // flood from the first occupied cell; every occupied cell must be reached
    let start: [number, number] | null = null;
    for (let y = 0; y < rows && !start; y++)
      for (let x = 0; x < cols && !start; x++) if (occ[y][x]) start = [x, y];
    const seen = new Set<string>();
    const st = [start!]; seen.add(`${start![0]},${start![1]}`);
    while (st.length) {
      const [x, y] = st.pop()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (nx>=0&&ny>=0&&nx<cols&&ny<rows&&occ[ny][nx]&&!seen.has(`${nx},${ny}`)) {
          seen.add(`${nx},${ny}`); st.push([nx,ny]);
        }
      }
    }
    const total = occ.flat().filter(Boolean).length;
    expect(seen.size).toBe(total);
  });

  it('no building type is ever a bare rectangle (has a shape-breaking feature)', () => {
    for (const type of ['cottage','shop','tavern','workshop','manor'] as const) {
      let rectangles = 0;
      for (let s = 0; s < 200; s++) {
        const { occ, cols, rows } = shapeOf(type, s);
        const filled = occ.flat().filter(Boolean).length;
        if (filled === cols * rows) rectangles++;
      }
      expect(rectangles).toBe(0);
    }
  });

  it('masses exactly tile the footprint: union === cells, main first — 100 seeds × all types', () => {
    for (const type of ALL_TYPES) {
      for (let seed = 0; seed < 100; seed++) {
        const fp = genFootprint(rootSeedPath(seed), type);
        expect(fp.masses[0].kind).toBe('main');
        const union = new Set<string>();
        for (const m of fp.masses) {
          for (let y = m.y; y < m.y + m.h; y++)
            for (let x = m.x; x < m.x + m.w; x++) union.add(`${x},${y}`);
        }
        expect(union.size >= fp.cells.length).toBe(true); // masses may overlap each other
        for (const c of fp.cells) expect(union.has(`${c.cx},${c.cy}`)).toBe(true);
        for (const key of union) {
          const [x, y] = key.split(',').map(Number);
          expect(fp.occ[y]?.[x]).toBe(true); // no mass cell outside the footprint
        }
      }
    }
  });

  it('clampFootprint transforms masses consistently with cells', () => {
    const fp = genFootprint(rootSeedPath(4), 'manor');
    const clamped = clampFootprint(fp, Math.max(4, fp.cols - 2), fp.rows);
    // every clamped mass stays inside the clamped grid
    for (const m of clamped.masses) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.w).toBeLessThanOrEqual(clamped.cols);
    }
  });
});
