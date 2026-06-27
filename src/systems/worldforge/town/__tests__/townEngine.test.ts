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
  buildTownCore,
  buildOutskirts,
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

// Regression guards for failure modes found by the town audit (2026-06-24):
// overlapping buildings, civic-on-building / civic-on-civic overlap, buildings
// outside the walls, and inverted density (denser towns had FEWER buildings).
describe('no-overlap + density invariants (audit regression)', () => {
  // A larger, more realistic footprint matching the design-preview burg.
  const cx = 360, cy = 360, R = 300;
  const bigFootprint: Pt[] = [
    [cx - R * 0.95, cy - R * 0.35], [cx - R * 0.2, cy - R * 0.95],
    [cx + R * 0.7, cy - R * 0.7], [cx + R * 0.95, cy + R * 0.15],
    [cx + R * 0.45, cy + R * 0.9], [cx - R * 0.5, cy + R * 0.85],
    [cx - R * 0.95, cy + R * 0.25],
  ];
  const river: Pt[][] = [[[cx - R, cy - 40], [cx - 120, cy + 10], [cx + 10, cy - 30], [cx + 130, cy + 60], [cx + R, cy + 120]]];

  const cellCentroid = (poly: Pt[]): Pt => {
    let x = 0, y = 0; for (const [px, py] of poly) { x += px; y += py; } return [x / poly.length, y / poly.length];
  };
  const polysOverlap = (a: Pt[], b: Pt[]): boolean => {
    for (const p of a) if (pointInPolygon(p, b)) return true;
    for (const p of b) if (pointInPolygon(p, a)) return true;
    return false;
  };

  const cases = [
    { label: 'hamlet', pop: 60 }, { label: 'village', pop: 450 },
    { label: 'walled town', pop: 3200 }, { label: 'city', pop: 14000 }, { label: 'capital', pop: 120000 },
  ];

  for (const c of cases) {
    for (const withRiver of [false, true]) {
      it(`${c.label} (river=${withRiver}) has no building/civic overlaps and keeps buildings inside the walls`, () => {
        const plan = generateTownPlan(bigFootprint, rootSeedPath(137), {
          population: c.pop, water: withRiver ? river : [], roads: withRiver ? river : [],
        });
        const buildings = plan.wards.flatMap((w) => w.plots.map((p) => p.polygon));
        expect(buildings.length).toBeGreaterThan(0);

        // No two buildings overlap (centroid-in-other test, both directions).
        for (let i = 0; i < buildings.length; i++) {
          const ci = cellCentroid(buildings[i]);
          for (let j = i + 1; j < buildings.length; j++) {
            if (pointInPolygon(ci, buildings[j]) || pointInPolygon(cellCentroid(buildings[j]), buildings[i])) {
              throw new Error(`${c.label}: buildings ${i} and ${j} overlap`);
            }
          }
        }

        // No solid civic structure sits on a building, and no two solid civics overlap.
        const solid = plan.civic.filter((s) => s.kind !== 'plaza' && s.kind !== 'bridge');
        for (const s of solid) for (const b of buildings) expect(polysOverlap(s.polygon, b)).toBe(false);
        for (let i = 0; i < solid.length; i++)
          for (let j = i + 1; j < solid.length; j++)
            expect(polysOverlap(solid[i].polygon, solid[j].polygon)).toBe(false);

        // Walled towns keep every building inside the wall ring.
        if (plan.walls.ring.length >= 3) {
          for (const b of buildings) expect(pointInPolygon(cellCentroid(b), plan.walls.ring)).toBe(true);
        }
      });
    }
  }

  it('every ward has a buildable block strictly inset from its Voronoi cell (street margin)', () => {
    const areaOf = (poly: Pt[]): number => {
      let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
      return Math.abs(a) / 2;
    };
    const plan = generateTownPlan(bigFootprint, rootSeedPath(137), { population: 14000 });
    for (const w of plan.wards) {
      expect(w.block.length).toBeGreaterThanOrEqual(3);
      // The block is inset, so it must be smaller than the full ward → a street gap.
      expect(areaOf(w.block)).toBeLessThan(areaOf(w.polygon));
    }
  });

  it('building count scales UP with typology (hamlet < village < walled < city < capital)', () => {
    const count = (pop: number) => countPlots(generateTownPlan(bigFootprint, rootSeedPath(137), { population: pop }));
    const hamlet = count(60), village = count(450), walled = count(3200), city = count(14000), capital = count(120000);
    expect(hamlet).toBeLessThan(village);
    expect(village).toBeLessThan(walled);
    expect(walled).toBeLessThan(city);
    expect(city).toBeLessThan(capital);
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

describe('organic town core + outskirts (lives inside the cell, not its exact shape)', () => {
  // An area helper (shoelace).
  const area = (pts: Pt[]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
  };

  it('buildTownCore stays inside the cell and is smaller than it', () => {
    const center = polygonCentroid(footprint);
    const core = buildTownCore(footprint, center, 0.6, rootSeedPath(5));
    expect(core.length).toBeGreaterThan(8);
    for (const p of core) expect(pointInPolygon(p, footprint)).toBe(true); // never spills the cell
    expect(area(core)).toBeLessThan(area(footprint) * 0.85);              // leaves an outskirts ring
  });

  it('a bigger settlement core fills more of the cell than a small one', () => {
    const center = polygonCentroid(footprint);
    const hamlet = area(buildTownCore(footprint, center, 0.42, rootSeedPath(5)));
    const capital = area(buildTownCore(footprint, center, 0.86, rootSeedPath(5)));
    expect(capital).toBeGreaterThan(hamlet);
  });

  it('buildOutskirts classifies the ring (farm near the core → scrub at the rim)', () => {
    const center = polygonCentroid(footprint);
    const core = buildTownCore(footprint, center, 0.5, rootSeedPath(5));
    const outs = buildOutskirts(footprint, core, center, rootSeedPath(5), 40);
    expect(outs.length).toBeGreaterThan(0);
    const kinds = new Set(outs.map((o) => o.kind));
    expect([...kinds].every((k) => ['farm', 'pasture', 'scrub'].includes(k))).toBe(true);
    // No outskirt parcel centroid sits inside the town core.
    for (const o of outs) expect(pointInPolygon(polygonCentroid(o.polygon), core)).toBe(false);
  });

  it('generateTownPlan emits an organic core (inside the cell) + outskirts; wards sit in the core', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    expect(plan.core.length).toBeGreaterThan(8);
    for (const p of plan.core) expect(pointInPolygon(p, plan.footprint)).toBe(true);
    expect(area(plan.core)).toBeLessThan(area(plan.footprint) * 0.9); // core ≠ whole cell
    expect(plan.outskirts.length).toBeGreaterThan(0);
    // Ward centroids fall within the core, not the outskirts ring.
    const inCore = plan.wards.filter((w) => pointInPolygon(polygonCentroid(w.polygon), plan.core)).length;
    expect(inCore).toBeGreaterThan(plan.wards.length * 0.6);
  });
});

describe('generateTownPlan — dock capping (#4 quality)', () => {
  // A large footprint with water along a full edge + a river up the middle makes
  // many wards "waterfront"; without a cap every one would seat a dock.
  const bigFp: Pt[] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const heavyWater: Pt[][] = [
    [[0, 20], [1000, 20]],      // coast along the whole bottom edge
    [[500, 0], [500, 1000]],    // a river straight up the middle
  ];
  const dockCount = (plan: ReturnType<typeof generateTownPlan>): number =>
    plan.civic.filter((c) => c.kind === 'dock').length;

  it('caps docks to a few principal quays for a city (not one per waterfront ward)', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(7), { population: 6000, water: heavyWater });
    const docks = dockCount(plan);
    expect(docks).toBeGreaterThan(0);
    expect(docks).toBeLessThanOrEqual(4); // city cap
  });

  it('a small town gets fewer docks than a city', () => {
    const town = dockCount(generateTownPlan(bigFp, rootSeedPath(7), { population: 3000, water: heavyWater }));
    const city = dockCount(generateTownPlan(bigFp, rootSeedPath(7), { population: 20000, water: heavyWater }));
    expect(town).toBeLessThanOrEqual(2); // walled-town cap
    expect(city).toBeGreaterThanOrEqual(town);
  });

  it('leaves no orphan dock-flagged ward (every dock ward has a kept pier)', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(7), { population: 6000, water: heavyWater });
    const dockWardIdx = new Set(
      plan.civic.filter((c) => c.kind === 'dock').map((c) => c.wardIndex),
    );
    plan.wards.forEach((w, i) => {
      if (w.civic === 'dock') expect(dockWardIdx.has(i)).toBe(true);
    });
  });
});
