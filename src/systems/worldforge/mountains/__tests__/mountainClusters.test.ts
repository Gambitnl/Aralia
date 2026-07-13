import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../../../utils/random/seededRandom';
import { TRAVEL_EVENTS } from '../../../../data/travelEvents';
import {
  clusterRangeCells, findPeaks, rangeKindOf,
  nameRange, namePeak, namePass,
  type RangeCluster, type RangeKind,
} from '../mountainClusters';
import {
  RANGE_MIN_H, RANGE_MIN_CELLS, PEAK_MIN_H, PEAKS_PER_RANGE_MAX,
  RANGE_WORD_BANKS, PEAK_NAME_FORMS, PASS_WORDS,
  CLIMB_TIER_SOFTEN, TRIP_EVENT_CHANCE, TRIP_EVENT_DRAMA,
  TREELINE_N, treelineClassOf, SNOW_LINE_H, SNOW_RGB, ICE_RGB,
} from '../mountainTunables';

// ---------------------------------------------------------------------------
// Fixtures: 1-D strips of cells (neighbors = left/right on the line), heights
// crafted around RANGE_MIN_H=50 / PEAK_MIN_H=70 / RANGE_MIN_CELLS=5.
// ---------------------------------------------------------------------------
const lineNeighbors = (len: number) => (c: number): number[] =>
  [c - 1, c + 1].filter((n) => n >= 0 && n < len);

/** Crafted cluster for functions that take one directly. */
const craft = (id: number, cellIds: number[], coreCells: number[]): RangeCluster => ({
  id, cellIds, coreCells, seedCell: cellIds[0],
});

describe('clusterRangeCells', () => {
  it('flood-fills contiguous highland into one range and drops sub-minimum knots', () => {
    expect(RANGE_MIN_H).toBe(50);      // the fixtures are built around these values
    expect(RANGE_MIN_CELLS).toBe(5);
    // Islands (h >= 50): cells 1-5 (size 5, kept), 7-8 (size 2, dropped),
    // 10-13 (size 4, one below minimum, dropped).
    const h = [30, 55, 60, 72, 58, 51, 30, 55, 60, 30, 52, 55, 58, 51];
    const clusters = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].id).toBe(0);
    expect(clusters[0].cellIds).toEqual([1, 2, 3, 4, 5]);
    expect(clusters[0].seedCell).toBe(1);
  });

  it('includes cells at exactly RANGE_MIN_H and excludes cells just below', () => {
    const h = [50, 50, 50, 50, 50, 49];
    const clusters = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].cellIds).toEqual([0, 1, 2, 3, 4]); // 49 stays out
    const low = [49, 49, 49, 49, 49, 49];
    expect(clusterRangeCells(low, lineNeighbors(low.length), low.length)).toHaveLength(0);
  });

  it('collects coreCells (h >= PEAK_MIN_H) and leaves them empty for pure highlands', () => {
    expect(PEAK_MIN_H).toBe(70); // fixture guard
    const h = [55, 70, 82, 55, 60];
    const [range] = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    expect(range.coreCells).toEqual([1, 2]); // 70 is core, 82 is core, rest below
    const rolling = [55, 60, 65, 69, 55];
    const [highland] = clusterRangeCells(rolling, lineNeighbors(rolling.length), rolling.length);
    expect(highland.coreCells).toEqual([]);
  });

  it('orders ranges by seedCell with contiguous ids', () => {
    const h = [55, 55, 55, 55, 55, 20, 20, 55, 55, 55, 55, 55];
    const clusters = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    expect(clusters.map((c) => c.id)).toEqual([0, 1]);
    expect(clusters.map((c) => c.seedCell)).toEqual([0, 7]);
    expect(clusters[1].cellIds).toEqual([7, 8, 9, 10, 11]);
  });

  it('is deterministic: two runs produce identical output', () => {
    const h = [30, 55, 60, 72, 58, 51, 30, 55, 60, 30, 52, 55, 58, 51];
    const a = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    const b = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    expect(a).toEqual(b);
  });
});

