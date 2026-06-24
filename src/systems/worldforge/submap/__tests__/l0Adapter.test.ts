import { describe, it, expect } from 'vitest';
import { atlasCellToSubmapContext } from '../l0Adapter';
import { generateSubmap, pointInPolygon } from '../submapEngine';
import { rootSeedPath } from '../../seedPath';

// Stub shaped like an FmgAtlasResult: one 100×100 land cell (id 0) carrying burg 5
// (off-center, matching the proven engine-test scale).
const atlas = {
  biomesData: { name: ['Marine', 'Temperate forest'] },
  pack: {
    vertices: { p: [[0, 0], [100, 0], [100, 100], [0, 100]] },
    cells: { v: [[0, 1, 2, 3]], biome: [1], burg: [5] },
    burgs: [null, null, null, null, null, { i: 5, x: 50, y: 40, name: 'Bomnogorvan', capital: 1 }],
  },
} as any;

describe('atlasCellToSubmapContext (L0→L1 adapter)', () => {
  it('maps a cell to its polygon + inherited biome + burg + descended seed-path', () => {
    const ctx = atlasCellToSubmapContext(atlas, 0, rootSeedPath(42));
    expect(ctx.polygon).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
    expect(ctx.biome).toBe('Temperate forest');
    expect(ctx.seedPath).toBe('wf:42/cell:0');
    expect(ctx.features).toHaveLength(1);
    expect(ctx.features![0]).toMatchObject({ kind: 'burg', x: 50, y: 40, id: 5, name: 'Bomnogorvan' });
  });

  it('round-trips into generateSubmap: the inherited burg owns a cell at its position', () => {
    const ctx = atlasCellToSubmapContext(atlas, 0, rootSeedPath(42));
    const model = generateSubmap(ctx, { count: 40 });
    expect(model.biome).toBe('Temperate forest');
    expect(model.cells.length).toBeGreaterThan(20);
    expect(model.burgCellIndex).not.toBeNull();
    const burgCell = model.cells[model.burgCellIndex as number];
    expect(burgCell.feature?.name).toBe('Bomnogorvan');
    expect(pointInPolygon([50, 40], burgCell.polygon)).toBe(true);
  });

  it('omits the burg feature for a cell with no burg', () => {
    const noBurg = {
      ...atlas,
      pack: { ...atlas.pack, cells: { ...atlas.pack.cells, burg: [0] } },
    } as any;
    const ctx = atlasCellToSubmapContext(noBurg, 0, rootSeedPath(1));
    expect(ctx.features).toHaveLength(0);
  });
});
