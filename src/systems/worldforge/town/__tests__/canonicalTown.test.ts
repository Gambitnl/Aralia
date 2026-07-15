import { describe, it, expect } from 'vitest';
import {
  canonicalTownSeedPath,
  getCanonicalTownPlan,
  transformTownPlan,
  peopleForBurg,
  townSpanFtForBurg,
  CANON_TOWN_SPAN,
} from '../canonicalTown';
import { polygonBounds } from '../../submap/submapEngine';

/** Minimal atlas fixture: one burg (id 1) in cell 0, a square cell polygon.
 *  population is in FMG POINTS — 2 points × 1000 = 2000 people ⇒ walled town. */
function makeAtlas(): any {
  return {
    pack: {
      burgs: [undefined, { i: 1, cell: 0, x: 100, y: 100, population: 2 }],
      cells: { v: [[0, 1, 2, 3]], burg: [1] },
      vertices: { p: [[60, 60], [140, 60], [140, 140], [60, 140]] },
    },
  };
}

describe('canonicalTownSeedPath', () => {
  it('is stable and burg/world addressed (drill-path independent)', () => {
    expect(canonicalTownSeedPath(42, 7)).toBe('wf:42/burg:7/s:town');
    expect(canonicalTownSeedPath(42, 7)).toBe(canonicalTownSeedPath(42, 7));
    expect(canonicalTownSeedPath(42, 7)).not.toBe(canonicalTownSeedPath(43, 7));
  });
});

describe('getCanonicalTownPlan', () => {
  it('generates a walled, warded town in the normalized frame', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    expect(plan.wards.length).toBeGreaterThan(0);
    expect(plan.plots.length).toBeGreaterThan(0);
    expect(plan.walls.ring.length).toBeGreaterThanOrEqual(3); // pop 1200 ⇒ walls
    // Normalized: footprint longest side ≈ CANON_TOWN_SPAN, centered near origin.
    const b = polygonBounds(plan.footprint);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    expect(span).toBeCloseTo(CANON_TOWN_SPAN, 0);
    expect(Math.abs((b.minX + b.maxX) / 2)).toBeLessThan(1);
    expect(Math.abs((b.minY + b.maxY) / 2)).toBeLessThan(1);
  });

  it('is deterministic: two identical atlases ⇒ structurally identical plans', () => {
    const a = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const b = getCanonicalTownPlan(makeAtlas(), 42, 1); // separate object ⇒ bypasses the cache
    expect(b.plots.length).toBe(a.plots.length);
    expect(b.wards.length).toBe(a.wards.length);
    expect(b.walls.ring).toEqual(a.walls.ring);
    expect(b.footprint).toEqual(a.footprint);
  });

  it('caches per (atlas, burgId)', () => {
    const atlas = makeAtlas();
    expect(getCanonicalTownPlan(atlas, 42, 1)).toBe(getCanonicalTownPlan(atlas, 42, 1));
  });
});

/** makeAtlas + a road crossing the cell and a river running through its centre. */
function makeAtlasWithWaterAndRoads(): any {
  return {
    pack: {
      burgs: [undefined, { i: 1, cell: 0, x: 100, y: 100, population: 2 }],
      cells: {
        v: [[0, 1, 2, 3]],
        burg: [1],
        p: { 0: [100, 100], 50: [100, 40], 51: [100, 220] },
        h: [],
        harbor: { 0: 0 },
      },
      vertices: { p: [[60, 60], [140, 60], [140, 140], [60, 140]] },
      // River flows 50 → cell 0 → 51, a vertical line through the town centre.
      rivers: [{ cells: [50, 0, 51] }],
      // A road crossing the cell horizontally.
      routes: [{ group: 'roads', points: [[0, 100], [200, 100] ] }],
    },
  };
}