describe('findPeaks', () => {
  /** Cluster + peaks straight from a strip's heights. */
  const peaksOf = (h: number[]): number[] => {
    const clusters = clusterRangeCells(h, lineNeighbors(h.length), h.length);
    expect(clusters).toHaveLength(1);
    return findPeaks(clusters[0], h, lineNeighbors(h.length));
  };

  it('finds a strict local maximum at or above PEAK_MIN_H', () => {
    expect(peaksOf([55, 60, 75, 60, 55])).toEqual([2]);
  });

  it('yields NO peak for a plateau of equal-height cells (ties are not strict)', () => {
    expect(peaksOf([55, 72, 72, 55, 51])).toEqual([]);
  });

  it('ignores strict maxima below PEAK_MIN_H', () => {
    // 69 is the strict summit of this cluster but under the peak line.
    expect(peaksOf([51, 69, 51, 50, 50])).toEqual([]);
  });

  it('caps at PEAKS_PER_RANGE_MAX keeping the highest, ordered by h desc then id asc', () => {
    expect(PEAKS_PER_RANGE_MAX).toBe(4); // fixture guard
    // Five strict maxima (71, 80, 74, 78, 72) — the lowest (cell 0) is cut.
    const h = [71, 60, 80, 60, 74, 60, 78, 60, 72, 60, 55];
    const peaks = peaksOf(h);
    expect(peaks).toEqual([2, 6, 4, 8]);
    expect(peaks).not.toContain(0);
  });

  it('breaks equal-height ties by lower cell id', () => {
    expect(peaksOf([72, 60, 72, 60, 80])).toEqual([4, 0, 2]);
  });

  it('compares against ALL neighbors, including cells outside the cluster', () => {
    // Cell 1 (75) tops its crafted cluster but a taller out-of-cluster
    // neighbor (cell 0, 90) looms over it — not a peak.
    const h = [90, 75, 60, 55];
    const shard = craft(0, [1, 2, 3], [1]);
    expect(findPeaks(shard, h, lineNeighbors(h.length))).toEqual([]);
  });
});

describe('rangeKindOf', () => {
  const hasVolcanoAt = (volcanoCell: number) => (c: number) => c === volcanoCell;
  const noVolcano = () => false;

  it('is volcanic when any cluster cell hosts a volcano, even with core cells', () => {
    const c = craft(0, [10, 11, 12], [11]);
    expect(rangeKindOf(c, hasVolcanoAt(12))).toBe('volcanic');
  });

  it('is highlands when no cell reaches PEAK_MIN_H and no volcano', () => {
    const c = craft(0, [10, 11, 12], []);
    expect(rangeKindOf(c, noVolcano)).toBe('highlands');
  });

  it('is range when core cells exist and no volcano', () => {
    const c = craft(0, [10, 11, 12], [11]);
    expect(rangeKindOf(c, noVolcano)).toBe('range');
  });

  it('volcanic outranks highlands (coreless cluster with a volcano)', () => {
    const c = craft(0, [10, 11, 12], []);
    expect(rangeKindOf(c, hasVolcanoAt(10))).toBe('volcanic');
  });
});

describe('nameRange', () => {
  it('carries exactly the briefed word banks', () => {
    expect(RANGE_WORD_BANKS.range).toEqual(
      ['Spine', 'Reach', 'Range', 'Heights', 'Teeth', 'Crags', 'Wall']);
    expect(RANGE_WORD_BANKS.highlands).toEqual(['Downs', 'Highlands', 'Moors', 'Fells']);
    expect(RANGE_WORD_BANKS.volcanic).toEqual(['Furnace', 'Anvil', 'Ashreach', 'Cinderwall']);
  });

  it('returns "<Adjective> <BankWord>" drawn from the kind\'s own bank', () => {
    const kinds: RangeKind[] = ['range', 'highlands', 'volcanic'];
    const rng = new SeededRandom(987654321);
    for (const kind of kinds) {
      const name = nameRange(kind, 'Elden', rng);
      const [adj, word] = name.split(' ');
      expect(adj).toBe('Elden');
      expect(RANGE_WORD_BANKS[kind]).toContain(word);
    }
  });

  it('is rng-deterministic: same seed, same name', () => {
    expect(nameRange('range', 'Grim', new SeededRandom(99)))
      .toBe(nameRange('range', 'Grim', new SeededRandom(99)));
  });
});

