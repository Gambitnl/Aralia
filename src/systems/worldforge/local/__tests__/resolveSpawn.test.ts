import { describe, it, expect } from 'vitest';
import { resolveWorldSpawn, applyWfSpawnToMap } from '../resolveSpawn';
import { legacyGridToAtlasCell } from '../gridAtlasBridge';
import { generateFmgWorld } from '../../fmg/generateWorld';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { wfBiomeIndexToLegacyId } from '../wfBiomeToLegacy';
import type { MapData } from '../../../../types';

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
    // The spawn grid cell's center maps to WF LAND — never the open ocean.
    const atlasCell = legacyGridToAtlasCell(world, s.gridCell, gs);
    expect(world.pack.cells.h[atlasCell]).toBeGreaterThanOrEqual(20);
    // Deterministic for the same seed.
    expect(resolveWorldSpawn(generateFmgWorld('4321'), gs).gridCell).toEqual(s.gridCell);
  }, 60000);
});

describe('applyWfSpawnToMap — reroll→find-me invariant (integration)', () => {
  const COLS = 30;
  const ROWS = 20;

  // A blank grid; applyWfSpawnToMap unifies its biomes from the WF world, so the
  // starting biomes are irrelevant — what matters is where the player ends up.
  function blankMap(): MapData {
    const tiles = Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) => ({
        x, y, biomeId: 'ocean', discovered: false, isPlayerCurrent: x === 0 && y === 0,
      })),
    );
    return { gridSize: { rows: ROWS, cols: COLS }, tiles } as unknown as MapData;
  }

  const isWalkable = (b: string) => b !== 'ocean';

  // Replicates the user's manual loop: reroll the world, "find me", check the tile.
  it('lands the player on a non-ocean walkable tile for every reroll seed', () => {
    const seeds = [1, 7, 42, 1234, 4321, 99999, 271828, 555000, 8675309, 31337];
    for (const seed of seeds) {
      const map = blankMap();
      const spawn = applyWfSpawnToMap(map, seed, { cols: COLS, rows: ROWS }, {
        biomeIndexToLegacyId: (idx) => wfBiomeIndexToLegacyId(idx),
        fallbackBiomeId: 'plains_meadow',
        isWalkable,
      });

      // Grid retirement: spawn no longer mutates the grid (no isPlayerCurrent /
      // biome write). The invariant is now on the RESOLVED CELL: its grid cell
      // center maps to WF LAND — never the open ocean.
      const atlasCell = legacyGridToAtlasCell(getBridgeAtlas(seed), spawn.gridCell, { cols: COLS, rows: ROWS });
      expect(atlasCell, `seed ${seed}: spawn cell resolves`).toBeGreaterThanOrEqual(0);
      expect(getBridgeAtlas(seed).pack.cells.h[atlasCell], `seed ${seed}: spawn on land`).toBeGreaterThanOrEqual(20);
    }
  }, 120000);
});

describe('applyWfSpawnToMap — player-chosen town (spawnAtlasCellId)', () => {
  const COLS = 30;
  const ROWS = 20;
  function blankMap(): MapData {
    const tiles = Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) => ({
        x, y, biomeId: 'ocean', discovered: false, isPlayerCurrent: x === 0 && y === 0,
      })),
    );
    return { gridSize: { rows: ROWS, cols: COLS }, tiles } as unknown as MapData;
  }

  it('spawns at the chosen burg cell, not the auto capital', () => {
    const seed = 4321;
    // WM1: derive the chosen burg from the SAME canonical world applyWfSpawnToMap
    // resolves against (the bridge atlas, "aralia-<seed>"), not a bare
    // generateFmgWorld(String(seed)) — otherwise the chosen cell belongs to a
    // different world than the spawn is computed in (the exact WM1 mismatch).
    const world = getBridgeAtlas(seed);
    const burgs = (world.pack.burgs ?? []).filter(
      (b: any) => b && b.i !== 0 && !b.removed && typeof b.cell === 'number',
    );
    // Pick a non-capital town so the chosen spawn differs from the auto pick.
    const chosen = burgs.find((b: any) => !b.capital) ?? burgs[0];

    const map = blankMap();
    const spawn = applyWfSpawnToMap(map, seed, { cols: COLS, rows: ROWS }, {
      biomeIndexToLegacyId: (i) => wfBiomeIndexToLegacyId(i),
      fallbackBiomeId: 'plains_meadow',
      isWalkable: (b) => b !== 'ocean',
      spawnAtlasCellId: chosen.cell,
      spawnBurgName: chosen.name,
    });

    // Grid retirement: the spawn is the chosen burg CELL (no grid mutation).
    expect(spawn.atlasCellId).toBe(chosen.cell);
    expect(spawn.burgName).toBe(chosen.name);
    // The chosen town's cell is land (h >= sea level) — never an ocean spawn.
    expect(world.pack.cells.h[chosen.cell]).toBeGreaterThanOrEqual(20);
  }, 60000);
});

// Grid retirement: the `relocateStartTile` describe block is removed with the
// function — the spawn no longer writes an isPlayerCurrent/biome start tile into
// the 30x20 grid (position + biome are cell-native).
