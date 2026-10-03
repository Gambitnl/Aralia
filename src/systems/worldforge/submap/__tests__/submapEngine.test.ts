import { describe, it, expect } from 'vitest';
import {
  pointInPolygon,
  polygonBounds,
  generateSubmapSites,
  generateSubmap,
  clipPolygon,
  clipPolylineToPolygon,
  submapCellToChildContext,
  subBiomeFor,
  polygonCentroid,
  edgeBlendPull,
  EDGE_BLEND_START,
  type NeighbourBiome,
  type SubmapCell,
} from '../submapEngine';
import { rootSeedPath } from '../../seedPath';

const square: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10]];
const triangle: Array<[number, number]> = [[0, 100], [100, 100], [50, 0]]; // apex at (50,0)

describe('geometry helpers', () => {
  it('pointInPolygon: inside true, outside false', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });
  it('polygonBounds returns the axis-aligned bbox', () => {
    expect(polygonBounds(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
});

describe('generateSubmapSites', () => {
  it('scatters the requested count of points, all inside the polygon', () => {
    const r = generateSubmapSites(
      { polygon: triangle, seedPath: rootSeedPath(42), features: [] },
      { count: 40 },
    );
    expect(r.sites.length).toBeGreaterThanOrEqual(40);
    for (const s of r.sites) expect(pointInPolygon(s, triangle)).toBe(true);
  });

  it('Bomnogorvan contract: an inherited burg is force-sited at its relative position', () => {
    const r = generateSubmapSites(
      {
        polygon: triangle,
        seedPath: rootSeedPath(42),
        features: [{ kind: 'burg', x: 50, y: 8, id: 137, name: 'Bomnogorvan' }], // near apex
      },
      { count: 40 },
    );
    const fs = r.featureSites[0];
    expect(fs.feature.name).toBe('Bomnogorvan');     // identity preserved
    expect(r.sites[fs.siteIndex]).toEqual([50, 8]);  // exact relative position kept
    // and it is the nearest site to its own location (owns a cell there)
    let nearest = -1; let best = Infinity;
    r.sites.forEach((s, i) => {
      const d = (s[0] - 50) ** 2 + (s[1] - 8) ** 2;
      if (d < best) { best = d; nearest = i; }
    });
    expect(nearest).toBe(fs.siteIndex);
  });

  it('is deterministic: same seed-path → identical sites', () => {
    const ctx = { polygon: triangle, seedPath: rootSeedPath(7), features: [] };
    const a = generateSubmapSites(ctx, { count: 30 });
    const b = generateSubmapSites(ctx, { count: 30 });
    expect(a.sites).toEqual(b.sites);
  });
});

describe('generateSubmap (iter-2: Voronoi cells)', () => {
  it('produces a bounded Voronoi cell per site; the burg owns the cell containing its point', () => {
    const r = generateSubmap(
      {
        polygon: triangle,
        seedPath: rootSeedPath(42),
        biome: 'Temperate forest',
        features: [{ kind: 'burg', x: 50, y: 60, id: 137, name: 'Bomnogorvan' }],
      },
      { count: 50 },
    );
    expect(r.biome).toBe('Temperate forest');
    expect(r.cells.length).toBeGreaterThan(40);
    for (const c of r.cells) expect(c.polygon.length).toBeGreaterThanOrEqual(3); // all bounded
    expect(r.burgCellIndex).not.toBeNull();
    const burgCell = r.cells[r.burgCellIndex as number];
    expect(burgCell.feature?.name).toBe('Bomnogorvan');          // identity preserved
    expect(pointInPolygon([50, 60], burgCell.polygon)).toBe(true); // burg sits inside its own cell
  });

  it('is deterministic: same seed-path → identical cell polygons', () => {
    const ctx = { polygon: triangle, seedPath: rootSeedPath(7), features: [] };
    const a = generateSubmap(ctx, { count: 30 }).cells.map((c) => c.polygon);
    const b = generateSubmap(ctx, { count: 30 }).cells.map((c) => c.polygon);
    expect(a).toEqual(b);
  });

  it('clips cells to the parent polygon — no cell vertex spills past the boundary bbox', () => {
    const r = generateSubmap({ polygon: triangle, seedPath: rootSeedPath(42), features: [] }, { count: 60 });
    const b = polygonBounds(triangle);
    const eps = 1e-6;
    for (const c of r.cells) {
      for (const [x, y] of c.polygon) {
        expect(x).toBeGreaterThanOrEqual(b.minX - eps);
        expect(x).toBeLessThanOrEqual(b.maxX + eps);
        expect(y).toBeGreaterThanOrEqual(b.minY - eps);
        expect(y).toBeLessThanOrEqual(b.maxY + eps);
      }
    }
  });
});

describe('submapCellToChildContext (recursion wrapper)', () => {
  it('an output sub-cell re-feeds as a valid child context (drill L1→L2), burg descends', () => {
    const parent = {
      polygon: triangle,
      seedPath: rootSeedPath(42),
      biome: 'Temperate forest',
      features: [{ kind: 'burg' as const, x: 50, y: 60, id: 137, name: 'Bomnogorvan' }],
    };
    const m1 = generateSubmap(parent, { count: 50 });
    const burgCell = m1.cells[m1.burgCellIndex as number];
    const child = submapCellToChildContext(burgCell, parent);
    expect(child.polygon).toEqual(burgCell.polygon);   // sub-cell becomes the child boundary
    expect(child.biome).toBe('Temperate forest');       // biome inherits
    expect(child.seedPath).toContain('/sub:');          // seed-path descends
    expect(child.features?.[0]?.name).toBe('Bomnogorvan'); // the set piece descends
    const m2 = generateSubmap(child, { count: 20 });     // re-feeds cleanly
    expect(m2.cells.length).toBeGreaterThan(5);
    expect(m2.burgCellIndex).not.toBeNull();
  });

  it('is deterministic at the child tier', () => {
    const parent = { polygon: triangle, seedPath: rootSeedPath(7), features: [] };
    const cell = generateSubmap(parent, { count: 30 }).cells[5];
    const c1 = submapCellToChildContext(cell, parent);
    const c2 = submapCellToChildContext(cell, parent);
    expect(generateSubmap(c1, { count: 15 }).cells.map((c) => c.polygon))
      .toEqual(generateSubmap(c2, { count: 15 }).cells.map((c) => c.polygon));
  });
});

describe('river/road polyline projection', () => {
  const square: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];

  it('clipPolylineToPolygon keeps the inside portion of a crossing polyline', () => {
    // a horizontal line from x=-50 to x=150 at y=50 → inside piece x∈[0,100]
    const pieces = clipPolylineToPolygon([[-50, 50], [150, 50]], square);
    expect(pieces).toHaveLength(1);
    expect(pieces[0][0][0]).toBeCloseTo(0, 3);
    expect(pieces[0][pieces[0].length - 1][0]).toBeCloseTo(100, 3);
  });

  it('generateSubmap carries inherited polylines onto the model, clipped to the boundary', () => {
    const r = generateSubmap(
      { polygon: square, seedPath: rootSeedPath(42), polylines: [{ kind: 'river', points: [[-20, 50], [120, 50]] }] },
      { count: 30 },
    );
    expect(r.polylines.length).toBeGreaterThanOrEqual(1);
    expect(r.polylines[0].kind).toBe('river');
    for (const [x] of r.polylines[0].points) {
      expect(x).toBeGreaterThanOrEqual(-1e-6);
      expect(x).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it('recursion descends inherited polylines into the sub-cell that the river crosses', () => {
    const parent = {
      polygon: square,
      seedPath: rootSeedPath(42),
      polylines: [{ kind: 'river' as const, points: [[-20, 50], [120, 50]] as Array<[number, number]> }],
    };
    const m = generateSubmap(parent, { count: 40 });
    const crossed = m.cells.find((c) => {
      const child = submapCellToChildContext(c, parent);
      return (child.polylines ?? []).length > 0;
    });
    expect(crossed).toBeTruthy(); // at least one sub-cell inherits the river segment
  });
});

describe('per-sub-cell biome sub-variation', () => {
  it('subBiomeFor is deterministic and stays within the parent biome variant set', () => {
    const sp = rootSeedPath(42);
    const palette = ['Grassland', 'Savanna', 'Wetland', 'Temperate deciduous forest'];
    for (let i = 0; i < 50; i++) {
      const a = subBiomeFor('Grassland', sp, i);
      const b = subBiomeFor('Grassland', sp, i);
      expect(a).toBe(b);
      expect(palette).toContain(a);
    }
  });

  it('keeps the parent biome when there is no variant palette, undefined stays undefined', () => {
    expect(subBiomeFor('Temperate forest', rootSeedPath(1), 3)).toBe('Temperate forest');
    expect(subBiomeFor(undefined, rootSeedPath(1), 0)).toBeUndefined();
  });

  it('every generated submap cell carries a biome — dominant parent, with variation', () => {
    const r = generateSubmap(
      { polygon: triangle, seedPath: rootSeedPath(42), biome: 'Grassland' },
      { count: 80 },
    );
    for (const c of r.cells) expect(typeof c.biome).toBe('string');
    const biomes = r.cells.map((c) => c.biome);
    const parentCount = biomes.filter((b) => b === 'Grassland').length;
    expect(parentCount).toBeGreaterThan(biomes.length * 0.4); // parent dominates
    expect(new Set(biomes).size).toBeGreaterThan(1);          // but locally varied
  });
});

describe('clipPolygon (Sutherland-Hodgman, convex clip)', () => {
  it('trims a subject larger than the clip down to the clip region', () => {
    const big: Array<[number, number]> = [[-5, -5], [15, -5], [15, 15], [-5, 15]];
    const clip: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const out = clipPolygon(big, clip);
    expect(out.length).toBeGreaterThanOrEqual(4);
    for (const [x, y] of out) {
      expect(x).toBeGreaterThanOrEqual(-1e-6);
      expect(x).toBeLessThanOrEqual(10 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(10 + 1e-6);
    }
  });
});


/**
 * Gradual biome transitions across a parent-tier edge (W16-D).
 *
 * The parent is a 1000x1000 square of forest. One neighbour sits due EAST, so
 * the blend direction is +x, the parent's reach along it is 500, and a cell
 * only feels any pull once its normalized position t = (x - 500) / 500 passes
 * EDGE_BLEND_START = 0.5, i.e. x > 750.
 */
describe('gradual biome transitions at a parent-tier edge', () => {
  const PARENT: Array<[number, number]> = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const FOREST = 'Temperate deciduous forest';
  /** NOT in BIOME_VARIANTS[FOREST], so any desert cell can only come from the blend. */
  const DESERT = 'Hot desert';
  const eastDesert: NeighbourBiome[] = [{ biome: DESERT, centroid: [2000, 500] }];
  /** t = 0 at the parent centre, t = 1 at the eastern boundary. */
  const tOf = (c: { polygon: Array<[number, number]> }): number => (polygonCentroid(c.polygon)[0] - 500) / 500;

  it('(a) regression pin: with no neighbour data the cell biomes are IDENTICAL to before edge blending', () => {
    const r = generateSubmap(
      { polygon: triangle, seedPath: rootSeedPath(42), biome: 'Grassland' },
      { count: 80 },
    );
    expect(r.cells.map((c) => c.biome)).toEqual(GOLDEN_NO_NEIGHBOURS);
  });

  it('(a2) an empty neighbour list is the same as no neighbour list', () => {
    const base = { polygon: PARENT, seedPath: rootSeedPath(4242), biome: FOREST } as const;
    const none = generateSubmap(base, { count: 300 });
    const empty = generateSubmap({ ...base, neighbourBiomes: [] }, { count: 300 });
    expect(empty.cells.map((c) => c.biome)).toEqual(none.cells.map((c) => c.biome));
  });

  it('(b) a forest cell beside a desert cell grows a mixed band at that edge, and ONLY that edge', () => {
    const base = { polygon: PARENT, seedPath: rootSeedPath(4242), biome: FOREST } as const;
    const plain = generateSubmap(base, { count: 600 });
    const blended = generateSubmap({ ...base, neighbourBiomes: eastDesert }, { count: 600 });

    // Nothing but the blend can introduce the neighbour biome.
    expect(plain.cells.some((c) => c.biome === DESERT)).toBe(false);
    const desert = blended.cells.filter((c) => c.biome === DESERT);
    expect(desert.length).toBeGreaterThan(20);

    // ONLY that edge: every desert cell lies past the blend threshold toward the neighbour.
    for (const c of desert) expect(tOf(c)).toBeGreaterThan(EDGE_BLEND_START);

    // Interior cells are untouched — identical biome to the unblended run.
    const interior = blended.cells.filter((c) => tOf(c) <= EDGE_BLEND_START).map((c) => c.biome);
    const interiorPlain = plain.cells.filter((c) => tOf(c) <= EDGE_BLEND_START).map((c) => c.biome);
    expect(interior).toEqual(interiorPlain);

    // Gradient, not a step: the outermost slice is far more desert than the inner slice.
    const frac = (lo: number, hi: number): number => {
      const band = blended.cells.filter((c) => tOf(c) > lo && tOf(c) <= hi);
      expect(band.length).toBeGreaterThan(10);
      return band.filter((c) => c.biome === DESERT).length / band.length;
    };
    const outer = frac(0.85, 1.0);
    const inner = frac(EDGE_BLEND_START, 0.65);
    expect(outer).toBeGreaterThan(0.4);
    expect(inner).toBeLessThan(outer);
  });

  it('(b2) a neighbour of the SAME biome as the parent changes nothing', () => {
    const base = { polygon: PARENT, seedPath: rootSeedPath(4242), biome: FOREST } as const;
    const plain = generateSubmap(base, { count: 300 });
    const same = generateSubmap(
      { ...base, neighbourBiomes: [{ biome: FOREST, centroid: [2000, 500] }] },
      { count: 300 },
    );
    expect(same.cells.map((c) => c.biome)).toEqual(plain.cells.map((c) => c.biome));
  });

  it('(c) same seed → same blend', () => {
    const ctx = { polygon: PARENT, seedPath: rootSeedPath(4242), biome: FOREST, neighbourBiomes: eastDesert };
    const a = generateSubmap(ctx, { count: 300 });
    const b = generateSubmap(ctx, { count: 300 });
    expect(a.cells.map((c) => c.biome)).toEqual(b.cells.map((c) => c.biome));
  });

  it('edgeBlendPull rises toward the shared edge and is zero in the interior', () => {
    const at = (x: number): number =>
      edgeBlendPull(FOREST, { cellCentroid: [x, 500], parentPolygon: PARENT, neighbourBiomes: eastDesert })?.pull ?? 0;
    expect(at(200)).toBe(0);   // far side
    expect(at(500 + 500 * EDGE_BLEND_START - 20)).toBe(0); // interior, below the threshold
    expect(at(800)).toBeGreaterThan(0);
    expect(at(900)).toBeGreaterThan(at(800));
    expect(at(1000)).toBeGreaterThan(at(900));
    expect(at(1000)).toBeLessThanOrEqual(1);
  });

  it('edgeBlendPull picks the NEAREST differing neighbour at a corner', () => {
    const corner = edgeBlendPull(FOREST, {
      cellCentroid: [980, 520],
      parentPolygon: PARENT,
      neighbourBiomes: [{ biome: DESERT, centroid: [2000, 500] }, { biome: 'Tundra', centroid: [500, 2000] }],
    });
    expect(corner?.biome).toBe(DESERT);
  });

  it('a submap with no biome stays undefined even with neighbours', () => {
    const r = generateSubmap(
      { polygon: PARENT, seedPath: rootSeedPath(1), neighbourBiomes: eastDesert },
      { count: 40 },
    );
    for (const c of r.cells) expect(c.biome).toBeUndefined();
  });
});

/**
 * Cell biomes for `triangle` / seed 42 / count 80, captured from the generator
 * BEFORE edge blending existed. The blend draws from its own `edge-blend`
 * stream, so a context with no neighbours must still produce exactly this.
 */
const GOLDEN_NO_NEIGHBOURS: string[] = [
  'Grassland', 'Grassland', 'Temperate deciduous forest', 'Grassland',
  'Grassland', 'Grassland', 'Savanna', 'Temperate deciduous forest',
  'Wetland', 'Grassland', 'Grassland', 'Savanna',
  'Grassland', 'Grassland', 'Wetland', 'Grassland',
  'Grassland', 'Temperate deciduous forest', 'Grassland', 'Grassland',
  'Grassland', 'Temperate deciduous forest', 'Temperate deciduous forest', 'Grassland',
  'Wetland', 'Grassland', 'Grassland', 'Grassland',
  'Grassland', 'Grassland', 'Grassland', 'Grassland',
  'Grassland', 'Temperate deciduous forest', 'Grassland', 'Grassland',
  'Temperate deciduous forest', 'Savanna', 'Grassland', 'Savanna',
  'Savanna', 'Temperate deciduous forest', 'Grassland', 'Grassland',
  'Temperate deciduous forest', 'Grassland', 'Grassland', 'Wetland',
  'Grassland', 'Grassland', 'Savanna', 'Grassland',
  'Grassland', 'Savanna', 'Temperate deciduous forest', 'Grassland',
  'Grassland', 'Temperate deciduous forest', 'Grassland', 'Wetland',
  'Savanna', 'Temperate deciduous forest', 'Grassland', 'Grassland',
  'Grassland', 'Savanna', 'Wetland', 'Grassland',
  'Grassland', 'Grassland', 'Grassland', 'Savanna',
  'Savanna', 'Grassland', 'Grassland', 'Temperate deciduous forest',
  'Temperate deciduous forest', 'Grassland', 'Grassland', 'Grassland',
];

/**
 * W16-H: the transition band survives the drill. `submapCellToChildContext`
 * reads the parent submap's own cell adjacency, so a sub-cell that touches a
 * differently-biomed sub-cell opens as a child tier that blends toward it.
 */
describe('child-tier edge blending (drill recursion)', () => {
  const sq = (x0: number, y0: number, s: number): Array<[number, number]> =>
    [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
  const parent = { polygon: sq(-1000, 0, 3000), seedPath: rootSeedPath(42), biome: 'Grassland' };
  const mk = (i: number, poly: Array<[number, number]>, biome: string, nb: number[]): SubmapCell =>
    ({ siteIndex: i, polygon: poly, biome, neighbours: nb });
  /** The drilled sub-cell: a Grassland square with one sibling on each side. */
  const drilled = mk(7, sq(0, 0, 1000), 'Grassland', [8, 9]);
  const siblings = (eastBiome: string): SubmapCell[] => [
    drilled,
    mk(8, sq(1000, 0, 1000), eastBiome, [7]),
    mk(9, sq(-1000, 0, 1000), 'Grassland', [7]),
  ];
  // Glacier is NOT in Grassland's variant palette, so a Glacier child cell can
  // only have come from the blend — never from local sub-variation.
  const GLACIER = 'Glacier';

  it('derives the child neighbourBiomes from the parent submap adjacency', () => {
    const child = submapCellToChildContext(drilled, parent, siblings(GLACIER));
    expect(child.biome).toBe('Grassland');                 // the SUB-cell's biome descends
    expect(child.neighbourBiomes).toEqual([
      { biome: GLACIER, centroid: [1500, 500] },           // east sibling, bbox centre
      { biome: 'Grassland', centroid: [-500, 500] },       // west sibling
    ]);
  });

  it('a child tile at a band edge blends toward the adjacent sub-biome', () => {
    const child = submapCellToChildContext(drilled, parent, siblings(GLACIER));
    const m = generateSubmap(child, { count: 120 });
    const glacier = m.cells.filter((c) => c.biome === GLACIER);
    expect(glacier.length).toBeGreaterThan(5);
    // and the band hugs the shared edge: every adopted cell sits in the east
    // part of the child, past EDGE_BLEND_START of the run to the boundary.
    const meanX = (cs: typeof m.cells): number =>
      cs.reduce((a, c) => a + polygonCentroid(c.polygon)[0], 0) / cs.length;
    const rest = m.cells.filter((c) => c.biome !== GLACIER);
    expect(meanX(glacier)).toBeGreaterThan(meanX(rest) + 200);
    for (const c of glacier) {
      expect(polygonCentroid(c.polygon)[0]).toBeGreaterThan(500 + EDGE_BLEND_START * 500);
    }
  });

  it('a child tile in the core does not blend', () => {
    // Every neighbour shares the drilled cell's biome ⇒ no pull at all.
    const child = submapCellToChildContext(drilled, parent, siblings('Grassland'));
    const m = generateSubmap(child, { count: 120 });
    const palette = ['Grassland', 'Savanna', 'Wetland', 'Temperate deciduous forest'];
    for (const c of m.cells) expect(palette).toContain(c.biome);
  });

  it('omitting the siblings leaves the child unblended (unchanged behaviour)', () => {
    const child = submapCellToChildContext(drilled, parent);
    expect(child.neighbourBiomes).toBeUndefined();
    const m = generateSubmap(child, { count: 120 });
    for (const c of m.cells) expect(c.biome).not.toBe(GLACIER);
  });

  it('is deterministic: same parent cell + siblings ⇒ byte-identical child tier', () => {
    const a = generateSubmap(submapCellToChildContext(drilled, parent, siblings(GLACIER)), { count: 120 });
    const b = generateSubmap(submapCellToChildContext(drilled, parent, siblings(GLACIER)), { count: 120 });
    expect(a.cells.map((c) => [c.siteIndex, c.biome, c.polygon])).toEqual(
      b.cells.map((c) => [c.siteIndex, c.biome, c.polygon]),
    );
  });

  it('a real generated submap hands its own cell biomes down as the child neighbours', () => {
    const m = generateSubmap({ polygon: sq(0, 0, 1000), seedPath: rootSeedPath(7), biome: 'Taiga' }, { count: 160 });
    const bySite = new Map(m.cells.map((c) => [c.siteIndex, c]));
    let checked = 0;
    for (const cell of m.cells) {
      const child = submapCellToChildContext(cell, { polygon: sq(0, 0, 1000), seedPath: rootSeedPath(7), biome: 'Taiga' }, m.cells);
      const expected = cell.neighbours
        .map((n) => bySite.get(n)?.biome)
        .filter((b): b is string => Boolean(b));
      expect((child.neighbourBiomes ?? []).map((n) => n.biome)).toEqual(expected);
      if (expected.some((b) => b !== cell.biome)) checked++;
    }
    expect(checked).toBeGreaterThan(20); // plenty of real sub-biome band edges exist
  });
});
