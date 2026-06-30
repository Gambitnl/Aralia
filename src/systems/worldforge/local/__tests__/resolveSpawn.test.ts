import { describe, it, expect } from 'vitest';
import { resolveWorldSpawn, applyWfSpawnToMap } from '../resolveSpawn';
import { generateFmgWorld } from '../../fmg/generateWorld';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';

// 4-cell atlas (cell-native: only h[] for land + biome[] matter now).
const baseCells = { p: [[25, 25], [75, 25], [25, 75], [75, 75]], h: [50, 50, 50, 50], biome: [3, 4, 5, 6] };

function world(burgs: unknown[]): any {
  return { graphWidth: 100, graphHeight: 100, pack: { cells: baseCells, burgs } };
}

describe('resolveWorldSpawn (cell-native)', () => {
  it('spawns at the capital burg cell', () => {
    const w = world([
      { i: 0 },                                       // id-0 placeholder
      { i: 1, cell: 1, name: 'Townsville' },          // a town
      { i: 2, cell: 3, capital: 1, name: 'Capital City' }, // the capital
    ]);
    const s = resolveWorldSpawn(w);
    expect(s.atlasCellId).toBe(3);
    expect(s.burgName).toBe('Capital City');
    expect(s.biomeIndex).toBe(6);
  });

  it('falls back to the first real burg when there is no capital', () => {
    const s = resolveWorldSpawn(world([{ i: 0 }, { i: 1, cell: 2, name: 'Hamlet' }]));
    expect(s.atlasCellId).toBe(2);
  });

  it('falls back to the first land cell when there are no burgs', () => {
    const w = world([{ i: 0 }]);
    w.pack.cells = { ...baseCells, h: [5, 5, 50, 5] }; // only cell 2 is land
    const s = resolveWorldSpawn(w);
    expect(s.atlasCellId).toBe(2);
  });

  it('is deterministic', () => {
    const w = world([{ i: 0 }, { i: 1, cell: 1, capital: 1, name: 'Cap' }]);
    expect(resolveWorldSpawn(w)).toEqual(resolveWorldSpawn(w));
  });
});

describe('resolveWorldSpawn — real FMG world (integration)', () => {
  it('lands a valid LAND cell anchored to a burg', () => {
    const world = generateFmgWorld('4321');
    const s = resolveWorldSpawn(world);
    expect(s.atlasCellId).toBeGreaterThanOrEqual(0);
    // A generated world has burgs, so the spawn anchors to a named one.
    expect(typeof s.burgName).toBe('string');
    // The spawn cell is WF LAND — never the open ocean.
    expect(world.pack.cells.h[s.atlasCellId]).toBeGreaterThanOrEqual(20);
    // Deterministic for the same seed.
    expect(resolveWorldSpawn(generateFmgWorld('4321')).atlasCellId).toBe(s.atlasCellId);
  }, 60000);
});

describe('applyWfSpawnToMap — reroll→find-me invariant (integration)', () => {
  // Reroll the world; the resolved spawn cell must be land — never the open ocean.
  it('lands the player on a LAND (non-ocean) cell for every reroll seed', () => {
    const seeds = [1, 7, 42, 1234, 4321, 99999, 271828, 555000, 8675309, 31337];
    for (const seed of seeds) {
      const spawn = applyWfSpawnToMap(seed);
      const h = getBridgeAtlas(seed).pack.cells.h[spawn.atlasCellId];
      expect(h, `seed ${seed}: spawn on land`).toBeGreaterThanOrEqual(20);
    }
  }, 120000);
});

describe('applyWfSpawnToMap — player-chosen town (spawnAtlasCellId)', () => {
  it('spawns at the chosen burg cell, not the auto capital', () => {
    const seed = 4321;
    const world = getBridgeAtlas(seed);
    const burgs = (world.pack.burgs ?? []).filter(
      (b: any) => b && b.i !== 0 && !b.removed && typeof b.cell === 'number',
    );
    // Pick a non-capital town so the chosen spawn differs from the auto pick.
    const chosen = burgs.find((b: any) => !b.capital) ?? burgs[0];

    const spawn = applyWfSpawnToMap(seed, {
      spawnAtlasCellId: chosen.cell,
      spawnBurgName: chosen.name,
    });

    // The spawn IS the chosen burg's cell.
    expect(spawn.atlasCellId).toBe(chosen.cell);
    expect(spawn.burgName).toBe(chosen.name);
    // The chosen town's cell is land (h >= sea level) — never an ocean spawn.
    expect(world.pack.cells.h[chosen.cell]).toBeGreaterThanOrEqual(20);
  }, 60000);
});
