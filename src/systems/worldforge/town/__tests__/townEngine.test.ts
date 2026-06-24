import { describe, it, expect } from 'vitest';
import {
  polygonCentroid,
  packWardFrontage,
  generateTownPlan,
  countPlots,
  buildWalls,
  assignCivicRoles,
  typologyForPopulation,
  scaleProfile,
  wardWaterEdge,
  findBridges,
  packWardInterior,
} from '../townEngine';
import { pointInPolygon, polygonBounds, type Pt } from '../../submap/submapEngine';
import { rootSeedPath } from '../../seedPath';

const footprint: Pt[] = [[0, 0], [120, 0], [140, 90], [70, 140], [0, 100]];
const squareWard: Pt[] = [[0, 0], [50, 0], [50, 50], [0, 50]];

describe('polygonCentroid', () => {
  it('returns the center of a square', () => {
    const c = polygonCentroid(squareWard);
    expect(c[0]).toBeCloseTo(25, 6);
    expect(c[1]).toBeCloseTo(25, 6);
  });
});

describe('packWardFrontage (party-wall plots)', () => {
  it('packs plots along the ward edges, each a 4-gon set inward (not a scatter)', () => {
    const plots = packWardFrontage(squareWard, rootSeedPath(1), { plotWidth: 6, plotDepth: 7 });
    expect(plots.length).toBeGreaterThan(8); // multiple plots per side, all four sides
    for (const p of plots) {
      expect(p.polygon.length).toBeGreaterThanOrEqual(4); // rect (4) or stepped/L (6)
      // The plot's own centroid sits inside the ward (set back from the street).
      expect(pointInPolygon(polygonCentroid(p.polygon), squareWard)).toBe(true);
    }
    // Plots come from more than one frontage edge (ring of frontage, not one line).
    expect(new Set(plots.map((p) => p.frontageEdge)).size).toBeGreaterThan(1);
  });

  it('is deterministic for a given seed-path', () => {
    const a = packWardFrontage(squareWard, rootSeedPath(7));
    const b = packWardFrontage(squareWard, rootSeedPath(7));
    expect(a.map((p) => p.polygon)).toEqual(b.map((p) => p.polygon));
  });

  it('skips edges too short to seat a plot', () => {
    const sliver: Pt[] = [[0, 0], [3, 0], [3, 60], [0, 60]];
    const plots = packWardFrontage(sliver, rootSeedPath(1), { plotWidth: 6, plotDepth: 7 });
    // Only the two long edges (length 60) seat plots; the width-3 edges are skipped.
    expect(new Set(plots.map((p) => p.frontageEdge)).size).toBeLessThanOrEqual(2);
    expect(plots.length).toBeGreaterThan(0);
  });
});

describe('generateTownPlan', () => {
  it('subdivides the footprint into wards, each with frontage plots', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { wardCount: 12 });
    expect(plan.footprint).toBe(footprint);
    expect(plan.wards.length).toBeGreaterThan(6);
    for (const w of plan.wards) expect(w.polygon.length).toBeGreaterThanOrEqual(3);
    expect(countPlots(plan)).toBeGreaterThan(20); // a real town, not a handful
  });

  it('scales plot count with ward count (density grows with size)', () => {
    const small = countPlots(generateTownPlan(footprint, rootSeedPath(42), { wardCount: 6 }));
    const big = countPlots(generateTownPlan(footprint, rootSeedPath(42), { wardCount: 24 }));
    expect(big).toBeGreaterThan(small);
  });

  it('is deterministic for a given seed-path', () => {
    const a = generateTownPlan(footprint, rootSeedPath(99), { wardCount: 12 });
    const b = generateTownPlan(footprint, rootSeedPath(99), { wardCount: 12 });
    expect(countPlots(a)).toBe(countPlots(b));
  });
});

describe('buildWalls (criterion #3: walls + gatehouses)', () => {
  it('insets a wall ring inside the footprint with gatehouses', () => {
    const walls = buildWalls(footprint, 3);
    expect(walls.ring).toHaveLength(footprint.length);
    for (const v of walls.ring) expect(pointInPolygon(v, footprint)).toBe(true); // ring is inside
    expect(walls.gatehouses.length).toBe(3);
    for (const g of walls.gatehouses) expect(pointInPolygon(g, footprint)).toBe(true);
  });
});

