import { describe, it, expect } from 'vitest';
import {
  generateTownPlan,
  buildIntramuralOpenLand,
  wallFill,
  type TownPlan,
  type OpenLandKind,
} from '../townEngine';
import { pointInPolygon, type Pt } from '../../submap/submapEngine';
import { rootSeedPath } from '../../seedPath';

/** A square cell big enough for a walled town at the canonical span. */
const CELL: Pt[] = [[-500, -500], [500, -500], [500, 500], [-500, 500]];

const planFor = (population: number, seed = 4242): TownPlan =>
  generateTownPlan(CELL, rootSeedPath(seed), { population });

const kindsOf = (plan: TownPlan): OpenLandKind[] => plan.openLand.map((o) => o.kind);

describe('intramural open land', () => {
  it('parcels the ground the walls enclose but the wards never built on', () => {
    const plan = planFor(2500);
    expect(plan.openLand.length).toBeGreaterThan(0);
    for (const parcel of plan.openLand) {
      expect(parcel.polygon.length).toBeGreaterThanOrEqual(3);
      expect(['rim', 'ward']).toContain(parcel.source);
    }
  });

  it('is deterministic for the same seed path and divergent for a different one', () => {
    const a = planFor(2500);
    const b = planFor(2500);
    expect(b.openLand).toEqual(a.openLand);

    const c = planFor(2500, 9191);
    expect(JSON.stringify(c.openLand)).not.toEqual(JSON.stringify(a.openLand));
  });

  it('keeps every rim parcel inside the wall ring', () => {
    const plan = planFor(2500);
    expect(plan.walls.ring.length).toBeGreaterThanOrEqual(3);
    for (const parcel of plan.openLand) {
      if (parcel.source !== 'rim') continue;
      for (const v of parcel.polygon) {
        // A hair of tolerance: the polar clamp lands vertices ON the ring.
        expect(pointInPolygon(v, plan.walls.ring) || onOrNearRing(v, plan.walls.ring)).toBe(true);
      }
    }
  });

  it('turns unbuilt non-civic ward blocks into open land and leaves the plaza alone', () => {
    // A capital packs enough wards that some come out empty at a size worth
    // parcelling; a 2,500-person town's only empty ward is a 184-unit sliver,
    // below the parcel floor, which is correctly left to the block fill.
    const plan = planFor(30000);
    const emptyNonCivic = plan.wards.filter(
      (w) => w.plots.length === 0 && w.civic == null && polyArea(w.block) > 2000,
    );
    expect(emptyNonCivic.length).toBeGreaterThan(0);
    expect(plan.openLand.some((o) => o.source === 'ward')).toBe(true);
    // No parcel may sit on a plaza: the plaza's emptiness IS the civic structure.
    const plaza = plan.civic.find((c) => c.kind === 'plaza');
    if (plaza) {
      for (const parcel of plan.openLand) {
        const c = centroid(parcel.polygon);
        expect(pointInPolygon(c, plaza.polygon)).toBe(false);
      }
    }
  });

  it('reads the kind mix off population versus footprint', () => {
    // Same footprint, 20x the people: the crowded town works its open ground as
    // yards and gardens, the empty one lets it go to orchard/paddock/ruin.
    const sparse = planFor(1600);
    const dense = planFor(32000);
    const unneeded = new Set<OpenLandKind>(['orchard', 'paddock', 'ruin']);
    const share = (p: TownPlan): number =>
      kindsOf(p).filter((k) => unneeded.has(k)).length / Math.max(1, p.openLand.length);
    expect(share(sparse)).toBeGreaterThan(share(dense));
    // Ruins are the walls' record of a bigger past — never in a full town.
    expect(kindsOf(dense)).not.toContain('ruin');
  });

  it('rises as a town holds fewer people behind the same walls', () => {
    expect(wallFill(30000, 300_000, 1000)).toBeGreaterThan(wallFill(2000, 300_000, 1000));
    expect(wallFill(0, 300_000, 1000)).toBe(0);
    expect(wallFill(1e9, 300_000, 1000)).toBe(1);
  });

  it('throws rather than quietly returning an empty region', () => {
    const plan = planFor(2500);
    const base = {
      wards: plan.wards,
      civic: plan.civic,
      center: [0, 0] as Pt,
      fpSpan: 1000,
      walled: true,
      population: 2500,
      seedPath: rootSeedPath(1),
    };
    expect(() => buildIntramuralOpenLand({ ...base, envelope: [[0, 0], [1, 1]] }))
      .toThrow(/at least 3 vertices/);
    expect(() => buildIntramuralOpenLand({ ...base, envelope: plan.walls.ring, fpSpan: 0 }))
      .toThrow(/span must be positive/);
    expect(() => buildIntramuralOpenLand({ ...base, envelope: [[0, 0], [1, 0], [2, 0]] }))
      .toThrow(/zero area/);
  });
});

function polyArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return Math.abs(a / 2);
}

function centroid(poly: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

/** Distance from `p` to the ring boundary is within a hair of zero. */
function onOrNearRing(p: Pt, ring: Pt[]): boolean {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)));
  }
  return best < 1;
}
