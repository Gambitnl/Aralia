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
  findWaterGates,
  insetConvexPolygon,
  MAIN_ROAD_CARVE_HALF_FRAC,
  WATER_CARVE_HALF_FRAC,
  wallFill,
  MIN_LOT_WIDTH_FT,
  MAX_LOT_WIDTH_FT,
  QUAY_WIDTH_FT,
  type TownPlan,
} from '../townEngine';
import { pointInPolygon, polygonBounds, type Pt } from '../../submap/submapEngine';
import { rootSeedPath } from '../../seedPath';
import { cornerAngles, houseShapeOk, isSquarish, minWidth, packBlockDeep, packBlockRows, packBlockSquare, rectangleOnFront, simplifyConvexCorners } from '../townLots';
import { STREET_TIER_SPECS } from '../streetRibbons';
import { courtyardCentersForBlock, resolveCourtyardSpaces } from '../courtyardSpaces';
import { resolveBuildingEnsembles } from '../buildingEnsembles';

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

  it('negotiates one rear boundary per dense street edge', () => {
    const plots = packWardFrontage(squareWard, rootSeedPath(71), {
      plotWidth: 8,
      plotDepth: 10,
      variety: true,
      partyWallRows: true,
    });
    const byEdge = new Map<number, typeof plots>();
    for (const candidate of plots) {
      const group = byEdge.get(candidate.frontageEdge) ?? [];
      group.push(candidate);
      byEdge.set(candidate.frontageEdge, group);
    }

    for (const edgePlots of byEdge.values()) {
      const depths = edgePlots.map((candidate) =>
        Math.hypot(
          candidate.polygon.at(-1)![0] - candidate.polygon[0][0],
          candidate.polygon.at(-1)![1] - candidate.polygon[0][1],
        ));
      expect(new Set(depths.map((depth) => depth.toFixed(6))).size).toBe(1);
      expect(edgePlots.every((candidate) => candidate.shape === 'rect')).toBe(true);
    }
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
    // Every first edge faces its intentionally empty indexed court. This edge
    // becomes the interior building's frontage in the artifact adapter.
    const courtCount = Math.max(...inside.map((plot) => plot.courtyardIndex ?? 0)) + 1;
    const centers = courtyardCentersForBlock(bigWard, courtCount);
    for (const p of inside) {
      const center = centers[p.courtyardIndex ?? 0];
      const frontMid: Pt = [
        (p.polygon[0][0] + p.polygon[1][0]) / 2,
        (p.polygon[0][1] + p.polygon[1][1]) / 2,
      ];
      const backMid: Pt = [
        (p.polygon[2][0] + p.polygon[3][0]) / 2,
        (p.polygon[2][1] + p.polygon[3][1]) / 2,
      ];
      expect(Math.hypot(frontMid[0] - center[0], frontMid[1] - center[1]))
        .toBeLessThan(Math.hypot(backMid[0] - center[0], backMid[1] - center[1]));
    }
    for (let index = 0; index < centers.length; index++) {
      expect(inside.some((plot) =>
        (plot.courtyardIndex ?? 0) === index
        && pointInPolygon(centers[index], plot.polygon))).toBe(false);
    }
    expect(courtCount).toBeGreaterThan(1);
  });

  it('composes three distinct courts in a genuinely large block', () => {
    const block: Pt[] = [[0, 0], [240, 0], [240, 160], [0, 160]];
    const plots = packWardInterior(block, rootSeedPath(2027), { plotWidth: 8 });
    const ward = { polygon: block, block, plots };
    const ensembles = resolveBuildingEnsembles([ward], [], 'city', rootSeedPath(2027));
    for (const plot of plots) plot.ensemble = ensembles.get(plot);
    const courts = resolveCourtyardSpaces([ward], rootSeedPath(2027));

    expect(courts).toHaveLength(3);
    expect(new Set(courts.map((court) => court.blockKey)).size).toBe(3);
    expect(new Set(courts.map((court) => court.courtyardSignature)).size).toBe(3);
    for (const court of courts) {
      const members = plots.filter((plot) => plot.ensemble?.blockKey === court.blockKey);
      expect(members.length).toBeGreaterThanOrEqual(3);
      expect(members.some((plot) => pointInPolygon(court.center, plot.polygon))).toBe(false);
    }
  });

  it('emits deterministic shared-courtyard receipts from surviving interior plots', () => {
    // RE-PINNED (GG-552 after the GG-563 block shapes, 2026-11-01): the smaller
    // grid blocks leave the 12,000-person schematic city no shared court
    // (GG-577), so the receipts are checked on a capital that keeps two.
    const CAP: Pt[] = [[-500, -500], [500, -500], [500, 500], [-500, 500]];
    const RD: Pt[] = [[-600, 40], [-200, 20], [200, -10], [600, 30]];
    const first = generateTownPlan(CAP, rootSeedPath(32), { population: 30_000, roads: [RD], feetPerUnit: 2 });
    const replay = generateTownPlan(CAP, rootSeedPath(32), { population: 30_000, roads: [RD], feetPerUnit: 2 });

    expect(first.courtyards.length).toBeGreaterThan(0);
    expect(replay.courtyards).toEqual(first.courtyards);
    for (let index = 1; index < first.courtyards.length; index++) {
      expect(first.courtyards[index].amenity).not.toBe(first.courtyards[index - 1].amenity);
    }
    for (const court of first.courtyards) {
      const ward = first.wards[court.wardIndex];
      const courtPlots = ward.plots.filter((plot) =>
        plot.kind === 'interior' && plot.ensemble?.blockKey === court.blockKey);
      expect(courtPlots.length).toBeGreaterThanOrEqual(2);
      expect(court.districtKey).toBe(ward.architectureDistrict?.key);
      expect(court.wealth).toBe(ward.wealth);
      expect(court.radius).toBeGreaterThan(0);
      expect(courtPlots.some((plot) => pointInPolygon(court.center, plot.polygon))).toBe(false);
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

// ── Street-true blocks + wedge plots (plot/street overlap fix) ───────────────

/** Distance from a point to the nearest edge of a polygon boundary. */
function distToBoundary(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    const qx = a[0] + dx * t, qy = a[1] + dy * t;
    best = Math.min(best, Math.hypot(p[0] - qx, p[1] - qy));
  }
  return best;
}

function segsCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = d(b1, b2, a1), d2 = d(b1, b2, a2), d3 = d(a1, a2, b1), d4 = d(a1, a2, b2);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** True when two simple polygons overlap (edge cross or full containment). */
function polysIntersect(a: Pt[], b: Pt[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

describe('insetConvexPolygon (true street margin)', () => {
  it('insets a square uniformly on every side', () => {
    const inset = insetConvexPolygon(squareWard, 5)!;
    expect(inset).not.toBeNull();
    expect(inset.length).toBe(4);
    for (const v of inset) expect(distToBoundary(v, squareWard)).toBeCloseTo(5, 4);
  });

  it('keeps every vertex at the margin on an irregular convex polygon', () => {
    // Off-center convex pentagon: centroid-scaling would inset edges unevenly.
    const poly: Pt[] = [[0, 0], [90, 10], [100, 60], [40, 85], [-5, 40]];
    const inset = insetConvexPolygon(poly, 4)!;
    expect(inset).not.toBeNull();
    for (const v of inset) expect(distToBoundary(v, poly)).toBeCloseTo(4, 3);
  });

  it('returns null when the margin swallows the polygon', () => {
    expect(insetConvexPolygon(squareWard, 30)).toBeNull();
  });
});

describe('plots respect streets (the overlap fix)', () => {
  const plan = generateTownPlan(footprint, rootSeedPath(137), { population: 3200 });

  it('every plot keeps a real street margin from its ward boundary', () => {
    for (const w of plan.wards) {
      for (const pl of w.plots) {
        for (const v of pl.polygon) {
          // Ward edges ARE street centerlines; a vertex touching one is a
          // building in the road. The inset street margin keeps them off it
          // (tiny wards retry at half margin = 0.6, hence the 0.55 floor —
          // the pre-fix centroid-scale left vertices at ~0, in the street).
          expect(distToBoundary(v, w.polygon)).toBeGreaterThan(0.55);
        }
      }
    }
  });

  it('produces wedge plots that follow angled ward edges', () => {
    const shapes = plan.wards.flatMap((w) => w.plots.map((p) => p.shape));
    expect(shapes).toContain('wedge');
  });

  it('carves plots off the river channel (no buildings in the water)', () => {
    const water: Pt[][] = [[[-50, 60], [40, 70], [90, 55], [200, 80]]];
    const p2 = generateTownPlan(footprint, rootSeedPath(137), { population: 3200, water });
    const b = polygonBounds(footprint);
    const half = Math.max(b.maxX - b.minX, b.maxY - b.minY) * WATER_CARVE_HALF_FRAC;
    for (const line of water) {
      for (let i = 0; i < line.length - 1; i++) {
        const [x1, y1] = line[i], [x2, y2] = line[i + 1];
        const L = Math.hypot(x2 - x1, y2 - y1) || 1;
        const nx = -(y2 - y1) / L * half, ny = (x2 - x1) / L * half;
        const quad: Pt[] = [[x1 - nx, y1 - ny], [x2 - nx, y2 - ny], [x2 + nx, y2 + ny], [x1 + nx, y1 + ny]];
        for (const w of p2.wards) for (const pl of w.plots) {
          expect(polysIntersect(pl.polygon, quad)).toBe(false);
        }
      }
    }
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
        // A bounding-box reject first: deep lots and suburbs tripled a
        // capital's building count, and the all-pairs test outran its timeout.
        const boxes = buildings.map((b) => polygonBounds(b));
        for (let i = 0; i < buildings.length; i++) {
          const ci = cellCentroid(buildings[i]);
          for (let j = i + 1; j < buildings.length; j++) {
            const A = boxes[i], B = boxes[j];
            if (A.maxX < B.minX || B.maxX < A.minX || A.maxY < B.minY || B.maxY < A.minY) continue;
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

        // Walled towns keep every intramural building inside the wall ring,
        // and every suburb building outside it (GG-544).
        if (plan.walls.ring.length >= 3) {
          for (const w of plan.wards) {
            for (const p of w.plots) expect(pointInPolygon(cellCentroid(p.polygon), plan.walls.ring)).toBe(!w.extramural);
          }
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

  it('larger settlements retain a growing building sample with usable urban lots', () => {
    const count = (pop: number) => countPlots(generateTownPlan(bigFootprint, rootSeedPath(137), { population: pop }));
    const hamlet = count(60), village = count(450), walled = count(3200), city = count(14000), capital = count(120000);
    expect(hamlet).toBeLessThan(village);
    // Walled settlements now reserve usable 25ft frontages instead of packing
    // 15ft boxes. Their finite core can show fewer homes than a detached village;
    // population conservation is checked separately in population.test.ts.
    expect(walled).toBeGreaterThan(hamlet);
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

describe('generateTownPlan — bridge capping (TG1 fix)', () => {
  const bigFp: Pt[] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  // A river that snakes back and forth across the town center, producing many crossings.
  const snakingWater: Pt[][] = [
    [[500, -10], [500, 200], [200, 400], [800, 600], [200, 800], [500, 1010]],
  ];
  const bridgeCount = (plan: ReturnType<typeof generateTownPlan>): number =>
    plan.civic.filter((c) => c.kind === 'bridge').length;

  it('caps bridges to a few principal crossings for a city (not one per ward crossing)', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(8), { population: 15000, water: snakingWater, wardCount: 30 });
    const bridges = bridgeCount(plan);
    expect(bridges).toBeGreaterThan(0);
    expect(bridges).toBeLessThanOrEqual(3); // city cap
  });

  it('a small town gets fewer bridges than a city', () => {
    const townBridges = bridgeCount(generateTownPlan(bigFp, rootSeedPath(8), { population: 800, water: snakingWater, wardCount: 10 }));
    const cityBridges = bridgeCount(generateTownPlan(bigFp, rootSeedPath(8), { population: 15000, water: snakingWater, wardCount: 30 }));
    expect(townBridges).toBeLessThanOrEqual(1); // village cap
    expect(cityBridges).toBeGreaterThan(townBridges);
  });
});

describe('dock/bridge deck geometry (TG5)', () => {
  // A footprint with a river straight up the middle and a coast along the bottom.
  const bigFp: Pt[] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const water: Pt[][] = [
    [[500, -10], [500, 1010]],   // river up the middle
    [[0, 30], [1000, 30]],       // coast along the bottom
  ];

  // Longest side of a quad's oriented bbox vs the shortest — a pier/span is
  // elongated (length >> width), a square is ~1:1.
  const aspect = (poly: Pt[]): number => {
    const b = polygonBounds(poly);
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    return Math.max(w, h) / Math.max(1e-6, Math.min(w, h));
  };

  it('dock decks are elongated piers, not small squares', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(21), { population: 8000, water });
    const docks = plan.civic.filter((c) => c.kind === 'dock');
    expect(docks.length).toBeGreaterThan(0);
    // Every pier deck is meaningfully longer than it is wide.
    for (const d of docks) expect(aspect(d.polygon)).toBeGreaterThan(1.6);
  });

  it('a dock pier reaches seaward — its far end is on the water side of its base', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(21), { population: 8000, water });
    // Return the actual nearest point, not only its distance. A valid pier can
    // cross a river centreline and finish farther from that line than its base;
    // direction is the preserving proof that distinguishes this from an inland
    // pier without rejecting intentional seaward overshoot.
    const nearestPointOnWater = (p: Pt): Pt => {
      let nearest: Pt = water[0][0];
      let nearestDistance = Infinity;
      for (const line of water) {
        for (let i = 0; i < line.length - 1; i++) {
          const a = line[i], b = line[i + 1];
          const vx = b[0] - a[0], vy = b[1] - a[1];
          const c2 = vx * vx + vy * vy || 1;
          let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / c2;
          t = Math.max(0, Math.min(1, t));
          const qx = a[0] + t * vx, qy = a[1] + t * vy;
          const distance = (p[0] - qx) ** 2 + (p[1] - qy) ** 2;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = [qx, qy];
          }
        }
      }
      return nearest;
    };
    const docks = plan.civic.filter((c) => c.kind === 'dock');
    // pierQuad winds [nearL, farL, farR, nearR]: near edge = verts 0,3; far = 1,2.
    // The far end must be at least as close to the water as the near (base) end —
    // i.e. the pier points toward the body, not inland. (Overshoot past the line
    // is bounded by pierLen, so the far end never lands farther than the base.)
    let reaching = 0;
    for (const d of docks) {
      const near: Pt = [(d.polygon[0][0] + d.polygon[3][0]) / 2, (d.polygon[0][1] + d.polygon[3][1]) / 2];
      const far: Pt = [(d.polygon[1][0] + d.polygon[2][0]) / 2, (d.polygon[1][1] + d.polygon[2][1]) / 2];
      const waterPoint = nearestPointOnWater(near);
      const wardCenter = polygonCentroid(plan.wards[d.wardIndex].polygon);
      const towardWater: Pt = Math.hypot(waterPoint[0] - near[0], waterPoint[1] - near[1]) > 1e-6
        ? [waterPoint[0] - near[0], waterPoint[1] - near[1]]
        : [near[0] - wardCenter[0], near[1] - wardCenter[1]];
      const pierDirection: Pt = [far[0] - near[0], far[1] - near[1]];
      if (pierDirection[0] * towardWater[0] + pierDirection[1] * towardWater[1] >= -1e-6) reaching++;
    }
    // The strong majority of piers point toward water. Piers may cross the
    // centerline, which is still a correct seaward result rather than a failure.
    expect(reaching).toBeGreaterThanOrEqual(Math.ceil(docks.length * 0.6));
  });

  it('bridge decks span across the river (elongated, not a tiny square)', () => {
    const crossingWater: Pt[][] = [[[500, -10], [500, 1010]]];
    const plan = generateTownPlan(bigFp, rootSeedPath(22), { population: 8000, water: crossingWater, wardCount: 24 });
    const bridges = plan.civic.filter((c) => c.kind === 'bridge');
    expect(bridges.length).toBeGreaterThan(0);
    // RE-PINNED (GG-560, Remy 2026-11-01: "why are these bridges so massive"):
    // a deck is as wide as the street it carries plus its parapets, not 32%
    // of its length, so a plaza-wide street gives a near-square deck on this
    // schematic plan. What stays is the span: the long side crosses the whole
    // carved channel, and the short side is no wider than the widest street
    // plus parapets.
    const widest = Math.max(...plan.streetNetwork.map((s) => s.width));
    for (const br of bridges) {
      const e = br.polygon.map((p, i) => Math.hypot(br.polygon[(i + 1) % 4][0] - p[0], br.polygon[(i + 1) % 4][1] - p[1]));
      expect(Math.max(...e)).toBeGreaterThanOrEqual(2 * 1000 * WATER_CARVE_HALF_FRAC);
      expect(Math.min(...e)).toBeLessThanOrEqual(widest * 1.25);
    }
  });
});

describe('water-gates where a river crosses the wall ring (TG7)', () => {
  const bigFp: Pt[] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const river: Pt[][] = [[[500, -50], [500, 1050]]]; // straight through the town

  it('findWaterGates returns the crossing points of a river with a ring', () => {
    const ring: Pt[] = [[200, 200], [800, 200], [800, 800], [200, 800]];
    const gates = findWaterGates(ring, river);
    // A vertical river at x=500 crosses the top edge (y=200) and bottom edge (y=800).
    expect(gates.length).toBe(2);
    for (const g of gates) expect(g[0]).toBeCloseTo(500, 6);
    const ys = gates.map((g) => g[1]).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(200, 6);
    expect(ys[1]).toBeCloseTo(800, 6);
  });

  it('no gates when no water crosses the ring', () => {
    const ring: Pt[] = [[200, 200], [800, 200], [800, 800], [200, 800]];
    expect(findWaterGates(ring, [[[0, 0], [100, 100]]])).toHaveLength(0);
    expect(findWaterGates(ring, [])).toHaveLength(0);
  });

  it('a walled town with a river through it seats water-gates on its wall', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(23), { population: 12000, water: river });
    expect(plan.walls.ring.length).toBeGreaterThanOrEqual(3);
    expect(plan.walls.waterGates).toBeTruthy();
    expect(plan.walls.waterGates!.length).toBeGreaterThan(0);
  });

  it('an unwalled hamlet seats no water-gates even with a river', () => {
    const plan = generateTownPlan(bigFp, rootSeedPath(23), { population: 50, water: river });
    expect(plan.walls.ring).toHaveLength(0);
    expect(plan.walls.waterGates ?? []).toHaveLength(0);
  });
});

/**
 * TOWN-LOOK RULES (GG-544 to GG-551, Remy's town-look sheet 2026-10-31).
 * Each rule was measured against the Watabou town and village output; these
 * tests pin the rule itself, at the canonical scale (1000-unit cell, 1.2 ft
 * per unit — a 1,200 ft town, the usual span for a town under 10,000 people).
 */
describe('town-look rules (GG-544..GG-551)', () => {
  const CELL: Pt[] = [[-500, -500], [500, -500], [500, 500], [-500, 500]];
  const FPU = 1.2;
  const ROAD: Pt[] = [[-600, 40], [-200, 20], [200, -10], [600, 30]];
  const walled = generateTownPlan(CELL, rootSeedPath(31), { population: 6000, roads: [ROAD], feetPerUnit: FPU });
  const ftWide = (p: Pt[]): number => Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) * FPU;
  const centroidOf = (poly: Pt[]): Pt => {
    let x = 0, y = 0; for (const [px, py] of poly) { x += px; y += py; } return [x / poly.length, y / poly.length];
  };
  const area = (poly: Pt[]): number => {
    let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    return Math.abs(a / 2);
  };
  /** True overlap: shrink both 1% so a shared party wall is not a hit. */
  const overlaps = (a: Pt[], b: Pt[]): boolean => {
    const s = (p: Pt[]): Pt[] => { const c = centroidOf(p); return p.map(([x, y]) => [c[0] + (x - c[0]) * 0.99, c[1] + (y - c[1]) * 0.99] as Pt); };
    return polysIntersect(s(a), s(b));
  };

  it('GG-545: deep lots tile a block from every street to its rear line', () => {
    const block: Pt[] = [[0, 0], [100, 0], [100, 60], [0, 60]];
    const lots = packBlockDeep(block, rootSeedPath(5), {
      lotWidth: 20, minLotWidth: 15, maxLotWidth: 30, maxDepth: 40, snap: 5, alleyChance: 0, alleyWidth: 5,
    });
    const covered = lots.reduce((s, l) => s + area(l.polygon), 0);
    // Rows meet at the bisector: the whole block is built.
    // RE-PINNED (GG-563, Remy 2026-11-01: "pie shapes and really squished
    // houses"): a lot under 12 ft across, or with a corner under 30 degrees,
    // joins its neighbor or stays yard, and a pie tip is cut off as open
    // ground. So the rows meet at the bisector but no longer cover 99%.
    // Remy's squarish ruling (GG-563): a corner wedge that cannot hold a
    // square house joins its neighbor, so cover drops to about 0.92.
    expect(covered / area(block)).toBeGreaterThan(0.9);
    for (const l of lots) expect(houseShapeOk(l.polygon, 12, 30)).toBe(true);
    for (let i = 0; i < lots.length; i++) {
      // The street edge comes first and lies on the block boundary.
      expect(distToBoundary(lots[i].polygon[0], block)).toBeLessThan(1e-6);
      expect(distToBoundary(lots[i].polygon[1], block)).toBeLessThan(1e-6);
      for (let j = i + 1; j < lots.length; j++) expect(overlaps(lots[i].polygon, lots[j].polygon)).toBe(false);
    }
  });

  it('GG-545: deep lots never leave a concave block', () => {
    const block: Pt[] = [[0, 0], [120, 0], [120, 50], [60, 50], [60, 110], [0, 110]];
    const lots = packBlockDeep(block, rootSeedPath(6), {
      lotWidth: 20, minLotWidth: 15, maxLotWidth: 30, maxDepth: 35, snap: 5, alleyChance: 0, alleyWidth: 5,
    });
    // RE-PINNED (GG-563): the shape rule merges the slivers at the concave
    // corner, and Remy's squarish ruling merges each wedge that cannot hold
    // a square house, so the block holds 4 wider lots where it held 9.
    expect(lots.length).toBeGreaterThanOrEqual(4);
    for (const l of lots) expect(houseShapeOk(l.polygon, 12, 30)).toBe(true);
    for (const lot of lots) {
      for (const v of lot.polygon) expect(pointInPolygon(v, block) || distToBoundary(v, block) < 1e-6).toBe(true);
    }
  });

  it('GG-545: physical lots are three to six 5-ft cells wide (Watabou grain)', () => {
    const widths = walled.plots.filter((p) => p.kind === 'frontage' && p.shape === 'rect').map((p) => ftWide(p.polygon));
    expect(widths.length).toBeGreaterThan(50);
    widths.sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)];
    expect(median).toBeGreaterThanOrEqual(MIN_LOT_WIDTH_FT - 1e-6);
    expect(median).toBeLessThanOrEqual(MAX_LOT_WIDTH_FT + 1e-6);
  });

  it('GG-545: deep rows keep a back court, so shared courts survive', () => {
    const capital = generateTownPlan(CELL, rootSeedPath(32), { population: 30000, roads: [ROAD], feetPerUnit: 2 });
    expect(capital.courtyards.length).toBeGreaterThan(0);
  });

  it('GG-550: plan streets use the shared feet ladder (lane 10 ft, nothing wider than the plaza)', () => {
    const lanes = walled.streetNetwork.filter((s) => s.tier === 'lane' && !s.track);
    expect(lanes.length).toBeGreaterThan(0);
    for (const s of lanes) expect(s.width * FPU).toBeLessThanOrEqual(STREET_TIER_SPECS.lane.widthFt + 1e-6);
    for (const s of walled.streetNetwork) expect(s.width * FPU).toBeLessThanOrEqual(STREET_TIER_SPECS.plaza.widthFt + 1e-6);
  });

  it('GG-549: every gate has a way out — its road, or a field track', () => {
    expect(walled.walls.gatehouses.length).toBe(3);
    const approaches = walled.streetNetwork.filter((s) => s.role === 'approach');
    const touches = (g: Pt): boolean => approaches.some((s) =>
      s.centerline.some((p) => Math.hypot(p[0] - g[0], p[1] - g[1]) < 1e-6));
    for (const g of walled.walls.gatehouses) expect(touches(g)).toBe(true);
    // One road makes at most two road gates; the third gate gets a track.
    expect(walled.streetNetwork.some((s) => s.track)).toBe(true);
  });

  it('GG-544: suburbs stand outside the wall, after every intramural plot', () => {
    const outside = walled.plots.filter((p) => !pointInPolygon(centroidOf(p.polygon), walled.walls.ring));
    expect(outside.length).toBeGreaterThan(0);
    const firstSuburb = walled.wards.findIndex((w) => w.extramural);
    expect(firstSuburb).toBeGreaterThan(0);
    // Suburb wards come last, so intramural plot numbers keep their order.
    expect(walled.wards.slice(firstSuburb).every((w) => w.extramural)).toBe(true);
    for (const w of walled.wards) {
      for (const p of w.plots) expect(pointInPolygon(centroidOf(p.polygon), walled.walls.ring)).toBe(!w.extramural);
    }
  });

  it('GG-544: the suburb is set by how full the walls are', () => {
    const inside = walled.wards.filter((w) => !w.extramural).reduce((n, w) => n + w.plots.length, 0);
    const outside = walled.plots.length - inside;
    const fill = wallFill(6000, area(walled.walls.ring), 1000);
    expect(fill).toBeGreaterThan(0);
    // The target is fill x inside; one suburb block may overshoot it.
    const biggestBlock = Math.max(...walled.wards.filter((w) => w.extramural).map((w) => w.plots.length));
    expect(outside).toBeLessThanOrEqual(Math.round(fill * inside) + biggestBlock);
  });

  it('GG-546: the road carve follows the drawn approaches, not the raw road inside the wall', () => {
    const half = MAIN_ROAD_CARVE_HALF_FRAC * 1000;
    const inner = clipToRing(ROAD, walled.walls.ring);
    // Houses now stand along the raw road's line inside the wall, where the
    // drawn street is the routed spine and the blocks are inset for it.
    const nearRaw = walled.plots.filter((p) => p.polygon.some((v) => inner.some((seg) => segDist(v, seg[0], seg[1]) < half)));
    expect(nearRaw.length).toBeGreaterThan(0);
    for (const s of walled.streetNetwork.filter((x) => x.role === 'approach')) {
      for (let i = 0; i < s.centerline.length - 1; i++) {
        for (const p of walled.plots) {
          for (const v of p.polygon) expect(segDist(v, s.centerline[i], s.centerline[i + 1])).toBeGreaterThan(s.width / 2 - 1e-6);
        }
      }
    }
  });

  it('GG-547: a port core runs out to its shore', () => {
    const coastEdge: Pt[] = [[500, -500], [500, 500]];
    const dry = generateTownPlan(CELL, rootSeedPath(33), { population: 6000, feetPerUnit: FPU });
    const port = generateTownPlan(CELL, rootSeedPath(33), { population: 6000, feetPerUnit: FPU, water: [coastEdge], coast: [coastEdge] });
    const reach = (plan: TownPlan): number => Math.max(...plan.core.map((p) => p[0]));
    expect(500 - reach(port)).toBeLessThanOrEqual((QUAY_WIDTH_FT / FPU) * 2 + 1e-6);
    expect(reach(port)).toBeGreaterThan(reach(dry));
  });

  it('GG-548: an unwalled settlement is a lane village with a green, a church and gardens', () => {
    const village = generateTownPlan(CELL, rootSeedPath(34), { population: 400, roads: [ROAD], feetPerUnit: FPU });
    expect(village.form).toBe('lanes');
    expect(village.walls.ring).toHaveLength(0);
    expect(village.plots.length).toBeGreaterThan(20);
    const kinds = village.civic.map((c) => c.kind);
    expect(kinds).toContain('plaza');
    expect(kinds).toContain('temple');
    expect(village.openLand.some((o) => o.kind === 'garden' || o.kind === 'orchard')).toBe(true);
    // Every house fronts a lane or the village street.
    const lines = village.streetNetwork.map((s) => s.centerline);
    for (const p of village.plots) {
      const front: Pt = [(p.polygon[0][0] + p.polygon[1][0]) / 2, (p.polygon[0][1] + p.polygon[1][1]) / 2];
      const d = Math.min(...lines.flatMap((l) => l.slice(1).map((q, i) => segDist(front, l[i], q))));
      // RE-PINNED (GG-564, Remy's ruling: villages stand back behind a front
      // garden): the setback is the 15 ft garden, +/- 20%, not a quarter lot.
      expect(d * FPU).toBeLessThan(STREET_TIER_SPECS.avenue.widthFt / 2 + 15 * 1.2 + 1);
    }
    for (let i = 0; i < village.plots.length; i++) {
      for (let j = i + 1; j < village.plots.length; j++) {
        expect(overlaps(village.plots[i].polygon, village.plots[j].polygon)).toBe(false);
      }
    }
  });

  it('GG-551: farm parcels are cut into strips that carry their furrow direction', () => {
    const strips = walled.outskirts.filter((o) => o.kind === 'farm' && o.furrowAngle != null);
    expect(strips.length).toBeGreaterThan(10);
    for (const o of walled.outskirts) if (o.kind !== 'farm') expect(o.furrowAngle).toBeUndefined();
  });
});

/** Distance from p to segment ab. */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

/** The segments of a polyline whose midpoints lie inside a ring. */
function clipToRing(line: Pt[], ring: Pt[]): Array<[Pt, Pt]> {
  const out: Array<[Pt, Pt]> = [];
  for (let i = 0; i < line.length - 1; i++) {
    const steps = 40;
    for (let k = 0; k < steps; k++) {
      const a: Pt = [line[i][0] + (line[i + 1][0] - line[i][0]) * (k / steps), line[i][1] + (line[i + 1][1] - line[i][1]) * (k / steps)];
      const b: Pt = [line[i][0] + (line[i + 1][0] - line[i][0]) * ((k + 1) / steps), line[i][1] + (line[i + 1][1] - line[i][1]) * ((k + 1) / steps)];
      if (pointInPolygon([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ring)) out.push([a, b]);
    }
  }
  return out;
}

describe('town-map rules (GG-560..GG-567, Remy 2026-11-01)', () => {
  const CELL: Pt[] = [[-500, -500], [500, -500], [500, 500], [-500, 500]];
  const FPU = 1.2;
  const ROAD: Pt[] = [[-600, 40], [-200, 20], [200, -10], [600, 30]];
  const RIVER: Pt[] = [[60, -600], [40, 0], [70, 600]];
  const plain = generateTownPlan(CELL, rootSeedPath(31), { population: 6000, roads: [ROAD], feetPerUnit: FPU });
  const river = generateTownPlan(CELL, rootSeedPath(31), {
    population: 6000, roads: [ROAD], feetPerUnit: FPU,
    water: [RIVER], bridgeWater: [RIVER], waterWidth: 60,
  });
  const segD = (p: Pt, a: Pt, b: Pt): number => {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
  };
  const lineD = (p: Pt, L: Pt[]): number => Math.min(...L.slice(1).map((b, i) => segD(p, L[i], b)));
  const turnDeg = (a: Pt, b: Pt, c: Pt): number => {
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const n = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
    return n < 1e-12 ? 0 : (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))) * 180) / Math.PI;
  };

  it('GG-563: no house under 12 ft across or with a corner under 30 degrees', () => {
    for (const plan of [plain, river]) {
      for (const p of plan.plots) {
        expect(p.polygon.length).toBeGreaterThanOrEqual(4);
        expect(minWidth(p.polygon) * FPU).toBeGreaterThanOrEqual(12 - 1e-6);
        expect(Math.min(...cornerAngles(p.polygon))).toBeGreaterThanOrEqual(30 - 1e-6);
        // Remy's squarish ruling: every corner within 15 degrees of square.
        expect(isSquarish(p.polygon)).toBe(true);
      }
    }
  });

  it('GG-563: a wedge lot gets a rectangle on its street front; the rest is yard', () => {
    // A row-end wedge: 30 ft of front, one side slanted in at 60 degrees.
    const lot: Pt[] = [[0, 0], [30, 0], [30, 25], [0 + 25 / Math.tan(Math.PI / 3), 25]];
    expect(isSquarish(lot)).toBe(false);
    const rect = rectangleOnFront(lot, 12)!;
    expect(rect).not.toBeNull();
    expect(isSquarish(rect)).toBe(true);
    // Street edge first, on the lot's front line, square to it.
    expect(rect[0][1]).toBeCloseTo(0, 9);
    expect(rect[1][1]).toBeCloseTo(0, 9);
    for (const v of rect) expect(pointInPolygon(v, lot) || distToBoundary(v, lot) < 1e-6).toBe(true);
    expect(minWidth(rect)).toBeGreaterThanOrEqual(12);
    // Too small for a 12 ft square: no house.
    expect(rectangleOnFront([[0, 0], [14, 0], [3, 10]], 12)).toBeNull();
  });

  it('GG-563 block shapes: rectangle rows cut only square lots that stay in the block and apart', () => {
    // A six-sided block like a Voronoi ward, corners about 120 degrees.
    const hex: Pt[] = [[0, 0], [100, 0], [150, 70], [100, 140], [0, 140], [-50, 70]];
    const lots = packBlockRows(hex, rootSeedPath(8), {
      lotWidth: 20, minLotWidth: 15, maxLotWidth: 30, maxDepth: 40, snap: 5, alleyChance: 0, alleyWidth: 5, minHouseWidth: 12,
    });
    expect(lots.length).toBeGreaterThan(10);
    for (const l of lots) {
      expect(isSquarish(l.polygon, 1e-6)).toBe(true);
      expect(minWidth(l.polygon)).toBeGreaterThanOrEqual(12 - 1e-9);
      for (const v of l.polygon) expect(pointInPolygon(v, hex) || distToBoundary(v, hex) < 1e-6).toBe(true);
    }
    for (let i = 0; i < lots.length; i++) {
      // Shrunk 1% so a shared side cut (a party wall) is not an overlap.
      const shrink = (p: Pt[]): Pt[] => { const c = polygonCentroid(p); return p.map((v) => [c[0] + (v[0] - c[0]) * 0.99, c[1] + (v[1] - c[1]) * 0.99] as Pt); };
      for (let j = i + 1; j < lots.length; j++) expect(polysIntersect(shrink(lots[i].polygon), shrink(lots[j].polygon))).toBe(false);
    }
    // On a rectangle block every row is clean, so rows beat the bisector cut.
    const rect: Pt[] = [[0, 0], [120, 0], [120, 80], [0, 80]];
    const o = { lotWidth: 20, minLotWidth: 15, maxLotWidth: 30, maxDepth: 30, snap: 5, alleyChance: 0, alleyWidth: 5, minHouseWidth: 12 };
    expect(packBlockSquare(rect, rootSeedPath(9), o).every((l) => isSquarish(l.polygon, 1e-6))).toBe(true);
  });

  it('GG-563 block shapes: a straight-ish curve of block corners merges into one street edge', () => {
    // The front bulges out of the block by at most 1.5: convex corners.
    const arc: Pt[] = [[0, 0], [50, -1], [100, -1.5], [150, -1], [200, 0], [200, 60], [0, 60]];
    const out = simplifyConvexCorners(arc, 2);
    expect(out.length).toBeLessThan(arc.length);
    for (const v of out) expect(pointInPolygon(v, arc) || distToBoundary(v, arc) < 1e-6).toBe(true);
  });

  it('GG-564: no house reaches into a street, and the suburbs and wealthy wards have front gardens', () => {
    for (const plan of [plain, river]) {
      // Box test first; one expect per plan (millions of expect calls time out).
      const segs = plan.streetNetwork.filter((s) => s.role !== 'passage').flatMap((s) => s.centerline.slice(1).map((q, i) => {
        const p0 = s.centerline[i], h = s.width / 2;
        return { a: p0, b: q, h, x0: Math.min(p0[0], q[0]) - h, x1: Math.max(p0[0], q[0]) + h, y0: Math.min(p0[1], q[1]) - h, y1: Math.max(p0[1], q[1]) + h };
      }));
      let inRoad = 0;
      for (const p of plan.plots) {
        for (const v of p.polygon) {
          for (const s of segs) {
            if (v[0] < s.x0 || v[0] > s.x1 || v[1] < s.y0 || v[1] > s.y1) continue;
            if (segD(v, s.a, s.b) < s.h - 0.25) inRoad++;
          }
        }
      }
      expect(inRoad).toBe(0);
    }
    const front = plain.openLand.filter((o) => o.front);
    expect(front.length).toBeGreaterThan(0);
    // Every front garden lies in a suburb or a wealthy ward.
    for (const g of front) {
      const c = polygonCentroid(g.polygon);
      const ward = plain.wards.find((w) => pointInPolygon(c, w.polygon));
      expect(ward && (ward.extramural || ward.wealth === 'wealthy')).toBeTruthy();
    }
  });

  it('GG-565: every back-court house has a passage to a street that crosses no other house', () => {
    const passages = plain.streetNetwork.filter((s) => s.role === 'passage' && s.serves);
    const interior = plain.plots.filter((p) => p.kind === 'interior');
    expect(interior.length).toBeGreaterThan(0);
    for (const house of interior) {
      const way = passages.find((s) => pointInPolygon(s.centerline[0], house.polygon));
      expect(way).toBeDefined();
      for (const other of plain.plots) {
        if (other === house) continue;
        for (const v of other.polygon) expect(segD(v, way!.centerline[0], way!.centerline[1])).toBeGreaterThan(way!.width / 2 * 0.98);
      }
    }
  });

  it('GG-566: each temple and keep has grounds, a forecourt and an open approach', () => {
    const grounds = plain.civicGrounds ?? [];
    expect(grounds.map((g) => g.civicKind).sort()).toEqual(['keep', 'temple']);
    for (const g of grounds) {
      expect(g.grounds.length).toBeGreaterThanOrEqual(3);
      expect(g.approach).toHaveLength(2);
      for (const p of plain.plots) {
        expect(polysIntersect(p.polygon, g.grounds)).toBe(false);
        for (const v of p.polygon) expect(segD(v, g.approach[0], g.approach[1])).toBeGreaterThan(g.approachWidth / 2 * 0.98);
      }
      // No faith or holder was given: plain grounds.
      expect(g.setPiece).toBe('grounds');
    }
    const faithful = generateTownPlan(CELL, rootSeedPath(31), {
      population: 6000, roads: [ROAD], feetPerUnit: FPU,
      faith: { type: 'Folk', form: 'Totemism' }, holder: { form: 'Monarchy' },
    });
    const kinds = Object.fromEntries((faithful.civicGrounds ?? []).map((g) => [g.civicKind, g.setPiece]));
    expect(kinds).toEqual({ temple: 'grove', keep: 'bailey' });
  });

  it('GG-567: one main street from a gate to the market, gently curved, widest after the market ring', () => {
    for (const plan of [plain, river]) {
      const main = plan.streetNetwork.filter((s) => s.main);
      expect(main).toHaveLength(1);
      const L = main[0].centerline;
      for (let i = 1; i < L.length - 1; i++) expect(turnDeg(L[i - 1], L[i], L[i + 1])).toBeLessThanOrEqual(30);
      expect(plan.walls.gatehouses.some((g) => Math.hypot(g[0] - L[0][0], g[1] - L[0][1]) < 1e-6)).toBe(true);
      const plaza = plan.civic.find((c) => c.kind === 'plaza')!;
      const end = L[L.length - 1];
      const toPlaza = Math.min(...plaza.polygon.map((a, i) => segD(end, a, plaza.polygon[(i + 1) % plaza.polygon.length])));
      expect(toPlaza * FPU).toBeLessThan(STREET_TIER_SPECS.plaza.widthFt);
      for (const s of plan.streetNetwork) {
        if (s.main || s.tier === 'plaza' || s.role === 'approach') continue;
        expect(s.width).toBeLessThan(main[0].width);
      }
    }
  });

  it('GG-561: the river channel is cut out of the town; docks start at a bank', () => {
    const half = 30;
    for (const p of river.plots) expect(lineD(polygonCentroid(p.polygon), RIVER)).toBeGreaterThan(half);
    for (const w of river.wards) expect(lineD(polygonCentroid(w.polygon), RIVER)).toBeGreaterThan(half);
    for (const d of river.civic.filter((c) => c.kind === 'dock')) {
      const base = polygonCentroid([d.polygon[0], d.polygon[3]]);
      const tip = polygonCentroid([d.polygon[1], d.polygon[2]]);
      expect(lineD(base, RIVER)).toBeGreaterThanOrEqual(half - 1e-6);
      expect(lineD(tip, RIVER)).toBeLessThan(half);
    }
  });

  it('GG-560: each bridge is its street plus parapets wide, and no two decks touch', () => {
    const decks = river.civic.filter((c) => c.kind === 'bridge');
    expect(decks.length).toBeGreaterThan(0);
    const widths = new Set(river.streetNetwork.map((s) => +(s.width + 2 * (2 / FPU)).toFixed(6)));
    for (const d of decks) {
      const e = d.polygon.map((p, i) => Math.hypot(d.polygon[(i + 1) % 4][0] - p[0], d.polygon[(i + 1) % 4][1] - p[1]));
      const w = Math.min(...e);
      expect([...widths].some((x) => Math.abs(x - w) < 1e-6)).toBe(true);
      expect(Math.max(...e)).toBeGreaterThan(60);
    }
    for (let i = 0; i < decks.length; i++) {
      for (let j = i + 1; j < decks.length; j++) expect(polysIntersect(decks[i].polygon, decks[j].polygon)).toBe(false);
    }
  });
});