describe('getCanonicalTownPlan — inherited water/roads (follow-up #1)', () => {
  it('continues an inherited road into a main street', () => {
    const plan = getCanonicalTownPlan(makeAtlasWithWaterAndRoads(), 42, 1);
    expect(plan.streets.length).toBeGreaterThan(0);
  });

  it('seats docks where an inherited river crosses the town', () => {
    const plan = getCanonicalTownPlan(makeAtlasWithWaterAndRoads(), 42, 1);
    expect(plan.wards.some((w) => w.civic === 'dock')).toBe(true);
  });

  it('produces no docks/streets for an inland burg with no rivers or roads', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    expect(plan.streets.length).toBe(0);
    expect(plan.wards.some((w) => w.civic === 'dock')).toBe(false);
  });
});

describe('transformTownPlan', () => {
  it('scales + translates every coordinate (the 3D placement step)', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const k = 3, dx = 1000, dy = 2000;
    const out = transformTownPlan(plan, k, dx, dy);
    // A representative point maps by the affine transform.
    expect(out.footprint[0][0]).toBeCloseTo(plan.footprint[0][0] * k + dx, 6);
    expect(out.footprint[0][1]).toBeCloseTo(plan.footprint[0][1] * k + dy, 6);
    // Top-level plots stay ref-identical to the flattened wards[].plots
    // (townEngine contract; some wards — e.g. a plaza — carry no plots).
    const flat = out.wards.flatMap((w) => w.plots);
    expect(out.plots.length).toBe(flat.length);
    out.plots.forEach((p, i) => expect(p).toBe(flat[i]));
    // Wall ring scales too.
    if (plan.walls.ring.length) {
      expect(out.walls.ring[0][0]).toBeCloseTo(plan.walls.ring[0][0] * k + dx, 6);
    }
    // Shared courts scale with the same affine while their district use remains
    // canonical across the normalized 2D and region-feet 3D frames.
    if (plan.courtyards.length) {
      expect(out.courtyards[0].center[0]).toBeCloseTo(plan.courtyards[0].center[0] * k + dx, 6);
      expect(out.courtyards[0].center[1]).toBeCloseTo(plan.courtyards[0].center[1] * k + dy, 6);
      expect(out.courtyards[0].radius).toBeCloseTo(plan.courtyards[0].radius * k, 6);
      expect(out.courtyards[0].amenity).toBe(plan.courtyards[0].amenity);
      expect(out.courtyards[0].courtyardSignature).toBe(plan.courtyards[0].courtyardSignature);
    }
  });

  it('round-trips back to the source plan (identity proof)', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const k = 7.5, dx = 500, dy = -300;
    const fwd = transformTownPlan(plan, k, dx, dy);
    const back = transformTownPlan(fwd, 1 / k, -dx / k, -dy / k);
    for (let i = 0; i < plan.footprint.length; i++) {
      expect(back.footprint[i][0]).toBeCloseTo(plan.footprint[i][0], 4);
      expect(back.footprint[i][1]).toBeCloseTo(plan.footprint[i][1], 4);
    }
  });

  it('preserves social and architecture identity while transforming geometry', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const out = transformTownPlan(plan, 3, 1000, 2000);

    expect(out.wards.map((ward) => ward.wealth)).toEqual(
      plan.wards.map((ward) => ward.wealth),
    );
    expect(out.wards.map((ward) => ward.architectureDistrict)).toEqual(
      plan.wards.map((ward) => ward.architectureDistrict),
    );
    expect(out.plots.map((plot) => plot.architectureKey)).toEqual(
      plan.plots.map((plot) => plot.architectureKey),
    );
    expect(out.courtyards.map((court) => ({
      districtKey: court.districtKey,
      amenity: court.amenity,
      signature: court.courtyardSignature,
    }))).toEqual(plan.courtyards.map((court) => ({
      districtKey: court.districtKey,
      amenity: court.amenity,
      signature: court.courtyardSignature,
    })));
  });
});

describe('population scaling', () => {
  it('peopleForBurg scales FMG points by the population rate (1000)', () => {
    expect(peopleForBurg(makeAtlas(), 1)).toBe(2000); // 2 points × 1000
  });
  it('townSpanFtForBurg clamps to a walkable [800, 6000] ft range', () => {
    const span = townSpanFtForBurg(makeAtlas(), 1);
    expect(span).toBeGreaterThanOrEqual(800);
    expect(span).toBeLessThanOrEqual(6000);
  });
});
