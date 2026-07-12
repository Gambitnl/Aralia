import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../../../utils/random/seededRandom';
import {
  clusterForestCells, assignForestKinds, nameForest,
  type ForestCluster, type ForestKind,
} from '../forestClusters';
import {
  FOREST_BIOME_IDS, FOREST_MIN_CELLS, ANCIENT_MIN_CELLS,
  HAUNTED_PERCENT, FEY_PERCENT, FOREST_WORD_BANKS,
} from '../forestTunables';

// ---------------------------------------------------------------------------
// Fixture: a 12-cell strip (cells 0..11, neighbors = left/right on the line).
// Two forest islands: cells 0-4 (size 5, mixed forest biomes) and cells 6-8
// (size 3, below FOREST_MIN_CELLS=4). Cells 5 and 9-11 are grassland (3).
// ---------------------------------------------------------------------------
const STRIP_BIOME = [6, 8, 9, 5, 7, 3, 6, 6, 6, 3, 3, 3];
const STRIP_CELLS = STRIP_BIOME.length;
const stripNeighbors = (c: number): number[] =>
  [c - 1, c + 1].filter((n) => n >= 0 && n < STRIP_CELLS);

/** Crafted cluster with n synthetic cell ids (base..base+n-1). */
const makeCluster = (id: number, n: number, base: number): ForestCluster => ({
  id,
  cellIds: Array.from({ length: n }, (_, i) => base + i),
  seedCell: base,
});

/** First seed whose FIRST nextInt(0,100) draw lands in [lo, hi). */
const findSeed = (lo: number, hi: number): number => {
  for (let s = 1; s < 200000; s++) {
    const roll = new SeededRandom(s).nextInt(0, 100);
    if (roll >= lo && roll < hi) return s;
  }
  throw new Error(`no seed rolls in [${lo}, ${hi})`);
};

describe('clusterForestCells', () => {
  it('flood-fills mixed forest biomes into one cluster and drops sub-minimum copses', () => {
    expect(FOREST_MIN_CELLS).toBe(4); // the fixture is built around this value
    const clusters = clusterForestCells(STRIP_BIOME, stripNeighbors, STRIP_CELLS);
    // Island 0-4 (5 cells, biomes 6/8/9/5/7 all forest) survives; island 6-8 (3 cells) is a copse.
    expect(clusters).toHaveLength(1);
    expect(clusters[0].cellIds).toEqual([0, 1, 2, 3, 4]);
    expect(clusters[0].seedCell).toBe(0);
    expect(clusters[0].id).toBe(0);
  });

  it('treats exactly the five forest biome ids {5,6,7,8,9} as forest', () => {
    expect([...FOREST_BIOME_IDS].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9]);
    // A strip of biome 4 (grassland-side) never clusters.
    const noForest = clusterForestCells([4, 4, 4, 4, 4, 4], stripNeighbors, 6);
    expect(noForest).toHaveLength(0);
  });

  it('orders clusters by seedCell with contiguous ids', () => {
    // Two qualifying islands: 0-3 and 8-11.
    const biome = [6, 6, 6, 6, 3, 3, 3, 3, 9, 9, 9, 9];
    const clusters = clusterForestCells(biome, stripNeighbors, biome.length);
    expect(clusters.map((c) => c.id)).toEqual([0, 1]);
    expect(clusters.map((c) => c.seedCell)).toEqual([0, 8]);
    expect(clusters[1].cellIds).toEqual([8, 9, 10, 11]);
  });

  it('is deterministic: two runs produce identical output', () => {
    const a = clusterForestCells(STRIP_BIOME, stripNeighbors, STRIP_CELLS);
    const b = clusterForestCells(STRIP_BIOME, stripNeighbors, STRIP_CELLS);
    expect(a).toEqual(b);
  });
});