describe('assignCivicRoles', () => {
  it('makes the most central ward the plaza and the most peripheral the keep', () => {
    const center: Pt = [0, 0];
    const centroids: Pt[] = [[1, 0], [40, 40], [3, -2], [-20, 5]]; // d²: 1, 3200, 13, 425
    const roles = assignCivicRoles(centroids, center);
    expect(roles.get(0)).toBe('plaza');  // closest to center (d²=1)
    expect(roles.get(1)).toBe('keep');   // farthest (d²=3200)
    expect(roles.get(2)).toBe('temple'); // next central distinct (d²=13)
  });
});

describe('typology by scale (criterion #5)', () => {
  it('maps population to settlement typology across the bands (uncapped)', () => {
    expect(typologyForPopulation(50)).toBe('hamlet');
    expect(typologyForPopulation(500)).toBe('village');
    expect(typologyForPopulation(3000)).toBe('walled town');
    expect(typologyForPopulation(12000)).toBe('city');
    expect(typologyForPopulation(250000)).toBe('capital');
  });

  it('scaleProfile gates civic anatomy: hamlet bare, capital full + citadel', () => {
    const hamlet = scaleProfile(50);
    expect(hamlet.hasWalls).toBe(false);
    expect(hamlet.hasKeep).toBe(false);
    expect(hamlet.hasPlaza).toBe(false);
    const capital = scaleProfile(100000);
    expect(capital.hasWalls).toBe(true);
    expect(capital.hasKeep).toBe(true);
    expect(capital.hasCitadel).toBe(true);
  });

  it('ward count grows with population and is uncapped', () => {
    expect(scaleProfile(100000).wardCount).toBeGreaterThan(scaleProfile(3000).wardCount);
    expect(scaleProfile(3000).wardCount).toBeGreaterThan(scaleProfile(50).wardCount);
  });

  it('generateTownPlan(population) reflects the scale: hamlet has no walls/plaza, capital has a citadel', () => {
    const hamlet = generateTownPlan(footprint, rootSeedPath(3), { population: 50 });
    expect(hamlet.walls.ring).toHaveLength(0);
    expect(hamlet.civic.map((c) => c.kind)).not.toContain('plaza');

    const capital = generateTownPlan(footprint, rootSeedPath(3), { population: 120000 });
    expect(capital.walls.ring.length).toBeGreaterThan(0);
    const kinds = capital.civic.map((c) => c.kind);
    expect(kinds).toContain('citadel');
    expect(kinds).toContain('keep');
    expect(kinds).toContain('plaza');
  });

  it('is deterministic for a given population + seed-path', () => {
    const a = generateTownPlan(footprint, rootSeedPath(8), { population: 4000 });
    const b = generateTownPlan(footprint, rootSeedPath(8), { population: 4000 });
    expect(countPlots(a)).toBe(countPlots(b));
    expect(a.civic.map((c) => c.kind).sort()).toEqual(b.civic.map((c) => c.kind).sort());
  });
});

describe('variety + interior infill (criterion #6)', () => {
  const bigWard: Pt[] = [[0, 0], [120, 0], [120, 120], [0, 120]];

  it('produces some stepped/L footprints when variety is on, none when off', () => {
    const varied = packWardFrontage(bigWard, rootSeedPath(11), { plotWidth: 8, plotDepth: 9, variety: true });
    expect(varied.some((p) => p.shape === 'L' || p.polygon.length > 4)).toBe(true);
    const plain = packWardFrontage(bigWard, rootSeedPath(11), { plotWidth: 8, plotDepth: 9, variety: false });
    expect(plain.every((p) => p.polygon.length === 4)).toBe(true);
  });

  it('packWardInterior places freestanding buildings inside the ward core', () => {
    const inside = packWardInterior(bigWard, rootSeedPath(2), { plotWidth: 8 });
    expect(inside.length).toBeGreaterThan(0);
    for (const p of inside) {
      expect(p.kind).toBe('interior');
      expect(p.frontageEdge).toBe(-1);
      expect(pointInPolygon(polygonCentroid(p.polygon), bigWard)).toBe(true);
    }
  });

  it('interior infill increases the total plot count', () => {
    const withInfill = countPlots(generateTownPlan(footprint, rootSeedPath(4), { wardCount: 12 }));
    const without = countPlots(generateTownPlan(footprint, rootSeedPath(4), { wardCount: 12, interiorInfill: false }));
    expect(withInfill).toBeGreaterThan(without);
  });

  it('road continuation: inherited roads become main streets clipped to the town', () => {
    const roads: Pt[][] = [[[-50, 60], [200, 60]]]; // a regional road sweeping through
    const plan = generateTownPlan(footprint, rootSeedPath(4), { wardCount: 12, roads });
    expect(plan.streets.length).toBeGreaterThanOrEqual(1);
    const b = polygonBounds(footprint);
    for (const s of plan.streets) for (const [x] of s) {
      expect(x).toBeGreaterThanOrEqual(b.minX - 1);
      expect(x).toBeLessThanOrEqual(b.maxX + 1);
    }
  });

  it('is deterministic with variety + infill + roads', () => {
    const roads: Pt[][] = [[[-50, 60], [200, 60]]];
    const a = generateTownPlan(footprint, rootSeedPath(13), { wardCount: 12, roads });
    const c = generateTownPlan(footprint, rootSeedPath(13), { wardCount: 12, roads });
    expect(countPlots(a)).toBe(countPlots(c));
    expect(a.streets).toEqual(c.streets);
  });
});

