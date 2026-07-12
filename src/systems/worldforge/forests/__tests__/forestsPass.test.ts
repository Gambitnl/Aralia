/**
 * @file forestsPass.test.ts — unit tests for the world-gen forests pass
 * (forests campaign Task 2): pack.forests built from a crafted mini-pack,
 * plus the pack → AtlasForest adapter chain.
 *
 * The mini-pack is a hand-built adjacency strip (no Voronoi vertices). Each
 * forest's border gap cell points at a synthetic lake feature whose shoreline
 * is the forest's own first cell, so getIsolines takes its inner-lake skip on
 * every cluster and the pass exercises its documented seed-cell pole
 * FALLBACK deterministically. Real isoline poles are covered by the
 * fmgWorld.test.ts integration extension.
 */
import { describe, it, expect, vi } from 'vitest';
import { SeededRandom } from '../../../../utils/random/seededRandom';
import {
  dedupeForestNames,
  generateForests,
  type PackForest,
} from '../forestsPass';
import {
  FOREST_MIN_CELLS,
  FOREST_POI_MAX_PER_FOREST,
  FOREST_POI_PER_CELLS,
  FOREST_WORD_BANKS,
} from '../forestTunables';
import type { Pack } from '../../fmg/features';
import type { Marker } from '../../fmg/markers-generator';
import {
  buildAtlasArtifact,
  feetFromFmgPixel,
} from '../../adapter/atlasArtifact';
import type { WorldGenOptions } from '../../adapter/worldGenOptions';

// ---------------------------------------------------------------------------
// Mini-pack fixture: an 18-cell adjacency chain (plus a detached 2-cell copse).
//
//   cells   0  1  2  3 |  4    5 |  6  7  8  9 | 10   11 | 12 13 14 15 | 16 17
//   biome   6  6  8  7 |  3    3 |  9  9  9  9 |  3    3 |  7  7  5  6 |  6  6
//           forest A     gap  gap   forest B     gap  gap   forest C     copse
//
// A (cells 0-3, mixed biomes, no taiga/tropical majority) -> 'ordinary' bank.
// B (cells 6-9, all taiga)                                -> 'taiga' bank.
// C (cells 12-15, tropical majority 7/7/5)                -> 'jungle' bank.
// Copse (cells 16-17, size 2 < FOREST_MIN_CELLS)          -> anonymous.
// All clusters are 4 cells (< FOREST_MIN_CELLS * 2), so no kind rolls fire —
// every forest is 'ordinary' and the rng is consumed by name picks only.
// ---------------------------------------------------------------------------

const MINI_BIOME = [6, 6, 8, 7, 3, 3, 9, 9, 9, 9, 3, 3, 7, 7, 5, 6, 6, 6];
const MINI_CELL_COUNT = MINI_BIOME.length;

function makeMiniPack(): Pack {
  const chain = (i: number): number[] => {
    if (i === 16) return [17];
    if (i === 17) return [16];
    if (i === 0) return [1];
    if (i === 15) return [14];
    return [i - 1, i + 1];
  };

  // Feature ids: gap cells carry the lake features that trigger getIsolines'
  // inner-lake skip (see file header); everything else is a plain island.
  const f = new Uint16Array(MINI_CELL_COUNT).fill(5);
  f[4] = 1; // lake bordering forest A, shoreline = [0] (all forest A)
  f[5] = 2; // lake bordering forest B, shoreline = [6]
  f[10] = 3; // lake bordering forest B's far edge, shoreline = [6]
  f[11] = 4; // lake bordering forest C, shoreline = [12]

  const culture = new Uint16Array(MINI_CELL_COUNT);
  for (let i = 0; i <= 3; i++) culture[i] = 1;
  for (let i = 6; i <= 9; i++) culture[i] = 2;
  for (let i = 12; i <= 15; i++) culture[i] = 3;

  const burg = new Uint16Array(MINI_CELL_COUNT);
  burg[4] = 1; // a settlement on forest A's doorstep

  return {
    cells: {
      i: Uint32Array.from({ length: MINI_CELL_COUNT }, (_, i) => i),
      c: Array.from({ length: MINI_CELL_COUNT }, (_, i) => chain(i)),
      v: Array.from({ length: MINI_CELL_COUNT }, () => []),
      b: new Uint8Array(MINI_CELL_COUNT),
      p: Array.from({ length: MINI_CELL_COUNT }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(MINI_CELL_COUNT).fill(50),
      biome: Uint8Array.from(MINI_BIOME),
      f,
      culture,
      burg,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [0] },
      { type: 'lake', shoreline: [6] },
      { type: 'lake', shoreline: [6] },
      { type: 'lake', shoreline: [12] },
      { type: 'island' },
    ],
    cultures: [
      { name: 'Wildlands' },
      { name: 'Astel' },
      { name: 'Norvik' },
      { name: 'Zamai' },
    ],
  } as unknown as Pack;
}

/** Mirror of the pass's documented seed-hash contract (31-multiplier string
 * hash XOR 0x466f7265 "Fore") — pins the forests RNG stream. */
function forestsStreamSeed(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h ^ 0x466f7265) >>> 0;
}

