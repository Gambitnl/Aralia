/**
 * @file mountainsPass.test.ts — unit tests for the world-gen mountains pass
 * (mountains campaign Tasks 2 + 4): pack.ranges + pack.peaks built from a
 * crafted mini-pack, marker-name adoption for peaks, the shared geographic
 * dedup on range names, pass detection + naming on crafted routes, and the
 * pack → AtlasRange/AtlasPeak/AtlasPass adapter chain.
 *
 * The mini-pack is a hand-built adjacency strip (no Voronoi vertices), the
 * forestsPass.test.ts rig: each range's border gap cell points at a synthetic
 * lake feature whose shoreline is the range's own seed cell, so getIsolines
 * takes its inner-lake skip on every cluster and the pass exercises its
 * documented seed-cell pole FALLBACK deterministically. Real isoline poles
 * are covered by the fmgWorld.test.ts integration extension.
 */
import { describe, it, expect, vi } from 'vitest';
import { SeededRandom } from '../../../../utils/random/seededRandom';
import { generateMountains, type PackRange, type PackPeak } from '../mountainsPass';
import { RANGE_WORD_BANKS, PEAK_NAME_FORMS } from '../mountainTunables';
import type { Pack } from '../../fmg/features';
import type { Marker } from '../../fmg/markers-generator';
import type { Route } from '../../fmg/routes-generator';
import {
  buildAtlasArtifact,
  feetFromFmgPixel,
} from '../../adapter/atlasArtifact';
import type { WorldGenOptions } from '../../adapter/worldGenOptions';

// ---------------------------------------------------------------------------
// Mini-pack fixture: a 24-cell adjacency chain.
//
//   cells   0   1   2   3   4 |  5   6 |  7   8   9  10  11 | 12  13 | 14  15  16  17  18 | 19 | 20  21  22 | 23
//   h      55  60  75  60  55 | 10  10 | 55  60  65  60  55 | 10  10 | 55  75  60  78  55 | 10 | 55  55  55 | 10
//          range A (peak 2)     gaps     range B (no core)    gaps     range C (peaks 17,15) gap  hills (drop)
//
// A (cells 0-4, core [2])   -> kind 'range';   ONE peak: cell 2 (75).
// B (cells 7-11, no core)   -> kind 'highlands'; no peaks.
// C (cells 14-18, core [15,17]) -> volcano marker on 17 -> kind 'volcanic';
//    peaks in findPeaks order [17 (78), 15 (75)].
// Hills (cells 20-22, size 3 < RANGE_MIN_CELLS) -> anonymous, dropped.
//
// Markers (FMG-shaped, crafted): a volcano on peak cell 17 (note 'marker4' =
// "Mount Zamai" — ADOPTED, no draw) and a hot-spring on cell 16 (note
// 'marker7' — a NON-adoptable type next to peak 15, pinning the type filter).
// ---------------------------------------------------------------------------

const MINI_H = [
  55, 60, 75, 60, 55, 10, 10, 55, 60, 65, 60, 55, 10, 10, 55, 75, 60, 78, 55,
  10, 55, 55, 55, 10,
];
const MINI_CELL_COUNT = MINI_H.length;

function makeMiniPack(): Pack {
  const chain = (i: number): number[] =>
    [i - 1, i + 1].filter((n) => n >= 0 && n < MINI_CELL_COUNT);

  // Feature ids: gap cells carry the lake features that trigger getIsolines'
  // inner-lake skip (see file header); everything else is a plain island.
  const f = new Uint16Array(MINI_CELL_COUNT).fill(6);
  f[5] = 1; // lake bordering range A, shoreline = [0] (A's seed cell)
  f[6] = 2; // lake bordering range B's near edge, shoreline = [7]
  f[12] = 3; // lake bordering range B's far edge, shoreline = [7]
  f[13] = 4; // lake bordering range C's near edge, shoreline = [14]
  f[19] = 5; // lake bordering range C's far edge, shoreline = [14]

  const culture = new Uint16Array(MINI_CELL_COUNT);
  for (let i = 0; i <= 4; i++) culture[i] = 1;
  for (let i = 7; i <= 11; i++) culture[i] = 2;
  for (let i = 14; i <= 18; i++) culture[i] = 3;

  const pack = {
    cells: {
      i: Uint32Array.from({ length: MINI_CELL_COUNT }, (_, i) => i),
      c: Array.from({ length: MINI_CELL_COUNT }, (_, i) => chain(i)),
      v: Array.from({ length: MINI_CELL_COUNT }, () => []),
      b: new Uint8Array(MINI_CELL_COUNT),
      p: Array.from({ length: MINI_CELL_COUNT }, (_, i) => [i * 10, 5]),
      h: Uint8Array.from(MINI_H),
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [0] },
      { type: 'lake', shoreline: [7] },
      { type: 'lake', shoreline: [7] },
      { type: 'lake', shoreline: [14] },
      { type: 'lake', shoreline: [14] },
      { type: 'island' },
    ],
    cultures: [
      { name: 'Wildlands' },
      { name: 'Astel' },
      { name: 'Norvik' },
      { name: 'Zamai' },
    ],
  } as unknown as Pack;

  (pack as Pack & { markers?: Marker[] }).markers = [
    { i: 4, type: 'volcanoes', icon: '🌋', x: 170, y: 5, cell: 17 },
    { i: 7, type: 'hot-springs', icon: '♨️', x: 160, y: 5, cell: 16 },
  ];
  return pack;
}