describe('terrain/water pass (criterion #4)', () => {
  it('wardWaterEdge flags a waterfront ward and returns the water-facing edge', () => {
    // Water runs just below the bottom edge (edge 0: (0,0)->(50,0)) of the ward.
    const water: Pt[][] = [[[-10, -2], [60, -2]]];
    const edge = wardWaterEdge(squareWard, water, 5);
    expect(edge).toBe(0);
    // Far-away water → not waterfront.
    expect(wardWaterEdge(squareWard, [[[-100, -100], [-90, -90]]], 5)).toBeNull();
  });

  it('findBridges marks a crossing where a river passes between two wards', () => {
    const left: Pt[] = [[0, 0], [50, 0], [50, 100], [0, 100]];
    const right: Pt[] = [[50, 0], [100, 0], [100, 100], [50, 100]];
    const river: Pt[][] = [[[-10, 50], [110, 50]]];
    const bridges = findBridges(river, [left, right], 1);
    expect(bridges.length).toBeGreaterThanOrEqual(1);
    expect(bridges[0][0]).toBeGreaterThan(46); // crossing sits near the shared boundary x=50
    expect(bridges[0][0]).toBeLessThan(54);
    expect(bridges[0][1]).toBeCloseTo(50, 0);  // on the river line (y=50)
  });

  it('generateTownPlan(water) seats docks on waterfront wards', () => {
    const water: Pt[][] = [[[0, 70], [120, 70]]]; // a river sweeping through the footprint
    const plan = generateTownPlan(footprint, rootSeedPath(5), { wardCount: 16, water });
    expect(plan.civic.some((c) => c.kind === 'dock')).toBe(true);
  });

  it('slope-aware: a steep height field removes some frontage plots', () => {
    const flat = countPlots(generateTownPlan(footprint, rootSeedPath(5), { wardCount: 16 }));
    const steep = countPlots(generateTownPlan(footprint, rootSeedPath(5), {
      wardCount: 16,
      heightAt: (p: Pt) => p[1] * 2, // strong N–S grade
      maxGrade: 0.5,
    }));
    expect(steep).toBeLessThan(flat);
  });

  it('is deterministic with water + height inputs', () => {
    const water: Pt[][] = [[[0, 70], [120, 70]]];
    const a = generateTownPlan(footprint, rootSeedPath(6), { wardCount: 16, water });
    const b = generateTownPlan(footprint, rootSeedPath(6), { wardCount: 16, water });
    expect(countPlots(a)).toBe(countPlots(b));
    expect(a.civic.filter((c) => c.kind === 'dock').length).toBe(b.civic.filter((c) => c.kind === 'dock').length);
  });
});

describe('generateTownPlan civic anatomy (criterion #3)', () => {
  it('produces walls, a plaza, a temple and a keep; the plaza ward has no plots', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { wardCount: 14 });
    expect(plan.walls.ring.length).toBeGreaterThanOrEqual(3);
    const kinds = plan.civic.map((c) => c.kind);
    expect(kinds).toContain('plaza');
    expect(kinds).toContain('temple');
    expect(kinds).toContain('keep');
    const plazaWard = plan.wards.find((w) => w.civic === 'plaza');
    expect(plazaWard).toBeTruthy();
    expect(plazaWard!.plots).toHaveLength(0); // open market square, not built over
  });
});
