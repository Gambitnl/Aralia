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
      polylines: [{ kind: 'river' as const, points: [[-20, 50], [120, 50]] }],
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