describe('assignForestKinds', () => {
  // Landmass 0 = cells < 1000, landmass 1 = cells >= 1000.
  const landmassOf = (cell: number) => (cell < 1000 ? 0 : 1);
  const noIsolation = () => 0;

  it('crowns exactly one ancient per landmass, preferring rainforest-rich over larger', () => {
    expect(ANCIENT_MIN_CELLS).toBe(24); // the fixture is built around this value
    const big = makeCluster(0, 30, 0);        // landmass 0, low rainforest share
    const rich = makeCluster(1, 25, 100);     // landmass 0, high rainforest share
    const small = makeCluster(2, 10, 200);    // landmass 0, below ancient threshold
    const island = makeCluster(3, 24, 1000);  // landmass 1, exactly at threshold
    const share = (c: ForestCluster) =>
      c.id === 1 ? 0.8 : c.id === 0 ? 0.1 : 0;
    const kinds = assignForestKinds([big, rich, small, island], {
      landmassOf, rainforestShare: share, isolation: noIsolation,
      rng: new SeededRandom(findSeed(90, 100)), // rolls land in the ordinary band
    });
    expect(kinds.get(1)).toBe('ancient');       // highest share wins on landmass 0
    expect(kinds.get(0)).not.toBe('ancient');   // bigger but poorer loses
    expect(kinds.get(3)).toBe('ancient');       // sole qualifier on landmass 1
    expect(kinds.get(2)).not.toBe('ancient');   // never ancient below threshold
    const ancientsOnLandmass0 = [0, 1, 2].filter((id) => kinds.get(id) === 'ancient');
    expect(ancientsOnLandmass0).toEqual([1]);   // uniqueness per landmass
  });

  it('breaks rainforest-share ties by most cells, then lowest id', () => {
    const a = makeCluster(0, 26, 0);
    const b = makeCluster(1, 30, 100); // same share, more cells -> wins
    const kinds = assignForestKinds([a, b], {
      landmassOf, rainforestShare: () => 0.5, isolation: noIsolation,
      rng: new SeededRandom(findSeed(90, 100)),
    });
    expect(kinds.get(1)).toBe('ancient');
    expect(kinds.get(0)).not.toBe('ancient');

    const c = makeCluster(0, 26, 0);
    const d = makeCluster(1, 26, 100); // full tie -> lowest id wins
    const kinds2 = assignForestKinds([c, d], {
      landmassOf, rainforestShare: () => 0.5, isolation: noIsolation,
      rng: new SeededRandom(findSeed(90, 100)),
    });
    expect(kinds2.get(0)).toBe('ancient');
  });

  it('rolls haunted inside the base band and fey in the band above it', () => {
    expect(HAUNTED_PERCENT).toBe(6);
    expect(FEY_PERCENT).toBe(4);
    const roller = makeCluster(0, FOREST_MIN_CELLS * 2, 0); // qualifies to roll
    const ctx = { landmassOf, rainforestShare: () => 0, isolation: noIsolation };
    // roll in [0,6) -> haunted
    const haunted = assignForestKinds([roller], { ...ctx, rng: new SeededRandom(findSeed(0, 6)) });
    expect(haunted.get(0)).toBe('haunted');
    // roll in [6,10) -> fey
    const fey = assignForestKinds([roller], { ...ctx, rng: new SeededRandom(findSeed(6, 10)) });
    expect(fey.get(0)).toBe('fey');
    // roll in [10,100) -> ordinary
    const ordinary = assignForestKinds([roller], { ...ctx, rng: new SeededRandom(findSeed(10, 100)) });
    expect(ordinary.get(0)).toBe('ordinary');
  });

  it('doubles the haunted band for isolated clusters (isolation > 0.5)', () => {
    const roller = makeCluster(0, FOREST_MIN_CELLS * 2, 0);
    // A roll in [10,12): outside both plain bands, inside the DOUBLED haunted band.
    const seed = findSeed(HAUNTED_PERCENT + FEY_PERCENT, HAUNTED_PERCENT * 2);
    const ctx = { landmassOf, rainforestShare: () => 0 };
    const plain = assignForestKinds([roller], { ...ctx, isolation: () => 0, rng: new SeededRandom(seed) });
    expect(plain.get(0)).toBe('ordinary');
    const isolated = assignForestKinds([roller], { ...ctx, isolation: () => 1, rng: new SeededRandom(seed) });
    expect(isolated.get(0)).toBe('haunted');
    // At the boundary (0.5) the band does NOT double.
    const boundary = assignForestKinds([roller], { ...ctx, isolation: () => 0.5, rng: new SeededRandom(seed) });
    expect(boundary.get(0)).toBe('ordinary');
  });

  it('excludes ancient clusters from rolls without consuming rng draws', () => {
    const ancient = makeCluster(0, ANCIENT_MIN_CELLS, 0);
    const roller = makeCluster(1, FOREST_MIN_CELLS * 2, 100);
    const seed = findSeed(0, HAUNTED_PERCENT); // FIRST draw is a haunted roll
    const kinds = assignForestKinds([ancient, roller], {
      landmassOf, rainforestShare: () => 0, isolation: noIsolation,
      rng: new SeededRandom(seed),
    });
    expect(kinds.get(0)).toBe('ancient');
    // The roller got the FIRST draw — the ancient cluster consumed nothing.
    expect(kinds.get(1)).toBe('haunted');
  });

  it('marks small clusters ordinary without a roll', () => {
    const small = makeCluster(0, FOREST_MIN_CELLS * 2 - 1, 0); // below the roll threshold
    const roller = makeCluster(1, FOREST_MIN_CELLS * 2, 100);
    const seed = findSeed(0, HAUNTED_PERCENT);
    const kinds = assignForestKinds([small, roller], {
      landmassOf, rainforestShare: () => 0, isolation: noIsolation,
      rng: new SeededRandom(seed),
    });
    expect(kinds.get(0)).toBe('ordinary');
    expect(kinds.get(1)).toBe('haunted'); // first draw went to the roller
  });

  it('is deterministic: same seed, same kinds', () => {
    const clusters = [
      makeCluster(0, 30, 0), makeCluster(1, 12, 100),
      makeCluster(2, 8, 200), makeCluster(3, 5, 300),
    ];
    const run = () => assignForestKinds(clusters, {
      landmassOf, rainforestShare: (c) => (c.id === 0 ? 0.4 : 0), isolation: (c) => (c.id === 2 ? 1 : 0),
      rng: new SeededRandom(4242),
    });
    expect([...run().entries()]).toEqual([...run().entries()]);
    // Every cluster got a kind.
    expect(run().size).toBe(clusters.length);
  });
});