describe('generateForests (mini-pack)', () => {
  it('writes pack.forests with 1-based ids, member cells, and drops copses', () => {
    const pack = makeMiniPack();
    expect(pack.forests).toBeUndefined();
    generateForests(pack, 'mini-seed');

    const forests = pack.forests!;
    expect(forests).toHaveLength(3);
    expect(forests.map((forest) => forest.i)).toEqual([1, 2, 3]);
    expect(forests.map((forest) => forest.cells)).toEqual([
      [0, 1, 2, 3],
      [6, 7, 8, 9],
      [12, 13, 14, 15],
    ]);
    // The 2-cell copse (16-17) never becomes a forest.
    const allCells = forests.flatMap((forest) => forest.cells);
    expect(allCells).not.toContain(16);
    expect(allCells).not.toContain(17);
  });

  it('places every forest cell in exactly one forest of at least minimum size', () => {
    const pack = makeMiniPack();
    generateForests(pack, 'mini-seed');
    const seen = new Set<number>();
    for (const forest of pack.forests!) {
      expect(forest.cells.length).toBeGreaterThanOrEqual(FOREST_MIN_CELLS);
      for (const cell of forest.cells) {
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
      }
    }
  });

  it('names forests from the seed cell culture + majority-biome bank on the pinned stream', () => {
    const pack = makeMiniPack();
    generateForests(pack, 'mini-seed');
    const [a, b, c] = pack.forests!;

    // Stream pin: no kind rolls fire (all clusters are 4 cells), so the
    // forests stream is consumed by name picks alone, in forest id order.
    const rng = new SeededRandom(forestsStreamSeed('mini-seed'));
    expect(a.name).toBe(`Astel ${rng.pick(FOREST_WORD_BANKS.ordinary)}`);
    expect(b.name).toBe(`Norvik ${rng.pick(FOREST_WORD_BANKS.taiga)}`);
    expect(c.name).toBe(`Zamai ${rng.pick(FOREST_WORD_BANKS.jungle)}`);

    for (const forest of pack.forests!) {
      expect(forest.name.length).toBeGreaterThan(0);
      expect(forest.kind).toBe('ordinary'); // no cluster reaches the roll size
    }
  });

  it('falls back to the seed-cell point when a forest has no isoline pole', () => {
    const pack = makeMiniPack();
    generateForests(pack, 'mini-seed');
    // Every cluster in this fixture skips its isoline (see file header), so
    // each pole is the seed cell's pack.cells.p point.
    expect(pack.forests!.map((forest) => forest.pole)).toEqual([
      [0, 5],
      [60, 5],
      [120, 5],
    ]);
  });

  it('is deterministic: same seed twice produces identical JSON', () => {
    const a = makeMiniPack();
    const b = makeMiniPack();
    generateForests(a, 'mini-seed');
    generateForests(b, 'mini-seed');
    expect(JSON.stringify(a.forests)).toBe(JSON.stringify(b.forests));
  });

  it('consumes no shared-stream randomness (world-preservation doctrine)', () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      generateForests(makeMiniPack(), 'mini-seed');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('writes an empty forests array when the world has no forest biomes', () => {
    const pack = makeMiniPack();
    pack.cells.biome!.fill(3); // all grassland
    generateForests(pack, 'mini-seed');
    expect(pack.forests).toEqual([]);
  });

  it('fails honestly when the biome layer is missing (no-fallback directive)', () => {
    const pack = makeMiniPack();
    delete (pack.cells as { biome?: Uint8Array }).biome;
    expect(() => generateForests(pack, 'mini-seed')).toThrow(/biome/i);
  });
});

describe('pack.forests → AtlasForest adapter chain', () => {
  const options = { width: 200, height: 100, winds: [] } as unknown as WorldGenOptions;
  const asInput = (pack: Pack) =>
    ({ pack, graphWidth: 200, graphHeight: 100 }) as unknown as Parameters<
      typeof buildAtlasArtifact
    >[0];

  it('mirrors forests onto the artifact: raw cellIds, feet-space poles', () => {
    const pack = makeMiniPack();
    generateForests(pack, 'mini-seed');
    const artifact = buildAtlasArtifact(asInput(pack), 1234, options);

    expect(artifact.forests).toHaveLength(3);
    artifact.forests.forEach((forest, idx) => {
      const source: PackForest = pack.forests![idx];
      expect(forest.id).toBe(source.i);
      expect(forest.name).toBe(source.name);
      expect(forest.kind).toBe(source.kind);
      // Cell-space data keeps raw pack cell ids (the AtlasRoute convention).
      expect(forest.cellIds).toEqual(source.cells);
      // Point data converts FMG px → world feet (the AtlasBurg convention).
      expect(forest.pole[0]).toBeCloseTo(feetFromFmgPixel(source.pole[0]), 6);
      expect(forest.pole[1]).toBeCloseTo(feetFromFmgPixel(source.pole[1]), 6);
    });
  });

  it('emits an empty forests list for packs generated without the pass', () => {
    const artifact = buildAtlasArtifact(asInput(makeMiniPack()), 1234, options);
    expect(artifact.forests).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 8a: forest POI marker placement (placeForestPois via generateForests).
//
// POI fixture: a 39-cell adjacency chain with THREE forests separated by
// two-cell lake gaps (the same inner-lake pole rig as the mini-pack above —
// every forest border cell's non-forest neighbor is a lake whose shoreline
// is that forest's own seed cell, so poles take the seed-cell fallback and
// the pass never walks the empty vertex arrays).
//
//   cells   0..19      | 20  21 | 22..29     | 30  31 | 32..38
//   biome   6 (forest)   3   3    6 (forest)   3   3    6 (forest)
//           forest A     lakes    forest B     lakes    forest C
//
// A: 20 cells -> qualifies (>= 2*FOREST_MIN_CELLS), max(1, floor(20/40)) = 1 POI.
// B:  8 cells -> qualifies exactly, max(1, floor(8/40)) = 1 POI.
// C:  7 cells -> a named forest, but BELOW the POI threshold: 0 POIs.
// No burg layer -> isolation 1 for every cluster, so A and B roll kinds with
// the doubled haunted band (12) + fey band (16); C is under the roll size.
// Interior cells (every neighbor in the same forest): A = 0..18 (19 borders
// lake 20), B = 23..28 (22 and 29 border lakes 21/30).
// ---------------------------------------------------------------------------

const POI_CELL_COUNT = 39;

function makePoiPack(): Pack {
  const chain = (i: number): number[] => {
    if (i === 0) return [1];
    if (i === POI_CELL_COUNT - 1) return [POI_CELL_COUNT - 2];
    return [i - 1, i + 1];
  };

  const biome = new Uint8Array(POI_CELL_COUNT).fill(3);
  for (let i = 0; i <= 19; i++) biome[i] = 6;
  for (let i = 22; i <= 29; i++) biome[i] = 6;
  for (let i = 32; i <= 38; i++) biome[i] = 6;

  const f = new Uint16Array(POI_CELL_COUNT).fill(5);
  f[20] = 1; // lake bordering forest A's far edge, shoreline = [0]
  f[21] = 2; // lake bordering forest B's near edge, shoreline = [22]
  f[30] = 3; // lake bordering forest B's far edge, shoreline = [22]
  f[31] = 4; // lake bordering forest C's near edge, shoreline = [32]

  const culture = new Uint16Array(POI_CELL_COUNT);
  for (let i = 0; i <= 19; i++) culture[i] = 1;
  for (let i = 22; i <= 29; i++) culture[i] = 2;
  for (let i = 32; i <= 38; i++) culture[i] = 3;

  return {
    cells: {
      i: Uint32Array.from({ length: POI_CELL_COUNT }, (_, i) => i),
      c: Array.from({ length: POI_CELL_COUNT }, (_, i) => chain(i)),
      v: Array.from({ length: POI_CELL_COUNT }, () => []),
      b: new Uint8Array(POI_CELL_COUNT),
      p: Array.from({ length: POI_CELL_COUNT }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(POI_CELL_COUNT).fill(50),
      biome,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [0] },
      { type: 'lake', shoreline: [22] },
      { type: 'lake', shoreline: [22] },
      { type: 'lake', shoreline: [32] },
      { type: 'island' },
    ],
    cultures: [
      { name: 'Wildlands' },
      { name: 'Astel' },
      { name: 'Norvik' },
      { name: 'Zamai' },
    ],
  } as unknown as Pack;
}

/** One 10-cell forest (0..9) bordered by a single lake gap cell (10), no
 * burgs (isolation 1 -> haunted band 12). Interior = cells 0..8 (cell 9
 * borders the lake). Used with pinned seeds for exact-draw proofs. */
function makeHauntedPack(): Pack {
  const n = 11;
  const chain = (i: number): number[] => {
    if (i === 0) return [1];
    if (i === n - 1) return [n - 2];
    return [i - 1, i + 1];
  };
  const biome = new Uint8Array(n).fill(6);
  biome[10] = 3;
  const f = new Uint16Array(n).fill(2);
  f[10] = 1;
  const culture = new Uint16Array(n);
  for (let i = 0; i <= 9; i++) culture[i] = 1;
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(n).fill(50),
      biome,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [0, { type: 'lake', shoreline: [0] }, { type: 'island' }],
    cultures: [{ name: 'Wildlands' }, { name: 'Grim' }],
  } as unknown as Pack;
}

/** An 8-cell forest chain (0..7) where EVERY cell also neighbors the lake
 * gap cell 8 — so no cell is interior and the POI cell pick must take its
 * documented fallback to the whole (sorted) cluster. */
function makeFallbackPack(): Pack {
  const n = 9;
  const adjacency = (i: number): number[] => {
    if (i === 8) return [0, 1, 2, 3, 4, 5, 6, 7];
    if (i === 0) return [1, 8];
    if (i === 7) return [6, 8];
    return [i - 1, i + 1, 8];
  };
  const biome = new Uint8Array(n).fill(6);
  biome[8] = 3;
  const f = new Uint16Array(n).fill(2);
  f[8] = 1;
  const culture = new Uint16Array(n);
  for (let i = 0; i <= 7; i++) culture[i] = 1;
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => adjacency(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(n).fill(50),
      biome,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [0, { type: 'lake', shoreline: [0] }, { type: 'island' }],
    cultures: [{ name: 'Wildlands' }, { name: 'Moor' }],
  } as unknown as Pack;
}

/** One n-cell forest chain (0..n-1) bordered by a single lake gap cell (n),
 * for density/cap coverage: interior = 0..n-2 (cell n-1 borders the lake). */
function makeLongForestPack(forestCells: number): Pack {
  const n = forestCells + 1;
  const chain = (i: number): number[] => {
    if (i === 0) return [1];
    if (i === n - 1) return [n - 2];
    return [i - 1, i + 1];
  };
  const biome = new Uint8Array(n).fill(6);
  biome[n - 1] = 3;
  const f = new Uint16Array(n).fill(2);
  f[n - 1] = 1;
  const culture = new Uint16Array(n);
  for (let i = 0; i < forestCells; i++) culture[i] = 1;
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(n).fill(50),
      biome,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [0, { type: 'lake', shoreline: [0] }, { type: 'island' }],
    cultures: [{ name: 'Wildlands' }, { name: 'Longwood' }],
  } as unknown as Pack;
}

const markersOf = (pack: Pack): Marker[] | undefined =>
  (pack as Pack & { markers?: Marker[] }).markers;

/** The POI type contract: weight-expanded pick pool in declaration order
 * (hunter-camp x4, forest-shrine x3, hermit-hollow x2, beast-den x3 — x6 in
 * haunted forests). Hardcoded here on purpose: the test pins the contract,
 * not the implementation's constants. */
function expandedPool(kind: string): string[] {
  const weights: Array<[string, number]> = [
    ['hunter-camp', 4],
    ['forest-shrine', 3],
    ['hermit-hollow', 2],
    ['beast-den', kind === 'haunted' ? 6 : 3],
  ];
  const pool: string[] = [];
  for (const [type, weight] of weights) {
    for (let k = 0; k < weight; k++) pool.push(type);
  }
  return pool;
}

const POI_ICONS: Record<string, string> = {
  'hunter-camp': '🏕️',
  'hermit-hollow': '🛖',
  'forest-shrine': '⛩️',
  'beast-den': '🐾',
};

describe('generateForests — forest POI markers (Task 8a)', () => {
  it('places min(cap, max(1, floor(cells / FOREST_POI_PER_CELLS))) POIs per qualifying forest only', () => {
    const pack = makePoiPack();
    generateForests(pack, 'poi-mini-seed');
    const forests = pack.forests!;
    expect(forests.map((forest) => forest.cells.length)).toEqual([20, 8, 7]);

    const markers = markersOf(pack)!;
    expect(markers).toBeDefined();
    const countFor = (forest: PackForest) =>
      markers.filter((m) => forest.cells.includes(m.cell)).length;
    const expectedFor = (forest: PackForest) =>
      forest.cells.length >= FOREST_MIN_CELLS * 2
        ? Math.min(
            FOREST_POI_MAX_PER_FOREST,
            Math.max(1, Math.floor(forest.cells.length / FOREST_POI_PER_CELLS)),
          )
        : 0;
    expect(forests.map(countFor)).toEqual(forests.map(expectedFor));
    expect(forests.map(countFor)).toEqual([1, 1, 0]); // the fixture's numbers
    expect(markers).toHaveLength(2); // every marker belongs to some forest
  });

  it('caps POIs at FOREST_POI_MAX_PER_FOREST and scales by FOREST_POI_PER_CELLS', () => {
    // 250 cells -> floor(250/40) = 6, capped to 5; 80 cells -> exactly 2.
    const capped = makeLongForestPack(250);
    generateForests(capped, 'poi-long-seed');
    expect(markersOf(capped)!).toHaveLength(FOREST_POI_MAX_PER_FOREST);
    expect(new Set(markersOf(capped)!.map((m) => m.cell)).size).toBe(
      FOREST_POI_MAX_PER_FOREST,
    );

    const scaled = makeLongForestPack(80);
    generateForests(scaled, 'poi-long-seed');
    expect(markersOf(scaled)!).toHaveLength(2);
  });

  it('prefers interior cells and never places two POIs on one cell', () => {
    const pack = makePoiPack();
    generateForests(pack, 'poi-mini-seed');
    const markers = markersOf(pack)!;
    // Interior = every neighbor in the same forest: A -> 0..18, B -> 23..28.
    const interior = new Set<number>();
    for (let i = 0; i <= 18; i++) interior.add(i);
    for (let i = 23; i <= 28; i++) interior.add(i);
    for (const m of markers) expect(interior.has(m.cell)).toBe(true);
    expect(new Set(markers.map((m) => m.cell)).size).toBe(markers.length);
  });

  it('falls back to edge cells when a qualifying forest has no interior cells', () => {
    const pack = makeFallbackPack();
    generateForests(pack, 'poi-fallback-seed');
    const forests = pack.forests!;
    expect(forests).toHaveLength(1);
    expect(forests[0].cells).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const markers = markersOf(pack)!;
    expect(markers).toHaveLength(1); // max(1, floor(8/40)) = 1
    expect(forests[0].cells).toContain(markers[0].cell);
  });

  it('never places a POI on a cell that already carries a marker', () => {
    // Occupy every interior cell (0..8) but cell 8 — the pick is FORCED to 8
    // regardless of the seed, proving occupied cells leave the candidate set.
    const pack = makeHauntedPack();
    const prior: Marker[] = Array.from({ length: 8 }, (_, k) => ({
      i: k,
      type: 'encounters',
      icon: '!',
      x: k * 10,
      y: 5,
      cell: k,
    }));
    (pack as Pack & { markers?: Marker[] }).markers = prior;
    generateForests(pack, 'poi-occupied-seed');
    const markers = markersOf(pack)!;
    expect(markers).toHaveLength(9);
    expect(markers[8].cell).toBe(8); // the only free interior cell
    expect(markers[8].i).toBe(8); // ids continue from the occupied block
  });

  it('falls back past occupied interiors to a free edge cell', () => {
    // Occupy ALL interior cells (0..8): interior candidates empty, so the
    // pick must fall back to the cluster's only free cell — edge cell 9.
    const pack = makeHauntedPack();
    const prior: Marker[] = Array.from({ length: 9 }, (_, k) => ({
      i: k,
      type: 'encounters',
      icon: '!',
      x: k * 10,
      y: 5,
      cell: k,
    }));
    (pack as Pack & { markers?: Marker[] }).markers = prior;
    generateForests(pack, 'poi-occupied-seed');
    const markers = markersOf(pack)!;
    expect(markers).toHaveLength(10);
    expect(markers[9].cell).toBe(9); // forced: everything else is occupied
  });

  it('doubles the beast-den weight in haunted forests (exact pinned-seed proof)', () => {
    // Seed picked (2026-07-11 search) so the single kind roll lands haunted
    // (roll 7 < band 12) AND the type draw u≈0.692 falls where the 15-slot
    // haunted pool and the 12-slot ordinary pool DISAGREE: haunted index 10 is
    // beast-den, while the same draw on the ordinary pool (index 8) would be
    // hermit-hollow — the doubled weight visibly changes the outcome.
    const seed = 'poi-haunted-1029';
    const pack = makeHauntedPack();
    generateForests(pack, seed);

    const [forest] = pack.forests!;
    expect(forest.kind).toBe('haunted');
    const markers = markersOf(pack)!;
    expect(markers).toHaveLength(1);
    expect(markers[0].type).toBe('beast-den');
    expect(markers[0].icon).toBe('🐾');

    // Replay the forests stream to the type draw and prove the divergence.
    const rng = new SeededRandom(forestsStreamSeed(seed));
    expect(rng.nextInt(0, 100)).toBeLessThan(12); // kind roll -> haunted
    rng.pick(FOREST_WORD_BANKS.haunted); // name pick
    rng.nextInt(0, 9); // cell pick over the 9 interior cells (0..8)
    const u = rng.next(); // the type draw
    expect(expandedPool('haunted')[Math.floor(u * 15)]).toBe('beast-den');
    expect(expandedPool('ordinary')[Math.floor(u * 12)]).toBe('hermit-hollow');
  });

  it('draws POIs strictly AFTER all kind and name draws (full stream mirror)', () => {
    const seed = 'poi-mini-seed';
    const pack = makePoiPack();
    generateForests(pack, seed);
    const forests = pack.forests!;
    const markers = markersOf(pack)!;

    // Mirror the forests stream draw-for-draw. If the implementation drew
    // POIs before (or between) the kind/name draws, every pick below shifts
    // and this test fails — which is exactly the Task-2 stream contract.
    const rng = new SeededRandom(forestsStreamSeed(seed));
    const kindFor = (roll: number): 'haunted' | 'fey' | 'ordinary' =>
      roll < 12 ? 'haunted' : roll < 16 ? 'fey' : 'ordinary';
    const kindA = kindFor(rng.nextInt(0, 100)); // A (20 cells) rolls
    const kindB = kindFor(rng.nextInt(0, 100)); // B (8 cells) rolls; C skips
    const nameA = `Astel ${rng.pick(FOREST_WORD_BANKS[kindA])}`;
    const nameB = `Norvik ${rng.pick(FOREST_WORD_BANKS[kindB])}`;
    const nameC = `Zamai ${rng.pick(FOREST_WORD_BANKS.ordinary)}`;
    expect(forests.map((forest) => forest.name)).toEqual([nameA, nameB, nameC]);
    expect([forests[0].kind, forests[1].kind]).toEqual([kindA, kindB]);

    // POI draws continue the SAME stream: per forest in id order (A then B,
    // one POI each under the retuned density), one cell pick then one type
    // pick per POI, candidates sorted by cell id.
    const pickCell = (candidates: number[]) =>
      candidates[rng.nextInt(0, candidates.length)];
    const pickType = (pool: string[]) => pool[rng.nextInt(0, pool.length)];
    const expected: Array<{ cell: number; type: string }> = [];

    const interiorA = forests[0].cells.filter((c) => c !== 19); // 19 = edge
    expected.push({ cell: pickCell(interiorA), type: pickType(expandedPool(kindA)) });

    const interiorB = forests[1].cells.filter((c) => c !== 22 && c !== 29);
    expected.push({ cell: pickCell(interiorB), type: pickType(expandedPool(kindB)) });

    expect(markers.map((m) => ({ cell: m.cell, type: m.type }))).toEqual(expected);
  });

  it('continues marker ids from the existing max and never touches prior markers', () => {
    const pack = makePoiPack();
    const prior: Marker[] = [
      { i: 3, type: 'volcanoes', icon: 'V', x: 1, y: 2, cell: 20 },
      { i: 7, type: 'inns', icon: 'I', x: 3, y: 4, cell: 21 },
    ];
    (pack as Pack & { markers?: Marker[] }).markers = prior;
    const priorSnapshot = JSON.parse(JSON.stringify(prior)) as Marker[];

    generateForests(pack, 'poi-mini-seed');
    const markers = markersOf(pack)!;
    expect(markers).toHaveLength(4); // 2 prior + one POI each for A and B
    expect(markers.slice(0, 2)).toEqual(priorSnapshot); // byte-identical
    expect(markers.slice(2).map((m) => m.i)).toEqual([8, 9]); // max 7 + 1
  });

  it('creates pack.markers when absent and stamps the FMG marker shape', () => {
    const pack = makePoiPack();
    expect(markersOf(pack)).toBeUndefined();
    generateForests(pack, 'poi-mini-seed');
    const markers = markersOf(pack)!;
    expect(markers.length).toBeGreaterThan(0);
    markers.forEach((m, idx) => {
      expect(m.i).toBe(idx); // fresh array counts from 0
      expect(Object.keys(POI_ICONS)).toContain(m.type);
      expect(m.icon).toBe(POI_ICONS[m.type]);
      expect(m.x).toBe(pack.cells.p[m.cell][0]);
      expect(m.y).toBe(pack.cells.p[m.cell][1]);
    });
  });

  it('leaves pack.markers absent when no forest qualifies for POIs', () => {
    const pack = makeMiniPack(); // every Task-2 cluster is 4 cells (< 8)
    generateForests(pack, 'mini-seed');
    expect(markersOf(pack)).toBeUndefined();
  });

  it('is deterministic: same seed twice produces identical markers', () => {
    const a = makePoiPack();
    const b = makePoiPack();
    generateForests(a, 'poi-mini-seed');
    generateForests(b, 'poi-mini-seed');
    expect(JSON.stringify(markersOf(a))).toBe(JSON.stringify(markersOf(b)));
  });

  it('POI placement consumes no shared-stream randomness', () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      const pack = makePoiPack();
      generateForests(pack, 'poi-mini-seed');
      expect(markersOf(pack)!.length).toBeGreaterThan(0); // placement DID run
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Task 9: spur retargeting onto forest POIs (retargetSpursToPois via
// generateForests). Retargeting is PURE GEOMETRY — zero draws on any stream —
// so every stream-pin test above (names, full stream mirror) must stay green
// UNMODIFIED; that is the binding zero-RNG proof.
//
// Spur fixture: a 7-cell world — village 0, grass gap 1, forest 2..5, and a
// WATER cell 6 (h=10) that shortcuts 0↔5. Cell 6 is listed FIRST in the
// village's neighbor array, so a BFS that forgot the land filter would reach
// the far forest in one hop through it. The 4-cell forest is below the POI
// threshold (< 2*FOREST_MIN_CELLS), so the pass places no POIs of its own —
// tests hand-place markers for full control. Border cells 1 and 6 carry the
// usual synthetic-lake features (shoreline = forest seed cell 2) so the pole
// walk takes its inner-lake skip, as in every fixture above.
//
//   cell    0        1      2  3  4  5      6
//   biome   3        3      6  6  6  6      0 (water, h=10)
//   role  village   gap     forest.....    water shortcut 0<->5
// ---------------------------------------------------------------------------

function makeSpurPack(): Pack {
  const n = 7;
  const adjacency = (i: number): number[] => {
    if (i === 0) return [6, 1]; // water shortcut listed FIRST on purpose
    if (i === 5) return [4, 6];
    if (i === 6) return [0, 5];
    return [i - 1, i + 1];
  };
  const biome = Uint8Array.from([3, 3, 6, 6, 6, 6, 0]);
  const h = new Uint8Array(n).fill(50);
  h[6] = 10; // the shortcut is open water
  const f = Uint16Array.from([3, 1, 3, 3, 3, 3, 2]);
  const culture = new Uint16Array(n);
  for (let i = 2; i <= 5; i++) culture[i] = 1;
  const burg = new Uint16Array(n);
  burg[0] = 1; // the village the spur starts from
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => adjacency(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h,
      biome,
      f,
      culture,
      burg,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [2] },
      { type: 'lake', shoreline: [2] },
      { type: 'island' },
    ],
    cultures: [{ name: 'Wildlands' }, { name: 'Spurwood' }],
    routes: [
      // Control: a non-paths route retargeting must NEVER touch.
      { i: 0, group: 'highways', feature: 3, points: [[0, 5, 0], [10, 5, 1]] },
      // The village forest spur. First point is BURG-ADJUSTED ([3,7] is the
      // burg's position, deliberately != cells.p[0] = [0,5]); original target
      // is forest cell 3 (no POI there).
      {
        i: 1,
        group: 'paths',
        feature: 3,
        points: [[3, 7, 0], [10, 5, 1], [20, 5, 2], [30, 5, 3]],
      },
    ],
  } as unknown as Pack;
}

/** Tie fixture: village 0 with TWO depth-1 forest POI cells, neighbor array
 * [1, 2]. Both copses are below forest-min size, so pack.forests is empty and
 * the only draw-free stage that acts is the retarget itself. */
function makeTiePack(): Pack {
  const n = 3;
  const adjacency = (i: number): number[] => (i === 0 ? [1, 2] : [0]);
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => adjacency(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(n).fill(50),
      biome: Uint8Array.from([3, 6, 6]),
      f: new Uint16Array(n).fill(1),
      culture: new Uint16Array(n),
      burg: Uint16Array.from([1, 0, 0]),
    },
    vertices: { p: [], v: [], c: [] },
    features: [0, { type: 'island' }],
    cultures: [{ name: 'Wildlands' }],
    routes: [
      { i: 0, group: 'paths', feature: 1, points: [[0, 5, 0], [20, 5, 2]] },
    ],
  } as unknown as Pack;
}

/** Out-of-range fixture: a 439-cell land chain — village 0, grass out to 432,
 * a 4-cell forest at 434..437 (lake-trick borders 433/438). The nearest POI
 * cell (437) is discovered only when dequeuing cell 436 — visit 437, beyond
 * the 400-visited BFS bound the retarget mirrors from generatePaths. */
function makeFarPoiPack(): Pack {
  const n = 439;
  const chain = (i: number): number[] => {
    if (i === 0) return [1];
    if (i === n - 1) return [n - 2];
    return [i - 1, i + 1];
  };
  const biome = new Uint8Array(n).fill(3);
  for (let i = 434; i <= 437; i++) biome[i] = 6;
  const f = new Uint16Array(n).fill(3);
  f[433] = 1;
  f[438] = 2;
  const culture = new Uint16Array(n);
  for (let i = 434; i <= 437; i++) culture[i] = 1;
  const burg = new Uint16Array(n);
  burg[0] = 1;
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h: new Uint8Array(n).fill(50),
      biome,
      f,
      culture,
      burg,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [434] },
      { type: 'lake', shoreline: [434] },
      { type: 'island' },
    ],
    cultures: [{ name: 'Wildlands' }, { name: 'Farwood' }],
    routes: [
      // A short dead-end spur; with no POI in range it must stay VERBATIM.
      {
        i: 0,
        group: 'paths',
        feature: 3,
        points: [[3, 7, 0], [10, 5, 1], [20, 5, 2]],
      },
    ],
  } as unknown as Pack;
}

const shrineAt = (cell: number, i = 0): Marker => ({
  i,
  type: 'forest-shrine',
  icon: '⛩️',
  x: cell * 10,
  y: 5,
  cell,
});

const campAt = (cell: number, i = 0): Marker => ({
  i,
  type: 'hunter-camp',
  icon: '🏕️',
  x: cell * 10,
  y: 5,
  cell,
});

const routeCellsOf = (pack: Pack, idx: number): number[] =>
  pack.routes![idx].points.map((p) => p[2]);

describe('generateForests — spur retargeting onto forest POIs (Task 9)', () => {
  it('retargets a village spur onto the BFS-nearest POI over land only, first point verbatim', () => {
    const pack = makeSpurPack();
    (pack as Pack & { markers?: Marker[] }).markers = [shrineAt(5)];
    const highwaysBefore = JSON.parse(JSON.stringify(pack.routes![0]));

    generateForests(pack, 'spur-seed');

    const spur = pack.routes![1];
    // Rebuilt village→POI chain, positions from cells.p — EXCEPT the first
    // point, which keeps the burg-adjusted original verbatim.
    expect(spur.points).toEqual([
      [3, 7, 0],
      [10, 5, 1],
      [20, 5, 2],
      [30, 5, 3],
      [40, 5, 4],
      [50, 5, 5],
    ]);
    const cells = routeCellsOf(pack, 1);
    expect(cells[cells.length - 1]).toBe(5); // ends ON the POI cell
    expect(cells).not.toContain(6); // the water shortcut is never walked
    // The chain is a real path: consecutive cells are neighbors.
    for (let i = 0; i < cells.length - 1; i++) {
      expect(pack.cells.c![cells[i]]).toContain(cells[i + 1]);
    }
    // Only points changed; identity fields stay.
    expect(spur.i).toBe(1);
    expect(spur.group).toBe('paths');
    expect(spur.feature).toBe(3);
    // Non-paths routes are untouched, markers are not consumed or moved.
    expect(pack.routes![0]).toEqual(highwaysBefore);
    expect((pack as Pack & { markers?: Marker[] }).markers).toEqual([shrineAt(5)]);
    // The pass itself still ran in full (forest named as usual).
    expect(pack.forests).toHaveLength(1);
  });

  it('picks the nearer of two POIs by BFS depth', () => {
    const pack = makeSpurPack();
    (pack as Pack & { markers?: Marker[] }).markers = [
      shrineAt(5, 0),
      campAt(4, 1), // one cell nearer to the village than the shrine
    ];
    generateForests(pack, 'spur-seed');
    const cells = routeCellsOf(pack, 1);
    expect(cells).toEqual([0, 1, 2, 3, 4]); // stops at the camp, not the shrine
  });

  it('breaks equal-depth ties by neighbor visit order', () => {
    // POIs on cells 1 AND 2, both at BFS depth 1 from the village; the
    // village's neighbor array is [1, 2], so 1 is discovered first and wins.
    // (The original spur targeted 2 — the assert proves retargeting fired.)
    const pack = makeTiePack();
    (pack as Pack & { markers?: Marker[] }).markers = [
      shrineAt(1, 0),
      campAt(2, 1),
    ];
    generateForests(pack, 'tie-seed');
    expect(routeCellsOf(pack, 0)).toEqual([0, 1]);
  });

  it('leaves the spur untouched when the only POI is beyond the 400-visited BFS bound', () => {
    const pack = makeFarPoiPack();
    (pack as Pack & { markers?: Marker[] }).markers = [shrineAt(437)];
    const before = JSON.parse(JSON.stringify(pack.routes));
    generateForests(pack, 'far-seed');
    expect(pack.routes).toEqual(before); // dead-end spur remains, verbatim
  });

  it('leaves routes untouched when the world has no POI markers at all', () => {
    const pack = makeSpurPack(); // no markers hand-placed, none self-placed
    const before = JSON.parse(JSON.stringify(pack.routes));
    generateForests(pack, 'spur-seed');
    expect(pack.routes).toEqual(before);
  });

  it('is deterministic: same seed twice produces identical retargeted routes', () => {
    const a = makeSpurPack();
    const b = makeSpurPack();
    (a as Pack & { markers?: Marker[] }).markers = [shrineAt(5)];
    (b as Pack & { markers?: Marker[] }).markers = [shrineAt(5)];
    generateForests(a, 'spur-seed');
    generateForests(b, 'spur-seed');
    expect(JSON.stringify(a.routes)).toBe(JSON.stringify(b.routes));
    expect(JSON.stringify(a.forests)).toBe(JSON.stringify(b.forests));
  });

  it('consumes no shared-stream randomness while actually retargeting', () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      const pack = makeSpurPack();
      (pack as Pack & { markers?: Marker[] }).markers = [shrineAt(5)];
      generateForests(pack, 'spur-seed');
      expect(routeCellsOf(pack, 1)).toHaveLength(6); // retargeting DID fire
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Duplicate forest names → geographic suffix (Remy ruling 2026-07-11, closing
// the forests campaign). dedupeForestNames is PURE GEOMETRY — zero draws on
// any stream — slotted between naming and POI placement, so every stream-pin
// test above (names, full stream mirror) stays green UNMODIFIED.
//
// Compass convention mirrors navDrift's bearingToDirection with full words:
// atlas y grows DOWN (SVG), so north is −y; 8 buckets counter-clockwise from
// East at 45° each.
// ---------------------------------------------------------------------------

/** Crafted PackForest for the pure dedup tests — only the fields the dedup
 * reads (i, name, cells.length, pole) carry meaning. */
const forestNamed = (
  i: number,
  name: string,
  pole: [number, number],
  cellCount = 4,
): PackForest => ({
  i,
  name,
  kind: 'ordinary',
  cells: Array.from({ length: cellCount }, (_, k) => i * 100 + k),
  pole,
});

/** Dup fixture: TWO 4-cell ordinary-bank clusters (0-3 and 6-9) sharing ONE
 * culture ('Astel'), built on the mini-pack's lake-gap pole rig so each pole
 * takes the seed-cell fallback: pole A = p[0] = [50,50], pole B = p[6] =
 * [50,10] — forest B sits due NORTH of forest A (y grows down). Both clusters
 * are below the kind-roll size, so the forests stream is exactly two ordinary
 * name picks. */
function makeDupPack(): Pack {
  const n = 10;
  const chain = (i: number): number[] => {
    if (i === 0) return [1];
    if (i === n - 1) return [n - 2];
    return [i - 1, i + 1];
  };
  const biome = Uint8Array.from([6, 6, 6, 6, 3, 3, 6, 6, 6, 6]);
  const f = new Uint16Array(n).fill(3);
  f[4] = 1; // lake bordering forest A, shoreline = [0] (A's seed cell)
  f[5] = 2; // lake bordering forest B, shoreline = [6] (B's seed cell)
  const culture = new Uint16Array(n);
  for (const c of [0, 1, 2, 3, 6, 7, 8, 9]) culture[c] = 1;
  const p = Array.from({ length: n }, (_, i) => [i * 10, 5] as [number, number]);
  p[0] = [50, 50]; // forest A's pole (seed-cell fallback)
  p[6] = [50, 10]; // forest B's pole — due north of A's
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p,
      h: new Uint8Array(n).fill(50),
      biome,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [0] },
      { type: 'lake', shoreline: [6] },
      { type: 'island' },
    ],
    cultures: [{ name: 'Wildlands' }, { name: 'Astel' }],
  } as unknown as Pack;
}

describe('dedupeForestNames — duplicate names gain a geographic suffix', () => {
  it('keeps the bare name on the lowest id and suffixes the rest by 8-way pole bearing', () => {
    // Ids deliberately out of array order: the LOWEST id keeps the bare name
    // regardless of position. Members sit due north (−y), due west (−x), and
    // exactly southeast (+x,+y) of the keeper's pole [100,100].
    const forests = [
      forestNamed(4, 'Astel Weald', [100, 60]), // dy=-40 → North
      forestNamed(2, 'Astel Weald', [100, 100]), // lowest id — keeper
      forestNamed(7, 'Astel Weald', [60, 100]), // dx=-40 → West
      forestNamed(9, 'Astel Weald', [140, 140]), // dx=+40,dy=+40 → Southeast
    ];
    dedupeForestNames(forests);
    expect(forests.map((f) => f.name)).toEqual([
      'Astel Weald of the North',
      'Astel Weald',
      'Astel Weald of the West',
      'Astel Weald of the Southeast',
    ]);
  });

  it('falls back to Greater/Lesser when two members land the same compass word', () => {
    // Three-way collision: both non-keepers sit due north of the keeper, so
    // the second (higher id) cannot take "of the North" again. It compares
    // cell counts against the first claimant: larger → Greater.
    const bigger = [
      forestNamed(1, 'Norvik Pinewood', [100, 100], 4), // keeper
      forestNamed(2, 'Norvik Pinewood', [100, 60], 6), // North, first claimant
      forestNamed(3, 'Norvik Pinewood', [100, 20], 10), // North again, larger
    ];
    dedupeForestNames(bigger);
    expect(bigger.map((f) => f.name)).toEqual([
      'Norvik Pinewood',
      'Norvik Pinewood of the North',
      'Norvik Pinewood the Greater',
    ]);

    const smaller = [
      forestNamed(1, 'Norvik Pinewood', [100, 100], 4),
      forestNamed(2, 'Norvik Pinewood', [100, 60], 6),
      forestNamed(3, 'Norvik Pinewood', [100, 20], 5), // North again, smaller
    ];
    dedupeForestNames(smaller);
    expect(smaller[2].name).toBe('Norvik Pinewood the Lesser');
  });

  it('leaves a world without duplicate names untouched (deep-equal)', () => {
    const forests = [
      forestNamed(1, 'Astel Weald', [10, 10]),
      forestNamed(2, 'Norvik Taiga', [50, 10]),
      forestNamed(3, 'Zamai Jungle', [90, 10]),
    ];
    const before = JSON.parse(JSON.stringify(forests)) as PackForest[];
    dedupeForestNames(forests);
    expect(forests).toEqual(before);
  });

  it('generateForests dedups duplicate names between naming and POIs (pinned seed)', () => {
    // Seed picked (2026-07-11 search): both ordinary name picks on the
    // 'dup-seed-0' forests stream land 'Weald', so the two same-culture
    // clusters collide as "Astel Weald" before dedup.
    const seed = 'dup-seed-0';
    const pack = makeDupPack();
    generateForests(pack, seed);

    // Replay guard: the stream really does produce the duplicate raw names.
    const rng = new SeededRandom(forestsStreamSeed(seed));
    expect(rng.pick(FOREST_WORD_BANKS.ordinary)).toBe('Weald');
    expect(rng.pick(FOREST_WORD_BANKS.ordinary)).toBe('Weald');

    // Forest 1 (lowest id) keeps the bare name; forest 2's pole [50,10] is
    // due north of forest 1's [50,50] (atlas y grows down).
    expect(pack.forests!.map((f) => f.name)).toEqual([
      'Astel Weald',
      'Astel Weald of the North',
    ]);
    expect(pack.forests!.map((f) => f.pole)).toEqual([
      [50, 50],
      [50, 10],
    ]);
  });

  it('dedup consumes no randomness on any stream (pure geometry)', () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      const pack = makeDupPack();
      generateForests(pack, 'dup-seed-0');
      // The rename DID fire...
      expect(pack.forests![1].name).toBe('Astel Weald of the North');
      // ...with zero shared-stream draws, and the forests-stream draw count
      // is unchanged: the two name picks above are the whole stream, which
      // the pinned-seed replay in the previous test already mirrors.
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
