import { describe, it, expect } from 'vitest';
import { listSelectableTowns, groupTownsByState } from '../startTowns';
import { generateFmgWorld } from '../../fmg/generateWorld';
import { applyWfSpawnToMap } from '../resolveSpawn';
import { wfBiomeIndexToLegacyId } from '../wfBiomeToLegacy';
import type { MapData } from '../../../../types';

function fakeWorld(burgs: unknown[], states: unknown[] = [], opts: Record<string, unknown> = {}): any {
  return {
    populationRate: 1000,
    urbanization: 1,
    pack: { burgs, states, cells: { biome: [] } },
    ...opts,
  };
}

describe('listSelectableTowns', () => {
  it('lists real burgs and skips the placeholder + removed ones', () => {
    const world = fakeWorld(
      [
        { i: 0 },                                                   // placeholder
        { i: 1, cell: 10, name: 'Aldermoor', x: 5, y: 5, state: 1, population: 4 },
        { i: 2, cell: 20, name: 'Ghosttown', state: 1, removed: true }, // removed
        { i: 3, cell: 30, name: 'Riverford', x: 9, y: 2, state: 2, port: 1, population: 2, capital: 1 },
        { i: 4, name: 'NoCell', state: 2 },                          // no cell → skipped
      ],
      [{ i: 0, name: 'Neutrals' }, { i: 1, name: 'Eldoria' }, { i: 2, name: 'Marlind' }],
    );
    const towns = listSelectableTowns(world);
    expect(towns.map((t) => t.name)).toEqual(['Riverford', 'Aldermoor']); // capital first
    const riverford = towns[0];
    expect(riverford).toMatchObject({
      atlasCellId: 30, isCapital: true, isPort: true, stateIndex: 2, stateName: 'Marlind',
    });
    expect(riverford.population).toBe(2000); // 2 points × 1000 rate × 1 urban
    expect(towns[1]).toMatchObject({ atlasCellId: 10, isCapital: false, stateName: 'Eldoria' });
  });

  it('labels stateless burgs Neutral', () => {
    const towns = listSelectableTowns(fakeWorld([{ i: 1, cell: 1, name: 'Wanderhome', x: 0, y: 0 }]));
    expect(towns[0].stateName).toBe('Neutral');
    expect(towns[0].stateIndex).toBe(0);
  });
});

describe('groupTownsByState', () => {
  it('groups towns by region, most-populous region first, neutral last', () => {
    const world = fakeWorld(
      [
        { i: 1, cell: 1, name: 'A', x: 0, y: 0, state: 1, population: 1 },
        { i: 2, cell: 2, name: 'B', x: 0, y: 0, state: 2, population: 9, capital: 1 },
        { i: 3, cell: 3, name: 'C', x: 0, y: 0, state: 0, population: 5 },
        { i: 4, cell: 4, name: 'D', x: 0, y: 0, state: 2, population: 2 },
      ],
      [{ i: 0, name: 'Neutrals' }, { i: 1, name: 'Eldoria' }, { i: 2, name: 'Marlind' }],
    );
    const regions = groupTownsByState(listSelectableTowns(world));
    expect(regions.map((r) => r.stateName)).toEqual(['Marlind', 'Eldoria', 'Neutral']);
    expect(regions[0].towns.map((t) => t.name)).toEqual(['B', 'D']); // capital first
  });
});

describe('listSelectableTowns — real FMG world (integration)', () => {
  it('produces grouped, land-anchored, named towns', () => {
    const world = generateFmgWorld('4321');
    const towns = listSelectableTowns(world);
    expect(towns.length).toBeGreaterThan(0);
    for (const t of towns) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.atlasCellId).toBe('number');
      // Every selectable town sits on a WF LAND cell (h >= 20) — never ocean.
      expect(world.pack.cells.h[t.atlasCellId]).toBeGreaterThanOrEqual(20);
    }
    const regions = groupTownsByState(towns);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.reduce((n, r) => n + r.towns.length, 0)).toBe(towns.length);
  }, 60000);
});

describe('Start Point Selection end-to-end spawn contract (integration)', () => {
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

  // The exact feature path: the player picks a town from the public list, and
  // applyWfSpawnToMap (the same call startGame makes) must drop them at THAT town
  // on land. Covers the chosen-town → spawn wiring that the live preview blocked.
  it('spawns the player at whichever listed town they pick — on land, named', () => {
    const seed = 4321;
    const world = generateFmgWorld(String(seed));
    const towns = listSelectableTowns(world);
    expect(towns.length).toBeGreaterThan(3);

    // Try a spread of picks (biggest capital, a mid-list town, the last/smallest)
    // so the contract holds regardless of which the player chooses.
    for (const idx of [0, Math.floor(towns.length / 2), towns.length - 1]) {
      const town = towns[idx];
      const map = blankMap();
      const spawn = applyWfSpawnToMap(seed, { cols: COLS, rows: ROWS }, {
        biomeIndexToLegacyId: (i) => wfBiomeIndexToLegacyId(i),
        fallbackBiomeId: 'plains_meadow',
        isWalkable: (b) => b !== 'ocean',
        spawnAtlasCellId: town.atlasCellId,
        spawnBurgName: town.name,
      });

      // Grid retirement: the spawn IS the chosen town's cell (no grid mutation).
      expect(spawn.atlasCellId, `town ${town.name}: cell`).toBe(town.atlasCellId);
      expect(spawn.burgName, `town ${town.name}: name`).toBe(town.name);
      // The chosen town's cell is on land (h >= sea level) — never an ocean spawn.
      expect(world.pack.cells.h[town.atlasCellId], `town ${town.name}: on land`).toBeGreaterThanOrEqual(20);
    }
  }, 60000);
});