describe('namePeak', () => {
  const expectedFor = (adj: string) => PEAK_NAME_FORMS.map((f) => f.replace('{a}', adj));

  it('renders one of the five forms with the adjective substituted', () => {
    const rng = new SeededRandom(424242);
    for (let i = 0; i < 25; i++) {
      const name = namePeak('Elden', rng);
      expect(expectedFor('Elden')).toContain(name);
      expect(name).toContain('Elden');
      expect(name).not.toContain('{a}');
    }
  });

  it('covers every form across a long stream (the FORM itself is the rng pick)', () => {
    expect(PEAK_NAME_FORMS).toEqual(
      ['Mount {a}', '{a} Peak', '{a} Horn', '{a} Tor', '{a} Fang']);
    const rng = new SeededRandom(987654321);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(namePeak('Elden', rng));
    expect(seen.size).toBe(PEAK_NAME_FORMS.length);
  });

  it('is rng-deterministic: same seed, same name', () => {
    expect(namePeak('Grim', new SeededRandom(31337)))
      .toBe(namePeak('Grim', new SeededRandom(31337)));
  });
});

describe('namePass', () => {
  it('exports PASS_WORDS exactly, for deterministic non-rng indexing too', () => {
    expect(PASS_WORDS).toEqual(['Pass', 'Gap', 'Col', 'Saddle']);
    // The pass task indexes the bank directly by cell id.
    expect(PASS_WORDS[4217 % PASS_WORDS.length]).toBe(PASS_WORDS[1]);
  });

  it('returns "<stem> <PassWord>" keeping multi-word stems intact', () => {
    const rng = new SeededRandom(424242);
    const name = namePass('Elden Horn', rng);
    expect(name.startsWith('Elden Horn ')).toBe(true);
    expect(PASS_WORDS).toContain(name.slice('Elden Horn '.length));
  });

  it('is rng-deterministic: same seed, same name', () => {
    expect(namePass('Grim Fang', new SeededRandom(7)))
      .toBe(namePass('Grim Fang', new SeededRandom(7)));
  });
});

describe('mountainTunables contracts', () => {
  it('pins the trip-event drama priority order (first legacy id crossed wins)', () => {
    // highland_vale dropped (final-review fix): no `highland` event pool exists,
    // so listing it only let a lone highland cell hijack a themed route down to
    // the generic pool. Every listed id resolves to a real pool via substring
    // match (mountain_*→mountain, wetland_marsh→wetland, desert_dune→desert).
    expect(TRIP_EVENT_DRAMA).toEqual([
      'mountain_crag', 'mountain_alpine', 'mountain_glacier',
      'forest_haunted', 'forest_fey',
      'wetland_marsh', 'desert_dune',
    ]);
    // Every drama id must resolve to a real (non-general) pool.
    for (const id of TRIP_EVENT_DRAMA) {
      const pool = Object.keys(TRAVEL_EVENTS).find((k) => k !== 'general' && (id.includes(k) || k.includes(id)));
      expect(pool, `drama id ${id} has no themed pool`).toBeTruthy();
    }
    expect(TRIP_EVENT_CHANCE).toBe(0.25);
  });

  it('softens climb by route tier: maintained grades half, trails 75%, paths full', () => {
    expect(CLIMB_TIER_SOFTEN).toEqual({ highway: 0.5, road: 0.5, trail: 0.75, path: 1 });
  });

  it('maps biomes to tree-line classes: taiga/tundra/glacier cold, tropical none, else temperate', () => {
    expect(TREELINE_N).toEqual({ cold: 0.55, temperate: 0.62, none: 1.1 });
    for (const cold of [9, 10, 11]) expect(treelineClassOf(cold)).toBe('cold');
    for (const tropical of [1, 3, 5, 7]) expect(treelineClassOf(tropical)).toBe('none');
    for (const temperate of [2, 4, 6, 8, 12]) expect(treelineClassOf(temperate)).toBe('temperate');
    // 'none' sits above the whole normalized elevation domain — it disables the line.
    expect(TREELINE_N.none).toBeGreaterThan(1);
  });

  it('carries the briefed snow/ice constants', () => {
    expect(SNOW_LINE_H).toBe(55);
    expect(SNOW_RGB).toEqual([0.92, 0.93, 0.95]);
    expect(ICE_RGB).toEqual([0.86, 0.9, 0.95]);
  });
});
