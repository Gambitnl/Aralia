import { describe, it, expect } from 'vitest';
import {
  cellPolygonPoints,
  biomeFillForCell,
  buildAtlasSvgModel,
  buildMergedRegions,
} from '../atlasSvg';

// Minimal stub shaped like FmgAtlasResult (only fields the helpers read).
const stub = {
  graphWidth: 100,
  graphHeight: 100,
  biomesData: { color: ['#000000', '#11aa33', '#cccccc'] },
  pack: {
    vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    cells: {
      h: [5, 50],            // cell 0 = water, cell 1 = land
      v: [[0, 1, 2], [0, 1, 2, 3]],
      biome: [0, 1],
    },
  },
} as any;

describe('atlasSvg helpers', () => {
  it('cellPolygonPoints joins vertex coords as "x,y" pairs', () => {
    expect(cellPolygonPoints(stub, 1)).toBe('0,0 10,0 10,10 0,10');
  });
  it('biomeFillForCell resolves the biome color', () => {
    expect(biomeFillForCell(stub, 1)).toBe('#11aa33');
  });
  it('biomeFillForCell falls back when color missing', () => {
    expect(biomeFillForCell(stub, 99)).toBe('#888888');
  });
});

describe('buildAtlasSvgModel', () => {
  it('emits an ocean layer and a merged land-region layer (T2: no per-cell polygons)', () => {
    const model = buildAtlasSvgModel(stub);
    expect(model.width).toBe(100);
    expect(model.height).toBe(100);
    const land = model.layers.find((l) => l.id === 'land');
    expect(land!.regions).toHaveLength(1);             // only cell 1 is land (h>=20)
    expect(land!.regions![0].fill).toBe('#11aa33');
    expect(land!.regions![0].d.startsWith('M')).toBe(true);
    expect(land!.regions![0].d.endsWith('Z')).toBe(true);
    expect(land!.polygons).toHaveLength(0);            // merged, not per-cell
    expect(model.layers.map((l) => l.id)).toEqual(['ocean', 'land']);
  });
});

// Two unit squares sharing the vertical edge (10,0)-(10,10).
function pairMesh(biome: number[]) {
  return {
    graphWidth: 30,
    graphHeight: 10,
    biomesData: { color: ['#000', '#111', '#222', '#333', '#444', '#555', '#666', '#7a7a7a', '#888', '#9a9a9a'] },
    pack: {
      vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10], [20, 0], [20, 10]] },
      cells: {
        h: [50, 50],
        v: [[0, 1, 2, 3], [1, 4, 5, 2]],
        c: [[1], [0]],
        biome,
      },
    },
  } as any;
}
const landBiomeKey = (a: any) => (i: number) => (a.pack.cells.h[i] >= 20 ? a.pack.cells.biome[i] : null);
const biomeColor = (a: any) => (k: any) => a.biomesData.color[k] ?? '#888';

describe('buildMergedRegions', () => {
  it('merges two same-biome adjacent cells into ONE region (drops the shared edge)', () => {
    const a = pairMesh([7, 7]);
    const regs = buildMergedRegions(a, landBiomeKey(a), biomeColor(a));
    expect(regs).toHaveLength(1);
    expect(regs[0].fill).toBe('#7a7a7a');
    // The interior shared edge endpoints 10,0 and 10,10 must not both terminate
    // a subpath as an internal wall — the merged ring traces only outer vertices.
    expect((regs[0].d.match(/M/g) || []).length).toBe(1); // single outer ring
    expect(regs[0].d.endsWith('Z')).toBe(true);
  });

  it('keeps two different-biome adjacent cells as TWO regions', () => {
    const a = pairMesh([7, 9]);
    const regs = buildMergedRegions(a, landBiomeKey(a), biomeColor(a));
    expect(regs).toHaveLength(2);
  });
});
