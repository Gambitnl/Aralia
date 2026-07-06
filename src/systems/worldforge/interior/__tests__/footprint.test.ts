import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';

const shapeOf = (type: any, seed: number) =>
  genFootprint(rootSeedPath(seed), type);

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
});