describe('nameForest', () => {
  it('returns "<Adjective> <BankWord>" drawn from the requested bank', () => {
    const rng = new SeededRandom(7);
    const name = nameForest('ordinary', 'Elden', rng);
    const [adj, word] = name.split(' ');
    expect(adj).toBe('Elden');
    expect(FOREST_WORD_BANKS.ordinary).toContain(word);
  });

  it('draws taiga and jungle flavors from their own banks', () => {
    const taiga = nameForest('taiga', 'Norvik', new SeededRandom(11));
    expect(FOREST_WORD_BANKS.taiga).toContain(taiga.split(' ')[1]);
    const jungle = nameForest('jungle', 'Zamai', new SeededRandom(11));
    expect(FOREST_WORD_BANKS.jungle).toContain(jungle.split(' ')[1]);
  });

  it('covers a bank for every kind plus the two flavor banks', () => {
    const kinds: ForestKind[] = ['ordinary', 'ancient', 'haunted', 'fey'];
    for (const kind of kinds) expect(FOREST_WORD_BANKS[kind].length).toBeGreaterThan(0);
    expect(FOREST_WORD_BANKS.taiga.length).toBeGreaterThan(0);
    expect(FOREST_WORD_BANKS.jungle.length).toBeGreaterThan(0);
  });

  it('is rng-deterministic: same seed, same name', () => {
    expect(nameForest('haunted', 'Grim', new SeededRandom(99)))
      .toBe(nameForest('haunted', 'Grim', new SeededRandom(99)));
  });
});
