import { describe, it, expect } from 'vitest';
import { resolveWorldSpawn, relocateStartTile } from '../resolveSpawn';
import { legacyGridToAtlasCell } from '../gridAtlasBridge';
import { generateFmgWorld } from '../../fmg/generateWorld';

const gridSize = { cols: 2, rows: 2 };
// 2x2 atlas: sites at the 4 grid-cell centers of a 100x100 graph.
const baseCells = { p: [[25, 25], [75, 25], [25, 75], [75, 75]], h: [50, 50, 50, 50], biome: [3, 4, 5, 6] };

function world(burgs: unknown[]): any {
  return { graphWidth: 100, graphHeight: 100, pack: { cells: baseCells, burgs } };
}

describe('resolveWorldSpawn', () => {
  it('spawns at the capital burg, mapped onto the legacy grid', () => {
    const w = world([
      { i: 0 },                                       // id-0 placeholder
      { i: 1, cell: 1, name: 'Townsville' },          // a town (cell 1 → grid {1,0})
      { i: 2, cell: 3, capital: 1, name: 'Capital City' }, // the capital (cell 3 → grid {1,1})
    ]);
    const s = resolveWorldSpawn(w, gridSize);
    expect(s.atlasCellId).toBe(3);
    expect(s.burgName).toBe('Capital City');
    expect(s.gridCell).toEqual({ x: 1, y: 1 });
    expect(s.biomeIndex).toBe(6);
  });

  it('falls back to the first real burg when there is no capital', () => {
    const s = resolveWorldSpawn(world([{ i: 0 }, { i: 1, cell: 2, name: 'Hamlet' }]), gridSize);
    expect(s.atlasCellId).toBe(2);
    expect(s.gridCell).toEqual({ x: 0, y: 1 });
  });

  it('falls back to the first land cell when there are no burgs', () => {
    const w = world([{ i: 0 }]);
    w.pack.cells = { ...baseCells, h: [5, 5, 50, 5] }; // only cell 2 is land
    const s = resolveWorldSpawn(w, gridSize);
    expect(s.atlasCellId).toBe(2);
    expect(s.gridCell).toEqual({ x: 0, y: 1 });
  });

  it('is deterministic', () => {
    const w = world([{ i: 0 }, { i: 1, cell: 1, capital: 1, name: 'Cap' }]);
    expect(resolveWorldSpawn(w, gridSize)).toEqual(resolveWorldSpawn(w, gridSize));
  });

  it('nudges off a water grid cell to the nearest land grid cell (no ocean spawn)', () => {
    // Capital sits in cell 1 (grid {1,0}), but cell 1 is WATER (h=5). Cells 0/2/3 are land.
    const w = world([{ i: 0 }, { i: 1, cell: 1, capital: 1, name: 'Portside' }]);
    w.pack.cells = { p: [[25, 25], [75, 25], [25, 75], [75, 75]], h: [50, 5, 50, 50], biome: [3, 4, 5, 6] };
    const s = resolveWorldSpawn(w, gridSize);
    // The chosen grid cell's center must map to a LAND atlas cell.
    const atlasCell = legacyGridToAtlasCell(w, s.gridCell, gridSize);
    expect(w.pack.cells.h[atlasCell]).toBeGreaterThanOrEqual(20);
    expect(s.gridCell).not.toEqual({ x: 1, y: 0 }); // moved off the water cell
  });
});

describe('resolveWorldSpawn — real FMG world (integration)', () => {
  it('lands a valid in-bounds grid cell anchored to a burg', () => {
    const world = generateFmgWorld('4321');
    const gs = { cols: 30, rows: 20 };
    const s = resolveWorldSpawn(world, gs);
    expect(s.atlasCellId).toBeGreaterThanOrEqual(0);
    expect(s.gridCell.x).toBeGreaterThanOrEqual(0);
    expect(s.gridCell.x).toBeLessThan(gs.cols);
    expect(s.gridCell.y).toBeGreaterThanOrEqual(0);
    expect(s.gridCell.y).toBeLessThan(gs.rows);
    // A generated world has burgs, so the spawn anchors to a named one.
    expect(typeof s.burgName).toBe('string');
    // Deterministic for the same seed.
    expect(resolveWorldSpawn(generateFmgWorld('4321'), gs).gridCell).toEqual(s.gridCell);
  }, 60000);
});

describe('relocateStartTile', () => {
  const makeMap = () => ({
    gridSize: { rows: 2, cols: 2 },
    tiles: [
      [{ x: 0, y: 0, biomeId: 'ocean', discovered: false, isPlayerCurrent: true }, { x: 1, y: 0, biomeId: 'ocean', discovered: false, isPlayerCurrent: false }],
      [{ x: 0, y: 1, biomeId: 'ocean', discovered: false, isPlayerCurrent: false }, { x: 1, y: 1, biomeId: 'ocean', discovered: false, isPlayerCurrent: false }],
    ],
  }) as any;

  const isWalkable = (b: string) => b !== 'ocean';

  it('applies the desired WF biome when walkable; forces fallback when not', () => {
    const map = makeMap(); // all tiles 'ocean'
    relocateStartTile(map, { x: 1, y: 1 }, { biomeId: 'forest', fallbackBiomeId: 'plains', isWalkable });
    expect(map.tiles[0][0].isPlayerCurrent).toBe(false); // old start cleared
    const t = map.tiles[1][1];
    expect(t.isPlayerCurrent).toBe(true);
    expect(t.discovered).toBe(true);
    expect(t.biomeId).toBe('forest'); // desired WF biome applied (walkable)

    const map2 = makeMap();
    relocateStartTile(map2, { x: 1, y: 1 }, { biomeId: 'ocean', fallbackBiomeId: 'plains', isWalkable });
    expect(map2.tiles[1][1].biomeId).toBe('plains'); // unwalkable desired → fallback
  });

  it('keeps the tile biome when no desired biome is given', () => {
    const map = makeMap();
    map.tiles[1][1].biomeId = 'forest';
    relocateStartTile(map, { x: 1, y: 1 }, { fallbackBiomeId: 'plains', isWalkable });
    expect(map.tiles[1][1].biomeId).toBe('forest');
  });

  it('clamps an out-of-bounds target into the grid', () => {
    const map = makeMap();
    relocateStartTile(map, { x: 99, y: 99 }, { biomeId: 'forest', fallbackBiomeId: 'plains', isWalkable });
    expect(map.tiles[1][1].isPlayerCurrent).toBe(true);
  });
});