/** The notes the crafted markers point at (markers-generator id template:
 * `"marker" + marker.i`). 'marker7' belongs to the NON-adoptable hot-spring. */
const MINI_NOTES = [
  { id: 'marker4', name: 'Mount Zamai' },
  { id: 'marker7', name: 'Norvik Hot Springs' },
];

/** Mirror of the pass's documented seed-hash contract (31-multiplier string
 * hash XOR 0x4d6f756e "Moun") — pins the mountains RNG stream. */
function mountainsStreamSeed(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h ^ 0x4d6f756e) >>> 0;
}

/** FMG-shaped route over the fixture cells: points are [x, y, cellId] triples
 * at each cell's site — pass detection only ever reads points[k][2]. */
const routeOver = (i: number, group: Route['group'], cells: number[]): Route =>
  ({ i, group, feature: 6, points: cells.map((c) => [c * 10, 5, c]) }) as Route;

describe('generateMountains (mini-pack)', () => {
  it('writes pack.ranges with 1-based ids, member/core cells, and drops sub-minimum hills', () => {
    const pack = makeMiniPack();
    expect(pack.ranges).toBeUndefined();
    expect(pack.peaks).toBeUndefined();
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);

    const ranges = pack.ranges!;
    expect(ranges).toHaveLength(3);
    expect(ranges.map((range) => range.i)).toEqual([1, 2, 3]);
    expect(ranges.map((range) => range.cells)).toEqual([
      [0, 1, 2, 3, 4],
      [7, 8, 9, 10, 11],
      [14, 15, 16, 17, 18],
    ]);
    expect(ranges.map((range) => range.coreCells)).toEqual([
      [2],
      [],
      [15, 17],
    ]);
    // The 3-cell hill knot (20-22) never becomes a range.
    const allCells = ranges.flatMap((range) => range.cells);
    expect(allCells).not.toContain(20);
    expect(allCells).not.toContain(21);
    expect(allCells).not.toContain(22);
  });

  it('classifies kinds: volcano marker → volcanic, coreless → highlands, else range', () => {
    const pack = makeMiniPack();
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.ranges!.map((range) => range.kind)).toEqual([
      'range',
      'highlands',
      'volcanic',
    ]);
  });

  it('writes pack.peaks with global 1-based ids, range links, and findPeaks order', () => {
    const pack = makeMiniPack();
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(
      pack.peaks!.map(({ i, rangeI, cellId, h }) => ({ i, rangeI, cellId, h })),
    ).toEqual([
      { i: 1, rangeI: 1, cellId: 2, h: 75 },
      { i: 2, rangeI: 3, cellId: 17, h: 78 }, // highest first (findPeaks order)
      { i: 3, rangeI: 3, cellId: 15, h: 75 },
    ]);
  });

  it('names ranges and fresh peaks on the pinned stream; adopted peaks consume NO draw', () => {
    const seed = 'mtn-mini-0';
    const pack = makeMiniPack();
    generateMountains(pack, seed, MINI_NOTES);

    // Mirror the mountains stream draw-for-draw. THE STREAM CONTRACT: per
    // range in cluster id order — ONE nameRange draw, then per peak in
    // findPeaks order one namePeak draw UNLESS adopted. Range kinds and pole
    // walks consume no draws. If the implementation drew for the adopted
    // peak 17 (or reordered anything), the picks below shift and this fails.
    const rng = new SeededRandom(mountainsStreamSeed(seed));
    const nameA = `Astel ${rng.pick(RANGE_WORD_BANKS.range)}`;
    const peakA = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Astel');
    const nameB = `Norvik ${rng.pick(RANGE_WORD_BANKS.highlands)}`;
    const nameC = `Zamai ${rng.pick(RANGE_WORD_BANKS.volcanic)}`;
    // Peak 17 carries the volcano marker: ADOPTED ("Mount Zamai"), no draw.
    // Peak 15 sits next to only a hot-spring (non-adoptable type): fresh.
    const peakC15 = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Zamai');
    // Seed guard (searched 2026-07-11): the NEXT form draw differs from peak
    // 15's, so an implementation that burns a draw on the adopted peak
    // produces a visibly different peak-15 name and cannot pass by accident.
    const buggyC15 = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Zamai');
    expect(peakC15).not.toBe(buggyC15);

    expect(pack.ranges!.map((range) => range.name)).toEqual([
      nameA,
      nameB,
      nameC,
    ]);
    expect(pack.peaks!.map((peak) => peak.name)).toEqual([
      peakA,
      'Mount Zamai', // adopted from the volcano's note, verbatim
      peakC15,
    ]);
  });

  it('adopts a direct neighbor\'s sacred-mountain name; a cell marker beats a neighbor marker', () => {
    const pack = makeMiniPack();
    // Turn the cell-16 marker into a sacred mountain: cell 16 neighbors BOTH
    // peaks (15 and 17). Peak 17 must still adopt its OWN cell's volcano
    // note; peak 15 adopts the neighbor's sacred-mountain note.
    const markers = (pack as Pack & { markers?: Marker[] }).markers!;
    markers[1] = { i: 7, type: 'sacred-mountains', icon: '🗻', x: 160, y: 5, cell: 16 };
    const notes = [
      { id: 'marker4', name: 'Mount Zamai' },
      { id: 'marker7', name: 'Zamai Mountain' },
    ];
    generateMountains(pack, 'mtn-mini-0', notes);

    expect(pack.peaks!.map((peak) => peak.name)).toEqual([
      expect.any(String), // range A's fresh peak
      'Mount Zamai', // own-cell volcano wins over the neighboring sacred
      'Zamai Mountain', // adopted across the cell 15 → 16 adjacency
    ]);
    // Both range-C peaks adopted, so the stream holds exactly 4 range/peak
    // draws: A name, A peak, B name, C name — pinned via range names.
    const rng = new SeededRandom(mountainsStreamSeed('mtn-mini-0'));
    const nameA = `Astel ${rng.pick(RANGE_WORD_BANKS.range)}`;
    const peakA = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Astel');
    const nameB = `Norvik ${rng.pick(RANGE_WORD_BANKS.highlands)}`;
    const nameC = `Zamai ${rng.pick(RANGE_WORD_BANKS.volcanic)}`;
    expect(pack.ranges!.map((r) => r.name)).toEqual([nameA, nameB, nameC]);
    expect(pack.peaks![0].name).toBe(peakA);
  });

  it('rolls fresh names for every peak when notes are omitted (adoption needs marker AND note)', () => {
    const seed = 'mtn-mini-0';
    const pack = makeMiniPack();
    generateMountains(pack, seed); // no notes: nothing to adopt from

    const rng = new SeededRandom(mountainsStreamSeed(seed));
    const nameA = `Astel ${rng.pick(RANGE_WORD_BANKS.range)}`;
    const peakA = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Astel');
    const nameB = `Norvik ${rng.pick(RANGE_WORD_BANKS.highlands)}`;
    const nameC = `Zamai ${rng.pick(RANGE_WORD_BANKS.volcanic)}`;
    const peakC17 = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Zamai');
    const peakC15 = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Zamai');

    expect(pack.ranges!.map((range) => range.name)).toEqual([nameA, nameB, nameC]);
    expect(pack.peaks!.map((peak) => peak.name)).toEqual([peakA, peakC17, peakC15]);
  });

  it('rolls a fresh name when no note matches the marker id template', () => {
    const pack = makeMiniPack();
    generateMountains(pack, 'mtn-mini-0', [
      { id: 'marker99', name: 'Wrong Mountain' },
    ]);
    // Identical to the notes-omitted stream: the volcano marker on 17 has no
    // resolvable note, so no peak adopts and both range-C peaks draw.
    const rng = new SeededRandom(mountainsStreamSeed('mtn-mini-0'));
    rng.pick(RANGE_WORD_BANKS.range);
    const peakA = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Astel');
    rng.pick(RANGE_WORD_BANKS.highlands);
    rng.pick(RANGE_WORD_BANKS.volcanic);
    const peakC17 = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Zamai');
    const peakC15 = rng.pick(PEAK_NAME_FORMS).replace('{a}', 'Zamai');
    expect(pack.peaks!.map((peak) => peak.name)).toEqual([peakA, peakC17, peakC15]);
    expect(pack.peaks!.map((peak) => peak.name)).not.toContain('Wrong Mountain');
  });

  it('falls back to the seed-cell point when a range has no isoline pole', () => {
    const pack = makeMiniPack();
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    // Every cluster in this fixture skips its isoline (see file header), so
    // each pole is the seed cell's pack.cells.p point.
    expect(pack.ranges!.map((range) => range.pole)).toEqual([
      [0, 5],
      [70, 5],
      [140, 5],
    ]);
  });

  it('is deterministic: same seed twice produces identical JSON', () => {
    const a = makeMiniPack();
    const b = makeMiniPack();
    a.routes = [routeOver(1, 'highways', [13, 14, 15, 16, 17, 18, 19])];
    b.routes = [routeOver(1, 'highways', [13, 14, 15, 16, 17, 18, 19])];
    generateMountains(a, 'mtn-mini-0', MINI_NOTES);
    generateMountains(b, 'mtn-mini-0', MINI_NOTES);
    expect(JSON.stringify(a.ranges)).toBe(JSON.stringify(b.ranges));
    expect(JSON.stringify(a.peaks)).toBe(JSON.stringify(b.peaks));
    expect(JSON.stringify(a.passes)).toBe(JSON.stringify(b.passes));
    expect(a.passes!.length).toBeGreaterThan(0);
  });

  it('consumes no shared-stream randomness (world-preservation doctrine)', () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      generateMountains(makeMiniPack(), 'mtn-mini-0', MINI_NOTES);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('writes empty ranges/peaks arrays when the world has no highland', () => {
    const pack = makeMiniPack();
    (pack.cells.h as Uint8Array).fill(30); // all lowland
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.ranges).toEqual([]);
    expect(pack.peaks).toEqual([]);
  });

  it('writes pack.passes = [] when the pack carries no routes at all', () => {
    const pack = makeMiniPack();
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.passes).toEqual([]);
  });

  it('tolerates a land route with no points (cells-only legacy shape)', () => {
    // detectPasses reads route.points; a crafted/legacy route lacking it must
    // not throw (final-review guard, matching buildRouteCellTiers' `?? []`).
    const pack = makeMiniPack();
    // A land route carrying `cells` but no `points` (crafted/legacy shape).
    pack.routes = [{ i: 999, group: 'roads', feature: 6, cells: [0, 1] } as unknown as Route];
    expect(() => generateMountains(pack, 'mtn-mini-guard', MINI_NOTES)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Pass detection (mountains Task 4): per route in {highways, roads, trails},
// each contiguous run of range cells crests at its max-h cell (tie → lowest
// cellId); candidates dedup by cellId across routes (routeIds merged, sorted
// asc); pack.passes ordered by cellId asc with 1-based ids. RNG-FREE — the
// pinned-stream tests above run UNMODIFIED, which is the stream proof.
// ---------------------------------------------------------------------------

describe('generateMountains — pass detection (Task 4)', () => {
  it('detects the run crest: max-h cell of a contiguous range crossing', () => {
    const pack = makeMiniPack();
    // Cells 13/19 are lowland gaps; 14-18 are range 3 (max h 78 at cell 17).
    pack.routes = [routeOver(1, 'highways', [13, 14, 15, 16, 17, 18, 19])];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(
      pack.passes!.map(({ i, rangeI, cellId, routeIds }) => ({ i, rangeI, cellId, routeIds })),
    ).toEqual([{ i: 1, rangeI: 3, cellId: 17, routeIds: [1] }]);
  });

  it('breaks a max-h tie toward the LOWEST cellId', () => {
    const pack = makeMiniPack();
    // Route order [3, 1]: both range 1 at h 60 — the tie resolves to cell 1.
    pack.routes = [routeOver(2, 'roads', [3, 1])];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.passes!.map(({ cellId, rangeI }) => ({ cellId, rangeI }))).toEqual([
      { cellId: 1, rangeI: 1 },
    ]);
    // Deterministic non-rng word: PASS_WORDS[1 % 4] = 'Gap'.
    expect(pack.passes![0].name.endsWith(' Gap')).toBe(true);
  });

  it('a run of length 1 still crests: a route clipping a range corner', () => {
    const pack = makeMiniPack();
    // Only cell 7 (range 2) is highland on this road; 6/12 are lowland gaps.
    pack.routes = [routeOver(3, 'roads', [6, 7, 12])];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.passes!.map(({ cellId, rangeI }) => ({ cellId, rangeI }))).toEqual([
      { cellId: 7, rangeI: 2 },
    ]);
  });

  it('two runs on one route yield two passes, ordered by cellId with 1-based ids', () => {
    const pack = makeMiniPack();
    // Cell 2 (range 1), gap 5, then cell 15 (range 3): two separate runs.
    pack.routes = [routeOver(4, 'trails', [2, 5, 15])];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(
      pack.passes!.map(({ i, rangeI, cellId, routeIds }) => ({ i, rangeI, cellId, routeIds })),
    ).toEqual([
      { i: 1, rangeI: 1, cellId: 2, routeIds: [4] },
      { i: 2, rangeI: 3, cellId: 15, routeIds: [4] },
    ]);
  });

  it('dedups a shared crest cell across routes, merging routeIds sorted asc', () => {
    const pack = makeMiniPack();
    // Route 3 (trails) is FIRST in pack.routes but has the higher id's peer:
    // both crest at cell 17, so the pass merges routeIds [1, 3] sorted asc.
    pack.routes = [
      routeOver(3, 'trails', [16, 17, 18]),
      routeOver(1, 'highways', [13, 14, 15, 16, 17, 18, 19]),
    ];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(
      pack.passes!.map(({ i, rangeI, cellId, routeIds }) => ({ i, rangeI, cellId, routeIds })),
    ).toEqual([{ i: 1, rangeI: 3, cellId: 17, routeIds: [1, 3] }]);
  });

  it('paths and searoutes never make passes', () => {
    const pack = makeMiniPack();
    pack.routes = [
      routeOver(5, 'paths', [0, 1, 2, 3, 4]),
      routeOver(6, 'searoutes', [14, 15, 16, 17, 18]),
    ];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.passes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pass naming (Task 4), deterministic and rng-free: stem = nearest same-range
// peak within 3 BFS steps (ties → lowest peak cellId) with its bank form word
// stripped ("Mount Trubc" → "Trubc"; "Astel Horn" → "Astel"), else the range
// name's FIRST word; word = PASS_WORDS[cellId % 4] (Pass/Gap/Col/Saddle).
// Adopted marker names pin the peak names here so no test mirrors the rng.
// ---------------------------------------------------------------------------

describe('generateMountains — pass naming (Task 4)', () => {
  /** Mini-pack with the cell-16 marker as a SACRED MOUNTAIN whose note is
   * "Astel Horn": peak 15 adopts it (neighbor), peak 17 keeps its own
   * volcano's "Mount Zamai" — both range-3 peak names pinned verbatim. */
  function makeNamedPeaksPack(): { pack: Pack; notes: Array<{ id: string; name: string }> } {
    const pack = makeMiniPack();
    const markers = (pack as Pack & { markers?: Marker[] }).markers!;
    markers[1] = { i: 7, type: 'sacred-mountains', icon: '🗻', x: 160, y: 5, cell: 16 };
    const notes = [
      { id: 'marker4', name: 'Mount Zamai' },
      { id: 'marker7', name: 'Astel Horn' },
    ];
    return { pack, notes };
  }

  it('stems: "Mount X" prefix strip, "X Horn" suffix strip, BFS nearest, range fallback', () => {
    const { pack, notes } = makeNamedPeaksPack();
    pack.routes = [
      // Pass at 7 (range 2, NO peaks): range-name-first-word fallback.
      routeOver(1, 'roads', [6, 7]),
      // Pass at 14: nearest range-3 peak is 15 at BFS depth 1 ("Astel Horn").
      routeOver(2, 'trails', [14]),
      // Pass at 16: peaks 15 and 17 BOTH at depth 1 — tie → lowest (15).
      routeOver(3, 'trails', [16]),
      // Pass at 17: the crest IS peak 17 (depth 0, "Mount Zamai").
      routeOver(4, 'highways', [16, 17, 18]),
    ];
    generateMountains(pack, 'mtn-mini-0', notes);

    // Range 2 is "Norvik <bank>" — the fallback takes the FIRST word, which
    // is the culture adjective whatever the rng picked for the bank word.
    expect(pack.passes!.map(({ cellId, name }) => ({ cellId, name }))).toEqual([
      { cellId: 7, name: 'Norvik Saddle' }, // fallback + PASS_WORDS[7%4=3]
      { cellId: 14, name: 'Astel Col' }, // "Astel Horn" → "Astel" + [14%4=2]
      { cellId: 16, name: 'Astel Pass' }, // depth tie → peak 15 + [16%4=0]
      { cellId: 17, name: 'Zamai Gap' }, // "Mount Zamai" → "Zamai" + [17%4=1]
    ]);
  });

  it('fresh rng peak names also stem to the culture adjective (every form strips)', () => {
    const pack = makeMiniPack();
    // Pass at cell 2 = range 1's peak (depth 0). Peak 2's name is rng-drawn,
    // but every PEAK_NAME_FORMS value strips to the bare adjective "Astel".
    pack.routes = [routeOver(1, 'roads', [1, 2, 3])];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    expect(pack.passes!.map(({ cellId, name }) => ({ cellId, name }))).toEqual([
      { cellId: 2, name: 'Astel Col' }, // PASS_WORDS[2 % 4] = 'Col'
    ]);
  });
});

// ---------------------------------------------------------------------------
// BFS depth limit (Task 4): the peak hunt stops at 3 steps. A long single
// range with one far peak pins the boundary — depth 3 still stems from the
// peak, depth 4 falls back to the range's first word.
//
//   cells   0   1   2   3   4   5   6   7   8 | 9
//   h      60  55  55  55  55  55  55  55  75 | 10
//   one range (cells 0-8), volcano peak at 8 ("Mount Grum" adopted).
// ---------------------------------------------------------------------------

/** Long-chain pack: ONE range, cells 0-8, peak only at cell 8. Same lake-gap
 * pole rig as the other fixtures (gap cell 9 = lake, shoreline [0]). */
function makeLongRangePack(): Pack {
  const n = 10;
  const chain = (i: number): number[] =>
    [i - 1, i + 1].filter((k) => k >= 0 && k < n);
  const h = Uint8Array.from([60, 55, 55, 55, 55, 55, 55, 55, 75, 10]);
  const f = new Uint16Array(n).fill(2);
  f[9] = 1; // lake bordering the range, shoreline = [0]
  const culture = new Uint16Array(n);
  for (let i = 0; i <= 8; i++) culture[i] = 1;
  const pack = {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [0, { type: 'lake', shoreline: [0] }, { type: 'island' }],
    cultures: [{ name: 'Wildlands' }, { name: 'Astel' }],
  } as unknown as Pack;
  (pack as Pack & { markers?: Marker[] }).markers = [
    { i: 4, type: 'volcanoes', icon: '🌋', x: 80, y: 5, cell: 8 },
  ];
  return pack;
}

describe('generateMountains — pass-stem BFS stops at 3 steps', () => {
  it('a crest 3 steps from the peak stems from it; 4 steps falls back to the range', () => {
    const pack = makeLongRangePack();
    pack.routes = [
      routeOver(1, 'highways', [4]), // peak 8 is 4 steps away → fallback
      routeOver(2, 'trails', [5]), // peak 8 is exactly 3 steps away → "Grum"
    ];
    generateMountains(pack, 'long-0', [{ id: 'marker4', name: 'Mount Grum' }]);
    expect(pack.passes!.map(({ cellId, name }) => ({ cellId, name }))).toEqual([
      { cellId: 4, name: 'Astel Pass' }, // range first word + PASS_WORDS[4%4=0]
      { cellId: 5, name: 'Grum Gap' }, // "Mount Grum" → "Grum" + PASS_WORDS[5%4=1]
    ]);
  });
});

// ---------------------------------------------------------------------------
// Geographic dedup on range names (shared naming/dedupeNames helper): twins
// pull apart with a compass suffix; PEAKS skip dedup on purpose — "Mount X"
// twins are tolerable and adopted names must never mutate.
// ---------------------------------------------------------------------------

/** Dup fixture: TWO 5-cell highland clusters (0-4 and 7-11) sharing ONE
 * culture ('Astel'), all cells h=55 (both ranges are 'highlands' kind, no
 * peaks), on the same lake-gap pole rig, so each pole takes the seed-cell
 * fallback: pole A = p[0] = [50,50], pole B = p[7] = [50,10] — range B sits
 * due NORTH of range A (atlas y grows down). The mountains stream is exactly
 * two highlands-bank picks. */
function makeDupPack(): Pack {
  const n = 13;
  const chain = (i: number): number[] =>
    [i - 1, i + 1].filter((k) => k >= 0 && k < n);
  const h = Uint8Array.from([55, 55, 55, 55, 55, 10, 10, 55, 55, 55, 55, 55, 10]);
  const f = new Uint16Array(n).fill(4);
  f[5] = 1; // lake bordering range A, shoreline = [0] (A's seed cell)
  f[6] = 2; // lake bordering range B, shoreline = [7] (B's seed cell)
  f[12] = 3; // lake bordering range B's far edge, shoreline = [7]
  const culture = new Uint16Array(n);
  for (const c of [0, 1, 2, 3, 4, 7, 8, 9, 10, 11]) culture[c] = 1;
  const p = Array.from({ length: n }, (_, i) => [i * 10, 5] as [number, number]);
  p[0] = [50, 50]; // range A's pole (seed-cell fallback)
  p[7] = [50, 10]; // range B's pole — due north of A's
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p,
      h,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [
      0,
      { type: 'lake', shoreline: [0] },
      { type: 'lake', shoreline: [7] },
      { type: 'lake', shoreline: [7] },
      { type: 'island' },
    ],
    cultures: [{ name: 'Wildlands' }, { name: 'Astel' }],
  } as unknown as Pack;
}

/** Peak-twin fixture: ONE range (cells 0-4, culture 'Astel') with TWO strict
 * maxima (cells 3 at 78, 1 at 75) — findPeaks order [3, 1]. */
function makePeakTwinPack(): Pack {
  const n = 6;
  const chain = (i: number): number[] =>
    [i - 1, i + 1].filter((k) => k >= 0 && k < n);
  const h = Uint8Array.from([55, 75, 60, 78, 55, 10]);
  const f = new Uint16Array(n).fill(2);
  f[5] = 1; // lake bordering the range, shoreline = [0]
  const culture = new Uint16Array(n);
  for (let i = 0; i <= 4; i++) culture[i] = 1;
  return {
    cells: {
      i: Uint32Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => chain(i)),
      v: Array.from({ length: n }, () => []),
      b: new Uint8Array(n),
      p: Array.from({ length: n }, (_, i) => [i * 10, 5]),
      h,
      f,
      culture,
    },
    vertices: { p: [], v: [], c: [] },
    features: [0, { type: 'lake', shoreline: [0] }, { type: 'island' }],
    cultures: [{ name: 'Wildlands' }, { name: 'Astel' }],
  } as unknown as Pack;
}

describe('generateMountains — geographic dedup on range names only', () => {
  it('pulls duplicate range names apart with a compass suffix (pinned seed)', () => {
    // Seed searched 2026-07-11: both highlands-bank picks on the 'mtn-dup-2'
    // mountains stream land 'Highlands', so the two same-culture ranges
    // collide as "Astel Highlands" before dedup.
    const seed = 'mtn-dup-2';
    const pack = makeDupPack();
    generateMountains(pack, seed);

    // Replay guard: the stream really does produce the duplicate raw names.
    const rng = new SeededRandom(mountainsStreamSeed(seed));
    const wordA = rng.pick(RANGE_WORD_BANKS.highlands);
    const wordB = rng.pick(RANGE_WORD_BANKS.highlands);
    expect(wordA).toBe(wordB);

    // Range 1 (lowest id) keeps the bare name; range 2's pole [50,10] is due
    // north of range 1's [50,50] (atlas y grows down).
    expect(pack.ranges!.map((range) => range.name)).toEqual([
      `Astel ${wordA}`,
      `Astel ${wordA} of the North`,
    ]);
    expect(pack.ranges!.map((range) => range.pole)).toEqual([
      [50, 50],
      [50, 10],
    ]);
  });

  it('leaves identical peak names alone — peaks skip dedup (pinned seed)', () => {
    // Seed searched 2026-07-11: after the range-name draw, both peak form
    // picks on the 'mtn-peakdup-2' stream land the same form, so the two
    // peaks of one range get IDENTICAL names — and must keep them.
    const seed = 'mtn-peakdup-2';
    const pack = makePeakTwinPack();
    generateMountains(pack, seed);

    const rng = new SeededRandom(mountainsStreamSeed(seed));
    rng.pick(RANGE_WORD_BANKS.range); // the range-name draw
    const formA = rng.pick(PEAK_NAME_FORMS);
    const formB = rng.pick(PEAK_NAME_FORMS);
    expect(formA).toBe(formB); // replay guard: the twins are real

    const twin = formA.replace('{a}', 'Astel');
    expect(pack.peaks!.map((peak) => peak.name)).toEqual([twin, twin]);
    // No compass/Greater/Lesser suffix ever lands on a peak.
    for (const peak of pack.peaks!) {
      expect(peak.name).not.toMatch(/ of the /);
      expect(peak.name).not.toMatch(/ the (Greater|Lesser)$/);
    }
  });
});

// ---------------------------------------------------------------------------
// pack.ranges/pack.peaks → AtlasRange/AtlasPeak adapter chain
// ---------------------------------------------------------------------------

describe('pack.ranges/peaks → atlas artifact adapter chain', () => {
  const options = { width: 240, height: 100, winds: [] } as unknown as WorldGenOptions;
  const asInput = (pack: Pack) =>
    ({ pack, graphWidth: 240, graphHeight: 100 }) as unknown as Parameters<
      typeof buildAtlasArtifact
    >[0];

  it('mirrors ranges and peaks onto the artifact: raw cellIds, feet-space poles', () => {
    const pack = makeMiniPack();
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    const artifact = buildAtlasArtifact(asInput(pack), 1234, options);

    expect(artifact.ranges).toHaveLength(3);
    artifact.ranges.forEach((range, idx) => {
      const source: PackRange = pack.ranges![idx];
      expect(range.id).toBe(source.i);
      expect(range.name).toBe(source.name);
      expect(range.kind).toBe(source.kind);
      // Cell-space data keeps raw pack cell ids (the AtlasRoute convention).
      expect(range.cellIds).toEqual(source.cells);
      expect(range.coreCellIds).toEqual(source.coreCells);
      // Point data converts FMG px → world feet (the AtlasBurg convention).
      expect(range.pole[0]).toBeCloseTo(feetFromFmgPixel(source.pole[0]), 6);
      expect(range.pole[1]).toBeCloseTo(feetFromFmgPixel(source.pole[1]), 6);
    });

    expect(artifact.peaks).toHaveLength(3);
    artifact.peaks.forEach((peak, idx) => {
      const source: PackPeak = pack.peaks![idx];
      expect(peak.id).toBe(source.i);
      expect(peak.rangeId).toBe(source.rangeI);
      expect(peak.cellId).toBe(source.cellId);
      expect(peak.h).toBe(source.h);
      expect(peak.name).toBe(source.name);
    });

    // The route-less mini-pack detects no passes, so the artifact carries [].
    expect(artifact.passes).toEqual([]);
  });

  it('mirrors detected passes onto the artifact (AtlasPass shape, raw cellIds)', () => {
    const pack = makeMiniPack();
    pack.routes = [routeOver(1, 'highways', [13, 14, 15, 16, 17, 18, 19])];
    generateMountains(pack, 'mtn-mini-0', MINI_NOTES);
    const artifact = buildAtlasArtifact(asInput(pack), 1234, options);
    expect(artifact.passes).toEqual([
      { id: 1, rangeId: 3, cellId: 17, name: 'Zamai Gap', routeIds: [1] },
    ]);
  });

  it('emits empty ranges/peaks/passes lists for packs generated without the pass', () => {
    const artifact = buildAtlasArtifact(asInput(makeMiniPack()), 1234, options);
    expect(artifact.ranges).toEqual([]);
    expect(artifact.peaks).toEqual([]);
    expect(artifact.passes).toEqual([]);
  });
});
