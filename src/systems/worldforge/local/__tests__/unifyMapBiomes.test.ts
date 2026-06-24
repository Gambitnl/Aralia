import { describe, it, expect } from 'vitest';
import { unifyMapBiomesWithWorld } from '../unifyMapBiomes';
import { BIOMES } from '../../../../data/biomes';
import { generateFmgWorld } from '../../fmg/generateWorld';

// 2x2 atlas: sites at the 4 grid-cell centers of a 100x100 graph.
// cell 0 = water (h<20), cells 1-3 = land with biome indices.
const world = {
  graphWidth: 100,
  graphHeight: 100,
  pack: { cells: { p: [[25, 25], [75, 25], [25, 75], [75, 75]], h: [5, 50, 50, 50], biome: [0, 6, 3, 9] } },
} as any;
const gridSize = { cols: 2, rows: 2 };

const makeMap = () => ({
  gridSize: { rows: 2, cols: 2 },
  tiles: [
    [{ x: 0, y: 0, biomeId: 'plains', discovered: false, isPlayerCurrent: false }, { x: 1, y: 0, biomeId: 'plains', discovered: false, isPlayerCurrent: false }],
    [{ x: 0, y: 1, biomeId: 'plains', discovered: false, isPlayerCurrent: false }, { x: 1, y: 1, biomeId: 'plains', discovered: false, isPlayerCurrent: false }],
  ],
}) as any;

describe('unifyMapBiomesWithWorld', () => {
  it('rewrites land tiles to the WF biome and water tiles to ocean', () => {
    const map = makeMap();
    const n = unifyMapBiomesWithWorld(map, world, gridSize);
    expect(n).toBe(4);
    expect(map.tiles[0][0].biomeId).toBe('ocean');            // cell 0 water
    expect(map.tiles[0][1].biomeId).toBe('forest_temperate'); // cell 1 = WF index 6
    expect(map.tiles[1][0].biomeId).toBe('plains_savanna');   // cell 2 = WF index 3
    expect(map.tiles[1][1].biomeId).toBe('forest_boreal');    // cell 3 = WF index 9
    // every assigned land biome is a real, passable biome
    for (const row of map.tiles) for (const t of row) {
      if (t.biomeId !== 'ocean') expect(BIOMES[t.biomeId]?.passable).toBe(true);
    }
  });

  it('preserves location-anchored tiles', () => {
    const map = makeMap();
    map.tiles[0][0].locationId = 'clearing'; // anchored (would otherwise become ocean)
    map.tiles[0][0].biomeId = 'plains_meadow';
    unifyMapBiomesWithWorld(map, world, gridSize);
    expect(map.tiles[0][0].biomeId).toBe('plains_meadow'); // untouched
    expect(map.tiles[0][1].biomeId).toBe('forest_temperate'); // others still rewritten
  });

  it('is deterministic', () => {
    const a = makeMap(); unifyMapBiomesWithWorld(a, world, gridSize);
    const b = makeMap(); unifyMapBiomesWithWorld(b, world, gridSize);
    expect(a.tiles).toEqual(b.tiles);
  });

  it('real FMG world: a 30x20 grid becomes a downsampled view (ocean + varied land)', () => {
    const real = generateFmgWorld('2026');
    const gs = { cols: 30, rows: 20 };
    const map = {
      gridSize: { rows: 20, cols: 30 },
      tiles: Array.from({ length: 20 }, (_, y) => Array.from({ length: 30 }, (_, x) => ({ x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false }))),
    } as any;
    unifyMapBiomesWithWorld(map, real, gs);
    const flat = map.tiles.flat().map((t: any) => t.biomeId);
    const unique = new Set(flat);
    expect(unique.size).toBeGreaterThan(1);                      // not a flat single biome
    expect(flat.some((b: string) => b === 'ocean')).toBe(true);  // the world has seas
    expect(flat.some((b: string) => b !== 'ocean')).toBe(true);  // and land
    for (const b of unique) expect(b === 'ocean' || BIOMES[b as string]).toBeTruthy(); // all real
  }, 60000);
});
